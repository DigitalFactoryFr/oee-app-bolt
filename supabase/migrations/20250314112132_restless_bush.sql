-- Start transaction
BEGIN;

-- Drop existing constraints if they exist
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_project_member;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_machine_operator;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_line_manager;

-- Assure uniqueness of project-level roles (owner, quality_technician, maintenance_technician)
ALTER TABLE team_members 
ADD CONSTRAINT unique_project_member UNIQUE (project_id, email)
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

-- Assure uniqueness of operators on a specific machine
ALTER TABLE team_members 
ADD CONSTRAINT unique_machine_operator UNIQUE (project_id, email, machine_id)
WHERE role = 'operator';

-- Assure uniqueness of team managers on a specific line
ALTER TABLE team_members 
ADD CONSTRAINT unique_line_manager UNIQUE (project_id, email, line_id)
WHERE role = 'team_manager';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_role_scope ON team_members(role, project_id, email);

COMMIT;