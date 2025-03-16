import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Project } from '../types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
  
  setCurrentProject: (project) => {
    set({ currentProject: project });
    if (project) {
      localStorage.setItem('currentProject', JSON.stringify(project));
    } else {
      localStorage.removeItem('currentProject');
    }
  },

  clearCurrentProject: () => {
    set({ currentProject: null });
    localStorage.removeItem('currentProject');
  },


  loadCurrentProject: () => {
  const savedProject = localStorage.getItem('currentProject');
  if (savedProject) {
    try {
      set({ currentProject: JSON.parse(savedProject) });
    } catch (error) {
      console.error("Erreur lors du chargement du projet depuis localStorage:", error);
    }
  }
},

  
  fetchProjects: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ projects: [], loading: false });
        return;
      }

      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ projects: data || [], loading: false });
      
      
      if (data && data.length > 0) {
        console.log("[ProjectStore] ✅ Sélection du premier projet :", data[0]);
        set({ currentProject: data[0] });
        localStorage.setItem('currentProject', JSON.stringify(data[0]));
}

      
    } catch (error) {
      console.error('Error fetching projects:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  fetchProject: async (id) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      set({ currentProject: data as Project, loading: false });

      if (!data) {
        console.log("[ProjectStore] ⚠️ Aucun projet trouvé, redirection vers /projects/new");
        set({ currentProject: null });
        localStorage.removeItem('currentProject');
      }


      
    } catch (error) {
      console.error('Error fetching project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  createProject: async (name, description = '') => {
    try {
      set({ loading: true, error: null });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          user_id: user.id
        })
        .select()
        .single();
      
      if (projectError) throw projectError;


      
      set((state) => {
  console.log("[ProjectStore] ✅ Projet créé :", project);
  localStorage.setItem('currentProject', JSON.stringify(project));

      return { 
        projects: [project as Project, ...state.projects],
        currentProject: project as Project,
        loading: false
      };
    });

      
      return project as Project;
    } catch (error) {
      console.error('Error creating project:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },
  
  updateProject: async (id, projectData) => {
    try {
      set({ loading: true, error: null });
      
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id);
      
      if (error) throw error;
      
      set((state) => {
        const updatedProjects = state.projects.map(project => 
          project.id === id ? { ...project, ...projectData } : project
        );
        
        return { 
          projects: updatedProjects,
          currentProject: state.currentProject?.id === id 
            ? { ...state.currentProject, ...projectData }
            : state.currentProject,
          loading: false
        };
      });
    } catch (error) {
      console.error('Error updating project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  deleteProject: async (id) => {
    try {
      set({ loading: true, error: null });
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      set((state) => ({ 
        projects: state.projects.filter(project => project.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false
      }));
      
      if (state.currentProject?.id === id) {
        console.log("[ProjectStore] 🗑️ Projet supprimé, redirection vers /projects/new");
        set({ currentProject: null });
        localStorage.removeItem('currentProject');
      }

      
    } catch (error) {
      console.error('Error deleting project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
}));