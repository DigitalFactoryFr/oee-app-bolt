import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  User,
  ChevronRight,
  // PenTool as Tool, // Si vous avez un souci d'import, utilisez une autre icône
  AlertTriangle
} from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import type { StopEvent } from '../../../types';

interface FilterTag {
  id: string;
  label: string;
  value: string;
  type: 'date' | 'status' | 'failure_type' | 'owner';
}

// Convertit start/end en "Xh Ym"
function getDuration(startTime?: string, endTime?: string) {
  const end = endTime ? new Date(endTime) : new Date();
  const diff = end.getTime() - new Date(startTime || '').getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours}h ${remain}m`;
}

// Convertit total ms en "Xh Ym" (pour le KPI)
function msToHhMm(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours}h ${remain}m`;
}

function getFailureTypeColor(type: string) {
  switch (type) {
    case 'AP': return 'bg-blue-100 text-blue-800';
    case 'PA': return 'bg-red-100 text-red-800';
    case 'DO': return 'bg-yellow-100 text-yellow-800';
    case 'NQ': return 'bg-purple-100 text-purple-800';
    case 'CS': return 'bg-green-100 text-green-800';
    default:   return 'bg-gray-100 text-gray-800';
  }
}

function getFailureTypeIcon(type: string) {
  switch (type) {
    case 'AP': return <Clock className="h-4 w-4" />;
    case 'PA': 
      // return <Tool className="h-4 w-4" />;
      return <AlertTriangle className="h-4 w-4" />;
    case 'DO': return <AlertTriangle className="h-4 w-4" />;
    case 'NQ': return <AlertCircle className="h-4 w-4" />;
    case 'CS': return <ChevronRight className="h-4 w-4" />;
    default:   return null;
  }
}

const StopEventsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [stops, setStops] = useState<StopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<FilterTag[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    loadStops();
  }, [projectId, activeTags]);

  const loadStops = async () => {
    if (!projectId || !user?.email) return;

    try {
      setLoading(true);
      setError(null);

      // Récupère l'ID du team_member (si besoin "My Stops")
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('email', user.email)
        .single();

      // Requête Supabase + tri par created_at desc
      let query = supabase
        .from('stop_events')
        .select(`
          *,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }); // <-- Tri décroissant par created_at

      // Applique les filtres
      activeTags.forEach(tag => {
        switch (tag.type) {
          case 'date':
            if (tag.value === 'last7days') {
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              query = query.gte('date', sevenDaysAgo.toISOString().split('T')[0]);
            } else if (tag.value !== 'all') {
              query = query.eq('date', tag.value);
            }
            break;
          case 'status':
            if (tag.value !== 'all') {
              query = query.eq('status', tag.value);
            }
            break;
          case 'failure_type':
            if (tag.value !== 'all') {
              query = query.eq('failure_type', tag.value);
            }
            break;
          case 'owner':
            if (tag.value === 'my-stops' && teamMember) {
              query = query.eq('team_member', teamMember.id);
            }
            break;
        }
      });

      const { data, error } = await query;
      if (error) throw error;

      setStops(data as StopEvent[]);
    } catch (err) {
      console.error('Error loading stops:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stops');
    } finally {
      setLoading(false);
    }
  };

  // Filtrage par mot-clé
  const filteredStops = stops.filter(stop => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      stop.products.name.toLowerCase().includes(searchLower) ||
      stop.machines.name.toLowerCase().includes(searchLower) ||
      stop.team_members.email.toLowerCase().includes(searchLower) ||
      stop.failure_type.toLowerCase().includes(searchLower) ||
      stop.cause.toLowerCase().includes(searchLower)
    );
  });

  const formatEmail = (email: string) => email.split('@')[0];

  // Retire un tag de filtre
  const removeTag = (tagId: string) => {
    setActiveTags(tags => tags.filter(tag => tag.id !== tagId));
  };

  // Ajoute (remplace) un tag
  const addTag = (tag: FilterTag) => {
    setActiveTags(tags => {
      const filtered = tags.filter(t => t.type !== tag.type);
      return [...filtered, tag];
    });
    setShowFilterMenu(false);
  };

  // Calcul "Total Duration Today"
  const todayStr = new Date().toISOString().split('T')[0];
  const totalMsToday = filteredStops
    .filter(s => s.date === todayStr)
    .reduce((acc, s) => {
      const end = s.end_time ? new Date(s.end_time) : new Date();
      return acc + (end.getTime() - new Date(s.start_time).getTime());
    }, 0);
  const totalDurationToday = msToHhMm(totalMsToday);

  // Marquer un stop "completed"
  const handleCompleteStop = async (stopId: string) => {
    try {
      await supabase
        .from('stop_events')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', stopId);

      await loadStops();
    } catch (error) {
      console.error('Error completing stop:', error);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Stop Events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track and manage production stop events
            </p>
          </div>
          <button
            onClick={() => navigate(`/projects/${projectId}/stops/select-lot`)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Stop Event
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {/* Active Stops */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Stops
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {filteredStops.filter(s => s.status === 'ongoing').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Completed Today */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completed Today
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {
                        filteredStops.filter(
                          s => s.status === 'completed' && s.date === todayStr
                        ).length
                      }
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Equipment Failures */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Equipment Failures
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {filteredStops.filter(s => s.failure_type === 'PA').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Duration Today */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Duration Today
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {totalDurationToday}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone Search + Filters */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search stops..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filters button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu">
                      {/* Owner */}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500">Owner</div>
                      {getOwnerOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() =>
                            addTag({
                              id: `owner-${option.value}`,
                              label: option.label,
                              value: option.value,
                              type: 'owner'
                            })
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                      {/* Date */}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">
                        Date
                      </div>
                      {getDateOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() =>
                            addTag({
                              id: `date-${option.value}`,
                              label: option.label,
                              value: option.value,
                              type: 'date'
                            })
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                      {/* Status */}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">
                        Status
                      </div>
                      {getStatusOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() =>
                            addTag({
                              id: `status-${option.value}`,
                              label: option.label,
                              value: option.value,
                              type: 'status'
                            })
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                      {/* Failure Type */}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">
                        Failure Type
                      </div>
                      {getFailureTypeOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() =>
                            addTag({
                              id: `type-${option.value}`,
                              label: option.label,
                              value: option.value,
                              type: 'failure_type'
                            })
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Filters */}
            {activeTags.length > 0 && (
              <div className="mt-4 flex items-center space-x-2 overflow-x-auto pb-2">
                {activeTags.map(tag => (
                  <div
                    key={tag.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100"
                  >
                    <span className="text-gray-900">{tag.label}</span>
                    <button
                      onClick={() => removeTag(tag.id)}
                      className="ml-2 text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stops List */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading stops</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            ) : filteredStops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">
                  No stop events found for the selected filters.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/stops/select-lot`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Record Stop Event
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStops.map(stop => {
                  const durationCard = getDuration(stop.start_time, stop.end_time);

                  return (
                    <div
                      key={stop.id}
                      onClick={() => navigate(`/projects/${projectId}/stops/${stop.id}`)}
                      className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                    >
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                stop.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {stop.status === 'completed' ? 'Completed' : 'Ongoing'}
                            </span>
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getFailureTypeColor(stop.failure_type)}`}
                            >
                              {getFailureTypeIcon(stop.failure_type)}
                              <span>{stop.failure_type}</span>
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {durationCard}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {stop.products.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {stop.machines.name}
                            </div>
                          </div>

                          <div>
                            <div className="text-sm text-gray-500">
                              {new Date(stop.date).toLocaleDateString()} •{' '}
                              {new Date(stop.start_time).toLocaleTimeString().slice(0, -3)}
                              {stop.end_time &&
                                ` - ${new Date(stop.end_time).toLocaleTimeString().slice(0, -3)}`}
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {stop.cause}
                            </div>
                            {stop.comment && (
                              <div className="mt-1 text-sm text-gray-500 line-clamp-2">
                                {stop.comment}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center pt-2 border-t border-gray-100">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-600">
                              {formatEmail(stop.team_members.email)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {stop.status === 'ongoing' && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteStop(stop.id);
                              }}
                              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Stop
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default StopEventsPage;
