/*
  # Update Stop Events Schema

  1. Changes
    - Add lot_id column to stop_events table
    - Add indexes for improved query performance
    - Add stored procedure for getting unique failure causes

  2. Security
    - Update RLS policies to include new fields
*/

-- Add lot_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stop_events' AND column_name = 'lot_id'
  ) THEN
    ALTER TABLE stop_events 
    ADD COLUMN lot_id uuid REFERENCES lots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for improved performance
CREATE INDEX IF NOT EXISTS idx_stop_events_lot_id ON stop_events(lot_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_start_time ON stop_events(start_time);
CREATE INDEX IF NOT EXISTS idx_stop_events_end_time ON stop_events(end_time);
CREATE INDEX IF NOT EXISTS idx_stop_events_failure_type ON stop_events(failure_type);
CREATE INDEX IF NOT EXISTS idx_stop_events_status ON stop_events(status);

-- Create function to get unique failure causes
CREATE OR REPLACE FUNCTION get_unique_failure_causes(p_project_id uuid)
RETURNS TABLE (cause text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT se.cause
  FROM stop_events se
  WHERE se.project_id = p_project_id
  ORDER BY se.cause;
END;
$$;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can create stop events in their projects" ON stop_events;
DROP POLICY IF EXISTS "Users can view their own stop events" ON stop_events;
DROP POLICY IF EXISTS "Users can update their own stop events" ON stop_events;

CREATE POLICY "Users can create stop events in their projects"
  ON stop_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = stop_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own stop events"
  ON stop_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = stop_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own stop events"
  ON stop_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = stop_events.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = stop_events.project_id
      AND projects.user_id = auth.uid()
    )
  );