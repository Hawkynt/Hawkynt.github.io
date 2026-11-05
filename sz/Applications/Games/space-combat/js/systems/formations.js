/* Arcade formations, pure and seeded: how a group of one enemy type enters the play field (rows
   and V shapes dropping in from the top, sweeps curling in from a side, diving pairs, swarmer
   columns, heavy ships sliding into station, cloakers slipping in from the flanks). Each entry
   is a timed quadratic path from off-screen to a hover slot in the upper band, or a lane for
   ships that never hover. Never touches the DOM or G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  /* hover slots live in this band; the player owns everything below PLAYER_TOP */
  const SLOT_TOP = 70, SLOT_BOTTOM = 260;

  /* the formations a type may fly, first is the most common */
  const BY_TYPE = {
    fighter: ['row', 'vee', 'sweep'],
    interceptor: ['dive'],
    drone: ['column'],
    bomber: ['single', 'row'],
    frigate: ['single'],
    cloaker: ['flank'],
    lancer: ['single'],
    carrier: ['single'],
    station: ['single'],
    turret: ['single'],
  };

  function pick(type, rng) {
    const list = BY_TYPE[type] || ['single'];
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function clampX(x, r, W) {
    return Math.max(r + 12, Math.min(W - r - 12, x));
  }

  /* `count` evenly spread x positions across the usable width, centred on `cx` when they fit */
  function spread(count, r, W, cx, gap) {
    const step = Math.min(gap, (W - 2 * (r + 16)) / Math.max(1, count - 1));
    const w = step * (count - 1);
    const left = Math.max(r + 16, Math.min(W - r - 16 - w, cx - w / 2));
    const out = [];
    for (let i = 0; i < count; ++i) out.push(count === 1 ? clampX(cx, r, W) : left + i * step);
    return out;
  }

  function entry(delay, x0, y0, cx, cy, x1, y1, dur, hold) {
    return { delay: delay, x0: x0, y0: y0, cx: cx, cy: cy, x1: x1, y1: y1, dur: dur, hold: hold, lane: x1, amp: 0 };
  }

  /* The entries for `count` ships of radius `r` flying formation `kind` in a W x H field */
  function plan(kind, count, r, rng, W, H) {
    const out = [];
    const band = (lo, hi) => SLOT_TOP + (SLOT_BOTTOM - SLOT_TOP) * (lo + (hi - lo) * rng());
    switch (kind) {
      case 'row': {
        /* more than seven become two staggered rows */
        const perRow = Math.min(count, 7);
        const y = band(0.1, 0.7);
        for (let i = 0; i < count; ++i) {
          const row = Math.floor(i / perRow), n = Math.min(perRow, count - row * perRow);
          const xs = spread(n, r, W, W / 2 + (row ? 30 : 0), 84);
          const x = xs[i % perRow];
          const y1 = Math.min(SLOT_BOTTOM, y + row * 56);
          const mid = Math.abs(i % perRow - (n - 1) / 2);
          out.push(entry(mid * 0.1 + row * 0.5, x, -r - 30, x, y1 - 160, x, y1, 1.4, true));
        }
        break;
      }
      case 'vee': {
        const ax = clampX(W * (0.3 + rng() * 0.4), r + 120, W), ay = band(0.5, 1);
        for (let i = 0; i < count; ++i) {
          const rank = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
          const x = clampX(ax + side * rank * 58, r, W), y = Math.max(SLOT_TOP, ay - rank * 36);
          out.push(entry(rank * 0.16, x + side * 40, -r - 30, x + side * 90, y - 120, x, y, 1.5, true));
        }
        break;
      }
      case 'sweep': {
        /* in a line from one side, curling down then up into a row */
        const left = rng() < 0.5;
        const y0 = band(0, 0.6);
        const xs = spread(count, r, W, W / 2, 76);
        for (let i = 0; i < count; ++i) {
          const x = left ? xs[count - 1 - i] : xs[i];
          const sx = left ? -r - 40 : W + r + 40;
          out.push(entry(i * 0.2, sx, y0, W / 2, y0 + 260, x, band(0.15, 0.55), 2.1, true));
        }
        break;
      }
      case 'dive': {
        /* pairs drop from the top corners and go straight into their attack run */
        for (let i = 0; i < count; ++i) {
          const side = i % 2 ? 1 : -1;
          const x = W / 2 + side * W * (0.3 + rng() * 0.15);
          out.push(entry(Math.floor(i / 2) * 0.55 + (i % 2) * 0.15, x, -r - 30, x, 20, clampX(x - side * 60, r, W), 70, 0.7, false));
        }
        break;
      }
      case 'column': {
        /* a snake of swarmers weaving down one lane */
        const lane = W * (0.2 + rng() * 0.6), amp = (50 + rng() * 90) * (rng() < 0.5 ? -1 : 1);
        for (let i = 0; i < count; ++i) {
          const e = entry(i * 0.24, lane, -r - 20, lane, -r, lane, 0, 0.01, false);
          e.lane = lane;
          e.amp = amp;
          out.push(e);
        }
        break;
      }
      case 'flank': {
        for (let i = 0; i < count; ++i) {
          const left = (i + Math.floor(rng() * 2)) % 2 === 0;
          const y = 220 + rng() * 220;
          const x1 = left ? W * 0.18 : W * 0.82;
          out.push(entry(i * 0.7, left ? -r - 40 : W + r + 40, y, (left ? 0 : W) + (left ? 80 : -80), y - 80, x1, band(0.5, 1), 1.8, false));
        }
        break;
      }
      default: {
        /* heavy ships slide down into distinct stations */
        const xs = spread(count, r, W, W * (0.35 + rng() * 0.3), Math.max(150, r * 2 + 50));
        for (let i = 0; i < count; ++i) {
          const y1 = band(0.05, 0.5);
          out.push(entry(i * 0.8, xs[i], -r - 40, xs[i], y1 - 80, xs[i], y1, 2.4, true));
        }
      }
    }
    return out;
  }

  /* Position on an entry path at fraction k in [0, 1] (eased so ships brake into the slot) */
  function pathPoint(en, k, out) {
    const t = k * (2 - k);
    const u = 1 - t;
    out.x = u * u * en.x0 + 2 * u * t * en.cx + t * t * en.x1;
    out.y = u * u * en.y0 + 2 * u * t * en.cy + t * t * en.y1;
    return out;
  }

  Object.assign(NS.formations, {
    SLOT_TOP, SLOT_BOTTOM, BY_TYPE, pick, plan, pathPoint, spread
  });
})();
