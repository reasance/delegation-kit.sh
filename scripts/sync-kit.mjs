#!/usr/bin/env node
// Sync the site from the delegation-kit checkout (source of truth).
//
// Reads (sibling repo, or DELEGATION_KIT_ROOT):
//   package.json, CHANGELOG.md, docs/*.md, config/catalog.json
//   bin/delegation-config init                        (a fresh preset, in a temp dir)
//   bin/delegation-route table|resolve --json         (read-only router, schema 3)
// Writes:
//   src/data/kit.json, routing-table.json, resolve.json
//   the AUTOGEN block of src/pages/docs/*.md and src/pages/changelog/index.md
//
// Usage:
//   node scripts/sync-kit.mjs                     write everything
//   node scripts/sync-kit.mjs --check             exit 1 if out of sync (CI)
//   node scripts/sync-kit.mjs --allow-unreleased  sync from a checkout that is
//                                                 not at a clean release tag
//
// Syncs only from a clean kit checkout on the tag its package.json names;
// --check skips itself otherwise, so a refactor in progress next door cannot
// break or leak into the site. Nothing here dispatches a model: `init`,
// `table` and `resolve` are the kit's own read-only commands, run
// against a throwaway personal configuration in a temp directory.

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access, mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, posix, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, '..');
const kitRoot = resolve(
  process.env.DELEGATION_KIT_ROOT ?? resolve(siteRoot, '..', 'delegation-kit')
);
const isCheck = process.argv.includes('--check');
const allowUnreleased = process.argv.includes('--allow-unreleased');
const GITHUB = 'https://github.com/reasance/delegation-kit';

const BEGIN = '<!-- BEGIN AUTOGEN -->';
const END = '<!-- END AUTOGEN -->';
// Mirrors REVIEW_ROLES in the kit's bin/lib/delegation_config.py.
const REVIEW_LANES = ['reviewer', 'routine-review', 'material-review', 'security'];

function fail(message) {
  console.error(`sync-kit: ${message}`);
  process.exit(1);
}

try {
  await access(resolve(kitRoot, 'bin', 'delegation-route'));
} catch {
  if (isCheck) {
    console.log(`sync-kit: kit checkout not found at ${kitRoot}; skipping --check.`);
    process.exit(0);
  }
  fail(`kit checkout not found at ${kitRoot} (set DELEGATION_KIT_ROOT)`);
}

