/*
  # Fix Project Policies

  1. Changes
    - Remove recursive policies
    - Implement clean, non-recursive access control
    - Maintain proper security model
  
  2. Security
    - Enable RLS
    - Define clear policies for CRUD operations
    - Preserve role-based access control
*/

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS project_select_policy ON projects;
DROP POLICY IF EXISTS project_insert_policy ON projects;
DROP POLICY IF EXISTS project_update_policy ON projects;
DROP POLICY IF EXISTS project_delete_policy ON projects;

-- Create new non-recursive policies
CREATE POLICY "project_select_policy" ON projects
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

CREATE POLICY "project_insert_policy" ON projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_update_policy" ON projects
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR 
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
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
    AND team_members.role IN ('it_admin', 'super_admin')
  )
);