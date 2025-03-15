-- Start transaction
BEGIN;

-- ✅ Supprimer la contrainte existante si elle existe
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_project_id_unique;

-- ✅ Ajouter la contrainte UNIQUE sur (project_id)
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_project_id_unique UNIQUE (project_id);

COMMIT;
