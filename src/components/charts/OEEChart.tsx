import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface OEEData {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  // Champs de comparaison (optionnels)
  oee_prev?: number;
  availability_prev?: number;
  performance_prev?: number;
  quality_prev?: number;
}

interface OEEChartProps {
  data: OEEData[];
  showComparison?: boolean; // active l'affichage des courbes en pointillé
}

const OEEChart: React.FC<OEEChartProps> = ({
  data,
  showComparison = false
}) => {
  // Tooltip personnalisé
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      // `payload[0].payload` contient tout l'objet data de la ligne survolée
      const d = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
          <p className="font-medium text-gray-900 mb-2">Date: {label}</p>
          <p className="text-blue-600">
            OEE: {d.oee.toFixed(1)}%
            {showComparison && d.oee_prev !== undefined && (
              <span className="text-gray-500 ml-2">
                (prev: {d.oee_prev.toFixed(1)}%)
              </span>
            )}
          </p>
          <p className="text-green-600">
            Availability: {d.availability.toFixed(1)}%
            {showComparison && d.availability_prev !== undefined && (
              <span className="text-gray-500 ml-2">
                (prev: {d.availability_prev.toFixed(1)}%)
              </span>
            )}
          </p>
          <p className="text-orange-600">
            Performance: {d.performance.toFixed(1)}%
            {showComparison && d.performance_prev !== undefined && (
              <span className="text-gray-500 ml-2">
                (prev: {d.performance_prev.toFixed(1)}%)
              </span>
            )}
          </p>
          <p className="text-purple-600">
            Quality: {d.quality.toFixed(1)}%
            {showComparison && d.quality_prev !== undefined && (
              <span className="text-gray-500 ml-2">
                (prev: {d.quality_prev.toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Courbes principales */}
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

        {/* Courbes de comparaison (pointillées) */}
        {showComparison && (
          <>
            <Area
              type="monotone"
              dataKey="oee_prev"
              name="OEE (Previous)"
              stroke="#2563eb"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="availability_prev"
              name="Availability (Previous)"
              stroke="#16a34a"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="performance_prev"
              name="Performance (Previous)"
              stroke="#ea580c"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="quality_prev"
              name="Quality (Previous)"
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
