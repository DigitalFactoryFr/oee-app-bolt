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

-- Add policies
CREATE POLICY "Users can view their subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  ));

-- Add trigger to enforce free tier limits
CREATE OR REPLACE FUNCTION enforce_machine_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_status text;
  v_machine_limit integer;
  v_machine_count integer;
BEGIN
  -- Get subscription status and limits
  SELECT status, machine_limit 
  INTO v_subscription_status, v_machine_limit
  FROM subscriptions 
  WHERE project_id = NEW.project_id;

  -- Count existing machines
  SELECT COUNT(*) 
  INTO v_machine_count
  FROM machines
  WHERE project_id = NEW.project_id;

  -- Enforce limits for free tier
  IF v_subscription_status = 'free' AND v_machine_count >= v_machine_limit THEN
    RAISE EXCEPTION 'Free tier limited to % machines. Please upgrade to add more machines.', v_machine_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to machines table
CREATE TRIGGER enforce_machine_limits_trigger
  BEFORE INSERT ON machines
  FOR EACH ROW
  EXECUTE FUNCTION enforce_machine_limits();

-- Add trigger to update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create subscription when project is created
CREATE OR REPLACE FUNCTION create_project_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (project_id, status, machine_limit)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_project_subscription_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_subscription();