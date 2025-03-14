/*
  # Fix Multiple Issues

  1. Changes
    - Fix plant configs RLS policies
    - Add proper subscription handling
    - Update team member role constraints
    - Add missing indexes

  2. Security
    - Maintain proper access control
    - Fix policy recursion issues
*/

-- Start transaction
BEGIN;

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "plant_configs_access_policy" ON plant_configs;
  DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_delete" ON subscriptions;
END $$;

-- Create simplified plant configs policies
CREATE POLICY "plant_configs_access" ON plant_configs
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Create simplified subscription policies
CREATE POLICY "subscriptions_access" ON subscriptions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Update team member role constraints
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_assignments_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_assignments_check
CHECK (
  (role = 'operator' AND machine_id IS NOT NULL AND line_id IS NULL) OR
  (role = 'team_manager' AND line_id IS NOT NULL AND machine_id IS NULL) OR
  (role IN ('owner', 'quality_technician', 'maintenance_technician') AND machine_id IS NULL AND line_id IS NULL)
);

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_plant_configs_project_id ON plant_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_project_id ON subscriptions(project_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email_status ON team_members(email, status);

-- Create function to ensure subscription exists
CREATE OR REPLACE FUNCTION ensure_subscription_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (project_id, status, machine_limit)
  VALUES (NEW.id, 'free', 3)
  ON CONFLICT (project_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription creation
DROP TRIGGER IF EXISTS ensure_subscription_exists_trigger ON projects;
CREATE TRIGGER ensure_subscription_exists_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION ensure_subscription_exists();

COMMIT;