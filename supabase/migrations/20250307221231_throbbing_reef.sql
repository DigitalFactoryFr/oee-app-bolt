/*
  # Fix Project RLS Policies

  1. Changes
    - Remove recursive references in project policies
    - Simplify policies to use direct user_id check
    - Add clear policies for team member access
    - Fix infinite recursion issue

  2. Security
    - Enable RLS on projects table
    - Add policies for CRUD operations
    - Ensure proper access control for project owners and team members
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "project_select_policy" ON projects;
DROP POLICY IF EXISTS "project_insert_policy" ON projects;
DROP POLICY IF EXISTS "project_update_policy" ON projects;
DROP POLICY IF EXISTS "project_delete_policy" ON projects;

-- Create new simplified policies
CREATE POLICY "project_select_policy" ON projects
  FOR SELECT
  TO authenticated
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
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update_policy" ON projects
  FOR UPDATE
  TO authenticated
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
  FOR DELETE
  TO authenticated
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