/*
  # Update team role name

  1. Changes
    - Update the role name from 'opérateur' to 'operator' in team_roles table
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM team_roles 
    WHERE id = 'operator'
  ) THEN
    UPDATE team_roles 
    SET name = 'Operator'
    WHERE id = 'operator';
  END IF;
END $$;