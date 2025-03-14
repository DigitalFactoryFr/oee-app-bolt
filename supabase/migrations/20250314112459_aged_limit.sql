-- Start transaction
BEGIN;

-- Drop existing constraints if they exist
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_project_member;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_machine_operator;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_line_manager;

-- Create unique indexes with conditions
CREATE UNIQUE INDEX unique_project_member 
ON team_members (project_id, email) 
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

CREATE UNIQUE INDEX unique_machine_operator 
ON team_members (project_id, email, machine_id) 
WHERE role = 'operator';

CREATE UNIQUE INDEX unique_line_manager 
ON team_members (project_id, email, line_id) 
WHERE role = 'team_manager';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_role_scope 
ON team_members(role, project_id, email);

-- Add indexes for email lookups
CREATE INDEX IF NOT EXISTS idx_team_members_email_status_role 
ON team_members(email, status, role);

-- Add indexes for role-based queries
CREATE INDEX IF NOT EXISTS idx_team_members_role 
ON team_members(role);

COMMIT;