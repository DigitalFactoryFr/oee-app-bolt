/*
  # Update OEE calculation functions

  1. New Functions
    - calculate_lot_oee: Calculates OEE metrics for a single lot
    - calculate_machine_oee: Calculates OEE metrics for a machine over a period
    - calculate_global_oee: Calculates global OEE metrics for a project

  2. Changes
    - Fixed loop variable declarations
    - Improved lot matching logic
    - Added helper functions for time calculations
    - Added better error handling

  3. Security
    - All functions run with SECURITY DEFINER
    - Maintain existing RLS policies
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS calculate_lot_oee CASCADE;
DROP FUNCTION IF EXISTS calculate_machine_oee CASCADE;
DROP FUNCTION IF EXISTS calculate_global_oee CASCADE;

-- Helper function to calculate time difference in hours
CREATE OR REPLACE FUNCTION get_time_diff_hours(start_time timestamptz, end_time timestamptz)
RETURNS float AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate OEE metrics for a single lot
CREATE OR REPLACE FUNCTION calculate_lot_oee(
  p_lot_id uuid
) RETURNS TABLE (
  oee float,
  availability float,
  performance float,
  quality float,
  useful_time float,
  opening_time float
) AS $$
DECLARE
  v_lot RECORD;
  v_cycle_time float;
  v_opening_time float;
  v_useful_time float;
  v_planned_downtime float := 0;
  v_total_parts integer := 0;
  v_ok_parts integer := 0;
BEGIN
  -- Get lot data
  SELECT l.*, p.cycle_time 
  INTO v_lot
  FROM lots l
  JOIN products p ON p.id = l.product
  WHERE l.id = p_lot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot not found';
  END IF;

  -- Calculate opening time
  v_opening_time := get_time_diff_hours(v_lot.start_time, COALESCE(v_lot.end_time, now()));

  -- Get planned downtime
  SELECT COALESCE(SUM(get_time_diff_hours(start_time, COALESCE(end_time, now()))), 0)
  INTO v_planned_downtime
  FROM stop_events
  WHERE lot_id = p_lot_id
  AND failure_type = 'AP';

  -- Get quality data
  v_ok_parts := v_lot.ok_parts_produced;
  
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_parts
  FROM quality_issues
  WHERE lot_id = p_lot_id;
  
  v_total_parts := v_total_parts + v_ok_parts;

  -- Calculate metrics
  v_useful_time := (v_lot.cycle_time * v_total_parts) / 3600.0;
  
  -- Calculate OEE components
  availability := CASE 
    WHEN v_opening_time > 0 THEN ((v_opening_time - v_planned_downtime) / v_opening_time) * 100
    ELSE 100
  END;

  performance := CASE 
    WHEN v_useful_time > 0 THEN (v_ok_parts / v_total_parts) * 100
    ELSE 0
  END;

  quality := CASE 
    WHEN v_total_parts > 0 THEN (v_ok_parts::float / v_total_parts::float) * 100
    ELSE 100
  END;

  -- Calculate final OEE
  oee := (availability * performance * quality) / 10000.0;

  -- Return all metrics
  RETURN QUERY SELECT 
    LEAST(100, GREATEST(0, oee)),
    LEAST(100, GREATEST(0, availability)),
    LEAST(100, GREATEST(0, performance)),
    LEAST(100, GREATEST(0, quality)),
    v_useful_time,
    v_opening_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate OEE metrics for a machine over a period
CREATE OR REPLACE FUNCTION calculate_machine_oee(
  p_machine_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS TABLE (
  oee float,
  availability float,
  performance float,
  quality float,
  total_useful_time float,
  total_opening_time float
) AS $$
DECLARE
  v_lot RECORD;
  v_total_useful_time float := 0;
  v_total_opening_time float := 0;
  v_total_ok_parts integer := 0;
  v_total_parts integer := 0;
  v_total_planned_downtime float := 0;
  v_lot_metrics RECORD;
BEGIN
  -- Get all lots for this machine in the period
  FOR v_lot IN
    SELECT l.*, p.cycle_time
    FROM lots l
    JOIN products p ON p.id = l.product
    WHERE l.machine = p_machine_id
    AND l.date BETWEEN p_start_date AND p_end_date
  LOOP
    -- Calculate times for this lot
    SELECT * INTO v_lot_metrics FROM calculate_lot_oee(v_lot.id);
    
    v_total_useful_time := v_total_useful_time + v_lot_metrics.useful_time;
    v_total_opening_time := v_total_opening_time + v_lot_metrics.opening_time;
    
    -- Accumulate parts counts
    v_total_ok_parts := v_total_ok_parts + v_lot.ok_parts_produced;
    
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_parts
    FROM quality_issues
    WHERE lot_id = v_lot.id;
    
    v_total_parts := v_total_parts + v_lot.ok_parts_produced;
  END LOOP;

  -- Calculate final metrics
  availability := CASE 
    WHEN v_total_opening_time > 0 THEN ((v_total_opening_time - v_total_planned_downtime) / v_total_opening_time) * 100
    ELSE 100
  END;

  performance := CASE 
    WHEN v_total_useful_time > 0 THEN (v_total_ok_parts::float / v_total_parts::float) * 100
    ELSE 0
  END;

  quality := CASE 
    WHEN v_total_parts > 0 THEN (v_total_ok_parts::float / v_total_parts::float) * 100
    ELSE 100
  END;

  oee := (availability * performance * quality) / 10000.0;

  -- Return all metrics
  RETURN QUERY SELECT 
    LEAST(100, GREATEST(0, oee)),
    LEAST(100, GREATEST(0, availability)),
    LEAST(100, GREATEST(0, performance)),
    LEAST(100, GREATEST(0, quality)),
    v_total_useful_time,
    v_total_opening_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate global OEE metrics for a project
CREATE OR REPLACE FUNCTION calculate_global_oee(
  p_project_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS TABLE (
  oee float,
  availability float,
  performance float,
  quality float,
  total_useful_time float,
  total_opening_time float
) AS $$
DECLARE
  v_lot RECORD;
  v_total_useful_time float := 0;
  v_total_opening_time float := 0;
  v_total_ok_parts integer := 0;
  v_total_parts integer := 0;
  v_total_planned_downtime float := 0;
  v_lot_metrics RECORD;
BEGIN
  -- Get all lots for this project in the period
  FOR v_lot IN
    SELECT l.*, p.cycle_time
    FROM lots l
    JOIN products p ON p.id = l.product
    WHERE l.project_id = p_project_id
    AND l.date BETWEEN p_start_date AND p_end_date
  LOOP
    -- Calculate times for this lot
    SELECT * INTO v_lot_metrics FROM calculate_lot_oee(v_lot.id);
    
    v_total_useful_time := v_total_useful_time + v_lot_metrics.useful_time;
    v_total_opening_time := v_total_opening_time + v_lot_metrics.opening_time;
    
    -- Accumulate parts counts
    v_total_ok_parts := v_total_ok_parts + v_lot.ok_parts_produced;
    
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_parts
    FROM quality_issues
    WHERE lot_id = v_lot.id;
    
    v_total_parts := v_total_parts + v_lot.ok_parts_produced;
  END LOOP;

  -- Calculate final metrics
  availability := CASE 
    WHEN v_total_opening_time > 0 THEN ((v_total_opening_time - v_total_planned_downtime) / v_total_opening_time) * 100
    ELSE 100
  END;

  performance := CASE 
    WHEN v_total_useful_time > 0 THEN (v_total_ok_parts::float / v_total_parts::float) * 100
    ELSE 0
  END;

  quality := CASE 
    WHEN v_total_parts > 0 THEN (v_total_ok_parts::float / v_total_parts::float) * 100
    ELSE 100
  END;

  oee := (availability * performance * quality) / 10000.0;

  -- Return all metrics
  RETURN QUERY SELECT 
    LEAST(100, GREATEST(0, oee)),
    LEAST(100, GREATEST(0, availability)),
    LEAST(100, GREATEST(0, performance)),
    LEAST(100, GREATEST(0, quality)),
    v_total_useful_time,
    v_total_opening_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;