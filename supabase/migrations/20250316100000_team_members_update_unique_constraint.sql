CREATE OR REPLACE FUNCTION can_access_project(pid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- exécute la fonction avec les droits du propriétaire (ex. l'admin)
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM team_members
    WHERE team_members.project_id = pid
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
  )
  OR EXISTS(
    SELECT 1 FROM projects
    WHERE projects.id = pid
      AND projects.user_id = auth.uid()
  );
END;
$$;

-- Ensuite, la policy sur projects devient :
CREATE POLICY project_access
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    can_access_project(id)
  );
