-- Start transaction
BEGIN;

-- 1) Supprimer le trigger et la fonction existants
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

-- 2) Créer une nouvelle fonction AVEC ON CONFLICT
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Empêcher le doublon pour team_members
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
  ON CONFLICT (project_id, email, role) DO NOTHING;  -- ✅ Empêche l'erreur "duplicate key"

  -- Empêcher le doublon pour subscriptions
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  )
  ON CONFLICT (project_id) DO NOTHING;  -- ✅ Empêche aussi les doublons

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Recréer le trigger
CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

-- 4) Validation
COMMIT;
