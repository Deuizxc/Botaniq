-- Put MAP-05 back between MAP-04 and MAP-06, wherever those two are now. Unmoved plots use their slot 4 and 6 defaults.
UPDATE plots p SET map_x=a.x, map_y=(a.y+b.y)/2, map_w=a.w, map_h=a.h, map_revision=p.map_revision+1
FROM (SELECT COALESCE(map_x,79) x, COALESCE(map_y,58) y, COALESCE(map_w,18) w, COALESCE(map_h,4.3) h FROM plots WHERE plot_code='MAP-04' AND removed_at IS NULL) a,
     (SELECT COALESCE(map_y,46.6) y FROM plots WHERE plot_code='MAP-06' AND removed_at IS NULL) b
WHERE p.plot_code='MAP-05';
