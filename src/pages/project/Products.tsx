import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Upload, Check, AlertCircle, Download, Plus, Trash2, Edit2 } from 'lucide-react';
import ProjectLayout from '../../components/layout/ProjectLayout';
import { useProductStore } from '../../store/productStore';
import { useMachineStore } from '../../store/machineStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { parseProductsExcel, generateProductsTemplate } from '../../utils/excelParser';
import ProductFormDialog from '../../components/products/ProductFormDialog';
import ProductImportPreview from '../../components/products/ProductImportPreview';
import type { Product, Machine } from '../../types';

interface ProductFormData {
  name: string;
  machine_id: string;
  product_id: string;
  description: string;
  cycle_time: number;
}

const ProductsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { products, loading: productsLoading, error, fetchProducts, createProduct, updateProduct, deleteProduct, bulkCreateProducts } = useProductStore();
  const { machines, loading: machinesLoading, fetchMachines } = useMachineStore();
  const { updateStepStatus } = useOnboardingStore();
  
  const [isExcelMode, setIsExcelMode] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    errors: Array<{ row: number; message: string }>;
    products: Product[];
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ProductFormData>();

  const selectedMachineId = watch('machine_id');

  useEffect(() => {
    if (projectId) {
      fetchProducts(projectId);
      fetchMachines(projectId);
    }
  }, [projectId, fetchProducts, fetchMachines]);

  useEffect(() => {
    if (editingProduct) {
      setValue('name', editingProduct.name);
      setValue('machine_id', editingProduct.machine_id);
      setValue('product_id', editingProduct.product_id || '');
      setValue('description', editingProduct.description || '');
      setValue('cycle_time', editingProduct.cycle_time);
      setShowFormDialog(true);
    } else {
      reset({
        name: '',
        machine_id: '',
        product_id: '',
        description: '',
        cycle_time: 0
      });
    }
  }, [editingProduct, setValue, reset]);

  const onSubmit = async (data: ProductFormData) => {
    if (!projectId) return;

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
        setEditingProduct(null);
      } else {
        await createProduct(projectId, data.machine_id, data);
      }

      setShowFormDialog(false);
      reset();
      await fetchProducts(projectId);
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError(null);
    
    if (file && projectId) {
      try {
        const products = await parseProductsExcel(file);
        const result = await bulkCreateProducts(projectId, products);
        
        if (!result.success) {
          setImportPreview({
            errors: result.errors,
            products: result.created
          });
        } else if (result.created.length > 0) {
          await fetchProducts(projectId);
          updateStepStatus('products', 'completed');
        } else {
          setExcelError('No valid products found in the Excel file');
        }
      } catch (error) {
        setExcelError((error as Error).message);
      }
    }
  };

  const handleTemplateDownload = () => {
    try {
      const buffer = generateProductsTemplate();
      
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'products_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating template:', error);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    await deleteProduct(id);
    setShowDeleteConfirm(null);
    await fetchProducts(projectId);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setShowFormDialog(true);
  };

  const handleCloseDialog = () => {
    setShowFormDialog(false);
    setEditingProduct(null);
    reset();
  };

  const handleContinueToTeams = () => {
    if (projectId) {
      updateStepStatus('products', 'completed');
      navigate(`/projects/${projectId}/onboarding/teams`);
    }
  };

  const getMachineById = (machineId: string): Machine | undefined => {
    return machines.find(machine => machine.id === machineId);
  };

  const getProductsForMachine = (machineId: string): Product[] => {
    return products.filter(product => product.machine_id === machineId);
  };

  const loading = productsLoading || machinesLoading;

  return (
    <ProjectLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure your products and assign them to machines.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-red-800">Error loading products</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsExcelMode(false)}
                    className={`flex-1 py-3 px-4 rounded-lg text-center ${
                      !isExcelMode
                        ? 'bg-white shadow-sm border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Manual Configuration
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExcelMode(true)}
                    className={`flex-1 py-3 px-4 rounded-lg text-center ${
                      isExcelMode
                        ? 'bg-white shadow-sm border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Excel Import
                  </button>
                </div>
              </div>

              {isExcelMode ? (
                <div className="mt-6 space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label
                      htmlFor="excel-upload"
                      className="cursor-pointer inline-flex flex-col items-center"
                    >
                      <Upload className="h-12 w-12 text-gray-400" />
                      <span className="mt-2 text-sm font-medium text-gray-900">
                        Upload Excel Template
                      </span>
                      <span className="mt-1 text-sm text-gray-500">
                        Download our template and fill it with your products data
                      </span>
                    </label>
                  </div>

                  {excelError && (
                    <div className="bg-red-50 p-4 rounded-md flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-red-800">Error processing Excel file</h3>
                        <p className="mt-1 text-sm text-red-700">{excelError}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleTemplateDownload}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Excel Template
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Configured Products</h3>
                  {!isExcelMode && (
                    <button
                      onClick={handleAddNew}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </button>
                  )}
                </div>

                {machines.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium text-gray-900">No Machines</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      You need to configure machines before adding products.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate(`/projects/${projectId}/onboarding/machines`)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Configure Machines
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {machines.map((machine) => (
                      <div key={machine.id} className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">{machine.name}</h4>
                        <div className="space-y-4">
                          {getProductsForMachine(machine.id).map((product) => (
                            <div
                              key={product.id}
                              className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between"
                            >
                              <div>
                                <h5 className="text-sm font-medium text-gray-900">{product.name}</h5>
                                {product.product_id && (
                                  <p className="mt-1 text-sm text-gray-500">ID: {product.product_id}</p>
                                )}
                                {product.description && (
                                  <p className="mt-1 text-sm text-gray-500">{product.description}</p>
                                )}
                                <p className="mt-1 text-sm text-gray-500">
                                  Cycle time: {product.cycle_time} seconds
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="p-2 text-gray-400 hover:text-blue-500"
                                >
                                  <Edit2 className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(product.id)}
                                  className="p-2 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {products.length > 0 && (
                <div className="p-6 bg-gray-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToTeams}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Continue to Teams
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showFormDialog && (
              <ProductFormDialog
                product={editingProduct}
                machines={machines}
                onSubmit={handleSubmit(onSubmit)}
                onClose={handleCloseDialog}
                register={register}
                errors={errors}
                selectedMachineId={selectedMachineId}
              />
            )}

            {showDeleteConfirm && (
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
                          Delete Product
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this product? This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                      <button
                        type="button"
                        onClick={() => confirmDelete(showDeleteConfirm)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(null)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {importPreview && (
              <ProductImportPreview
                errors={importPreview.errors}
                products={importPreview.products}
                onClose={() => setImportPreview(null)}
                getMachineName={(machineId) => getMachineById(machineId)?.name || 'Unknown Machine'}
              />
            )}
          </div>
        )}
      </div>
    </ProjectLayout>
  );
};

export default ProductsPage;