import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, openDatabase, seedDemo } from '../server.js';

async function fixture(t) {
  const db=openDatabase(),password=seedDemo(db,'2026-10-19');
  const server=createApp(db,{today:()=> '2026-10-19'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,body,cookie='',headers={}) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:response.headers.get('Content-Type')?.includes('application/json')?await response.json():await response.text(),cookie:response.headers.get('Set-Cookie')?.split(';')[0],headers:response.headers};
  }
  async function login(email='admin@botaniq.local') {const response=await request('/api/login',{email,password});assert.equal(response.status,200);return response.cookie;}
  return {db,request,login,password};
}
test('authenticated state, role boundaries, and static files protect database records',async t=>{
  const {request,login}=await fixture(t);
  assert.equal((await request('/api/state')).status,401);
  const staff=await login('mika@botaniq.local'),state=await request('/api/state',undefined,staff);
  assert.equal(state.status,200);assert.deepEqual(state.body.archive,[]);
  assert.equal(state.body.users[0].email,undefined);
  assert.ok(state.body.users.every(u=>!('password_hash' in u)));
  assert.equal((await request('/api/plots',{plot_code:'OP-99',zone:'Outdoor'},staff)).status,403);
  for(const path of ['/data/botaniq.sqlite','/schema.sql','/server.js','/.git/config']) assert.equal((await request(path)).status,404);
  for(const path of ['/','/edit-plot.html','/staff-dashboard.html','/css/style.css','/js/script.js']) assert.equal((await request(path)).status,200);
});
test('42-day harvest boundary has no gap and never removes permanent history',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  db.prepare("UPDATE crop_cycles SET harvest_date='2026-09-07' WHERE cycle_id=7").run();
  let result=await request('/api/state',undefined,admin);
  assert.equal(result.body.cutoff,'2026-09-07');
  assert.ok(result.body.cycles.some(c=>c.cycle_id===7));assert.equal(result.body.archive.length,0);
  db.prepare("UPDATE crop_cycles SET harvest_date='2026-09-06' WHERE cycle_id=7").run();
  result=await request('/api/state',undefined,admin);
  assert.ok(!result.body.cycles.some(c=>c.cycle_id===7));assert.equal(result.body.archive[0].cycle_id,7);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM crop_cycles').get().n,7);
  assert.equal((await request('/api/harvest',{cycle_id:7,harvest_date:'2026-10-19'},admin)).status,404);
});
test('transplant is atomic and preserves identity, origin and planting date',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  const before=db.prepare('SELECT * FROM crop_cycles WHERE cycle_id=4').get();
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:1},admin)).status,400);
  assert.deepEqual(db.prepare('SELECT * FROM crop_cycles WHERE cycle_id=4').get(),before);
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:2},admin)).status,200);
  const after=db.prepare('SELECT * FROM crop_cycles WHERE cycle_id=4').get();
  assert.equal(after.origin_plot_id,7);assert.equal(after.planted_date,before.planted_date);assert.equal(after.current_plot_id,2);assert.equal(after.transplanted_date,'2026-10-19');
  assert.equal(db.prepare('SELECT occupancy_status AS s FROM plots WHERE plot_id=7').get().s,'Vacant');
  assert.equal(db.prepare('SELECT occupancy_status AS s FROM plots WHERE plot_id=2').get().s,'Occupied');
  assert.equal((await request('/api/transplant',{cycle_id:4,target_plot_id:6},admin)).status,400);
});
test('staff takeover requires a reason, preserves assignee, and raises an admin flag',async t=>{
  const {db,request,login}=await fixture(t),staff=await login('mika@botaniq.local');
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'  '},staff)).status,400);
  assert.equal((await request('/api/complete',{task_id:3},staff)).status,403);
  assert.equal((await request('/api/takeover',{task_id:1,takeover_reason:'My own task'},staff)).status,403);
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'Paolo is absent.'},staff)).status,200);
  const task=db.prepare('SELECT * FROM maintenance_tasks WHERE task_id=3').get();
  assert.equal(task.assigned_staff_id,3);assert.equal(task.substitute_staff_id,2);assert.equal(task.is_flagged_for_admin,1);assert.equal(task.status,'Completed');assert.ok(task.completed_at);
  assert.equal((await request('/api/takeover',{task_id:3,takeover_reason:'Again'},staff)).status,409);
  assert.equal((await request('/api/review',{task_id:3},staff)).status,403);
  const admin=await login();assert.equal((await request('/api/review',{task_id:3},admin)).status,200);
  const reviewed=db.prepare('SELECT * FROM maintenance_tasks WHERE task_id=3').get();
  assert.equal(reviewed.takeover_reason,'Paolo is absent.');assert.ok(reviewed.reviewed_at);assert.equal(reviewed.is_flagged_for_admin,0);
});
test('weather adjustments retain a schedule audit and cannot change unrelated staff tasks',async t=>{
  const {db,request,login}=await fixture(t),staff=await login('mika@botaniq.local');
  assert.equal((await request('/api/adjust',{task_id:3,action:'Skip',reason:'Rain'},staff)).status,403);
  assert.equal((await request('/api/adjust',{task_id:1,action:'Skip',reason:''},staff)).status,400);
  assert.equal((await request('/api/adjust',{task_id:1,action:'Reschedule',scheduled_date:'2026-10-20',scheduled_time:'09:00',reason:'Heavy rain'},staff)).status,200);
  const adjustment=db.prepare('SELECT * FROM task_adjustments').get();assert.equal(adjustment.previous_schedule,'2026-10-19 08:00');assert.equal(adjustment.new_schedule,'2026-10-20 09:00');
  assert.equal((await request('/api/complete',{task_id:1},staff)).status,400);
  assert.equal((await request('/api/adjust',{task_id:2,action:'Skip',reason:'Watering not needed after inspection'},staff)).status,200);
  assert.equal(db.prepare('SELECT status FROM maintenance_tasks WHERE task_id=2').get().status,'Skipped');
});
test('harvest, replacement, assignment and date validation preserve history',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-02-30'},admin)).status,400);
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-10-20'},admin)).status,400);
  assert.equal((await request('/api/harvest',{cycle_id:1,harvest_date:'2026-10-19'},admin)).status,200);
  assert.equal((await request('/api/cycles',{plot_id:1,plant_id:4,planted_date:'2026-10-19',assigned_staff_id:3},admin)).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM crop_cycles WHERE current_plot_id=1').get().n,2);
  assert.equal((await request('/api/cycles',{plot_id:1,plant_id:4,planted_date:'2026-10-19',assigned_staff_id:3},admin)).status,400);
  assert.equal((await request('/api/cycle-assignment',{cycle_id:8,assigned_staff_id:''},admin)).status,200);
  assert.equal(db.prepare('SELECT assigned_staff_id FROM crop_cycles WHERE cycle_id=8').get().assigned_staff_id,null);
});
test('account management, password changes and session revocation are enforced',async t=>{
  const {request,login,password}=await fixture(t),admin=await login(),staff=await login('mika@botaniq.local');
  assert.equal((await request('/api/user-status',{user_id:1,active:false},admin)).status,400);
  assert.equal((await request('/api/user-status',{user_id:2,active:false},admin)).status,200);
  assert.equal((await request('/api/state',undefined,staff)).status,401);
  assert.equal((await request('/api/login',{email:'mika@botaniq.local',password})).status,401);
  assert.equal((await request('/api/users',{full_name:'Test Staff',email:'test@example.com',role:'Staff',password:'a strong new password '},admin)).status,200);
  const signIn=await request('/api/login',{email:'test@example.com',password:'a strong new password '});assert.equal(signIn.status,200);
  assert.match(signIn.headers.get('Set-Cookie'),/HttpOnly/);assert.match(signIn.headers.get('Set-Cookie'),/SameSite=Strict/);
  assert.equal((await request('/api/password',{current_password:'a strong new password ',password:'another strong password'},signIn.cookie)).status,200);
  assert.equal((await request('/api/state',undefined,signIn.cookie)).status,401);
});
test('catalog, scheduling and nutrient logs validate trust boundaries',async t=>{
  const {db,request,login}=await fixture(t),admin=await login(),staff=await login('mika@botaniq.local');
  assert.equal((await request('/api/plants',{crop_name:'Eggplant',variety:'Long purple',notes:'Transplant when ready.'},admin)).status,200);
  assert.equal((await request('/api/plants',{crop_name:'Eggplant'},admin)).status,409);
  assert.equal((await request('/api/plots',{plot_code:'OP-05',zone:'Outdoor'},admin)).status,200);
  assert.equal((await request('/api/tasks',{plot_id:9,task_type:'Manual watering',scheduled_date:'2026-10-19',scheduled_time:'25:00',assigned_staff_id:2},admin)).status,400);
  assert.equal((await request('/api/tasks',{plot_id:9,task_type:'Manual watering',scheduled_date:'2026-10-19',scheduled_time:'16:00',assigned_staff_id:2},admin)).status,200);
  assert.equal((await request('/api/task-assignment',{task_id:7,assigned_staff_id:''},admin)).status,200);
  assert.equal(db.prepare('SELECT assigned_staff_id FROM maintenance_tasks WHERE task_id=7').get().assigned_staff_id,null);
  assert.equal((await request('/api/nutrients',{plot_id:1,application_date:'2026-10-19',nutrient_type:'Pesticide',product:'Not allowed'},staff)).status,400);
  assert.equal((await request('/api/nutrients',{plot_id:1,application_date:'2026-10-19',nutrient_type:'Fertilizer',product:'Compost'},staff)).status,200);
  assert.equal((await request('/api/plots',{plot_code:'HACK',zone:'Outdoor'},admin,{Origin:'https://other.example'})).status,403);
  assert.equal((await request('/api/harvest',{cycle_id:'invalid',harvest_date:'2026-10-19'},admin)).status,400);
});
test('competing transplants cannot double-book a plot',async t=>{
  const {db,request,login}=await fixture(t),admin=await login();
  const responses=await Promise.all([4,5].map(cycle_id=>request('/api/transplant',{cycle_id,target_plot_id:2},admin)));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM crop_cycles WHERE current_plot_id=2 AND harvest_date IS NULL').get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM plots WHERE zone='Nursery' AND occupancy_status='Occupied'").get().n,1);
});
test('repeated bad logins are rate-limited',async t=>{
  const {request}=await fixture(t);
  for(let i=0;i<10;i++) assert.equal((await request('/api/login',{email:'unknown@example.com',password:'incorrect'})).status,401);
  assert.equal((await request('/api/login',{email:'unknown@example.com',password:'incorrect'})).status,429);
});
