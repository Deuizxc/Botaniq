import { mapPosition, plotOverview, plotHistory, filterHistory } from './garden.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  leaf:'M20 4C9 2 3 7 5 14c2 7 13 6 15-10Z M5 20 15 10 M9 16v-5 M9 16h5',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  sprout:'M12 21v-9 M12 15C4 16 3 10 3 7c7-1 10 4 9 8Z M12 12c-1-6 4-9 9-9 0 6-3 10-9 9Z',
  tasks:'M8 3h12v18H4V7 M3 3l2 2 4-4 M8 10h8 M8 14h8 M8 18h5',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
  pencil:'m16 3 5 5-12 12-6 1 1-6L16 3Z M13 6l5 5',
  drop:'M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z M9 15c0 2 1 3 3 3',
  search:'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M16 16l6 6',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  arrow:'M5 12h14 M14 7l5 5-5 5',
  calendar:'M4 5h16v16H4z M4 10h16 M8 2v5 M16 2v5 M8 14h2 M14 14h2',
  plus:'M12 5v14 M5 12h14',
  check:'M5 12l4 4L19 6',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2',
  flag:'M5 22V3 M5 3c5-4 9 4 15 0v11c-6 4-10-4-15 0',
  close:'M6 6l12 12 M6 18 18 6',
  menu:'M3 6h18 M3 12h18 M3 18h18',
  lock:'M5 10h14v12H5z M8 10V6a4 4 0 0 1 8 0v4',
  sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.leaf}"/></svg>`;
