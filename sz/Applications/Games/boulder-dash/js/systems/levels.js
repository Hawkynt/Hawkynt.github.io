/* Level parameters for every mode: the 40 story caves (six regular caves per chapter that bring
   in each depth's specialities, a bonus intermission and a boss arena), escalating Arcade caves
   with a boss every tenth, calm Zen caves, the Daily cave with its modifier, and small Time
   Attack caves. Each returns the parameter record cavegen.generate builds from. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const R = NS.rng;
  const C = NS.constants;
  const ST = NS.story;
  const I = NS.items;

  const CH_ORDER = ['amber', 'frost', 'grotto', 'magma', 'crystal'];

  /* creature pockets per chapter and cave index */
  function pocketsFor(ch, lv, extra) {
    const P = [];
    const add = (type, n, count) => { for (let k = 0; k < n; ++k) P.push({ type, count: count || 1 }); };
    switch (CH_ORDER[ch]) {
      case 'amber':
        if (lv >= 3) add(C.FIREFLY, lv - 1);
        if (lv >= 4) add(C.BUTTERFLY, 2);
        break;
      case 'frost':
        if (lv >= 1) add(C.BAT, 1 + (lv >> 1));
        if (lv >= 3) add(C.FIREFLY, 2);
        if (lv >= 5) add(C.BUTTERFLY, 1);
        break;
      case 'grotto':
        add(C.BUTTERFLY, 1 + (lv >> 1));
        if (lv >= 2) add(C.FIREFLY, 1 + (lv >> 2));
        if (lv >= 4) add(C.BAT, 1);
        break;
      case 'magma':
        add(C.FIREFLY, 2 + (lv >> 1));
        if (lv >= 3) add(C.MOLE, 1);
        if (lv >= 2) add(C.BUTTERFLY, 1);
        break;
      case 'crystal':
        add(C.FIREFLY, 2 + (lv >> 1));
        add(C.BUTTERFLY, 2);
        add(C.BAT, 1 + (lv >> 2));
        if (lv >= 2) add(C.MOLE, 1);
        break;
    }
    for (let k = 0; k < (extra || 0); ++k) P.push({ type: [C.FIREFLY, C.BUTTERFLY, C.BAT][k % 3], count: 1 });
    return P;
  }

  function caveParams(ch, lv, seed, opts) {
    opts = opts || {};
    const id = CH_ORDER[ch];
    const d = ch * 6 + lv;
    const p = {
      kind: 'cave', seed, theme: id, w: 40, h: 22,
      boulders: Math.min(0.2, 0.1 + d * 0.0035 + (lv === 2 && ch === 0 ? 0.05 : 0)),
      gems: 0.075 + Math.min(0.03, d * 0.001),
      caverns: 3 + (lv % 3),
      bricks: 2 + (ch >= 1 ? 2 : 0) + (lv >> 1),
      steel: 1 + ch,
      required: Math.round(10 + d * 0.6),
      time: 150 - ch * 4,
      items: 2 + (ch >> 1),
      tokens: 0,
      pockets: pocketsFor(ch, lv, opts.extraPockets),
      dark: ST.THEMES[id].dark,
      allowLife: !!opts.allowLife
    };
    if (id === 'amber' && lv >= 5) p.tnt = 5;
    if (id === 'frost') { p.ice = 0.03; if (lv >= 3) p.magic = 1; }
    if (id === 'grotto' && lv >= 1) p.amoeba = 1;
    if (id === 'magma') { p.lava = 2 + (lv >> 1); p.tnt = 4 + lv; }
    if (id === 'crystal') { p.bigGems = 0.008; p.magic = lv % 2; p.tnt = 3; if (lv >= 3) p.amoeba = 1; p.ice = 0.01; }
    return p;
  }

  function bonusParams(ch, seed) {
    return {
      kind: 'bonus', seed, theme: CH_ORDER[ch], w: 24, h: 14,
      boulders: 0.12, gems: 0.2, caverns: 2, bricks: 1, steel: 0, required: 22 + ch * 3, time: 50,
      items: 1, tokens: 0, pockets: [], dark: 0, allowLife: true, bigGems: ch >= 3 ? 0.02 : 0
    };
  }

  function bossParams(ch, seed, kind) {
    const def = I.BOSSES[kind || ST.CHAPTERS[ch].boss];
    return {
      kind: 'boss', seed, theme: CH_ORDER[ch], w: 40, h: 22, boss: kind || ST.CHAPTERS[ch].boss,
      items: def.hp + 4, bossBombs: def.hp + 3, tokens: 0, gemsInArena: 14, required: 0, time: 240, dark: 0
    };
  }

  function storyParams(ch, lv) {
    const seed = R.hash('story-' + ch + '-' + lv);
    const kind = ST.CHAPTERS[ch].kinds[lv];
    if (kind === 'bonus') return bonusParams(ch, seed);
    if (kind === 'boss') return bossParams(ch, seed);
    return caveParams(ch, lv, seed);
  }

  /* arcade cave n (1-based): themes rotate every three caves, a boss every tenth */
  function arcadeParams(n, runSeed) {
    const seed = R.hash('arcade-' + runSeed + '-' + n);
    const ch = Math.floor((n - 1) / 3) % 5;
    if (n % 10 === 0) {
      const p = bossParams(ch, seed, ST.CHAPTERS[(n / 10 - 1) % 5].boss);
      return p;
    }
    if (n % 5 === 0) return Object.assign(bonusParams(ch, seed), { time: 45 });
    const lv = Math.min(5, 1 + Math.floor(n / 4));
    const p = caveParams(ch, lv, seed, { extraPockets: Math.floor(n / 6), allowLife: true });
    p.time = Math.max(90, 150 - n * 3);
    p.required = Math.round(12 + Math.min(20, n * 0.8));
    return p;
  }

  function zenParams(n, runSeed) {
    const seed = R.hash('zen-' + runSeed + '-' + n);
    return {
      kind: 'zen', seed, theme: 'zen', w: 36, h: 20, boulders: 0.11, gems: 0.09, caverns: 4, bricks: 2, steel: 1,
      required: 18, time: 0, items: 3, tokens: 0, pockets: [], dark: 0.1, zen: true, ice: 0, allowLife: false
    };
  }

  function dailyParams(key, mod) {
    const seed = NS.progression.dailySeed(key);
    const r = R.make(seed);
    const ch = R.int(r, 5);
    const p = caveParams(ch, 4, seed);
    p.kind = 'daily';
    p.w = 44; p.h = 24;
    p.required = 26;
    p.time = 170;
    p.items = 4;
    switch (mod.id) {
      case 'dark': p.dark = 0.85; p.items += 2; break;
      case 'gemrain': p.gems *= 2; p.boulders = Math.min(0.26, p.boulders * 1.6); p.required = 40; break;
      case 'swarm': p.pockets = p.pockets.concat(pocketsFor(ch, 4, 3)); break;
      case 'quick': p.time = 140; break;
      case 'powder': p.tnt = (p.tnt || 0) + 10; break;
      case 'giant': p.w = 56; p.h = 30; p.required = 40; p.time = 240; p.items += 2; break;
    }
    return p;
  }

  function timeParams(n, runSeed) {
    const seed = R.hash('time-' + runSeed + '-' + n);
    const ch = (n - 1) % 5;
    const p = caveParams(ch, Math.min(4, n >> 1), seed);
    p.kind = 'time';
    p.w = 30; p.h = 17;
    p.gems = 0.11;
    p.required = 10 + Math.min(10, n);
    p.pockets = p.pockets.slice(0, 2);
    p.items = 2;
    p.tnt = Math.min(p.tnt || 0, 3);
    p.lava = Math.min(p.lava || 0, 1);
    return p;
  }

  /* builds the cave; a layout the repair could not make whole is rerolled with a nearby seed */
  function build(p) {
    if (p.kind === 'boss') return NS.cavegen.generateArena(p);
    let cv = null;
    for (let attempt = 0; attempt < 12; ++attempt) {
      const q = attempt ? Object.assign({}, p, { seed: (p.seed + attempt * 7919) >>> 0 }) : p;
      cv = NS.cavegen.generate(q);
      if (cv.required >= Math.ceil(p.required * 0.85) && NS.solver.isSolvable(cv)) break;
    }
    return cv;
  }

  Object.assign(NS.levels, { build, CH_ORDER, caveParams, bonusParams, bossParams, storyParams, arcadeParams, zenParams, dailyParams, timeParams });
})();
