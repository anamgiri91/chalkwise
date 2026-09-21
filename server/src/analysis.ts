import { parseCaptureExtraction, type CaptureExtraction } from '../../src/lib/captureExtraction.ts';
import { parseLectureAnalysis, parseLectureOrganization } from '../../src/lib/lectureAnalysis.ts';
import { verifySupport } from '../../src/lib/grounding.ts';
import type { LectureAnalysis } from '../../src/features/lectures/types.ts';
import { ApiError } from './errors.ts';
import type { Ai } from './ai.ts';
import type { Photo } from './storage.ts';

/**
 * Total wall clock for one analysis. Transcription runs in parallel, so the worst case
 * is one transcription plus one organization, which has to finish inside the API's own
 * request timeout rather than relying on the provider to be quick.
 */
export const PIPELINE_BUDGET_MS = 75_000;
const MAX_STEP_MS = 45_000;
const MIN_STEP_MS = 5_000;

export type SessionAnalysis = {
  analysis: LectureAnalysis;
  /** 1-based photo numbers that could not be transcribed. The session still saves. */
  unreadablePhotos: number[];
  /** Assignment and exam items removed because no transcript supported them. */
  removedClaims: number;
};

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  // A tie keeps the earliest label, which is the first photo the student took.
  return [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/**
 * Turn one capture session into saved study material.
 *
 * Each photo is transcribed on its own, then a single organizing step runs over those
 * transcripts and never sees the photos, so an organized claim can only be built from
 * text we already hold.
 *
 * The support check that follows is a one-way filter, not a proof. Failing it is good
 * evidence a claim was invented. Passing it is NOT evidence the claim is correct:
 * matching words, numbers and dates carries no syntax, so it cannot see negation
 * ("not due Friday"), attribution ("problem 4 is due Monday", not problem 3), or
 * cancellation. Those cases belong in the evaluation set, and actionable claims should
 * move to verbatim source excerpts rather than paraphrases.
 */
export async function analyzeSession(
  ai: Ai,
  photos: Photo[],
  now: () => number = Date.now,
): Promise<SessionAnalysis> {
  if (!photos.length) {
    throw new ApiError(400, 'NO_PHOTOS', 'Capture at least one photo to analyze.');
  }
  const deadline = now() + PIPELINE_BUDGET_MS;
  const nextBudget = () => {
    const remaining = deadline - now();
    if (remaining < MIN_STEP_MS) {
      throw new ApiError(
        503,
        'AI_UNAVAILABLE',
        'Analysis took too long to finish. Your originals are safe; try again.',
      );
    }
    return Math.min(remaining, MAX_STEP_MS);
  };

  // One unreadable photo must not cost the student the rest of the session.
  const budget = nextBudget();
  const settled = await Promise.allSettled(
    photos.map((photo) => ai.generate('extract', {}, [photo], budget)),
  );

  const extractions: { photo: number; extraction: CaptureExtraction }[] = [];
  const unreadablePhotos: number[] = [];
  let failure: unknown;
  settled.forEach((result, index) => {
    const photo = index + 1;
    if (result.status === 'rejected') {
      failure ??= result.reason;
      unreadablePhotos.push(photo);
      return;
    }
    try {
      const extraction = parseCaptureExtraction(result.value);
      if (extraction.readability === 'unreadable' || !extraction.text) unreadablePhotos.push(photo);
      else extractions.push({ photo, extraction });
    } catch (error) {
      failure ??= error;
      unreadablePhotos.push(photo);
    }
  });

  if (!extractions.length) {
    if (failure instanceof ApiError) throw failure;
    throw new ApiError(
      422,
      'AI_UNREADABLE',
      'None of these photos could be read. Try again with more light and less glare.',
    );
  }

  const transcript = extractions.map((entry) => entry.extraction.text).join('\n\n');
  const organization = parseLectureOrganization(
    await ai.generate(
      'organize',
      {
        photos: extractions.map((entry) => ({
          photo: entry.photo,
          readability: entry.extraction.readability,
          transcript: entry.extraction.text,
          unclear: entry.extraction.unclear,
        })),
        unreadablePhotos,
      },
      [],
      nextBudget(),
    ),
  );

  // Only claims a student would act on are removed. A summary is synthesis by nature
  // and cannot be checked this way, so it is left intact and labelled as generated.
  const assignments = verifySupport(organization.assignments, transcript);
  const examMentions = verifySupport(organization.examMentions, transcript);
  const labels = extractions
    .map((entry) => entry.extraction.courseLabel)
    .filter((label): label is string => Boolean(label));

  return {
    analysis: parseLectureAnalysis({
      ...organization,
      suggestedCourse: labels.length ? mostCommon(labels) : null,
      assignments: assignments.supported,
      examMentions: examMentions.supported,
    }),
    unreadablePhotos,
    removedClaims: assignments.unsupported.length + examMentions.unsupported.length,
  };
}
