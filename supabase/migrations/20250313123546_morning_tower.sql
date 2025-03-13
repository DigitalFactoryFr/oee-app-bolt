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
CREATE POLICY "owner_full_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create a separate SELECT-only policy for team members that avoids recursion
CREATE POLICY "team_member_read_access" ON projects
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT DISTINCT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

COMMIT;