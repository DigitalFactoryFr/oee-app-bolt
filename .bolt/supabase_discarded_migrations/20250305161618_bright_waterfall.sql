/*
  # Add Data Constraints and Indexes

  1. Changes
    - Add check constraint for failure_type in stop_events table
    - Add check constraint for category in quality_issues table
    - Add indexes for better query performance

  2. Details
    - Failure types must be one of: AP, PA, DO, NQ, CS
      - AP: Planned downtime
      - PA: Equipment breakdown
      - DO: Organized malfunction
      - NQ: Non-quality issue
      - CS: Series change
    - Quality categories must be one of: rework, out_of_station, scrap
    - Added indexes on commonly queried columns

  3. Notes
    - These constraints ensure data integrity
    - Indexes improve query performance
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

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lots_date ON lots(date);
CREATE INDEX IF NOT EXISTS idx_lots_team_member ON lots(team_member);
CREATE INDEX IF NOT EXISTS idx_lots_product ON lots(product);
CREATE INDEX IF NOT EXISTS idx_lots_machine ON lots(machine);

CREATE INDEX IF NOT EXISTS idx_stop_events_date ON stop_events(date);
CREATE INDEX IF NOT EXISTS idx_stop_events_team_member ON stop_events(team_member);
CREATE INDEX IF NOT EXISTS idx_stop_events_product ON stop_events(product);
CREATE INDEX IF NOT EXISTS idx_stop_events_machine ON stop_events(machine);
CREATE INDEX IF NOT EXISTS idx_stop_events_failure_type ON stop_events(failure_type);

CREATE INDEX IF NOT EXISTS idx_quality_issues_date ON quality_issues(date);
CREATE INDEX IF NOT EXISTS idx_quality_issues_team_member ON quality_issues(team_member);
CREATE INDEX IF NOT EXISTS idx_quality_issues_product ON quality_issues(product);
CREATE INDEX IF NOT EXISTS idx_quality_issues_machine ON quality_issues(machine);
CREATE INDEX IF NOT EXISTS idx_quality_issues_category ON quality_issues(category);

-- Add comments to explain the constraints
COMMENT ON CONSTRAINT stop_events_failure_type_check ON stop_events IS 
'Failure types must be one of: AP (Planned downtime), PA (Equipment breakdown), DO (Organized malfunction), NQ (Non-quality issue), CS (Series change)';

COMMENT ON CONSTRAINT quality_issues_category_check ON quality_issues IS
'Quality categories must be one of: rework, out_of_station, scrap';