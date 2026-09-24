import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { openDatabase } from '../src/db.ts';
import { readConfig } from '../src/config.ts';
import type { Repository } from '../src/repository.ts';

test('a response taking longer than ten seconds survives the real HTTP socket', async (t) => {
  const app = await buildApp({
    repo: {} as Repository,
    verify: async () => {
      throw new Error('unused');
    },
    ai: {
      generate: async () => {
        throw new Error('unused');
      },
    },
    origins: [],
    ping: async () => {
      await setTimeout(10_200);
    },
  });
  t.after(() => app.close());
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const response = await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('database disconnects discard uncertain transactions and retain the original error', async (t) => {
  const workError = new Error('original work failed');
  let discard: boolean | undefined;
  let rollbackFails = true;
  const client = {
    async query(sql: string) {
      if (sql === 'ROLLBACK' && rollbackFails) throw new Error('connection lost');
      return { rows: [] };
    },
    release(value: boolean) {
      discard = value;
    },
  };
  let pool: EventEmitter;
  class FakePool extends EventEmitter {
    constructor() {
      super();
      pool = this;
    }
    async query() {
      return { rows: [{ unsafe: false }] };
    }
    async connect() {
      return client;
    }
    async end() {}
  }
  t.mock.method(pg, 'Pool', function () {
    return new FakePool();
  });
  const db = await openDatabase(
    readConfig({
      DATABASE_URL: 'postgres://runtime@localhost/chalkwise_test',
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_test',
      COGNITO_CLIENT_ID: 'test',
      S3_BUCKET: 'test-bucket',
    }),
  );
  t.after(() => db.close());
  await assert.rejects(
    db.asUser('user', async () => {
      throw workError;
    }),
    (e) => e === workError,
  );
  assert.equal(discard, true);
  rollbackFails = false;
  assert.equal(await db.asUser('another-user', async () => 'recovered'), 'recovered');
  assert.equal(discard, false);
  const logs = t.mock.method(console, 'error', () => {});
  assert.doesNotThrow(() => pool.emit('error', new Error('secret database details')));
  assert.equal(logs.mock.callCount(), 1);
  assert.ok(!String(logs.mock.calls[0].arguments).includes('secret database details'));
});
