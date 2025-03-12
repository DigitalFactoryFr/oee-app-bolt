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

  // 1. Calcul de l'OEE global d'abord
  let totalUsefulTime = 0;  // Temps utile total
  let totalOpeningTime = 0; // Temps d'ouverture total

  data.lots.forEach(lot => {
    if (lot.products?.cycle_time) {
      // Calculer le nombre total de pièces (conformes + retouchées)
      const okParts = lot.ok_parts_produced;
      
      // Trouver les retouches pour ce lot
      const reworkParts = data.quality
        .filter(issue => 
          issue.lot_id === lot.id && 
          (issue.category === 'at_station_rework' || issue.category === 'off_station_rework')
        )
        .reduce((sum, issue) => sum + issue.quantity, 0);

      // Calculer le temps utile pour ce lot
      const totalParts = okParts + reworkParts;
      const cycleTimeHours = lot.products.cycle_time / 3600; // Convertir en heures
      totalUsefulTime += totalParts * cycleTimeHours;

      // Ajouter le temps d'ouverture pour ce lot
      const start = new Date(lot.start_time);
      const end = lot.end_time ? new Date(lot.end_time) : new Date();
      const openingTimeHours = (end.getTime() - start.getTime()) / (1000 * 3600); // en heures
      totalOpeningTime += openingTimeHours;
    }
  });

  // Calculer l'OEE global
  metrics.oee = totalOpeningTime > 0 ? (totalUsefulTime / totalOpeningTime) * 100 : 0;

  // 2. Calcul de la disponibilité (A)
  const plannedDowntime = data.stops
    .filter(stop => stop.failure_type === 'AP')
    .reduce((total, stop) => {
      const start = new Date(stop.start_time);
      const end = stop.end_time ? new Date(stop.end_time) : new Date();
      return total + (end.getTime() - start.getTime()) / (1000 * 3600); // en heures
    }, 0);

  metrics.availability = totalOpeningTime > 0 
    ? ((totalOpeningTime - plannedDowntime) / totalOpeningTime) * 100 
    : 100;

  // 3. Calcul de la qualité (Q)
  let totalProduced = 0;
  let goodParts = 0;

  data.lots.forEach(lot => {
    const okParts = lot.ok_parts_produced;
    const qualityIssues = data.quality
      .filter(issue => issue.lot_id === lot.id)
      .reduce((sum, issue) => sum + issue.quantity, 0);

    totalProduced += okParts + qualityIssues;
    goodParts += okParts;
  });

  metrics.quality = totalProduced > 0 ? (goodParts / totalProduced) * 100 : 100;

  // 4. Calcul de la performance (P) à partir de l'OEE, A et Q
  // P = OEE / (A * Q)
  metrics.performance = (metrics.availability > 0 && metrics.quality > 0)
    ? (metrics.oee / (metrics.availability * metrics.quality)) * 10000
    : 0;

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