// The worked example that runs through the home page: three models from three
// vendors, each one a profile the default install ships — GPT-6 Luna (mid,
// luna-clerk, through Codex; kit 0.35.0 and later), DeepSeek Flash (mid,
// deepseek-flash, an API key) and Claude Opus 5.5 (frontier, opus-reviewer,
// through Claude Code). Luna clears the mid line by half a point and is the
// cheapest, so it answers everything below the frontier; DeepSeek Flash is the
// default, answering when the decider can't. Every number comes from
// src/data/catalog.json at build time, and `route()` mirrors floor-v1's
// `choose()` in the kit (bin/lib/delegation_router_policy.py) for the requests
// the page shows. If the catalog moves a model to another tier, or
// a request would land elsewhere, the build fails here instead of publishing
// copy that no longer matches the router.
import catalog from '../data/catalog.json';

export type Tier = 'small' | 'mid' | 'frontier';

type CatalogModel = {
  id: string;
  name: string | null;
  tier: string | null;
  index: number | null;
  source: string;
  price: { in: number; out: number } | null;
};

/** A 310-token request plus the default 1,024-token answer budget. */
export const REQUEST_TOKENS = 310;
export const ANSWER_TOKENS = 1024;
export const CONFIDENCE_FLOOR = 0.55;

export const catalogVersion = catalog.catalogVersion as string;
export const tiering = catalog.tiering as {
  rule: string;
  frontier_within: number;
  mid_within: number;
  top_index: number;
  source: string;
  date: string;
  attribution: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
export const cuts = {
  top: tiering.top_index,
  frontier: round1(tiering.top_index - tiering.frontier_within),
  mid: round1(tiering.top_index - tiering.mid_within)
};

export type Profile = {
  /** The profile id in the kit's default install, as the config names it. */
  id: string;
  /** The catalog model. */
  model: string;
  name: string;
  /** How the model is reached, in a reader's words. */
  via: string;
  tier: Tier;
  index: number;
  price: { in: number; out: number };
  code: boolean;
  tierSource: string;
};

function profile(id: string, model: string, name: string, via: string, expected: Tier): Profile {
  const m = (catalog.models as CatalogModel[]).find((row) => row.id === model);
  if (!m || !m.price || m.index === null) throw new Error(`example pool: ${model} missing from the catalog`);
  if (m.tier !== expected)
    throw new Error(`example pool: ${model} is ${m.tier} in the catalog, the page says ${expected}`);
  return { id, model, name, via, tier: expected, index: m.index, price: m.price, code: true, tierSource: m.source };
}

export const luna = profile('luna-clerk', 'gpt-6-luna', 'GPT-6 Luna', 'through Codex', 'mid');
export const flash = profile('deepseek-flash', 'deepseek-flash', 'DeepSeek Flash', 'an API key', 'mid');
export const opus = profile('opus-reviewer', 'claude-opus-5-5', 'Claude Opus 5.5', 'through Claude Code', 'frontier');
/** The pool in the order the config lists it; flash is the default and the decider. */
export const pool = [luna, flash, opus];
export const fallback = flash;

export const cost = (p: Profile) => (p.price.in * REQUEST_TOKENS + p.price.out * ANSWER_TOKENS) / 1e6;
export const usd = (n: number) => `$${n.toFixed(4)}`;
export const priceTag = (p: Profile) => usd(cost(p));

/** `failed`: the decider errored, timed out or answered outside the schema. */
export type Verdict = { difficulty: number; tags: ('code' | 'math')[]; confidence: number; failed?: string };
export type Route = {
  chosen: Profile;
  /** The minimum score the rating sets; null when undecidable. */
  minimum: number | null;
  undecidable: boolean;
};

/**
 * floor-v1's minimum score for a 0–4 rating: none up to 1, the bottom of the
 * mid band at 2, of the frontier band from 3, in proportion between; math
 * raises it to the mid band.
 */
export function minimumScore(v: Verdict): number {
  const r = v.difficulty;
  let need = r >= 3 ? cuts.frontier : r >= 2 ? cuts.mid + (r - 2) * (cuts.frontier - cuts.mid) : r > 1 ? (r - 1) * cuts.mid : 0;
  if (v.tags.includes('math')) need = Math.max(need, cuts.mid);
  return round1(need);
}

/** floor-v1 for the page's requests: no tools, no long input, no ceiling. */
export function route(v: Verdict, models: Profile[] = pool, dflt: Profile = fallback): Route {
  if (v.failed || v.confidence < CONFIDENCE_FLOOR) return { chosen: dflt, minimum: null, undecidable: true };
  const need = minimumScore(v);
  const reaches = (p: Profile) => p.index >= need;
  let candidates: Profile[] = [];
  if (v.tags.includes('code')) candidates = models.filter((p) => p.code && reaches(p));
  if (!candidates.length) candidates = models.filter(reaches);
  const byCost = (a: Profile, b: Profile) => cost(a) - cost(b);
  const chosen = candidates.length
    ? [...candidates].sort(byCost)[0]
    : [...models].sort((a, b) => b.index - a.index || byCost(a, b))[0];
  return { chosen, minimum: need, undecidable: false };
}

export type Example = {
  request: string;
  v: Verdict;
  /** Where the kit's own policy sends it; the build checks route() agrees. */
  expect: Profile;
  /** The one-line reason the page prints. */
  why: string;
  r: Route;
};

function example(request: string, v: Verdict, expect: Profile, why: string): Example {
  const r = route(v);
  if (r.chosen !== expect)
    throw new Error(`example pool: "${request}" goes to ${r.chosen.name}, the page says ${expect.name}`);
  return { request, v, expect, why, r };
}

/** The requests the page follows; the hero shows the first three. */
export const examples: Example[] = [
  example(
    'Translate this paragraph into French',
    { difficulty: 1, tags: [], confidence: 0.8 },
    luna,
    'No minimum: the cheapest of your models, Luna.'
  ),
  example(
    'Summarise this contract',
    { difficulty: 2, tags: [], confidence: 0.8 },
    luna,
    `Minimum ${cuts.mid}: Luna (${luna.index}) clears it and is the cheapest that does.`
  ),
  example(
    'Find the race condition in this scheduler',
    { difficulty: 3, tags: ['code'], confidence: 0.8 },
    opus,
    `Minimum ${cuts.frontier}: only Opus 5.5 (${opus.index}) reaches it.`
  ),
  example(
    'Rename foo to bar in utils.py',
    { difficulty: 1, tags: ['code'], confidence: 0.8 },
    luna,
    'No minimum: the cheapest of your models good at code, Luna.'
  ),
  example(
    'What is 17% of 2,340?',
    { difficulty: 1, tags: ['math'], confidence: 0.8 },
    luna,
    `Easy, but math raises the minimum to ${cuts.mid}: Luna (${luna.index}) still clears it.`
  ),
  example(
    'Any request, when the decider times out',
    { difficulty: 0, tags: [], confidence: 0, failed: 'timeout' },
    flash,
    'No rating: your default model answers, and the response says so.'
  )
];

/** "2 of 4 · min 37.6", "1 of 4 · code · no minimum", or "no rating". */
export const rating = (v: Verdict) => {
  if (v.failed) return 'no rating';
  const need = minimumScore(v);
  return [`${v.difficulty} of 4`, ...v.tags, need > 0 ? `min ${need}` : 'no minimum'].join(' · ');
};

/** The site's spelling where the board's differs. */
const DISPLAY: Record<string, string> = {
  'deepseek-flash': 'DeepSeek Flash',
  'glm-5.3-flash': 'GLM 5.3 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'minimax-m3.1-flash': 'MiniMax M3.1 Flash'
};

/** A catalog model as a profile of the page's, for the hero's other sets. */
function catalogProfile(model: string): Profile {
  const m = (catalog.models as CatalogModel[]).find((row) => row.id === model);
  if (!m || !m.price || m.index === null || !m.tier) throw new Error(`example pool: ${model} missing from the catalog`);
  return {
    id: model,
    model,
    name: DISPLAY[model] ?? m.name ?? model,
    via: '',
    tier: m.tier as Tier,
    index: m.index,
    price: m.price,
    code: true,
    tierSource: m.source
  };
}

/**
 * The hero shows its three requests against four sets of your models from
 * different vendors, the example's own first. Each set lists, for each row,
 * the model the rule sends that request to; the build checks it. A model can
 * answer more than one row: a cheap mid model (Luna, MiniMax M3.1 Flash, GLM
 * 5.3 Flash) takes the easy request and the medium one; only the last set has
 * a small model, DeepSeek V4 Pro, which stops at the easy one.
 */
const SETS: { models: string[]; answers: [string, string, string] }[] = [
  {
    models: ['gpt-6-luna', 'deepseek-flash', 'claude-opus-5-5'],
    answers: ['gpt-6-luna', 'gpt-6-luna', 'claude-opus-5-5']
  },
  {
    models: ['minimax-m3.1-flash', 'claude-sonnet-5-5'],
    answers: ['minimax-m3.1-flash', 'minimax-m3.1-flash', 'claude-sonnet-5-5']
  },
  {
    models: ['glm-5.3-flash', 'gemini-3.8-flash', 'gpt-6.1-sol'],
    answers: ['glm-5.3-flash', 'glm-5.3-flash', 'gpt-6.1-sol']
  },
  {
    models: ['deepseek-v4-pro', 'qwen3.8-max', 'gpt-6-astra'],
    answers: ['deepseek-v4-pro', 'qwen3.8-max', 'gpt-6-astra']
  }
];

export type Option = { name: string; cost: string; tier: Tier };

/** For each of the hero's rows, the model that answers in each set. */
export const heroOptions: Option[][] = (() => {
  const own = new Map([luna, flash, opus].map((p) => [p.model, p]));
  const sets = SETS.map(({ models, answers }, k) => {
    const pool = models.map((id) => own.get(id) ?? catalogProfile(id));
    return answers.map((id, i) => {
      const r = route(examples[i].v, pool, pool[0]);
      if (r.chosen.model !== id)
        throw new Error(`example pool: set ${k + 1}: "${examples[i].request}" goes to ${r.chosen.name}, not ${id}`);
      return r.chosen;
    });
  });
  return [0, 1, 2].map((i) =>
    sets.map((answers) => ({ name: answers[i].name, cost: priceTag(answers[i]), tier: answers[i].tier }))
  );
})();
