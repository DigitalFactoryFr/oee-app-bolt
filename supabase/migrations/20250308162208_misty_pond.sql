/*
  # Update team roles structure

  1. Changes
    - Updates role names to use consistent terminology
    - Uses "Manager" consistently for leadership roles
    - Simplifies maintenance role to "Maintenance Manager"
    - Clarifies hierarchy and responsibilities

  2. Security
    - Ensures RLS is enabled
    - Maintains proper policy configuration
*/

-- First insert any missing roles to ensure foreign key constraints are satisfied
DO $$ 
BEGIN
  -- Insert operator role if it doesn't exist
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('operator', 'Operator', 'Production line operator responsible for data entry and basic operations')
  ON CONFLICT (id) DO NOTHING;

  -- Update any existing members to use 'operator' role
  UPDATE team_members
  SET role = 'operator'
  WHERE role NOT IN (SELECT id FROM team_roles);

  -- Now we can safely update existing roles and add new ones
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('line_manager', 'Line Manager', 'Supervises production lines, manages teams, and accesses line performance reports'),
    ('plant_manager', 'Plant Manager', 'Oversees plant operations, configurations, and has access to all plant-level reports'),
    ('quality_manager', 'Quality Manager', 'Manages quality control processes, standards, and quality-related reporting'),
    ('maintenance_manager', 'Maintenance Manager', 'Manages equipment maintenance, repairs, and oversees maintenance team')
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