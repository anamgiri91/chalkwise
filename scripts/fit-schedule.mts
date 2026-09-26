/**
 * Fit the memory model in src/features/study/memoryModel.ts to review history and
 * compare how well it predicts recall against simple baselines.
 *
 *   node scripts/fit-schedule.mts --synthetic         # validate on simulated students
 *   node scripts/fit-schedule.mts review-events.csv   # an export from
 *                                                     # server/infra/export-review-events.sql
 *
 * Students are split 80/20 by a hash of their pseudonymous ID, so the test score says
 * how well a model fitted on some students predicts others. The outcome is reported
 * recall: "again" is a miss, "good" and "easy" are hits. Lower log-loss is better.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MEMORY_PARAMS,
  intervalDays,
  predictRecall,
  stabilityAfter,
  type MemoryParams,
  type ReviewStep,
} from '../src/features/study/memoryModel.ts';
import type { ReviewConfidence } from '../src/types/study.ts';

const DAY_MS = 86_400_000;

export type History = { student: string; steps: ReviewStep[] };
export type Row = {
  student: string;
  notebook: string;
  capturedAt: string;
  reviewedAt: string;
  confidence: ReviewConfidence;
};

export function parseCsv(text: string): Row[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(',');
  const index = (name: string) => {
    const i = columns.indexOf(name);
    if (i < 0) throw new Error(`Export is missing the ${name} column`);
    return i;
  };
  const [s, n, c, r, k] = ['student', 'notebook', 'captured_at', 'reviewed_at', 'confidence'].map(
    index,
  );
  return lines.map((line) => {
    const cells = line.split(',');
    const confidence = cells[k] as ReviewConfidence;
    if (!['again', 'good', 'easy'].includes(confidence))
      throw new Error(`Unknown confidence ${confidence}`);
    return {
      student: cells[s],
      notebook: cells[n],
      capturedAt: cells[c],
      reviewedAt: cells[r],
      confidence,
    };
  });
}

/** One ordered history per notebook; elapsed time runs from capture, then each review. */
export function buildHistories(rows: Row[]): History[] {
  const byNotebook = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byNotebook.get(row.notebook) ?? [];
    list.push(row);
    byNotebook.set(row.notebook, list);
  }
  return [...byNotebook.values()].map((list) => {
    list.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
    let previous = Date.parse(list[0].capturedAt);
    const steps = list.map((row) => {
      const at = Date.parse(row.reviewedAt);
      const step = { elapsedDays: Math.max(at - previous, 0) / DAY_MS, confidence: row.confidence };
      previous = at;
      return step;
    });
    return { student: list[0].student, steps };
  });
}

function fnv(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function splitByStudent(histories: History[]) {
  const test = (h: History) => fnv(h.student) % 5 === 0;
  return { train: histories.filter((h) => !test(h)), test: histories.filter(test) };
}

const recalled = (step: ReviewStep): number => (step.confidence === 'again' ? 0 : 1);

export function logLoss(predictions: number[], outcomes: number[]): number {
  let sum = 0;
  predictions.forEach((p, i) => {
    const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
    sum -= outcomes[i] ? Math.log(q) : Math.log(1 - q);
  });
  return sum / predictions.length;
}

export function brier(predictions: number[], outcomes: number[]): number {
  return predictions.reduce((s, p, i) => s + (p - outcomes[i]) ** 2, 0) / predictions.length;
}

type Predictor = (history: History) => number[];

function score(histories: History[], predict: Predictor) {
  const predictions = histories.flatMap(predict);
  const outcomes = histories.flatMap((h) => h.steps.map(recalled));
  return {
    logLoss: logLoss(predictions, outcomes),
    brier: brier(predictions, outcomes),
    n: outcomes.length,
  };
}

/** Keep parameters where the model's formulas make sense. */
function bounded(p: number[]): MemoryParams {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return [
    clamp(p[0], 0.01, 100),
    clamp(p[1], 0.01, 1),
    clamp(p[2], 0.1, 1.5),
    clamp(p[3], -5, 5),
    clamp(p[4], 0, 1),
    clamp(p[5], 0.01, 5),
    clamp(p[6], 1, 5),
  ];
}

/** Derivative-free minimisation; the model has seven parameters and no gradients. */
export function nelderMead(f: (x: number[]) => number, start: number[], iterations = 1500) {
  const n = start.length;
  let simplex = [start, ...start.map((_, i) => start.map((v, j) => (i === j ? v * 1.2 + 0.1 : v)))];
  let values = simplex.map(f);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    const centroid = start.map((_, j) => simplex.slice(0, n).reduce((s, x) => s + x[j], 0) / n);
    const toward = (t: number) => centroid.map((c, j) => c + t * (simplex[n][j] - c));
    const reflected = toward(-1);
    const fr = f(reflected);
    if (fr < values[0]) {
      const expanded = toward(-2);
      const fe = f(expanded);
      [simplex[n], values[n]] = fe < fr ? [expanded, fe] : [reflected, fr];
    } else if (fr < values[n - 1]) {
      [simplex[n], values[n]] = [reflected, fr];
    } else {
      const contracted = toward(0.5);
      const fc = f(contracted);
      if (fc < values[n]) {
        [simplex[n], values[n]] = [contracted, fc];
      } else {
        simplex = simplex.map((x) => x.map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])));
        values = simplex.map(f);
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], value: values[best] };
}

