/*
  # Update Quality Issues Schema

  1. Changes
    - Remove category constraint to allow any string value
    - Add index on category column for better performance
*/

-- Remove existing category constraint
ALTER TABLE quality_issues 
DROP CONSTRAINT IF EXISTS quality_issues_category_check;

-- Add index for category column
CREATE INDEX IF NOT EXISTS idx_quality_issues_category ON quality_issues(category);