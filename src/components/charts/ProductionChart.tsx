import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ProductionData {
  date: string;
  actual: number;
  target: number;
  scrap: number;
}

interface ComparisonData {
  date: string;
  actual: number;
  target: number;
  scrap: number;
}

interface ProductionChartProps {
  data: ProductionData[];
  comparisonData?: ComparisonData[];
  showComparison?: boolean;
  comparisonLabel?: string;
}

const ProductionChart: React.FC<ProductionChartProps> = ({
  data,
  comparisonData,
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  const combinedData = data.map((item, index) => ({
    ...item,
    ...(showComparison && comparisonData && comparisonData[index] ? {
      actual_prev: comparisonData[index].actual,
      target_prev: comparisonData[index].target,
      scrap_prev: comparisonData[index].scrap
    } : {})
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
          <p className="font-medium text-gray-900 mb-2">Date: {label}</p>
          <p className="text-blue-600">
            Actual: {payload[0].value}
            {showComparison && payload[3] !== undefined && (
              <span className="text-gray-500 ml-2">(prev: {payload[3].value})</span>
            )}
          </p>
          <p className="text-green-600">
            Target: {payload[1].value}
            {showComparison && payload[4] !== undefined && (
              <span className="text-gray-500 ml-2">(prev: {payload[4].value})</span>
            )}
          </p>
          <p className="text-red-600">
            Scrap: {payload[2].value}
            {showComparison && payload[5] !== undefined && (
              <span className="text-gray-500 ml-2">(prev: {payload[5].value})</span>
            )}
          </p>
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
        {/* Période courante */}
        <Bar dataKey="actual" name="Actual Production" fill="#2563eb" />
        <Bar dataKey="target" name="Target" fill="#16a34a" />
        <Bar dataKey="scrap" name="Scrap" fill="#dc2626" />
        {/* Comparaison */}
        {showComparison && (
          <>
            <Bar dataKey="actual_prev" name={`Actual (${comparisonLabel})`} fill="#2563eb" fillOpacity={0.3} />
            <Bar dataKey="target_prev" name={`Target (${comparisonLabel})`} fill="#16a34a" fillOpacity={0.3} />
            <Bar dataKey="scrap_prev" name={`Scrap (${comparisonLabel})`} fill="#dc2626" fillOpacity={0.3} />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProductionChart;
