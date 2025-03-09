import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { Check, AlertCircle } from 'lucide-react';

interface OnboardingSidebarProps {
  projectId: string;
  currentStep: string;
}

const OnboardingSidebar: React.FC<OnboardingSidebarProps> = ({ projectId, currentStep }) => {
  const { steps, setCurrentStep, getStepStatus } = useOnboardingStore();

  useEffect(() => {
    setCurrentStep(currentStep);
    getStepStatus(projectId, currentStep);
  }, [currentStep, projectId]);

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Configuration Steps</h2>
      <nav className="space-y-2">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const Icon = step.icon;
          
          return (
            <NavLink
              key={step.id}
              to={`/projects/${projectId}/onboarding/${step.id}`}
              className={`
                flex items-center justify-between p-3 rounded-md transition-colors
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  p-2 rounded-full
                  ${step.status === 'completed' 
                    ? 'bg-green-100' 
                    : step.status === 'in_progress'
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
                  }
                `}>
                  <Icon className={`
                    h-5 w-5
                    ${step.status === 'completed'
                      ? 'text-green-600'
                      : step.status === 'in_progress'
                      ? 'text-blue-600'
                      : 'text-gray-500'
                    }
                  `} />
                </div>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                {step.status === 'completed' && (
                  <span className="flex items-center text-green-600">
                    <Check className="h-5 w-5" />
                  </span>
                )}
                {step.status === 'in_progress' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    In Progress
                  </span>
                )}
                {step.status === 'pending' && (
                  <span className="flex items-center text-gray-400">
                    <AlertCircle className="h-5 w-5" />
                  </span>
                )}
              </div>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <div className="flex items-center space-x-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Completed Steps</span>
        </div>
        <div className="flex items-center space-x-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-600">Current Step</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-gray-300"></div>
          <span className="text-sm text-gray-600">Pending Steps</span>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSidebar