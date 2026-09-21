# Chalkwise whole-project plan

Status: planning checkpoint, September 21, 2026. This is the forward roadmap for the product previously named ClassLens. Read it with the root [architecture.md](../architecture.md), which contains the technology inventory and Mermaid diagrams. The [authoritative plan index](CHALKWISE_IMPLEMENTATION_PLAN.md) points here for new work; older milestones remain historical context. Planning a milestone does not start its implementation automatically.

## Confirmed direction

- Upload whiteboard photos and loose notes; turn them into ordered, editable notes with source references.
- Make the website the main study workspace, retaining mobile capture.
- **Generate new practice problems from the notes** as the first problem-set feature. Assignment tracking and a dedicated uploaded-worksheet organizer are later decisions.
- Ask before searching for missing context. Keep accepted external concept explanations in a separate, cited, removable layer. Never reconstruct an unreadable board or generate class deadlines from the web.
- Use PostgreSQL deployable on Amazon RDS, private S3 storage and Cognito identity.
- Build incrementally for 10–20 students with tests and a local commit for every completed checkpoint. No deployment-scale infrastructure before evidence requires it.

## What already exists

The repository includes authentication/profile/course services, photo capture, one-to-six-photo analysis, transcript-based organization, private originals, friendships and explicit sharing, Q&A, quiz generation, a review queue, responsive navigation, a Node/PostgreSQL API, a container definition and CI configuration. Reuse these features. Their existence is not proof of a completed AWS deployment or physical-device acceptance.

The current analysis checks some assignment/exam claims using token overlap. It does not establish semantic truth, persist all source-reading warnings for the UI, or sequence overlapping photos. Source editing/revisions, pasted-text/PDF ingestion, persistent generated practice attempts, and approved web enrichment are the main gaps. Check the actual Git state before each milestone; do not rely on stale implementation-status tables.

## Delivery roadmap

| Checkpoint | Concrete outcome | Dependencies and main work | Completion evidence | Suggested commit |
| --- | --- | --- | --- | --- |
| P0 | Agreed baseline and product/architecture plan | Reconcile current code, generated-practice choice, technology inventory, source rules, known grounding failures and open deployment checks | Reviewed docs, valid Mermaid, working local links, clean documentation diff | `docs: define project roadmap and architecture` |
| P1a.1 | Persisted sources and recoverable drafts | Add reviewed extraction/source-reference and revision contracts; surface per-source warnings; course-optional inbox; retain existing lecture routes | RLS/ownership tests, original-to-block references, partial failure, duplicate publication, save/reopen and conflict tests | `feat(notes): preserve source-linked notebook drafts` |
| P1a.2 | Ordered photo notebooks | Sequence proposal, overlapping-board detection, manual override, edit/undo, equation correction; preserve every original | Out-of-order pages, repeated board with a new line, mixed subjects, ambiguous numbering; browser source/edit/reload flow | `feat(notes): organize and edit photo notebooks` |
| P1b.1 | Desktop upload and pasted notes | Drag/drop/file input, text ingestion, three-pane workspace with narrow-screen tabs; same services and ownership model | Keyboard/accessible labels, invalid inputs, cancel/retry, no course required, source retention | `feat(web): add upload and text notebook workspace` |
| P1b.2 | Bounded PDF ingestion | PDF.js integration; file/page/processing limits; page references; explicit unreadable/encrypted-file states; scanned-page support only after its rendering path passes | Text/scanned fixtures, corrupt and oversized PDFs, page order, no active content, failures without discarded originals | `feat(inputs): add bounded PDF notebook ingestion` |
| P2.1 | Generated practice sets from notes | Extend existing quiz generation; persist set/problem/source/revision/version records; configurable concept selection and bounded set size | Question and answer consistency, no unsupported concept claims, source selection, idempotent retries, failed generation leaves notes unchanged | `feat(practice): generate source-linked problem sets` |
| P2.2 | Attempts, hints and review | Persist attempts; progressive hints and explicit explanation reveal; reuse review scheduling; offer regenerate/flag issue | Cross-user isolation, retry-safe attempts, hint/reveal behavior, ambiguous answers, invalid answer keys, review timing; manual math samples | `feat(practice): add attempts hints and review` |
| P3a | Measured source/research quality | Versioned eval fixtures, response replay, metric tests and baseline report; include practice evaluation from P2 and malicious-page cases | Negation/cross-problem deadlines, transcription mistakes, citation mismatch, unsafe instructions, unsupported explanations; human-reviewed held-out samples | `test(ai): add grounding and enrichment evaluation gates` |
| P3b.1 | Per-gap research approval | Propose/approve/decline API and UI; owner/revision/scope/expiry checks; bounded idempotent jobs; no search capability on ordinary routes | Zero provider calls without approval; stale, cross-user, cancelled/replayed requests; topic/context preview matches payload | `feat(research): enforce scoped search approval` |
| P3b.2 | Separate cited web suggestions | Research/evidence adapter, safe source retrieval, claim-to-passage links, accept/reject, collapsible/removable additions | Reject irrelevant/missing evidence, resist source-page injection, prohibit assignments/dates/reconstruction, preserve class layer and user corrections | `feat(research): add cited concept suggestions` |
| P4.1 | Operational pilot readiness | Durable jobs/restart recovery where not already delivered, input retention/export/deletion, dependency review, container and infrastructure definitions | Crash/lease recovery, bounded provider usage, cleanup behavior, account data coverage, container build and reviewed infrastructure diff | `chore(ops): prepare recoverable pilot deployment` |
| P4.2 | AWS integration and cutover rehearsal | Separate explicit deployment authorization; Cognito/S3/RDS/TLS; secrets; backups/restore; migration inventory and owner mapping | Real two/three-account isolation, live capture/practice/research consent, native restore, dependency sign-off, restored backup and rollback rehearsal | `test(release): record pilot acceptance and cutover evidence` |

