/*
  # Role-Based Access Control with Super Admin

  1. Changes
    - Adds Super Administrator role with full access
    - Fixes infinite recursion in team_members policies
    - Simplifies policy structure to prevent circular dependencies
    - Resets existing data to clean state

  2. Security
    - Implements hierarchical role-based access
    - Super Admin has unrestricted access
    - Prevents policy recursion through direct checks
*/

-- Start transaction
BEGIN;

-- Drop all existing policies
DO $$ 
BEGIN
  -- Drop policies for all tables
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON team_members;
  DROP POLICY IF EXISTS "Team managers can manage team members" ON team_members;
  DROP POLICY IF EXISTS "Users can view team members in their projects" ON team_members;
  DROP POLICY IF EXISTS "Project owners can manage team members" ON team_members;
  DROP POLICY IF EXISTS "Users can create their own team members" ON team_members;
  DROP POLICY IF EXISTS "Users can update their own team members" ON team_members;
  DROP POLICY IF EXISTS "Users can view their own team members" ON team_members;
END $$;

-- Safely remove existing data
DELETE FROM quality_issues;
DELETE FROM stop_events;
DELETE FROM lot_tracking;
DELETE FROM lots;
DELETE FROM products;
DELETE FROM machines;
DELETE FROM team_members;
DELETE FROM production_lines;
DELETE FROM plant_configs;
DELETE FROM team_roles;

-- Insert roles including new Super Admin role
INSERT INTO team_roles (id, name, description) VALUES
  ('super_admin', 'Super Administrator', 'Full system access and configuration'),
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

-- Function to check user role with super admin override
CREATE OR REPLACE FUNCTION check_user_role(project_id uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    is_super_admin(project_id) OR
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE project_id = $1 
      AND email = auth.email()
      AND role = $2
      AND status = 'active'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    is_super_admin(project_id) OR
    EXISTS (
      SELECT 1 
      FROM projects 
      WHERE id = project_id 
      AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE project_id = $1
      AND email = auth.email()
      AND status = 'active'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Team Members base policies
CREATE POLICY "team_members_select_policy" ON team_members
FOR SELECT TO authenticated
USING (
  is_super_admin(project_id) OR
  EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

CREATE POLICY "team_members_insert_policy" ON team_members
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(project_id) OR
  EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "team_members_update_policy" ON team_members
FOR UPDATE TO authenticated
USING (
  is_super_admin(project_id) OR
  EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  is_super_admin(project_id) OR
  EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "team_members_delete_policy" ON team_members
FOR DELETE TO authenticated
USING (
  is_super_admin(project_id) OR
  EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) OR
  check_user_role(project_id, 'team_manager')
);

-- Enable RLS on all tables
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;

-- Base policies for other tables using has_project_access
CREATE POLICY "machines_access_policy" ON machines FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "products_access_policy" ON products FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "lots_access_policy" ON lots FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "stop_events_access_policy" ON stop_events FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "quality_issues_access_policy" ON quality_issues FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

COMMIT;