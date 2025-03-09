/*
  # Update plant address structure

  1. Changes
    - Replace individual address fields with a single address field
    - Add place_id field for Google Places API integration
    - Add coordinates fields for latitude and longitude

  2. Security
    - Maintains existing RLS policies
*/

ALTER TABLE plant_configs 
  DROP COLUMN IF EXISTS street_address,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS country;

ALTER TABLE plant_configs
  ADD COLUMN address text,
  ADD COLUMN place_id text,
  ADD COLUMN latitude numeric(10,8),
  ADD COLUMN longitude numeric(11,8);