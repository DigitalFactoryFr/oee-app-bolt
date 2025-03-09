import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

interface ComparisonButtonProps {
  showComparison: boolean;
  onClick: () => void;
  className?: string;
}

const ComparisonButton: React.FC<ComparisonButtonProps> = ({
  showComparison,
  onClick,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors duration-200 ${
        showComparison 
          ? 'border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100'
          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
      } ${className}`}
    >
      <ArrowRightLeft className="h-4 w-4 mr-2" />
      {showComparison ? 'Hide Comparison' : 'Compare'}
    </button>
  );
};

export default ComparisonButton;