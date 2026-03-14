-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add location column as geography type to support ST_DWithin accurately using meters
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- 3. Create a spatial index for fast nearest-neighbor/radius queries
CREATE INDEX IF NOT EXISTS hospitals_location_gix ON hospitals USING GIST (location);

-- 4. Create the function to find nearest hospitals within a given radius in meters
-- It returns up to 25 items to limit Matrix API payload per PRD
CREATE OR REPLACE FUNCTION get_nearest_hospitals(user_lat float, user_lng float, radius_meters float)
RETURNS TABLE (
  id uuid,
  name text,
  latitude float8,
  longitude float8,
  base_wait_time int4,
  facility_type text,
  is_trauma_center bool,
  distance float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.latitude,
    h.longitude,
    h.base_wait_time,
    h.facility_type,
    h.is_trauma_center,
    ST_Distance(h.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS distance
  FROM hospitals h
  WHERE ST_DWithin(
    h.location, 
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, 
    radius_meters
  )
  ORDER BY h.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  LIMIT 25;
END;
$$ LANGUAGE plpgsql;
