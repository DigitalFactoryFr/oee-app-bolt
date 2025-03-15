-- Start transaction
BEGIN;

-- 🔥 Supprimer l'ancienne contrainte si elle existe
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_project_member;

-- ✅ Ajouter une colonne temporaire pour une valeur par défaut sur machine_id et line_id
ALTER TABLE team_members ADD COLUMN temp_machine_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE team_members ADD COLUMN temp_line_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- ✅ Remplir les valeurs pour éviter les NULL
UPDATE team_members 
SET temp_machine_id = COALESCE(machine_id, '00000000-0000-0000-0000-000000000000'),
    temp_line_id = COALESCE(line_id, '00000000-0000-0000-0000-000000000000');

-- ✅ Appliquer la contrainte UNIQUE sur les nouvelles colonnes
ALTER TABLE team_members 
ADD CONSTRAINT unique_project_member UNIQUE (project_id, email, role, temp_machine_id, temp_line_id);

-- ✅ Supprimer les colonnes temporaires
ALTER TABLE team_members DROP COLUMN temp_machine_id;
ALTER TABLE team_members DROP COLUMN temp_line_id;

-- ✅ Validation des modifications
COMMIT;
