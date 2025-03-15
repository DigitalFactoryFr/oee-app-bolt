-- Start transaction
BEGIN;

-- ✅ Supprimer l'ancienne contrainte si elle existe
ALTER TABLE projects DROP CONSTRAINT IF EXISTS unique_project_id;

-- ✅ Ajouter une contrainte UNIQUE sur `id`
ALTER TABLE projects ADD CONSTRAINT unique_project_id UNIQUE (id);

-- ✅ Vérifier si une autre clé unique est nécessaire
ALTER TABLE projects DROP CONSTRAINT IF EXISTS unique_project_name;
ALTER TABLE projects ADD CONSTRAINT unique_project_name UNIQUE (name);

-- ✅ Validation des modifications
COMMIT;
