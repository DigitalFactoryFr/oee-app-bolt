/*
  # Add Lot Tracking and Update Lots Schema

  1. Changes
    - Add theoretical_lot_size column to lots table
    - Add comment column to lots table
    - Create lot_tracking table for hourly production tracking

  2. New Tables
    - lot_tracking
      - id (uuid, primary key)
      - lot_id (uuid, references lots)
      - date (date)
      - start_time (timestamptz)
      - end_time (timestamptz)
      - parts_produced (integer)
      - comment (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  3. Security
    - Enable RLS on lot_tracking table
    - Add policies for authenticated users
*/

-- Add new columns to lots table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'theoretical_lot_size'
  ) THEN
    ALTER TABLE lots ADD COLUMN theoretical_lot_size integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'comment'
  ) THEN
    ALTER TABLE lots ADD COLUMN comment text;
  END IF;
END $$;

-- Create lot_tracking table
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

-- Create policies for lot_tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lot_tracking' AND policyname = 'Users can create tracking entries for their lots'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lot_tracking' AND policyname = 'Users can view tracking entries for their lots'
  ) THEN
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
  END IF;
END $$;

-- Create updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_lot_tracking_updated_at'
  ) THEN
    CREATE TRIGGER update_lot_tracking_updated_at
      BEFORE UPDATE ON lot_tracking
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lot_tracking_lot_id ON lot_tracking(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_date ON lot_tracking(date);