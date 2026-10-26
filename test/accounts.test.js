import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';

const accounts = [
  ['CUAI Admin', 'admin@gmail.com', 'Admin', 'admin@botaniq.local'],
  ['Heaven Ashley De Paz', 'heavenashley@gmail.com', 'Staff', 'mika@botaniq.local'],
  ['Brent Andrei Leur Furton', 'andreifurton@gmail.com', 'Staff', 'paolo@botaniq.local'],
  ['John Bernard Bacani', 'johntayag@gmail.com', 'Staff', 'sam@botaniq.local']
];

function checkAccount(values, expected) {
  const [name, email, hash, role] = values;
  assert.deepEqual([name, email, role], expected.slice(0, 3));
  const [salt, digest] = hash.split(':');
  assert.equal(scryptSync('123', salt, 64).toString('hex'), digest);
}

function fixture(count, query = () => ({ rows: [], rowCount: 1 })) {
  const calls = [];
  let releases = 0;
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT COUNT')) return { rows: [{ n: count }] };
      return query(sql, values);
    },
    release() { releases++; }
  };
  return { pool: { async connect() { return client; } }, calls, releases: () => releases };
}

test('fresh databases seed exactly the requested accounts with salted passwords', async () => {
  const { seedDemo } = await import('../backend.js?accounts=fresh');
  const { pool, calls, releases } = fixture(0);
  assert.equal(await seedDemo(pool, '2026-10-21'), '123');
  const inserts = calls.filter(c => c.sql.startsWith('INSERT INTO users'));
  assert.equal(inserts.length, 4);
  inserts.forEach((call, index) => checkAccount(call.values, accounts[index]));
  assert.equal(new Set(inserts.map(c => c.values[2])).size, 4);
  assert.equal(calls.at(-1).sql, 'COMMIT');
  assert.equal(releases(), 1);
});

test('existing accounts retain their IDs and revoke the replaced users sessions', async () => {
  const { seedDemo } = await import('../backend.js?accounts=existing');
  const { pool, calls, releases } = fixture(4, (sql, values) => ({
    rows: sql.startsWith('UPDATE users')
      ? [{ user_id: accounts.findIndex(a => a[3] === values[4]) + 1 }]
      : []
  }));
  assert.equal(await seedDemo(pool), null);
  const updates = calls.filter(c => c.sql.startsWith('UPDATE users'));
  assert.equal(updates.length, 4);
  updates.forEach((call, index) => {
    checkAccount(call.values, accounts[index]);
    assert.equal(call.values[4], accounts[index][3]);
    assert.match(call.sql, /WHERE email=\$5 RETURNING user_id$/);
    assert.doesNotMatch(call.sql, /SET user_id/);
  });
  assert.deepEqual(calls.filter(c => c.sql.startsWith('DELETE FROM sessions')).map(c => c.values), [[1], [2], [3], [4]]);
  assert.equal(calls.some(c => c.sql.startsWith('INSERT INTO users')), false);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls[1].sql, 'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  await seedDemo(pool);
  assert.equal(releases(), 1);
});

test('a later process only matches old emails and leaves current sessions alone', async () => {
  const { seedDemo } = await import('../backend.js?accounts=already-replaced');
  const { pool, calls } = fixture(4);
  await seedDemo(pool);
  for (const call of calls.filter(c => c.sql.startsWith('UPDATE users'))) {
    assert.match(call.sql, /WHERE email=\$5 RETURNING user_id$/);
    assert.ok(accounts.some(a => a[3] === call.values[4]));
  }
  assert.equal(calls.some(c => c.sql.startsWith('DELETE FROM sessions')), false);
});

test('a replacement failure rolls back and allows a retry', async () => {
  const { seedDemo } = await import('../backend.js?accounts=failure');
  const { pool, calls, releases } = fixture(4, sql => {
    if (sql.startsWith('UPDATE users')) throw new Error('Email conflict');
    return { rows: [] };
  });
  await assert.rejects(seedDemo(pool), /Email conflict/);
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
  assert.equal(calls.some(c => c.sql === 'COMMIT'), false);
  assert.equal(releases(), 1);
  const retry = fixture(4);
  await seedDemo(retry.pool);
  assert.equal(retry.calls.at(-1).sql, 'COMMIT');
});
