-- Add subscription tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'trial', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  machine_limit integer NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can manage their subscriptions" ON subscriptions;

-- Add policies
CREATE POLICY "subscriptions_manage_policy" ON subscriptions
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

-- Add trigger to update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create subscription when project is created
CREATE OR REPLACE FUNCTION create_project_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Since this is a trigger function, it bypasses RLS
  INSERT INTO subscriptions (project_id, status, machine_limit)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_project_subscription_trigger ON projects;

-- Create trigger
CREATE TRIGGER create_project_subscription_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_subscription();