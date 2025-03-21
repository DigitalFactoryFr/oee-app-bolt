import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Check, Search, ChevronLeft, AlertOctagon, Trash2 } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import QualityTypeSelect from '../../../components/data/QualityTypeSelect';
import type { QualityIssue } from '../../../types';
import { supabase } from '../../../lib/supabase';

interface QualityIssueFormData {
  category: string;
  quantity: number;
  cause: string;
  comment?: string;
  end_time?: string;
}

const EditQualityIssue: React.FC = () => {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<any>(null);
  const [commonCauses, setCommonCauses] = useState<string[]>([]);
  const [causeSearch, setCauseSearch] = useState('');
  const [selectedCause, setSelectedCause] = useState('');
  const [filteredCauses, setFilteredCauses] = useState<string[]>([]);
  const [showCausesList, setShowCausesList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCommonCauses } = useDataStore();

  // 1. Add state for the delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<QualityIssueFormData>();

  useEffect(() => {
    if (projectId) {
      loadQualityIssue();
      loadCommonCauses();
    }
  }, [projectId, issueId]);

  useEffect(() => {
    const filtered = commonCauses.filter(cause =>
      cause.toLowerCase().includes(causeSearch.toLowerCase())
    );
    setFilteredCauses(filtered);
  }, [causeSearch, commonCauses]);

  const loadQualityIssue = async () => {
    if (!issueId) return;

    try {
      const { data, error } = await supabase
        .from('quality_issues')
        .select(`
          *,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
        `)
        .eq('id', issueId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Quality issue not found');

      setIssue(data);
      setValue('category', data.category);
      setValue('quantity', data.quantity);
      setValue('cause', data.cause);
      setSelectedCause(data.cause);
      setCauseSearch(data.cause);
      setValue('comment', data.comment);

      // Set end time if it exists, otherwise use current local time
      if (data.end_time) {
        setValue('end_time', new Date(data.end_time).toISOString().slice(0, 16));
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setValue('end_time', `${year}-${month}-${day}T${hours}:${minutes}`);
      }
    } catch (err) {
      console.error('Error loading quality issue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality issue');
    }
  };

  const loadCommonCauses = async () => {
    if (!projectId) return;
    const causes = await getCommonCauses(projectId);
    setCommonCauses(causes);
  };

  const onSubmit = async (data: QualityIssueFormData) => {
    if (!projectId || !issueId) return;

    try {
      setLoading(true);
      setError(null);

      const updateData: Partial<QualityIssue> = {
        category: data.category,
        quantity: data.quantity,
        cause: selectedCause || data.cause,
        comment: data.comment,
      };

      if (data.end_time) {
        updateData.end_time = new Date(data.end_time).toISOString();
        updateData.status = 'completed';
      }

      const { error } = await supabase
        .from('quality_issues')
        .update(updateData)
        .eq('id', issueId);

      if (error) throw error;

      navigate(`/projects/${projectId}/quality`);
    } catch (err) {
      console.error('Error updating quality issue:', err);
      setError(err instanceof Error ? err.message : 'Failed to update quality issue');
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

  // 2. Create a function to confirm deletion using Supabase
  const confirmDelete = async () => {
    if (!projectId || !issueId) return;
    
    try {
      setLoading(true);
      // Delete the quality issue from the database
      const { error } = await supabase
        .from('quality_issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;

      // Redirect after deletion
      navigate(`/projects/${projectId}/quality`);
    } catch (err) {
      console.error('Error deleting quality issue:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete quality issue');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (!issue) {
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
                onClick={() => navigate(`/projects/${projectId}/quality`)}
                className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Edit Quality Issue</h1>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {/* Issue Info */}
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Product</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {issue.products.name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Machine</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {issue.machines.name}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Team Member</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 truncate">
                    {formatEmail(issue.team_members.email)}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-5 sm:p-6 space-y-6">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
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
                            onClick={() => {
                              handleCauseSelect(cause);
                            }}
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

            {/* Action Buttons */}
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectId}/quality`)}
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
                  <AlertOctagon className="h-4 w-4 mr-2" />
                  Update Quality Issue
                </button>

                {/* 3. Add a button to open the delete modal */}
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Quality Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Display the confirmation modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            {/* Centering trick */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Delete Quality Issue
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this quality issue? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={loading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
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

export default EditQualityIssue;
