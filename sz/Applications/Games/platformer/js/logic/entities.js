;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Everything that moves besides the hero: seven foe behaviours, five
   * bosses with three phases each, projectiles (fireballs, enemy shots, boss
   * attacks, falling rocks and icicles, lightning, ground waves) and moving
   * platforms. Pure logic on top of SZ.PlatformerPhysics; the game draws
   * them (js/render/world.js) and turns the events they emit into sound and
   * particles (js/play/events.js).
   *
   * Every update gets a `game` object:
   *   { level, player, t, emit(type, data), shots: [], enemies: [] }
   * Events: 'shot', 'windup', 'land', 'quake', 'telegraph', 'teleport',
   *         'summon', 'phase', 'roar', 'muzzle' (a boss projectile leaves
   *         the boss), 'fizzle' (a shot burns out).
   */

  const Ph = SZ.PlatformerPhysics;
  const TS = Ph.TS;

  const ENEMY_DEFS = {
    walker: { w: 36, h: 30, speed: 60, stomp: true, hp: 1, score: 100 },
    charger: { w: 48, h: 36, speed: 50, stomp: true, hp: 1, score: 150 },
    hopper: { w: 34, h: 30, speed: 0, stomp: true, hp: 1, score: 120 },
    spiky: { w: 36, h: 30, speed: 38, stomp: false, hp: 2, score: 200 },
    flyer: { w: 36, h: 30, speed: 0, stomp: true, hp: 1, score: 120, air: true },
    diver: { w: 38, h: 30, speed: 0, stomp: true, hp: 1, score: 160, air: true },
    turret: { w: 40, h: 44, speed: 0, stomp: true, hp: 2, score: 180 }
  };

  const BOSS_DEFS = {
    slime: { w: 120, h: 92, hp: 6, name: 'King Gloop' },
    golem: { w: 104, h: 124, hp: 6, name: 'Crystal Golem' },
    yeti: { w: 112, h: 120, hp: 6, name: 'Old Rimeback' },
    drake: { w: 170, h: 100, hp: 6, name: 'Magma Drake' },
    sorcerer: { w: 80, h: 120, hp: 6, name: 'The Storm Regent' }
  };
  const BOSS_KINDS = ['slime', 'golem', 'yeti', 'drake', 'sorcerer'];

  const moveOut = {};

  function sign(v) {
    return v < 0 ? -1 : v > 0 ? 1 : 0;
  }

  function centreX(b) { return b.x + b.w / 2; }
  function centreY(b) { return b.y + b.h / 2; }

  /* ══════════════════════════════════════════════════════════════════
     FOES
     ══════════════════════════════════════════════════════════════════ */

  function createEnemy(type, c, r, world) {
    const d = ENEMY_DEFS[type] || ENEMY_DEFS.walker;
    const e = {
      type: type, world: world, w: d.w, h: d.h,
      x: c * TS + (TS - d.w) / 2, y: (r + 1) * TS - d.h,
      vx: 0, vy: 0, dir: -1, state: 'normal', t: Math.random() * 2, stateT: 0,
      alive: true, hp: d.hp, stomp: d.stomp, air: !!d.air, score: d.score,
      x0: 0, y0: 0, onGround: false, flash: 0, squash: 0, frameT: Math.random()
    };
    if (e.air) {
      e.y = r * TS + (TS - d.h) / 2;
      e.x0 = e.x;
      e.y0 = e.y;
    }
    return e;
  }

  const speedMul = (e) => 1 + e.world * 0.08;

  function setState(e, s) {
    e.state = s;
    e.stateT = 0;
  }

  function walk(e, level, dt, speed, turnAtEdges) {
    e.vx = e.dir * speed;
    Ph.moveBody(e, level, dt, Ph.P.gravity, moveOut);
    e.onGround = moveOut.landed;
    if (moveOut.hitX) {
      e.dir = -moveOut.hitX;
    } else if (turnAtEdges && e.onGround && !Ph.groundAhead(e, level, e.dir)) {
      e.dir = -e.dir;
      e.x -= e.vx * dt;
    }
  }

  function updateEnemy(e, game, dt) {
    if (!e.alive)
      return;
    const level = game.level, p = game.player;
    e.t += dt;
    e.stateT += dt;
    e.frameT += dt;
    e.flash = Math.max(0, e.flash - dt);
    const dx = centreX(p) - centreX(e), dy = centreY(p) - centreY(e);
    const k = speedMul(e);
    switch (e.type) {
      case 'walker':
        walk(e, level, dt, ENEMY_DEFS.walker.speed * k, true);
        break;
      case 'spiky':
        walk(e, level, dt, ENEMY_DEFS.spiky.speed * k, true);
        break;
      case 'charger':
        if (e.state === 'normal') {
          walk(e, level, dt, ENEMY_DEFS.charger.speed * k, true);
          if (Math.abs(dy) < 50 && Math.abs(dx) < 320 && sign(dx) === e.dir && e.stateT > 0.8) {
            setState(e, 'windup');
            game.emit('windup', e);
          }
        } else if (e.state === 'windup') {
          e.vx = 0;
          Ph.moveBody(e, level, dt, Ph.P.gravity, moveOut);
          if (e.stateT > 0.45)
            setState(e, 'charge');
        } else if (e.state === 'charge') {
          e.vx = e.dir * 330 * k;
          Ph.moveBody(e, level, dt, Ph.P.gravity, moveOut);
          const edge = moveOut.landed && !Ph.groundAhead(e, level, e.dir);
          if (moveOut.hitX || edge || e.stateT > 2.2) {
            if (edge)
              e.x -= e.vx * dt;
            setState(e, 'stunned');
            if (moveOut.hitX)
              game.emit('land', { x: centreX(e) + e.dir * e.w / 2, y: e.y + e.h / 2, power: 0.5 });
          }
        } else if (e.state === 'stunned') {
          e.vx = 0;
          Ph.moveBody(e, level, dt, Ph.P.gravity, moveOut);
          if (e.stateT > 1.1) {
            e.dir = -e.dir;
            setState(e, 'normal');
          }
        }
        break;
      case 'hopper':
        e.vx *= e.onGround ? 0 : 1;
        Ph.moveBody(e, level, dt, Ph.P.gravity, moveOut);
        if (moveOut.hitX)
          e.vx = -e.vx * 0.3;
        if (moveOut.landed && !e.onGround) {
          e.squash = 0.15;
          setState(e, 'normal');
        }
        e.onGround = moveOut.landed;
        e.squash = Math.max(0, e.squash - dt);
        if (e.onGround && e.stateT > 1.25) {
          e.dir = Math.abs(dx) < 400 ? sign(dx) || e.dir : -e.dir;
          if (!Ph.groundAhead(e, level, e.dir) && Math.random() < 0.6)
            e.dir = -e.dir;
          e.vy = -720;
          e.vx = e.dir * 150 * k;
          e.onGround = false;
          setState(e, 'windup');
        }
        break;
      case 'flyer':
        e.x = e.x0 + Math.sin(e.t * 0.9) * 110;
        e.y = e.y0 + Math.sin(e.t * 2.3) * 14;
        e.dir = Math.cos(e.t * 0.9) >= 0 ? 1 : -1;
        break;
      case 'diver':
        if (e.state === 'normal') {
          e.x = e.x0 + Math.sin(e.t * 0.7) * 60;
          e.y = e.y0 + Math.sin(e.t * 2) * 8;
          e.dir = sign(dx) || 1;
          if (dy > 40 && Math.abs(dx) < 240 && e.stateT > 1.2) {
            setState(e, 'windup');
            e.tx = centreX(p);
            e.ty = centreY(p);
            game.emit('windup', e);
          }
        } else if (e.state === 'windup') {
          e.y -= 30 * dt;
          if (e.stateT > 0.4) {
            const ax = e.tx - centreX(e), ay = e.ty - centreY(e);
            const len = Math.max(1, Math.sqrt(ax * ax + ay * ay));
            e.vx = ax / len * 400 * k;
            e.vy = ay / len * 400 * k;
            setState(e, 'dive');
          }
        } else if (e.state === 'dive') {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.stateT > 0.9 || Ph.solidAt(level, Math.floor(centreX(e) / TS), Math.floor((e.y + e.h) / TS)))
            setState(e, 'return');
        } else {
          const ax = e.x0 - e.x, ay = e.y0 - e.y;
          const len = Math.sqrt(ax * ax + ay * ay);
          if (len < 6) {
            e.x = e.x0;
            e.y = e.y0;
            setState(e, 'normal');
            e.t = 0;
          } else {
            e.x += ax / len * 150 * dt;
            e.y += ay / len * 150 * dt;
          }
        }
        break;
      case 'turret':
        e.dir = sign(dx) || e.dir;
        if (e.state === 'normal') {
          if (Math.abs(dx) < 560 && Math.abs(dy) < 360 && e.stateT > 2.1) {
            setState(e, 'windup');
            game.emit('windup', e);
          }
        } else if (e.state === 'windup' && e.stateT > 0.55) {
          const ax = dx, ay = dy - 10;
          const len = Math.max(1, Math.sqrt(ax * ax + ay * ay));
          spawnShot(game, { kind: 'shot', owner: 'enemy', x: centreX(e) + e.dir * 16, y: e.y + 14, vx: ax / len * 270, vy: ay / len * 270, r: 10, life: 3.2, world: e.world });
          game.emit('shot', e);
          setState(e, 'normal');
        }
        break;
    }
    if (e.y > level.rows * TS + 100)
      e.alive = false;
  }

  /* ══════════════════════════════════════════════════════════════════
     PROJECTILES
     ══════════════════════════════════════════════════════════════════ */

  function spawnShot(game, s) {
    const shot = {
      kind: s.kind, owner: s.owner, x: s.x, y: s.y, vx: s.vx || 0, vy: s.vy || 0, r: s.r || 10,
      gravity: s.gravity || 0, life: s.life || 3, t: 0, delay: s.delay || 0, bounce: !!s.bounce,
      pierce: !!s.pierce, homing: s.homing || 0, world: s.world || 0, boss: s.boss || 0, alive: true,
      dmg: s.dmg || 1, w: s.w || 0, h: s.h || 0, ground: s.ground || 0
    };
    game.shots.push(shot);
    return shot;
  }

  function solidPoint(level, x, y) {
    return Ph.solidAt(level, Math.floor(x / TS), Math.floor(y / TS));
  }

  /* can a ground wave run here? solid ground or a one-way ledge */
  function floorPoint(level, x, y) {
    const code = Ph.tileAt(level, Math.floor(x / TS), Math.floor(y / TS));
    return Ph.isSolid(code) || code === Ph.T.ONEWAY;
  }

  function updateShot(s, game, dt) {
    if (!s.alive)
      return;
    const level = game.level;
    s.t += dt;
    if (s.delay > 0) {
      s.delay -= dt;
      return;
    }
    s.life -= dt;
    if (s.life <= 0) {
      s.alive = false;
      return;
    }
    if (s.kind === 'bolt') {
      /* a lightning column, deadly for its short life */
      return;
    }
    if (s.homing && game.player) {
      const ax = centreX(game.player) - s.x, ay = centreY(game.player) - s.y;
      const len = Math.max(1, Math.sqrt(ax * ax + ay * ay));
      const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      s.vx += (ax / len * sp - s.vx) * Math.min(1, s.homing * dt);
      s.vy += (ay / len * sp - s.vy) * Math.min(1, s.homing * dt);
    }
    s.vy += s.gravity * dt;
    const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
    if (s.kind === 'wave') {
      /* a ground wave hugs the floor and dies at walls or edges */
      s.x = nx;
      if (solidPoint(level, s.x + sign(s.vx) * s.r, s.ground - 10) || !floorPoint(level, s.x, s.ground + 4))
        s.alive = false;
      return;
    }
    if (s.kind === 'fall') {
      s.y = ny;
      if (solidPoint(level, s.x, s.y + s.r)) {
        s.alive = false;
        game.emit('land', { x: s.x, y: s.y + s.r, power: 0.6, shard: true, world: s.world });
      }
      return;
    }
    if (solidPoint(level, nx, s.y)) {
      if (s.bounce && s.owner === 'player') {
        s.alive = false;
        game.emit('fizzle', s);
        return;
      }
      s.alive = false;
      game.emit('fizzle', s);
      return;
    }
    s.x = nx;
    if (solidPoint(level, s.x, ny + (s.vy > 0 ? s.r : -s.r))) {
      if (s.bounce && s.vy > 0) {
        s.vy = -Math.max(380, Math.abs(s.vy) * 0.6) * (s.highBounce ? 1.25 : 1);
        return;
      }
      s.alive = false;
      game.emit('fizzle', s);
      return;
    }
    s.y = ny;
    if (s.y > level.rows * TS + 60)
      s.alive = false;
  }

  /* the box a shot hurts, as { x, y, w, h } */
  function shotBox(s, out) {
    if (s.kind === 'bolt') {
      out.x = s.x - 22; out.y = 0; out.w = 44; out.h = s.ground;
    } else if (s.kind === 'wave') {
      out.x = s.x - s.r; out.y = s.ground - 30; out.w = s.r * 2; out.h = 30;
    } else {
      out.x = s.x - s.r; out.y = s.y - s.r; out.w = s.r * 2; out.h = s.r * 2;
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     POWER-UPS FROM ITEM BLOCKS
     ══════════════════════════════════════════════════════════════════ */

  const ITEM_RISE = 0.4;        // seconds to climb out of the block
  const ITEM_GRAB = 34;         // pickup radius around the hero's centre

  /* a power-up bumped out of the block at column c, row r */
  function createBlockItem(kind, c, r) {
    const x = c * TS + TS / 2, y = r * TS + TS / 2;
    return { kind: kind, x: x, y: y, y0: y - TS, t: 0, taken: false };
  }

  /* it rises out of the block and comes to rest on top of it */
  function updateBlockItem(it, dt) {
    it.t += dt;
    it.y = it.y0 + TS - TS * Math.min(1, it.t / ITEM_RISE);
  }

  /* can the hero grab it? not while it is still inside the block */
  function itemTouches(it, p) {
    if (it.taken || it.t < ITEM_RISE * 0.75)
      return false;
    const dx = p.x + p.w / 2 - it.x, dy = p.y + p.h / 2 - it.y;
    return dx * dx + dy * dy < ITEM_GRAB * ITEM_GRAB;
  }

  /* ══════════════════════════════════════════════════════════════════
     MOVING PLATFORMS
     ══════════════════════════════════════════════════════════════════ */

  const posTmp = { x: 0, y: 0 };

  function createPlatforms(level) {
    return level.platforms.map(d => {
      Ph.platformPos(d, 0, posTmp);
      return { def: d, x: posTmp.x, y: posTmp.y, w: d.w, h: d.h, px: posTmp.x, py: posTmp.y };
    });
  }

  function updatePlatforms(list, t) {
    for (const pl of list) {
      pl.px = pl.x;
      pl.py = pl.y;
      Ph.platformPos(pl.def, t, posTmp);
      pl.x = posTmp.x;
      pl.y = posTmp.y;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     BOSSES
     ══════════════════════════════════════════════════════════════════ */

  function createBoss(kind, level) {
    const d = BOSS_DEFS[kind];
    const a = level.arena;
    const sp = level.bossSpawn;
    const b = {
      kind: kind, name: d.name, w: d.w, h: d.h, x: sp.c * TS + TS / 2 - d.w / 2, y: (sp.r + 1) * TS - d.h,
      vx: 0, vy: 0, hp: d.hp, maxHp: d.hp, phase: 1, state: 'intro', stateT: 0, t: 0, inv: 0, dir: -1,
      onGround: true, alive: true, active: false, dying: 0, flash: 0, minions: 0, cast: 0,
      ax0: (a.c0 + 2) * TS, ax1: (a.c1 - 1) * TS, floor: (sp.r + 1) * TS, top: 3 * TS,
      anchor: 0, attackT: 0, swoopT: 0, homeY: 0
    };
    b.homeY = b.floor - 330;
    if (kind === 'drake') {
      b.y = b.homeY;
      b.onGround = false;
    }
    if (kind === 'sorcerer') {
      b.y = b.floor - 230;
      b.onGround = false;
    }
    return b;
  }

  function bossSet(b, s) {
    b.state = s;
    b.stateT = 0;
  }

  /* bosses take damage; returns true when the hit landed */
  function hurtBoss(b, dmg, game) {
    if (!b.alive || b.inv > 0 || b.dying > 0 || !b.active)
      return false;
    b.hp = Math.max(0, b.hp - dmg);
    b.inv = dmg >= 1 ? 1.0 : 0.15;
    b.flash = 0.25;
    const phase = b.hp < b.maxHp / 3 - 1e-6 ? 3 : b.hp < b.maxHp * 2 / 3 - 1e-6 ? 2 : 1;
    if (phase !== b.phase) {
      b.phase = phase;
      game.emit('phase', b);
    }
    if (b.hp <= 0) {
      b.dying = 2.2;
      bossSet(b, 'dying');
      clearBossShots(game);
    }
    return true;
  }

  /* a beaten boss takes its waves, rocks, bolts and orbs with it */
  function clearBossShots(game) {
    for (const s of game.shots) {
      if (!s.alive || s.owner !== 'boss')
        continue;
      s.alive = false;
      if (s.delay <= 0)
        game.emit('fizzle', s);
    }
  }

  /* a projectile leaves the boss's body: a burst marks where it starts */
  function bossShot(game, b, s) {
    game.emit('muzzle', { x: s.x, y: s.kind === 'wave' ? s.ground - 15 : s.y, boss: BOSS_KINDS.indexOf(b.kind) });
    return spawnShot(game, s);
  }

  /* can a stomp hurt the boss right now? */
  function bossStompable(b) {
    if (b.dying > 0 || !b.active)
      return false;
    if (b.kind === 'golem')
      return b.state === 'stunned' || b.state === 'walk';
    if (b.kind === 'sorcerer')
      return b.state !== 'teleport';
    return true;
  }

  function bossGround(b, level, dt) {
    /* stop at the arena bounds before moving, so it never lands on the gate */
    if (b.x + b.vx * dt < b.ax0) b.vx = Math.min(0, (b.ax0 - b.x) / dt);
    if (b.x + b.w + b.vx * dt > b.ax1) b.vx = Math.max(0, (b.ax1 - b.x - b.w) / dt);
    Ph.moveBody(b, level, dt, Ph.P.gravity, moveOut);
    const landed = moveOut.landed && !b.onGround;
    b.onGround = moveOut.landed;
    if (b.x < b.ax0) { b.x = b.ax0; if (b.vx < 0) b.vx = 0; }
    if (b.x + b.w > b.ax1) { b.x = b.ax1 - b.w; if (b.vx > 0) b.vx = 0; }
    return landed;
  }

  function dropHazard(game, b, x, kind) {
    spawnShot(game, { kind: 'fall', owner: 'boss', x: x, y: b.top + 10, vy: 0, gravity: 1400, r: 16, life: 4, delay: 0.85, boss: BOSS_KINDS.indexOf(b.kind) });
    game.emit('telegraph', { x: x, y: b.floor, kind: kind });
  }

  function aimAt(game, b, sx, sy, speed, spread, kind, extra) {
    const p = game.player;
    const ax = centreX(p) - sx, ay = centreY(p) - sy;
    const base = Math.atan2(ay, ax);
    for (let k = 0; k < (spread || 1); ++k) {
      const off = spread > 1 ? (k - (spread - 1) / 2) * 0.28 : 0;
      bossShot(game, b, Object.assign({ kind: kind || 'boss', owner: 'boss', x: sx, y: sy, vx: Math.cos(base + off) * speed, vy: Math.sin(base + off) * speed,
        r: 14, life: 3.5, boss: BOSS_KINDS.indexOf(b.kind) }, extra || {}));
    }
    game.emit('shot', b);
  }

  /* a lobbed arc that lands near the player */
  function lob(game, b, sx, sy, time, kind) {
    const p = game.player;
    const tx = centreX(p) + (Math.random() - 0.5) * 60, ty = p.y + p.h;
    const g = 1300;
    const vx = (tx - sx) / time, vy = (ty - sy - 0.5 * g * time * time) / time;
    bossShot(game, b, { kind: kind || 'boss', owner: 'boss', x: sx, y: sy, vx: vx, vy: vy, gravity: g, r: 15, life: time + 1, boss: BOSS_KINDS.indexOf(b.kind) });
    game.emit('shot', b);
  }

  function updateBoss(b, game, dt) {
    if (!b.alive)
      return;
    const level = game.level, p = game.player;
    b.t += dt;
    b.stateT += dt;
    b.inv = Math.max(0, b.inv - dt);
    b.flash = Math.max(0, b.flash - dt);
    const dx = centreX(p) - centreX(b);
    const fast = 1 + (b.phase - 1) * 0.22;

    if (b.state === 'dying') {
      b.dying -= dt;
      b.vx = 0;
      if (b.kind !== 'drake' && b.kind !== 'sorcerer')
        bossGround(b, level, dt);
      else
        b.y += 40 * dt;
      if (b.dying <= 0)
        b.alive = false;
      return;
    }
    if (!b.active) {
      if (b.kind !== 'drake' && b.kind !== 'sorcerer')
        bossGround(b, level, dt);
      return;
    }
    if (b.state === 'intro') {
      if (b.stateT > 1.2) {
        bossSet(b, 'idle');
        game.emit('roar', b);
      }
      if (b.kind !== 'drake' && b.kind !== 'sorcerer')
        bossGround(b, level, dt);
      return;
    }

    switch (b.kind) {
      case 'slime': {
        if (b.state === 'idle') {
          b.vx = 0;
          bossGround(b, level, dt);
          if (b.stateT > 0.9 / fast) {
            b.dir = Math.sign(dx) || b.dir;
            b.vy = -(b.phase === 3 ? 1150 : 1000);
            b.vx = b.dir * Math.min(320, Math.abs(dx) * 0.9 + 80) * (b.phase === 1 ? 0.8 : 1);
            b.onGround = false;
            bossSet(b, 'hop');
          }
        } else if (b.state === 'hop') {
          if (bossGround(b, level, dt)) {
            b.vx = 0;
            /* the waves start at its feet, on whatever it landed on */
            const feet = b.y + b.h;
            game.emit('quake', { x: centreX(b), y: feet, power: 0.7 });
            if (b.phase >= 2) {
              for (const d of [-1, 1])
                bossShot(game, b, { kind: 'wave', owner: 'boss', x: centreX(b) + d * b.w * 0.4, y: feet - 15, vx: d * 330, r: 18, life: 2.5, ground: feet, boss: 0 });
            }
            if (b.phase === 3 && b.minions < 3) {
              ++b.minions;
              game.emit('summon', { type: 'walker', x: centreX(b), y: b.y });
            }
            bossSet(b, 'idle');
          }
        }
        break;
      }
      case 'golem': {
        if (b.state === 'idle' || b.state === 'walk') {
          if (b.state === 'idle' && b.stateT > 0.6)
            bossSet(b, 'walk');
          b.dir = Math.sign(dx) || b.dir;
          b.vx = b.state === 'walk' ? b.dir * 80 * fast : 0;
          bossGround(b, level, dt);
          b.attackT += dt;
          if (b.phase === 3 && b.attackT > 1.3) {
            b.attackT = 0;
            lob(game, b, centreX(b), b.y + 20, 0.9);
          }
          if (b.state === 'walk' && b.stateT > 1.6) {
            bossSet(b, 'windup');
            game.emit('windup', b);
          }
        } else if (b.state === 'windup') {
          b.vx = 0;
          bossGround(b, level, dt);
          if (b.stateT > 0.65)
            bossSet(b, 'charge');
        } else if (b.state === 'charge') {
          b.vx = b.dir * 430 * fast;
          bossGround(b, level, dt);
          if (b.x <= b.ax0 + 0.5 || b.x + b.w >= b.ax1 - 0.5 || b.stateT > 3) {
            game.emit('quake', { x: centreX(b) + b.dir * b.w / 2, y: b.y + b.h / 2, power: 0.9 });
            if (b.phase >= 2)
              for (let k = 0; k < 2 + b.phase; ++k)
                dropHazard(game, b, b.ax0 + 40 + Math.random() * (b.ax1 - b.ax0 - 80), 'rock');
            bossSet(b, 'stunned');
          }
        } else if (b.state === 'stunned') {
          b.vx = 0;
          bossGround(b, level, dt);
          if (b.stateT > 1.7)
            bossSet(b, 'idle');
        }
        break;
      }
      case 'yeti': {
        if (b.state === 'idle') {
          b.dir = Math.sign(dx) || b.dir;
          b.vx = b.dir * 50;
          bossGround(b, level, dt);
          if (b.stateT > 1.1 / fast) {
            bossSet(b, b.cast++ % 3 === 2 ? 'leap' : 'throw');
            if (b.state === 'leap') {
              b.vy = -1100;
              b.vx = b.dir * 160;
              b.onGround = false;
            }
          }
        } else if (b.state === 'throw') {
          b.vx = 0;
          bossGround(b, level, dt);
          if (b.stateT > 0.4 && !b.thrown) {
            b.thrown = true;
            const n = b.phase === 1 ? 1 : b.phase === 2 ? 2 : 3;
            for (let k = 0; k < n; ++k)
              lob(game, b, centreX(b) + b.dir * 40, b.y + 10, 0.8 + k * 0.25);
          }
          if (b.stateT > 0.8) {
            b.thrown = false;
            bossSet(b, 'idle');
          }
        } else if (b.state === 'leap') {
          if (bossGround(b, level, dt)) {
            b.vx = 0;
            game.emit('quake', { x: centreX(b), y: b.y + b.h, power: 1 });
            for (let k = 0; k < 2 + b.phase; ++k)
              dropHazard(game, b, b.ax0 + 30 + Math.random() * (b.ax1 - b.ax0 - 60), 'icicle');
            bossSet(b, 'idle');
          }
        }
        break;
      }
      case 'drake': {
        if (b.state === 'idle' || b.state === 'fly') {
          if (b.state === 'idle')
            bossSet(b, 'fly');
          /* sweep side to side above the arena */
          const mid = (b.ax0 + b.ax1) / 2 - b.w / 2, half = (b.ax1 - b.ax0 - b.w) / 2 - 20;
          b.x = mid + Math.sin(b.t * 0.55 * fast) * half;
          b.y = b.homeY + Math.sin(b.t * 1.7) * 18;
          b.dir = Math.cos(b.t * 0.55 * fast) >= 0 ? 1 : -1;
          b.attackT += dt;
          if (b.attackT > 1.6 / fast) {
            b.attackT = 0;
            aimAt(game, b, centreX(b) + b.dir * 60, b.y + b.h * 0.7, 300, b.phase === 1 ? 1 : 3);
          }
          b.swoopT += dt;
          if (b.swoopT > 6.5 / fast) {
            b.swoopT = 0;
            b.dir = centreX(b) < (b.ax0 + b.ax1) / 2 ? 1 : -1;
            bossSet(b, 'swoop');
            game.emit('windup', b);
          }
        } else if (b.state === 'swoop') {
          /* dive to the floor and skim across the arena */
          const targetY = b.floor - b.h;
          b.y += (targetY - b.y) * Math.min(1, dt * 4);
          b.x += b.dir * 380 * fast * dt;
          if (b.x < b.ax0 || b.x + b.w > b.ax1) {
            b.x = Math.max(b.ax0, Math.min(b.ax1 - b.w, b.x));
            game.emit('quake', { x: centreX(b), y: b.floor, power: 0.6 });
            bossSet(b, 'rest');
          }
        } else if (b.state === 'rest') {
          b.y = b.floor - b.h;
          if (b.stateT > 1.6) {
            bossSet(b, 'rise');
          }
        } else if (b.state === 'rise') {
          b.y += (b.homeY - b.y) * Math.min(1, dt * 2.5);
          if (Math.abs(b.y - b.homeY) < 6) {
            b.t = Math.asin(Math.max(-1, Math.min(1, (b.x - ((b.ax0 + b.ax1) / 2 - b.w / 2)) / ((b.ax1 - b.ax0 - b.w) / 2 - 20)))) / (0.55 * fast);
            bossSet(b, 'fly');
          }
        }
        break;
      }
      case 'sorcerer': {
        const anchors = [b.ax0 + 120, (b.ax0 + b.ax1) / 2, b.ax1 - 120];
        if (b.state === 'idle') {
          b.y += ((b.floor - 230 + Math.sin(b.t * 2) * 10) - b.y) * Math.min(1, dt * 3);
          if (b.stateT > 0.7)
            bossSet(b, 'cast');
        } else if (b.state === 'cast') {
          b.dir = Math.sign(dx) || b.dir;
          if (b.stateT > 0.6 && !b.casted) {
            b.casted = true;
            const roll = b.cast++ % 2;
            if (roll === 0 || b.phase === 3) {
              const n = b.phase === 3 ? 2 : 1;
              for (let k = 0; k < n; ++k)
                aimAt(game, b, centreX(b) + (k ? -30 : 30), b.y + 30, 200, 1, 'boss', { homing: 1.6, life: 3.2 });
            }
            if (roll === 1 || b.phase >= 2) {
              const cols = b.phase === 1 ? 1 : b.phase === 2 ? 2 : 3;
              /* the storm is called from its raised hands */
              game.emit('muzzle', { x: centreX(b), y: b.y + 10, boss: 4 });
              for (let k = 0; k < cols; ++k) {
                const x = k === 0 ? centreX(p) : b.ax0 + 60 + Math.random() * (b.ax1 - b.ax0 - 120);
                spawnShot(game, { kind: 'bolt', owner: 'boss', x: x, y: 0, r: 22, life: 0.35, delay: 0.85, ground: b.floor, boss: 4 });
                game.emit('telegraph', { x: x, y: b.floor, kind: 'bolt' });
              }
            }
          }
          if (b.stateT > 1.2) {
            b.casted = false;
            bossSet(b, 'tired');
          }
        } else if (b.state === 'tired') {
          /* sinks low and catches its breath: the time to stomp */
          b.y += ((b.floor - b.h - 30) - b.y) * Math.min(1, dt * 2.5);
          if (b.stateT > 1.6 / fast) {
            bossSet(b, 'teleport');
            game.emit('teleport', b);
          }
        } else if (b.state === 'teleport') {
          if (b.stateT > 0.45) {
            let a = Math.floor(Math.random() * anchors.length);
            if (a === b.anchor) a = (a + 1) % anchors.length;
            b.anchor = a;
            b.x = anchors[a] - b.w / 2;
            b.y = b.floor - 230;
            game.emit('teleport', b);
            bossSet(b, 'idle');
          }
        }
        break;
      }
    }
  }

  SZ.PlatformerEntities = Object.freeze({
    ENEMY_DEFS, BOSS_DEFS, BOSS_KINDS,
    createEnemy, updateEnemy, spawnShot, updateShot, shotBox,
    ITEM_RISE, createBlockItem, updateBlockItem, itemTouches,
    createPlatforms, updatePlatforms,
    createBoss, updateBoss, hurtBoss, bossStompable
  });
})();
