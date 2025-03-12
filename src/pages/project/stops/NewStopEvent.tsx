import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, Check, Search, Clock, Package, User, Activity } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useTeamStore } from '../../../store/teamStore';
import { useProductStore } from '../../../store/productStore';
import { useMachineStore } from '../../../store/machineStore';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import FailureTypeSelect from '../../../components/data/FailureTypeSelect';
import type { StopEvent } from '../../../types';

interface StopEventFormData {
  lot_id?: string;
  failure_type: string;
  cause: string;
  comment?: string;
  end_time?: string;
}

const NewStopEvent: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { members, fetchMembers } = useTeamStore();
  const { products, fetchProducts } = useProductStore();
  const { machines, fetchMachines } = useMachineStore();
  const { createStopEvent, getActiveLot, getCommonCauses, loading, error } = useDataStore();
  
  const [activeLot, setActiveLot] = useState<any>(null);
  const [commonCauses, setCommonCauses] = useState<string[]>([]);
  const [causeSearch, setCauseSearch] = useState('');
  const [filteredCauses, setFilteredCauses] = useState<string[]>([]);
  const [showCausesList, setShowCausesList] = useState(false);
  const [isOngoing, setIsOngoing] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<StopEventFormData>();

  const selectedFailureType = watch('failure_type');
  const selectedCause = watch('cause');

  useEffect(() => {
    if (projectId) {
      fetchMembers(projectId);
      fetchProducts(projectId);
      fetchMachines(projectId);
      loadActiveLot();
      loadCommonCauses();
    }
  }, [projectId]);

  useEffect(() => {
    const filtered = commonCauses.filter(cause =>
      cause.toLowerCase().includes(causeSearch.toLowerCase())
    );
    setFilteredCauses(filtered);
  }, [causeSearch, commonCauses]);

  const loadActiveLot = async () => {
    if (!projectId || !user?.email) return;
    const lot = await getActiveLot(projectId, user.email);
    setActiveLot(lot);
  };

  const loadCommonCauses = async () => {
    if (!projectId) return;
    const causes = await getCommonCauses(projectId);
    setCommonCauses(causes);
  };

  const onSubmit = async (data: StopEventFormData) => {
    if (!projectId || !activeLot) return;

    try {
      const stopEvent: Partial<StopEvent> = {
        date: new Date().toISOString().split('T')[0],
        start_time: new Date().toISOString(),
        end_time: isOngoing ? undefined : data.end_time,
        team_member: activeLot.team_member,
        product: activeLot.product,
        machine: activeLot.machine,
        failure_type: data.failure_type,
        cause: data.cause,
        comment: data.comment,
        lot_id: activeLot.id,
        status: isOngoing ? 'ongoing' : 'completed'
      };

      await createStopEvent(projectId, stopEvent);
      navigate(`/projects/${projectId}/lots/${activeLot.id}`);
    } catch (err) {
      console.error('Error creating stop event:', err);
    }
  };

  const handleCauseSelect = (cause: string) => {
    setValue('cause', cause);
    setShowCausesList(false);
  };

  if (!activeLot) {
    return (
      <ProjectLayout>
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">No Active Lot</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  You need an active production lot to record stop events.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${projectId}/lots/new`)}
                    className="text-sm font-medium text-yellow-800 hover:text-yellow-700"
                  >
                    Create New Lot <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Record Stop Event</h2>
          <p className="mt-1 text-sm text-gray-500">
            Record a production stop event for the current lot.
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          {/* Active Lot Info */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Product</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {activeLot.product_name}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Machine</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {activeLot.machine_name}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Operator</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {activeLot.team_member_name}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Failure Type
              </label>
              <div className="mt-1">
                <FailureTypeSelect
                  value={selectedFailureType}
                  onChange={(value) => setValue('failure_type', value)}
                />
              </div>
              {errors.failure_type && (
                <p className="mt-1 text-sm text-red-600">{errors.failure_type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cause
              </label>
              <div className="mt-1 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={causeSearch}
                    onChange={(e) => {
                      setCauseSearch(e.target.value);
                      setShowCausesList(true);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search or enter new cause..."
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                {showCausesList && filteredCauses.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200">
                    <ul className="max-h-60 overflow-auto py-1">
                      {filteredCauses.map((cause, index) => (
                        <li
                          key={index}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => handleCauseSelect(cause)}
                        >
                          {cause}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <input
                type="hidden"
                {...register('cause', { required: 'Cause is required' })}
              />
              {errors.cause && (
                <p className="mt-1 text-sm text-red-600">{errors.cause.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="isOngoing"
                  checked={isOngoing}
                  onChange={(e) => setIsOngoing(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isOngoing" className="ml-2 block text-sm text-gray-900">
                  Stop is still ongoing
                </label>
              </div>

              {!isOngoing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    End Time
                  </label>
                  <div className="mt-1">
                    <input
                      type="datetime-local"
                      {...register('end_time')}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Comments (Optional)
              </label>
              <div className="mt-1">
                <textarea
                  {...register('comment')}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/lots/${activeLot.id}`)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Clock className="h-4 w-4 mr-2" />
                Record Stop Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default NewStopEvent;