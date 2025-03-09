import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Calculator, Download } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { supabase } from '../../../lib/supabase';

interface OEECalculation {
  date: string;
  line: string;
  machine: string;
  product: string;
  team: string;
  openingTime: number;
  lotDuration: number;
  totalLotDuration: number;
  adjustedLotDuration: number;
  plannedDowntime: number;
  otherDowntime: number;
  scrapCount: number;
  totalParts: number;
  goodParts: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

const OEEDraftPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [calculations, setCalculations] = useState<OEECalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all required data
      const [lotsResult, stopsResult, qualityResult, linesResult, machinesResult] = await Promise.all([
        supabase
          .from('lots')
          .select(`
            id,
            date,
            start_time,
            end_time,
            lot_size,
            ok_parts_produced,
            products (name, cycle_time),
            machines (name, line_id),
            team_members (email, working_time_minutes)
          `)
          .eq('project_id', projectId)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('stop_events')
          .select('*')
          .eq('project_id', projectId),
        supabase
          .from('quality_issues')
          .select('*')
          .eq('project_id', projectId)
          .eq('category', 'scrap'),
        supabase
          .from('production_lines')
          .select('id, name')
          .eq('project_id', projectId),
        supabase
          .from('machines')
          .select('id, name, line_id')
          .eq('project_id', projectId)
      ]);

      if (lotsResult.error) throw lotsResult.error;
      if (stopsResult.error) throw stopsResult.error;
      if (qualityResult.error) throw qualityResult.error;
      if (linesResult.error) throw linesResult.error;
      if (machinesResult.error) throw machinesResult.error;

      // Group data by date and machine
      const calculationMap = new Map<string, OEECalculation>();

      // Process lots
      lotsResult.data?.forEach(lot => {
        const machineId = lot.machines?.id;
        const machine = machinesResult.data?.find(m => m.id === machineId);
        const line = linesResult.data?.find(l => l.id === machine?.line_id);
        
        if (!machine || !line) return;

        const key = `${lot.date}-${machine.id}`;
        const existing = calculationMap.get(key) || {
          date: lot.date,
          line: line.name,
          machine: machine.name,
          product: lot.products?.name || '',
          team: lot.team_members?.email || '',
          openingTime: lot.team_members?.working_time_minutes || 480,
          lotDuration: 0,
          totalLotDuration: 0,
          adjustedLotDuration: 0,
          plannedDowntime: 0,
          otherDowntime: 0,
          scrapCount: 0,
          totalParts: 0,
          goodParts: 0,
          availability: 0,
          performance: 0,
          quality: 0,
          oee: 0
        };

        // Calculate lot duration
        const startTime = new Date(lot.start_time);
        const endTime = lot.end_time ? new Date(lot.end_time) : new Date();
        const duration = differenceInMinutes(endTime, startTime);

        existing.lotDuration = duration;
        existing.totalLotDuration += duration;
        existing.totalParts += lot.lot_size;
        existing.goodParts += lot.ok_parts_produced;

        calculationMap.set(key, existing);
      });

      // Process stops
      stopsResult.data?.forEach(stop => {
        const key = `${stop.date}-${stop.machine}`;
        const calculation = calculationMap.get(key);
        if (!calculation) return;

        const startTime = new Date(stop.start_time);
        const endTime = stop.end_time ? new Date(stop.end_time) : new Date();
        const duration = differenceInMinutes(endTime, startTime);

        if (stop.failure_type === 'AP') {
          calculation.plannedDowntime += duration;
        } else {
          calculation.otherDowntime += duration;
        }
      });

      // Process quality issues
      qualityResult.data?.forEach(issue => {
        const key = `${issue.date}-${issue.machine}`;
        const calculation = calculationMap.get(key);
        if (!calculation) return;

        calculation.scrapCount += issue.quantity;
      });

      // Calculate final metrics
      calculationMap.forEach(calc => {
        // Adjust lot duration based on number of lots
        const lotsForMachine = lotsResult.data?.filter(
          lot => lot.date === calc.date && lot.machines?.name === calc.machine
        );
        const numberOfLots = lotsForMachine?.length || 1;
        const remainingTime = calc.openingTime - calc.totalLotDuration;
        calc.adjustedLotDuration = calc.totalLotDuration + (remainingTime / numberOfLots);

        // Calculate availability
        const availableTime = calc.openingTime - calc.plannedDowntime;
        const runningTime = availableTime - calc.otherDowntime;
        calc.availability = (runningTime / availableTime) * 100;

        // Calculate performance
        calc.performance = (calc.totalLotDuration / calc.adjustedLotDuration) * 100;

        // Calculate quality
        calc.quality = calc.totalParts > 0 ? ((calc.goodParts) / calc.totalParts) * 100 : 0;

        // Calculate OEE
        calc.oee = (calc.availability * calc.performance * calc.quality) / 10000;

        // Ensure all metrics are between 0 and 100
        calc.availability = Math.min(100, Math.max(0, calc.availability));
        calc.performance = Math.min(100, Math.max(0, calc.performance));
        calc.quality = Math.min(100, Math.max(0, calc.quality));
        calc.oee = Math.min(100, Math.max(0, calc.oee));
      });

      setCalculations(Array.from(calculationMap.values()));
      setLoading(false);
    } catch (err) {
      console.error('Error loading OEE data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load OEE data');
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Line', 'Machine', 'Product', 'Team', 'Opening Time', 'Lot Duration', 
       'Total Lot Duration', 'Adjusted Lot Duration', 'Planned Downtime', 'Other Downtime',
       'Scrap Count', 'Total Parts', 'Good Parts', 'Availability', 'Performance', 'Quality', 'OEE'].join(','),
      ...calculations.map(calc => [
        calc.date,
        calc.line,
        calc.machine,
        calc.product,
        calc.team,
        calc.openingTime,
        calc.lotDuration,
        calc.totalLotDuration,
        calc.adjustedLotDuration,
        calc.plannedDowntime,
        calc.otherDowntime,
        calc.scrapCount,
        calc.totalParts,
        calc.goodParts,
        calc.availability.toFixed(2),
        calc.performance.toFixed(2),
        calc.quality.toFixed(2),
        calc.oee.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oee_calculations_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OEE Draft Calculations</h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed OEE calculations with adjusted lot durations
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
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opening Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Duration</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjusted Duration</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned DT</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Other DT</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scrap</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parts</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Good Parts</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">A (%)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P (%)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Q (%)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OEE (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((calc, index) => (
                    <tr key={`${calc.date}-${calc.machine}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.line}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.machine}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.product}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.team}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.openingTime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.lotDuration}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.adjustedLotDuration.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.plannedDowntime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.otherDowntime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.scrapCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.totalParts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{calc.goodParts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{calc.availability.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{calc.performance.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{calc.quality.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{calc.oee.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default OEEDraftPage;