import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Product, ProductExcelData } from '../types';

interface ImportResult {
  success: boolean;
  duplicates: Array<{
    name: string;
    existing: Product;
    new: Partial<Product>;
  }>;
  created: Product[];
}

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchProducts: (projectId: string) => Promise<Product[]>;
  createProduct: (projectId: string, machineId: string, data: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkCreateProducts: (projectId: string, products: ProductExcelData[]) => Promise<ImportResult>;
  bulkUpdateProducts: (updates: Array<{ id: string } & Partial<Product>>) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const products = data as Product[];
      set({ products, loading: false });
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      set({ error: (error as Error).message, loading: false });
      return [];
    }
  },

  createProduct: async (projectId, machineId, productData) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('products')
        .insert([{
          project_id: projectId,
          machine_id: machineId,
          status: 'in_progress',
          ...productData
        }])
        .select()
        .single();

      if (error) throw error;

      const newProduct = data as Product;
      set((state) => ({
        products: [...state.products, newProduct],
        loading: false
      }));

      return newProduct;
    } catch (error) {
      console.error('Error creating product:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateProduct: async (id, productData) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        products: state.products.map(product =>
          product.id === id ? { ...product, ...productData } : product
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating product:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        products: state.products.filter(product => product.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting product:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkCreateProducts: async (projectId, products) => {
    try {
      set({ loading: true, error: null });
      console.log("🚀 Starting bulk product creation...");

      // 1. Récupérer toutes les machines
      const { data: machines, error: machinesError } = await supabase
        .from('machines')
        .select('id, name')
        .eq('project_id', projectId);

      if (machinesError) throw machinesError;

      if (!machines || machines.length === 0) {
        throw new Error('No machines found for this project');
      }

      // 2. Récupérer tous les produits existants
      const { data: existingProducts, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', projectId);

      if (productsError) throw productsError;

      // 3. Créer les maps pour la recherche rapide
      const machinesByName = new Map(machines.map(machine => [machine.name.toLowerCase(), machine]));
      const existingProductsByName = new Map();
      
      existingProducts?.forEach(product => {
        const machine = machines.find(m => m.id === product.machine_id);
        if (machine) {
          const key = `${machine.name.toLowerCase()}-${product.name.toLowerCase()}`;
          existingProductsByName.set(key, product);
        }
      });

      // 4. Préparer les résultats
      const duplicates: Array<{
        name: string;
        existing: Product;
        new: Partial<Product>;
      }> = [];
      const created: Product[] = [];

      // 5. Traiter chaque produit
      for (const product of products) {
        const machine = machinesByName.get(product.machine_name.toLowerCase());
        
        if (!machine) {
          throw new Error(`Machine "${product.machine_name}" not found`);
        }

        const key = `${product.machine_name.toLowerCase()}-${product.name.toLowerCase()}`;
        const existingProduct = existingProductsByName.get(key);

        if (existingProduct) {
          duplicates.push({
            name: product.name,
            existing: existingProduct,
            new: {
              name: product.name,
              product_id: product.product_id,
              description: product.description,
              cycle_time: product.cycle_time,
            }
          });
        } else {
          const { data, error } = await supabase
            .from('products')
            .insert([{
              project_id: projectId,
              machine_id: machine.id,
              name: product.name,
              product_id: product.product_id,
              description: product.description,
              cycle_time: product.cycle_time,
              status: 'in_progress'
            }])
            .select()
            .single();

          if (error) throw error;
          if (data) created.push(data as Product);
        }
      }

      // 6. Mettre à jour l'état local
      if (created.length > 0) {
        set((state) => ({
          products: [...state.products, ...created],
          loading: false
        }));
      }

      return {
        success: true,
        duplicates,
        created
      };

    } catch (error) {
      console.error('Error in bulkCreateProducts:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkUpdateProducts: async (updates) => {
    try {
      set({ loading: true, error: null });

      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      set((state) => ({
        products: state.products.map(existingProduct => {
          const update = updates.find(u => u.id === existingProduct.id);
          return update ? { ...existingProduct, ...update } : existingProduct;
        }),
        loading: false
      }));
    } catch (error) {
      console.error('Error bulk updating products:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));