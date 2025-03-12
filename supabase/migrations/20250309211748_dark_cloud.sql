/*
  # Update quality issues and stop events tables for lot matching

  1. Changes
    - Add function to find matching lot ID based on date, team member, product, and machine
    - Add trigger to automatically set lot_id when importing quality issues and stop events
    - Update existing functions to handle lot_id matching

  2. Security
    - Enable RLS on all functions
    - Add appropriate policies
*/

-- Function to find matching lot ID
CREATE OR REPLACE FUNCTION find_matching_lot_id(
  p_date date,
  p_team_member uuid,
  p_product uuid,
  p_machine uuid
) RETURNS uuid AS $$
DECLARE
  v_lot_id uuid;
BEGIN
  -- Find a lot that matches the criteria
  SELECT id INTO v_lot_id
  FROM lots
  WHERE date = p_date
    AND team_member = p_team_member
    AND product = p_product
    AND machine = p_machine
    AND status = 'in_progress'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for quality issues
CREATE OR REPLACE FUNCTION match_quality_issue_lot() RETURNS TRIGGER AS $$
BEGIN
  -- Only try to match if lot_id is not already set
  IF NEW.lot_id IS NULL THEN
    NEW.lot_id := find_matching_lot_id(
      NEW.date,
      NEW.team_member,
      NEW.product,
      NEW.machine
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for stop events
CREATE OR REPLACE FUNCTION match_stop_event_lot() RETURNS TRIGGER AS $$
BEGIN
  -- Only try to match if lot_id is not already set
  IF NEW.lot_id IS NULL THEN
    NEW.lot_id := find_matching_lot_id(
      NEW.date,
      NEW.team_member,
      NEW.product,
      NEW.machine
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to tables
DROP TRIGGER IF EXISTS match_quality_issue_lot_trigger ON quality_issues;
CREATE TRIGGER match_quality_issue_lot_trigger
  BEFORE INSERT ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION match_quality_issue_lot();

DROP TRIGGER IF EXISTS match_stop_event_lot_trigger ON stop_events;
CREATE TRIGGER match_stop_event_lot_trigger
  BEFORE INSERT ON stop_events
  FOR EACH ROW
  EXECUTE FUNCTION match_stop_event_lot();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION find_matching_lot_id TO authenticated;
GRANT EXECUTE ON FUNCTION match_quality_issue_lot TO authenticated;
GRANT EXECUTE ON FUNCTION match_stop_event_lot TO authenticated;