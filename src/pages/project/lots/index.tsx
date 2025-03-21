import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Search, Filter, X, Calendar, Activity, AlertTriangle, Clock, Check } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';

interface LotStats {
  total: number;
  in_progress: number;
  completed: number;
  delayed: number;
  stops_today: number;
  quality_issues_today: number;
}

interface Lot {
  id: string;
  lot_id?: string;            // Affichage du lot_id
  date: string;
  start_time: string;
  end_time: string;
  products: { name: string };
  machines: { name: string };
  team_members: { email: string };
  status: string;
  ok_parts_produced: number;
  lot_size: number;
  stop_events: { id: string }[];
  quality_issues: { id: string }[];
  created_at?: string;        // Assurez-vous que ce champ existe dans votre table
}

interface FilterTag {
  id: string;
  label: string;
  value: string;
  type: 'date' | 'status' | 'owner';
}

const LotsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [lots, setLots] = useState<Lot[]>([]);
  const [stats, setStats] = useState<LotStats>({
    total: 0,
    in_progress: 0,
    completed: 0,
    delayed: 0,
    stops_today: 0,
    quality_issues_today: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<FilterTag[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadLots();
      loadStats();
    }
  }, [projectId, activeTags]);

  const loadStats = async () => {
    if (!projectId) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Récupération des stats "in_progress" / "completed"
      const { data: lotsStats, error: lotsError } = await supabase
        .from('lots')
        .select('status', { count: 'exact' })
        .eq('project_id', projectId)
        .in('status', ['in_progress', 'completed']);
      if (lotsError) throw lotsError;

      // Récupération du nombre de stops créés aujourd'hui
      const { data: stopsData, error: stopsError } = await supabase
        .from('stop_events')
        .select('id')
        .eq('project_id', projectId)
        .eq('date', today);
      if (stopsError) throw stopsError;

      // Récupération du nombre de quality issues créés aujourd'hui
      const { data: qualityData, error: qualityError } = await supabase
        .from('quality_issues')
        .select('id')
        .eq('project_id', projectId)
        .eq('date', today);
      if (qualityError) throw qualityError;

      // Récupération des lots "in_progress" mais en retard (end_time < maintenant)
      const { data: delayedData, error: delayedError } = await supabase
        .from('lots')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'in_progress')
        .lt('end_time', new Date().toISOString());
      if (delayedError) throw delayedError;

      setStats({
        total: lotsStats?.length || 0,
        in_progress: lotsStats?.filter(l => l.status === 'in_progress').length || 0,
        completed: lotsStats?.filter(l => l.status === 'completed').length || 0,
        delayed: delayedData?.length || 0,
        stops_today: stopsData?.length || 0,
        quality_issues_today: qualityData?.length || 0
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadLots = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('lots')
        .select(`
          id,
          lot_id,
          date,
          start_time,
          end_time,
          products (name),
          machines (name),
          team_members (email),
          status,
          ok_parts_produced,
          lot_size,
          stop_events (id),
          quality_issues (id),
          created_at
        `)
        .eq('project_id', projectId)
        // Tri par date de création (plus récent en premier)
        .order('created_at', { ascending: false });

      // Application des filtres (activeTags)
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
        }
      });

      const { data, error } = await query;
      if (error) throw error;

      setLots(data as Lot[]);
    } catch (err) {
      console.error('Error loading lots:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lots');
    } finally {
      setLoading(false);
    }
  };

  // Filtrage par "searchTerm"
  const filteredLots = lots.filter(lot => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      lot.products.name.toLowerCase().includes(searchLower) ||
      lot.machines.name.toLowerCase().includes(searchLower) ||
      lot.team_members.email.toLowerCase().includes(searchLower) ||
      (lot.lot_id && lot.lot_id.toLowerCase().includes(searchLower))
    );
  });

  const formatEmail = (email: string) => email.split('@')[0];

  // Gestion des tags
  const removeTag = (tagId: string) => {
    setActiveTags(tags => tags.filter(tag => tag.id !== tagId));
  };

  const addTag = (tag: FilterTag) => {
    setActiveTags(tags => {
      // On supprime l'ancien tag du même type
      const filtered = tags.filter(t => t.type !== tag.type);
      return [...filtered, tag];
    });
    setShowFilterMenu(false);
  };

  // Options pour le filtrage
  const getDateOptions = () => [
    { label: 'Today', value: new Date().toISOString().split('T')[0] },
    { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
    { label: 'Last 7 days', value: 'last7days' },
    { label: 'All dates', value: 'all' }
  ];

  const getStatusOptions = () => [
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'All Status', value: 'all' }
  ];

  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Production Lots</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage and track your production lots
            </p>
          </div>
          <Link
            to={`/projects/${projectId}/lots/new`}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Lot
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Lots</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">In Progress</dt>
                    <dd className="text-lg font-semibold text-blue-600">{stats.in_progress}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-semibold text-green-600">{stats.completed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Delayed</dt>
                    <dd className="text-lg font-semibold text-yellow-600">{stats.delayed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Stops Today</dt>
                    <dd className="text-lg font-semibold text-red-600">{stats.stops_today}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-orange-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Quality Issues</dt>
                    <dd className="text-lg font-semibold text-orange-600">{stats.quality_issues_today}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lots List */}
        <div className="bg-white shadow rounded-lg">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search lots..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500">Date</div>
                      {getDateOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() => addTag({ id: `date-${option.value}`, label: option.label, value: option.value, type: 'date' })}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">Status</div>
                      {getStatusOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() => addTag({ id: `status-${option.value}`, label: option.label, value: option.value, type: 'status' })}
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

          {/* Lots Grid */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading lots</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No lots found for the selected filters.</p>
                <div className="mt-4">
                  <Link
                    to={`/projects/${projectId}/lots/new`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Lot
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLots.map((lot) => (
                  <Link
                    key={lot.id}
                    to={`/projects/${projectId}/lots/${lot.id}`}
                    className="block bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-4">
                      {/* Affichage du lot_id si disponible */}
                      {lot.lot_id && (
                        <div className="text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-1 rounded inline-block mb-2">
                          Lot #{lot.lot_id}
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {lot.products.name}
                          </h3>
                          <p className="text-sm text-gray-500">{lot.machines.name}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lot.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {lot.status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Team Member</span>
                          <span className="font-medium">{formatEmail(lot.team_members.email)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Time</span>
                          <span className="font-medium">
                            {lot.start_time.slice(11, 16)} - {lot.end_time.slice(11, 16)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium">
                            {lot.ok_parts_produced} / {lot.lot_size}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-100">
                            <div
                              style={{
                                width: `${(lot.ok_parts_produced / lot.lot_size) * 100}%`
                              }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center space-x-4 text-sm">
                        {lot.stop_events && lot.stop_events.length > 0 && (
                          <div className="flex items-center text-red-600">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{lot.stop_events.length} stops</span>
                          </div>
                        )}
                        {lot.quality_issues && lot.quality_issues.length > 0 && (
                          <div className="flex items-center text-orange-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            <span>{lot.quality_issues.length} issues</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default LotsPage;
