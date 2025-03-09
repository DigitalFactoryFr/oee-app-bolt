/*
  # Add Constraints for Failure Types and Quality Categories

  1. Changes
    - Add check constraint for failure_type in stop_events table
    - Add check constraint for category in quality_issues table

  2. Details
    - Failure types must be one of: AP, PA, DO, NQ, CS
    - Quality categories must be one of: rework, out_of_station, scrap

  3. Notes
    - These constraints ensure data integrity at the database level
    - Invalid values will be rejected by the database
*/

-- Add check constraint for failure types
ALTER TABLE stop_events
DROP CONSTRAINT IF EXISTS stop_events_failure_type_check;

ALTER TABLE stop_events
ADD CONSTRAINT stop_events_failure_type_check
CHECK (failure_type IN ('AP', 'PA', 'DO', 'NQ', 'CS'));

-- Add check constraint for quality categories
ALTER TABLE quality_issues
DROP CONSTRAINT IF EXISTS quality_issues_category_check;

ALTER TABLE quality_issues
ADD CONSTRAINT quality_issues_category_check
CHECK (category IN ('rework', 'out_of_station', 'scrap'));

-- Add comments to explain the constraints
COMMENT ON CONSTRAINT stop_events_failure_type_check ON stop_events IS 
'Failure types must be one of: AP (Planned downtime), PA (Equipment breakdown), DO (Organized malfunction), NQ (Non-quality issue), CS (Series change)';

COMMENT ON CONSTRAINT quality_issues_category_check ON quality_issues IS
'Quality categories must be one of: rework, out_of_station, scrap';