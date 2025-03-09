/*
  # Create Data Import Tables

  1. New Tables
    - `lots`
      - Production data with OK parts count
      - Tracks daily production by team member and machine
    - `stop_events`
      - Machine stop events and durations
      - Records all production stops with failure types
    - `quality_issues`
      - Quality issues and defects
      - Tracks quality problems by category

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create lots table
CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  team_member uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  product uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  machine uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  ok_parts_produced integer NOT NULL CHECK (ok_parts_produced >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lots"
  ON lots
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = lots.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create lots in their projects"
  ON lots
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = lots.project_id
    AND projects.user_id = auth.uid()
  ));

-- Create stop_events table
CREATE TABLE IF NOT EXISTS stop_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  team_member uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  product uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  failure_type text NOT NULL CHECK (failure_type IN ('AP', 'PA', 'DO', 'NQ', 'CS')),
  machine uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  duration integer NOT NULL CHECK (duration > 0),
  cause text NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stop events"
  ON stop_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = stop_events.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create stop events in their projects"
  ON stop_events
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = stop_events.project_id
    AND projects.user_id = auth.uid()
  ));

-- Create quality_issues table
CREATE TABLE IF NOT EXISTS quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  team_member uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  product uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('rework', 'out_of_station', 'scrap')),
  machine uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  cause text NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quality issues"
  ON quality_issues
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quality_issues.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create quality issues in their projects"
  ON quality_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quality_issues.project_id
    AND projects.user_id = auth.uid()
  ));

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stop_events_updated_at
  BEFORE UPDATE ON stop_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quality_issues_updated_at
  BEFORE UPDATE ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();