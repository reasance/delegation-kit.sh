# delegation-kit.sh

Showcase and docs site for [`delegation-kit`](https://github.com/reasance/delegation-kit):
a model router on your machine for the models you already pay for. Easy
requests go to your cheap models, hard ones to your strong ones; you choose
the judge, your rules pick the model, and every response says why.

Built with **Astro 5** + **Tailwind v4** + **TypeScript**. Static-only output.
The runtime JavaScript is the copy button on code blocks and
`src/scripts/motion.ts` on the home page: scroll reveals and three story loops
(the hero table's rows rated one by one, the install command retyping itself,
a request's minimum score sweeping the ladder chart), driven by one
`requestAnimationFrame` clock that runs only while a story is on screen. All of
it is off under `prefers-reduced-motion`, where the markup is the final frame.
The "Resolve a role" panel on `/dispatch` is radio buttons plus CSS `:has()`.

## What the site shows, and where it comes from

Everything that describes the kit is generated from the kit checkout, never
written by hand here:

| on the site                                                                     | source in `../delegation-kit`                                                                         |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| version in the footer and hero, catalog date in the footer                      | `package.json`, `config/catalog.json`                                                                 |
| the ladder, the index chart and every price and rung in the worked example      | `config/catalog.json`                                                                                 |
| the routing table and the "Resolve a role" panel on `/dispatch`                 | `delegation-route table --json`, `delegation-route resolve --lane … --json`                           |
| `/docs/router`, `/docs/configuration`, `/docs/executors`, `/docs/compatibility` | `docs/router.md`, `docs/user-configuration.md`, `docs/external-executors.md`, `docs/compatibility.md` |
| `/changelog`                                                                    | `CHANGELOG.md`                                                                                        |

The worked example (a pool of GLM 5.3 Flash and Opus 5.5) is computed at build
time by `src/lib/example-pool.ts`, which mirrors tiered-v1 and fails the build
if the catalog moves one of its models to another rung.

`scripts/sync-kit.mjs` runs the kit's read-only commands and rewrites the
synced blocks between `<!-- BEGIN AUTOGEN -->` / `<!-- END AUTOGEN -->`
markers. It never dispatches a model.

```bash
npm run sync-kit          # refresh from ../delegation-kit (or DELEGATION_KIT_ROOT)
npm run sync-kit -- --check   # exit 1 if out of sync; skipped when the kit checkout is absent (CI)
```

`npm run build` runs the check first, then regenerates `public/og-image.png`
from `public/og-image.svg`.

## Develop

```bash
npm install
npm run dev       # http://localhost:4321
npm run check     # astro check: TypeScript + templates
npm run build     # static output in dist/
npm run preview
```

## Release sync

When the kit ships a version (its `release` flow, step "sync the showcase
site"): after npm serves the version, `npm run sync-kit`, `npm run build`,
commit, push. Pushing `main` deploys.

## Deploy

Production runs on **Cloudflare Workers with Static Assets**, configured in
`wrangler.jsonc` (Worker `delegation-kit-sh`, assets from `dist/`, custom
domain `delegation-kit.sh`). Two ways to deploy, same result:

- **From CI** — `.github/workflows/deploy.yml` builds and runs `wrangler
deploy` on every push to `main`. It needs the repository secrets
  `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + Workers Routes:Edit) and
  `CLOUDFLARE_ACCOUNT_ID`.
- **From a machine** — `npx wrangler login` once, then
  `npm run build && npx wrangler deploy`.

## Analytics

Umami Cloud, through `src/components/UmamiAnalytics.astro`. The script reports
only on `delegation-kit.sh` (`data-domains`), so dev and previews send nothing;
see `/privacy`.

## Layout

```
src/
  components/   CodeBlock, HeroResponse, RequestFlow, LadderStepper, LadderChart, Ladder, Disclosure,
                MachineBoundary, StatusPill, RoutingTable, LaneResolver, ResolvePanel, UmamiAnalytics
  data/         kit.json, catalog.json, routing-table.json, resolve.json  (generated)
  lib/          example-pool.ts (the worked example, from catalog.json)
  layouts/      BaseLayout, DocLayout
  pages/        index.astro, dispatch.astro, docs/*.md, changelog/index.md, privacy.md
  styles/       global.css (design tokens)
scripts/        sync-kit.mjs, generate-og-image.mjs
public/         favicon, og-image, prose.css, _headers, robots.txt
wrangler.jsonc  Workers Static Assets config
```

## License

MIT. Content synced from the kit repository is MIT there too.
