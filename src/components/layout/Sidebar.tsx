import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Factory,
  Settings,
  Cpu,
  Package,
  Users,
  Database,
  Activity,
  Clock,
  AlertTriangle,
  BarChart2,
  Gauge,
  Brain,
  Bot
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const [showProjectList, setShowProjectList] = useState(false);


    useEffect(() => {
    if (!currentProject && projects.length > 0) {
      console.log("[Sidebar] 📌 Sélection automatique du premier projet :", projects[0]);
      setCurrentProject(projects[0]);
    }
  }, [projects, currentProject, setCurrentProject]);

  
  // Helper function to check if a path matches the current location
  const isPathActive = (path: string) => {
    return location.pathname.includes(path);
  };

  // Check specific sections
  const isReportsMain = location.pathname.endsWith('/reports');
  const isRealTimeMonitoring = isPathActive('/reports/realtime');
  const isPredictiveInsights = isPathActive('/reports/predictive');
  const isAIAgents = isPathActive('/ai-agents');

  return (
    <nav className="mt-5 px-2 space-y-4">
      {/* Project Selector */}
      <div className="px-2">
        <button
          onClick={() => setShowProjectList(!showProjectList)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-50"
        >
          <div className="flex items-center">
            <Factory className="mr-3 h-5 w-5 text-gray-500" />
            <span>{currentProject?.name || 'Select Project'}</span>
          </div>
          {showProjectList ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {showProjectList && (
          <div className="mt-1 pl-10 space-y-1">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => {
                  setCurrentProject(project);
                  setShowProjectList(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                  currentProject?.id === project.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {project.name}
              </button>
            ))}
            <NavLink
              to="/projects/new"
              className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New Project
            </NavLink>
          </div>
        )}
      </div>

      <div className="px-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Overview
        </div>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <LayoutDashboard className="mr-3 h-5 w-5" />
          Dashboard
        </NavLink>
        <NavLink
          to={currentProject ? `/projects/${currentProject.id}/reports` : '#'}
          className={
            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              !currentProject ? 'opacity-50 cursor-not-allowed' : 
              isReportsMain ? 'bg-blue-50 text-blue-700' :
              'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <BarChart2 className="mr-3 h-5 w-5" />
          Reports & Analytics
        </NavLink>
        <NavLink
          to={currentProject ? `/projects/${currentProject.id}/reports/realtime` : '#'}
          className={
            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              !currentProject ? 'opacity-50 cursor-not-allowed' :
              isRealTimeMonitoring ? 'bg-blue-50 text-blue-700' :
              'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <Gauge className="mr-3 h-5 w-5" />
          Real-time Monitoring
        </NavLink>
        <NavLink
          to={currentProject ? `/projects/${currentProject.id}/reports/predictive` : '#'}
          className={
            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              !currentProject ? 'opacity-50 cursor-not-allowed' :
              isPredictiveInsights ? 'bg-blue-50 text-blue-700' :
              'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <Brain className="mr-3 h-5 w-5" />
          Predictive Insights
        </NavLink>
        <NavLink
          to={currentProject ? `/projects/${currentProject.id}/ai-agents` : '#'}
          className={
            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              !currentProject ? 'opacity-50 cursor-not-allowed' :
              isAIAgents ? 'bg-blue-50 text-blue-700' :
              'text-gray-700 hover:bg-gray-50'
            }`
          }
        >
          <Bot className="mr-3 h-5 w-5" />
          AI Agents
        </NavLink>
      </div>

      {currentProject && (
        <>
          <div className="px-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Data Entry
            </div>
            <NavLink
              to={`/projects/${currentProject.id}/lots`}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <Activity className="mr-3 h-5 w-5" />
              Production Lots
            </NavLink>
            <NavLink
              to={`/projects/${currentProject.id}/stops`}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <Clock className="mr-3 h-5 w-5" />
              Stop Events
            </NavLink>
            <NavLink
              to={`/projects/${currentProject.id}/quality`}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <AlertTriangle className="mr-3 h-5 w-5" />
              Quality Issues
            </NavLink>
          </div>

          <div className="px-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Configuration
            </div>
            {[
              {
                path: 'plant',
                icon: Factory,
                label: 'Plant Settings'
              },
              {
                path: 'lines',
                icon: Settings,
                label: 'Production Lines'
              },
              {
                path: 'machines',
                icon: Cpu,
                label: 'Machines'
              },
              {
                path: 'products',
                icon: Package,
                label: 'Products'
              },
              {
                path: 'teams',
                icon: Users,
                label: 'Teams'
              }
            ].map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/projects/${currentProject.id}/onboarding/${item.path}`}
                  className={({ isActive }) =>
                    `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="px-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Data Management
            </div>
            <NavLink
              to={`/projects/${currentProject.id}/data-connection`}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <Database className="mr-3 h-5 w-5" />
              Data Connection
            </NavLink>
          </div>
        </>
      )}
    </nav>
  );
};

export default Sidebar;