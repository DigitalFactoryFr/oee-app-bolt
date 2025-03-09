import React, { ReactNode, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useProjectStore } from '../../store/projectStore';
import { useOnboardingStore } from '../../store/onboardingStore';

interface ProjectLayoutProps {
  children: ReactNode;
}

const ProjectLayout: React.FC<ProjectLayoutProps> = ({ children }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { pathname } = useLocation();
  const { fetchProject, currentProject, loading, error } = useProjectStore();
  const { setCurrentStep } = useOnboardingStore();

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject]);

  useEffect(() => {
    // Extract current step from pathname
    const match = pathname.match(/\/onboarding\/([^/]+)/);
    if (match) {
      setCurrentStep(match[1]);
    }
  }, [pathname, setCurrentStep]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-red-800">Error loading project</h3>
          <div className="mt-2 text-sm text-red-700">{error}</div>
        </div>
      ) : currentProject ? (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{currentProject.name}</h2>
            {currentProject.description && (
              <p className="mt-1 text-sm text-gray-500">{currentProject.description}</p>
            )}
          </div>
          {children}
        </div>
      ) : (
        <div className="bg-yellow-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-yellow-800">Project not found</h3>
          <p className="mt-2 text-sm text-yellow-700">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ProjectLayout;