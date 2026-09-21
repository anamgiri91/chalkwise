# Chalkwise: turn scattered material into a notebook you can learn from

Status: product direction clarified by the user on September 21, 2026. The first problem-set feature is **generating new practice problems from notes**. This document specifies product behavior; the [whole-project roadmap](../PROJECT_PLAN.md) supplies checkpoints, and [architecture.md](../../architecture.md) supplies the technology inventory and Mermaid diagrams. Future milestones are not implemented by this plan. PostgreSQL on Amazon RDS is confirmed. Package installation and local checks are authorized; deployment and source-data migration remain separate.

## Product promise

Upload whiteboard photos or loose notes. Chalkwise makes an editable, well-ordered notebook and generates new practice problems from its concepts. When context appears to be missing, Chalkwise asks before searching the web and presents cited additions for review. Uploaded worksheets may be source material; dedicated assignment organization and due-date tracking are separate future features.

The first audience is students using their own learning material, with a pilot of 10–20 users. The primary entry point becomes a responsive website with upload and paste actions. Mobile capture remains supported. A course is an optional organizer: a student must be able to start in a personal inbox without choosing a university, enrolling in a course, or knowing a topic name.

The product should make the distinction between **what was uploaded**, **how Chalkwise organized it**, and **what was added from elsewhere** visible and recoverable. A polished summary alone is not evidence that the notes are correct.

## Existing implementation and actual gaps

The multi-photo pipeline is committed in `598a96d`, following the full-stack checkpoint `c3067f1`; the inspected checkout also includes the Chalkwise rename and UI refinements. Inspection confirms the code paths below; it does not establish live provider, browser, or device acceptance. Reuse these features rather than rebuilding them.

| Capability | Current evidence | Remaining product work |
| --- | --- | --- |
| Photo sessions | `processing.tsx` calls `analyzeMaterials`; `/v1/ai/analyze` accepts one to six material IDs | Verify the complete capture/save/reopen path on devices and web |
| Extract then organize | `analyzeSession` transcribes each photo and passes transcripts, without photos, to the organizer | Persist inspectable extraction/source references and surface partial failures |
| Claim filtering | `verifySupport` filters assignment and exam items by words, numbers, and date tokens | Semantic evaluation; it does not verify all summary/concept claims or prove factual support |
| Ordering | Material IDs and successful extraction results retain input order | Infer page sequence, identify overlapping board photos, and provide a reversible user override |
| Website | Expo web export and CI build configuration already exist; the app has responsive navigation | Desktop upload, source inspection, and notebook editing interactions need browser acceptance |
| Other inputs | Photo ingestion exists; a document-picker dependency is installed | Typed/pasted text and PDFs need real ingestion, validation, and extraction paths |
| Problem sets | `Lecture.assignments` is a list of mentions; quiz generation exists | Extend quiz capability into persistent generated practice sets with source references, attempts and hints |
| Learning | Ask This Lecture, generated quizzes, and again/good/easy reviews exist | Reuse them; add source links and problem-specific support only where needed |
| Web enrichment | No search/consent/result-layer implementation | Build only after attribution and evaluation gates are in place |

The draft orchestration/evaluation document describes useful future work, but some of its baseline statements (no root test script, CI, or AI tests) predate the current code. Reconcile it during the evaluation checkpoint; do not treat those statements as instructions to recreate completed work.

## Main workflow

1. **Add material.** Drop one or several photos into the website, select files, paste text, or capture a photo on mobile. Begin with images and pasted text; add PDF ingestion after page extraction and isolation tests work. Do not claim arbitrary file-format support. Retain upload order and allow reordering before processing.
2. **Check the reading.** Extract each source separately. Preserve equations, problem numbering, units, and visible diagram labels. Mark unclear regions without guessing. Show the original beside editable extracted text. Diagram interpretation remains labeled as interpretation unless its relationships can be traced to the source.
3. **Organize.** Reuse the existing extraction/organization stages. Add a sequence proposal using page numbers, headings, and continuity; preserve original source positions and let the student override it. Identify duplicate or overlapping board photos without deleting originals or dropping a newly added line. Produce sections such as Concepts, Definitions, Worked Examples, Formulas, and Problem Sets when supported. Keep problem statements complete. Suggest a topic and destination notebook; let the student correct them. An unrelated upload goes to the inbox instead of being forced into an existing subject.
4. **Review and save.** Show a draft with source links and suggested organization. The student can edit, reorder, accept, or undo. Adding material to an existing notebook creates a proposed revision; it must not overwrite previous corrections or silently merge unrelated topics.
5. **Resolve gaps, optionally.** A note might refer to a theorem without stating it, or a prerequisite without explaining it. Offer a specific research request. If the student declines, leave a visible gap and keep the notebook usable.
6. **Learn.** Extend existing Q&A, quiz, and review features with generated practice sets. Connect each problem to its source concepts, preserve attempts, offer progressive hints, and reveal explanations on request. Keep generated practice distinguishable from uploaded assignments.