const art = `<svg class="garden-art" aria-hidden="true" viewBox="0 0 300 180"><ellipse cx="155" cy="161" rx="121" ry="12" fill="#d6dfc2"/><path d="M99 157V62l53-34 55 34v95" stroke="#a7b893" stroke-width="2"/><path d="m99 62 53 20 55-20M152 28v129M99 105h108M125 46v111M179 46v111" stroke="#b4c2a1" stroke-width="1.5"/><path d="M48 155v-51M48 131c-31-3-30-29-30-29 23-1 33 12 30 29M48 119c26-1 29-26 29-26-22-1-30 10-29 26" fill="#7b9664" stroke="#7b9664" stroke-width="2"/><path d="M31 143h35l-5 20H36Z" fill="#b2ba88"/><path d="M238 156V93M238 121c-31-1-36-28-36-28 30-4 40 11 36 28M238 108c28 0 35-32 35-32-31 0-39 13-35 32M238 145c22 0 28-24 28-24-24-2-32 11-28 24" fill="#5e7e4d" stroke="#5e7e4d" stroke-width="2"/><path d="M221 144h35l-5 20h-25Z" fill="#c4aa7c"/><path d="M119 150v-25M119 140c-14 0-18-15-18-15 17-1 20 8 18 15M119 133c16 0 20-15 20-15-16-1-23 8-20 15" fill="#9bb47b" stroke="#9bb47b"/><path d="M166 150v-29M166 139c-16 0-19-17-19-17 17-1 22 7 19 17M166 131c17 0 20-17 20-17-18 0-23 7-20 17" fill="#759257" stroke="#759257"/><path d="M107 146h25l-3 15h-19Z M154 146h25l-3 15h-19Z" fill="#baa77e"/><circle cx="230" cy="34" r="14" fill="#dde5bf"/></svg>`;
let state, view, search = '', zone = 'All zones', taskFilter = 'All tasks', toastTimer;
let plotTab = 'overview', editingPlot = false, historyQuery = '', historyFertilizer = 'all', historyFrom = '', historyTo = '';
const selectedPlot = () => state?.plots.find(p => p.plot_id === Number(new URLSearchParams(location.search).get('id')));
const isAdmin = () => state.user.role === 'Admin';
const initials = name => name.split(' ').slice(0,2).map(x => x[0]).join('');
const fmt = value => value ? new Date(`${value.slice(0,10)}T00:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : '—';
const clock = value => { const [hour,minute] = value.split(':'); return `${Number(hour)%12 || 12}:${minute} ${Number(hour)>=12?'PM':'AM'}`; };
const badge = (label, color = '') => `<span class="badge ${color}">${escape(label)}</span>`;
const statusBadge = status => badge(status,({Vacant:'gray',Harvested:'amber',Pending:'amber',Skipped:'gray',Completed:'blue'})[status]||'');
const match = values => values.join(' ').toLowerCase().includes(search.toLowerCase());
const empty = text => `<div class="empty">${icon('sprout')}${escape(text)}</div>`;
const button = (label, action, id = '', style = 'secondary', name = '') => `<button class="btn ${style}" data-action="${action}" data-id="${id}">${name?icon(name):''}${label}</button>`;
const options = (rows,key,label,selected) => rows.map(row=>`<option value="${escape(row[key])}" ${String(row[key])===String(selected)?'selected':''}>${escape(row[label])}</option>`).join('');
const staffOptions = selected => `<option value="">Unassigned</option>${options(state.users.filter(u=>u.role==='Staff'&&u.active),'user_id','full_name',selected)}`;
const plotOptions = selected => options(state.plots,'plot_id','plot_code',selected);
function field(label,name,type='text',value='',extra='') { return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${escape(value)}" ${extra}></div>`; }
function select(label,name,items) { return `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" required>${items}</select></div>`; }
function textarea(label,name) { return `<div class="field wide"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" maxlength="500" required></textarea></div>`; }
async function api(path,body) {
  const response=await fetch(`/api/${path}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok) { if(response.status===401 && path!=='login') { state=null;renderLogin(); } throw new Error(result.error); }
  return result;
}
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function getView() { return ({'tasks.html':'tasks','plot-info.html':'plots','edit-plot.html':'plots','inventory.html':'inventory','staff.html':'staff','archive.html':'plots','nutrients.html':'nutrients'})[location.pathname.split('/').pop()] || 'dashboard'; }
const href = name => ({dashboard:isAdmin()?'admin-dashboard.html':'staff-dashboard.html',plots:'plot-info.html',tasks:'tasks.html',inventory:'inventory.html',staff:'staff.html',nutrients:'nutrients.html'})[name];
function renderLogin() {
  $('#modal').close();
  $('#app').innerHTML=`<div class="login"><section class="login-art"><a class="brand" href="/">${icon('leaf')}<span>BotaniQ<small>↗</small></span></a><div><div class="eyebrow">A little care. A greener tomorrow.</div><h1>Good things<br>take growing.</h1><p>A shared space to care for our garden, keep track of every crop, and make each day a little greener.</p>${art}</div><small>CUAI · QUEZON CITY UNIVERSITY</small></section><section class="login-form"><div class="login-box"><div class="eyebrow">Your garden workspace</div><h2>Welcome back.</h2><p>Sign in to see what’s growing and what needs your care.</p><form id="login-form">${field('Email address','email','email','','required autocomplete="username" placeholder="you@botaniq.local"')}${field('Password','password','password','','required autocomplete="current-password" maxlength="128"')}<div class="form-error" role="alert"></div><button class="btn" type="submit">Sign in ${icon('arrow')}</button></form><p class="login-foot">Authorized garden staff only. For the local demo, use the account details printed in the server terminal.</p></div></section></div>`;
  $('#login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('button');submit.disabled=true;try{await api('login',Object.fromEntries(new FormData(form)));await refresh();}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}});
}
function shell() {
  const names={dashboard:'Overview',plots:'Garden plots',tasks:'Maintenance tasks',inventory:'Plant inventory',staff:'Staff & access',nutrients:'Nutrient log'};
  const links=[['dashboard','grid'],['plots','sprout'],['tasks','tasks'],['inventory','leaf'],['nutrients','drop'],...(isAdmin()?[['staff','users']]:[])];
  const flags=state.tasks.filter(t=>t.is_flagged_for_admin);
  $('#app').innerHTML=`<aside class="sidebar" id="sidebar"><button class="icon-button sidebar-close" data-action="menu" aria-label="Close navigation">${icon('close')}</button><a class="brand" href="${href('dashboard')}">${icon('leaf')}<span>BotaniQ<small>↗</small></span></a><div class="workspace">Garden workspace</div><nav class="nav" aria-label="Main navigation">${links.map(([name,ic])=>`<a href="${href(name)}" class="${view===name?'active':''}" ${view===name?'aria-current="page"':''} title="${names[name]}">${icon(ic)}<span>${names[name]}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="garden-note">${icon('sprout')}<strong>Small steps. Lasting growth.</strong>Every record helps us care for a greener campus.</div><small>CUAI · QUEZON CITY UNIVERSITY</small></div></aside><div class="layout"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb">Workspace <span>/</span> <strong>${names[view]}</strong></div><div class="top-spacer"></div><label class="search">${icon('search')}<input id="search" type="search" placeholder="Search this workspace…" aria-label="Search current page" value="${escape(search)}"></label><button class="icon-button" data-action="notifications" aria-label="${isAdmin()?'Review task takeovers':'View my tasks'}">${icon('bell')}${isAdmin()&&flags.length?'<span class="notification-dot"></span>':''}</button><button class="profile" data-action="account" aria-label="Account settings"><span class="avatar">${escape(initials(state.user.full_name))}</span><div><strong>${escape(state.user.full_name)}</strong><small>${isAdmin()?'Garden administrator':'Garden staff'}</small></div></button></header><main class="main" id="main"></main></div>`;
  $('#search').addEventListener('input',event=>{search=event.target.value;renderMain();});
  renderMain();
}
function heading(title,description,action='') { return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${action}</div></div>`; }
function panelHead(title,description='',link='') { return `<div class="panel-head"><div><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>${link}</div>`; }
function link(label,name) { return `<a href="${href(name)}">${label} ${icon('arrow')}</a>`; }
function renderMain() {
  let content;
  if(view==='dashboard') content=dashboard();
  if(view==='plots') content=plotsPage();
  if(view==='tasks') content=tasksPage();
  if(view==='inventory') content=inventoryPage();
  if(view==='staff') content=isAdmin()?staffPage():empty('Staff management is available to administrators.');
  if(view==='nutrients') content=nutrientsPage();
  $('#main').innerHTML=content+`<footer class="footer"><span>${icon('leaf')}Growing with purpose. Caring for our campus.</span><span>BotaniQ · CUAI Garden Management &nbsp; / &nbsp; Demo garden</span></footer>`;
  mountGardenMap();
  document.title=`BotaniQ · ${{dashboard:'Overview',plots:'Garden plots',tasks:'Maintenance tasks',inventory:'Plant inventory',staff:'Staff & access',nutrients:'Nutrient log'}[view]}`;
}
function filters(items,selected,action) { return `<div class="filters">${items.map(item=>`<button class="filter ${item===selected?'active':''}" data-action="${action}" data-id="${item}" aria-pressed="${item===selected}">${item}</button>`).join('')}</div>`; }
function cycleTable(cycles) {
  const rows=cycles.filter(c=>match([c.crop_name,c.plot_code,c.assigned_staff||'',c.origin_plot]));
  if(!rows.length) return empty('No crop records to show.');
  return `<div class="table-wrap"><table><thead><tr><th>Crop / variety</th><th>Current plot</th><th>Planted</th><th>Harvested</th><th>Assigned staff</th><th>Status</th></tr></thead><tbody>${rows.map(c=>`<tr><td><div class="table-crop"><span class="crop-icon">${icon('sprout')}</span><div><strong>${escape(c.crop_name)}</strong><span class="sub">${escape(c.variety||'Cycle #'+c.cycle_id)} · ${escape(c.origin_plot)} origin</span></div></div></td><td><a href="plot-info.html?id=${c.current_plot_id}">${escape(c.plot_code)}</a><span class="sub">${c.zone}</span></td><td>${fmt(c.planted_date)}</td><td>${fmt(c.harvest_date)}</td><td>${escape(c.assigned_staff||'Unassigned')}</td><td>${statusBadge(c.cycle_status)}</td></tr>`).join('')}</tbody></table></div>`;
}
function dashboard() {
  const live=state.cycles.filter(c=>!c.harvest_date), due=state.tasks.filter(t=>t.scheduled_date===state.today), mine=due.filter(t=>isAdmin()||t.assigned_staff_id===state.user.user_id), flags=state.tasks.filter(t=>t.is_flagged_for_admin);
  const todo=mine.filter(t=>t.status==='Pending');
  const stats=[['Garden plots',state.plots.length,`${state.plots.filter(p=>p.occupancy_status==='Occupied').length} occupied`,'Across 3 garden zones','grid'],['Growing crops',live.length,`${live.filter(c=>c.zone==='Nursery').length} in nursery`,'Nurturing the next harvest','sprout'],[isAdmin()?"Today’s tasks":"My tasks today",mine.length,`${mine.filter(t=>t.status!=='Pending').length} closed`,`${todo.length} still need care`,'tasks'],['Garden team',state.users.filter(u=>u.role==='Staff'&&u.active).length,'Growing together','One shared garden','users']];
  return heading('A good day to grow.', 'Here’s what’s happening in your garden today.', `<span class="date-label">${icon('calendar')}${fmt(state.today)}</span>${isAdmin()?button('New crop cycle','new-cycle','','','plus'):button('View my tasks','my-tasks','','','tasks')}`)+
    `<section class="welcome"><div><div class="eyebrow">CUAI Garden · Quezon City University</div><h2>Every little bit of care counts.</h2><p>You have ${todo.length} ${isAdmin()?'garden tasks':'assigned tasks'} to tend to today.<br>Let’s keep good things growing.</p></div>${art}</section><div class="stats">${stats.map(([label,value,detail,foot,ic])=>`<article class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(ic)}</span></div><div class="stat-value">${value}</div><p class="stat-foot"><strong>${detail}</strong> · ${foot}</p></article>`).join('')}</div><div class="dashboard-grid"><section class="panel">${panelHead('Your garden at a glance','A little space for every stage of growth.',link('All plots','plots'))}<div class="tabs">${['All zones','Greenhouse','Outdoor','Nursery'].map(z=>`<button class="tab ${zone===z?'active':''}" data-action="zone" data-id="${z}" aria-pressed="${zone===z}">${z}</button>`).join('')}</div>${gardenMap(true)}<div class="legend"><span>Occupied</span><span>Harvested</span><span>Available for planting</span></div></section><section class="panel">${panelHead('Today’s care list',`${fmt(state.today)} · Asia/Manila`,link('View all','tasks'))}<div class="task-list">${mine.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||''])).map(t=>`<a class="task-row" href="tasks.html"><span class="task-check">${t.status!=='Pending'?icon('check'):''}</span><div class="task-content"><h3>${escape(t.task_type)}</h3><p>${escape(t.plot_code)} · ${escape(t.assigned_staff||'Unassigned')}</p>${statusBadge(t.status)}</div><span class="task-time">${clock(t.scheduled_time)}</span></a>`).join('')||empty('Your care list is clear for today.')}</div>${isAdmin()&&flags.length?`<div class="takeover-box"><h3>${icon('flag')}${flags.length} takeover${flags.length===1?'':'s'} to review</h3><p>A teammate stepped in. Take a moment to review their update.</p>${button('Review takeovers →','notifications','','text')}</div>`:`<div class="takeover-box"><h3>${icon('leaf')}Care, one task at a time.</h3><p>Record weather adjustments when watering plans change.</p></div>`}</section></div><section class="panel section-space">${panelHead('Recent growing history','Live cycles and crops harvested in the last 6 weeks.',link('Explore plot history','plots'))}${cycleTable(state.cycles.filter(c=>!c.harvest_date||c.harvest_date>=state.cutoff))}</section>`;
}
function plotsPage() {
  return heading('Your garden, from above.','Choose a plot to explore its growth, care, and every chapter before it.',isAdmin()?button('Add plot','new-plot','','','plus'):'')+
    `<div class="toolbar">${filters(['All zones','Greenhouse','Outdoor','Nursery'],zone,'zone')}<span class="muted"><small>${state.plots.length} spaces · One growing community</small></span></div>${gardenMap()}`;
}
function gardenMap(compact=false) {
  const maxSlot=Math.max(27,...state.plots.map(p=>p.map_slot||p.plot_id));
  const height=Math.max(700,(95+Math.floor(Math.max(0,maxSlot-28)/4)*13)*7);
  return `<section class="garden-map ${compact?'compact':''}" aria-label="Interactive garden map">
    <div class="map-caption"><span class="eyebrow">CUAI / Garden atlas</span><label class="map-picker"><span class="sr-only">Choose a plot</span><select id="map-picker"><option value="">Choose a plot…</option>${[...state.plots].sort((a,b)=>a.map_slot-b.map_slot).map(p=>`<option value="${p.plot_id}" ${selectedPlot()?.plot_id===p.plot_id?'selected':''}>${p.map_slot} · ${escape(p.plot_code)}</option>`).join('')}</select></label><span>${icon('sprout')} Tap a space. See what’s growing.</span></div>
    <div class="map-viewport"><svg class="map-svg" viewBox="0 0 1000 ${height}" aria-label="Garden plots" role="group">
      <defs><pattern id="map-grain" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#a8b99b" opacity=".3"/></pattern>
      <pattern id="bed-rows" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6h12" stroke="#fff" opacity=".15" stroke-width="2"/></pattern></defs>
      <g class="map-world">
        <rect class="map-ground" x="0" y="0" width="1000" height="${height}" rx="28"/>
        <rect x="0" y="0" width="1000" height="${height}" fill="url(#map-grain)" rx="28"/>
        <path class="map-path-edge" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>
        <path class="map-path" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>
        <g class="map-landmarks"><circle cx="515" cy="215" r="48"/><circle cx="515" cy="215" r="33"/><rect x="222" y="170" width="77" height="98" rx="20"/><text x="260" y="225">GROW</text><text x="515" y="220">REST</text></g>
        <g class="map-compass"><path d="m665 30-9 30 9-5 9 5Z"/><text x="665" y="20">N</text></g>
        ${state.plots.map(p=>{
          const slot=p.map_slot||p.plot_id,[x,y,w,h]=mapPosition(slot),c=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date);
          const muted=(zone!=='All zones'&&zone!==p.zone)||!match([p.plot_code,p.zone,c?.crop_name||'']);
          return `<g class="map-plot ${p.zone.toLowerCase()} ${p.occupancy_status.toLowerCase()} ${muted?'dimmed':''}" data-action="map-plot" data-id="${p.plot_id}" role="button" tabindex="0" aria-pressed="false" aria-label="Plot ${slot}, ${escape(p.plot_code)}, ${escape(c?.crop_name||p.occupancy_status)}">
            <title>${escape(p.plot_code)} · ${escape(c?.crop_name||'Available for planting')} · ${p.zone}</title>
            <rect class="plot-shape" x="${x*10}" y="${y*7}" width="${w*10}" height="${h*7}" rx="${p.zone==='Outdoor'?5:18}"/>
            <rect class="plot-texture" x="${x*10+4}" y="${y*7+4}" width="${w*10-8}" height="${h*7-8}" rx="5" fill="url(#bed-rows)"/>
            <text class="map-plot-label" x="${(x+w/2)*10}" y="${(y+h/2)*7+5}">${slot}<tspan class="map-plot-code"> · ${escape(p.plot_code)}</tspan></text>
            <circle class="plot-status" cx="${(x+w)*10-10}" cy="${y*7+10}" r="4"/>
          </g>`;
        }).join('')}
        <text class="map-site-label" x="30" y="582">A LITTLE CARE. A GREENER TOMORROW.</text>
      </g>
    </svg></div>
    <div class="map-bottom"><div class="map-key"><span class="indoor-key">Indoor / greenhouse</span><span class="outdoor-key">Outdoor beds</span><span class="nursery-key">Nursery</span><span class="vacant-key">Dashed = vacant</span></div><button class="btn secondary small" data-action="map-reset" aria-label="Zoom out and close plot details">Reset view</button></div>
    ${compact?'':'<aside id="plot-inspector" class="plot-inspector" aria-label="Selected plot" hidden></aside>'}
  </section>`;
}
function mountGardenMap() {
  $('#map-picker')?.addEventListener('change',event=>{if(event.target.value)selectMapPlot(Number(event.target.value));else closeMapPlot();});
  const p=selectedPlot();
  if(view==='plots'&&p) {
    requestAnimationFrame(()=>{zoomMap(p);renderPlotInspector();});
  }
}
function zoomMap(p) {
  const world=$('.map-world');if(!world)return;
  if($('#map-picker'))$('#map-picker').value=p?.plot_id||'';
  document.querySelectorAll('.map-plot').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.id)===p?.plot_id)));
  $('.garden-map').classList.toggle('has-selection',Boolean(p));
  if(!p){world.style.transform='';return;}
  const [x,y,w,h]=mapPosition(p.map_slot||p.plot_id),left=x>55;
  const mobile=matchMedia('(max-width: 700px)').matches;
  const scale=mobile?1.25:1.65,center=mobile?500:left?690:310;
  world.style.transform=`translate(${center-(x+w/2)*10*scale}px,${320-(y+h/2)*7*scale}px) scale(${scale})`;
  $('#plot-inspector')?.classList.toggle('on-left',left);
}
function selectMapPlot(id) {
  if(view!=='plots'){navigate(`plot-info.html?id=${id}`);return;}
  editingPlot=false;plotTab='overview';historyQuery='';historyFertilizer='all';historyFrom='';historyTo='';
  history.pushState({},'',`plot-info.html?id=${id}`);
  zoomMap(selectedPlot());renderPlotInspector();
  $('#plot-heading')?.focus({preventScroll:true});
}
function closeMapPlot() {
  const p=selectedPlot();editingPlot=false;
  if(view==='plots')history.pushState({},'','plot-info.html');
  zoomMap(null);
  const inspector=$('#plot-inspector');if(inspector)inspector.hidden=true;
  document.querySelector(`.map-plot[data-id="${p?.plot_id}"]`)?.focus({preventScroll:true});
}
function timestampLabel(value) {
  if(!value)return 'Not recorded';
  if(!value.includes('T'))return `${fmt(value)} · time not recorded`;
  return new Date(value).toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
function plotFacts(record) {
  return `<img class="plot-photo" src="/img/testinglang.png" alt="Placeholder image for ${escape(record.crop_name)}" loading="lazy">
    <div class="plot-story"><h3>${escape(record.crop_name)}</h3><p>${escape(record.description)}</p></div>
    <dl class="plot-facts"><div><dt>${icon('drop')} Last watered</dt><dd>${escape(timestampLabel(record.watered_at))}</dd></div>
    <div><dt>${icon('sprout')} Last harvest</dt><dd>${escape(timestampLabel(record.harvested_at))}</dd></div>
    <div><dt>${icon('leaf')} Fertilizer</dt><dd>${escape(record.fertilizer||'None')}${record.fertilizer?`<small>${escape(timestampLabel(record.fertilized_at))}</small>`:''}</dd></div></dl>`;
}
function renderPlotInspector() {
  const panel=$('#plot-inspector'),p=selectedPlot();if(!panel||!p)return;
  const c=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date),record=plotOverview(state,p,c);
  panel.hidden=false;
  panel.innerHTML=`<div class="inspector-heading"><div><span class="eyebrow">${escape(p.zone)} · Plot ${p.map_slot||p.plot_id}</span><h2 id="plot-heading" tabindex="-1">${escape(p.plot_code)}</h2></div><div class="inspector-buttons">${isAdmin()&&plotTab==='overview'&&!editingPlot?`<button class="icon-button" data-action="plot-edit" aria-label="Edit plot details">${icon('pencil')}</button>`:''}<button class="icon-button" data-action="map-reset" aria-label="Close plot details">${icon('close')}</button></div></div>
    <div class="tabs inspector-tabs" role="tablist" aria-label="Plot information">${['overview','history'].map(tab=>`<button id="tab-${tab}" class="tab ${plotTab===tab?'active':''}" role="tab" aria-selected="${plotTab===tab}" aria-controls="plot-tab-content" tabindex="${plotTab===tab?0:-1}" data-action="plot-tab" data-id="${tab}">${tab==='overview'?'Overview':'History'}</button>`).join('')}</div>
    <div id="plot-tab-content" class="inspector-content" role="tabpanel" aria-labelledby="tab-${plotTab}">
    ${plotTab==='history'?historyPanel(p):editingPlot&&isAdmin()?plotEditor(record):`${plotFacts(record)}<div class="plot-state">${statusBadge(p.occupancy_status)}<span>Times in Asia/Manila</span></div>`}</div>`;
  if(editingPlot)bindPlotEditor(p,record);
  if(plotTab==='history') {
    for(const id of ['history-query','history-fertilizer','history-from','history-to'])$('#'+id).addEventListener('input',()=>{
      historyQuery=$('#history-query').value;historyFertilizer=$('#history-fertilizer').value;historyFrom=$('#history-from').value;historyTo=$('#history-to').value;renderHistoryResults();
    });
  }
}
function historyPanel(p) {
  return `<div class="history-search"><label for="history-query">${icon('search')} Search this plot’s history</label><input id="history-query" type="search" value="${escape(historyQuery)}" placeholder='crop:Tomato before:2026-10-01' aria-describedby="history-search-help">
    <div class="search-tokens">${['crop','fertilizer','before','after','on'].map(key=>`<button data-action="history-token" data-id="${key}" title="Add ${key} search filter">${key}:</button>`).join('')}</div>
    <p id="history-search-help">Combine words and filters. Use quotes for phrases: crop:"String beans".</p>
    <details class="history-filter"><summary>Filter by date & fertilizer</summary><label>Fertilizer<select id="history-fertilizer"><option value="all">Any application</option><option value="used" ${historyFertilizer==='used'?'selected':''}>Fertilizer used</option><option value="none" ${historyFertilizer==='none'?'selected':''}>None</option></select></label><div class="history-dates"><label>From<input id="history-from" type="date" value="${historyFrom}"></label><label>To<input id="history-to" type="date" value="${historyTo}"></label></div></details></div>
    <div id="history-results">${historyResults(p)}</div>`;
}
function historyResults(p) {
  const records=filterHistory(plotHistory(state,p),historyQuery,historyFertilizer,historyFrom,historyTo);
  return `<p class="history-count" role="status">${records.length} ${records.length===1?'chapter':'chapters'} in this plot’s story</p>${records.map(r=>`<details class="history-entry"><summary><span class="history-dot"></span><span><strong>${fmt(r.date)}</strong><small>${escape(r.crop_name)} · ${r.type}</small></span><span class="history-expand">+</span></summary><div class="history-entry-body">${plotFacts(r)}</div></details>`).join('')||empty('No history matches. Try a different crop, date, or fertilizer filter.')}`;
}
function renderHistoryResults(){const p=selectedPlot();if(p)$('#history-results').innerHTML=historyResults(p);}
function plotEditor(record) {
  const local=value=>value?.includes('T')?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):'';
  const input=(label,key)=>`<div class="field"><label for="plot-${key}">${label} (Manila)</label><input id="plot-${key}" name="${key}" type="datetime-local" value="${local(record[key])}">${record[key]&&!record[key].includes('T')?`<small>Existing date: ${fmt(record[key])}. Leave blank to keep its unknown time.</small>`:''}</div>`;
  return `<form id="plot-edit-form"><div class="field"><label for="plot-description">About this plot</label><textarea id="plot-description" name="description" required maxlength="500">${escape(record.description)}</textarea></div>
    ${input('Last watered','watered_at')}${input('Last harvest','harvested_at')}
    <div class="field"><label for="plot-fertilizer-mode">Fertilizer</label><select id="plot-fertilizer-mode"><option value="none" ${!record.fertilizer?'selected':''}>None</option><option value="used" ${record.fertilizer?'selected':''}>Fertilizer used</option></select></div>
    <div id="fertilizer-fields" ${!record.fertilizer?'hidden':''}><div class="field"><label for="plot-fertilizer">Product name</label><input id="plot-fertilizer" name="fertilizer" maxlength="120" value="${escape(record.fertilizer||'')}"></div>${input('Applied','fertilized_at')}</div>
    <p class="editor-note">Saving adds a dated entry to History. Crop changes use the actions below.</p><div class="form-error" role="alert"></div>
    <div class="plot-edit-actions"><button type="button" class="btn secondary small" data-action="plot-cancel">Cancel</button><button class="btn small" type="submit">Save details</button></div>
    </form>${plotCropActions(record)}`;
}
function plotCropActions(record) {
  const p=selectedPlot();
  return `<div class="plot-crop-actions"><span class="eyebrow">Manage this crop</span>${record.cycle_id?`${p.zone==='Nursery'?button('Transplant','transplant',record.cycle_id,'secondary small'):''}${button('Record harvest','harvest',record.cycle_id,'secondary small')}${button('Change assignment','cycle-assignment',record.cycle_id,'text')}`:button('Plant a crop','new-cycle',p.plot_id,'secondary small','plus')}</div>`;
}
function bindPlotEditor(p,record) {
  const toggle=()=>{const used=$('#plot-fertilizer-mode').value==='used';$('#fertilizer-fields').hidden=!used;$('#plot-fertilizer').required=used;$('#plot-fertilized_at').required=used&&!record.fertilized_at;};
  $('#plot-fertilizer-mode').addEventListener('change',toggle);toggle();
  $('#plot-edit-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    for(const key of ['watered_at','harvested_at','fertilized_at'])values[key]=values[key]?new Date(values[key]+':00+08:00').toISOString():record[key]?.includes('T')?null:record[key]||null;
    if($('#plot-fertilizer-mode').value==='none'){values.fertilizer=null;values.fertilized_at=null;}
    try{await api('plot-entry',{...values,plot_id:p.plot_id,cycle_id:record.cycle_id});editingPlot=false;await refresh();toast('Plot details saved to history.');}
    catch(error){form.querySelector('.form-error').textContent=error.message;submit.disabled=false;}
  });
}
document.addEventListener('keydown',event=>{
  if(event.target.closest('.map-plot')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.closest('.map-plot').dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  if(event.key==='Escape'&&!$('#modal').open&&selectedPlot()){event.preventDefault();closeMapPlot();}
  if(event.target.matches('[data-action="plot-tab"]')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();plotTab=plotTab==='overview'?'history':'overview';editingPlot=false;renderPlotInspector();$('#tab-'+plotTab).focus();}
});
window.addEventListener('resize',()=>{if(view==='plots')zoomMap(selectedPlot());});

function tasksPage() {
  const tasks=state.tasks.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||'',t.substitute_staff||''])&&(taskFilter==='All tasks'||taskFilter==='My tasks'&&(t.assigned_staff_id===state.user.user_id||t.substitute_staff_id===state.user.user_id)||taskFilter==='Today'&&t.scheduled_date===state.today||taskFilter===t.status));
  return heading('A little care goes a long way.','Plan daily maintenance, record weather changes, and keep care accountable.',isAdmin()?button('Schedule task','new-task','','','plus'):'')+`<div class="toolbar">${filters(['All tasks','My tasks','Today','Pending','Completed','Skipped'],taskFilter,'task-filter')}</div>${tasks.length?`<div class="task-cards">${tasks.map(t=>{
    const own=t.assigned_staff_id===state.user.user_id,canUpdate=isAdmin()||own,pending=t.status==='Pending',future=t.scheduled_date>state.today;
    const adjustments=state.adjustments.filter(a=>a.task_id===t.task_id);
    return `<article class="task-card"><div class="plot-card-top">${badge(t.plot_code)}${statusBadge(t.status)}</div><h3>${escape(t.task_type)}</h3><p>${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}<br>Assigned to ${escape(t.assigned_staff||'Unassigned')}${t.assigned_staff_id&&!state.users.find(u=>u.user_id===t.assigned_staff_id)?.active?' (inactive)':''}</p>${t.substitute_staff?`<p class="reason"><strong>Covered by ${escape(t.substitute_staff)}</strong><br>${escape(t.takeover_reason)}<br>${t.is_flagged_for_admin?'Awaiting admin review':'Reviewed by admin'}</p>`:''}${adjustments.map(a=>`<p class="reason"><strong>${escape(a.action)} · ${escape(a.full_name)}</strong><br>${escape(a.reason)}<br>${escape(a.previous_schedule)}${a.new_schedule?` → ${escape(a.new_schedule)}`:''}</p>`).join('')}<div class="actions">${pending&&canUpdate&&!future?button('Mark complete','complete',t.task_id,'small','check'):''}${pending&&!isAdmin()&&!own&&t.assigned_staff_id&&!future?button('Take over','takeover',t.task_id,'small','users'):''}${pending&&canUpdate&&t.task_type==='Manual watering'?button('Weather adjustment','adjust',t.task_id,'secondary small'):''}${pending&&isAdmin()?button('Reassign','task-assignment',t.task_id,'text'):''}</div></article>`;
  }).join('')}</div>`:empty('No tasks match this view.')}`;
}
function inventoryPage() { const plants=state.plants.filter(p=>match([p.crop_name,p.variety,p.notes]));return heading('Meet what’s growing.','The shared crop catalog for our campus garden.',isAdmin()?button('Add crop','new-plant','','','plus'):'')+`<section class="panel">${panelHead('Plant inventory',`${state.plants.length} crop varieties in the garden catalog`)}${plants.length?`<div class="table-wrap"><table><thead><tr><th>Crop</th><th>Variety</th><th>Live cycles</th><th>Growing notes</th><th></th></tr></thead><tbody>${plants.map(p=>`<tr><td><div class="table-crop"><span class="crop-icon">${icon('sprout')}</span><strong>${escape(p.crop_name)}</strong></div></td><td>${escape(p.variety||'—')}</td><td>${state.cycles.filter(c=>c.plant_id===p.plant_id&&!c.harvest_date).length}</td><td>${escape(p.notes||'—')}</td><td>${isAdmin()?button('Plant crop','plant-crop',p.plant_id,'secondary small'):''}</td></tr>`).join('')}</tbody></table></div>`:empty('No crops match your search.')}</section>`; }
function staffPage() { return heading('Growing is a team effort.','Manage authorized accounts and see who’s caring for the garden.',button('Add account','new-user','','','plus'))+`<div class="account-grid">${state.users.filter(u=>match([u.full_name,u.email,u.role])).map(u=>`<article class="person-card"><span class="avatar">${escape(initials(u.full_name))}</span><h3>${escape(u.full_name)}</h3><p>${escape(u.email)}<br>${u.role} · ${state.tasks.filter(t=>t.assigned_staff_id===u.user_id&&t.status==='Pending').length} pending tasks</p><div class="person-bottom">${badge(u.active?'Active':'Inactive',u.active?'':'gray')}${u.user_id!==state.user.user_id?button(u.active?'Deactivate':'Reactivate','user-status',u.user_id,'text'):'<small class="muted">Your account</small>'}</div></article>`).join('')}</div>`; }
function nutrientsPage() { const logs=state.nutrients.filter(n=>match([n.product,n.nutrient_type,n.plot_code,n.full_name,n.notes]));return heading('Nourish what comes next.','Record fertilizer and hydroponic nutrient applications.',button('Log application','new-nutrient','','','plus'))+`<div class="notice">This log records manual applications. It does not measure water or fertilizer usage. Pesticides and insecticides are outside this garden’s workflow.</div><section class="panel">${panelHead('Application history','Recorded by the staff who completed the application.')}${logs.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Plot</th><th>Application</th><th>Product</th><th>Recorded by</th><th>Notes</th></tr></thead><tbody>${logs.map(n=>`<tr><td>${fmt(n.application_date)}</td><td><strong>${escape(n.plot_code)}</strong></td><td>${badge(n.nutrient_type)}</td><td>${escape(n.product)}</td><td>${escape(n.full_name)}</td><td>${escape(n.notes||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty('No nutrient applications match this view.')}</section>`; }
function modal(title,description,fields,endpoint,extra={},label='Save record') {
  const dialog=$('#modal');
  dialog.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body"><p>${description}</p><form id="record-form">${fields}<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close">Cancel</button><button class="btn" type="submit">${label}</button></div></form></div>`;
  dialog.showModal();
  $('#record-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try { await api(endpoint,{...Object.fromEntries(new FormData(form)),...extra});dialog.close();if(endpoint==='password'){state=null;renderLogin();toast('Password changed. Sign in again.');}else{await refresh();toast('Garden record saved.');} }
    catch(error){form.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}
  });
}
function openForm(action,id) {
  const today=state.today,task=state.tasks.find(t=>t.task_id===Number(id)),cycle=state.cycles.find(c=>c.cycle_id===Number(id));
  if(action==='new-plant') modal('Add a crop','Keep the shared crop catalog up to date.',`${field('Crop name','crop_name','text','','required maxlength="80"')}${field('Variety','variety','text','','maxlength="80"')}${field('Growing notes (optional)','notes','text','','maxlength="500"')}`,'plants');
  if(action==='new-plot') modal('Add a garden plot','Give each garden space a unique plot code.',`${field('Plot code','plot_code','text','','required maxlength="30" placeholder="e.g. GH-03"')}${select('Zone','zone',options(['Greenhouse','Outdoor','Nursery'].map(x=>({x})),'x','x'))}`,'plots');
  if(action==='new-cycle'||action==='plant-crop') {
    const available=state.plots.filter(p=>p.occupancy_status!=='Occupied');
    if(!available.length) {toast('All plots are occupied. Record a harvest or add a plot first.');return;}
    modal('Start a new crop cycle','The planting date and original plot stay with this crop throughout its life.',`${select('Crop','plant_id',options(state.plants,'plant_id','crop_name',action==='plant-crop'?id:''))}${select('Available plot','plot_id',options(available,'plot_id','plot_code',action==='new-cycle'?id:''))}${field('Planting date','planted_date','date',today,`required max="${today}"`)}${select('Assigned staff','assigned_staff_id',staffOptions())}`,'cycles');
    $('#f-assigned_staff_id').required=false;
  }
  if(action==='transplant') {
    const targets=state.plots.filter(p=>p.zone!=='Nursery'&&p.occupancy_status!=='Occupied');
    if(!targets.length) {toast('No outdoor or greenhouse plots are currently available.');return;}
    modal('A new place to grow',`${escape(cycle.crop_name)} · ${escape(cycle.origin_plot)} origin · Planted ${fmt(cycle.planted_date)}. The transplant will be dated today.`,select('Destination plot','target_plot_id',options(targets,'plot_id','plot_code')),'transplant',{cycle_id:cycle.cycle_id},'Transplant crop');
  }
  if(action==='harvest') modal('Record a harvest',`${escape(cycle.crop_name)} · ${escape(cycle.plot_code)}. This closes the cycle and makes the plot available for planting.`,field('Harvest date','harvest_date','date',today,`required min="${cycle.transplanted_date||cycle.planted_date}" max="${today}"`),'harvest',{cycle_id:cycle.cycle_id},'Record harvest');
  if(action==='cycle-assignment'||action==='task-assignment') {
    modal('Update staff assignment','Choose a staff member, or leave this duty unassigned.',select('Assigned staff','assigned_staff_id',staffOptions(cycle&&action==='cycle-assignment'?cycle.assigned_staff_id:task?.assigned_staff_id)),action,action==='cycle-assignment'?{cycle_id:Number(id)}:{task_id:Number(id)});
    $('#f-assigned_staff_id').required=false;
  }
  if(action==='new-task') {
    modal('Schedule garden care','Use individual dated tasks for daily watering, extra sessions, and other garden care.',`<div class="form-grid">${select('Plot','plot_id',plotOptions())}${select('Task type','task_type',options(['Manual watering','Fertilizer application','Hydroponic nutrients','General maintenance'].map(x=>({x})),'x','x'))}${field('Date','scheduled_date','date',today,'required')}${field('Time (Asia/Manila)','scheduled_time','time','08:00','required')}<div class="wide">${select('Assigned staff','assigned_staff_id',staffOptions())}</div></div>`,'tasks');
    $('#f-assigned_staff_id').required=false;
  }
  if(action==='takeover') modal('Step in for a teammate',`You will complete ${escape(task.task_type.toLowerCase())} for ${escape(task.assigned_staff)} at ${escape(task.plot_code)}. Your reason will be sent to the admin’s review list.`,textarea('Why are you taking over?','takeover_reason'),'takeover',{task_id:task.task_id},'Take over & complete');
  if(action==='complete') modal('Mark this task complete?',`${escape(task.task_type)} · ${escape(task.plot_code)} · ${fmt(task.scheduled_date)}. Confirm after the manual work is done.`,'','complete',{task_id:task.task_id},'Mark complete');
  if(action==='adjust') {
    modal('Adjust for the weather',`Update watering for ${escape(task.plot_code)} only. Other plots keep their own care schedules.`,`${select('Adjustment','action',options(['Skip','Reschedule'].map(x=>({x})),'x','x'))}<div id="reschedule-fields" hidden>${field('New date','scheduled_date','date',today,`min="${today}"`)}${field('New time','scheduled_time','time',task.scheduled_time)}</div>${textarea('Weather observation and reason','reason')}`,'adjust',{task_id:task.task_id},'Save adjustment');
    $('#f-action').addEventListener('change',event=>{const reschedule=event.target.value==='Reschedule';$('#reschedule-fields').hidden=!reschedule;$('#f-scheduled_date').required=reschedule;$('#f-scheduled_time').required=reschedule;});
  }
  if(action==='new-nutrient') modal('Log an application','Record only fertilizer or hydroponic nutrients actually applied.',`${select('Target plot','plot_id',plotOptions())}${select('Application type','nutrient_type',options(['Fertilizer','Hydroponic nutrient'].map(x=>({x})),'x','x'))}${field('Application date','application_date','date',today,`required max="${today}"`)}${field('Fertilizer / nutrient product','product','text','','required maxlength="120"')}${field('Notes (optional)','notes','text','','maxlength="500"')}`,'nutrients');
  if(action==='new-user') modal('Add an authorized account','Share the initial password securely and ask the staff member to change it on first sign-in.',`${field('Full name','full_name','text','','required maxlength="100"')}${field('Email address','email','email','','required maxlength="150" autocomplete="off"')}${select('Role','role',options(['Staff','Admin'].map(x=>({x})),'x','x'))}${field('Initial password','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}`,'users',{},'Create account');
  if(action==='user-status') {const user=state.users.find(u=>u.user_id===Number(id));modal(user.active?'Deactivate account?':'Reactivate account?',`${escape(user.full_name)}. ${user.active?'Their current sessions will end. Existing assignments and records will remain; reassign pending tasks as needed.':'This account will be able to sign in again.'}`,'','user-status',{user_id:user.user_id,active:!user.active},user.active?'Deactivate':'Reactivate');}
  if(action==='password') modal('Change your password','Use at least 12 characters. All your sessions will end after the change.',`${field('Current password','current_password','password','','required autocomplete="current-password" maxlength="128"')}${field('New password','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}`,'password',{},'Update password');
}
function notifications() {
  if(!isAdmin()) {navigate('tasks.html');return;}
  const flags=state.tasks.filter(t=>t.is_flagged_for_admin);
  $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">Task takeover review</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>${flags.length?flags.map(t=>`<div class="review-row"><div><h3>${escape(t.plot_code)} · ${escape(t.task_type)}</h3><p>${fmt(t.scheduled_date)}<br>${escape(t.substitute_staff)} covered for ${escape(t.assigned_staff)}.<br><strong>Reason:</strong> ${escape(t.takeover_reason)}</p></div>${button('Mark reviewed','review',t.task_id,'small')}</div>`).join(''):empty('All caught up. No takeovers are waiting for review.')}`;
  $('#modal').showModal();
}
async function refresh() { state=await api('state');view=getView();shell(); }
function navigate(target) {editingPlot=false;plotTab='overview';history.pushState({},'',target);view=getView();search='';shell();window.scrollTo(0,0);}
document.addEventListener('click',async event=>{
  const anchor=event.target.closest('a');
  if(anchor&&state&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&anchor.origin===location.origin) {event.preventDefault();navigate(anchor.getAttribute('href'));return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id}=target.dataset;
  try {
    if(action==='close'){$('#modal').close();return;}
    if(action==='menu'){$('#sidebar').classList.toggle('open');$('.mobile-menu').setAttribute('aria-expanded',$('#sidebar').classList.contains('open'));if(!$('#sidebar').classList.contains('open'))$('.mobile-menu').focus();return;}
    if(action==='map-plot'){selectMapPlot(Number(id));return;}
    if(action==='map-reset'){closeMapPlot();return;}
    if(action==='plot-tab'){plotTab=id;editingPlot=false;renderPlotInspector();document.querySelector(`[data-action="plot-tab"][data-id="${id}"]`)?.focus();return;}
    if(action==='plot-edit'){if(isAdmin()){editingPlot=true;renderPlotInspector();$('#plot-description')?.focus();}return;}
    if(action==='plot-cancel'){editingPlot=false;renderPlotInspector();return;}
    if(action==='history-token'){const input=$('#history-query');input.value+=(input.value?' ':'')+id+':';historyQuery=input.value;input.focus();renderHistoryResults();return;}
    if(action==='zone'){zone=id;renderMain();return;}
    if(action==='task-filter'){taskFilter=id;renderMain();return;}
    if(action==='my-tasks'){taskFilter='My tasks';navigate('tasks.html');return;}
    if(action==='notifications'){notifications();return;}
    if(action==='review'){target.disabled=true;await api('review',{task_id:Number(id)});await refresh();notifications();toast('Takeover reviewed. The original record is preserved.');return;}
    if(action==='account'){
      $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">Your account</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body"><p>${escape(state.user.full_name)}<br>${escape(state.user.email)} · ${state.user.role}</p><div class="modal-actions">${button('Change password','password')}${button('Sign out','logout','','')}</div></div>`;$('#modal').showModal();return;
    }
    if(action==='logout'){await api('logout',{});state=null;renderLogin();return;}
    openForm(action,id);
  }catch(error){target.disabled=false;toast(error.message);}
});
window.addEventListener('popstate',()=>{if(state){view=getView();search='';shell();}});
try{await refresh();}catch(error){if(!state)renderLogin();if(error.message!=='Please sign in to continue.')toast(error.message);}
