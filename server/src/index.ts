import { readConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { cognitoVerifier } from './auth.ts';
import { s3Storage } from './storage.ts';
import { repository } from './repository.ts';
import { geminiAi } from './ai.ts';
import { buildApp } from './app.ts';

const config = readConfig();
const database = await openDatabase(config);
const app = await buildApp({
  repo: repository(database, s3Storage(config.AWS_REGION, config.S3_BUCKET)),
  verify: cognitoVerifier(config.AWS_REGION, config.COGNITO_USER_POOL_ID, config.COGNITO_CLIENT_ID),
  ai: geminiAi(config.GEMINI_API_KEY, config.GEMINI_MODEL),
  ping: database.ping,
  origins: config.origins,
  logger: true,
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await app.close();
  await database.close();
}
process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  await stop();
  throw error;
}
