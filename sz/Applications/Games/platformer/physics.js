;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Movement and collision for the Platformer. Pure logic, no DOM: the game,
   * the level validator and the reachability bot all run the very same code.
   *
   * World units are pixels, one tile is TS = 48 px, y grows downward. A body
   * is an axis-aligned box { x, y, w, h } (x, y = top-left). The player runs
   * on a fixed step (STEP seconds) so every run is deterministic: coyote time,
   * jump buffering, variable jump height, apex hang, corner correction,
   * wall slide and wall jump, double jump, dash, springs, ice, one-way
   * platforms and moving platforms all live in stepPlayer.
   */

  const TS = 48;
  const STEP = 1 / 120;

  const T = Object.freeze({
    EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3, SPRING: 4, LIQUID: 5, ICE: 6,
    FAKE: 7, QBLOCK: 8, USED: 9, CRATE: 10, CRUMBLE: 11, GATE: 12
  });

  /* which codes stop a body from every side */
  const SOLID = [false, true, false, false, true, false, true, false, true, true, true, true, true];

  const P = Object.freeze({
    gravity: 2500,       // px/s^2 while rising
    fallMul: 1.18,       // heavier on the way down
    apexMul: 0.6,        // gravity near the apex while jump is held
    apexBand: 110,       // |vy| below this counts as the apex
    maxFall: 1000,
    jumpV: 920,          // ~3.5 tiles of height
    cutMul: 0.45,        // releasing jump while rising keeps this much speed
    run: 320,
    accel: 2600, decel: 3000, turn: 4200,
    iceAccel: 650, iceDecel: 360,
    airAccel: 1700, airDecel: 900,
    coyote: 0.1, buffer: 0.13,
    wallSlide: 170, wallJumpVX: 390, wallJumpVY: 860, wallLock: 0.15, wallCoyote: 0.08,
    doubleJumpV: 820,
    dashSpeed: 900, dashTime: 0.15, dashCd: 0.3,
    springV: 1380,
    stompBounce: 700,
    cornerNudge: 12,
    w: 28, h: 42
  });

  function tileAt(level, c, r) {
    if (c < 0 || c >= level.cols)
      return T.SOLID;
    if (r < 0 || r >= level.rows)
      return T.EMPTY;
    return level.tiles[r * level.cols + c];
  }

  function setTile(level, c, r, code) {
    if (c >= 0 && c < level.cols && r >= 0 && r < level.rows)
      level.tiles[r * level.cols + c] = code;
  }

  function isSolid(code) {
    return SOLID[code] === true;
  }

  function solidAt(level, c, r) {
    return SOLID[tileAt(level, c, r)] === true;
  }

  /* ── moving platforms: a pure function of time, ping-pong with eased turns ── */

  function platformPos(def, t, out) {
    const dx = def.x1 - def.x0, dy = def.y1 - def.y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const period = Math.max(0.5, 2 * dist / def.speed);
    const s = (1 - Math.cos((t + (def.phase || 0)) * Math.PI * 2 / period)) / 2;
    out.x = def.x0 + dx * s;
    out.y = def.y0 + dy * s;
    return out;
  }

  /* ── sweeps: one axis at a time, never more than a tile per step ── */

  function sweepX(b, dx, level) {
    b.x += dx;
    const r0 = Math.floor(b.y / TS), r1 = Math.floor((b.y + b.h - 0.01) / TS);
    if (dx > 0) {
      const c = Math.floor((b.x + b.w - 0.01) / TS);
      for (let r = r0; r <= r1; ++r) {
        if (SOLID[tileAt(level, c, r)]) {
          b.x = c * TS - b.w;
          return { side: 1, c: c, r: r };
        }
      }
    } else if (dx < 0) {
      const c = Math.floor(b.x / TS);
      for (let r = r0; r <= r1; ++r) {
        if (SOLID[tileAt(level, c, r)]) {
          b.x = (c + 1) * TS;
          return { side: -1, c: c, r: r };
        }
      }
    }
    return null;
  }

  /* moves vertically; lands on solids, one-way tiles (unless dropping) and the
     tops of moving platforms. Returns { side, c, r, code, platform } or null */
  function sweepY(b, dy, level, platforms, dropping) {
    const prevBottom = b.y + b.h;
    b.y += dy;
    const c0 = Math.floor(b.x / TS), c1 = Math.floor((b.x + b.w - 0.01) / TS);
    if (dy > 0) {
      const r = Math.floor((b.y + b.h - 0.01) / TS);
      let best = null;
      for (let c = c0; c <= c1; ++c) {
        const code = tileAt(level, c, r);
        if (SOLID[code] || (code === T.ONEWAY && !dropping && prevBottom <= r * TS + 0.5)) {
          /* prefer the tile under the body centre so a spring or ice edge counts */
          const centre = Math.floor((b.x + b.w / 2) / TS);
          if (!best || c === centre)
            best = { side: 1, c: c, r: r, code: code, platform: -1 };
        }
      }
      if (best) {
        b.y = r * TS - b.h;
        return best;
      }
      if (platforms) {
        for (let i = 0; i < platforms.length; ++i) {
          const pl = platforms[i];
          if (dropping || b.x + b.w <= pl.x || b.x >= pl.x + pl.w)
            continue;
          if (prevBottom <= Math.max(pl.py, pl.y) + 1 && b.y + b.h >= pl.y) {
            b.y = pl.y - b.h;
            return { side: 1, c: -1, r: -1, code: T.ONEWAY, platform: i };
          }
        }
      }
    } else if (dy < 0) {
      const r = Math.floor(b.y / TS);
      let hit = null;
      const centre = Math.floor((b.x + b.w / 2) / TS);
      for (let c = c0; c <= c1; ++c) {
        if (SOLID[tileAt(level, c, r)]) {
          if (!hit || c === centre)
            hit = { side: -1, c: c, r: r, code: tileAt(level, c, r), platform: -1 };
        }
      }
      if (hit) {
        b.y = (r + 1) * TS;
        return hit;
      }
    }
    return null;
  }

  /* generic body under gravity (enemies, items): returns flags for the caller */
  function moveBody(b, level, dt, gravity, out) {
    out = out || {};
    out.hitX = 0;
    out.landed = false;
    out.hitHead = false;
    if (gravity)
      b.vy = Math.min(P.maxFall, b.vy + gravity * dt);
    const hx = sweepX(b, b.vx * dt, level);
    if (hx)
      out.hitX = hx.side;
    const hy = sweepY(b, b.vy * dt, level, null, false);
    if (hy) {
      if (hy.side > 0) {
        out.landed = true;
        out.code = hy.code;
      } else {
        out.hitHead = true;
      }
      b.vy = 0;
    }
    return out;
  }

  /* is there floor one step ahead of a body walking in direction dir? */
  function groundAhead(b, level, dir) {
    const x = dir > 0 ? b.x + b.w + 2 : b.x - 2;
    const c = Math.floor(x / TS), r = Math.floor((b.y + b.h + 2) / TS);
    const code = tileAt(level, c, r);
    return SOLID[code] || code === T.ONEWAY;
  }

  function wallAhead(b, level, dir) {
    const x = dir > 0 ? b.x + b.w + 1 : b.x - 1;
    const c = Math.floor(x / TS);
    const r0 = Math.floor(b.y / TS), r1 = Math.floor((b.y + b.h - 1) / TS);
    for (let r = r0; r <= r1; ++r)
      if (SOLID[tileAt(level, c, r)])
        return true;
    return false;
  }

  /* hazard boxes: spikes point away from the solid they sit on */
  function spikeOrientation(level, c, r) {
    if (SOLID[tileAt(level, c, r + 1)]) return 'up';
    if (SOLID[tileAt(level, c, r - 1)]) return 'down';
    if (SOLID[tileAt(level, c - 1, r)]) return 'right';
    if (SOLID[tileAt(level, c + 1, r)]) return 'left';
    return 'up';
  }

  function spikeBox(level, c, r, out) {
    const o = spikeOrientation(level, c, r);
    const x = c * TS, y = r * TS;
    if (o === 'up') { out.x = x + 6; out.y = y + 22; out.w = TS - 12; out.h = TS - 22; }
    else if (o === 'down') { out.x = x + 6; out.y = y; out.w = TS - 12; out.h = TS - 22; }
    else if (o === 'right') { out.x = x; out.y = y + 6; out.w = TS - 22; out.h = TS - 12; }
    else { out.x = x + 22; out.y = y + 6; out.w = TS - 22; out.h = TS - 12; }
    return out;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  const tmpBox = { x: 0, y: 0, w: 0, h: 0 };

  /* 'spike' | 'liquid' | 'fall' | null */
  function hazardAt(b, level) {
    if (b.y > level.rows * TS + 24)
      return 'fall';
    const c0 = Math.floor(b.x / TS), c1 = Math.floor((b.x + b.w - 0.01) / TS);
    const r0 = Math.floor(b.y / TS), r1 = Math.floor((b.y + b.h - 0.01) / TS);
    for (let r = r0; r <= r1; ++r) {
      for (let c = c0; c <= c1; ++c) {
        const code = tileAt(level, c, r);
        if (code === T.SPIKE && overlaps(b, spikeBox(level, c, r, tmpBox)))
          return 'spike';
        if (code === T.LIQUID) {
          const top = tileAt(level, c, r - 1) === T.LIQUID ? r * TS : r * TS + 16;
          if (b.y + b.h > top)
            return 'liquid';
        }
      }
    }
    return null;
  }

  /* ── the player ── */

  function createPlayer(x, y) {
    return {
      x: x, y: y, w: P.w, h: P.h, vx: 0, vy: 0,
      onGround: false, ground: T.EMPTY, platform: -1,
      coyote: 0, buffer: 0, jumping: false,
      wall: 0, wallCoyote: 0, wallDir: 0, wallLock: 0,
      airJumps: 0, dashT: 0, dashCd: 0, dashReady: true, dashDir: 1,
      facing: 1, airTime: 0, dropT: 0,
      ev: { jump: false, doubleJump: false, wallJump: false, dash: false, land: 0, spring: null, head: null, crate: null, wallSlide: false }
    };
  }

  function resetEvents(ev) {
    ev.jump = false;
    ev.doubleJump = false;
    ev.wallJump = false;
    ev.dash = false;
    ev.land = 0;
    ev.spring = null;
    ev.head = null;
    ev.crate = null;
    ev.wallSlide = false;
  }

  function approach(v, target, delta) {
    if (v < target)
      return Math.min(target, v + delta);
    return Math.max(target, v - delta);
  }

  /* wall contact beside the body's middle rows: -1 left, 1 right, 0 none */
  function wallContact(p, level) {
    const r0 = Math.floor((p.y + 6) / TS), r1 = Math.floor((p.y + p.h - 8) / TS);
    const cl = Math.floor((p.x - 1) / TS), cr = Math.floor((p.x + p.w + 1) / TS);
    let left = false, right = false;
    for (let r = r0; r <= r1; ++r) {
      const a = tileAt(level, cl, r), b = tileAt(level, cr, r);
      if (SOLID[a] && a !== T.SPRING) left = true;
      if (SOLID[b] && b !== T.SPRING) right = true;
    }
    return right ? 1 : left ? -1 : 0;
  }

  /*
   * One fixed step of player movement.
   *   inp:   { left, right, down, jump (held), jumpPressed, dashPressed }
   *   world: { level, platforms: [{ x, y, w, h, px, py }] } (px/py = last step)
   *   stats: { doubleJump, wallJump, dash (0-2), airControl (0-2) }
   * Fills p.ev with what happened this step.
   */
  function stepPlayer(p, inp, world, stats, dt) {
    const level = world.level;
    const platforms = world.platforms;
    const ev = p.ev;
    resetEvents(ev);
    dt = dt || STEP;

    /* ride the platform we stand on */
    if (p.onGround && p.platform >= 0 && platforms && platforms[p.platform]) {
      const pl = platforms[p.platform];
      sweepX(p, pl.x - pl.px, level);
      p.y = pl.y - p.h;
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir)
      p.facing = dir;

    if (inp.jumpPressed)
      p.buffer = P.buffer;
    else
      p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? P.coyote : Math.max(0, p.coyote - dt);
    p.wallLock = Math.max(0, p.wallLock - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.onGround) {
      p.airJumps = stats.doubleJump ? 1 : 0;
      p.dashReady = true;
      p.airTime = 0;
    } else {
      p.airTime += dt;
    }

    /* wall contact (only in the air) */
    p.wall = p.onGround ? 0 : wallContact(p, level);
    if (p.wall) {
      p.wallCoyote = P.wallCoyote;
      p.wallDir = p.wall;
      if (stats.wallJump)
        p.dashReady = true;
    } else {
      p.wallCoyote = Math.max(0, p.wallCoyote - dt);
    }

    /* dash */
    if (inp.dashPressed && stats.dash > 0 && p.dashReady && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = P.dashTime * (stats.dash > 1 ? 1.35 : 1);
      p.dashReady = false;
      p.dashCd = P.dashCd;
      p.dashDir = dir || p.facing;
      p.facing = p.dashDir;
      p.vx = p.dashDir * P.dashSpeed;
      p.vy = 0;
      p.jumping = false;
      ev.dash = true;
    }

    /* dropping through a one-way floor: hold down and press jump */
    if (p.dropT > 0)
      p.dropT -= dt;
    if (inp.down && inp.jumpPressed && p.onGround && p.ground === T.ONEWAY) {
      p.dropT = 0.22;
      p.onGround = false;
      p.platform = -1;
      p.coyote = 0;
      p.buffer = 0;
      p.y += 2;
    }

    /* jumps: ground (with coyote), wall, then air */
    if (p.buffer > 0 && p.dashT <= 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = -P.jumpV;
        p.onGround = false;
        p.platform = -1;
        p.coyote = 0;
        p.buffer = 0;
        p.jumping = true;
        ev.jump = true;
      } else if (stats.wallJump && (p.wall || p.wallCoyote > 0)) {
        const wd = p.wall || p.wallDir;
        p.vx = -wd * P.wallJumpVX;
        p.vy = -P.wallJumpVY;
        p.facing = -wd;
        p.wallLock = P.wallLock;
        p.wallCoyote = 0;
        p.buffer = 0;
        p.jumping = true;
        ev.wallJump = true;
      } else if (inp.jumpPressed && p.airJumps > 0) {
        --p.airJumps;
        p.vy = -P.doubleJumpV;
        p.buffer = 0;
        p.jumping = true;
        ev.doubleJump = true;
      }
    }
    if (p.jumping && !inp.jump && p.vy < 0) {
      p.vy *= P.cutMul;
      p.jumping = false;
    }
    if (p.vy >= 0)
      p.jumping = false;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vy = 0;
      if (p.dashT <= 0)
        p.vx *= 0.42;
    } else {
      /* horizontal control */
      /* right after a wall jump the push away from the wall wins */
      const want = p.wallLock > 0 ? (Math.sign(p.vx) || dir) : dir;
      const target = want * P.run;
      let acc, dec;
      const ice = p.onGround && p.ground === T.ICE;
      if (p.onGround) {
        acc = ice ? P.iceAccel : P.accel;
        dec = ice ? P.iceDecel : P.decel;
      } else {
        const k = 0.7 + 0.2 * (stats.airControl || 0);
        acc = P.airAccel * k;
        dec = P.airDecel * k;
      }
      if (want) {
        const reversing = p.vx * want < 0;
        const a = reversing && !ice ? (p.onGround ? P.turn : acc * 1.4) : acc;
        if (Math.abs(p.vx) > P.run && p.vx * want > 0)
          p.vx = approach(p.vx, target, dec * 0.5 * dt);
        else
          p.vx = approach(p.vx, target, a * dt);
      } else {
        p.vx = approach(p.vx, 0, dec * dt);
      }

      /* gravity with apex hang and a heavier fall */
      let g = P.gravity;
      if (p.vy > 0)
        g *= P.fallMul;
      else if (inp.jump && Math.abs(p.vy) < P.apexBand)
        g *= P.apexMul;
      p.vy = Math.min(P.maxFall, p.vy + g * dt);

      /* wall slide when pushing into a wall on the way down */
      if (p.wall && dir === p.wall && p.vy > P.wallSlide) {
        p.vy = P.wallSlide;
        ev.wallSlide = true;
      }
    }

    /* move: x first, then y */
    const hx = sweepX(p, p.vx * dt, level);
    if (hx) {
      if (p.dashT > 0 && hx.r >= 0) {
        const code = tileAt(level, hx.c, hx.r);
        if (code === T.CRATE)
          ev.crate = { c: hx.c, r: hx.r };
      }
      p.vx = 0;
    }

    const wasGround = p.onGround;
    const impact = p.vy;
    let hy = sweepY(p, p.vy * dt, level, platforms, p.dropT > 0);
    /* corner correction: a head bump on a tile edge slides around it */
    if (hy && hy.side < 0) {
      const nudged = cornerNudge(p, level);
      if (nudged) {
        hy = sweepY(p, 0, level, platforms, false);
      } else {
        ev.head = { c: hy.c, r: hy.r, code: hy.code };
        p.vy = 0;
        p.jumping = false;
      }
    }
    p.onGround = false;
    if (hy && hy.side > 0) {
      if (hy.code === T.SPRING && impact >= 0) {
        p.vy = -P.springV;
        p.jumping = false;
        ev.spring = { c: hy.c, r: hy.r };
        p.airJumps = stats.doubleJump ? 1 : 0;
        p.dashReady = true;
      } else {
        p.onGround = true;
        p.ground = hy.code;
        p.platform = hy.platform;
        p.vy = 0;
        if (!wasGround)
          ev.land = impact;
      }
    }
    if (!p.onGround)
      p.platform = -1;

    return ev;
  }

  /* slide sideways around a ceiling corner when the overlap is small */
  function cornerNudge(p, level) {
    const r = Math.floor((p.y - 1) / TS);
    const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + p.w - 0.01) / TS);
    if (c0 === c1)
      return false;
    const left = SOLID[tileAt(level, c0, r)], right = SOLID[tileAt(level, c1, r)];
    if (left && !right) {
      const push = (c0 + 1) * TS - p.x;
      if (push <= P.cornerNudge && !SOLID[tileAt(level, c1, Math.floor((p.y + p.h - 1) / TS))]) {
        p.x += push;
        return true;
      }
    } else if (right && !left) {
      const push = p.x + p.w - c1 * TS;
      if (push <= P.cornerNudge && !SOLID[tileAt(level, c0, Math.floor((p.y + p.h - 1) / TS))]) {
        p.x -= push;
        return true;
      }
    }
    return false;
  }

  /* the player's animation pose from its state */
  function poseOf(p) {
    if (p.dashT > 0) return 'dash';
    if (p.onGround) return Math.abs(p.vx) > 30 ? 'run' : 'idle';
    if (p.wall && p.vy > 0 && p.wall === p.facing) return 'wall';
    return p.vy < 0 ? 'jump' : 'fall';
  }

  SZ.PlatformerPhysics = Object.freeze({
    TS, STEP, T, P, SOLID,
    tileAt, setTile, isSolid, solidAt, platformPos,
    sweepX, sweepY, moveBody, groundAhead, wallAhead,
    spikeOrientation, spikeBox, overlaps, hazardAt,
    createPlayer, stepPlayer, poseOf
  });
})();
