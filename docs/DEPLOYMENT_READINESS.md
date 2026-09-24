# Chalkwise deployment readiness and feature inventory

Reviewed September 24, 2026, on `integration`, starting at `d90c5fd` with an
existing untracked `WorkspaceControls.tsx`. This report covers the local patch;
it is not a record of an AWS deployment. No dependencies were installed, schema
applied, cloud resources changed, or commits/pushes made.

## Readiness decision

The existing product is a substantial small-pilot foundation. The release path
now has stricter configuration, regression coverage, explicit web artifacts and
reviewable hosting configuration. **Production acceptance remains open.** Do not
invite students onto the replacement backend until the live checks below pass.

This scope hardens existing behavior for 10–20 users. It does not implement the
later notebook, practice, research or enterprise milestones in
[PROJECT_PLAN.md](PROJECT_PLAN.md). AWS remains the established deployment target.

## Features implemented today

“Implemented” means present in the inspected app/API, with automated tests where
noted. It does not imply a verified live provider or physical-device workflow.

| Area | Current behavior | Limits |
| --- | --- | --- |
| Accounts | Cognito sign-up, emailed confirmation code, sign-in, password reset, sign-out; native refresh tokens in SecureStore | Web sessions are in memory and require sign-in after reload; MFA/SSO challenge flows are not implemented |
| Student workspace | Profile editing, course creation/enrollment, dashboard, course/notebook browsing, local search and review queue | Current auth flow requires a course; there is no course-optional inbox |
| Photo capture | Continuous camera screen, blur/exposure feedback, retake/keep controls, up to six photos in a session | Desktop drag/drop, pasted notes, PDF/audio/video ingestion are not implemented |
| Photo storage | Staged pending/ready uploads, size/type checks, immutable S3 objects, SHA-256 integrity, stable retry IDs, private signed URLs | Retry IDs survive the client process, not app termination; originals are not deleted by current APIs |
| AI notes | Each photo is transcribed, then those transcripts are organized into a title, summary, concepts, key points and source-mentioned tasks/exams | Full extraction/source warnings are not persisted for inspection; lexical claim filtering is not semantic verification |
| Study tools | Source-based questions, five-question/four-option quizzes, recall before reveal, explicit again/good/easy review choices | No saved practice sets, attempts, progressive hints or adaptive mastery model |
| Social | Name-based discovery, friend requests, acceptance, explicit per-notebook sharing, independent notebook/photo copies | API sharing requires accepted friendship plus course enrollment; no automatic missed-class detection or push notifications |
| User interface | Responsive web/native navigation, light/dark themes, loading/error/retry states and populated demo | Interactive browser/accessibility and physical-device acceptance are still required |
| Backend | Fastify/TypeScript, PostgreSQL with a non-owner RLS role, Cognito JWT verification, S3, Gemini, validation and safe errors | One process with in-memory quotas; list endpoints have caps without pagination |
| Compatibility | Mock, API and preserved Supabase service adapters | Mock data changes are in memory; mock uploads and AI deliberately reject; legacy behavior must not be represented as the new private sharing model |

Evidence: [services](../src/services), [screens](../src/app),
[API routes](../server/src/app.ts), [repository](../server/src/repository.ts),
[analysis pipeline](../server/src/analysis.ts) and [contracts](../SHARED_CONTRACTS.md).

## Changes in this patch

- Fixed the 10-second socket idle timeout that could disconnect valid AI work.
  A real HTTP regression waits longer than ten seconds and receives its response.
- Keyed authenticated quotas by verified user rather than the load balancer's
  shared address. Health checks are exempt. Tests exercise independent users,
  AI limits, forged forwarded headers and repeated health probes.
- Added generated `X-Request-Id` correlation and structured route/status/timing
  logs. Profile search queries, credentials and payloads are excluded.
- Rejected database URL options, including `ssl=0`, that could override verified
  TLS. Validate PostgreSQL URLs, PEM bundles, Cognito region, nonempty exact web
  origins and the production AI key. Configuration errors name fields without
  printing submitted secrets.
- Handle idle PostgreSQL connection errors without an unhandled-event crash.
  Discard a connection if rollback fails so uncertain transaction identity cannot
  return to the pool; preserve the original operation error.
- Added explicit API/demo release builds, public-variable validation, dotenv
  isolation, source revision/dirty status and SHA-256 artifact inventories.
- Prepared CloudFront route rewriting and an ECS task template with health
  checks, a non-root user, read-only filesystem and Secrets Manager references.
  These are reviewable configuration, not provisioned infrastructure.
- Added a Docker liveness probe, expanded secret-file exclusions, and embedded
  the public RDS CA bundle through a checksum-pinned download. The downloaded
  bundle parsed as 108 certificates; no live TLS connection was tested.
- Extended CI with dependency gates, both web build modes, reviewable artifacts,
  and a container startup/readiness/auth/shutdown check against its disposable
  PostgreSQL service. No production credentials or deployment job were added.
- Removed one unsupported React Native outline declaration from the existing
  untracked component; preserved its other content. Formatted two existing files
  that blocked the repository's formatting check, with no behavior change.

Run the commands in the [AWS runbook](architecture/AWS_DEPLOYMENT.md). The new
release command is `node scripts/build-release.mjs` with explicitly supplied API
identifiers; `--demo` writes a separate demo artifact. Neither command deploys.

