/*
  # Add ongoing status to quality issues

  1. Changes
    - Add `is_ongoing` boolean column to quality_issues table
    - Add status column if not exists
    - Update existing records to have consistent status
    - Add check constraint for end_time based on status
    - Add trigger to handle status changes

  2. Notes
    - When is_ongoing is true, end_time must be null
    - When is_ongoing is false, end_time must be set
    - Existing records are updated to maintain consistency
*/

-- First ensure status column exists and has correct values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quality_issues' AND column_name = 'status'
  ) THEN
    ALTER TABLE quality_issues ADD COLUMN status text DEFAULT 'completed';
  END IF;
END $$;

-- Add is_ongoing column with temporary nullable constraint
ALTER TABLE quality_issues 
ADD COLUMN is_ongoing boolean DEFAULT false;

-- Update existing records to ensure consistency
UPDATE quality_issues
SET 
  is_ongoing = CASE 
    WHEN status = 'ongoing' OR end_time IS NULL THEN true 
    ELSE false 
  END,
  status = CASE
    WHEN end_time IS NULL THEN 'ongoing'
    ELSE 'completed'
  END;

-- Now make is_ongoing not nullable
ALTER TABLE quality_issues 
ALTER COLUMN is_ongoing SET NOT NULL;

-- Add check constraint
ALTER TABLE quality_issues
ADD CONSTRAINT quality_issues_end_time_check 
CHECK (
  (status = 'ongoing' AND end_time IS NULL) OR 
  (status = 'completed' AND end_time IS NOT NULL)
);

-- Create trigger function to handle status changes
CREATE OR REPLACE FUNCTION handle_quality_issue_status() 
RETURNS TRIGGER AS $$
BEGIN
  -- If changing to completed, ensure end_time is set
  IF NEW.status = 'completed' AND NEW.end_time IS NULL THEN
    NEW.end_time := CURRENT_TIMESTAMP;
    NEW.is_ongoing := false;
  END IF;

  -- If changing to ongoing, clear end_time
  IF NEW.status = 'ongoing' THEN
    NEW.end_time := NULL;
    NEW.is_ongoing := true;
  END IF;

  -- Ensure is_ongoing matches status
  NEW.is_ongoing := (NEW.status = 'ongoing');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER quality_issue_status_trigger
  BEFORE UPDATE ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION handle_quality_issue_status();