/*
  # Add plant configuration

  1. New Tables
    - `plant_configs`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `name` (text, plant name)
      - `opening_time_minutes` (integer, daily opening time in minutes)
      - `description` (text, nullable)
      - `import_method` (text, either 'manual' or 'excel')
      - `status` (text, onboarding status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage their plant configurations
*/

CREATE TABLE IF NOT EXISTS plant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_time_minutes integer NOT NULL,
  description text,
  import_method text NOT NULL CHECK (import_method IN ('manual', 'excel')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE plant_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plant_configs' 
    AND policyname = 'Users can view their own plant configs'
  ) THEN
    CREATE POLICY "Users can view their own plant configs"
      ON plant_configs
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = plant_configs.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plant_configs' 
    AND policyname = 'Users can create their own plant configs'
  ) THEN
    CREATE POLICY "Users can create their own plant configs"
      ON plant_configs
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = plant_configs.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plant_configs' 
    AND policyname = 'Users can update their own plant configs'
  ) THEN
    CREATE POLICY "Users can update their own plant configs"
      ON plant_configs
      FOR UPDATE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = plant_configs.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plant_configs' 
    AND policyname = 'Users can delete their own plant configs'
  ) THEN
    CREATE POLICY "Users can delete their own plant configs"
      ON plant_configs
      FOR DELETE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = plant_configs.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plant_configs_updated_at
    BEFORE UPDATE ON plant_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();