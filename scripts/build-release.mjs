import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicFields = new Set([
  'EXPO_PUBLIC_DATA_MODE',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_AWS_REGION',
  'EXPO_PUBLIC_COGNITO_CLIENT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);

export function releaseEnvironment(env, demo = false) {
  for (const name of Object.keys(env)) {
    if (name.startsWith('EXPO_PUBLIC_') && !publicFields.has(name) && env[name]) {
      throw new Error(`Unreviewed public build variable: ${name}. Public values enter the bundle.`);
    }
  }
  if (!demo && env.EXPO_PUBLIC_DATA_MODE !== 'api') {
    throw new Error(
      'Release builds require EXPO_PUBLIC_DATA_MODE=api. Use --demo for an explicit demo.',
    );
  }
  const result = { ...env, EXPO_NO_DOTENV: '1', NODE_ENV: 'production' };
  // Never embed a legacy project's identifiers in the new API or demo artifact.
  delete result.EXPO_PUBLIC_SUPABASE_URL;
  delete result.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (demo) {
    result.EXPO_PUBLIC_DATA_MODE = 'mock';
    delete result.EXPO_PUBLIC_API_URL;
    delete result.EXPO_PUBLIC_AWS_REGION;
    delete result.EXPO_PUBLIC_COGNITO_CLIENT_ID;
    return result;
  }
  let api;
  try {
    api = new URL(env.EXPO_PUBLIC_API_URL);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be an exact HTTPS origin.');
  }
  if (
    api.protocol !== 'https:' ||
    api.origin !== env.EXPO_PUBLIC_API_URL ||
    ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)
  ) {
    throw new Error('EXPO_PUBLIC_API_URL must be an exact, non-local HTTPS origin.');
  }
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(env.EXPO_PUBLIC_AWS_REGION ?? '')) {
    throw new Error('EXPO_PUBLIC_AWS_REGION must be configured for release.');
  }
  if (!/^[a-z0-9]+$/.test(env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '')) {
    throw new Error('EXPO_PUBLIC_COGNITO_CLIENT_ID must be a public Cognito app client ID.');
  }
  return result;
}

function run() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--demo'))
    throw new Error('Usage: node scripts/build-release.mjs [--demo]');
  const env = releaseEnvironment(process.env, args.includes('--demo'));
  const mode = env.EXPO_PUBLIC_DATA_MODE;
  const output = join(root, 'dist', mode);
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/expo/bin/cli'),
      'export',
      '--platform',
      'web',
      '--clear',
      '--output-dir',
      output,
    ],
    { cwd: root, env, stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) throw new Error('Web release export failed.');
  for (const name of ['index.html', 'login.html', 'course/[id].html', 'lecture/[id].html']) {
    if (!readFileSync(join(output, name), 'utf8').includes('<html')) {
      throw new Error(`Missing exported route: ${name}`);
    }
  }
  const files = {};
  function inventory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inventory(path);
      else if (entry.isFile()) {
        const name = relative(output, path).replaceAll('\\', '/');
        if (name !== 'release.json')
          files[name] = createHash('sha256').update(readFileSync(path)).digest('hex');
      } else throw new Error('Release artifacts must contain only regular files and directories.');
    }
  }
  inventory(output);
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  writeFileSync(
    join(output, 'release.json'),
    JSON.stringify(
      {
        mode,
        builtAt: new Date().toISOString(),
        node: process.version,
        revision: revision.status === 0 ? revision.stdout.trim() : null,
        dirty: status.status === 0 ? Boolean(status.stdout.trim()) : null,
        publicConfig: Object.fromEntries(
          Object.entries(env).filter(([key]) => key.startsWith('EXPO_PUBLIC_')),
        ),
        files,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Prepared ${relative(root, output)} (${mode}); review release.json before publishing.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
