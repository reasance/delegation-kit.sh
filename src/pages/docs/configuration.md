---
layout: ../../layouts/DocLayout.astro
title: 'Configuration — delegation-kit'
description: 'How delegation-kit profiles, adapters, keys and review policies work: the personal configuration file, delegation-config, and delegation-run.'
path: '/docs/configuration'
---

<!-- Synced from docs/user-configuration.md in the kit repository: edit there, not here. -->

<!-- BEGIN AUTOGEN -->

# User configuration

This page sets up your profiles, keys and review policy. Models are your
choice: no benchmark, gate or kit qualification authorizes or blocks a
profile. The only checks are the adapter's technical limits and the verification of
the result by the lead (you, or the Claude Code or Codex session that
delegated the task). The starting profiles ship in
`config/presets.json`.

## Configure

The personal configuration lives at
`${XDG_CONFIG_HOME:-$HOME/.config}/delegation-kit/config.json`. Set
`DELEGATION_CONFIG_FILE` to use another file. Project-local configuration is
never discovered.

| command | what it does |
|---|---|
| `delegation-config init` | creates the file with `"schema_version": 2`; never overwrites an existing one. `--preset strict` sets cross-family review. |
| `delegation-config validate` | checks the file locally; never contacts a provider |
| `delegation-config show` | prints the validated configuration, with credential variable names only |
| `delegation-config apply` | regenerates `managed/profiles.json` and conservative native Claude and Codex snippets beside the configuration; edited snippets are kept and listed |

`delegation-run` reads the configuration directly. The snippets exist only
for explicit host integration; the native host profiles the kit installs keep
their own permissions.

## Profiles

A complete configuration for an existing provider and a local endpoint:

```json
{
  "schema_version": 2,
  "review_policy": "optional",
  "profiles": {
    "my-deepseek": {
      "adapter": "deepseek-api",
      "model": "deepseek-flash",
      "family": "deepseek",
      "roles": ["builder", "reviewer"],
      "credential_env": "DEEPSEEK_API_KEY",
      "parameters": {"effort": "max", "max_tokens": 4096, "timeout": 120}
    },
    "local-model": {
      "adapter": "openai-compatible",
      "model": "my-local-model",
      "family": "my-model-family",
      "roles": ["clerk", "builder", "reviewer"],
      "base_url": "http://127.0.0.1:8080/v1",
      "parameters": {"max_tokens": 2048, "timeout": 60}
    }
  }
}
```

