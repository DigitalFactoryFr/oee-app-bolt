BEGIN;

-- Ajout d'une contrainte unique sur (user_id, name) dans la table projects
ALTER TABLE projects
  ADD CONSTRAINT projects_user_id_name_unique UNIQUE (user_id, name);

COMMIT;
