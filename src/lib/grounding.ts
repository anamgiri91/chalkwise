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

function isDateToken(token: string): boolean {
  if (token.length < SUPPORT_THRESHOLDS.datePrefixLength) return false;
  const prefix = token.slice(0, SUPPORT_THRESHOLDS.datePrefixLength);
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
export function isSupported(item: string, source: string): boolean {
  const sourceTokens = new Set(tokenize(source).map(stem));
  const sourceDates = tokenize(source).filter(isDateToken);
  const sourceDigits = new Set(digits(source));

  for (const number of digits(item)) {
    if (!sourceDigits.has(number)) return false;
  }

  const tokens = tokenize(item);
  for (const token of tokens.filter(isDateToken)) {
    const prefix = token.slice(0, SUPPORT_THRESHOLDS.datePrefixLength);
    if (!sourceDates.some((candidate) => candidate.startsWith(prefix))) return false;
  }

  const content = tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
  if (content.length === 0) return false;

  // Date words already passed the prefix rule above, so they count as present here;
  // otherwise "Sept" would be rejected for not matching the token "September" exactly.
  const present = content.filter(
    (token) => isDateToken(token) || sourceTokens.has(stem(token)),
  ).length;
  if (content.length <= SUPPORT_THRESHOLDS.shortItemTokenCount) return present === content.length;
  return present / content.length >= SUPPORT_THRESHOLDS.minContentTokenRatio;
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
