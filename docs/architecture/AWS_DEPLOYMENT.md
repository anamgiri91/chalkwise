# AWS deployment and cutover runbook

This is a preparation document. No AWS resources were provisioned, no migration was applied, no existing data was moved, and no code was pushed or deployed during implementation.

The [September 24 readiness report](../DEPLOYMENT_READINESS.md) records the current
feature inventory, local hardening, verified checks and remaining launch gates.

## Small-pilot topology

Use one API container in ECS Fargate behind an HTTPS Application Load Balancer, one private RDS PostgreSQL instance, a private originals bucket, and Cognito. Host the exported website in a separate S3 bucket behind CloudFront. Use one region, five pooled database connections and one API task initially. Authenticated rate limits use verified user IDs and remain in process; reassess them before adding API replicas. Avoid a queue, Kubernetes, vector database or separate microservices until a measured requirement justifies them.

AWS hosting can incur ongoing costs even with no active users. Choose instance/task sizes and budget alerts in the target account before provisioning; no specific monthly price is assumed here.

## Provisioning order

1. **Network and database.** Place RDS in private subnets. Restrict port 5432 to the API task security group and the approved migration path. Enable storage encryption and automated backups. Create a dedicated migration identity and separate API login. Download the [AWS RDS CA bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).
2. **Schema review.** Review `server/infra/runtime-role.sql` and `server/migrations/001_initial.sql`. Apply them only to the new database after explicit approval. Grant the runtime login `chalkwise_app`, without superuser, BYPASSRLS, schema ownership, or membership in the migration role. Exercise the isolation suite in a disposable database first.
3. **Cognito.** Create a user pool with email usernames, automatic email verification and a minimum 12-character password policy requiring uppercase, lowercase, numbers and symbols. Use a public client without a secret. Enable USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH; use a five-minute access-token lifetime. Enable token revocation, disable refresh-token rotation and remembered devices for the implemented client. Set the refresh lifetime appropriate for the pilot. Mandatory MFA/federated/challenge flows need a further client implementation before enabling them.
4. **Pilot eligibility.** Configure a Cognito pre-sign-up trigger that enforces the accepted institution domain or an invitation list. The original TXST pilot requires `txstate.edu`; choose a different policy only deliberately. Confirm it rejects an ineligible email through direct Cognito API calls, not just through the mobile form. Keep email confirmation enabled.
5. **S3.** Enable Block Public Access and encryption. The API task needs GetObject and PutObject only for the selected materials bucket. The client never receives AWS credentials. No public URLs or bucket listing are used. A five-minute presigned URL cannot be instantly revoked after it has been issued.
6. **Secrets and configuration.** Put DATABASE_URL and GEMINI_API_KEY in Secrets Manager. The image includes AWS’s public RDS CA bundle at `/app/rds-ca.pem`, fetched at build time with a pinned SHA-256 checksum. Review certificate validity and update that checksum deliberately when AWS changes its bundle; a mismatch fails the build. Local development can set DATABASE_CA_FILE to a separately downloaded bundle. Do not embed credentials in the image. Set AWS_REGION, matching COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID, S3_BUCKET and exact HTTPS WEB_ORIGINS. Production startup requires a readable PEM CA bundle and an AI key. DATABASE_URL must have no query options: node-postgres can otherwise override explicit TLS settings. Use the task IAM role for S3. Use `server/.env.example` as the configuration inventory.
7. **Container.** Build from the repository root with `docker build --platform linux/amd64 -f server/Dockerfile -t chalkwise-api .`. Review the image before publishing. Set NODE_ENV=production, HOST=0.0.0.0 and PORT=3001. Configure `/health/ready` as the load-balancer health endpoint. Use the reviewed [`ecs-task.template.json`](../../server/infra/ecs-task.template.json), replacing every placeholder. It includes an explicit `/health/live` ECS healthCheck, non-root user, read-only filesystem and Secrets Manager references. Define the network, service, IAM roles, secrets and log group separately; the template does not provision them. Health checks do not consume request quotas. Use an ALB idle timeout of 120 seconds, task `stopTimeout` of 120 seconds and target deregistration delay of at least 120 seconds. These accommodate the 75-second analysis budget, storage/database overhead and 90-second client timeout; measure the full path during acceptance. The API socket idle timeout is 100 seconds. Its 90-second `requestTimeout` limits receiving a request, not handler execution. SIGTERM drains requests before closing the pool. Pin the reviewed image by digest and exercise SIGTERM with an in-flight analysis before release.
8. **App.** Set EXPO_PUBLIC_DATA_MODE=api, EXPO_PUBLIC_API_URL to the HTTPS API origin, and matching public AWS region/Cognito client ID. Rebuild the native development app after adding SecureStore. The public variables contain no database passwords, Gemini key or AWS secret access key.

