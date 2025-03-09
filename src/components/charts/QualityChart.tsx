import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QualityData {
  date: string;
  rework: number;
  scrap: number;
  other: number;
}

interface ComparisonData {
  date: string;
  rework: number;
  scrap: number;
  other: number;
}

interface QualityChartProps {
  data: QualityData[];
  comparisonData?: ComparisonData[];
  showComparison?: boolean;
  comparisonLabel?: string;
}

const QualityChart: React.FC<QualityChartProps> = ({ 
  data, 
  comparisonData,
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  const combinedData = data.map((item, index) => ({
    ...item,
    ...(showComparison && comparisonData && comparisonData[index] ? {
      rework_prev: comparisonData[index].rework,
      scrap_prev: comparisonData[index].scrap,
      other_prev: comparisonData[index].other
    } : {})
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">Date: {label}</p>
          <div className="space-y-1">
            <p className="text-sm text-yellow-600">
              Rework: {payload[0].value}
              {showComparison && payload[3] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[3].value})
                </span>
              )}
            </p>
            <p className="text-sm text-red-600">
              Scrap: {payload[1].value}
              {showComparison && payload[4] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[4].value})
                </span>
              )}
            </p>
            <p className="text-sm text-gray-600">
              Other: {payload[2].value}
              {showComparison && payload[5] && (
                <span className="text-gray-500 ml-2">
                  (prev: {payload[5].value})
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
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={combinedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {/* Current period */}
        <Bar dataKey="rework" name="Rework" fill="#eab308" stackId="stack" />
        <Bar dataKey="scrap" name="Scrap" fill="#dc2626" stackId="stack" />
        <Bar dataKey="other" name="Other" fill="#9ca3af" stackId="stack" />

        {/* Previous period */}
        {showComparison && (
          <>
            <Bar 
              dataKey="rework_prev" 
              name={`Rework (${comparisonLabel})`} 
              fill="#eab308" 
              fillOpacity={0.3} 
              stackId="stack_prev" 
            />
            <Bar 
              dataKey="scrap_prev" 
              name={`Scrap (${comparisonLabel})`} 
              fill="#dc2626" 
              fillOpacity={0.3} 
              stackId="stack_prev" 
            />
            <Bar 
              dataKey="other_prev" 
              name={`Other (${comparisonLabel})`} 
              fill="#9ca3af" 
              fillOpacity={0.3} 
              stackId="stack_prev" 
            />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default QualityChart;