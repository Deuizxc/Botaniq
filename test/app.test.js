import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, seedDemo } from '../backend.js';
import { testDatabase } from './database.js';

async function fixture(t) {
  const db=await testDatabase(),password=await seedDemo(db,'2026-10-19');
  const server=createApp(db,{today:()=> '2026-10-19'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();server.close();await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,body,cookie='',headers={}) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:response.headers.get('Content-Type')?.includes('application/json')?await response.json():await response.text(),cookie:response.headers.get('Set-Cookie')?.split(';')[0],headers:response.headers};
  }
  async function login(email='admin@gmail.com') {const response=await request('/api/login',{email,password});assert.equal(response.status,200);return response.cookie;}
  return {db,request,login,password};
}
test('profiles validate security changes and removal preserves history without access',async t=>{
  const {db,request,login}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com');
  const profile={full_name:'Heaven De Paz',email:'heavenashley@gmail.com'};
  assert.equal((await request('/api/profile',profile,staff)).status,200);
  assert.equal((await request('/api/profile',{...profile,email:'new@example.com'},staff)).status,400);
  assert.equal((await request('/api/profile',{...profile,password:'1234567',current_password:'123'},staff)).status,400);
  const changed=await request('/api/profile',{...profile,password:'newpass8',current_password:'123'},staff);
  assert.equal(changed.status,200);assert.equal(changed.body.signed_out,true);
  assert.equal((await request('/api/state',undefined,staff)).status,401);
  const next=await request('/api/login',{email:profile.email,password:'newpass8'});
  assert.equal(next.status,200);
  assert.equal((await request('/api/remove-user',{user_id:3},next.cookie)).status,403);
  assert.equal((await request('/api/users',{full_name:'Eight Character',email:'eight@example.com',role:'Staff',password:'12345678'},admin)).status,200);
  assert.equal((await request('/api/users',{full_name:'Short Password',email:'short@example.com',role:'Staff',password:'1234567'},admin)).status,400);
  assert.equal((await request('/api/remove-user',{user_id:2},admin)).status,200);
  assert.equal((await request('/api/state',undefined,next.cookie)).status,401);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM crop_cycles')).n,7);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM nutrient_logs')).n,1);
  assert.equal((await db.get('SELECT assigned_staff_id FROM maintenance_tasks WHERE task_id=1')).assigned_staff_id,null);
  assert.ok(!(await request('/api/state',undefined,admin)).body.users.some(u=>u.user_id===2));
  assert.equal((await request('/api/remove-user',{user_id:2},admin)).status,404);
});
test('authenticated state, role boundaries, and static files protect database records',async t=>{
  const {request,login}=await fixture(t);
  assert.equal((await request('/api/state')).status,401);
  const staff=await login('heavenashley@gmail.com'),state=await request('/api/state',undefined,staff);
  assert.equal(state.status,200);assert.ok(state.body.cycles.some(c=>c.cycle_id===7));
  assert.equal(state.body.users[0].email,undefined);
  assert.ok(state.body.users.every(u=>!('password_hash' in u)));
  assert.equal((await request('/api/plots',{plot_code:'OP-99',zone:'Outdoor'},staff)).status,403);
  for(const path of ['/data/botaniq.sqlite','/schema.sql','/server.js','/.git/config']) assert.equal((await request(path)).status,404);
  for(const path of ['/','/login.html','/edit-plot.html','/staff-dashboard.html','/css/style.css','/js/script.js','/js/garden.js','/img/testinglang.png','/img/qcu.png','/img/login_bg.png']) assert.equal((await request(path)).status,200);
});
test('staff messages stay private to admins, including through state and read endpoints',async t=>{
  const {request,login}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com'),other=await login('andreifurton@gmail.com');
  assert.equal((await request('/api/task-message',{task_id:3,message:'Not my task'},staff)).status,403);
  assert.equal((await request('/api/task-message',{task_id:1,message:'   '},staff)).status,400);
  assert.equal((await request('/api/task-message',{task_id:1,message:'The hose needs repair.'},staff)).status,200);
  assert.deepEqual((await request('/api/state',undefined,other)).body.messages,[]);
  assert.deepEqual((await request('/api/state',undefined,staff)).body.messages,[]);
  const messages=(await request('/api/state',undefined,admin)).body.messages;
  assert.equal(messages.length,1);assert.equal(messages[0].message,'The hose needs repair.');
  assert.equal((await request('/api/read-message',{message_id:messages[0].message_id},other)).status,403);
  assert.equal((await request('/api/read-message',{message_id:messages[0].message_id},admin)).status,200);
  assert.ok((await request('/api/state',undefined,admin)).body.messages[0].read_at);
});
test('fertilizer task completion records its application atomically once',async t=>{
  const {db,request,login}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com'),other=await login('andreifurton@gmail.com');
  assert.equal((await request('/api/tasks',{plot_id:1,task_type:'Fertilizer application',scheduled_date:'2026-10-19',scheduled_time:'08:00',assigned_staff_id:2},admin)).status,200);
  const task=(await db.get('SELECT MAX(task_id) AS id FROM maintenance_tasks')).id;
  assert.equal((await request('/api/complete',{task_id:task,product:'Compost'},other)).status,403);
  assert.equal((await request('/api/complete',{task_id:task},staff)).status,400);
  assert.equal((await db.get(`SELECT status FROM maintenance_tasks WHERE task_id=${task}`)).status,'Pending');
  assert.equal((await request('/api/complete',{task_id:task,product:'Compost',notes:'Around roots'},staff)).status,200);
  assert.equal((await request('/api/complete',{task_id:task,product:'Compost'},staff)).status,409);
  const application=await db.get(`SELECT * FROM nutrient_logs WHERE task_id=${task}`);
  assert.equal(application.product,'Compost');assert.equal(application.nutrient_type,'Fertilizer');assert.equal(application.staff_id,2);assert.ok(application.applied_at);
});
test('42-day harvest boundary has no gap and never removes permanent history',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  await db.query("UPDATE crop_cycles SET harvest_date='2026-09-07' WHERE cycle_id=7");
  let result=await request('/api/state',undefined,admin);
  assert.equal(result.body.cutoff,'2026-09-07');
  assert.ok(result.body.cycles.some(c=>c.cycle_id===7));
  await db.query("UPDATE crop_cycles SET harvest_date='2026-09-06' WHERE cycle_id=7");
  result=await request('/api/state',undefined,admin);
  assert.ok(result.body.cycles.some(c=>c.cycle_id===7));assert.equal(result.body.archive,undefined);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM crop_cycles')).n,7);
  assert.equal((await request('/api/harvest',{cycle_id:7,harvest_date:'2026-10-19'},admin)).status,404);
});
test('transplant is atomic and preserves identity, origin and planting date',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  const before=(await db.get('SELECT * FROM crop_cycles WHERE cycle_id=4'));
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:1},admin)).status,400);
  assert.deepEqual((await db.get('SELECT * FROM crop_cycles WHERE cycle_id=4')),before);
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:2},admin)).status,200);
  const after=(await db.get('SELECT * FROM crop_cycles WHERE cycle_id=4'));
  assert.equal(after.origin_plot_id,7);assert.equal(after.planted_date,before.planted_date);assert.equal(after.current_plot_id,2);assert.equal(after.transplanted_date,'2026-10-19');
  assert.equal((await db.get('SELECT occupancy_status AS s FROM plots WHERE plot_id=7')).s,'Vacant');
  assert.equal((await db.get('SELECT occupancy_status AS s FROM plots WHERE plot_id=2')).s,'Occupied');
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:6},admin)).status,400);
});
test('staff takeover requires a reason, preserves assignee, and raises an admin flag',async t=>{
  const {db,request,login}=await fixture(t),staff=await login('heavenashley@gmail.com');
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'  '},staff)).status,400);
  assert.equal((await request('/api/complete',{task_id:3},staff)).status,403);
  assert.equal((await request('/api/takeover',{task_id:1,takeover_reason:'My own task'},staff)).status,403);
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'Brent is absent.'},staff)).status,200);
  const task=(await db.get('SELECT * FROM maintenance_tasks WHERE task_id=3'));
  assert.equal(task.assigned_staff_id,3);assert.equal(task.substitute_staff_id,2);assert.equal(task.is_flagged_for_admin,1);assert.equal(task.status,'Completed');assert.ok(task.completed_at);
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'Again'},staff)).status,409);
  assert.equal((await request('/api/review',{task_id:3},staff)).status,403);
  const admin=await login();assert.equal((await request('/api/review',{task_id:3},admin)).status,200);
  const reviewed=(await db.get('SELECT * FROM maintenance_tasks WHERE task_id=3'));
  assert.equal(reviewed.takeover_reason,'Brent is absent.');assert.ok(reviewed.reviewed_at);assert.equal(reviewed.is_flagged_for_admin,0);
});
test('weather adjustments retain a schedule audit and cannot change unrelated staff tasks',async t=>{
  const {db,request,login}=await fixture(t),staff=await login('heavenashley@gmail.com');
  assert.equal((await request('/api/adjust',{task_id:3,action:'Skip',reason:'Rain'},staff)).status,403);
  assert.equal((await request('/api/adjust',{task_id:1,action:'Skip',reason:''},staff)).status,400);
  assert.equal((await request('/api/adjust',{task_id:1,action:'Reschedule',scheduled_date:'2026-10-20',scheduled_time:'09:00',reason:'Heavy rain'},staff)).status,200);
  const adjustment=(await db.get('SELECT * FROM task_adjustments'));assert.equal(adjustment.previous_schedule,'2026-10-19 08:00');assert.equal(adjustment.new_schedule,'2026-10-20 09:00');
  assert.equal((await request('/api/complete',{task_id:1},staff)).status,400);
  assert.equal((await request('/api/adjust',{task_id:2,action:'Skip',reason:'Watering not needed after inspection'},staff)).status,200);
  assert.equal((await db.get('SELECT status FROM maintenance_tasks WHERE task_id=2')).status,'Skipped');
});
test('harvest, replacement, assignment and date validation preserve history',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-02-30'},admin)).status,400);
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-10-20'},admin)).status,400);
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-10-19'},admin)).status,200);
  assert.equal((await request('/api/cycles',{plot_id:1,plant_id:4,planted_date:'2026-10-19',assigned_staff_id:3},admin)).status,200);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM crop_cycles WHERE current_plot_id=1')).n,2);
  assert.equal((await request('/api/cycles',{plot_id:1,plant_id:4,planted_date:'2026-10-19',assigned_staff_id:3},admin)).status,400);
  assert.equal((await request('/api/cycle-assignment',{cycle_id:8,assigned_staff_id:''},admin)).status,200);
  assert.equal((await db.get('SELECT assigned_staff_id FROM crop_cycles WHERE cycle_id=8')).assigned_staff_id,null);
});
test('account management, password changes and session revocation are enforced',async t=>{
  const {request,login,password}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com');
  assert.equal((await request('/api/remove-user',{user_id:1},admin)).status,400);
  assert.equal((await request('/api/remove-user',{user_id:2},admin)).status,200);
  assert.equal((await request('/api/state',undefined,staff)).status,401);
  assert.equal((await request('/api/login',{email:'heavenashley@gmail.com',password})).status,401);
  assert.equal((await request('/api/users',{full_name:'Test Staff',email:'test@example.com',role:'Staff',password:'a strong new password '},admin)).status,200);
  const signIn=await request('/api/login',{email:'test@example.com',password:'a strong new password '});assert.equal(signIn.status,200);
  assert.match(signIn.headers.get('Set-Cookie'),/HttpOnly/);assert.match(signIn.headers.get('Set-Cookie'),/SameSite=Strict/);
  assert.equal((await request('/api/password',{current_password:'a strong new password ',password:'another strong password'},signIn.cookie)).status,200);
  assert.equal((await request('/api/state',undefined,signIn.cookie)).status,401);
});
test('catalog, scheduling and nutrient logs validate trust boundaries',async t=>{
  const {db,request,login}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com');
  assert.equal((await request('/api/plants',{crop_name:'Eggplant',variety:'Long purple',notes:'Transplant when ready.'},admin)).status,200);
  assert.equal((await request('/api/plants',{crop_name:'Eggplant'},admin)).status,409);
  assert.equal((await request('/api/plots',{plot_code:'OP-05',zone:'Outdoor'},admin)).status,200);
  assert.equal((await request('/api/tasks',{plot_id:9,task_type:'Manual watering',scheduled_date:'2026-10-19',scheduled_time:'25:00',assigned_staff_id:2},admin)).status,400);
  assert.equal((await request('/api/tasks',{plot_id:9,task_type:'Manual watering',scheduled_date:'2026-10-19',scheduled_time:'16:00',assigned_staff_id:2},admin)).status,200);
  assert.equal((await request('/api/task-assignment',{task_id:7,assigned_staff_id:''},admin)).status,200);
  assert.equal((await db.get('SELECT assigned_staff_id FROM maintenance_tasks WHERE task_id=7')).assigned_staff_id,null);
  assert.equal((await request('/api/nutrients',{plot_id:1,application_date:'2026-10-19',nutrient_type:'Pesticide',product:'Not allowed'},staff)).status,400);
  assert.equal((await request('/api/nutrients',{plot_id:1,application_date:'2026-10-19',nutrient_type:'Fertilizer',product:'Compost'},staff)).status,200);
  assert.equal((await request('/api/plots',{plot_code:'HACK',zone:'Outdoor'},admin,{Origin:'https://other.example'})).status,403);
  assert.equal((await request('/api/harvest',{cycle_id:'invalid',harvest_date:'2026-10-19'},admin)).status,400);
});
test('competing transplants cannot double-book a plot',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  const responses=await Promise.all([4,5].map(cycle_id=>request('/api/transplant',{cycle_id,target_plot_id:2},admin)));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM crop_cycles WHERE current_plot_id=2 AND harvest_date IS NULL')).n,1);
  assert.equal((await db.get("SELECT COUNT(*)::int AS n FROM plots WHERE zone='Nursery' AND occupancy_status='Occupied'")).n,1);
});
test('repeated bad logins are rate-limited',async t=>{
  const {request}=await fixture(t);
  for(let i=0;i<10;i++) assert.equal((await request('/api/login',{email:'unknown@example.com',password:'incorrect'})).status,401);
  assert.equal((await request('/api/login',{email:'unknown@example.com',password:'incorrect'})).status,429);
});

