ALTER TABLE plots
  ADD COLUMN map_x DOUBLE PRECISION,
  ADD COLUMN map_y DOUBLE PRECISION,
  ADD COLUMN map_w DOUBLE PRECISION,
  ADD COLUMN map_h DOUBLE PRECISION,
  ADD COLUMN map_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN removed_at TEXT,
  ADD CONSTRAINT plot_geometry CHECK (
    (map_x IS NULL AND map_y IS NULL AND map_w IS NULL AND map_h IS NULL) OR
    (map_x IS NOT NULL AND map_y IS NOT NULL AND map_w IS NOT NULL AND map_h IS NOT NULL
      AND map_x >= 0 AND map_y >= 0 AND map_w >= 3 AND map_h >= 3
      AND map_x + map_w <= 100 AND map_y + map_h <= 1000)
  );
