/*
  # Add Lot Status and Improve Tracking

  1. Changes
    - Add status field to lots table
    - Add constraints for lot status values
    - Add indexes for better performance
    - Add RLS policies for status updates

  2. Security
    - Enable RLS policies for status updates
    - Ensure proper access control
*/

-- Add status to lots table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'status'
  ) THEN
    ALTER TABLE lots ADD COLUMN status text DEFAULT 'in_progress'::text;
    ALTER TABLE lots ADD CONSTRAINT lots_status_check CHECK (status = ANY (ARRAY['in_progress'::text, 'completed'::text]));
  END IF;
END $$;

-- Add index for status field
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);

-- Create policy for updating lot status
DROP POLICY IF EXISTS "Users can update lot status" ON lots;
CREATE POLICY "Users can update lot status"
  ON lots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lots.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lots.project_id
      AND projects.user_id = auth.uid()
    )
  );