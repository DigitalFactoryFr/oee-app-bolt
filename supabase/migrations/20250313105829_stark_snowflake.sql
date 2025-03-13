-- Start transaction
BEGIN;

-- Drop existing policies first
DO $$ 
BEGIN
  -- Drop all existing policies
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON projects;
  DROP POLICY IF EXISTS "projects_access_policy" ON projects;
  DROP POLICY IF EXISTS "projects_manage_policy" ON projects;
  DROP POLICY IF EXISTS "lots_view_policy" ON lots;
  DROP POLICY IF EXISTS "lots_create_policy" ON lots;
  DROP POLICY IF EXISTS "lots_manage_policy" ON lots;
  DROP POLICY IF EXISTS "stops_view_policy" ON stop_events;
  DROP POLICY IF EXISTS "stops_create_policy" ON stop_events;
  DROP POLICY IF EXISTS "stops_manage_policy" ON stop_events;
  DROP POLICY IF EXISTS "quality_view_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_create_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_manage_policy" ON quality_issues;
  DROP POLICY IF EXISTS "team_members_view_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_manage_policy" ON team_members;
END $$;

-- Create helper function to check user role
CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = project_uuid 
    AND email = auth.email()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_uuid 
    AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects policies
CREATE POLICY "projects_view" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

CREATE POLICY "projects_manage" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Configuration tables policies
CREATE POLICY "plant_configs_view" ON plant_configs 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "plant_configs_manage" ON plant_configs 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
    ) OR check_user_role(project_id, 'team_manager')
  )
);

-- Production lines policies
CREATE POLICY "production_lines_view" ON production_lines 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "production_lines_manage" ON production_lines 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
    ) OR check_user_role(project_id, 'team_manager')
  )
);

-- Machines policies
CREATE POLICY "machines_view" ON machines 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "machines_manage" ON machines 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
    ) OR check_user_role(project_id, 'team_manager')
  )
);

-- Lots policies
CREATE POLICY "lots_view" ON lots 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "lots_create" ON lots 
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "lots_manage" ON lots 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND
  check_user_role(project_id, 'team_manager')
);

-- Stop events policies
CREATE POLICY "stops_view" ON stop_events 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "stops_create" ON stop_events 
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "stops_manage" ON stop_events 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

-- Quality issues policies
CREATE POLICY "quality_view" ON quality_issues 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "quality_create" ON quality_issues 
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "quality_manage" ON quality_issues 
FOR ALL TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

-- Team members policies
CREATE POLICY "team_members_view" ON team_members 
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "team_members_manage" ON team_members 
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
  ) OR check_user_role(project_id, 'team_manager')
);

COMMIT;