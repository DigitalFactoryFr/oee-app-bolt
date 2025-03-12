/*
  # Simplify Security Policies

  1. Changes
    - Creates new project access function with temporary name
    - Updates all policies to use basic project access
    - Removes complex role-based restrictions
    - Drops old functions after updating dependencies
    
  2. Security
    - Basic project-level access control
    - Users can access data for their projects
    - Project owners have full access
*/

BEGIN;

-- Drop all existing policies first
DROP POLICY IF EXISTS "plant_config_access_policy" ON plant_configs;
DROP POLICY IF EXISTS "lines_access_policy" ON production_lines;
DROP POLICY IF EXISTS "machines_access_policy" ON machines;
DROP POLICY IF EXISTS "products_access_policy" ON products;
DROP POLICY IF EXISTS "team_members_manage_policy" ON team_members;
DROP POLICY IF EXISTS "Operators can create lots" ON lots;
DROP POLICY IF EXISTS "Team managers can update lots" ON lots;
DROP POLICY IF EXISTS "lots_access_policy" ON lots;
DROP POLICY IF EXISTS "Operators can create stops" ON stop_events;
DROP POLICY IF EXISTS "Maintenance can manage stops" ON stop_events;
DROP POLICY IF EXISTS "stop_events_access_policy" ON stop_events;
DROP POLICY IF EXISTS "Quality techs can manage quality issues" ON quality_issues;
DROP POLICY IF EXISTS "Operators can create quality issues" ON quality_issues;
DROP POLICY IF EXISTS "quality_issues_access_policy" ON quality_issues;

-- Drop existing functions with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS has_project_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS has_config_access(uuid) CASCADE;

-- Create new project access function
CREATE FUNCTION has_project_access(p_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM projects p
    WHERE p.id = p_project_id 
    AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 
    FROM team_members tm
    WHERE tm.project_id = p_project_id 
    AND tm.email = auth.email()
    AND tm.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies using the new function
CREATE POLICY "plant_config_access_policy" ON plant_configs
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "lines_access_policy" ON production_lines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "machines_access_policy" ON machines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "products_access_policy" ON products
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "team_members_manage_policy" ON team_members
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "lots_access_policy" ON lots
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "stop_events_access_policy" ON stop_events
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "quality_issues_access_policy" ON quality_issues
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_project_email_status 
ON team_members (project_id, email, status);

CREATE INDEX IF NOT EXISTS idx_projects_user_id 
ON projects (user_id);

COMMIT;
