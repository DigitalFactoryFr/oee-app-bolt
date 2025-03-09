/*
  # Fix Role Permissions

  1. Changes
    - Adds super_admin role with full access
    - Fixes operator permissions
    - Properly restricts configuration access
    - Implements correct role hierarchy
    
  2. Security
    - Enforces proper access control
    - Prevents unauthorized configuration changes
    - Maintains data integrity
*/

-- Start transaction
BEGIN;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "team_members_view_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;

-- Update team roles to include super_admin
TRUNCATE team_roles CASCADE;
INSERT INTO team_roles (id, name, description) VALUES
  ('super_admin', 'Super Administrator', 'Full system access and configuration rights'),
  ('team_manager', 'Team Manager', 'Team supervision and production management'),
  ('operator', 'Operator', 'Basic production data entry and monitoring'),
  ('quality_technician', 'Quality Technician', 'Quality control and analysis'),
  ('maintenance_technician', 'Maintenance Technician', 'Equipment maintenance and repairs');

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = $1 
    AND email = auth.email()
    AND role = 'super_admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has configuration access
CREATE OR REPLACE FUNCTION has_config_access(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = $1 
    AND email = auth.email()
    AND role IN ('super_admin', 'team_manager')
    AND status = 'active'
  ) OR EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = $1 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Plant Configuration Policies
DROP POLICY IF EXISTS "plant_config_access_policy" ON plant_configs;
CREATE POLICY "plant_config_access_policy" ON plant_configs
FOR ALL TO authenticated
USING (has_config_access(project_id))
WITH CHECK (has_config_access(project_id));

-- Production Lines Policies
DROP POLICY IF EXISTS "lines_access_policy" ON production_lines;
CREATE POLICY "lines_access_policy" ON production_lines
FOR ALL TO authenticated
USING (has_config_access(project_id))
WITH CHECK (has_config_access(project_id));

-- Machines Policies
DROP POLICY IF EXISTS "machines_access_policy" ON machines;
CREATE POLICY "machines_access_policy" ON machines
FOR ALL TO authenticated
USING (has_config_access(project_id))
WITH CHECK (has_config_access(project_id));

-- Products Policies
DROP POLICY IF EXISTS "products_access_policy" ON products;
CREATE POLICY "products_access_policy" ON products
FOR ALL TO authenticated
USING (has_config_access(project_id))
WITH CHECK (has_config_access(project_id));

-- Team Members Policies
CREATE POLICY "team_members_view_policy" ON team_members
FOR SELECT TO authenticated
USING (
  has_config_access(project_id) OR
  email = auth.email()
);

CREATE POLICY "team_members_manage_policy" ON team_members
FOR ALL TO authenticated
USING (has_config_access(project_id))
WITH CHECK (has_config_access(project_id));

-- Projects Policies
DROP POLICY IF EXISTS "projects_access_policy" ON projects;
CREATE POLICY "projects_manage_policy" ON projects
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = projects.id 
    AND email = auth.email()
    AND role = 'super_admin'
    AND status = 'active'
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = projects.id 
    AND email = auth.email()
    AND role = 'super_admin'
    AND status = 'active'
  )
);

-- Lots Policies
DROP POLICY IF EXISTS "lots_access_policy" ON lots;
CREATE POLICY "lots_view_policy" ON lots
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 
  FROM team_members
  WHERE project_id = lots.project_id
  AND email = auth.email()
  AND status = 'active'
));

CREATE POLICY "lots_manage_policy" ON lots
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = lots.project_id
    AND email = auth.email()
    AND role IN ('operator', 'team_manager', 'super_admin')
    AND status = 'active'
  )
);

CREATE POLICY "lots_update_policy" ON lots
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = lots.project_id
    AND email = auth.email()
    AND role IN ('team_manager', 'super_admin')
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = lots.project_id
    AND email = auth.email()
    AND role IN ('team_manager', 'super_admin')
    AND status = 'active'
  )
);

-- Stop Events Policies
DROP POLICY IF EXISTS "stops_access_policy" ON stop_events;
CREATE POLICY "stops_view_policy" ON stop_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 
  FROM team_members
  WHERE project_id = stop_events.project_id
  AND email = auth.email()
  AND status = 'active'
));

CREATE POLICY "stops_create_policy" ON stop_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = stop_events.project_id
    AND email = auth.email()
    AND role IN ('operator', 'maintenance_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
);

CREATE POLICY "stops_update_policy" ON stop_events
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = stop_events.project_id
    AND email = auth.email()
    AND role IN ('maintenance_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = stop_events.project_id
    AND email = auth.email()
    AND role IN ('maintenance_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
);

-- Quality Issues Policies
DROP POLICY IF EXISTS "quality_access_policy" ON quality_issues;
CREATE POLICY "quality_view_policy" ON quality_issues
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 
  FROM team_members
  WHERE project_id = quality_issues.project_id
  AND email = auth.email()
  AND status = 'active'
));

CREATE POLICY "quality_create_policy" ON quality_issues
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = quality_issues.project_id
    AND email = auth.email()
    AND role IN ('operator', 'quality_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
);

CREATE POLICY "quality_manage_policy" ON quality_issues
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = quality_issues.project_id
    AND email = auth.email()
    AND role IN ('quality_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members
    WHERE project_id = quality_issues.project_id
    AND email = auth.email()
    AND role IN ('quality_technician', 'team_manager', 'super_admin')
    AND status = 'active'
  )
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;

COMMIT;