export function fitMemoryModel(train: History[]): MemoryParams {
  const outcomes = train.flatMap((h) => h.steps.map(recalled));
  const objective = (x: number[]) => {
    const p = bounded(x);
    return logLoss(
      train.flatMap((h) => predictRecall(h.steps, p)),
      outcomes,
    );
  };
  return bounded(nelderMead(objective, [...DEFAULT_MEMORY_PARAMS]).x);
}

/** Logistic regression on log elapsed time and review number, fitted by gradient descent. */
export function fitLogistic(train: History[]): Predictor {
  const features = (h: History) =>
    h.steps.map((s, i) => [1, Math.log1p(s.elapsedDays * 24), Math.log(i + 1)]);
  const x = train.flatMap(features);
  const y = train.flatMap((h) => h.steps.map(recalled));
  const w = [0, 0, 0];
  for (let it = 0; it < 3000; it++) {
    const grad = [0, 0, 0];
    x.forEach((row, i) => {
      const p = 1 / (1 + Math.exp(-row.reduce((s, v, j) => s + v * w[j], 0)));
      row.forEach((v, j) => (grad[j] += (p - y[i]) * v));
    });
    w.forEach((_, j) => (w[j] -= (0.5 * grad[j]) / x.length));
  }
  return (h) =>
    features(h).map((row) => 1 / (1 + Math.exp(-row.reduce((s, v, j) => s + v * w[j], 0))));
}

/** Seeded generator so synthetic runs are reproducible. */
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

/** Parameters the simulator uses as ground truth; the fit never sees them. */
export const SIMULATED_TRUTH: MemoryParams = [0.6, 0.25, 0.9, 1.6, 0.25, 1.8, 1.8];

/**
 * Simulated students reviewing on the live fixed schedule (4 h, 1 day, 3 days) with
 * random lateness, whose recall follows SIMULATED_TRUTH scaled by a per-student ability.
 * The per-student spread is something the fitted model cannot represent, so the fit is
 * tested under mild misspecification rather than on its own assumptions.
 */
