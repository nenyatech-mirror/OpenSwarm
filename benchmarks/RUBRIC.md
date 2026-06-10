# OpenSwarm Coding Benchmark Rubric (L0–L6)

A rubric for measuring the coding capability of the OpenSwarm harness
(worker = `runAgenticLoop`, openrouter adapter) per difficulty level, and for
routing each level to the most **cost-efficient model** based on data.

> The unit under measurement is the **harness + model combination**. The codex
> adapter (delegates to the Codex CLI) bypasses the OpenSwarm harness and is
> excluded — always run measurements through the openrouter adapter.

## Difficulty ladder

| Lv | Name | Capability verified | Grading | Infra |
|----|------|--------------------|---------|-------|
| **L0** | Single edit | One-line to one-function bugfix | Regex (`check()`) | Instant |
| **L1** | Locate + edit | Add a guard, simple feature | Regex | Instant |
| **L2** | Multi-file | Rename/signature cascade (3–4 files) | Regex | Instant |
| **L3** | Make tests pass | Implement a stub until existing tests are green | **Test run** (`tsx`) | Instant |
| **L4** | Hard | Deep dependency chains, edge-case completeness, hidden-bug tracing, type changes | Test run + **tsc** | Instant |
| **L5** | Very hard | Algorithmic correctness (merge-intervals/LRU), state machines (tokenizer), generic types | Test run | Instant |
| **L6** | **Real-world** | **Real GitHub issues** (SWE-bench Lite) — large-repo exploration + root cause + exact patch | **Official swebench harness** (Docker) | OrbStack, minutes |

- **L0–L5**: `benchmarks/tasks/codingTasks.ts` (synthetic, self-contained). Fast
  regression suite. `npx tsx benchmarks/modelSelect.ts --repeat N`. Grading is
  deterministic — no LLM judge.
- **L6**: `benchmarks/sweBench.ts`. The OpenSwarm worker solves SWE-bench Lite
  instances; the official `swebench.harness.run_evaluation` grades them via
  FAIL_TO_PASS + PASS_TO_PASS.

## Recommended models per level (measured)

Derived from benchmark data (`benchmarks/results/`). Score = pass_rate → $/pass → tool calls.

| Lv | Recommended worker model | Rationale |
|----|--------------------------|-----------|
| L0–L3 | **z-ai/glm-4.7-flash** or deepseek-v4-flash | 100% pass, $0.002–0.004/pass. glm is fastest at 2759 tok/s (DeepInfra). Lightweight is enough |
| L4 | Lightweight + escalate | Lightweight models mostly pass (100%); frontier escalation absorbs failures |
| L5 | Lightweight (tolerating some failures) | glm/qwen fail 1–2 tasks like L5-lru (87–95%). Escalation absorbs it |
| **L6** | **Frontier (openai/gpt-5)** | **Lightweight models lack answer accuracy** — see L6 measurements below |

### L6 measurements (pylint-dev__pylint-7080, 2026-06)

| Model | Patch | Result | Notes |
|-------|-------|--------|-------|
| **openai/gpt-5** | ✅ | **RESOLVED** | Correct location in `expand_modules.py` (`os.path.relpath`) |
| gemini-2.5-flash | ✅ | unresolved | Only `pylinter.py` — missed the correct location |
| glm-4.7-flash | ✅ | unresolved | Touched the right file but inaccurate |
| qwen3-coder-30b | ✅ | unresolved | Inaccurate |
| deepseek-v4-flash | ❌ | (empty patch) | Never reached an edit |
| gpt-5-mini | ❌ | (empty patch) | Never reached an edit |

→ **Only the frontier model (gpt-5) solved this instance (1/6).** After the
compaction-threshold fix (24k→60k), lightweight models do produce patches, but
**their answer accuracy falls short of frontier**. SWE-bench Lite sits at
30–50% difficulty even for frontier models, so L6 needs frontier routing plus
generous maxTurns (80).

### "Can mandatory verification push a lightweight model through?" (v2, ceiling test)

