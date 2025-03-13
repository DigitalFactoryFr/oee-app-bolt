import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useProjectStore } from '../store/projectStore';
import DashboardLayout from '../components/layout/DashboardLayout';

interface FormData {
  name: string;
  description: string;
}

const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const { createProject, error, loading } = useProjectStore();
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<FormData>();
  
  const onSubmit = async (data: FormData) => {
    console.log("📝 Submitting project form:", data);
    const project = await createProject(data.name, data.description);
    if (project) {
      console.log("✅ Project created successfully, redirecting to onboarding");
      navigate(`/projects/${project.id}/onboarding/plant`);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create New Project</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new OEE tracking project for your production line.
        </p>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Project Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  {...register('name', { required: 'Project name is required' })}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  rows={3}
                  {...register('description')}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error creating project</h3>
                    <div className="mt-2 text-sm text-red-700">
                      {error}
                      {error.includes('infinite recursion') && (
                        <div className="mt-2 text-xs text-red-600">
                          <p>A database policy recursion error occurred. Details:</p>
                          <pre className="mt-1 bg-red-100 p-2 rounded overflow-auto">
                            {JSON.stringify({
                              message: error,
                              timestamp: new Date().toISOString(),
                              location: 'Project creation'
                            }, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NewProject;