import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSession, PIPELINE_BUDGET_MS } from '../src/analysis.ts';
import type { Ai, AiKind } from '../src/ai.ts';
import type { Photo } from '../src/storage.ts';
import { ApiError } from '../src/errors.ts';
import { buildApp } from '../src/app.ts';
import type { Repository } from '../src/repository.ts';
import { randomUUID } from 'node:crypto';

type Call = { kind: AiKind; context: unknown; photos: Photo[]; timeoutMs?: number };
const photo = (n: number): Photo => ({ bytes: new Uint8Array([n]), mimeType: 'image/png' });

const transcribed = (text: string, over: Record<string, unknown> = {}) => ({
  text,
  readability: 'good',
  unclear: [],
  courseLabel: null,
  ...over,
});
const organized = (over: Record<string, unknown> = {}) => ({
  title: 'Binary trees',
  topic: 'Data structures',
  summary: 'Traversal order and balance.',
  keyConcepts: ['Binary tree'],
  importantPoints: [],
  assignments: [],
  examMentions: [],
  ...over,
});

/** A provider stand-in that records every step the orchestrator runs. */
function scripted(script: {
  extract: (photoNumber: number) => unknown;
  organize?: (context: unknown) => unknown;
  clock?: { advance: number };
}) {
  const calls: Call[] = [];
  let time = 0;
  const ai: Ai = {
    async generate(kind, context, photos, timeoutMs) {
      calls.push({ kind, context, photos, timeoutMs });
      if (kind === 'extract') {
        if (script.clock) time += script.clock.advance;
        const value = script.extract(photos[0].bytes[0]);
        if (value instanceof Error) throw value;
        return value;
      }
      if (kind === 'organize') return script.organize ? script.organize(context) : organized();
      throw new Error(`Unexpected step: ${kind}`);
    },
  };
  return { ai, calls, now: () => time };
}

test('every photo is transcribed and the organizer works from text alone', async () => {
  const { ai, calls } = scripted({
    extract: (n) => transcribed(`Photo ${n} board contents.`),
  });
  const result = await analyzeSession(ai, [photo(1), photo(2), photo(3)]);

  assert.equal(calls.filter((call) => call.kind === 'extract').length, 3);
  const organize = calls.find((call) => call.kind === 'organize');
  // The organizer cannot see the originals, which is what makes support checking sound.
  assert.deepEqual(organize?.photos, []);
  assert.match(JSON.stringify(organize?.context), /Photo 2 board contents/);
  assert.equal(result.analysis.title, 'Binary trees');
  assert.deepEqual(result.unreadablePhotos, []);
});

test('an invented assignment or exam date never reaches a notebook', async () => {
  const { ai } = scripted({
    extract: () => transcribed('Problem set 3 is due Friday. Midterm covers chapters 1 and 2.'),
    organize: () =>
      organized({
        assignments: ['Problem set 3 is due Friday', 'Essay due October 14'],
        examMentions: ['Midterm covers chapters 1 and 2', 'Final exam December 5'],
      }),
  });
  const result = await analyzeSession(ai, [photo(1)]);

  assert.deepEqual(result.analysis.assignments, ['Problem set 3 is due Friday']);
  assert.deepEqual(result.analysis.examMentions, ['Midterm covers chapters 1 and 2']);
  assert.equal(result.removedClaims, 2);
});

test('one unreadable photo costs that photo, not the whole session', async () => {
  const { ai } = scripted({
    extract: (n) =>
      n === 1
        ? new ApiError(422, 'AI_INCOMPLETE', 'Too blurry.')
        : n === 2
          ? transcribed('', { readability: 'unreadable' })
          : transcribed('Depth-first traversal.'),
  });
  const result = await analyzeSession(ai, [photo(1), photo(2), photo(3)]);

  assert.deepEqual(result.unreadablePhotos, [1, 2]);
  assert.equal(result.analysis.title, 'Binary trees');
});

