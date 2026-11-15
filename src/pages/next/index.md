---
layout: ../../layouts/DocLayout.astro
title: 'Next release preview — delegation-kit'
description: 'Unreleased documentation for Fable 5.2, Gemini 4 Hydrogen and Carbon. AA v5.0.1 snapshot of November 13, 2026.'
path: '/next'
preview: true
---

<!-- Snapshot of README.md; provenance: /next/snapshot.json. -->

> **Unreleased preview.** These model changes are in development and are not included in the published npm package (0.36.0). Installation commands below require the unreleased checkout. This is a documentation snapshot, not evidence of a live model run. Benchmark data: November 13, 2026, AA v5.0.1. [Published documentation](/docs/).

# delegation-kit

Easy requests go to your cheap models, hard ones to your strong ones.

You choose a decider — one of your cheap models, Levanto Sage, TypeSafe Jev,
your own Dipylon, a local classifier — and the models it may pick from: API
keys, a Claude or Codex subscription, a local endpoint. `delegation-router
serve` is an OpenAI-compatible endpoint on your own machine. Send it
`"model": "auto"`: the decider rates how much capability the request needs,
the request goes to the cheapest of your models strong enough for that
rating, with that model's own credential, and the response names the model
and the reasons. For each request the decider gets an excerpt (the whole
request with `input: full`) unless it runs on your machine, and the chosen
model gets the request.

## How the choice is made

The decider never picks a model by name. It judges the task; your
configuration judges the models.

1. **The request is measured**, not judged: tokens, turns, tools, images,
   JSON output. **Your models are checked**, without a model call: one this
   machine cannot reach — no key, its CLI missing, its runner logged out (a
   Codex or Claude Code login is not checked) — is set aside and named in
   the response, so the choice is only among models that can answer. The
   default is the exception: doubt still lands on it, so keep it reachable.
2. **The decider answers one typed question**: how much capability does
   answering this correctly need (0 trivial … 4 frontier, half points
   allowed), and does it involve code, math or rare knowledge. It sees an
   excerpt, never your keys, never your model names; text inside the request
   cannot steer it.
3. **The rating becomes a minimum score** on the same public index that
   places the models: up to 1, none; at 2, the bottom of the mid band
   (37.6 today); from 3, the bottom of the frontier band (49.6); in between,
   in proportion (2.5 → 43.6). `math`, `rare` and `tools` raise it to the
   mid band, a very long request to the frontier band; `code` keeps only
   code-capable profiles.
4. **The cheapest profile that reaches it wins**, whatever its tier, priced
   for this request. When none does, the strongest eligible one answers and
   the response says so. Doubt — low confidence, a decider error, a timeout —
   lands on your default, and says so.
5. **Every response discloses the choice**: `X-Router-*` headers and a
   `router` object with the signals, the reasons, the candidates with their
   estimated cost, usage and what the provider reported.

With three models from the default install — GPT-5.6 Luna as `luna-clerk`
(`small`: Intelligence Index 37.3), DeepSeek Flash as `deepseek-flash`
(`mid`: 39.5) and Claude Opus 5.5 as `opus-reviewer` (`frontier`: 57.6, the
best model on the board):

| request | the decider says | minimum | answered by | because |
|---|---|---|---|---|
| rename `foo` to `bar` | 1, `code` | none | GPT-5.6 Luna | every model reaches it; Luna is the cheapest |
| summarise this contract | 2 | 37.6 | DeepSeek Flash | 39.5 reaches it, Luna's 37.3 does not; cheaper than Opus |
| what is 17 % of 2,340 € | 1, `math` | 37.6 | DeepSeek Flash | `math` raises an easy request to the mid band |
| why this Go worker pool deadlocks | 2.5, `code` | 43.6 | Claude Opus 5.5 | DeepSeek's 39.5 falls short; Opus is the only one above |
| find the race condition in this scheduler | 3, `code` | 49.6 | Claude Opus 5.5 | from 3 up only the frontier band |

Add GLM 5.3 Flash (41.8, $0.15/$0.50 per million) and the first three go to
GLM: it reaches both minimums and costs less than Luna and DeepSeek. Add
Kimi K3.1 Pro (`frontier`: 55.1, $2/$10) as well and the last two go to Kimi
instead of Opus, at half the price.

Where the tiers come from: a third party, not the kit. The shipped catalog
places every model it knows from the Artificial Analysis Intelligence Index
through one published rule — frontier within 8 points of the best model of
the day, mid within 20, small below — and records the evidence and the date
beside each row; `delegation-router catalog show` prints it. That is how
the kit knows that GPT-5.6 Sol (47.0) is `mid`, not `frontier`, whatever
its name suggests, and that Mistral Large 3 (9.3) is `small`. With your own
Artificial Analysis key (`AA_API_KEY` in your environment or in
`~/.config/delegation-kit/.env`),
`delegation-router catalog refresh` writes a current catalog on your machine
that takes precedence over the shipped one; without a key you get the catalog
the package shipped with, refreshed at every release. The levers are yours —
`tier` and `price` per profile, the pool, the default, a cost ceiling — and
`delegation-router decide --json` prints the reasons for any prompt without
dispatching it; with `--lane ROLE` it recommends, for a task you are about to
delegate, only the models that take that role. `delegation-router eval`
measures a decider against the rules-only baseline on a golden set of yours.

