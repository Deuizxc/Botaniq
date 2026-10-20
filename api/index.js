import { createHandler, getPool } from '../server.js';

const handler = createHandler(getPool(), { secure: true });
export default handler;