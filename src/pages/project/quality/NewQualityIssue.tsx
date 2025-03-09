import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, Check, Search, ChevronLeft, Calendar, Clock as ClockIcon } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useTeamStore } from '../../../store/teamStore';
import { useProductStore } from '../../../store/productStore';
import { useMachineStore } from '../../../store/machineStore';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import QualityTypeSelect from '../../../components/data/QualityTypeSelect';
import type { QualityIssue } from '../../../types';

interface QualityIssueFormData {
  date: string;
  start_time: string;
  end_time?: string;
  category: string;
  quantity: number;
  cause: string;
  comment?: string;
  is_ongoing: boolean;
}

const NewQualityIssue: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { members, fetchMembers } = useTeamStore();
  const { products, fetchProducts } = useProductStore();
  const { machines, fetchMachines } = useMachineStore();
  const { createQualityIssue, getActiveLot, getCommonCauses, loading, error } = useDataStore();
  
  const [activeLot, setActiveLot] = useState<any>(null);
  const [commonCauses, setCommonCauses] = useState<string[]>([]);
  const [causeSearch, setCauseSearch] = useState('');
  const [selectedCause, setSelectedCause] = useState('');
  const [filteredCauses, setFilteredCauses] = useState<string[]>([]);
  const [showCausesList, setShowCausesList] = useState(false);
  const [isOngoing, setIsOngoing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<QualityIssueFormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      start_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      quantity: 1,
      is_ongoing: false
    }
  });

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

  const onSubmit = async (data: QualityIssueFormData) => {
    if (!projectId || !activeLot) return;

    try {
      const qualityIssue: Partial<QualityIssue> = {
        date: data.date,
        start_time: `${data.date}T${data.start_time}:00.000Z`,
        end_time: isOngoing ? undefined : `${data.date}T${data.end_time}:00.000Z`,
        team_member: activeLot.team_member,
        product: activeLot.product,
        machine: activeLot.machine,
        category: data.category,
        quantity: data.quantity,
        cause: selectedCause || data.cause,
        comment: data.comment,
        lot_id: activeLot.id,
        status: isOngoing ? 'ongoing' : 'completed',
        is_ongoing: isOngoing
      };

      await createQualityIssue(projectId, qualityIssue);
      navigate(`/projects/${projectId}/lots/${activeLot.id}`);
    } catch (err) {
      console.error('Error creating quality issue:', err);
    }
  };

  const handleCauseSelect = (cause: string) => {
    setSelectedCause(cause);
    setCauseSearch(cause);
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
                  You need an active production lot to record quality issues.
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
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <button
                onClick={() => navigate(`/projects/${projectId}/quality/select-lot`)}
                className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Record Quality Issue</h1>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {/* Lot Info */}
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Product</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {activeLot.product_name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Machine</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {activeLot.machine_name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Team Member</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {activeLot.team_member_name?.split('@')[0]}
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-5 sm:p-6 space-y-6">
              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="h-4 w-4 inline-block mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    {...register('date')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <ClockIcon className="h-4 w-4 inline-block mr-1" />
                    Start Time
                  </label>
                  <input
                    type="time"
                    {...register('start_time')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <QualityTypeSelect
                  value={watch('category')}
                  onChange={(value) => setValue('category', value)}
                  className="w-full"
                />
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  {...register('quantity', {
                    required: 'Quantity is required',
                    min: { value: 1, message: 'Quantity must be at least 1' }
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                )}
              </div>

              {/* Cause */}
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

              {/* Ongoing Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isOngoing"
                    checked={isOngoing}
                    onChange={(e) => setIsOngoing(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isOngoing" className="ml-2 block text-sm text-gray-900">
                    Issue is still ongoing
                  </label>
                </div>

                {!isOngoing && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      {...register('end_time')}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Comments */}
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
            </form>

            {/* Actions */}
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectId}/quality/select-lot`)}
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
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Record Quality Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default NewQualityIssue;