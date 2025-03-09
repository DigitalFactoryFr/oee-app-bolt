import * as XLSX from 'xlsx';

export const generateSampleDataTemplates = () => {
  // Common data to ensure consistency - updated to match actual data
  const operators = [
    'operator1@example.com',
    'operator2@example.com'
  ];

  const machines = [
    'Machine 1',
    'Machine 2',
    'Machine 3'
  ];

  const products = [
    { name: 'Product A', machine: 'Machine 1', cycleTime: 45, productId: 'PROD-A' },
    { name: 'Product B', machine: 'Machine 2', cycleTime: 30, productId: 'PROD-B' },
    { name: 'Product C', machine: 'Machine 3', cycleTime: 60, productId: 'PROD-C' }
  ];

  // Generate dates for the last week
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  });

  // Generate lots data
  const lotsData = [];
  let lotCounter = 1;

  // Exact header row as specified
  lotsData.push([
    'date',
    'start_time',
    'end_time',
    'team_member',
    'product',
    'machine',
    'lot_id',
    'lot_size',
    'ok_parts_produced'
  ]);

  // Generate data rows
  dates.forEach(date => {
    products.forEach(product => {
      const operator = operators[Math.floor(Math.random() * operators.length)];
      
      // Morning shift
      lotsData.push([
        date,
        '06:00',
        '14:00',
        operator,
        product.name,
        product.machine,
        `LOT-${date}-${String(lotCounter++).padStart(3, '0')}`,
        480,
        450
      ]);

      // Afternoon shift
      lotsData.push([
        date,
        '14:00',
        '22:00',
        operator,
        product.name,
        product.machine,
        `LOT-${date}-${String(lotCounter++).padStart(3, '0')}`,
        480,
        460
      ]);
    });
  });

  // Generate stops data
  const stopsData = [];
  const failureTypes = ['AP', 'PA', 'DO', 'NQ', 'CS'];
  const stopCauses = {
    AP: ['Planned maintenance', 'Tool change', 'Setup change'],
    PA: ['Motor failure', 'Sensor error', 'Hydraulic system failure'],
    DO: ['Material shortage', 'Operator break', 'Team meeting'],
    NQ: ['Quality check', 'Process adjustment', 'Parameter tuning'],
    CS: ['Product changeover', 'Format change', 'Recipe update']
  };

  // Exact header row as specified
  stopsData.push([
    'date',
    'start_time',
    'end_time',
    'team_member',
    'product',
    'failure_type',
    'machine',
    'cause',
    'comment'
  ]);

  // Generate random stops
  dates.forEach(date => {
    machines.forEach(machine => {
      const numStops = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numStops; i++) {
        const failureType = failureTypes[Math.floor(Math.random() * failureTypes.length)];
        const causes = stopCauses[failureType as keyof typeof stopCauses];
        const cause = causes[Math.floor(Math.random() * causes.length)];
        
        const stopDuration = 15 + Math.floor(Math.random() * 46);
        const startHour = 8 + Math.floor(Math.random() * 8);
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endHour = startHour + Math.floor(stopDuration / 60);
        const endMinutes = stopDuration % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

        stopsData.push([
          date,
          startTime,
          endTime,
          operators[Math.floor(Math.random() * operators.length)],
          products.find(p => p.machine === machine)?.name || '',
          failureType,
          machine,
          cause,
          `Duration: ${stopDuration} minutes`
        ]);
      }
    });
  });

  // Generate quality issues data
  const qualityData = [];
  const categories = ['at_station_rework', 'off_station_rework', 'scrap'];
  const qualityCauses = {
    'at_station_rework': ['Minor surface defect', 'Dimensional deviation', 'Color variation'],
    'off_station_rework': ['Assembly error', 'Missing component', 'Wrong label'],
    'scrap': ['Material defect', 'Major deformation', 'Broken parts']
  };

  // Exact header row as specified
  qualityData.push([
    'date',
    'team_member',
    'product',
    'category',
    'machine',
    'quantity',
    'cause',
    'comment'
  ]);

  // Generate random quality issues
  dates.forEach(date => {
    products.forEach(product => {
      const numIssues = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numIssues; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const causes = qualityCauses[category as keyof typeof qualityCauses];
        const cause = causes[Math.floor(Math.random() * causes.length)];
        
        const quantity = 1 + Math.floor(Math.random() * 5);

        qualityData.push([
          date,
          operators[Math.floor(Math.random() * operators.length)],
          product.name,
          category,
          product.machine,
          quantity,
          cause,
          'Detected during regular inspection'
        ]);
      }
    });
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add data sheets with array-of-arrays format to preserve exact header names
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lotsData), 'Lots');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopsData), 'Stops');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(qualityData), 'Quality');

  // Add instructions sheet
  const instructions = [
    ['Sheet', 'Field', 'Required', 'Format/Values', 'Description'],
    ['', '', '', '', ''],
    ['Lots', 'date', 'Yes', 'YYYY-MM-DD', 'Date of production'],
    ['Lots', 'start_time', 'Yes', 'HH:mm', 'Start time (24-hour format)'],
    ['Lots', 'end_time', 'Yes', 'HH:mm', 'End time (24-hour format)'],
    ['Lots', 'team_member', 'Yes', 'email', 'Team member email address'],
    ['Lots', 'product', 'Yes', 'text', 'Product name (must exist in system)'],
    ['Lots', 'machine', 'Yes', 'text', 'Machine name (must exist in system)'],
    ['Lots', 'lot_id', 'No', 'text', 'Optional lot identifier'],
    ['Lots', 'lot_size', 'Yes', 'number > 0', 'Total number of parts in lot'],
    ['Lots', 'ok_parts_produced', 'Yes', 'number >= 0', 'Number of good parts (must not exceed lot_size)'],
    ['', '', '', '', ''],
    ['Stops', 'date', 'Yes', 'YYYY-MM-DD', 'Date of stop event'],
    ['Stops', 'start_time', 'Yes', 'HH:mm', 'Start time (24-hour format)'],
    ['Stops', 'end_time', 'Yes', 'HH:mm', 'End time (24-hour format)'],
    ['Stops', 'team_member', 'Yes', 'email', 'Team member email address'],
    ['Stops', 'product', 'Yes', 'text', 'Product name (must exist in system)'],
    ['Stops', 'failure_type', 'Yes', 'AP|PA|DO|NQ|CS', 'AP: Planned, PA: Breakdown, DO: Malfunction, NQ: Quality, CS: Change'],
    ['Stops', 'machine', 'Yes', 'text', 'Machine name (must exist in system)'],
    ['Stops', 'cause', 'Yes', 'text', 'Cause of the stop'],
    ['Stops', 'comment', 'No', 'text', 'Optional comment'],
    ['', '', '', '', ''],
    ['Quality', 'date', 'Yes', 'YYYY-MM-DD', 'Date of quality issue'],
    ['Quality', 'team_member', 'Yes', 'email', 'Team member email address'],
    ['Quality', 'product', 'Yes', 'text', 'Product name (must exist in system)'],
    ['Quality', 'category', 'Yes', 'text', 'Must be: at_station_rework, off_station_rework, or scrap'],
    ['Quality', 'machine', 'Yes', 'text', 'Machine name (must exist in system)'],
    ['Quality', 'quantity', 'Yes', 'number > 0', 'Number of affected parts'],
    ['Quality', 'cause', 'Yes', 'text', 'Cause of the quality issue'],
    ['Quality', 'comment', 'No', 'text', 'Optional comment']
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

  // Add validation rules sheet
  const validationRules = [
    ['Validation Rules'],
    [''],
    ['1. Date Format'],
    ['- All dates must be in YYYY-MM-DD format'],
    ['- Dates must be valid calendar dates'],
    [''],
    ['2. Time Format'],
    ['- All times must be in HH:mm format (24-hour)'],
    ['- Hours must be between 00-23'],
    ['- Minutes must be between 00-59'],
    [''],
    ['3. Lots Validation'],
    ['- lot_size must be greater than 0'],
    ['- ok_parts_produced must be between 0 and lot_size'],
    ['- end_time must be after start_time'],
    [''],
    ['4. Stops Validation'],
    ['- failure_type must be one of: AP, PA, DO, NQ, CS'],
    ['- end_time must be after start_time'],
    [''],
    ['5. Quality Validation'],
    ['- category must be one of: at_station_rework, off_station_rework, scrap'],
    ['- quantity must be greater than 0'],
    [''],
    ['6. General Rules'],
    ['- team_member must be a valid email address'],
    ['- product must match an existing product name in the system'],
    ['- machine must match an existing machine name in the system'],
    ['- Empty cells are not allowed for required fields'],
    ['- Text fields should not contain only whitespace'],
    [''],
    ['7. Data Consistency'],
    ['- Products must be assigned to their correct machines'],
    ['- Team members must be assigned to their configured machines'],
    ['- Lot sizes should be based on cycle time and shift duration'],
    ['- Stop events should align with production lots'],
    ['- Quality issues should correspond to active production lots']
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(validationRules), 'Validation Rules');

  // Add example data sheet with updated information
  const exampleData = [
    ['Example Data Sets'],
    [''],
    ['Products & Machines:'],
    ['Product', 'Product ID', 'Machine', 'Cycle Time (sec)', 'Description'],
    ['Product A', 'PROD-A', 'Machine 1', '45', 'Standard product A'],
    ['Product B', 'PROD-B', 'Machine 2', '30', 'High-speed product B'],
    ['Product C', 'PROD-C', 'Machine 3', '60', 'Premium product C'],
    [''],
    ['Team Members:'],
    ['Email', 'Machine', 'Team', 'Shift'],
    ['operator1@example.com', 'Machine 1', 'Team A', '06:00-14:00'],
    ['operator2@example.com', 'Machine 2', 'Team B', '14:00-22:00'],
    [''],
    ['Quality Categories:'],
    ['Category', 'Description'],
    ['at_station_rework', 'Quality issues that can be fixed at the workstation'],
    ['off_station_rework', 'Issues requiring repair at a different location'],
    ['scrap', 'Defective parts that cannot be repaired'],
    [''],
    ['Failure Types:'],
    ['Code', 'Description', 'Examples'],
    ['AP', 'Planned downtime', 'Maintenance, Tool change'],
    ['PA', 'Equipment breakdown', 'Motor failure, Sensor error'],
    ['DO', 'Organized malfunction', 'Material shortage, Breaks'],
    ['NQ', 'Non-quality issue', 'Quality checks, Adjustments'],
    ['CS', 'Series change', 'Product changeover, Format change']
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(exampleData), 'Example Data');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
};

// Re-export other template functions
export { 
  generateExcelTemplate,
  generateProductionLinesTemplate,
  generateMachinesTemplate,
  generateProductsTemplate,
  generateTeamTemplate
} from './excelParser';