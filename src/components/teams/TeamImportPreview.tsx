// src/components/teams/TeamImportPreview.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTeamStore } from '../../store/teamStore';
import type { TeamMember } from '../../types';

interface DuplicatesResult {
  email: string;
  existing: TeamMember;
  new: Partial<TeamMember>;
}

interface CheckResult {
  newInserts: TeamMember[];
  duplicates: DuplicatesResult[];
  errors: Array<{ row: number; message: string }>;
}

interface TeamImportPreviewProps {
  projectId: string;
  checkResult: CheckResult;
  onClose: () => void;

  getMachineName: (machineId?: string) => string | undefined;
  getLineName: (lineId?: string) => string | undefined;
  getRoleName: (roleId: string) => string | undefined;
}

const TeamImportPreview: React.FC<TeamImportPreviewProps> = ({
  projectId,
  checkResult,
  onClose,
  getMachineName,
  getLineName,
  getRoleName,
}) => {
  const teamStore = useTeamStore();
  const [isConfirming, setIsConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { newInserts, duplicates, errors } = checkResult;

  const handleConfirmImport = async () => {
    setIsConfirming(true);
    setSuccessMessage(null);
    try {
      await teamStore.bulkConfirmImport(projectId, checkResult);
      setSuccessMessage('Import completed successfully and invitations were sent!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setSuccessMessage(`Error during import: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen text-center px-4 py-4 sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        <div
          className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left
                     overflow-hidden shadow-xl transform transition-all
                     sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6 relative"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>

          <h3 className="text-lg leading-6 font-medium text-gray-900 text-center">
            Import Results
          </h3>

          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md text-center">
              {successMessage}
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 text-left">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Errors Found ({errors.length})
              </h4>
              <div className="bg-red-50 p-4 rounded-md mb-4">
                <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                  {errors.map((error, idx) => (
                    <li key={idx}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Nouveaux membres */}
          {newInserts.length > 0 && (
            <div className="mt-4 text-left">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                New Members ({newInserts.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Working Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {newInserts.map((m, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {m.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {getRoleName(m.role)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {m.team_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {m.working_time_minutes} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Doublons => update */}
          {duplicates.length > 0 && (
            <div className="mt-8 text-left">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Members to Update ({duplicates.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Old Role / New Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Old Team / New Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Old Time / New Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {duplicates.map((dup, idx) => {
                      const oldRole = getRoleName(dup.existing.role);
                      const newRole = dup.new.role ? getRoleName(dup.new.role) : '(unchanged)';
                      return (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {dup.existing.email}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="text-xs text-gray-400">Old: {oldRole}</div>
                            <div className="text-xs text-gray-400">New: {newRole}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="text-xs text-gray-400">
                              Old: {dup.existing.team_name}
                            </div>
                            <div className="text-xs text-gray-400">
                              New: {dup.new.team_name || '(unchanged)'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="text-xs text-gray-400">
                              Old: {dup.existing.working_time_minutes} min
                            </div>
                            <div className="text-xs text-gray-400">
                              New:{' '}
                              {dup.new.working_time_minutes !== undefined
                                ? `${dup.new.working_time_minutes} min`
                                : '(unchanged)'}
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

          {/* Bouton de confirmation */}
          <div className="mt-5 sm:mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isConfirming}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm
                         px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            >
              {isConfirming ? 'Importing...' : 'Confirm Import and Send Invitations'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamImportPreview;
