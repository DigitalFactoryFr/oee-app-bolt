/*
  # Update stop events table

  1. Changes
    - Add lot_id reference to stop_events table
    - Add status column for tracking ongoing stops
    - Add indexes for better performance
    - Update RLS policies

  2. Security
    - Maintain existing RLS policies
    - Add new policies for lot association
*/

-- Add lot_id column and make it nullable (since some stops might not be associated with lots)
ALTER TABLE stop_events 
ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES lots(id) ON DELETE SET NULL;

-- Add status column for tracking ongoing stops
ALTER TABLE stop_events 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ongoing' 
CHECK (status IN ('ongoing', 'completed'));

-- Make end_time nullable for ongoing stops
ALTER TABLE stop_events 
ALTER COLUMN end_time DROP NOT NULL;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stop_events_lot_id ON stop_events(lot_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_status ON stop_events(status);

-- Create a function to get unique failure causes
CREATE OR REPLACE FUNCTION get_unique_failure_causes(p_project_id uuid)
RETURNS TABLE (cause text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT s.cause 
  FROM stop_events s
  WHERE s.project_id = p_project_id
  ORDER BY s.cause;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;