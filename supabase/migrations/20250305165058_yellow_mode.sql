/*
  # Update Time Columns for Lots and Stop Events

  1. Changes
    - Add start_time and end_time columns to lots table
    - Add start_time and end_time columns to stop_events table
    - Remove duration column from stop_events table

  2. Details
    - New columns use timestamptz type for timezone support
    - Columns are nullable to allow gradual migration
    - Indexes added for performance optimization

  3. Notes
    - Existing duration data should be migrated before removing the column
    - Times should be in UTC format
*/

-- Add time columns to lots table
ALTER TABLE lots 
ADD COLUMN start_time timestamptz,
ADD COLUMN end_time timestamptz;

-- Add indexes for lots time columns
CREATE INDEX IF NOT EXISTS idx_lots_start_time ON lots(start_time);
CREATE INDEX IF NOT EXISTS idx_lots_end_time ON lots(end_time);

-- Add time columns to stop_events table
ALTER TABLE stop_events 
ADD COLUMN start_time timestamptz,
ADD COLUMN end_time timestamptz;

-- Add indexes for stop_events time columns
CREATE INDEX IF NOT EXISTS idx_stop_events_start_time ON stop_events(start_time);
CREATE INDEX IF NOT EXISTS idx_stop_events_end_time ON stop_events(end_time);

-- Remove duration column from stop_events
-- Note: In a production environment, you would want to migrate the data first
ALTER TABLE stop_events DROP COLUMN duration;