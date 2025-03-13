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
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .or(`user_id.eq.${user.id},id.in.(${
          supabase
            .from('team_members')
            .select('project_id')
            .eq('email', user.email)
            .eq('status', 'active')
            .then(({ data }) => data?.map(d => d.project_id).join(','))
        })`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching projects:", error);
        throw error;
      }
      
      console.log("✅ Projects fetched successfully:", data?.length || 0, "projects");
      const projects = data as Project[];
      set({ projects, loading: false, error: null });
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
      
      if (error) {
        console.error("❌ Error fetching project:", error);
        throw error;
      }
      
      console.log("✅ Project fetched successfully:", data?.name);
      const project = data as Project;
      set({ 
        currentProject: project,
        loading: false,
        error: null
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
        console.error("❌ Error: User not authenticated");
        throw new Error('User not authenticated');
      }
      
      console.log("👤 Creating project for user:", user.id);
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name,
          description,
          user_id: user.id
        }])
        .select()
        .single();
      
      if (error) {
        console.error("❌ Error creating project:", error);
        throw error;
      }
      
      console.log("✅ Project created successfully:", data);
      const project = data as Project;
      set((state) => ({ 
        projects: [project, ...state.projects],
        currentProject: project,
        loading: false,
        error: null
      }));
      
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },
  
  updateProject: async (id, projectData) => {
    try {
      console.log("📝 Updating project:", id, projectData);
      set({ loading: true, error: null });
      
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id);
      
      if (error) {
        console.error("❌ Error updating project:", error);
        throw error;
      }
      
      console.log("✅ Project updated successfully");
      set((state) => {
        const updatedProjects = state.projects.map(project => 
          project.id === id ? { ...project, ...projectData } : project
        );
        
        return { 
          projects: updatedProjects,
          currentProject: state.currentProject?.id === id 
            ? { ...state.currentProject, ...projectData }
            : state.currentProject,
          loading: false,
          error: null
        };
      });
    } catch (error) {
      console.error('Error updating project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
  
  deleteProject: async (id) => {
    try {
      console.log("🗑️ Deleting project:", id);
      set({ loading: true, error: null });
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error("❌ Error deleting project:", error);
        throw error;
      }
      
      console.log("✅ Project deleted successfully");
      set((state) => ({ 
        projects: state.projects.filter(project => project.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error deleting project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
}));