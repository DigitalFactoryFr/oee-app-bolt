-- Start transaction
BEGIN;

-- Drop ALL existing policies on projects table
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "select_access" ON projects;
  DROP POLICY IF EXISTS "insert_access" ON projects;
  DROP POLICY IF EXISTS "update_access" ON projects;
  DROP POLICY IF EXISTS "delete_access" ON projects;
END $$;

-- Create a single policy for project owners
CREATE POLICY "owner_full_access" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create a separate SELECT-only policy for team members
CREATE POLICY "team_member_read_access" ON projects
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT DISTINCT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

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