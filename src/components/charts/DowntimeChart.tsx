import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DowntimeData {
  name: string;
  value: number;
  color: string;
}

interface DowntimeChartProps {
  data: DowntimeData[];
}

const DowntimeChart: React.FC<DowntimeChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          fill="#8884d8"
          paddingAngle={5}
          dataKey="value"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value.toFixed(1)} hours`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DowntimeChart;
