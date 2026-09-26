/**
 * Deterministic support checking for generated study material.
 *
 * Organized notes are written from the faithful transcript of a capture, never from
 * the photo itself, so every organized claim must be traceable back to that transcript.
 * This exists for the failure that matters most in a study tool: an assignment or an
 * exam date the lecture never mentioned. A student who trusts an invented deadline is
 * worse off than a student who used no app at all, so unsupported items are removed
 * rather than flagged.
 *
 * This removes claims the transcript cannot account for. It does not establish that a
 * surviving claim is true: word, number and date matching has no syntax, so a negated,
 * cancelled, or misattributed sentence still matches. Do not describe it as proof.
 *
 * Conservative starting values. Tune only after measuring against labelled captures;
 * every change to these numbers changes what students are shown.
 */
export const SUPPORT_THRESHOLDS = {
  /** Share of an item's content words that must appear in the transcript. */
  minContentTokenRatio: 0.6,
  /** At or below this many content words, every word must appear. */
  shortItemTokenCount: 2,
  /** Characters compared when matching a weekday or month against an abbreviation. */
  datePrefixLength: 3,
} as const;

export type SupportThresholds = {
  minContentTokenRatio: number;
  shortItemTokenCount: number;
  datePrefixLength: number;
};

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'do',
  'due',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'our',
  'out',
  'that',
  'the',
  'their',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'up',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
]);

