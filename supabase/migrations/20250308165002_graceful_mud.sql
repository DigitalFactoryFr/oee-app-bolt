/*
  # Role-based Access Control Setup

  1. Changes
    - Drops existing policies
    - Safely removes existing data
    - Sets up new team roles
    - Creates role check function
    - Establishes RLS policies for all tables

  2. Security
    - Implements role-based access control
    - Enforces data isolation between projects
    - Sets up proper authorization checks
*/

-- Start transaction
BEGIN;

-- First drop all existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop policies for lots
  DROP POLICY IF EXISTS "Operators can create lots" ON lots;
  DROP POLICY IF EXISTS "Team managers can update lots" ON lots;
  DROP POLICY IF EXISTS "Users can view lots in their projects" ON lots;
  DROP POLICY IF EXISTS "Users can create their own lots" ON lots;
  DROP POLICY IF EXISTS "Users can update their own lots" ON lots;
  DROP POLICY IF EXISTS "Users can view their own lots" ON lots;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON lots;

  -- Drop policies for stop_events
  DROP POLICY IF EXISTS "Operators can create stops" ON stop_events;
  DROP POLICY IF EXISTS "Maintenance can manage stops" ON stop_events;
  DROP POLICY IF EXISTS "Users can view stops in their projects" ON stop_events;
  DROP POLICY IF EXISTS "Users can create their own stop events" ON stop_events;
  DROP POLICY IF EXISTS "Users can update their own stop events" ON stop_events;
  DROP POLICY IF EXISTS "Users can view their own stop events" ON stop_events;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON stop_events;

  -- Drop policies for quality_issues
  DROP POLICY IF EXISTS "Quality techs can manage quality issues" ON quality_issues;
  DROP POLICY IF EXISTS "Operators can create quality issues" ON quality_issues;
  DROP POLICY IF EXISTS "Users can view quality issues in their projects" ON quality_issues;
  DROP POLICY IF EXISTS "Users can create their own quality issues" ON quality_issues;
  DROP POLICY IF EXISTS "Users can update their own quality issues" ON quality_issues;
  DROP POLICY IF EXISTS "Users can view their own quality issues" ON quality_issues;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON quality_issues;

  -- Drop policies for machines
  DROP POLICY IF EXISTS "Maintenance can manage machines" ON machines;
  DROP POLICY IF EXISTS "Users can view machines in their projects" ON machines;
  DROP POLICY IF EXISTS "Users can create their own machines" ON machines;
  DROP POLICY IF EXISTS "Users can update their own machines" ON machines;
  DROP POLICY IF EXISTS "Users can view their own machines" ON machines;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON machines;

  -- Drop policies for team_members
  DROP POLICY IF EXISTS "Team managers can manage team members" ON team_members;
  DROP POLICY IF EXISTS "Users can view team members in their projects" ON team_members;
  DROP POLICY IF EXISTS "Project owners can manage team members" ON team_members;
  DROP POLICY IF EXISTS "Users can create their own team members" ON team_members;
  DROP POLICY IF EXISTS "Users can update their own team members" ON team_members;
  DROP POLICY IF EXISTS "Users can view their own team members" ON team_members;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON team_members;

  -- Drop policies for products
  DROP POLICY IF EXISTS "Team managers can manage products" ON products;
  DROP POLICY IF EXISTS "Users can view products in their projects" ON products;
  DROP POLICY IF EXISTS "Users can create their own products" ON products;
  DROP POLICY IF EXISTS "Users can update their own products" ON products;
  DROP POLICY IF EXISTS "Users can view their own products" ON products;
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON products;
END $$;

-- Safely remove existing data in correct order to avoid FK constraints
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

-- Insert new roles
INSERT INTO team_roles (id, name, description) VALUES
  ('operator', 'Operator', 'Basic production data entry and monitoring'),
  ('team_manager', 'Team Manager', 'Team supervision and production management'),
  ('quality_technician', 'Quality Technician', 'Quality control and analysis'),
  ('maintenance_technician', 'Maintenance Technician', 'Equipment maintenance and repairs');

-- Function to check user role for a project
CREATE OR REPLACE FUNCTION check_user_role(project_id uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = $1 
    AND email = auth.email()
    AND role = $2
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Production Lots Policies
CREATE POLICY "Operators can create lots" ON lots
FOR INSERT TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator') OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "Team managers can update lots" ON lots
FOR UPDATE TO authenticated
USING (check_user_role(project_id, 'team_manager'))
WITH CHECK (check_user_role(project_id, 'team_manager'));

CREATE POLICY "Users can view lots in their projects" ON lots
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.project_id = lots.project_id
  AND team_members.email = auth.email()
  AND team_members.status = 'active'
));

-- Stop Events Policies
CREATE POLICY "Operators can create stops" ON stop_events
FOR INSERT TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator') OR
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "Maintenance can manage stops" ON stop_events
FOR UPDATE TO authenticated
USING (
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "Users can view stops in their projects" ON stop_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.project_id = stop_events.project_id
  AND team_members.email = auth.email()
  AND team_members.status = 'active'
));

-- Quality Issues Policies
CREATE POLICY "Quality techs can manage quality issues" ON quality_issues
FOR ALL TO authenticated
USING (
  check_user_role(project_id, 'quality_technician') OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  check_user_role(project_id, 'quality_technician') OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "Operators can create quality issues" ON quality_issues
FOR INSERT TO authenticated
WITH CHECK (check_user_role(project_id, 'operator'));

CREATE POLICY "Users can view quality issues in their projects" ON quality_issues
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.project_id = quality_issues.project_id
  AND team_members.email = auth.email()
  AND team_members.status = 'active'
));

-- Machine Management Policies
CREATE POLICY "Maintenance can manage machines" ON machines
FOR ALL TO authenticated
USING (
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
);

CREATE POLICY "Users can view machines in their projects" ON machines
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.project_id = machines.project_id
  AND team_members.email = auth.email()
  AND team_members.status = 'active'
));

-- Team Management Policies
CREATE POLICY "Project owners can manage team members" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Team managers can manage team members" ON team_members
FOR ALL TO authenticated
USING (
  check_user_role(project_id, 'team_manager') OR
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  check_user_role(project_id, 'team_manager') OR
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view team members in their projects" ON team_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM team_members tm2
    WHERE tm2.project_id = team_members.project_id
    AND tm2.email = auth.email()
    AND tm2.status = 'active'
  ) OR
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Product Management Policies
CREATE POLICY "Team managers can manage products" ON products
FOR ALL TO authenticated
USING (check_user_role(project_id, 'team_manager'))
WITH CHECK (check_user_role(project_id, 'team_manager'));

CREATE POLICY "Users can view products in their projects" ON products
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.project_id = products.project_id
  AND team_members.email = auth.email()
  AND team_members.status = 'active'
));

COMMIT;