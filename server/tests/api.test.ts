import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import type { Repository } from '../src/repository.ts';
import { ApiError } from '../src/errors.ts';

const user = 'bd90d574-fd6c-4ce4-bf77-897162f7180d';
const headers = { authorization: 'Bearer test-token' };
async function setup(overrides: Partial<Repository> = {}, ping = async () => {}) {
  const repo = new Proxy(overrides, {
    get(target, key) {
      return (
        target[key as keyof Repository] ??
        (() => {
          throw new Error(`Unexpected repository call: ${String(key)}`);
        })
      );
    },
  }) as Repository;
  return buildApp({
    repo,
    ping,
    origins: ['https://chalkwise.example'],
    verify: async (token) => {
      if (token !== 'test-token') throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in again.');
      return user;
    },
    ai: {
      generate: async () => {
        throw new Error('AI must not run');
      },
    },
  });
}
test('all data routes reject missing credentials before touching data', async (t) => {
  const app = await setup();
  t.after(() => app.close());
  for (const url of [
    '/v1/me',
    '/v1/profile',
    '/v1/courses',
    '/v1/lectures?courseId=cs',
    '/v1/materials?lectureId=x',
    '/v1/friendships',
    '/v1/reviews',
  ]) {
    const response = await app.inject({ url });
    assert.equal(response.statusCode, 401, url);
  }
});
test('health checks are public and readiness fails closed', async (t) => {
  const app = await setup({}, async () => {
    throw new Error('postgres password=secret');
  });
  t.after(() => app.close());
  assert.equal((await app.inject('/health/live')).statusCode, 200);
  const response = await app.inject('/health/ready');
  assert.equal(response.statusCode, 503);
  assert.ok(!response.body.includes('secret'));
});
test('identity is derived only from authentication; profile injection is rejected', async (t) => {
  let called = false;
  const app = await setup({
    saveProfile: async () => {
      called = true;
      return null;
    },
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/profile',
    headers,
    payload: { id: 'victim', name: 'Sam', year: 'Senior', major: 'CS' },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});
test('validated requests use the verified identity and trimmed values', async (t) => {
  const app = await setup({
    createCourse: async (id, input) => {
      assert.equal(id, user);
      assert.equal(input.code, 'CS 101');
      return { id: 'cs-101', ...input };
    },
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: '/v1/courses',
    headers,
    payload: { code: ' CS 101 ', name: 'Intro', professor: '' },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, 'cs-101');
});
test('lecture saves require a caller-retained idempotency key', async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/v1/lectures', headers, payload: {} });
  assert.equal(response.statusCode, 400);
});
test('invalid confidence never reaches persistence', async (t) => {
  const app = await setup();
  t.after(() => app.close());
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: '/v1/lectures/x/review',
        headers,
        payload: { confidence: 'mastered' },
      })
    ).statusCode,
    400,
  );
});
test('ownership and attachment errors retain safe status codes', async (t) => {
  const app = await setup({
    setSharing: async () => {
      throw new ApiError(404, 'NOT_FOUND', 'This item is unavailable.');
    },
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/lectures/private/sharing',
    headers,
    payload: { shared: true },
  });
  assert.equal(response.statusCode, 404);
});
test('internal errors expose a correlation ID but no database details', async (t) => {
  const app = await setup({
    courses: async () => {
      throw new Error('postgres://admin:secret@db');
    },
  });
  t.after(() => app.close());
  const response = await app.inject({ url: '/v1/courses', headers });
  assert.equal(response.statusCode, 500);
  assert.ok(response.json().error.requestId);
  assert.ok(!response.body.includes('secret'));
});
test('CORS does not grant unknown origins access', async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const response = await app.inject({
    url: '/health/live',
    headers: { origin: 'https://evil.example' },
  });
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});
test('signed-photo responses cannot be cached', async (t) => {
  const app = await setup({ materialUrl: async () => ({ url: 'https://private.example/photo' }) });
  t.after(() => app.close());
  const response = await app.inject({ url: `/v1/materials/${user}/url`, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
});
