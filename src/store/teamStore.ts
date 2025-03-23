import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailService';
import type { TeamMember, ProjectRole } from '../types';
import { useProjectStore } from '../store/projectStore';

/** Doublon : "existing" est en base, "new" = nouvelles données */
interface DuplicatesResult {
  email: string;
  existing: TeamMember;
  new: Partial<TeamMember>;
}

/** Résultat de bulkCreateMembers (méthode existante) */
interface ImportResult {
  duplicates: DuplicatesResult[];
  created: TeamMember[];
  errors: Array<{ row: number; message: string }>;
}

/** Résultat du "dry run" (bulkCheckMembers) */
interface CheckResult {
  newInserts: TeamMember[];
  duplicates: DuplicatesResult[];
  errors: Array<{ row: number; message: string }>;
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

  // Méthodes de base
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

  // Méthodes d'import existantes
  bulkCreateMembers: (projectId: string, membersToImport: TeamMember[]) => Promise<ImportResult>;
  bulkUpdateMembers: (updates: Array<{ id: string } & Partial<TeamMember>>) => Promise<void>;
  bulkInviteMembers: (members: TeamMember[]) => Promise<void>;

  // Nouvelles méthodes (dry run + confirm)
  bulkCheckMembers: (projectId: string, membersToImport: TeamMember[]) => Promise<CheckResult>;
  bulkConfirmImport: (projectId: string, checkResult: CheckResult) => Promise<void>;
}

/**
 * Construit une clé unique :
 * - (email + role + machine_id) si operator
 * - (email + role + line_id) si team_manager
 * - (email + role) sinon
 */

