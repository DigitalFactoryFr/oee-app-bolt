/*
  # Fix lot tracking functionality

  1. Changes
    - Remove any remaining references to auto_ok_parts_produced
    - Update trigger function to handle lot tracking changes correctly
    - Add proper constraints for ok_parts_produced validation

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_lot_ok_parts_trigger ON lot_tracking;
DROP FUNCTION IF EXISTS update_lot_ok_parts();

-- Remove any existing constraints that might conflict
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;

-- Add new constraints for ok_parts_produced
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_produced_check 
  CHECK (ok_parts_produced >= 0);

ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_check 
  CHECK (ok_parts_produced <= lot_size);

-- Create new trigger function to update lot's ok_parts_produced
CREATE OR REPLACE FUNCTION update_lot_ok_parts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the lot's ok_parts_produced
  UPDATE lots
  SET ok_parts_produced = (
    SELECT COALESCE(SUM(parts_produced), 0)
    FROM lot_tracking
    WHERE lot_id = COALESCE(NEW.lot_id, OLD.lot_id)
  )
  WHERE id = COALESCE(NEW.lot_id, OLD.lot_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER update_lot_ok_parts_trigger
AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
FOR EACH ROW
EXECUTE FUNCTION update_lot_ok_parts();