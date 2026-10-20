import http from 'node:http';
import pg from 'pg';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const ROOT = dirname(fileURLToPath(import.meta.url));

export const gardenDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

const shiftDays = (baseDate, offsetDays) =>
  new Date(Date.parse(baseDate) + offsetDays * 86400000).toISOString().slice(0, 10);

const digest = value => createHash('sha256').update(value).digest('hex');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
}

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function required(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    fail(`${name} is required (up to ${max} characters).`);
  }
  return value.trim();
}

function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    fail('Enter a valid date.');
  }
  return value;
}

function time(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    fail('Enter a valid time.');
  }
  return value;
}

function identifier(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    fail('Choose a valid record.');
  }
  return Number(value);
}

function choice(value, list) {
  if (!list.includes(value)) fail('Choose a valid option.');
  return value;
}

const taskTypes = [
  'Manual watering',
  'Fertilizer application',
  'Hydroponic nutrients',
  'General maintenance'
];

// Convert "?" placeholders into PostgreSQL "$1, $2, ..."
function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createRunner(client) {
  return {
    async get(sql, ...args) {
      const res = await client.query(toPgSql(sql), args);
      return res.rows[0] || null;
    },
    async all(sql, ...args) {
      const res = await client.query(toPgSql(sql), args);
      return res.rows;
    },
    async run(sql, ...args) {
      const res = await client.query(toPgSql(sql), args);
      return { changes: res.rowCount };
    }
  };
}

let pool;
export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false }
    });
  }
  return pool;
}

