import React from 'react';
import { PenTool as Tool, Settings, Users, Package, X } from 'lucide-react';

interface ComparisonModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCompare: (type: string) => void;
  projectId: string;
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isVisible,
  onClose,
  onCompare,
  projectId
}) => {
  if (!isVisible) return null;

  const comparisonOptions = [
    {
      id: 'machines',
      title: 'Compare Machines',
      description: 'Compare performance between different machines',
      icon: Tool
    },
    {
      id: 'lines',
      title: 'Compare Production Lines',
      description: 'Compare metrics across production lines',
      icon: Settings
    },
    {
      id: 'teams',
      title: 'Compare Teams',
      description: 'Compare performance between different teams',
      icon: Users
    },
    {
      id: 'products',
      title: 'Compare Products',
      description: 'Compare metrics across different products',
      icon: Package
    }
  ];

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg max-w-lg w-full p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Compare Data</h3>
            <p className="mt-2 text-sm text-gray-500">
              Select what you want to compare:
            </p>
          </div>
          
          <div className="space-y-4">
            {comparisonOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => onCompare(option.id)}
                  className="w-full flex items-center p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors duration-150"
                >
                  <Icon className="h-6 w-6 text-gray-400" />
                  <div className="ml-4 text-left">
                    <div className="font-medium text-gray-900">{option.title}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;