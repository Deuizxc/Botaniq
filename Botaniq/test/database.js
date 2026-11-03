import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync } from 'node:fs';

// Serialize a test connection for the same transaction ownership that pg.Pool provides.
export async function testDatabase() {
  const db = new PGlite({ extensions: { citext } });
  await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  let pending = Promise.resolve();
  const pool = {
    async connect() {
      const previous = pending;
      let release;
      pending = new Promise(resolve => { release = resolve; });
      await previous;
      return {
        async query(sql, args) {
          const result = args?.length ? await db.query(sql, args) : (await db.exec(sql)).at(-1);
          return { ...result, rows: result?.rows || [], rowCount: result?.affectedRows || 0 };
        },
        release
      };
    },
    async query(sql, args) {
      const client = await pool.connect();
      try { return await client.query(sql, args); } finally { client.release(); }
    },
    async get(sql) { return (await pool.query(sql)).rows[0]; },
    close: () => db.close()
  };
  return pool;
}
