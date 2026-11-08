/* Versus: you against a CPU rival on its own board, dealt the same pieces from the same seed.
   Clears send garbage after the attack table (single 0, double 1, triple 2, quad 4, T-spin
   single 2 / double 4 / triple 6, mini double 1, back-to-back +1, combo bonus, perfect clear 10).
   Sent rows first cancel your own incoming rows, the rest travel to the other board and land
   after a short warning, all with one hole per attack. Both boards speed up every 25 seconds so
   a match always ends; the first to top out loses. The rival is the placement bot steered like a
   player - it waits, holds, turns and slides the piece one step at a time and drops it - at one
   of four strengths (Rookie, Pro, Ace, Legend) that differ in thinking time, step speed, look-ahead
   and how often it settles for a worse spot. Its choices come from its own seeded generator, so
   a match replays the same. Every rule set works: Blast adds a row per bomb that goes off, and
   in Pairs and Jewels bursts send grey stones instead of rows (Pairs: one per blob past the
   third, four per chain link; Jewels: one per jewel past the second, three per link). Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const E = NS.engine;
  const BOT = NS.bot;
  const { makeRng } = NS.rng;

  const CPUS = [
    { id: 'rookie', name: 'Rookie', think: 0.9, gap: 0.16, miss: 0.3, deep: false, color: '#7be08a' },
    { id: 'pro', name: 'Pro', think: 0.45, gap: 0.09, miss: 0.1, deep: false, color: '#5ad0ff' },
    { id: 'ace', name: 'Ace', think: 0.22, gap: 0.055, miss: 0.03, deep: true, color: '#ffb14a' },
    { id: 'legend', name: 'Legend', think: 0.08, gap: 0.03, miss: 0, deep: true, color: '#ff5a8a' },
  ];
  const CPU_BY_ID = {};
  for (const c of CPUS) CPU_BY_ID[c.id] = c;

  const LINES = [0, 0, 1, 2, 4];
  const TSPIN = [0, 2, 4, 6];
  const COMBO = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  const LAND = 1.5, SPEEDUP = 25, MAX_LEVEL = 15;

  /* rows (or stones) a clear or burst event sends */
  function attackFor(ev, rule) {
    if (ev && ev.type === 'burst') {
      const chain = Math.max(0, (ev.chain || 1) - 1);
      return rule === 'jewels' ? Math.max(0, ev.cleared - 2) + chain * 3 : Math.max(0, ev.cleared - 3) + chain * 4;
    }
    if (!ev || !ev.lines || ev.source !== 'piece') return 0;
    let n = ev.tspin === 'full' ? TSPIN[ev.lines] : ev.tspin === 'mini' ? (ev.lines === 2 ? 1 : 0) : LINES[ev.lines];
    if (ev.b2b) n += 1;
    n += COMBO[Math.min(COMBO.length - 1, ev.combo || 0)];
    if (ev.perfect) n += 10;
    n += ev.bombs || 0;
    return n;
  }

  function side(game) {
    return { game: game, incoming: [], sent: 0, received: 0, cancelled: 0 };
  }

  /* run fields for a match; cpu: id from CPUS */
  function attach(run, cpu, seed) {
    const def = CPU_BY_ID[cpu] || CPUS[1];
    const g0 = run.game;
    const rival = g0.match ? NS.match.create({ rule: g0.rule, seed: seed, level: 1, levelMode: 'fixed', preview: 2 })
      : E.create({ seed: seed, level: 1, levelMode: 'fixed', preview: 5, hold: true, orbChance: 0, bombChance: g0.bombChance });
    run.game.levelMode = 'fixed';
    run.game.level = 1;
    run.game.orbChance = 0;
    run.vs = { cpu: def.id, you: side(null), rival: side(null), plan: null, wait: def.think, rng: (seed ^ 0x5bd1e995) >>> 0, level: 1 };
    run.rival = rival;
    run.kind = 'versus';
    return run;
  }

  function en(g) {
    return g.match ? NS.match : E;
  }

  function sideOf(run, who) {
    return who === 'you' ? run.vs.you : run.vs.rival;
  }

  function gameOf(run, who) {
    return who === 'you' ? run.game : run.rival;
  }

  function pending(run, who) {
    let n = 0;
    for (const a of sideOf(run, who).incoming) n += a.rows;
    return n;
  }

  /* a clear by `who`: cancel own incoming, send the rest; -> rows sent on */
  function onClear(run, who, ev) {
    let n = attackFor(ev, run.game.rule);
    if (!n) return 0;
    const me = sideOf(run, who), them = sideOf(run, who === 'you' ? 'rival' : 'you');
    while (n > 0 && me.incoming.length) {
      const a = me.incoming[0];
      const k = Math.min(a.rows, n);
      a.rows -= k;
      n -= k;
      me.cancelled += k;
      if (!a.rows) me.incoming.shift();
    }
    if (!n) return 0;
    me.sent += n;
    const target = gameOf(run, who === 'you' ? 'rival' : 'you');
    them.incoming.push({ rows: n, t: LAND, hole: Math.floor(en(target).rand(target) * C.COLS) });
    run.events.push({ type: 'send', from: who, rows: n });
    return n;
  }

  function landing(run, who, dt) {
    const s = sideOf(run, who), g = gameOf(run, who);
    for (const a of s.incoming) a.t -= dt;
    while (s.incoming.length && s.incoming[0].t <= 0 && !g.over) {
      const a = s.incoming.shift();
      s.received += a.rows;
      en(g).addGarbage(g, a.rows, a.hole);
      if (who === 'you') ++run.hitsTaken;
      run.events.push({ type: 'land', to: who, rows: a.rows });
    }
  }

  function rnd(vs) {
    const r = makeRng(vs.rng);
    const v = r.next();
    vs.rng = r.s;
    return v;
  }

  /* every placement of type t on board, best first */
  function ranked(board, t) {
    const out = [];
    const rots = t === 'O' ? 1 : t === 'I' || t === 'S' || t === 'Z' ? 2 : 4;
    for (let r = 0; r < rots; ++r)
      for (let x = -2; x < C.COLS; ++x) {
        const s = BOT.simulate(board, t, r, x);
        if (s) out.push({ r: r, x: x, value: BOT.evaluate(s.board, s.lines) });
      }
    out.sort((a, b) => b.value - a.value);
    return out;
  }

  /* where the rival wants its current piece: { r, x, hold } */
  function plan(run) {
    const g = run.rival, vs = run.vs, def = CPU_BY_ID[vs.cpu];
    if (!g.piece) return null;
    if (g.match) {
      const list = NS.match.ranked(g);
      if (!list.length) return null;
      const k = def.miss && rnd(vs) < def.miss ? Math.min(list.length - 1, 1 + Math.floor(rnd(vs) * 3)) : 0;
      return { r: list[k].r, x: list[k].x, hold: false };
    }
    let best = def.deep ? BOT.deepFor(g.board, g.piece.t, g.queue[0], 0) : BOT.choose(g);
    if (!best) return null;
    best = { r: best.r, x: best.x, hold: !!best.hold };
    if (def.miss && rnd(vs) < def.miss) {
      const list = ranked(g.board, g.piece.t);
      const pick = list[Math.min(list.length - 1, 1 + Math.floor(rnd(vs) * 3))];
      if (pick) best = { r: pick.r, x: pick.x, hold: false };
    }
    return best;
  }

  /* the rival's hands: one action per step gap */
  function steer(run, dt) {
    const g = run.rival, vs = run.vs, def = CPU_BY_ID[vs.cpu];
    const EN = en(g);
    if (!EN.active(g)) { vs.plan = null; return; }
    vs.wait -= dt;
    if (vs.wait > 0) return;
    if (!vs.plan) {
      vs.plan = plan(run);
      vs.wait = def.gap;
      if (!vs.plan) { EN.hardDrop(g); vs.wait = def.think; }
      return;
    }
    const p = vs.plan, pc = g.piece;
    vs.wait = def.gap;
    if (p.hold) {
      p.hold = false;
      if (E.holdPiece(g)) {
        const again = BOT.bestFor(g.board, g.piece.t);
        if (again) { p.r = again.r; p.x = again.x; }
      }
      return;
    }
    if (pc.r !== p.r) {
      const d = g.rule === 'jewels' ? 1 : (p.r - pc.r + 4) & 3;
      if (!EN.rotate(g, d === 3 ? -1 : d === 2 ? 2 : 1)) { EN.placeAt(g, p.r, p.x); finishPiece(vs, def); }
      return;
    }
    if (pc.x !== p.x) {
      if (!EN.move(g, p.x > pc.x ? 1 : -1)) { EN.placeAt(g, p.r, p.x); finishPiece(vs, def); }
      return;
    }
    EN.hardDrop(g);
    finishPiece(vs, def);
  }

  function finishPiece(vs, def) {
    vs.plan = null;
    vs.wait = def.think;
  }

  /* one fixed step of the match after the player's board stepped */
  function step(run, dt) {
    const vs = run.vs;
    const lv = Math.min(MAX_LEVEL, 1 + Math.floor(run.t / SPEEDUP));
    if (lv !== vs.level) {
      vs.level = lv;
      run.game.level = lv;
      run.rival.level = lv;
      run.events.push({ type: 'levelup', level: lv });
    }
    steer(run, dt);
    en(run.rival).step(run.rival, dt, null);
    const evs = en(run.rival).takeEvents(run.rival);
    for (const e of evs) {
      if (e.type === 'clear' || e.type === 'burst') onClear(run, 'rival', e);
      run.events.push({ type: 'rival', ev: e });
    }
    landing(run, 'you', dt);
    landing(run, 'rival', dt);
  }

  /* -> 'you' | 'rival' | '' */
  function winner(run) {
    if (run.game.over) return 'rival';
    if (run.rival.over) return 'you';
    return '';
  }

  Object.assign(NS.versus, { CPUS, CPU_BY_ID, LAND, SPEEDUP, attackFor, attach, pending, onClear, landing, ranked, plan, steer, step, winner });
})();
