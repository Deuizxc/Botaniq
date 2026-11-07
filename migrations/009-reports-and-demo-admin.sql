-- Overdue work used to be deleted; reports need it, so it now closes as Missed.
ALTER TABLE maintenance_tasks DROP CONSTRAINT maintenance_tasks_status_check;
ALTER TABLE maintenance_tasks ADD CONSTRAINT maintenance_tasks_status_check
  CHECK(status IN ('Pending','Completed','Skipped','Missed'));

-- Demo account (password 123). A migration runs once, so removing this account keeps it removed.
INSERT INTO users(full_name,email,password_hash,role)
VALUES('CUAI Admin 2','admin2@gmail.com','dc1fd24340d0f5cf6007ec5393c1b1ef:eaaaf3413fbd3435642d991e6f98ed1467d2dbcca94ca44fefa22d02ae63cc5a55dc9a4fc5004b53b6d3468a5c2ae0f1faacd62055afff694b5fd81cadb1caf3','Admin')
ON CONFLICT(email) DO NOTHING;
