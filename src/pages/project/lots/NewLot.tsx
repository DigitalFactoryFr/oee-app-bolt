import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Search } from 'lucide-react';
import ProjectLayout from '../../../components/layout/ProjectLayout';
import { useTeamStore } from '../../../store/teamStore';
import { useProductStore } from '../../../store/productStore';
import { useMachineStore } from '../../../store/machineStore';
import { useDataStore } from '../../../store/dataStore';
import { useAuthStore } from '../../../store/authStore';
import type { Machine, Product } from '../../../types';

interface LotFormData {
  date: string;
  start_time: string;
  end_time: string;
  product: string;
  machine: string;
  lot_id?: string;
  lot_size: number;
  comment?: string;
}

const NewLot: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { members, fetchMembers } = useTeamStore();
  const { products, fetchProducts } = useProductStore();
  const { machines, fetchMachines } = useMachineStore();
  const { createLot, calculateTheoreticalLotSize, loading, error } = useDataStore();
  
  // Search states
  const [machineSearch, setMachineSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showMachinesList, setShowMachinesList] = useState(false);
  const [showProductsList, setShowProductsList] = useState(false);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Get current date and last used times from localStorage
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const lastStartTime = localStorage.getItem('lastStartTime') || '08:00';
  const lastEndTime = localStorage.getItem('lastEndTime') || '16:00';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<LotFormData>({
    defaultValues: {
      date: currentDate,
      start_time: lastStartTime,
      end_time: lastEndTime,
      lot_size: 0
    }
  });

  const selectedMachine = watch('machine');
  const selectedProduct = watch('product');
  const startTime = watch('start_time');
  const endTime = watch('end_time');

  useEffect(() => {
    if (projectId) {
      fetchMembers(projectId);
      fetchProducts(projectId);
      fetchMachines(projectId);
    }
  }, [projectId]);

  // Filter machines based on search
  useEffect(() => {
    const filtered = machines.filter(machine =>
      machine.name.toLowerCase().includes(machineSearch.toLowerCase())
    );
    setFilteredMachines(filtered);
  }, [machineSearch, machines]);

  // Filter products based on search and selected machine
  useEffect(() => {
    let filtered = products;
    
    if (selectedMachine) {
      filtered = filtered.filter(product => product.machine_id === selectedMachine);
    }
    
    filtered = filtered.filter(product =>
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.product_id && product.product_id.toLowerCase().includes(productSearch.toLowerCase()))
    );
    
    setFilteredProducts(filtered);
  }, [productSearch, products, selectedMachine]);

  // Update lot size when times or product changes
  useEffect(() => {
    if (selectedProduct && startTime && endTime) {
      const product = products.find(p => p.id === selectedProduct);
      if (product) {
        const theoreticalSize = calculateTheoreticalLotSize(
          `${watch('date')}T${startTime}`,
          `${watch('date')}T${endTime}`,
          product.cycle_time
        );
        setValue('lot_size', theoreticalSize);
      }
    }
  }, [selectedProduct, startTime, endTime, products, setValue]);

  const onSubmit = async (data: LotFormData) => {
    if (!projectId) return;

    try {
      // Save times for next use
      localStorage.setItem('lastStartTime', data.start_time);
      localStorage.setItem('lastEndTime', data.end_time);

      const lot = await createLot(projectId, data);
      navigate(`/projects/${projectId}/lots/${lot.id}`);
    } catch (err) {
      console.error('Error creating lot:', err);
    }
  };

  const handleMachineSelect = (machine: Machine) => {
    setValue('machine', machine.id);
    setMachineSearch(machine.name);
    setShowMachinesList(false);
    setValue('product', ''); // Reset product when machine changes
    setProductSearch('');
  };

  const handleProductSelect = (product: Product) => {
    setValue('product', product.id);
    setProductSearch(product.name);
    setShowProductsList(false);
  };

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create Production Lot</h2>
          <p className="mt-1 text-sm text-gray-500">
            Record new production data for your machines.
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  {...register('date', { required: 'Date is required' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <input
                  type="time"
                  id="start_time"
                  {...register('start_time', { required: 'Start time is required' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.start_time && (
                  <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                  End Time
                </label>
                <input
                  type="time"
                  id="end_time"
                  {...register('end_time', { required: 'End time is required' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.end_time && (
                  <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lot_id" className="block text-sm font-medium text-gray-700">
                  Lot ID (Optional)
                </label>
                <input
                  type="text"
                  id="lot_id"
                  {...register('lot_id')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., LOT001"
                />
              </div>

              <div>
                <label htmlFor="machine" className="block text-sm font-medium text-gray-700">
                  Machine
                </label>
                <div className="mt-1 relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={machineSearch}
                      onChange={(e) => {
                        setMachineSearch(e.target.value);
                        setShowMachinesList(true);
                      }}
                      onFocus={() => setShowMachinesList(true)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Search machines..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {showMachinesList && filteredMachines.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200">
                      <ul className="max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
                        {filteredMachines.map((machine) => (
                          <li
                            key={machine.id}
                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 ${
                              selectedMachine === machine.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleMachineSelect(machine)}
                          >
                            <div className="flex items-center">
                              <span className="block truncate font-medium">
                                {machine.name}
                              </span>
                            </div>
                            {machine.description && (
                              <span className="block truncate text-sm text-gray-500">
                                {machine.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <input
                  type="hidden"
                  {...register('machine', { required: 'Machine is required' })}
                />
                {errors.machine && (
                  <p className="mt-1 text-sm text-red-600">{errors.machine.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                  Product
                </label>
                <div className="mt-1 relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductsList(true);
                      }}
                      onFocus={() => setShowProductsList(true)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Search by name or ID..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {showProductsList && filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200">
                      <ul className="max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
                        {filteredProducts.map((product) => (
                          <li
                            key={product.id}
                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 ${
                              selectedProduct === product.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleProductSelect(product)}
                          >
                            <div className="flex items-center">
                              <span className="block truncate font-medium">
                                {product.name}
                              </span>
                              {product.product_id && (
                                <span className="ml-2 text-sm text-gray-500">
                                  ({product.product_id})
                                </span>
                              )}
                            </div>
                            {product.description && (
                              <span className="block truncate text-sm text-gray-500">
                                {product.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <input
                  type="hidden"
                  {...register('product', { required: 'Product is required' })}
                />
                {errors.product && (
                  <p className="mt-1 text-sm text-red-600">{errors.product.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lot_size" className="block text-sm font-medium text-gray-700">
                  Lot Size
                </label>
                <input
                  type="number"
                  id="lot_size"
                  {...register('lot_size', {
                    required: 'Lot size is required',
                    min: { value: 1, message: 'Lot size must be at least 1' }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.lot_size && (
                  <p className="mt-1 text-sm text-red-600">{errors.lot_size.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Suggested lot size based on cycle time and duration
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  Comments
                </label>
                <textarea
                  id="comment"
                  rows={3}
                  {...register('comment')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Add any additional notes or comments..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/lots`)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Lot
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProjectLayout>
  );
};

export default NewLot;