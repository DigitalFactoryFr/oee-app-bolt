/*
  # Fix Project Policies Recursion

  1. Changes
    - Drop existing policies that may cause recursion
    - Create new streamlined policies for project access
  
  2. Security
    - Maintains RLS enabled
    - Implements clean policies without recursion
    - Preserves security based on user roles and ownership
*/

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Team members can view their assigned projects" ON projects;
DROP POLICY IF EXISTS "Team members can update their assigned projects" ON projects;
DROP POLICY IF EXISTS "Team members can delete their assigned projects" ON projects;

-- Create new policies without recursion
CREATE POLICY "project_select_policy"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id -- Project owner
    OR 
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
    )
  );

CREATE POLICY "project_insert_policy"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_update_policy"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id -- Project owner
    OR 
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
      AND team_members.role IN ('line_manager', 'it_admin', 'super_admin')
    )
  );

CREATE POLICY "project_delete_policy"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id -- Project owner
    OR 
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
      AND team_members.role IN ('it_admin', 'super_admin')
    )
  );