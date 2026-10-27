---
layout: ../../layouts/DocLayout.astro
title: 'Router reference — delegation-kit'
description: 'How the router picks a model for each request: the decider, the tiers, the price rule, what each response says, errors and eval.'
path: '/docs/router'
---

<!-- Synced from docs/router.md in the kit repository: edit there, not here. -->

> The full reference. New here? Start with [Getting started](/docs/).

<!-- BEGIN AUTOGEN -->

# Model router

Point any OpenAI Chat Completions client at `http://127.0.0.1:4141/v1` with
`"model": "auto"`, and `delegation-router` sends each request to the cheapest
profile in your pool that is strong enough for it. A decider you choose rates
the request; the rating sets a minimum score; the cheapest pool profile that
reaches it answers, and the response says which model answered and why.

- It runs on your machine and listens on loopback only.
- You name the decider, the pool and the default; it chooses only inside the
  pool and discloses the chosen model in every response.
- It never retries, falls back or widens the pool. It keeps a decision only
  for a conversation the client names, in memory
  ([Conversations](#conversations)).
- No public instance, access tokens or multi-tenant limits.
- `serve` prints one line at start, naming any profile set aside as
  unreachable, then nothing: no request or error log, no header, no key.
  Opt-in receipts are the only record.

The decider sees an excerpt of each request (all of it with `input: full`)
unless it runs locally. Only the chosen profile gets the request, with its own
key, never a key or header from the caller.

## Endpoints

```sh
delegation-router check
delegation-router serve
# another shell:
curl -si 127.0.0.1:4141/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Rename foo to bar in utils.py"}]}'
curl -s 127.0.0.1:4141/v1/models        # the pool, plus "auto"
curl -s 127.0.0.1:4141/v1/health
```

Use `base_url="http://127.0.0.1:4141/v1"` and any API key; the router ignores
it, because each profile uses its own. Claude Code (Anthropic Messages) and
Codex 0.163 (custom providers only on the Responses API) cannot send requests
here, but both can be pool profiles.

Naming a pool profile as `model` skips the decider and still discloses; the
context and cost rules still apply. An agent loop that sends
`X-Router-Conversation` keeps its first route
([Conversations](#conversations)). `doctor.sh`'s "Model router" section shows
the decider, the catalog in effect and `check`'s warnings.

## Commands

| command | does | model calls |
|---|---|---|
| `check [--json]` | validates the router block and says what this machine can reach | none |
| `decide --prompt-file F [--lane ROLE] [--decider K] [--input excerpt\|full] [--raw] [--json]` | one recommendation; `--raw` adds the decider's answer as `decider.raw` (never in a served response) | at most one, to the decider, with its own key |
| `serve [--listen HOST:PORT]` | the endpoint; `--listen` overrides `router.listen` | the decider, then the chosen profile |
| `catalog show\|refresh [--shipped] [--key-env VAR] [--json]` | [the tiers](#where-the-tiers-come-from); `--key-env` defaults to `AA_API_KEY`; `--shipped` writes `config/catalog.json` | `refresh`: one Artificial Analysis request |
| `eval --items F [--decider K] [--input excerpt\|full] [--output DIR] [--json]` | [measures a decider](#measuring-a-decider) | one per prompt and paraphrase |

Only `serve` dispatches a pool profile; starting it and sending `auto` is you
directing the router. Running a `decide` recommendation is a separate
`delegation-run` you ask for.

`decide --lane ROLE` recommends a profile for a task you are about to
delegate. Candidates are the pool profiles that declare the role and whose
adapter supports it (the check `delegation-run` makes); the rest go under
`blocked`. The recommendation carries the adapter's
[`capabilities`](/docs/executors#adapters) (`text-patch`,
`sandboxed-worktree`, …). A decision that lands on a
default without the role, or an unreachable one, recommends nothing and says
so. A role no reachable pool profile takes is an error.

## Configuration

A `router` block in the personal configuration turns the router on; without
it the router is off and `check` says so.

```json
{
  "schema_version": 2,
  "review_policy": "optional",
  "profiles": {
    "flash": {"adapter": "deepseek-api", "model": "deepseek-flash", "roles": ["clerk"]},
    "qwen":  {"adapter": "token-plan-openai", "model": "qwen3.8-max", "roles": ["builder"]},
    "sol":   {"adapter": "openai-compatible", "model": "gpt-6.1-sol", "roles": ["judgement"],
              "base_url": "https://api.openai.com/v1", "credential_env": "OPENAI_API_KEY"}
  },
  "router": {
    "decider": {"kind": "llm", "profile": "flash"},
    "pool": ["flash", "qwen", "sol"],
    "default": "qwen"
  }
}
```

| field | meaning |
|---|---|
| `decider` | **required**; see [Deciders](#deciders) |
| `pool` | profile ids on any adapter. HTTP ones (`openai-compatible`, `deepseek-api`, `token-plan-openai`) are called directly, native ones (`codex`, `claude-code`, `claude-zai`, `kimi-code-cli`, `muse-code-cli`, `grok-build-cli`, `agy`) [through `delegation-run`](#native-profiles-in-the-pool) |
| `default` | the pool profile used when the decision is undecidable |
| `listen` | loopback `host:port` (`127.0.0.1`, `localhost`, `[::1]`); default `127.0.0.1:4141` |
| `max_cost_usd` | ceiling on a request's estimated cost, in (0, 1000]; the `X-Router-Max-Cost-USD` header sets it per request. Profiles over it are set aside; a request that still lands on one is refused `400 cost-ceiling` |
| `receipts` | `false` by default. When `true`, one JSONL line per request in `$DELEGATION_DATA_HOME/router/receipts.jsonl` (mode 600): decision, profile, pin state, usage, cost, latency, never prompt content or a conversation id. Survives uninstall and reinstall |
| `allow_origins` | exact browser origins, HTTPS or HTTP on loopback; empty by default. A listed origin gets the CORS preflight and the `X-Router-*` headers; any other `Origin` gets `403 browser-denied` |
| `mode` | `route` (default) or `shadow`: decide and disclose but dispatch the default, to observe a decider before trusting it |

Profiles may declare routing fields; a declaration wins, the
[catalog](#where-the-tiers-come-from) fills the rest, and `check` shows each
tier's `tier_source`.

| field | meaning | when neither source has it |
|---|---|---|
| `tier` | `small`, `mid` or `frontier` | default only |
| `price` | `{"in", "out"}` USD per million tokens | ranked last |
| `code` | code-capable | not code-capable |
| `context` | tokens | not checked |
| `json_mode` | `false`: no JSON mode | assumed |

## Where the tiers come from

[Artificial Analysis](https://artificialanalysis.ai/) publishes an
Intelligence Index (0–100, a composite of public evaluations), coding and math
sub-indexes, and list prices for a few hundred models and reasoning settings.
One published rule, `index-bands-v1`, makes tiers of it: **frontier** within 8
points of the day's best, **mid** within 20, **small** below; the catalog
records the bands and the date. `delegation-router catalog show` prints the
rule, the best, and every model's tier and source; each row carries its
evidence (measured name, index per reasoning setting, date), or `null` when
placed by hand.

Neither catalog refreshes itself:

- **Shipped**: `config/catalog.json`, refreshed before each release.
- **Local**: `catalog refresh` writes
  `$DELEGATION_DATA_HOME/config/catalog.local.json`, which wins while at least
  as recent. It needs `AA_API_KEY` ([Keys and
  environment](/docs/configuration#keys-and-environment)); a free account
  issues one. Uninstall keeps key and catalog; reinstall restores them.

`refresh` matches by the board's slug (`claude-opus-5-5`, `-xhigh`, …), else
by measured name through the row's `aa_name`, never partially, and names what
it could not place. A profile whose `model` differs from a catalog id only
in case or punctuation still matches, by measured name. The data is
Artificial Analysis's.

The index measures general capability, not your tasks;
[`eval`](#measuring-a-decider) on your golden set is the local proof.

## How a request is routed

1. **Features**: estimated tokens, turns, tools, images, `max_tokens`, JSON
   output requested, arithmetic-looking numbers.
2. **Set aside**, without a model call: profiles that cannot take the request
   go under `blocked` (table below).
3. **Decide**: the decider rates the request, unless skipped.
4. **Policy** [`floor-v1`](#policy-floor-v1) picks one profile.
5. **Forward** one request to that profile's endpoint with its key. The
   `router` body field is dropped, `model` rewritten,
   `stream_options.include_usage` set when streaming. Connecting is bounded at
   20 s; the profile's `parameters.timeout` bounds the exchange (`504
   timeout`). Without it a non-stream answer is awaited indefinitely and a
   stream is cut after 30 s without an event.
6. **[Disclose](#what-a-response-carries).**

| `blocked[].reason` | when |
|---|---|
| `unreachable: <why>` | HTTP profile without its key (named variable or kit key file); native runner whose `check --json` selects no backend; `codex` or `claude` not on PATH. `serve` checks at start, `decide` and `check` every time; a login that lapses later fails at dispatch |
| `does not take the ROLE role` | `decide --lane` |
| `native profile: no tools, images or JSON mode` | the request has one of them |
| `no tier declared` | unless it is the default |
| `context too small` | estimated tokens + `max_tokens` (1024 when unset) > `context` |
| `no JSON mode` | JSON requested, `json_mode: false` |
| `estimated cost above ceiling` | over `max_cost_usd` or the header |

The default is never replaced: an `auto` request that lands on a blocked or
unreachable default is refused `400 no-usable-candidate`, with a `reason`.

The decider is skipped when it cannot change the outcome: nothing is
eligible; only the default is; or the decider has a price, no eligible profile
scores above the default, and the cheapest saves less than 10× the decision's
cost (450 input tokens at the decider's price).

**The excerpt** (at most 4,000 characters): turn count, whether there is a
system prompt, tool names, the first 1,000 characters of the system prompt,
and the last user turn trimmed to 2,048; never images. Before the trim, the
blocks coding harnesses add to a user turn are dropped: `<system-reminder>`
(OpenCode; Claude Code through translators such as claude-code-router),
`<environment_context>` (Codex) and `<environment_details>` (Roo Code). They
describe the session, not the task, and their dates and versions do not
count as arithmetic. A user turn that is only such blocks is passed over for
the one before it, and kept when no turn says more. `input: full` sends
every message's text as it is, up to 32,000 characters.

**The question**: how much capability this needs (0 trivial … 4 frontier, in
half points), and does it involve code, math or rare knowledge. `long` (over
20,000 estimated tokens) and `tools` are set deterministically. An
out-of-schema answer, HTTP error, timeout or missing key is *undecidable*:
the default answers, with a warning. Out of schema includes any probability
or confidence that is not a finite number in [0, 1], a difficulty outside
its scale (a classifier's outside 0..1) and a distribution that does not
sum to 1 (within 0.005 a level); one such value voids the whole answer, and
no value is clamped into range. Text in the request cannot steer the route:
the decider never treats it as instructions and cannot name a model.

### Policy floor-v1

No usable signal, or confidence below 0.55: the default. Otherwise the rating
becomes a **minimum score** on the Artificial Analysis index:

| rating | minimum | today |
|---|---|---|
| ≤ 1 | none | 0 |
| 1.5 | in proportion | 18.8 |
| 2 | bottom of the mid band | 37.6 |
| 2.5 | in proportion | 43.6 |
| ≥ 3 | bottom of the frontier band | 49.6 |

- A yes/no "needs a strong model" sets the frontier band from 0.7, the mid
  band from 0.3; the higher minimum wins.
- Tags count from 0.6. `math`, `rare` and `tools` raise the minimum to the mid
  band, `long` to the frontier band. `code` narrows the candidates to
  code-capable profiles (any, if none of those reaches the minimum).
- Every eligible profile at or above the minimum is a candidate, whatever its
  tier; the cheapest by `price.in × est_tokens + price.out × max_tokens`
  (1024 when unset) wins. If none reaches it, the strongest eligible answers
  and the reasons say so.
- A profile's score is the index at the reasoning setting it runs at (its
  declared `effort`, if measured). A hand-placed model or a declared `tier`
  counts as the bottom of its band.
- Effort, on `deepseek-api` and `token-plan-openai` only: `high` from a rating
  of 3.6 (a floor; a declared `xhigh` or `max` is kept), `low` below 1.5 on a
  small-tier profile.

### Why this model and not that one

The rule is Levanto Sage's: *the cheapest model that will get it right*. The
decider judges the task; your configuration judges the models.

In a pool of Opus 5.5, GPT-6 Astra, GLM 5.3 Flash, Kimi K3.1 Pro and Qwen3.8 Max:

| minimum | candidates (score, $ in/out per Mtok) | winner |
|---|---|---|
| 49.6 | Opus 5.5 (57.6, 4/20), Kimi K3.1 Pro (55.1, 2/10), GPT-6 Astra (50.9, 10/50) | Kimi; Opus only for a minimum above 55.1, or if Kimi is blocked or not in the pool |
| 37.6 | GLM 5.3 Flash (41.8, 0.15/0.50), Qwen3.8 Max (45.4, 2/6), Kimi K3.1 Pro | GLM |
| 43.6 | Qwen3.8 Max, Kimi K3.1 Pro | Qwen; Kimi for a minimum above 45.4 |

Your levers: `tier` and `price` per profile, the pool, the default, the
ceiling. The `reasons` give the minimum, the chosen score and each candidate's
estimated cost.

## Native profiles in the pool

A native profile has no chat-completions endpoint, so the router goes through
`delegation-run`. The conversation becomes a prompt file (a lone user turn
verbatim, otherwise a `[system]`/`[user]`/`[assistant]` transcript), `delegation-run
--profile <id> --lane <role>` runs it in an empty temporary workdir, and the
answer returns as one chat completion.

- **Role**: the first read-only role the profile declares and its adapter
  supports; a build role only if nothing else. `check` and
  `router.delegation_run.lane` name it.
- **Limits stay**: the profile's `timeout`, the identity check
  (`502 provider-identity-mismatch`), OAuth locks (a second concurrent Kimi, Muse
  Code or Grok request gets `429 provider-rate-limited`), sandboxes.
- **Receipt**: `review_policy`, `review_status`, `status` under
  `router.delegation_run`.
- **Streaming**: one event with the whole answer, then the router chunk.
- **Cost**: null when the CLI reports no usage.
- **Nothing outlives the request**: the dispatch runs in its own process
  group. When the client hangs up or `serve` stops, the whole group —
  dispatcher, runner and the CLI it started — gets SIGTERM, and SIGKILL
  10 s later.

Claude models join through `claude-code` (`claude-zai` runs GLM through the
Claude Code CLI).

## Conversations

Without help, the router decides every request on its own. An agent loop
sends one request per step, so each step pays a decision and can land on
another model: a step with tools needs the mid band, and once the
conversation passes 20,000 estimated tokens `long` asks for the frontier.
The model changes halfway through the task, and the provider's prompt cache
is lost with it.

A client that sends `X-Router-Conversation: <id>` (1–128 letters, digits,
`.`, `_`, `:`, `-`) on its `auto` requests keeps the first route:

- **The first request** is decided as usual and pins the conversation to the
  profile it dispatched (in `shadow` mode, the default) at that request's
  effort. `X-Router-Pin: new`.
- **Every later request** goes to that profile without asking the decider,
  as if the client had named it: mode `pinned`, `X-Router-Pin: held`, and
  `router.pin` with the profile, `since` and the request count. The context,
  cost and JSON-mode rules still apply; a request the pinned profile cannot
  take is refused `400 no-usable-candidate` (or `cost-ceiling`) with
  `pinned` naming it, never sent elsewhere. Start a new id to decide again.
- **Memory only**: 1,024 conversations, the least recently used forgotten
  first, and a pin lapses after 12 hours without a request. A restart
  forgets them all. The id is never written to receipts or echoed back.

The pin is set when the first request is routed, whatever the provider
answers, so a client's retry reaches the same profile. Naming a pool profile
as `model` ignores the header. Without the header nothing changes.

## Deciders

Every decider reports the same signals: a 0–4 difficulty (expectation,
distribution, confidence), a "needs a strong model" probability, and tag
probabilities. A service decider uses its own key (`credential_env`), never a
pool profile's; `llm` uses its profile's ([Keys and
environment](/docs/configuration#keys-and-environment)). Each decision is
priced from `price` and disclosed.

| kind | service | defaults | asks and reads |
|---|---|---|---|
| `llm` | your HTTP `profile` (default: the pool default) | its key and price; 3 s | one completion at temperature 0 with [`config/router-prompt.v1.md`](https://github.com/reasance/delegation-kit/blob/delegation-kit--v0.35.1/config/router-prompt.v1.md), the excerpt in a `DATA` block; one JSON object (`difficulty`, `tags`, `reason`) in ≤ 120 tokens, confidence 0.8. DeepSeek without thinking, Qwen at `minimal`. Pick a cheap, fast profile |
| `sage` | Levanto Sage, `POST /decide/batch` | `https://sage.levanto.ai`, `SAGE_API_KEY`, $0.05/$10 per Mtok, 3 s | `scale` 0–4 and `tags` in one batch. Confidence: the distribution's mass in the tier's band (Sage's own disclosed beside it). `null` is undecidable. Fanout bills output tokens on long excerpts even with reasoning off |
| `jev` | TypeSafe Jev, System One API | `https://api.typesafe.ai/v1/systemone`, `TYPESAFE_API_KEY`, `jev-latest`, $0.042 in, 3 s | a 5-level `score`; `noul`s for needs-frontier, code and rare. Confidence: Jev's own figure, how concentrated the distribution is around its likeliest level (a near level counts less than a far one). Arithmetic-looking numbers are never routed below mid |
| `dipylon` | your Dipylon, `POST /decide` | `url` required, no key, 2 s | one `yesno`; `probability` = P(yes). A selective-use verdict other than `retain` halves confidence; 503 is undecidable |
| `classifier` | local, `POST {"text"}` | `url` required, no key, 2 s | `difficulty` (0..1) or NVIDIA's `prompt_complexity_score`, `p_needs_strong`, `tags`, `confidence`, `task_type_1` naming code |
| `none` | — | — | always the default; `eval`'s baseline |

Fields: `kind`; `profile` (`llm`); for services, `url` (HTTPS or loopback
HTTP), `credential_env`, `model` (Jev), `price` (`{in, out}` USD per Mtok);
`input` (`excerpt` or `full`); `timeout` (1–600 s). Sage and Jev URLs may point
at your own proxy; Jev through OpenRouter is not wired. Measured answers,
latencies and costs: [Decider measurements](/docs/compatibility#decider-measurements).

Pin the decider you measured. `jev-latest` follows TypeSafe's newest Jev, so
an [`eval`](#measuring-a-decider) gate passed last month may describe a model
that no longer answers. Set `model` to a fixed Jev version from TypeSafe's
list and run `eval` again before you change it. Every decision names the
version that answered (`X-Router-Decider`, `router.decider.version`), and so
does the eval report.

## What a response carries

Headers: `X-Router-Profile`, `X-Router-Model`, `X-Router-Tier`,
`X-Router-Effort`, `X-Router-Decider` (`id/version`), `X-Router-Policy`,
`X-Router-Difficulty`, `X-Router-Confidence`, `X-Router-Undecidable`,
`X-Router-Latency-Ms` (the decision's), `X-Router-Mode` (`route`, `shadow`,
`explicit`, `pinned`), `X-Router-Pin` (`new` or `held`, with
[`X-Router-Conversation`](#conversations)), and
`X-Router-Model-Mismatch: 1` when the provider names a model other than the
profile's or an alias.

A `router` object next to `choices` (`reasons` state difficulty on 0–1, so a
rating of 1 reads 0.25):

```json
"router": {
  "version": "1", "mode": "route",
  "decider": {"id": "llm", "version": "deepseek-flash+46002df5", "input": "excerpt", "reason": "routine rename"},
  "policy": {"id": "floor-v1", "version": "2026-10-19"},
  "signals": {"difficulty": 1, "scale": [0, 4], "tags": {"code": 1.0, "math": 0.0, "long": 0.0, "rare": 0.0, "tools": 0.0},
              "p_needs_strong": null, "confidence": 0.8},
  "chosen": {"profile": "flash", "model": "deepseek-flash", "tier": "mid", "tier_source": "artificialanalysis:2026-10-21", "score": 39.5, "reasoning_effort": null},
  "minimum_score": 0.0,
  "default": "qwen", "undecidable": false,
  "reasons": ["difficulty 0.25", "tag code 1.00", "minimum score 0.0 (mid from 37.6, frontier from 49.6)",
              "code → cheapest code-capable profile scoring ≥ 0.0", "flash scores 39.5, mid (artificialanalysis:2026-10-21)",
              "candidates: flash $0.0013, qwen $0.0068, sol $0.0109 → flash"],
  "blocked": [], "warnings": [],
  "features": {"est_tokens": 310, "turns": 1, "tools": false, "images": false},
  "decision_latency_ms": 1171, "decision_cost_usd": 0.00012, "catalog_version": "2026-10-21",
  "usage": {"prompt_tokens": 300, "completion_tokens": 20}, "cost_usd": 0.000114,
  "provider_reported_model": "deepseek-flash", "mismatch": false,
  "latency_ms": 1830, "upstream_status": 200
}
```

A request with [`X-Router-Conversation`](#conversations) also carries
`"pin": {"state": "new"|"held", "profile", "since", "requests"}`.

Streaming: headers first, provider events unchanged, then a chunk with
`"choices": []` carrying `router` before `data: [DONE]`. If the stream was
cut, closed early, idle over 30 s or sent an event over 64 KiB, that chunk
carries `error.code` `stream-interrupted`, `stream-idle`, `stream-limit` or
`timeout` (or a native profile's error code), and `upstream_status` 502.

A mismatch on an HTTP profile is disclosed, not fatal; `delegation-run` fails
on it ([exit 70](/docs/executors#model-identity)), so a native profile
fails `502 provider-identity-mismatch`.

## Errors

`{"error": {"code", "retryable", "profile"?, …}}` plus `X-Router-Error`. A
refusal before the body is read closes the connection. Provider failures
keep their meaning and lose their payload: only `provider-rejected-request`
relays a message, cut to 500 characters with key-shaped tokens redacted.
Rows down to `busy`
never reach a provider; "native" means a `delegation-run` exit code.

| status | code | retry | when |
|---|---|---|---|
| 404 | `not-found`, `unknown-model` | no | unknown path; `model` neither `auto` nor a pool id |
| 403 | `browser-denied` | no | `Origin` not allowed |
| 411, 413 | `length-required`, `size-limit` | no | no `Content-Length`; body over 4 MiB |
| 400 | `invalid-json`, `invalid-request` | no | not an object with a `messages` list |
| 400 | `invalid-cost-ceiling` | no | header not a number in (0, 1000] |
| 400 | `invalid-conversation` | no | `X-Router-Conversation` not 1–128 of `A-Za-z0-9._:-` on an `auto` request |
| 400 | `cost-ceiling` | no | landed profile over the ceiling; `estimated_usd`, `ceiling_usd` |
| 400 | `no-usable-candidate` | no | named profile blocked (context, JSON mode, no routable role); `auto` lands on a blocked or unreachable default; a conversation's pinned profile blocked (`pinned` names it); native 78 |
| 401 | `provider-key-missing` | no | named profile's credential unset; native `missing_credentials` |
| 429 | `busy` | yes | over 16 in flight |
| 401 | `provider-key-rejected` | no | provider 401/403 |
| 429 | `provider-rate-limited` | yes | provider 429 (`Retry-After` passed on); native rate limit or OAuth lock |
| 502 | `provider-unavailable` | yes | provider 5xx or unreachable; native 75 (69: not retryable) |
| provider's | `provider-rejected-request` | no | other 4xx; message cut to 500 characters, key-shaped tokens redacted |
| 504 | `timeout` | yes | the profile's `timeout` |
| 502 | `upstream-too-large`, `upstream-format` | no | non-stream response over 4 MiB, or not a JSON object |
| 502 | `upstream-interrupted` | yes | connection lost while reading a non-stream response |
| 502 | `provider-identity-mismatch`, `provider-failed` | no | native 70: another model answered, or any other failure |
| 502 | `provider-interrupted` | yes | native 130 |
| 499, 503 | `client-gone`, `router-stopping` | no, yes | a native dispatch ended because the client hung up or `serve` stopped |
| 502 | `bridge-failed` | no | `delegation-run` did not start, left no answer, or exited otherwise |
| 502 | `router-unavailable` | no | internal error |

## Measuring a decider

```sh
delegation-router eval --items ~/work/evals/router/items.jsonl --decider sage --output ~/work/evals/router/sage
```

The golden set lives outside the repository; its JSONL format is the contract
(no importer for any particular corpus):

```json
{"id": "easy-rename", "prompt": "Rename …", "paraphrases": ["Please rename …"],
 "outcomes": {"flash": {"correct": true, "cost_usd": 0.0011}, "qwen": {"correct": true, "cost_usd": 0.0093},
              "sol": {"correct": true, "cost_usd": 0.041}},
 "oracle": {"cheapest_correct": "flash"}}
```

`outcomes` is what each profile did when *you* ran it; the harness never
dispatches a pool profile, it asks the decider once per prompt and paraphrase.
For the decider and the rules-only baseline it reports accuracy, cost
(outcomes plus decisions), optimal-selection ratio, robustness (same tier
across paraphrases), undecidable rate, decision latency p50/p95, and a
deferral curve sweeping the frontier cut 0.1–0.9 without new decider calls.

`--output` writes `report.json`, `gate.json` and `decisions.jsonl`: one line
per prompt and paraphrase with the profile chosen, the signals, the reasons
and the decider's own answer (as `decide --raw` shows it; never the prompt).
The gate is advisory; `serve` never reads it.

| measure | bar |
|---|---|
| accuracy | ≥ baseline − 2 pp |
| cost | ≤ 0.8 × baseline |
| optimal selection | ≥ 0.40 |
| robustness | ≥ 0.85 |
| p95 latency | ≤ 300 ms (Dipylon 1.2 s, `llm` 1.5 s) |
| undecidable | ≤ 15 % |
| decision cost | ≤ 10 % of the saving |

<!-- END AUTOGEN -->
