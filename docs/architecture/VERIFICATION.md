# Full-stack checkpoint verification

For the current deployment-hardening results and feature inventory, see the
[September 24 readiness report](../DEPLOYMENT_READINESS.md). The results below
remain the historical September 21 checkpoint and do not certify later changes.

Recorded September 21, 2026. Results apply to the full-stack checkpoint. Separate, concurrent AI/capture changes in the working directory were excluded from the verification snapshot and checkpoint commit.

## Local checks

| Check | Result | Scope |
| --- | --- | --- |
| `npx tsc --noEmit` | Passed | Expo application typecheck |
| Server TypeScript | Passed | Separate strict API project |
| App/domain tests | 17 passed | Review timing and queue behavior; capture quality; ambiguous course matching; AI parsers; session races; HTTP failures and idempotency |
| Server tests | 26 passed | Real signed JWT verification; route authentication/validation/errors; upload recovery; storage validation; provider output and failure handling |
| Legacy function harnesses | Passed | 65 request scenarios (23 analysis, 21 question, 21 quiz), plus timeout, normalization and service assertions |
| Scoped formatting | Passed | New architecture and touched application files |
| Expo web export | Passed | 16 routes exported; this is a build check, not interactive acceptance |
| `git diff --check` | Passed | Patch whitespace |

Run `npm ci`, `npm ci --prefix server`, and `npm run check` from the root to reproduce the automated checks. `npm run build:web` exports the demo. Native TypeScript execution emits a harmless module-detection warning for shared app modules; it does not skip tests.

The regression harnesses gained an API import stub because the services now support the new backend. Their existing assertions remain intact. An attempted AWS API call in legacy mode throws, so the stub does not hide accidental routing changes.

## Checks that remain open

- **Live PostgreSQL RLS:** `npm run test:db --prefix server` reported one explicit skip because TEST_DATABASE_URL was not configured. The test verifies owner isolation, private defaults, accepted/enrolled sharing, revocation, denied updates and transaction identity cleanup. It must run before cutover. No migration was applied locally or remotely.
- **Container:** Docker's daemon socket was unavailable; the image was not built locally. The workflow includes a container-build gate.
- **CI:** `.github/workflows/ci.yml` is prepared, not executed on GitHub. Its separate PostgreSQL 17 service applies scripts only inside the disposable CI database and runs tests as a non-owner runtime login.
- **Browser:** the Browser skill runtime returned no available browser. No interactive browser checks or screenshots were obtained.
- **Physical devices:** camera permissions/quality, native SecureStore restore, app backgrounding, dark mode, screen-reader behavior and enlarged text still need an iOS/Android device. A web export cannot verify these behaviors.
- **Live services:** Cognito email confirmation/password reset, private S3 behavior, Gemini results, TLS and real two/three-account access acceptance require a provisioned environment. See the [deployment checklist](AWS_DEPLOYMENT.md).

## Dependency review

The root dependency audit reported 14 moderate findings and no high or critical findings at installation/review time. They are inherited Expo transitive paths including `uuid` through Xcode tooling and `decode-uri-component` through routing/query-string dependencies. Suggested automated fixes included incompatible framework downgrades; no forced downgrade was applied. Review the advisory paths and compatible Expo updates before public launch. The server dependency installation audit reported zero vulnerabilities at that time. Audit results can change and should be rerun before release.

## Release boundary

This is an implemented small-pilot foundation with automated regression checks, not an assertion of enterprise certification or production readiness. Existing Supabase data and cloud resources were untouched. The replacement path uses a separate PostgreSQL schema, Cognito identities and private S3 originals; source-data migration and production cutover are still operational work.

The current processing flow handles one photo. Multi-photo processing, durable capture recovery after process termination, background notifications and hardware pairing are deferred. AI output is validated structurally and prompted to stay within the source; model accuracy still needs evaluation against representative student material.

Complete the live isolation test, cloud acceptance, dependency review, backup/restore rehearsal and physical-device checklist before inviting real users onto the new backend.

## Study features (September 2026)

Reminders, editable notes linked to photos, class-time filing, weekly catch-up and saved
quizzes.

Verified in this environment:

- `npm run check`: typecheck of app and server, 65 app and 49 server tests, formatting.
- Database tests against disposable local PostgreSQL 16 with migrations 001–003 and
  the restricted runtime login. They cover owner-only class times, note edits and quiz
  attempts, and repository round-trips for sources, edits, class times and attempts.
- Web demo in Chromium at phone and desktop width, light and dark: note-to-photo chips,
  the photo viewer, editing and saving notes, the class-times editor with loosely typed
  times, the Overview catch-up card, CatchUp "This week", copying a classmate note, the
  Profile reminders setting, and the Overview today line. No console errors, except the
  known hydration warning below.
- Planner, schedule and catch-up logic tested in UTC, America/Chicago and Asia/Kolkata.

Still needs manual verification:

- **Reminders on a device.** Permission prompt, delivery at the planned time, the
  Android channel, and tapping a reminder while the app is closed or open. The web build
  has no scheduled notifications. A native build is needed because `app.json` gained
  the `expo-notifications` plugin.
- **Quiz history and quiz-to-review** against the live API with Gemini. Mock mode
  deliberately cannot generate quizzes, so this path is covered by API and unit tests
  only.
- **Note sources from real captures.** The matcher is unit-tested on sample
  transcripts; check the photo links on a few real multi-photo sessions.
- **Camera "in class now" label** on a device during a scheduled class.

Known, pre-existing: the static web export logs React hydration error #418 on the
Overview at desktop widths. It also occurs on the code before this work (checked at
`7ff3c8d`). The likely cause is the shell choosing its layout from the window width,
which differs between prerender and the browser.
