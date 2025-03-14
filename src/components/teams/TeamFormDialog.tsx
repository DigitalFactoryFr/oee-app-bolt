import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { TeamMember, Machine, ProductionLine, TeamRole } from '../../types';

interface TeamFormDialogProps {
  member: TeamMember | null;
  machines: Machine[];
  lines: ProductionLine[];
  roles: TeamRole[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  register: UseFormRegister<any>;
  errors: FieldErrors;
  selectedRole: string;
}

const TeamFormDialog: React.FC<TeamFormDialogProps> = ({
  member,
  machines,
  lines,
  roles,
  onSubmit,
  onClose,
  register,
  errors,
  selectedRole
}) => {
  // Get role details
  const selectedRoleDetails = roles.find(role => role.id === selectedRole);
  const scope = selectedRoleDetails?.scope || 'none';

  return (
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
                {member ? 'Edit Team Member' : 'Add Team Member'}
              </h3>
              <div className="mt-4">
                <form onSubmit={onSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="member@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      id="role"
                      {...register('role', { required: 'Role is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select a role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="team_name" className="block text-sm font-medium text-gray-700">
                      Team Name
                    </label>
                    <input
                      type="text"
                      id="team_name"
                      {...register('team_name', { required: 'Team name is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Team A"
                    />
                    {errors.team_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.team_name.message}</p>
                    )}
                  </div>

                  {/* Show machine selection only for operators */}
                  {scope === 'machine' && (
                    <div>
                      <label htmlFor="machine_id" className="block text-sm font-medium text-gray-700">
                        Machine
                      </label>
                      <select
                        id="machine_id"
                        {...register('machine_id', { required: 'Machine is required for operators' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select a machine</option>
                        {machines.map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.name}
                          </option>
                        ))}
                      </select>
                      {errors.machine_id && (
                        <p className="mt-1 text-sm text-red-600">{errors.machine_id.message}</p>
                      )}
                    </div>
                  )}

                  {/* Show line selection only for team managers */}
                  {scope === 'line' && (
                    <div>
                      <label htmlFor="line_id" className="block text-sm font-medium text-gray-700">
                        Production Line
                      </label>
                      <select
                        id="line_id"
                        {...register('line_id', { required: 'Production line is required for team managers' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select a production line</option>
                        {lines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.name}
                          </option>
                        ))}
                      </select>
                      {errors.line_id && (
                        <p className="mt-1 text-sm text-red-600">{errors.line_id.message}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="working_time_minutes" className="block text-sm font-medium text-gray-700">
                      Working Time (minutes)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="working_time_minutes"
                        {...register('working_time_minutes', {
                          required: 'Working time is required',
                          min: { value: 1, message: 'Working time must be at least 1 minute' },
                          max: { value: 1440, message: 'Working time cannot exceed 24 hours' }
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">min</span>
                      </div>
                    </div>
                    {errors.working_time_minutes && (
                      <p className="mt-1 text-sm text-red-600">{errors.working_time_minutes.message}</p>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onSubmit}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {member ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamFormDialog;