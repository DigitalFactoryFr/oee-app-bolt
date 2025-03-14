-- Start transaction
BEGIN;

-- Drop existing triggers first
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP TRIGGER IF EXISTS create_project_subscription_trigger ON projects;
DROP TRIGGER IF EXISTS ensure_subscription_exists_trigger ON projects;

-- Create function to handle project creation
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Create owner team member record
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  ) VALUES (
    NEW.id,
    (SELECT email FROM auth.users WHERE id = NEW.user_id),
    'owner',
    'active',
    'Management',
    480
  );

  -- Create subscription
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for project creation
CREATE TRIGGER create_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_owner();

-- Add unique constraints for team member roles
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- Create unique indexes with proper conditions
CREATE UNIQUE INDEX idx_unique_project_member 
ON team_members (project_id, email) 
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

CREATE UNIQUE INDEX idx_unique_machine_operator 
ON team_members (project_id, email, machine_id) 
WHERE role = 'operator';

CREATE UNIQUE INDEX idx_unique_line_manager 
ON team_members (project_id, email, line_id) 
WHERE role = 'team_manager';

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_team_members_role_scope 
ON team_members(role, project_id, email);

CREATE INDEX IF NOT EXISTS idx_team_members_email_status_role 
ON team_members(email, status, role);

CREATE INDEX IF NOT EXISTS idx_team_members_role 
ON team_members(role);

-- Add validation function for team member assignments
CREATE OR REPLACE FUNCTION validate_team_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate role-specific requirements
  CASE NEW.role
    WHEN 'operator' THEN
      IF NEW.machine_id IS NULL THEN
        RAISE EXCEPTION 'Operator must be assigned to a machine';
      END IF;
      IF NEW.line_id IS NOT NULL THEN
        RAISE EXCEPTION 'Operator cannot be assigned to a line';
      END IF;
      
    WHEN 'team_manager' THEN
      IF NEW.line_id IS NULL THEN
        RAISE EXCEPTION 'Team manager must be assigned to a line';
      END IF;
      IF NEW.machine_id IS NOT NULL THEN
        RAISE EXCEPTION 'Team manager cannot be assigned to a machine';
      END IF;
      
    WHEN 'owner' THEN
      IF NEW.machine_id IS NOT NULL OR NEW.line_id IS NOT NULL THEN
        RAISE EXCEPTION 'Owner cannot be assigned to machine or line';
      END IF;
      
    WHEN 'quality_technician' THEN
      IF NEW.machine_id IS NOT NULL OR NEW.line_id IS NOT NULL THEN
        RAISE EXCEPTION 'Quality technician cannot be assigned to machine or line';
      END IF;
      
    WHEN 'maintenance_technician' THEN
      IF NEW.machine_id IS NOT NULL OR NEW.line_id IS NOT NULL THEN
        RAISE EXCEPTION 'Maintenance technician cannot be assigned to machine or line';
      END IF;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for team member validation
DROP TRIGGER IF EXISTS validate_team_member_trigger ON team_members;
CREATE TRIGGER validate_team_member_trigger
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_team_member();

COMMIT;