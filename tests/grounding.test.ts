import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupported, isSupportedByClause, verifySupport } from '../src/lib/grounding.ts';

const transcript = [
  'CS 3358 Data Structures. Problem set 3 is due Friday.',
  'Midterm covers chapters 1 and 2.',
  'Boolean logic, truth tables, and short-circuit evaluation.',
].join(' ');

test('claims repeated from the transcript are kept, including light rewording', () => {
  assert.equal(isSupported('Problem set 3 is due Friday', transcript), true);
  assert.equal(isSupported('Truth tables', transcript), true);
  assert.equal(isSupported('Short-circuit evaluation of boolean logic', transcript), true);
});

test('an invented deadline is removed even when the surrounding words match', () => {
  assert.equal(isSupported('Problem set 3 is due October 14', transcript), false);
  assert.equal(isSupported('Essay due Monday', transcript), false);
});

test('a changed number is removed because ratio checks cannot see it', () => {
  // "Problem set 7" shares every content word with a real assignment.
  assert.equal(isSupported('Problem set 7 is due Friday', transcript), false);
  // Chapters 1 and 2 must not become chapter 12.
  assert.equal(isSupported('Midterm covers chapter 12', transcript), false);
});

test('weekday and month abbreviations match their full names in either direction', () => {
  assert.equal(isSupported('Problem set 3 due Fri', transcript), true);
  assert.equal(isSupported('Quiz on Sept 3', 'Quiz on September 3'), true);
  assert.equal(isSupported('Quiz on September 3', 'Quiz on Sept 3'), true);
});

test('content that never appears is removed, and empty items never survive', () => {
  assert.equal(isSupported('Read the assigned chapter on graph traversal', transcript), false);
  assert.equal(isSupported('   ', transcript), false);
  assert.equal(isSupported('...', transcript), false);
});

test('verification partitions items and preserves their original order', () => {
  const result = verifySupport(
    ['Problem set 3', 'Final exam December 5', 'Truth tables'],
    transcript,
  );
  assert.deepEqual(result.supported, ['Problem set 3', 'Truth tables']);
  assert.deepEqual(result.unsupported, ['Final exam December 5']);
});

test('an empty transcript supports nothing, so nothing can be fabricated from silence', () => {
  assert.deepEqual(verifySupport(['Problem set 3', 'Midterm Friday'], ''), {
    supported: [],
    unsupported: ['Problem set 3', 'Midterm Friday'],
  });
});

const board = [
  'CS 3358 Data Structures',
  'Program 2 (AVL insert + delete) due Oct 2',
  'Exam 1 Oct 8 in class, covers ch. 5-7',
  'No lab Monday Oct 5 (fall break)',
  'Quiz 3 moved from Wed to next Monday',
  'Exam 2 moved to Nov 3 (was Oct 29)',
  'Exam covers ch 7-9 only',
  'Midterm: closed book, no notes allowed',
  'Test 3 on 10/21',
].join('\n');

test('clause support keeps claims one board item states, including reformatted ones', () => {
  assert.equal(isSupportedByClause('Program 2 due October 2', board), true);
  assert.equal(isSupportedByClause('Exam 1 on October 8 covers chapters 5-7', board), true);
  assert.equal(isSupportedByClause('Quiz 3 is next Monday', board), true);
  assert.equal(isSupportedByClause('Test 3 on October 21', board), true);
  // A line that repeats the previous line's subject continues it.
  assert.equal(isSupportedByClause('Exam 2 covers chapters 7-9', board), true);
});

test('clause support removes a value borrowed from a different item', () => {
  // The whole-transcript check keeps this: "Oct 8" is on the board, just not for Program 2.
  assert.equal(isSupported('Program 2 due Oct 8', board), true);
  assert.equal(isSupportedByClause('Program 2 due Oct 8', board), false);
  // A range is one fact; 5-8 is not 5-7 even though 8 appears on the same line.
  assert.equal(isSupportedByClause('Exam 1 covers chapters 5-8', board), false);
});

test('clause support removes negated, superseded and contradicted claims', () => {
  assert.equal(isSupportedByClause('Lab on Monday Oct 5', board), false);
  assert.equal(isSupportedByClause('No lab Monday Oct 5', board), true);
  assert.equal(isSupportedByClause('Quiz 3 on Wednesday', board), false);
  assert.equal(isSupportedByClause('Exam 2 on October 29', board), false);
  assert.equal(isSupportedByClause('Exam 2 on November 3', board), true);
  assert.equal(isSupportedByClause('Notes allowed on the midterm', board), false);
  assert.equal(isSupportedByClause('Midterm is open book', board), false);
  assert.equal(isSupportedByClause('Midterm is closed book', board), true);
});

test('clause support treats a decimal section number as one number', () => {
  const source = 'Problem Set 3: #2, #5 from section 4.1. Due Friday';
  assert.equal(isSupportedByClause('Problem Set 3 from section 4.1 due Friday', source), true);
  assert.equal(isSupportedByClause('Problem Set 4 due Friday', source), false);
});

test('clause support never keeps anything from an empty transcript', () => {
  assert.equal(isSupportedByClause('Problem set 3', ''), false);
  assert.equal(isSupportedByClause('   ', board), false);
});
