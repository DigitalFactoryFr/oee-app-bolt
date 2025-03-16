import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailService';
import type { TeamMember, ProjectRole } from '../types';

interface DuplicatesResult {
  email: string;
  existing: TeamMember;
  new: Partial<TeamMember>;
}

interface ImportResult {
  duplicates: DuplicatesResult[];
  created: TeamMember[];
}

interface TeamState {
  members: TeamMember[];
  roles: {
    id: ProjectRole;
    name: string;
    description: string;
    scope: 'project' | 'line' | 'machine' | 'none';
  }[];
  loading: boolean;
  error: string | null;

  fetchMembers: (projectId: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  createMember: (
    projectId: string,
    machineId: string | null,
    lineId: string | null,
    data: Partial<TeamMember>
  ) => Promise<TeamMember | null>;
  updateMember: (id: string, data: Partial<TeamMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  bulkCreateMembers: (projectId: string, membersToImport: TeamMember[]) => Promise<ImportResult>;
  bulkUpdateMembers: (updates: Array<{ id: string } & Partial<TeamMember>>) => Promise<void>;
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
    } catch (err) {
      console.error('Error fetching team members:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRoles: async () => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase.from('team_roles').select('*');
      if (error) throw error;
      set({ roles: data, loading: false });
    } catch (err) {
      console.error('Error fetching roles:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

  createMember: async (projectId, machineId, lineId, memberData) => {
    try {
      set({ loading: true, error: null });
      const insertData: Partial<TeamMember> = {
        project_id: projectId,
        email: memberData.email,
        role: memberData.role,
        team_name: memberData.team_name,
        working_time_minutes: memberData.working_time_minutes,
        status: 'pending',
        invited_at: new Date().toISOString()
      };
      if (memberData.role === 'operator' && machineId) {
        insertData.machine_id = machineId;
      }
      if (memberData.role === 'team_manager' && lineId) {
        insertData.line_id = lineId;
      }
      const { data, error } = await supabase
        .from('team_members')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      await sendEmail(
        memberData.email!,
        'You have been invited to join a project on Pilot',
        'TEAM_INVITE',
        {
          role: memberData.role,
          inviteUrl: data.id
        }
      );
      set((state) => ({
        members: [...state.members, data as TeamMember],
        loading: false
      }));
      return data as TeamMember;
    } catch (err) {
      console.error('Error creating team member:', err);
      set({ error: (err as Error).message, loading: false });
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
        members: state.members.map((member) =>
          member.id === id ? { ...member, ...memberData } : member
        ),
        loading: false
      }));
    } catch (err) {
      console.error('Error updating team member:', err);
      set({ error: (err as Error).message, loading: false });
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
        members: state.members.filter((m) => m.id !== id),
        loading: false
      }));
    } catch (err) {
      console.error('Error deleting team member:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

bulkCreateMembers: async (projectId, membersToImport) => {
  try {
    set({ loading: true, error: null });

    // Récupérer les membres existants pour le projet
    const { data: existingMembers, error: existingErr } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId);
    if (existingErr) throw existingErr;
    const existingMap = new Map<string, TeamMember>();
    (existingMembers ?? []).forEach((member: TeamMember) => {
      if (member.email) {
        existingMap.set(member.email.toLowerCase().trim(), member);
      }
    });

    // Récupérer les machines et les production lines pour le projet
    const { data: machinesData, error: machinesError } = await supabase
      .from('machines')
      .select('id, name')
      .eq('project_id', projectId);
    if (machinesError) throw machinesError;
    const { data: linesData, error: linesError } = await supabase
      .from('production_lines')
      .select('id, name')
      .eq('project_id', projectId);
    if (linesError) throw linesError;

    // Construire des maps pour les recherches rapides
    const machinesMap = new Map<string, string>();
    machinesData?.forEach((machine) => {
      machinesMap.set(machine.name.trim().toLowerCase(), machine.id);
    });
    const linesMap = new Map<string, string>();
    linesData?.forEach((line) => {
      linesMap.set(line.name.trim().toLowerCase(), line.id);
    });

    const duplicates: Array<{
      email: string;
      existing: TeamMember;
      new: Partial<TeamMember>;
    }> = [];
    const created: TeamMember[] = [];
    const errorsArray: Array<{ row: number; message: string }> = [];

    // Parcourir les membres à importer
    for (let i = 0; i < membersToImport.length; i++) {
      const newMember = membersToImport[i];

      // Vérifier la présence d'un email
      if (!newMember.email) {
        errorsArray.push({ row: i + 2, message: `Email is required` });
        continue;
      }
      const lowerEmail = newMember.email.toLowerCase().trim();
      if (existingMap.has(lowerEmail)) {
        duplicates.push({
          email: newMember.email,
          existing: existingMap.get(lowerEmail)!,
          new: {
            role: newMember.role,
            team_name: newMember.team_name,
            working_time_minutes: newMember.working_time_minutes,
          },
        });
        continue;
      }

      const insertData: any = {
        project_id: projectId,
        email: newMember.email,
        role: newMember.role,
        team_name: newMember.team_name,
        working_time_minutes: newMember.working_time_minutes,
        status: 'pending',
        invited_at: new Date().toISOString(),
      };

      // Pour les opérateurs : vérifier que machine_name est renseigné et correspondante
      if (newMember.role === 'operator') {
        const machineName = newMember.machine_name ? newMember.machine_name.trim().toLowerCase() : '';
        if (!machineName) {
          errorsArray.push({ row: i + 2, message: `Operator ${newMember.email} must be assigned to a machine` });
          continue;
        }
        const machineId = machinesMap.get(machineName);
        if (!machineId) {
          errorsArray.push({
            row: i + 2,
            message: `Machine "${newMember.machine_name.trim()}" not found for operator ${newMember.email}`,
          });
          continue;
        }
        insertData.machine_id = machineId;
      }

      // Pour les team managers : vérifier que line_name est renseigné et correspondante
      if (newMember.role === 'team_manager') {
        const lineName = newMember.line_name ? newMember.line_name.trim().toLowerCase() : '';
        if (!lineName) {
          errorsArray.push({ row: i + 2, message: `Team manager ${newMember.email} must be assigned to a production line` });
          continue;
        }
        let lineId = linesMap.get(lineName);
        // Tentative de correspondance partielle si aucune correspondance exacte n'est trouvée
        if (!lineId) {
          for (const [key, id] of linesMap.entries()) {
            if (key.includes(lineName) || lineName.includes(key)) {
              lineId = id;
              break;
            }
          }
        }
        if (!lineId) {
          errorsArray.push({
            row: i + 2,
            message: `Production line "${newMember.line_name.trim()}" not found for team manager ${newMember.email}`,
          });
          continue;
        }
        insertData.line_id = lineId;
      }

      // Insertion du membre dans la base
      const { data, error } = await supabase
        .from('team_members')
        .insert([insertData])
        .select()
        .single();
      if (error) {
        errorsArray.push({ row: i + 2, message: error.message });
        continue;
      }
      const createdMember = data as TeamMember;
      created.push(createdMember);
      existingMap.set(lowerEmail, createdMember);
    }

    // Mise à jour de l'état local
    set((state) => ({
      members: [...state.members, ...created],
      loading: false,
      error: null,
    }));

    return { duplicates, created, errors: errorsArray };
  } catch (err) {
    console.error('Error in bulkCreateMembers:', err);
    set({ error: (err as Error).message, loading: false });
    throw err;
  }
},



  bulkUpdateMembers: async (updates) => {
    try {
      set({ loading: true, error: null });
      for (const upd of updates) {
        const { error } = await supabase
          .from('team_members')
          .update(upd)
          .eq('id', upd.id);
        if (error) throw error;
      }
      set((state) => ({
        members: state.members.map((existing) => {
          const updatedData = updates.find((u) => u.id === existing.id);
          return updatedData ? { ...existing, ...updatedData } : existing;
        }),
        loading: false,
        error: null
      }));
    } catch (err) {
      console.error('Error bulk updating members:', err);
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  bulkInviteMembers: async (members) => {
    try {
      set({ loading: true, error: null });
      for (const member of members) {
        await sendEmail(
          member.email,
          'You have been invited to join a project on Pilot',
          'TEAM_INVITE',
          {
            role: member.role,
            inviteUrl: member.id
          }
        );
        await supabase
          .from('team_members')
          .update({ status: 'invited' })
          .eq('id', member.id);
      }
      set({ loading: false });
    } catch (err) {
      console.error('Error inviting team members:', err);
      set({ error: (err as Error).message, loading: false });
    }
  }
}));
