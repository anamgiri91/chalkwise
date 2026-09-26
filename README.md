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

[Features](#features) · [Evaluation](docs/evaluation/GROUNDING_EVAL.md) · [How it's built](#how-its-built) · [Quick start](#quick-start) · [Testing](#testing-and-quality) · [Project structure](#project-structure)

</div>

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="Opening a notebook, recalling it from memory, revealing the notes and scheduling the next review" width="30%" />
  <img src="docs/screenshots/home.png" alt="Overview with notebooks due for review" width="30%" />
  <img src="docs/screenshots/notebook.png" alt="Generated notes kept separate from the original photos" width="30%" />
</p>

<p align="center">
  <img src="docs/screenshots/desktop-dark.png" alt="Desktop layout in dark mode" width="90%" />
</p>

## What it is

Most students take photos of the board and never open them again. I wanted those photos to turn into something you'd actually study from, without having to trust the AI blindly.

So Chalkwise does four things:

1. You take up to six photos of the board. It checks each one for blur and bad lighting before you move on.
2. It reads the photos and writes organized notes: a summary, key concepts, assignments and exam mentions.
3. It keeps your original photos right next to those notes, so you can always check what the board actually said.
4. It asks you to recall the lecture before showing the notes, then schedules your next review based on how it went.

You can also ask questions about a lecture, generate a quiz, and share a notebook with friends in the same course.

It runs on iOS, Android and the web from one codebase. I built it for a small pilot of 10 to 20 students, so I've kept the setup simple on purpose.

## The part I'm most careful about

The worst thing a study app can do is invent a deadline. If the AI says "Problem set 4 due Friday" and the board never said that, a student is worse off than if they'd used nothing.

Chalkwise checks every assignment and exam mention against what was actually written on the board, and removes anything it can't find. The first version of that check just matched words, so I built a test set of 156 claims to see how well it worked. It didn't work as well as I thought:

| | Wrong claims caught | Real claims removed by mistake |
| --- | --- | --- |
| Word matching (what's live now) | 44% | 8% |
| New check that reads one board line at a time | 94% | 4% |

These are results on 60 claims I held back and didn't look at while building the new check. The old version missed every case like "No lab Monday" turning into "Lab Monday". The full write-up, including where the new check still fails, is in [docs/evaluation/GROUNDING_EVAL.md](docs/evaluation/GROUNDING_EVAL.md).

## Features

- **Capture:** camera with blur and exposure checks. Up to six photos per lecture, analyzed together into one set of notes.
- **Notebooks:** your originals stay separate from anything the AI wrote. You can test yourself before revealing the notes.
- **Ask and quiz:** ask questions about a lecture or generate a quiz from it.
- **Review:** after each review you say how well you remembered it, and it schedules the next one for 4 hours, 1 day or 3 days later.
- **Sharing:** add friends and share a notebook with them. Only accepted friends in the same course can see it, and they can save their own copy.
- **Accounts:** email confirmation, sign-in, password reset, profiles, courses and enrollment.
- **Demo mode:** a filled-in demo so you can try it without any accounts or cloud setup.

## How it's built

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

Screens never talk to the backend directly. They go through a service layer, so the same app can run on the demo data, the new API or the old Supabase backend just by changing one environment variable.

### Keeping student data private

- **Access is checked twice.** The API checks your sign-in token, and the database checks again with row-level security. Even if the API had a bug, the database wouldn't hand one student's notes to another. The database login the API uses can't get around this.
- **Queries are always parameterized**, and error messages never expose internal details.
- **Photos are private.** They're stored in a private S3 bucket and only shown through links that expire after a few minutes.
- **Secrets stay on the server.** The AI key and database password never reach the app.
- **You control your data.** Your photos stay yours, and nothing is shared unless you choose to share it.

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

**Grounding evaluation.** `node scripts/eval-grounding.mts` scores the transcript support check against 156 labelled claims, with bootstrap intervals, a threshold sweep and a paired significance test. `npm test` fails if either verifier falls below its floor on the held-out split. See the [grounding evaluation](docs/evaluation/GROUNDING_EVAL.md).

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
| [Grounding evaluation](docs/evaluation/GROUNDING_EVAL.md) | Labelled claim set, verifier results, and limitations |

## License

Released under the [MIT License](LICENSE).
