/* The runner's movement as a pure step function, shared by the game, the title-screen
   autopilot and the course solver in the tests: running speed, jumps with coyote time, air jumps,
   the jump cut, fast fall, slides that stay down under overhangs, the dash, springs and boost
   pads, landing on ground spans and one-way ledges, flying, gliding and falling into pits; plus
   the hit boxes of every obstacle (most move with the runner's distance, not with time, so every
   course plays the same at any frame rate). Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const { BAR_GAP, BAR_TOP } = NS.items;

  /* input bits for one step */
  const A = { JUMP: 1, SLIDE: 2, DASH: 4, CUT: 8, HOLD_DOWN: 16 };
  /* event bits a step reports in p.ev */
  const E = { JUMP: 1, DJUMP: 2, LAND: 4, SLIDE: 8, DASH: 16, SPRING: 32, BOOST: 64, DROP: 128, EDGE: 256 };

  function newPlayer(x) {
    return {
      x: x, y: C.GROUND_Y, vy: 0, ground: 1, jumps: 0, coyote: 0, slideT: 0, dashT: 0, dashCd: 0, airDash: 0,
      boostT: 0, scale: 1, fly: 0, flyY: 300, glide: 0, invT: 0, ev: 0, lastLand: 0,
    };
  }

  function clonePlayer(p) {
    return {
      x: p.x, y: p.y, vy: p.vy, ground: p.ground, jumps: p.jumps, coyote: p.coyote, slideT: p.slideT, dashT: p.dashT,
      dashCd: p.dashCd, airDash: p.airDash, boostT: p.boostT, scale: p.scale, fly: p.fly, flyY: p.flyY, glide: p.glide,
      invT: p.invT, ev: p.ev, lastLand: p.lastLand,
    };
  }

  /* first index whose left edge is at or after x (arrays sorted by .x) */
  function lowerBound(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].x < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function smooth(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }

  /* index of the last element whose left edge is at or before x, or -1 */
  function lastAtOrBefore(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].x <= x) lo = mid + 1; else hi = mid;
    }
    return lo - 1;
  }

  /* ── surfaces ── */
  function onGroundSpan(course, x0, x1) {
    const g = course.ground;
    for (let i = lastAtOrBefore(g, x1); i >= 0; --i) {
      if (g[i].x + g[i].w >= x0) return true;
      /* spans never overlap: once one ends before x0, all earlier ones do */
      return false;
    }
    return false;
  }

  /* the highest surface crossed between yPrev and yNew under the feet, or -1 */
  function support(course, x, half, yPrev, yNew) {
    const x0 = x - half, x1 = x + half;
    let best = -1;
    if (yPrev <= C.GROUND_Y + 0.5 && yNew >= C.GROUND_Y && onGroundSpan(course, x0, x1)) best = C.GROUND_Y;
    const pl = course.plats;
    for (let i = lastAtOrBefore(pl, x1); i >= 0 && pl[i].x >= x0 - 2400; --i) {
      const q = pl[i];
      if (q.x + q.w < x0) continue;
      if (yPrev <= q.y + 0.5 && yNew >= q.y && (best < 0 || q.y < best)) best = q.y;
    }
    return best;
  }

  /* is the column above x covered by an overhang the slider must stay under? */
  function underBar(course, x, half) {
    const hz = course.hz;
    let i = lowerBound(hz, x - half - 600);
    for (; i < hz.length && hz[i].x <= x + half + 8; ++i) {
      const h = hz[i];
      if (h.kind === 'bar' && !h.dead && h.x + h.w > x - half - 8) return true;
    }
    return false;
  }

  function padAt(course, x) {
    const pads = course.pads;
    let i = lowerBound(pads, x - 200);
    for (; i < pads.length && pads[i].x <= x; ++i)
      if (pads[i].x + pads[i].w >= x) return pads[i];
    return null;
  }

  /* ── hit boxes ── */
  const BOX = { x0: 0, y0: 0, x1: 0, y1: 0 };

  function playerBox(p, out) {
    out = out || {};
    const s = p.scale || 1;
    const w = C.PW * s, h = (p.slideT > 0 ? C.PH_SLIDE : C.PH) * s;
    const k = C.HIT_SHRINK;
    out.x0 = p.x - w / 2 + k;
    out.x1 = p.x + w / 2 - k;
    out.y1 = p.y - 2;
    out.y0 = p.y - h + k;
    return out;
  }

  /* where a moving obstacle is drawn and hits, as the runner at px approaches it; f runs from 1
     (far, at rest) to 0 (arrived). Fills and returns one shared scratch object. */
  const MO = { cx: 0, cy: 0, f: 0 };
  function motion(h, px) {
    const dx = h.x - px;
    let f;
    if (h.kind === 'saw' || h.kind === 'drone') {
      f = smooth((dx - 240) / 520);
      MO.cx = h.x + h.w / 2 - (h.kind === 'drone' ? (h.glide || 0) * (1 - f) : 0);
      MO.cy = h.cyEnd + (h.cyStart - h.cyEnd) * f;
    } else if (h.kind === 'rock') {
      f = smooth((dx - 330) / 380);
      MO.cx = h.x + h.w / 2;
      MO.cy = h.base - (h.base - h.h - h.top) * f - h.h / 2;
    } else {
      f = smooth((dx - 120) / 900);
      MO.cx = h.x + h.w / 2 - (h.roll || 0) * (1 - f);
      MO.cy = h.base - h.h / 2;
    }
    MO.f = f;
    return MO;
  }

  /* the obstacle's hit box with the runner at px, t seconds ahead (projectiles); null if gone */
  function hazardBox(h, px, t, out) {
    out = out || BOX;
    if (h.dead) return null;
    switch (h.kind) {
      case 'bar':
        out.x0 = h.x; out.x1 = h.x + h.w; out.y0 = h.base - BAR_TOP; out.y1 = h.base - BAR_GAP;
        return out;
      case 'spikes':
        out.x0 = h.x + 4; out.x1 = h.x + h.w - 4; out.y0 = h.base - h.h + 8; out.y1 = h.base;
        return out;
      case 'saw': case 'drone': case 'rock': case 'roller': {
        const m = motion(h, px);
        const rw = h.w / 2 - 6, rh = h.h / 2 - 6;
        out.x0 = m.cx - rw; out.x1 = m.cx + rw; out.y0 = m.cy - rh; out.y1 = m.cy + rh;
        return out;
      }
      case 'proj': {
        const x = h.x + h.vx * (t || 0);
        out.x0 = x - h.w / 2 + 4; out.x1 = x + h.w / 2 - 4; out.y0 = h.y - h.h / 2 + 4; out.y1 = h.y + h.h / 2 - 4;
        return out;
      }
      default:
        out.x0 = h.x; out.x1 = h.x + h.w; out.y0 = h.base - h.h; out.y1 = h.base;
        return out;
    }
  }

  function overlap(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }

  const PB = {};

  /* the first obstacle the runner touches that would hurt it; smashables are handed to
     env.onSmash instead while dashing or as a giant */
  function collide(p, env) {
    if (p.invT > 0 || p.fly || env.mods.ghost) return null;
    playerBox(p, PB);
    const course = env.course;
    const hz = course.hz;
    const smashAll = env.mods.giant;
    let i = lowerBound(hz, p.x - 700);
    for (; i < hz.length && hz[i].x <= p.x + 420; ++i) {
      const h = hz[i];
      const b = hazardBox(h, p.x, 0);
      if (!b || !overlap(PB, b)) continue;
      if (smashAll || (p.dashT > 0 && h.smash)) {
        if (env.onSmash) env.onSmash(h); else h.ghostHit = 1;
        continue;
      }
      return h;
    }
    const pr = env.projs;
    if (pr)
      for (let j = 0; j < pr.length; ++j) {
        const b = hazardBox(pr[j], p.x, env.t || 0);
        if (!b || !overlap(PB, b)) continue;
        if (smashAll || p.dashT > 0) { if (env.onSmash) env.onSmash(pr[j]); continue; }
        return pr[j];
      }
    return null;
  }

  function speedOf(p, env) {
    let v = env.speedAt(p.x) * (env.mods.speedMul || 1);
    if (p.dashT > 0) v *= env.mods.dashMul || C.DASH_MUL;
    if (p.boostT > 0) v *= C.BOOST_MUL;
    if (p.fly === 2) v *= 2;
    return v;
  }

  /* One step. Returns 0 (fine), 'fall' (into a pit) or the obstacle that was hit. */
  function step(p, act, env, dt) {
    const m = env.mods;
    const course = env.course;
    const half = C.PW * (p.scale || 1) / 2 - 4;
    p.ev = 0;
    if (p.invT > 0) p.invT -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.boostT > 0) p.boostT -= dt;

    /* flying: ease towards the cruising height, nothing else matters */
    if (p.fly) {
      p.x += speedOf(p, env) * dt;
      p.vy = (p.flyY - p.y) * 5;
      p.y += p.vy * dt;
      p.ground = 0;
      p.slideT = 0;
      p.jumps = 1;
      return 0;
    }

    if ((act & A.DASH) && p.dashCd <= 0 && (p.ground || !p.airDash)) {
      p.dashT = m.dashT || C.DASH_T;
      p.dashCd = m.dashCd || C.DASH_CD;
      if (!p.ground) { p.airDash = 1; p.vy = Math.min(p.vy, 0); }
      p.ev |= E.DASH;
    }
    if (act & A.JUMP) {
      if (p.ground || p.coyote > 0) {
        p.vy = -(m.jumpV || C.JUMP_V);
        p.ground = 0; p.coyote = 0; p.jumps = 1; p.slideT = 0;
        p.ev |= E.JUMP;
      } else if (p.jumps < (m.maxJumps || 2)) {
        p.vy = -(m.jump2V || C.JUMP2_V);
        ++p.jumps;
        p.dashT = 0;
        p.ev |= E.DJUMP;
      }
    }
    if ((act & A.CUT) && p.vy < -C.CUT_V && p.jumps === 1) p.vy = -C.CUT_V;
    if (act & A.SLIDE) {
      if (p.ground) {
        if (p.slideT <= 0) p.ev |= E.SLIDE;
        p.slideT = Math.max(p.slideT, m.slideT || C.SLIDE_T);
      } else if (p.vy < C.DROP_V) {
        p.vy = C.DROP_V;
        p.dashT = 0;
        p.ev |= E.DROP;
      }
    }

    p.x += speedOf(p, env) * dt;
    const yPrev = p.y;
    if (p.dashT > 0) {
      p.dashT -= dt;
      if (!p.ground) p.vy = 0;
    } else {
      p.vy = Math.min(p.vy + C.GRAVITY * (m.grav || 1) * dt, C.MAX_FALL);
      if (p.glide && p.vy > 110) p.vy = 110;
    }
    p.y += p.vy * dt;

    const wasGround = p.ground;
    if (p.vy >= 0) {
      const s = support(course, p.x, half, yPrev, p.y);
      if (s >= 0) {
        p.y = s;
        p.vy = 0;
        if (!wasGround) { p.ev |= E.LAND; p.lastLand = p.x; }
        p.ground = 1; p.jumps = 0; p.airDash = 0; p.glide = 0;
        if (act & A.HOLD_DOWN && p.slideT <= 0) { p.slideT = m.slideT || C.SLIDE_T; p.ev |= E.SLIDE; }
      } else {
        if (wasGround) { p.coyote = C.COYOTE; p.ev |= E.EDGE; }
        p.ground = 0;
      }
    } else
      p.ground = 0;
    if (!p.ground) {
      if (p.coyote > 0) {
        p.coyote -= dt;
        if (p.coyote <= 0 && p.jumps === 0) p.jumps = 1;
      }
      p.slideT = 0;
    } else if (p.slideT > 0) {
      p.slideT -= dt;
      if (p.slideT <= 0 && underBar(course, p.x, half)) p.slideT = 0.05;
    }

    if (p.ground) {
      const pad = course.pads.length ? padAt(course, p.x) : null;
      if (pad) {
        if (pad.kind === 'spring') {
          p.vy = -C.SPRING_V;
          p.ground = 0; p.jumps = 1; p.slideT = 0;
          p.ev |= E.SPRING;
        } else if (p.boostT <= 0) {
          p.boostT = C.BOOST_T;
          p.ev |= E.BOOST;
        }
      }
    }

    if (p.y > C.FALL_Y) return 'fall';
    return collide(p, env) || 0;
  }

  Object.assign(NS.physics, {
    A, E, newPlayer, clonePlayer, lowerBound, lastAtOrBefore, smooth, support, onGroundSpan, underBar, padAt, playerBox, motion,
    hazardBox, overlap, collide, speedOf, step
  });
})();
