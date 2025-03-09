/*
  # Add Automatic Parts Tracking

  1. Changes
    - Add auto_ok_parts_produced column to lots table
    - Add constraint to ensure auto_ok_parts_produced is not negative
    - Add index for performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add auto_ok_parts_produced column to lots table
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS auto_ok_parts_produced integer DEFAULT 0;

-- Add constraint to ensure auto_ok_parts_produced is not negative
ALTER TABLE lots
ADD CONSTRAINT lots_auto_ok_parts_check 
CHECK (auto_ok_parts_produced >= 0);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lots_auto_ok_parts ON lots(auto_ok_parts_produced);

-- Create function to update auto_ok_parts_produced
CREATE OR REPLACE FUNCTION update_lot_auto_parts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auto_ok_parts_produced in lots table
  UPDATE lots
  SET auto_ok_parts_produced = (
    SELECT COALESCE(SUM(parts_produced), 0)
    FROM lot_tracking
    WHERE lot_id = NEW.lot_id
  )
  WHERE id = NEW.lot_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update auto_ok_parts_produced
DROP TRIGGER IF EXISTS update_lot_auto_parts_trigger ON lot_tracking;
CREATE TRIGGER update_lot_auto_parts_trigger
AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
FOR EACH ROW
EXECUTE FUNCTION update_lot_auto_parts();