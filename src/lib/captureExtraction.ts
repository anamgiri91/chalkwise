/**
 * One photo, transcribed. Extraction is deliberately a separate step from organizing:
 * the organizer never sees the photo, so every organized claim has to come from this
 * text, which is what makes support checking meaningful rather than decorative.
 */
export type CaptureExtraction = {
  /** What is visibly written, in reading order. Empty only when nothing was readable. */
  text: string;
  readability: 'good' | 'partial' | 'unreadable';
  /** What could not be read, and why: glare, blur, a cut-off edge. */
  unclear: string[];
  /** A course code or name printed on the material. A label, never a course ID. */
  courseLabel: string | null;
};

const readabilities = ['good', 'partial', 'unreadable'] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid capture extraction.');
  }
  return value as Record<string, unknown>;
}

/** Validate untrusted provider output at the orchestration boundary. */
export function parseCaptureExtraction(value: unknown): CaptureExtraction {
  const row = record(value);
  if (typeof row.text !== 'string') throw new Error('Invalid extraction field: text.');
  const readability = row.readability;
  if (!readabilities.includes(readability as CaptureExtraction['readability'])) {
    throw new Error('Invalid extraction field: readability.');
  }
  if (!Array.isArray(row.unclear) || !row.unclear.every((item) => typeof item === 'string')) {
    throw new Error('Invalid extraction field: unclear.');
  }
  if (row.courseLabel !== null && typeof row.courseLabel !== 'string') {
    throw new Error('Invalid extraction field: courseLabel.');
  }
  const text = row.text.trim();
  if (readability !== 'unreadable' && !text) {
    throw new Error('A readable photo must produce transcribed text.');
  }
  return {
    text,
    readability: readability as CaptureExtraction['readability'],
    unclear: row.unclear.map((item) => item.trim()).filter(Boolean),
    courseLabel: row.courseLabel === null ? null : row.courseLabel.trim() || null,
  };
}