const DATE_WORDS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export type SupportResult = {
  /** Items traceable to the transcript, in their original order. */
  supported: string[];
  /** Items removed because the transcript does not contain them. */
  unsupported: string[];
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** A single trailing plural is the only stemming applied; anything more invites false matches. */
function stem(token: string): string {
  return token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;
}

function isDateToken(token: string, prefixLength: number): boolean {
  if (token.length < prefixLength) return false;
  const prefix = token.slice(0, prefixLength);
  return DATE_WORDS.some((word) => word.startsWith(prefix));
}

function digits(value: string): string[] {
  return value.match(/\d+/g) ?? [];
}

/**
 * An item is supported when the transcript contains its numbers, its dates, and enough
 * of its content words. Numbers and dates are required exactly because they are what a
 * model invents: "problem set 4" and "problem set 7" read identically to a ratio check.
 */
export function isSupported(
  item: string,
  source: string,
  thresholds: SupportThresholds = SUPPORT_THRESHOLDS,
): boolean {
  const { datePrefixLength } = thresholds;
  const isDate = (token: string) => isDateToken(token, datePrefixLength);
  const sourceTokens = new Set(tokenize(source).map(stem));
  const sourceDates = tokenize(source).filter(isDate);
  const sourceDigits = new Set(digits(source));

  for (const number of digits(item)) {
    if (!sourceDigits.has(number)) return false;
  }

  const tokens = tokenize(item);
  for (const token of tokens.filter(isDate)) {
    const prefix = token.slice(0, datePrefixLength);
    if (!sourceDates.some((candidate) => candidate.startsWith(prefix))) return false;
  }

  const content = tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
  if (content.length === 0) return false;

  // Date words already passed the prefix rule above, so they count as present here;
  // otherwise "Sept" would be rejected for not matching the token "September" exactly.
  const present = content.filter((token) => isDate(token) || sourceTokens.has(stem(token))).length;
  if (content.length <= thresholds.shortItemTokenCount) return present === content.length;
  return present / content.length >= thresholds.minContentTokenRatio;
}

/** Partition generated items by whether the transcript supports them. */
export function verifySupport(items: string[], source: string): SupportResult {
  const supported: string[] = [];
  const unsupported: string[] = [];
  for (const item of items) {
    (isSupported(item, source) ? supported : unsupported).push(item);
  }
  return { supported, unsupported };
}

/*
 * Clause-local support: a candidate replacement for isSupported, not yet used by the
 * analysis pipeline. Measure it with `node scripts/eval-grounding.mts` before wiring it in.
 *
 * isSupported asks whether the whole transcript contains a claim's words, so "Program 2
 * due Oct 8" survives when one line says "Program 2 due Oct 2" and another "Exam 1 Oct 8".
 * This version asks whether one board item supports the claim on its own, and reads the
 * few pieces of syntax that flip a claim's meaning on a board: negation ("no lab Monday"),
 * superseded values ("moved from Wed", "was Oct 29"), and a short list of opposites
 * ("closed book"). It is still word matching and still a one-way filter.
 */

/** Board shorthand expanded in both claim and transcript before comparison. */
const ABBREVIATIONS: Record<string, string> = {
  ch: 'chapter',
  chap: 'chapter',
  chs: 'chapter',
  pp: 'pages',
  pg: 'page',
  pgs: 'pages',
  hw: 'homework',
  hrs: 'hours',
  hr: 'hour',
  min: 'minutes',
  mins: 'minutes',
  pts: 'points',
  pt: 'point',
  sec: 'section',
  eval: 'evaluation',
  evals: 'evaluation',
  wk: 'week',
  tba: 'announced',
  tbd: 'determined',
};

const MONTHS = DATE_WORDS.slice(7);
const NEGATORS = new Set(['no', 'not', 'never', 'without', 'cannot']);
/** Words that mark the value after "from" as superseded on the same line. */
const MOVE_WORDS = new Set(['moved', 'pushed', 'rescheduled', 'changed', 'postponed']);
/** Content words negated after a negator, before the clause ends. */
const NEGATION_SCOPE = 3;
const OPPOSITES: [string, string][] = [
  ['open', 'closed'],
  ['before', 'after'],
  ['required', 'optional'],
  ['mandatory', 'optional'],
  ['individual', 'group'],
];

/** Lowercase, write M/D dates as "month day", split "11pm" into "11 pm", expand shorthand. */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (match, m: string, d: string) => {
      const month = Number(m);
      return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${Number(d)}` : match;
    })
    .replace(/[–—]/g, '-')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[a-z]+/g, (word) => ABBREVIATIONS[word] ?? word);
}

/** Whole numbers and decimals, so "4.1" never counts as "4", plus hyphenated ranges. */
function numbersIn(text: string): { singles: Set<string>; ranges: Set<string> } {
  const singles = new Set<string>();
  const ranges = new Set<string>();
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/g)) {
    singles.add(match[1]);
    if (match[2]) {
      singles.add(match[2]);
      ranges.add(`${match[1]}-${match[2]}`);
    }
  }
  return { singles, ranges };
}

function words(text: string): string[] {
  return text
    .split(/[^a-z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

type Segment = {
  stems: Set<string>;
  dates: string[];
  numbers: Set<string>;
  ranges: Set<string>;
  negated: Set<string>;
};

/** Clauses end at punctuation and at a spaced dash; "5-7" and "write-up" stay whole. */
function clauses(line: string): string[] {
  return line.split(/[,;:!?()]|\.(?=\s|$)|\s-\s|\s->\s/);
}

function buildSegment(text: string): Segment {
  const stems = new Set<string>();
  const dates: string[] = [];
  const negated = new Set<string>();
  const superseded: string[] = [];
  const moved = words(text).some((w) => MOVE_WORDS.has(w));

  for (const clause of clauses(text)) {
    const tokens = words(clause);
    let scope = 0;
    let old = false;
    for (const token of tokens) {
      if (token === 'to') old = false;
      if (token === 'was' || (token === 'from' && moved)) {
        old = true;
        continue;
      }
      if (old) {
        superseded.push(token);
        continue;
      }
      if (NEGATORS.has(token)) {
        scope = NEGATION_SCOPE;
        continue;
      }
      if (scope > 0 && !STOPWORDS.has(token)) {
        negated.add(stem(token));
        scope--;
      }
      stems.add(stem(token));
      if (isDateToken(token, SUPPORT_THRESHOLDS.datePrefixLength)) dates.push(token);
    }
  }

  // A value that only appears as the superseded one is not a current fact.
  const current = numbersIn(
    words(text)
      .filter((w) => !superseded.includes(w) || stems.has(stem(w)))
      .join(' '),
  );
  const { ranges } = numbersIn(text);
  const numbers = new Set(
    [...current.singles].filter((n) => !superseded.includes(n) || stems.has(n)),
  );
  return { stems, dates, numbers, ranges, negated };
}

/**
 * Board items. Each line is its own item, except that a line repeating the previous
 * line's first word continues it ("Exam 2 moved to Nov 3" / "Exam covers ch 7-9").
 */
function segmentsOf(source: string): Segment[] {
  const lines = normalizeText(source)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const grouped: string[] = [];
  let previousHead = '';
  for (const line of lines) {
    const head = words(line)[0] ?? '';
    if (grouped.length && head && head === previousHead) grouped[grouped.length - 1] += `\n${line}`;
    else grouped.push(line);
    previousHead = head;
  }
  return grouped.map(buildSegment);
}

function supportedBySegment(
  claim: string,
  segment: Segment,
  thresholds: SupportThresholds,
): boolean {
  const tokens = words(claim);
  const claimNumbers = numbersIn(claim);
  for (const range of claimNumbers.ranges) if (!segment.ranges.has(range)) return false;
  for (const number of claimNumbers.singles) if (!segment.numbers.has(number)) return false;

  const prefixLength = thresholds.datePrefixLength;
  for (const token of tokens.filter((t) => isDateToken(t, prefixLength))) {
    const prefix = token.slice(0, prefixLength);
    if (!segment.dates.some((date) => date.startsWith(prefix))) return false;
  }

  const content = tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t) && !NEGATORS.has(t));
  if (content.length === 0) return false;
  const present = content.filter(
    (t) => isDateToken(t, prefixLength) || segment.stems.has(stem(t)),
  ).length;
  const enough =
    content.length <= thresholds.shortItemTokenCount
      ? present === content.length
      : present / content.length >= thresholds.minContentTokenRatio;
  if (!enough) return false;

  const claimStems = new Set(tokens.map(stem));
  const claimNegated = tokens.some((t) => NEGATORS.has(t));
  if (!claimNegated && [...claimStems].some((s) => segment.negated.has(s))) return false;
  for (const [a, b] of OPPOSITES) {
    if (claimStems.has(a) && segment.stems.has(b) && !segment.stems.has(a)) return false;
    if (claimStems.has(b) && segment.stems.has(a) && !segment.stems.has(b)) return false;
  }
  return true;
}

/** True when a single board item supports the claim without negating or superseding it. */
export function isSupportedByClause(
  item: string,
  source: string,
  thresholds: SupportThresholds = SUPPORT_THRESHOLDS,
): boolean {
  const claim = normalizeText(item);
  return segmentsOf(source).some((segment) => supportedBySegment(claim, segment, thresholds));
}
