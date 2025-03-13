/*
  # Fix subscription table and policies

  1. Changes
    - Drop existing policies and recreate them
    - Add unique constraint on project_id
    - Add trigger for subscription creation
    - Add machine limit enforcement

  2. Security
    - Enable RLS
    - Add proper policies for subscription management
*/

-- Start transaction
BEGIN;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_delete" ON subscriptions;
END $$;

-- Create subscriptions table if it doesn't exist
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
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "subscriptions_select"
ON subscriptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "subscriptions_insert"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "subscriptions_update"
ON subscriptions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "subscriptions_delete"
ON subscriptions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Create function to check machine limits
CREATE OR REPLACE FUNCTION check_machine_limits()
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
    RAISE EXCEPTION 'Free tier is limited to % machines. Please upgrade to add more machines.', v_machine_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce machine limits
DROP TRIGGER IF EXISTS enforce_machine_limits_trigger ON machines;
CREATE TRIGGER enforce_machine_limits_trigger
  BEFORE INSERT ON machines
  FOR EACH ROW
  EXECUTE FUNCTION check_machine_limits();

-- Create function to create subscription when project is created
CREATE OR REPLACE FUNCTION create_project_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (project_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create subscription
DROP TRIGGER IF EXISTS create_project_subscription_trigger ON projects;
CREATE TRIGGER create_project_subscription_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_subscription();

COMMIT;