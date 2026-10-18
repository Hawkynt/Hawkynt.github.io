'use strict';

/*
 * Reachability bot for Platformer levels. It drives the game's own
 * stepPlayer with held inputs (run left / stand / run right, with and without
 * jump, and dashes when the move set has them), each held for a few fixed
 * steps, and runs a best-first search toward a target box. States are
 * deduplicated on a coarse grid of position, velocity and jump resources, so
 * the bot proves a route exists without exploring every frame. Enemies are
 * ignored (they can be stomped or dodged); spikes, liquid and pits end a branch.
 *
 *   const solver = require('./solver.js');
 *   const r = solver.reach(level, { x, y, w, h }, stats, { maxNodes });
 *   r.ok, r.time (seconds of play along the found route), r.nodes
 *
 * A target may carry test(player, events) to replace the plain overlap, e.g.
 * "the head hit this block" or "standing here"; its box still steers the search.
 */

global.window = global.window || {};
require('../js/logic/physics.js');
const Ph = window.SZ.PlatformerPhysics;
const TS = Ph.TS;
const HOLD = 12;

function cloneState(p) {
  const q = Ph.createPlayer(p.x, p.y);
  for (const k of Object.keys(p))
    if (k !== 'ev')
      q[k] = p[k];
  return q;
}

function makeHeap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(item) {
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const j = (i - 1) >> 1;
        if (a[j].f <= a[i].f) break;
        const t = a[i]; a[i] = a[j]; a[j] = t;
        i = j;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          const t = a[i]; a[i] = a[m]; a[m] = t;
          i = m;
        }
      }
      return top;
    }
  };
}

function solidLevel(level, opts) {
  /* crates break from below and from dashes: count them as open when asked */
  if (!opts || !opts.openCrates)
    return level;
  const tiles = new Uint8Array(level.tiles);
  for (let i = 0; i < tiles.length; ++i)
    if (tiles[i] === Ph.T.CRATE)
      tiles[i] = Ph.T.EMPTY;
  return Object.assign({}, level, { tiles: tiles });
}

