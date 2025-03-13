-- Start transaction
BEGIN;

-- Drop existing policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "projects_select" ON projects;
  DROP POLICY IF EXISTS "projects_insert" ON projects;
  DROP POLICY IF EXISTS "projects_update" ON projects;
  DROP POLICY IF EXISTS "projects_delete" ON projects;
  DROP POLICY IF EXISTS "projects_manage_policy" ON projects;
END $$;

-- Create simplified policies for projects
CREATE POLICY "projects_select" ON projects
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

CREATE POLICY "projects_insert" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update" ON projects
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete" ON projects
FOR DELETE TO authenticated
USING (user_id = auth.uid());

COMMIT;