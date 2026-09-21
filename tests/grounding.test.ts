import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupported, verifySupport } from '../src/lib/grounding.ts';

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
