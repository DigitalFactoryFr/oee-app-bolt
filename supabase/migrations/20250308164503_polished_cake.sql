/*
  # Update team roles and add access policies

  1. Changes
    - Updates team_roles table with new roles
    - Adds RLS policies for each role
    - Sets up role-based access control for all tables

  2. Roles Updated
    - operator: Basic production data entry
    - team_manager: Team and production management
    - quality_technician: Quality control and analysis
    - maintenance_technician: Equipment maintenance and repairs

  3. Access Control
    - Defines granular access permissions per role
    - Implements row-level security policies
    - Sets up hierarchical access structure
*/

-- Start transaction to ensure data consistency
BEGIN;

-- First update any existing team members to use 'operator' role as fallback
UPDATE team_members 
SET role = 'operator' 
WHERE role NOT IN ('operator', 'team_manager', 'quality_technician', 'maintenance_technician');

-- Now we can safely update the roles
DO $$ 
BEGIN
  -- Delete roles that aren't in our new set
  DELETE FROM team_roles 
  WHERE id NOT IN (
    'operator',
    'team_manager',
    'quality_technician',
    'maintenance_technician'
  );

  -- Insert or update the roles we want to keep
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('operator', 'Operator', 'Basic production data entry and monitoring'),
    ('team_manager', 'Team Manager', 'Team supervision and production management'),
    ('quality_technician', 'Quality Technician', 'Quality control and analysis'),
    ('maintenance_technician', 'Maintenance Technician', 'Equipment maintenance and repairs')
  ON CONFLICT (id) DO UPDATE 
  SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;
END $$;

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

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Lots policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Operators can create lots') THEN
    DROP POLICY "Operators can create lots" ON lots;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can update lots') THEN
    DROP POLICY "Team managers can update lots" ON lots;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view lots in their projects') THEN
    DROP POLICY "Users can view lots in their projects" ON lots;
  END IF;

  -- Stop events policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Operators can create stops') THEN
    DROP POLICY "Operators can create stops" ON stop_events;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Maintenance can manage stops') THEN
    DROP POLICY "Maintenance can manage stops" ON stop_events;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view stops in their projects') THEN
    DROP POLICY "Users can view stops in their projects" ON stop_events;
  END IF;

  -- Quality issues policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Quality techs can manage quality issues') THEN
    DROP POLICY "Quality techs can manage quality issues" ON quality_issues;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Operators can create quality issues') THEN
    DROP POLICY "Operators can create quality issues" ON quality_issues;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view quality issues in their projects') THEN
    DROP POLICY "Users can view quality issues in their projects" ON quality_issues;
  END IF;

  -- Machine policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Maintenance can manage machines') THEN
    DROP POLICY "Maintenance can manage machines" ON machines;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view machines in their projects') THEN
    DROP POLICY "Users can view machines in their projects" ON machines;
  END IF;

  -- Team member policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can manage team members') THEN
    DROP POLICY "Team managers can manage team members" ON team_members;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view team members in their projects') THEN
    DROP POLICY "Users can view team members in their projects" ON team_members;
  END IF;

  -- Product policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can manage products') THEN
    DROP POLICY "Team managers can manage products" ON products;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view products in their projects') THEN
    DROP POLICY "Users can view products in their projects" ON products;
  END IF;
END $$;

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
CREATE POLICY "Team managers can manage team members" ON team_members
FOR ALL TO authenticated
USING (check_user_role(project_id, 'team_manager'))
WITH CHECK (check_user_role(project_id, 'team_manager'));

CREATE POLICY "Users can view team members in their projects" ON team_members
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members tm2
  WHERE tm2.project_id = team_members.project_id
  AND tm2.email = auth.email()
  AND tm2.status = 'active'
));

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