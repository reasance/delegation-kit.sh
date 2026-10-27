---
layout: ../../layouts/DocLayout.astro
title: 'Executors — delegation-kit'
description: 'The external runners as adapters: what each can do, the three permission classes, model identity, exit codes, and the read-only patch verifier.'
path: '/docs/executors'
---

<!-- Synced from docs/external-executors.md in the kit repository: edit there, not here. -->

<!-- BEGIN AUTOGEN -->

# External executors: adapters and their limits

This page says what each adapter can technically do, how to check it on this
machine, and what you still do with its output. Seven runners ship with the
kit; `delegation-run` drives `codex` and `claude-code` itself. Each runner is the sole enforcement authority for
its own transport, credentials, sandbox, tools and refusals; nothing in the
configuration, the router or a skill can widen what it allows. Which model
runs is your choice ([user configuration](/docs/configuration)); where keys
are read from is in [keys and environment](/docs/configuration#keys-and-environment).

## Adapters

| adapter | runner | transport | key or login |
|---|---|---|---|
| `claude-zai` | `delegation-glm` | Claude Code CLI against the Z.AI endpoint | `ZAI_API_KEY` |
| `kimi-code-cli` | `delegation-kimi` | Kimi Code CLI in a macOS `sandbox-exec` profile | CLI login |
| `muse-code-cli` | `delegation-muse` | Muse Code CLI in a macOS `sandbox-exec` profile, on the subscription | CLI login (`muse login`) |
| `grok-build-cli` | `delegation-grok` | Grok Build CLI in its attested custom sandbox | CLI login |
| `token-plan-openai` | `delegation-qwen` | one chat-completions request | `QWEN_TOKEN_PLAN_API_KEY`, or `credential_env` |
| `deepseek-api` | `delegation-deepseek` | one chat-completions request | `DEEPSEEK_API_KEY`, or `credential_env` |
| `openai-compatible` | `delegation-openai-compatible` | one chat-completions request (HTTPS or loopback) | `credential_env`, or none |
| `agy` | `delegation-gemini` | Antigravity CLI, prompt-only, empty isolated workspace | CLI login |
| `codex` | `delegation-run` | `codex exec --sandbox read-only` in an empty temp dir | CLI login |
| `claude-code` | `delegation-run` | `claude -p`, no tools or MCP, in an empty temp dir | CLI login |

| adapter | roles → permission class | efforts (default) |
|---|---|---|
| `claude-zai` | clerk, scout, reviewer, policy-annotation: `read-only` · builder: `worktree-edit` | max |
| `kimi-code-cli` | clerk, scout, policy-annotation: `read-only` · builder, frontend-builder: `worktree-edit` | max |
| `muse-code-cli` | clerk, scout, reviewer, policy-annotation: `read-only` · builder, frontend-builder: `worktree-edit` | minimal … max (high) |
| `grok-build-cli` | policy-annotation: `read-only` · builder, frontend-builder: `worktree-edit` | high |
| `token-plan-openai` | text roles: `text-patch` | minimal … max (xhigh) |
| `deepseek-api` | text roles: `text-patch` | minimal … max (max) |
| `openai-compatible` | text roles: `text-patch` | minimal … max, sent only when declared (none) |
| `agy` | scout, builder, frontend-builder, reviewer, judgement: `read-only` | medium, high |
| `codex` | text roles plus routine-review, material-review, security: `read-only` | none … max (high) |
| `claude-code` | text roles plus routine-review, material-review, security: `read-only` | low … max (high) |

`delegation-route` and `decide --lane` report each adapter's
`capabilities`, the same for every role: `read-only` and `text-patch` (HTTP
adapters, `agy`), `sandboxed-worktree` (`kimi-code-cli`, `muse-code-cli`,
`grok-build-cli`),
`native-tool-policy` (`claude-zai`), `native-profile` (`codex`,
`claude-code`).

*Text roles* are builder, clerk, scout, reviewer, senior, judgement and
policy-annotation. Parameters: every adapter takes `timeout`;
`deepseek-api`, `token-plan-openai` and `openai-compatible` add `effort`
and `max_tokens`, `muse-code-cli` adds `effort` and `contributor_mode`,
the rest add `effort`. `openai-compatible` sends the
effort as `reasoning_effort` only when the profile declares one, so an
endpoint that does not know the field never sees it. The Claude
Code and Codex host profiles the kit installs keep their own sandbox; only
the `delegation-run` entry is read-only and prompt-only.

`<runner> check --json` is the authority on this machine. It reports
`model`, `adapter`, `roles`, `efforts`, `selected_backend` and
`backends.{available, reason}`; native runners add their sandbox, process
allowlist, OAuth mode and isolation. Run it just before a dispatch: a runner
that reports `selected_backend: "none"` refuses with exit 69.

## Permission classes

Exactly three, mutually exclusive, fixed per adapter and role:

| class | worktree writes | product |
|---|---|---|
| `read-only` | no | analysis text |
| `text-patch` | no (no filesystem) | patch text; the [lead](/docs/configuration) applies and verifies it |
| `worktree-edit` | scoped to the delegated worktree | edits in place |

A builder role on a text adapter grants no filesystem: its output is a
unified diff, and the trust boundary is where the lead applies it.

## Muse Code: subscription or API key

Meta's Muse models ship two ways, and you choose by profile:

| profiles | adapter | billed | needs |
|---|---|---|---|
| `muse-code-wonder-full`, `muse-code-wonder`, `muse-code-spark` | `muse-code-cli` | your Muse Code subscription | `muse login` (browser) and an active plan; Wonder Full needs the Power or Maximum plan |
| `muse-wonder-1.0`, `muse-spark-1.3` | `openai-compatible` | per token, on the Meta Model API | `META_API_KEY` |

- **The CLI lane never sees `META_API_KEY`.** Muse Code prefers an API key
  over the browser sign-in, so a key in its environment would move the run
  to per-token billing without saying so. A sign-in made with an API key
  (`muse auth set`) is refused (`check` says why); use the HTTP profiles
  for that. The receipt records `billing: subscription` and whether the
  response carried the plan's `allowance`.
- **Contributor mode** decides whether Meta may train on what a run sends:
  the profile's `contributor_mode`, `on` or `off`, `off` when unset. Every
  run passes it explicitly, so the setting saved in Muse Code does not
  apply, and the receipt records it.
- **Isolation.** The runner calls the release binary the `muse` launcher
  selected (no launcher, no self-update during a run) from an isolated home
  that holds minimal settings, a copy of `auth.json` and a link to the login
  keychain, where the token lives; the kit never reads the token. No user
  or project rules, skills, hooks, MCP servers or memory load. The shell is
  off in every role, as are web tools, reminders, questions to the user and
  approvals; read-only roles also have writes off. Under `sandbox-exec`
  only the Muse binary may execute, the ambient home is unreadable except
  the keychain, and writes go only to runner scratch, the keychain, and the
  worktree for builders.
- **One dispatch at a time.** A kit lock serializes Muse runs, because each
  refreshes the same sign-in; a refreshed `auth.json` goes back to the
  ambient file unless that file changed meanwhile (exit 75,
  `oauth_conflict`).
- **Muse Wonder Full** exists only on the subscription, so it has no API
  price: the catalog ranks it at Muse Wonder's ($4/$20), never as free.
- **Known limits.** Muse Code's own telemetry follows its defaults: the
  kit sets no option it does not document. Its bundled skills still load.

## Checking a text patch

`delegation-patch-verify` enforces the versioned policy in
[`config/external-patch-policy.json`](https://github.com/reasance/delegation-kit/blob/delegation-kit--v0.35.1/config/external-patch-policy.json).
It never applies a patch: it parses it, checks it against the policy, fixes
the strip level from the header shape, runs `git apply --check` at that one
level, and prints a receipt with no patch content.

```sh
# 1. verify — read-only; nothing is applied and nothing is written
delegation-patch-verify check --patch "$patch" --workdir "$repo" --json >receipt.json

# 2. inspect the receipt: verdict, paths, operations, and the strip level
jq '{verdict, file_count, operations, strip, files: [.files[].path], violations}' receipt.json

# 3. the LEAD applies it, with the strip level the receipt recorded
git -C "$repo" apply -p"$(jq -r '.strip.chosen' receipt.json)" -- "$patch"

# 4. the LEAD runs the tests — provider output is never proof that a change works
( cd "$repo" && ./run-tests.sh )
```

The default policy is fail-closed:

- **Format:** unified diff text only.
- **Paths:** no absolute, traversing or non-representable paths.
- **Denied paths:** `.git`, hooks, CI, `.env*`, shell startup files, keys,
  credential stores, this kit's provider auth directories.
- **Modes:** new files only as `100644`; no symlinks, submodules or mode
  changes.
- **Operations:** add and modify; delete only with `--allow-delete`; rename
  and copy refused, with no override.
- **Limits:** bounded file count, bytes, lines, hunks and added lines.

The strip level is fixed by the header shape, never guessed. The verifier
digests the patch, worktree, index and git control directory before and
after its run, and reports `attestation-failed` if anything changed. Its own
exit codes: 0 accepted, 64 invalid input, 65 rejected by policy, 66 patch or
worktree unreadable, 69 missing dependency, 70 attestation failed.
`delegation-patch-verify policy --json` prints the installed policy;
`tests/external-patch-verify.sh` is its regression suite.

## Model identity

Every run records the requested model apart from what the provider reported:

| field | meaning |
|---|---|
| `requested_model` | what the profile asked for, never read from a response |
| `provider_reported_model` | the model the provider named in its response, or `null` |
| `model_identity_source` | `provider-reported` when a response named the requested model or a configured alias; `requested-only` when the provider named nothing |

A response naming a *different* model fails with exit 70
(`provider_identity_mismatch`) unless the name is in the profile's
`aliases`. A provider report certifies nothing. `requested-only` is not a
defect: some transports never name a model, and Claude Code's JSON result
never does, so a `claude-code` profile is always `requested-only`. Grok's
`usage_model` (`grok-4.6-build`) is the billing participant, not the content
identity.

[`delegation-router serve`](/docs/router) discloses a mismatch on an HTTP pool
profile (`mismatch: true`, `provider_reported_model`,
`X-Router-Model-Mismatch: 1`) instead of failing; a native pool profile goes
through `delegation-run` and fails as `502 provider-identity-mismatch`.

## Exit codes

| code | retryable | meaning |
|---|---|---|
| 64 | no | invalid input: unknown argument, missing or colliding path, refused flag combination |
| 65 | no | `delegation-run`: invalid configuration or paths, unsupported role, missing CLI, malformed native response |
| 69 | no | unavailable: runtime, login, entitlement, key or quota; also a `credential_env` variable that is unset (`missing_credentials`) |
| 70 | no | dispatch, sandbox, identity, extraction or publication failure |
| 75 | **yes** | temporary: rate limit, overload, 5xx, timeout, credential lock |
| 78 | no | the adapter does not support the requested role or effort |
| 130 | no | the caller interrupted (Kimi, Muse Code); the runner stopped the child and released its locks |

A failure writes a sanitized `<output>.error.json` (phase, reason, sizes,
exit codes) and publishes no output or metrics. Raw provider responses are
kept only under an explicit `--debug-dir`, mode 700.

## Timeouts

No runner has a time limit of its own. Without the profile's `timeout`, a
hung run waits until you interrupt it, and Kimi, Muse Code and Grok hold their OAuth
lock the whole time. With it (whole seconds, 1–86400), `delegation-run`
exports it as `DELEGATION_TIMEOUT` and the run is bounded:

| adapter | mechanism | on expiry |
|---|---|---|
| `kimi-code-cli`, `muse-code-cli`, `grok-build-cli`, `claude-zai` | `timeout -k 10` (or `gtimeout`) around the CLI; without either on `PATH` the runner refuses with exit 69 | exit 75, reason `timeout` (`operational_timeout` on Kimi and Muse Code) |
| `deepseek-api`, `token-plan-openai`, `openai-compatible` | curl `--max-time` | exit 75, reason `deadline_exceeded` |
| `codex`, `claude-code` | subprocess deadline in `delegation-run` | exit 75, reason `timeout` |
| `agy` | `agy --print-timeout` (24h when unset) | the CLI's failure: exit 70, reason `process_exit` |

A run that hits the deadline publishes nothing. macOS ships neither
`timeout` nor `gtimeout`; Homebrew's `coreutils` provides `gtimeout`. Two
guards are not task limits: a 20 s connect timeout on the HTTP adapters,
and the short probes `check` runs against a CLI. On Grok, `check --json`
reports `timeout_seconds` (the configured value or `null`).

<!-- END AUTOGEN -->
