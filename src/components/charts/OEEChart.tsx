import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OEEData {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

interface ComparisonData {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

interface OEEChartProps {
  data: OEEData[];
  comparisonData?: ComparisonData[];
  showComparison?: boolean;
  comparisonLabel?: string;
}

const OEEChart: React.FC<OEEChartProps> = ({ 
  data, 
  comparisonData, 
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  // Combine current and comparison data for the tooltip
  const combinedData = data.map((item, index) => ({
    ...item,
    ...(showComparison && comparisonData && comparisonData[index] ? {
      oee_prev: comparisonData[index].oee,
      availability_prev: comparisonData[index].availability,
      performance_prev: comparisonData[index].performance,
      quality_prev: comparisonData[index].quality
    } : {})
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">Date: {label}</p>
          <div className="space-y-1">
            <p className="text-sm text-blue-600">
              OEE: {payload[0].value.toFixed(1)}%
              {showComparison && payload[4] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[4].value.toFixed(1)}%)
                </span>
              )}
            </p>
            <p className="text-sm text-green-600">
              Availability: {payload[1].value.toFixed(1)}%
              {showComparison && payload[5] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[5].value.toFixed(1)}%)
                </span>
              )}
            </p>
            <p className="text-sm text-orange-600">
              Performance: {payload[2].value.toFixed(1)}%
              {showComparison && payload[6] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[6].value.toFixed(1)}%)
                </span>
              )}
            </p>
            <p className="text-sm text-purple-600">
              Quality: {payload[3].value.toFixed(1)}%
              {showComparison && payload[7] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[7].value.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={combinedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Current period metrics */}
        <Area
          type="monotone"
          dataKey="oee"
          name="OEE"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="availability"
          name="Availability"
          stroke="#16a34a"
          fill="#16a34a"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="performance"
          name="Performance"
          stroke="#ea580c"
          fill="#ea580c"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="quality"
          name="Quality"
          stroke="#9333ea"
          fill="#9333ea"
          fillOpacity={0.1}
          strokeWidth={2}
        />

        {/* Previous period metrics (dashed lines) */}
        {showComparison && (
          <>
            <Area
              type="monotone"
              dataKey="oee_prev"
              name={`OEE (${comparisonLabel})`}
              stroke="#2563eb"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="availability_prev"
              name={`Availability (${comparisonLabel})`}
              stroke="#16a34a"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="performance_prev"
              name={`Performance (${comparisonLabel})`}
              stroke="#ea580c"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="quality_prev"
              name={`Quality (${comparisonLabel})`}
              stroke="#9333ea"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default OEEChart;