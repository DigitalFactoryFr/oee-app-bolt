/*
  # Fix Lot Tracking Schema and Triggers

  1. Changes
    - Drop existing trigger if it exists
    - Recreate trigger with proper function
    - Add missing indexes

  2. Security
    - No changes to security policies
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_lot_tracking_updated_at ON lot_tracking;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_lot_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_lot_tracking_updated_at
  BEFORE UPDATE ON lot_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_lot_tracking_updated_at();

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_lot_tracking_start_time ON lot_tracking(start_time);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_end_time ON lot_tracking(end_time);