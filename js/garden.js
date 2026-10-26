export function mapPosition(slot) {
  if (slot >= 1 && slot <= 3) return [79, 85 - (slot - 1) * 11, 18, 9];
  if (slot >= 4 && slot <= 13) return [79, 58 - (slot - 4) * 5.7, 18, 4.3];
  if (slot >= 15 && slot <= 22) return [slot <= 18 ? 50 : 34, 58 - ((slot - 15) % 4) * 6, 15, 4.4];
  return ({
    14: [49, 66, 17, 10], 23: [3, 48, 29, 23], 24: [12, 23, 9, 22],
    25: [34, 24, 10, 14], 26: [3, 3, 21, 16], 27: [28, 8, 18, 11]
  })[slot] || [3 + ((slot - 28) % 4) * 17, 82 + Math.floor((slot - 28) / 4) * 13, 15, 10];
}

export const plotBounds = plot => plot.map_x == null
  ? mapPosition(plot.map_slot || plot.plot_id)
  : [plot.map_x, plot.map_y, plot.map_w, plot.map_h];

export function dragPlot(bounds, dx, dy, corner = '', height = 100) {
  let [x,y,w,h]=bounds;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  if (!corner) return [clamp(x+dx,0,100-w),clamp(y+dy,0,height-h),w,h];
  const right=x+w,bottom=y+h;
  if (corner.includes('w')) {x=clamp(x+dx,0,right-3);w=right-x;}
  if (corner.includes('e')) w=clamp(w+dx,3,100-x);
  if (corner.includes('n')) {y=clamp(y+dy,0,bottom-3);h=bottom-y;}
  if (corner.includes('s')) h=clamp(h+dy,3,height-y);
  return [x,y,w,h];
}

const dateOf = value => value?.slice(0, 10) || '';
const latest = (rows, key) => [...rows].sort((a, b) => (b[key] || '').localeCompare(a[key] || ''))[0];
const localDate = value => value?.includes('T')
  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  : dateOf(value);

export const assignedPending = (tasks, userId) => tasks.filter(t => t.status === 'Pending' && t.assigned_staff_id === userId);

export function notificationKeys(state) {
  return state.user.role === 'Admin'
    ? [...state.tasks.filter(t=>t.is_flagged_for_admin).map(t=>`takeover-${t.task_id}`), ...(state.messages||[]).filter(m=>!m.read_at).map(m=>`message-${m.message_id}`)]
    : assignedPending(state.tasks,state.user.user_id).map(t=>`task-${t.task_id}-${t.scheduled_date}-${t.scheduled_time}`);
}

export const isGreenhouse = plot => plot.zone === 'Greenhouse' && !plot.parent_plot_id;
export const isGrowingPlot = plot => !plot.removed_at && plot.zone !== 'Open space' && !isGreenhouse(plot);

export function taskDateLabel(scheduled, today) {
  const days = Math.round((Date.parse(today) - Date.parse(scheduled)) / 86400000);
  return days === 0 ? 'Today' : days > 0 ? `${days} day${days === 1 ? '' : 's'} overdue` : scheduled;
}

export function dailyProgress(tasks, userId, today) {
  const assigned = tasks.filter(t => t.assigned_staff_id === userId && t.scheduled_date === today);
  const completed = assigned.filter(t => t.status === 'Completed' && !t.substitute_staff_id && localDate(t.completed_at) === today).length;
  return { total: assigned.length, completed };
}

export function overviewPlots(state) {
  const due = type => new Set(state.tasks.filter(t => t.status === 'Pending' && t.task_type === type && t.scheduled_date <= state.today).map(t => t.plot_id));
  const water = due('Manual watering'), fertilizer = due('Fertilizer application'), harvest = due('Harvest');
  const plots = state.plots.filter(p => !p.removed_at);
  return [
    {label: 'Awaiting water', plots: plots.filter(p => water.has(p.plot_id))},
    {label: 'Awaiting fertilizer', plots: plots.filter(p => fertilizer.has(p.plot_id))},
    {label: 'Awaiting harvest', plots: plots.filter(p => harvest.has(p.plot_id))},
    {label: 'Available plots', plots: plots.filter(p => isGrowingPlot(p) && p.occupancy_status !== 'Occupied')}
  ];
}

