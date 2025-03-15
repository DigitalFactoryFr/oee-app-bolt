import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle,
  Settings, 
  Users, 
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  FileSpreadsheet,
  Activity,
  Gauge,
  ChevronRight,
  Bell,
  Cpu
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useProjectStore } from '../store/projectStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useMachineStore } from '../store/machineStore';
import { useProductStore } from '../store/productStore';
import { useTeamStore } from '../store/teamStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { supabase } from '../lib/supabase';
import UpgradePrompt from '../components/UpgradePrompt';

interface RecentEvent {
  id: string;
  type: 'lot' | 'stop' | 'quality';
  title: string;
  description: string;
  time: string;
  status?: string;
}

interface Recommendation {
  id: string;
  type: 'action' | 'warning' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    link: string;
  };
}

const Dashboard: React.FC = () => {
  const { projects, currentProject, fetchProjects, setCurrentProject } = useProjectStore();
  const { machines, fetchMachines } = useMachineStore();
  const { products, fetchProducts } = useProductStore();
  const { members, fetchMembers } = useTeamStore();
  const { subscription, fetchSubscription } = useSubscriptionStore();
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);


    
  useEffect(() => {
  console.log("[Dashboard] 🚀 Chargement des projets...");
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProject?.id) {
      const fetchData = async () => {
        await Promise.all([
          fetchMachines(currentProject.id),
          fetchProducts(currentProject.id),
          fetchMembers(currentProject.id),
          fetchSubscription(currentProject.id),
          loadRecentEvents(),
          generateRecommendations()
        ]);
      };
      fetchData();
    }
  }, [currentProject?.id]);

  const loadRecentEvents = async () => {
    if (!currentProject?.id) return;

    try {
      setLoading(true);

      // Get last 5 lots
      const { data: lots } = await supabase
        .from('lots')
        .select(`
          id,
          date,
          products(name),
          machines(name),
          ok_parts_produced,
          lot_size,
          created_at,
          status
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get last 5 stops
      const { data: stops } = await supabase
        .from('stop_events')
        .select(`
          id,
          date,
          machines(name),
          failure_type,
          cause,
          created_at,
          status
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get last 5 quality issues
      const { data: quality } = await supabase
        .from('quality_issues')
        .select(`
          id,
          date,
          products(name),
          machines(name),
          category,
          quantity,
          created_at,
          status
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const events: RecentEvent[] = [
        ...(lots || []).map(lot => ({
          id: lot.id,
          type: 'lot' as const,
          title: `Production Lot - ${lot.products.name}`,
          description: `${lot.ok_parts_produced} / ${lot.lot_size} parts on ${lot.machines.name}`,
          time: new Date(lot.created_at).toLocaleString(),
          status: lot.status
        })),
        ...(stops || []).map(stop => ({
          id: stop.id,
          type: 'stop' as const,
          title: `Stop Event - ${stop.machines.name}`,
          description: `${stop.failure_type}: ${stop.cause}`,
          time: new Date(stop.created_at).toLocaleString(),
          status: stop.status
        })),
        ...(quality || []).map(issue => ({
          id: issue.id,
          type: 'quality' as const,
          title: `Quality Issue - ${issue.products.name}`,
          description: `${issue.quantity} parts ${issue.category} on ${issue.machines.name}`,
          time: new Date(issue.created_at).toLocaleString(),
          status: issue.status
        }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setRecentEvents(events);
      setLoading(false);
    } catch (error) {
      console.error('Error loading recent events:', error);
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    if (!currentProject?.id) return;

    try {
      const recommendations: Recommendation[] = [];

      // Check for uncompleted lots
      const { data: uncompletedLots } = await supabase
        .from('lots')
        .select('id')
        .eq('project_id', currentProject.id)
        .eq('status', 'in_progress')
        .lt('end_time', new Date().toISOString());

      if (uncompletedLots && uncompletedLots.length > 0) {
        recommendations.push({
          id: 'uncompleted-lots',
          type: 'warning',
          title: 'Uncompleted Production Lots',
          description: `You have ${uncompletedLots.length} production lots that need to be completed.`,
          action: {
            label: 'View Lots',
            link: `/projects/${currentProject.id}/lots`
          }
        });
      }

      // Check for ongoing stops
      const { data: ongoingStops } = await supabase
        .from('stop_events')
        .select('id')
        .eq('project_id', currentProject.id)
        .eq('status', 'ongoing');

      if (ongoingStops && ongoingStops.length > 0) {
        recommendations.push({
          id: 'ongoing-stops',
          type: 'warning',
          title: 'Ongoing Stop Events',
          description: `There are ${ongoingStops.length} ongoing stop events that need attention.`,
          action: {
            label: 'View Stops',
            link: `/projects/${currentProject.id}/stops`
          }
        });
      }

      // Check for quality issues
      const { data: openQualityIssues } = await supabase
        .from('quality_issues')
        .select('id')
        .eq('project_id', currentProject.id)
        .eq('status', 'ongoing');

      if (openQualityIssues && openQualityIssues.length > 0) {
        recommendations.push({
          id: 'quality-issues',
          type: 'warning',
          title: 'Open Quality Issues',
          description: `You have ${openQualityIssues.length} quality issues that need to be resolved.`,
          action: {
            label: 'View Issues',
            link: `/projects/${currentProject.id}/quality`
          }
        });
      }

      // Add configuration recommendations
      if (machines.length === 0) {
        recommendations.push({
          id: 'no-machines',
          type: 'action',
          title: 'Configure Machines',
          description: 'Start by adding your machines to begin tracking production.',
          action: {
            label: 'Add Machines',
            link: `/projects/${currentProject.id}/onboarding/machines`
          }
        });
      }

      if (products.length === 0) {
        recommendations.push({
          id: 'no-products',
          type: 'action',
          title: 'Add Products',
          description: 'Configure your products to start tracking production.',
          action: {
            label: 'Add Products',
            link: `/projects/${currentProject.id}/onboarding/products`
          }
        });
      }

      setRecommendations(recommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  const getEventIcon = (type: string, status?: string) => {
    switch (type) {
      case 'lot':
        return status === 'completed' ? 
          <CheckCircle className="h-5 w-5 text-green-500" /> :
          <Activity className="h-5 w-5 text-blue-500" />;
      case 'stop':
        return status === 'completed' ?
          <CheckCircle className="h-5 w-5 text-green-500" /> :
          <Clock className="h-5 w-5 text-red-500" />;
      case 'quality':
        return status === 'completed' ?
          <CheckCircle className="h-5 w-5 text-green-500" /> :
          <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'action':
        return <ChevronRight className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'info':
        return <Bell className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {subscription?.status === 'free' && (
          <div className="mb-6">
            <UpgradePrompt machineCount={machines.length + 1} />
          </div>
        )}
        
        {/* Project Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Project Overview</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Settings className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Production Lines</h3>
                  <p className="text-2xl font-semibold text-blue-600">{machines.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Cpu className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Machines</h3>
                  <p className="text-2xl font-semibold text-blue-600">{machines.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Products</h3>
                  <p className="text-2xl font-semibold text-blue-600">{products.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
                  <p className="text-2xl font-semibold text-blue-600">{members.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to={currentProject ? `/projects/${currentProject.id}/lots/new` : '#'}
              className={`flex items-center p-4 rounded-lg border ${
                currentProject 
                  ? 'border-gray-200 hover:border-blue-500 cursor-pointer'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex-shrink-0">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Create Production Lot</p>
                <p className="text-sm text-gray-500">Record new production data</p>
              </div>
            </Link>

            <Link
              to={currentProject ? `/projects/${currentProject.id}/stops/new` : '#'}
              className={`flex items-center p-4 rounded-lg border ${
                currentProject 
                  ? 'border-gray-200 hover:border-blue-500 cursor-pointer'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Record Stop Event</p>
                <p className="text-sm text-gray-500">Log machine downtime</p>
              </div>
            </Link>

            <Link
              to={currentProject ? `/projects/${currentProject.id}/quality/new` : '#'}
              className={`flex items-center p-4 rounded-lg border ${
                currentProject 
                  ? 'border-gray-200 hover:border-blue-500 cursor-pointer'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Quality Issue</p>
                <p className="text-sm text-gray-500">Report quality problems</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Events */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getEventIcon(event.type, event.status)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <p className="text-sm text-gray-500">{event.description}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{event.time}</span>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No recent events
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg font-medium text-gray-900">Recommendations</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recommendations.map((recommendation) => (
                <div key={recommendation.id} className="p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {getRecommendationIcon(recommendation.type)}
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">{recommendation.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{recommendation.description}</p>
                      {recommendation.action && (
                        <Link
                          to={recommendation.action.link}
                          className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          {recommendation.action.label}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {recommendations.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No recommendations at this time
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;