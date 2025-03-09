/*
  # Fix lot tracking and ok parts validation

  1. Changes
    - Remove existing triggers and functions
    - Add new trigger to validate lot tracking entries
    - Update lot tracking trigger to properly handle ok parts calculation
    - Remove redundant constraints

  2. Security
    - Maintain RLS policies
    - Ensure data integrity with new triggers
*/

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS update_lot_ok_parts_trigger ON lot_tracking;
DROP TRIGGER IF EXISTS validate_lot_ok_parts_trigger ON lots;
DROP FUNCTION IF EXISTS update_lot_ok_parts();
DROP FUNCTION IF EXISTS validate_lot_ok_parts();

-- Remove existing constraints (skip lots_lot_size_check since it already exists)
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;

-- Create function to validate lot tracking entries
CREATE OR REPLACE FUNCTION validate_lot_tracking()
RETURNS TRIGGER AS $$
DECLARE
  v_lot_size INTEGER;
  v_total_parts INTEGER;
BEGIN
  -- Get the lot size
  SELECT lot_size INTO v_lot_size
  FROM lots
  WHERE id = NEW.lot_id;

  -- Calculate total parts including the new entry
  SELECT COALESCE(SUM(parts_produced), 0) + NEW.parts_produced INTO v_total_parts
  FROM lot_tracking
  WHERE lot_id = NEW.lot_id
  AND id != COALESCE(OLD.id, -1); -- Exclude current record if updating

  -- Check if total would exceed lot size
  IF v_total_parts > v_lot_size THEN
    RAISE EXCEPTION 'Total parts produced cannot exceed lot size';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lot tracking validation
CREATE TRIGGER validate_lot_tracking_trigger
BEFORE INSERT OR UPDATE ON lot_tracking
FOR EACH ROW
EXECUTE FUNCTION validate_lot_tracking();

-- Create function to update lot's ok_parts_produced
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

-- Add check constraint for ok_parts_produced
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_produced_check 
  CHECK (ok_parts_produced >= 0);