Do not estimate a launch date from the number of rows. Size P1a after auditing the current data model, and P1b.2 after testing PDF extraction on representative fixtures. Each row can be split into smaller commits if it cannot be reviewed or verified as one change. No later milestone bypasses its acceptance gate because a UI demo looks finished.

## Detailed first implementation checkpoint

**Goal:** save an inspectable draft from the current photo pipeline and reopen it without losing the reading or the student’s corrections.

1. Define extraction, source-reference, draft/revision and partial-failure types in the shared type boundary. Distinguish source text, generated organization, and user edits.
2. Design additive PostgreSQL tables/policies and same-owner constraints. Review SQL before application. Extend repository/services without breaking legacy/mock contracts.
3. Persist extraction outcomes and source positions; return meaningful partial-failure states rather than only logging them. Keep completed extraction available when organization fails.
4. Expose draft reading and editing with the original beside it. Let a student create a personal notebook without course enrollment.
5. Save edits as revisions with a version check and stable operation identity. A stale client sees a conflict and can recover its draft.
6. Exercise ownership, lost responses, partial failure, correction preservation and save/reopen tests. Record any browser/device blocker honestly, then commit.

Likely files: shared definitions under `src/types/`, service adapters under `src/services/`, notes/source screens and components, `server/src/analysis.ts`, validation/repository/routes, and a new reviewed migration. Announce the exact files and contract changes at implementation time. This documentation commit edits none of those application files.

## Generated practice contract

The student selects a notebook revision, concepts and a bounded practice size. Start with the existing multiple-choice mechanism and add short-answer/numeric formats only when their validation/feedback contract is implemented. Save the generated prompt, expected answer/explanation, assumptions, source concepts, model/prompt versions, and validation status. Generated numerical examples may legitimately change values while preserving the taught concept.

Problems appear as **Practice generated from your notes**, never as uploaded or assigned work. Questions with insufficient source context or inconsistent answers are rejected or explicitly reported as unavailable. One bounded repair attempt is acceptable; an unchecked fallback is not. The student attempts a problem, requests hints, and reveals the explanation when ready. Preserve attempts when notes change; sets remain pinned to their original revision and can be regenerated deliberately.

Use the existing review queue for follow-up. Do not infer mastery from opening a page, and do not claim automatic proof grading. For unsupported free-response subjects, give clearly labeled guidance rather than definitive grades. Web-enriched practice is a later opt-in source scope, with separate citations; initial practice uses class notes only.

## Evaluation and test strategy

| Layer | Tools and meaningful cases |
| --- | --- |
| Domain | Node test runner: sequence/overlap proposals, revision conflicts, consent lifecycle, question validation and review scheduling |
| API | Fastify injection with realistic fake providers: authentication, permissions, schema limits, idempotency, errors and no unapproved search calls |
| Database | Disposable PostgreSQL with non-owner runtime login: RLS, same-owner references, leases, retries and concurrent edits |
| Browser | Proposed Playwright flows: upload/paste/PDF, source inspection, edit/reopen, generate/attempt/reveal, consent/accept/remove |
| Native | Relevant component tests plus physical camera, permissions, file persistence and SecureStore restore checks |
| AI quality | Versioned source/problem/research cases, recorded responses for normal CI, human-reviewed live samples for explicit provider evaluation |
| Operations | Container start/readiness, TLS and identity configuration, provider failure, database/S3 recovery and backup restore |