## Quick start

```sh
./install.sh                      # commands, runners, Claude/Codex profiles, the guard
delegation-config show            # the personal configuration the installer created
```

Keys: the installer asks for the DeepSeek, Qwen and Z.AI keys and keeps them
in files only you can read; any other key — MiniMax for the shipped
`minimax-m3.1-flash` profile, Meta for the API-key Muse profiles, a model
you add, a decider, the Artificial Analysis key — goes in
`~/.config/delegation-kit/.env`, created
from `.env.example` with mode 600. A variable already set in
your environment wins. Never commit the real file.

Add a `router` block to `~/.config/delegation-kit/config.json`: the decider
first, then the profiles it may pick from (names that already exist in the file):

```json
"router": {
  "decider": {"kind": "llm", "profile": "deepseek-flash"},
  "pool": ["luna-clerk", "deepseek-flash", "opus-reviewer"],
  "default": "deepseek-flash"
}
```

```sh
delegation-router check           # the decider, the pool with tiers and scores, what this machine cannot reach (--json adds prices)
delegation-router serve           # http://127.0.0.1:4141/v1, loopback only
curl -s 127.0.0.1:4141/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Rename foo to bar in utils.py"}]}'
```

Any client that speaks OpenAI Chat Completions works with
`base_url="http://127.0.0.1:4141/v1"`: the OpenAI SDKs, curl, tools that let
you set the base URL. Claude Code (Anthropic Messages) and Codex (OpenAI
Responses) speak other formats and cannot send their requests here; the
router can pick them to answer. Naming a pool profile as `model` skips the
decider and still discloses. An agent loop that sends
`X-Router-Conversation: <id>` stays on the model its first request was
routed to, instead of changing model halfway through. The
[router page](/next/router/) has every field, the policy, the deciders,
the error codes and the evaluation harness.

## How it works inside

- **One description per model.** The personal configuration holds a
  profile for each model you can call: HTTP adapters (`openai-compatible`,
  `deepseek-api`, `token-plan-openai`) and native CLIs (`codex`,
  `claude-code`, `claude-zai`, `kimi-code-cli`, `muse-code-cli`,
  `grok-build-cli`, `agy`).
  Each native CLI has a runner that enforces its sandbox, identity check and
  limits; the router reaches those profiles through the kit's own
  dispatcher, which is how Claude models join a pool although Anthropic
  exposes no chat-completions endpoint. A shipped catalog supplies tier,
  price and context for known models; your declarations win.
- **The installer also puts the same profiles in front of Claude Code and
  Codex** — six Claude subagents, five Codex profiles, the skills for a lead
  — together with a guard that nothing dispatches, retries, falls back or
  reviews without the user asking. The router follows the same rule: starting
  `serve` and sending `auto` is the user's choice, and the router never
  leaves the pool.
- **The patch trust boundary.** Text adapters return patches and never write
  to a worktree; `delegation-patch-verify` checks a patch against the shipped
  policy before the lead applies and tests it.
- **`doctor.sh`** reports what is installed, which runtimes are reachable,
  the personal `.env` (its mode and how many keys it sets, never a value)
  and, first in its router section, which decider rates for which pool and
  which pool models this machine cannot reach; `--ping` runs a live
  round-trip.

## Source package version: 0.36.0 (unreleased checkout)

Version 0.36.0 migrates the catalog and routing evidence to Artificial Analysis
Intelligence Index v5.0. New Terra builder and Opus judge presets are available;
Sonnet routine review uses high effort. Unmeasured efforts and incompatible
local catalog versions no longer inherit a benchmark score. Existing personal
configurations and router pools remain user-owned.

Every earlier release is in [`CHANGELOG.md`](/next/changelog/).

## Documentation

- [The router: decider, pool, policy, disclosure, eval](/next/router/)
- [Personal configuration, keys and environment, adding a model, upgrading](/next/configuration/)
- [External executors: adapters and their limits](/next/executors/)
- [Compatibility and release verification](/next/compatibility/)

## Testing

```sh
./run-tests.sh
npm test
```

The suites use isolated fixtures and fake providers. They do not authorize
or prove live provider behavior; live probes are recorded per release in
the compatibility page.

## npm package

`npx delegation-kit` clones the release tag of the package's own version,
verifies the checkout and runs its `./install.sh`; `--ref <tag-or-branch>`
installs another ref. The npm package is an installer wrapper, not a second
runtime.

## License

MIT. See LICENSE.

<!-- BEGIN controller-models: benchmark-reference -->
## Model benchmarks and availability

[Current v5.0.1 reference](/next/models/): Fable 5.2 and Carbon scores, provider contracts and integration choices. Carbon is optional via agy; agy selections use exact inventory checks; Carbon needs Ultra/Enterprise.
<!-- END controller-models: benchmark-reference -->