test('garden migration preserves existing plots and creates 27 unique map positions once',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  const state=(await request('/api/state',undefined,admin)).body;
  assert.equal(state.plots.length,27);
  assert.deepEqual(state.plots.map(p=>p.map_slot).sort((a,b)=>a-b),Array.from({length:27},(_,i)=>i+1));
  assert.equal(state.plots.find(p=>p.plot_id===1).plot_code,'GH-01');
  assert.equal(state.cycles.find(c=>c.cycle_id===1).current_plot_id,1);
  const {seedDemo:restart}=await import('../backend.js?restart=map');
  await restart(db);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM plots')).n,27);
  assert.equal((await db.get('SELECT COUNT(*)::int AS n FROM crop_cycles')).n,7);
});

test('plot entries are admin-only, validated, persistent snapshots visible to staff',async t=>{
  const {request,login}=await fixture(t),admin=await login(),staff=await login('heavenashley@gmail.com');
  const entry={plot_id:1,cycle_id:1,description:'Bok choy growing well.',watered_at:'2026-10-18T01:00:00.000Z',harvested_at:null,fertilizer:'Compost',fertilized_at:'2026-10-17T02:00:00.000Z'};
  assert.equal((await request('/api/plot-entry',entry)).status,401);
  assert.equal((await request('/api/plot-entry',entry,staff)).status,403);
  assert.equal((await request('/api/plot-entry',{...entry,cycle_id:2},admin)).status,409);
  assert.equal((await request('/api/plot-entry',{...entry,watered_at:'2026-02-30'},admin)).status,400);
  assert.equal((await request('/api/plot-entry',{...entry,watered_at:'2999-01-01'},admin)).status,400);
  assert.equal((await request('/api/plot-entry',{...entry,fertilized_at:null},admin)).status,400);
  assert.equal((await request('/api/plot-entry',{...entry,description:' '},admin)).status,400);
  assert.equal((await request('/api/plot-entry',entry,admin)).status,200);
  assert.equal((await request('/api/plot-entry',{...entry,description:'Ready to pick.',fertilizer:null,fertilized_at:null},admin)).status,200);
  const state=(await request('/api/state',undefined,staff)).body;
  assert.equal(state.entries.length,2);
  assert.equal(state.entries[0].description,'Ready to pick.');
  assert.equal(state.entries[0].fertilizer,null);
  assert.equal(state.entries[1].description,'Bok choy growing well.');
  assert.equal(state.entries[1].fertilizer,'Compost');
  assert.ok(state.cycles.some(c=>c.harvest_date&&c.harvest_date<state.cutoff));
});
