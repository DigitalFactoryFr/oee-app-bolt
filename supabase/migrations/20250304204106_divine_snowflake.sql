/*
  # Update production lines structure

  1. Changes
    - Make line_id optional
    - Add unique constraint on name within project
    - Add last_updated_at for tracking updates

  2. Security
    - Maintains existing RLS policies
*/

ALTER TABLE production_lines
  ALTER COLUMN line_id DROP NOT NULL,
  ADD COLUMN last_updated_at timestamptz DEFAULT now();

-- Add unique constraint on name within project
ALTER TABLE production_lines
  ADD CONSTRAINT unique_line_name_per_project UNIQUE (project_id, name);

-- Update trigger to also update last_updated_at
CREATE OR REPLACE FUNCTION update_production_lines_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.last_updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_production_lines_timestamps ON production_lines;
CREATE TRIGGER update_production_lines_timestamps
    BEFORE UPDATE ON production_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_production_lines_timestamps();