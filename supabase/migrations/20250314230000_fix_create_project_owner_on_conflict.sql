-- 20250314220000_update_create_project_owner.sql
BEGIN;

DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
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

  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  )
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

COMMIT;
