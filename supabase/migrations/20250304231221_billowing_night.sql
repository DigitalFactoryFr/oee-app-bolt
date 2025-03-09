/*
  # Add machines table

  1. New Tables
    - `machines`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `line_id` (uuid, references production_lines)
      - `name` (text)
      - `description` (text, nullable)
      - `opening_time_minutes` (integer, nullable)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Unique constraint on name within line
    - Opening time must be between 1 and 1440 minutes (24 hours)
    - Status must be one of: 'pending', 'in_progress', 'completed'

  3. Security
    - Enable RLS
    - Add policies for authenticated users to manage their own machines
*/

CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  opening_time_minutes integer CHECK (opening_time_minutes IS NULL OR (opening_time_minutes > 0 AND opening_time_minutes <= 1440)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(line_id, name)
);

-- Enable RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'machines' 
    AND policyname = 'Users can view their own machines'
  ) THEN
    CREATE POLICY "Users can view their own machines"
      ON machines
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = machines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'machines' 
    AND policyname = 'Users can create their own machines'
  ) THEN
    CREATE POLICY "Users can create their own machines"
      ON machines
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = machines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'machines' 
    AND policyname = 'Users can update their own machines'
  ) THEN
    CREATE POLICY "Users can update their own machines"
      ON machines
      FOR UPDATE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = machines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'machines' 
    AND policyname = 'Users can delete their own machines'
  ) THEN
    CREATE POLICY "Users can delete their own machines"
      ON machines
      FOR DELETE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = machines.project_id
        AND projects.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_machines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_machines_updated_at ON machines;
CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW
    EXECUTE FUNCTION update_machines_updated_at();