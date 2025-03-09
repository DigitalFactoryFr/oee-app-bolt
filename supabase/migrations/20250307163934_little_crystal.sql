/*
  # Remove team member email constraint

  1. Changes
    - Remove unique constraint on team_members(project_id, email) to allow multiple assignments
    - Keep other constraints and RLS policies unchanged

  2. Security
    - No changes to RLS policies
    - All existing security measures remain in place
*/

DO $$ BEGIN
  -- Drop the unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'team_members_project_id_email_key'
  ) THEN
    ALTER TABLE team_members
    DROP CONSTRAINT team_members_project_id_email_key;
  END IF;
END $$;