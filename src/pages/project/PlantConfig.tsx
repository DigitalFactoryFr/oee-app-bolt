import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Check, Trash2 } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { usePlantConfigStore } from '../../store/plantConfigStore';
import { useProjectStore } from '../../store/projectStore';
import { useOnboardingStore } from '../../store/onboardingStore';

interface PlantConfigFormData {
  name: string;
  opening_time_minutes: number;
  description: string;
  address: string;
}

const PlantConfigPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { plantConfig, loading, error, fetchPlantConfig, createPlantConfig, updatePlantConfig } = usePlantConfigStore();
  const { deleteProject, clearCurrentProject } = useProjectStore();
  const { updateStepStatus } = useOnboardingStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset
  } = useForm<PlantConfigFormData>({
    defaultValues: {
      opening_time_minutes: 480
    }
  });

  useEffect(() => {
    if (projectId) {
      fetchPlantConfig(projectId);
    }
  }, [projectId, fetchPlantConfig]);

  useEffect(() => {
    if (plantConfig) {
      setValue('name', plantConfig.name);
      setValue('opening_time_minutes', plantConfig.opening_time_minutes);
      setValue('description', plantConfig.description || '');
      setValue('address', plantConfig.address || '');
      
      if (plantConfig.status === 'completed') {
        updateStepStatus('plant', 'completed');
      }
    }
  }, [plantConfig, setValue, updateStepStatus]);

  const onSubmit = async (data: PlantConfigFormData) => {
    if (!projectId) return;

    try {
      if (plantConfig) {
        await updatePlantConfig(plantConfig.id, {
          ...data,
          status: 'completed'
        });
      } else {
        await createPlantConfig(projectId, {
          ...data,
          status: 'completed'
        });
      }
      
      updateStepStatus('plant', 'completed');
      navigate(`/projects/${projectId}/onboarding/lines`);
    } catch (err) {
      console.error('Error saving plant configuration:', err);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    
    try {
      setDeleteError(null);
      await deleteProject(projectId);
      clearCurrentProject(); // Ensure current project is cleared
      navigate('/dashboard', { replace: true }); // Use replace to prevent back navigation
    } catch (error) {
      console.error('Error deleting project:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Plant Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure your plant settings.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading plant configuration</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Plant Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name', { required: 'Plant name is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="opening_time_minutes" className="block text-sm font-medium text-gray-700">
                    Daily Opening Time (minutes)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="number"
                      id="opening_time_minutes"
                      {...register('opening_time_minutes', {
                        required: 'Opening time is required',
                        min: { value: 1, message: 'Opening time must be at least 1 minute' },
                        max: { value: 1440, message: 'Opening time cannot exceed 24 hours' }
                      })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">min</span>
                    </div>
                  </div>
                  {errors.opening_time_minutes && (
                    <p className="mt-1 text-sm text-red-600">{errors.opening_time_minutes.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">Default: 480 minutes (8 hours)</p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Plant Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    {...register('address', { required: 'Address is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter the complete address"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Enter the complete address of your plant
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save and Continue
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone */}
            {plantConfig && (
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between py-4 border-t border-gray-200">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Delete this project</h4>
                      <p className="text-sm text-gray-500">
                        Once you delete a project, there is no going back. Please be certain.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div>
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <Trash2 className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="mt-3 text-center sm:mt-5">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Delete Project
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this project? This action cannot be undone.
                            All data associated with this project will be permanently deleted.
                          </p>
                        </div>
                        {deleteError && (
                          <div className="mt-2 p-2 bg-red-50 rounded-md">
                            <p className="text-sm text-red-600">{deleteError}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default PlantConfigPage;