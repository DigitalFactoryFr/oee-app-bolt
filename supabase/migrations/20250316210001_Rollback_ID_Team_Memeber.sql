-- 🟢 Démarrer une transaction pour éviter les erreurs partielles
BEGIN;

-- 1️⃣ TEAM_MEMBERS : Supprimer les anciens indexes et contraintes uniques
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_project_email_role_machine_unique;

-- 2️⃣ Ajouter une **nouvelle** contrainte UNIQUE simplifiée
ALTER TABLE team_members
  ADD CONSTRAINT team_members_project_email_role_unique
  UNIQUE (project_id, email, role);

-- 3️⃣ SUBSCRIPTIONS : Unicité sur `project_id`
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_project_id_unique;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_project_id_unique
  UNIQUE (project_id);

-- 4️⃣ PROJECTS : Unicité sur `id`
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_id_unique;

ALTER TABLE projects
  ADD CONSTRAINT projects_id_unique
  UNIQUE (id);

-- 🟢 Valider la transaction
COMMIT;
