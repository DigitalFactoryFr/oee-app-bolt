import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Plus,
  Check,
  ArrowLeft,
  Trash2,
  Edit2
} from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import CompleteLotDialog from '../../../components/lots/CompleteLotDialog';
import type { LotTracking } from '../../../types';
import { supabase } from '../../../lib/supabase';

// Types pour le formulaire de tracking
interface TrackingFormData {
  start_time: string;
  end_time: string;
  parts_produced: number;
  comment?: string;
}

// Fonction utilitaire : calcule la durée (HHh MMm) entre start et end
// Si end n'est pas défini, on calcule jusqu'à "maintenant".
const getDuration = (start: string, end?: string) => {
  const endTime = end ? new Date(end) : new Date();
  const diff = endTime.getTime() - new Date(start).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
};

const LotTrackingPage: React.FC = () => {
  const { projectId, lotId } = useParams<{ projectId: string; lotId: string }>();
  const navigate = useNavigate();

  // État principal pour le lot
  const [lot, setLot] = useState<any>(null);
  // Suivi de production
  const [trackings, setTrackings] = useState<LotTracking[]>([]);
  // Stop events
  const [stopEvents, setStopEvents] = useState<any[]>([]);
  // Quality issues
  const [qualityIssues, setQualityIssues] = useState<any[]>([]);

  // Dialogs
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteLotModal, setShowDeleteLotModal] = useState(false);

  // Fonctions importées depuis votre dataStore
  const { getLotTrackings, addLotTracking, completeLot, loading } = useDataStore();

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<TrackingFormData>();

  // Charge les données au montage
  useEffect(() => {
    loadLotData();
  }, [lotId]);

  // Charge les infos du lot + events + issues
  const loadLotData = async () => {
    if (!lotId) return;
    try {
      // Récupération du lot + infos associées
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

      // Trackings
      const lotTrackings = await getLotTrackings(lotId);
      setTrackings(lotTrackings);

      // Stop Events
      const { data: stopData, error: stopError } = await supabase
        .from('stop_events')
        .select('*')
        .eq('lot_id', lotId);
      if (stopError) throw stopError;
      setStopEvents(stopData || []);

      // Quality Issues
      const { data: issuesData, error: issuesError } = await supabase
        .from('quality_issues')
        .select('*')
        .eq('lot_id', lotId);
      if (issuesError) throw issuesError;
      setQualityIssues(issuesData || []);

      // Pré-remplir le formulaire pour le tracking
      if (lotTrackings.length === 0) {
        const startTime = new Date(lotData.start_time);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);
        setValue('start_time', startTime.toTimeString().slice(0, 5));
        setValue('end_time', endTime.toTimeString().slice(0, 5));
      } else {
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

  // Soumission du formulaire de tracking
  const onSubmit = async (data: TrackingFormData) => {
    if (!lotId || !lot) return;
    try {
      const partsProduced = parseInt(data.parts_produced.toString(), 10);
      const tracking = await addLotTracking(lotId, {
        ...data,
        parts_produced: partsProduced,
        date: lot.date
      });
      setTrackings((prev) => [...prev, tracking]);

      // Mettre à jour l'UI
      const newTotal = trackings.reduce((sum, t) => sum + t.parts_produced, 0) + partsProduced;
      setLot({ ...lot, ok_parts_produced: newTotal });

      // Recalcule la période par défaut pour la prochaine saisie
      const nextStartTime = new Date(`${lot.date}T${data.end_time}`);
      const nextEndTime = new Date(nextStartTime);
      nextEndTime.setHours(nextEndTime.getHours() + 1);
      reset({
        start_time: nextStartTime.toTimeString().slice(0, 5),
        end_time: nextEndTime.toTimeString().slice(0, 5),
        parts_produced: 0,
        comment: ''
      });
    } catch (err) {
      console.error('Error adding tracking:', err);
    }
  };

  // Marquer le lot comme "completed"
  const handleCompleteLot = async () => {
    if (!lotId || !lot) return;
    try {
      await completeLot(lotId);
      navigate(`/projects/${projectId}/lots`);
    } catch (err) {
      console.error('Error completing lot:', err);
    }
  };

  // Supprimer le lot
  const handleDeleteLot = async () => {
    if (!lotId) return;
    try {
      const { error: deleteError } = await supabase
        .from('lots')
        .delete()
        .eq('id', lotId);
      if (deleteError) throw deleteError;
      navigate(`/projects/${projectId}/lots`);
    } catch (err) {
      console.error('Error deleting lot:', err);
    } finally {
      setShowDeleteLotModal(false);
    }
  };

  // Calculs pour la progression
  const totalPartsProduced = trackings.reduce((sum, t) => sum + parseInt(t.parts_produced.toString(), 10), 0);
  const efficiency = lot?.lot_size ? Math.round((totalPartsProduced / lot.lot_size) * 100) : 0;

  // Loader si le lot n'est pas encore chargé
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
                {/* Titre : inclure lot_id si existant */}
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                  Production Lot {lot?.lot_id ?? ''} 
                  {lot?.status === 'in_progress' && ' (In Progress)'}
                  {lot?.status === 'completed' && ' (Completed)'}
                </h2>
                <div className="mt-1 flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Status:</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lot?.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
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
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
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
            <div className="mt-1 text-lg font-semibold text-gray-900">{lot?.products?.name}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Machine</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{lot?.machines?.name}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Team Member</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {lot?.team_members?.email.split('@')[0]}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Time Period</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {new Date(lot?.start_time).toLocaleTimeString().slice(0, -3)} -{' '}
              {new Date(lot?.end_time).toLocaleTimeString().slice(0, -3)}
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
                  {lot?.ok_parts_produced} / {lot?.lot_size}
                </div>
                <div
                  className={`text-sm ${
                    efficiency >= 90
                      ? 'text-green-600'
                      : efficiency >= 70
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
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
                      efficiency >= 90
                        ? 'bg-green-500'
                        : efficiency >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
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
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-4"
            >
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
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
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

        {/* Production History */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Production History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Parts Produced
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trackings.map((tracking) => (
                  <tr key={tracking.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(tracking.start_time).toLocaleTimeString().slice(0, -3)} -{' '}
                      {new Date(tracking.end_time).toLocaleTimeString().slice(0, -3)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {parseInt(tracking.parts_produced.toString(), 10)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
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

        {/* Stop Events Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Stop Events</h3>
            {lot?.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/stops/new?lotId=${lotId}`)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stop Event
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cause
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comment
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stopEvents.map((event) => (
                  <tr
                    key={event.id}
                    // Onclick sur la ligne ou la cellule si vous préférez
                    onClick={() => navigate(`/projects/${projectId}/stops/${event.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(event.start_time).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(event.start_time).toLocaleTimeString().slice(0, -3)} -{' '}
                      {event.end_time
                        ? new Date(event.end_time).toLocaleTimeString().slice(0, -3)
                        : new Date().toLocaleTimeString().slice(0, -3)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {getDuration(event.start_time, event.end_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{event.cause || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{event.comment || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Évite le clic sur la ligne
                          navigate(`/projects/${projectId}/stops/${event.id}`); // OU /edit si besoin
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {stopEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No stop events yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Issues Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Quality Issues</h3>
            {lot?.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/quality/new?lotId=${lotId}`)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Quality Issue
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cause
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comment
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {qualityIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/projects/${projectId}/quality/${issue.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(issue.start_time).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {issue.category} - {issue.quantity} pcs
                    </td>
                    {/* Durée "à la sauce" quality issues */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {getDuration(issue.start_time, issue.end_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{issue.cause || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{issue.comment || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${projectId}/quality/${issue.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {qualityIssues.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No quality issues yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex flex-wrap justify-between items-center">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/lots`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteLotModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Lot
            </button>
          </div>
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

      {/* Delete Lot Confirmation Modal */}
      {showDeleteLotModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Delete Lot
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this lot? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={handleDeleteLot}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:col-start-2 sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteLotModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProjectLayout>
  );
};

export default LotTrackingPage;
