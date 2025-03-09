/*
  # Simplify team roles structure

  1. Changes
    - Reduces roles to only essential ones
    - Keeps structure simple and clear
    - Updates all existing members to valid roles

  2. Security
    - Maintains RLS
    - Updates policies
*/

DO $$ 
BEGIN
  -- First ensure operator role exists for foreign key constraints
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('operator', 'Operator', 'Production line operator')
  ON CONFLICT (id) DO NOTHING;

  -- Update existing members to operator role
  UPDATE team_members
  SET role = 'operator'
  WHERE role NOT IN ('operator', 'line_manager', 'plant_manager');

  -- Update to simplified role structure
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('line_manager', 'Line Manager', 'Production line supervisor'),
    ('plant_manager', 'Plant Manager', 'Plant operations manager')
  ON CONFLICT (id) DO UPDATE 
  SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

  -- Remove any other roles
  DELETE FROM team_roles 
  WHERE id NOT IN ('operator', 'line_manager', 'plant_manager');
END $$;

-- Ensure RLS is enabled
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

-- Update viewing policy
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view roles" ON team_roles;
  
  CREATE POLICY "Anyone can view roles" ON team_roles
    FOR SELECT
    TO authenticated
    USING (true);
END $$;