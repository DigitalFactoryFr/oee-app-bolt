// src/pages/TeamsPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Upload,
  Check,
  AlertCircle,
  Download,
  Plus,
  Trash2,
  Edit2,
  Mail
} from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { useTeamStore } from '../../store/teamStore';
import { useMachineStore } from '../../store/machineStore';
import { useProductionLineStore } from '../../store/productionLineStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { parseTeamExcel, generateTeamTemplate } from '../../utils/excelParser';
import TeamFormDialog from '../../components/teams/TeamFormDialog';
import TeamImportPreview from '../../components/teams/TeamImportPreview';
import type { TeamMember } from '../../types';

/** Résultat de bulkCheckMembers */
interface CheckResult {
  newInserts: TeamMember[];
  duplicates: Array<{
    email: string;
    existing: TeamMember;
    new: Partial<TeamMember>;
  }>;
  errors: Array<{ row: number; message: string }>;
}

interface TeamFormData {
  email: string;
  role: string;
  team_name: string;
  machine_id?: string;
  line_id?: string;
  working_time_minutes: number;
}

const TeamsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const {
    members,
    roles,
    loading: teamLoading,
    error,
    fetchMembers,
    fetchRoles,
    createMember,
    updateMember,
    deleteMember,
    bulkCheckMembers,
    bulkInviteMembers
  } = useTeamStore();

  const { machines, loading: machinesLoading, fetchMachines } = useMachineStore();
  const { lines, loading: linesLoading, fetchLines } = useProductionLineStore();
  const { updateStepStatus } = useOnboardingStore();

  const [importPreview, setImportPreview] = useState<CheckResult | null>(null);
  const [isExcelMode, setIsExcelMode] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors }
  } = useForm<TeamFormData>();

  const selectedRole = watch('role');

  useEffect(() => {
    if (projectId) {
      fetchMembers(projectId);
      fetchMachines(projectId);
      fetchLines(projectId);
      fetchRoles();
    }
  }, [projectId, fetchMembers, fetchMachines, fetchLines, fetchRoles]);

  useEffect(() => {
    if (editingMember) {
      setValue('email', editingMember.email);
      setValue('role', editingMember.role);
      setValue('team_name', editingMember.team_name);
      setValue('machine_id', editingMember.machine_id || '');
      setValue('line_id', editingMember.line_id || '');
      setValue('working_time_minutes', editingMember.working_time_minutes);
      setShowFormDialog(true);
    } else {
      reset({
        email: '',
        role: '',
        team_name: '',
        machine_id: '',
        line_id: '',
        working_time_minutes: 480
      });
    }
  }, [editingMember, setValue, reset]);

  // Création/Update manuels
  const onSubmit = async (data: TeamFormData) => {
    if (!projectId) return;
    try {
      if (data.role === 'operator' && !data.machine_id) {
        throw new Error('Machine must be assigned for operator role');
      }
      if (data.role === 'team_manager' && !data.line_id) {
        throw new Error('Production line must be assigned for team manager role');
      }
      if (editingMember) {
        await updateMember(editingMember.id, {
          ...data,
          machine_id: data.machine_id || null,
          line_id: data.line_id || null
        });
        setEditingMember(null);
      } else {
        await createMember(projectId, data.machine_id || null, data.line_id || null, data);
      }
      setShowFormDialog(false);
      reset();
      await fetchMembers(projectId);
    } catch (err) {
      console.error('Error saving team member:', err);
    }
  };

  // Upload Excel => bulkCheckMembers (dry run)
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError(null);
    if (file && projectId) {
      try {
        const parsed = await parseTeamExcel(file);
        const checkResult = await bulkCheckMembers(projectId, parsed);
        setImportPreview(checkResult);
      } catch (error) {
        setExcelError((error as Error).message);
      }
    }
  };

  const handleTemplateDownload = () => {
    try {
      const buffer = generateTeamTemplate();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'team_members_template.xlsx';
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
    await deleteMember(id);
    setShowDeleteConfirm(null);
    if (projectId) {
      await fetchMembers(projectId);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
  };

  const handleAddNew = () => {
    setEditingMember(null);
    setShowFormDialog(true);
  };

  const handleCloseDialog = () => {
    setShowFormDialog(false);
    setEditingMember(null);
    reset();
  };

  const handleContinueToData = () => {
    if (projectId) {
      updateStepStatus('teams', 'completed');
      navigate(`/projects/${projectId}/onboarding/data`);
    }
  };

  // Helpers pour l'affichage
  const getRoleById = (roleId: string) => roles.find((r) => r.id === roleId);
  const getMachineById = (machineId?: string) => machines.find((m) => m.id === machineId);
  const getLineById = (lineId?: string) => lines.find((l) => l.id === lineId);

  const isLoading = teamLoading || machinesLoading || linesLoading;

  const getStatusTag = (status: string) => {
    let bgClass = '';
    let textClass = '';

    switch (status) {
      case 'active':
        bgClass = 'bg-green-100';
        textClass = 'text-green-800';
        break;
      case 'invited':
        bgClass = 'bg-blue-100';
        textClass = 'text-blue-800';
        break;
      case 'pending':
        bgClass = 'bg-yellow-100';
        textClass = 'text-yellow-800';
        break;
      case 'inactive':
        bgClass = 'bg-red-100';
        textClass = 'text-red-800';
        break;
      default:
        bgClass = 'bg-gray-100';
        textClass = 'text-gray-800';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgClass} ${textClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Team & Scheduling</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team members and their schedules.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading team members</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        ) : (
          <>
            {/* Mode Manual / Excel */}
            <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
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
              {isExcelMode && (
                <div className="mt-6 space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer inline-flex flex-col items-center">
                      <Upload className="h-12 w-12 text-gray-400" />
                      <span className="mt-2 text-sm font-medium text-gray-900">
                        Upload Excel Template
                      </span>
                      <span className="mt-1 text-sm text-gray-500">
                        Download our template and fill it with your team data
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
              )}
            </div>

            {/* Liste des membres */}
            <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200 mb-6">
              <div className="p-6 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
                {!isExcelMode && (
                  <button
                    onClick={handleAddNew}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </button>
                )}
              </div>
              <div className="space-y-4 p-6">
                {members.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No team members yet</p>
                    <button
                      onClick={handleAddNew}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Member
                    </button>
                  </div>
                ) : (
                  members.map((member) => {
                    const role = getRoleById(member.role);
                    const machine = getMachineById(member.machine_id);
                    const line = getLineById(member.line_id);
                    return (
                      <div key={member.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{member.email}</h4>
                            <p className="mt-1 text-sm text-gray-500">
                              {role?.name} - {member.team_name}
                            </p>
                            {machine && (
                              <p className="mt-1 text-sm text-gray-500">
                                Machine: {machine.name}
                              </p>
                            )}
                            {line && (
                              <p className="mt-1 text-sm text-gray-500">
                                Line: {line.name}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-gray-500">
                              Working time: {member.working_time_minutes} minutes
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              Status: {getStatusTag(member.status)}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            {member.status === 'pending' && (
                              <button
                                onClick={() => bulkInviteMembers([member])}
                                className="p-2 text-gray-400 hover:text-blue-500"
                              >
                                <Mail className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(member)}
                              className="p-2 text-gray-400 hover:text-blue-500"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="p-2 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {members.length > 0 && (
                <div className="p-6 bg-gray-50 flex justify-end">
                  <button
                    type="button"
                    onClick={handleContinueToData}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Continue to Data Connection
                  </button>
                </div>
              )}
            </div>

            {/* Formulaire (création/édition) */}
            {showFormDialog && (
              <TeamFormDialog
                member={editingMember}
                machines={machines}
                lines={lines}
                roles={roles}
                onSubmit={handleSubmit(onSubmit)}
                onClose={handleCloseDialog}
                register={register}
                errors={formErrors}
                selectedRole={selectedRole}
              />
            )}

            {/* Confirmation de suppression */}
            {showDeleteConfirm && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                    &#8203;
                  </span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left
                                  overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle
                                  sm:max-w-lg sm:w-full sm:p-6">
                    <div>
                      <div className="mt-3 text-center sm:mt-5">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Team Member</h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this team member? This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                      <button
                        type="button"
                        onClick={() => confirmDelete(showDeleteConfirm!)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent
                                   shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700
                                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500
                                   sm:col-start-2 sm:text-sm"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(null)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300
                                   shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50
                                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                   sm:mt-0 sm:col-start-1 sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de prévisualisation (dry run) */}
            {importPreview && (
              <TeamImportPreview
                projectId={projectId!}
                checkResult={importPreview}
                onClose={() => setImportPreview(null)}
                getMachineName={(machineId) => {
                  const found = machines.find((m) => m.id === machineId);
                  return found ? found.name : 'Unknown Machine';
                }}
                getLineName={(lineId) => {
                  const found = lines.find((l) => l.id === lineId);
                  return found ? found.name : 'Unknown Line';
                }}
                getRoleName={(roleId) => {
                  const found = roles.find((r) => r.id === roleId);
                  return found ? found.name : roleId;
                }}
              />
            )}
          </>
        )}
      </div>
    </ProjectLayout>
  );
};

export default TeamsPage;
