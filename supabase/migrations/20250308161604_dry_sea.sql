/*
  # Update team roles structure

  1. Changes
    - Safely updates team_roles table with predefined roles
    - Handles existing data and foreign key constraints
    - Maintains data integrity

  2. Security
    - Ensures RLS is enabled
    - Avoids duplicate policy creation
*/

-- First insert any missing roles to ensure foreign key constraints are satisfied
DO $$ 
BEGIN
  -- Insert roles if they don't exist
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('operator', 'Operator', 'Production line operator with basic data entry permissions')
  ON CONFLICT (id) DO NOTHING;

  -- Update any existing members to use 'operator' role
  UPDATE team_members
  SET role = 'operator'
  WHERE role NOT IN (SELECT id FROM team_roles);

  -- Now we can safely update existing roles and add new ones
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('line_manager', 'Line Manager', 'Manages production lines, teams, and has access to line-specific reports'),
    ('plant_manager', 'Plant Manager', 'Full access to plant configuration and all reports'),
    ('quality_control', 'Quality Control', 'Manages quality control processes and quality-related reports'),
    ('maintenance', 'Maintenance', 'Handles equipment maintenance and stop events'),
    ('admin', 'Administrator', 'Full system access including user management')
  ON CONFLICT (id) DO UPDATE 
  SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;
END $$;

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'team_roles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policy if it exists and create new one
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view roles" ON team_roles;
  
  CREATE POLICY "Anyone can view roles" ON team_roles
    FOR SELECT
    TO authenticated
    USING (true);
END $$;