/* The board engine, pure and deterministic: a game is one plain object (size, mines, the board once
   the first click placed it, open cells, flags and question marks, gems and chests, defused mines,
   fog patches, timers, score, shields, statistics, events), so it saves as JSON and replays the
   same from its seed.
   - The first reveal places the mines (board.generate, proven no-guess when asked) around it.
   - Revealing floods through zeros; a mine ends the game unless a shield takes it - then the mine
     is defused and stays marked.
   - Flags cycle flag, question mark (when marks are on) and nothing; flagging can be switched off
     (No Flags) or frozen for a while (a guardian's frost).
   - Chording on a number whose flags match it opens the rest of its neighbours.
   - Gems and chests sit on safe cells: opening one collects it (score, or a power for the session).
   - Helpers for powers and guardians: scan (open a safe frontier cell), sonar (flag a frontier
     mine), lantern (light a 3 x 3), rebury (close open number cells again), unflag, fog.
   Every change leaves events (open, flag, boom, shield, gem, chest, win, lose, ...). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const B = NS.board;
  const { makeRng, hashString } = NS.rng;

  function rand(g) {
    const r = makeRng(g.rng);
    const v = r.next();
    g.rng = r.s;
    return v;
  }

  /* opts: w, h, mines, seed, noGuess, gems, chests, lives, marks, noFlags, scoreMul */
  function create(opts) {
    opts = opts || {};
    const w = opts.w || 9, h = opts.h || 9, n = w * h;
    const g = {
      w: w, h: h, mines: Math.min(opts.mines == null ? 10 : opts.mines, n - 1), seed: String(opts.seed == null ? 1 : opts.seed),
      rng: hashString('engine:' + opts.seed) >>> 0, noGuess: !!opts.noGuess, proven: false,
      mine: null, num: null, open: new Array(n).fill(0), flag: new Array(n).fill(0), item: new Array(n).fill(0), defused: new Array(n).fill(0), buried: new Array(n).fill(0),
      gems: opts.gems || 0, chests: opts.chests || 0, lives: opts.lives || 0, marks: opts.marks !== false, noFlags: !!opts.noFlags,
      state: 'ready', t: 0, opened: 0, score: 0, scoreMul: opts.scoreMul || 1, hit: -1, fog: [], flagLockT: 0,
      stats: { opened: 0, flags: 0, wrongFlags: 0, chords: 0, gems: 0, chests: 0, shields: 0, biggest: 0, clicks: 0, questions: 0 },
      events: [],
    };
    return g;
  }

  function safeCount(g) {
    return g.w * g.h - g.mines;
  }

  function playing(g) {
    return g.state === 'ready' || g.state === 'play';
  }

  /* the first reveal: the board, then the gems and chests on safe cells */
  function placeBoard(g, start) {
    const r = B.generate(g.w, g.h, g.mines, g.seed, start, { noGuess: g.noGuess });
    g.mine = r.mine;
    g.proven = r.noGuess;
    g.num = B.numbers(g.w, g.h, g.mine);
    const free = [];
    for (let i = 0; i < g.w * g.h; ++i) if (!g.mine[i] && i !== start) free.push(i);
    const put = (n, kind) => {
      for (let k = 0; k < n && free.length; ++k) {
        const j = Math.floor(rand(g) * free.length);
        g.item[free[j]] = kind;
        free.splice(j, 1);
      }
    };
    put(g.gems, 1);
    put(g.chests, 2);
    g.state = 'play';
    g.events.push({ type: 'board', proven: g.proven });
  }

  /* opens i and floods through zeros; -> cells opened */
  function flood(g, i) {
    const nb = B.neighbours(g.w, g.h);
    const stack = [i], opened = [];
    while (stack.length) {
      const k = stack.pop();
      if (g.open[k] || g.flag[k] === 1 || g.mine[k]) continue;
      g.open[k] = 1;
      g.buried[k] = 0;
      if (g.flag[k] === 2) g.flag[k] = 0;
      opened.push(k);
      if (g.item[k]) collect(g, k);
      if (g.num[k] === 0) for (const j of nb[k]) if (!g.open[j]) stack.push(j);
    }
    if (opened.length) {
      g.opened += opened.length;
      g.stats.opened += opened.length;
      g.stats.biggest = Math.max(g.stats.biggest, opened.length);
      g.score += Math.round(opened.length * 10 * g.scoreMul);
      g.events.push({ type: 'open', from: i, cells: opened });
    }
    return opened.length;
  }

  function collect(g, k) {
    const kind = g.item[k];
    g.item[k] = 0;
    if (kind === 1) {
      ++g.stats.gems;
      g.score += Math.round(250 * g.scoreMul);
      g.events.push({ type: 'gem', i: k });
    } else if (kind === 2) {
      ++g.stats.chests;
      g.score += Math.round(100 * g.scoreMul);
      g.events.push({ type: 'chest', i: k });
    }
  }

  function checkWin(g) {
    if (g.state !== 'play' || g.opened < safeCount(g)) return false;
    g.state = 'won';
    for (let i = 0; i < g.w * g.h; ++i) if (g.mine[i]) g.flag[i] = 1;
    g.events.push({ type: 'win' });
    return true;
  }

  function lose(g, i) {
    g.state = 'lost';
    g.hit = i;
    for (let k = 0; k < g.w * g.h; ++k) if (g.flag[k] === 1 && !g.mine[k]) ++g.stats.wrongFlags;
    g.events.push({ type: 'lose', i: i });
  }

  /* -> 'open' | 'boom' | 'shield' | '' */
  function reveal(g, i) {
    if (!playing(g) || i < 0 || i >= g.w * g.h || g.open[i] || g.flag[i] === 1 || g.defused[i]) return '';
    ++g.stats.clicks;
    if (g.state === 'ready') placeBoard(g, i);
    if (g.mine[i]) {
      if (g.lives > 0) {
        --g.lives;
        ++g.stats.shields;
        g.defused[i] = 1;
        g.flag[i] = 1;
        g.events.push({ type: 'shield', i: i });
        return 'shield';
      }
      g.events.push({ type: 'boom', i: i });
      lose(g, i);
      return 'boom';
    }
    flood(g, i);
    checkWin(g);
    return 'open';
  }

  /* flag, question mark (with marks), nothing */
  function toggleFlag(g, i) {
    if (!playing(g) || g.open[i] || g.defused[i] || g.noFlags || g.flagLockT > 0) return false;
    const f = g.flag[i];
    g.flag[i] = f === 0 ? 1 : f === 1 && g.marks ? 2 : 0;
    if (g.flag[i] === 1) ++g.stats.flags;
    if (g.flag[i] === 2) ++g.stats.questions;
    g.events.push({ type: 'flag', i: i, f: g.flag[i] });
    return true;
  }

  function setFlag(g, i, on) {
    if (g.open[i] || g.defused[i]) return false;
    if (!!(g.flag[i] === 1) === !!on) return false;
    g.flag[i] = on ? 1 : 0;
    if (on) ++g.stats.flags;
    g.events.push({ type: 'flag', i: i, f: g.flag[i] });
    return true;
  }

  /* on an open number with matching flags: open the other neighbours; -> result of the worst one */
  function chord(g, i) {
    if (g.state !== 'play' || !g.open[i] || g.num[i] <= 0) return '';
    const nb = B.neighbours(g.w, g.h)[i];
    let flags = 0;
    for (const j of nb) if (g.flag[j] === 1 || g.defused[j]) ++flags;
    if (flags !== g.num[i]) return '';
    ++g.stats.chords;
    g.events.push({ type: 'chord', i: i });
    let worst = 'open';
    for (const j of nb) {
      if (g.open[j] || g.flag[j] === 1 || g.defused[j]) continue;
      const r = reveal(g, j);
      if (r === 'boom') return 'boom';
      if (r === 'shield') worst = 'shield';
    }
    return worst;
  }

  function step(g, dt) {
    if (g.state !== 'play') return;
    g.t += dt;
    if (g.flagLockT > 0) g.flagLockT = Math.max(0, g.flagLockT - dt);
    for (let k = g.fog.length - 1; k >= 0; --k) if ((g.fog[k].t -= dt) <= 0) g.fog.splice(k, 1);
  }

  function flagsLeft(g) {
    let f = 0;
    for (let i = 0; i < g.w * g.h; ++i) if (g.flag[i] === 1) ++f;
    return g.mines - f;
  }

  /* the player's view for the solver: open cells with numbers, flags (and defused mines) as known mines */
  function view(g) {
    const n = g.w * g.h;
    const v = { w: g.w, h: g.h, mines: g.mines, state: new Array(n), num: new Array(n).fill(0) };
    for (let i = 0; i < n; ++i) {
      v.state[i] = g.open[i] ? 1 : g.flag[i] === 1 || g.defused[i] ? 2 : 0;
      if (g.open[i]) v.num[i] = g.num[i];
    }
    return v;
  }

  /* closed cells that touch an open one */
  function frontier(g) {
    const nb = B.neighbours(g.w, g.h);
    const out = [];
    for (let i = 0; i < g.w * g.h; ++i) {
      if (g.open[i] || g.defused[i]) continue;
      for (const j of nb[i]) if (g.open[j]) { out.push(i); break; }
    }
    return out;
  }

  /* ---- powers ---- */
  function scan(g) {
    if (g.state !== 'play') return -1;
    let list = frontier(g).filter(i => !g.mine[i] && g.flag[i] !== 1);
    if (!list.length) for (let i = 0; i < g.w * g.h; ++i) if (!g.open[i] && !g.mine[i]) list.push(i);
    if (!list.length) return -1;
    const i = list[Math.floor(rand(g) * list.length)];
    g.flag[i] = 0;
    flood(g, i);
    checkWin(g);
    return i;
  }

  function sonar(g) {
    if (g.state !== 'play') return -1;
    let list = frontier(g).filter(i => g.mine[i] && g.flag[i] !== 1);
    if (!list.length) for (let i = 0; i < g.w * g.h; ++i) if (g.mine[i] && g.flag[i] !== 1 && !g.defused[i]) list.push(i);
    if (!list.length) return -1;
    const i = list[Math.floor(rand(g) * list.length)];
    g.flag[i] = 1;
    g.events.push({ type: 'flag', i: i, f: 1, sonar: true });
    return i;
  }

  /* lights a 3 x 3 around i (centred on the frontier when i is -1) */
  function lantern(g, i) {
    if (g.state !== 'play') return -1;
    if (i < 0) {
      const f = frontier(g);
      i = f.length ? f[Math.floor(rand(g) * f.length)] : Math.floor(rand(g) * g.w * g.h);
    }
    const cells = [i].concat(B.neighbours(g.w, g.h)[i]);
    for (const k of cells) {
      if (g.mine[k]) { if (g.flag[k] !== 1 && !g.defused[k]) { g.flag[k] = 1; g.events.push({ type: 'flag', i: k, f: 1, lantern: true }); } }
      else if (!g.open[k]) { g.flag[k] = 0; flood(g, k); }
    }
    checkWin(g);
    return i;
  }

  /* ---- guardians ---- */
  /* closes up to n open number cells again (never the last way into a region); -> cells */
  function rebury(g, n) {
    if (g.state !== 'play') return [];
    const list = [];
    for (let i = 0; i < g.w * g.h; ++i) if (g.open[i] && g.num[i] > 0) list.push(i);
    const out = [];
    for (let k = 0; k < n && list.length; ++k) {
      const j = Math.floor(rand(g) * list.length);
      const i = list.splice(j, 1)[0];
      g.open[i] = 0;
      g.buried[i] = 1;
      --g.opened;
      out.push(i);
    }
    if (out.length) g.events.push({ type: 'bury', cells: out });
    return out;
  }

  /* knocks up to n flags off (right or wrong ones); -> cells */
  function unflag(g, n) {
    if (g.state !== 'play') return [];
    const list = [];
    for (let i = 0; i < g.w * g.h; ++i) if (g.flag[i] === 1 && !g.defused[i]) list.push(i);
    const out = [];
    for (let k = 0; k < n && list.length; ++k) {
      const i = list.splice(Math.floor(rand(g) * list.length), 1)[0];
      g.flag[i] = 0;
      out.push(i);
    }
    if (out.length) g.events.push({ type: 'unflag', cells: out });
    return out;
  }

  /* hides the numbers in a size x size patch for t seconds; -> the patch */
  function fog(g, size, t) {
    const s = Math.min(size, g.w, g.h);
    const x = Math.floor(rand(g) * (g.w - s + 1)), y = Math.floor(rand(g) * (g.h - s + 1));
    const p = { x: x, y: y, w: s, h: s, t: t, max: t };
    g.fog.push(p);
    g.events.push({ type: 'fog', patch: p });
    return p;
  }

  function fogged(g, i) {
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const p of g.fog) if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return true;
    return false;
  }

  function takeEvents(g) {
    const e = g.events;
    g.events = [];
    return e;
  }

  Object.assign(NS.engine, {
    rand, create, safeCount, playing, placeBoard, flood, reveal, toggleFlag, setFlag, chord, step, flagsLeft, view, frontier,
    scan, sonar, lantern, rebury, unflag, fog, fogged, takeEvents,
  });
})();
