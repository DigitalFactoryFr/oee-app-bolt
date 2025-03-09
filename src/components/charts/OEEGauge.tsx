import React from 'react';

interface OEEGaugeProps {
  value: number;
  label: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

const OEEGauge: React.FC<OEEGaugeProps> = ({ 
  value, 
  label, 
  color = '#10B981',
  size = 'md'
}) => {
  const radius = size === 'sm' ? 35 : size === 'md' ? 45 : 55;
  const strokeWidth = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const fontSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-2xl' : 'text-3xl';
  const labelSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        className="transform -rotate-90"
        width={(radius + strokeWidth) * 2}
        height={(radius + strokeWidth) * 2}
      >
        {/* Background circle */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          className="stroke-gray-200"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          fill="none"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${fontSize} font-bold text-gray-900`}>
          {value.toFixed(1)}%
        </span>
        <span className={`${labelSize} text-gray-500 font-medium`}>
          {label}
        </span>
      </div>
    </div>
  );
};

export default OEEGauge;