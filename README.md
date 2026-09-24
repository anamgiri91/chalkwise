<div align="center">

<img src="assets/images/chalkwise-icon.png" alt="Chalkwise logo" width="96" height="96" />

# Chalkwise

**Capture a lecture. Check the source. Remember what matters.**

A full-stack study workspace that turns photos of lecture boards into organized notes,<br />
source-grounded answers, quizzes, and a spaced review queue.

![Expo SDK 57](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS-4169E1?logo=postgresql&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Cognito_·_S3_·_RDS-FF9900?logo=amazonwebservices&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22.18+-339933?logo=nodedotjs&logoColor=white)

[Features](#features) · [Architecture](#architecture) · [Quick start](#quick-start) · [Testing](#testing-and-quality) · [Project structure](#project-structure)

</div>

<!--
  Screenshots: add images under docs/screenshots/ and uncomment this block.

<p align="center">
  <img src="docs/screenshots/home.png" alt="Home" width="30%" />
  <img src="docs/screenshots/notebook.png" alt="Notebook" width="30%" />
  <img src="docs/screenshots/review.png" alt="Review" width="30%" />
</p>
-->

## Overview

Students photograph the board, then rarely look at those photos again. Chalkwise connects the whole loop: **capture → organize → question → quiz → review**. It keeps the original photos next to anything the AI generates, so students can always check a claim against the source.

The project targets a pilot of 10–20 college students and runs on **iOS, Android, and the web** from a single Expo codebase, backed by a typed Fastify API on AWS.

## Features

| | |
| --- | --- |
| 📸 **Smart capture** | Camera capture with blur and exposure checks. A session of up to six photos is uploaded and analyzed together into one set of notes. |
| 📓 **Source-first notebooks** | Originals stay separate from AI output. Students can recall a topic from memory before revealing the notes. |
| 💬 **Grounded Q&A and quizzes** | Ask questions about a lecture and generate quizzes from it. Analysis drops claims the source transcript does not support. |
| 🔁 **Active recall review** | Students choose their own confidence, which schedules the next review in 4 hours, 1 day, or 3 days. |
| 👥 **Opt-in sharing** | Friend requests and per-notebook sharing. Only accepted friends in the same course can read a notebook. Recipients can save their own copy. |
| 🔐 **Accounts and courses** | Email confirmation, sign-in, password reset, profile editing, course creation, and enrollment. |
| 🎨 **Polished UI** | Responsive mobile and web navigation, light and dark themes, loading and error states, and a populated offline demo. |

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

Screens never call a backend directly. They go through a typed service layer, so the same UI can run on the in-memory demo, the new API, or the legacy Supabase backend with one environment variable.

### Security by design

- **Two layers of access control.** The API verifies Cognito access tokens and validates every request body. PostgreSQL row-level security enforces access again, using a transaction-local user identity. Runtime database credentials cannot own tables or bypass RLS.
- **Parameterized queries only**, with safe error responses that don't leak internals.
- **Private photo storage.** Photos use immutable S3 object keys, integrity metadata, recoverable upload intents, and short-lived signed URLs.
- **Secrets stay on the server.** AI and database credentials never reach the client. Native refresh tokens live in SecureStore; web sessions stay in memory.
- **Students own their data.** Original photos and sharing choices stay under their control.

### Tech stack

| Layer | Technology |
| --- | --- |
| Client | Expo SDK 57, React Native 0.86, Expo Router, React 19, TypeScript |
| API | Node.js 22, Fastify 5, Zod, jose (JWT verification), rate limiting |
| Data | PostgreSQL with row-level security (Amazon RDS) |
| Storage and auth | Amazon S3 (private, pre-signed URLs), Amazon Cognito |
| AI | Google Gemini, called only from the server, with validated outputs |
| Delivery | Docker, GitHub Actions CI, AWS ECS task template |

## Quick start

> **Requirements:** Node.js 22.18 or later and npm. The demo needs no cloud accounts.

```sh
git clone <this-repo-url> chalkwise
cd chalkwise
npm ci
npm ci --prefix server
cp .env.example .env.local
npm run web
```

The template defaults to `EXPO_PUBLIC_DATA_MODE=mock`, which loads a populated demo. You can browse and review, but uploads and AI are turned off in demo mode.

Other ways to run the client:

| Command | What it does |
| --- | --- |
| `npm start` | Expo development server |
| `npm run ios` / `npm run android` | Native build (needs Xcode or Android Studio). Native sign-in needs a build that includes SecureStore. |

### Data modes

| `EXPO_PUBLIC_DATA_MODE` | Behavior |
| --- | --- |
| `mock` (default) | Populated demo; changes live in memory and reset on restart |
| `api` | Cognito sign-in with the PostgreSQL and S3 API |
| `supabase` | Legacy backend, kept for migration and rollback |

<details>
<summary><strong>Running against the real API</strong></summary>

<br />

1. Follow the [API setup guide](server/README.md) to prepare a separate PostgreSQL database, a Cognito user pool and client, and a private S3 bucket. Review the schema scripts before applying them.
2. Configure the server from `server/.env.example`, then start it:

   ```sh
   npm run dev --prefix server
   ```

3. Add these public identifiers to the app's `.env.local` and restart Expo:

   ```dotenv
   EXPO_PUBLIC_DATA_MODE=api
   EXPO_PUBLIC_API_URL=https://your-api.example.com
   EXPO_PUBLIC_AWS_REGION=us-east-1
   EXPO_PUBLIC_COGNITO_CLIENT_ID=your-public-app-client-id
   ```

These values are public. Database passwords, Gemini keys, and AWS secret keys belong only on the server.

</details>

## Deployment

The backend is ready for AWS deployment. It ships with a production Dockerfile, an ECS task template, and least-privilege database roles. The [AWS deployment and cutover runbook](docs/architecture/AWS_DEPLOYMENT.md) covers TLS, IAM roles, pilot eligibility, backups, acceptance checks, and migrating data from Supabase.

> **Status:** No cloud resources have been provisioned yet, and no Supabase data has been migrated. The legacy adapter stays in place until live acceptance and cutover are complete.

## Testing and quality

```sh
npm run check        # Typecheck app and server, run all tests, check formatting
npm run build:web    # Production web export
```

The test suite covers:

- Signed-token rejection, request validation, access gates, and safe errors
- Upload recovery and session races
- Review scheduling and capture-quality checks
- AI result validation, multi-photo analysis, and transcript support checking
- Ambiguous course matching

**Database isolation tests** run against a disposable local PostgreSQL database, using the restricted runtime login. They are skipped unless you pass the URL explicitly:

```sh
TEST_DATABASE_URL=postgres://runtime:password@localhost:5432/chalkwise_test npm run test:db --prefix server
```

Ordinary tests never apply migrations or touch production credentials.

**Continuous integration.** GitHub Actions runs typechecks, tests, the web export, the container build, and the RLS isolation tests against a disposable PostgreSQL service on every pull request. The [verification record](docs/architecture/VERIFICATION.md) lists results and the checks that still need live AWS or a physical device.

## Project structure

```text
chalkwise/
├── src/
│   ├── app/            Expo Router screens
│   ├── components/     Reusable UI
│   ├── services/       Data adapters (mock · api · supabase)
│   ├── features/       Domain logic and shared types
│   ├── types/          Shared contracts
│   └── lib/            Auth, HTTP, parsing, client infrastructure
├── server/
│   ├── src/            Fastify API, repositories, auth, storage, AI providers
│   ├── migrations/     Reviewed, additive SQL schema with RLS
│   ├── infra/          Runtime roles and ECS task template
│   └── tests/          API, provider, and opt-in database tests
├── tests/              App and domain tests
├── supabase/           Legacy functions and schema history
└── docs/               Plans, architecture, deployment, and verification
```

## Roadmap

- [x] Multi-photo capture and AI-organized notes
- [x] Source-grounded Q&A, quizzes, and active recall review
- [x] Friend-based notebook sharing
- [x] AWS backend with Cognito, RLS-protected PostgreSQL, and private S3
- [ ] Live AWS provisioning and Supabase cutover
- [ ] Durable resume after the app closes, and background processing
- [ ] Review notifications

## Documentation

| Document | Contents |
| --- | --- |
| [Implementation plan](docs/CHALKWISE_IMPLEMENTATION_PLAN.md) | Product and milestone plan |
| [Full-stack plan](docs/architecture/FULL_STACK_PLAN.md) | Architecture and checkpoint history |
| [Shared contracts](SHARED_CONTRACTS.md) | Service, identity, and sharing boundaries |
| [AWS deployment](docs/architecture/AWS_DEPLOYMENT.md) | Deployment and cutover runbook |
| [Verification](docs/architecture/VERIFICATION.md) | Test results and outstanding checks |

## License

Released under the [MIT License](LICENSE).
