-- Targeted indexes for frequent staff/plot filters, session cleanup, and history lookups.
CREATE INDEX IF NOT EXISTS tasks_staff_status ON maintenance_tasks(assigned_staff_id, status, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS tasks_plot_status ON maintenance_tasks(plot_id, status);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS nutrient_logs_plot_date ON nutrient_logs(plot_id, application_date DESC, log_id DESC);
CREATE INDEX IF NOT EXISTS task_adjustments_task ON task_adjustments(task_id);
CREATE INDEX IF NOT EXISTS task_messages_task ON task_messages(task_id);
