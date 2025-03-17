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
}

interface StopTimeComparisonData {
  date: string;
  AP: number;
  PA: number;
  DO: number;
  NQ: number;
  other: number;
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
  // Fusion
  const combinedData = data.map((item, idx) => {
    const foundPrev = comparisonData?.[idx];
    if (showComparison && foundPrev) {
      return {
        ...item,
        AP_prev: foundPrev.AP,
        PA_prev: foundPrev.PA,
        DO_prev: foundPrev.DO,
        NQ_prev: foundPrev.NQ,
        other_prev: foundPrev.other
      };
    }
    return item;
  });

  // Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow rounded text-sm">
          <p className="font-medium text-gray-900 mb-1">Date: {label}</p>
          {/* AP */}
          <p className="text-blue-600">
            AP: {payload[0].value.toFixed(1)}h
            {showComparison && payload[5] && (
              <span className="text-gray-500 ml-2">(prev: {payload[5].value.toFixed(1)}h)</span>
            )}
          </p>
          {/* PA */}
          <p className="text-red-600">
            PA: {payload[1].value.toFixed(1)}h
            {showComparison && payload[6] && (
              <span className="text-gray-500 ml-2">(prev: {payload[6].value.toFixed(1)}h)</span>
            )}
          </p>
          {/* DO */}
          <p className="text-yellow-600">
            DO: {payload[2].value.toFixed(1)}h
            {showComparison && payload[7] && (
              <span className="text-gray-500 ml-2">(prev: {payload[7].value.toFixed(1)}h)</span>
            )}
          </p>
          {/* NQ */}
          <p className="text-purple-600">
            NQ: {payload[3].value.toFixed(1)}h
            {showComparison && payload[8] && (
              <span className="text-gray-500 ml-2">(prev: {payload[8].value.toFixed(1)}h)</span>
            )}
          </p>
          {/* other */}
          <p className="text-gray-600">
            Other: {payload[4].value.toFixed(1)}h
            {showComparison && payload[9] && (
              <span className="text-gray-500 ml-2">(prev: {payload[9].value.toFixed(1)}h)</span>
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
            <Bar dataKey="AP_prev" name={`AP (${comparisonLabel})`} fill="#2563eb" fillOpacity={0.3} stackId="stack_prev" />
            <Bar dataKey="PA_prev" name={`PA (${comparisonLabel})`} fill="#dc2626" fillOpacity={0.3} stackId="stack_prev" />
            <Bar dataKey="DO_prev" name={`DO (${comparisonLabel})`} fill="#eab308" fillOpacity={0.3} stackId="stack_prev" />
            <Bar dataKey="NQ_prev" name={`NQ (${comparisonLabel})`} fill="#9333ea" fillOpacity={0.3} stackId="stack_prev" />
            <Bar dataKey="other_prev" name={`Other (${comparisonLabel})`} fill="#9ca3af" fillOpacity={0.3} stackId="stack_prev" />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StopTimeChart;
