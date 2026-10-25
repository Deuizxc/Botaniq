import { mapPosition, plotOverview, plotHistory, filterHistory, assignedPending, taskPeriod, calendarMonth, notificationKeys } from './garden.js';
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
let state, view, search = '', zone = 'All zones', taskFilter = 'Assigned', toastTimer;
let taskScope = 'mine', staffFilter = 'all', cropSearch = '', calendarOffset = 0, calendarDate = '', mapZoom = 1;
let mapPan = {x:0,y:0};
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
  if(!response.ok) { if(response.status===401 && path!=='login' && state) { state=null;renderLogin(); } throw new Error(result.error); }
  return result;
}
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function getView() { return ({'tasks.html':'tasks','plot-info.html':'plots','edit-plot.html':'plots','inventory.html':'inventory','staff.html':'staff','archive.html':'plots','nutrients.html':'tasks'})[location.pathname.split('/').pop()] || 'dashboard'; }
const href = name => ({dashboard:isAdmin()?'admin-dashboard.html':'staff-dashboard.html',plots:'plot-info.html',tasks:'tasks.html',inventory:'inventory.html',staff:'staff.html',nutrients:'nutrients.html'})[name];
function renderLanding() {
  document.title='BotaniQ · QCU garden care';
  $('#app').innerHTML=`<div class="landing"><header class="landing-header"><a class="university" href="/"><img src="/img/qculogo.png" alt="Quezon City University seal" width="76" height="76"><span><strong>Quezon City University</strong><small>San Bartolome, Novaliches</small></span></a><a class="btn" href="login.html">Get started ${icon('arrow')}</a></header><main><section class="landing-intro"><div><h1><img class="welcome-logo" src="/img/landing_welcomemsg.png" alt="Welcome to BotaniQ"></h1></div><div class="landing-copy"><p>A shared garden.<br>A little care, every day.</p><p>Keep QCU’s garden growing with clear tasks, planting schedules, and a record of every crop.</p></div></section><figure class="landing-photo"><img src="/img/landingpage_bg.png" alt="Vegetable beds and greenhouses at Quezon City University" width="778" height="825"></figure></main><footer class="landing-footer"><a class="brand" href="/"><img src="/img/landing_botaniq.png" alt="BotaniQ"></a><p>Garden Tracker of Quezon City University</p></footer></div>`;
}
function renderLogin() {
  $('#modal').close();document.title='BotaniQ · Log in';
  $('#app').innerHTML=`<main class="login"><section class="login-form"><div class="login-box"><a class="login-back" href="/">← Back</a><h1>Welcome!</h1><p>Log in to check your tasks and manage your plots</p><form id="login-form">${field('Email address','email','email','','required autocomplete="username" placeholder="Your email address"')}${field('Password','password','password','','required autocomplete="current-password" maxlength="128"')}<div class="form-error" role="alert"></div><button class="btn" type="submit">Log in</button></form><p class="login-foot">New here? Approach an admin for a staff account.</p></div></section><section class="login-art" aria-label="The QCU campus garden"><img class="login-background" src="/img/login_bg.png" alt="QCU campus gardens and greenhouses" width="778" height="825"><a class="university login-university" href="/"><img src="/img/qculogo.png" alt="Quezon City University seal"><span><strong>Quezon City University</strong><small>San Bartolome, Novaliches</small></span></a><div class="login-brand"><img src="/img/Logo.png" alt="BotaniQ"><p>Assign · Track · Schedule</p></div><div class="login-photo-copy"><p>Good care today.<br>A greener campus tomorrow.</p><span>Quezon City University</span></div></section></main>`;
  $('#login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('button');submit.disabled=true;try{await api('login',Object.fromEntries(new FormData(form)));history.replaceState({},'','index.html');await refresh();history.replaceState({},'',href('dashboard'));toast('Welcome back. Your garden is ready.');}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}});
}
function shell() {
  const names={dashboard:'Overview',plots:'Garden plots',tasks:'Maintenance tasks',inventory:'Crop information',staff:'Staff & access',nutrients:'Nutrient log'};
  const links=[['dashboard','grid'],['tasks','tasks'],['plots','sprout'],['inventory','leaf'],...(isAdmin()?[['staff','users']]:[])];
  const flags=state.tasks.filter(t=>t.is_flagged_for_admin);
  const unread=(state.messages||[]).filter(m=>!m.read_at).length;
  $('#app').innerHTML=`<aside class="sidebar" id="sidebar"><button class="icon-button sidebar-close" data-action="menu" aria-label="Close navigation">${icon('close')}</button><a class="brand" href="${href('dashboard')}"><img class="brand-logo" src="/img/Logo.png" alt="BotaniQ"></a><div class="workspace">Garden workspace</div><nav class="nav" aria-label="Main navigation">${links.map(([name,ic])=>`<a href="${href(name)}" class="${view===name?'active':''}" ${view===name?'aria-current="page"':''} title="${names[name]}">${icon(ic)}<span>${names[name]}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="garden-note">${icon('sprout')}<strong>Small steps. Lasting growth.</strong>Every record helps us care for a greener campus.</div><small>CUAI · QUEZON CITY UNIVERSITY</small></div></aside><div class="layout"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb">Workspace <span>/</span> <strong>${names[view]}</strong></div><div class="top-spacer"></div><label class="search">${icon('search')}<input id="search" type="search" placeholder="Search this workspace…" aria-label="Search current page" value="${escape(search)}"></label><button class="icon-button" data-action="notifications" aria-label="${isAdmin()?'View notifications':'View my tasks'}">${icon('bell')}${isAdmin()&&(flags.length+unread)?'<span class="notification-dot"></span>':''}</button><div class="profile-wrap"><button class="profile" data-action="account" aria-label="Account settings" aria-expanded="false" aria-controls="profile-menu"><span class="avatar">${escape(initials(state.user.full_name))}</span><div><strong>${escape(state.user.full_name)}</strong><small>${isAdmin()?'Garden administrator':'Garden staff'}</small></div></button><div id="profile-menu" class="profile-menu" hidden><strong>${escape(state.user.full_name)}</strong><span>${escape(state.user.email)}</span>${button('Edit profile','edit-profile','','text','pencil')}${button('Sign out','logout','','text')}</div></div></header><main class="main" id="main"></main></div>`;
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
  $('#main').classList.toggle('overview-page',view==='dashboard');
  $('#main').innerHTML=content+`<footer class="footer"><span>${icon('leaf')}Growing with purpose. Caring for our campus.</span><span>BotaniQ · CUAI Garden Management &nbsp; / &nbsp; Demo garden</span></footer>`;
  mountGardenMap();
  $('#task-scope')?.addEventListener('change',event=>{taskScope=event.target.value;renderMain();});
  $('#staff-filter')?.addEventListener('change',event=>{staffFilter=event.target.value;renderMain();});
  $('#crop-search')?.addEventListener('input',event=>{
    cropSearch=event.target.value;
    const next=document.createElement('div');next.innerHTML=inventoryPage();
    $('#crop-results').replaceWith(next.querySelector('#crop-results'));
  });
  document.title=`BotaniQ · ${{dashboard:'Overview',plots:'Garden plots',tasks:'Maintenance tasks',inventory:'Crop information',staff:'Staff & access',nutrients:'Nutrient log'}[view]}`;
}
function filters(items,selected,action) { return `<div class="filters">${items.map(item=>`<button class="filter ${item===selected?'active':''}" data-action="${action}" data-id="${item}" aria-pressed="${item===selected}">${item}</button>`).join('')}</div>`; }
function dashboard() {
  const pending=assignedPending(state.tasks,state.user.user_id);
  const team=state.tasks.filter(t=>t.status==='Pending');
  const tasks=(isAdmin()?team:pending).filter(t=>!calendarDate||t.scheduled_date===calendarDate);
  const watered=new Set(state.tasks.filter(t=>t.task_type==='Manual watering'&&t.status==='Completed'&&t.completed_at&&new Date(t.completed_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})===state.today).map(t=>t.plot_id));
  const watering=new Set(state.tasks.filter(t=>t.task_type==='Manual watering'&&t.status==='Pending'&&t.scheduled_date<=state.today).map(t=>t.plot_id));
  const stats=[['Watered plots',watered.size,'Completed today'],['Awaiting water',watering.size,'Due or overdue'],['Harvested crops',state.cycles.filter(c=>c.harvest_date===state.today).length,'Harvested today'],['Available plots',state.plots.filter(p=>p.occupancy_status!=='Occupied').length,'Ready for planting']];
  return heading(`Welcome, ${escape(isAdmin()?'Admin':state.user.full_name.split(' ')[0])}.`,`${fmt(state.today)} · ${isAdmin()?team.length+' team tasks':pending.length+' of your tasks'} still need care.`,isAdmin()?button('Schedule task','new-task','','','plus'):button('View my tasks','my-tasks','','','tasks'))+
    `<div class="stats care-stats">${stats.map(([label,value,detail])=>`<article class="stat"><div class="stat-top">${label}</div><div class="stat-value">${value}</div><p class="stat-foot">${detail}</p></article>`).join('')}</div><div class="care-grid ${isAdmin()?'admin-care':''}"><section class="panel care-queue">${panelHead(isAdmin()?'Team assignments':'Your tasks',calendarDate?fmt(calendarDate):'Unfinished care, ordered by schedule.',link('View all','tasks'))}${calendarDate?button('Show all dates','calendar-clear','','text small'):''}<div class="task-list">${tasks.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||''])).slice(0,4).map(t=>`<div class="care-row"><div><a href="plot-info.html?id=${t.plot_id}">${escape(t.plot_code)}</a><h3>${escape(t.task_type)}</h3><p>${isAdmin()?escape(t.assigned_staff||'Unassigned')+' · ':''}${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}</p></div><div>${t.scheduled_date<state.today?badge('Missing','amber'):''}${t.scheduled_date===state.today&&!isAdmin()?button('Complete','complete',t.task_id,'secondary small','check'):t.scheduled_date>state.today?badge('Upcoming','gray'):''}</div></div>`).join('')||empty(calendarDate?'No unfinished tasks on this date.':'All caught up. No unfinished tasks.')}</div>${tasks.length>4?`<p class="queue-more">${tasks.length-4} more tasks in Maintenance tasks.</p>`:''}</section>${isAdmin()?`<aside class="panel team-summary">${panelHead('Garden team','Unfinished assignments by staff')}${state.users.filter(u=>u.role==='Staff'&&u.active).map(u=>`<div class="team-row"><span class="avatar">${escape(initials(u.full_name))}</span><span>${escape(u.full_name)}</span><strong>${assignedPending(state.tasks,u.user_id).length}</strong></div>`).join('')||empty('No staff accounts yet.')}</aside>`:taskCalendar(pending)}</div>`;
}
function taskCalendar(pending) {
  const month=calendarMonth(state.today,calendarOffset,pending);
  return `<section class="panel task-calendar" aria-label="Your task calendar"><div class="calendar-heading"><button class="icon-button" data-action="calendar-month" data-id="-1" aria-label="Previous month">‹</button><h2>${month.label}</h2><button class="icon-button" data-action="calendar-month" data-id="1" aria-label="Next month">›</button></div><p>Marked days have unfinished tasks assigned to you.</p><div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('')}${month.cells.map(day=>day?`<button class="calendar-day ${day.count?'has-tasks':''} ${calendarDate===day.date?'selected':''}" data-action="calendar-day" data-id="${day.date}" aria-label="${fmt(day.date)}, ${day.count} unfinished tasks" aria-pressed="${calendarDate===day.date}" ${day.date===state.today?'aria-current="date"':''}>${day.day}${day.count?'<span class="calendar-mark" aria-hidden="true"></span>':''}</button>`:'<span></span>').join('')}</div><p class="calendar-legend"><span></span> Your unfinished tasks</p></section>`;
}
function plotsPage() {
  return heading('CUAI Garden Atlas','Every plot gets the care it needs.',isAdmin()?button('Add plot','new-plot','','','plus'):'')+
    `<div class="toolbar">${filters(['All zones','Greenhouse','Outdoor','Nursery'],zone,'zone')}<span class="muted"><small>Tap a space. See what’s growing.</small></span></div><div class="atlas-layout ${isAdmin()?'with-tasks':''}">${isAdmin()?`<aside class="panel atlas-tasks">${panelHead('Unfinished tasks','Staff assignments')}${state.tasks.filter(t=>t.status==='Pending'&&match([t.task_type,t.plot_code,t.assigned_staff||''])).map(t=>`<a class="atlas-task" href="tasks.html?task=${t.task_id}" data-task-date="${t.scheduled_date}"><strong>${escape(t.task_type)}</strong><span>${escape(t.plot_code)} · ${escape(t.assigned_staff||'Unassigned')}</span><small>${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}${t.scheduled_date<state.today?' · Missing':''}</small></a>`).join('')||empty('No unfinished tasks.')}</aside>`:''}${gardenMap()}</div>`;
}
function gardenMap(compact=false) {
  const maxSlot=Math.max(27,...state.plots.map(p=>p.map_slot||p.plot_id));
  const height=Math.max(700,(95+Math.floor(Math.max(0,maxSlot-28)/4)*13)*7);
  return `<section class="garden-map ${compact?'compact':''}" aria-label="Interactive garden map">
    <div class="map-caption"><span class="eyebrow">CUAI / Garden atlas</span><label class="map-picker"><span class="sr-only">Choose a plot</span><select id="map-picker"><option value="">Choose a plot…</option>${[...state.plots].sort((a,b)=>a.map_slot-b.map_slot).map(p=>`<option value="${p.plot_id}" ${selectedPlot()?.plot_id===p.plot_id?'selected':''}>${p.map_slot} · ${escape(p.plot_code)}</option>`).join('')}</select></label><span>${icon('sprout')} Tap a space. See what’s growing.</span></div>
    <div class="map-viewport"><svg class="map-svg" viewBox="0 0 1000 ${height}" aria-label="Garden plots. Drag or use arrow keys to move the map." role="group" tabindex="0">
      <defs><pattern id="map-grain" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#a8b99b" opacity=".3"/></pattern>
      <pattern id="bed-rows" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6h12" stroke="#fff" opacity=".15" stroke-width="2"/></pattern></defs>
      <g class="map-world">
        <rect class="map-ground" x="0" y="0" width="1000" height="${height}" rx="28"/>
        <rect x="0" y="0" width="1000" height="${height}" fill="url(#map-grain)" rx="28"/>
        <path class="map-path-edge" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>
        <path class="map-path" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>
        <g class="map-landmarks"><circle cx="515" cy="215" r="48"/><circle cx="515" cy="215" r="33"/><rect x="222" y="170" width="77" height="98" rx="20"/><text x="260" y="225">GROW</text><text x="515" y="220">REST</text></g>
        <g class="map-entrance"><text x="638" y="674">Entrance</text><path d="M713 669h17m-8-7 8 7-8 7"/></g>
        ${state.plots.map(p=>{
          const slot=p.map_slot||p.plot_id,[x,y,w,h]=mapPosition(slot),c=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date);
          const muted=(zone!=='All zones'&&zone!==p.zone)||!match([p.plot_code,p.zone,c?.crop_name||'']);
          const assigned=assignedPending(state.tasks,state.user.user_id).some(t=>t.plot_id===p.plot_id);
          return `<g class="map-plot ${p.zone.toLowerCase()} ${p.occupancy_status.toLowerCase()} ${muted?'dimmed':''}" data-action="map-plot" data-id="${p.plot_id}" role="button" tabindex="0" aria-pressed="false" aria-label="Plot ${slot}, ${escape(p.plot_code)}, ${escape(c?.crop_name||p.occupancy_status)}">
            <title>${escape(p.plot_code)} · ${escape(c?.crop_name||'Available for planting')} · ${p.zone}</title>
            <rect class="plot-shape" x="${x*10}" y="${y*7}" width="${w*10}" height="${h*7}" rx="${p.zone==='Outdoor'?5:18}"/>
            <rect class="plot-texture" x="${x*10+4}" y="${y*7+4}" width="${w*10-8}" height="${h*7-8}" rx="5" fill="url(#bed-rows)"/>
            <text class="map-plot-label" x="${(x+w/2)*10}" y="${(y+h/2)*7+5}">${slot}<tspan class="map-plot-code"> · ${escape(p.plot_code)}</tspan></text>
            <circle class="plot-status" cx="${(x+w)*10-10}" cy="${y*7+10}" r="4"/>
            ${assigned?`<g class="plot-task-alert" aria-label="You have unfinished tasks here"><circle cx="${(x+w)*10-8}" cy="${y*7+5}" r="13"/><text x="${(x+w)*10-8}" y="${y*7+10}">!</text></g>`:''}
          </g>`;
        }).join('')}
      </g>
    </svg></div>
    <div class="map-bottom"><div class="map-key"><span class="indoor-key">Indoor / greenhouse</span><span class="outdoor-key">Outdoor beds</span><span class="nursery-key">Nursery</span><span class="vacant-key">Dashed = vacant</span><span class="task-key">! Your unfinished task</span></div><div class="map-controls"><button class="icon-button" data-action="map-zoom" data-id="-0.25" aria-label="Zoom out">−</button><button class="icon-button" data-action="map-zoom" data-id="0.25" aria-label="Zoom in">+</button><button class="btn secondary" data-action="map-reset" aria-label="Reset zoom and close plot details">Reset view</button></div></div>
    ${compact?'':'<aside id="plot-inspector" class="plot-inspector" aria-label="Selected plot" hidden></aside>'}
  </section>`;
}
function mountGardenMap() {
  const svg=$('.map-svg');
  if(svg){
    let drag;
    const point=event=>new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    svg.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      drag={start:point(event),pan:{...mapPan},moved:false};
    });
    svg.addEventListener('pointermove',event=>{
      if(!drag)return;
      const at=point(event),dx=at.x-drag.start.x,dy=at.y-drag.start.y;
      if(!drag.moved&&Math.hypot(dx,dy)<6)return;
      drag.moved=true;svg.setPointerCapture(event.pointerId);svg.classList.add('panning');
      mapPan={x:drag.pan.x+dx,y:drag.pan.y+dy};zoomMap(selectedPlot());
    });
    svg.addEventListener('click',event=>{if(drag?.moved){event.preventDefault();event.stopPropagation();drag=null;}},true);
    svg.addEventListener('pointerup',event=>{svg.classList.remove('panning');if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);if(!drag?.moved)drag=null;});
    svg.addEventListener('pointercancel',()=>{drag=null;svg.classList.remove('panning');});
    svg.addEventListener('pointerleave',()=>{if(!drag?.moved)drag=null;});
    svg.addEventListener('keydown',event=>{
      const delta={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[event.key];
      if(!delta)return;
      event.preventDefault();mapPan.x+=delta[0];mapPan.y+=delta[1];zoomMap(selectedPlot());
    });
  }
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
  if(!p){world.style.transform=mapZoom===1?'':`translate(${500-500*mapZoom+mapPan.x}px,${350-350*mapZoom+mapPan.y}px) scale(${mapZoom})`;return;}
  const [x,y,w,h]=mapPosition(p.map_slot||p.plot_id),left=x>55;
  const mobile=matchMedia('(max-width: 700px)').matches;
  const scale=(mobile?1.25:1.65)*mapZoom,center=mobile?500:left?690:310;
  world.style.transform=`translate(${center-(x+w/2)*10*scale+mapPan.x}px,${320-(y+h/2)*7*scale+mapPan.y}px) scale(${scale})`;
  $('#plot-inspector')?.classList.toggle('on-left',left);
}
function selectMapPlot(id) {
  if(view!=='plots'){navigate(`plot-info.html?id=${id}`);return;}
  if(selectedPlot()?.plot_id===id){closeMapPlot();return;}
  mapPan={x:0,y:0};
  editingPlot=false;plotTab='overview';historyQuery='';historyFertilizer='all';historyFrom='';historyTo='';
  history.pushState({},'',`plot-info.html?id=${id}`);
  zoomMap(selectedPlot());renderPlotInspector();
  $('#plot-heading')?.focus({preventScroll:true});
}
function closeMapPlot() {
  const p=selectedPlot();editingPlot=false;mapZoom=1;mapPan={x:0,y:0};
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
  if(event.key==='Escape'&&$('#profile-menu')&&!$('#profile-menu').hidden){$('#profile-menu').hidden=true;$('.profile').setAttribute('aria-expanded','false');$('.profile').focus();}
  if(event.target.closest('.map-plot')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.closest('.map-plot').dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  if(event.key==='Escape'&&!$('#modal').open&&selectedPlot()){event.preventDefault();closeMapPlot();}
  if(event.target.matches('[data-action="plot-tab"]')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();plotTab=plotTab==='overview'?'history':'overview';editingPlot=false;renderPlotInspector();$('#tab-'+plotTab).focus();}
});
window.addEventListener('resize',()=>{if(view==='plots')zoomMap(selectedPlot());});