Example: three whiteboard photos about integration become a notebook with definitions, formulas and a worked example. The student asks for five new practice problems using those concepts. If the photos mention substitution without explaining it, offer to research that concept separately. A citation-backed explanation appears as a proposed addition; the original lesson stays intact.

## Website layout

- **Inbox:** prominent Upload and Paste notes actions; unfinished drafts, unreadable pages, and unfiled material.
- **Notebooks:** folders or topics, search, and a chronological source list. Existing courses remain available as one grouping option.
- **Notebook workspace:** section outline on the left, editable notes in the middle, and the selected source on the right. On a narrow screen these become accessible tabs. Blocks expose their source without requiring a separate search.
- **Practice:** generated problem sets linked to the concepts they use, attempts, hints and explanations; no implied lecturer assignment or due date.
- **Review:** a small queue based on attempted problems and explicit review choices. Show activity and evidence, not an uncalibrated mastery percentage.

Keep the existing Expo web application and service boundary for the first milestone. A framework rewrite is not a prerequisite for validating upload, editing, and source inspection. Verify file picking, keyboard navigation, text selection, equation display, and responsive layouts in real browsers before deciding whether a separate web editor is necessary.

## Rules for source attribution

| Content | Required treatment |
| --- | --- |
| Uploaded image or text | Preserve the original and its position in the source list |
| Faithful extraction | Reference the source/page; mark uncertainty and preserve correction history |
| Organized notes | Reference supporting extraction blocks; reorganization must not introduce facts |
| Student edit | Label as user-authored; retain the prior revision and existing sources where applicable |
| Web addition | Link the supporting URL, title, retrieval time, and approved research request |
| Generated example, problem, or explanation | Label as generated; show assumptions and the concepts/sources it uses |

Source links make claims inspectable; they do not prove that a claim is correct. Token overlap is insufficient to establish meaning: matching words can still reverse a relationship or attach a deadline to the wrong problem. Test citations against the actual supporting content and preserve uncertainty.

Two counterexamples were reproduced against the current `isSupported` function: it accepts “Problem set 3 is due Friday” from “Problem set 3 is not due Friday,” and accepts “Problem set 3 is due Monday” when the transcript says problem 3 is due Friday and problem 4 is due Monday. Add negation, cross-sentence association, conflicting sources, and transcription-error cases to the evaluation set. For actionable assignment/date claims, prefer source excerpts to free paraphrases; do not label lexical filtering as proof.

Never infer a professor's assignment, due date, marking rubric, or exam scope from public web material. If the source is unreadable, request a clearer source or manual correction; a web result is not a reconstruction of what was on the board.

Render two separate layers: **From your class**, tied to source extractions, and **Added from the web**, tied to the actual retrieved page passages. The second layer is collapsible and removable. Each layer is checked against its own evidence; adding research must never relax the class-source checks or inject external text into class-only context. Enrichment supports concept explanations and worked examples only; its schema must have no assignment, deadline, exam-date, or board-reconstruction output. Q&A and practice must disclose which layers they used.

## Web research requires explicit approval

Suggested dialog:

> Your notes mention integration by substitution but do not explain the method. Search the web for an explanation and one worked example? Only this topic description will be sent to the search service.
>
> Search this topic · Edit request · Keep the gap

The actual dialog must disclose the real data sent, rather than promising a fixed privacy boundary that the implementation cannot enforce.

