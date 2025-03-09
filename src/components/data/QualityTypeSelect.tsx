import React from 'react';

const QUALITY_CATEGORIES = [
  { code: 'at_station_rework', name: 'At station rework' },
  { code: 'off_station_rework', name: 'Off station rework' },
  { code: 'scrap', name: 'Scrap' }
];

interface QualityTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const QualityTypeSelect: React.FC<QualityTypeSelectProps> = ({
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
      <option value="">Select quality issue type</option>
      {QUALITY_CATEGORIES.map((type) => (
        <option key={type.code} value={type.code}>
          {type.name}
        </option>
      ))}
    </select>
  );
};

export default QualityTypeSelect;