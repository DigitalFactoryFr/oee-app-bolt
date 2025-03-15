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
  loadCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  /** 🔹 Charge un projet depuis localStorage s'il existe */
  loadCurrentProject: async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const savedProject = localStorage.getItem('currentProject');
  if (savedProject) {
    try {
      const parsedProject = JSON.parse(savedProject);
      
      // Vérifier si le projet appartient bien à l'utilisateur connecté
      if (parsedProject.user_id === user.id) {
        set({ currentProject: parsedProject });
      } else {
        console.warn("[ProjectStore] ⚠️ Projet enregistré non valide pour cet utilisateur.");
        set({ currentProject: null });
        localStorage.removeItem('currentProject');
      }
    } catch (error) {
      console.error("Erreur lors du chargement du projet depuis localStorage:", error);
      set({ currentProject: null });
      localStorage.removeItem('currentProject');
    }
  }
},


  /** 🔹 Définit le projet courant et l'enregistre en local */
  setCurrentProject: async (project) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (project && project.user_id !== user.id) {
    console.warn("[ProjectStore] ❌ Tentative de charger un projet d'un autre utilisateur !");
    set({ currentProject: { id: 'default', name: 'My First Project', user_id: user.id } });
    localStorage.removeItem('currentProject');
    return;
  }

  set({ currentProject: project });

  if (project) {
    localStorage.setItem('currentProject', JSON.stringify(project));
  } else {
    localStorage.removeItem('currentProject');
  }
},


  /** 🔹 Efface le projet courant */
  clearCurrentProject: () => {
    set({ currentProject: null });
    localStorage.removeItem('currentProject');
  },

  /** 🔹 Récupère tous les projets de l'utilisateur */
fetchProjects: async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[ProjectStore] ❌ Aucun utilisateur trouvé, suppression des projets");
      set({ projects: [], currentProject: null, loading: false });
      localStorage.removeItem('currentProject');
      return;
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      console.warn("[ProjectStore] 🚨 Aucun projet trouvé, affichage de 'My First Project' temporaire");
      
      // 🔹 On affiche un projet temporaire sans l'enregistrer en base de données
      set({
        projects: [],
        currentProject: { id: 'default', name: 'My First Project', user_id: user.id },
        loading: false
      });

      return;
    }

    set({ projects: data, currentProject: data[0], loading: false });
    localStorage.setItem('currentProject', JSON.stringify(data[0]));

  } catch (error) {
    console.error('Error fetching projects:', error);
    set({ error: (error as Error).message, loading: false });
  }
},




  /** 🔹 Récupère un projet spécifique */
  fetchProject: async (id) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // 🔹 Vérifie que `data` existe avant d'écraser `currentProject`
      if (data) {
        set({ currentProject: data as Project, loading: false });
      } else {
        console.log("[ProjectStore] ⚠️ Aucun projet trouvé, redirection vers /projects/new");
        set({ currentProject: null });
        localStorage.removeItem('currentProject');
      }

    } catch (error) {
      console.error('Error fetching project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  /** 🔹 Crée un nouveau projet */
  createProject: async (name, description = '') => {
    try {
      set({ loading: true, error: null });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({ name, description, user_id: user.id })
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

  /** 🔹 Met à jour un projet existant */
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

  /** 🔹 Supprime un projet */
  deleteProject: async (id) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => {
        const isCurrentDeleted = state.currentProject?.id === id;

        console.log("[ProjectStore] 🗑️ Projet supprimé :", id);

        return {
          projects: state.projects.filter(project => project.id !== id),
          currentProject: isCurrentDeleted ? null : state.currentProject,
          loading: false
        };
      });

      if (localStorage.getItem('currentProject')) {
        localStorage.removeItem('currentProject');
      }

    } catch (error) {
      console.error('Error deleting project:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },
}));
