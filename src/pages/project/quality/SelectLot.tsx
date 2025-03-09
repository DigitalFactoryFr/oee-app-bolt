import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertOctagon, Filter, Search, Calendar, ChevronLeft, Plus, X } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';

interface Lot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  products: { name: string };
  machines: { name: string };
  team_members: { email: string };
  status: string;
}

interface FilterTag {
  id: string;
  label: string;
  value: string;
  type: 'date' | 'status' | 'owner';
}

const SelectLotQuality: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<FilterTag[]>([
    { id: 'status', label: 'In Progress', value: 'in_progress', type: 'status' },
    { id: 'date', label: 'Today', value: new Date().toISOString().split('T')[0], type: 'date' },
    { id: 'owner', label: 'My Lots', value: 'my-lots', type: 'owner' }
  ]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    loadLots();
  }, [projectId, user, activeTags]);

  const loadLots = async () => {
    if (!projectId || !user?.email) return;

    try {
      setLoading(true);
      setError(null);

      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('email', user.email)
        .single();

      if (!teamMember) {
        throw new Error('Team member not found');
      }

      let query = supabase
        .from('lots')
        .select(`
          id,
          date,
          start_time,
          end_time,
          products (name),
          machines (name),
          team_members (email),
          status
        `)
        .eq('project_id', projectId);

      // Apply filters from active tags
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
          case 'owner':
            if (tag.value === 'my-lots') {
              query = query.eq('team_member', teamMember.id);
            }
            break;
        }
      });

      const { data, error } = await query;

      if (error) throw error;
      setLots(data as Lot[]);
      
      // Auto-redirect if single lot
      if (data && data.length === 1 && data[0].team_members.email === user.email) {
        navigate(`/projects/${projectId}/quality/new?lot=${data[0].id}`);
        return;
      }
    } catch (err) {
      console.error('Error loading lots:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lots');
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = lots.filter(lot => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      lot.products.name.toLowerCase().includes(searchLower) ||
      lot.machines.name.toLowerCase().includes(searchLower) ||
      lot.team_members.email.toLowerCase().includes(searchLower)
    );
  });

  const formatEmail = (email: string) => email.split('@')[0];

  const removeTag = (tagId: string) => {
    setActiveTags(tags => tags.filter(tag => tag.id !== tagId));
  };

  const addTag = (tag: FilterTag) => {
    setActiveTags(tags => {
      // Remove existing tag of same type
      const filtered = tags.filter(t => t.type !== tag.type);
      return [...filtered, tag];
    });
    setShowFilterMenu(false);
  };

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

  const getOwnerOptions = () => [
    { label: 'My Lots', value: 'my-lots' },
    { label: 'All Lots', value: 'all-lots' }
  ];

  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate(`/projects/${projectId}/lots`)}
              className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Select Production Lot</h2>
          </div>
          <button
            onClick={() => navigate(`/projects/${projectId}/lots/new`)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Lot
          </button>
        </div>

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
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">Owner</div>
                      {getOwnerOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() => addTag({ id: `owner-${option.value}`, label: option.label, value: option.value, type: 'owner' })}
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

          {/* Lots List */}
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="p-4">
                <div className="bg-red-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error loading lots</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No lots found for the selected filters.</p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/lots/new`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Lot
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredLots.map((lot) => (
                  <button
                    key={lot.id}
                    onClick={() => navigate(`/projects/${projectId}/quality/new?lot=${lot.id}`)}
                    className="w-full text-left p-4 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition duration-150 ease-in-out"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-medium text-gray-900 truncate">
                            {lot.products.name}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {lot.machines.name}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lot.status === 'in_progress' 
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {lot.status === 'in_progress' ? 'In Progress' : 'Completed'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span>{formatEmail(lot.team_members.email)}</span>
                          <span className="mx-2">•</span>
                          <span>{lot.start_time.slice(11, 16)} - {lot.end_time.slice(11, 16)}</span>
                        </div>
                      </div>
                      <div className="ml-6">
                        <AlertOctagon className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default SelectLotQuality;