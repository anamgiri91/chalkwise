import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLectureAnalysis, parseLectureOrganization } from '../src/lib/lectureAnalysis.ts';
import { sourcePhotoOf } from '../src/lib/grounding.ts';

const base = {
  suggestedCourse: 'CS 3358',
  title: 'Trees',
  topic: 'Trees',
  summary: 'S',
  keyConcepts: ['BST', '  ', 'AVL'],
  importantPoints: [],
  assignments: ['HW 4 due Friday'],
  examMentions: [],
};

test('sources stay on the right line when blank lines are dropped', () => {
  const parsed = parseLectureAnalysis({
    ...base,
    sources: { keyConcepts: [1, 2, 3], assignments: [9] },
  });
  assert.deepEqual(parsed.keyConcepts, ['BST', 'AVL']);
  // Photo 9 cannot exist in a six-photo session, so it becomes unknown rather than wrong.
  assert.deepEqual(parsed.sources, { keyConcepts: [1, 3], assignments: [null] });
});

test('misaligned or missing sources are dropped, never guessed', () => {
  assert.equal(parseLectureAnalysis(base).sources, undefined);
  const parsed = parseLectureAnalysis({ ...base, sources: { keyConcepts: [1] } });
  assert.equal(parsed.sources, undefined);
});

test('the organizer cannot supply sources; they come from the transcripts', () => {
  const organized = parseLectureOrganization({ ...base, sources: { keyConcepts: [1, 1, 1] } });
  assert.equal('sources' in organized, false);
});

test('each note line links to the photo whose transcript contains it', () => {
  const transcripts = [
    'CS 3358 Data Structures\nAVL trees, rotations (LL, RR)',
    'HW 4 due Thurs Sept 24 on Canvas\nExam 1 Oct 8 covers ch. 5-7',
    '',
  ];
  assert.equal(sourcePhotoOf('AVL tree rotations', transcripts), 1);
  assert.equal(sourcePhotoOf('Homework 4 due Thursday, September 24', transcripts), 2);
  assert.equal(sourcePhotoOf('Exam 1 covers chapters 5-7', transcripts), 2);
  // A number no photo contains, or words no photo contains, links to nothing.
  assert.equal(sourcePhotoOf('HW 5 due Friday', transcripts), null);
  assert.equal(sourcePhotoOf('Dynamic programming', transcripts), null);
});

test('editing keeps each line on its photo and drops blank lines with their source', async () => {
  const { toEdit } = await import('../src/features/lectures/editNotes.ts');
  const edit = toEdit('  Trees ', ' Summary ', {
    keyConcepts: [
      { text: 'Binary search tree', source: 1 },
      { text: '   ', source: 2 },
      { text: 'New line', source: null },
    ],
    importantPoints: [],
    assignments: [{ text: 'HW 4 due Friday ', source: 2 }],
    examMentions: [],
  });
  assert.equal(edit.title, 'Trees');
  assert.deepEqual(edit.keyConcepts, ['Binary search tree', 'New line']);
  assert.deepEqual(edit.sources?.keyConcepts, [1, null]);
  assert.deepEqual(edit.assignments, ['HW 4 due Friday']);
  assert.deepEqual(edit.sources?.assignments, [2]);
});
