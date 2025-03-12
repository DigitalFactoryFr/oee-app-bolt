/*
  # Add theoretical lot size to lots table

  1. Changes
    - Add theoretical_lot_size column to lots table
    - Add trigger to automatically calculate theoretical lot size based on cycle time and duration

  2. Description
    This migration adds support for tracking theoretical lot sizes based on product cycle times
    and lot duration. The theoretical size is automatically calculated when a lot is created
    or updated.
*/

-- Add theoretical_lot_size column
ALTER TABLE lots ADD COLUMN theoretical_lot_size integer;

-- Create function to calculate theoretical lot size
CREATE OR REPLACE FUNCTION calculate_theoretical_lot_size()
RETURNS TRIGGER AS $$
DECLARE
  cycle_time_seconds integer;
  duration_seconds integer;
BEGIN
  -- Get product cycle time
  SELECT cycle_time INTO cycle_time_seconds
  FROM products
  WHERE id = NEW.product;

  -- Calculate duration in seconds
  duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time));

  -- Calculate theoretical lot size
  IF cycle_time_seconds > 0 AND duration_seconds > 0 THEN
    NEW.theoretical_lot_size := (duration_seconds / cycle_time_seconds)::integer;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate theoretical lot size
CREATE TRIGGER calculate_theoretical_lot_size_trigger
  BEFORE INSERT OR UPDATE OF start_time, end_time, product
  ON lots
  FOR EACH ROW
  EXECUTE FUNCTION calculate_theoretical_lot_size();

-- Update existing lots to calculate theoretical lot size
DO $$ 
BEGIN
  UPDATE lots 
  SET start_time = start_time 
  WHERE start_time IS NOT NULL 
    AND end_time IS NOT NULL 
    AND product IS NOT NULL;
END $$;