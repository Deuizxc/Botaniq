ALTER TABLE plants DROP CONSTRAINT IF EXISTS plants_crop_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS plants_name_variety_key
  ON plants (LOWER(BTRIM(crop_name::text)), LOWER(BTRIM(variety)));
