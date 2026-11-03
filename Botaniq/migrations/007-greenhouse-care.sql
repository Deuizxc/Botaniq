ALTER TABLE plots DROP CONSTRAINT plots_zone_check;
ALTER TABLE plots ADD CONSTRAINT plots_zone_check CHECK(zone IN ('Outdoor','Greenhouse','Nursery','Open space'));
ALTER TABLE plots ADD COLUMN parent_plot_id INTEGER REFERENCES plots(plot_id);
ALTER TABLE plots ADD CONSTRAINT greenhouse_bed CHECK(parent_plot_id IS NULL OR zone='Greenhouse');
CREATE INDEX greenhouse_beds ON plots(parent_plot_id);

-- Keep existing plot IDs and all their history as the first bed inside each greenhouse.
DO $$
DECLARE p RECORD; container_id INTEGER; bed_code TEXT;
BEGIN
  FOR p IN SELECT * FROM plots WHERE zone='Greenhouse' AND parent_plot_id IS NULL LOOP
    bed_code := p.plot_code || ' / Bed 1';
    WHILE EXISTS(SELECT 1 FROM plots WHERE plot_code=bed_code) LOOP
      bed_code := bed_code || '-';
    END LOOP;
    UPDATE plots SET plot_code=bed_code,map_slot=NULL,map_x=8,map_y=12,map_w=38,map_h=32 WHERE plot_id=p.plot_id;
    INSERT INTO plots(plot_code,zone,map_slot,map_x,map_y,map_w,map_h,removed_at)
      VALUES(p.plot_code,'Greenhouse',p.map_slot,p.map_x,p.map_y,p.map_w,p.map_h,p.removed_at)
      RETURNING plot_id INTO container_id;
    UPDATE plots SET parent_plot_id=container_id WHERE plot_id=p.plot_id;
  END LOOP;
END $$;

ALTER TABLE maintenance_tasks DROP CONSTRAINT maintenance_tasks_task_type_check;
ALTER TABLE maintenance_tasks ADD CONSTRAINT maintenance_tasks_task_type_check
  CHECK(task_type IN ('Manual watering','Fertilizer application','Hydroponic nutrients','General maintenance','Harvest'));
ALTER TABLE maintenance_tasks ADD COLUMN cycle_id INTEGER REFERENCES crop_cycles(cycle_id);
ALTER TABLE maintenance_tasks ADD CONSTRAINT harvest_task_cycle CHECK(task_type<>'Harvest' OR cycle_id IS NOT NULL);

ALTER TABLE task_adjustments DROP CONSTRAINT task_adjustments_task_id_fkey;
ALTER TABLE task_adjustments ADD FOREIGN KEY(task_id) REFERENCES maintenance_tasks(task_id) ON DELETE CASCADE;
ALTER TABLE task_messages DROP CONSTRAINT task_messages_task_id_fkey;
ALTER TABLE task_messages ADD FOREIGN KEY(task_id) REFERENCES maintenance_tasks(task_id) ON DELETE CASCADE;
ALTER TABLE nutrient_logs DROP CONSTRAINT nutrient_logs_task_id_fkey;
ALTER TABLE nutrient_logs ADD FOREIGN KEY(task_id) REFERENCES maintenance_tasks(task_id) ON DELETE SET NULL;
CREATE INDEX pending_task_expiry ON maintenance_tasks(scheduled_date) WHERE status='Pending';

UPDATE users SET full_name='CUAI Admin' WHERE full_name='CUIA Admin' AND role='Admin';
