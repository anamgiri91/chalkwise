# ClassLens API

Node 22.18+ / TypeScript / Fastify / PostgreSQL. Run commands from `server/` unless specified. This service does not use Supabase. Existing Supabase code is a separate migration fallback in the app.

## Setup

1. Install locked dependencies with `npm ci`.
2. Provision a PostgreSQL database and distinct migration/runtime identities. Review `infra/runtime-role.sql`, then `migrations/001_initial.sql`. Apply them only after explicit approval; startup never applies migrations. Grant `classlens_app` to the runtime login, never the migration role. The API refuses a superuser, BYPASSRLS login or table-owner membership.
3. Configure a Cognito user pool with email verification, email sign-in, a public app client with **no client secret**, `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`. Use 5-minute access tokens, disable remembered devices and refresh-token rotation for this initial client implementation. The confirmation flow uses an emailed code. Enforce the pilot's email domain or invitation policy through a Cognito pre-sign-up trigger; a client-side domain check is not an access control. Do not disable verification.
4. Provision a private S3 bucket with Block Public Access and default encryption. Use an IAM role limited to GetObject and PutObject in that bucket. No bucket listing or deletion is required by the API. Add a lifecycle policy only after reviewing pending-upload retention needs.
5. Copy `.env.example` to `.env`; supply real values. Use AWS SDK standard credentials locally, a task IAM role on AWS, and Secrets Manager for database and Gemini credentials. No credentials belong in `EXPO_PUBLIC_*` variables.
6. Run `npm run dev`. Configure the app's API URL and matching Cognito identifiers separately. `/health/live` tests the process; `/health/ready` checks the database.

For RDS, set `DATABASE_CA_FILE` to the AWS RDS CA bundle. Production refuses an absent CA; TLS certificate checks are never disabled. Do not add `sslmode` or certificate parameters to DATABASE_URL. Restrict RDS networking to the API's security group and require HTTPS at ingress. For a physical device in local development use an explicit LAN host/API URL; 127.0.0.1 on the phone is the phone itself.

## Routes

All `/v1` routes require `Authorization: Bearer <Cognito access token>`. Identity is never taken from input. Responses use the mobile domain's camelCase fields; times are serialized ISO strings. Missing individual courses, notes and profiles return null. Errors are `{error:{code,message,requestId}}`.

| Area | Routes |
| --- | --- |
| Session/profile | GET `/me`, GET/PUT `/profile`, GET `/profiles?q=`, GET `/profiles/:id` |
| Courses | GET/POST `/courses`, GET `/courses/:id`, GET `/enrollments`, PUT/DELETE `/enrollments/:id` |
| Notes | GET `/lectures?courseId=`, GET `/lectures/:id`, POST `/lectures` with UUID `Idempotency-Key` |
| Sharing | GET/PUT `/lectures/:id/sharing`, GET `/shared-lectures?owners=uuid,uuid`, POST `/lectures/:id/copy` |
| Friends | GET/POST `/friendships`, PUT `/friendships/:id/accept` |
| Photos | POST `/materials` with `{id,mimeType,data}` (base64), GET `/materials?lectureId=`, PUT `/materials/:id/lecture`, GET `/materials/:id/url` |
| AI | POST `/ai/analyze` with materialId, `/ai/ask` with lectureId/question, `/ai/quiz` with lectureId |
| Review | GET `/reviews`, PUT `/lectures/:id/review` with confidence: again/good/easy |

List caps are 500 courses/owned notes/reviews, 100 shared notes, 20 profile search results. Pagination is a future requirement before growing beyond this pilot. AI is capped at six originals and 10 MiB total; exceeding a bound fails explicitly instead of silently omitting context.

## Upload and copy recovery

Uploads persist a pending metadata intent before writing S3, then mark it ready. A caller must retain the UUID when retrying. An existing UUID with different content is a conflict. Conditional S3 writes and SHA-256 metadata protect immutable originals and recover lost responses. Pending rows are excluded from originals/AI reads. Failed requests may leave pending intents; do not remove the original locally until the operation completes.

Notebook copying uses deterministic IDs, copies bytes to independent paths, rechecks source visibility, and publishes the copied notebook and material rows in one database transaction. A storage failure reports failure and retries reuse paths. An aborted copy can leave unreferenced S3 objects; cleanup is an explicitly reviewed operator task. This deliberately avoids claiming a distributed database/S3 transaction exists.

Sharing is per-note and opt-in. Accepted friends enrolled in the note's course can read shared notes. Revocation prevents new reads and signed URLs; an already issued URL lasts up to five minutes. Downloads and independent copies cannot be recalled. Course membership is not an attendance record.

## Verification

```sh
npm run typecheck
npm test
# From repository root; no dependencies needed on supported Node:
node --test tests/domain.test.ts
```

`npm run test:db` is a separate opt-in integration test. Set TEST_DATABASE_URL to a prepared **local** runtime database ending in `_test`, after reviewing/applying its schema separately. The test uses RLS-protected fixture writes inside a rolled-back transaction. It does not read DATABASE_URL, provision a database or apply migrations. Without the explicit test URL it reports a skip, not a pass.

Route tests inject repository/provider boundaries; they do not establish live database or cloud behavior. Signed-JWT tests use real RSA signatures. Run the database suite and the two-account device checklist before production cutover.

Build the API image from the repository root: `docker build -f server/Dockerfile -t classlens-api .`. This image runs as a non-root user. Deploy later to one ECS service with an HTTPS load balancer, private RDS and S3; AWS provisioning and deployment are not performed by this change.
