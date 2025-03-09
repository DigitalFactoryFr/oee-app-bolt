/*
  # Add lot tracking table

  1. New Tables
    - `lot_tracking`
      - `id` (uuid, primary key)
      - `lot_id` (uuid, references lots)
      - `date` (date)
      - `start_time` (timestamp)
      - `end_time` (timestamp)
      - `parts_produced` (integer)
      - `comment` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `lot_tracking` table
    - Add policies for authenticated users to manage their lot tracking entries
*/

-- Drop existing indexes if they exist
DO $$ BEGIN
  DROP INDEX IF EXISTS idx_lot_tracking_lot_id;
  DROP INDEX IF EXISTS idx_lot_tracking_date;
  DROP INDEX IF EXISTS idx_lot_tracking_start_time;
  DROP INDEX IF EXISTS idx_lot_tracking_end_time;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create lot tracking table
CREATE TABLE IF NOT EXISTS lot_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  parts_produced integer NOT NULL CHECK (parts_produced >= 0),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lot_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can create tracking entries for their lots" ON lot_tracking;
  DROP POLICY IF EXISTS "Users can view tracking entries for their lots" ON lot_tracking;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Users can create tracking entries for their lots"
  ON lot_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lots
      WHERE lots.id = lot_tracking.lot_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = lots.project_id
        AND projects.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view tracking entries for their lots"
  ON lot_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lots
      WHERE lots.id = lot_tracking.lot_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = lots.project_id
        AND projects.user_id = auth.uid()
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lot_tracking_lot_id ON lot_tracking(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_date ON lot_tracking(date);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_start_time ON lot_tracking(start_time);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_end_time ON lot_tracking(end_time);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_lot_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lot_tracking_updated_at ON lot_tracking;

CREATE TRIGGER update_lot_tracking_updated_at
  BEFORE UPDATE ON lot_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_lot_tracking_updated_at();