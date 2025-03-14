/*
  # Fix team member constraints

  1. Changes
    - Make machine_id and line_id optional
    - Add constraints based on role
    - Update existing data to handle null values

  2. Security
    - Maintain existing RLS policies
    - Keep role-based access control
*/

-- Start transaction
BEGIN;

-- First make machine_id and line_id nullable
ALTER TABLE team_members 
  ALTER COLUMN machine_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES production_lines(id) ON DELETE CASCADE;

-- Add check constraint to ensure proper role assignments
ALTER TABLE team_members
  ADD CONSTRAINT team_members_role_assignments_check
  CHECK (
    (role = 'operator' AND machine_id IS NOT NULL AND line_id IS NULL) OR
    (role = 'team_manager' AND line_id IS NOT NULL AND machine_id IS NULL) OR
    (role IN ('owner', 'quality_technician', 'maintenance_technician') AND machine_id IS NULL AND line_id IS NULL)
  );

-- Update any existing owner records to have null machine_id
UPDATE team_members 
SET machine_id = NULL, line_id = NULL 
WHERE role IN ('owner', 'quality_technician', 'maintenance_technician');

COMMIT;