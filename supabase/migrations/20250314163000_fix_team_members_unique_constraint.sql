-- Start transaction
BEGIN;

-- ✅ Supprimer les anciennes contraintes si elles existent
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- ✅ Ajouter une nouvelle contrainte UNIQUE pour résoudre l'erreur ON CONFLICT
ALTER TABLE team_members 
ADD CONSTRAINT unique_project_member UNIQUE (project_id, email, role);

ALTER TABLE team_members 
ADD CONSTRAINT unique_machine_operator UNIQUE (project_id, email, machine_id, role);

ALTER TABLE team_members 
ADD CONSTRAINT unique_line_manager UNIQUE (project_id, email, line_id, role);

-- ✅ Vérification et correction de la fonction `create_project_owner`
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si cet utilisateur est déjà owner sur ce projet spécifique
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  ) VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    'Management',
    480
  )
  ON CONFLICT (project_id, email, role) DO NOTHING;

  -- ✅ Création automatique d'un abonnement pour le projet
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  ) ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Suppression de l'ancien trigger et création d'un nouveau
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;

CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

-- ✅ Validation des changements
COMMIT;
