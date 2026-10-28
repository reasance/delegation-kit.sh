---
layout: ../../layouts/DocLayout.astro
title: 'Compatibility — delegation-kit'
description: 'Supported-agent matrix, verified release snapshots, and host-specific rules for delegation-kit.'
path: '/docs/compatibility'
---

<!-- Synced from docs/compatibility.md in the kit repository: edit there, not here. -->

<!-- BEGIN AUTOGEN -->

# Compatibility and release verification

This page records what was observed, on which machine and day, before each
tag. A passing check shows that what was tested ran; it qualifies no model and
grants nothing (which model to use is
[your choice](/docs/configuration)). Each release replaces the snapshot
below with the numbers observed after running the
[gates](#reproduce-the-integration-gates). Snapshots 0.16 through 0.26 live in
`CHANGELOG.md` and in this file's history.

## Verified snapshot

**0.36.0, checked on 2026-10-28** on macOS with Claude Code `2.1.312`,
Codex CLI `0.165.0`, Python `3.15.2` and gh `2.103.3`, from the release
candidate.

- **Install and doctor:** source installed into isolated Claude, Codex, bin,
  data and personal-configuration directories. Static doctor: `49 OK, 1 WARN,
  0 FAIL`; `doctor.sh --ping`: `51 OK, 1 WARN, 0 FAIL`. The one warning is
  the intentionally absent normal Codex `config.toml`. The installed
  `luna-clerk`/max returned `PONG`, then Claude `sonnet`/low returned `PONG`.
  Exactly two separately authorized calls were consumed, with no retry or
  fallback. Claude's call disabled tools, hooks and MCP through the release
  wrapper. These are reachability checks, not provider identity attestation
  or qualification of the new builder/reviewer choices.
- **Offline:** 14 suites, 11 npm-wrapper tests, ruff, ShellCheck and version
  consistency passed. Router regressions cover suite-mismatched overlays,
  null scores, unmeasured effort, exact slugs and nonmonotonic effort scores.
- **Catalog:** the reviewed controller snapshot uses Intelligence Index v5.0
  and unchanged official token prices. A read-only native refresh over the
  same 715 API rows agreed with every controller index, preserved official
  price/source facts, selected DeepSeek 1017 at 32.5, and kept Muse Wonder
  Full's unknown price unset. The controller-generated catalog is retained
  so its version/source provenance and consumer sync stay reproducible.
- **Installation regression:** the first isolated install revealed that legacy
  cleanup removed the newly reintroduced `terra-builder` files. Cleanup now
  skips shipped names, and regression coverage checks the new Terra files,
  their model/effort, and the read-only Opus judge. The corrected installation
  was verified before either live call. Existing edited user profiles retain
  the installer's preservation behavior.

### Earlier releases


**0.35.1, checked on 2026-10-27** on macOS, from this release candidate.

- **Install and doctor**: installed into isolated Claude, Codex, bin, data
  and personal-configuration directories. `doctor.sh` returned
  `50 OK, 1 WARN, 0 FAIL`; `doctor.sh --ping` returned
  `52 OK, 1 WARN, 0 FAIL`. The warning is the intentionally absent normal
  Codex `config.toml` in the scratch installation. The installed `luna-clerk`
  profile returned `PONG`, followed by Claude `sonnet` at effort `low`.
  Exactly two calls were authorized and observed, once each, with no retry
  or fallback. These reachability checks do not attest the provider's model
  identity and did not dispatch Terra through this kit.
- **Offline**: 14 suites passed in 45 seconds, 11 npm-wrapper tests, ruff,
  ShellCheck and version consistency.
- **Catalog**: generated from controller-models, with Terra's official
  pricing and six Artificial Analysis effort results verified 2026-10-27.
  Existing shipped presets and personal user configuration stay unchanged.
  A fresh read-only trial of the upstream refresh still matched
  `deepseek-flash` to the older 39.5 row instead of 1017 at 45.1,
  inserted a zero price for Muse Wonder Full and discarded official price
  sources. As for 0.35.0, the reviewed controller output is retained; the
  upstream refresh is not written over it. Terra's six results agree with
  the fresh Artificial Analysis response.

### Additional earlier releases

**0.35.0, checked on 2026-10-25** on macOS 26.5.1 with Claude Code
`2.1.310`, Codex CLI `0.164.0`, Kimi Code `2.3.1` and Muse Code `1.4.13`
(`1.4.13-R6996.1`).

- **Offline**: the 14 suites green in 53 seconds, ShellCheck at
  `-S warning` on the 30 files CI collects, ruff, the eleven Node tests,
  the version gate and `git diff --check`.
- **Install and doctor**: a reinstall from the release branch removed no
  edited profile and installed `sol-builder` and `sol-reviewer` in place of
  the `terra-*` ones. Static `doctor.sh` reports `57 OK, 6 WARN, 0 FAIL`;
  `doctor.sh --ping`: `59 OK, 6 WARN, 0 FAIL`, the Claude → Codex
  round-trip returned `PONG`.
- **Catalog**: written by controller-models from its registry, with that
  day's Artificial Analysis index and every price re-checked on its official
  page on 2026-10-25. `catalog refresh --shipped` was not used: it matched
  `deepseek-flash` to the retired V4.1 Flash (39.5) instead of V4.1 Flash
  1017 (45.1), priced Muse Wonder Full at $0 and dropped the price sources.
- **External models**: none was called through the kit's runners for this
  release (the GLM lane has no Z.ai key on this machine). The usage key
  `delegation-grok` now reads, `grok-4.7-build`, was observed on 2026-10-25
  in a Grok Build CLI run with `grok-4.7` made through bottega-kit.

### Additional earlier releases

Newest first. "Suites" means the regression suites; every live call was
authorized and no key was printed.

- **0.34.1** (2026-10-24, Claude Code `2.1.310`, Codex `0.164.0`, Kimi
  Code `2.3.1`, Muse Code `1.4.12-R6909.1`): suites in 48 s, ShellCheck,
  ruff, Node tests, version gate; doctor `57 OK, 6 WARN, 0 FAIL`, with
  `--ping` `59 OK`. Catalog refreshed, nothing changed. The old
  `matteoscurati/delegation-kit` URL still listed the 0.34.0 tag.
- **0.34.0** (2026-10-24, Claude Code `2.1.309`, Codex `0.164.0`, Kimi
  Code `2.3.1`, Muse Code `1.4.12-R6909.1`): suites in 43 s (new: the Muse
  runner suite, `openai-compatible` effort, `contributor_mode`); doctor
  `57 OK, 6 WARN, 0 FAIL`, with `--ping --ping-muse` `60 OK`. Catalog: Muse
  Spark 1.3 (48.1, `mid`), Muse Wonder (52.4) and Muse Wonder Full (55.8,
  hand-priced at $4/$20) new. Live on the subscription, Contributor mode
  off: Spark `PONG` from an isolated home, a sandboxed read and a
  one-file builder edit, `muse-code-wonder` and `muse-code-wonder-full`
  `PONG` through `delegation-run`. API-key Muse profiles not dispatched.
- **0.33.0** (2026-10-23, Claude Code `2.1.309`, Codex `0.164.0`): suites
  in 43 s; a fresh `init` validated and listed `minimax-m3.1-flash`; doctor
  `55 OK, 6 WARN, 0 FAIL`, with `--ping` `57 OK`. MiniMax not dispatched.
  Catalog refreshed, nothing changed.
- **0.32.0** (2026-10-23, Claude Code `2.1.309`, Codex `0.164.0`, Kimi
  Code `2.3.1`): suites in 44 s (two new Kimi runner cases); doctor
  `55 OK, 6 WARN, 0 FAIL`, with `--ping --ping-kimi` `58 OK`, Codex and
  Kimi K3.1 Pro both `PONG`. Catalog refreshed: Kimi K3.1 Pro new at 55.1
  (`frontier`).
- **0.31.0** (2026-10-23, Claude Code `2.1.309`, Codex `0.164.0`): suites
  in 44 s (86 router tests, seven new for conversation pins, out-of-schema
  answers, harness blocks and native dispatch cancellation); doctor
  `55 OK, 6 WARN, 0 FAIL`, with `--ping` `57 OK`. Catalog refreshed,
  nothing changed. Live: the Jev decider, decider `eval` runs and 250 pool
  dispatches for the golden sets; see
  [Decider measurements](#decider-measurements).
- **0.30.4** (2026-10-21, Claude Code `2.1.306`, Codex `0.163.0`):
  housekeeping; suites in 51 s (79 router tests; the installer suite at 18,
  one new for files a release no longer ships); a reinstall removed the two
  library modules earlier releases had left; doctor `55 OK, 6 WARN, 0 FAIL`.
  Catalog refreshed, nothing changed.
- **0.30.3** (2026-10-21, Claude Code `2.1.306`): documentation and one
  `check` warning; suites in 214 s (79 router tests), ShellCheck, ruff, Node
  tests, version gate; doctor `55 OK, 6 WARN, 0 FAIL`, and without a
  personal configuration it named the missing keys file and reported four
  FAILs without stopping. Catalog refreshed, nothing changed.
- **0.30.2** (2026-10-20, Claude Code `2.1.304`): suites in 49 s (79 router
  tests), ShellCheck, ruff, Node tests, version gate; doctor `55 OK, 6 WARN,
  0 FAIL`, and without a personal configuration it no longer stopped on an
  unset variable. Catalog refreshed: MiniMax-M3.1-Flash 42.4 → 42.7, still
  `mid`.
- **0.30.1** (2026-10-20): docs and guard wording only; suites and version
  gate pass. MiniMax-M3.1-Flash dispatched once with its key only in the
  personal `.env`: `PONG` in 3 s, `provider_reported_model`
  `MiniMax-M3.1-Flash` (`provider-reported`), 214 input / 14 output tokens.
- **0.30.0** (2026-10-20): suites (new personal `.env` tests), ShellCheck,
  ruff, version gate. The reinstall created `~/.config/delegation-kit/.env`
  from `.env.example`, mode 600; an `openai-compatible` MiniMax profile with
  its key only there was reachable in `check`. Doctor `55 OK, 6 WARN, 0 FAIL`
  (new line: the keys file's mode and variable count).
- **0.29.1** (2026-10-19): catalog only. MiniMax-M3.1-Flash replaced
  MiniMax-M3, matched by slug at 42.4 (`mid`, $0.15/$0.60); 24 of 25 placed;
  everything else unchanged since 2026-10-17. Suites and version gate pass.
- **0.29.0** (2026-10-19): suites (75 router tests), ShellCheck, ruff, Node
  tests, version gate. Eight-profile pool all reachable, runner checks
  0.04–3 s (Kimi longest); doctor `54 OK, 6 WARN, 0 FAIL`. From a source
  checkout the GLM runner's key file was not found and `check` reported it
  unreachable. Live: two `decide --lane builder` calls to the DeepSeek Flash
  decider, nothing dispatched: a rename rated 0 →
  `glm53-flash-max-builder` (cheapest of five builders), a Go deadlock 2.5
  (minimum 43.6) → `kimi-k3`, the three profiles without the role blocked;
  0.8–1.1 s each.
- **0.28.0** (2026-10-19): suites (70 router tests), ShellCheck, ruff, Node
  tests, version gate; doctor `54 OK, 2 WARN, 0 FAIL` (`luna-clerk`,
  `opus-reviewer`: native limits). Live: four `decide --raw` calls to the
  DeepSeek Flash decider, no pool profile dispatched: a rename 0 (`code`), a
  contract summary 1, a Go worker-pool deadlock 2.5 (`code`), a four-colour
  proof 3.5 (`math`, `rare`); 0.8–1.1 s, about $0.00014 each; minimums 0, 0,
  43.6, 49.6. README routes checked against `choose()` with the shipped
  presets.
- **0.27.2** (2026-10-19, Claude Code `2.1.303`): suites (installer PATH
  warning asserted both ways), ShellCheck, ruff, Node tests, version gate;
  doctor `53 OK, 0 WARN, 0 FAIL` with `opus-builder` and `opus-reviewer`
  pinned to `claude-opus-5-5/max`. Live: `delegation-run --profile
  opus-reviewer --lane routine-review` answered `PONG` in 3 s; receipt
  `requested_model: claude-opus-5-5`, `model_identity_source: requested-only`
  (Claude Code's JSON result names no model). README routing example checked
  against `choose()`.
- **0.27.1** (2026-10-17): npm wrapper only; suites, ShellCheck, ruff and the
  eleven Node tests pass, three of them new for `--ref`.
- **0.27.0** (2026-10-15, re-checked 2026-10-17; Codex CLI `0.163.0`, Claude
  Code `2.1.302`): suites in 46 s (about 80 s on macOS CI), 64 router tests,
  ShellCheck, ruff, eight Node tests, ten-check version gate; reinstall and
  `doctor.sh --ping` `55 OK, 0 WARN, 0 FAIL`, router `not configured —
  optional`. `catalog refresh`: 700 rows, 24 of 25 models matched by slug or
  alias; re-run with `--shipped` on 2026-10-17, placements and prices as on
  2026-10-15. Deciders measured (below). A no-spend probe of `serve` against
  the real DeepSeek and Qwen endpoints with fake keys returned
  `401 provider-key-rejected` naming the default profile, with no key in the
  response or in the single log line. Dipylon was not probed (no local
  service running); no pool model was dispatched.

## Decider measurements

Live, 2026-10-15 (0.27.0), each call authorized.

| decider | version | prompts | latency | cost per decision |
|---|---|---|---|---|
| Levanto Sage | `levanto-sage-v1.4` | 3 | 0.8–2.0 s short; 7–13 s on a 900-token excerpt | ≈ $0.00003 short; ≈ $0.005 long (fanout billed 0 and ~500 output tokens with `reasoning: "off"`) |
| TypeSafe Jev | `jev-1.13.0` | 2 | ~250 ms | ~$0.00002 |
| `llm`, DeepSeek V4.1 Flash (kit key file) | — | 3 | 1.0–1.2 s | $0.00012–0.00015 |
| `llm`, Qwen3.8 Max (kit key file) | — | 3 | 5–10 s, still reasoning at `minimal` | $0.0014–0.0025 |

What they rated: a rename 0.7–1.0 with `code`; a race-condition design
question 1.6–1.7 (Sage, Jev; Sage adds `rare` 0.98) and 2.0 (DeepSeek, Qwen:
"classic SELECT-then-UPDATE race, SKIP LOCKED"); a percentage question 1 with
`math`. "Needs a frontier model" was ≈ 0.01–0.09 everywhere. The deciders
agree with each other and rate the race condition lower than a human would,
which is why `eval` on a golden set exists.

Live, 2026-10-22 and 2026-10-23 (0.31.0), each call authorized:

- **Jev** answered as `jev-1.14.0` (it was `jev-1.13.0` a week earlier) in
  235–376 ms for ~$0.00002, its score always carrying `probabilities` keyed
  `"0"`–`"4"`. Its own confidence was kept: Sage's band mass in its place,
  replayed on 20 recorded answers, changed no answer and sent two more
  requests to the default.
- **Harness blocks**: 20 items, each also wrapped in OpenCode's, Roo Code's
  and Claude Code's blocks, decided with 0.30.4 and with 0.31.0 by the
  DeepSeek Flash `llm` decider and by Jev. The tier never changed across
  variants (robustness 1.0 in all four runs); with the blocks dropped the
  decisions cost 25 % (DeepSeek) and 23 % (Jev) less. DeepSeek p50 1.1 s,
  p95 1.3 s; Jev p50 0.23 s, p95 0.33 s.
- **Golden sets**: the 20 items were answered correctly by all eight pool
  models, so they measure over-spending only. Of 30 harder candidates
  (program tracing, counting, search), GPT-5.6 Luna solved 29 and
  MiniMax-M3.1-Flash 25; on the five either missed, DeepSeek Flash, Opus 5.5
  and GPT-5.6 Terra solved all five, GLM 5.3 Flash four, Kimi K3 and
  Qwen3.8 Max three (GLM and Qwen ran out of 30 minutes on one). Both
  deciders rated all 30 between 1 and 2.7, never at the frontier; the `llm`
  decider sent one of them to Kimi, which got it wrong, and Jev's
  needs-frontier answer sent it to the default, which got it right. Kimi
  scores above DeepSeek on the index and did worse here: five items are a
  hint about the index, not a measurement of it.

## Host-specific boundaries

### Codex profiles

Use the shipped ephemeral profiles with:

```sh
codex exec --ephemeral -p <profile> "<self-contained prompt>" </dev/null
```

Do not add `--ignore-user-config`: Codex then ignores the selected `-p` profile
as well and can silently use the ambient base model. Treat the model, effort,
and sandbox shown in the invocation banner as part of the smoke assertion.
Ephemeral profiles carry no role prose, so the prompt must be bounded and
self-contained; native agent profiles carry their role through
`developer_instructions`.

### Claude Code agents

The clerk and scout agents expose Bash, to inspect Git state and run
read-only search or test commands; the reviewers and the judge do not. For
those two, read-only is role discipline plus the parent's permissions, not
Codex's OS-enforced read-only sandbox: run them on a clean worktree and check
`git diff` and `git status` afterwards.

For headless checks outside the current repository, pass the canonical
fixture path through `--add-dir`; macOS `/var` and `/private/var` aliases can
otherwise make an allowed temporary fixture look like a different path.
`--output-format json` does not settle model identity: its result names no
model (0.27.2 above).

External runners: see [Executors](/docs/executors) for `check --json`
and exit codes.

## Reproduce the integration gates

```sh
./run-tests.sh          # every suite under tests/, in parallel
./doctor.sh --ping
git diff --check
```

For semantic verification, use disposable Git repositories and
role-appropriate prompts: deterministic extraction for clerks, flow tracing for
scouts, one bounded edit for builders, concrete bug detection for reviewers,
and a reversible architecture decision for judges. Verify exact model identity,
scope, output meaning, and worktree changes—not merely process exit.

<!-- END AUTOGEN -->
