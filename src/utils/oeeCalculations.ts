import { format } from 'date-fns';

export interface OEEMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface ProductionData {
  date: string;
  lots: any[];
  stops: any[];
  quality: any[];
  openingTime: number;
}

export const calculateOEE = (data: ProductionData): OEEMetrics => {
  // Initialiser les métriques
  const metrics: OEEMetrics = {
    oee: 0,
    availability: 100,
    performance: 0,
    quality: 100
  };

  // Si pas de données, retourner les valeurs par défaut
  if (!data.lots || data.lots.length === 0) {
    return metrics;
  }

  // 1. Calcul de la disponibilité
  const plannedDowntime = data.stops
    .filter(stop => stop.failure_type === 'AP')
    .reduce((total, stop) => {
      const start = new Date(stop.start_time);
      const end = stop.end_time ? new Date(stop.end_time) : new Date();
      return total + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);

  const availableTime = data.openingTime - plannedDowntime;
  metrics.availability = (availableTime / data.openingTime) * 100;

  // 2. Calcul de la performance
  let totalTheoreticalTime = 0;
  let totalActualTime = 0;

  data.lots.forEach(lot => {
    if (lot.products?.cycle_time && lot.lot_size > 0) {
      const theoreticalTime = (lot.products.cycle_time * lot.lot_size) / 60; // en minutes
      const actualTime = (lot.products.cycle_time * lot.ok_parts_produced) / 60;
      
      totalTheoreticalTime += theoreticalTime;
      totalActualTime += actualTime;
    }
  });

  if (totalTheoreticalTime > 0) {
    metrics.performance = (totalActualTime / totalTheoreticalTime) * 100;
  }

  // 3. Calcul de la qualité
  const totalParts = data.lots.reduce((sum, lot) => sum + lot.lot_size, 0);
  const goodParts = data.lots.reduce((sum, lot) => sum + lot.ok_parts_produced, 0);

  if (totalParts > 0) {
    metrics.quality = (goodParts / totalParts) * 100;
  }

  // 4. Calcul de l'OEE global
  metrics.oee = (metrics.availability * metrics.performance * metrics.quality) / 10000;

  // Limiter toutes les valeurs entre 0 et 100
  Object.keys(metrics).forEach(key => {
    metrics[key as keyof OEEMetrics] = Math.min(100, Math.max(0, metrics[key as keyof OEEMetrics]));
  });

  return metrics;
};

export const calculateDailyOEE = (
  date: string,
  lots: any[],
  stops: any[],
  quality: any[],
  openingTime: number
): OEEMetrics => {
  const dayData: ProductionData = {
    date,
    lots: lots.filter(lot => lot.date === date),
    stops: stops.filter(stop => stop.date === date),
    quality: quality.filter(issue => issue.date === date),
    openingTime
  };

  return calculateOEE(dayData);
};

export const aggregateOEEData = (
  startDate: Date,
  endDate: Date,
  lots: any[],
  stops: any[],
  quality: any[],
  openingTime: number
): OEEData[] => {
  const data: OEEData[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const metrics = calculateDailyOEE(dateStr, lots, stops, quality, openingTime);

    data.push({
      date: dateStr,
      ...metrics
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return data;
};