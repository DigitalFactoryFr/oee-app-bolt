/*
  # Create teams and roles tables

  1. New Tables
    - `team_roles`
      - `id` (text, primary key)
      - `name` (text)
      - `description` (text)
    
    - `team_members`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `machine_id` (uuid, references machines)
      - `email` (text)
      - `role` (text, references team_roles)
      - `team_name` (text)
      - `working_time_minutes` (integer)
      - `status` (text)
      - `invited_at` (timestamptz)
      - `joined_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
    - Limit total members to 1000 per project

  3. Changes
    - Add predefined roles
    - Add constraints and checks
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS team_roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL
);

-- Insert predefined roles
INSERT INTO team_roles (id, name, description) VALUES
  ('operator', 'Opérateur', 'Saisie manuelle des arrêts et suivi des objectifs'),
  ('line_manager', 'Chef de ligne', 'Supervise la production d''une ligne et analyse les performances'),
  ('it_admin', 'Admin IT', 'Gère les connexions des machines et les intégrations'),
  ('super_admin', 'Super Admin Entreprise', 'Supervise l''ensemble de l''usine');

-- Create team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  role text NOT NULL REFERENCES team_roles(id),
  team_name text NOT NULL,
  working_time_minutes integer NOT NULL CHECK (working_time_minutes > 0 AND working_time_minutes <= 1440),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'active', 'inactive')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, email)
);

-- Add constraint to limit members per project
CREATE OR REPLACE FUNCTION check_team_members_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM team_members
    WHERE project_id = NEW.project_id
  ) >= 1000 THEN
    RAISE EXCEPTION 'Maximum number of team members (1000) reached for this project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_members_limit
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_members_limit();

-- Enable RLS
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_roles (read-only for authenticated users)
CREATE POLICY "Anyone can view roles"
  ON team_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for team_members
CREATE POLICY "Users can view team members in their projects"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create team members in their projects"
  ON team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update team members in their projects"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete team members in their projects"
  ON team_members
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  ));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_team_members_updated_at();