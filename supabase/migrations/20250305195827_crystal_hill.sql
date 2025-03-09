/*
  # Add lot tracking fields to lots table

  1. Changes
    - Add lot_id column (optional text field)
    - Add lot_size column (required integer field)
    - Add index on lot_id for faster lookups
    - Add constraints to ensure data integrity:
      - lot_size must be greater than 0
      - ok_parts_produced cannot exceed lot_size

  2. Notes
    - Handles existing data by setting default lot_size equal to ok_parts_produced
    - Ensures all constraints are satisfied before applying them
*/

-- First, add lot_id column (optional)
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_id text;

-- Create index on lot_id
CREATE INDEX IF NOT EXISTS idx_lots_lot_id ON lots (lot_id);

-- Add lot_size column with a default value of 1
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_size integer NOT NULL DEFAULT 1;

-- Update existing rows to set lot_size equal to ok_parts_produced if it's greater than 1
UPDATE lots SET lot_size = GREATEST(ok_parts_produced, 1);

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_lot_size_check;
  ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add check constraints
ALTER TABLE lots ADD CONSTRAINT lots_lot_size_check CHECK (lot_size > 0);
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_check CHECK (ok_parts_produced <= lot_size);