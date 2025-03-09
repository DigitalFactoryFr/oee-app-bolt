/*
  # Remove theoretical_lot_size column from lots table

  1. Changes
    - Remove theoretical_lot_size column from lots table
    - This change simplifies the data model by using only lot_size
    - No data loss as lot_size already contains the actual production target

  2. Security
    - No security changes needed
    - Existing RLS policies remain unchanged
*/

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'theoretical_lot_size'
  ) THEN
    ALTER TABLE lots DROP COLUMN theoretical_lot_size;
  END IF;
END $$;