/*
  # Production Lines Schema

  1. New Tables
    - `production_lines`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `plant_config_id` (uuid, foreign key to plant_configs)
      - `line_id` (text, unique identifier for the line)
      - `name` (text, line name)
      - `description` (text, optional)
      - `opening_time_minutes` (integer, operating time)
      - `status` (text, enum: pending, in_progress, completed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_lines` table
    - Add policies for authenticated users to manage their own lines
*/

CREATE TABLE IF NOT EXISTS production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plant_config_id uuid NOT NULL REFERENCES plant_configs(id) ON DELETE CASCADE,
  line_id text NOT NULL,
  name text NOT NULL,
  description text,
  opening_time_minutes integer NOT NULL CHECK (opening_time_minutes > 0 AND opening_time_minutes <= 1440),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, line_id)
);

-- Enable RLS
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_lines' 
    AND policyname = 'Users can view their own production lines'
  ) THEN
    CREATE POLICY "Users can view their own production lines"
      ON production_lines
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = production_lines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_lines' 
    AND policyname = 'Users can create their own production lines'
  ) THEN
    CREATE POLICY "Users can create their own production lines"
      ON production_lines
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = production_lines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_lines' 
    AND policyname = 'Users can update their own production lines'
  ) THEN
    CREATE POLICY "Users can update their own production lines"
      ON production_lines
      FOR UPDATE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = production_lines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_lines' 
    AND policyname = 'Users can delete their own production lines'
  ) THEN
    CREATE POLICY "Users can delete their own production lines"
      ON production_lines
      FOR DELETE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = production_lines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_production_lines_updated_at ON production_lines;
CREATE TRIGGER update_production_lines_updated_at
    BEFORE UPDATE ON production_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_production_lines_updated_at();