function taskDetails(t) {
  const own=t.assigned_staff_id===state.user.user_id,pending=t.status==='Pending',due=t.scheduled_date===state.today;
  const adjustments=state.adjustments.filter(a=>a.task_id===t.task_id);
  return `<details class="task-item" ${Number(new URLSearchParams(location.search).get('task'))===t.task_id?'open':''}><summary><span class="task-symbol">${icon(t.task_type==='Manual watering'?'drop':'tasks')}</span><span class="task-identity"><strong>${escape(t.task_type)}</strong><span>${escape(t.plot_code)} · ${escape(t.assigned_staff||'Unassigned')}</span></span><span class="task-due">${fmt(t.scheduled_date)}<small>${clock(t.scheduled_time)}</small></span>${pending?badge(t.scheduled_date<state.today?'Missing':'Assigned','amber'):statusBadge(t.status)}<span class="task-chevron" aria-hidden="true">⌄</span></summary><div class="task-detail"><p><a href="plot-info.html?id=${t.plot_id}">Open ${escape(t.plot_code)}</a> · ${escape(t.zone)}</p>${t.substitute_staff?`<p class="reason"><strong>Covered by ${escape(t.substitute_staff)}</strong><br>${escape(t.takeover_reason)}<br>${t.is_flagged_for_admin?'Awaiting admin review':'Reviewed by admin'}</p>`:''}${adjustments.map(a=>`<p class="reason"><strong>${escape(a.action)} · ${escape(a.full_name)}</strong><br>${escape(a.reason)}<br>${escape(a.previous_schedule)}${a.new_schedule?` → ${escape(a.new_schedule)}`:''}</p>`).join('')}<div class="actions">${pending&&own&&!isAdmin()&&due?button('Mark complete','complete',t.task_id,'small','check'):''}${pending&&!isAdmin()&&!own&&t.assigned_staff_id&&due?button('Take over','takeover',t.task_id,'secondary small'):''}${pending&&own&&!isAdmin()&&t.task_type==='Manual watering'?button('Weather adjustment','adjust',t.task_id,'secondary small'):''}${pending&&isAdmin()?button('Reassign','task-assignment',t.task_id,'text'):''}${!isAdmin()&&(own||t.substitute_staff_id===state.user.user_id)?button('Message admin','task-message',t.task_id,'secondary small'):''}</div></div></details>`;
}
function tasksPage() {
  const tasks=state.tasks.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||'',t.substitute_staff||''])&&(isAdmin()?(staffFilter==='all'||String(t.assigned_staff_id)===staffFilter):(taskScope==='all'||t.assigned_staff_id===state.user.user_id||t.substitute_staff_id===state.user.user_id))&&(taskFilter==='Done'?t.status!=='Pending':t.status==='Pending'&&(taskFilter==='Missing'?t.scheduled_date<state.today:t.scheduled_date>=state.today)));
  const groups=['Today','This week','Next week','Later'];
  return heading('Maintenance tasks','Every plot gets the care it needs.',isAdmin()?button('Schedule task','new-task','','','plus'):'')+`<section class="task-board"><div class="task-toolbar">${filters(['Assigned','Missing','Done'],taskFilter,'task-filter')}${!isAdmin()?`<label class="task-scope">Show<select id="task-scope"><option value="mine" ${taskScope==='mine'?'selected':''}>My tasks</option><option value="all" ${taskScope==='all'?'selected':''}>All team tasks</option></select></label>`:`<label class="task-scope">Show<select id="staff-filter"><option value="all">All team assignments</option>${options(state.users.filter(u=>u.role==='Staff'),'user_id','full_name',staffFilter)}</select></label>`}</div>${taskFilter!=='Assigned'?(tasks.map(taskDetails).join('')||empty('No '+taskFilter.toLowerCase()+' tasks.')):groups.map(group=>{const rows=tasks.filter(t=>taskPeriod(t.scheduled_date,state.today)===group);return `<details class="task-group" ${rows.length?'open':''}><summary><h2>${group}</h2><span>${rows.length}</span><span aria-hidden="true">⌄</span></summary><div>${rows.map(taskDetails).join('')||'<p class="task-group-empty">No tasks here.</p>'}</div></details>`;}).join('')}</section>${isAdmin()?'<button class="task-fab" data-action="new-task" aria-label="Schedule a task">'+icon('plus')+'</button>':''}`;
}
function inventoryPage() { const plants=state.plants.filter(p=>match([p.crop_name,p.variety,p.notes])&&`${p.crop_name}${p.variety?' · '+p.variety:''}`.toLowerCase().includes(cropSearch.toLowerCase()));return heading('Crop Information','Every plot gets the care it needs.',isAdmin()?button('Add crop','new-plant','','','plus'):'')+`<div class="catalog-filter"><label for="crop-search">Find a crop or variety</label><input id="crop-search" type="search" list="crop-options" value="${escape(cropSearch)}" placeholder="View all" autocomplete="off"><datalist id="crop-options">${state.plants.map(p=>`<option value="${escape(p.crop_name+(p.variety?' · '+p.variety:''))}"></option>`).join('')}</datalist></div><section class="panel" id="crop-results" aria-live="polite">${panelHead('Crop information',`${state.plants.length} crop varieties in the garden catalog`)}${plants.length?`<div class="table-wrap"><table class="crop-table"><thead><tr><th>Crop</th><th>Variety</th><th class="numeric">Live cycles</th><th>Growing notes</th><th></th></tr></thead><tbody>${plants.map(p=>`<tr><td><strong>${escape(p.crop_name)}</strong></td><td data-label="Variety">${escape(p.variety||'—')}</td><td data-label="Live cycles" class="numeric">${state.cycles.filter(c=>c.plant_id===p.plant_id&&!c.harvest_date).length}</td><td data-label="Growing notes">${escape(p.notes||'—')}</td><td>${isAdmin()?button('Plant crop','plant-crop',p.plant_id,'secondary small'):''}</td></tr>`).join('')}</tbody></table></div>`:empty('No crops match your search.')}</section>`; }
function staffPage() { return heading('Staff and Access','Every plot gets the care it needs.',button('Add account','new-user','','','plus'))+`<div class="account-grid">${state.users.filter(u=>match([u.full_name,u.email,u.role])).map(u=>`<article class="person-card"><span class="avatar">${escape(initials(u.full_name))}</span><h3>${escape(u.full_name)}</h3><p>${escape(u.email)}<br>${u.role} · ${state.tasks.filter(t=>t.assigned_staff_id===u.user_id&&t.status==='Pending').length} pending tasks</p><div class="person-bottom">${badge(u.active?'Active':'Inactive',u.active?'':'gray')}${u.user_id!==state.user.user_id?button('Remove account','remove-user',u.user_id,'text danger'):'<small class="muted">Your account</small>'}</div></article>`).join('')}</div>`; }
function modal(title,description,fields,endpoint,extra={},label='Save record') {
  const dialog=$('#modal');
  dialog.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body"><p>${description}</p><form id="record-form">${fields}<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close">Cancel</button><button class="btn" type="submit">${label}</button></div></form></div>`;
  dialog.showModal();
  $('#record-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try { const result=await api(endpoint,{...Object.fromEntries(new FormData(form)),...extra});dialog.close();if(endpoint==='password'||result.signed_out){state=null;renderLogin();toast('Profile updated. Sign in again.');}else{await refresh();toast(endpoint==='profile'?'Profile updated.':endpoint==='remove-user'?'Account removed. Pending work is now unassigned.':endpoint==='task-message'?'Message sent privately to your admin.':'Garden record saved.');} }
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
    modal('Start a new crop cycle','The planting date and original plot stay with this crop throughout its life.',`${select('Crop','plant_id',options(state.plants.map(p=>({...p,label:p.crop_name+(p.variety?' · '+p.variety:'')})),'plant_id','label',action==='plant-crop'?id:''))}${select('Available plot','plot_id',options(available,'plot_id','plot_code',action==='new-cycle'?id:''))}${field('Planting date','planted_date','date',today,`required max="${today}"`)}${select('Assigned staff','assigned_staff_id',staffOptions())}`,'cycles');
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
  const applicationFields=task&&['Fertilizer application','Hydroponic nutrients'].includes(task.task_type)?`${field('Product applied','product','text','','required maxlength="120"')}${field('Application notes (optional)','notes','text','','maxlength="500"')}`:'';
  if(action==='task-message') modal('Message your admin',`${escape(task.task_type)} · ${escape(task.plot_code)}. Only administrators can read this message.`,textarea('Message','message'),'task-message',{task_id:task.task_id},'Send message');
  if(action==='takeover') modal('Step in for a teammate',`You will complete ${escape(task.task_type.toLowerCase())} for ${escape(task.assigned_staff)} at ${escape(task.plot_code)}. Your reason will be sent to the admin’s review list.`,textarea('Why are you taking over?','takeover_reason')+applicationFields,'takeover',{task_id:task.task_id},'Take over & complete');
  if(action==='complete') modal('Mark this task complete?',`${escape(task.task_type)} · ${escape(task.plot_code)} · ${fmt(task.scheduled_date)}. Confirm after the manual work is done.`,applicationFields,'complete',{task_id:task.task_id},'Mark complete');
  if(action==='adjust') {
    modal('Adjust for the weather',`Update watering for ${escape(task.plot_code)} only. Other plots keep their own care schedules.`,`${select('Adjustment','action',options(['Skip','Reschedule'].map(x=>({x})),'x','x'))}<div id="reschedule-fields" hidden>${field('New date','scheduled_date','date',today,`min="${today}"`)}${field('New time','scheduled_time','time',task.scheduled_time)}</div>${textarea('Weather observation and reason','reason')}`,'adjust',{task_id:task.task_id},'Save adjustment');
    $('#f-action').addEventListener('change',event=>{const reschedule=event.target.value==='Reschedule';$('#reschedule-fields').hidden=!reschedule;$('#f-scheduled_date').required=reschedule;$('#f-scheduled_time').required=reschedule;});
  }
  if(action==='new-user') modal('Add an authorized account','Use at least 8 characters. Share the initial password securely and ask the staff member to update it in Edit profile.',`${field('Full name','full_name','text','','required maxlength="100"')}${field('Email address','email','email','','required maxlength="150" autocomplete="off"')}${select('Role','role',options(['Staff','Admin'].map(x=>({x})),'x','x'))}${field('Initial password','password','password','','required minlength="8" maxlength="128" autocomplete="new-password"')}`,'users',{},'Create account');
  if(action==='remove-user') {const user=state.users.find(u=>u.user_id===Number(id));modal('Remove account?',`Remove ${escape(user.full_name)}? Access ends immediately. Garden history keeps their name; pending tasks and live crops become unassigned. This cannot be undone.`,'','remove-user',{user_id:user.user_id},'Remove account');}
  if(action==='edit-profile') modal('Edit profile','Update your details. Enter your current password to change your email or password. Security changes sign you out of every session.',`${field('Full name','full_name','text',state.user.full_name,'required maxlength="100" autocomplete="name"')}${field('Email address','email','email',state.user.email,'required maxlength="150" autocomplete="email"')}${field('Current password','current_password','password','','maxlength="128" autocomplete="current-password"')}${field('New password (optional, 8 characters minimum)','password','password','','minlength="8" maxlength="128" autocomplete="new-password"')}`,'profile',{},'Save profile');
}
function notifications() {
  if(!isAdmin()) {taskScope='mine';navigate('tasks.html');return;}
  const flags=state.tasks.filter(t=>t.is_flagged_for_admin),messages=state.messages||[];
  $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">Notifications</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="notification-body"><h3>Staff messages</h3>${messages.map(m=>`<article class="review-row"><div><strong>${escape(m.full_name)}</strong><p>${escape(m.plot_code)} · ${escape(m.task_type)}<br>${escape(timestampLabel(m.created_at))}</p><p class="private-message">${escape(m.message)}</p></div>${!m.read_at?button('Mark read','read-message',m.message_id,'secondary small'):badge('Read','gray')}</article>`).join('')||empty('No staff messages yet.')}<h3>Task takeovers</h3>${flags.map(t=>`<div class="review-row"><div><h3>${escape(t.plot_code)} · ${escape(t.task_type)}</h3><p>${fmt(t.scheduled_date)}<br>${escape(t.substitute_staff)} covered for ${escape(t.assigned_staff)}.<br><strong>Reason:</strong> ${escape(t.takeover_reason)}</p></div>${button('Mark reviewed','review',t.task_id,'small')}</div>`).join('')||empty('No takeovers waiting for review.')}</div>`;
  $('#modal').showModal();
}
async function refresh() { state=await api('state');view=getView();shell(); }
function navigate(target) {editingPlot=false;plotTab='overview';mapZoom=1;mapPan={x:0,y:0};history.pushState({},'',target);view=getView();search='';shell();$('#main').classList.add('view-enter');window.scrollTo(0,0);}
document.addEventListener('click',async event=>{
  const profileMenu=$('#profile-menu');
  if(profileMenu&&!event.target.closest('.profile-wrap')){profileMenu.hidden=true;$('.profile').setAttribute('aria-expanded','false');}
  const anchor=event.target.closest('a');
  if(anchor?.dataset.taskDate){taskFilter=anchor.dataset.taskDate<state.today?'Missing':'Assigned';staffFilter='all';}
  if(anchor&&state&&!['/','/index.html','/login.html'].includes(anchor.pathname)&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&anchor.origin===location.origin) {event.preventDefault();navigate(anchor.getAttribute('href'));return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id}=target.dataset;
  try {
    if(action==='close'){$('#modal').close();return;}
    if(action==='menu'){$('#sidebar').classList.toggle('open');$('.mobile-menu').setAttribute('aria-expanded',$('#sidebar').classList.contains('open'));if(!$('#sidebar').classList.contains('open'))$('.mobile-menu').focus();return;}
    if(action==='map-plot'){selectMapPlot(Number(id));return;}
    if(action==='map-reset'){mapZoom=1;closeMapPlot();return;}
    if(action==='map-zoom'){mapZoom=Math.max(.75,Math.min(2,mapZoom+Number(id)));zoomMap(selectedPlot());return;}
    if(action==='plot-tab'){plotTab=id;editingPlot=false;renderPlotInspector();document.querySelector(`[data-action="plot-tab"][data-id="${id}"]`)?.focus();return;}
    if(action==='plot-edit'){if(isAdmin()){editingPlot=true;renderPlotInspector();$('#plot-description')?.focus();}return;}
    if(action==='plot-cancel'){editingPlot=false;renderPlotInspector();return;}
    if(action==='history-token'){const input=$('#history-query');input.value+=(input.value?' ':'')+id+':';historyQuery=input.value;input.focus();renderHistoryResults();return;}
    if(action==='zone'){zone=id;renderMain();return;}
    if(action==='task-filter'){taskFilter=id;renderMain();return;}
    if(action==='calendar-month'){calendarOffset+=Number(id);calendarDate='';renderMain();return;}
    if(action==='calendar-day'){calendarDate=calendarDate===id?'':id;renderMain();return;}
    if(action==='calendar-clear'){calendarDate='';renderMain();return;}
    if(action==='my-tasks'){taskFilter='Assigned';taskScope='mine';navigate('tasks.html');return;}
    if(action==='notifications'){notifications();return;}
    if(action==='read-message'){target.disabled=true;await api('read-message',{message_id:Number(id)});await refresh();notifications();toast('Message marked as read.');return;}
    if(action==='review'){target.disabled=true;await api('review',{task_id:Number(id)});await refresh();notifications();toast('Takeover reviewed. The original record is preserved.');return;}
    if(action==='account'){
      const menu=$('#profile-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button').focus();return;
    }
    if(action==='logout'){await api('logout',{});state=null;history.pushState({},'','login.html');renderLogin();return;}
    openForm(action,id);
  }catch(error){target.disabled=false;toast(error.message);}
});
window.addEventListener('popstate',()=>{if(['/','/index.html'].includes(location.pathname)){renderLanding();}else if(state){view=getView();search='';shell();}else renderLogin();});
const landingRoute=['/','/index.html'].includes(location.pathname);
try {
  const [loaded]=await Promise.all([api('state').catch(error=>{if(error.message!=='Please sign in to continue.')toast(error.message);return null;}),new Promise(resolve=>setTimeout(resolve,landingRoute&&!matchMedia('(prefers-reduced-motion: reduce)').matches?1000:0))]);
  state=loaded;
  if(landingRoute)renderLanding();else if(state){view=getView();shell();}else renderLogin();
} catch(error){renderLogin();toast(error.message);}

let polling=false;
setInterval(async()=>{
  if(!state||document.hidden||$('#modal').open||polling||!$('#main'))return;
  polling=true;
  try {
    const next=await api('state'),previous=new Set(notificationKeys(state));
    const incoming=notificationKeys(next).filter(key=>!previous.has(key));
    state=next;
    if(incoming.length) {
      toast(isAdmin()?`${incoming.length} new garden notification${incoming.length===1?'':'s'}. Open the bell to review.`:'Your task schedule has an update. Open your tasks to view it.');
      const bell=document.querySelector('[data-action="notifications"]');
      if(bell&&!bell.querySelector('.notification-dot'))bell.insertAdjacentHTML('beforeend','<span class="notification-dot"></span>');
      if(view==='dashboard'&&!document.activeElement?.matches('input,select,textarea'))renderMain();
    }
  } catch(error) {if(state)toast('Could not refresh notifications. Check your connection.');}
  finally {polling=false;}
},30000);
