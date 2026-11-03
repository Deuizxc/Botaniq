ALTER TABLE crop_cycles ADD COLUMN planting_stage TEXT CHECK (planting_stage IN ('Seedling','Fully grown plant'));
ALTER TABLE maintenance_tasks ADD COLUMN covered_for_id INTEGER REFERENCES users(user_id);
CREATE TABLE coverage_invites (
  invite_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES maintenance_tasks(task_id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES users(user_id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(task_id, staff_id)
);
CREATE TABLE login_failures (
  client_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT NOT NULL
);
