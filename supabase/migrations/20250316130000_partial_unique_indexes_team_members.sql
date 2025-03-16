BEGIN;

-- 1) Supprimer les anciennes contraintes uniques éventuelles
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_unique,
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_machine_unique;

-- 2) Créer des index uniques partiels
-- A) Operators : (project_id, email, role, machine_id) UNIQUE quand role='operator'
CREATE UNIQUE INDEX IF NOT EXISTS team_members_operator_unique_idx
  ON team_members (project_id, email, role, machine_id)
  WHERE role = 'operator';

-- B) Team managers : (project_id, email, role, line_id) UNIQUE quand role='team_manager'
CREATE UNIQUE INDEX IF NOT EXISTS team_members_manager_unique_idx
  ON team_members (project_id, email, role, line_id)
  WHERE role = 'team_manager';

-- C) Autres rôles : (project_id, email, role) UNIQUE quand role n'est pas operator/manager
CREATE UNIQUE INDEX IF NOT EXISTS team_members_others_unique_idx
  ON team_members (project_id, email, role)
  WHERE role NOT IN ('operator','team_manager');

COMMIT;
