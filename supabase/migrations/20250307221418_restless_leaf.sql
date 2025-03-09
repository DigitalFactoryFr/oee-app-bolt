/*
  # Fix Project Policies Recursion

  1. Changes
    - Remove recursive policy definitions
    - Implement direct user and team member checks
    - Fix infinite recursion in project policies
    - Simplify policy conditions for better performance

  2. Security
    - Maintain RLS protection
    - Ensure proper access control
    - Preserve team-based permissions
*/

-- First, drop all existing policies to start fresh
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects') THEN
    DROP POLICY IF EXISTS "project_select_policy" ON projects;
    DROP POLICY IF EXISTS "project_insert_policy" ON projects;
    DROP POLICY IF EXISTS "project_update_policy" ON projects;
    DROP POLICY IF EXISTS "project_delete_policy" ON projects;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create new optimized policies
CREATE POLICY "project_select_policy" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email()
    AND status = 'active'
  )
);

CREATE POLICY "project_insert_policy" ON projects
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update_policy" ON projects
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email()
    AND status = 'active'
    AND role IN ('line_manager', 'it_admin', 'super_admin')
  )
);

CREATE POLICY "project_delete_policy" ON projects
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email()
    AND status = 'active'
    AND role IN ('it_admin', 'super_admin')
  )
);