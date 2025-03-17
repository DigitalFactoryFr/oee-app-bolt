// src/components/charts/DowntimeChart.tsx

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DowntimeData {
  name: string;    // ex. 'AP', 'PA', 'DO', 'NQ', 'other'
  value: number;   // heures sur la période courante
  color: string;   // couleur pour la part
}

interface DowntimeChartProps {
  data: DowntimeData[];             // distribution courante
  comparisonData?: DowntimeData[];  // distribution comparée
  showComparison?: boolean;
  comparisonLabel?: string;
}

const DowntimeChart: React.FC<DowntimeChartProps> = ({
  data,
  comparisonData,
  showComparison = false,
  comparisonLabel = 'Previous Period'
}) => {
  // 1) Récupérer l'ensemble des catégories (name) présentes
  const allNames = new Set(data.map(d => d.name));
  if (showComparison && comparisonData) {
    comparisonData.forEach(d => allNames.add(d.name));
  }

  // 2) Construire un tableau fusionné "combinedData"
  //    pour que chaque catégorie apparaisse avec :
  //      - value : valeur courante
  //      - value_prev : valeur comparée
  //      - color : la couleur de la catégorie

  console.log('[DowntimeChart] data:', data);
console.log('[DowntimeChart] comparisonData:', comparisonData);

  const combinedData = Array.from(allNames).map(name => {
    // Chercher la catégorie correspondante dans data (courant)
    const current = data.find(d => d.name === name);
    // Chercher la catégorie correspondante dans comparisonData (si présente)
    const prev = comparisonData?.find(d => d.name === name);

    return {
      name,
      value: current?.value ?? 0,
      // On récupère la couleur depuis la période courante,
      // ou depuis la comparaison si elle n'est pas définie dans current,
      // ou une couleur par défaut (#999999).
      color: current?.color || prev?.color || '#999999',
      value_prev: prev?.value ?? 0
    };
  });

  // 3) Tooltip personnalisé
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
        {/* Donut principal (période courante) */}
        <Pie
          data={combinedData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {combinedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
            />
          ))}
        </Pie>

        {/* Donut pour la période de comparaison */}
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
              <Cell
                key={`cell-prev-${index}`}
                fill={entry.color}
                fillOpacity={0.4}
              />
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
