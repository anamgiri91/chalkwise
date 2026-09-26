import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MEMORY_PARAMS,
  intervalDays,
  nextStability,
  predictRecall,
  retrievability,
} from '../src/features/study/memoryModel.ts';
import {
  buildHistories,
  compare,
  logLoss,
  parseCsv,
  SIMULATED_TRUTH,
  simulate,
} from '../scripts/fit-schedule.mts';

test('stability is the time at which predicted recall falls to 90%', () => {
  assert.equal(retrievability(0, 3), 1);
  assert.ok(Math.abs(retrievability(3, 3) - 0.9) < 1e-12);
  assert.ok(Math.abs(intervalDays(3, 0.9) - 3) < 1e-9);
  assert.ok(intervalDays(3, 0.8) > intervalDays(3, 0.9));
  assert.throws(() => intervalDays(3, 1));
});

test('forgetting shrinks stability; recall grows it, and easy grows it more', () => {
  const p = DEFAULT_MEMORY_PARAMS;
  const s = 2;
  const r = retrievability(2, s);
  assert.ok(nextStability(s, r, 'again', p) < s);
  assert.ok(nextStability(s, r, 'good', p) > s);
  assert.ok(nextStability(s, r, 'easy', p) > nextStability(s, r, 'good', p));
  // A harder successful recall (lower R) strengthens memory more.
  assert.ok(nextStability(s, 0.6, 'good', p) > nextStability(s, 0.95, 'good', p));
});

test('predictions are made before each review and stay probabilities', () => {
  const recall = predictRecall(
    [
      { elapsedDays: 1, confidence: 'again' },
      { elapsedDays: 0.2, confidence: 'good' },
      { elapsedDays: 30, confidence: 'good' },
    ],
    DEFAULT_MEMORY_PARAMS,
  );
  assert.equal(recall.length, 3);
  for (const r of recall) assert.ok(r > 0 && r <= 1);
  assert.ok(recall[2] < recall[1], 'a month-long gap predicts lower recall');
});

test('exports become ordered per-notebook histories timed from capture', () => {
  const rows = parseCsv(
    [
      'student,notebook,captured_at,reviewed_at,confidence',
      'a,n1,2026-09-01T00:00:00Z,2026-09-03T00:00:00Z,good',
      'a,n1,2026-09-01T00:00:00Z,2026-09-02T00:00:00Z,again',
    ].join('\n'),
  );
  const [history] = buildHistories(rows);
  assert.deepEqual(history.steps, [
    { elapsedDays: 1, confidence: 'again' },
    { elapsedDays: 1, confidence: 'good' },
  ]);
  assert.throws(() => parseCsv('student,notebook\na,b'), /captured_at/);
});

test('on simulated students the fitted model beats baselines and nears the truth', () => {
  const { results } = compare(simulate(40, 5, 5, 3), SIMULATED_TRUTH);
  const fitted = results['memory model, fitted'].logLoss;
  assert.ok(fitted < results['constant (training recall rate)'].logLoss);
  assert.ok(fitted < results['logistic (log elapsed, review number)'].logLoss);
  assert.ok(fitted - results['memory model, true parameters'].logLoss < 0.02);
});

test('log-loss rewards confident correct predictions and stays finite', () => {
  assert.ok(logLoss([0.9, 0.1], [1, 0]) < logLoss([0.5, 0.5], [1, 0]));
  assert.ok(Number.isFinite(logLoss([1, 0], [0, 1])));
});
