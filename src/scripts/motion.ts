// The home page's motion: scroll reveals, and three story loops that act out
// what the router does. BaseLayout sets `motion` on <html> only when motion is
// allowed; without it nothing here runs and every element is its final frame.
//
// Each story starts on the design, acts, and comes back to it. One
// requestAnimationFrame clock drives them all; a story's time advances only
// while it is on screen.

type Story = {
  /** Seconds after the element enters the view before the story starts. */
  delay: number;
  draw(t: number): void;
  reset(): void;
};

declare global {
  interface Window {
    __motion?: boolean;
  }
}

const root = document.documentElement;
if (root.classList.contains('motion')) {
  window.__motion = true;
  init();
}

function init() {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));

  const live = new Map<Element, { story: Story; t: number; on: boolean }>();
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let any = false;
    for (const s of live.values()) {
      if (!s.on) continue;
      any = true;
      s.t += dt;
      if (s.t >= 0) s.story.draw(s.t);
    }
    frame = any ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  // The intro plays once, when 30% of the visual is in view; the story then
  // runs while any of it is on screen.
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        let s = live.get(e.target);
        if (!s && e.intersectionRatio >= 0.3) {
          const story = make(e.target as HTMLElement | SVGSVGElement);
          if (!story) continue;
          e.target.classList.add('is-in');
          s = { story, t: -story.delay, on: true };
          live.set(e.target, s);
        }
        if (s) s.on = e.isIntersecting;
      }
      run();
    },
    { threshold: [0, 0.3] }
  );
  document.querySelectorAll('[data-story]').forEach((el) => watch.observe(el));
}

function make(el: HTMLElement | SVGSVGElement): Story | null {
  switch (el.dataset.story) {
    case 'ladder':
      return ladder(el as SVGSVGElement);
    case 'rows':
      return rows(el as HTMLElement);
    case 'type':
      return typing(el as HTMLElement);
  }
  return null;
}

// ── Keyframe tracks ──────────────────────────────────────────────────────