// ---- release guard -----------------------------------------------------------
function readFileSyncSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
function kitReleaseState() {
  const run = (args) => {
    try {
      return execFileSync('git', ['-C', kitRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return null;
    }
  };
  const version =
    JSON.parse(readFileSyncSafe(resolve(kitRoot, 'package.json')) ?? '{}').version ?? null;
  const dirty = run(['status', '--porcelain']);
  const tag = run(['describe', '--tags', '--exact-match', 'HEAD']);
  const expected = version ? `delegation-kit--v${version}` : null;
  const released = dirty === '' && tag !== null && tag === expected;
  return { version, dirty: dirty === null ? null : dirty !== '', tag, expected, released };
}
const state = kitReleaseState();
if (!state.released) {
  const why = state.dirty
    ? 'the checkout has uncommitted changes'
    : `HEAD is ${state.tag ?? 'not on a tag'}, expected ${state.expected ?? 'a release tag'}`;
  if (isCheck) {
    console.log(`sync-kit: kit checkout is not at a clean release (${why}); skipping --check.`);
    process.exit(0);
  }
  if (!allowUnreleased)
    fail(`kit checkout is not at a clean release (${why}); pass --allow-unreleased to sync anyway`);
  console.warn(`sync-kit: syncing from an unreleased kit state (${why}).`);
}

// ---- throwaway personal configurations ----------------------------------------
// The router reads the personal configuration. Two fresh presets, generated in
// a temp directory with an empty data home (so no legacy install leaks in):
// the default (review optional) and the strict one (review cross-family).
const scratch = await mkdtemp(join(tmpdir(), 'delegation-kit-site-'));
const emptyData = join(scratch, 'data');
await mkdir(emptyData, { recursive: true });
const configs = {
  default: join(scratch, 'default.json'),
  strict: join(scratch, 'strict.json')
};
const kitEnv = (configFile) => ({
  ...process.env,
  DELEGATION_CONFIG_FILE: configFile,
  DELEGATION_DATA_HOME: emptyData
});
const kitCommand = (bin, args, configFile = configs.default) =>
  JSON.parse(
    execFileSync(resolve(kitRoot, 'bin', bin), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: kitEnv(configFile)
    })
  );
kitCommand('delegation-config', ['init'], configs.default);
kitCommand('delegation-config', ['init', '--preset', 'strict'], configs.strict);
const defaultConfig = JSON.parse(await readFile(configs.default, 'utf8'));

let drift = [];
async function emit(relPath, content) {
  const abs = resolve(siteRoot, relPath);
  let current = null;
  try {
    current = await readFile(abs, 'utf8');
  } catch {}
  if (current === content) return;
  if (isCheck) {
    drift.push(relPath);
    return;
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  console.log(`sync-kit: wrote ${relPath}`);
}

// ---- version + release date ---------------------------------------------------
const pkg = JSON.parse(await readFile(resolve(kitRoot, 'package.json'), 'utf8'));
const changelog = await readFile(resolve(kitRoot, 'CHANGELOG.md'), 'utf8');
const head = changelog.match(/^## \[([^\]]+)\] — (\d{4}-\d{2}-\d{2})/m);
if (!head) fail('CHANGELOG.md has no `## [version] — date` heading');
if (head[1] !== pkg.version) fail(`CHANGELOG head ${head[1]} != package.json ${pkg.version}`);
const releaseTag = `delegation-kit--v${pkg.version}`;
const releaseUrl = `${GITHUB}/releases/tag/${releaseTag}`;

// ---- router -------------------------------------------------------------------
const table = kitCommand('delegation-route', ['table', '--json']);
const lanes = [...new Set(table.profiles.map((row) => row.lane))].sort();
const families = [
  ...new Set(
    Object.values(defaultConfig.profiles)
      .map((p) => p.family)
      .filter(Boolean)
  )
].sort();
const adapters = [...new Set(Object.values(defaultConfig.profiles).map((p) => p.adapter))].sort();

// The lane resolver on the home page is the router's own answer, precomputed:
// every lane under the default preset and every review lane once per producer
// family under the strict preset.
const resolveArgs = (lane, family) => [
  'resolve',
  '--lane',
  lane,
  '--json',
  ...(family ? ['--producer-family', family] : [])
];
const resolveData = { lanes: {}, strict: {} };
for (const lane of lanes)
  resolveData.lanes[lane] = kitCommand('delegation-route', resolveArgs(lane));
for (const lane of lanes.filter((l) => REVIEW_LANES.includes(l))) {
  resolveData.strict[lane] = {};
  for (const family of families)
    resolveData.strict[lane][family] = kitCommand(
      'delegation-route',
      resolveArgs(lane, family),
      configs.strict
    );
}
await rm(scratch, { recursive: true, force: true });

const kit = {
  version: pkg.version,
  releaseTag,
  releaseUrl,
  releaseDate: head[2],
  schemaVersion: table.schema_version,
  reviewPolicy: table.review_policy,
  profiles: Object.keys(defaultConfig.profiles).length,
  laneRows: table.profiles.length,
  lanes,
  reviewLanes: REVIEW_LANES.filter((l) => lanes.includes(l)),
  families,
  adapters,
  // Parameters per profile, from the preset the router read (effort etc.).
  profileConfig: defaultConfig.profiles,
  syncedAt: head[2]
};

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
await emit('src/data/kit.json', json(kit));
await emit('src/data/routing-table.json', json(table));
await emit('src/data/resolve.json', json(resolveData));

// The ladder the router climbs: the shipped catalog, rung by rung, with the
// third-party index each placement came from (read-only, no network).
const catalog = JSON.parse(await readFile(resolve(kitRoot, 'config/catalog.json'), 'utf8'));
const ladder = {
  catalogVersion: catalog.catalog_version,
  tiering: catalog.tiering ?? null,
  models: Object.entries(catalog.models)
    .map(([id, row]) => ({
      id,
      // The board's name for the model, without its variant: "Qwen3.8 Max (0902)" → "Qwen3.8 Max".
      name: row.evidence?.name?.replace(/\s*\([^)]*\)\s*$/, '') ?? null,
      tier: row.tier ?? null,
      index: row.evidence?.index ?? null,
      variant: row.evidence?.variant ?? null,
      source: row.evidence ? `${row.evidence.source}:${row.evidence.date}` : 'hand',
      price: row.price ?? null
    }))
    .sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || a.id.localeCompare(b.id))
};
await emit('src/data/catalog.json', json(ladder));

// ---- markdown docs ------------------------------------------------------------
const routeFor = {
  'README.md': '/',
  'CHANGELOG.md': '/changelog',
  'docs/router.md': '/docs/router',
  'docs/user-configuration.md': '/docs/configuration',
  'docs/external-executors.md': '/docs/executors',
  'docs/compatibility.md': '/docs/compatibility'
};

function rewriteLinks(markdown, sourcePath) {
  const sourceDir = posix.dirname(sourcePath);
  const pinned = markdown
    .replaceAll(`${GITHUB}/blob/main/`, `${GITHUB}/blob/${releaseTag}/`)
    .replaceAll(`${GITHUB}/tree/main/`, `${GITHUB}/tree/${releaseTag}/`);
  return pinned.replace(
    /\]\(((?:\.\.?\/)?[A-Za-z0-9_./-]+\.(?:md|json|toml|sh))(#[^)\s]*)?\)/g,
    (match, target, hash = '') => {
      if (/^[a-z]+:/.test(target)) return match;
      const kitPath = posix.normalize(posix.join(sourceDir, target));
      if (routeFor[kitPath]) return `](${routeFor[kitPath]}${hash})`;
      return `](${GITHUB}/blob/${releaseTag}/${kitPath}${hash})`;
    }
  );
}

async function syncBlock(sitePath, body) {
  const abs = resolve(siteRoot, sitePath);
  let page;
  try {
    page = await readFile(abs, 'utf8');
  } catch {
    fail(`missing page ${sitePath}; create it with the ${BEGIN} / ${END} markers first`);
  }
  const b = page.indexOf(BEGIN);
  const e = page.indexOf(END, b + BEGIN.length);
  if (b === -1 || e === -1) fail(`markers missing from ${sitePath}`);
  await emit(
    sitePath,
    `${page.slice(0, b + BEGIN.length)}\n\n${body.trimEnd()}\n\n${page.slice(e)}`
  );
}

async function syncDoc(sourcePath, sitePath) {
  const source = await readFile(resolve(kitRoot, sourcePath), 'utf8');
  await syncBlock(sitePath, rewriteLinks(source, sourcePath));
}

await syncDoc('docs/user-configuration.md', 'src/pages/docs/configuration.md');
await syncDoc('docs/external-executors.md', 'src/pages/docs/executors.md');
await syncDoc('docs/compatibility.md', 'src/pages/docs/compatibility.md');
await syncDoc('docs/router.md', 'src/pages/docs/router.md');

const firstVersion = changelog.match(/^## \[/m);
if (!firstVersion) fail('CHANGELOG.md has no version headings');
await syncBlock(
  'src/pages/changelog/index.md',
  rewriteLinks(changelog.slice(firstVersion.index), 'CHANGELOG.md')
);

if (isCheck) {
  if (drift.length) {
    console.error('sync-kit: out of sync with the kit checkout:');
    for (const p of drift) console.error(`  ${p}`);
    console.error('  Run `npm run sync-kit` to update.');
    process.exit(1);
  }
  console.log(
    `sync-kit: in sync with delegation-kit ${pkg.version} (${relative(siteRoot, kitRoot)}).`
  );
}
