import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Upload, Check, AlertCircle, Download, Plus, Trash2, Edit2 } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { useProductionLineStore } from '../../store/productionLineStore';
import { usePlantConfigStore } from '../../store/plantConfigStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { parseProductionLinesExcel, generateProductionLinesTemplate } from '../../utils/excelParser';
import ImportPreviewDialog from '../../components/ImportPreviewDialog';
import type { ProductionLine } from '../../types';

interface ProductionLineFormData {
  name: string;
  description: string;
  opening_time_minutes: number;
}

interface ImportPreview {
  duplicates: Array<{
    name: string;
    existing: ProductionLine;
    new: Partial<ProductionLine>;
  }>;
  created: ProductionLine[];
}

const ProductionLinesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { lines, loading: storeLoading, error, fetchLines, createLine, updateLine, deleteLine, bulkCreateLines, bulkUpdateLines } = useProductionLineStore();
  const { plantConfig, fetchPlantConfig } = usePlantConfigStore();
  const { updateStepStatus } = useOnboardingStore();
  const [isExcelMode, setIsExcelMode] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<ProductionLineFormData>();

  useEffect(() => {
    if (projectId) {
      fetchLines(projectId);
      fetchPlantConfig(projectId);
    }
  }, [projectId, fetchLines, fetchPlantConfig]);

  useEffect(() => {
    if (editingLine) {
      setValue('name', editingLine.name);
      setValue('description', editingLine.description || '');
      setValue('opening_time_minutes', editingLine.opening_time_minutes);
      setShowFormDialog(true);
    } else {
      reset({
        name: '',
        description: '',
        opening_time_minutes: plantConfig?.opening_time_minutes || 480
      });
    }
  }, [editingLine, setValue, reset, plantConfig]);

