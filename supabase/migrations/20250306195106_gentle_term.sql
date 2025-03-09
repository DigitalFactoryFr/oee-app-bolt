/*
  # Update lots constraints

  1. Changes
    - Remove and re-add constraints for ok_parts_produced
    - Ensure ok_parts_produced is less than or equal to lot_size
    - Ensure ok_parts_produced is not negative

  2. Notes
    - Safely handles existing constraints
    - Maintains data integrity
*/

-- First, remove any existing constraints
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;

-- Add the constraints back with updated names to avoid conflicts
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_size_check CHECK (ok_parts_produced <= lot_size);
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_min_check CHECK (ok_parts_produced >= 0);
