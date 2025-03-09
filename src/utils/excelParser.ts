import * as XLSX from 'xlsx';
import type { PlantExcelData, ProductionLineExcelData, MachineExcelData, ProductExcelData, TeamExcelData, ExcelImportResult, LotData } from '../types';

export const parseExcelFile = async (file: File): Promise<PlantExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error('Excel file is empty');
        }

        const firstRow = jsonData[0] as any;

        // Validate required fields
        const requiredFields = ['name', 'opening_time_minutes', 'address'];
        const missingFields = requiredFields.filter(field => !firstRow[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Required fields are missing: ${missingFields.join(', ')}`);
        }

        // Convert opening time to number and validate
        const openingTime = Number(firstRow.opening_time_minutes);
        if (isNaN(openingTime) || openingTime <= 0 || openingTime > 1440) {
          throw new Error('Invalid opening time value');
        }

        const plantData: PlantExcelData = {
          name: String(firstRow.name),
          opening_time_minutes: openingTime,
          description: firstRow.description ? String(firstRow.description) : undefined,
          address: String(firstRow.address)
        };

        resolve(plantData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const parseProductionLinesExcel = async (file: File): Promise<ProductionLineExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error('Excel file is empty');
        }

        const lines: ProductionLineExcelData[] = [];
        const lineNames = new Set<string>();

        for (const row of jsonData) {
          const rowData = row as any;
          
          // Validate required fields
          const requiredFields = ['name', 'opening_time_minutes'];
          const missingFields = requiredFields.filter(field => !rowData[field]);
          
          if (missingFields.length > 0) {
            throw new Error(`Row is missing required fields: ${missingFields.join(', ')}`);
          }

          // Check for duplicate names in the Excel file
          const name = String(rowData.name).trim();
          if (lineNames.has(name.toLowerCase())) {
            throw new Error(`Duplicate line name found in Excel: ${name}`);
          }
          lineNames.add(name.toLowerCase());

          // Convert opening time to number and validate
          const openingTime = Number(rowData.opening_time_minutes);
          if (isNaN(openingTime) || openingTime <= 0 || openingTime > 1440) {
            throw new Error(`Invalid opening time value in row for line ${name}`);
          }

          lines.push({
            name,
            line_id: rowData.line_id ? String(rowData.line_id) : undefined,
            description: rowData.description ? String(rowData.description) : undefined,
            opening_time_minutes: openingTime
          });
        }

        resolve(lines);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const parseMachinesExcel = async (file: File): Promise<MachineExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames.length) {
          throw new Error('Excel file is empty');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log("📊 Raw Excel data:", jsonData);

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('No data found in Excel file');
        }

        const machines: MachineExcelData[] = jsonData.map((row: any, index) => {
          if (!row.name || !row.line_name) {
            throw new Error(`Row ${index + 2}: Name and line_name are required`);
          }

          let openingTime: number | undefined;
          if (row.opening_time_minutes !== undefined) {
            openingTime = Number(row.opening_time_minutes);
            if (isNaN(openingTime) || openingTime <= 0 || openingTime > 1440) {
              throw new Error(
                `Row ${index + 2}: Invalid opening time value (must be between 1 and 1440)`
              );
            }
          }

          return {
            name: String(row.name).trim(),
            line_name: String(row.line_name).trim(),
            description: row.description ? String(row.description).trim() : undefined,
            opening_time_minutes: openingTime
          };
        });

        console.log("✅ Parsed machines:", machines);
        resolve(machines);

      } catch (error) {
        console.error("❌ Error parsing Excel:", error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const generateExcelTemplate = () => {
  const template = [
    {
      name: 'Example Plant Name',
      opening_time_minutes: 480,
      description: 'Optional plant description',
      address: '123 Main Street, Example City, Example Country'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plant Configuration');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer;
};

export const generateProductionLinesTemplate = () => {
  const template = [
    {
      name: 'Production Line 1',
      description: 'Optional line description',
      opening_time_minutes: 480
    },
    {
      name: 'Production Line 2',
      description: 'Another production line',
      opening_time_minutes: 480
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Production Lines');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer;
};

export const generateMachinesTemplate = () => {
  const template = [
    {
      name: 'Machine 1',
      line_name: 'Production Line 1',
      opening_time_minutes: 480,
      description: 'Optional machine description'
    },
    {
      name: 'Machine 2',
      line_name: 'Production Line 1',
      opening_time_minutes: 480,
      description: 'Another machine'
    },
    {
      name: 'Machine 3',
      line_name: 'Production Line 2',
      opening_time_minutes: 360,
      description: 'Machine in another line'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);

  const headerInfo = [
    ['Column', 'Required', 'Description'],
    ['name', 'Yes', 'Name of the machine'],
    ['line_name', 'Yes', 'Name of the production line (must match exactly)'],
    ['opening_time_minutes', 'No', 'Daily opening time in minutes (1-1440)'],
    ['description', 'No', 'Optional description']
  ];

  const infoWs = XLSX.utils.aoa_to_sheet(headerInfo);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Machines');
  XLSX.utils.book_append_sheet(wb, infoWs, 'Instructions');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer;
};

export const parseProductsExcel = async (file: File): Promise<ProductExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          throw new Error('Excel file is empty');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: ['name', 'product_id', 'machine_name', 'cycle_time', 'description'],
          range: 1
        });

        console.log("📊 Excel data:", jsonData);

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('No data found in Excel file');
        }

        const products: ProductExcelData[] = jsonData.map((row: any, index) => {
          if (!row.name || !row.machine_name || !row.cycle_time) {
            throw new Error(`Row ${index + 2}: Name, machine_name, and cycle_time are required`);
          }

          const cycleTime = Number(row.cycle_time);
          if (isNaN(cycleTime) || cycleTime <= 0) {
            throw new Error(`Row ${index + 2}: Invalid cycle time value (must be greater than 0)`);
          }

          return {
            name: String(row.name).trim(),
            product_id: row.product_id ? String(row.product_id).trim() : undefined,
            machine_name: String(row.machine_name).trim(),
            cycle_time: cycleTime,
            description: row.description ? String(row.description).trim() : undefined
          };
        });

        console.log("✅ Parsed products:", products);
        resolve(products);

      } catch (error) {
        console.error("❌ Error parsing Excel:", error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const generateProductsTemplate = () => {
  // Updated template to match the provided data structure
  const template = [
    {
      name: 'Product A',
      product_id: 'PROD-A',
      machine_name: 'Machine 1',
      cycle_time: 45,
      description: 'Product A for Machine 1'
    },
    {
      name: 'Product B',
      product_id: 'PROD-B',
      machine_name: 'Machine 2',
      cycle_time: 30,
      description: 'Product B for Machine 2'
    },
    {
      name: 'Product C',
      product_id: 'PROD-C',
      machine_name: 'Machine 3',
      cycle_time: 60,
      description: 'Product C for Machine 3'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer;
};

export const parseTeamExcel = async (file: File): Promise<TeamExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          throw new Error('Excel file is empty');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: ['email', 'role', 'team_name', 'machine_name', 'working_time_minutes'],
          range: 1
        });

        console.log("📊 Excel data:", jsonData);

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('No data found in Excel file');
        }

        const members: TeamExcelData[] = jsonData.map((row: any, index) => {
          if (!row.email || !row.role || !row.team_name || !row.machine_name || !row.working_time_minutes) {
            throw new Error(`Row ${index + 2}: All fields are required`);
          }

          const workingTime = Number(row.working_time_minutes);
          if (isNaN(workingTime) || workingTime <= 0 || workingTime > 1440) {
            throw new Error(`Row ${index + 2}: Invalid working time value (must be between 1 and 1440)`);
          }

          const email = String(row.email).trim().toLowerCase();
          if (!email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
            throw new Error(`Row ${index + 2}: Invalid email address format`);
          }

          const role = String(row.role).trim().toLowerCase();
          if (!['operator', 'line_manager', 'it_admin', 'super_admin'].includes(role)) {
            throw new Error(`Row ${index + 2}: Invalid role (must be one of: operator, line_manager, it_admin, super_admin)`);
          }

          return {
            email,
            role,
            team_name: String(row.team_name).trim(),
            machine_name: String(row.machine_name).trim(),
            working_time_minutes: workingTime
          };
        });

        console.log("✅ Parsed team members:", members);
        resolve(members);

      } catch (error) {
        console.error("❌ Error parsing Excel:", error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const generateTeamTemplate = () => {
  // Updated template to match the provided data structure
  const template = [
    {
      email: 'operator1@example.com',
      role: 'operator',
      team_name: 'Team A',
      machine_name: 'Machine 1',
      working_time_minutes: 480
    },
    {
      email: 'operator2@example.com',
      role: 'operator', 
      team_name: 'Team B',
      machine_name: 'Machine 2',
      working_time_minutes: 480
    },
    {
      email: 'operator1@example.com',
      role: 'operator',
      team_name: 'Team A',
      machine_name: 'Machine 3',
      working_time_minutes: 480
    },
    {
      email: 'operator2@example.com',
      role: 'operator',
      team_name: 'Team B',
      machine_name: 'Machine 1',
      working_time_minutes: 480
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Team Members');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer;
};

export const parseDataExcel = async (file: File): Promise<ExcelImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const errors: ExcelImportResult['errors'] = [];
        const result: ExcelImportResult = { errors };

        // Parse Lots sheet
        if (workbook.SheetNames.includes('Lots')) {
          try {
            const lotsSheet = workbook.Sheets['Lots'];
            const lotsData = XLSX.utils.sheet_to_json(lotsSheet, { 
              header: ['date', 'start_time', 'end_time', 'team_member', 'product', 'machine', 'lot_id', 'lot_size', 'ok_parts_produced'],
              range: 1 // Skip header row
            });

            console.log("📊 Raw lots data:", lotsData);
            
            result.lots = lotsData.map((row: any, index) => {
              // Validate required fields
              const requiredFields = ['date', 'team_member', 'product', 'machine', 'lot_size', 'ok_parts_produced'];
              const missingFields = requiredFields.filter(field => !row[field]);
              
              if (missingFields.length > 0) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2, // Add 2 to account for header row and 0-based index
                  message: `Missing required fields: ${missingFields.join(', ')}`
                });
                return null;
              }

              // Validate lot size
              const lotSize = Number(row.lot_size);
              if (isNaN(lotSize) || lotSize <= 0) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2,
                  message: 'Lot size must be greater than 0'
                });
                return null;
              }

              // Validate OK parts
              const okParts = Number(row.ok_parts_produced);
              if (isNaN(okParts) || okParts < 0) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2,
                  message: 'OK parts produced must be 0 or greater'
                });
                return null;
              }

              if (okParts > lotSize) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2,
                  message: 'OK parts produced cannot exceed lot size'
                });
                return null;
              }

              // Validate date format
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!dateRegex.test(String(row.date))) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2,
                  message: 'Invalid date format (use YYYY-MM-DD)'
                });
                return null;
              }

              // Validate time format
              const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!timeRegex.test(String(row.start_time)) || !timeRegex.test(String(row.end_time))) {
                errors.push({
                  sheet: 'Lots',
                  row: index + 2,
                  message: 'Invalid time format (use HH:mm)'
                });
                return null;
              }

              return {
                date: String(row.date),
                start_time: String(row.start_time),
                end_time: String(row.end_time),
                team_member: String(row.team_member),
                product: String(row.product),
                machine: String(row.machine),
                lot_id: row.lot_id ? String(row.lot_id) : undefined,
                lot_size: lotSize,
                ok_parts_produced: okParts
              } as LotData;
            }).filter((lot): lot is LotData => lot !== null);

            console.log("✅ Successfully parsed lots:", result.lots);
          } catch (error) {
            console.error('Error parsing Lots sheet:', error);
            errors.push({
              sheet: 'Lots',
              row: 0,
              message: 'Failed to parse Lots sheet'
            });
          }
        }

        try {
          const stopsSheet = workbook.Sheets['Stops'];
          const stopsData = XLSX.utils.sheet_to_json(stopsSheet);
          
          result.stops = stopsData.map((row: any, index) => {
            const requiredFields = ['date', 'start_time', 'end_time', 'team_member', 'product', 'failure_type', 'machine', 'cause'];
            const missingFields = requiredFields.filter(field => !row[field]);
            
            if (missingFields.length > 0) {
              errors.push({
                sheet: 'Stops',
                row: index + 2,
                message: `Missing required fields: ${missingFields.join(', ')}`
              });
              return null;
            }

            // Validate failure type
            const failureType = String(row.failure_type).toUpperCase();
            if (!['AP', 'PA', 'DO', 'NQ', 'CS'].includes(failureType)) {
              errors.push({
                sheet: 'Stops',
                row: index + 2,
                message: 'Invalid failure type (must be AP, PA, DO, NQ, or CS)'
              });
              return null;
            }

            return {
              date: String(row.date),
              start_time: String(row.start_time),
              end_time: String(row.end_time),
              team_member: String(row.team_member),
              product: String(row.product),
              failure_type: failureType,
              machine: String(row.machine),
              cause: String(row.cause),
              comment: row.comment ? String(row.comment) : undefined
            };
          }).filter((stop): stop is NonNullable<typeof stop> => stop !== null);
        } catch (error) {
          console.error('Error parsing Stops sheet:', error);
          errors.push({
            sheet: 'Stops',
            row: 0,
            message: 'Failed to parse Stops sheet'
          });
        }

        try {
          const qualitySheet = workbook.Sheets['Quality'];
          const qualityData = XLSX.utils.sheet_to_json(qualitySheet);
          
          result.quality = qualityData.map((row: any, index) => {
            const requiredFields = ['date', 'team_member', 'product', 'category', 'machine', 'quantity', 'cause'];
            const missingFields = requiredFields.filter(field => !row[field]);
            
            if (missingFields.length > 0) {
              errors.push({
                sheet: 'Quality',
                row: index + 2,
                message: `Missing required fields: ${missingFields.join(', ')}`
              });
              return null;
            }

            const quantity = Number(row.quantity);
            if (isNaN(quantity) || quantity <= 0) {
              errors.push({
                sheet: 'Quality',
                row: index + 2,
                message: 'Invalid quantity'
              });
              return null;
            }

            const category = String(row.category).toLowerCase();
            if (!['at_station_rework', 'off_station_rework', 'scrap'].includes(category)) {
              errors.push({
                sheet: 'Quality',
                row: index + 2,
                message: 'Invalid category (must be at_station_rework, off_station_rework, or scrap)'
              });
              return null;
            }

            return {
              date: String(row.date),
              team_member: String(row.team_member),
              product: String(row.product),
              category: category as 'at_station_rework' | 'off_station_rework' | 'scrap',
              machine: String(row.machine),
              quantity: quantity,
              cause: String(row.cause),
              comment: row.comment ? String(row.comment) : undefined
            };
          }).filter((issue): issue is NonNullable<typeof issue> => issue !== null);
        } catch (error) {
          console.error('Error parsing Quality sheet:', error);
          errors.push({
            sheet: 'Quality',
            row: 0,
            message: 'Failed to parse Quality sheet'
          });
        }

        resolve(result);

      } catch (error) {
        console.error('Error parsing Excel:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

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
          ` ```
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