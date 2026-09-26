/**
 * Measure the transcript support check against the labelled set in
 * tests/fixtures/grounding-eval.jsonl.
 *
 *   node scripts/eval-grounding.mts                   # dev and holdout report
 *   node scripts/eval-grounding.mts --split holdout   # one split
 *   node scripts/eval-grounding.mts --sweep           # minContentTokenRatio sweep (dev only)
 *   node scripts/eval-grounding.mts --misses          # list every wrong decision
 *   node scripts/eval-grounding.mts --json            # machine-readable metrics
 *   node scripts/eval-grounding.mts --compare lexical,clause   # paired McNemar test
 *
 * "Removed" is the positive class: the check exists to remove claims a student should
 * not act on. Catch rate is the share of unsupported claims removed; false removal
 * rate is the share of supported claims removed. The set is adversarial by design, so
 * these are stress-test numbers, not estimates of production rates.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isSupported,
  isSupportedByClause,
  SUPPORT_THRESHOLDS,
  type SupportThresholds,
} from '../src/lib/grounding.ts';

export type Split = 'dev' | 'holdout';
export type Label = 'supported' | 'unsupported';
export type EvalCase = {
  id: string;
  transcript: string;
  source: string;
  split: Split;
  claim: string;
  label: Label;
  category: string;
};
/** Returns true when the claim should be kept. */
export type Verifier = (claim: string, source: string) => boolean;

export type Rate = { value: number; low: number; high: number; n: number };
export type Metrics = {
  cases: number;
  catchRate: Rate;
  falseRemovalRate: Rate;
  precision: number;
  accuracy: number;
  byCategory: Record<string, { label: Label; correct: number; total: number }>;
  misses: { id: string; claim: string; label: Label; category: string }[];
};

const datasetUrl = new URL('../tests/fixtures/grounding-eval.jsonl', import.meta.url);

export function loadCases(path: string | URL = datasetUrl): EvalCase[] {
  const transcripts = new Map<string, { text: string; split: Split }>();
  const rows: Omit<EvalCase, 'source' | 'split'>[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.type === 'transcript') transcripts.set(row.id, { text: row.text, split: row.split });
    if (row.type === 'case') rows.push(row);
  }
  return rows.map((row) => {
    const transcript = transcripts.get(row.transcript);
    if (!transcript) throw new Error(`Case ${row.id} names unknown transcript ${row.transcript}`);
    return { ...row, source: transcript.text, split: transcript.split };
  });
}

/** Small seeded generator so bootstrap intervals are reproducible run to run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Proportion with a 95% percentile bootstrap interval over the given outcomes. */
export function rate(outcomes: boolean[], iterations = 2000, seed = 7): Rate {
  const n = outcomes.length;
  if (n === 0) return { value: NaN, low: NaN, high: NaN, n };
  const hits = outcomes.filter(Boolean).length;
  const random = mulberry32(seed);
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) if (outcomes[Math.floor(random() * n)]) sum++;
    samples.push(sum / n);
  }
  samples.sort((a, b) => a - b);
  return {
    value: hits / n,
    low: samples[Math.floor(iterations * 0.025)],
    high: samples[Math.ceil(iterations * 0.975) - 1],
    n,
  };
}

export function evaluate(cases: EvalCase[], verifier: Verifier): Metrics {
  const decisions = cases.map((c) => ({ c, removed: !verifier(c.claim, c.source) }));
  const unsupported = decisions.filter((d) => d.c.label === 'unsupported');
  const supported = decisions.filter((d) => d.c.label === 'supported');
  const removed = decisions.filter((d) => d.removed);
  const correct = decisions.filter((d) => d.removed === (d.c.label === 'unsupported'));

  const byCategory: Metrics['byCategory'] = {};
  for (const { c, removed: wasRemoved } of decisions) {
    const entry = (byCategory[c.category] ??= { label: c.label, correct: 0, total: 0 });
    entry.total++;
    if (wasRemoved === (c.label === 'unsupported')) entry.correct++;
  }

  return {
    cases: cases.length,
    catchRate: rate(unsupported.map((d) => d.removed)),
    falseRemovalRate: rate(supported.map((d) => d.removed)),
    precision: removed.length
      ? removed.filter((d) => d.c.label === 'unsupported').length / removed.length
      : NaN,
    accuracy: correct.length / cases.length,
    byCategory,
    misses: decisions
      .filter((d) => d.removed !== (d.c.label === 'unsupported'))
      .map(({ c }) => ({ id: c.id, claim: c.claim, label: c.label, category: c.category })),
  };
}

/**
 * Exact two-sided McNemar test on paired decisions: of the cases the two verifiers
 * decide differently, is one right significantly more often than chance?
 */
