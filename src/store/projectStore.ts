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
  
  fetchProjects: async () => {
    try {
      console.log("🔍 Fetching projects...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("❌ No user found, clearing projects");
        set({ projects: [], loading: false });
        return;
      }

      set({ loading: true, error: null });

      // Get all projects in a single query
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log("✅ Projects fetched successfully:", data?.length || 0, "projects");
      set({ projects: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching projects:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  fetchProject: async (id) => {
    try {
      console.log("🔍 Fetching project:", id);
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      console.log("✅ Project fetched successfully:", data?.name);
      set({ 
        currentProject: data as Project,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  createProject: async (name, description = '') => {
    try {
      console.log("🚀 Creating new project:", { name, description });
      set({ loading: true, error: null });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // First create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name,
          description,
          user_id: user.id
        }])
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      // Then create the owner team member record
      const { error: teamError } = await supabase
        .from('team_members')
        .insert([{
          project_id: project.id,
          email: user.email,
          role: 'owner',
          status: 'active',
          team_name: 'Owners',
          working_time_minutes: 480
        }]);
      
      if (teamError) throw teamError;
      
      set((state) => ({ 
        projects: [project as Project, ...state.projects],
        currentProject: project as Project,
        loading: false
      }));
      
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
    } catch (error) {
      console.error('Error deleting project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
}));