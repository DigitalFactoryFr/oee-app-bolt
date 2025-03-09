/*
  # Remove Database Constraints
  
  1. Changes
    - Remove all CHECK constraints from tables
    - Keep foreign keys and primary keys for data integrity
    - Keep unique constraints for data uniqueness
    - Keep RLS policies for security

  2. Tables Modified
    - lots
    - lot_tracking
    - stop_events
    - quality_issues
    - plant_configs
    - production_lines
    - machines
    - products
    - team_members

  3. Notes
    - All data is preserved
    - Table structures remain intact
    - Only validation constraints are removed
*/

-- Remove constraints from lots table
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_lot_size_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_ok_parts_produced_check;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_status_check;

-- Remove constraints from lot_tracking table
ALTER TABLE lot_tracking DROP CONSTRAINT IF EXISTS lot_tracking_parts_produced_check;

-- Remove constraints from stop_events table
ALTER TABLE stop_events DROP CONSTRAINT IF EXISTS stop_events_status_check;

-- Remove constraints from quality_issues table
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_quantity_check;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_status_check;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_end_time_check;

-- Remove constraints from plant_configs table
ALTER TABLE plant_configs DROP CONSTRAINT IF EXISTS plant_configs_opening_time_minutes_check;
ALTER TABLE plant_configs DROP CONSTRAINT IF EXISTS plant_configs_import_method_check;
ALTER TABLE plant_configs DROP CONSTRAINT IF EXISTS plant_configs_status_check;

-- Remove constraints from production_lines table
ALTER TABLE production_lines DROP CONSTRAINT IF EXISTS production_lines_opening_time_minutes_check;
ALTER TABLE production_lines DROP CONSTRAINT IF EXISTS production_lines_status_check;

-- Remove constraints from machines table
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_opening_time_minutes_check;
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_status_check;

-- Remove constraints from products table
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_cycle_time_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;

-- Remove constraints from team_members table
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_working_time_minutes_check;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_email_check;