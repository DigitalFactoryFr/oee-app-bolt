-- Start transaction
BEGIN;

-- ✅ Vérifier et ajouter la colonne scope si elle n'existe pas
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS scope TEXT;

-- ✅ Supprimer l'ancienne contrainte si elle existe
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_project_member;

-- ✅ Ajouter une nouvelle contrainte UNIQUE incluant scope
ALTER TABLE team_members 
ADD CONSTRAINT unique_project_member 
UNIQUE (project_id, email, role, scope);

-- ✅ Validation des modifications
COMMIT;