const onSubmit = async (data: ProductionLineFormData) => {
  if (!projectId || !plantConfig) return;

  console.log("🚀 onSubmit function called");

  try {
    setLoading(true);
    if (editingLine) {
      console.log("🛠 Updating existing production line:", editingLine.id);
      await updateLine(editingLine.id, data);
      setEditingLine(null);
      console.log("✅ Production line updated!");
      setSuccessMessage('Production line has been successfully updated.');
    } else {
      console.log("➕ Creating new production line...");
      await createLine(projectId, plantConfig.id, {
        ...data,
        status: lines.length === 0 ? 'completed' : 'in_progress'
      });
      console.log("✅ Production line created!");
      setSuccessMessage('Production line has been successfully created.');
    }

    setShowFormDialog(false);
    reset();
    await fetchLines(projectId);

    console.log("🟢 Success message set:", successMessage);

    // ✅ Masquer le message après 5 secondes
    setTimeout(() => {
      console.log("🔴 Clearing success message");
      setSuccessMessage(null);
    }, 5000);
  } catch (err) {
    console.error('❌ Error saving production line:', err);
  } finally {
    setLoading(false);
  }
};


  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError(null);
    
    if (file && projectId && plantConfig) {
      try {
        setLoading(true);
        const lines = await parseProductionLinesExcel(file);
        
        const result = await bulkCreateLines(projectId, plantConfig.id, lines);
        
        if (result.duplicates.length > 0 || result.created.length > 0) {
          setImportPreview({
            duplicates: result.duplicates,
            created: result.created
          });
        } else {
          setExcelError('No valid lines found in the Excel file');
        }
      } catch (error) {
        setExcelError((error as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleImportConfirm = async () => {
  if (!importPreview || !projectId || !plantConfig) return;

  try {
    setLoading(true);
    console.log("📥 Importing lines from Excel...");
    
    if (importPreview.created.length > 0) {
      await bulkCreateLines(projectId, plantConfig.id, importPreview.created);
      console.log("✅ Success: Imported lines created!");
    }

    console.log("🔄 Fetching updated lines...");
    await fetchLines(projectId);

    console.log("🟢 Setting success message...");
    setSuccessMessage("Production lines have been successfully imported!");

    // ✅ Fermer le popup après import
    setImportPreview(null);

    // Masquer le message après 5 secondes
    setTimeout(() => setSuccessMessage(null), 5000);
  } catch (error) {
    console.error("❌ Error importing production lines:", error);
  } finally {
    setLoading(false);
  }
};

  const handleImportUpdateAll = async () => {
  if (!importPreview || !projectId) return;

  try {
    setLoading(true);
    
    // Mise à jour des lignes existantes
    const updates = importPreview.duplicates.map(duplicate => ({
      id: duplicate.existing.id,
      ...duplicate.new
    }));

    await bulkUpdateLines(updates);

    // Création des nouvelles lignes si elles existent
    if (importPreview.created.length > 0 && plantConfig) {
      await bulkCreateLines(projectId, plantConfig.id, importPreview.created);
    }

    console.log("🔄 Fetching updated lines...");
    await fetchLines(projectId);

    console.log("🟢 Setting success message...");
    setSuccessMessage("Production lines have been successfully updated!");

    // ✅ Fermer le popup après la mise à jour
    setImportPreview(null);

    // Masquer le message après 5 secondes
    setTimeout(() => setSuccessMessage(null), 5000);
    
  } catch (error) {
    console.error("❌ Error updating production lines:", error);
  } finally {
    setLoading(false);
  }
};


  const handleTemplateDownload = () => {
    try {
      const buffer = generateProductionLinesTemplate();
      
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'production_lines_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating template:', error);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    setLoading(true);
    await deleteLine(id);
    setShowDeleteConfirm(null);
    await fetchLines(projectId);
    setLoading(false);
  };

  const handleEdit = (line: ProductionLine) => {
    setEditingLine(line);
  };

  const handleAddNew = () => {
    setEditingLine(null);
    reset({
      name: '',
      description: '',
      opening_time_minutes: plantConfig?.opening_time_minutes || 480
    });
    setShowFormDialog(true);
  };

  const handleCloseDialog = () => {
    setShowFormDialog(false);
    setEditingLine(null);
    reset();
  };

  const handleContinueToMachines = () => {
    if (projectId) {
      updateStepStatus('lines', 'completed');
      navigate(`/projects/${projectId}/onboarding/machines`);
    }
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Production Lines</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure your production lines and their operating times.
          </p>
        </div>

          {/* ✅ Message de succès juste sous le titre */}
  {successMessage && (
    <div className="bg-green-50 p-4 rounded-md flex items-start mb-4">
      <Check className="h-5 w-5 text-green-400 mt-0.5 mr-2" />
      <div>
        <h3 className="text-sm font-medium text-green-800">Success</h3>
        <p className="mt-1 text-sm text-green-700">{successMessage}</p>
      </div>
    </div>
  )}

        {(loading || storeLoading) ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading production lines</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsExcelMode(false)}
                    className={`flex-1 py-3 px-4 rounded-lg text-center ${
                      !isExcelMode
                        ? 'bg-white shadow-sm border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Manual Configuration
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExcelMode(true)}
                    className={`flex-1 py-3 px-4 rounded-lg text-center ${
                      isExcelMode
                        ? 'bg-white shadow-sm border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Excel Import
                  </button>
                </div>
              </div>

              {isExcelMode ? (
                <div className="mt-6 space-y-6">
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
                        Upload Excel Template
                      </span>
                      <span className="mt-1 text-sm text-gray-500">
                        Download our template and fill it with your production lines data
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
              ) : null}
            </div>

            <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Configured Production Lines</h3>
                  {!isExcelMode && (
                    <button
                      onClick={handleAddNew}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Production Line
                    </button>
                  )}
                </div>
                <div className="mt-4 space-y-4">
                  {lines.map((line) => (
                    <div
                      key={line.id}
                      className="bg-gray-50 p-4 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{line.name}</h4>
                        {line.description && (
                          <p className="mt-1 text-sm text-gray-500">{line.description}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Operating time: {line.opening_time_minutes} minutes
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(line)}
                          className="p-2 text-gray-400 hover:text-blue-500"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(line.id)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {lines.length > 0 && (
                <div className="p-6 bg-gray-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToMachines}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Continue to Machines
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showFormDialog && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {editingLine ? 'Edit Production Line' : 'Add Production Line'}
                        </h3>
                        <div className="mt-4">
                          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Line Name
                              </label>
                              <input
                                type="text"
                                id="name"
                                {...register('name', { required: 'Line name is required' })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="Production Line 1"
                              />
                              {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description
                              </label>
                              <textarea
                                id="description"
                                rows={3}
                                {...register('description')}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="Optional description of the production line"
                              />
                            </div>

                            <div>
                              <label htmlFor="opening_time_minutes" className="block text-sm font-medium text-gray-700">
                                Daily Opening Time (minutes)
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <input
                                  type="number"
                                  id="opening_time_minutes"
                                  {...register('opening_time_minutes', {
                                    required: 'Opening time is required',
                                    min: { value: 1, message: 'Opening time must be at least 1 minute' },
                                    max: { value: 1440, message: 'Opening time cannot exceed 24 hours' }
                                  })}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">min</span>
                                </div>
                              </div>
                              {errors.opening_time_minutes && (
                                <p className="mt-1 text-sm text-red-600">{errors.opening_time_minutes.message}</p>
                              )}
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {editingLine ? 'Update' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseDialog}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div>
                      <div className="mt-3 text-center sm:mt-5">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Delete Production Line
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this production line? This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                      <button
                        type="button"
                        onClick={() => confirmDelete(showDeleteConfirm)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(null)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {importPreview && (
              <ImportPreviewDialog
                duplicates={importPreview.duplicates}
                created={importPreview.created}
                onConfirm={handleImportConfirm}
                onCancel={() => setImportPreview(null)}
                onUpdateAll={handleImportUpdateAll}
              />
            )}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default ProductionLinesPage;