-- Start transaction
BEGIN;

-- Drop and recreate team_roles table with proper structure
DROP TABLE IF EXISTS team_roles CASCADE;
 
CREATE TABLE team_roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('project', 'line', 'machine', 'none'))
);

-- Insert predefined roles with proper scopes
INSERT INTO team_roles (id, name, description, scope) VALUES
  ('owner', 'Project Owner', 'Full project access and management rights', 'project'),
  ('team_manager', 'Team Manager', 'Can manage teams and production lines', 'line'),
  ('operator', 'Operator', 'Basic production data entry', 'machine'),
  ('quality_technician', 'Quality Technician', 'Quality control access', 'project'),
  ('maintenance_technician', 'Maintenance Technician', 'Equipment maintenance access', 'project');

-- Enable RLS
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing roles
CREATE POLICY "Anyone can view roles"
  ON team_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Update team_members table constraints
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_assignments_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_assignments_check
CHECK (
  (role = 'operator' AND machine_id IS NOT NULL AND line_id IS NULL) OR
  (role = 'team_manager' AND line_id IS NOT NULL AND machine_id IS NULL) OR
  (role IN ('owner', 'quality_technician', 'maintenance_technician') AND machine_id IS NULL AND line_id IS NULL)
);

COMMIT;