export function mcnemar(cases: EvalCase[], a: Verifier, b: Verifier) {
  let onlyA = 0;
  let onlyB = 0;
  for (const c of cases) {
    const shouldKeep = c.label === 'supported';
    const aRight = a(c.claim, c.source) === shouldKeep;
    const bRight = b(c.claim, c.source) === shouldKeep;
    if (aRight && !bRight) onlyA++;
    if (bRight && !aRight) onlyB++;
  }
  const n = onlyA + onlyB;
  const k = Math.min(onlyA, onlyB);
  let tail = 0;
  let coefficient = 1;
  for (let i = 0; i <= k; i++) {
    if (i > 0) coefficient = (coefficient * (n - i + 1)) / i;
    tail += coefficient;
  }
  const p = n === 0 ? 1 : Math.min(1, (2 * tail) / 2 ** n);
  return { onlyA, onlyB, p };
}

export const verifiers: Record<string, Verifier> = {
  lexical: (claim, source) => isSupported(claim, source),
  clause: (claim, source) => isSupportedByClause(claim, source),
};

const pct = (value: number) => (Number.isNaN(value) ? '–' : `${(value * 100).toFixed(1)}%`);
const withInterval = (r: Rate) => `${pct(r.value)} [${pct(r.low)}, ${pct(r.high)}]`;

function report(name: string, split: string, m: Metrics): string {
  const lines = [
    `### ${name} · ${split} (${m.cases} cases)`,
    '',
    '| Metric | Value (95% bootstrap CI) |',
    '| --- | --- |',
    `| Catch rate (unsupported removed, n=${m.catchRate.n}) | ${withInterval(m.catchRate)} |`,
    `| False removal rate (supported removed, n=${m.falseRemovalRate.n}) | ${withInterval(m.falseRemovalRate)} |`,
    `| Precision of removals | ${pct(m.precision)} |`,
    `| Accuracy | ${pct(m.accuracy)} |`,
    '',
    '| Category | Expected | Correct |',
    '| --- | --- | --- |',
    ...Object.entries(m.byCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([category, e]) =>
          `| ${category} | ${e.label === 'unsupported' ? 'removed' : 'kept'} | ${e.correct}/${e.total} |`,
      ),
  ];
  return lines.join('\n');
}

function sweep(cases: EvalCase[]): string {
  const lines = [
    '| minContentTokenRatio | Catch rate | False removal rate |',
    '| --- | --- | --- |',
  ];
  for (let ratio = 0.3; ratio <= 1.0001; ratio += 0.1) {
    const thresholds: SupportThresholds = { ...SUPPORT_THRESHOLDS, minContentTokenRatio: ratio };
    const m = evaluate(cases, (claim, source) => isSupported(claim, source, thresholds));
    const marker =
      Math.abs(ratio - SUPPORT_THRESHOLDS.minContentTokenRatio) < 1e-9 ? ' (current)' : '';
    lines.push(
      `| ${ratio.toFixed(1)}${marker} | ${pct(m.catchRate.value)} | ${pct(m.falseRemovalRate.value)} |`,
    );
  }
  return lines.join('\n');
}

function main(argv: string[]) {
  const all = loadCases();
  const flag = (name: string) => argv.includes(name);
  const option = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const requested = option('--split');
  const splits: Split[] = requested ? [requested as Split] : ['dev', 'holdout'];
  const names = option('--verifier')?.split(',') ?? Object.keys(verifiers);

  const compare = option('--compare');
  if (compare) {
    const [a, b] = compare.split(',');
    if (!verifiers[a] || !verifiers[b]) throw new Error(`Unknown verifier in ${compare}`);
    console.log(`| Split | Only ${a} right | Only ${b} right | McNemar exact p |`);
    console.log('| --- | --- | --- | --- |');
    for (const split of splits) {
      const r = mcnemar(
        all.filter((c) => c.split === split),
        verifiers[a],
        verifiers[b],
      );
      console.log(`| ${split} | ${r.onlyA} | ${r.onlyB} | ${r.p.toExponential(1)} |`);
    }
    return;
  }

  if (flag('--sweep')) {
    // Tuning happens on dev only; the holdout split is for the final number.
    console.log(sweep(all.filter((c) => c.split === 'dev')));
    return;
  }

  const results: Record<string, Record<string, Metrics>> = {};
  for (const name of names) {
    const verifier = verifiers[name];
    if (!verifier) throw new Error(`Unknown verifier ${name}`);
    results[name] = {};
    for (const split of splits) {
      results[name][split] = evaluate(
        all.filter((c) => c.split === split),
        verifier,
      );
    }
  }

  if (flag('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const [name, bySplit] of Object.entries(results)) {
    for (const [split, m] of Object.entries(bySplit)) {
      console.log(report(name, split, m), '\n');
      if (flag('--misses')) {
        for (const miss of m.misses) {
          console.log(`- ${miss.id} [${miss.category}, ${miss.label}] ${miss.claim}`);
        }
        console.log();
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
