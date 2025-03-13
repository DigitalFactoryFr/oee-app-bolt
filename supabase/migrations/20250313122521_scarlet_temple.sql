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
END $$;

-- Create a single SELECT policy that combines both conditions
CREATE POLICY "projects_member_or_owner_select" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() -- Project owner
  OR 
  id IN ( -- Team member
    SELECT DISTINCT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

-- Create separate policies for other operations (owner only)
CREATE POLICY "projects_owner_insert" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_owner_update" ON projects
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_owner_delete" ON projects
FOR DELETE TO authenticated
USING (user_id = auth.uid());

COMMIT;