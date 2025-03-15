// MachineCountModal.jsx
import React, { useState } from 'react';

const MachineCountModal = ({ isOpen, onClose, onConfirm }) => {
  const [machineCount, setMachineCount] = useState(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="bg-white rounded-lg p-6 z-10 max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Select Number of Machines</h2>
        <p className="mb-4">Please enter the number of machine licenses you want to purchase:</p>
        <input
          type="number"
          min="1"
          value={machineCount}
          onChange={(e) => setMachineCount(parseInt(e.target.value, 10))}
          className="w-full p-2 border border-gray-300 rounded mb-4"
        />
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(machineCount)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default MachineCountModal;
