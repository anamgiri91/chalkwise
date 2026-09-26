# Grounding evaluation

Chalkwise removes generated assignments and exam mentions that the lecture transcript
does not support (`src/lib/grounding.ts`, called from `server/src/analysis.ts`). A
student who trusts an invented deadline is worse off than one who used no app, so
this check is the most consequential piece of AI logic in the product. This page
measures it.

```sh
node scripts/eval-grounding.mts                          # both verifiers, both splits
node scripts/eval-grounding.mts --misses                 # every wrong decision
node scripts/eval-grounding.mts --compare lexical,clause # paired significance test
node scripts/eval-grounding.mts --sweep                  # threshold sweep (dev split only)
```

`tests/grounding-eval.test.ts` runs in `npm test` and fails if either verifier drops
below its floor on the held-out split.

## Dataset

`tests/fixtures/grounding-eval.jsonl`: 156 transcript/claim pairs over 16 board
transcripts from 16 different courses. Each claim is labelled **supported** (a student
could act on it as written) or **unsupported** (it would mislead them), with a category:

| Kept when correct | Removed when correct |
| --- | --- |
| verbatim, paraphrase, reformatted (`10/14` → `October 14`, `ch.` → `chapter`) | changed number, changed date, misattribution (a real value from a different item), negation (`no lab Monday`), cancellation (`moved from Wed`), contradiction (`closed book` → `open book`), invented |

| Split | Transcripts | Supported | Unsupported |
| --- | --- | --- | --- |
| dev | 10 | 45 | 51 |
| holdout | 6 | 24 | 36 |

The dataset was committed on its own (commit `23987a0`) before the candidate verifier
was written, and the verifier was designed and tuned only against the dev split. The
holdout split was scored once, after the design was frozen.

## Results

"Removed" is the positive class. **Catch rate** is the share of unsupported claims
removed; **false removal rate** is the share of supported claims removed. Intervals are
95% percentile bootstrap intervals (2,000 resamples, fixed seed).

### Held-out split (60 claims)

| Verifier | Catch rate | False removal rate | Precision | Accuracy |
| --- | --- | --- | --- | --- |
| `lexical` (production today) | 44.4% [27.8, 61.1] | 8.3% [0.0, 20.8] | 88.9% | 63.3% |
| `clause` (candidate) | **94.4%** [86.1, 100] | **4.2%** [0.0, 12.5] | 97.1% | 95.0% |

### Dev split (96 claims)

| Verifier | Catch rate | False removal rate | Precision | Accuracy |
| --- | --- | --- | --- | --- |
| `lexical` | 41.2% [27.5, 54.9] | 4.4% [0.0, 11.1] | 91.3% | 66.7% |
| `clause` | 92.2% [84.3, 98.0] | 0.0% [0.0, 0.0] | 100% | 95.8% |

### Paired comparison

Exact McNemar test over claims the two verifiers decide differently:

| Split | Only `lexical` right | Only `clause` right | p |
| --- | --- | --- | --- |
| dev | 0 | 28 | 7.5e-9 |
| holdout | 0 | 19 | 3.8e-6 |

The candidate never gets a claim wrong that the production check got right.

### Where the production check fails (held-out)

| Category | `lexical` | `clause` |
| --- | --- | --- |
| negation | 0/4 | 4/4 |
| misattribution | 0/6 | 6/6 |
| cancellation | 1/2 | 2/2 |
| changed number | 6/11 | 10/11 |
| invented | 3/6 | 6/6 |
| contradiction | 2/3 | 2/3 |
| reformatted (kept) | 15/17 | 16/17 |

The production check asks whether the *whole transcript* contains a claim's words, so
"Program 2 due Oct 8" survives when one line says "Program 2 … Oct 2" and another
"Exam 1 Oct 8". It also splits `4.1` into `4` and `1`, so "Problem Set 4" matches
"section 4.1", and it cannot read `no`, `not`, `moved from` or `was`. The code comment
in `grounding.ts` already warned about the negation case; this measures it.

### Threshold sweep (dev split, `lexical`)

| `minContentTokenRatio` | Catch rate | False removal rate |
| --- | --- | --- |
| 0.3 | 37.3% | 4.4% |
| 0.5 | 39.2% | 4.4% |
| **0.6 (current)** | 41.2% | 4.4% |
| 0.7 | 45.1% | 24.4% |
| 0.8 | 54.9% | 31.1% |
| 1.0 | 58.8% | 40.0% |

0.6 sits at the knee: raising it catches a few more fabrications at the cost of
removing a quarter of real assignments. Tuning the ratio cannot fix the production
check. The failures are structural, which is why the candidate changes *where* it
looks rather than how much overlap it demands.

## How the candidate works

`isSupportedByClause` in `src/lib/grounding.ts`:

1. **Normalize** both sides: `10/14` → `october 14`, `11pm` → `11 pm`, common board
   shorthand (`ch`, `pp`, `hw`, `hrs`, `sec`, `pts`, `TBA`…) expanded.
2. **Segment** the transcript into board items: one per line, except that a line
   repeating the previous line's first word continues it.
3. A claim is kept only if **one item** contains all of its numbers (decimals and
   ranges compared whole, so `5-8` ≠ `5-7`), all of its dates, and enough of its words.
4. Within that item it is removed if it asserts something the board **negates** (words
   within three content words after `no`/`not`/`without`), a **superseded** value (after
   `was`, or after `from` on a line that says moved/pushed/rescheduled), or the
   **opposite** of a short list of pairs (`open`/`closed`, `before`/`after`,
   `required`/`optional`, `individual`/`group`).

It is not yet used by the analysis pipeline. Wiring it in changes what students see,
so it should be switched on deliberately. The measured change is fewer invented items
reaching students and fewer real items removed.

## Limitations

- **Same author for both splits.** The holdout split protects against tuning to
  specific cases, not against the author's blind spots. Both verifiers are rule-based,
  and a set written by the person who wrote the rules flatters them. The real test is
  labelled transcripts from pilot captures; add them as a third split and report it
  separately.
- **Adversarial, not representative.** Roughly half the claims were written to break
  word matching. These rates do not estimate how often students see a wrong item in
  production.
- **Small.** 60 held-out claims give intervals ±10–15 points wide. The paired test is
  the stronger evidence that the candidate is better.
- **Known misses.** Claims whose number happens to appear elsewhere on the same line
  ("chapter 8" on a line that says "opens 8am"), implications ("Free-body diagrams will
  be on the test"), and paraphrased contradictions ("bring your own formula sheet" when
  one is provided). These need a model that reads sentences, such as an entailment
  model or an LLM judge, which would be the next verifier to add to this harness.
