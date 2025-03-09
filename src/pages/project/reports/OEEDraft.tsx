import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Download, Calculator } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

interface OEEData {
  date: string;
  line: string;
  machine: string;
  product: string;
  team: string;
  operator: string;
  start_time: string;
  end_time: string;
  opening_time: number;
  lot_duration: number;
  planned_dt: number;
  other_dt: number;
  good_parts: number;
  scrap: number;
  theoretical_parts: number;
  products: {
    cycle_time: number;
  };
}

const OEEDraft: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OEEData[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const calculateMetrics = (row: OEEData) => {
    const totalParts = row.good_parts + row.scrap;
    const availableTime = row.opening_time - row.planned_dt;
    const actualProductionTime = row.lot_duration - row.planned_dt - row.other_dt;
    const cycleTimeMinutes = row.products.cycle_time / 60;
    const theoreticalProductionTime = totalParts * cycleTimeMinutes;

    const availability = (actualProductionTime / availableTime) * 100;
    const performance = (totalParts / row.theoretical_parts) * 100;
    const quality = (row.good_parts / totalParts) * 100;
    const oee = (availability * performance * quality) / 10000;

    return {
      availability: Math.min(100, Math.max(0, availability)),
      performance: Math.min(100, Math.max(0, performance)),
      quality: Math.min(100, Math.max(0, quality)),
      oee: Math.min(100, Math.max(0, oee)),
      actualProductionTime,
      theoreticalProductionTime
    };
  };

  const loadData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      console.log("🔍 Fetching data for project:", projectId);

      const [lotsResult, stopsResult, qualityResult] = await Promise.all([
        supabase
          .from('lots')
          .select(`
            id,
            date,
            start_time,
            end_time,
            lot_size,
            ok_parts_produced,
            products (
              id,
              name,
              cycle_time,
              machine_id,
              machines (
                id,
                name,
                production_lines (
                  id,
                  name,
                  opening_time_minutes
                )
              )
            ),
            team_members (
              id,
              email,
              team_name
            ),
            status
          `)
          .eq('project_id', projectId)
          .order('date', { ascending: true }),

        supabase
          .from('stop_events')
          .select(`
            id,
            date,
            start_time,
            end_time,
            failure_type,
            machine,
            cause,
            status,
            lot_id
          `)
          .eq('project_id', projectId),

        supabase
          .from('quality_issues')
          .select(`
            id,
            date,
            start_time,
            end_time,
            category,
            quantity,
            machine,
            cause,
            status,
            lot_id
          `)
          .eq('project_id', projectId)
      ]);

      if (lotsResult.error) throw lotsResult.error;
      if (stopsResult.error) throw stopsResult.error;
      if (qualityResult.error) throw qualityResult.error;

      console.log("📊 Raw data fetched:", {
        lots: lotsResult.data?.length || 0,
        stops: stopsResult.data?.length || 0,
        quality: qualityResult.data?.length || 0
      });

      const lotsByDateAndMachine = new Map<string, any[]>();
      
      lotsResult.data?.forEach(lot => {
        const key = `${lot.date}-${lot.products.machine_id}`;
        if (!lotsByDateAndMachine.has(key)) {
          lotsByDateAndMachine.set(key, []);
        }
        lotsByDateAndMachine.get(key)?.push(lot);
      });

      const processedData: OEEData[] = [];

      lotsByDateAndMachine.forEach((machineLots, key) => {
        const [date, machineId] = key.split('-');
        
        machineLots.sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        machineLots.forEach(lot => {
          if (!lot.products?.machines?.production_lines) {
            console.warn("⚠️ Skipping lot due to missing machine/line info:", lot.id);
            return;
          }

          const openingTime = lot.products.machines.production_lines.opening_time_minutes;
          const startTime = new Date(lot.start_time);
          const endTime = lot.status === 'completed' ? new Date(lot.end_time) : new Date();
          
          const lotDuration = differenceInMinutes(endTime, startTime);

          const lotStops = stopsResult.data?.filter(stop => 
            stop.lot_id === lot.id || (
              stop.date === date &&
              stop.machine === machineId &&
              new Date(stop.start_time) >= startTime &&
              new Date(stop.end_time || new Date()) <= endTime
            )
          ) || [];

          console.log(`📊 Found ${lotStops.length} stops for lot ${lot.id}`);

          const plannedDT = lotStops
            .filter(stop => stop.failure_type === 'AP')
            .reduce((total, stop) => {
              const stopStart = new Date(stop.start_time);
              const stopEnd = stop.end_time ? new Date(stop.end_time) : new Date();
              return total + differenceInMinutes(stopEnd, stopStart);
            }, 0);

          const otherDT = lotStops
            .filter(stop => stop.failure_type !== 'AP')
            .reduce((total, stop) => {
              const stopStart = new Date(stop.start_time);
              const stopEnd = stop.end_time ? new Date(stop.end_time) : new Date();
              return total + differenceInMinutes(stopEnd, stopStart);
            }, 0);

          const lotQuality = qualityResult.data?.filter(issue => 
            issue.lot_id === lot.id || (
              issue.date === date &&
              issue.machine === machineId &&
              new Date(issue.start_time) >= startTime &&
              new Date(issue.end_time || new Date()) <= endTime
            )
          ) || [];

          console.log(`📊 Found ${lotQuality.length} quality issues for lot ${lot.id}`);

          const scrap = lotQuality
            .filter(issue => issue.category === 'scrap')
            .reduce((total, issue) => total + issue.quantity, 0);

          const cycleTime = lot.products.cycle_time;
          const availableTime = openingTime - plannedDT;
          const theoreticalParts = Math.floor((availableTime * 60) / cycleTime);

          processedData.push({
            date: lot.date,
            line: lot.products.machines.production_lines.name,
            machine: lot.products.machines.name,
            product: lot.products.name,
            team: lot.team_members.team_name,
            operator: lot.team_members.email,
            start_time: format(startTime, 'HH:mm'),
            end_time: format(endTime, 'HH:mm'),
            opening_time: openingTime,
            lot_duration: lotDuration,
            planned_dt: plannedDT,
            other_dt: otherDT,
            scrap,
            good_parts: lot.ok_parts_produced,
            theoretical_parts: theoreticalParts,
            products: {
              cycle_time: lot.products.cycle_time
            }
          });
        });
      });

      console.log("✅ Processed data:", processedData.length, "records");
      setData(processedData);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading OEE data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load OEE data');
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      'Date',
      'Line',
      'Machine',
      'Product',
      'Team',
      'Operator',
      'Start Time',
      'End Time',
      'Opening Time',
      'Lot Duration',
      'Planned DT',
      'Other DT',
      'Good Parts',
      'Scrap',
      'Theoretical Parts',
      'Availability %',
      'Performance %',
      'Quality %',
      'OEE %'
    ];

    const rows = data.map(row => {
      const metrics = calculateMetrics(row);
      return [
        row.date,
        row.line,
        row.machine,
        row.product,
        row.team,
        row.operator,
        row.start_time,
        row.end_time,
        row.opening_time,
        row.lot_duration,
        row.planned_dt,
        row.other_dt,
        row.good_parts,
        row.scrap,
        row.theoretical_parts,
        metrics.availability.toFixed(1),
        metrics.performance.toFixed(1),
        metrics.quality.toFixed(1),
        metrics.oee.toFixed(1)
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `oee_calculations_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OEE Draft Calculations</h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed OEE calculations with example-based metrics
            </p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Line
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Machine
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team/Operator
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Time
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opening Time
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lot Duration
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Planned DT
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Other DT
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Good Parts
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scrap
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Theoretical
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Availability
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quality
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      OEE
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((row, index) => {
                    const metrics = calculateMetrics(row);

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.date}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.line}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.machine}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.product}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{row.team}</div>
                          <div className="text-xs text-gray-400">{row.operator}</div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.start_time}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.end_time}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.opening_time}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.lot_duration}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.planned_dt}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.other_dt}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.good_parts}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.scrap}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.theoretical_parts}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className="text-green-600 font-medium">{metrics.availability.toFixed(1)}%</span>
                          <div className="text-xs text-gray-400">
                            {row.lot_duration - row.planned_dt - row.other_dt}/{row.opening_time - row.planned_dt}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className="text-orange-600 font-medium">{metrics.performance.toFixed(1)}%</span>
                          <div className="text-xs text-gray-400">
                            {row.good_parts + row.scrap}/{row.theoretical_parts}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className="text-purple-600 font-medium">{metrics.quality.toFixed(1)}%</span>
                          <div className="text-xs text-gray-400">
                            {row.good_parts}/{row.good_parts + row.scrap}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className="text-blue-600 font-medium">{metrics.oee.toFixed(1)}%</span>
                          <div className="text-xs text-gray-400">
                            A × P × Q
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default OEEDraft;