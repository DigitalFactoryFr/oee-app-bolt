/*
  # Fix lot tracking schema

  1. Changes
    - Remove old constraints that might conflict
    - Add new constraints for ok_parts_produced validation
    - Create trigger function to update lot's ok_parts_produced
    - Add trigger to automatically update lot totals

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

-- Create trigger function to update lot's ok_parts_produced
CREATE OR REPLACE FUNCTION update_lot_ok_parts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the lot's ok_parts_produced
  UPDATE lots
  SET ok_parts_produced = (
    SELECT COALESCE(SUM(parts_produced), 0)
    FROM lot_tracking
    WHERE lot_id = NEW.lot_id
  )
  WHERE id = NEW.lot_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'update_lot_ok_parts_trigger'
  ) THEN
    CREATE TRIGGER update_lot_ok_parts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_lot_ok_parts();
  END IF;
END $$;