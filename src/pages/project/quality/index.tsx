import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, AlertOctagon, X, Calendar, CheckCircle, AlertCircle, User, ChevronRight } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import type { QualityIssue } from '../../../types';

interface FilterTag {
  id: string;
  label: string;
  value: string;
  type: 'date' | 'status' | 'category' | 'owner';
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'at_station_rework':
      return 'bg-yellow-100 text-yellow-800';
    case 'off_station_rework':
      return 'bg-orange-100 text-orange-800';
    case 'scrap':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'at_station_rework':
      return 'At Station Rework';
    case 'off_station_rework':
      return 'Off Station Rework';
    case 'scrap':
      return 'Scrap';
    default:
      return category;
  }
};

const QualityIssuesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<FilterTag[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    loadIssues();
  }, [projectId, activeTags]);

  const loadIssues = async () => {
    if (!projectId || !user?.email) return;

    try {
      setLoading(true);
      setError(null);

      // First get the team member ID for the current user
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('email', user.email)
        .single();

      let query = supabase
        .from('quality_issues')
        .select(`
          *,
          products:product (name),
          machines:machine (name),
          team_members:team_member (email)
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
          case 'category':
            if (tag.value !== 'all') {
              query = query.eq('category', tag.value);
            }
            break;
          case 'owner':
            if (tag.value === 'my-issues' && teamMember) {
              query = query.eq('team_member', teamMember.id);
            }
            break;
        }
      });

      const { data, error } = await query;

      if (error) throw error;
      setIssues(data as QualityIssue[]);
    } catch (err) {
      console.error('Error loading quality issues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality issues');
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      issue.products.name.toLowerCase().includes(searchLower) ||
      issue.machines.name.toLowerCase().includes(searchLower) ||
      issue.team_members.email.toLowerCase().includes(searchLower) ||
      issue.category.toLowerCase().includes(searchLower) ||
      issue.cause.toLowerCase().includes(searchLower)
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
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Completed', value: 'completed' },
    { label: 'All Status', value: 'all' }
  ];

  const getCategoryOptions = () => [
    { label: 'At Station Rework', value: 'at_station_rework' },
    { label: 'Off Station Rework', value: 'off_station_rework' },
    { label: 'Scrap', value: 'scrap' },
    { label: 'All Categories', value: 'all' }
  ];

  const getOwnerOptions = () => [
    { label: 'My Issues', value: 'my-issues' },
    { label: 'All Issues', value: 'all-issues' }
  ];

  const handleCompleteIssue = async (issueId: string) => {
    try {
      await supabase
        .from('quality_issues')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', issueId);

      await loadIssues();
    } catch (error) {
      console.error('Error completing quality issue:', error);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quality Issues</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track and manage quality issues and rework
            </p>
          </div>
          <button
            onClick={() => navigate(`/projects/${projectId}/quality/select-lot`)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Quality Issue
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertOctagon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Issues
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {filteredIssues.filter(i => i.status === 'ongoing').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

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
                      {filteredIssues.filter(i => 
                        i.status === 'completed' && 
                        i.date === new Date().toISOString().split('T')[0]
                      ).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Scrap Today
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {filteredIssues
                        .filter(i => 
                          i.category === 'scrap' && 
                          i.date === new Date().toISOString().split('T')[0]
                        )
                        .reduce((sum, i) => sum + i.quantity, 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertOctagon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Rework Today
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {filteredIssues
                        .filter(i => 
                          (i.category === 'at_station_rework' || i.category === 'off_station_rework') && 
                          i.date === new Date().toISOString().split('T')[0]
                        )
                        .reduce((sum, i) => sum + i.quantity, 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
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
                  placeholder="Search quality issues..."
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
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500">Owner</div>
                      {getOwnerOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() => addTag({ id: `owner-${option.value}`, label: option.label, value: option.value, type: 'owner' })}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {option.label}
                        </button>
                      ))}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">Date</div>
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
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-t">Category</div>
                      {getCategoryOptions().map(option => (
                        <button
                          key={option.value}
                          onClick={() => addTag({ id: `category-${option.value}`, label: option.label, value: option.value, type: 'category' })}
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

          {/* Issues List */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading quality issues</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No quality issues found for the selected filters.</p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/quality/select-lot`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Record Quality Issue
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => navigate(`/projects/${projectId}/quality/${issue.id}`)}
                    className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            issue.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {issue.status === 'completed' ? 'Completed' : 'Ongoing'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(issue.category)}`}>
                            {getCategoryLabel(issue.category)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {issue.quantity} parts
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {issue.products.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {issue.machines.name}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-500">
                            {new Date(issue.date).toLocaleDateString()}
                            {issue.start_time && ` • ${new Date(issue.start_time).toLocaleTimeString().slice(0, -3)}`}
                            {issue.end_time && ` - ${new Date(issue.end_time).toLocaleTimeString().slice(0, -3)}`}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {issue.cause}
                          </div>
                          {issue.comment && (
                            <div className="mt-1 text-sm text-gray-500 line-clamp-2">
                              {issue.comment}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center pt-2 border-t border-gray-100">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">
                            {formatEmail(issue.team_members.email)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {issue.status === 'ongoing' && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompleteIssue(issue.id);
                            }}
                            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete Issue
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default QualityIssuesPage;