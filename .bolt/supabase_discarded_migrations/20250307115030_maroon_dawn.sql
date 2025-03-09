/*
  # Project Statistics View

  1. New Objects
    - Creates a project_stats table to store project statistics
    - Adds function to update statistics
    - Adds trigger to maintain statistics

  2. Security
    - Enables RLS on project_stats table
    - Adds policy for viewing own stats
*/

-- Create table for project statistics
CREATE TABLE project_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  total_projects integer NOT NULL DEFAULT 0,
  first_project_created timestamptz,
  last_project_created timestamptz,
  project_names text[] DEFAULT ARRAY[]::text[],
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_stats ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view their own project stats"
  ON project_stats
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- Grant access to authenticated users
GRANT SELECT ON project_stats TO authenticated;

-- Create function to update stats
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS trigger AS $$
BEGIN
  -- For INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO project_stats (
      email,
      total_projects,
      first_project_created,
      last_project_created,
      project_names
    )
    SELECT
      u.email,
      COUNT(p.id),
      MIN(p.created_at),
      MAX(p.created_at),
      ARRAY_AGG(p.name)
    FROM auth.users u
    JOIN projects p ON p.user_id = u.id
    WHERE u.id = NEW.user_id
    GROUP BY u.email
    ON CONFLICT (email) DO UPDATE
    SET
      total_projects = EXCLUDED.total_projects,
      first_project_created = EXCLUDED.first_project_created,
      last_project_created = EXCLUDED.last_project_created,
      project_names = EXCLUDED.project_names,
      updated_at = now();
    RETURN NEW;
  
  -- For DELETE
  ELSIF TG_OP = 'DELETE' THEN
    WITH stats AS (
      SELECT
        u.email,
        COUNT(p.id) as total,
        MIN(p.created_at) as first_created,
        MAX(p.created_at) as last_created,
        ARRAY_AGG(p.name) as names
      FROM auth.users u
      LEFT JOIN projects p ON p.user_id = u.id
      WHERE u.id = OLD.user_id
      GROUP BY u.email
    )
    UPDATE project_stats ps
    SET
      total_projects = COALESCE((SELECT total FROM stats), 0),
      first_project_created = (SELECT first_created FROM stats),
      last_project_created = (SELECT last_created FROM stats),
      project_names = COALESCE((SELECT names FROM stats), ARRAY[]::text[]),
      updated_at = now()
    WHERE ps.email = (SELECT email FROM auth.users WHERE id = OLD.user_id);
    RETURN OLD;
  
  -- For UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE project_stats ps
    SET
      project_names = array_replace(project_names, OLD.name, NEW.name),
      updated_at = now()
    WHERE ps.email = (SELECT email FROM auth.users WHERE id = NEW.user_id);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_project_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_project_stats();

-- Initialize stats for existing projects
INSERT INTO project_stats (
  email,
  total_projects,
  first_project_created,
  last_project_created,
  project_names
)
SELECT
  u.email,
  COUNT(p.id),
  MIN(p.created_at),
  MAX(p.created_at),
  ARRAY_AGG(p.name)
FROM auth.users u
JOIN projects p ON p.user_id = u.id
GROUP BY u.email
ON CONFLICT (email) DO UPDATE
SET
  total_projects = EXCLUDED.total_projects,
  first_project_created = EXCLUDED.first_project_created,
  last_project_created = EXCLUDED.last_project_created,
  project_names = EXCLUDED.project_names,
  updated_at = now();