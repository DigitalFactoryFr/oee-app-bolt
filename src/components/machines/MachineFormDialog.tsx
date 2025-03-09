import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { Machine, ProductionLine } from '../../types';

interface MachineFormDialogProps {
  machine: Machine | null;
  lines: ProductionLine[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  register: UseFormRegister<any>;
  errors: FieldErrors;
  selectedLineId: string;
}

const MachineFormDialog: React.FC<MachineFormDialogProps> = ({
  machine,
  lines,
  onSubmit,
  onClose,
  register,
  errors,
  selectedLineId
}) => {
  const selectedLine = lines.find(line => line.id === selectedLineId);

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
                {machine ? 'Edit Machine' : 'Add Machine'}
              </h3>
              <div className="mt-4">
                <form onSubmit={onSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="line_id" className="block text-sm font-medium text-gray-700">
                      Production Line
                    </label>
                    <select
                      id="line_id"
                      {...register('line_id', { required: 'Production line is required' })}
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

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Machine Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      {...register('name', { required: 'Machine name is required' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Machine 1"
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
                      placeholder="Optional description of the machine"
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
                          min: { value: 1, message: 'Opening time must be at least 1 minute' },
                          max: { value: 1440, message: 'Opening time cannot exceed 24 hours' }
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder={selectedLine ? String(selectedLine.opening_time_minutes) : ''}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">min</span>
                      </div>
                    </div>
                    {errors.opening_time_minutes && (
                      <p className="mt-1 text-sm text-red-600">{errors.opening_time_minutes.message}</p>
                    )}
                    {selectedLine && (
                      <p className="mt-1 text-sm text-gray-500">
                        Leave empty to use line default ({selectedLine.opening_time_minutes} minutes)
                      </p>
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
              {machine ? 'Update' : 'Add'}
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

export default MachineFormDialog;