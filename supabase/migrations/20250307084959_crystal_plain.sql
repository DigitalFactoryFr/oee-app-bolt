/*
  # Add ongoing flag to quality issues

  1. Changes
    - Add `is_ongoing` boolean column to quality_issues table with default false
    - Add check constraint to ensure is_ongoing is not null
    - Add trigger to handle ongoing status changes

  2. Notes
    - When is_ongoing is true, end_time can be null
    - When is_ongoing is false, end_time must be set
    - start_time and date remain unchanged regardless of ongoing status
*/

-- Add is_ongoing column
ALTER TABLE quality_issues 
ADD COLUMN is_ongoing boolean NOT NULL DEFAULT false;

-- Add check constraint
ALTER TABLE quality_issues
ADD CONSTRAINT quality_issues_ongoing_check 
CHECK (
  (is_ongoing = true AND end_time IS NULL) OR 
  (is_ongoing = false AND end_time IS NOT NULL)
);

-- Create trigger function to handle ongoing status changes
CREATE OR REPLACE FUNCTION handle_quality_issue_ongoing() 
RETURNS TRIGGER AS $$
BEGIN
  -- If changing from ongoing to not ongoing, set end_time to current timestamp
  IF OLD.is_ongoing = true AND NEW.is_ongoing = false AND NEW.end_time IS NULL THEN
    NEW.end_time := CURRENT_TIMESTAMP;
  END IF;

  -- If changing to ongoing, clear end_time
  IF NEW.is_ongoing = true THEN
    NEW.end_time := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER quality_issue_ongoing_trigger
  BEFORE UPDATE ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION handle_quality_issue_ongoing();