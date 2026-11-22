-- MAP-05 was removed by accident; removal only hides a plot, so this puts it back where it was.
UPDATE plots SET removed_at=NULL,map_revision=map_revision+1 WHERE plot_code='MAP-05' AND removed_at IS NOT NULL;
