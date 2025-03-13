-- Start transaction
BEGIN;

-- First drop ALL existing policies on projects table
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
  DROP POLICY IF EXISTS "owner_full_access" ON projects;
  DROP POLICY IF EXISTS "team_member_read_access" ON projects;
  DROP POLICY IF EXISTS "owner_access" ON projects;
  DROP POLICY IF EXISTS "member_read_access" ON projects;
END $$;

-- Create basic SELECT policy that combines both conditions without nesting
CREATE POLICY "select_access" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

-- Create separate policies for other operations (owner only)
CREATE POLICY "insert_access" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_access" ON projects
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_access" ON projects
FOR DELETE TO authenticated
USING (user_id = auth.uid());

COMMIT;