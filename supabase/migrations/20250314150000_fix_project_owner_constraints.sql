-- Start transaction
BEGIN;

-- ✅ Suppression de l'ancien trigger et de la fonction associée s'ils existent déjà
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

-- ✅ Création d'une nouvelle fonction pour gérer l'ajout automatique du Project Owner
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

-- ✅ Ajout du trigger pour créer automatiquement un owner à la création d’un projet
CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

-- ✅ Vérification et suppression des contraintes en double sur team_members
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- ✅ Création des nouvelles contraintes uniques avec correction des conditions
CREATE UNIQUE INDEX idx_unique_project_member 
ON team_members (project_id, email, role) 
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

CREATE UNIQUE INDEX idx_unique_machine_operator 
ON team_members (project_id, email, machine_id) 
WHERE role = 'operator';

CREATE UNIQUE INDEX idx_unique_line_manager 
ON team_members (project_id, email, line_id) 
WHERE role = 'team_manager';

-- ✅ Validation des changements
COMMIT;
