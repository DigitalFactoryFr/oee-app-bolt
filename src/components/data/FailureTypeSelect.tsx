import React from 'react';
import { FAILURE_TYPES } from '../../types';

interface FailureTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const FailureTypeSelect: React.FC<FailureTypeSelectProps> = ({
  value,
  onChange,
  className = ''
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${className}`}
    >
      <option value="">Select failure type</option>
      {FAILURE_TYPES.map((type) => (
        <option key={type.code} value={type.code}>
          {type.code} - {type.name}
        </option>
      ))}
    </select>
  );
};

export default FailureTypeSelect;