## Verification record

Local runtime: Node `v26.0.0`. CI and the container target Node 22; that environment
still needs its first CI run. Source dependencies and lockfiles were unchanged.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed after the one-line style repair |
| `npm run typecheck --prefix server` | Passed |
| App/release and API tests | 76 passed, 0 failed, 0 skipped; includes the real localhost socket test |
| `npm run test:legacy` | Passed: 23 analysis, 21 question and 21 quiz scenarios, plus existing timeout/type/service assertions |
| `npm run format:check` | Passed after formatting the two existing failures |
| `git diff --check` | Passed |
| Ordinary Expo web export | Passed: 16 routes |
| Explicit API and demo release exports | Passed: 16 routes each; API uses deliberately non-live test identifiers |
| Root dependency audit | 14 moderate findings, 0 high/critical; inherited Expo/router/tooling paths need review before public release |
| Server production dependency audit | 0 findings at review time |
| Public RDS bundle | Downloaded from AWS, parsed, and SHA-256 pinned in Dockerfile |
| PostgreSQL RLS integration | **Skipped**: no explicitly configured disposable `TEST_DATABASE_URL`; not counted as a pass |
| Container build/startup | **Unverified locally**: Docker daemon unavailable; CI check prepared |
| Browser interaction | **Unverified**: Browser skill read, but its required browser-control tool is unavailable in this session |
| Native devices | **Unverified**: no usable iOS simulator (`simctl` unavailable) or physical device connected through tooling |
| AWS/Gemini/backup restore | **Unverified**: no provisioned target or live acceptance run in this task |

The initial full check stopped on the pre-existing unsupported style. Automated
layers were subsequently run individually so a failed or skipped external gate
could not hide the results of other checks. Ordinary tests use fake provider
boundaries and spend no Gemini quota. No database was provisioned or migrated.

## Remaining launch gates

1. Provision/review the AWS resources and actual domain, secret references, pilot
   signup policy and network paths. Replace every ECS template placeholder. Review
   task sizes and cost alerts. Full CDK infrastructure is still planned work.
2. Run CI on the intended revision: Node 22 checks, RLS against real PostgreSQL,
   container build and startup. Review dependency findings and scan the actual
   image. Rebuild artifacts with real public identifiers, not CI fixtures.
3. Rehearse account confirmation/reset, one/six-photo capture, retry, originals,
   AI and review persistence. Exercise two/three-account private/sharing/copy
   isolation, revocation, expired tokens and signed URLs against real services.
4. Verify website direct links and refresh through CloudFront, keyboard and
   screen-reader access, permission denial, mobile camera and SecureStore restore.
5. Demonstrate backup restore and record recovery time/data loss window; exercise
   SIGTERM, database/S3/provider failure and rollback. Configure alarms and a
   support/incident procedure before inviting students.
6. Review AI output on representative consented/redacted sources. Known negation
   and cross-problem deadline errors remain in the lexical filter; never present
   that filter as proof of source truth. Record pilot limitations for foreground
   processing, in-memory web sessions and account-data export/deletion gaps.

## What would make this a strong engineering portfolio project?

Recommendation: finish one reliable, measurable student workflow, then show the
engineering evidence behind it. The priorities below align with the security,
reliability, operations, performance and cost concerns in the
[AWS](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html),
[Google Cloud](https://docs.cloud.google.com/architecture/framework) and
[Azure](https://learn.microsoft.com/en-us/azure/well-architected/) architecture
frameworks. This is an engineering recommendation, not a claim about hiring
requirements or a certification.

| Priority | Addition | Evidence to show |
| --- | --- | --- |
| 1 | Editable notebooks with persisted source references, revisions, ordering and visible partial failures | Correct a misread equation, reopen it, inspect its original, recover a conflict without losing either edit |
| 2 | Durable processing jobs with bounded concurrency, retry/backoff, leases and idempotent publication | Kill the worker during upload/analysis, restart it and finish once without losing originals |
| 3 | Desktop uploads, pasted text and bounded PDF ingestion | Keyboard-accessible import; corrupt/encrypted/oversized input handling; page-level source links |
| 4 | Persisted generated practice, attempts, hints and review | Problems tied to a notebook revision; checked answer consistency; attempts survive later note edits |
| 5 | Versioned AI evaluation and consented research | Dataset/prompt/model versions, measured extraction/citation errors, injection tests, zero searches without approval |
| 6 | Reproducible infrastructure and release operations | Reviewed CDK changes, short-lived CI cloud identity, staging acceptance, image digests, rollback and a demonstrated restore |
| 7 | Observability, capacity and cost measurement | Request traces, upload-to-notebook success rate, measured p50/p95 latency, failures and cost per successful notebook |
| 8 | Data lifecycle and access maturity | User export/deletion, audited sharing changes and retention; institution SSO/admin controls only when a real customer needs them |

An effective demonstration would upload three out-of-order boards, flag an
unreadable region, preserve a student correction, generate useful practice,
recover from a forced interruption, and show that a second account cannot read
the private notebook. Pair that with a reproducible deployment, an evaluation
report, real pilot feedback and a short incident/restore record.

Keep the current modular monolith and one-region pilot while measuring it. Add
pagination, more replicas or new infrastructure when actual limits demand them.
Multi-cloud deployment, Kubernetes and microservices add little evidence until
there is a concrete problem they solve.
