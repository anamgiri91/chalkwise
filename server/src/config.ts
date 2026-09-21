import { readFileSync } from 'node:fs';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.url(),
  DATABASE_CA_FILE: z.string().optional(),
  AWS_REGION: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/),
  COGNITO_USER_POOL_ID: z.string().regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/),
  COGNITO_CLIENT_ID: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  WEB_ORIGINS: z.string().default('http://localhost:8081'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+$/)
    .default('gemini-3.1-flash-lite'),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = schema.parse(env);
  if (config.NODE_ENV === 'production' && !config.DATABASE_CA_FILE) {
    throw new Error('Production requires DATABASE_CA_FILE for verified PostgreSQL TLS.');
  }
  const url = new URL(config.DATABASE_URL);
  if (['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) => url.searchParams.has(key))) {
    throw new Error('Configure database TLS with DATABASE_CA_FILE, not URL ssl parameters.');
  }
  const origins = config.WEB_ORIGINS.split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      (config.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    ) {
      throw new Error('WEB_ORIGINS must contain exact origins, using HTTPS in production.');
    }
  }
  return {
    ...config,
    origins,
    ssl: config.DATABASE_CA_FILE
      ? { ca: readFileSync(config.DATABASE_CA_FILE, 'utf8'), rejectUnauthorized: true }
      : undefined,
  };
}
export type Config = ReturnType<typeof readConfig>;
