/*
  # Fix Project Owner Access Control

  1. Changes
    - Add project owner check to all access functions
    - Ensure project owners have full access to their projects
    - Keep super admin role for system-wide administration
    - Update policies to check for project ownership

  2. Security
    - Project owners have full access to their projects
    - Super admins maintain system-wide access
    - Team-based permissions remain intact
*/

-- Start transaction
BEGIN;

-- Function to check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update project access function to include owner check
CREATE OR REPLACE FUNCTION has_project_access(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    is_project_owner(project_id) OR -- Project owner has full access
    is_super_admin(project_id) OR -- Super admin for system-wide access
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

-- Update role check function to include owner check
CREATE OR REPLACE FUNCTION check_user_role(project_id uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    is_project_owner(project_id) OR -- Project owner has all roles
    is_super_admin(project_id) OR -- Super admin has all roles
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

-- Update team members policies
CREATE OR REPLACE POLICY "team_members_manage_policy" ON team_members
FOR ALL TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
);

-- Update configuration access policies
CREATE OR REPLACE POLICY "plant_config_access_policy" ON plant_configs
FOR ALL TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
);

CREATE OR REPLACE POLICY "lines_access_policy" ON production_lines
FOR ALL TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
)
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'team_manager')
);

-- Update data access policies
CREATE OR REPLACE POLICY "lots_manage_policy" ON lots
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'operator') OR
  check_user_role(project_id, 'team_manager')
);

CREATE OR REPLACE POLICY "stops_manage_policy" ON stop_events
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'operator') OR
  check_user_role(project_id, 'maintenance_technician') OR
  check_user_role(project_id, 'team_manager')
);

CREATE OR REPLACE POLICY "quality_manage_policy" ON quality_issues
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  check_user_role(project_id, 'operator') OR
  check_user_role(project_id, 'quality_technician') OR
  check_user_role(project_id, 'team_manager')
);

COMMIT;