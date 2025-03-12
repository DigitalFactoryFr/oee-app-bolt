/*
  # Simplify lot matching logic

  1. Changes
    - Remove time-based matching from lot finding function
    - Focus on date and production resources only
    - Improve matching priority order
    - Maintain existing RLS policies

  2. Security
    - Functions run with SECURITY DEFINER
    - No changes to existing RLS policies
*/

-- Function to find matching lot ID without time consideration
CREATE OR REPLACE FUNCTION find_matching_lot_id(
  p_date date,
  p_team_member uuid,
  p_product uuid,
  p_machine uuid
) RETURNS uuid AS $$
DECLARE
  v_lot_id uuid;
BEGIN
  -- Try matching based on date and all production resources
  SELECT id INTO v_lot_id
  FROM lots
  WHERE date = p_date
    AND team_member = p_team_member
    AND product = p_product
    AND machine = p_machine
  ORDER BY 
    status = 'in_progress' DESC, -- Prefer active lots
    created_at DESC -- Then most recent
  LIMIT 1;

  IF v_lot_id IS NOT NULL THEN
    RETURN v_lot_id;
  END IF;

  -- Try matching based on date and machine only
  SELECT id INTO v_lot_id
  FROM lots
  WHERE date = p_date
    AND machine = p_machine
  ORDER BY 
    status = 'in_progress' DESC,
    created_at DESC
  LIMIT 1;

  IF v_lot_id IS NOT NULL THEN
    RETURN v_lot_id;
  END IF;

  -- If still no match, try finding any lot from the same day with at least one matching resource
  SELECT id INTO v_lot_id
  FROM lots
  WHERE date = p_date
    AND (
      machine = p_machine OR
      product = p_product OR
      team_member = p_team_member
    )
  ORDER BY 
    status = 'in_progress' DESC,
    created_at DESC
  LIMIT 1;

  RETURN v_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated trigger function for quality issues
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

-- Updated trigger function for stop events
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

-- Drop and recreate triggers to ensure they use the latest functions
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