export function calendarMonth(today, offset, tasks) {
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + offset);
  const year = start.getUTCFullYear(), month = start.getUTCMonth();
  const cells = Array.from({length:start.getUTCDay()}, () => null);
  for (let day=1; day<=new Date(Date.UTC(year,month+1,0)).getUTCDate(); day++) {
    const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cells.push({day,date,count:tasks.filter(t=>t.scheduled_date===date&&t.status==='Pending').length});
  }
  return {label:start.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}),cells};
}

export function plotOverview(state, plot, cycle, until = '9999-12-31') {
  const start = cycle ? (cycle.current_plot_id === plot.plot_id && cycle.transplanted_date || cycle.planted_date) : '';
  const inRange = value => localDate(value) >= start && localDate(value) <= until;
  const entry = (state.entries || []).find(e => e.plot_id === plot.plot_id && e.cycle_id === (cycle?.cycle_id ?? null) && localDate(e.recorded_at) <= until);
  const watering = latest(state.tasks.filter(t => t.plot_id === plot.plot_id && t.task_type === 'Manual watering' && t.status === 'Completed' && t.completed_at && inRange(t.completed_at)), 'completed_at');
  const fertilizer = latest(state.nutrients.filter(n => n.plot_id === plot.plot_id && n.nutrient_type === 'Fertilizer' && inRange(n.application_date)).map(n=>({...n,application_time:n.applied_at||n.application_date})), 'application_time');
  const harvest = latest(state.cycles.filter(c => c.current_plot_id === plot.plot_id && c.harvest_date && c.harvest_date <= until), 'harvest_date');
  const newerWatering = watering && (!entry || watering.completed_at > entry.recorded_at);
  const newerHarvest = harvest && (!entry || harvest.harvest_date > localDate(entry.recorded_at));
  const newerFertilizer = fertilizer && (!entry || (fertilizer.applied_at ? fertilizer.applied_at > entry.recorded_at : fertilizer.application_date > localDate(entry.recorded_at)));
  return {
    cycle_id: cycle?.cycle_id ?? null,
    crop_name: cycle?.crop_name || 'Ready for a new chapter',
    description: entry?.description || (cycle
      ? `${cycle.crop_name}${cycle.variety ? ` (${cycle.variety})` : ''} ${cycle.harvest_date ? 'grew' : 'is growing'} in ${plot.plot_code}. Planted ${cycle.planted_date}${cycle.assigned_staff ? ` and cared for by ${cycle.assigned_staff}` : ''}.`
      : `${plot.plot_code} is resting between crops, ready for the next planting.`),
    watered_at: newerWatering ? watering.completed_at : entry ? entry.watered_at : watering?.completed_at || null,
    harvested_at: newerHarvest ? harvest.harvest_date : entry ? entry.harvested_at : harvest?.harvest_date || null,
    fertilizer: newerFertilizer ? fertilizer.product : entry ? entry.fertilizer : fertilizer?.product || null,
    fertilized_at: newerFertilizer ? fertilizer.application_time : entry ? entry.fertilized_at : fertilizer?.application_time || null
  };
}

export function plotHistory(state, plot) {
  const snapshots = (state.entries || []).filter(e => e.plot_id === plot.plot_id).map(e => ({
    ...e, key: `entry-${e.entry_id}`, date: localDate(e.recorded_at), type: 'Saved update',
    crop_name: state.cycles.find(c => c.cycle_id === e.cycle_id)?.crop_name || 'Between crops'
  }));
  const cycles = state.cycles.filter(c => c.current_plot_id === plot.plot_id && c.harvest_date || c.origin_plot_id === plot.plot_id && c.current_plot_id !== plot.plot_id);
  const applications = state.nutrients.filter(n=>n.plot_id===plot.plot_id).map(n=>{
    const cycle = state.cycles.find(c=>c.current_plot_id===plot.plot_id && c.planted_date<=n.application_date && (!c.harvest_date||c.harvest_date>=n.application_date));
    return {key:`nutrient-${n.log_id}`,date:n.application_date,type:n.nutrient_type==='Fertilizer'?'Fertilizer applied':'Nutrients applied',crop_name:cycle?.crop_name||'Garden care',description:`${n.product}${n.full_name?` · Recorded by ${n.full_name}`:''}${n.notes?`. ${n.notes}`:''}`,fertilizer:n.product,fertilized_at:n.applied_at||n.application_date,watered_at:null,harvested_at:null};
  });
  return [...snapshots, ...applications, ...cycles.map(c => {
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
