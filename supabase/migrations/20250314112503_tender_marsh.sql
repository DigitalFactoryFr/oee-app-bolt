-- Start transaction
BEGIN;

-- Create function to automatically create owner team member
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create owner when project is created
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
CREATE TRIGGER create_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_owner();

-- Create function to validate team member assignments
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