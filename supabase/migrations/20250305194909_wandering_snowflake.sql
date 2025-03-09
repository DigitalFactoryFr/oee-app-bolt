/*
  # Add Lot ID and Size Fields to Lots Table

  1. Changes
    - Add lot_id column (optional text field)
    - Add lot_size column (required integer field)
    - Add check constraint to ensure lot_size is positive
    - Add index on lot_id for faster lookups

  2. Notes
    - lot_id is optional to allow for manual entries without IDs
    - lot_size must be greater than 0
    - Handles existing rows by setting a default lot size
*/

-- First, add the lot_id column (optional)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'lot_id'
  ) THEN
    ALTER TABLE lots ADD COLUMN lot_id text;
  END IF;
END $$;

-- Add index on lot_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'lots' AND indexname = 'idx_lots_lot_id'
  ) THEN
    CREATE INDEX idx_lots_lot_id ON lots (lot_id);
  END IF;
END $$;

-- Add lot_size column with a temporary default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'lot_size'
  ) THEN
    -- Add column with a default value equal to ok_parts_produced
    ALTER TABLE lots ADD COLUMN lot_size integer;
    
    -- Update existing rows to set lot_size equal to ok_parts_produced
    UPDATE lots SET lot_size = GREATEST(ok_parts_produced, 1)
    WHERE lot_size IS NULL;
    
    -- Now make the column NOT NULL
    ALTER TABLE lots ALTER COLUMN lot_size SET NOT NULL;
  END IF;
END $$;

-- Add check constraint for lot_size
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'lots' AND constraint_name = 'lots_lot_size_check'
  ) THEN
    ALTER TABLE lots ADD CONSTRAINT lots_lot_size_check CHECK (lot_size > 0);
  END IF;
END $$;

-- Add check constraint to ensure ok_parts_produced doesn't exceed lot_size
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'lots' AND constraint_name = 'lots_ok_parts_check'
  ) THEN
    ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_check 
    CHECK (ok_parts_produced <= lot_size);
  END IF;
END $$;