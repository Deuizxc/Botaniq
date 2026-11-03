CREATE TABLE IF NOT EXISTS task_messages (
  message_id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES maintenance_tasks(task_id),
  staff_id INTEGER NOT NULL REFERENCES users(user_id),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
ALTER TABLE nutrient_logs ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES maintenance_tasks(task_id);
ALTER TABLE nutrient_logs ADD COLUMN IF NOT EXISTS applied_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS one_application_per_task ON nutrient_logs(task_id) WHERE task_id IS NOT NULL;
