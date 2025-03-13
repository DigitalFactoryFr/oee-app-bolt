import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailService';
import type { TeamMember, TeamRole, TeamExcelData } from '../types';

interface ImportResult {
  success: boolean;
  duplicates: Array<{
    email: string;
    existing: TeamMember;
    new: Partial<TeamMember>;
  }>;
  created: TeamMember[];
}

interface TeamState {
  members: TeamMember[];
  roles: TeamRole[];
  loading: boolean;
  error: string | null;
  fetchMembers: (projectId: string) => Promise<TeamMember[]>;
  fetchRoles: () => Promise<void>;
  createMember: (projectId: string, machineId: string, data: Partial<TeamMember>) => Promise<TeamMember | null>;
  updateMember: (id: string, data: Partial<TeamMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  bulkCreateMembers: (projectId: string, members: TeamExcelData[]) => Promise<ImportResult>;
  bulkUpdateMembers: (updates: Array<{ id: string } & Partial<TeamMember>>) => Promise<void>;
  bulkInviteMembers: (members: TeamMember[]) => Promise<void>;
  findMemberByEmail: (projectId: string, email: string) => Promise<TeamMember | null>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  roles: [],
  loading: false,
  error: null,

  fetchMembers: async (projectId) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const members = data as TeamMember[];
      set({ members, loading: false });
      return members;
    } catch (error) {
      console.error('Error fetching team members:', error);
      set({ error: (error as Error).message, loading: false });
      return [];
    }
  },

  findMemberByEmail: async (projectId, email) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId)
        .ilike('email', email)
        .maybeSingle();

      if (error) throw error;
      return data as TeamMember | null;
    } catch (error) {
      console.error('Error finding team member:', error);
      return null;
    }
  },

  fetchRoles: async () => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('team_roles')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      set({ roles: data as TeamRole[], loading: false });
    } catch (error) {
      console.error('Error fetching team roles:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  createMember: async (projectId, machineId, memberData) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('team_members')
        .insert([{
          project_id: projectId,
          machine_id: machineId,
          status: 'pending',
          ...memberData
        }])
        .select()
        .single();

      if (error) throw error;

      const newMember = data as TeamMember;

      // Send invitation email
      await sendEmail(
        newMember.email,
        'You\'ve been invited to join a team on Pilot',
        'TEAM_INVITE',
        {
          projectName: projectId,
          role: newMember.role,
          inviteUrl: `https://i40pilot.app/invite/${newMember.id}`
        }
      );

      set((state) => ({
        members: [...state.members, newMember],
        loading: false
      }));

      return newMember;
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
      throw error;
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
      throw error;
    }
  },

  bulkCreateMembers: async (projectId, members) => {
    try {
      set({ loading: true, error: null });
      console.log("🚀 Starting bulk team member creation...");

      // Get all machines for this project
      const { data: machines, error: machinesError } = await supabase
        .from('machines')
        .select('id, name')
        .eq('project_id', projectId);

      if (machinesError) throw machinesError;

      if (!machines || machines.length === 0) {
        throw new Error('No machines found for this project');
      }

      // Get all existing members
      const { data: existingMembers, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      // Create maps for quick lookup
      const machinesByName = new Map(machines.map(machine => [machine.name.toLowerCase(), machine]));
      const existingMembersByEmail = new Map(
        existingMembers?.map(member => [member.email.toLowerCase(), member]) || []
      );

      // Prepare results
      const duplicates: Array<{
        email: string;
        existing: TeamMember;
        new: Partial<TeamMember>;
      }> = [];
      const created: TeamMember[] = [];

      // Process each member
      for (const member of members) {
        const machine = machinesByName.get(member.machine_name.toLowerCase());
        
        if (!machine) {
          throw new Error(`Machine "${member.machine_name}" not found`);
        }

        const existingMember = existingMembersByEmail.get(member.email.toLowerCase());

        if (existingMember) {
          duplicates.push({
            email: member.email,
            existing: existingMember,
            new: {
              role: member.role,
              team_name: member.team_name,
              machine_id: machine.id,
              working_time_minutes: member.working_time_minutes,
            }
          });
        } else {
          const { data, error } = await supabase
            .from('team_members')
            .insert([{
              project_id: projectId,
              machine_id: machine.id,
              email: member.email.toLowerCase(),
              role: member.role,
              team_name: member.team_name,
              working_time_minutes: member.working_time_minutes,
              status: 'pending',
              invited_at: null,
              joined_at: null
            }])
            .select()
            .single();

          if (error) throw error;
          if (data) created.push(data as TeamMember);
        }
      }

      // Update local state
      if (created.length > 0) {
        set((state) => ({
          members: [...state.members, ...created],
          loading: false
        }));
      }

      return {
        success: true,
        duplicates,
        created
      };

    } catch (error) {
      console.error('Error in bulkCreateMembers:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkUpdateMembers: async (updates) => {
    try {
      set({ loading: true, error: null });

      for (const update of updates) {
        const { error } = await supabase
          .from('team_members')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      set((state) => ({
        members: state.members.map(existingMember => {
          const update = updates.find(u => u.id === existingMember.id);
          return update ? { ...existingMember, ...update } : existingMember;
        }),
        loading: false
      }));
    } catch (error) {
      console.error('Error bulk updating team members:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  bulkInviteMembers: async (members) => {
    try {
      set({ loading: true, error: null });

      const updates = members.map(member => ({
        id: member.id,
        status: 'invited',
        invited_at: new Date().toISOString()
      }));

      await get().bulkUpdateMembers(updates);

      // Send invitation emails
      for (const member of members) {
        await sendEmail(
          member.email,
          'You\'ve been invited to join a team on Pilot',
          'TEAM_INVITE',
          {
            projectName: member.project_id,
            role: member.role,
            inviteUrl: `https://i40pilot.app/invite/${member.id}`
          }
        );
      }

    } catch (error) {
      console.error('Error inviting team members:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  }
}));