ALTER TABLE users ADD COLUMN IF NOT EXISTS removed_at TEXT;
UPDATE users SET full_name='CUIA Admin'
WHERE email='admin@gmail.com' AND full_name='Admin Admin' AND role='Admin';
