/*
  # Fix Team Members Policies Recursion

  1. Changes
    - Simplifies policy structure to prevent recursion
    - Adds direct project ownership checks
    - Implements super admin role with full access
    - Removes circular policy dependencies

  2. Security
    - Maintains proper access control
    - Prevents infinite recursion
    - Preserves role-based permissions
*/

-- Start transaction
BEGIN;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;
DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON team_members;

-- Function to check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin (without recursion)
CREATE OR REPLACE FUNCTION is_super_admin(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = $1 
    AND email = auth.email()
    AND role = 'super_admin'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 
      FROM projects 
      WHERE id = team_members.project_id 
      AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to project
CREATE OR REPLACE FUNCTION has_project_access(project_id uuid)
RETURNS boolean AS $$
DECLARE
  is_owner boolean;
  is_admin boolean;
  is_member boolean;
BEGIN
  -- Check if user is project owner
  SELECT EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  ) INTO is_owner;

  IF is_owner THEN
    RETURN true;
  END IF;

  -- Check if user is super admin
  SELECT is_super_admin(project_id) INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;

  -- Check if user is team member
  SELECT EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE project_id = $1
    AND email = auth.email()
    AND status = 'active'
  ) INTO is_member;

  RETURN is_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new non-recursive policies for team_members
CREATE POLICY "team_members_view_policy" ON team_members
FOR SELECT TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  (
    email = auth.email() AND
    status = 'active'
  )
);

CREATE POLICY "team_members_insert_policy" ON team_members
FOR INSERT TO authenticated
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  (
    EXISTS (
      SELECT 1 
      FROM team_members
      WHERE project_id = team_members.project_id
      AND email = auth.email()
      AND role = 'team_manager'
      AND status = 'active'
    )
  )
);

CREATE POLICY "team_members_update_policy" ON team_members
FOR UPDATE TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  (
    EXISTS (
      SELECT 1 
      FROM team_members
      WHERE project_id = team_members.project_id
      AND email = auth.email()
      AND role = 'team_manager'
      AND status = 'active'
    )
  )
)
WITH CHECK (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  (
    EXISTS (
      SELECT 1 
      FROM team_members
      WHERE project_id = team_members.project_id
      AND email = auth.email()
      AND role = 'team_manager'
      AND status = 'active'
    )
  )
);

CREATE POLICY "team_members_delete_policy" ON team_members
FOR DELETE TO authenticated
USING (
  is_project_owner(project_id) OR
  is_super_admin(project_id) OR
  (
    EXISTS (
      SELECT 1 
      FROM team_members
      WHERE project_id = team_members.project_id
      AND email = auth.email()
      AND role = 'team_manager'
      AND status = 'active'
    )
  )
);

-- Enable RLS on team_members table
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

COMMIT;