/*
  # Fix plant configuration schema

  1. Changes
    - Add unique constraint on project_id to ensure one config per project
    - Add default values for status and import_method
    - Add NOT NULL constraints where appropriate
    - Add validation for opening_time_minutes

  2. Security
    - Enable RLS
    - Add policies for CRUD operations
*/

-- Drop existing table if it exists and recreate with proper constraints
DROP TABLE IF EXISTS plant_configs;

CREATE TABLE plant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_time_minutes integer NOT NULL CHECK (opening_time_minutes > 0 AND opening_time_minutes <= 1440),
  description text,
  import_method text NOT NULL DEFAULT 'manual' CHECK (import_method IN ('manual', 'excel')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id)
);

-- Enable RLS
ALTER TABLE plant_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own plant configs"
  ON plant_configs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own plant configs"
  ON plant_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own plant configs"
  ON plant_configs
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own plant configs"
  ON plant_configs
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  ));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_plant_configs_updated_at ON plant_configs;
CREATE TRIGGER update_plant_configs_updated_at
    BEFORE UPDATE ON plant_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();