1. Detect possible gaps without any web tool enabled. Gap detection is a suggestion, not a declaration that the student or lecturer made an error.
2. Store a proposed research request tied to the owner, notebook revision, selected gap, and exact topic/context the user will approve. Show the request before execution. Do not send an entire notebook, photo, identifying details, or other private context by default.
3. Require an authenticated approval action. The server checks ownership, scope, expiry, and the notebook revision before enabling search. A prompt, a boolean supplied to the normal analysis endpoint, or a model-generated instruction cannot grant consent.
4. Execute one bounded research job using the approved context. Use stable request identities to avoid duplicate work after lost responses. Technical retries must stay within the same approved scope and budget; expired approval, a changed notebook, or new research scope requires approval again.
5. Prefer primary educational sources and show where they disagree. Capture returned source metadata and link individual proposed additions to supporting sources. A provider failure or missing citation leaves a visible unresolved gap.
6. Present the results as a draft. The student accepts or rejects each addition; acceptance creates a new revision labeled as web enrichment. Rejecting results leaves the notebook unchanged.

Reuse `readability` and `unclear[]` to identify capture-quality problems. They currently exist inside extraction, while the route returns `result.analysis` and logs warning counts. Persist and expose the relevant source warning before designing a UI around it. Keep **unreadable evidence** separate from **a named concept needing explanation**: glare prompts retake/manual correction; an identifiable concept can prompt scoped research. Do not ask a search service what “usually goes” in a missing image region.

The ordinary transcription, organization, question-answering, and quiz paths must have no search capability. A learning question that needs external information goes through this same approval flow. Approval is per research request; do not introduce a default-on or blanket search permission.

Google's [Gemini search-grounding documentation](https://ai.google.dev/gemini-api/docs/google-search) describes search invocation and citation metadata. It is a provider candidate, not a shipped integration. Evaluate supported models, citation handling, display requirements, and costs at implementation time. The server must control whether the tool is available regardless of the provider selected. Treat source pages as untrusted data, never as instructions to call tools or change permissions.

## Problem sets and learning

The user selected **Generate new practice problems from notes**. Implement that first; these remain distinct products:

| Meaning | Minimum records needed |
| --- | --- |
| Generate practice — selected | Practice set pinned to a note revision, generated problem, source concepts, answer/explanation, hints, attempt history |
| Organize an uploaded worksheet — deferred | Source sheet, problem/subpart, position, supporting concept links |
| Track assigned work — deferred | Assignment/task, source-confirmed or user-entered due date, completion state |

Reuse the current quiz service for the first generation path. Let the student choose concepts and a bounded set size. Save source references and the notebook revision used so later note edits do not silently change an existing problem or answer. Generated examples may introduce new numbers, so validate the calculation and taught method rather than requiring every value to appear in the source. Do not automatically fetch solutions to uploaded assignments.

Support a progression of **attempt → small hint → next-step hint → worked explanation**. Keep the student's attempt, show which step feedback addresses, and allow reveal on request. Mark machine-generated feedback as provisional unless a supported checker establishes a narrow property. For example, a numerical substitution check does not validate an entire proof.

Generate additional practice only as a separate action, with a label such as “Practice generated from your notes.” Validate question structure, answer consistency, and source support; do not save ambiguous or unsupported answer keys as trustworthy study material. Use short recall prompts and repeat reviews to help learning without pretending that opening a note proves understanding.

## Implementation approach

Keep the modular API, Cognito authentication, PostgreSQL on RDS, and private S3 originals from the existing full-stack foundation. [Amazon RDS supports PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html). Screens continue to call services. The server owns model calls, research approval enforcement, validation, and access control.

Add new persistence only as each milestone needs it. Candidate records are notebooks, source extractions, note revisions/blocks, source references, generated practice sets/problems, attempts, research requests, research results, and review events. They are a design outline, not approved SQL. Keep existing lecture/course routes compatible while introducing course-optional notebooks. Use reviewed additive migrations, owner-scoped RLS, a non-owner runtime role, and transactional publication of completed revisions.

Model calls form bounded stages: extract each source, organize extracted content, validate sources and structure, then show a draft. Store stage outcomes and stable retry identities so an interrupted job does not discard successful extraction or duplicate saved notes. Transcription success should remain accessible even if organization fails. Never silently omit an unreadable source and label the whole upload complete.

