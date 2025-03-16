-- 🔹 Supprimer les anciens index qui posent problème
DROP INDEX IF EXISTS team_members_project_email_role_unique;
DROP INDEX IF EXISTS team_members_project_email_role_machine_unique;
DROP INDEX IF EXISTS team_members_project_email_role_line_unique;
DROP INDEX IF EXISTS team_members_unique_idx;

-- 🔹 Appliquer la contrainte de remplissage automatique avec 'ALL' si machine_id ou line_id est NULL
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS machine_id_text TEXT DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS line_id_text TEXT DEFAULT 'ALL';

UPDATE team_members
SET machine_id_text = COALESCE(machine_id::TEXT, 'ALL'),
    line_id_text = COALESCE(line_id::TEXT, 'ALL');

-- 🔹 Création de l'index unique sur les 5 colonnes
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_idx
ON team_members (project_id, email, role, machine_id_text, line_id_text);
