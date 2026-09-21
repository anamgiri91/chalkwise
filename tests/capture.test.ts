import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPhotoPixels } from '../src/features/capture/photoQualityMath.ts';
import { parseCaptureSession } from '../src/features/capture/captureSession.ts';
import { matchCourse } from '../src/features/courses/matchCourse.ts';

const pixels = (value: (index: number) => number) =>
  Uint8Array.from({ length: 8 * 8 * 4 }, (_, index) =>
    index % 4 === 3 ? 255 : value(Math.floor(index / 4)),
  );
test('photo quality detects severe exposure failures and low detail', () => {
  assert.deepEqual(
    classifyPhotoPixels(
      pixels(() => 0),
      8,
      8,
    ).warnings,
    ['blurry', 'too-dark'],
  );
  assert.deepEqual(
    classifyPhotoPixels(
      pixels(() => 255),
      8,
      8,
    ).warnings,
    ['blurry', 'too-bright'],
  );
  assert.deepEqual(
    classifyPhotoPixels(
      pixels(() => 128),
      8,
      8,
    ).warnings,
    ['blurry'],
  );
});
test('photo quality accepts sharp alternating edges and rejects incomplete samples', () => {
  const sharp = pixels((index) => (((index % 8) + Math.floor(index / 8)) % 2 ? 255 : 0));
  assert.deepEqual(classifyPhotoPixels(sharp, 8, 8).warnings, []);
  assert.throws(() => classifyPhotoPixels(new Uint8Array(4), 8, 8));
});
test('capture sessions reject empty and over-limit batches', () => {
  const photo = {
    id: 'photo',
    uri: 'file:///photo.jpg',
    width: 100,
    height: 100,
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
    capturedAt: '2026-09-20T12:00:00Z',
    quality: { status: 'unchecked', warnings: [], metrics: null },
  };
  const session = { version: 1, id: 'session', createdAt: photo.capturedAt, photos: [photo] };
  assert.equal(parseCaptureSession(JSON.stringify(session)).photos.length, 1);
  assert.throws(() => parseCaptureSession(JSON.stringify({ ...session, photos: [] })));
  assert.throws(() =>
    parseCaptureSession(JSON.stringify({ ...session, photos: Array(7).fill(photo) })),
  );
});
test('ambiguous AI course labels require student confirmation', () => {
  const courses = [
    { id: 'cs-1', code: 'CS 1', name: 'Introduction', professor: '' },
    { id: 'math-1', code: 'MATH 1', name: 'Introduction', professor: '' },
  ];
  assert.equal(matchCourse('Introduction', courses), null);
  assert.equal(matchCourse('CS 1 - Introduction', courses), null);
  assert.equal(matchCourse('CS 1', courses)?.id, 'cs-1');
  assert.equal(matchCourse('Unknown', courses), null);
});
