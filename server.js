import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const gardenDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const digest = value => createHash('sha256').update(value).digest('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
}
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function required(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${name} is required (up to ${max} characters).`);
  return value.trim();
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date.');
  return value;
}
function time(value) { if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('Enter a valid time.'); return value; }
function identifier(value) { if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail('Choose a valid record.'); return Number(value); }
function choice(value, list) { if (!list.includes(value)) fail('Choose a valid option.'); return value; }
const taskTypes = ['Manual watering', 'Fertilizer application', 'Hydroponic nutrients', 'General maintenance'];
export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(join(ROOT, 'schema.sql'), 'utf8'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}
export function seedDemo(db, today = gardenDate()) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n) return null;
  const password = randomBytes(9).toString('base64url');
  const day = offset => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
  db.exec('BEGIN');
  try {
    const user = db.prepare('INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)');
    user.run('Alex Rivera', 'admin@botaniq.local', hashPassword(password), 'Admin');
    user.run('Mika Santos', 'mika@botaniq.local', hashPassword(password), 'Staff');
    user.run('Paolo Reyes', 'paolo@botaniq.local', hashPassword(password), 'Staff');
    user.run('Sam Cruz', 'sam@botaniq.local', hashPassword(password), 'Staff');
    const plant = db.prepare('INSERT INTO plants(crop_name,variety,notes) VALUES(?,?,?)');
    for (const row of [['Bok choy','Pak choi','Leafy greens for the hydroponic greenhouse.'],['Chili','Siling haba','Harvest mature green fruits.'],['Cucumber','Slicing','Support with a trellis.'],['Radish','White radish','Root crop.'],['String beans','Sitaw','Climbing crop.'],['Tomato','Cherry','Nursery seedlings.']]) plant.run(...row);
    const plot = db.prepare('INSERT INTO plots(plot_code,zone,occupancy_status) VALUES(?,?,?)');
    for (const row of [['GH-01','Greenhouse','Occupied'],['GH-02','Greenhouse','Vacant'],['OP-01','Outdoor','Occupied'],['OP-02','Outdoor','Occupied'],['OP-03','Outdoor','Harvested'],['OP-04','Outdoor','Vacant'],['NR-01','Nursery','Occupied'],['NR-02','Nursery','Occupied']]) plot.run(...row);
    const cycle = db.prepare('INSERT INTO crop_cycles(plant_id,origin_plot_id,current_plot_id,assigned_staff_id,planted_date,harvest_date,cycle_status) VALUES(?,?,?,?,?,?,?)');
    for (const row of [[1,1,1,2,day(-25),null,'Active in Plot'],[2,3,3,3,day(-38),null,'Active in Plot'],[3,4,4,4,day(-30),null,'Active in Plot'],[6,7,7,2,day(-18),null,'In Nursery'],[1,8,8,3,day(-10),null,'In Nursery'],[4,5,5,4,day(-70),day(-9),'Harvested'],[5,6,6,3,day(-120),day(-60),'Harvested']]) cycle.run(...row);
    const task = db.prepare('INSERT INTO maintenance_tasks(plot_id,task_type,scheduled_date,scheduled_time,assigned_staff_id) VALUES(?,?,?,?,?)');
    for (const row of [[7,'Manual watering',today,'08:00',2],[1,'Manual watering',today,'14:00',2],[3,'Manual watering',today,'16:00',3],[4,'General maintenance',today,'09:00',4],[1,'Hydroponic nutrients',day(1),'10:00',2],[8,'Manual watering',today,'08:30',3]]) task.run(...row);
    db.prepare("UPDATE maintenance_tasks SET status='Completed',substitute_staff_id=4,takeover_reason='Paolo is away today. I covered the nursery watering.',is_flagged_for_admin=1,completed_at=? WHERE task_id=6").run(`${today}T00:40:00.000Z`);
    db.prepare("INSERT INTO nutrient_logs(plot_id,staff_id,application_date,nutrient_type,product,notes) VALUES(1,2,?,'Hydroponic nutrient','Leafy greens nutrient solution','Routine application recorded; no measured usage volume.')").run(day(-2));
    db.exec('COMMIT');
    return password;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function createApp(db, { today = gardenDate, secure = false } = {}) {
  // shortcut: login throttling is process-local; use a shared limiter before running multiple instances.
  const attempts = new Map();
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const admin = user => { if (user.role !== 'Admin') fail('Administrator access required.', 403); };
  const staff = id => {
    if (id === null || id === '') return null;
    const user = get("SELECT * FROM users WHERE user_id=? AND active=1 AND role='Staff'", identifier(id));
    if (!user) fail('Choose an active staff member.');
    return user.user_id;
  };
  const plot = id => { const p = get('SELECT * FROM plots WHERE plot_id=?', identifier(id)); if (!p) fail('Plot not found.', 404); return p; };
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const recentCycle = id => { const c = get("SELECT * FROM crop_cycles WHERE cycle_id=? AND (harvest_date IS NULL OR harvest_date>=date(?,'-42 days'))", identifier(id), today()); if (!c) fail('Cycle not found or archived. Archived records are read-only.', 404); return c; };
  function mutate(path, b, user) {
    if (path === '/api/plants') {
      admin(user); run('INSERT INTO plants(crop_name,variety,notes) VALUES(?,?,?)', required(b.crop_name,'Crop name',80), String(b.variety || '').slice(0,80), String(b.notes || '').slice(0,500));
    } else if (path === '/api/plots') {
      admin(user); run('INSERT INTO plots(plot_code,zone) VALUES(?,?)', required(b.plot_code,'Plot code',30), choice(b.zone,['Outdoor','Greenhouse','Nursery']));
    } else if (path === '/api/cycles') {
      admin(user);
      transaction(() => {
        const p = plot(b.plot_id);
        if (p.occupancy_status === 'Occupied') fail('This plot is already occupied.');
        if (!get('SELECT plant_id FROM plants WHERE plant_id=?', identifier(b.plant_id))) fail('Choose an existing crop.');
        const planted = date(b.planted_date); if (planted > today()) fail('Planting date cannot be in the future.');
        run('INSERT INTO crop_cycles(plant_id,origin_plot_id,current_plot_id,assigned_staff_id,planted_date,cycle_status) VALUES(?,?,?,?,?,?)', identifier(b.plant_id),p.plot_id,p.plot_id,staff(b.assigned_staff_id),planted,p.zone==='Nursery'?'In Nursery':'Active in Plot');
        run("UPDATE plots SET occupancy_status='Occupied' WHERE plot_id=?",p.plot_id);
      });
    } else if (path === '/api/transplant') {
      admin(user);
      transaction(() => {
        const c = recentCycle(b.cycle_id), source = plot(c.current_plot_id), target = plot(b.target_plot_id);
        if (c.harvest_date || source.zone !== 'Nursery' || c.transplanted_date) fail('Only a live nursery cycle can be transplanted.');
        if (target.zone === 'Nursery' || target.occupancy_status === 'Occupied') fail('Choose an available outdoor or greenhouse plot.');
        run("UPDATE crop_cycles SET current_plot_id=?,transplanted_date=?,cycle_status='Active in Plot' WHERE cycle_id=?",target.plot_id,today(),c.cycle_id);
        run("UPDATE plots SET occupancy_status='Vacant' WHERE plot_id=?",source.plot_id);
        run("UPDATE plots SET occupancy_status='Occupied' WHERE plot_id=?",target.plot_id);
      });
    } else if (path === '/api/harvest') {
      admin(user);
      transaction(() => {
        const c = recentCycle(b.cycle_id), harvested = date(b.harvest_date);
        if (c.harvest_date) fail('This cycle has already been harvested.');
        if (harvested < (c.transplanted_date || c.planted_date) || harvested > today()) fail('Harvest must be between planting/transplanting and today.');
        run("UPDATE crop_cycles SET harvest_date=?,cycle_status='Harvested' WHERE cycle_id=?",harvested,c.cycle_id);
        run("UPDATE plots SET occupancy_status='Harvested' WHERE plot_id=?",c.current_plot_id);
      });
    } else if (path === '/api/cycle-assignment') {
      admin(user); const c = recentCycle(b.cycle_id); if(c.harvest_date) fail('A harvested cycle cannot be reassigned.');
      run('UPDATE crop_cycles SET assigned_staff_id=? WHERE cycle_id=?',staff(b.assigned_staff_id),c.cycle_id);
    } else if (path === '/api/tasks') {
      admin(user); const p = plot(b.plot_id);
      run('INSERT INTO maintenance_tasks(plot_id,task_type,scheduled_date,scheduled_time,assigned_staff_id) VALUES(?,?,?,?,?)',p.plot_id,choice(b.task_type,taskTypes),date(b.scheduled_date),time(b.scheduled_time),staff(b.assigned_staff_id));
    } else if (['/api/complete','/api/takeover','/api/adjust','/api/task-assignment'].includes(path)) {
      transaction(() => {
        const task = get('SELECT * FROM maintenance_tasks WHERE task_id=?',identifier(b.task_id));
        if (!task) fail('Task not found.',404);
        if (task.status !== 'Pending') fail('This task is already closed.',409);
        if (path === '/api/task-assignment') {
          admin(user); run('UPDATE maintenance_tasks SET assigned_staff_id=? WHERE task_id=?',staff(b.assigned_staff_id),task.task_id); return;
        }
        if (path === '/api/takeover') {
          if (user.role !== 'Staff' || !task.assigned_staff_id || task.assigned_staff_id === user.user_id) fail('Take over a task assigned to another staff member.',403);
          if (task.scheduled_date > today()) fail('A future task cannot be completed yet.');
          run("UPDATE maintenance_tasks SET substitute_staff_id=?,takeover_reason=?,status='Completed',is_flagged_for_admin=1,completed_at=? WHERE task_id=?",user.user_id,required(b.takeover_reason,'Takeover reason'),new Date().toISOString(),task.task_id);
        } else {
          if (user.role !== 'Admin' && task.assigned_staff_id !== user.user_id) fail('Only the assigned staff member can update this task.',403);
          if (path === '/api/complete') {
            if (task.scheduled_date > today()) fail('A future task cannot be completed yet.');
            run("UPDATE maintenance_tasks SET status='Completed',completed_at=? WHERE task_id=?",new Date().toISOString(),task.task_id);
          } else {
            if (task.task_type !== 'Manual watering') fail('Weather adjustments apply to manual watering tasks.');
            const action = choice(b.action,['Skip','Reschedule']), reason = required(b.reason,'Weather adjustment reason');
            const schedule = action === 'Reschedule' ? `${date(b.scheduled_date)} ${time(b.scheduled_time)}` : null;
            if (action === 'Skip' && task.scheduled_date > today()) fail('A future task cannot be skipped yet.');
            if (action === 'Reschedule' && b.scheduled_date < today()) fail('Reschedule for today or a future date.');
            run('INSERT INTO task_adjustments(task_id,staff_id,reason,action,previous_schedule,new_schedule,created_at) VALUES(?,?,?,?,?,?,?)',task.task_id,user.user_id,reason,action,`${task.scheduled_date} ${task.scheduled_time}`,schedule,new Date().toISOString());
            if (action === 'Skip') run("UPDATE maintenance_tasks SET status='Skipped' WHERE task_id=?",task.task_id);
            else run('UPDATE maintenance_tasks SET scheduled_date=?,scheduled_time=? WHERE task_id=?',b.scheduled_date,b.scheduled_time,task.task_id);
          }
        }
      });
    } else if (path === '/api/review') {
      admin(user); const result=run('UPDATE maintenance_tasks SET is_flagged_for_admin=0,reviewed_at=?,reviewed_by=? WHERE task_id=? AND is_flagged_for_admin=1',new Date().toISOString(),user.user_id,identifier(b.task_id));
      if(!result.changes) fail('Flagged takeover not found.',404);
    } else if (path === '/api/nutrients') {
      const p = plot(b.plot_id), applied = date(b.application_date);
      if (applied > today()) fail('Application date cannot be in the future.');
      run('INSERT INTO nutrient_logs(plot_id,staff_id,application_date,nutrient_type,product,notes) VALUES(?,?,?,?,?,?)',p.plot_id,user.user_id,applied,choice(b.nutrient_type,['Fertilizer','Hydroponic nutrient']),required(b.product,'Fertilizer or nutrient name',120),String(b.notes||'').slice(0,500));
    } else if (path === '/api/users') {
      admin(user); const email=required(b.email,'Email',150).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email.');
      if(typeof b.password !== 'string' || b.password.length<12 || b.password.length>128) fail('Password must contain 12–128 characters.');
      run('INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',required(b.full_name,'Full name',100),email,hashPassword(b.password),choice(b.role,['Admin','Staff']));
    } else if (path === '/api/user-status') {
      admin(user); if(identifier(b.user_id)===user.user_id) fail('You cannot deactivate your own account.');
      if(typeof b.active !== 'boolean') fail('Invalid account status.');
      const result=run('UPDATE users SET active=? WHERE user_id=?',b.active?1:0,identifier(b.user_id)); if(!result.changes) fail('User not found.',404);
      run('DELETE FROM sessions WHERE user_id=?',identifier(b.user_id));
    } else if (path === '/api/password') {
      const current=get('SELECT password_hash FROM users WHERE user_id=?',user.user_id);
      if(typeof b.current_password!=='string' || b.current_password.length>128 || !verifyPassword(b.current_password,current.password_hash)) fail('Current password is incorrect.');
      if(typeof b.password!=='string' || b.password.length<12 || b.password.length>128) fail('Password must contain 12–128 characters.');
      transaction(()=>{run('UPDATE users SET password_hash=? WHERE user_id=?',hashPassword(b.password),user.user_id);run('DELETE FROM sessions WHERE user_id=?',user.user_id);});
    } else fail('Endpoint not found.',404);
    return { ok: true };
  }
  return http.createServer(async (req,res) => {
    const json = (data,status=200) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url,'http://localhost'), path=url.pathname;
      if (!path.startsWith('/api/')) {
        if(req.method !== 'GET' && req.method !== 'HEAD') fail('Method not allowed.',405);
        const pages=['/','/index.html','/admin-dashboard.html','/staff-dashboard.html','/plot-info.html','/edit-plot.html','/tasks.html','/inventory.html','/staff.html','/archive.html','/nutrients.html'];
        const assets={'/css/style.css':['css/style.css','text/css'],'/js/script.js':['js/script.js','text/javascript']};
        const asset=pages.includes(path)?['index.html','text/html']:assets[path];
        if(!asset) fail('Page not found.',404);
        res.writeHead(200,{'Content-Type':`${asset[1]}; charset=utf-8`,'Cache-Control':'no-cache'}); res.end(req.method==='HEAD'?'':readFileSync(join(ROOT,asset[0]))); return;
      }
      if(!['GET','POST'].includes(req.method)) fail('Method not allowed.',405);
      let b={};
      if(req.method==='POST') {
        if(req.headers.origin && req.headers.origin !== `${secure?'https':'http'}://${req.headers.host}`) fail('Cross-origin request rejected.',403);
        if(!req.headers['content-type']?.startsWith('application/json')) fail('Send JSON content.',415);
        let raw=''; for await (const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>16384) fail('Request too large.',413); }
        try { b=JSON.parse(raw); } catch { fail('Invalid JSON.'); }
        if(!b || typeof b!=='object' || Array.isArray(b)) fail('Invalid request.');
      }
      const token = /(?:^|; )botaniq_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];
      const user=token?get('SELECT u.user_id,u.full_name,u.email,u.role FROM sessions s JOIN users u ON s.user_id=u.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',digest(token),Date.now()):null;
      const cookie = value => res.setHeader('Set-Cookie',`botaniq_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?28800:0}${secure?'; Secure':''}`);
      if(path==='/api/login' && req.method==='POST') {
        const key=req.socket.remoteAddress;
        for(const [ip,entry] of attempts) if(entry.until<Date.now()) attempts.delete(ip);
        const attempt=attempts.get(key)||{count:0,until:Date.now()+900000};
        if(attempt.count>=10) fail('Too many sign-in attempts. Try again in 15 minutes.',429);
        attempt.count++;attempts.set(key,attempt);
        const email=required(b.email,'Email',150), password=b.password;
        if(typeof password!=='string' || !password.length || password.length>128) fail('Enter a valid password.');
        const account=get('SELECT * FROM users WHERE email=? AND active=1',email);
        if(!account || !verifyPassword(password,account.password_hash)) fail('Email or password is incorrect.',401);
        attempts.delete(key);
        const value=randomBytes(32).toString('hex');
        run('DELETE FROM sessions WHERE expires_at<?',Date.now());
        if(token) run('DELETE FROM sessions WHERE token_hash=?',digest(token));
        run('INSERT INTO sessions VALUES(?,?,?)',digest(value),account.user_id,Date.now()+28800000);
        cookie(value); json({ok:true}); return;
      }
      if(!user) fail('Please sign in to continue.',401);
      if(path==='/api/logout' && req.method==='POST') { run('DELETE FROM sessions WHERE token_hash=?',digest(token));cookie('');json({ok:true});return; }
      if(req.method==='GET' && path==='/api/state') {
        const isAdmin=user.role==='Admin';
        json({user,today:today(),cutoff:get("SELECT date(?,'-42 days') AS value",today()).value,
          plots:all('SELECT * FROM plots ORDER BY plot_code'),plants:all('SELECT * FROM plants ORDER BY crop_name'),
          users:all(`SELECT user_id,full_name,role,active${isAdmin?',email':''} FROM users ORDER BY full_name`),
          cycles:all("SELECT * FROM cycle_details WHERE harvest_date IS NULL OR harvest_date>=date(?,'-42 days') ORDER BY planted_date DESC",today()),
          archive:isAdmin?all("SELECT * FROM cycle_details WHERE harvest_date<date(?,'-42 days') ORDER BY harvest_date DESC",today()):[],
          tasks:all('SELECT t.*,p.plot_code,p.zone,u.full_name AS assigned_staff,s.full_name AS substitute_staff FROM maintenance_tasks t JOIN plots p ON t.plot_id=p.plot_id LEFT JOIN users u ON t.assigned_staff_id=u.user_id LEFT JOIN users s ON t.substitute_staff_id=s.user_id ORDER BY scheduled_date,scheduled_time'),
          adjustments:all('SELECT a.*,u.full_name FROM task_adjustments a JOIN users u ON a.staff_id=u.user_id ORDER BY adjustment_id DESC'),
          nutrients:all('SELECT n.*,p.plot_code,u.full_name FROM nutrient_logs n JOIN plots p ON n.plot_id=p.plot_id JOIN users u ON n.staff_id=u.user_id ORDER BY application_date DESC,log_id DESC')}); return;
      }
      if(req.method==='POST') { json(mutate(path,b,user)); return; }
      fail('Endpoint not found.',404);
    } catch(error) {
      if(error.code?.startsWith('ERR_SQLITE')) { json({error:error.message.includes('UNIQUE')?'This record already exists or the plot is occupied.':'The record could not be saved. Check the selected values.'},409); }
      else { if(!error.status) console.error(error); json({error:error.status?error.message:'An unexpected error occurred.'},error.status||500); }
    }
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  mkdirSync(join(ROOT,'data'),{recursive:true});
  const db=openDatabase(join(ROOT,'data','botaniq.sqlite'));
  const password=seedDemo(db);
  if(password) console.log(`Demo accounts created. Password: ${password}\nAdmin: admin@botaniq.local\nStaff: mika@botaniq.local, paolo@botaniq.local, sam@botaniq.local\nChange passwords from the account menu. These are fictional demo records.`);
  const port=Number(process.env.PORT||3000);
  const server=createApp(db,{secure:process.env.COOKIE_SECURE==='true'});
  server.listen(port,'127.0.0.1',()=>console.log(`BotaniQ is ready at http://localhost:${port}`));
}
