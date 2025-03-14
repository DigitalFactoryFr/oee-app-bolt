-- Start transaction
BEGIN;

-- Drop existing roles
TRUNCATE team_roles CASCADE;

-- Insert new roles
INSERT INTO team_roles (id, name, description) VALUES
  ('owner', 'Project Owner', 'Full project access and management rights'),
  ('manager', 'Project Manager', 'Can manage team and production operations'),
  ('operator', 'Operator', 'Basic data entry and monitoring'),
  ('quality', 'Quality Control', 'Quality management access'),
  ('maintenance', 'Maintenance', 'Equipment maintenance access');

-- Update existing team members to use new roles
UPDATE team_members
SET role = 'operator'
WHERE role NOT IN ('owner', 'manager', 'operator', 'quality', 'maintenance');

-- Create function to check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND role = 'owner'
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

-- Create function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;