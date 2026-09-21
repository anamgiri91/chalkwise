# AWS deployment and cutover runbook

This is a preparation document. No AWS resources were provisioned, no migration was applied, no existing data was moved, and no code was pushed or deployed during implementation.

## Small-pilot topology

Use one API container in ECS Fargate behind an HTTPS Application Load Balancer, one private RDS PostgreSQL instance, a private S3 bucket, and Cognito. Use one region, five pooled database connections and one API task initially. The request-rate limit is in process; reassess it before adding API replicas. Avoid a queue, Kubernetes, vector database or separate microservices until a measured requirement justifies them.

AWS hosting can incur ongoing costs even with no active users. Choose instance/task sizes and budget alerts in the target account before provisioning; no specific monthly price is assumed here.

## Provisioning order

1. **Network and database.** Place RDS in private subnets. Restrict port 5432 to the API task security group and the approved migration path. Enable storage encryption and automated backups. Create a dedicated migration identity and separate API login. Download the [AWS RDS CA bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).
2. **Schema review.** Review `server/infra/runtime-role.sql` and `server/migrations/001_initial.sql`. Apply them only to the new database after explicit approval. Grant the runtime login `chalkwise_app`, without superuser, BYPASSRLS, schema ownership, or membership in the migration role. Exercise the isolation suite in a disposable database first.
3. **Cognito.** Create a user pool with email usernames, automatic email verification and a minimum 12-character password policy requiring uppercase, lowercase, numbers and symbols. Use a public client without a secret. Enable USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH; use a five-minute access-token lifetime. Enable token revocation, disable refresh-token rotation and remembered devices for the implemented client. Set the refresh lifetime appropriate for the pilot. Mandatory MFA/federated/challenge flows need a further client implementation before enabling them.
4. **Pilot eligibility.** Configure a Cognito pre-sign-up trigger that enforces the accepted institution domain or an invitation list. The original TXST pilot requires `txstate.edu`; choose a different policy only deliberately. Confirm it rejects an ineligible email through direct Cognito API calls, not just through the mobile form. Keep email confirmation enabled.
5. **S3.** Enable Block Public Access and encryption. The API task needs GetObject and PutObject only for the selected materials bucket. The client never receives AWS credentials. No public URLs or bucket listing are used. A five-minute presigned URL cannot be instantly revoked after it has been issued.
6. **Secrets and configuration.** Put DATABASE_URL and GEMINI_API_KEY in Secrets Manager. Mount the RDS CA as a file and set DATABASE_CA_FILE. Set AWS_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, S3_BUCKET and exact HTTPS WEB_ORIGINS. Use the task IAM role for S3. Use `server/.env.example` as the configuration inventory.
7. **Container.** Build from the repository root with `docker build -f server/Dockerfile -t chalkwise-api .`. Review the image before publishing. Set NODE_ENV=production, HOST=0.0.0.0 and PORT=3001. Configure `/health/ready` as the load-balancer health endpoint. Allow 90 seconds for AI requests; use a compatible load-balancer timeout. The process handles SIGTERM and closes its pool gracefully.
8. **App.** Set EXPO_PUBLIC_DATA_MODE=api, EXPO_PUBLIC_API_URL to the HTTPS API origin, and matching public AWS region/Cognito client ID. Rebuild the native development app after adding SecureStore. The public variables contain no database passwords, Gemini key or AWS secret access key.

## Acceptance before switching real users

- A newly confirmed account can sign in, save a profile, join/create a course, capture one photo, save notes, reopen originals, ask a question, generate a quiz, and record a review.
- Repeat a failed upload with the same upload UUID. Verify a pending intent becomes ready without overwriting or duplicating the original. Confirm a mismatched payload is rejected for an existing UUID.
- A second account sees no private notes, pending photo metadata, or signed URLs for the first account. Even after accepting a friendship, private notes remain hidden. Opting in to sharing plus recipient enrollment permits the intended notebook only.
- A third account cannot read the shared notebook without the accepted relationship. Turning off sharing prevents new reads and new signed URLs. Previously downloaded material and independent copies remain available to their recipients.
- A lost save response can be retried with the same idempotency key. An already-attached photo cannot be reassigned. Copy retries produce one independent notebook and complete originals.
- Denied/expired tokens, wrong-client tokens and oversized requests fail with safe errors. API logs contain no authorization header, tokens, credentials or photo bytes. Local sign-out clears the stored refresh token; an already-issued access JWT may remain verifiable until its five-minute expiry.
- Profile/enrollment/network failures show retry states. They must not silently create a second profile or route an existing user through onboarding again.
- Test native SecureStore restore, large text, dark mode, a screen reader, camera permission denial and app backgrounding on a physical device. Camera capture supports multiple local photos, but the existing processing flow currently handles only one photo; multi-photo processing and durable background resume are deferred.

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
