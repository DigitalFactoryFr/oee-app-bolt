/*
  # Add new team roles

  1. Changes
    - Add 'Team Manager' role
    - Add 'Quality Technician' role
    - Add 'Maintenance Technician' role

  2. Description
    - Adds three new roles to support team management and specialized technical roles
    - Each role has a unique ID and descriptive name
*/

DO $$ 
BEGIN
  -- Add Team Manager role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM team_roles WHERE id = 'team_manager') THEN
    INSERT INTO team_roles (id, name, description)
    VALUES ('team_manager', 'Team Manager', 'Manages team operations and coordinates production activities');
  END IF;

  -- Add Quality Technician role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM team_roles WHERE id = 'quality_technician') THEN
    INSERT INTO team_roles (id, name, description)
    VALUES ('quality_technician', 'Quality Technician', 'Responsible for quality control and inspection processes');
  END IF;

  -- Add Maintenance Technician role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM team_roles WHERE id = 'maintenance_technician') THEN
    INSERT INTO team_roles (id, name, description)
    VALUES ('maintenance_technician', 'Maintenance Technician', 'Handles equipment maintenance and repairs');
  END IF;
END $$;