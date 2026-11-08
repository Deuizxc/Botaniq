import { plotBounds, dragPlot, plotOverview, plotHistory, filterHistory, assignedPending, taskDateLabel, dailyProgress, overviewPlots, isGreenhouse, isGrowingPlot, calendarMonth, notificationKeys, needsCover, isMissed, taskSummary, reportPeriod, reportStatus, staffReport, plotOccupancy, plotStatus, growthStage, liveCrop, taskWarnings } from './garden.js';
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
  printer:'M6 9V3h12v6 M6 18H3v-8h18v8h-3 M6 14h12v7H6z',
  report:'M6 2h9l4 4v16H6z M14 2v5h5 M9 12h7 M9 16h7',
  sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.leaf}"/></svg>`;
let state, view, search = '', zone = 'All zones', taskFilter = 'Open', toastTimer;
let staffFilter = 'all', cropSearch = '', calendarOffset = 0, calendarDate = '', mapZoom = 1;
let mapPan = {x:0,y:0};
let reportKind = 'Weekly', reportOffset = 0, reportStaff = 'all';
const pageNames = {dashboard:'Overview',plots:'Garden plots',tasks:'Maintenance tasks',reports:'Task reports',inventory:'Crop information',staff:'Staff & access',nutrients:'Nutrient log'};
let editingMap=false, mapPlacing=false, mapEditId=null, mapSaving=false, mapExtent=100;
const activePlots=()=>state.plots.filter(p=>!p.removed_at);
let plotTab = 'overview', editingPlot = false, historyQuery = '', historyFertilizer = 'all', historyFrom = '', historyTo = '';
const selectedPlot = () => state?.plots.find(p => p.plot_id === Number(new URLSearchParams(location.search).get('id')));
const greenhouse = () => state?.plots.find(p => isGreenhouse(p) && p.plot_id === (selectedPlot()?.parent_plot_id || Number(new URLSearchParams(location.search).get('greenhouse'))));
const mapPlots = () => activePlots().filter(p => (p.parent_plot_id || null) === (greenhouse()?.plot_id || null));
const matchesPlot = p => {
  const beds=activePlots().filter(b=>b.parent_plot_id===p.plot_id);
  const crops=state.cycles.filter(c=>!c.harvest_date&&(c.current_plot_id===p.plot_id||beds.some(b=>b.plot_id===c.current_plot_id)));
  return (zone==='All zones'||zone===p.zone)&&match([p.plot_code,p.zone,...beds.map(b=>b.plot_code),...crops.map(c=>`${c.crop_name} ${c.variety||''}`)]);
};
const isAdmin = () => state.user.role === 'Admin';
const initials = name => name.split(' ').slice(0,2).map(x => x[0]).join('');
const fmt = value => value ? new Date(`${value.slice(0,10)}T00:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : '—';
const clock = value => { const [hour,minute] = value.split(':'); return `${Number(hour)%12 || 12}:${minute} ${Number(hour)>=12?'PM':'AM'}`; };
const badge = (label, color = '') => `<span class="badge ${color}">${escape(label)}</span>`;
const statusBadge = status => badge(status,({Vacant:'gray',Harvested:'amber',Pending:'amber',Missed:'amber',Skipped:'gray',Completed:'blue'})[status]||'');
const match = values => values.join(' ').toLowerCase().includes(search.toLowerCase());
const empty = text => `<div class="empty">${icon('sprout')}${escape(text)}</div>`;
const button = (label, action, id = '', style = 'secondary', name = '') => `<button class="btn ${style}" data-action="${action}" data-id="${id}">${name?icon(name):''}${label}</button>`;
const options = (rows,key,label,selected) => rows.map(row=>`<option value="${escape(row[key])}" ${String(row[key])===String(selected)?'selected':''}>${escape(row[label])}</option>`).join('');
const staffOptions = selected => `<option value="">Unassigned</option>${options(state.users.filter(u=>u.role==='Staff'&&u.active),'user_id','full_name',selected)}`;
const plotOptions = selected => options(activePlots(),'plot_id','plot_code',selected);
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
function getView() { return ({'tasks.html':'tasks','reports.html':'reports','plot-info.html':'plots','edit-plot.html':'plots','inventory.html':'inventory','staff.html':'staff','archive.html':'plots','nutrients.html':'tasks'})[location.pathname.split('/').pop()] || 'dashboard'; }
const href = name => ({dashboard:isAdmin()?'admin-dashboard.html':'staff-dashboard.html',plots:'plot-info.html',tasks:'tasks.html',reports:'reports.html',inventory:'inventory.html',staff:'staff.html',nutrients:'nutrients.html'})[name];
// Campus beds growing from seedling to full plant, on a loop. Drawn inline so the CSP needs no new sources.
function gardenScene() {
  const bed=(x,y,scale,row,column)=>{
    const plants=[34,98,162,226].map((px,i)=>{
      const kind=(row+column+i)%3===0?'#scene-fruit':'#scene-leafy';
      return `<g transform="translate(${px} 22)"><g class="scene-plant d${(row*2+column+i)%6}"><g class="${row===2?'scene-sway':''}"><use href="${kind}"/></g></g></g>`;
    }).join('');
    return `<g transform="translate(${x} ${y}) scale(${scale})"><path class="scene-soil" d="M16 0H244L268 30H-8Z"/><rect x="-8" y="30" width="276" height="24" fill="url(#scene-blocks)"/>${plants}</g>`;
  };
  const rows=[[150,338,.56,5,212],[20,392,.74,4,276],[-100,456,1,4,372]];
  const beds=rows.map(([x,y,scale,count,gap],row)=>Array.from({length:count},(_,i)=>bed(x+i*gap,y,scale,row,i)).join('')).join('');
  const posts=[12,112,212,312,412,500].map(x=>`<rect x="${x}" y="196" width="13" height="124" fill="#d8b64c"/>`).join('');
  return `<svg class="garden-scene" viewBox="0 0 1440 540" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Illustration of the QCU garden: raised vegetable beds grow from seedlings into full plants beside a greenhouse and the campus building.">
    <defs>
      <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f6f1"/><stop offset=".6" stop-color="#d6e4c4"/></linearGradient>
      <linearGradient id="scene-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efb46a" stop-opacity="0"/><stop offset=".7" stop-color="#efb46a"/></linearGradient>
      <pattern id="scene-windows" width="30" height="34" patternUnits="userSpaceOnUse"><rect x="5" y="7" width="20" height="20" fill="#7f9aa0"/><path d="M15 7v20" stroke="#e7cd7c" stroke-width="2"/></pattern>
      <pattern id="scene-mesh" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0h12M0 0v12" stroke="#4d7354" stroke-width="1.4" fill="none"/></pattern>
      <pattern id="scene-blocks" width="46" height="24" patternUnits="userSpaceOnUse"><rect width="46" height="24" fill="#8d8f77"/><rect x="5" y="6" width="15" height="12" fill="#55584a"/><rect x="26" y="6" width="15" height="12" fill="#55584a"/><path d="M45.5 0v24" stroke="#6d705c"/></pattern>
      <symbol id="scene-leafy" overflow="visible"><path fill="#4f8a3c" d="M0 0C-20-5-30-24-20-42-8-34-2-16 0 0Z"/><path fill="#5f9f45" d="M0 0C20-5 30-24 20-42 8-34 2-16 0 0Z"/><path fill="#75b552" d="M0 0C-11-14-11-38 0-54 11-38 11-14 0 0Z"/></symbol>
      <symbol id="scene-fruit" overflow="visible"><path d="M0 0V-58" stroke="#3f6d38" stroke-width="3.5" fill="none"/><path fill="#46803a" d="M0-14C-18-14-30-26-30-38-14-40-2-30 0-14ZM0-30C18-30 28-42 28-52 12-54 2-44 0-30Z"/><path fill="#63a347" d="M0-46C-10-48-16-56-15-66-5-64 0-56 0-46Z"/><g class="scene-ripe"><circle cx="-14" cy="-20" r="6.5" fill="#c9472f"/><circle cx="13" cy="-36" r="6" fill="#d4562f"/></g></symbol>
    </defs>
    <rect width="1440" height="540" fill="url(#scene-sky)"/>
    <g class="scene-sun"><circle cx="720" cy="44" r="40" fill="#f6d365"/></g>
    <rect class="scene-dusk" width="1440" height="320" fill="url(#scene-dusk)"/>
    <g fill="#fbfcf7"><path class="scene-cloud" d="M120 118c6-30 52-36 66-12 22-12 54 0 52 22H98c-10 0-6-12 22-10Z"/><path class="scene-cloud slow" d="M880 72c5-22 40-28 52-8 17-8 42 0 40 16H850c-8 0-5-9 30-8Z"/></g>
    <path fill="#7da36a" d="M0 318V214c60-40 120-22 170-10 40-44 118-40 170-6 56-36 120-28 180 2 70-30 170-34 240-6 90-40 200-42 290-8 80-26 180-26 250 4 60-20 100-14 140 8v122Z"/>
    <g><rect x="594" y="92" width="320" height="226" fill="#e7c766"/><rect x="594" y="92" width="320" height="226" fill="url(#scene-windows)"/><path d="M594 160h320M594 228h320" stroke="#c2a549" stroke-width="5"/><path d="M660 92v226M750 92v226M840 92v226" stroke="#b9bdb1" stroke-width="14"/><rect x="584" y="82" width="340" height="12" fill="#a9ad9f"/></g>
    <rect x="0" y="206" width="510" height="112" fill="url(#scene-mesh)"/>${posts}<rect x="0" y="204" width="510" height="5" fill="#b89a3f"/>
    <g><path d="M520 318v-34c0-56 150-56 150 0v34Z" fill="#eaf2e6" opacity=".78"/><path d="M520 284c0-56 150-56 150 0M595 244v74M556 254v64M634 254v64" stroke="#92a693" stroke-width="3" fill="none"/></g>
    <g><path d="M946 318V206c0-112 400-112 400 0v112Z" fill="#edf3ea" opacity=".9"/><path d="M946 206h400M1012 136v182M1080 122v196M1148 118v200M1216 122v196M1284 136v182" stroke="#a5b6a4" stroke-width="3" fill="none"/><path d="M946 318V206c0-112 400-112 400 0v112" stroke="#7f957f" stroke-width="5" fill="none"/></g>
    <rect y="316" width="1440" height="224" fill="#97b878"/>
    ${beds}
    <g class="scene-water"><path d="M1098 468c18-70 66-96 124-78"/><path d="M1098 468c-2-74 42-110 96-112"/><path d="M1098 468c-32-64-84-76-138-52"/><path d="M1098 468c-22-74-66-100-120-92"/></g>
    <rect x="1093" y="466" width="10" height="56" fill="#55584a"/>
    <g class="scene-butterfly"><g class="scene-wings"><path fill="#f2b84b" d="M0 0C-12-14-20-8-16 2-20 10-8 12 0 0Z"/><path fill="#e9a23b" d="M0 0C12-14 20-8 16 2 20 10 8 12 0 0Z"/></g></g>
  </svg>`;
}
function renderLanding() {
  document.title='BotaniQ · QCU garden care';
  $('#app').innerHTML=`<div class="landing"><header class="landing-header"><a class="university" href="/"><img src="/img/qculogo.png" alt="Quezon City University seal" width="76" height="76"><span><strong>Quezon City University</strong><small>San Bartolome, Novaliches</small></span></a><a class="btn" href="login.html">Get started ${icon('arrow')}</a></header><main><section class="landing-intro"><div><h1><img class="welcome-logo" src="/img/landing_welcomemsg.png" alt="Welcome to BotaniQ"></h1></div><div class="landing-copy"><p>A shared garden.<br>A little care, every day.</p><p>Keep QCU’s garden growing with clear tasks, planting schedules, and a record of every crop.</p></div></section><figure class="landing-scene">${gardenScene()}</figure></main><footer class="landing-footer"><a class="brand" href="/"><img src="/img/landing_botaniq.png" alt="BotaniQ"></a><p>Garden Tracker of Quezon City University</p></footer></div>`;
}
function renderLogin() {
  $('#modal').close();document.title='BotaniQ · Log in';
  $('#app').innerHTML=`<main class="login"><section class="login-form"><div class="login-box"><a class="login-back" href="/">← Back</a><h1>Welcome!</h1><p>Log in to check your tasks and manage your plots</p><form id="login-form">${field('Email address','email','email','','required autocomplete="username" placeholder="Your email address"')}${field('Password','password','password','','required autocomplete="current-password" maxlength="128"')}<div class="form-error" role="alert"></div><button class="btn" type="submit">Log in</button></form><p class="login-foot">New here? Approach an admin for a staff account.</p></div></section><section class="login-art" aria-label="The QCU campus garden"><img class="login-background" src="/img/login_bg.png" alt="QCU campus gardens and greenhouses" width="778" height="825"><a class="university login-university" href="/"><img src="/img/qculogo.png" alt="Quezon City University seal"><span><strong>Quezon City University</strong><small>San Bartolome, Novaliches</small></span></a><div class="login-brand"><img src="/img/Logo.png" alt="BotaniQ"><p>Assign · Track · Schedule</p></div><div class="login-photo-copy"><p>Good care today.<br>A greener campus tomorrow.</p><span>Quezon City University</span></div></section></main>`;
  $('#login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('button');submit.disabled=true;try{await api('login',Object.fromEntries(new FormData(form)));history.replaceState({},'','index.html');await refresh();history.replaceState({},'',href('dashboard'));syncPush().catch(()=>{});toast('Welcome back. Your garden is ready.');sessionStorage.setItem('botaniq-greeted','1');loginPopup();}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}});
}
function shell() {
  const links=[['dashboard','grid'],['tasks','tasks'],['plots','sprout'],['inventory','leaf'],...(isAdmin()?[['reports','report'],['staff','users']]:[])];
  $('#app').innerHTML=`<aside class="sidebar" id="sidebar"><button class="icon-button sidebar-close" data-action="menu" aria-label="Close navigation">${icon('close')}</button><a class="brand" href="${href('dashboard')}"><img class="brand-logo" src="/img/Logo.png" alt="BotaniQ"></a><div class="workspace">Garden workspace</div><nav class="nav" aria-label="Main navigation">${links.map(([name,ic])=>`<a href="${href(name)}" class="${view===name?'active':''}" ${view===name?'aria-current="page"':''} title="${pageNames[name]}">${icon(ic)}<span>${pageNames[name]}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="garden-note">${icon('sprout')}<strong>Small steps. Lasting growth.</strong>Every record helps us care for a greener campus.</div><small>CUAI · QUEZON CITY UNIVERSITY</small></div></aside><div class="layout"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb">Workspace <span>/</span> <strong>${pageNames[view]}</strong></div><div class="top-spacer"></div><label class="search">${icon('search')}<input id="search" type="search" placeholder="Search" aria-label="Search current page" value="${escape(search)}"></label><button class="icon-button" data-action="notifications" aria-label="Notifications">${icon('bell')}</button><div class="profile-wrap"><button class="profile" data-action="account" aria-label="Account settings" aria-expanded="false" aria-controls="profile-menu"><span class="avatar">${escape(initials(state.user.full_name))}</span><div><strong>${escape(state.user.full_name)}</strong><small>${isAdmin()?'Garden administrator':'Garden staff'}</small></div></button><div id="profile-menu" class="profile-menu" hidden><strong>${escape(state.user.full_name)}</strong><span>${escape(state.user.email)}</span>${button('Edit profile','edit-profile','','text','pencil')}${button('Sign out','logout','','text')}</div></div></header><main class="main" id="main"></main></div>`;
  updateBell();
  $('#search').addEventListener('input',event=>{search=event.target.value;renderMain();});
  renderMain();
}
function heading(title,description,action='') { return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${action}</div></div>`; }
function panelHead(title,description='',link='') { return `<div class="panel-head"><div><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>${link}</div>`; }
function link(label,name) { return `<a href="${href(name)}">${label} ${icon('arrow')}</a>`; }
function renderMain() {
  let content;
  if(view==='dashboard') content=dashboard();
  if(view==='plots') {const p=selectedPlot();if(p&&isGreenhouse(p))history.replaceState({},'',`plot-info.html?greenhouse=${p.plot_id}`);content=plotsPage();}
  if(view==='tasks') content=tasksPage();
  if(view==='reports') content=isAdmin()?reportsPage():empty('Task reports are available to administrators.');
  if(view==='inventory') content=inventoryPage();
  if(view==='staff') content=isAdmin()?staffPage():empty('Staff management is available to administrators.');
  $('#main').classList.toggle('overview-page',view==='dashboard');
  $('#main').innerHTML=content+`<footer class="footer"><span>${icon('leaf')}Growing with purpose. Caring for our campus.</span><span>BotaniQ · CUAI Garden Management &nbsp; / &nbsp; Demo garden</span></footer>`;
  mountGardenMap();
  $('#staff-filter')?.addEventListener('change',event=>{staffFilter=event.target.value;renderMain();});
  $('#report-staff')?.addEventListener('change',event=>{reportStaff=event.target.value;renderMain();});
  $('#crop-search')?.addEventListener('input',event=>{
    cropSearch=event.target.value;
    const next=document.createElement('div');next.innerHTML=inventoryPage();
    $('#crop-results').replaceWith(next.querySelector('#crop-results'));
  });
  document.title=`BotaniQ · ${pageNames[view]}`;
}
function filters(items,selected,action) { return `<div class="filters">${items.map(item=>`<button class="filter ${item===selected?'active':''}" data-action="${action}" data-id="${item}" aria-pressed="${item===selected}">${item}</button>`).join('')}</div>`; }
function coverAlert() {
  const count=isAdmin()?state.tasks.filter(t=>needsCover(t,state.today)).length:(state.invites||[]).length;
  if(!count)return '';
  return `<div class="cover-alert">${icon('bell')}<p><strong>${count} task${count===1?' needs':'s need'} taking over</strong>${isAdmin()?'Staff were notified. Reassign it if nobody steps in.':'A teammate asked for help. Accept to move the task to your queue.'}</p>${button('Review','notifications','','small')}</div>`;
}
function taskSummaryStrip() {
  const {missed,ongoing,dueToday}=taskSummary(state.tasks,state.today),latest=missed[0];
  return `<section class="task-summary" aria-label="Task summary"><a href="tasks.html" data-summary="Missed"><strong>${missed.length}</strong><span>Missed tasks<small>${latest?`Latest: ${escape(latest.task_type)}, ${escape(latest.plot_code)}, ${fmt(latest.scheduled_date)}`:'Nothing missed so far.'}</small></span>${icon('arrow')}</a><a href="tasks.html" data-summary="Open"><strong>${ongoing.length}</strong><span>Ongoing tasks<small>${dueToday} due today · ${ongoing.length-dueToday} upcoming</small></span>${icon('arrow')}</a></section>`;
}
function dashboard() {
  const pending=assignedPending(state.tasks,state.user.user_id);
  const team=state.tasks.filter(t=>t.status==='Pending');
  const tasks=(isAdmin()?team:pending).filter(t=>!calendarDate||t.scheduled_date===calendarDate);
  const stats=overviewPlots(state);
  return heading(`Welcome, ${escape(isAdmin()?'Admin':state.user.full_name.split(' ')[0])}.`,`${fmt(state.today)} · ${isAdmin()?team.length+' team tasks':pending.length+' of your tasks'} still need care.`,isAdmin()?button('Schedule task','new-task','','','plus'):button('View my tasks','my-tasks','','','tasks'))+
    `<div class="stats care-stats">${stats.map(({label,plots},i)=>`<button class="stat" data-action="stat-plots" data-id="${i}" aria-label="${label}: ${plots.length}. View plots"><span class="stat-top">${label}</span><span class="stat-value">${plots.length}</span><span class="stat-foot">View plots →</span></button>`).join('')}</div>${coverAlert()}${taskSummaryStrip()}<div class="care-grid ${isAdmin()?'admin-care':''}"><section class="panel care-queue">${panelHead(isAdmin()?'Team assignments':'Your tasks',calendarDate?fmt(calendarDate):'Unfinished care, ordered by schedule.',link('View all','tasks'))}${calendarDate?button('Show all dates','calendar-clear','','text small'):''}<div class="task-list">${tasks.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||''])).slice(0,4).map(t=>`<div class="care-row"><div><a href="plot-info.html?id=${t.plot_id}">${escape(t.plot_code)}</a><h3>${escape(t.task_type)}</h3><p>${isAdmin()?escape(t.assigned_staff||'Unassigned')+' · ':''}${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}</p></div><div>${t.scheduled_date<state.today?badge('Overdue','amber'):''}${t.scheduled_date===state.today&&!isAdmin()?button('Complete','complete',t.task_id,'secondary small','check'):t.scheduled_date>state.today?badge('Upcoming','gray'):''}</div></div>`).join('')||empty(calendarDate?'No unfinished tasks on this date.':'All caught up. No unfinished tasks.')}</div>${tasks.length>4?`<p class="queue-more">${tasks.length-4} more tasks in Maintenance tasks.</p>`:''}</section>${isAdmin()?`<aside class="panel team-summary">${panelHead('Garden team','Today’s assignments completed today')}${state.users.filter(u=>u.role==='Staff'&&u.active) .map(u=>{const {total,completed}=dailyProgress(state.tasks,u.user_id,state.today);return `<div class="team-row"><span class="avatar">${escape(initials(u.full_name))}</span><span>${escape(u.full_name)}</span><div class="team-progress"><progress value="${completed}" max="${total||1}" aria-label="${escape(u.full_name)}: ${completed} of ${total} assignments completed today"></progress><small>${total?`${completed} / ${total} completed`:'No tasks today'}</small></div></div>`;}).join('')||empty('No staff accounts yet.')}</aside>`:taskCalendar(pending)}</div>`;
}
function taskCalendar(pending) {
  const month=calendarMonth(state.today,calendarOffset,pending);
  return `<section class="panel task-calendar" aria-label="Your task calendar"><div class="calendar-heading"><button class="icon-button" data-action="calendar-month" data-id="-1" aria-label="Previous month">‹</button><h2>${month.label}</h2><button class="icon-button" data-action="calendar-month" data-id="1" aria-label="Next month">›</button></div><p>Marked days have unfinished tasks assigned to you.</p><div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('')}${month.cells.map(day=>day?`<button class="calendar-day ${day.count?'has-tasks':''} ${calendarDate===day.date?'selected':''}" data-action="calendar-day" data-id="${day.date}" aria-label="${fmt(day.date)}, ${day.count} unfinished tasks" aria-pressed="${calendarDate===day.date}" ${day.date===state.today?'aria-current="date"':''}>${day.day}${day.count?'<span class="calendar-mark" aria-hidden="true"></span>':''}</button>`:'<span></span>').join('')}</div><p class="calendar-legend"><span></span> Your unfinished tasks</p></section>`;
}
function filterMap() {
  document.querySelectorAll('.map-plot').forEach(el=>{
    const p=state.plots.find(p=>p.plot_id===Number(el.dataset.id));
    el.classList.toggle('dimmed',!matchesPlot(p));
  });
  document.querySelectorAll('[data-action="zone"]').forEach(el=>{
    el.classList.toggle('active',el.dataset.id===zone);
    el.setAttribute('aria-pressed',String(el.dataset.id===zone));
  });
}
function plotStage(cycle) { const {label,days}=growthStage(cycle,state.today);return {label,detail:`${days} day${days===1?'':'s'} since planting`}; }
function plotsPage() {
  const house=greenhouse(),spaces=mapPlots().filter(isGrowingPlot),occupied=spaces.filter(p=>plotOccupancy(p)==='Occupied').length;
  return heading(house?escape(house.plot_code):'CUAI Garden Atlas',house?'Each bed has its own crop, care tasks and editable layout.':'Every plot gets the care it needs.',(house?'<a class="btn secondary" href="plot-info.html">Back to garden</a>':'')+(isAdmin()?button(editingMap?'Done editing map':'Edit map','map-edit','','',editingMap?'check':'pencil'):''))+
    `<div class="toolbar">${filters(['All zones','Greenhouse','Outdoor','Nursery','Open space'],zone,'zone')}<span class="muted"><small>${occupied} occupied · ${spaces.length-occupied} vacant</small></span></div><div class="atlas-layout ${isAdmin()?'with-tasks':''}">${isAdmin()?`<aside class="panel atlas-tasks">${panelHead('Unfinished tasks','Staff assignments')}${state.tasks.filter(t=>t.status==='Pending'&&match([t.task_type,t.plot_code,t.assigned_staff||''])).map(t=>`<a class="atlas-task" href="tasks.html?task=${t.task_id}" data-task-date="${t.scheduled_date}"><strong>${escape(t.task_type)}</strong><span>${escape(t.plot_code)} · ${escape(t.assigned_staff||'Unassigned')}</span><small>${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}${t.scheduled_date<state.today?' · Overdue':''}</small></a>`).join('')||empty('No unfinished tasks.')}</aside>`:''}${gardenMap()}</div>`;
}
function gardenMap(compact=false) {
  const house=greenhouse(),plots=mapPlots();
  const height=(house?100:editingMap?mapExtent:Math.max(100,...plots.map(p=>{const [,y,,h]=plotBounds(p);return y+h+5;})))*7;
  return `<section class="garden-map ${compact?'compact':''} ${editingMap?'editing-map':''} ${mapPlacing?'placing-plot':''}" aria-label="Interactive garden map">
    ${editingMap?mapEditorToolbar():''}
    <div class="map-caption"><span class="eyebrow">CUAI / Garden atlas</span><label class="map-picker"><span class="sr-only">Choose a plot</span><select id="map-picker"><option value="">Choose a plot…</option>${[...plots].sort((a,b)=>a.map_slot-b.map_slot).map(p=>`<option value="${p.plot_id}" ${selectedPlot()?.plot_id===p.plot_id?'selected':''}>${p.map_slot?`${p.map_slot} · `:''}${escape(p.plot_code)}</option>`).join('')}</select></label><span>${icon('sprout')} Tap a space. See what’s growing.</span></div>
    <div class="map-viewport"><svg class="map-svg" viewBox="0 0 1000 ${height}" aria-label="Garden plots. Drag or use arrow keys to move the map." role="group" tabindex="0">
      <defs><pattern id="map-grain" width="24" height="24" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="2" height="2" fill="#a8b99b" opacity=".3"/></pattern>
      <pattern id="bed-rows" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7h14" stroke="#3b2a18" opacity=".16" stroke-width="2"/></pattern>
      <pattern id="house-ribs" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M13 0v26" stroke="#fff" opacity=".6" stroke-width="3.5"/></pattern>
      <pattern id="nursery-trays" width="18" height="18" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="14" height="14" fill="none" stroke="#2f4a25" opacity=".24" stroke-width="1.5"/></pattern>
      <pattern id="paving" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 .5h40M0 10.5h40M.5 0v10M20.5 10v10" stroke="#697162" opacity=".32" fill="none"/></pattern>
      <g id="map-seedling"><path fill="#2f6b2c" d="M-1 0C-2-8-1-14 0-20 1-14 2-8 1 0Z"/><path fill="#3f8a35" d="M0-16C-10-16-17-22-18-32-8-33 0-26 0-16ZM0-20C8-20 14-26 15-34 6-35 0-29 0-20Z"/></g>
      <g id="map-plant"><path fill="#2f6b2c" d="M0 0C-20-5-30-24-20-42-8-34-2-16 0 0Z"/><path fill="#3a7d30" d="M0 0C20-5 30-24 20-42 8-34 2-16 0 0Z"/><path fill="#4c9a3d" d="M0 0C-11-14-11-38 0-54 11-38 11-14 0 0Z"/></g></defs>
      <g class="map-world">
        <rect class="map-ground" x="0" y="0" width="1000" height="${height}" rx="28"/>
        <rect x="0" y="0" width="1000" height="${height}" fill="url(#map-grain)" rx="28"/>
        ${house?'':`<path class="map-path-edge" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>
        <path class="map-path" d="M730 10V680M20 145H730M450 145V275M20 540H730"/>

        <g class="map-entrance"><text x="638" y="674">Entrance</text><path d="M713 669h17m-8-7 8 7-8 7"/></g>`}
        ${plots.map(mapPlotMarkup).join('')}
      </g>
    </svg></div>
    <div class="map-bottom"><div class="map-key"><span class="key-missed">Missed task</span><span class="key-care">Needs care today</span><span class="key-growing">Growing</span><span class="key-vacant">Vacant</span><span class="key-house">Greenhouse, open to view beds</span><span class="key-space">Open space</span><span class="key-icon"><svg viewBox="-20 -36 40 38" aria-hidden="true"><use href="#map-seedling"/></svg>Seedling</span><span class="key-icon"><svg viewBox="-30 -56 60 58" aria-hidden="true"><use href="#map-plant"/></svg>Full-grown</span></div><div class="map-controls"><button class="icon-button" data-action="map-zoom" data-id="-0.25" aria-label="Zoom out">−</button><button class="icon-button" data-action="map-zoom" data-id="0.25" aria-label="Zoom in">+</button><button class="btn secondary" data-action="map-reset" aria-label="Reset zoom and close plot details">Reset view</button></div></div>
    ${house?`<div class="greenhouse-beds">${plots.map(p=>{const crop=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date);return `<button class="greenhouse-bed" data-action="map-plot" data-id="${p.plot_id}"><strong>${escape(p.plot_code)}</strong><span>${escape(crop?`Occupied · ${crop.crop_name}${crop.variety?' · '+crop.variety:''} · ${growthStage(crop,state.today).label}`:'Vacant · Ready for planting')}</span></button>`;}).join('')||empty(isAdmin()?'No beds yet. Choose Edit map, then Add bed to lay out this greenhouse.':'No beds have been added yet.')}</div>`:''}
    ${compact?'':'<aside id="plot-inspector" class="plot-inspector" aria-label="Selected plot" hidden></aside>'}
  </section>`;
}
const plotStatusLabels={missed:'Missed task',care:'Needs care today',growing:'Growing',vacant:'Vacant',open:'Open space'};
// Fills a bed with one plant per spot, leaving the label clear. Coordinates are in map units.
function plotPlants(crop,[x,y,w,h],thin,hasCode) {
  if(!crop)return '';
  const left=x*10,top=y*7,width=w*10,height=h*7,size=thin?Math.min(28,height*.72):24,gap=size*1.35,scale=size/54;
  const from=thin?left+(hasCode?120:62):left+10,span=left+width-(thin?24:10)-from,cols=Math.floor(span/gap);
  if(cols<1)return '';
  // Rows sit against the bed edges so the label keeps the middle clear.
  const rows=thin?1:Math.min(6,Math.floor((height-12)/(size*1.2))),firstY=thin?top+height/2+size/2:top+size+6,rowGap=rows>1?(height-size-12)/(rows-1):0,labelTop=top+height/2-14,labelBottom=top+height/2+38,labelSide=width>220?95:width,icon=growthStage(crop,state.today).label==='Seedling'?'#map-seedling':'#map-plant',spots=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
    const px=from+(span-(cols-1)*gap)/2+col*gap,py=firstY+row*rowGap;
    if(thin||py<labelTop||py-size>labelBottom||Math.abs(px-(left+width/2))>labelSide)spots.push(`<use href="${icon}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${scale.toFixed(3)})"/>`);
  }
  return `<g class="plot-plants">${spots.join('')}</g>`;
}
function mapPlotMarkup(p) {
          const slot=p.map_slot||p.plot_id,[x,y,w,h]=plotBounds(p),c=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date);
          const beds=activePlots().filter(b=>b.parent_plot_id===p.plot_id);
          const stage=c&&growthStage(c,state.today).label,caption=isGreenhouse(p)?`${beds.length} bed${beds.length===1?'':'s'}`:p.zone==='Open space'?'No planting':c?`${c.crop_name} · ${stage}`:'Vacant';
          const status=plotStatus(p,state),thin=h<14,hasCode=w>=17,shape=isGreenhouse(p)?'house':p.zone==='Open space'?'space':'bed';
          const texture=isGreenhouse(p)?'house-ribs':p.zone==='Open space'?'paving':p.zone==='Nursery'?'nursery-trays':'bed-rows';
          const occupancy=isGreenhouse(p)?(beds.some(b=>b.occupancy_status==='Occupied')?'Occupied':'Vacant'):p.occupancy_status;
          const muted=!matchesPlot(p);
          return `<g class="map-plot ${p.zone.toLowerCase().replace(' ','-')} ${occupancy.toLowerCase()} ${shape} status-${status} ${muted?'dimmed':''}" data-action="map-plot" data-id="${p.plot_id}" role="button" tabindex="0" aria-pressed="${editingMap&&mapEditId===p.plot_id}" aria-label="Plot ${slot}, ${escape(p.plot_code)}, ${escape(caption)}, ${plotStatusLabels[status]}">
            <title>${escape(p.plot_code)} · ${escape(caption)} · ${p.zone} · ${plotStatusLabels[status]}</title>
            <rect class="plot-shape" x="${x*10}" y="${y*7}" width="${w*10}" height="${h*7}" rx="3"/>
            <rect class="plot-texture" x="${x*10+4}" y="${y*7+4}" width="${w*10-8}" height="${h*7-8}" rx="5" fill="url(#${texture})"/>
            ${plotPlants(c,[x,y,w,h],thin,hasCode)}
            <text class="map-plot-label ${thin?'thin':''}" x="${thin?x*10+12:(x+w/2)*10}" y="${(y+h/2)*7+(thin?7:5)}">${slot}${hasCode?`<tspan class="map-plot-code"> · ${escape(p.plot_code)}</tspan>`:''}</text>
            ${h>=14?`<text class="map-bed-caption" x="${(x+w/2)*10}" y="${(y+h/2)*7+28}">${escape(w<16&&c?c.crop_name:caption)}</text>`:''}
            ${status==='care'||status==='missed'?`<g class="plot-task-alert"><rect x="${(x+w)*10-21}" y="${y*7-8}" width="26" height="26"/><text x="${(x+w)*10-8}" y="${y*7+10}">!</text></g>`:''}
            ${editingMap&&mapEditId===p.plot_id?['nw','ne','sw','se'].map(corner=>`<rect class="plot-handle ${corner}" data-corner="${corner}" x="${(x+(corner.includes('e')?w:0))*10-8}" y="${(y+(corner.includes('s')?h:0))*7-8}" width="16" height="16" rx="3" role="button" tabindex="0" aria-label="Resize ${corner} corner of ${escape(p.plot_code)} with arrow keys"/>`).join(''):''}
          </g>`;
}
function mapEditorToolbar() {
  return `<div class="map-edit-toolbar" aria-label="Map editing controls"><strong>Edit map</strong><span>Drag a plot to move it. Drag a corner to resize.</span>${button(mapPlacing?'Cancel placement':greenhouse()?'Add bed':'Add plot',mapPlacing?'map-place-cancel':'new-plot','','secondary small','plus')}<p id="map-edit-status" role="status">${mapPlacing?'Click an empty map space, or focus the map and press Enter, to place your new plot.':'Select a plot to edit its layout. Changes save when you release.'}</p><div id="map-edit-selection"></div></div>`;
}
function paintMapPlot(p,bounds=plotBounds(p)) {
  const [map_x,map_y,map_w,map_h]=bounds;
  const el=document.querySelector(`.map-plot[data-id="${p.plot_id}"]`);
  if(el)el.outerHTML=mapPlotMarkup({...p,map_x,map_y,map_w,map_h});
}
function selectMapEdit(id) {
  if(!editingMap||mapSaving||!isAdmin())return;
  const previous=state.plots.find(p=>p.plot_id===mapEditId);
  mapEditId=id;
  if($('#map-picker'))$('#map-picker').value=id||'';
  if(previous)paintMapPlot(previous);
  const p=activePlots().find(p=>p.plot_id===id);
  if(p)paintMapPlot(p);
  const panel=$('#map-edit-selection');
  if(panel)panel.innerHTML=p?`<strong>${escape(p.plot_code)}</strong><span>Arrow keys move the plot; focus a corner and use arrow keys to resize.</span>${isGreenhouse(p)?`<a class="btn secondary small" href="plot-info.html?greenhouse=${p.plot_id}">Edit beds inside</a>`:''}${button('Remove plot','remove-plot',id,'secondary small danger')}`:'';
}
async function savePlotBounds(p,bounds) {
  mapSaving=true;
  const status=$('#map-edit-status');if(status)status.textContent='Saving plot layout…';
  try {
    await api('plot-layout',{plot_id:p.plot_id,bounds,revision:p.map_revision||0,map_edit:true});
    [p.map_x,p.map_y,p.map_w,p.map_h]=bounds;p.map_revision=(p.map_revision||0)+1;
    if(status)status.textContent='Plot layout saved.';
  } catch(error) {
    paintMapPlot(p);
    if(status)status.textContent='Layout was not saved. '+error.message;
    toast(error.message);
  } finally {mapSaving=false;}
}
function placeMapPlot(point) {
  if(!editingMap||!mapPlacing||!isAdmin())return;
  const house=greenhouse();
  const bounds=dragPlot([0,0,house?30:15,house?20:10],point.x/10-(house?15:7.5),point.y/7-(house?10:5),'',mapExtent);
  modal(house?'Add a greenhouse bed':'Add a garden plot','Place and resize rectangular spaces in Edit map. Greenhouses contain individual growing beds; open spaces contain no plants.',`${field(house?'Bed code':'Plot code','plot_code','text','','required maxlength="30" placeholder="e.g. GH-03-B2"')}${house?'':select('Space type','zone',options(['Greenhouse','Outdoor','Nursery','Open space'].map(x=>({x})),'x','x'))}`,'plots',{bounds,...(house?{zone:'Greenhouse',parent_plot_id:house.plot_id}:{})});
  mapPlacing=false;$('.garden-map')?.classList.remove('placing-plot');
  $('#map-edit-status').textContent='Complete the form to add this plot.';
}
function mountGardenMap() {
  const svg=$('.map-svg');
  if(!svg)return;
  let drag, suppressClick=false;
  const point=(event,world=false)=>new DOMPoint(event.clientX,event.clientY).matrixTransform((world?$('.map-world'):svg).getScreenCTM().inverse());
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0||mapSaving)return;
    suppressClick=false;
    const el=event.target.closest('.map-plot');
    if(editingMap&&el&&!mapPlacing) {
      const p=activePlots().find(p=>p.plot_id===Number(el.dataset.id));
      const corner=event.target.dataset.corner||'';
      selectMapEdit(p.plot_id);
      drag={start:point(event,true),p,bounds:plotBounds(p),corner,moved:false,pointerId:event.pointerId};
    } else drag={start:point(event),pan:{...mapPan},moved:false,pointerId:event.pointerId};
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const at=point(event,Boolean(drag.p)),dx=at.x-drag.start.x,dy=at.y-drag.start.y;
    if(!drag.moved&&Math.hypot(dx,dy)<6)return;
    drag.moved=true;svg.setPointerCapture(event.pointerId);svg.classList.add('panning');
    if(drag.p) {
      drag.next=dragPlot(drag.bounds,dx/10,dy/7,drag.corner,mapExtent);
      paintMapPlot(drag.p,drag.next);
    } else {mapPan={x:drag.pan.x+dx,y:drag.pan.y+dy};zoomMap(editingMap?null:selectedPlot());}
  });
  svg.addEventListener('click',event=>{
    if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;return;}
    if(editingMap&&mapPlacing){event.preventDefault();event.stopPropagation();if(!event.target.closest('.map-plot'))placeMapPlot(point(event,true));}
  },true);
  const endDrag=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const current=drag;drag=null;suppressClick=current.moved;
    svg.classList.remove('panning');
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    if(current.p&&current.moved) {
      if(event.type==='pointerup')savePlotBounds(current.p,current.next);
      else paintMapPlot(current.p,current.bounds);
    }
  };
  svg.addEventListener('pointerup',endDrag);
  svg.addEventListener('pointercancel',endDrag);
  svg.addEventListener('lostpointercapture',endDrag);
  svg.addEventListener('pointerleave',()=>{if(!drag?.moved)drag=null;});
  svg.addEventListener('keydown',event=>{
    if(editingMap&&mapPlacing&&event.target===svg&&event.key==='Enter') {
      event.preventDefault();const rect=svg.getBoundingClientRect();placeMapPlot(point({clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2},true));return;
    }
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!delta)return;
    event.preventDefault();
    const el=event.target.closest('.map-plot');
    if(editingMap&&el) {
      if(mapSaving||mapPlacing)return;
      const p=activePlots().find(p=>p.plot_id===Number(el.dataset.id)),corner=event.target.dataset.corner||'';
      const bounds=dragPlot(plotBounds(p),delta[0],delta[1],corner,mapExtent);
      paintMapPlot(p,bounds);
      document.querySelector(`.map-plot[data-id="${p.plot_id}"]${corner?` [data-corner="${corner}"]`:''}`)?.focus({preventScroll:true});
      savePlotBounds(p,bounds);
    } else {mapPan.x-=delta[0]*60;mapPan.y-=delta[1]*60;zoomMap(editingMap?null:selectedPlot());}
  });
  $('#map-picker')?.addEventListener('change',event=>{if(editingMap)selectMapEdit(Number(event.target.value));else if(event.target.value)selectMapPlot(Number(event.target.value));else closeMapPlot();});
  zoomMap(editingMap?null:selectedPlot());
  if(editingMap)selectMapEdit(mapEditId);
  else if(view==='plots'&&selectedPlot())renderPlotInspector();
}
function zoomMap(p) {
  const world=$('.map-world');if(!world)return;
  const selectedId=editingMap?mapEditId:p?.plot_id;
  if($('#map-picker'))$('#map-picker').value=selectedId||'';
  document.querySelectorAll('.map-plot').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.id)===selectedId)));
  $('.garden-map').classList.toggle('has-selection',Boolean(p&&!p.removed_at));
  if(!p||p.removed_at){world.style.transform=mapZoom===1&&!mapPan.x&&!mapPan.y?'':`translate(${500-500*mapZoom+mapPan.x}px,${350-350*mapZoom+mapPan.y}px) scale(${mapZoom})`;return;}
  const [x,y,w,h]=plotBounds(p),left=x>55;
  const mobile=matchMedia('(max-width: 700px)').matches;
  const scale=(mobile?1.25:1.65)*mapZoom,center=mobile?500:left?690:310;
  world.style.transform=`translate(${center-(x+w/2)*10*scale+mapPan.x}px,${320-(y+h/2)*7*scale+mapPan.y}px) scale(${scale})`;
  $('#plot-inspector')?.classList.toggle('on-left',left);
}
function selectMapPlot(id) {
  const p=state.plots.find(p=>p.plot_id===id);
  if(p&&isGreenhouse(p)){zone='All zones';navigate(`plot-info.html?greenhouse=${id}`);return;}
  if(view!=='plots'){navigate(`plot-info.html?id=${id}`);return;}
  if(selectedPlot()?.plot_id===id){closeMapPlot();return;}
  mapPan={x:0,y:0};
  editingPlot=false;plotTab='overview';historyQuery='';historyFertilizer='all';historyFrom='';historyTo='';
  history.pushState({},'',`plot-info.html?id=${id}`);
  zoomMap(selectedPlot());renderPlotInspector();
  $('#plot-heading')?.focus({preventScroll:true});
}
function closeMapPlot() {
  const p=selectedPlot(),house=greenhouse();editingPlot=false;mapZoom=1;mapPan={x:0,y:0};
  if(view==='plots')history.pushState({},'',house?`plot-info.html?greenhouse=${house.plot_id}`:'plot-info.html');
  zoomMap(null);
  const inspector=$('#plot-inspector');if(inspector)inspector.hidden=true;
  document.querySelector(`.map-plot[data-id="${p?.plot_id}"]`)?.focus({preventScroll:true});
}
function timestampLabel(value) {
  if(!value)return 'Not recorded';
  if(!value.includes('T'))return `${fmt(value)} · time not recorded`;
  return new Date(value).toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
function plotPhoto(p,src=p?.has_photo?`/api/plot-photo?id=${p.plot_id}&v=${p.photo_version}`:null) {
  return src?`<img class="plot-photo" src="${escape(src)}" alt="Photo of ${escape(p.plot_code)}" loading="lazy">`:`<div class="plot-photo plot-photo-empty">${icon('sprout')}<span>No Image Available</span></div>`;
}
function plotFacts(record,p) {
  return `${plotPhoto(p)}
    <div class="plot-story"><h3>${escape(record.crop_name)}</h3>${record.cycle_id?`<p>Stage at planting · ${escape(state.cycles.find(c=>c.cycle_id===record.cycle_id)?.planting_stage||'Not recorded')}</p>`: ''}<p>${escape(record.description)}</p></div>
    <dl class="plot-facts"><div><dt>${icon('drop')} Last watered</dt><dd>${escape(timestampLabel(record.watered_at))}</dd></div>
    <div><dt>${icon('sprout')} Last harvest</dt><dd>${escape(timestampLabel(record.harvested_at))}</dd></div>
    <div><dt>${icon('leaf')} Fertilizer</dt><dd>${escape(record.fertilizer||'None')}${record.fertilizer?`<small>${escape(timestampLabel(record.fertilized_at))}</small>`:''}</dd></div></dl>`;
}
function renderPlotInspector() {
  const panel=$('#plot-inspector'),p=selectedPlot();if(!panel||!p)return;
  const c=state.cycles.find(c=>c.current_plot_id===p.plot_id&&!c.harvest_date),record=plotOverview(state,p,c);
  if(p.zone==='Open space'){record.crop_name='Open space';if(!state.entries.some(e=>e.plot_id===p.plot_id))record.description='Unplanted space for access, storage or other garden use.';}
  panel.hidden=false;
  panel.innerHTML=`<div class="inspector-heading"><div><span class="eyebrow">${p.removed_at?'Removed from map':escape(p.zone)} · Plot ${p.map_slot||p.plot_id}</span><h2 id="plot-heading" tabindex="-1">${escape(p.plot_code)}</h2>${p.zone==='Open space'||p.removed_at?'':`<div class="plot-status-row">${statusBadge(plotOccupancy(p))}${c?`${badge(plotStage(c).label,plotStage(c).label==='Seedling'?'amber':'')}<small>${plotStage(c).detail}</small>`:''}</div>`}</div><div class="inspector-buttons">${isAdmin()&&!p.removed_at&&plotTab==='overview'&&!editingPlot?`<button class="icon-button" data-action="plot-edit" aria-label="Edit plot details">${icon('pencil')}</button>`:''}<button class="btn plot-exit" data-action="map-reset" aria-label="Exit plot details">${icon('close')} Exit plot</button></div></div>
    <div class="tabs inspector-tabs" role="tablist" aria-label="Plot information">${['overview','history'].map(tab=>`<button id="tab-${tab}" class="tab ${plotTab===tab?'active':''}" role="tab" aria-selected="${plotTab===tab}" aria-controls="plot-tab-content" tabindex="${plotTab===tab?0:-1}" data-action="plot-tab" data-id="${tab}">${tab==='overview'?'Overview':'History'}</button>`).join('')}</div>
    <div id="plot-tab-content" class="inspector-content" role="tabpanel" aria-labelledby="tab-${plotTab}">
    ${plotTab==='history'?historyPanel(p):editingPlot&&isAdmin()&&!p.removed_at?plotEditor(record):`${plotFacts(record,p)}<div class="plot-state"><span>Times in Asia/Manila</span></div>`}</div>`;
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
  const p=selectedPlot();
  const local=value=>value?.includes('T')?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):'';
  const input=(label,key)=>`<div class="field"><label for="plot-${key}">${label} (Manila)</label><input id="plot-${key}" name="${key}" type="datetime-local" value="${local(record[key])}">${record[key]&&!record[key].includes('T')?`<small>Existing date: ${fmt(record[key])}. Leave blank to keep its unknown time.</small>`:''}</div>`;
  return `<form id="plot-edit-form"><div class="field"><label for="plot-photo-file">Plot photo</label><div id="plot-photo-preview">${plotPhoto(p)}</div><input id="plot-photo-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="plot-photo-help"><small id="plot-photo-help">Choose a JPG, PNG, or WebP up to 10 MB. Saved photos are resized to fit.</small><button type="button" class="btn secondary small" id="plot-photo-reset">Remove Image</button><p id="plot-photo-status" role="status"></p></div><div class="field"><label for="plot-description">About this plot</label><textarea id="plot-description" name="description" required maxlength="500">${escape(record.description)}</textarea></div>
    ${input('Last watered','watered_at')}${input('Last harvest','harvested_at')}
    <div class="field"><label for="plot-fertilizer-mode">Fertilizer</label><select id="plot-fertilizer-mode"><option value="none" ${!record.fertilizer?'selected':''}>None</option><option value="used" ${record.fertilizer?'selected':''}>Fertilizer used</option></select></div>
    <div id="fertilizer-fields" ${!record.fertilizer?'hidden':''}><div class="field"><label for="plot-fertilizer">Product name</label><input id="plot-fertilizer" name="fertilizer" maxlength="120" value="${escape(record.fertilizer||'')}"></div>${input('Applied','fertilized_at')}</div>
    <p class="editor-note">Saving adds a dated entry to History. Crop changes use the actions below.</p><div class="form-error" role="alert"></div>
    <div class="plot-edit-actions"><button type="button" class="btn secondary small" data-action="plot-cancel">Cancel</button><button class="btn small" type="submit">Save details</button></div>
    </form>${plotCropActions(record)}`;
}
function plotCropActions(record) {
  const p=selectedPlot();
  if(!isGrowingPlot(p))return '';
  return `<div class="plot-crop-actions"><span class="eyebrow">Manage this crop</span>${record.cycle_id?`${p.zone==='Nursery'?button('Transplant','transplant',record.cycle_id,'secondary small'):''}${button('Record harvest','harvest',record.cycle_id,'secondary small')}${button('Change assignment','cycle-assignment',record.cycle_id,'text')}`:button('Plant a crop','new-cycle',p.plot_id,'secondary small','plus')}</div>`;
}
async function preparePlotPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG, or WebP image up to 10 MB.');
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read this image.'));reader.readAsDataURL(file);});
  const image=new Image();image.src=source;
  try{await image.decode();}catch{throw new Error('This image could not be opened. Choose another photo.');}
  const scale=Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const photo=canvas.toDataURL('image/jpeg',0.8);
  if(photo.length>349547)throw new Error('This photo is too detailed. Choose a smaller image.');
  return photo;
}
function bindPlotEditor(p,record) {
  let photo,photoError='',photoLoading=false;
  const photoInput=$('#plot-photo-file'),photoStatus=$('#plot-photo-status'),preview=$('#plot-photo-preview'),submitButton=$('#plot-edit-form [type=submit]'),reset=$('#plot-photo-reset');
  photoInput.addEventListener('change',async()=>{
    const file=photoInput.files[0];if(!file)return;
    photoLoading=true;photoError='';photoStatus.textContent='Preparing photo…';submitButton.disabled=true;photoInput.disabled=true;reset.disabled=true;
    try{photo=await preparePlotPhoto(file);preview.innerHTML=plotPhoto(p,photo);photoStatus.textContent='Photo ready. Save details to apply it.';}
    catch(error){photoError=error.message;photoStatus.textContent=photoError;}
    finally{photoLoading=false;submitButton.disabled=false;photoInput.disabled=false;reset.disabled=false;}
  });
  reset.addEventListener('click',()=>{photo=null;photoError='';photoInput.value='';preview.innerHTML=plotPhoto(p,null);photoStatus.textContent='Image removed. Save details to apply it.';});
  const toggle=()=>{const used=$('#plot-fertilizer-mode').value==='used';$('#fertilizer-fields').hidden=!used;$('#plot-fertilizer').required=used;$('#plot-fertilized_at').required=used&&!record.fertilized_at;};
  $('#plot-fertilizer-mode').addEventListener('change',toggle);toggle();
  $('#plot-edit-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
    if(photoLoading||photoError){form.querySelector('.form-error').textContent=photoError||'Wait for the photo to finish.';submit.disabled=false;return;}
    const values=Object.fromEntries(new FormData(form));
    if(photo!==undefined){values.photo_data=photo;values.photo_version=p.photo_version||0;}
    for(const key of ['watered_at','harvested_at','fertilized_at'])values[key]=values[key]?new Date(values[key]+':00+08:00').toISOString():record[key]?.includes('T')?null:record[key]||null;
    if($('#plot-fertilizer-mode').value==='none'){values.fertilizer=null;values.fertilized_at=null;}
    try{await api('plot-entry',{...values,plot_id:p.plot_id,cycle_id:record.cycle_id});editingPlot=false;await refresh();toast('Plot details saved to history.');}
    catch(error){form.querySelector('.form-error').textContent=error.message;submit.disabled=false;}
  });
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('#profile-menu')&&!$('#profile-menu').hidden){$('#profile-menu').hidden=true;$('.profile').setAttribute('aria-expanded','false');$('.profile').focus();}
  if(event.target.closest('.map-plot')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.closest('.map-plot').dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  if(event.key==='Escape'&&!$('#modal').open&&editingMap&&mapPlacing){mapPlacing=false;renderMain();return;}
  if(event.key==='Escape'&&!$('#modal').open&&selectedPlot()){event.preventDefault();closeMapPlot();}
  if(event.target.matches('[data-action="plot-tab"]')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();plotTab=plotTab==='overview'?'history':'overview';editingPlot=false;renderPlotInspector();$('#tab-'+plotTab).focus();}
});
window.addEventListener('resize',()=>{if(view==='plots')zoomMap(selectedPlot());});

function taskDetails(t) {
  const own=t.assigned_staff_id===state.user.user_id,pending=t.status==='Pending',due=t.scheduled_date===state.today;
  const adjustments=state.adjustments.filter(a=>a.task_id===t.task_id);
  return `<details class="task-item" ${Number(new URLSearchParams(location.search).get('task'))===t.task_id?'open':''}><summary><span class="task-symbol">${icon(t.task_type==='Manual watering'?'drop':'tasks')}</span><span class="task-identity"><strong>${escape(t.task_type)}</strong><span>${escape(t.plot_code)} · ${escape(t.assigned_staff||'Unassigned')}</span></span><span class="task-due">${escape(t.scheduled_date>state.today?fmt(t.scheduled_date):taskDateLabel(t.scheduled_date,state.today))}<small>${clock(t.scheduled_time)}</small><small>${t.scheduled_date<=state.today?fmt(t.scheduled_date):''}</small></span>${needsCover(t,state.today)?badge('Needs cover','amber'):''}${pending?badge(t.scheduled_date<state.today?'Overdue':'Open','amber'):statusBadge(t.status)}<span class="task-chevron" aria-hidden="true">⌄</span></summary><div class="task-detail"><p><a href="plot-info.html?id=${t.plot_id}">Open ${escape(t.plot_code)}</a> · ${escape(t.zone)}</p>${t.substitute_staff?`<p class="reason"><strong>${t.covered_for?`Taken over from ${escape(t.covered_for)} by`:'Covered by'} ${escape(t.substitute_staff)}</strong><br>${escape(t.takeover_reason)}<br>${t.is_flagged_for_admin?'Awaiting admin review':'Reviewed by admin'}</p>`:''}${adjustments.map(a=>`<p class="reason"><strong>${escape(a.action)} · ${escape(a.full_name)}</strong><br>${escape(a.reason)}<br>${escape(a.previous_schedule)}${a.new_schedule?` → ${escape(a.new_schedule)}`:''}</p>`).join('')}<div class="actions">${pending&&own&&!isAdmin()&&due?button('Mark complete','complete',t.task_id,'small','check'):''}${pending&&(own||isAdmin())&&t.scheduled_date>=state.today&&!t.needs_cover?button('Request cover','request-cover',t.task_id,'secondary small'):''}${pending&&own&&!isAdmin()&&t.task_type==='Manual watering'?button('Weather adjustment','adjust',t.task_id,'secondary small'):''}${pending&&isAdmin()?button('Reassign','task-assignment',t.task_id,'text'):''}${!isAdmin()&&(own||t.substitute_staff_id===state.user.user_id)?button('Message admin','task-message',t.task_id,'secondary small'):''}</div></div></details>`;
}
function tasksPage() {
  const scoped=state.tasks.filter(t=>isAdmin()?(staffFilter==='all'||String(t.assigned_staff_id)===staffFilter):t.assigned_staff_id===state.user.user_id);
  const tasks=scoped.filter(t=>match([t.task_type,t.plot_code,t.assigned_staff||'',t.substitute_staff||''])&&(taskFilter==='Done'?['Completed','Skipped'].includes(t.status):taskFilter==='Missed'?isMissed(t,state.today):t.status==='Pending'));
  const quietToday=!isAdmin()&&taskFilter==='Open'&&!search&&!scoped.some(t=>t.status==='Pending'&&t.scheduled_date<=state.today);
  return heading('Maintenance tasks','Dated care, with missed tasks shown first.',isAdmin()?button('Schedule task','new-task','','','plus'):'')+`<section class="task-board"><div class="task-toolbar">${filters(['Open','Missed','Done'],taskFilter,'task-filter')}${!isAdmin()?'My tasks':`<label class="task-scope">Show<select id="staff-filter"><option value="all">All team assignments</option>${options(state.users.filter(u=>u.role==='Staff'),'user_id','full_name',staffFilter)}</select></label>`}</div>${quietToday?empty('Nothing due today. Your garden is in good hands.'):''}${tasks.map(taskDetails).join('')||(!quietToday?empty('No '+taskFilter.toLowerCase()+' tasks match this view.'):'')}</section>${isAdmin()?'<button class="task-fab" data-action="new-task" aria-label="Schedule a task">'+icon('plus')+'</button>':''}`;
}
function reportNote(t) {
  if(t.covered_for)return `Taken over from ${t.covered_for}${t.takeover_reason?`: ${t.takeover_reason}`:''}`;
  return t.substitute_staff?`Covered by ${t.substitute_staff}`:'';
}
function reportsPage() {
  const period=reportPeriod(state.today,reportKind,reportOffset),staff=state.users.filter(u=>u.role==='Staff'&&u.active);
  const reports=staff.filter(u=>(reportStaff==='all'||String(u.user_id)===reportStaff)&&match([u.full_name])).map(u=>({...u,...staffReport(state.tasks,u.user_id,period,state.today)}));
  const total=key=>reports.reduce((sum,r)=>sum+r[key],0);
  const columns=[['assigned','Assigned'],['completed','Completed'],['missed','Missed'],['ongoing','Ongoing'],['skipped','Skipped'],['takenOver','Taken over'],['handedOver','Handed over']];
  const rate=value=>value===null?'—':`${value}%`;
  const due=total('completed')+total('missed')+total('skipped');
  return heading('Task reports','Weekly and monthly staff summaries. They update on their own and are ready to print.',button('Print report','report-print','','','printer'))+
    `<div class="report-toolbar">${filters(['Weekly','Monthly'],reportKind,'report-kind')}<div class="report-step"><button class="icon-button" data-action="report-step" data-id="-1" aria-label="Previous period">‹</button><strong>${period.label}</strong><button class="icon-button" data-action="report-step" data-id="1" aria-label="Next period" ${reportOffset>=0?'disabled':''}>›</button></div><label class="task-scope">Show<select id="report-staff"><option value="all">All staff</option>${options(staff,'user_id','full_name',reportStaff)}</select></label></div>
    <article class="report-paper" aria-label="${reportKind} task report">
      <header class="report-head"><img src="/img/qculogo.png" alt="" width="56" height="56"><div><p>Quezon City University · CUAI Garden</p><h2>${reportKind} task report</h2></div><dl><div><dt>Period</dt><dd>${period.label}</dd></div><div><dt>Generated</dt><dd>${fmt(state.today)}</dd></div></dl></header>
      <h3>Summary by staff</h3>
      ${reports.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>Staff</th>${columns.map(([,label])=>`<th class="numeric">${label}</th>`).join('')}<th class="numeric">Completion</th></tr></thead><tbody>${reports.map(r=>`<tr><td>${escape(r.full_name)}</td>${columns.map(([key])=>`<td class="numeric">${r[key]}</td>`).join('')}<td class="numeric">${rate(r.rate)}</td></tr>`).join('')}</tbody>${reports.length>1?`<tfoot><tr><th>Total</th>${columns.map(([key])=>`<td class="numeric">${total(key)}</td>`).join('')}<td class="numeric">${rate(due?Math.round(total('completed')/due*100):null)}</td></tr></tfoot>`:''}</table></div>`:empty('No staff match this report.')}
      <p class="report-note">Completion counts closed tasks only: completed, missed and skipped. Ongoing tasks are not held against anyone.</p>
      ${reports.map(r=>`<section class="report-staff"><h3>${escape(r.full_name)}</h3>${r.rows.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>Date</th><th>Time</th><th>Task</th><th>Plot</th><th>Status</th><th>Notes</th></tr></thead><tbody>${r.rows.map(t=>`<tr><td>${fmt(t.scheduled_date)}</td><td>${clock(t.scheduled_time)}</td><td>${escape(t.task_type)}</td><td>${escape(t.plot_code)}</td><td>${reportStatus(t,state.today)}</td><td>${escape(reportNote(t))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="report-none">No tasks assigned in this period.</p>'}</section>`).join('')}
      <footer class="report-sign"><div><span>${escape(state.user.full_name)}</span><small>Prepared by</small></div><div><span></span><small>Noted by</small></div></footer>
    </article>`;
}
function inventoryPage() { const plants=state.plants.filter(p=>match([p.crop_name,p.variety,p.notes])&&`${p.crop_name} ${p.variety||''} ${p.notes||''}`.toLowerCase().includes(cropSearch.trim().toLowerCase()));return heading('Crop Information','Every plot gets the care it needs.',isAdmin()?button('Add crop','new-plant','','','plus'):'')+`<div class="catalog-filter"><label for="crop-search">Find a crop or variety</label><input id="crop-search" type="search" value="${escape(cropSearch)}" placeholder="Search crops, varieties or notes" autocomplete="off"></div><section class="panel" id="crop-results" aria-live="polite">${panelHead('Crop information',`${state.plants.length} crop varieties in the garden catalog`)}${plants.length?`<div class="table-wrap"><table class="crop-table"><thead><tr><th>Crop</th><th>Variety</th><th class="numeric">Live cycles</th><th>Growing notes</th><th></th></tr></thead><tbody>${plants.map(p=>`<tr><td><strong>${escape(p.crop_name)}</strong></td><td data-label="Variety">${escape(p.variety||'—')}</td><td data-label="Live cycles" class="numeric">${state.cycles.filter(c=>c.plant_id===p.plant_id&&!c.harvest_date).length}</td><td data-label="Growing notes">${escape(p.notes||'—')}</td><td>${isAdmin()?button('Plant crop','plant-crop',p.plant_id,'secondary small'):''}</td></tr>`).join('')}</tbody></table></div>`:empty('No crops match your search.')}</section>`; }
function staffPage() { return heading('Staff and Access','Every plot gets the care it needs.',button('Add account','new-user','','','plus'))+`<div class="account-grid">${state.users.filter(u=>match([u.full_name,u.email,u.role])).map(u=>`<article class="person-card"><span class="avatar">${escape(initials(u.full_name))}</span><h3>${escape(u.full_name)}</h3><p>${escape(u.email)}<br>${u.role} · ${state.tasks.filter(t=>t.assigned_staff_id===u.user_id&&t.status==='Pending').length} pending tasks</p><div class="person-bottom">${badge(u.active?'Active':'Inactive',u.active?'':'gray')}${u.user_id!==state.user.user_id?button('Remove account','remove-user',u.user_id,'text danger'):'<small class="muted">Your account</small>'}</div></article>`).join('')}</div>`; }
function confirmWarning(warnings) {
  const dialog=$('#confirm');
  dialog.innerHTML=`${warnings.map(w=>`<h2>${escape(w.title)}</h2><p>${escape(w.text)}</p>`).join('')}<p class="confirm-question">Do you still want to continue?</p><div class="modal-actions"><button type="button" class="btn secondary" value="cancel">Cancel</button><button type="button" class="btn" value="continue">Continue</button></div>`;
  dialog.returnValue='';
  return new Promise(resolve=>{
    dialog.onclick=event=>{const value=event.target.closest('button')?.value;if(value)dialog.close(value);};
    dialog.onclose=()=>resolve(dialog.returnValue==='continue');
    dialog.showModal();
  });
}
function modal(title,description,fields,endpoint,extra={},label='Save record',warnings=()=>[]) {
  const dialog=$('#modal');
  dialog.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body"><p>${description}</p><form id="record-form">${fields}<div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close">Cancel</button><button class="btn" type="submit">${label}</button></div></form></div>`;
  if(!dialog.open)dialog.showModal();
  $('#record-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try { const values=Object.fromEntries(new FormData(form)),found=warnings(values);if(found.length&&!await confirmWarning(found))return;const result=await api(endpoint,{...values,...extra});dialog.close();if(endpoint==='password'||result.signed_out){state=null;renderLogin();toast('Profile updated. Sign in again.');}else{await refresh();toast(endpoint==='takeover'?'Task added to your open queue.':endpoint==='request-cover'?'Coverage request sent to staff.':endpoint==='profile'?'Profile updated.':endpoint==='remove-user'?'Account removed. Pending work is now unassigned.':endpoint==='task-message'?'Message sent privately to your admin.':'Garden record saved.');} }
    catch(error){form.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}
  });
}
function openForm(action,id) {
  const invite=(state.invites||[]).find(i=>i.invite_id===Number(id));
  const today=state.today,task=state.tasks.find(t=>t.task_id===Number(id)),cycle=state.cycles.find(c=>c.cycle_id===Number(id));
  if(action==='new-plant') modal('Add a crop','Keep the shared crop catalog up to date.',`${field('Crop name','crop_name','text','','required maxlength="80"')}${field('Variety','variety','text','','maxlength="80"')}${field('Growing notes (optional)','notes','text','','maxlength="500"')}`,'plants');
  if(action==='new-plot'&&editingMap&&isAdmin()) {mapPlacing=true;renderMain();$('.map-svg')?.focus({preventScroll:true});}
  if(action==='remove-plot'&&editingMap&&isAdmin()) {
    const p=activePlots().find(p=>p.plot_id===Number(id));if(!p)return;
    modal('Remove this plot?',`Remove ${escape(p.plot_code)} from the map? Past crop and care records stay available. A plot with a live crop or pending task cannot be removed.`,'','remove-plot',{plot_id:p.plot_id,revision:p.map_revision||0,map_edit:true},'Remove plot');
  }
  if(action==='new-cycle'||action==='plant-crop') {
    const available=activePlots().filter(p=>isGrowingPlot(p)&&p.occupancy_status!=='Occupied');
    if(!available.length) {toast('All plots are occupied. Record a harvest or add a plot first.');return;}
    modal('Start a new crop cycle','The planting date and original plot stay with this crop throughout its life.',`${select('Crop','plant_id',options(state.plants.map(p=>({...p,label:p.crop_name+(p.variety?' · '+p.variety:'')})),'plant_id','label',action==='plant-crop'?id:''))}${select('Available plot','plot_id',options(available,'plot_id','plot_code',action==='new-cycle'?id:''))}${select('Stage at planting','planting_stage','<option value="">Choose a stage</option><option>Seedling</option><option>Fully grown plant</option>')}${field('Planting date','planted_date','date',today,`required max="${today}"`)}${select('Assigned staff','assigned_staff_id',staffOptions())}`,'cycles');
    $('#f-assigned_staff_id').required=false;
  }
  if(action==='transplant') {
    const targets=activePlots().filter(p=>isGrowingPlot(p)&&p.zone!=='Nursery'&&p.occupancy_status!=='Occupied');
    if(!targets.length) {toast('No outdoor or greenhouse plots are currently available.');return;}
    modal('A new place to grow',`${escape(cycle.crop_name)} · ${escape(cycle.origin_plot)} origin · Planted ${fmt(cycle.planted_date)}. The transplant will be dated today.`,select('Destination plot','target_plot_id',options(targets,'plot_id','plot_code')),'transplant',{cycle_id:cycle.cycle_id},'Transplant crop');
  }
  if(action==='harvest') modal('Record a harvest',`${escape(cycle.crop_name)} · ${escape(cycle.plot_code)}. This closes the cycle and makes the plot available for planting.`,field('Harvest date','harvest_date','date',today,`required min="${cycle.transplanted_date||cycle.planted_date}" max="${today}"`),'harvest',{cycle_id:cycle.cycle_id},'Record harvest');
  if(action==='cycle-assignment'||action==='task-assignment') {
    modal('Update staff assignment','Choose a staff member, or leave this duty unassigned.',select('Assigned staff','assigned_staff_id',staffOptions(cycle&&action==='cycle-assignment'?cycle.assigned_staff_id:task?.assigned_staff_id)),action,action==='cycle-assignment'?{cycle_id:Number(id)}:{task_id:Number(id)});
    $('#f-assigned_staff_id').required=false;
  }
  if(action==='new-task') {
    modal('Schedule garden care','Use individual dated tasks for daily watering, extra sessions, and other garden care.',`<div class="form-grid">${select('Task type','task_type',options(['Manual watering','Fertilizer application','Hydroponic nutrients','General maintenance','Harvest'].map(x=>({x})),'x','x'))}${select('Plot','plot_id',plotOptions())}${field('Date','scheduled_date','date',today,`required min="${today}"`)}${field('Time (Asia/Manila)','scheduled_time','time','08:00','required')}<div class="wide">${select('Assigned staff','assigned_staff_id',staffOptions())}</div><p class="task-hint wide" id="task-hint" role="status"></p></div>`,'tasks',{},'Schedule task',values=>taskWarnings(values,state));
    $('#f-assigned_staff_id').required=false;
    const updatePlots=()=>{
      const type=$('#f-task_type').value,previous=$('#f-plot_id').value;
      const plots=activePlots().filter(p=>type==='General maintenance'||isGrowingPlot(p)&&(type!=='Harvest'||state.cycles.some(c=>c.current_plot_id===p.plot_id&&!c.harvest_date)));
      const label=p=>{const crop=liveCrop(state,p.plot_id);return `${p.plot_code} · ${isGrowingPlot(p)?crop?`${crop.crop_name}, ${growthStage(crop,state.today).label}`:'Vacant':p.zone}`;};
      $('#f-plot_id').innerHTML=options(plots.map(p=>({...p,label:label(p)})),'plot_id','label',previous)||'<option value="">No eligible plots</option>';
      $('#task-hint').textContent={'Manual watering':'Best before 9 AM or after 4 PM, when less water evaporates.','Fertilizer application':'Best on a plot with a growing crop, soon after watering.','Hydroponic nutrients':'For hydroponic greenhouse beds. Staff record the product used when they finish.','General maintenance':'For weeding, repairs and cleaning. Any plot or space can be chosen.','Harvest':'Only plots with a live crop are listed. Completing this task closes the crop cycle.'}[type];
    };
    $('#f-task_type').addEventListener('change',updatePlots);updatePlots();
  }
  const applicationFields=task&&['Fertilizer application','Hydroponic nutrients'].includes(task.task_type)?`${field('Product applied','product','text','','required maxlength="120"')}${field('Application notes (optional)','notes','text','','maxlength="500"')}`:'';
  if(action==='task-message') modal('Message your admin',`${escape(task.task_type)} · ${escape(task.plot_code)}. Only administrators can read this message.`,textarea('Message','message'),'task-message',{task_id:task.task_id},'Send message');
  if(action==='request-cover') modal('Request task coverage','Other active staff will be notified. This task stays in its current queue until someone accepts.','','request-cover',{task_id:task.task_id},'Notify staff');
  if(action==='takeover') modal('Step in for a teammate',`Accept this coverage request to move the task to your open queue.`,textarea('Why are you taking over?','takeover_reason'),'takeover',{task_id:invite.task_id,invite_id:invite.invite_id},'Accept task');
  if(action==='complete') modal('Mark this task complete?',`${escape(task.task_type)} · ${escape(task.plot_code)} · ${fmt(task.scheduled_date)}. Confirm after the manual work is done.`,applicationFields,'complete',{task_id:task.task_id},'Mark complete');
  if(action==='adjust') {
    modal('Adjust for the weather',`Update watering for ${escape(task.plot_code)} only. Other plots keep their own care schedules.`,`${select('Adjustment','action',options(['Skip','Reschedule'].map(x=>({x})),'x','x'))}<div id="reschedule-fields" hidden>${field('New date','scheduled_date','date',today,`min="${today}"`)}${field('New time','scheduled_time','time',task.scheduled_time)}</div>${textarea('Weather observation and reason','reason')}`,'adjust',{task_id:task.task_id},'Save adjustment',values=>values.action==='Reschedule'?taskWarnings({...task,scheduled_time:values.scheduled_time},state):[]);
    $('#f-action').addEventListener('change',event=>{const reschedule=event.target.value==='Reschedule';$('#reschedule-fields').hidden=!reschedule;$('#f-scheduled_date').required=reschedule;$('#f-scheduled_time').required=reschedule;});
  }
  if(action==='new-user') modal('Add an authorized account','Use at least 8 characters. Share the initial password securely and ask the staff member to update it in Edit profile.',`${field('Full name','full_name','text','','required maxlength="100"')}${field('Email address','email','email','','required maxlength="150" autocomplete="off"')}${select('Role','role',options(['Staff','Admin'].map(x=>({x})),'x','x'))}${field('Initial password','password','password','','required minlength="8" maxlength="128" autocomplete="new-password"')}`,'users',{},'Create account');
  if(action==='remove-user') {const user=state.users.find(u=>u.user_id===Number(id));modal('Remove account?',`Remove ${escape(user.full_name)}? Access ends immediately. Garden history keeps their name; pending tasks and live crops become unassigned. This cannot be undone.`,'','remove-user',{user_id:user.user_id},'Remove account');}
  if(action==='edit-profile') modal('Edit profile','Update your details. Enter your current password to change your email or password. Security changes sign you out of every session.',`${field('Full name','full_name','text',state.user.full_name,'required maxlength="100" autocomplete="name"')}${field('Email address','email','email',state.user.email,'required maxlength="150" autocomplete="email"')}${field('Current password','current_password','password','','maxlength="128" autocomplete="current-password"')}${field('New password (optional, 8 characters minimum)','password','password','','minlength="8" maxlength="128" autocomplete="new-password"')}`,'profile',{},'Save profile');
}
const pushOn=()=>Boolean(state.push_key)&&'serviceWorker' in navigator&&'PushManager' in window&&!isAdmin();
async function syncPush(ask) {
  if(!pushOn()||(Notification.permission!=='granted'&&!(ask&&await Notification.requestPermission()==='granted')))return;
  const reg=await navigator.serviceWorker.register('/sw.js');
  const raw=atob(state.push_key.replace(/-/g,'+').replace(/_/g,'/'));
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
  await api('push-subscribe',sub.toJSON());
}
async function dropPush() {
  try{const sub=await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription();if(sub){await api('push-unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}}catch{}
}
const pushButton=()=>pushOn()&&Notification.permission==='default'?button('Turn on phone alerts','enable-push','','secondary small'):'';
const seenKey=()=>`botaniq-seen-${state.user.user_id}`;
const seenTasks=()=>{try{return new Set(JSON.parse(localStorage.getItem(seenKey())||'[]'));}catch{return new Set();}};
const newTasks=()=>{const seen=seenTasks();return assignedPending(state.tasks,state.user.user_id).filter(t=>!seen.has(t.task_id));};
function markTasksSeen() {try{localStorage.setItem(seenKey(),JSON.stringify(assignedPending(state.tasks,state.user.user_id).map(t=>t.task_id)));}catch{}updateBell();}
const taskRows=tasks=>tasks.map(t=>`<article class="review-row"><div><strong>${escape(t.task_type)} · ${escape(t.plot_code)}</strong><p>${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}</p></div></article>`).join('');
function loginPopup() {
  if(isAdmin())return;
  const tasks=assignedPending(state.tasks,state.user.user_id);
  if(!tasks.length)return;
  $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">Notifications</h2><button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></div><div class="notification-body"><h3>You have ${tasks.length} task${tasks.length===1?'':'s'} to do</h3>${taskRows(tasks.slice(0,5))}${tasks.length>5?`<p class="queue-more">${tasks.length-5} more in Maintenance tasks.</p>`:''}${button('View my tasks','my-tasks','','small')} ${pushButton()}</div>`;
  $('#modal').showModal();markTasksSeen();
}
function updateBell() {
  const bell=document.querySelector('[data-action="notifications"]');
  if(!bell)return;
  const count=isAdmin()?notificationKeys(state).length:(state.invites||[]).filter(i=>!i.is_read).length+newTasks().length;
  bell.setAttribute('aria-label',`Notifications, ${count} unread`);
  bell.innerHTML=icon('bell')+(count?`<span class="notification-count" aria-hidden="true">${count}</span>`:'');
}
function notifications() {
  if(!isAdmin()) {
    const dialog=$('#modal');
    dialog.innerHTML=`<div class="modal-head"><h2 id="modal-title">Notifications</h2><button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></div>
      <div class="notification-body">${pushButton()}${newTasks().length?`<h3>Newly assigned tasks</h3>${taskRows(newTasks())}${(state.invites||[]).length?'<h3>Takeover requests</h3>':''}`:''}${(state.invites||[]).map(i=>`<article class="review-row"><div><strong>${escape(i.task_type)} · ${escape(i.plot_code)}</strong><p>${fmt(i.scheduled_date)} · ${clock(i.scheduled_time)}</p>
      ${button('Take over','takeover',i.invite_id,'small')} ${i.is_read?badge('Read','gray'):button('Mark read','read-invite',i.invite_id,'secondary small')}</div></article>`).join('')||empty('No tasks need taking over.')}</div>`;
    if(!dialog.open)dialog.showModal();markTasksSeen();return;
  }
  const flags=state.tasks.filter(t=>t.is_flagged_for_admin),messages=state.messages||[],cover=state.tasks.filter(t=>needsCover(t,state.today));
  $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">Notifications</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="notification-body"><h3>Tasks that need taking over</h3>${cover.map(t=>`<div class="review-row"><div><strong>${escape(t.plot_code)} · ${escape(t.task_type)}</strong><p>${fmt(t.scheduled_date)} · ${clock(t.scheduled_time)}<br>${escape(t.assigned_staff||'Unassigned')} needs cover. Staff were notified.</p></div>${button('Reassign','task-assignment',t.task_id,'secondary small')}</div>`).join('')||empty('No tasks need taking over.')}<h3>Staff messages</h3>${messages.map(m=>`<article class="review-row"><div><strong>${escape(m.full_name)}</strong><p>${escape(m.plot_code)} · ${escape(m.task_type)}<br>${escape(timestampLabel(m.created_at))}</p><p class="private-message">${escape(m.message)}</p></div>${!m.read_at?button('Mark read','read-message',m.message_id,'secondary small'):badge('Read','gray')}</article>`).join('')||empty('No staff messages yet.')}<h3>Task takeovers</h3>${flags.map(t=>`<div class="review-row"><div><h3>${escape(t.plot_code)} · ${escape(t.task_type)}</h3><p>${fmt(t.scheduled_date)}<br>${escape(t.substitute_staff)} accepted coverage${t.covered_for||t.assigned_staff_id!==t.substitute_staff_id?' for '+escape(t.covered_for||t.assigned_staff||'unassigned work'):''}.<br><strong>Reason:</strong> ${escape(t.takeover_reason)}</p></div>${button('Mark reviewed','review',t.task_id,'small')}</div>`).join('')||empty('No takeovers waiting for review.')}</div>`;
  if(!$('#modal').open)$('#modal').showModal();
}
async function refresh() { state=await api('state');view=getView();shell(); }
function navigate(target) {editingMap=false;mapPlacing=false;mapEditId=null;editingPlot=false;plotTab='overview';mapZoom=1;mapPan={x:0,y:0};history.pushState({},'',target);view=getView();search='';shell();$('#main').classList.add('view-enter');window.scrollTo(0,0);}
document.addEventListener('click',async event=>{
  const profileMenu=$('#profile-menu');
  if(profileMenu&&!event.target.closest('.profile-wrap')){profileMenu.hidden=true;$('.profile').setAttribute('aria-expanded','false');}
  const anchor=event.target.closest('a');
  if(anchor?.dataset.taskDate){taskFilter=anchor.dataset.taskDate<state.today?'Missed':'Open';staffFilter='all';}
  if(anchor?.dataset.summary){taskFilter=anchor.dataset.summary;staffFilter='all';}
  if(anchor&&state&&!['/','/index.html','/login.html'].includes(anchor.pathname)&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&anchor.origin===location.origin) {event.preventDefault();$('#modal')?.close();navigate(anchor.getAttribute('href'));return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id}=target.dataset;
  try {
    if(action==='close'){$('#modal').close();return;}
    if(action==='menu'){$('#sidebar').classList.toggle('open');$('.mobile-menu').setAttribute('aria-expanded',$('#sidebar').classList.contains('open'));if(!$('#sidebar').classList.contains('open'))$('.mobile-menu').focus();return;}
    if(mapSaving&&['map-edit','new-plot','remove-plot','map-place-cancel'].includes(action))return;
    if(action==='map-edit') {
      if(!isAdmin()||mapSaving)return;
      if(!editingMap){closeMapPlot();mapExtent=greenhouse()?100:Math.min(1000,Math.max(120,...mapPlots().map(p=>{const [,y,,h]=plotBounds(p);return y+h+15;})));}
      editingMap=!editingMap;mapPlacing=false;mapEditId=null;renderMain();return;
    }
    if(action==='map-place-cancel'){mapPlacing=false;renderMain();return;}
    if(action==='map-plot'){if(editingMap)selectMapEdit(Number(id));else selectMapPlot(Number(id));return;}
    if(action==='map-reset'){mapZoom=1;closeMapPlot();return;}
    if(action==='map-zoom'){mapZoom=Math.max(.75,Math.min(2,mapZoom+Number(id)));zoomMap(selectedPlot());return;}
    if(action==='plot-tab'){plotTab=id;editingPlot=false;renderPlotInspector();document.querySelector(`[data-action="plot-tab"][data-id="${id}"]`)?.focus();return;}
    if(action==='plot-edit'){if(isAdmin()){editingPlot=true;renderPlotInspector();$('#plot-description')?.focus();}return;}
    if(action==='plot-cancel'){editingPlot=false;renderPlotInspector();return;}
    if(action==='history-token'){const input=$('#history-query');input.value+=(input.value?' ':'')+id+':';historyQuery=input.value;input.focus();renderHistoryResults();return;}
    if(action==='zone'){zone=id;filterMap();return;}
    if(action==='task-filter'){taskFilter=id;renderMain();return;}
    if(action==='report-kind'){reportKind=id;reportOffset=0;renderMain();return;}
    if(action==='report-step'){reportOffset=Math.min(0,reportOffset+Number(id));renderMain();return;}
    if(action==='report-print'){window.print();return;}
    if(action==='stat-plots'){
      const stat=overviewPlots(state)[Number(id)];if(!stat)return;
      $('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">${escape(stat.label)}</h2><button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></div><div class="stat-plots">${stat.plots.map(p=>`<a href="plot-info.html?id=${p.plot_id}"><strong>${escape(p.plot_code)}</strong><span>${escape(p.zone)} →</span></a>`).join('')||empty('No plots in this category.')}</div>`;
      $('#modal').showModal();return;
    }
    if(action==='calendar-month'){calendarOffset+=Number(id);calendarDate='';renderMain();return;}
    if(action==='calendar-day'){calendarDate=calendarDate===id?'':id;renderMain();return;}
    if(action==='calendar-clear'){calendarDate='';renderMain();return;}
    if(action==='my-tasks'){$('#modal').close();taskFilter='Open';navigate('tasks.html');return;}
    if(action==='notifications'){notifications();return;}
    if(action==='read-invite'){target.disabled=true;await api('read-invite',{invite_id:Number(id)});await refresh();notifications();return;}
    if(action==='read-message'){target.disabled=true;await api('read-message',{message_id:Number(id)});await refresh();notifications();toast('Message marked as read.');return;}
    if(action==='review'){target.disabled=true;await api('review',{task_id:Number(id)});await refresh();notifications();toast('Takeover reviewed. The original record is preserved.');return;}
    if(action==='account'){
      const menu=$('#profile-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button').focus();return;
    }
    if(action==='enable-push'){await syncPush(true);$('#modal').close();toast(Notification.permission==='granted'?'Phone alerts are on.':'Phone alerts were not allowed.');return;}
    if(action==='logout'){await dropPush();await api('logout',{});state=null;history.pushState({},'','login.html');renderLogin();return;}
    openForm(action,id);
  }catch(error){target.disabled=false;toast(error.message);}
});
window.addEventListener('popstate',()=>{editingMap=false;mapPlacing=false;mapEditId=null;if(['/','/index.html'].includes(location.pathname)){renderLanding();}else if(state){view=getView();search='';shell();}else renderLogin();});
const landingRoute=['/','/index.html'].includes(location.pathname);
try {
  const [loaded]=await Promise.all([api('state').catch(error=>{if(error.message!=='Please sign in to continue.')toast(error.message);return null;}),new Promise(resolve=>setTimeout(resolve,landingRoute&&!matchMedia('(prefers-reduced-motion: reduce)').matches?1000:0))]);
  state=loaded;
  if(state)syncPush().catch(()=>{});
  if(landingRoute)renderLanding();else if(state){view=getView();shell();if(!sessionStorage.getItem('botaniq-greeted')){sessionStorage.setItem('botaniq-greeted','1');loginPopup();}}else renderLogin();
} catch(error){renderLogin();toast(error.message);}

let polling=false;
setInterval(async()=>{
  if(!state||document.hidden||$('#modal').open||editingMap||editingPlot||polling||!$('#main'))return;
  polling=true;
  try {
    const current=state;
    const next=await api('state');if(state!==current||next.user.user_id!==current.user.user_id||editingMap||editingPlot)return;
    const previous=new Set(notificationKeys(state));
    const incoming=notificationKeys(next).filter(key=>!previous.has(key));
    const changed=state.today!==next.today||JSON.stringify(state.tasks)!==JSON.stringify(next.tasks)||JSON.stringify(state.plots)!==JSON.stringify(next.plots)||JSON.stringify(state.cycles)!==JSON.stringify(next.cycles)||JSON.stringify(state.invites)!==JSON.stringify(next.invites);
    state=next;
    if(incoming.length) {
      toast(isAdmin()?`${incoming.length} new garden notification${incoming.length===1?'':'s'}. Open the bell to review.`:'Your garden work has an update. Check your tasks and takeover requests.');
    }
    updateBell();
    if(changed&&['dashboard','tasks','plots','reports'].includes(view)&&!document.activeElement?.matches('input,select,textarea'))renderMain();
  } catch(error) {if(state)toast('Could not refresh notifications. Check your connection.');}
  finally {polling=false;}
},30000);
