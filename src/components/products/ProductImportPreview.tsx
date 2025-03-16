import React from 'react';
import { Check, X } from 'lucide-react';
import type { Product } from '../../types';

interface DuplicateInfo {
  name: string;
  existing: Product;
  new: Partial<Product>;
}

interface ProductExcelData {
  name: string;
  machine_name: string;
  product_id?: string;
  description?: string;
  cycle_time?: number;
}

interface ProductImportPreviewProps {
  errors: Array<{ row: number; message: string }>;
  newInserts: ProductExcelData[];
  duplicates: DuplicateInfo[];
  onClose: () => void;
  onConfirm: () => void;    // skip duplicates
  onUpdateAll: () => void;  // update duplicates
}

const ProductImportPreview: React.FC<ProductImportPreviewProps> = ({
  errors,
  newInserts,
  duplicates,
  onClose,
  onConfirm,
  onUpdateAll,
}) => {
  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen text-center px-4 py-4 sm:block sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" />
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left 
                     overflow-hidden shadow-xl transform transition-all
                     sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6 relative"
        >
          {/* Bouton X */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>

          <div className="text-center sm:mt-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Import Preview</h3>

            {/* Erreurs */}
            {errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">
                  Errors Found ({errors.length})
                </h4>
                <div className="bg-red-50 p-4 rounded-md mb-4">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                    {errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Doublons */}
            {duplicates.length > 0 && (
              <div className="mt-4 text-left">
                <h4 className="text-md font-medium text-gray-900 mb-2">
                  Duplicate Products ({duplicates.length})
                </h4>
                <div className="bg-yellow-50 p-4 rounded-md mb-4">
                  <p className="text-sm text-yellow-700">
                    The following products already exist. You can update them or skip.
                  </p>
                </div>
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500">Existing Name</th>
                      <th className="px-4 py-2 font-medium text-gray-500">New Name</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Cycle Time (Old → New)</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Description (Old → New)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {duplicates.map((dup, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">{dup.existing.name}</td>
                        <td className="px-4 py-2">{dup.new.name}</td>
                        <td className="px-4 py-2">
                          {dup.existing.cycle_time} → {dup.new.cycle_time}
                        </td>
                        <td className="px-4 py-2">
                          {dup.existing.description || '-'} → {dup.new.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Nouveaux produits */}
            {newInserts.length > 0 && (
              <div className="mt-4 text-left">
                <h4 className="text-md font-medium text-gray-900 mb-2">
                  New Products ({newInserts.length})
                </h4>
                <div className="bg-green-50 p-4 rounded-md mb-4">
                  <p className="text-sm text-green-700">
                    The following products will be created.
                  </p>
                </div>
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Machine</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Cycle Time</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {newInserts.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">{item.machine_name}</td>
                        <td className="px-4 py-2">{item.cycle_time || '-'}</td>
                        <td className="px-4 py-2">{item.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Boutons de confirmation */}
          <div className="mt-5 sm:mt-6 flex justify-end space-x-2">
            {duplicates.length > 0 && (
              <button
                type="button"
                onClick={onUpdateAll}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md
                           shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Update All
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md
                         shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {duplicates.length > 0 ? 'Skip Duplicates' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImportPreview;
