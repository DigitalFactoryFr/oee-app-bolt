-- Start transaction
BEGIN;

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop all existing policies
  DROP POLICY IF EXISTS "projects_owner_access" ON projects;
  DROP POLICY IF EXISTS "projects_member_access" ON projects;
  DROP POLICY IF EXISTS "team_members_owner_access" ON team_members;
  DROP POLICY IF EXISTS "team_members_self_view" ON team_members;
END $$;

-- Create non-recursive policies for projects
CREATE POLICY "projects_owner_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_member_access" ON projects
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

-- Create non-recursive policies for team_members
CREATE POLICY "team_members_owner_access" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = team_members.project_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = team_members.project_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "team_members_member_access" ON team_members
FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
  ) OR
  email = auth.email()
);

COMMIT;