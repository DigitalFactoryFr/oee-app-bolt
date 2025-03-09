/*
  # Fix lot tracking functionality

  1. Changes
    - Remove old constraints that might conflict
    - Add new constraints for ok_parts_produced validation
    - Update trigger function to handle lot tracking changes correctly

  2. Security
    - Maintain existing RLS policies
*/

-- First, remove any existing constraints that might conflict
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;

-- Add new constraints for ok_parts_produced
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_produced_check 
  CHECK (ok_parts_produced >= 0);

ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_check 
  CHECK (ok_parts_produced <= lot_size);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_lot_ok_parts_trigger ON lot_tracking;

-- Create or replace trigger function to update lot's ok_parts_produced
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

-- Create trigger
CREATE TRIGGER update_lot_ok_parts_trigger
AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
FOR EACH ROW
EXECUTE FUNCTION update_lot_ok_parts();