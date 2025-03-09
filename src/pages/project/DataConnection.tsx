import React, { useState } from 'react';
import { Upload, Download, Check, AlertCircle } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { parseDataExcel } from '../../utils/excelParser';
import { generateSampleDataTemplates } from '../../utils/excelTemplates';
import { useDataStore } from '../../store/dataStore';
import { useParams } from 'react-router-dom';
import type { ExcelImportResult } from '../../types';
import DataImportPreview from '../../components/data/DataImportPreview';
import DataConnectorsList from '../../components/data/DataConnectorsList';

const DataConnection: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { importLots, importStops, importQuality, loading } = useDataStore();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ExcelImportResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleConnectorSelect = (connectorId: string) => {
    setSelectedConnector(connectorId);
    setExcelError(null);
    setImportPreview(null);
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError(null);
    
    if (file) {
      try {
        const result = await parseDataExcel(file);
        console.log("📊 Parsed Excel data:", result);
        setImportPreview(result);
      } catch (error) {
        console.error("❌ Error parsing Excel:", error);
        setExcelError((error as Error).message);
      }
    }
  };

  const handleTemplateDownload = () => {
    try {
      const buffer = generateSampleDataTemplates();
      
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating template:', error);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview || !projectId) return;

    try {
      console.log("🚀 Starting data import...");

      // Import lots if present
      if (importPreview.lots && importPreview.lots.length > 0) {
        console.log("📦 Importing lots...");
        await importLots(projectId, importPreview.lots);
      }

      // Import stops if present
      if (importPreview.stops && importPreview.stops.length > 0) {
        console.log("🛑 Importing stop events...");
        await importStops(projectId, importPreview.stops);
      }

      // Import quality issues if present
      if (importPreview.quality && importPreview.quality.length > 0) {
        console.log("⚠️ Importing quality issues...");
        await importQuality(projectId, importPreview.quality);
      }

      console.log("✅ Import completed successfully!");
      setSuccessMessage('Data has been successfully imported!');
      setImportPreview(null);
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (error) {
      console.error("❌ Error during import:", error);
      setExcelError((error as Error).message);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Data Connection</h2>
          <p className="mt-1 text-sm text-gray-500">
            Import your production data from various sources.
          </p>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
              <p className="mt-4 text-gray-700">Importing data...</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 bg-green-50 p-4 rounded-md flex items-start">
            <Check className="h-5 w-5 text-green-400 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="mt-1 text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {!selectedConnector ? (
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Available Connectors</h3>
              <DataConnectorsList onSelect={handleConnectorSelect} />
            </div>
          ) : selectedConnector === 'excel' && (
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Excel Import</h3>
                <button
                  onClick={() => setSelectedConnector(null)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  ← Back to connectors
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Required Excel Structure</h4>
                  <p className="text-sm text-blue-700">
                    Your Excel file should contain three sheets:
                  </p>
                  <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>Lots: Production data with OK parts count</li>
                    <li>Stops: Machine stop events and durations</li>
                    <li>Quality: Quality issues and defects</li>
                  </ul>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="cursor-pointer inline-flex flex-col items-center"
                  >
                    <Upload className="h-12 w-12 text-gray-400" />
                    <span className="mt-2 text-sm font-medium text-gray-900">
                      Upload Excel File
                    </span>
                    <span className="mt-1 text-sm text-gray-500">
                      Download our template below for the correct format
                    </span>
                  </label>
                </div>

                {excelError && (
                  <div className="bg-red-50 p-4 rounded-md flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Error processing Excel file</h3>
                      <p className="mt-1 text-sm text-red-700">{excelError}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {importPreview && (
          <DataImportPreview
            data={importPreview}
            onClose={() => setImportPreview(null)}
            onConfirm={handleImportConfirm}
          />
        )}
      </div>
    </ProjectLayout>
  );
};

export default DataConnection;