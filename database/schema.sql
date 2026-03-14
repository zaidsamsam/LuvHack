CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  base_wait_time int4 NOT NULL,
  facility_type text NOT NULL,
  is_trauma_center bool NOT NULL
);

-- Seed data for 10 fake locations around a central area (e.g., Downtown Chicago, 41.8781, -87.6298)
INSERT INTO hospitals (name, latitude, longitude, base_wait_time, facility_type, is_trauma_center) VALUES
('Mercy ER Hospital', 41.88, -87.63, 120, 'ER', true),
('Lakeshore Urgent Care', 41.89, -87.61, 45, 'UrgentCare', false),
('River North General', 41.89, -87.63, 90, 'ER', true),
('Westside Medical Center', 41.87, -87.65, 180, 'ER', false),
('South Loop Emergency', 41.86, -87.62, 50, 'ER', false),
('Pilsen Urgent Care', 41.85, -87.66, 15, 'UrgentCare', false),
('Lincoln Park Hospital', 41.92, -87.64, 110, 'ER', true),
('Lakeview Express Clinic', 41.94, -87.65, 20, 'UrgentCare', false),
('Wicker Park Urgent Care', 41.91, -87.67, 30, 'UrgentCare', false),
('Downtown Express Care', 41.88, -87.62, 25, 'UrgentCare', false);
