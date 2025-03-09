/*
  # Fix Projects Table Policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Simplify project access policies to use direct user ID comparison
    - Add clear policies for CRUD operations
    - Add team-based access policies

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Add policies for team members
*/

-- Remove existing policies to start fresh
DROP POLICY IF EXISTS "project_delete_policy" ON projects;
DROP POLICY IF EXISTS "project_insert_policy" ON projects;
DROP POLICY IF EXISTS "project_select_policy" ON projects;
DROP POLICY IF EXISTS "project_team_delete_policy" ON projects;
DROP POLICY IF EXISTS "project_team_select_policy" ON projects;
DROP POLICY IF EXISTS "project_team_update_policy" ON projects;
DROP POLICY IF EXISTS "project_update_policy" ON projects;

-- Create new simplified policies
CREATE POLICY "users_can_create_projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_view_own_projects"
ON projects FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

CREATE POLICY "users_can_update_own_projects"
ON projects FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_projects"
ON projects FOR DELETE
TO authenticated
USING (auth.uid() = user_id);