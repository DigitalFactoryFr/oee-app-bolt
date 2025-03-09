/*
  # Fix lot tracking functionality

  1. Changes
    - Add auto_ok_parts_produced column to lots table
    - Add theoretical_lot_size column to lots table
    - Add comment column to lots table
    - Create lot_tracking table with proper relationships and policies
    - Add triggers for automatic parts calculation

  2. Security
    - Enable RLS on lot_tracking table
    - Add policies for authenticated users
*/

-- Add new columns to lots table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lots' AND column_name = 'auto_ok_parts_produced'
  ) THEN
    ALTER TABLE lots ADD COLUMN auto_ok_parts_produced integer DEFAULT 0;
  END IF;

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

-- Create lot_tracking table if it doesn't exist
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

-- Create function to update lot's auto_ok_parts_produced
CREATE OR REPLACE FUNCTION update_lot_auto_parts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE lots
    SET auto_ok_parts_produced = (
      SELECT COALESCE(SUM(parts_produced), 0)
      FROM lot_tracking
      WHERE lot_id = NEW.lot_id
    )
    WHERE id = NEW.lot_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE lots
    SET auto_ok_parts_produced = (
      SELECT COALESCE(SUM(parts_produced), 0)
      FROM lot_tracking
      WHERE lot_id = OLD.lot_id
    )
    WHERE id = OLD.lot_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lot_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create policies for lot_tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create tracking entries for their lots'
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
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view tracking entries for their lots'
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

-- Create triggers if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_lot_auto_parts_trigger'
  ) THEN
    CREATE TRIGGER update_lot_auto_parts_trigger
      AFTER INSERT OR UPDATE OR DELETE ON lot_tracking
      FOR EACH ROW
      EXECUTE FUNCTION update_lot_auto_parts();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_lot_tracking_updated_at'
  ) THEN
    CREATE TRIGGER update_lot_tracking_updated_at
      BEFORE UPDATE ON lot_tracking
      FOR EACH ROW
      EXECUTE FUNCTION update_lot_tracking_updated_at();
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lot_tracking_lot_id ON lot_tracking(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_date ON lot_tracking(date);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_start_time ON lot_tracking(start_time);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_end_time ON lot_tracking(end_time);