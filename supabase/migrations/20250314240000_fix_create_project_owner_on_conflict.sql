CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Empêcher le doublon dans team_members
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  )
  VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    'Management',
    480
  )
  ON CONFLICT (project_id, email, role) DO NOTHING;

  -- Empêcher le doublon dans subscriptions
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  )
  VALUES (
    NEW.id,
    'free',
    3
  )
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
