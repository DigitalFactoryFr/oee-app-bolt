BEGIN;

-- Supprimer d'éventuelles contraintes uniques globales existantes
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_unique,
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_machine_unique;

-- Créer un index unique partiel pour les opérateurs :
-- Un opérateur est unique pour une combinaison de (project_id, email, role, machine_id)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_operator_unique_idx
  ON team_members (project_id, email, role, machine_id)
  WHERE role = 'operator';

-- Créer un index unique partiel pour les team managers :
-- Un team manager est unique pour une combinaison de (project_id, email, role, line_id)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_manager_unique_idx
  ON team_members (project_id, email, role, line_id)
  WHERE role = 'team_manager';

-- Créer un index unique partiel pour les autres rôles :
-- Les autres rôles (ex. owner, quality, maintenance, etc.) sont uniques sur (project_id, email, role)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_others_unique_idx
  ON team_members (project_id, email, role)
  WHERE role NOT IN ('operator', 'team_manager');

COMMIT;
