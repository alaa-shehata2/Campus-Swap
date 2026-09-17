import { createMysqlPool } from './db/repositories';

const globalForDb = globalThis as unknown as { __campusPool?: ReturnType<typeof createMysqlPool> };

function pool() {
  if (!globalForDb.__campusPool) {
    const url = process.env['MYSQL_URL'];
    if (!url) throw new Error('MYSQL_URL is not set (see web/.env.example).');
    globalForDb.__campusPool = createMysqlPool(url);
  }
  return globalForDb.__campusPool;
}

export function db() {
  return pool();
}
