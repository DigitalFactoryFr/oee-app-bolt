-- 🟢 Démarrer une transaction pour éviter les erreurs partielles
BEGIN;

-- 1️⃣ TEAM_MEMBERS : Supprimer les contraintes existantes avant recréation
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_unique;

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_machine_unique;

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_line_unique;

DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- 2️⃣ Ajouter une **contrainte UNIQUE simple** (comme avant)
ALTER TABLE team_members
  ADD CONSTRAINT team_members_project_email_role_unique
  UNIQUE (project_id, email, role);

-- 3️⃣ Supprimer les entrées invalides (si plusieurs machines/lignes existent)
DELETE FROM team_members
WHERE id NOT IN (
    SELECT DISTINCT ON (project_id, email, role) id
    FROM team_members
    WHERE role IN ('operator', 'team_manager')
    ORDER BY project_id, email, role, id
);

-- 4️⃣ Vérifier et rétablir les contraintes sur les machines et lignes
ALTER TABLE machines
  DROP CONSTRAINT IF EXISTS machines_project_id_unique;
ALTER TABLE machines
  ADD CONSTRAINT machines_project_id_unique
  UNIQUE (id, project_id);

ALTER TABLE production_lines
  DROP CONSTRAINT IF EXISTS production_lines_project_id_unique;
ALTER TABLE production_lines
  ADD CONSTRAINT production_lines_project_id_unique
  UNIQUE (id, project_id);

-- 🟢 Valider la transaction
COMMIT;
