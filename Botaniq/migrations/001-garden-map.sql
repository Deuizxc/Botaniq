ALTER TABLE plots ADD COLUMN IF NOT EXISTS map_slot INTEGER UNIQUE CHECK(map_slot > 0);

CREATE TABLE IF NOT EXISTS plot_entries (
  entry_id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
  cycle_id INTEGER REFERENCES crop_cycles(cycle_id),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 500),
  watered_at TEXT,
  harvested_at TEXT,
  fertilizer TEXT,
  fertilized_at TEXT,
  recorded_at TEXT NOT NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(user_id),
  CHECK ((fertilizer IS NULL) = (fertilized_at IS NULL))
);
CREATE INDEX IF NOT EXISTS plot_entries_history ON plot_entries(plot_id, entry_id DESC);

-- Assign the existing garden spaces before filling vacant positions in the reference map.
WITH numbered AS (
  SELECT plot_id, row_number() OVER (ORDER BY
    CASE zone WHEN 'Greenhouse' THEN 0 WHEN 'Nursery' THEN 1 ELSE 2 END, plot_id) AS n
  FROM plots
)
UPDATE plots SET map_slot=CASE numbered.n
  WHEN 1 THEN 26 WHEN 2 THEN 27 WHEN 3 THEN 24 WHEN 4 THEN 25
  WHEN 5 THEN 13 WHEN 6 THEN 12 WHEN 7 THEN 11 WHEN 8 THEN 10
  ELSE numbered.n + 27 END
FROM numbered WHERE plots.plot_id=numbered.plot_id AND plots.map_slot IS NULL;

INSERT INTO plots(plot_code, zone, map_slot)
SELECT 'MAP-' || lpad(slot::text,2,'0'),
  CASE WHEN slot IN (1,2,3,14,23,24,25,26,27) THEN 'Greenhouse' ELSE 'Outdoor' END,
  slot
FROM generate_series(1,27) AS slot
WHERE NOT EXISTS (SELECT 1 FROM plots WHERE map_slot=slot);
