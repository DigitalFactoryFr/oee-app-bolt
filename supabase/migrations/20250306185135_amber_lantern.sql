/*
  # Update Quality Issues Schema

  1. Changes
    - Update quality issue categories to:
      - at_station_rework: Parts reworked directly on the machine
      - off_station_rework: Parts reworked outside the station
      - scrap: Parts that cannot be recovered
    - Add start_time and end_time columns
    - Add lot_id reference
    - Add status column
    - Add indexes for performance

  2. Security
    - Maintain existing RLS policies
*/

-- Update category enum type
ALTER TABLE quality_issues 
DROP CONSTRAINT IF EXISTS quality_issues_category_check;

ALTER TABLE quality_issues
ADD CONSTRAINT quality_issues_category_check 
CHECK (category IN ('at_station_rework', 'off_station_rework', 'scrap'));

-- Add new columns
ALTER TABLE quality_issues
ADD COLUMN IF NOT EXISTS start_time timestamptz,
ADD COLUMN IF NOT EXISTS end_time timestamptz,
ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES lots(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_quality_issues_start_time ON quality_issues(start_time);
CREATE INDEX IF NOT EXISTS idx_quality_issues_end_time ON quality_issues(end_time);
CREATE INDEX IF NOT EXISTS idx_quality_issues_lot_id ON quality_issues(lot_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_status ON quality_issues(status);