const { currentProject } = useProjectStore.getState();
function buildUniqueKey(member: TeamMember): string {
  const lowerEmail = (member.email || '').toLowerCase().trim();
  const rolePart = member.role || '';

  if (member.role === 'operator' && member.machine_id) {
    return `${lowerEmail}__${rolePart}__${member.machine_id}`;
  }
  if (member.role === 'team_manager' && member.line_id) {
    return `${lowerEmail}__${rolePart}__${member.line_id}`;
  }
  return `${lowerEmail}__${rolePart}`;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  roles: [
    {
      id: 'owner',
      name: 'Project Owner',
      description: 'Full project access and management rights',
      scope: 'project',
    },
    {
      id: 'team_manager',
      name: 'Team Manager',
      description: 'Can manage teams and production lines',
      scope: 'line',
    },
    {
      id: 'operator',
      name: 'Operator',
      description: 'Basic production data entry',
      scope: 'machine',
    },
    {
      id: 'quality_technician',
      name: 'Quality Technician',
      description: 'Quality control access',
      scope: 'project',
    },
    {
      id: 'maintenance_technician',
      name: 'Maintenance Technician',
      description: 'Equipment maintenance access',
      scope: 'project',
    },
  ],
  loading: false,
  error: null,

  // ================================
  // Méthodes de base
  // ================================

  async fetchMembers(projectId) {
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

  async fetchRoles() {
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

  
  async createMember(projectId, machineId, lineId, memberData) {
  try {
    set({ loading: true, error: null });
    const insertData: Partial<TeamMember> = {
      project_id: projectId,
      email: memberData.email,
      role: memberData.role,
      team_name: memberData.team_name,
      working_time_minutes: memberData.working_time_minutes,
      status: 'pending', // Initialement en "pending"
      invited_at: new Date().toISOString(),
      machine_id: machineId || null,
      line_id: lineId || null,
    };
    const { data, error } = await supabase
      .from('team_members')
      .insert([insertData])
      .select()
      .single();
    if (error) throw error;

    
    const { currentProject } = useProjectStore.getState();

    // Envoi de l'email d'invitation
    const emailSuccess = await sendEmail(
      memberData.email!,
      'You have been invited to join a project on Pilot',
      'TEAM_INVITE',
      {
        role: memberData.role,
        inviteUrl: data.id, // On utilise l'ID du membre créé
        projectName: currentProject ? currentProject.name : 'this project',
 team_name: member.team_name, // Remplacer memberData.team_name par member.team_name
      }
    );

    // Si l'email est envoyé avec succès, mettre à jour le statut à "invited"
    if (emailSuccess) {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ status: 'invited' })
        .eq('id', data.id);
      if (updateError) {
        console.error("Error updating status to 'invited':", updateError);
      } else {
        // Mise à jour de l'état local pour refléter le changement
        set((state) => ({
          members: [...state.members, { ...data, status: 'invited' } as TeamMember],
          loading: false,
        }));
      }
    } else {
      // Si l'email n'a pas été envoyé, on garde le statut "pending"
      set((state) => ({
        members: [...state.members, data as TeamMember],
        loading: false,
      }));
    }
    return data as TeamMember;
  } catch (err) {
    console.error('Error creating team member:', err);
    set({ error: (err as Error).message, loading: false });
    return null;
  }
},


  async updateMember(id, memberData) {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('team_members')
        .update(memberData)
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        members: state.members.map((m) =>
          m.id === id ? { ...m, ...memberData } : m
        ),
        loading: false,
      }));
    } catch (err) {
      console.error('Error updating team member:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

  async deleteMember(id) {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        members: state.members.filter((m) => m.id !== id),
        loading: false,
      }));
    } catch (err) {
      console.error('Error deleting team member:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

  // ================================
  // Méthodes d'import existantes
  // ================================

  async bulkCreateMembers(projectId, membersToImport) {
    // ... inchangé ...
    throw new Error('bulkCreateMembers not shown for brevity');
  },

  async bulkUpdateMembers(updates) {
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
        members: state.members.map((m) => {
          const updatedData = updates.find((u) => u.id === m.id);
          return updatedData ? { ...m, ...updatedData } : m;
        }),
        loading: false,
        error: null,
      }));
    } catch (err) {
      console.error('Error bulk updating members:', err);
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async bulkInviteMembers(members) {
    try {
      set({ loading: true, error: null });
      for (const member of members) {
        // Envoi d'email

        const { currentProject } = useProjectStore.getState();
        await sendEmail(
          member.email,
          'You have been invited to join a project on Pilot',
          'TEAM_INVITE',
          {
            role: member.role,
            inviteUrl: member.id,
    projectName: currentProject ? currentProject.name : 'this project',
    team_name: member.team_name, // Remplacer memberData.team_name par member.team_name
  
          }
        );
        // Mettre à jour le statut
        await supabase
          .from('team_members')
          .update({ status: 'invited' })
          .eq('id', member.id);
      }
      // Mettre à jour local
      set((state) => ({
        members: state.members.map((m) =>
          members.find((u) => u.id === m.id) ? { ...m, status: 'invited' } : m
        ),
        loading: false,
      }));
    } catch (err) {
      console.error('Error inviting team members:', err);
      set({ error: (err as Error).message, loading: false });
    }
  },

  // ============================================
  // NOUVELLES MÉTHODES : "dry run" + confirmation
  // ============================================

  async bulkCheckMembers(projectId, membersToImport) {
    if (!projectId) {
      throw new Error('projectId is undefined');
    }
    try {
      set({ loading: true, error: null });

      // 1) Récupérer les membres existants
      const { data: existingMembers, error: existingErr } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', projectId);
      if (existingErr) throw existingErr;

      // 2) Récupérer machines & lines
      const { data: machinesData } = await supabase
        .from('machines')
        .select('id, name')
        .eq('project_id', projectId);

      const { data: linesData } = await supabase
        .from('production_lines')
        .select('id, name')
        .eq('project_id', projectId);

      // Construire les maps pour le lookup
      const machinesMap = new Map<string, string>();
      (machinesData ?? []).forEach((m) => {
        machinesMap.set(m.name.trim().toLowerCase(), m.id);
      });

      const linesMap = new Map<string, string>();
      (linesData ?? []).forEach((l) => {
        linesMap.set(l.name.trim().toLowerCase(), l.id);
      });

      // 3) Construire un set des emails importés pour ignorer les membres hors Excel
      const importedEmails = new Set(
        membersToImport.map((m) => (m.email || '').toLowerCase().trim())
      );

      // 4) Map "existant" : key => TeamMember
      const existingMap = new Map<string, TeamMember>();
      (existingMembers ?? []).forEach((m) => {
        const key = buildUniqueKey(m);
        existingMap.set(key, m);
      });

      const newInserts: TeamMember[] = [];
      const duplicates: DuplicatesResult[] = [];
      const errors: Array<{ row: number; message: string }> = [];

      // 5) Parcourir la liste importée
      for (let i = 0; i < membersToImport.length; i++) {
        const rowIndex = i + 2;
        const mem = membersToImport[i];

        // Vérifier l'email
        if (!mem.email) {
          errors.push({ row: rowIndex, message: 'Email is required' });
          continue;
        }

        const lowerEmail = mem.email.toLowerCase().trim();

        // Si operator => machine_name -> machine_id
        if (mem.role === 'operator') {
          const machineName = (mem.machine_name || '').trim().toLowerCase();
          if (!machineName) {
            errors.push({
              row: rowIndex,
              message: `Operator ${mem.email} must be assigned to a machine`,
            });
            continue;
          }
          const foundMachineId = machinesMap.get(machineName);
          if (!foundMachineId) {
            errors.push({
              row: rowIndex,
              message: `Machine "${mem.machine_name}" not found for operator ${mem.email}`,
            });
            continue;
          }
          mem.machine_id = foundMachineId;
        }

        // Si team_manager => line_name -> line_id
        if (mem.role === 'team_manager') {
          const lineName = (mem.line_name || '').trim().toLowerCase();
          if (!lineName) {
            errors.push({
              row: rowIndex,
              message: `Team manager ${mem.email} must be assigned to a production line`,
            });
            continue;
          }
          const foundLineId = linesMap.get(lineName);
          if (!foundLineId) {
            errors.push({
              row: rowIndex,
              message: `Line "${mem.line_name}" not found for team manager ${mem.email}`,
            });
            continue;
          }
          mem.line_id = foundLineId;
        }

        // Construire la clé => (email + role + machine_id/line_id)
        const uniqueKey = buildUniqueKey(mem);

        // Vérifier si c'est un doublon
        if (existingMap.has(uniqueKey)) {
          const existingMember = existingMap.get(uniqueKey)!;
          // Ne considérer comme "duplicate" que si l'email est dans le fichier
          if (importedEmails.has(lowerEmail)) {
            // Optionnel : exclure le owner (si on ne veut pas le modifier)
            if (existingMember.role !== 'owner') {
              duplicates.push({
                email: mem.email,
                existing: existingMember,
                new: {
                  role: mem.role,
                  team_name: mem.team_name,
                  working_time_minutes: mem.working_time_minutes,
                  machine_id: mem.machine_id,
                  line_id: mem.line_id,
                },
              });
            }
          }
        } else {
          newInserts.push(mem);
        }
      }

      set({ loading: false, error: null });
      return { newInserts, duplicates, errors };
    } catch (err) {
      console.error('Error in bulkCheckMembers:', err);
      set({ loading: false, error: (err as Error).message });
      return { newInserts: [], duplicates: [], errors: [] };
    }
  },

async bulkConfirmImport(projectId, checkResult) {
  if (!projectId) {
    throw new Error('projectId is not defined');
  }
  try {
    set({ loading: true, error: null });

    const { newInserts, duplicates } = checkResult;

    // Créer un ensemble des emails importés (en minuscules)
    const importedEmails = new Set<string>([
      ...newInserts.map(m => (m.email || '').toLowerCase().trim()),
      ...duplicates.map(d => d.email.toLowerCase().trim()),
    ]);

    // A) Insérer les nouveaux membres avec status 'pending'
    for (const mem of newInserts) {
      // Ici, on s'assure d'utiliser projectId pour la colonne project_id
      const insertData: Partial<TeamMember> = {
        project_id: projectId, // assignation correcte
        email: mem.email,
        role: mem.role,
        team_name: mem.team_name,
        working_time_minutes: mem.working_time_minutes,
        status: 'pending', // statut fixe à pending pour les nouveaux membres
        invited_at: new Date().toISOString(),
        machine_id: mem.machine_id || null,
        line_id: mem.line_id || null,
      };

      const { data, error } = await supabase
        .from('team_members')
        .insert([insertData])
        .select()
        .single();
      if (error) {
        console.error('Insert error for new member:', error);
        continue;
      }
      set((state) => ({
        members: [...state.members, data as TeamMember],
      }));
    }

    // B) Mettre à jour les doublons (uniquement pour les membres présents dans l'import)
    if (duplicates.length > 0) {
      const updates = duplicates.map((dup) => ({
        id: dup.existing.id,
        role: dup.new.role,
        team_name: dup.new.team_name,
        working_time_minutes: dup.new.working_time_minutes,
        // On ne modifie pas le statut pour ne pas changer les membres déjà actifs
      }));
      await get().bulkUpdateMembers(updates);
    }

    // C) Re-fetch final data et envoyer les invitations uniquement si ≤ 30 membres importés
    const { data: finalData } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId);
    if (finalData) {
      set({ members: finalData as TeamMember[] });
      const membersToInvite = (finalData as TeamMember[]).filter((m) =>
        importedEmails.has((m.email || '').toLowerCase().trim())
      );
      if (membersToInvite.length <= 30) {
        await get().bulkInviteMembers(membersToInvite);
      } else {
        console.log(
          `Bulk import: ${membersToInvite.length} members imported, skipping automatic invitations.`
        );
      }
    }

    set({ loading: false, error: null });
  } catch (err) {
    console.error('Error in bulkConfirmImport:', err);
    set({ error: (err as Error).message, loading: false });
  }
}



}));
