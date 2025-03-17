import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DowntimeData {
  name: string;   // ex. 'AP', 'PA', 'DO', 'NQ', 'other'
  value: number;  // heures sur la période courante
  color: string;  // couleur pour la part
}

interface DowntimeComparisonData {
  name: string;
  value: number;
  color: string;
  value_prev?: number; // on ajoutera manuellement si on fusionne
}

interface DowntimeChartProps {
  data: DowntimeData[];
  comparisonData?: DowntimeData[];
  showComparison?: boolean;
  comparisonLabel?: string;
}

const DowntimeChart: React.FC<DowntimeChartProps> = ({
  data,
  comparisonData,
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  // Fusionner la data => si "showComparison" est true, on ajoute value_prev
  const combinedData = data.map((item) => {
    const foundPrev = comparisonData?.find((d) => d.name === item.name);
    return {
      ...item,
      value_prev: foundPrev ? foundPrev.value : 0
    };
  });

  // Tooltip personnalisé
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 shadow rounded text-sm">
          <p className="font-semibold">{item.name}</p>
          <p>Current: {item.value.toFixed(1)}h</p>
          {showComparison && (
            <p>
              {comparisonLabel}: {item.value_prev.toFixed(1)}h
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        {/* Pie pour la période courante */}
        <Pie
          data={combinedData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
        >
          {combinedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        {/* Pie pour la période de comparaison */}
        {showComparison && (
          <Pie
            data={combinedData}
            dataKey="value_prev"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={85}
            outerRadius={105}
            paddingAngle={5}
            strokeDasharray="3 3"
            labelLine={false}
          >
            {combinedData.map((entry, index) => (
              <Cell key={`cell-prev-${index}`} fill={entry.color} fillOpacity={0.4} />
            ))}
          </Pie>
        )}

        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DowntimeChart;
