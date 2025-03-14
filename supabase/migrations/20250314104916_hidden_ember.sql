-- Start transaction
BEGIN;

-- Drop ALL existing policies on projects table
DO $$ 
BEGIN
  -- Drop any policy that might exist on the projects table
  DROP POLICY IF EXISTS "projects_select" ON projects;
  DROP POLICY IF EXISTS "projects_insert" ON projects;
  DROP POLICY IF EXISTS "projects_update" ON projects;
  DROP POLICY IF EXISTS "projects_delete" ON projects;
  DROP POLICY IF EXISTS "projects_manage_policy" ON projects;
  DROP POLICY IF EXISTS "projects_view" ON projects;
  DROP POLICY IF EXISTS "projects_team_view" ON projects;
  DROP POLICY IF EXISTS "projects_owner_access" ON projects;
  DROP POLICY IF EXISTS "projects_member_access" ON projects;
  DROP POLICY IF EXISTS "projects_member_or_owner_select" ON projects;
  DROP POLICY IF EXISTS "projects_owner_insert" ON projects;
  DROP POLICY IF EXISTS "projects_owner_update" ON projects;
  DROP POLICY IF EXISTS "projects_owner_delete" ON projects;
  DROP POLICY IF EXISTS "projects_owner_all" ON projects;
  DROP POLICY IF EXISTS "projects_team_select" ON projects;
END $$;

-- Create a single policy for project owners
CREATE POLICY "owner_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create a separate SELECT-only policy for team members that avoids recursion
CREATE POLICY "member_read_access" ON projects
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
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