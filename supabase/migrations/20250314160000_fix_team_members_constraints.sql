-- Start transaction
BEGIN;

-- ✅ Suppression des contraintes existantes pour éviter les conflits
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- ✅ Ajout des nouvelles contraintes uniques correctement définies
CREATE UNIQUE INDEX idx_unique_project_member 
ON team_members (project_id, email, role) 
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

CREATE UNIQUE INDEX idx_unique_machine_operator 
ON team_members (project_id, email, machine_id) 
WHERE role = 'operator';

CREATE UNIQUE INDEX idx_unique_line_manager 
ON team_members (project_id, email, line_id) 
WHERE role = 'team_manager';

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