export function simulate(students = 80, notebooks = 6, reviews = 6, seed = 11): Row[] {
  const random = mulberry32(seed);
  const normal = () =>
    Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  const fixedHours = { again: 4, good: 24, easy: 72 };
  const rows: Row[] = [];
  const start = Date.parse('2026-09-01T00:00:00Z');
  for (let s = 0; s < students; s++) {
    const student = `s${s}`;
    const ability = Math.exp(0.3 * normal());
    for (let n = 0; n < notebooks; n++) {
      const notebook = `${student}-n${n}`;
      const capturedAt = start + n * 3 * DAY_MS + random() * DAY_MS;
      const truth: MemoryParams = [
        SIMULATED_TRUTH[0] * ability,
        ...SIMULATED_TRUTH.slice(1),
      ] as unknown as MemoryParams;
      const steps: ReviewStep[] = [];
      let at = capturedAt + (6 + random() * 42) * 3_600_000;
      for (let r = 0; r < reviews; r++) {
        const elapsed =
          (at - (r === 0 ? capturedAt : Date.parse(rows[rows.length - 1].reviewedAt))) / DAY_MS;
        const recall = predictRecall(
          [...steps, { elapsedDays: elapsed, confidence: 'good' }],
          truth,
        )[r];
        const confidence: ReviewConfidence =
          random() >= recall ? 'again' : recall > 0.93 && random() < 0.6 ? 'easy' : 'good';
        steps.push({ elapsedDays: elapsed, confidence });
        rows.push({
          student,
          notebook,
          capturedAt: new Date(capturedAt).toISOString(),
          reviewedAt: new Date(at).toISOString(),
          confidence,
        });
        const lateness = Math.exp(0.8 * Math.abs(normal()));
        at += fixedHours[confidence] * 3_600_000 * lateness;
      }
    }
  }
  return rows;
}

export function compare(rows: Row[], truth?: MemoryParams) {
  const histories = buildHistories(rows);
  const { train, test } = splitByStudent(histories);
  if (!train.length || !test.length)
    throw new Error('Too few students to hold any out; the split needs both sets non-empty.');
  const mean =
    train.flatMap((h) => h.steps.map(recalled)).reduce((a, b) => a + b, 0) /
    train.reduce((n, h) => n + h.steps.length, 0);
  const fitted = fitMemoryModel(train);
  const logistic = fitLogistic(train);
  const results: Record<string, ReturnType<typeof score>> = {
    'constant (training recall rate)': score(test, (h) => h.steps.map(() => mean)),
    'logistic (log elapsed, review number)': score(test, logistic),
    'memory model, unfitted defaults': score(test, (h) =>
      predictRecall(h.steps, DEFAULT_MEMORY_PARAMS),
    ),
    'memory model, fitted': score(test, (h) => predictRecall(h.steps, fitted)),
  };
  if (truth)
    results['memory model, true parameters'] = score(test, (h) => predictRecall(h.steps, truth));
  return { fitted, results, train: train.length, test: test.length };
}

function main(argv: string[]) {
  const synthetic = argv.includes('--synthetic');
  const file = argv.find((a) => !a.startsWith('--'));
  if (!synthetic && !file) throw new Error('Pass --synthetic or a review_events CSV export.');
  const rows = synthetic ? simulate() : parseCsv(readFileSync(file!, 'utf8'));
  const { fitted, results, train, test } = compare(rows, synthetic ? SIMULATED_TRUTH : undefined);

  console.log(
    `${synthetic ? 'Synthetic' : 'Exported'} reviews: ${rows.length}; notebooks ${train} train / ${test} test\n`,
  );
  console.log('| Predictor | Test log-loss | Test Brier |');
  console.log('| --- | --- | --- |');
  for (const [name, r] of Object.entries(results)) {
    console.log(`| ${name} | ${r.logLoss.toFixed(4)} | ${r.brier.toFixed(4)} |`);
  }
  console.log(`\nFitted parameters: [${fitted.map((v) => v.toFixed(3)).join(', ')}]`);

  console.log('\nDays until predicted recall falls to 90% (fitted model) vs the fixed schedule:\n');
  console.log('| History | Fitted interval | Fixed interval |');
  console.log('| --- | --- | --- |');
  const cases: [string, ReviewStep[], string][] = [
    ['first review, recalled ("good")', [{ elapsedDays: 1, confidence: 'good' }], '1 day'],
    ['first review, forgot ("again")', [{ elapsedDays: 1, confidence: 'again' }], '4 hours'],
    [
      'three on-time "good" reviews',
      [
        { elapsedDays: 1, confidence: 'good' },
        { elapsedDays: 1, confidence: 'good' },
        { elapsedDays: 1, confidence: 'good' },
      ],
      '1 day',
    ],
    ['first review, "easy"', [{ elapsedDays: 1, confidence: 'easy' }], '3 days'],
  ];
  for (const [name, steps, fixed] of cases) {
    console.log(
      `| ${name} | ${intervalDays(stabilityAfter(steps, fitted), 0.9).toFixed(1)} days | ${fixed} |`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
