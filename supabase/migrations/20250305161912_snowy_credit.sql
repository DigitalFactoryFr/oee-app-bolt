/*
  # Remove Constraints and Add Performance Indexes

  1. Changes
    - Remove check constraints for failure_type and category
    - Add indexes for better query performance

  2. Details
    - Remove constraints to allow more flexibility
    - Add indexes on commonly queried columns for better performance
    - Keep foreign key constraints and other data integrity checks

  3. Notes
    - Failure types commonly used: AP, PA, DO, NQ, CS
    - Quality categories commonly used: rework, out_of_station, scrap
    - These are now recommendations rather than enforced constraints
*/

-- Remove check constraints
ALTER TABLE stop_events
DROP CONSTRAINT IF EXISTS stop_events_failure_type_check;

ALTER TABLE quality_issues
DROP CONSTRAINT IF EXISTS quality_issues_category_check;

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

-- Add comments to document recommended values
COMMENT ON COLUMN stop_events.failure_type IS 
'Recommended failure types: AP (Planned downtime), PA (Equipment breakdown), DO (Organized malfunction), NQ (Non-quality issue), CS (Series change)';

COMMENT ON COLUMN quality_issues.category IS
'Recommended quality categories: rework, out_of_station, scrap';