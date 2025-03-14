-- Start transaction
BEGIN;

-- Drop existing project-related policies
DO $$ 
BEGIN
  -- Drop all existing policies
  DROP POLICY IF EXISTS "projects_select" ON projects;
  DROP POLICY IF EXISTS "projects_insert" ON projects;
  DROP POLICY IF EXISTS "projects_update" ON projects;
  DROP POLICY IF EXISTS "projects_delete" ON projects;
  DROP POLICY IF EXISTS "projects_owner_access" ON projects;
  DROP POLICY IF EXISTS "projects_member_access" ON projects;
END $$;

-- Create new simplified policies
CREATE POLICY "projects_owner_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_member_access" ON projects
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

-- Create function to ensure subscription exists
CREATE OR REPLACE FUNCTION ensure_subscription_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (project_id, status, machine_limit)
  VALUES (NEW.id, 'free', 3)
  ON CONFLICT (project_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription creation
DROP TRIGGER IF EXISTS ensure_subscription_exists_trigger ON projects;
CREATE TRIGGER ensure_subscription_exists_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION ensure_subscription_exists();

COMMIT;