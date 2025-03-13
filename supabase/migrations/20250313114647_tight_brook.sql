-- Start transaction
BEGIN;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS has_project_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_user_role(uuid, text) CASCADE;

-- Create function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid 
    AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check user role
CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
DO $$ 
BEGIN
  -- Core tables
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE plant_configs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
  ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  
  -- Production data tables
  ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE lot_tracking ENABLE ROW LEVEL SECURITY;
  ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;
END $$;

-- Drop existing policies first
DO $$ 
BEGIN
  -- Projects
  DROP POLICY IF EXISTS "projects_view_policy" ON projects;
  DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
  DROP POLICY IF EXISTS "projects_update_policy" ON projects;
  DROP POLICY IF EXISTS "projects_delete_policy" ON projects;
  
  -- Team members
  DROP POLICY IF EXISTS "team_members_view_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_manage_policy" ON team_members;
  
  -- Configuration tables
  DROP POLICY IF EXISTS "plant_configs_access_policy" ON plant_configs;
  DROP POLICY IF EXISTS "production_lines_access_policy" ON production_lines;
  DROP POLICY IF EXISTS "machines_access_policy" ON machines;
  DROP POLICY IF EXISTS "products_access_policy" ON products;
  
  -- Production data
  DROP POLICY IF EXISTS "lots_view_policy" ON lots;
  DROP POLICY IF EXISTS "lots_create_policy" ON lots;
  DROP POLICY IF EXISTS "lots_manage_policy" ON lots;
  DROP POLICY IF EXISTS "lot_tracking_access_policy" ON lot_tracking;
  DROP POLICY IF EXISTS "stop_events_view_policy" ON stop_events;
  DROP POLICY IF EXISTS "stop_events_create_policy" ON stop_events;
  DROP POLICY IF EXISTS "stop_events_manage_policy" ON stop_events;
  DROP POLICY IF EXISTS "quality_issues_view_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_issues_create_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_issues_manage_policy" ON quality_issues;
END $$;

-- Create new policies

-- Projects policies
CREATE POLICY "projects_view_policy" ON projects
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

CREATE POLICY "projects_insert_policy" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_policy" ON projects
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete_policy" ON projects
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Team members policies
CREATE POLICY "team_members_view_policy" ON team_members
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "team_members_manage_policy" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
  ) OR check_user_role(project_id, 'team_manager')
);

-- Configuration tables policies
CREATE POLICY "plant_configs_access_policy" ON plant_configs
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "production_lines_access_policy" ON production_lines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "machines_access_policy" ON machines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "products_access_policy" ON products
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Production data policies
CREATE POLICY "lots_view_policy" ON lots
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "lots_create_policy" ON lots
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "lots_manage_policy" ON lots
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "lot_tracking_access_policy" ON lot_tracking
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = lot_tracking.lot_id
    AND has_project_access(lots.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = lot_tracking.lot_id
    AND has_project_access(lots.project_id)
  )
);

CREATE POLICY "stop_events_view_policy" ON stop_events
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "stop_events_create_policy" ON stop_events
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "stop_events_manage_policy" ON stop_events
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "quality_issues_view_policy" ON quality_issues
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "quality_issues_create_policy" ON quality_issues
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "quality_issues_manage_policy" ON quality_issues
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

COMMIT;