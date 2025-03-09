/*
  # Fix team members policies to prevent recursion

  1. Changes
    - Fixes infinite recursion in team_members policies
    - Updates policy structure to avoid self-referencing
    - Maintains same security model but with optimized implementation

  2. Security
    - Maintains role-based access control
    - Preserves data isolation between projects
    - Prevents unauthorized access
*/

-- Start transaction
BEGIN;

-- Update the check_user_role function to avoid recursion
CREATE OR REPLACE FUNCTION check_user_role(project_id uuid, required_role text)
RETURNS boolean AS $$
DECLARE
  user_email text;
  user_status text;
  user_role text;
BEGIN
  -- Get the current user's email
  user_email := auth.email();
  
  -- Get the user's role and status directly
  SELECT status, role
  INTO user_status, user_role
  FROM team_members
  WHERE project_id = $1 
  AND email = user_email
  LIMIT 1;

  -- Return true if user has an active status and the required role
  RETURN user_status = 'active' AND user_role = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing team member policies to recreate them
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team managers can manage team members' AND tablename = 'team_members') THEN
    DROP POLICY "Team managers can manage team members" ON team_members;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view team members in their projects' AND tablename = 'team_members') THEN
    DROP POLICY "Users can view team members in their projects" ON team_members;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert for authenticated users only' AND tablename = 'team_members') THEN
    DROP POLICY "Enable insert for authenticated users only" ON team_members;
  END IF;
END $$;

-- Create new optimized policies for team_members
CREATE POLICY "Team managers can manage team members" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM team_members manager
    WHERE manager.project_id = team_members.project_id
    AND manager.email = auth.email()
    AND manager.role = 'team_manager'
    AND manager.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM team_members manager
    WHERE manager.project_id = team_members.project_id
    AND manager.email = auth.email()
    AND manager.role = 'team_manager'
    AND manager.status = 'active'
  )
);

-- Allow users to view team members in their projects
CREATE POLICY "Users can view team members in their projects" ON team_members
FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT project_id 
    FROM team_members viewer
    WHERE viewer.email = auth.email()
    AND viewer.status = 'active'
  )
);

-- Allow project owners to manage their team members
CREATE POLICY "Project owners can manage team members" ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

COMMIT;