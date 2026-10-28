// The worked example uses three shipped profiles with exact measured efforts:
// Terra/high (mid), DeepSeek/max (small, default and decider), Opus/max
// (frontier). Scores and token prices come from the released v5 catalog.
// route() mirrors floor-v1 for these bounded text-only illustrative requests.
import catalog from '../data/catalog.json';

export type Tier = 'small' | 'mid' | 'frontier';

type CatalogModel = {
  id: string;
  name: string | null;
  tier: string | null;
  index: number | null;
  variant?: string | null;
  variants?: Record<string, number>;
  indexVersion?: string | null;
  source: string;
  price: { in: number; out: number } | null;
};

/** A 310-token request plus the default 1,024-token answer budget. */
export const REQUEST_TOKENS = 310;
export const ANSWER_TOKENS = 1024;
export const CONFIDENCE_FLOOR = 0.55;

export const catalogVersion = catalog.catalogVersion as string;
export const indexVersion = (catalog.tiering as { index_version?: string }).index_version ?? "unknown";
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

function profile(id: string, model: string, name: string, via: string, expected: Tier, effort: string): Profile {
  const m = (catalog.models as CatalogModel[]).find((row) => row.id === model);
  const index = m?.variants?.[effort];
  if (!m || !m.price || typeof index !== 'number' || m.indexVersion !== '5.0')
    throw new Error(`example pool: ${model}/${effort} has no measured v5 score`);
  const tier: Tier = index >= cuts.frontier ? 'frontier' : index >= cuts.mid ? 'mid' : 'small';
  if (tier !== expected) throw new Error(`example pool: ${model}/${effort} is ${tier}, expected ${expected}`);
  return { id, model, name, via, tier, index, price: m.price, code: true, tierSource: m.source };

}

export const terra = profile('terra-builder', 'gpt-6.1-terra', 'GPT-6.1 Terra', 'through Codex at high effort', 'mid', 'high');
export const flash = profile('deepseek-flash', 'deepseek-flash', 'DeepSeek Flash', 'an API key at max effort', 'small', 'max');
export const opus = profile('opus-reviewer', 'claude-opus-5-5', 'Claude Opus 5.5', 'through Claude Code at max effort', 'frontier', 'max');
/** The pool in the order the config lists it; flash is the default and the decider. */
export const pool = [terra, flash, opus];
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
    flash,
    'No minimum: the cheapest of your models, DeepSeek Flash.'
  ),
  example(
    'Summarise this contract',
    { difficulty: 2, tags: [], confidence: 0.8 },
    terra,
    `Minimum ${cuts.mid}: Terra (${terra.index}) clears it and is the cheapest that does.`
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
    flash,
    'No minimum: the cheapest code-capable model in this pool, DeepSeek Flash.'
  ),
  example(
    'What is 17% of 2,340?',
    { difficulty: 1, tags: ['math'], confidence: 0.8 },
    terra,
    `Easy, but math raises the minimum to ${cuts.mid}: Terra (${terra.index}) still clears it.`
  ),
  example(
    'Any request, when the decider times out',
    { difficulty: 0, tags: [], confidence: 0, failed: 'timeout' },
    flash,
    'No rating: your default model answers, and the response says so.'
  )
];

/** "2 of 4 · min 38.4", "1 of 4 · code · no minimum", or "no rating". */
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
    name: `${DISPLAY[model] ?? m.name ?? model} (${m.variant ?? "unmeasured"})`,
    via: '',
    tier: m.tier as Tier,
    index: m.index,
    price: m.price,
    code: true,
    tierSource: m.source
  };
}

/** Four illustrative pools; every displayed answer is checked by route().
 * Models outside the primary pool use their best explicitly measured variant.
 */
const SETS: { models: string[]; answers: [string, string, string] }[] = [
  { models: ['gpt-6.1-terra', 'deepseek-flash', 'claude-opus-5-5'],
    answers: ['deepseek-flash', 'gpt-6.1-terra', 'claude-opus-5-5'] },
  { models: ['gpt-6-luna', 'gpt-6.1-terra', 'claude-sonnet-5-5'],
    answers: ['gpt-6-luna', 'gpt-6.1-terra', 'claude-sonnet-5-5'] },
  { models: ['deepseek-flash', 'gpt-6.1-terra', 'gpt-6.1-sol'],
    answers: ['deepseek-flash', 'gpt-6.1-terra', 'gpt-6.1-sol'] },
  { models: ['gpt-6-luna', 'claude-opus-5-5', 'gpt-6-astra'],
    answers: ['gpt-6-luna', 'claude-opus-5-5', 'claude-opus-5-5'] }
];

export type Option = { name: string; cost: string; tier: Tier };

/** For each of the hero's rows, the model that answers in each set. */
export const heroOptions: Option[][] = (() => {
  const own = new Map([terra, flash, opus].map((p) => [p.model, p]));
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
