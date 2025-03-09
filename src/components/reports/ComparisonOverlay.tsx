import React from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ComparisonData {
  label: string;
  current: number[];
  comparison: number[];
  dates: string[];
}

interface ComparisonOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  data: ComparisonData;
}

const ComparisonOverlay: React.FC<ComparisonOverlayProps> = ({
  isVisible,
  onClose,
  data
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50">
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl">
        <div className="h-full flex flex-col">
          <div className="px-4 py-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Comparison</h3>
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
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">{data.label}</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-4">
                    {data.dates.map((date, index) => (
                      <div key={date} className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">{date}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-blue-600">
                            {data.current[index]}%
                          </span>
                          <span className="text-sm font-medium text-gray-400">
                            {data.comparison[index]}%
                          </span>
                          <span className={`text-xs font-medium ${
                            data.current[index] > data.comparison[index]
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {data.current[index] > data.comparison[index] ? '↑' : '↓'}
                            {Math.abs(data.current[index] - data.comparison[index])}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Average Difference</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(data.current.reduce((a, b) => a + b, 0) / data.current.length -
                          data.comparison.reduce((a, b) => a + b, 0) / data.comparison.length).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Max Difference</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.max(...data.current.map((val, i) => Math.abs(val - data.comparison[i])))}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonOverlay;