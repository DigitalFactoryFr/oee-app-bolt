/*
  # Fix lot tracking and ok parts calculation

  1. Changes
    - Remove check constraint on ok_parts_produced to allow trigger updates
    - Add new trigger to validate ok_parts against lot_size
    - Update lot tracking trigger to handle ok parts calculation

  2. Security
    - Maintain RLS policies
    - Ensure data integrity with new trigger
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS update_lot_ok_parts_trigger ON lot_tracking;
DROP FUNCTION IF EXISTS update_lot_ok_parts();
DROP FUNCTION IF EXISTS get_unique_failure_causes;

-- Remove existing constraints that might conflict
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;

-- Create function to get unique failure causes
CREATE OR REPLACE FUNCTION get_unique_failure_causes(p_project_id uuid)
RETURNS TABLE (cause text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT se.cause
  FROM stop_events se
  WHERE se.project_id = p_project_id
  ORDER BY se.cause;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate lot ok_parts against lot_size
CREATE OR REPLACE FUNCTION validate_lot_ok_parts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if ok_parts_produced exceeds lot_size
  IF NEW.ok_parts_produced > NEW.lot_size THEN
    RAISE EXCEPTION 'ok_parts_produced cannot exceed lot_size';
  END IF;
  
  -- Ensure ok_parts_produced is not negative
  IF NEW.ok_parts_produced < 0 THEN
    RAISE EXCEPTION 'ok_parts_produced cannot be negative';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lot validation
CREATE TRIGGER validate_lot_ok_parts_trigger
BEFORE UPDATE ON lots
FOR EACH ROW
EXECUTE FUNCTION validate_lot_ok_parts();

-- Create trigger function to update lot's ok_parts_produced
CREATE OR REPLACE FUNCTION update_lot_ok_parts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate new ok_parts_produced total
  WITH tracking_total AS (
    SELECT COALESCE(SUM(parts_produced), 0) as total
    FROM lot_tracking
    WHERE lot_id = COALESCE(NEW.lot_id, OLD.lot_id)
  )
  UPDATE lots
  SET ok_parts_produced = tracking_total.total,
      updated_at = CURRENT_TIMESTAMP
  FROM tracking_total
  WHERE id = COALESCE(NEW.lot_id, OLD.lot_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lot tracking
CREATE TRIGGER update_lot_ok_parts_trigger
AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
FOR EACH ROW
EXECUTE FUNCTION update_lot_ok_parts();