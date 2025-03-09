import React from 'react';
import { X } from 'lucide-react';

interface FilterPanelProps {
  isVisible: boolean;
  onClose: () => void;
  options: {
    machines: string[];
    lines: string[];
    products: string[];
    teams: string[];
  };
  selectedFilters: {
    machines: string[];
    lines: string[];
    products: string[];
    teams: string[];
  };
  onFilterChange: (category: string, values: string[]) => void;
  onClearFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isVisible,
  onClose,
  options,
  selectedFilters,
  onFilterChange,
  onClearFilters
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50">
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl">
        <div className="h-full flex flex-col">
          <div className="px-4 py-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {Object.entries(options).map(([category, values]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 capitalize">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {values.map((value) => (
                      <label key={value} className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={selectedFilters[category as keyof typeof selectedFilters].includes(value)}
                          onChange={(e) => {
                            const currentSelected = selectedFilters[category as keyof typeof selectedFilters];
                            const newSelected = e.target.checked
                              ? [...currentSelected, value]
                              : currentSelected.filter(v => v !== value);
                            onFilterChange(category, newSelected);
                          }}
                        />
                        <span className="ml-2 text-sm text-gray-700">{value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between">
              <button
                onClick={onClearFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all filters
              </button>
              <button
                onClick={onClose}
                className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;