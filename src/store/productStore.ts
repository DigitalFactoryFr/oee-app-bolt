// src/store/productStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Product, ProductExcelData } from '../types';

interface DuplicatesResult {
  name: string;
  existing: Product;
  new: Partial<Product>;
}

interface CheckResult {
  newInserts: ProductExcelData[]; 
  duplicates: DuplicatesResult[];
  errors: Array<{ row: number; message: string }>;
}

interface ConfirmResult {
  created: Product[];
  updated: Product[];
}

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;

  fetchProducts: (projectId: string) => Promise<Product[]>;
  createProduct: (
    projectId: string,
    machineId: string,
    data: Partial<Product>
  ) => Promise<Product | null>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Nouveau flux : check + confirm
  bulkCheckProducts: (
    projectId: string,
    productsExcel: ProductExcelData[]
  ) => Promise<CheckResult>;
  bulkConfirmImport: (
    projectId: string,
    checkResult: CheckResult
  ) => Promise<ConfirmResult>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  // ----------------------
  // Méthodes de base
  // ----------------------
  async fetchProducts(projectId) {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      set({ products: data as Product[], loading: false });
      return data as Product[];
    } catch (err) {
      console.error('Error fetching products:', err);
      set({ error: (err as Error).message, loading: false });
      return [];
    }
  },

  async createProduct(projectId, machineId, productData) {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            project_id: projectId,
            machine_id: machineId,
            status: 'in_progress',
            ...productData,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      const newProduct = data as Product;
      set((state) => ({
        products: [...state.products, newProduct],
        loading: false,
      }));
      return newProduct;
    } catch (err) {
      console.error('Error creating product:', err);
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  async updateProduct(id, productData) {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, ...productData } : p
        ),
        loading: false,
      }));
    } catch (err) {
      console.error('Error updating product:', err);
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async deleteProduct(id) {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (err) {
      console.error('Error deleting product:', err);
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  // ----------------------
  // DRY RUN + CONFIRM
  // ----------------------
  async bulkCheckProducts(projectId, productsExcel) {
    if (!projectId) {
      throw new Error('projectId is undefined');
    }
    try {
      set({ loading: true, error: null });

      // 1) Récupérer machines
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('id, name')
        .eq('project_id', projectId);
      if (machinesError) throw machinesError;
      if (!machinesData) throw new Error('No machines found');

      // 2) Récupérer produits existants
      const { data: existingProducts, error: existingError } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', projectId);
      if (existingError) throw existingError;

      // 3) Maps
      const machinesMap = new Map<string, string>();
      machinesData.forEach((m) => {
        machinesMap.set(m.name.trim().toLowerCase(), m.id);
      });

      const existingMap = new Map<string, Product>();
      existingProducts.forEach((prod) => {
        const machine = machinesData.find((m) => m.id === prod.machine_id);
        if (machine) {
          const key = `${machine.name.toLowerCase()}-${prod.name.toLowerCase()}`;
          existingMap.set(key, prod);
        }
      });

      const newInserts: ProductExcelData[] = [];
      const duplicates: DuplicatesResult[] = [];
      const errors: Array<{ row: number; message: string }> = [];

      // 4) Parcourir le fichier
      for (let i = 0; i < productsExcel.length; i++) {
        const rowIndex = i + 2;
        const item = productsExcel[i];
        if (!item.name) {
          errors.push({ row: rowIndex, message: 'Product name is required' });
          continue;
        }
        if (!item.machine_name) {
          errors.push({
            row: rowIndex,
            message: `Machine name is required for product ${item.name}`,
          });
          continue;
        }

        const machineId = machinesMap.get(item.machine_name.trim().toLowerCase());
        if (!machineId) {
          errors.push({
            row: rowIndex,
            message: `Machine "${item.machine_name}" not found`,
          });
          continue;
        }

        const key = `${item.machine_name.toLowerCase()}-${item.name.toLowerCase()}`;
        if (existingMap.has(key)) {
          // => Doublon
          duplicates.push({
            name: item.name,
            existing: existingMap.get(key)!,
            new: {
              name: item.name,
              product_id: item.product_id,
              description: item.description,
              cycle_time: item.cycle_time,
            },
          });
        } else {
          newInserts.push(item);
        }
      }

      set({ loading: false });
      return { newInserts, duplicates, errors };
    } catch (err) {
      console.error('Error in bulkCheckProducts:', err);
      set({ error: (err as Error).message, loading: false });
      return { newInserts: [], duplicates: [], errors: [] };
    }
  },

  async bulkConfirmImport(projectId, checkResult) {
    if (!projectId) {
      throw new Error('projectId is undefined');
    }
    try {
      set({ loading: true, error: null });

      const { newInserts, duplicates } = checkResult;
      const created: Product[] = [];
      const updated: Product[] = [];

      // A) Insérer newInserts
      for (const item of newInserts) {
        // Retrouver machine
        const { data: foundMachine } = await supabase
          .from('machines')
          .select('id, name')
          .eq('project_id', projectId)
          .ilike('name', item.machine_name.trim()) // iLike => case-insensitive
          .single();

        if (!foundMachine) {
          console.warn(
            `Machine "${item.machine_name}" not found for product ${item.name}`
          );
          continue;
        }

        const { data, error } = await supabase
          .from('products')
          .insert([
            {
              project_id: projectId,
              machine_id: foundMachine.id,
              name: item.name,
              product_id: item.product_id,
              description: item.description,
              cycle_time: item.cycle_time,
              status: 'in_progress',
            },
          ])
          .select()
          .single();
        if (error) {
          console.error('Insert error for new product:', error);
          continue;
        }
        created.push(data as Product);
      }

      // B) Mettre à jour duplicates
      for (const dup of duplicates) {
        const { id } = dup.existing;
        const updateData: Partial<Product> = {
          name: dup.new.name,
          product_id: dup.new.product_id,
          description: dup.new.description,
          cycle_time: dup.new.cycle_time,
        };
        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', id);
        if (error) {
          console.error('Update error for existing product:', error);
          continue;
        }
        updated.push({ ...dup.existing, ...updateData });
      }

      // Re-fetch final
      const { data: finalData } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', projectId);
      if (finalData) {
        set({ products: finalData as Product[] });
      }

      set({ loading: false });
      return { created, updated };
    } catch (err) {
      console.error('Error in bulkConfirmImport:', err);
      set({ error: (err as Error).message, loading: false });
      return { created: [], updated: [] };
    }
  },
}));