## Acceptance before switching real users

- A newly confirmed account can sign in, save a profile, join/create a course, capture one photo, save notes, reopen originals, ask a question, generate a quiz, and record a review.
- Repeat a failed upload with the same upload UUID. Verify a pending intent becomes ready without overwriting or duplicating the original. Confirm a mismatched payload is rejected for an existing UUID.
- A second account sees no private notes, pending photo metadata, or signed URLs for the first account. Even after accepting a friendship, private notes remain hidden. Opting in to sharing plus recipient enrollment permits the intended notebook only.
- A third account cannot read the shared notebook without the accepted relationship. Turning off sharing prevents new reads and new signed URLs. Previously downloaded material and independent copies remain available to their recipients.
- A lost save response can be retried with the same idempotency key. An already-attached photo cannot be reassigned. Copy retries produce one independent notebook and complete originals.
- Denied/expired tokens, wrong-client tokens and oversized requests fail with safe errors. API logs contain no authorization header, tokens, credentials or photo bytes. Local sign-out clears the stored refresh token; an already-issued access JWT may remain verifiable until its five-minute expiry.
- Profile/enrollment/network failures show retry states. They must not silently create a second profile or route an existing user through onboarding again.
- Test native SecureStore restore, large text, dark mode, a screen reader, camera permission denial and app backgrounding on a physical device. API processing supports one to six photos. Durable recovery after process termination and background processing are deferred; document this pilot limitation and verify foreground failure/retry behavior.

## Website release

Use the installed, locked dependencies and Node 22.18+ (CI and the image use Node 22).
Run `npm run check` and review both dependency audits before building. No release
script installs packages, applies migrations or deploys resources.

Set only the real public identifiers for the intended environment. For example,
replace the illustrative API domain and client ID before running:

```sh
EXPO_PUBLIC_DATA_MODE=api \
EXPO_PUBLIC_API_URL=https://api.your-domain.example \
EXPO_PUBLIC_AWS_REGION=us-east-1 \
EXPO_PUBLIC_COGNITO_CLIENT_ID=yourpublicclientid \
node scripts/build-release.mjs
```

This produces `dist/api/` and a `release.json` inventory with SHA-256 checksums,
public configuration, source revision and dirty-tree status. The script rejects
implicit mock mode, non-HTTPS API targets, missing identity configuration and
unreviewed `EXPO_PUBLIC_*` names. It disables dotenv loading so an ignored local
file cannot silently change the release. The task execution role needs ECR pull, scoped log writes and access to the two referenced secrets (plus KMS decrypt if required). The application task role needs only the originals bucket GetObject/PutObject permissions. The API security group must admit port 3001 only from the load balancer; private tasks need a reviewed outbound path to Cognito, S3 and Gemini.

The operator still must verify that
the public identifiers point to the intended provisioned environment.

Use `node scripts/build-release.mjs --demo` for a separate `dist/mock/` artifact.
CI builds both paths; its API identifiers use `.invalid` and **must never be
published as a live release**. Rebuild with real values after acceptance.

For the website distribution:

1. Use a private website bucket, S3 REST origin and CloudFront Origin Access
   Control with a distribution-scoped read policy. Keep original student photos
   in their separate private bucket. See [AWS OAC guidance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).
2. Attach [`web-router.js`](../../server/infra/web-router.js) as a viewer-request
   CloudFront Function (runtime 2.0). Expo's static export contains
   `/course/[id].html` and `/lecture/[id].html`; the function maps direct record
   URLs to these shells without changing the browser's URL. Other extensionless
   pages map to `.html`; assets retain their paths. The API still authorizes all
   private data. See [CloudFront URI rewriting](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html).
