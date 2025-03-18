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

interface StopTimeData {
  date: string;
  AP: number;
  PA: number;
  DO: number;
  NQ: number;
  other: number;
  // Valeurs comparées (optionnelles)
  AP_prev?: number;
  PA_prev?: number;
  DO_prev?: number;
  NQ_prev?: number;
  other_prev?: number;
}

interface StopTimeChartProps {
  data: StopTimeData[];
  comparisonData?: StopTimeData[];
  showComparison?: boolean;
  comparisonLabel?: string;
}

const StopTimeChart: React.FC<StopTimeChartProps> = ({
  data,
  comparisonData,
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  // Fusionner les données courantes et comparées
  const combinedData = data.map((item, idx) => {
    const prev = comparisonData?.[idx];
    if (showComparison && prev) {
      return {
        ...item,
        AP_prev: prev.AP,
        PA_prev: prev.PA,
        DO_prev: prev.DO,
        NQ_prev: prev.NQ,
        other_prev: prev.other
      };
    }
    return item;
  });

  // Composant Tooltip personnalisé avec vérification sécurisée
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      // Fonction pour récupérer la valeur en toute sécurité
      const getValue = (index: number) => {
        return payload[index] && payload[index].value !== undefined
          ? payload[index].value
          : 0;
      };

      return (
        <div className="bg-white p-2 border border-gray-200 shadow rounded text-sm">
          <p className="font-medium text-gray-900 mb-1">Date: {label}</p>
          <p className="text-blue-600">
            AP: {getValue(0).toFixed(1)}h
            {showComparison && payload[5] && (
              <span className="text-gray-500 ml-2">
                (prev: {getValue(5).toFixed(1)}h)
              </span>
            )}
          </p>
          <p className="text-red-600">
            PA: {getValue(1).toFixed(1)}h
            {showComparison && payload[6] && (
              <span className="text-gray-500 ml-2">
                (prev: {getValue(6).toFixed(1)}h)
              </span>
            )}
          </p>
          <p className="text-yellow-600">
            DO: {getValue(2).toFixed(1)}h
            {showComparison && payload[7] && (
              <span className="text-gray-500 ml-2">
                (prev: {getValue(7).toFixed(1)}h)
              </span>
            )}
          </p>
          <p className="text-purple-600">
            NQ: {getValue(3).toFixed(1)}h
            {showComparison && payload[8] && (
              <span className="text-gray-500 ml-2">
                (prev: {getValue(8).toFixed(1)}h)
              </span>
            )}
          </p>
          <p className="text-gray-600">
            Other: {getValue(4).toFixed(1)}h
            {showComparison && payload[9] && (
              <span className="text-gray-500 ml-2">
                (prev: {getValue(9).toFixed(1)}h)
              </span>
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
        <Bar dataKey="AP" name="AP" fill="#2563eb" stackId="stack" />
        <Bar dataKey="PA" name="PA" fill="#dc2626" stackId="stack" />
        <Bar dataKey="DO" name="DO" fill="#eab308" stackId="stack" />
        <Bar dataKey="NQ" name="NQ" fill="#9333ea" stackId="stack" />
        <Bar dataKey="other" name="Other" fill="#9ca3af" stackId="stack" />
        {/* Comparaison */}
        {showComparison && (
          <>
            <Bar
              dataKey="AP_prev"
              name={`AP (${comparisonLabel})`}
              fill="#2563eb"
              fillOpacity={0.3}
              stackId="stack_prev"
            />
            <Bar
              dataKey="PA_prev"
              name={`PA (${comparisonLabel})`}
              fill="#dc2626"
              fillOpacity={0.3}
              stackId="stack_prev"
            />
            <Bar
              dataKey="DO_prev"
              name={`DO (${comparisonLabel})`}
              fill="#eab308"
              fillOpacity={0.3}
              stackId="stack_prev"
            />
            <Bar
              dataKey="NQ_prev"
              name={`NQ (${comparisonLabel})`}
              fill="#9333ea"
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

export default StopTimeChart;
