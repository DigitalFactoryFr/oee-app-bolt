import React from 'react';
import ProjectLayout from '../../components/layout/ProjectLayout';

const ProductionLine: React.FC = () => {
  return (
    <ProjectLayout>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Production Line Management</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>This page will allow you to configure and monitor your production lines.</p>
          </div>
          <div className="mt-5">
            <p className="text-sm text-gray-500">Coming soon...</p>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default ProductionLine;