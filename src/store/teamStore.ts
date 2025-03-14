import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailService';
import type { TeamMember, ProjectRole } from '../types';

interface TeamState {
  members: TeamMember[];
  roles: { id: ProjectRole; name: string; description: string; scope: 'project' | 'line' | 'machine' | 'none' }[];
  loading: boolean;
  error: string | null;
  fetchMembers: (projectId: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  createMember: (projectId: string, machineId: string | null, lineId: string | null, data: Partial<TeamMember>) => Promise<TeamMember | null>;
  updateMember: (id: string, data: Partial<TeamMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  bulkCreateMembers: (projectId: string, members: TeamMember[]) => Promise<{ success: boolean; errors: any[]; created: TeamMember[] }>;
  bulkInviteMembers: (members: TeamMember[]) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  roles: [
    {
      id: 'owner',
      name: 'Project Owner',
      description: 'Full project access and management rights',
      scope: 'project'
    },
    {
      id: 'team_manager',
      name: 'Team Manager',
      description: 'Can manage teams and production lines',
      scope: 'line'
    },
    {
      id: 'operator',
      name: 'Operator',
      description: 'Basic production data entry',
      scope: 'machine'
    },
    {
      id: 'quality_technician',
      name: 'Quality Technician',
      description: 'Quality control access',
      scope: 'project'
    },
    {
      id: 'maintenance_technician',
      name: 'Maintenance Technician',
      description: 'Equipment maintenance access',
      scope: 'project'
    }
  ],
  loading: false,
  error: null,

  fetchMembers: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      set({ members: data as TeamMember[], loading: false });
    } catch (error) {
      console.error('Error fetching team members:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchRoles: async () => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('team_roles')
        .select('*');

      if (error) throw error;
      set({ roles: data, loading: false });
    } catch (error) {
      console.error('Error fetching roles:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  createMember: async (projectId, machineId, lineId, memberData) => {
    try {
      set({ loading: true, error: null });

      // Prepare member data based on role
      const data: any = {
        project_id: projectId,
        email: memberData.email,
        role: memberData.role,
        team_name: memberData.team_name,
        working_time_minutes: memberData.working_time_minutes,
        status: 'pending',
        invited_at: new Date().toISOString()
      };

      // Add machine_id only for operators
      if (memberData.role === 'operator' && machineId) {
        data.machine_id = machineId;
      }

      // Add line_id only for team managers
      if (memberData.role === 'team_manager' && lineId) {
        data.line_id = lineId;
      }

      const { data: member, error } = await supabase
        .from('team_members')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      // Send invitation email
      await sendEmail(
        memberData.email!,
        'You\'ve been invited to join a project on Pilot',
        'TEAM_INVITE',
        {
          role: memberData.role,
          inviteUrl: member.id
        }
      );

      set((state) => ({
        members: [...state.members, member as TeamMember],
        loading: false
      }));

      return member as TeamMember;
    } catch (error) {
      console.error('Error creating team member:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateMember: async (id, memberData) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('team_members')
        .update(memberData)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        members: state.members.map(member =>
          member.id === id ? { ...member, ...memberData } : member
        ),
        loading: false
      }));
    } catch (error) {
      console.error('Error updating team member:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteMember: async (id) => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        members: state.members.filter(member => member.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting team member:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  bulkCreateMembers: async (projectId, members) => {
    try {
      set({ loading: true, error: null });

      const errors: any[] = [];
      const created: TeamMember[] = [];

      for (const member of members) {
        try {
          const { data, error } = await supabase
            .from('team_members')
            .insert([{
              ...member,
              project_id: projectId,
              status: 'pending',
              invited_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (error) throw error;
          created.push(data as TeamMember);
        } catch (error) {
          errors.push(error);
        }
      }

      set((state) => ({
        members: [...state.members, ...created],
        loading: false
      }));

      return {
        success: errors.length === 0,
        errors,
        created
      };
    } catch (error) {
      console.error('Error bulk creating team members:', error);
      set({ error: (error as Error).message, loading: false });
      return {
        success: false,
        errors: [error],
        created: []
      };
    }
  },

  bulkInviteMembers: async (members) => {
    try {
      set({ loading: true, error: null });

      // Send invitation emails
      for (const member of members) {
        await sendEmail(
          member.email,
          'You\'ve been invited to join a project on Pilot',
          'TEAM_INVITE',
          {
            role: member.role,
            inviteUrl: member.id
          }
        );

        // Update member status to invited
        await supabase
          .from('team_members')
          .update({ status: 'invited' })
          .eq('id', member.id);
      }

      set({ loading: false });
    } catch (error) {
      console.error('Error inviting team members:', error);
      set({ error: (error as Error).message, loading: false });
    }
  }
}));