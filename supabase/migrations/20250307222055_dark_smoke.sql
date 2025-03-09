/*
  # Fix Project Policies - Version 2

  1. Changes
    - Completely rewrite project policies to eliminate recursion
    - Simplify policy conditions to basic checks
    - Add proper indexing for performance
    - Fix infinite recursion by removing nested EXISTS clauses

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
CREATE INDEX IF NOT EXISTS idx_team_members_project_email_status_role 
ON public.team_members(project_id, email, status, role);

CREATE INDEX IF NOT EXISTS idx_projects_user_id 
ON public.projects(user_id);

-- Create new simplified policies
CREATE POLICY "project_select_policy" ON public.projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT project_id 
    FROM public.team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

CREATE POLICY "project_insert_policy" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update_policy" ON public.projects
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT project_id 
    FROM public.team_members 
    WHERE email = auth.email() 
    AND status = 'active'
    AND role IN ('line_manager', 'it_admin', 'super_admin')
  )
);

CREATE POLICY "project_delete_policy" ON public.projects
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT project_id 
    FROM public.team_members 
    WHERE email = auth.email() 
    AND status = 'active'
    AND role IN ('it_admin', 'super_admin')
  )
);