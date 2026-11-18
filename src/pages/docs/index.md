---
layout: ../../layouts/DocLayout.astro
title: 'Getting started — delegation-kit'
description: 'Install delegation-kit, choose a decider and your models, start the router and send your first request from curl or the OpenAI SDK.'
path: '/docs'
---

# Getting started

By the end of this page a router runs on your own machine: each request goes
to the cheapest of your models strong enough for it, and the response says
which answered and why.
[How it picks](/#how) is on the home page.

## What you need

- macOS with Node.js, `jq`, `git` and `python3`.
- Two or more models you can call. Each is either an API key (DeepSeek, Qwen,
  MiniMax, Meta, or any OpenAI-compatible endpoint, local ones included) or a
  plan you use through a CLI (Claude, Codex, GLM, Kimi, Muse Code, Grok, Antigravity).
- The example uses three models the install already knows: Gemini 4 Hydrogen/high
  (an Antigravity login), DeepSeek Flash (an API key) and Claude Opus 5.5 (Claude
  Code). Use the ones you have instead.

## 1. Install

The standard install adds commands and model profiles. It also installs a
delegation guard in the global Claude Code instructions (`CLAUDE.md`) and the
global Codex instructions (`AGENTS.md`), so the guard applies across projects.
Choose `--claude-only` or `--codex-only` to limit the installation to one host.

```sh
npx delegation-kit
```

The installer:

- fetches the release and installs the commands in `~/.local/bin` (keep it on
  your PATH);
- asks for the Z.AI, DeepSeek and Qwen keys (Enter skips one) and saves them
  in files only you can read;
- checks the install.

Every other key goes in `~/.config/delegation-kit/.env` (created from
`.env.example`, mode 600, outside every project, never committed), one
`NAME=value` per line: `MINIMAX_API_KEY` for the `minimax-m3.1-flash` profile
the install ships, and the key of any model you add. A variable
set in your shell wins. See
[Keys and environment](/docs/configuration/#keys-and-environment).

## 2. See your profiles

```sh
delegation-config show
```

Each entry is a *profile*: a short name for one model and how to reach it.
A model can have several profiles, one per role (`opus-builder`,
`opus-reviewer`).

## 3. Choose the decider and the pool

Open `~/.config/delegation-kit/config.json` and add a `"router"` entry next to
`"profiles"`:

```json
"router": {
  "decider": { "kind": "llm", "profile": "deepseek-flash" },
  "pool": ["hydrogen-builder", "deepseek-flash", "opus-reviewer"],
  "default": "deepseek-flash"
}
```

- `decider`: who rates each request. Here, DeepSeek Flash on your API key.
- `pool`: the profiles it may choose from, by the names `show` printed.
  `hydrogen-builder` is mid at high effort (50.8), `deepseek-flash` small at
  max effort (32.6), and `opus-reviewer` frontier at max effort (59.1). The
  v5.0.1 snapshot starts mid at 44.6 and frontier at 56.6.
- `default`: the profile that answers when the decider can't.

Other deciders: Levanto Sage, TypeSafe Jev, your own Dipylon, a local
classifier, or `none` (always the default). See
[Deciders](/docs/router/#deciders).

## 4. Check it

```sh
delegation-router check
```

It prints the decider and each profile's tier and score, calling no model,
and names any pool profile this machine can't reach (no key, its runner's
check failing, its CLI missing). The router sets those aside, except the
default: a request that lands on an unreachable default is refused.

## 5. Start the router and send a request

```sh
delegation-router serve
```

In another terminal:

```sh
curl -si 127.0.0.1:4141/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Rename foo to bar in utils.py"}]}'
```

From your app, point any OpenAI SDK at the router and ask for `"auto"`. The
API key is ignored: each profile uses its own. Claude Code and Codex can't
send requests here, but the router can pick them to answer
([why](/docs/router/)).

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:4141/v1", api_key="unused")
reply = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Rename foo to bar in utils.py"}],
)
```

## 6. Read why

The response headers name the choice:

```
X-Router-Model: gpt-5.6-luna
X-Router-Tier: small
X-Router-Difficulty: 1.0
```

`X-Router-Difficulty` is the decider's rating, 0 to 4. The `router` field in
the body lists the reasons and each candidate's estimated cost.

With this pool, an easy request goes to `luna-clerk`, a medium one or one
with math to `deepseek-flash`, a hard or very long one to `opus-reviewer`.
Tools, images or JSON mode always go to `deepseek-flash`: the other two answer
through CLIs, which can't take them.

An agent loop sends one request per step. Send the same
`X-Router-Conversation: <id>` on each, and every step goes to the model the
first one got, instead of changing model halfway through the task
([Conversations](/docs/router/#conversations)).

## Next

- [Router reference](/docs/router/): every field and error.
- [Add a model](/docs/configuration/#adding-a-model): your own key or endpoint.
- [Run a model by hand](/docs/dispatch/): one task to one profile, named by
  you or proposed by your decider.

## Other ways to install

- From a clone: `git clone https://github.com/reasance/delegation-kit`,
  then `./install.sh`; `./doctor.sh` checks the install.
- To remove it, run `./uninstall.sh` from a clone. Your keys are kept.