let seeded = false;
export async function seedDemo(dbPool, today = gardenDate()) {
  if (seeded) return null;
  const client = await dbPool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n > 0) {
      seeded = true;
      return null;
    }
    const password = process.env.DEMO_PASSWORD || 'botaniq-demo-1234';
    const day = offset => shiftDays(today, offset);
    const db = createRunner(client);

    await client.query('BEGIN');
    for (const [fullName, email, role] of [
      ['Alex Rivera', 'admin@botaniq.local', 'Admin'],
      ['Mika Santos', 'mika@botaniq.local', 'Staff'],
      ['Paolo Reyes', 'paolo@botaniq.local', 'Staff'],
      ['Sam Cruz', 'sam@botaniq.local', 'Staff']
    ]) {
      await db.run(
        'INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',
        fullName,
        email,
        hashPassword(password),
        role
      );
    }

    for (const row of [
      ['Bok choy', 'Pak choi', 'Leafy greens for the hydroponic greenhouse.'],
      ['Chili', 'Siling haba', 'Harvest mature green fruits.'],
      ['Cucumber', 'Slicing', 'Support with a trellis.'],
      ['Radish', 'White radish', 'Root crop.'],
      ['String beans', 'Sitaw', 'Climbing crop.'],
      ['Tomato', 'Cherry', 'Nursery seedlings.']
    ]) {
      await db.run('INSERT INTO plants(crop_name,variety,notes) VALUES(?,?,?)', ...row);
    }

    for (const row of [
      ['GH-01', 'Greenhouse', 'Occupied'],
      ['GH-02', 'Greenhouse', 'Vacant'],
      ['OP-01', 'Outdoor', 'Occupied'],
      ['OP-02', 'Outdoor', 'Occupied'],
      ['OP-03', 'Outdoor', 'Harvested'],
      ['OP-04', 'Outdoor', 'Vacant'],
      ['NR-01', 'Nursery', 'Occupied'],
      ['NR-02', 'Nursery', 'Occupied']
    ]) {
      await db.run('INSERT INTO plots(plot_code,zone,occupancy_status) VALUES(?,?,?)', ...row);
    }

    for (const row of [
      [1, 1, 1, 2, day(-25), null, 'Active in Plot'],
      [2, 3, 3, 3, day(-38), null, 'Active in Plot'],
      [3, 4, 4, 4, day(-30), null, 'Active in Plot'],
      [6, 7, 7, 2, day(-18), null, 'In Nursery'],
      [1, 8, 8, 3, day(-10), null, 'In Nursery'],
      [4, 5, 5, 4, day(-70), day(-9), 'Harvested'],
      [5, 6, 6, 3, day(-120), day(-60), 'Harvested']
    ]) {
      await db.run(
        'INSERT INTO crop_cycles(plant_id,origin_plot_id,current_plot_id,assigned_staff_id,planted_date,harvest_date,cycle_status) VALUES(?,?,?,?,?,?,?)',
        ...row
      );
    }

    for (const row of [
      [7, 'Manual watering', today, '08:00', 2],
      [1, 'Manual watering', today, '14:00', 2],
      [3, 'Manual watering', today, '16:00', 3],
      [4, 'General maintenance', today, '09:00', 4],
      [1, 'Hydroponic nutrients', day(1), '10:00', 2],
      [8, 'Manual watering', today, '08:30', 3]
    ]) {
      await db.run(
        'INSERT INTO maintenance_tasks(plot_id,task_type,scheduled_date,scheduled_time,assigned_staff_id) VALUES(?,?,?,?,?)',
        ...row
      );
    }

    await db.run(
      "UPDATE maintenance_tasks SET status='Completed',substitute_staff_id=4,takeover_reason='Paolo is away today. I covered the nursery watering.',is_flagged_for_admin=1,completed_at=? WHERE task_id=6",
      `${today}T00:40:00.000Z`
    );

    await db.run(
      "INSERT INTO nutrient_logs(plot_id,staff_id,application_date,nutrient_type,product,notes) VALUES(1,2,?,'Hydroponic nutrient','Leafy greens nutrient solution','Routine application recorded; no measured usage volume.')",
      day(-2)
    );

    await client.query('COMMIT');
    seeded = true;
    return password;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createHandler(dbPool, { today = gardenDate, secure = false } = {}) {
  const attempts = new Map();
  const baseDb = createRunner(dbPool);

  const admin = user => {
    if (user.role !== 'Admin') fail('Administrator access required.', 403);
  };

  const staff = async (db, id) => {
    if (id === null || id === '') return null;
    const user = await db.get(
      "SELECT * FROM users WHERE user_id=? AND active=1 AND role='Staff'",
      identifier(id)
    );
    if (!user) fail('Choose an active staff member.');
    return user.user_id;
  };

  const plot = async (db, id) => {
    const p = await db.get('SELECT * FROM plots WHERE plot_id=?', identifier(id));
    if (!p) fail('Plot not found.', 404);
    return p;
  };

  const recentCycle = async (db, id) => {
    const cutoff = shiftDays(today(), -42);
    const c = await db.get(
      'SELECT * FROM crop_cycles WHERE cycle_id=? AND (harvest_date IS NULL OR harvest_date>=?)',
      identifier(id),
      cutoff
    );
    if (!c) fail('Cycle not found or archived. Archived records are read-only.', 404);
    return c;
  };

  const transaction = async fn => {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(createRunner(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  async function mutate(path, b, user) {
    if (path === '/api/plants') {
      admin(user);
      await baseDb.run(
        'INSERT INTO plants(crop_name,variety,notes) VALUES(?,?,?)',
        required(b.crop_name, 'Crop name', 80),
        String(b.variety || '').slice(0, 80),
        String(b.notes || '').slice(0, 500)
      );
    } else if (path === '/api/plots') {
      admin(user);
      await baseDb.run(
        'INSERT INTO plots(plot_code,zone) VALUES(?,?)',
        required(b.plot_code, 'Plot code', 30),
        choice(b.zone, ['Outdoor', 'Greenhouse', 'Nursery'])
      );
    } else if (path === '/api/cycles') {
      admin(user);
      await transaction(async tx => {
        const p = await plot(tx, b.plot_id);
        if (p.occupancy_status === 'Occupied') fail('This plot is already occupied.');
        if (!(await tx.get('SELECT plant_id FROM plants WHERE plant_id=?', identifier(b.plant_id)))) {
          fail('Choose an existing crop.');
        }
        const planted = date(b.planted_date);
        if (planted > today()) fail('Planting date cannot be in the future.');
        const assignedStaff = await staff(tx, b.assigned_staff_id);
        await tx.run(
          'INSERT INTO crop_cycles(plant_id,origin_plot_id,current_plot_id,assigned_staff_id,planted_date,cycle_status) VALUES(?,?,?,?,?,?)',
          identifier(b.plant_id),
          p.plot_id,
          p.plot_id,
          assignedStaff,
          planted,
          p.zone === 'Nursery' ? 'In Nursery' : 'Active in Plot'
        );
        await tx.run("UPDATE plots SET occupancy_status='Occupied' WHERE plot_id=?", p.plot_id);
      });
    } else if (path === '/api/transplant') {
      admin(user);
      await transaction(async tx => {
        const c = await recentCycle(tx, b.cycle_id);
        const source = await plot(tx, c.current_plot_id);
        const target = await plot(tx, b.target_plot_id);
        if (c.harvest_date || source.zone !== 'Nursery' || c.transplanted_date) {
          fail('Only a live nursery cycle can be transplanted.');
        }
        if (target.zone === 'Nursery' || target.occupancy_status === 'Occupied') {
          fail('Choose an available outdoor or greenhouse plot.');
        }
        await tx.run(
          "UPDATE crop_cycles SET current_plot_id=?,transplanted_date=?,cycle_status='Active in Plot' WHERE cycle_id=?",
          target.plot_id,
          today(),
          c.cycle_id
        );
        await tx.run("UPDATE plots SET occupancy_status='Vacant' WHERE plot_id=?", source.plot_id);
        await tx.run("UPDATE plots SET occupancy_status='Occupied' WHERE plot_id=?", target.plot_id);
      });
    } else if (path === '/api/harvest') {
      admin(user);
      await transaction(async tx => {
        const c = await recentCycle(tx, b.cycle_id);
        const harvested = date(b.harvest_date);
        if (c.harvest_date) fail('This cycle has already been harvested.');
        if (harvested < (c.transplanted_date || c.planted_date) || harvested > today()) {
          fail('Harvest must be between planting/transplanting and today.');
        }
        await tx.run(
          "UPDATE crop_cycles SET harvest_date=?,cycle_status='Harvested' WHERE cycle_id=?",
          harvested,
          c.cycle_id
        );
        await tx.run("UPDATE plots SET occupancy_status='Harvested' WHERE plot_id=?", c.current_plot_id);
      });
    } else if (path === '/api/cycle-assignment') {
      admin(user);
      const c = await recentCycle(baseDb, b.cycle_id);
      if (c.harvest_date) fail('A harvested cycle cannot be reassigned.');
      const assignedStaff = await staff(baseDb, b.assigned_staff_id);
      await baseDb.run('UPDATE crop_cycles SET assigned_staff_id=? WHERE cycle_id=?', assignedStaff, c.cycle_id);
    } else if (path === '/api/tasks') {
      admin(user);
      const p = await plot(baseDb, b.plot_id);
      const assignedStaff = await staff(baseDb, b.assigned_staff_id);
      await baseDb.run(
        'INSERT INTO maintenance_tasks(plot_id,task_type,scheduled_date,scheduled_time,assigned_staff_id) VALUES(?,?,?,?,?)',
        p.plot_id,
        choice(b.task_type, taskTypes),
        date(b.scheduled_date),
        time(b.scheduled_time),
        assignedStaff
      );
    } else if (['/api/complete', '/api/takeover', '/api/adjust', '/api/task-assignment'].includes(path)) {
      await transaction(async tx => {
        const task = await tx.get('SELECT * FROM maintenance_tasks WHERE task_id=?', identifier(b.task_id));
        if (!task) fail('Task not found.', 404);
        if (task.status !== 'Pending') fail('This task is already closed.', 409);
        if (path === '/api/task-assignment') {
          admin(user);
          const assignedStaff = await staff(tx, b.assigned_staff_id);
          await tx.run('UPDATE maintenance_tasks SET assigned_staff_id=? WHERE task_id=?', assignedStaff, task.task_id);
          return;
        }
        if (path === '/api/takeover') {
          if (user.role !== 'Staff' || !task.assigned_staff_id || task.assigned_staff_id === user.user_id) {
            fail('Take over a task assigned to another staff member.', 403);
          }
          if (task.scheduled_date > today()) fail('A future task cannot be completed yet.');
          await tx.run(
            "UPDATE maintenance_tasks SET substitute_staff_id=?,takeover_reason=?,status='Completed',is_flagged_for_admin=1,completed_at=? WHERE task_id=?",
            user.user_id,
            required(b.takeover_reason, 'Takeover reason'),
            new Date().toISOString(),
            task.task_id
          );
        } else {
          if (user.role !== 'Admin' && task.assigned_staff_id !== user.user_id) {
            fail('Only the assigned staff member can update this task.', 403);
          }
          if (path === '/api/complete') {
            if (task.scheduled_date > today()) fail('A future task cannot be completed yet.');
            await tx.run(
              "UPDATE maintenance_tasks SET status='Completed',completed_at=? WHERE task_id=?",
              new Date().toISOString(),
              task.task_id
            );
          } else {
            if (task.task_type !== 'Manual watering') fail('Weather adjustments apply to manual watering tasks.');
            const action = choice(b.action, ['Skip', 'Reschedule']);
            const reason = required(b.reason, 'Weather adjustment reason');
            const schedule = action === 'Reschedule' ? `${date(b.scheduled_date)} ${time(b.scheduled_time)}` : null;
            if (action === 'Skip' && task.scheduled_date > today()) fail('A future task cannot be skipped yet.');
            if (action === 'Reschedule' && b.scheduled_date < today()) fail('Reschedule for today or a future date.');
            await tx.run(
              'INSERT INTO task_adjustments(task_id,staff_id,reason,action,previous_schedule,new_schedule,created_at) VALUES(?,?,?,?,?,?,?)',
              task.task_id,
              user.user_id,
              reason,
              action,
              `${task.scheduled_date} ${task.scheduled_time}`,
              schedule,
              new Date().toISOString()
            );
            if (action === 'Skip') {
              await tx.run("UPDATE maintenance_tasks SET status='Skipped' WHERE task_id=?", task.task_id);
            } else {
              await tx.run(
                'UPDATE maintenance_tasks SET scheduled_date=?,scheduled_time=? WHERE task_id=?',
                b.scheduled_date,
                b.scheduled_time,
                task.task_id
              );
            }
          }
        }
      });
    } else if (path === '/api/review') {
      admin(user);
      const result = await baseDb.run(
        'UPDATE maintenance_tasks SET is_flagged_for_admin=0,reviewed_at=?,reviewed_by=? WHERE task_id=? AND is_flagged_for_admin=1',
        new Date().toISOString(),
        user.user_id,
        identifier(b.task_id)
      );
      if (!result.changes) fail('Flagged takeover not found.', 404);
    } else if (path === '/api/nutrients') {
      const p = await plot(baseDb, b.plot_id);
      const applied = date(b.application_date);
      if (applied > today()) fail('Application date cannot be in the future.');
      await baseDb.run(
        'INSERT INTO nutrient_logs(plot_id,staff_id,application_date,nutrient_type,product,notes) VALUES(?,?,?,?,?,?)',
        p.plot_id,
        user.user_id,
        applied,
        choice(b.nutrient_type, ['Fertilizer', 'Hydroponic nutrient']),
        required(b.product, 'Fertilizer or nutrient name', 120),
        String(b.notes || '').slice(0, 500)
      );
    } else if (path === '/api/users') {
      admin(user);
      const email = required(b.email, 'Email', 150).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email.');
      if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128) {
        fail('Password must contain 12–128 characters.');
      }
      await baseDb.run(
        'INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',
        required(b.full_name, 'Full name', 100),
        email,
        hashPassword(b.password),
        choice(b.role, ['Admin', 'Staff'])
      );
    } else if (path === '/api/user-status') {
      admin(user);
      if (identifier(b.user_id) === user.user_id) fail('You cannot deactivate your own account.');
      if (typeof b.active !== 'boolean') fail('Invalid account status.');
      const result = await baseDb.run(
        'UPDATE users SET active=? WHERE user_id=?',
        b.active ? 1 : 0,
        identifier(b.user_id)
      );
      if (!result.changes) fail('User not found.', 404);
      await baseDb.run('DELETE FROM sessions WHERE user_id=?', identifier(b.user_id));
    } else if (path === '/api/password') {
      const current = await baseDb.get('SELECT password_hash FROM users WHERE user_id=?', user.user_id);
      if (
        typeof b.current_password !== 'string' ||
        b.current_password.length > 128 ||
        !verifyPassword(b.current_password, current.password_hash)
      ) {
        fail('Current password is incorrect.');
      }
      if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128) {
        fail('Password must contain 12–128 characters.');
      }
      await transaction(async tx => {
        await tx.run('UPDATE users SET password_hash=? WHERE user_id=?', hashPassword(b.password), user.user_id);
        await tx.run('DELETE FROM sessions WHERE user_id=?', user.user_id);
      });
    } else {
      fail('Endpoint not found.', 404);
    }
    return { ok: true };
  }

  return async (req, res) => {
    const json = (data, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(data));
    };

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );

    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;

      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail('Method not allowed.', 405);
        const pages = [
          '/',
          '/index.html',
          '/admin-dashboard.html',
          '/staff-dashboard.html',
          '/plot-info.html',
          '/edit-plot.html',
          '/tasks.html',
          '/inventory.html',
          '/staff.html',
          '/archive.html',
          '/nutrients.html'
        ];
        const assets = {
          '/css/style.css': ['css/style.css', 'text/css'],
          '/js/script.js': ['js/script.js', 'text/javascript']
        };
        const asset = pages.includes(path) ? ['index.html', 'text/html'] : assets[path];
        if (!asset) fail('Page not found.', 404);
        res.writeHead(200, {
          'Content-Type': `${asset[1]}; charset=utf-8`,
          'Cache-Control': 'no-cache'
        });
        res.end(req.method === 'HEAD' ? '' : readFileSync(join(ROOT, asset[0])));
        return;
      }

      await seedDemo(dbPool, today());

      if (!['GET', 'POST'].includes(req.method)) fail('Method not allowed.', 405);
      const isSecure =
        secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        Boolean(process.env.VERCEL);

      let b = {};
      if (req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `${isSecure ? 'https' : 'http'}://${req.headers.host}`) {
          fail('Cross-origin request rejected.', 403);
        }
        if (!req.headers['content-type']?.startsWith('application/json')) fail('Send JSON content.', 415);
        if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
          b = req.body;
        } else {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 16384) fail('Request too large.', 413);
          }
          try {
            b = JSON.parse(raw);
          } catch {
            fail('Invalid JSON.');
          }
        }
        if (!b || typeof b !== 'object' || Array.isArray(b)) fail('Invalid request.');
      }

      const token = /(?:^|; )botaniq_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      const user = token
        ? await baseDb.get(
            'SELECT u.user_id,u.full_name,u.email,u.role FROM sessions s JOIN users u ON s.user_id=u.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',
            digest(token),
            Date.now()
          )
        : null;

      const cookie = value =>
        res.setHeader(
          'Set-Cookie',
          `botaniq_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? 28800 : 0}${
            isSecure ? '; Secure' : ''
          }`
        );

      if (path === '/api/login' && req.method === 'POST') {
        const key = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        for (const [ip, entry] of attempts) if (entry.until < Date.now()) attempts.delete(ip);
        const attempt = attempts.get(key) || { count: 0, until: Date.now() + 900000 };
        if (attempt.count >= 10) fail('Too many sign-in attempts. Try again in 15 minutes.', 429);
        attempt.count++;
        attempts.set(key, attempt);

        const email = required(b.email, 'Email', 150).toLowerCase();
        const password = b.password;
        if (typeof password !== 'string' || !password.length || password.length > 128) {
          fail('Enter a valid password.');
        }
        const account = await baseDb.get('SELECT * FROM users WHERE email=? AND active=1', email);
        if (!account || !verifyPassword(password, account.password_hash)) {
          fail('Email or password is incorrect.', 401);
        }
        attempts.delete(key);

        const value = randomBytes(32).toString('hex');
        await baseDb.run('DELETE FROM sessions WHERE expires_at<?', Date.now());
        if (token) await baseDb.run('DELETE FROM sessions WHERE token_hash=?', digest(token));
        await baseDb.run('INSERT INTO sessions VALUES(?,?,?)', digest(value), account.user_id, Date.now() + 28800000);
        cookie(value);
        json({ ok: true });
        return;
      }

      if (!user) fail('Please sign in to continue.', 401);

      if (path === '/api/logout' && req.method === 'POST') {
        await baseDb.run('DELETE FROM sessions WHERE token_hash=?', digest(token));
        cookie('');
        json({ ok: true });
        return;
      }

      if (req.method === 'GET' && path === '/api/state') {
        const isAdmin = user.role === 'Admin';
        const currentToday = today();
        const cutoff = shiftDays(currentToday, -42);

        const [plots, plants, users, cycles, archive, tasks, adjustments, nutrients] = await Promise.all([
          baseDb.all('SELECT * FROM plots ORDER BY plot_code'),
          baseDb.all('SELECT * FROM plants ORDER BY crop_name'),
          baseDb.all(`SELECT user_id,full_name,role,active${isAdmin ? ',email' : ''} FROM users ORDER BY full_name`),
          baseDb.all(
            'SELECT * FROM cycle_details WHERE harvest_date IS NULL OR harvest_date>=? ORDER BY planted_date DESC',
            cutoff
          ),
          isAdmin
            ? baseDb.all('SELECT * FROM cycle_details WHERE harvest_date<? ORDER BY harvest_date DESC', cutoff)
            : Promise.resolve([]),
          baseDb.all(
            'SELECT t.*,p.plot_code,p.zone,u.full_name AS assigned_staff,s.full_name AS substitute_staff FROM maintenance_tasks t JOIN plots p ON t.plot_id=p.plot_id LEFT JOIN users u ON t.assigned_staff_id=u.user_id LEFT JOIN users s ON t.substitute_staff_id=s.user_id ORDER BY scheduled_date,scheduled_time'
          ),
          baseDb.all(
            'SELECT a.*,u.full_name FROM task_adjustments a JOIN users u ON a.staff_id=u.user_id ORDER BY adjustment_id DESC'
          ),
          baseDb.all(
            'SELECT n.*,p.plot_code,u.full_name FROM nutrient_logs n JOIN plots p ON n.plot_id=p.plot_id JOIN users u ON n.staff_id=u.user_id ORDER BY application_date DESC,log_id DESC'
          )
        ]);

        json({
          user,
          today: currentToday,
          cutoff,
          plots,
          plants,
          users,
          cycles,
          archive,
          tasks,
          adjustments,
          nutrients
        });
        return;
      }

      if (req.method === 'POST') {
        json(await mutate(path, b, user));
        return;
      }
      fail('Endpoint not found.', 404);
    } catch (error) {
      if (error.code?.startsWith('23')) {
        json(
          {
            error:
              error.code === '23505'
                ? 'This record already exists or the plot is occupied.'
                : 'The record could not be saved. Check the selected values.'
          },
          409
        );
      } else {
        if (!error.status) console.error(error);
        json({ error: error.status ? error.message : 'An unexpected error occurred.' }, error.status || 500);
      }
    }
  };
}

export function createApp(dbPool, options = {}) {
  return http.createServer(createHandler(dbPool, options));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const dbPool = getPool();
  const password = await seedDemo(dbPool);
  if (password) {
    console.log(
      `Demo accounts created. Password: ${password}\nAdmin: admin@botaniq.local\nStaff: mika@botaniq.local, paolo@botaniq.local, sam@botaniq.local`
    );
  }
  const port = Number(process.env.PORT || 3000);
  const server = createApp(dbPool, { secure: process.env.COOKIE_SECURE === 'true' });
  server.listen(port, '127.0.0.1', () => console.log(`BotaniQ is ready at http://localhost:${port}`));
}