import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import OEEGauge from './OEEGauge';
import OEEChart from './OEEChart';

interface MachineOEEMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  trend: number;
}

interface MachineOEECardProps {
  machineName: string;
  metrics: MachineOEEMetrics;
  historicalData: any[];
}

const MachineOEECard: React.FC<MachineOEECardProps> = ({
  machineName,
  metrics,
  historicalData
}) => {
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <ArrowUp className="h-4 w-4" />;
    if (trend < 0) return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  // Recalcul de l'OEE à partir des composants
  const calculatedOEE = (metrics.availability * metrics.performance * metrics.quality) / 10000;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">{machineName}</h3>
          <div className={`flex items-center ${getTrendColor(metrics.trend)}`}>
            {getTrendIcon(metrics.trend)}
            <span className="ml-1 text-sm font-medium">
              {Math.abs(metrics.trend).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Gauges Column */}
          <div className="space-y-6">
            <div className="flex justify-center">
              <OEEGauge
                value={calculatedOEE}
                label="OEE"
                color="#2563EB"
                size="lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <OEEGauge
                value={metrics.availability}
                label="A"
                color="#16A34A"
                size="sm"
              />
              <OEEGauge
                value={metrics.performance}
                label="P"
                color="#EA580C"
                size="sm"
              />
              <OEEGauge
                value={metrics.quality}
                label="Q"
                color="#9333EA"
                size="sm"
              />
            </div>
          </div>

          {/* Trend Chart Column */}
          <div className="h-64">
            <OEEChart
              data={historicalData}
              showComparison={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineOEECard;