/* Bombs and fire: placing (player, imp and boss bombs, the Mega Bomb), fuses, remote detonation,
   kicks that slide a bomb until something stops it, glove throws that arc over walls, belts
   that carry resting bombs, detonation into four fire arms (pierce, chained bombs that join
   the same blast group, burning pickups) and the fire timers. Mutates G.run.bombs and the
   fire layers run.fire / fireDir / fireG / fireO. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS, T_HARD, T_SOFT, T_CRATE, T_BELT_U, T_BELT_D, T_BELT_L, T_BELT_R, DIRS } = C;
  const A = NS.arena;
  const fx = NS.fx;

  const OWNER = { p: 0, e: 1, b: 2 };
  const BELT_DIR = {};
  BELT_DIR[T_BELT_D] = 0; BELT_DIR[T_BELT_U] = 1; BELT_DIR[T_BELT_L] = 2; BELT_DIR[T_BELT_R] = 3;

  function playerBombs() {
    let n = 0;
    const bs = G.run.bombs;
    for (let k = 0; k < bs.length; ++k) if (bs[k].owner === 'p' && !bs[k].mega) ++n;
    return n;
  }

  function make(owner, c, r, range, fuse, opts) {
    const run = G.run;
    const b = {
      id: run.nextId++, owner: owner, i: A.idx(c, r), x: c, y: r, t: fuse, fuse: fuse, range: range,
      pierce: !!(opts && opts.pierce), remote: !!(opts && opts.remote), mega: !!(opts && opts.mega),
      vx: 0, vy: 0, fly: null, group: 0, chained: false, squash: 1
    };
    run.bombs.push(b);
    G.lvl.bombAt[b.i] = run.bombs.length - 1;
    return b;
  }

  /* The player's bomb key: returns the bomb or null */
  function placePlayer() {
    const run = G.run, p = run.player;
    if (p.dead || run.phase !== 'play') return null;
    if (p.curse === 'nobomb') { fx.sfx('error', { volume: 0.4 }); return null; }
    const c = Math.round(p.x), r = Math.round(p.y);
    const t = A.tileAt(c, r);
    if (t === T_SOFT || t === T_CRATE || t === T_HARD) return null;
    if (A.bombAtCell(c, r)) return null;
    if (playerBombs() >= p.bombs) return null;
    const fuse = p.curse === 'short' ? 0.9 : G.perks.fuse;
    const b = make('p', c, r, p.curse === 'short' ? 1 : p.fire, fuse, { pierce: p.pierce, remote: p.remote });
    p.onBomb.push(b.id);
    p.squash = 0.35;
    b.squash = 0.4;
    NS.tracker.stat('bombs', 1);
    fx.sfx('drop', { pitch: 0.9 + Math.random() * 0.2 });
    return b;
  }

  function placeMega() {
    const run = G.run, p = run.player;
    if (!G.perks.mega || p.mega < C.SUPER_COST || p.dead || run.phase !== 'play') return null;
    const c = Math.round(p.x), r = Math.round(p.y);
    if (A.bombAtCell(c, r) || A.isBlock(A.tileAt(c, r))) return null;
    p.mega = 0;
    const b = make('p', c, r, 6, 1.7, { pierce: true, mega: true });
    p.onBomb.push(b.id);
    fx.banner('MEGA BOMB!', 'run!', '#ff8a3c', 1.2);
    fx.sfx('powerup', { pitch: 0.6 });
    return b;
  }

  function placeEnemy(c, r, range, fuse, owner) {
    if (A.bombAtCell(c, r) || A.isBlock(A.tileAt(c, r))) return null;
    return make(owner || 'e', c, r, range, fuse || 2.2, null);
  }

  /* Starts a bomb sliding in direction d (kick); returns whether it moved */
  function kick(b, d) {
    const nc = Math.round(b.x) + DIRS[d][0], nr = Math.round(b.y) + DIRS[d][1];
    if (b.fly || !A.bombCan(nc, nr)) return false;
    b.vx = DIRS[d][0] * C.SLIDE_SPEED;
    b.vy = DIRS[d][1] * C.SLIDE_SPEED;
    b.from = b.i;
    b.belt = false;
    b.squash = 0.6;
    fx.sfx('whoosh', { volume: 0.6 });
    return true;
  }

  /* Glove: the bomb arcs three tiles and lands on the first free tile from there */
  function throwBomb(b, d) {
    const run = G.run;
    b.vx = b.vy = 0;
    const fromX = b.x, fromY = b.y;
    let c = Math.round(b.x) + DIRS[d][0] * 3, r = Math.round(b.y) + DIRS[d][1] * 3;
    for (let k = 0; k < COLS + ROWS; ++k) {
      c = Math.min(COLS - 2, Math.max(1, c));
      r = Math.min(ROWS - 2, Math.max(1, r));
      if (!A.isBlock(A.tileAt(c, r)) && !A.bombAtCell(c, r)) break;
      c += DIRS[d][0]; r += DIRS[d][1];
      if (c <= 0 || c >= COLS - 1 || r <= 0 || r >= ROWS - 1) { c = Math.round(b.x); r = Math.round(b.y); break; }
    }
    b.fly = { t: 0, dur: C.THROW_TIME, fx: fromX, fy: fromY, tx: c, ty: r };
    b.t = Math.max(b.t, 0.8);
    const p = run.player;
    const k = p.onBomb.indexOf(b.id);
    if (k >= 0) p.onBomb.splice(k, 1);
    fx.sfx('jump', { pitch: 1.2 });
  }

  /* Every remote bomb of the player goes off, oldest first, a beat apart */
  function detonateRemote() {
    const bs = G.run.bombs;
    let n = 0;
    for (let k = 0; k < bs.length; ++k)
      if (bs[k].owner === 'p' && bs[k].remote && !bs[k].fly) {
        bs[k].remote = false;
        bs[k].t = 0.001 + n * C.CHAIN_DELAY;
        ++n;
      }
    if (n) fx.sfx('click', { pitch: 1.6 });
    return n;
  }

  function setFire(i, dirBits, group, owner) {
    const run = G.run;
    run.fire[i] = C.FIRE_TIME;
    run.fireDir[i] |= dirBits;
    run.fireG[i] = group;
    run.fireO[i] = owner;
  }

  /* Blows bomb b up: four fire arms, chain reactions, broken bricks */
  function detonate(b) {
    const run = G.run;
    const k = run.bombs.indexOf(b);
    if (k < 0) return;
    run.bombs.splice(k, 1);
    A.rebuild();
    const c0 = Math.round(b.x), r0 = Math.round(b.y);
    const owner = OWNER[b.owner];
    if (!b.group) {
      b.group = run.nextId++;
      run.groups.push({ id: b.group, kills: 0, bombs: 0, owner: b.owner });
      if (run.groups.length > 24) run.groups.shift();
    }
    const grp = run.groups.find(g => g.id === b.group);
    if (grp) ++grp.bombs;
    const i0 = A.idx(c0, r0);
    run.fireDir[i0] = 0;
    setFire(i0, 16, b.group, owner);
    fx.flame(c0, r0, 2);
    const range = b.range + (b.chained && b.owner === 'p' ? G.perks.chain : 0);
    for (let d = 0; d < 4; ++d) {
      const dx = DIRS[d][0], dy = DIRS[d][1];
      for (let s = 1; s <= range; ++s) {
        const c = c0 + dx * s, r = r0 + dy * s;
        if (!A.inside(c, r)) break;
        const i = A.idx(c, r);
        const t = run.level.grid[i];
        if (t === T_HARD) break;
        if (t === T_SOFT || t === T_CRATE) {
          setFire(i, d < 2 ? 3 : 12, b.group, owner);
          A.hitBlock(i, b.owner === 'p');
          if (!b.pierce || t === T_CRATE) break;
          continue;
        }
        setFire(i, (d < 2 ? 3 : 12) | (s === range ? 32 : 0), b.group, owner);
        if ((s & 1) === 0 || s === range) fx.flame(c, r, 1);
        const other = A.bombAtCell(c, r);
        if (other && !other.chained) {
          other.chained = true;
          other.group = b.group;
          other.remote = false;
          other.t = Math.min(other.t, C.CHAIN_DELAY);
          if (!other.mega) break;
        }
        NS.items.burnAt(i);
      }
    }
    fx.explosion(c0, r0, range);
    fx.hitstop(b.mega ? 0.09 : 0.025);
    fx.sfx(b.mega || range >= 5 ? 'explode' : 'smallExplode', { pitch: 0.85 + Math.random() * 0.3 });
    if (b.mega) { fx.shake(18); fx.flash('#ffffff', 0.5); }
  }

  function update(dt) {
    const run = G.run;
    const bs = run.bombs;
    for (let k = bs.length - 1; k >= 0; --k) {
      const b = bs[k];
      if (!b) continue;
      b.squash += (1 - b.squash) * Math.min(1, dt * 10);
      if (b.fly) {
        const f = b.fly;
        f.t += dt;
        const u = Math.min(1, f.t / f.dur);
        b.x = f.fx + (f.tx - f.fx) * u;
        b.y = f.fy + (f.ty - f.fy) * u;
        if (u >= 1) {
          b.fly = null;
          b.x = f.tx; b.y = f.ty;
          b.i = A.idx(f.tx, f.ty);
          b.squash = 0.45;
          fx.sfx('thud', { volume: 0.5 });
          A.rebuild();
        }
        continue;
      }
      /* belts push resting bombs */
      const tile = A.tileAt(Math.round(b.x), Math.round(b.y));
      if (!b.vx && !b.vy && BELT_DIR[tile] !== undefined && Math.abs(b.x - Math.round(b.x)) < 0.01 && Math.abs(b.y - Math.round(b.y)) < 0.01) {
        const d = BELT_DIR[tile];
        if (A.bombCan(Math.round(b.x) + DIRS[d][0], Math.round(b.y) + DIRS[d][1]) && !playerOn(b)) {
          b.vx = DIRS[d][0] * 2.4;
          b.vy = DIRS[d][1] * 2.4;
          b.belt = true;
          b.from = b.i;
        }
      }
      if (b.vx || b.vy) slide(b, dt);
      if (b.owner !== 'p' || !b.remote || run.player.dead) {
        b.t -= dt;
        if (b.t <= 0) detonate(b);
      }
    }
    const f = run.fire;
    for (let i = 0; i < f.length; ++i) {
      if (f[i] <= 0) continue;
      f[i] -= dt;
      if (f[i] <= 0) { f[i] = 0; run.fireDir[i] = 0; }
    }
  }

  function playerOn(b) {
    const p = G.run.player;
    return Math.abs(p.x - b.x) < 0.7 && Math.abs(p.y - b.y) < 0.7;
  }

  function slide(b, dt) {
    const sx = Math.sign(b.vx), sy = Math.sign(b.vy);
    const cx = Math.round(b.x), cy = Math.round(b.y);
    const atOrPast = sx ? (sx > 0 ? b.x >= cx : b.x <= cx) : (sy > 0 ? b.y >= cy : b.y <= cy);
    if (atOrPast) {
      const ci = A.idx(cx, cy);
      const stopBelt = b.belt && ci !== b.from;
      const nc = cx + sx, nr = cy + sy;
      const p = G.run.player;
      const blocked = !A.bombCan(nc, nr) || (!p.dead && Math.round(p.x) === nc && Math.round(p.y) === nr);
      if (stopBelt || blocked) {
        b.x = cx; b.y = cy;
        b.vx = b.vy = 0;
        b.belt = false;
        b.i = ci;
        if (blocked && !stopBelt) b.squash = 0.6;
        A.rebuild();
        return;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const ni = A.idx(Math.round(b.x), Math.round(b.y));
    if (ni !== b.i) {
      b.i = ni;
      A.rebuild();
    }
  }

  function bombById(id) {
    const bs = G.run.bombs;
    for (let k = 0; k < bs.length; ++k) if (bs[k].id === id) return bs[k];
    return null;
  }

  Object.assign(NS.bombs, {
    playerBombs, placePlayer, placeMega, placeEnemy, kick, throwBomb, detonateRemote, detonate, setFire, update, bombById, OWNER
  });
})();
