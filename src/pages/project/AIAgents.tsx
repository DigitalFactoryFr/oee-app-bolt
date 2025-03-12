import React, { useState } from 'react';
import { Search, Bot, Brain, Calendar, PenTool as Tool, Truck, FileSpreadsheet, ChevronRight } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';

interface AIAgent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  capabilities: string[];
  dataAccess: string[];
  status: 'available' | 'coming_soon';
}

const agents: AIAgent[] = [
  {
    id: 'maintenance-planner',
    name: 'Maintenance Planner',
    description: 'AI agent that optimizes maintenance schedules based on historical data, equipment status, and production plans.',
    icon: <Tool className="h-6 w-6" />,
    capabilities: [
      'Predictive maintenance scheduling',
      'Resource optimization',
      'Risk assessment',
      'Cost optimization',
      'Maintenance strategy recommendations'
    ],
    dataAccess: [
      'Equipment maintenance history',
      'Production schedules',
      'Spare parts inventory',
      'Machine performance data',
      'Stop events history'
    ],
    status: 'available'
  },
  {
    id: 'production-optimizer',
    name: 'Production Optimizer',
    description: 'Analyzes production data to suggest optimal schedules and resource allocation.',
    icon: <Brain className="h-6 w-6" />,
    capabilities: [
      'Production schedule optimization',
      'Resource allocation',
      'Bottleneck identification',
      'Capacity planning',
      'Efficiency recommendations'
    ],
    dataAccess: [
      'Production history',
      'Resource availability',
      'Machine capacity data',
      'Order backlog',
      'Quality metrics'
    ],
    status: 'available'
  },
  {
    id: 'inventory-manager',
    name: 'Inventory Manager',
    description: 'Manages inventory levels and suggests optimal ordering patterns.',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    capabilities: [
      'Inventory level optimization',
      'Order scheduling',
      'Demand forecasting',
      'Stock level alerts',
      'Supplier performance analysis'
    ],
    dataAccess: [
      'Inventory levels',
      'Order history',
      'Supplier data',
      'Production requirements',
      'Lead time data'
    ],
    status: 'coming_soon'
  },
  {
    id: 'supply-chain-optimizer',
    name: 'Supply Chain Optimizer',
    description: 'Optimizes supply chain operations and logistics.',
    icon: <Truck className="h-6 w-6" />,
    capabilities: [
      'Route optimization',
      'Delivery scheduling',
      'Supplier selection',
      'Cost optimization',
      'Risk management'
    ],
    dataAccess: [
      'Supplier data',
      'Logistics costs',
      'Delivery schedules',
      'Inventory levels',
      'Order history'
    ],
    status: 'coming_soon'
  },
  {
    id: 'scheduling-assistant',
    name: 'Scheduling Assistant',
    description: 'AI-powered assistant for optimal shift and resource scheduling.',
    icon: <Calendar className="h-6 w-6" />,
    capabilities: [
      'Shift planning',
      'Resource allocation',
      'Workload balancing',
      'Break scheduling',
      'Overtime management'
    ],
    dataAccess: [
      'Employee availability',
      'Skill matrices',
      'Production requirements',
      'Labor regulations',
      'Historical schedules'
    ],
    status: 'coming_soon'
  }
];

const AIAgentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Agents</h2>
            <p className="mt-1 text-sm text-gray-500">
              Intelligent agents to help optimize your operations
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search AI agents..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`relative rounded-lg border ${
                agent.status === 'available'
                  ? 'border-gray-300 hover:border-blue-500 cursor-pointer'
                  : 'border-gray-200 opacity-60 cursor-not-allowed'
              } bg-white p-6 shadow-sm space-y-3`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    {agent.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {agent.name}
                  </h3>
                  {agent.status === 'coming_soon' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {agent.description}
              </p>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Capabilities:</h4>
                <ul className="space-y-1">
                  {agent.capabilities.slice(0, 3).map((capability, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <ChevronRight className="h-4 w-4 text-gray-400 mr-1" />
                      {capability}
                    </li>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <li className="text-sm text-blue-600">
                      +{agent.capabilities.length - 3} more capabilities...
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Agent Details Modal */}
        {selectedAgent && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        {selectedAgent.icon}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedAgent.name}
                      </h3>
                      {selectedAgent.status === 'coming_soon' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      {selectedAgent.description}
                    </p>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900">Capabilities:</h4>
                    <ul className="mt-2 space-y-2">
                      {selectedAgent.capabilities.map((capability, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <ChevronRight className="h-4 w-4 text-gray-400 mr-1" />
                          {capability}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900">Data Access:</h4>
                    <ul className="mt-2 space-y-2">
                      {selectedAgent.dataAccess.map((access, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <ChevronRight className="h-4 w-4 text-gray-400 mr-1" />
                          {access}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setSelectedAgent(null)}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default AIAgentsPage;