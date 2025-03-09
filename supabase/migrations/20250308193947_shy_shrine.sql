/*
  # Remove theoretical lot size column

  1. Changes
    - Remove theoretical_lot_size column from lots table
    - Update lot_size to be required and non-null
    - Add check constraint to ensure lot_size is positive

  2. Notes
    - Existing lot_size values are preserved
    - No data loss since theoretical_lot_size was only used for suggestions
*/

-- Remove theoretical_lot_size column
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'theoretical_lot_size'
  ) THEN
    ALTER TABLE lots DROP COLUMN theoretical_lot_size;
  END IF;
END $$;

-- Ensure lot_size is required and positive
ALTER TABLE lots 
  ALTER COLUMN lot_size SET NOT NULL,
  ADD CONSTRAINT lots_lot_size_check CHECK (lot_size > 0);