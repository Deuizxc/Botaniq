ALTER TABLE crop_cycles DROP CONSTRAINT IF EXISTS crop_cycles_cycle_status_check;
ALTER TABLE crop_cycles ADD CONSTRAINT crop_cycles_cycle_status_check CHECK(cycle_status IN ('In Nursery','Active in Plot','Harvested','Removed'));