test('when no photo can be read the failure surfaces instead of empty notes', async () => {
  const { ai, calls } = scripted({
    extract: () => new ApiError(503, 'AI_UNAVAILABLE', 'Study AI is not configured yet.'),
  });
  await assert.rejects(analyzeSession(ai, [photo(1), photo(2)]), { code: 'AI_UNAVAILABLE' });
  assert.equal(
    calls.some((call) => call.kind === 'organize'),
    false,
    'Organizing must not run without a transcript',
  );

  const unreadable = scripted({ extract: () => transcribed('', { readability: 'unreadable' }) });
  await assert.rejects(analyzeSession(unreadable.ai, [photo(1)]), { code: 'AI_UNREADABLE' });
});

test('the course label comes from the photos, and a tie keeps the earliest', async () => {
  const labels = ['CS 3358', 'MATH 2358', 'CS 3358'];
  const { ai } = scripted({
    extract: (n) => transcribed('Board contents.', { courseLabel: labels[n - 1] }),
  });
  assert.equal(
    (await analyzeSession(ai, [photo(1), photo(2), photo(3)])).analysis.suggestedCourse,
    'CS 3358',
  );

  const tie = scripted({
    extract: (n) =>
      transcribed('Board contents.', { courseLabel: n === 1 ? 'CS 3358' : 'PHYS 1430' }),
  });
  assert.equal(
    (await analyzeSession(tie.ai, [photo(1), photo(2)])).analysis.suggestedCourse,
    'CS 3358',
  );
});

test('a run that overruns its budget stops instead of exceeding the request timeout', async () => {
  const slow = scripted({
    extract: () => transcribed('Board contents.'),
    clock: { advance: PIPELINE_BUDGET_MS },
  });
  await assert.rejects(analyzeSession(slow.ai, [photo(1)], slow.now), { statusCode: 503 });
  assert.equal(
    slow.calls.some((call) => call.kind === 'organize'),
    false,
  );

  const timely = scripted({ extract: () => transcribed('Board contents.') });
  await analyzeSession(timely.ai, [photo(1)], timely.now);
  for (const call of timely.calls) {
    assert.ok(call.timeoutMs && call.timeoutMs > 0 && call.timeoutMs <= PIPELINE_BUDGET_MS);
  }
});

test('analysis requires at least one photo', async () => {
  const { ai } = scripted({ extract: () => transcribed('Unused.') });
  await assert.rejects(analyzeSession(ai, []), { code: 'NO_PHOTOS' });
});

test('the analyze route takes a whole session and still accepts the older body', async (t) => {
  const user = 'bd90d574-fd6c-4ce4-bf77-897162f7180d';
  const requested: string[][] = [];
  const repo = new Proxy(
    {
      capturePhotos: async (_user: string, ids: string[]) => {
        requested.push(ids);
        return ids.map((_id, index) => photo(index + 1));
      },
    },
    {
      get(target, key) {
        return (
          target[key as 'capturePhotos'] ??
          (() => {
            throw new Error(`Unexpected repository call: ${String(key)}`);
          })
        );
      },
    },
  ) as unknown as Repository;
  const app = await buildApp({
    repo,
    ping: async () => {},
    origins: ['https://chalkwise.example'],
    verify: async () => user,
    ai: scripted({ extract: () => transcribed('Board contents.') }).ai,
  });
  t.after(() => app.close());

  const headers = { authorization: 'Bearer token' };
  const status = async (payload: Record<string, unknown>) =>
    (await app.inject({ method: 'POST', url: '/v1/ai/analyze', headers, payload })).statusCode;
  const ids = [randomUUID(), randomUUID()];

  assert.equal(await status({ materialIds: ids }), 200);
  assert.deepEqual(requested.at(-1), ids, 'Capture order reaches the repository unchanged');

  assert.equal(await status({ materialId: ids[0] }), 200);
  assert.deepEqual(requested.at(-1), [ids[0]], 'The older single-photo body still works');

  // A session cannot exceed the photo ceiling, repeat a photo, or omit one.
  assert.equal(await status({ materialIds: Array.from({ length: 7 }, () => randomUUID()) }), 400);
  assert.equal(await status({ materialIds: [ids[0], ids[0]] }), 400);
  assert.equal(await status({ materialIds: [] }), 400);
  assert.equal(await status({}), 400);
});
