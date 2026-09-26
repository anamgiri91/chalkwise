import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, loadCases, mcnemar, rate, verifiers } from '../scripts/eval-grounding.mts';

const cases = loadCases();
const holdout = cases.filter((c) => c.split === 'holdout');

test('the labelled set is well formed and keeps a held-out split', () => {
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  assert.ok(cases.length >= 150);
  assert.ok(holdout.length >= 50);
  for (const c of cases) {
    assert.ok(c.claim.trim() && c.source.trim(), c.id);
    assert.ok(c.label === 'supported' || c.label === 'unsupported', c.id);
  }
});

// Floors sit a little under the measured held-out numbers (lexical 44.4% caught and
// 8.3% false removals; clause 94.4% and 4.2%). A change that drops below them changes
// what students are shown and must be measured, not waved through.
test('the production lexical check has not silently changed', () => {
  const m = evaluate(holdout, verifiers.lexical);
  assert.ok(m.catchRate.value >= 0.4, `catch rate ${m.catchRate.value}`);
  assert.ok(m.falseRemovalRate.value <= 0.1, `false removals ${m.falseRemovalRate.value}`);
});

test('the clause check stays well ahead of the lexical check on held-out claims', () => {
  const m = evaluate(holdout, verifiers.clause);
  assert.ok(m.catchRate.value >= 0.9, `catch rate ${m.catchRate.value}`);
  assert.ok(m.falseRemovalRate.value <= 0.1, `false removals ${m.falseRemovalRate.value}`);
  const paired = mcnemar(holdout, verifiers.lexical, verifiers.clause);
  assert.ok(paired.p < 0.01, `McNemar p ${paired.p}`);
});

test('bootstrap intervals are reproducible and contain the estimate', () => {
  const outcomes = [true, false, true, true, false, true, false, true];
  const a = rate(outcomes);
  assert.deepEqual(rate(outcomes), a);
  assert.ok(a.low <= a.value && a.value <= a.high);
  assert.equal(rate([]).n, 0);
});
