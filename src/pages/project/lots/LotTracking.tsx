import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Check, ArrowLeft, Clock, Package, User, Activity } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useTeamStore } from '../../../store/teamStore';
import { useProductStore } from '../../../store/productStore';
import { useMachineStore } from '../../../store/machineStore';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import CompleteLotDialog from '../../../components/lots/CompleteLotDialog';
import type { LotData, LotTracking } from '../../../types';
import { supabase } from '../../../lib/supabase';

interface TrackingFormData {
  start_time: string;
  end_time: string;
  parts_produced: number;
  comment?: string;
}

const LotTrackingPage: React.FC = () => {
  const { projectId, lotId } = useParams<{ projectId: string; lotId: string }>();
  const navigate = useNavigate();
  const [lot, setLot] = useState<any>(null);
  const [trackings, setTrackings] = useState<LotTracking[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const { getLotTrackings, addLotTracking, completeLot, loading, error } = useDataStore();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<TrackingFormData>();

  useEffect(() => {
    loadLotData();
  }, [lotId]);

  const loadLotData = async () => {
    if (!lotId) return;

    try {
      // Fetch lot with related data
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select(`
          *,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
        `)
        .eq('id', lotId)
        .single();

      if (lotError) throw lotError;
      if (!lotData) throw new Error('Lot not found');

      setLot(lotData);

      // Load trackings
      const lotTrackings = await getLotTrackings(lotId);
      setTrackings(lotTrackings);

      // Set initial time period based on lot start time or last tracking
      if (lotTrackings.length === 0) {
        // For first entry, use lot start time
        const startTime = new Date(lotData.start_time);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        setValue('start_time', startTime.toTimeString().slice(0, 5));
        setValue('end_time', endTime.toTimeString().slice(0, 5));
      } else {
        // For subsequent entries, use last tracking end time + 1 hour
        const lastTracking = lotTrackings[lotTrackings.length - 1];
        const startTime = new Date(lastTracking.end_time);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        setValue('start_time', startTime.toTimeString().slice(0, 5));
        setValue('end_time', endTime.toTimeString().slice(0, 5));
      }
    } catch (err) {
      console.error('Error loading lot data:', err);
    }
  };

  const onSubmit = async (data: TrackingFormData) => {
    if (!lotId || !lot) return;

    try {
      const partsProduced = parseInt(data.parts_produced.toString(), 10);
      const tracking = await addLotTracking(lotId, {
        ...data,
        parts_produced: partsProduced,
        date: lot.date
      });

      // Update trackings list
      setTrackings([...trackings, tracking]);

      // Calculate new total and update lot data
      const newTotal = trackings.reduce((sum, t) => sum + t.parts_produced, 0) + partsProduced;
      setLot({ ...lot, ok_parts_produced: newTotal });

      // Set up next time period
      const nextStartTime = new Date(`${lot.date}T${data.end_time}`);
      const nextEndTime = new Date(nextStartTime);
      nextEndTime.setHours(nextEndTime.getHours() + 1);

      reset({
        start_time: nextStartTime.toTimeString().slice(0, 5),
        end_time: nextEndTime.toTimeString().slice(0, 5),
        parts_produced: 0
      });
    } catch (err) {
      console.error('Error adding tracking:', err);
    }
  };

  const handleCompleteLot = async () => {
    if (!lotId || !lot) return;
    
    try {
      await completeLot(lotId);
      navigate(`/projects/${projectId}/lots`);
    } catch (err) {
      console.error('Error completing lot:', err);
    }
  };

  // Calculate total parts produced and efficiency
  const totalPartsProduced = trackings.reduce((sum, t) => sum + parseInt(t.parts_produced.toString(), 10), 0);
  const efficiency = lot?.lot_size 
    ? Math.round((totalPartsProduced / lot.lot_size) * 100) 
    : 0;

  if (!lot) {
    return (
      <ProjectLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <button
                onClick={() => navigate(`/projects/${projectId}/lots`)}
                className="mr-4 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                  Production Lot {lot?.lot_id || 'Loading...'}
                </h2>
                <div className="mt-1 flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    lot?.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {lot?.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {lot?.status === 'in_progress' && (
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                type="button"
                onClick={() => setShowCompleteDialog(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Check className="h-4 w-4 mr-2" />
                Complete Lot
              </button>
            </div>
          )}
        </div>

        {/* Lot Info Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Product</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {lot.products.name}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Machine</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {lot.machines.name}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Team Member</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {lot.team_members.email.split('@')[0]}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Time Period</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {new Date(lot.start_time).toLocaleTimeString().slice(0, -3)} - {new Date(lot.end_time).toLocaleTimeString().slice(0, -3)}
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Production Progress</h3>
              <div className="mt-2">
                <div className="text-3xl font-bold text-gray-900">
                  {lot.ok_parts_produced} / {lot.lot_size}
                </div>
                <div className={`text-sm ${
                  efficiency >= 90 ? 'text-green-600' :
                  efficiency >= 70 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {efficiency}% Efficiency
                </div>
              </div>
            </div>
            <div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${efficiency}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      efficiency >= 90 ? 'bg-green-500' :
                      efficiency >= 70 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Tracking Form */}
        {lot?.status === 'in_progress' && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Production Entry</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <input
                  type="time"
                  {...register('start_time', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                  End Time
                </label>
                <input
                  type="time"
                  {...register('end_time', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="parts_produced" className="block text-sm font-medium text-gray-700">
                  Parts Produced
                </label>
                <input
                  type="number"
                  min="0"
                  {...register('parts_produced', { 
                    required: true, 
                    min: 0,
                    valueAsNumber: true
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </button>
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  Comments (Optional)
                </label>
                <textarea
                  {...register('comment')}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Add any notes about this production period..."
                />
              </div>
            </form>
          </div>
        )}

        {/* Tracking History */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Production History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Period
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parts Produced
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trackings.map((tracking) => (
                  <tr key={tracking.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(tracking.start_time).toLocaleTimeString().slice(0, -3)} - {new Date(tracking.end_time).toLocaleTimeString().slice(0, -3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {parseInt(tracking.parts_produced.toString(), 10)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tracking.comment || '-'}
                    </td>
                  </tr>
                ))}
                {trackings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No tracking entries yet
                    </td>
                  </tr>
                )}
              </tbody>
              {trackings.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      Total Parts Produced
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {totalPartsProduced}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Complete Lot Dialog */}
        {showCompleteDialog && lot && (
          <CompleteLotDialog
            onConfirm={handleCompleteLot}
            onCancel={() => setShowCompleteDialog(false)}
            totalParts={totalPartsProduced}
            theoreticalParts={lot.lot_size}
          />
        )}
      </div>
    </ProjectLayout>
  );
};

export default LotTrackingPage;