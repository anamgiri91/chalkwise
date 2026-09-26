import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import type { Repository } from '../src/repository.ts';
import { ApiError } from '../src/errors.ts';

const user = 'bd90d574-fd6c-4ce4-bf77-897162f7180d';
const headers = { authorization: 'Bearer test-token' };
async function setup(overrides: Partial<Repository>) {
  const repo = new Proxy(overrides, {
    get: (target, key) =>
      target[key as keyof Repository] ??
      (() => {
        throw new Error(`Unexpected repository call: ${String(key)}`);
      }),
  }) as Repository;
  return buildApp({
    repo,
    ping: async () => {},
    origins: [],
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
const notes = {
  title: 'Trees',
  summary: 'S',
  keyConcepts: ['BST', 'AVL'],
  importantPoints: [],
  assignments: [],
  examMentions: [],
};
const question = { question: 'Q?', options: ['a', 'b'], correctAnswer: 'a', explanation: 'E' };

test('new study routes require sign-in', async (t) => {
  const app = await setup({});
  t.after(() => app.close());
  for (const [method, url] of [
    ['PUT', '/v1/lectures/l1'],
    ['GET', '/v1/meetings'],
    ['PUT', '/v1/courses/cs/meetings'],
    ['GET', '/v1/lectures/l1/quiz-attempts'],
    ['POST', '/v1/lectures/l1/quiz-attempts'],
  ] as const) {
    assert.equal((await app.inject({ method, url })).statusCode, 401, `${method} ${url}`);
  }
});

test('note edits are validated and sources must line up with their lines', async (t) => {
  const saved: unknown[] = [];
  const app = await setup({
    editLecture: async (who, id, input) => {
      saved.push({ who, id, input });
      return { id, ...input };
    },
  });
  t.after(() => app.close());
  const ok = await app.inject({
    method: 'PUT',
    url: '/v1/lectures/l1',
    headers,
    payload: { ...notes, sources: { keyConcepts: [1, null] } },
  });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(saved, [
    { who: user, id: 'l1', input: { ...notes, sources: { keyConcepts: [1, null] } } },
  ]);
  for (const payload of [
    { ...notes, sources: { keyConcepts: [1] } },
    { ...notes, sources: { keyConcepts: [7, 1] } },
    { ...notes, title: '' },
    { ...notes, courseId: 'moved' },
  ]) {
    const bad = await app.inject({ method: 'PUT', url: '/v1/lectures/l1', headers, payload });
    assert.equal(bad.statusCode, 400, JSON.stringify(payload));
  }
  assert.equal(saved.length, 1);
});

test('class times are validated before they are saved', async (t) => {
  let calls = 0;
  const app = await setup({
    setMeetings: async (_who, courseId, input) => {
      calls++;
      return input.meetings.map((m) => ({ courseId, ...m }));
    },
  });
  t.after(() => app.close());
  const ok = await app.inject({
    method: 'PUT',
    url: '/v1/courses/cs-3358/meetings',
    headers,
    payload: { meetings: [{ weekday: 2, start: '09:30', end: '10:50' }] },
  });
  assert.equal(ok.statusCode, 200);
  for (const meetings of [
    [{ weekday: 7, start: '09:30', end: '10:50' }],
    [{ weekday: 2, start: '9:30', end: '10:50' }],
    [{ weekday: 2, start: '11:00', end: '10:50' }],
  ]) {
    const bad = await app.inject({
      method: 'PUT',
      url: '/v1/courses/cs-3358/meetings',
      headers,
      payload: { meetings },
    });
    assert.equal(bad.statusCode, 400, JSON.stringify(meetings));
  }
  assert.equal(calls, 1);
});

test('a quiz attempt must agree with its own score', async (t) => {
  let saved: unknown = null;
  const app = await setup({
    recordQuizAttempt: async (_who, lectureId, input) => {
      saved = input;
      return { id: 'a1', lectureId, attemptedAt: 'now', ...input };
    },
  });
  t.after(() => app.close());
  const ok = await app.inject({
    method: 'POST',
    url: '/v1/lectures/l1/quiz-attempts',
    headers,
    payload: { score: 4, total: 5, missed: [question] },
  });
  assert.equal(ok.statusCode, 201);
  assert.deepEqual(saved, { score: 4, total: 5, missed: [question] });
  for (const payload of [
    { score: 6, total: 5, missed: [] },
    { score: 4, total: 5, missed: [] },
    { score: 5, total: 5, missed: [], extra: true },
  ]) {
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/lectures/l1/quiz-attempts',
      headers,
      payload,
    });
    assert.equal(bad.statusCode, 400, JSON.stringify(payload));
  }
});
