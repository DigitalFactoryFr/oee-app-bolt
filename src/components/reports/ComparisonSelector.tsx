// src/components/reports/ComparisonSelector.tsx
import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ComparisonSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  type: string;
  projectId: string;
  onSelect: (items: string[]) => void;
  onCompare: (items: string[]) => void;
}

interface ComparisonItem {
  id: string;
  name: string;
  description?: string;
}

const ComparisonSelector: React.FC<ComparisonSelectorProps> = ({
  isVisible,
  onClose,
  type,
  projectId,
  onSelect,
  onCompare
}) => {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && projectId) {
      loadItems();
    }
  }, [isVisible, projectId, type]);

  const loadItems = async () => {
    try {
      setLoading(true);

      let query: any = null;

      switch (type) {
        case 'machines':
          query = supabase
            .from('machines')
            .select('id, name, description')
            .eq('project_id', projectId);
          break;
        case 'lines':
          query = supabase
            .from('production_lines')
            .select('id, name, description')
            .eq('project_id', projectId);
          break;
        case 'teams':
          // Teams -> on lit la table "team_members", on regroupe par team_name
          // Ex. vous devrez adapter si votre schéma est différent
          const { data: teamData, error: teamError } = await supabase
            .from('team_members')
            .select('team_name')
            .eq('project_id', projectId);

          if (teamError) throw teamError;
          const uniqueTeams = Array.from(new Set(teamData?.map((d: any) => d.team_name)));
          const mappedTeams = uniqueTeams.map((t) => ({
            id: t,
            name: t
          }));
          setItems(mappedTeams);
          setLoading(false);
          return;

        case 'products':
          query = supabase
            .from('products')
            .select('id, name, description')
            .eq('project_id', projectId);
          break;
        default:
          setLoading(false);
          return;
      }

      const { data, error } = await query;
      if (error) throw error;

      setItems(data as ComparisonItem[]);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: string) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      // Limiter à 2
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompareClick = () => {
    onCompare(selectedItems);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50">
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl">
        <div className="h-full flex flex-col">
          <div className="px-4 py-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Select items to compare (max 2)
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <label
                    key={item.id}
                    className={`block p-4 rounded-lg border ${
                      selectedItems.includes(item.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } cursor-pointer transition-colors duration-150`}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelect(item.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-500">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompareClick}
                disabled={selectedItems.length !== 2}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Compare Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonSelector;