| field | meaning |
|---|---|
| `adapter` | how the model is reached; what each adapter can do is on [External executors](/docs/executors#adapters) |
| `model` | any identifier the endpoint accepts |
| `family` | your declaration, used by review policy; not model attestation |
| `roles` | the jobs the profile takes (a role is the `--lane` flag). Roles never grant capabilities: `builder` on a text adapter means a textual patch, not permission to edit ([permission classes](/docs/executors#permission-classes)). |
| `parameters` | `effort`, `contributor_mode` (`muse-code-cli`: `on` or `off`, default `off`; whether Meta may train on what the run sends), `max_tokens` (1–1,000,000; 4096 when unset on the chat-completions adapters) and `timeout` (whole seconds, 1–86400), as the adapter supports. No `timeout` means no time limit; see [Timeouts](/docs/executors#timeouts). |
| `base_url` | the endpoint, for `openai-compatible` |
| `credential_env` | the *name* of the variable holding the key; `openai-compatible`, `deepseek-api` and `token-plan-openai` only. Other adapters use their native credential storage. When set, only the environment and the `.env` are read, never a key file. |
| `aliases` | optional list of accepted response model identifiers |
| `tier`, `code`, `price`, `context`, `json_mode` | optional routing metadata; see [the router page](/docs/router) |

Rules:

- Inline credentials, unknown fields and unsupported parameters are rejected.
- Remote endpoints require HTTPS; loopback HTTP is allowed.
- `openai-compatible` appends `/chat/completions` and sends one non-streaming
  text request with optional Bearer auth. It never calls `/models`, never
  uses tools and never retries. A declared `effort` goes out as
  `reasoning_effort`; without one the field is not sent.
- Gemini is not in the shipped presets. The `agy` adapter stays installed and
  works with a profile you add by hand.

**GPT-6.1 Terra.** The catalog includes `gpt-6.1-terra`, its current prices
and its per-effort Artificial Analysis results. To select it, add a personal
profile with `"adapter": "codex"`, `"model": "gpt-6.1-terra"`, the roles you
want and `"parameters": {"effort": "low"}`. This adapter accepts Terra at
`low`, `medium`, `high`, `xhigh` and `max`; `none` and `minimal` are rejected.
Shipped presets and your personal configuration are not changed by a catalog
update. Offline tests verify model forwarding and effort validation; they
do not establish live provider availability or quality.

## Selection and execution

```sh
delegation-route resolve --lane builder --json
delegation-route resolve --lane builder --selected-profile local-model --json
# Only after the user explicitly requested this dispatch:
delegation-run --profile local-model --lane builder \
  --prompt-file /tmp/task.txt --output /tmp/model-result.txt --workdir /path/to/repo
```

- `delegation-route` prints schema 3 JSON with `configuration_valid`,
  `technical_compatibility` and `capabilities` per profile and role. Its
  `check`, `lane`, `profile`, `resolve` and `table` commands are read-only. A
  selected row is validation only: `authorization_granted` is false.
- `delegation-run` writes the output, metrics and a version 2 `.result.json`
  receipt. It keeps the requested and the reported model apart
  ([model identity](/docs/executors#model-identity)); failures have
  their own reasons and [exit codes](/docs/executors#exit-codes).
- A failure never dispatches a replacement.

## Review

| `review_policy` | meaning |
|---|---|
| `optional` (default) | no review needed |
| `required` | a review is needed; the reviewer may be the same family |
| `cross-family` | both families must be declared and different |

Neither mandatory policy authorizes a reviewer call.
`--reviewer-profile ID --review-authorized` records an authorized review plan
but never calls the reviewer. An `optional` result has `status`
`ready-for-integration` (`review_status` `not-required`), which does not
claim that tests or review passed. A mandatory result has `status`
`pending-review` until the lead obtains and verifies the review, and its
`review_status` says what is missing:

| situation | `review_status` |
|---|---|
| no `--review-authorized` | `pending-authorization` |
| no usable reviewer | `pending-reviewer` |
| `cross-family`, a family missing or equal | `pending-compatible-reviewer` |
| authorized, compatible reviewer | `pending-review` |

`delegation-config init --preset strict` sets `cross-family` for a new file.
For an existing file, edit `review_policy` and run `apply`; `init` never
overrides your later decisions.

## Router

A `router` block names the `decider` (required: one of your profiles, Sage,
Jev, a Dipylon, a local classifier, or `none`), the `pool` and the `default`.
Pool and default may be HTTP or native profiles. A pool profile this machine
cannot reach is set aside (`delegation-router check` says which); the
default never is. Without the block the router is off and nothing else reads
it. Fields, policy and `decide --lane`: [the router page](/docs/router).

## Keys and environment

Nothing in the kit holds a key value: profiles and services name a variable.
A variable is read from, in this order:

1. your environment;
2. the personal `.env` beside the configuration file (or beside
   `$DELEGATION_CONFIG_FILE`);
3. for a profile that does not declare `credential_env`, the adapter's key
   file under the data home (table below).

The `.env`:

- The installer creates it once from the repository's `.env.example`: mode
  600, every value empty, never overwritten. Fill in only the keys you use.
- The commands, the runners and `delegation-run` read it.
- `doctor` reports its mode and how many variables it sets, never their
  values.

The variables a user sets:

| variable | meaning |
|---|---|
| `DELEGATION_CONFIG_FILE` | the personal configuration (default `${XDG_CONFIG_HOME:-$HOME/.config}/delegation-kit/config.json`) |
| `DELEGATION_DATA_HOME` | commands, runners, key files, receipts and the local catalog (default `~/.local/share/delegation-kit`) |
| `DELEGATION_BIN_HOME` | where the installer links the commands (default `~/.local/bin`) |
| `CLAUDE_HOME`, `CODEX_HOME` | the host homes the installer writes profiles and the guard into |
| the name in a profile's `credential_env` | that profile's key, for the HTTP adapters |
| the name in `router.decider.credential_env` | the decision service's key (`SAGE_API_KEY`, `TYPESAFE_API_KEY` by default) |
| `AA_API_KEY` | the Artificial Analysis key for `delegation-router catalog refresh` |

Key files, read when the variable is unset in the environment and in the
`.env`, one `NAME=value` line each, mode 600, under
`$DELEGATION_DATA_HOME/config/`:

| file | variable | used by |
|---|---|---|
| `zai.env` | `ZAI_API_KEY` | `claude-zai` profiles |
| `qwen-token-plan.env` | `QWEN_TOKEN_PLAN_API_KEY` | `token-plan-openai` profiles |
| `deepseek.env` | `DEEPSEEK_API_KEY` | `deepseek-api` profiles |
| `artificial-analysis.env` | `AA_API_KEY` | `delegation-router catalog refresh` |

- Every `.env` and key file is parsed, never executed, and ignored when it is
  a symlink or readable by group or others.
- Run from a source checkout, the GLM, Qwen and DeepSeek runners look for
  their key file in the checkout's `config/` instead; put the key in the
  `.env`, or point `DELEGATION_GLM_KEY_FILE`, `DELEGATION_QWEN_KEY_FILE` or
  `DELEGATION_DEEPSEEK_KEY_FILE` at a key file.
- The uninstaller keeps each key file as `<data home>.<name>.env.bak` and
  the installer restores it. The `.env` lives in the configuration
  directory, which neither touches.
- There is no project `.env`: the kit never reads one, because a key in a
  worktree is one `git add` from a commit. `.env.example` has no values, and
  `.gitignore` excludes every other `.env*`.

## Adding a model

Nothing else in the kit has to change:

1. Add a profile to the personal file: the adapter, the exact model
   identifier the endpoint accepts, the roles and the parameters the adapter
   supports. For a custom OpenAI-compatible endpoint add `base_url` and, if
   it needs a key, `credential_env` with the variable's *name*.
2. Put the key in the environment or the personal `.env`.
3. Run `delegation-config validate` and `delegation-config apply`.
4. To route to it, add it to `router.pool`; `delegation-router check --json`
   should list it with `"reachable": true`.
5. Dispatch once to confirm the key and the model name.

The shipped `minimax-m3.1-flash` profile is one such profile (the two
shipped Meta Muse profiles are others, with `META_API_KEY` and
`"parameters": {"effort": "max"}`), with `MINIMAX_API_KEY=…` in
`~/.config/delegation-kit/.env`:

```json
"minimax-m3.1-flash": {
  "adapter": "openai-compatible",
  "model": "MiniMax-M3.1-Flash",
  "family": "minimax",
  "roles": ["builder", "clerk", "scout", "reviewer", "senior", "judgement", "policy-annotation"],
  "base_url": "https://api.minimax.io/v1",
  "credential_env": "MINIMAX_API_KEY",
  "context": 1000000
}
```

The catalog recognises `minimax-m3.1-flash`, so the profile gets the
catalog's tier, score and price; `context` comes from MiniMax's
documentation. `delegation-run --profile minimax-m3.1-flash --lane clerk
--prompt-file FILE --output FILE --workdir DIR` should give a receipt whose
`provider_reported_model` reads `MiniMax-M3.1-Flash`.

Declare `tier`, `price`, `code`, `context` or `json_mode` to rank a profile
on your numbers instead of the catalog's. Catalog tiers come from the
Artificial Analysis Intelligence Index through a published band rule:
`delegation-router catalog show` prints each tier's source, and `catalog
refresh` writes a local catalog ([the router page](/docs/router)).

## Upgrading

- The installer never rewrites your file. New fields are optional, and a
  file that says `"schema_version": 1` is read like `2`.
- Installs older than 0.25 (profiles in `routing-gates.json`) must go
  through 0.26 first, or the profiles must be recreated by hand from the
  preset; the migration code is gone.
- 0.27.2 moved the shipped `opus-builder`, `opus-reviewer` and
  `opus-policy-annotator` profiles to `claude-opus-5-5`. A file made earlier
  keeps `claude-opus-5` in them until you edit `model`. The Claude Code
  agents the installer writes move to `claude-opus-5-5` on the next install,
  unless you edited them.
- 0.32.0 replaced the shipped `kimi-k3` profile with `kimi-k3.1-pro` (model
  `kimi-k3.1-pro`). A file made earlier keeps `kimi-k3`; since 0.35.0, K3
  being retired, `delegation-kimi` refuses it. To move, rename the profile, and the
  pool entries and routes that name it, and set `model` to `kimi-k3.1-pro`.
- 0.33.0 added the `minimax-m3.1-flash` profile to the preset. A file made
  earlier does not get it; copy it from the example under *Adding a model*,
  or from `config/presets.json`, and set `MINIMAX_API_KEY`.
- 0.34.0 added five Meta Muse profiles to the preset: `muse-code-wonder-full`,
  `muse-code-wonder` and `muse-code-spark` on the Muse Code subscription
  (`muse login`), and
  `muse-wonder-1.0` and `muse-spark-1.3` on the Meta Model API
  (`META_API_KEY`); see
  [Muse Code](/docs/executors#muse-code-subscription-or-api-key). It
  also added `effort` to `openai-compatible`. A file made earlier gets none
  of the profiles; copy the ones you want from `config/presets.json`.
  Existing `openai-compatible` profiles send nothing new.
- 0.35.0 renamed `terra-builder` and `terra-reviewer` to
  `sol-builder` and `sol-reviewer`, on `gpt-6.1-sol`: GPT-5.6 Terra is
  retired. A file made earlier keeps the `terra-*` profiles and their
  `gpt-5.6-terra` model. To move, rename the profiles, and the pool entries
  and routes that name them, and set `model` to `gpt-6.1-sol`.

<!-- END AUTOGEN -->
