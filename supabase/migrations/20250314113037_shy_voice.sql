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
  DROP POLICY IF EXISTS "owner_access" ON projects;
  DROP POLICY IF EXISTS "member_read_access" ON projects;
  DROP POLICY IF EXISTS "select_access" ON projects;
  DROP POLICY IF EXISTS "insert_access" ON projects;
  DROP POLICY IF EXISTS "update_access" ON projects;
  DROP POLICY IF EXISTS "delete_access" ON projects;
  DROP POLICY IF EXISTS "owner_full_access" ON projects;
  DROP POLICY IF EXISTS "team_member_read_access" ON projects;
END $$;

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

-- Create non-recursive policies for projects
CREATE POLICY "owner_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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

-- Create function to create owner team member
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Get user email directly from auth.jwt() to avoid users table access
  v_user_email := auth.email();
  
  -- Create owner team member record
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  ) VALUES (
    NEW.id,
    v_user_email,
    'owner',
    'active',
    'Management',
    480
  );

  -- Create subscription
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project creation
CREATE TRIGGER create_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_owner();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;