-- The garden's crop catalog. The original demo crops become the new ones so their plantings keep a crop.
UPDATE plants p SET crop_name=n.crop_name, variety=n.variety, notes=n.notes
FROM (VALUES
  ('Bok choy','Pak choi','Siling Labuyo','Capsicum frutescens','Full sun. Water when the topsoil is dry. Pick pods green or red about 3 months after transplanting.'),
  ('Chili','Siling haba','French lavender','Lavandula dentata','Full sun, sandy well-drained soil. Water sparingly; wet roots rot. Trim spent flower spikes.'),
  ('Cucumber','Slicing','Italian oregano','Origanum x majoricum','Sun to light shade. Let the soil dry between waterings. Pinch tips to keep it bushy.'),
  ('Radish','White radish','Peppermint','Mentha x piperita','Partial shade, moist soil. Spreads fast, so keep it contained. Cut stems often for fresh growth.'),
  ('String beans','Sitaw','Garlic','Allium sativum','Plant cloves pointed end up, 2-3 cm deep. Water lightly. Harvest when half the leaves turn brown.'),
  ('Tomato','Cherry','Mayana','Coleus scutellarioides','Bright shade for best leaf colour. Keep the soil evenly moist. Pinch flower buds to keep leaves full.')
) AS n(old_name,old_variety,crop_name,variety,notes)
WHERE p.crop_name=n.old_name AND p.variety=n.old_variety
  AND NOT EXISTS (SELECT 1 FROM plants q WHERE LOWER(q.crop_name::text)=LOWER(n.crop_name) AND LOWER(q.variety)=LOWER(n.variety));

INSERT INTO plants(crop_name,variety,notes) VALUES
  ('Siling Labuyo','Capsicum frutescens','Full sun. Water when the topsoil is dry. Pick pods green or red about 3 months after transplanting.'),
  ('French lavender','Lavandula dentata','Full sun, sandy well-drained soil. Water sparingly; wet roots rot. Trim spent flower spikes.'),
  ('Italian oregano','Origanum x majoricum','Sun to light shade. Let the soil dry between waterings. Pinch tips to keep it bushy.'),
  ('Peppermint','Mentha x piperita','Partial shade, moist soil. Spreads fast, so keep it contained. Cut stems often for fresh growth.'),
  ('Garlic','Allium sativum','Plant cloves pointed end up, 2-3 cm deep. Water lightly. Harvest when half the leaves turn brown.'),
  ('Mayana','Coleus scutellarioides','Bright shade for best leaf colour. Keep the soil evenly moist. Pinch flower buds to keep leaves full.'),
  ('Ampalaya','Momordica charantia','Full sun. Grow on a trellis. Water often while fruiting. Harvest fruits young and green.')
ON CONFLICT DO NOTHING;

-- Other crops leave the catalog unless something was planted from them (planting history needs its crop).
DELETE FROM plants p
WHERE p.crop_name NOT IN ('Siling Labuyo','French lavender','Italian oregano','Peppermint','Garlic','Mayana','Ampalaya')
  AND NOT EXISTS (SELECT 1 FROM crop_cycles c WHERE c.plant_id=p.plant_id);
