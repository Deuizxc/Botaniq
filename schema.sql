CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Admin','Staff')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS plants (
  plant_id SERIAL PRIMARY KEY,
  crop_name CITEXT NOT NULL,
  variety TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS plants_name_variety_key
  ON plants (LOWER(BTRIM(crop_name::text)), LOWER(BTRIM(variety)));

CREATE TABLE IF NOT EXISTS plots (
  plot_id SERIAL PRIMARY KEY,
  plot_code CITEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL CHECK(zone IN ('Outdoor','Greenhouse','Nursery')),
  occupancy_status TEXT NOT NULL DEFAULT 'Vacant' CHECK(occupancy_status IN ('Vacant','Occupied','Harvested'))
);

CREATE TABLE IF NOT EXISTS crop_cycles (
  cycle_id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(plant_id),
  origin_plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
  current_plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
  assigned_staff_id INTEGER REFERENCES users(user_id),
  planted_date TEXT NOT NULL,
  transplanted_date TEXT,
  harvest_date TEXT,
  cycle_status TEXT NOT NULL CHECK(cycle_status IN ('In Nursery','Active in Plot','Harvested')),
  CHECK(harvest_date IS NULL OR harvest_date >= planted_date),
  CHECK(transplanted_date IS NULL OR transplanted_date >= planted_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_live_cycle_per_plot ON crop_cycles(current_plot_id) WHERE harvest_date IS NULL;
CREATE INDEX IF NOT EXISTS cycle_harvest_date ON crop_cycles(harvest_date);

CREATE TABLE IF NOT EXISTS maintenance_tasks (
  task_id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
  task_type TEXT NOT NULL CHECK(task_type IN ('Manual watering','Fertilizer application','Hydroponic nutrients','General maintenance')),
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  assigned_staff_id INTEGER REFERENCES users(user_id),
  substitute_staff_id INTEGER REFERENCES users(user_id),
  takeover_reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Completed','Skipped')),
  is_flagged_for_admin INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  reviewed_at TEXT,
  reviewed_by INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS task_adjustments (
  adjustment_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES maintenance_tasks(task_id),
  staff_id INTEGER NOT NULL REFERENCES users(user_id),
  reason TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_schedule TEXT NOT NULL,
  new_schedule TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrient_logs (
  log_id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
  staff_id INTEGER NOT NULL REFERENCES users(user_id),
  application_date TEXT NOT NULL,
  nutrient_type TEXT NOT NULL CHECK(nutrient_type IN ('Fertilizer','Hydroponic nutrient')),
  product TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE OR REPLACE VIEW cycle_details AS
SELECT c.*, p.plot_code, p.zone, pl.crop_name, pl.variety, u.full_name AS assigned_staff, o.plot_code AS origin_plot
FROM crop_cycles c
JOIN plots p ON c.current_plot_id = p.plot_id
JOIN plots o ON c.origin_plot_id = o.plot_id
JOIN plants pl ON c.plant_id = pl.plant_id
LEFT JOIN users u ON c.assigned_staff_id = u.user_id;
