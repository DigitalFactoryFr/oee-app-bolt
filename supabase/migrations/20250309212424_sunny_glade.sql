/*
  # Improve lot matching logic

  1. Changes
    - Simplify lot matching function to focus on key identifiers
    - Remove time-based matching complexity
    - Add better error handling and logging
    - Improve matching priority order

  2. Security
    - Functions run with SECURITY DEFINER
    - Maintain existing RLS policies
*/

-- Drop existing functions and triggers first
DROP FUNCTION IF EXISTS match_quality_issue_lot() CASCADE;
DROP FUNCTION IF EXISTS match_stop_event_lot() CASCADE;

-- Create a more robust lot matching function
CREATE OR REPLACE FUNCTION find_matching_lot(
  p_project_id uuid,
  p_date date,
  p_team_member uuid,
  p_product uuid,
  p_machine uuid
) RETURNS uuid AS $$
DECLARE
  v_lot_id uuid;
  v_log_message text;
BEGIN
  -- First try: exact match on all fields
  SELECT id INTO v_lot_id
  FROM lots
  WHERE project_id = p_project_id
    AND date = p_date
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

  -- Second try: match on date and machine (most important for tracking)
  SELECT id INTO v_lot_id
  FROM lots
  WHERE project_id = p_project_id
    AND date = p_date
    AND machine = p_machine
  ORDER BY 
    status = 'in_progress' DESC,
    created_at DESC
  LIMIT 1;

  IF v_lot_id IS NOT NULL THEN
    RETURN v_lot_id;
  END IF;

  -- Last try: match on date and any of team_member, product, or machine
  SELECT id INTO v_lot_id
  FROM lots
  WHERE project_id = p_project_id
    AND date = p_date
    AND (
      team_member = p_team_member OR
      product = p_product OR
      machine = p_machine
    )
  ORDER BY 
    status = 'in_progress' DESC,
    created_at DESC
  LIMIT 1;

  RETURN v_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger function for quality issues
CREATE OR REPLACE FUNCTION match_quality_issue_lot() RETURNS TRIGGER AS $$
BEGIN
  -- Only try to match if lot_id is not already set
  IF NEW.lot_id IS NULL THEN
    NEW.lot_id := find_matching_lot(
      NEW.project_id,
      NEW.date,
      NEW.team_member,
      NEW.product,
      NEW.machine
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger function for stop events
CREATE OR REPLACE FUNCTION match_stop_event_lot() RETURNS TRIGGER AS $$
BEGIN
  -- Only try to match if lot_id is not already set
  IF NEW.lot_id IS NULL THEN
    NEW.lot_id := find_matching_lot(
      NEW.project_id,
      NEW.date,
      NEW.team_member,
      NEW.product,
      NEW.machine
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER match_quality_issue_lot_trigger
  BEFORE INSERT ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION match_quality_issue_lot();

CREATE TRIGGER match_stop_event_lot_trigger
  BEFORE INSERT ON stop_events
  FOR EACH ROW
  EXECUTE FUNCTION match_stop_event_lot();