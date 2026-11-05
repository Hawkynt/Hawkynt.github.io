/* The player: the stage-start loadout from perks, smooth grid movement with lane assist around
   corners, ice slides, belt pushes and teleport pads, kicking and throwing bombs, the bomb,
   detonate, Mega Bomb and dash intents, curses, the cosmetic trail, getting hurt (shield,
   Phoenix, Zen bumps), dying and respawning. Mutates G.run.player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, T_ICE, T_TELE, T_BELT_U, T_BELT_D, T_BELT_L, T_BELT_R, DIRS } = C;
  const { TRAILS } = NS.meta;
  const A = NS.arena;
  const fx = NS.fx;

  const BELT = {};
  BELT[T_BELT_D] = 0; BELT[T_BELT_U] = 1; BELT[T_BELT_L] = 2; BELT[T_BELT_R] = 3;
  const TRAIL_KIND = { sparks: 1, stars: 6, hearts: 0, snow: 0, petals: 5, bubbles: 0, leaves: 5, confetti: 4 };

  /* A fresh player at the level spawn with the perk loadout; mods are the daily modifiers */
  function create(spawnIdx, mods) {
    const P = G.perks;
    const has = id => mods && mods.indexOf(id) >= 0;
    return {
      x: spawnIdx % COLS, y: (spawnIdx / COLS) | 0, dir: 0, moving: false, walkT: 0, squash: 1,
      bombs: P.bombs + (has('bombs') ? 2 : 0), fire: P.fire + (has('bigfire') ? 2 : 0), speed: P.speed,
      kick: P.kick || has('bombs'), glove: P.glove, remote: P.remote, pierce: false, wallpass: false, bombpass: false,
      shield: P.shield ? 1 : 0, magnetT: 0, curse: '', curseT: 0, curseDropT: 0,
      inv: 1.2, dead: false, deadT: 0, dashT: 0, dashCd: 0, slide: -1, teleCd: 0, mega: 0, onBomb: [], trailT: 0, bump: 0
    };
  }

  /* Carries the power-ups from one stage to the next (story keeps what you found in a world) */
  function carry(old, spawnIdx, mods) {
    const p = create(spawnIdx, mods);
    if (!old) return p;
    p.bombs = Math.max(p.bombs, old.bombs);
    p.fire = Math.max(p.fire, old.fire);
    p.speed = Math.max(p.speed, old.speed);
    for (const k of ['kick', 'glove', 'remote', 'pierce', 'bombpass']) p[k] = p[k] || old[k];
    p.mega = old.mega;
    return p;
  }

  function speedOf(p) {
    let s = Math.min(C.SPEED_MAX, C.SPEED_BASE + p.speed * C.SPEED_STEP);
    if (p.curse === 'slow') s *= 0.45;
    return s;
  }

  /* Moves along one axis with lane alignment; returns the distance actually travelled */
  function moveAxis(p, dx, dy, dist) {
    const horizontal = dx !== 0;
    const along = horizontal ? p.x : p.y;
    const across = horizontal ? p.y : p.x;
    const lane = Math.round(across);
    const off = across - lane;
    const cc = Math.round(along);
    const s = horizontal ? dx : dy;
    const can = (a, l) => horizontal ? A.playerCan(a, l, p) : A.playerCan(l, a, p);
    const aheadFree = can(cc + s, lane);
    const beforeCentre = s > 0 ? along < cc - 0.001 : along > cc + 0.001;
    let moved = 0;
    if (Math.abs(off) > 0.001) {
      if (aheadFree || beforeCentre) {
        const step = Math.min(Math.abs(off), dist);
        setAcross(p, horizontal, across - Math.sign(off) * step);
        dist -= step;
        moved += step;
      } else {
        /* corner assist: slip toward the neighbouring lane if that way is open */
        const other = lane + Math.sign(off);
        if (can(cc + s, other) && can(cc, other)) {
          const step = Math.min(1 - Math.abs(off), dist);
          setAcross(p, horizontal, across + Math.sign(off) * step);
          return moved + step;
        }
        return moved;
      }
    } else if (!aheadFree && !beforeCentre) {
      /* aligned but blocked: lane assist toward an open neighbouring lane when close to it */
      return moved;
    }
    if (dist <= 0) return moved;
    let next;
    if (aheadFree) next = along + s * dist;
    else next = s > 0 ? Math.min(cc, along + dist) : Math.max(cc, along - dist);
    moved += Math.abs(next - along);
    if (horizontal) p.x = next; else p.y = next;
    return moved;
  }

  function setAcross(p, horizontal, v) {
    if (horizontal) p.y = v; else p.x = v;
  }

  function tryKick(p, d) {
    if (!p.kick) return false;
    const c = Math.round(p.x), r = Math.round(p.y);
    const along = d < 2 ? p.y : p.x;
    const cc = d < 2 ? r : c;
    if (Math.abs(along - cc) > 0.12) return false;
    if (Math.abs((d < 2 ? p.x : p.y) - (d < 2 ? c : r)) > 0.15) return false;
    const b = A.bombAtCell(c + DIRS[d][0], r + DIRS[d][1]);
    if (!b || p.onBomb.indexOf(b.id) >= 0 || b.vx || b.vy) return false;
    if (NS.bombs.kick(b, d)) {
      NS.tracker.stat('kicks', 1);
      NS.tracker.stat('moves', 1);
      p.squash = 0.7;
      return true;
    }
    return false;
  }

  /* Bomb key: throw the bomb under your feet with the glove, else drop a bomb */
  function bombKey(p) {
    const c = Math.round(p.x), r = Math.round(p.y);
    const under = A.bombAtCell(c, r);
    if (under && p.glove && under.owner === 'p') {
      NS.bombs.throwBomb(under, p.dir);
      NS.tracker.stat('throws', 1);
      NS.tracker.stat('moves', 1);
      p.squash = 0.6;
      return;
    }
    NS.bombs.placePlayer();
  }

  function update(dt) {
    const run = G.run, p = run.player, inp = G.input;
    p.squash += (1 - p.squash) * Math.min(1, dt * 9);
    if (p.dead) {
      p.deadT += dt;
      if (p.deadT > 1.7) respawnOrEnd();
      return;
    }
    if (p.inv > 0) p.inv -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.teleCd > 0) p.teleCd -= dt;
    if (p.magnetT > 0) p.magnetT -= dt;
    if (p.curseT > 0) {
      p.curseT -= dt;
      if (p.curseT <= 0) p.curse = '';
    }
    if (run.phase !== 'play') { p.moving = false; return; }

    /* intents queued by input */
    if (inp.bombQ) { inp.bombQ = false; bombKey(p); }
    if (inp.detonateQ) { inp.detonateQ = false; NS.bombs.detonateRemote(); }
    if (inp.megaQ) { inp.megaQ = false; NS.bombs.placeMega(); }
    if (inp.dashQ) {
      inp.dashQ = false;
      if (G.perks.dash && p.dashCd <= 0) {
        p.dashT = C.DASH_TIME;
        p.dashCd = G.perks.dashCd;
        fx.sfx('whoosh', { pitch: 1.3 });
        fx.ring(fx.px(p.x), fx.py(p.y), 6, 30, 0.25, '#bff4ff', 3);
      }
    }
    if (p.curse === 'drop') {
      p.curseDropT -= dt;
      if (p.curseDropT <= 0) { p.curseDropT = 0.7; NS.bombs.placePlayer(); }
    }

    let mx = inp.moveX, my = inp.moveY;
    if (p.curse === 'reverse') { mx = -mx; my = -my; }
    if (mx && my) {
      /* both axes held: turn toward the axis we are not moving on */
      if (p.dir >= 2) mx = 0; else my = 0;
    }
    const c = Math.round(p.x), r = Math.round(p.y);
    const tile = A.tileAt(c, r);
    let d = -1;
    if (mx) d = mx > 0 ? 3 : 2;
    else if (my) d = my > 0 ? 0 : 1;
    let speed = speedOf(p);
    if (p.dashT > 0) {
      p.dashT -= dt;
      speed = C.DASH_SPEED;
      if (d < 0) d = p.dir;
      if (G.time % 0.04 < dt) fx.trail(fx.px(p.x), fx.py(p.y), '#bff4ff', 0);
    }
    /* ice: a slide keeps going until something stops it */
    if (p.slide >= 0) {
      const centred = Math.abs(p.x - c) < 0.05 && Math.abs(p.y - r) < 0.05;
      if (tile !== T_ICE && centred) { p.slide = -1; p.x = c; p.y = r; }
      else {
        /* a slide can be steered sideways when crossing a cell centre, never reversed */
        const along = p.slide < 2 ? p.y - r : p.x - c;
        const turn = d >= 0 && (d < 2) !== (p.slide < 2);
        if (turn && Math.abs(along) < speed * dt + 0.02 && A.playerCan(c + DIRS[d][0], r + DIRS[d][1], p)) {
          p.x = c; p.y = r;
          p.slide = d;
        } else d = p.slide;
      }
    }
    p.moving = false;
    if (d >= 0) {
      p.dir = d;
      const want = speed * dt;
      const moved = moveAxis(p, DIRS[d][0], DIRS[d][1], want);
      if (moved > 0.0005) {
        p.moving = true;
        p.walkT += moved;
      } else {
        if (p.slide >= 0) { p.slide = -1; p.squash = 0.7; fx.sfx('thud', { volume: 0.3 }); }
        tryKick(p, d);
      }
      if (tile === T_ICE && p.moving && p.slide < 0 && p.dashT <= 0) p.slide = d;
    }
    /* belts carry a resting player */
    const b = BELT[tile];
    if (b !== undefined && p.slide < 0) moveAxis(p, DIRS[b][0], DIRS[b][1], 2.2 * dt);
    /* teleport pads */
    const nc = Math.round(p.x), nr = Math.round(p.y);
    if (A.tileAt(nc, nr) === T_TELE && p.teleCd <= 0 && Math.abs(p.x - nc) < 0.2 && Math.abs(p.y - nr) < 0.2) {
      const to = G.lvl.teleTo[A.idx(nc, nr)];
      if (to !== undefined) {
        fx.burst(fx.px(p.x), fx.py(p.y), 20, '#7ef9ff', 200, 0.5, 6, true);
        p.x = to % COLS; p.y = (to / COLS) | 0;
        p.teleCd = 0.8;
        p.slide = -1;
        p.squash = 0.4;
        fx.burst(fx.px(p.x), fx.py(p.y), 20, '#ff4fd8', 200, 0.5, 6, true);
        fx.ring(fx.px(p.x), fx.py(p.y), 4, 50, 0.35, '#7ef9ff', 4);
        fx.sfx('zap', { pitch: 1.5 });
      }
    } else if (A.tileAt(nc, nr) !== T_TELE && p.teleCd > 0.3) p.teleCd = 0.3;
    /* leave bombs we were standing on */
    for (let k = p.onBomb.length - 1; k >= 0; --k) {
      const bb = NS.bombs.bombById(p.onBomb[k]);
      if (!bb || Math.abs(bb.x - p.x) >= 0.8 || Math.abs(bb.y - p.y) >= 0.8) p.onBomb.splice(k, 1);
    }
    /* cosmetic trail */
    const trail = G.save.equip.trail;
    if (trail !== 'none' && p.moving) {
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.06;
        const def = TRAILS.find(t => t.id === trail);
        if (def) fx.trail(fx.px(p.x), fx.py(p.y) + 10, def.color, TRAIL_KIND[trail] || 0);
      }
    }
  }

  /* Fire or an enemy touched the player */
  function hurt(cause) {
    const run = G.run, p = run.player;
    if (p.dead || p.inv > 0 || p.dashT > 0 || run.phase !== 'play') return false;
    if (run.mode === 'zen') {
      /* Zen never kills: a gentle bump and a moment of grace */
      p.inv = 1.2;
      p.squash = 0.5;
      fx.text(p.x, p.y, 'oops', '#bff4ff', 14);
      fx.sfx('bounce', { volume: 0.4 });
      return false;
    }
    run.hurt = true;
    if (p.shield) {
      p.shield = 0;
      p.inv = 1.3;
      fx.burst(fx.px(p.x), fx.py(p.y), 26, '#8fe8ff', 260, 0.6, 6, true);
      fx.ring(fx.px(p.x), fx.py(p.y), 10, 70, 0.4, '#8fe8ff', 5);
      fx.sfx('hit', { pitch: 1.4 });
      fx.hitstop(0.08);
      return false;
    }
    if (G.perks.phoenix && !run.phoenixUsed) {
      run.phoenixUsed = true;
      p.inv = 3;
      fx.banner('PHOENIX!', 'risen from the ashes', '#ff8a3c', 1.6);
      fx.burst(fx.px(p.x), fx.py(p.y), 40, '#ff8a3c', 320, 0.9, 1, true);
      fx.flash('#ffb060', 0.5);
      fx.sfx('powerup', { pitch: 0.7 });
      fx.hitstop(0.15);
      return false;
    }
    p.dead = true;
    p.deadT = 0;
    p.moving = false;
    --run.lives;
    NS.tracker.stat('deaths', 1);
    run.combo = 0;
    fx.burst(fx.px(p.x), fx.py(p.y), 36, '#ffffff', 300, 0.8, 6, true);
    fx.flash('#ff4040', 0.35);
    fx.shake(12);
    fx.hitstop(0.22);
    fx.sfx('hurt');
    fx.sfx('lose', { volume: 0.5 });
    return true;
  }

  function respawnOrEnd() {
    const run = G.run, p = run.player;
    if (run.lives <= 0) {
      NS.run.gameOver();
      return;
    }
    const s = run.level.spawn;
    p.x = s % COLS; p.y = (s / COLS) | 0;
    p.dead = false;
    p.deadT = 0;
    p.inv = G.perks.inv;
    p.curse = '';
    p.curseT = 0;
    p.magnetT = 0;
    p.slide = -1;
    p.onBomb.length = 0;
    p.squash = 0.4;
    /* losing a life costs one power-up level */
    if (p.fire > G.perks.fire) --p.fire;
    else if (p.bombs > G.perks.bombs) --p.bombs;
    fx.ring(fx.px(p.x), fx.py(p.y), 4, 60, 0.5, '#ffffff', 4);
    fx.sfx('whoosh', { pitch: 0.8 });
  }

  Object.assign(NS.player, {
    create, carry, speedOf, moveAxis, update, hurt, bombKey
  });
})();
