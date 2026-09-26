import { z } from 'zod';

export const id = z.string().trim().min(1).max(180);
export const text = z.string().trim().min(1).max(500);
const lines = z.array(z.string().trim().min(1).max(4000)).max(100);
export const profileInput = z
  .object({
    name: text.max(100),
    year: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']),
    major: text.max(160),
  })
  .strict();
export const courseInput = z
  .object({ code: text.max(40), name: text.max(200), professor: z.string().trim().max(160) })
  .strict();
const photoRefs = z.array(z.number().int().min(1).max(6).nullable()).max(100);
/** Each list of sources must line up with the note list it describes. */
const sources = z
  .object({
    keyConcepts: photoRefs,
    importantPoints: photoRefs,
    assignments: photoRefs,
    examMentions: photoRefs,
  })
  .partial()
  .strict();
const notes = {
  title: text,
  summary: text.max(20000),
  keyConcepts: lines,
  importantPoints: lines,
  assignments: lines,
  examMentions: lines,
  sources: sources.optional(),
};
const alignedSources = (value: {
  keyConcepts: string[];
  importantPoints: string[];
  assignments: string[];
  examMentions: string[];
  sources?: z.infer<typeof sources>;
}) =>
  Object.entries(value.sources ?? {}).every(
    ([key, refs]) => refs?.length === value[key as keyof z.infer<typeof sources>].length,
  );
const alignment = { message: 'Each source list must match its notes.', path: ['sources'] };
export const lectureInput = z
  .object({ courseId: id, ...notes })
  .strict()
  .refine(alignedSources, alignment);
export const lectureEditInput = z.object(notes).strict().refine(alignedSources, alignment);

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour HH:MM time.');
export const meetingsInput = z
  .object({
    meetings: z
      .array(
        z
          .object({ weekday: z.number().int().min(0).max(6), start: clock, end: clock })
          .strict()
          .refine((m) => m.end > m.start, { message: 'A class must end after it starts.' }),
      )
      .max(14),
  })
  .strict();

const question = z
  .object({
    question: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correctAnswer: z.string().trim().min(1).max(500),
    explanation: z.string().trim().max(2000),
  })
  .strict();
export const attemptInput = z
  .object({
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(20),
    missed: z.array(question).max(20),
  })
  .strict()
  .refine((a) => a.score <= a.total && a.missed.length === a.total - a.score, {
    message: 'Score, total and missed questions must agree.',
  });
export const uploadInput = z
  .object({
    id: z.uuid(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
    data: z
      .string()
      .min(4)
      .max(13981016)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export const reviewInput = z.object({ confidence: z.enum(['again', 'good', 'easy']) }).strict();

/**
 * One to six photos of a single capture session. The legacy single-photo body stays
 * accepted so an app build in a student's hand keeps working after the server updates.
 */
export const analyzeInput = z
  .union([
    z.object({ materialIds: z.array(z.uuid()).min(1).max(6) }).strict(),
    z
      .object({ materialId: z.uuid() })
      .strict()
      .transform(({ materialId }) => ({ materialIds: [materialId] })),
  ])
  .refine(({ materialIds }) => new Set(materialIds).size === materialIds.length, {
    message: 'List each photo once.',
  });