const io = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** [[time, value], ...] eased per segment. */
function track(keys: [number, number][], t: number, ease = io) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * ease(Math.min(1, (t - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}

// ── The ladder: a request's minimum score sweeps the axis ────────────────
//
// The hero's three requests in turn: an amber line at the minimum score, the
// models under it dimmed, the cheapest ringed model at or above it pulsing.
// The caption counts the minimum as the line glides.

function ladder(svg: SVGSVGElement): Story {
  const { beats, pool } = JSON.parse(svg.dataset.model!) as {
    beats: { rated: string; min: number }[];
    pool: { id: string; name: string; index: number }[];
  };
  const o = Number(svg.dataset.o);
  const k = Number(svg.dataset.k);
  const horizontal = svg.dataset.axis === 'x';
  const helpers = [...svg.querySelectorAll<SVGGElement>('.st')];
  const floor = svg.querySelector<SVGPathElement>('.floor')!;
  const rated = svg.querySelector<SVGTextElement>('[data-cap="rated"]')!;
  const pick = svg.querySelector<SVGTextElement>('[data-cap="pick"]')!;
  const dots = [...svg.querySelectorAll<SVGGElement>('.pt')].map((g) => ({
    index: Number(g.dataset.i),
    view: g.querySelector('.pv')!
  }));
  const pulses = new Map(
    [...svg.querySelectorAll<SVGCircleElement>('[data-pulse]')].map((c) => [c.dataset.pulse!, c])
  );

  // Fade in at the first minimum, hold, glide to the next; back to rest.
  const HOLD = 2.8;
  const GLIDE = 1.1;
  const minKeys: [number, number][] = [[0, beats[0].min]];
  const beatAt: number[] = [0];
  let t = 0.6 + HOLD;
  for (let b = 1; b < beats.length; b++) {
    beatAt.push(t);
    minKeys.push([t, beats[b - 1].min], [t + GLIDE, beats[b].min]);
    t += GLIDE + HOLD;
  }
  const end = t;
  minKeys.push([end + 0.8, beats[beats.length - 1].min]);
  const PERIOD = end + 1.6;
  const shown: [number, number][] = [
    [0, 0],
    [0.6, 1],
    [end + 0.3, 1],
    [end + 0.8, 0]
  ];

  const reset = () => {
    helpers.forEach((g) => (g.style.opacity = ''));
    dots.forEach((d) => d.view.classList.remove('dim'));
    pulses.forEach((c) => (c.style.opacity = ''));
  };

  return {
    delay: 2.2,
    reset,
    draw(time) {
      const lt = time % PERIOD;
      const alpha = track(shown, lt, (x) => x);
      if (alpha <= 0) return reset();
      const min = track(minKeys, lt);
      const at = o + min * k;
      floor.setAttribute('transform', horizontal ? `translate(${at} 0)` : `translate(0 ${at})`);
      helpers.forEach((g) => (g.style.opacity = String(alpha)));
      for (const d of dots) d.view.classList.toggle('dim', d.index < min - 0.05);

      // The router's rule on this page's pool: the cheapest at or above.
      const chosen = pool.find((p) => p.index >= min - 0.05) ?? pool[pool.length - 1];
      const b = beatAt.filter((s) => lt >= s).length - 1;
      rated.textContent = beats[b].rated;
      pick.textContent = `${min > 0.05 ? `min ${min.toFixed(1)}` : 'no minimum'} → ${chosen.name} answers`;

      // Pulse ring on the chosen model: 2s period, scale 1 → 2.6, 0.55 → 0.
      const p = (lt % 2) / 2;
      pulses.forEach((c, id) => {
        const on = id === chosen.id && alpha === 1;
        c.style.opacity = on ? String(0.55 * (1 - p)) : '0';
        c.style.transform = on ? `scale(${1 + 1.6 * p})` : '';
      });
    }
  };
}

// ── The hero table: the decider rates the rows one by one ───────────────

function rows(table: HTMLElement): Story {
  const list = [...table.querySelectorAll('tbody tr')];
  const STEP = 2.4;
  const PERIOD = list.length * STEP + 1.8;
  const reset = () => list.forEach((r) => r.classList.remove('is-on'));
  return {
    delay: 1.6,
    reset,
    draw(time) {
      const lt = time % PERIOD;
      list.forEach((r, i) => r.classList.toggle('is-on', lt >= i * STEP && lt < i * STEP + 2));
    }
  };
}

// ── The terminal: the commands delete and retype themselves ──────────────

function typing(pre: HTMLElement): Story {
  const code = pre.querySelector('code')!;
  const text = code.textContent ?? '';
  const ghost = document.createElement('code');
  ghost.className = 'type-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const typed = document.createTextNode(text);
  const caret = document.createElement('span');
  caret.className = 'type-caret';
  ghost.append(typed, caret);

  // [time, glyphs shown]: hold, delete, pause, type each line, hold.
  const TYPE = 0.06;
  const DELETE = 0.025;
  const keys: [number, number][] = [];
  let t = 1.4;
  keys.push([0, text.length], [t, text.length]);
  t += text.length * DELETE;
  keys.push([t, 0]);
  t += 0.6;
  keys.push([t, 0]);
  const lines = text.split('\n');
  let n = 0;
  lines.forEach((line, i) => {
    t += line.length * TYPE;
    n += line.length;
    keys.push([t, n]);
    if (i < lines.length - 1) {
      // The first command runs before the next is typed.
      n += 1;
      t += 0.7;
      keys.push([t, n]);
    }
  });
  t += 3;
  keys.push([t, text.length]);
  const PERIOD = t;
  const typingAt = (lt: number) => {
    for (let i = 1; i < keys.length; i++)
      if (lt < keys[i][0]) return keys[i][1] !== keys[i - 1][1];
    return false;
  };

  const reset = () => {
    ghost.remove();
    code.style.opacity = '';
  };
  return {
    delay: 1.2,
    reset,
    draw(time) {
      const lt = time % PERIOD;
      if (!ghost.isConnected) {
        pre.append(ghost);
        code.style.opacity = '0';
      }
      const shown = Math.round(track(keys, lt, (x) => x));
      typed.data = text.slice(0, shown);
      // Solid while typing, blinking once a second while idle.
      caret.style.opacity = typingAt(lt) || lt % 1 < 0.5 ? '1' : '0';
    }
  };
}

export {};
