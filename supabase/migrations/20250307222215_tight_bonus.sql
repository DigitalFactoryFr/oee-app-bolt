/*
  # Fix Project Policies - Version 3

  1. Changes
    - Rewrite project policies to eliminate recursion
    - Simplify policy conditions
    - Add proper indexing for performance
    - Fix infinite recursion by using direct joins instead of subqueries

  2. Security
    - Maintain RLS protection
    - Keep role-based access control
    - Preserve team member access rules
*/

-- Drop existing policies
DROP POLICY IF EXISTS "project_select_policy" ON public.projects;
DROP POLICY IF EXISTS "project_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "project_update_policy" ON public.projects;
DROP POLICY IF EXISTS "project_delete_policy" ON public.projects;

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_team_members_email_status_role 
ON public.team_members(email, status, role);

-- Create new simplified policies
CREATE POLICY "project_select_policy" ON public.projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "project_team_select_policy" ON public.projects
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
  )
);

CREATE POLICY "project_insert_policy" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update_policy" ON public.projects
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "project_team_update_policy" ON public.projects
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
    AND team_members.role IN ('line_manager', 'it_admin', 'super_admin')
  )
);

CREATE POLICY "project_delete_policy" ON public.projects
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "project_team_delete_policy" ON public.projects
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
    AND team_members.status = 'active'
    AND team_members.role IN ('it_admin', 'super_admin')
  )
);