For every code checkpoint run `npx tsc --noEmit`, the server typecheck, relevant tests, formatting and `git diff --check`; run `npm run build:web` for UI changes. Existing `npm run check` combines core local gates. Tests must cover behavior and failure, not merely restate the implementation. Commit evaluation reports with dataset/pipeline versions and sample counts; private uploads do not belong in Git without consent and redaction.

P3a must exist before web enrichment ships. Seed relevant evaluation cases during P1/P2 rather than waiting until the search milestone. The current lexical verifier accepts negation and cross-problem date mistakes; treat these as known failures to address, not as passing semantic validation. Neither a model judge nor a citation count alone is a truth metric.

## Deployment and operating plan

Use the technology inventory and AWS diagram in [architecture.md](../architecture.md). Local development stays available in mock mode and against an explicitly prepared development backend. Use one region, a small RDS instance, one container task, bounded worker concurrency, separate website/originals buckets, and cost alerts. Choose actual sizes only after measuring uploads and provider usage; avoid a speculative monthly price.

Prepare infrastructure with AWS CDK/TypeScript during P4, review its changes, and deploy only when requested. Keep production secrets in Secrets Manager and runtime AWS access in task roles. Enable database backups and rehearse restore. CI should use short-lived scoped AWS identity if deployment automation is later enabled; ordinary pull requests need no production credentials.

Before cutover, inventory Supabase rows/objects, map owners to verified Cognito subjects, copy originals with checksums, reconcile rows, rehearse access tests, and freeze legacy writes for the transition. Do not dual-write without a designed reconciliation mechanism. Retain a rollback path and record what happens to writes made after cutover. See [AWS_DEPLOYMENT.md](architecture/AWS_DEPLOYMENT.md).

## Pilot outcomes and completion criteria

A pilot student should be able to upload a disordered set, inspect a questionable reading, correct and save the notebook, generate useful practice, attempt it, and return to a review. Research must make it obvious what will be sent, what was found, and what was accepted. Declining research must leave a usable notebook.

Measure with consent: successful upload-to-notebook completion, correction frequency, unresolved source failures, useful practice feedback, return-to-review, processing latency and provider cost. Do not collect raw study content as telemetry. Start with small human-reviewed samples and publish limitations rather than inventing reliability percentages.

The pilot is ready only after the code checks, actual database/provider integration, browser/device flows, consent boundaries, dependency review and backup/restore checks pass. The [historical verification report](architecture/VERIFICATION.md) documents earlier checks; it must not be presented as validation of future milestones.

## Deferred work

Dedicated assignment/deadline tracking, automatic attendance, institution administration, payments, ambient audio/video, automatic solution scraping, autonomous browsing, vector search, distributed microservices and custom capture hardware. Existing sharing remains functional. Hardware becomes a separate milestone only if pilot evidence shows capture friction is the limiting problem.

## Documentation ownership

- [CHALKWISE_IMPLEMENTATION_PLAN.md](CHALKWISE_IMPLEMENTATION_PLAN.md): authoritative entry point and historical scope.
- [PROJECT_PLAN.md](PROJECT_PLAN.md): current forward roadmap and acceptance gates.
- [architecture.md](../architecture.md): technology choices, boundaries, Mermaid diagrams and data model.
- [PRODUCT_WORKFLOW_PLAN.md](architecture/PRODUCT_WORKFLOW_PLAN.md): detailed product behavior and source/research rules.
- [SHARED_CONTRACTS.md](../SHARED_CONTRACTS.md): implemented operational contracts, updated alongside code rather than ahead of it.

Keep these aligned at each checkpoint. Record the tested commit and limitations. Preserve unrelated work, use an isolated checkout when work overlaps, and commit only the completed scope.

## P0 validation record

The documentation was prepared against isolated baseline `db94602`. All five Mermaid blocks in `architecture.md` parsed successfully with Mermaid; local links in the five changed documents resolve; `git diff --check` passed. Mermaid syntax was validated without a browser render. The baseline's `npm run check` also passed: app/server TypeScript, 29 app/domain tests, 34 server tests, 65 legacy request scenarios plus their existing assertions, and scoped formatting. No application code, project dependency manifest, schema, or cloud resource changed in this documentation checkpoint. Temporary diagram-validation dependencies stayed outside the project.

These results do not establish live AWS, database, browser, physical-device, or future-feature behavior. The reproduced semantic grounding counterexamples remain documented failures outside the currently passing test cases.