We made the verification loop MANDATORY ("run run_tests.sh after every edit;
iterate while failing") and re-measured:

| Model | v1 (optional verification) | v2 (mandatory verification + all harness fixes) |
|-------|---------------------------|------------------------------------------------|
| gemini-2.5-flash | 1 edit, 0 verifications → wrong patch | **9 edits + 13 test runs** → still unresolved (FAIL_TO_PASS 0/1, PASS_TO_PASS 120/120 intact) |
| deepseek-v4-flash | 0 edits (pre-compaction-fix) | **Still 0 edits** — 80 turns of exploration, never committed to a change |

**Conclusion: for diagnosis-type bugs at this difficulty, it is effectively a
model ceiling.** Mandatory verification changed behavior dramatically (blind
submission → iterate loop), but the insight the answer required ("absolute vs
relative path representation mismatch in recursive discovery") never emerged
even after 13 rounds of feedback. The harness can provide opportunity (loops,
context) — it cannot provide diagnostic depth.

### Hybrid experiment: frontier diagnosis + lightweight implementation — ✅ all 3 attempted instances RESOLVED (3/3)

We measured the planner/worker split hypothesis directly: **gpt-5 performs a
read-only diagnosis** (root cause + concrete fix plan) → **a lightweight model
implements with the verification loop** → official swebench grading.
**4 cumulative passes** — reproducible across instances (5859, 7993) and
across implementers (deepseek).

| Configuration | Instance | Result |
|---------------|----------|--------|
| gemini solo (mandatory verification, 9 edits + 13 tests) | 7080 | unresolved — diagnosis failure |
| **gpt-5 diagnosis (52 read-only turns) + gemini implementation (3 edits + 2 tests)** | 7080 | **RESOLVED** ✅ |
| **gpt-5 diagnosis + deepseek-v4-flash implementation** (a model that made 0 edits solo) | 7080 | **RESOLVED** ✅ |
| **gpt-5 diagnosis + gemini implementation** (full pipeline on a new instance) | 5859 | **RESOLVED** ✅ |
| gpt-5 diagnosis + glm-4.7-flash | 7080 | Empty patch — **unfit as implementer** (ignored the no-edit guard, 0 edits) |
| gpt-5 diagnosis + gemini (v1–v5) | 7993 | unresolved — the implementer faithfully copied a bug in the first diagnosis's pseudocode |
| **gpt-5 re-diagnosis (fed the failing patch + test output) + deepseek implementation** | 7993 | **RESOLVED** ✅ |

→ **A lightweight model's L6 ceiling is "diagnostic depth"; fill just that gap
with a frontier model and it passes.** Implementer fitness varies by model:
deepseek ✅✅ (reliable mechanical finishing) / gemini ✅ (volatile finishing —
e.g. missed imports) / glm ✗.

**The re-diagnosis escalate loop (proven by 7993)**: when the first diagnosis's
fix plan contains a bug, the lightweight implementer copies it faithfully
("trust this analysis" — even an explicit trust-boundary instruction failed to
break through, 4 consecutive runs). The remedy is not persuading the
implementer but **re-diagnosing with the frontier model, feeding it the
failing patch + test output** — given that feedback, gpt-5 pinpointed the bug
in its own pseudocode (a missing Formatter.parse literal re-escape), and
deepseek finished the job with the revised diagnosis. Structurally identical
to the OpenSwarm worker escalate loop.
Run with SWE_DIAG_MODEL=openai/gpt-5 + SWE_MODEL=<lightweight>. Diagnoses are
reusable (SWE_DIAG_FILE) — retrying stage 2 on the same instance costs zero
frontier tokens.

Operational implication: even L6-grade work can use the "frontier planner
analyzes → lightweight worker implements" split, reducing frontier usage from
a full solve (82 turns) to a read-only diagnosis (52 turns). Lightweight
implementers are volatile (they can give up early even with the same
diagnosis) — the no-edit guard (`nudgeMaxOnNoEdit`) and a rich diagnosis
(including concrete pseudocode) are the success factors. Best-of-N has low
expected value (all 9 undiagnosed gemini attempts were wrong).

Additional hybrid failure modes (discovered on 7993):

- **Diagnosis error propagation**: if the diagnosis pseudocode itself is buggy
  (the missing Formatter.parse literal re-escape), the implementer copies the
  bug faithfully because of the "trust this analysis" instruction (3
  consecutive identical patches). → Added the "THE TEST RESULT OUTRANKS THE
  PLAN" trust boundary to the stage-2 instructions.
- **Verification-harness self-dismantling** (defect #6): the implementer
  misattributed test failures to the verification script and edited
  run_tests.sh five times. → `protectedFiles` option (rejects edit/write).
- **Silent bash timeout** (defect #7): the fixed 30s timeout died without
  output on docker-based test runs, leading models to conclude "the
  environment is broken". → `bashTimeoutMs` option + explicit TIMEOUT message.

## Routing principles (tiering)

- **Judgment-heavy roles** (Planner/decomposition, Reviewer): pinned to
  frontier (gpt-5). A wrong judgment poisons everything downstream, so these
  are never downgraded.
- **Execution roles** (Worker/Tester/Documenter/Auditor): lightweight by
  default + frontier escalation after 2 failures.
  - But **L6-grade real-world work should use a frontier worker too** —
    lightweight answer accuracy is too low.

## L6 grading procedure

```bash
# 1. Use OrbStack (stable amd64 emulation on Apple Silicon). Docker Desktop corrupts.
export DOCKER_HOST="unix:///Users/<you>/.orbstack/run/docker.sock"

# 2. The OpenSwarm worker solves the instance and produces predictions
OPENROUTER_API=... SWE_MODEL=openai/gpt-5 \
  npx tsx benchmarks/sweBench.ts <instances.json> <preds.json>

# 3. Grade with the official swebench harness (per-model, max_workers 1 — concurrency overloads the VM)
/path/swebench-env/bin/python -m swebench.harness.run_evaluation \
  --dataset_name SWE-bench/SWE-bench_Lite --predictions_path <preds.json> \
  --run_id <run> --instance_ids <id> --cache_level instance --max_workers 1
```

### L6 pitfalls (all confirmed by measurement)

- **OrbStack is required.** Docker Desktop corrupts with "unable to start" 503
  on every amd64 SWE-bench workload (reboot needed). OrbStack completes
  reliably.
- Old instances need period-correct Python (3.6–3.9) → use the conda env
  "testbed" inside the official Docker image. A naive venv won't work
  (`cgi` / `collections.Mapping` were removed from modern Python).
- Old `requests` instances depend on external httpbin (503s) → unsuitable.
  Prefer **pure-logic repos** (pylint/sympy/sphinx).
- Putting the same instance_id under multiple models in one prediction file
  grades only the last one → **grade per model separately**.
- Image tag: `swebench/sweb.eval.x86_64.<instance_id with __ replaced by _1776_>`.

## Harness defects — found and fixed at L6 (invisible on synthetic L0–L5)

L6 exposed defects that only manifest in large repos:

1. **cwd unawareness**: agenticLoop never told the model its working
   directory, so it guessed absolute paths → exploration fully blocked.
   → Inject `Working directory: <cwd>` into the user prompt.
2. **bash exit-1 misread**: grep "no match" (exit 1) was treated as a fatal
   error with no stdout returned → infinite retries.
   → Return stdout/stderr + exit code even on errors; exit 1 with no output
   is benign.
3. **Compaction loop** (the critical one): on long runs (60+ turns),
   compaction truncated freshly-read files, causing endless re-reads — edits
   were never reached. → Thresholds 24k→60k tokens, compactAfterMessages
   24→60, keepRecent 8→16.

(Defects #4–#7 — final-answer turn, no-edit guard, protected files, bash
timeout — were found later during the hybrid experiments; see the hybrid
section above.)
