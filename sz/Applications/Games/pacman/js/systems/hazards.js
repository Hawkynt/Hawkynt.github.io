/* Things that fly and burn: Pellet Blaster shots (stun ghosts, chip bosses), boss ice shards
   that drift through walls, sticky boss puddles, the Ember Core's fire vents on their warning
   and eruption cycle, and the boss arena's power pellets growing back. Owns G.run.lvl.shots and
   puddles. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, DX, DY, F_VENT, D_POWER } = C;
  const grid = NS.grid;
  const FX = NS.fx;
  const { sfx } = NS.audio;
  const rnd = NS.rng.fx;

  const VENT_CYCLE = 6, VENT_WARN = 3.6, VENT_FIRE = 4.9;

  function shoot(run, x, y, dir) {
    run.lvl.shots.push({ x: x, y: y, vx: DX[dir] * 17, vy: DY[dir] * 17, owner: 'pac', life: 1.2, t: 0 });
  }

  function shard(run, x, y, ang, speed) {
    run.lvl.shots.push({ x: x, y: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, owner: 'boss', life: 3.4, t: 0 });
  }

  function puddle(run, x, y) {
    run.lvl.puddles.push({ x: x, y: y, t: 0, life: 9 });
  }

  /* 'idle' | 'warn' | 'fire' for the vent at tile (x, y); pairs alternate */
  function ventState(lvl, x, y) {
    const t = (lvl.ventT + ((x + y) % 2) * VENT_CYCLE / 2) % VENT_CYCLE;
    return t >= VENT_FIRE ? 'fire' : t >= VENT_WARN ? 'warn' : 'idle';
  }

  function update(run, dt) {
    const lvl = run.lvl;
    const m = lvl.maze;
    const pac = lvl.pac;
    /* shots */
    for (let i = lvl.shots.length - 1; i >= 0; --i) {
      const s = lvl.shots[i];
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let dead = s.t >= s.life;
      if (s.owner === 'pac') {
        if (s.x < 0) s.x += COLS;
        else if (s.x >= COLS) s.x -= COLS;
        if (grid.wallAt(m, Math.floor(s.x), Math.floor(s.y)) !== C.W_OPEN) {
          FX.sparks(grid.px(s.x), grid.py(s.y), 5, '#ff6a4a', 140);
          dead = true;
        }
        for (let k = 0; k < lvl.ghosts.length && !dead; ++k) {
          const g = lvl.ghosts[k];
          if (g.mode !== 'out' || g.stun > 0) continue;
          if (grid.dist2(s.x, s.y, g.x, g.y) < 0.45) {
            g.stun = 2.6;
            g.flash = 0.25;
            NS.level.addScore(run, 50, grid.px(g.x), grid.py(g.y) - 10, '#ff6a4a', 14);
            FX.burst(grid.px(g.x), grid.py(g.y), 12, '#ff6a4a', 200, 0.4, 5, 0);
            sfx('hit', { pitch: 1.3, volume: 0.5 });
            dead = true;
          }
        }
        if (!dead && lvl.boss && NS.boss.hitTest(lvl.boss, s.x, s.y)) {
          NS.boss.chip(run, 0.25);
          dead = true;
        }
      } else if (lvl.phase === 'play' && pac.grace <= 0 && grid.dist2(s.x, s.y, pac.x, pac.y) < 0.3) {
        dead = true;
        if (lvl.effects.mega > 0) FX.sparks(grid.px(s.x), grid.py(s.y), 8, '#8af0ff', 200);
        else NS.level.caught(run, null);
      }
      if (dead) lvl.shots.splice(i, 1);
    }
    /* puddles */
    for (let i = lvl.puddles.length - 1; i >= 0; --i) {
      lvl.puddles[i].t += dt;
      if (lvl.puddles[i].t >= lvl.puddles[i].life) lvl.puddles.splice(i, 1);
    }
    /* vents */
    if (lvl.features.indexOf('vents') >= 0) vents(run, dt);
    /* the boss arena grows its power pellets back */
    if (lvl.kind === 'boss') regrow(run, dt);
  }

  function vents(run, dt) {
    const lvl = run.lvl, m = lvl.maze, pac = lvl.pac;
    const before = lvl.ventT;
    lvl.ventT += dt;
    for (let i = 0; i < m.feat.length; ++i) {
      if (m.feat[i] !== F_VENT) continue;
      const x = i % COLS, y = (i - x) / COLS;
      const st = ventState(lvl, x, y);
      const cx = grid.px(x + 0.5), cy = grid.py(y + 0.5);
      if (st === 'warn' && rnd() < 0.15) FX.particle(cx + (rnd() - 0.5) * 12, cy, 0, -30, 0.5, 3, '#ff6a2a', 0, 0, 0);
      if (st !== 'fire') continue;
      const tPrev = (before + ((x + y) % 2) * VENT_CYCLE / 2) % VENT_CYCLE;
      if (tPrev < VENT_FIRE) {
        FX.ring(cx, cy, 4, 34, 0.3, '#ffa040', 4);
        sfx('smallExplode', { volume: 0.25 });
      }
      for (let k = 0; k < 2; ++k)
        FX.particle(cx + (rnd() - 0.5) * 14, cy + 6, (rnd() - 0.5) * 40, -120 - rnd() * 120, 0.45, 6 + rnd() * 5, rnd() < 0.5 ? '#ff7a2a' : '#ffd23a', 0, -80, 1);
      if (lvl.phase === 'play' && Math.floor(pac.x) === x && Math.floor(pac.y) === y && pac.grace <= 0 && !(lvl.effects.mega > 0)) {
        NS.level.caught(run, null);
        return;
      }
      for (let k = 0; k < lvl.ghosts.length; ++k) {
        const g = lvl.ghosts[k];
        if (g.mode === 'out' && Math.floor(g.x) === x && Math.floor(g.y) === y) {
          FX.burst(grid.px(g.x), grid.py(g.y), 14, '#ff7a2a', 200, 0.5, 5, 0);
          NS.ghosts.sendHome(g);
        }
      }
    }
  }

  const POWER_TILES = [];
  function regrow(run, dt) {
    const lvl = run.lvl, m = lvl.maze;
    if (!lvl.powerTiles) {
      lvl.powerTiles = [];
      for (let i = 0; i < m.dots.length; ++i) if (m.dots[i] === D_POWER) lvl.powerTiles.push(i);
    }
    let any = false;
    for (let i = 0; i < lvl.powerTiles.length; ++i) if (m.dots[lvl.powerTiles[i]] === D_POWER) any = true;
    if (any || lvl.frightT > 0) { lvl.pelletRespawn = 0; return; }
    lvl.pelletRespawn += dt;
    if (lvl.pelletRespawn < 4) return;
    lvl.pelletRespawn = 0;
    for (let i = 0; i < lvl.powerTiles.length; ++i) {
      const t = lvl.powerTiles[i];
      m.dots[t] = D_POWER;
      const x = t % COLS, y = (t - x) / COLS;
      FX.ring(grid.px(x + 0.5), grid.py(y + 0.5), 40, 6, 0.5, '#ffffff', 4);
    }
    sfx('pickup', { pitch: 0.7, volume: 0.5 });
  }

  Object.assign(NS.hazards, {
    shoot, shard, puddle, ventState, update, VENT_CYCLE, POWER_TILES
  });
})();
