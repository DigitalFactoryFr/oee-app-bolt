/*
  # Update team roles to English

  1. Changes
    - Update role names to English
    - Simplify role structure
    - Remove duplicate/unnecessary roles
  
  2. Security
    - Keep existing RLS policies
*/

DO $$ 
BEGIN
  -- First ensure the operator role exists as it's referenced by team members
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('operator', 'Operator', 'Production line operator responsible for data entry and basic operations')
  ON CONFLICT (id) DO NOTHING;

  -- Update any existing members to use 'operator' role if needed
  UPDATE team_members
  SET role = 'operator'
  WHERE role NOT IN (SELECT id FROM team_roles);

  -- Now update existing roles and add new ones
  INSERT INTO team_roles (id, name, description)
  VALUES
    ('line_manager', 'Line Manager', 'Manages production lines and teams'),
    ('maintenance_manager', 'Maintenance Manager', 'Manages equipment maintenance and repairs'),
    ('quality_manager', 'Quality Manager', 'Manages quality control processes'),
    ('plant_manager', 'Plant Manager', 'Overall plant management and reporting')
  ON CONFLICT (id) DO UPDATE 
  SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

  -- Remove any old roles that are no longer needed
  DELETE FROM team_roles 
  WHERE id NOT IN ('operator', 'line_manager', 'maintenance_manager', 'quality_manager', 'plant_manager');
END $$;