3. Redirect HTTP to HTTPS. Configure website-only 403/404 error responses to
   `/+not-found.html` with response status 404 and a short error TTL. Do not map
   API errors or missing JavaScript to a successful HTML response.
4. Use `Cache-Control: public,max-age=31536000,immutable` for content-hashed assets,
   and `Cache-Control: no-cache` for HTML and `release.json`. Use a cache policy
   with minimum TTL 0 for HTML so those headers are honored. Upload assets before
   HTML and keep the previous release assets during rollback. Apply HTTPS security
   headers (HSTS, nosniff, Referrer-Policy and frame protection); validate a CSP
   with the real API, Cognito and signed-S3 origins in a browser before enforcement.
5. Upload only the reviewed artifact directory when deployment is authorized.
   Verify `/`, `/login`, `/course/<real-id>` and `/lecture/<real-id>` in a fresh
   browser and on refresh, including invalid IDs, signed-out access and expired
   sessions. Unit tests of the rewrite are not a substitute for this acceptance.

## Operations before invitation

- Send structured API stdout/stderr to CloudWatch with a deliberate retention
  period. Request completion records include generated request ID, route template,
  status and duration; they omit raw queries, credentials and study content.
  `X-Request-Id` is returned to clients. Review ALB access-log privacy separately.
- Alarm on unhealthy targets, elevated 5xx/latency, database storage/connection
  pressure and provider failures. Set an account budget alert and provider quotas;
  record cost per successful notebook, not a guessed monthly bill.
- Configure ingress abuse protection for unauthenticated traffic. Application
  quotas isolate authenticated students but are not a perimeter denial-of-service
  defense, and they reset on restart. One replica is the initial supported target.
- Enable backups and restore into a separate database; verify a sample original
  and its saved notebook under the runtime role. Record the observed restore time
  and recovery point. Keep schema changes separate from automatic application
  rollout and document rollback before publishing a new image.
- Exercise database reconnect, invalid secrets/CA, provider timeouts, unavailable
  S3 and an interrupted upload. Keep durable upload recovery and data export/deletion
  as explicit product gaps until their implementations and acceptance tests exist.

## Data migration

Supabase remains a legacy adapter until this acceptance run is complete. Do not claim a database migration has happened by changing a client environment variable.

1. Take verified source backups and inventory table rows and original objects.
2. Define an explicit mapping from Supabase auth IDs to verified Cognito subjects. Profile IDs must match Cognito subjects in the new system. Supabase password hashes are not a direct Cognito import path; use a verified migration flow or password reset.
3. Transform the source records into the new schema, including owner IDs, memberships, MIME types, byte sizes and SHA-256 digests. Material paths become owner-scoped S3 object keys. Resolve demo/null owners deliberately; never assign their data to an arbitrary real user.
4. Set imported notebooks private unless the owner explicitly chooses sharing. Importing old friendship-wide access as opt-in consent would be incorrect.
5. Copy original objects, validate checksums, import metadata under the migration principal and reconcile counts. Import scripts must be reviewed against the actual source export; this implementation deliberately does not invent one without access to that data.
6. Rehearse two-account isolation and source/AI consistency against migrated samples. Retain backups and reconcile a sample of notebook copies.
7. Freeze legacy writes for the cutover window. Switch clients after validation; never dual-write to the old and new stores without a reconciliation strategy.

Rollback before new writes can use the old adapter. After new writes, reconcile those writes before rolling back; otherwise the new work disappears from the user's view. Keep old schema and objects until the retention and rollback window has been explicitly closed.

## Operational limits

Review and upload retry identities are retained in the current client process; surviving a killed app requires the later durable-capture milestone. Request rate limiting is memory-based for one process. List endpoints have documented caps without pagination. Failed or interrupted S3 copies can leave unreferenced objects; cleanup is a reviewed operator operation. This code does not claim institution-wide readiness or compliance certification.

Sources: [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html), [Cognito JWT verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html), [Cognito authentication API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html).
