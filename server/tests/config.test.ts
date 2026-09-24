import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { readConfig } from '../src/config.ts';

const development = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://runtime:private-password@localhost:5432/chalkwise',
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_test',
  COGNITO_CLIENT_ID: 'publicclient',
  S3_BUCKET: 'chalkwise-test',
};

test('development supports blank optional values from the example configuration', () => {
  const config = readConfig({ ...development, DATABASE_CA_FILE: ' ', GEMINI_API_KEY: '' });
  assert.equal(config.ssl, undefined);
  assert.equal(config.GEMINI_API_KEY, undefined);
  assert.deepEqual(config.origins, ['http://localhost:8081']);
});

test('production validates its certificate, AI configuration and HTTPS origins', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'chalkwise-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const certificate = join(directory, 'ca.pem');
  writeFileSync(certificate, rootCertificates.join('\n'));
  const production = {
    ...development,
    NODE_ENV: 'production',
    DATABASE_CA_FILE: certificate,
    GEMINI_API_KEY: 'test-only-key',
    WEB_ORIGINS: 'https://chalkwise.example, https://preview.chalkwise.example',
  };
  const config = readConfig(production);
  assert.equal(config.ssl?.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, rootCertificates.join('\n'));
  assert.equal(config.origins.length, 2);
  assert.throws(() => readConfig({ ...production, DATABASE_CA_FILE: '' }), /DATABASE_CA_FILE/);
  assert.throws(() => readConfig({ ...production, GEMINI_API_KEY: ' ' }), /GEMINI_API_KEY/);
  assert.throws(() => readConfig({ ...production, WEB_ORIGINS: 'http://localhost:8081' }), /HTTPS/);
  writeFileSync(certificate, 'not a certificate');
  assert.throws(() => readConfig(production), /PEM certificate bundle/);
  assert.throws(
    () => readConfig({ ...production, DATABASE_CA_FILE: join(directory, 'missing.pem') }),
    /PEM certificate bundle/,
  );
});

test('URL options cannot override the database TLS or connection identity', () => {
  for (const option of [
    'ssl=0',
    'sslmode=disable',
    'sslrootcert=other',
    'host=other',
    'user=admin',
  ]) {
    assert.throws(
      () => readConfig({ ...development, DATABASE_URL: `${development.DATABASE_URL}?${option}` }),
      /must not contain query options/,
    );
  }
  for (const url of [
    'https://localhost/chalkwise',
    'postgres://localhost',
    'postgres://localhost/db#part',
  ]) {
    assert.throws(() => readConfig({ ...development, DATABASE_URL: url }), /PostgreSQL URL/);
  }
});

test('invalid origins and mismatched Cognito regions fail before startup', () => {
  for (const origin of [
    '',
    ' , ',
    '*',
    'ftp://files.example',
    'https://app.example/path',
    'https://user:secret@app.example',
  ]) {
    assert.throws(() => readConfig({ ...development, WEB_ORIGINS: origin }), /WEB_ORIGINS/);
  }
  assert.throws(
    () => readConfig({ ...development, COGNITO_USER_POOL_ID: 'us-west-2_test' }),
    /must belong to AWS_REGION/,
  );
});

test('configuration errors name invalid fields without revealing their values', () => {
  assert.throws(
    () => readConfig({ ...development, DATABASE_URL: 'private-password', PORT: 'private-port' }),
    (error: Error) => {
      assert.match(error.message, /DATABASE_URL/);
      assert.match(error.message, /PORT/);
      assert.ok(!String(error).includes('private-password'));
      assert.ok(!String(error).includes('private-port'));
      return true;
    },
  );
});
