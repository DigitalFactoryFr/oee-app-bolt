/*
  # Fix Project Owner Access Control

  1. Changes
    - Drop existing policies first
    - Create functions for access control
    - Add new policies for project access
    - Enable RLS on all tables

  2. Security
    - Project owners have full access to their projects
    - Team-based permissions remain intact
*/

-- Start transaction
BEGIN;

-- Drop existing policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON team_members;
  DROP POLICY IF EXISTS "team_members_manage_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_select_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_update_policy" ON team_members;
  DROP POLICY IF EXISTS "team_members_delete_policy" ON team_members;
END $$;

-- Function to check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM projects 
    WHERE id = project_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    is_project_owner(project_id) OR
    EXISTS (
      SELECT 1 
      FROM team_members 
      WHERE project_id = $1
      AND email = auth.email()
      AND status = 'active'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members
CREATE POLICY "team_members_select" ON team_members
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "team_members_insert" ON team_members
FOR INSERT TO authenticated
WITH CHECK (is_project_owner(project_id));

CREATE POLICY "team_members_update" ON team_members
FOR UPDATE TO authenticated
USING (is_project_owner(project_id))
WITH CHECK (is_project_owner(project_id));

CREATE POLICY "team_members_delete" ON team_members
FOR DELETE TO authenticated
USING (is_project_owner(project_id));

-- Create policies for other tables
CREATE POLICY "machines_access" ON machines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "products_access" ON products
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "lots_access" ON lots
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "stop_events_access" ON stop_events
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

CREATE POLICY "quality_issues_access" ON quality_issues
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

COMMIT;