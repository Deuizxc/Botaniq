ALTER TABLE plots
  ADD COLUMN photo_data TEXT CHECK(photo_data IS NULL OR length(photo_data) <= 350000),
  ADD COLUMN photo_version INTEGER NOT NULL DEFAULT 0;