function reach(levelIn, target, stats, opts) {
  opts = opts || {};
  const level = solidLevel(levelIn, opts);
  const maxNodes = opts.maxNodes || 400000;
  const start = Ph.createPlayer(level.start.c * TS + (TS - Ph.P.w) / 2, (level.start.r + 1) * TS - Ph.P.h);
  start.t = 0;
  start.jumpHeld = false;
  const defs = level.platforms || [];
  const plats = defs.map(() => ({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 }));
  const tmp = { x: 0, y: 0 };
  function placePlatforms(t) {
    for (let i = 0; i < defs.length; ++i) {
      const d = defs[i], pl = plats[i];
      Ph.platformPos(d, t - Ph.STEP, tmp);
      pl.px = tmp.x;
      pl.py = tmp.y;
      Ph.platformPos(d, t, tmp);
      pl.x = tmp.x;
      pl.y = tmp.y;
      pl.w = d.w;
      pl.h = d.h;
    }
  }
  /* the phase of every platform close by, in twelfths of its period */
  function platformPhase(p) {
    let out = '';
    for (const d of defs) {
      const x0 = Math.min(d.x0, d.x1) - 5 * TS, x1 = Math.max(d.x0, d.x1) + d.w + 5 * TS;
      const y0 = Math.min(d.y0, d.y1) - 6 * TS, y1 = Math.max(d.y0, d.y1) + 6 * TS;
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) {
        const dx = d.x1 - d.x0, dy = d.y1 - d.y0;
        const period = Math.max(0.5, 2 * Math.sqrt(dx * dx + dy * dy) / d.speed);
        const ph = ((p.t + (d.phase || 0)) % period) / period;
        out += '@' + Math.floor(ph * 8);
      }
    }
    return out;
  }
  const world = { level: level, platforms: plats };
  const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
  function hits(p, ev) {
    if (target.test)
      return target.test(p, ev);
    return p.x < target.x + target.w && p.x + p.w > target.x && p.y < target.y + target.h && p.y + p.h > target.y;
  }
  function key(p) {
    /* fine on the ground, coarser in the air where states are plentiful */
    const g = p.onGround;
    let k = (g ? Math.round(p.x / 8) + ',' + Math.round(p.y / 8) + ',' + Math.round(p.vx / 160) + ',0'
      : Math.round(p.x / 10) + ',' + Math.round(p.y / 10) + ',' + Math.round(p.vx / 110) + ',' + Math.round(p.vy / 220))
      + (g ? 'g' : 'a') + p.airJumps + (p.dashReady ? 'd' : '') + (p.jumpHeld ? 'j' : '') + (p.dashT > 0 ? 'D' : '');
    if (defs.length)
      k += platformPhase(p);
    return k;
  }
  const actions = [];
  for (const dir of [-1, 0, 1])
    for (const jump of [false, true])
      actions.push({ dir: dir, jump: jump, dash: false });
  if (stats.dash > 0) {
    actions.push({ dir: 1, jump: false, dash: true });
    actions.push({ dir: -1, jump: false, dash: true });
    actions.push({ dir: 1, jump: true, dash: true });
  }
  /* standing still long enough to reach the next platform phase bucket */
  let shortest = 1e9;
  for (const d of defs) {
    const dx = d.x1 - d.x0, dy = d.y1 - d.y0;
    shortest = Math.min(shortest, Math.max(0.5, 2 * Math.sqrt(dx * dx + dy * dy) / d.speed));
  }
  const WAIT = { dir: 0, jump: false, dash: false, steps: Math.max(HOLD, Math.round(shortest / 8 / Ph.STEP)), wait: true };
  const seen = new Set();
  const heap = makeHeap();
  function h(p) {
    const dx = (p.x + p.w / 2) - tx, dy = (p.y + p.h / 2) - ty;
    return Math.sqrt(dx * dx + dy * dy) / Ph.P.run;
  }
  heap.push({ p: start, f: h(start) });
  seen.add(key(start));
  let nodes = 0, maxX = 0;
  const inp = { left: false, right: false, down: false, jump: false, jumpPressed: false, dashPressed: false };
  while (heap.size && nodes < maxNodes) {
    const cur = heap.pop().p;
    ++nodes;
    if (cur.x > maxX)
      maxX = cur.x;
    const list = defs.length && cur.onGround && platformPhase(cur) ? actions.concat([WAIT]) : actions;
    for (const a of list) {
      const p = cloneState(cur);
      let dead = false, won = false;
      const steps = a.steps || HOLD;
      for (let s = 0; s < steps; ++s) {
        inp.left = a.dir < 0;
        inp.right = a.dir > 0;
        inp.jump = a.jump;
        inp.jumpPressed = a.jump && !p.jumpHeld;
        inp.dashPressed = a.dash && s === 0;
        p.jumpHeld = a.jump;
        p.t += Ph.STEP;
        if (defs.length)
          placePlatforms(p.t);
        const ev = Ph.stepPlayer(p, inp, world, stats, Ph.STEP);
        if (Ph.hazardAt(p, level)) {
          dead = true;
          break;
        }
        if (hits(p, ev)) {
          won = true;
          break;
        }
      }
      if (won)
        return { ok: true, time: p.t, nodes: nodes, maxX: maxX };
      if (dead)
        continue;
      const k = key(p);
      if (seen.has(k))
        continue;
      seen.add(k);
      /* greedy toward the target with a little weight on time spent */
      heap.push({ p: p, f: h(p) + p.t * 0.15 });
    }
  }
  return { ok: false, time: 0, nodes: nodes, maxX: maxX };
}

const BASE = { doubleJump: false, wallJump: false, dash: 0, airControl: 0 };
const FULL = { doubleJump: true, wallJump: true, dash: 2, airControl: 2 };

function goalBox(level) {
  return { x: level.goal.c * TS + 8, y: (level.goal.r - 1) * TS, w: TS - 16, h: TS * 2 };
}

function gemBox(g) {
  return { x: g.c * TS + 10, y: g.r * TS + 10, w: TS - 20, h: TS - 20 };
}

/* the hero's head bumps the block at c, r from below */
function bumpBox(c, r) {
  return { x: c * TS, y: (r + 1) * TS, w: TS, h: TS, test: (p, ev) => !!ev.head && ev.head.c === c && ev.head.r === r };
}

/* the hero stands on top of the block at c, r */
function standBox(c, r) {
  return { x: c * TS, y: r * TS - Ph.P.h, w: TS, h: Ph.P.h,
    test: p => p.onGround && p.ground === Ph.T.QBLOCK && Math.abs(p.y + p.h - r * TS) < 0.5 && p.x + p.w > c * TS + 4 && p.x < (c + 1) * TS - 4 };
}

module.exports = { reach, BASE, FULL, goalBox, gemBox, bumpBox, standBox };
