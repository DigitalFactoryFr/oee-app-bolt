import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Check, Clock, Search, ChevronLeft } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import FailureTypeSelect from '../../../components/data/FailureTypeSelect';
import type { StopEvent } from '../../../types';
import { supabase } from '../../../lib/supabase';

interface StopEventFormData {
  failure_type: string;
  cause: string;
  comment?: string;
  end_time?: string;
}

const EditStopEvent: React.FC = () => {
  const { projectId, stopId } = useParams<{ projectId: string; stopId: string }>();
  const navigate = useNavigate();
  const [stop, setStop] = useState<any>(null);
  const [commonCauses, setCommonCauses] = useState<string[]>([]);
  const [causeSearch, setCauseSearch] = useState('');
  const [selectedCause, setSelectedCause] = useState('');
  const [filteredCauses, setFilteredCauses] = useState<string[]>([]);
  const [showCausesList, setShowCausesList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCommonCauses } = useDataStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<StopEventFormData>();

  useEffect(() => {
    if (projectId) {
      loadStopEvent();
      loadCommonCauses();
    }
  }, [projectId, stopId]);

  useEffect(() => {
    const filtered = commonCauses.filter(cause =>
      cause.toLowerCase().includes(causeSearch.toLowerCase())
    );
    setFilteredCauses(filtered);
  }, [causeSearch, commonCauses]);

  const loadStopEvent = async () => {
    if (!stopId) return;

    try {
      const { data, error } = await supabase
        .from('stop_events')
        .select(`
          *,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
        `)
        .eq('id', stopId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Stop event not found');

      setStop(data);
      setValue('failure_type', data.failure_type);
      setValue('cause', data.cause);
      setSelectedCause(data.cause);
      setCauseSearch(data.cause);
      setValue('comment', data.comment);

      // Set end time to current local time if not already set
      if (data.end_time) {
        setValue('end_time', new Date(data.end_time).toISOString().slice(0, 16));
      } else {
        // Format current local time for datetime-local input
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setValue('end_time', `${year}-${month}-${day}T${hours}:${minutes}`);
      }
    } catch (err) {
      console.error('Error loading stop event:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stop event');
    }
  };

  const loadCommonCauses = async () => {
    if (!projectId) return;
    const causes = await getCommonCauses(projectId);
    setCommonCauses(causes);
  };

  const onSubmit = async (data: StopEventFormData) => {
    if (!projectId || !stopId) return;

    try {
      setLoading(true);
      setError(null);

      const updateData: Partial<StopEvent> = {
        failure_type: data.failure_type,
        cause: selectedCause || data.cause,
        comment: data.comment,
      };

      if (data.end_time) {
        updateData.end_time = new Date(data.end_time).toISOString();
        updateData.status = 'completed';
      }

      const { error } = await supabase
        .from('stop_events')
        .update(updateData)
        .eq('id', stopId);

      if (error) throw error;

      navigate(`/projects/${projectId}/stops`);
    } catch (err) {
      console.error('Error updating stop event:', err);
      setError(err instanceof Error ? err.message : 'Failed to update stop event');
    } finally {
      setLoading(false);
    }
  };

  const handleCauseSelect = (cause: string) => {
    setSelectedCause(cause);
    setCauseSearch(cause);
    setShowCausesList(false);
  };

  const formatEmail = (email: string) => email.split('@')[0];

  if (!stop) {
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
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <button
                onClick={() => navigate(`/projects/${projectId}/stops`)}
                className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Edit Stop Event</h1>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {/* Stop Info */}
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Product</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {stop.products.name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Machine</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {stop.machines.name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Team Member</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {formatEmail(stop.team_members.email)}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-5 sm:p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Failure Type
                </label>
                <FailureTypeSelect
                  value={watch('failure_type')}
                  onChange={(value) => setValue('failure_type', value)}
                  className="w-full"
                />
                {errors.failure_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.failure_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cause
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={causeSearch}
                    onChange={(e) => {
                      setCauseSearch(e.target.value);
                      setSelectedCause(e.target.value);
                      setShowCausesList(true);
                    }}
                    className={`block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.cause ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Search or enter new cause..."
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <Search className="h-4 w-4 text-gray-400" />
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
                {errors.cause && (
                  <p className="mt-1 text-sm text-red-600">Please enter a cause</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  {...register('end_time')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Current local time is set by default. You can modify it manually.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (Optional)
                </label>
                <textarea
                  {...register('comment')}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Add any additional notes..."
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectId}/stops`)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit(onSubmit)}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Update Stop Event
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default EditStopEvent;