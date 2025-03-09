/*
  # Fix Project Access Policies

  1. Changes
    - Add policy for team members to view projects they are assigned to
    - Modify existing policies to include team member access
  
  2. Security
    - Maintains RLS enabled
    - Adds new policy for team member access
    - Updates existing policies
*/

-- Add policy for team members to view projects they are assigned to
CREATE POLICY "Team members can view their assigned projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
    )
  );

-- Update existing policies to include team member access
CREATE POLICY "Team members can update their assigned projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
      AND team_members.role IN ('line_manager', 'it_admin', 'super_admin')
    )
  );

CREATE POLICY "Team members can delete their assigned projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.project_id = projects.id
      AND team_members.email = auth.email()
      AND team_members.status = 'active'
      AND team_members.role IN ('it_admin', 'super_admin')
    )
  );