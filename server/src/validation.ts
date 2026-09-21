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
export const lectureInput = z
  .object({
    courseId: id,
    title: text,
    summary: text.max(20000),
    keyConcepts: lines,
    importantPoints: lines,
    assignments: lines,
    examMentions: lines,
  })
  .strict();
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
