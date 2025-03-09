/*
  # Add theoretical lot size and comments to lots table

  1. Changes
    - Add theoretical_lot_size column to lots table
    - Add comment column to lots table
    - Create new lot_tracking table for hourly production tracking

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
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Add new columns to lots table
ALTER TABLE lots 
ADD COLUMN theoretical_lot_size integer,
ADD COLUMN comment text;

-- Create lot tracking table
CREATE TABLE lot_tracking (
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

-- Create policies
CREATE POLICY "Users can create lot tracking entries for their lots"
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

CREATE POLICY "Users can view lot tracking entries for their lots"
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

-- Add trigger to update updated_at
CREATE TRIGGER update_lot_tracking_updated_at
  BEFORE UPDATE ON lot_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();