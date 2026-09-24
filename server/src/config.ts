import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || undefined : value),
  z.string().optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  DATABASE_URL: z.url(),
  DATABASE_CA_FILE: optionalText,
  AWS_REGION: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/),
  COGNITO_USER_POOL_ID: z.string().regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/),
  COGNITO_CLIENT_ID: z.string().trim().min(1),
  S3_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  WEB_ORIGINS: z.string().default('http://localhost:8081'),
  GEMINI_API_KEY: optionalText,
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+$/)
    .default('gemini-3.1-flash-lite'),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsedConfig = schema.safeParse(env);
  if (!parsedConfig.success) {
    // Never print submitted values: this configuration contains credentials.
    const fields = [...new Set(parsedConfig.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid server configuration: ${fields.join(', ')}.`);
  }
  const config = parsedConfig.data;
  if (config.NODE_ENV === 'production' && !config.DATABASE_CA_FILE) {
    throw new Error('Production requires DATABASE_CA_FILE for verified PostgreSQL TLS.');
  }
  const url = new URL(config.DATABASE_URL);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  ) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name.');
  }
  if (url.search) {
    // pg merges URL options over the explicit pool configuration. In particular,
    // ssl=0 silently disables the verified TLS configured below.
    throw new Error('DATABASE_URL must not contain query options; use DATABASE_CA_FILE for TLS.');
  }
  if (!config.COGNITO_USER_POOL_ID.startsWith(`${config.AWS_REGION}_`)) {
    throw new Error('COGNITO_USER_POOL_ID must belong to AWS_REGION.');
  }
  if (config.NODE_ENV === 'production' && !config.GEMINI_API_KEY) {
    throw new Error('Production requires GEMINI_API_KEY for the capture and study workflows.');
  }
  const origins = config.WEB_ORIGINS.split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!origins.length) throw new Error('WEB_ORIGINS must contain at least one exact origin.');
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('WEB_ORIGINS must contain exact HTTP or HTTPS origins.');
    }
    if (
      parsed.origin !== origin ||
      !['http:', 'https:'].includes(parsed.protocol) ||
      (config.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    ) {
      throw new Error('WEB_ORIGINS must contain exact origins, using HTTPS in production.');
    }
  }
  let ssl: { ca: string; rejectUnauthorized: true } | undefined;
  if (config.DATABASE_CA_FILE) {
    try {
      const ca = readFileSync(config.DATABASE_CA_FILE, 'utf8');
      const certificates = ca.match(
        /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
      );
      if (!certificates?.length) throw new Error('Missing certificates');
      for (const certificate of certificates) new X509Certificate(certificate);
      ssl = { ca, rejectUnauthorized: true };
    } catch {
      throw new Error('DATABASE_CA_FILE must be a readable PEM certificate bundle.');
    }
  }
  return {
    ...config,
    origins,
    ssl,
  };
}
export type Config = ReturnType<typeof readConfig>;
