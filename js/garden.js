// Map coordinates follow the supplied garden plan; record IDs remain independent of map numbers.
export function mapPosition(slot) {
  if (slot >= 1 && slot <= 3) return [79, 85 - (slot - 1) * 11, 18, 9];
  if (slot >= 4 && slot <= 13) return [79, 58 - (slot - 4) * 5.7, 18, 4.3];
  if (slot >= 15 && slot <= 22) return [slot <= 18 ? 50 : 34, 58 - ((slot - 15) % 4) * 6, 15, 4.4];
  return ({
    14: [49, 66, 17, 10], 23: [3, 48, 29, 23], 24: [12, 23, 9, 22],
    25: [34, 24, 10, 14], 26: [3, 3, 21, 16], 27: [28, 8, 18, 11]
  })[slot] || [3 + ((slot - 28) % 4) * 17, 82 + Math.floor((slot - 28) / 4) * 13, 15, 10];
}

const dateOf = value => value?.slice(0, 10) || '';
const latest = (rows, key) => [...rows].sort((a, b) => (b[key] || '').localeCompare(a[key] || ''))[0];
const localDate = value => value?.includes('T')
  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  : dateOf(value);

export function plotOverview(state, plot, cycle, until = '9999-12-31') {
  const start = cycle ? (cycle.current_plot_id === plot.plot_id && cycle.transplanted_date || cycle.planted_date) : '';
  const inRange = value => localDate(value) >= start && localDate(value) <= until;
  const entry = (state.entries || []).find(e => e.plot_id === plot.plot_id && e.cycle_id === (cycle?.cycle_id ?? null) && localDate(e.recorded_at) <= until);
  const watering = latest(state.tasks.filter(t => t.plot_id === plot.plot_id && t.task_type === 'Manual watering' && t.status === 'Completed' && t.completed_at && inRange(t.completed_at)), 'completed_at');
  const fertilizer = latest(state.nutrients.filter(n => n.plot_id === plot.plot_id && n.nutrient_type === 'Fertilizer' && inRange(n.application_date)), 'application_date');
  const harvest = latest(state.cycles.filter(c => c.current_plot_id === plot.plot_id && c.harvest_date && c.harvest_date <= until), 'harvest_date');
  const newerWatering = watering && (!entry || watering.completed_at > entry.recorded_at);
  const newerHarvest = harvest && (!entry || harvest.harvest_date > localDate(entry.recorded_at));
  const newerFertilizer = fertilizer && (!entry || fertilizer.application_date > localDate(entry.recorded_at));
  return {
    cycle_id: cycle?.cycle_id ?? null,
    crop_name: cycle?.crop_name || 'Ready for a new chapter',
    description: entry?.description || (cycle
      ? `${cycle.crop_name}${cycle.variety ? ` (${cycle.variety})` : ''} ${cycle.harvest_date ? 'grew' : 'is growing'} in ${plot.plot_code}. Planted ${cycle.planted_date}${cycle.assigned_staff ? ` and cared for by ${cycle.assigned_staff}` : ''}.`
      : `${plot.plot_code} is resting between crops, ready for the next planting.`),
    watered_at: newerWatering ? watering.completed_at : entry ? entry.watered_at : watering?.completed_at || null,
    harvested_at: newerHarvest ? harvest.harvest_date : entry ? entry.harvested_at : harvest?.harvest_date || null,
    fertilizer: newerFertilizer ? fertilizer.product : entry ? entry.fertilizer : fertilizer?.product || null,
    fertilized_at: newerFertilizer ? fertilizer.application_date : entry ? entry.fertilized_at : fertilizer?.application_date || null
  };
}

export function plotHistory(state, plot) {
  const snapshots = (state.entries || []).filter(e => e.plot_id === plot.plot_id).map(e => ({
    ...e, key: `entry-${e.entry_id}`, date: localDate(e.recorded_at), type: 'Saved update',
    crop_name: state.cycles.find(c => c.cycle_id === e.cycle_id)?.crop_name || 'Between crops'
  }));
  const cycles = state.cycles.filter(c => c.current_plot_id === plot.plot_id && c.harvest_date || c.origin_plot_id === plot.plot_id && c.current_plot_id !== plot.plot_id);
  return [...snapshots, ...cycles.map(c => {
    const moved = c.current_plot_id !== plot.plot_id;
    const end = moved ? c.transplanted_date : c.harvest_date;
    return { ...plotOverview(state, plot, c, end), key: `cycle-${c.cycle_id}`, date: end, type: moved ? 'Transplanted' : 'Harvested' };
  })].sort((a, b) => b.date.localeCompare(a.date) || (b.entry_id || 0) - (a.entry_id || 0));
}

export function filterHistory(records, query = '', fertilizer = 'all', from = '', to = '') {
  const terms = query.toLowerCase().match(/(?:[a-z]+:)?(?:"[^"]*"|\S+)/g) || [];
  return records.filter(record => {
    if (from && record.date < from || to && record.date > to) return false;
    if (fertilizer === 'none' && record.fertilizer || fertilizer === 'used' && !record.fertilizer) return false;
    const text = `${record.crop_name} ${record.description} ${record.fertilizer || 'none'} ${record.date} ${record.type}`.toLowerCase();
    return terms.every(term => {
      const match = /^(crop|fertilizer|before|after|on):(.+)$/.exec(term);
      if (!match) return text.includes(term.replaceAll('"', ''));
      const [, key, raw] = match, value = raw.replaceAll('"', '');
      if (key === 'crop') return record.crop_name.toLowerCase().includes(value);
      if (key === 'fertilizer') return (record.fertilizer || 'none').toLowerCase().includes(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      return key === 'before' ? record.date < value : key === 'after' ? record.date > value : record.date === value;
    });
  });
}
