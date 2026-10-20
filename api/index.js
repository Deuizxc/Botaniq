import { createHandler, getPool } from '../backend.js';

const handler = createHandler(getPool(), { secure: true });
export default handler;