For 10–20 users, start with one API deployment and PostgreSQL-backed job records. A bounded worker in the same deployment can resume work from persisted states. Do not introduce a distributed agent framework or separate queue service before measured load requires one. Record processing version, timing, outcome, and provider usage without placing private notes or credentials in logs. Version prompt changes and test them against saved evaluation cases.

The AI/capture changes are now committed; inspect their current tests and limitations before extending them. The earlier [verification report](VERIFICATION.md) applies to its historical checkpoint and identifies open live-database and device checks; it does not certify later changes.

## Delivery order and acceptance gates

Each completed step gets a separate local commit, a test result, and a short record of remaining manual checks. These are planned product steps, distinct from the earlier infrastructure checkpoints.

| Step | Deliverable | Acceptance and meaningful tests |
| --- | --- | --- |
| P0 | Reconcile baseline and confirm scope | Reuse the existing AI/capture work; record generated practice as the first problem-set feature, a web-first workspace, and concept-only enrichment. No duplicate implementation of existing features. |
| P1a | Sequence and organize messy photos | Reuse extraction; add source references, sequence proposals, overlapping-board handling, visible partial failures, and reversible edits. Test reordered pages, repeated boards with new lines, conflicting page numbers, mixed subjects, and user overrides. |
| P1b | Add text/PDF inputs and desktop upload | Paste text first, then bounded PDF page ingestion; course-optional inbox and source inspection. Test corrupt/encrypted/oversized PDFs, cancellation, file MIME mismatch, ordering, interrupted saves, owner isolation, and preserving user edits. Exercise browser upload/edit/save/reopen and keyboard flows. |
| P2 | Generated practice from notes | Extend quiz generation into persistent, source-linked sets, attempts, progressive hints and review. Test answer consistency, unsupported concepts, changed numeric examples, revision pinning, owner isolation, reveal behavior and retry safety. |
| P3a | Source and enrichment evaluation foundation | Versioned fixtures, recorded-response replay, metric tests, a documented baseline, and manually reviewed examples. Include the reproduced negation/deadline failures and malicious retrieved pages. Separate source-extraction mistakes from organization/enrichment mistakes. No live search in normal CI. |
| P3b | Research with approval | Gap preview, scoped server-verified consent, cited proposed additions, and explicit acceptance in a separate removable layer. Test zero search calls before approval and after rejection; cross-user access; stale/expired consent; bounded retries; scope changes; missing or irrelevant citations; injection; and the prohibition on assignments, deadlines, exam dates, or board reconstruction. P3a is a prerequisite. |
| P4 | Pilot acceptance | Run real PostgreSQL isolation, cloud integration and backup/restore checks; browser/accessibility and physical-device capture checks; document latency, cost, failures, and student feedback before expanding access. |

For code milestones, run both TypeScript checks, the relevant automated suites, formatting and `git diff --check`. Run the web export for UI changes. Stub search/model calls in ordinary tests so CI does not spend money or disclose notes; provider-backed evaluation is an explicit separate run. Database tests use only a disposable test database. Package installation approval does not authorize applying a schema to RDS or moving existing data.

Build a small evaluation set covering printed and handwritten whiteboards, equations, diagrams, glare/crops, multi-photo order, incomplete notes, unrelated material, and problem sheets. Use consented/redacted real examples or clearly labeled synthetic fixtures; private student uploads must not enter Git by default. A release report should name the dataset and model/prompt versions, count extraction and citation errors, and show manual review results. Zero observed invented assignment/deadline claims on the test set is a release gate, not a guarantee about unseen inputs.

## First demonstrable slice

Start with **three out-of-order whiteboard photos, including one overlapping re-shot board → an ordered draft with clickable source references and a manual order override**. Preserve every original and do not lose the new line in the re-shot board. Reuse the current multi-photo pipeline. Then extend this demonstrated flow to pasted text and bounded PDFs, with a course-optional inbox, editable drafts, and visible retryable source failures. No web request occurs during this flow.

This is the next product implementation target after review of the existing AI/capture edits. Web enrichment follows only when the source and revision model can keep additions separate. Hardware remains optional; consider a student-operated capture device only if the pilot shows that taking/uploading photos is the main obstacle.
