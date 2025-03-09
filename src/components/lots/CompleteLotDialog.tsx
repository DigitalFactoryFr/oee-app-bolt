import React from 'react';
import { Check, X } from 'lucide-react';

interface CompleteLotDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  totalParts: number;
  theoreticalParts: number;
}

const CompleteLotDialog: React.FC<CompleteLotDialogProps> = ({
  onConfirm,
  onCancel,
  totalParts,
  theoreticalParts
}) => {
  const efficiency = Math.round((totalParts / theoreticalParts) * 100);

  return (
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
                Complete Production Lot
              </h3>
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Are you sure you want to complete this production lot? This action cannot be undone.
                </p>
                <div className="mt-4 bg-gray-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Parts Produced</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{totalParts}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Theoretical Parts</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{theoreticalParts}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-500">Efficiency</p>
                      <p className={`mt-1 text-2xl font-semibold ${
                        efficiency >= 90 ? 'text-green-600' :
                        efficiency >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {efficiency}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
            >
              <Check className="h-4 w-4 mr-2" />
              Complete Lot
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteLotDialog;