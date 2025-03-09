import React, { useState } from 'react';
import { Search, Database, FileSpreadsheet, Cpu, Globe } from 'lucide-react';

interface DataConnector {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'coming_soon';
}

const connectors: DataConnector[] = [
  {
    id: 'excel',
    name: 'Excel Import',
    description: 'Import data from Excel files with production data, stops, and quality issues',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    status: 'available'
  },
  {
    id: 'mqtt',
    name: 'MQTT Connection',
    description: 'Direct machine connection using MQTT protocol',
    icon: <Cpu className="h-6 w-6" />,
    status: 'coming_soon'
  },
  {
    id: 'database',
    name: 'Database Integration',
    description: 'Connect to external databases to import data',
    icon: <Database className="h-6 w-6" />,
    status: 'coming_soon'
  },
  {
    id: 'api',
    name: 'REST API',
    description: 'Connect through REST API endpoints',
    icon: <Globe className="h-6 w-6" />,
    status: 'coming_soon'
  }
];

interface DataConnectorsListProps {
  onSelect: (connectorId: string) => void;
}

const DataConnectorsList: React.FC<DataConnectorsListProps> = ({ onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConnectors = connectors.filter(connector =>
    connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    connector.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search connectors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredConnectors.map((connector) => (
          <div
            key={connector.id}
            className={`relative rounded-lg border ${
              connector.status === 'available'
                ? 'border-gray-300 hover:border-blue-500 cursor-pointer'
                : 'border-gray-200 opacity-60 cursor-not-allowed'
            } bg-white p-6 shadow-sm space-y-3`}
            onClick={() => connector.status === 'available' && onSelect(connector.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  {connector.icon}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {connector.name}
                </h3>
                {connector.status === 'coming_soon' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {connector.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataConnectorsList;