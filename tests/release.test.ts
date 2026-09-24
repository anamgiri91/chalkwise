import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { releaseEnvironment } from '../scripts/build-release.mjs';

const config = {
  EXPO_PUBLIC_DATA_MODE: 'api',
  EXPO_PUBLIC_API_URL: 'https://api.chalkwise.example',
  EXPO_PUBLIC_AWS_REGION: 'us-east-1',
  EXPO_PUBLIC_COGNITO_CLIENT_ID: 'testpublicclient',
};

test('release cannot silently ship a demo or pick up local dotenv credentials', () => {
  assert.throws(() => releaseEnvironment({}), /DATA_MODE=api/);
  assert.throws(
    () => releaseEnvironment({ ...config, EXPO_PUBLIC_DATA_MODE: 'mock' }),
    /DATA_MODE=api/,
  );
  assert.throws(
    () => releaseEnvironment({ ...config, EXPO_PUBLIC_DATA_MODE: 'supabase' }),
    /DATA_MODE=api/,
  );
  const env = releaseEnvironment({ ...config, EXPO_PUBLIC_SUPABASE_URL: 'legacy' });
  assert.equal(env.EXPO_NO_DOTENV, '1');
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, undefined);
  const demo = releaseEnvironment(config, true);
  assert.equal(demo.EXPO_PUBLIC_DATA_MODE, 'mock');
  assert.equal(demo.EXPO_PUBLIC_API_URL, undefined);
});

test('release refuses insecure API targets, incomplete identity and unreviewed public secrets', () => {
  for (const url of [
    undefined,
    'http://api.example',
    'https://localhost',
    'https://api.example/path',
    'https://user:password@api.example',
    'https://api.example?key=secret',
  ]) {
    assert.throws(
      () => releaseEnvironment({ ...config, EXPO_PUBLIC_API_URL: url }),
      /HTTPS origin/,
    );
  }
  for (const key of ['EXPO_PUBLIC_AWS_REGION', 'EXPO_PUBLIC_COGNITO_CLIENT_ID']) {
    assert.throws(() => releaseEnvironment({ ...config, [key]: '' }), new RegExp(key));
  }
  assert.throws(
    () => releaseEnvironment({ ...config, EXPO_PUBLIC_GEMINI_API_KEY: 'private-value' }),
    (error: Error) => {
      assert.match(error.message, /Unreviewed public build variable/);
      assert.ok(!error.message.includes('private-value'));
      return true;
    },
  );
});

test('website routing supports direct notebook links without rewriting assets or queries', () => {
  const handler = runInNewContext(
    readFileSync(new URL('../server/infra/web-router.js', import.meta.url), 'utf8') + '\nhandler;',
  );
  for (const [uri, expected] of [
    ['/', '/index.html'],
    ['/login', '/login.html'],
    ['/profile/', '/profile.html'],
    ['/course/cs-101', '/course/[id].html'],
    ['/lecture/a-new-private-id/', '/lecture/[id].html'],
    ['/_expo/static/js/web/entry-hash.js', '/_expo/static/js/web/entry-hash.js'],
    ['/assets/image.png', '/assets/image.png'],
    ['/favicon.ico', '/favicon.ico'],
    ['/missing-page', '/missing-page.html'],
  ]) {
    const querystring = { from: { value: 'review' } };
    const request = { uri, method: 'GET', querystring };
    assert.equal(handler({ request }).uri, expected);
    assert.equal(request.querystring, querystring);
  }
});
