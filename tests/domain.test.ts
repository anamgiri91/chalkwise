import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReviewAt } from '../src/features/study/schedule.ts';
import { parseLectureAnalysis } from '../src/lib/lectureAnalysis.ts';
import { parseAskLectureInput, parseAskLectureResult } from '../src/lib/askLecture.ts';
import { parseQuizResult } from '../src/lib/quiz.ts';
import { buildReviewQueue } from '../src/features/study/queue.ts';
import type { Lecture } from '../src/features/lectures/types.ts';

test('review scheduling handles year boundaries and uses elapsed time across DST', () => {
  assert.equal(nextReviewAt('good', new Date('2026-12-31T12:00:00Z')), '2027-01-01T12:00:00.000Z');
  assert.equal(nextReviewAt('again', new Date('2026-03-08T06:00:00Z')), '2026-03-08T10:00:00.000Z');
  assert.equal(nextReviewAt('easy', new Date('2026-09-20T12:00:00Z')), '2026-09-23T12:00:00.000Z');
});
test('invalid review times cannot enter a study queue', () => {
  assert.throws(() => nextReviewAt('good', new Date('invalid')));
});
test('review queue includes unreviewed and due notes, and omits future reviews', () => {
  const lecture = (id: string): Lecture => ({
    id,
    courseId: 'cs',
    title: id,
    summary: 'Notes',
    keyConcepts: [],
    importantPoints: [],
    assignments: [],
    examMentions: [],
    createdAt: '2026-09-01T12:00:00Z',
  });
  const notes = ['new', 'due', 'later'].map(lecture);
  const reviews = [
    {
      lectureId: 'due',
      confidence: 'good' as const,
      reviewedAt: '2026-09-18T12:00:00Z',
      nextReviewAt: '2026-09-19T12:00:00Z',
    },
    {
      lectureId: 'later',
      confidence: 'easy' as const,
      reviewedAt: '2026-09-20T12:00:00Z',
      nextReviewAt: '2026-09-23T12:00:00Z',
    },
  ];
  const before = structuredClone(notes);
  const queue = buildReviewQueue(notes, reviews, new Date('2026-09-20T12:00:00Z'));
  assert.deepEqual(
    queue.map((item) => item.lecture.id),
    ['new', 'due'],
  );
  assert.equal(queue[0].reason, 'Not reviewed yet');
  assert.equal(queue[1].reason, 'Ready to revisit');
  assert.deepEqual(notes, before, 'Queue derivation must not mutate source notes');
});
test('review due time is inclusive and missing notebooks cannot leak into the queue', () => {
  const review = {
    lectureId: 'missing',
    confidence: 'again' as const,
    reviewedAt: '2026-09-20T00:00:00Z',
    nextReviewAt: '2026-09-20T04:00:00Z',
  };
  assert.deepEqual(buildReviewQueue([], [review], new Date(review.nextReviewAt)), []);
  const note: Lecture = {
    id: 'missing',
    courseId: 'cs',
    title: 'Topic',
    summary: '',
    keyConcepts: [],
    importantPoints: [],
    assignments: [],
    examMentions: [],
    createdAt: review.reviewedAt,
  };
  assert.equal(buildReviewQueue([note], [review], new Date(review.nextReviewAt)).length, 1);
});
test('analysis preserves uncertainty and normalizes blank course suggestions', () => {
  const result = parseLectureAnalysis({
    suggestedCourse: ' ',
    title: ' Lecture ',
    topic: 'Logic',
    summary: 'The lower section is unreadable.',
    keyConcepts: [' Boolean logic ', ''],
    importantPoints: [],
    assignments: [],
    examMentions: [],
  });
  assert.equal(result.suggestedCourse, null);
  assert.deepEqual(result.keyConcepts, ['Boolean logic']);
  assert.equal(result.summary, 'The lower section is unreadable.');
  assert.throws(() => parseLectureAnalysis({ title: 'Guess' }));
});
test('lecture questions require a bounded question and a real answer', () => {
  assert.deepEqual(parseAskLectureInput(' l1 ', ' Why? '), { lectureId: 'l1', question: 'Why?' });
  assert.throws(() => parseAskLectureInput('l1', 'x'.repeat(2001)));
  assert.throws(() => parseAskLectureResult({ answer: ' ' }));
});
test('quizzes reject ambiguous answer keys, repeated questions and repeated choices', () => {
  const valid = {
    title: 'Logic',
    questions: Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'From the lecture.',
    })),
  };
  assert.equal(parseQuizResult(valid).questions.length, 5);
  const badAnswer = structuredClone(valid);
  badAnswer.questions[0].correctAnswer = 'E';
  assert.throws(() => parseQuizResult(badAnswer));
  const duplicate = structuredClone(valid);
  duplicate.questions[1].question = duplicate.questions[0].question;
  assert.throws(() => parseQuizResult(duplicate));
  const options = structuredClone(valid);
  options.questions[0].options = ['A', 'A', 'B', 'C'];
  assert.throws(() => parseQuizResult(options));
});

test('a finished quiz counts as a review by how much was recalled', async () => {
  const { confidenceFromQuiz } = await import('../src/features/study/quizReview.ts');
  assert.equal(confidenceFromQuiz(5, 5), 'easy');
  assert.equal(confidenceFromQuiz(4, 5), 'good');
  assert.equal(confidenceFromQuiz(3, 5), 'good');
  assert.equal(confidenceFromQuiz(2, 5), 'again');
  assert.equal(confidenceFromQuiz(0, 5), 'again');
  assert.throws(() => confidenceFromQuiz(6, 5));
  assert.throws(() => confidenceFromQuiz(0, 0));
});
