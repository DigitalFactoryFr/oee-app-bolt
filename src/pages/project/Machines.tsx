import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Upload, Check, AlertCircle, Download, Plus, Trash2, Edit2 } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { useMachineStore } from '../../store/machineStore';
import { useProductionLineStore } from '../../store/productionLineStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { parseMachinesExcel, generateMachinesTemplate } from '../../utils/excelParser';
import MachineFormDialog from '../../components/machines/MachineFormDialog';
import MachineImportPreview from '../../components/machines/MachineImportPreview';
import SubscriptionBanner from '../../components/SubscriptionBanner';
import UpgradePrompt from '../../components/UpgradePrompt';
import type { Machine } from '../../types';

interface MachineFormData {
  name: string;
  line_id: string;
  description: string;
  opening_time_minutes: number | null;
}

const MachinesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { machines, loading: machinesLoading, error: machinesError, fetchMachines, createMachine, updateMachine, deleteMachine, bulkCreateMachines, bulkUpdateMachines } = useMachineStore();
  const { lines, loading: linesLoading, fetchLines } = useProductionLineStore();
  const { updateStepStatus } = useOnboardingStore();
  const { subscription, fetchSubscription } = useSubscriptionStore();
  
  const [isExcelMode, setIsExcelMode] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    duplicates: Array<{
      name: string;
      existing: Machine;
      new: Partial<Machine>;
    }>;
    created: Machine[];
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<MachineFormData>();

  const selectedLineId = watch('line_id');

  useEffect(() => {
    if (projectId) {
      fetchMachines(projectId);
      fetchLines(projectId);
      fetchSubscription(projectId);
    }
  }, [projectId, fetchMachines, fetchLines, fetchSubscription]);

  useEffect(() => {
    if (editingMachine) {
      setValue('name', editingMachine.name);
      setValue('line_id', editingMachine.line_id);
      setValue('description', editingMachine.description || '');
      setValue('opening_time_minutes', editingMachine.opening_time_minutes || null);
      setShowFormDialog(true);
    } else {
      reset({
        name: '',
        line_id: '',
        description: '',
        opening_time_minutes: null
      });
    }
  }, [editingMachine, setValue, reset]);

  const onSubmit = async (data: MachineFormData) => {
    if (!projectId || !subscription) return;

    try {
      // Check machine limit for free tier
      if (subscription.status === 'free' && machines.length >= subscription.machine_limit && !editingMachine) {
        throw new Error(`Free tier is limited to ${subscription.machine_limit} machines. Please upgrade to add more machines.`);
      }

      if (editingMachine) {
        await updateMachine(editingMachine.id, data);
        setEditingMachine(null);
        setSuccessMessage('Machine has been successfully updated!');
      } else {
        await createMachine(projectId, data.line_id, data);
        setSuccessMessage('Machine has been successfully created!');
      }

      setShowFormDialog(false);
      reset();
      await fetchMachines(projectId);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error saving machine:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save machine');
    }
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError(null);
    
    if (file && projectId) {
      try {
        const machines = await parseMachinesExcel(file);
        const result = await bulkCreateMachines(projectId, machines);
        setImportPreview(result);
      } catch (error) {
        setExcelError((error as Error).message);
      }
    }
  };

  const handleTemplateDownload = () => {
    try {
      const buffer = generateMachinesTemplate();
      
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'machines_template.xlsx';
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
      // Create new machines only
      if (importPreview.created.length > 0) {
        await bulkCreateMachines(projectId, importPreview.created);
      }
      
      await fetchMachines(projectId);
      setImportPreview(null);
      setSuccessMessage('Machines have been successfully imported!');
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
    } catch (error) {
      setExcelError((error as Error).message);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    await deleteMachine(id);
    setShowDeleteConfirm(null);
    await fetchMachines(projectId);
  };

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
  };

  const handleAddNew = () => {
    setEditingMachine(null);
    setShowFormDialog(true);
  };

  const handleCloseDialog = () => {
    setShowFormDialog(false);
    setEditingMachine(null);
    reset();
  };

  const handleContinueToProducts = () => {
    if (projectId) {
      updateStepStatus('machines', 'completed');
      navigate(`/projects/${projectId}/onboarding/products`);
    }
  };

  const getMachineById = (machineId: string) => {
    return machines.find(machine => machine.id === machineId);
  };

  const getMachinesForLine = (lineId: string): Machine[] => {
    return machines.filter(machine => machine.line_id === lineId);
  };

  const loading = machinesLoading || linesLoading;

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Machines</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure your machines and assign them to production lines.
            </p>
          </div>
          {subscription?.status === 'free' && machines.length >= subscription.machine_limit && (
            <button
              onClick={() => startCheckout(machines.length + 1)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Upgrade to Add More Machines
            </button>
          )}
        </div>

        {subscription?.status === 'free' && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <SubscriptionBanner machineCount={machines.length} />
            </div>
            <div className="lg:col-span-1">
              <UpgradePrompt machineCount={machines.length + 1} />
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

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : machinesError ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading machines</h3>
            <div className="mt-2 text-sm text-red-700">{machinesError}</div>
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
                        Download our template and fill it with your machines data
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
                  <h3 className="text-lg font-medium text-gray-900">Configured Machines</h3>
                  {!isExcelMode && (
                    <button
                      onClick={handleAddNew}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Machine
                    </button>
                  )}
                </div>

                {lines.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium text-gray-900">No Production Lines</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      You need to configure production lines before adding machines.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate(`/projects/${projectId}/onboarding/lines`)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Configure Production Lines
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {lines.map((line) => (
                      <div key={line.id} className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">{line.name}</h4>
                        <div className="space-y-4">
                          {getMachinesForLine(line.id).map((machine) => (
                            <div
                              key={machine.id}
                              className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between"
                            >
                              <div>
                                <h5 className="text-sm font-medium text-gray-900">{machine.name}</h5>
                                {machine.description && (
                                  <p className="mt-1 text-sm text-gray-500">{machine.description}</p>
                                )}
                                <p className="mt-1 text-sm text-gray-500">
                                  Operating time: {machine.opening_time_minutes || line.opening_time_minutes} minutes
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEdit(machine)}
                                  className="p-2 text-gray-400 hover:text-blue-500"
                                >
                                  <Edit2 className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(machine.id)}
                                  className="p-2 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {machines.length > 0 && (
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
                      onClick={handleContinueToProducts}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Continue to Products
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showFormDialog && (
              <MachineFormDialog
                machine={editingMachine}
                lines={lines}
                onSubmit={handleSubmit(onSubmit)}
                onClose={handleCloseDialog}
                register={register}
                errors={errors}
                selectedLineId={selectedLineId}
              />
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
                          Delete Machine
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this machine? This action cannot be undone.
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
              <MachineImportPreview
                duplicates={importPreview.duplicates}
                created={importPreview.created}
                onClose={() => setImportPreview(null)}
                onConfirm={handleImportConfirm}
                onUpdateAll={handleImportUpdateAll}
                getLineName={(lineId) => getLineById(lineId)?.name || 'Unknown Line'}
              />
            )}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default MachinesPage;