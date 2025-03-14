-- Start transaction
BEGIN;

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop team_members policies
  DROP POLICY IF EXISTS "team_members_select" ON team_members;
  DROP POLICY IF EXISTS "team_members_insert" ON team_members;
  DROP POLICY IF EXISTS "team_members_update" ON team_members;
  DROP POLICY IF EXISTS "team_members_delete" ON team_members;
  
  -- Drop projects policies
  DROP POLICY IF EXISTS "projects_select" ON projects;
  DROP POLICY IF EXISTS "projects_insert" ON projects;
  DROP POLICY IF EXISTS "projects_update" ON projects;
  DROP POLICY IF EXISTS "projects_delete" ON projects;
  DROP POLICY IF EXISTS "projects_owner_all" ON projects;
  DROP POLICY IF EXISTS "projects_team_select" ON projects;
  DROP POLICY IF EXISTS "select_access" ON projects;
  DROP POLICY IF EXISTS "insert_access" ON projects;
  DROP POLICY IF EXISTS "update_access" ON projects;
  DROP POLICY IF EXISTS "delete_access" ON projects;
END $$;

-- Create simplified policies for projects
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

-- Create simplified policies for team_members
CREATE POLICY "team_members_owner_access" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "team_members_self_view" ON team_members
FOR SELECT TO authenticated
USING (email = auth.email());

COMMIT;