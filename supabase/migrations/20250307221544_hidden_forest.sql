/*
  # Fix Project Policies

  1. Changes
    - Remove recursive policy definitions
    - Implement direct user and team member checks
    - Fix infinite recursion in project policies
    - Add proper indexing for performance

  2. Security
    - Enable RLS on projects table
    - Add policies for CRUD operations
    - Implement role-based access control
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "project_select_policy" ON projects;
DROP POLICY IF EXISTS "project_insert_policy" ON projects;
DROP POLICY IF EXISTS "project_update_policy" ON projects;
DROP POLICY IF EXISTS "project_delete_policy" ON projects;

-- Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Add index to improve policy performance
CREATE INDEX IF NOT EXISTS idx_team_members_email_status_role 
ON team_members(email, status, role);

-- Create new optimized policies
CREATE POLICY "project_select_policy" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

CREATE POLICY "project_insert_policy" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update_policy" ON projects
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
    AND team_members.role IN ('line_manager', 'it_admin', 'super_admin')
  )
);

CREATE POLICY "project_delete_policy" ON projects
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
    AND team_members.role IN ('it_admin', 'super_admin')
  )
);