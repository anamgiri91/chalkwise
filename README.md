# Chalkwise

**Capture a lecture. Check the source. Remember what matters.**

Chalkwise is a study workspace for a pilot of 10–20 college students. It connects lecture photos, organized notes, source-based questions, quizzes, and a personal review queue. The redesigned home shows the student's courses, recent notes, and next review. Notebooks keep originals separate from AI output and let students recall a topic before revealing the notes.

The new backend uses PostgreSQL, Amazon Cognito, and private Amazon S3. It is ready for deployment preparation on AWS; no cloud resources have been provisioned and no existing Supabase data has been migrated. The legacy adapter stays available until live acceptance and cutover are complete.

## Implemented experience

- Email confirmation, sign-in, password reset, profile editing, course creation and enrollment.
- Camera capture with blur/exposure checks, and capture sessions of up to six photos uploaded and analyzed together into one set of notes.
- Course and notebook search, original-photo access, AI questions and quizzes in live modes.
- Active recall with explicit confidence choices: review again in four hours, one day, or three days. These are review intervals, not mastery estimates.
- Friend requests and opt-in notebook sharing in API mode. Only accepted friends enrolled in the course can read a shared notebook. Recipients can save an independent copy.
- Responsive mobile/web navigation, light/dark themes, loading/error states, and a populated local demo.

Durable resume after app termination, background processing, notifications, automatic attendance inference, and hardware integration remain future work. Demo uploads and AI are intentionally unavailable; demo review and browsing work locally.

## Architecture

```mermaid
flowchart LR
  Screens[Expo screens] --> Services[Typed services]
  Services --> Demo[In-memory demo]
  Services --> API[Fastify API]
  Services -. migration fallback .-> Legacy[Legacy Supabase]
  Screens --> Auth[Amazon Cognito]
  API --> DB[(PostgreSQL / Amazon RDS)]
  API --> Storage[Private Amazon S3]
  API --> AI[Gemini]
```

The API verifies Cognito access tokens, validates request bodies, and uses parameterized queries with a transaction-local user identity. PostgreSQL row-level security provides a second access boundary. Runtime credentials cannot own the tables or bypass RLS. Photos use immutable object keys, integrity metadata, recoverable upload intents, and short-lived signed URLs. Database scripts are separate from application startup.

The app stores native refresh tokens in SecureStore; web sessions remain in memory. AI credentials stay on the server. Original photos and explicit sharing choices remain under the student's control. Generated content still needs checking against the source.

## Run the demo

Use Node.js 22.18 or later and npm. From the repository root:

```sh
npm ci
npm ci --prefix server
cp .env.example .env.local
npm run web
```

The template defaults to `EXPO_PUBLIC_DATA_MODE=mock`. No cloud credentials are needed for the demo. Use `npm start` for the Expo development server, or `npm run ios` / `npm run android` with the corresponding native development tools installed. Native authentication needs a build containing SecureStore.

## Run against the API

First follow [API setup](server/README.md) to prepare a separate PostgreSQL database, Cognito pool/client, and private S3 bucket. Review schema scripts before applying them. Configure the server using `server/.env.example`, then run:

```sh
npm run dev --prefix server
```

Set these public identifiers in the app's `.env.local` and restart Expo:

```dotenv
EXPO_PUBLIC_DATA_MODE=api
EXPO_PUBLIC_API_URL=https://your-api.example.com
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_COGNITO_CLIENT_ID=your-public-app-client-id
```

These identifiers are public configuration. Database passwords, Gemini keys, and AWS secret keys belong only on the server. Follow the [AWS deployment and cutover runbook](docs/architecture/AWS_DEPLOYMENT.md) for TLS, least-privilege roles, pilot eligibility, backups, acceptance checks, and source-data migration.

| Data mode | Behavior |
| --- | --- |
| `mock` (default) | Populated demo; changes are in memory and reset on restart |
| `api` | Cognito authentication and the new PostgreSQL/S3 API |
| `supabase` | Preserved legacy backend for migration and rollback preparation |

## Tests and checks

```sh
npm run check          # App/server typechecks, tests, legacy checks, scoped formatting
npm run build:web      # Expo production web export
git diff --check
```

The suite covers signed-token rejection, API validation and access gates, safe errors, upload recovery, session races, review scheduling, AI result validation, multi-photo session analysis, transcript support checking, capture quality, and ambiguous course matching. Legacy Edge Function harnesses remain part of the ordinary test command.

PostgreSQL isolation tests run separately against a prepared local disposable database using the restricted runtime login:

```sh
TEST_DATABASE_URL=postgres://runtime:password@localhost:5432/chalkwise_test npm run test:db --prefix server
```

Without that explicit URL the database test is skipped. Ordinary tests never apply migrations or use production credentials. GitHub Actions is configured to run the checks, web export, container build, and isolation test against a disposable PostgreSQL service. Local passing tests do not establish live AWS or physical-device behavior; see the [verification record](docs/architecture/VERIFICATION.md) for results and outstanding checks.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/app`, `src/components` | Expo screens and reusable UI |
| `src/services` | Data adapters and service boundary |
| `src/features`, `src/types` | Domain logic and shared contracts |
| `src/lib` | Authentication, HTTP, parsing, and client infrastructure |
| `server/src` | API, repositories, auth, storage, and AI providers |
| `server/migrations`, `server/infra` | Reviewed schema and runtime-role scripts |
| `tests`, `server/tests` | App/domain, API, provider, and opt-in database tests |
| `supabase` | Preserved legacy functions and schema history |

The [implementation plan](docs/CHALKWISE_IMPLEMENTATION_PLAN.md) points to the [full-stack plan and checkpoint history](docs/architecture/FULL_STACK_PLAN.md). [SHARED_CONTRACTS.md](SHARED_CONTRACTS.md) defines the service, identity, and sharing boundaries.
