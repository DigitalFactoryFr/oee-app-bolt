/*
  # Add Quality Issues Indexes and Relationships

  1. Changes
    - Add index on lot_id for quality_issues table
    - Add index on start_time and end_time for quality_issues table
    - Add foreign key relationship to lots table
    - Add status column for tracking ongoing/completed issues

  2. Indexes
    - lot_id: For faster lookups of quality issues by lot
    - start_time, end_time: For time-based queries and filtering
    - status: For filtering by issue status

  3. Security
    - Update RLS policies to include new columns
*/

-- Add lot_id column and index
ALTER TABLE quality_issues 
ADD COLUMN lot_id uuid REFERENCES lots(id) ON DELETE CASCADE,
ADD COLUMN start_time timestamptz,
ADD COLUMN end_time timestamptz,
ADD COLUMN status text DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed'));

-- Create indexes
CREATE INDEX idx_quality_issues_lot_id ON quality_issues(lot_id);
CREATE INDEX idx_quality_issues_start_time ON quality_issues(start_time);
CREATE INDEX idx_quality_issues_end_time ON quality_issues(end_time);
CREATE INDEX idx_quality_issues_status ON quality_issues(status);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can create quality issues in their projects" ON quality_issues;
DROP POLICY IF EXISTS "Users can view their own quality issues" ON quality_issues;

CREATE POLICY "Users can create quality issues in their projects"
ON quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = quality_issues.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own quality issues"
ON quality_issues
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = quality_issues.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own quality issues"
ON quality_issues
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = quality_issues.project_id 
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = quality_issues.project_id 
    AND projects.user_id = auth.uid()
  )
);