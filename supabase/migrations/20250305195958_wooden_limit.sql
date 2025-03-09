/*
  # Add lot tracking fields to lots table

  1. Changes
    - Add lot_id column (optional text field) for external lot identification
    - Add lot_size column (required integer field) to track total parts in lot
    - Add index on lot_id for faster lookups
    - Add constraints to ensure data integrity:
      - lot_size must be greater than 0
      - ok_parts_produced cannot exceed lot_size

  2. Notes
    - Handles existing data by setting default lot_size equal to ok_parts_produced
    - Uses DO blocks to safely handle existing constraints
    - Ensures all constraints are satisfied before applying them
*/

-- First, check if lot_id column exists and add it if not
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'lot_id'
  ) THEN
    ALTER TABLE lots ADD COLUMN lot_id text;
  END IF;
END $$;

-- Create index on lot_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'lots' AND indexname = 'idx_lots_lot_id'
  ) THEN
    CREATE INDEX idx_lots_lot_id ON lots (lot_id);
  END IF;
END $$;

-- Add lot_size column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'lot_size'
  ) THEN
    ALTER TABLE lots ADD COLUMN lot_size integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Update existing rows to set lot_size equal to ok_parts_produced if it's greater than 1
UPDATE lots SET lot_size = GREATEST(ok_parts_produced, 1);

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  -- Drop lot_size check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'lots' AND constraint_name = 'lots_lot_size_check'
  ) THEN
    ALTER TABLE lots DROP CONSTRAINT lots_lot_size_check;
  END IF;

  -- Drop ok_parts check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'lots' AND constraint_name = 'lots_ok_parts_check'
  ) THEN
    ALTER TABLE lots DROP CONSTRAINT lots_ok_parts_check;
  END IF;
END $$;

-- Add check constraints
ALTER TABLE lots ADD CONSTRAINT lots_lot_size_check CHECK (lot_size > 0);
ALTER TABLE lots ADD CONSTRAINT lots_ok_parts_check CHECK (ok_parts_produced <= lot_size);