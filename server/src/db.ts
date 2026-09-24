import pg from 'pg';
import type { PoolClient } from 'pg';
import type { Config } from './config.ts';

export type Database = {
  asUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
};

export async function openDatabase(config: Config): Promise<Database> {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.ssl,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    application_name: 'chalkwise-api',
  });
  // Idle connections can fail during an RDS restart. pg removes the failed
  // connection, but an unhandled pool 'error' event would terminate the API.
  pool.on('error', () => {
    console.error(JSON.stringify({ level: 'error', event: 'database_idle_connection_failed' }));
  });
  // RLS is ineffective for superusers, BYPASSRLS roles and table owners.
  try {
    const result = await pool.query(`SELECT r.rolsuper OR r.rolbypassrls OR EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='chalkwise' AND pg_has_role(current_user,c.relowner,'MEMBER')
    ) AS unsafe FROM pg_roles r WHERE r.rolname=current_user`);
    if (result.rows[0]?.unsafe)
      throw new Error('API must use a non-owner database role without BYPASSRLS.');
    await pool.query('SELECT 1 FROM chalkwise.courses LIMIT 0');
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    async asUser(userId, work) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        // Transaction-local context cannot leak to the next pooled request.
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Never reuse a connection with uncertain transaction/user context.
          discard = true;
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}
