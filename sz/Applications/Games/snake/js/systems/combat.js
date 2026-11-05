/* Fighting back: venom spits flying along the board (breaking crates, felling critters, chipping
   guardians; piercing and bursting with the tech tree), defeating critters (score, drops,
   respawn), the Quake shockwave, and hazards striking - warnings turning into spikes, fire or
   lasers that fell critters standing in them. Owns run.shots and run.venom. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { COLS, ROWS } = NS.constants;
  const { ENEMIES, T, FRUITS } = NS.items;
  const L = NS.levels;
  const B = NS.board;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  const SHOT_SPEED = 20;

  function venomMax() {
    return 3 + G.stats.venomMax;
  }

  function addVenom(n) {
    const run = G.run;
    run.venom = Math.min(venomMax(), run.venom + n);
  }

  function spit() {
    const run = G.run;
    if (!run || run.venom <= 0 || !run.snake.alive) {
      if (run && run.snake.alive) sfx('error', { volume: 0.4 });
      return false;
    }
    run.venom -= 1;
    const h = run.snake.body[0];
    run.shots.push({ c: h, dir: run.snake.dir, t: 0, d: 0, hits: 0 });
    const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][run.snake.dir];
    fx.spray(fx.cx(h), fx.cy(h), a, 0.8, 10, '#9aff4a', 260, 0.35, 6);
    sfx('shoot', { pitch: 1.3 });
    return true;
  }

  function update(dt) {
    const run = G.run;
    for (let k = run.shots.length - 1; k >= 0; --k) {
      const s = run.shots[k];
      s.d += dt * SHOT_SPEED;
      while (s.d >= 1 && !s.done) {
        s.d -= 1;
        advance(s);
      }
      if (s.done) run.shots.splice(k, 1);
    }
  }

  function advance(s) {
    const run = G.run;
    const n = L.step(run.level, s.c, s.dir);
    if (n < 0) { end(s); return; }
    s.c = n;
    ++s.t;
    const ch = run.level.tiles[n];
    if (ch === T.CRATE || ch === T.ROCK) {
      smash(n);
      end(s);
      return;
    }
    if (ch === T.WALL) { end(s); return; }
    const o = B.occ.type[n];
    if (o === B.CRITTER || o === B.RIVAL) {
      const e = run.enemies[B.occ.ref[n]];
      if (e && e.alive) {
        killEnemy(e, 'venom');
        NS.progress.add('venomHits', 1);
        if (!G.stats.pierce) end(s);
      }
    } else if (o === B.BOSS) {
      if (NS.bosses.hit(0.5, n, true)) NS.progress.add('venomHits', 1);
      end(s);
    }
    if (s.t > 40) end(s);
  }

  function end(s) {
    s.done = true;
    const x = fx.cx(s.c), y = fx.cy(s.c);
    fx.burst(x, y, 10, ['#9aff4a', '#d8ff9a'], 160, 0.4, 6);
    if (G.stats.burst) {
      fx.ring(x, y, 4, 70, 0.4, '#9aff4a', 5);
      for (let dy = -1; dy <= 1; ++dy)
        for (let dx = -1; dx <= 1; ++dx) {
          const cx = s.c % COLS + dx, cy = ((s.c / COLS) | 0) + dy;
          if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
          const i = cy * COLS + cx;
          const ch = G.run.level.tiles[i];
          if (ch === T.CRATE || ch === T.ROCK) smash(i);
          if (B.occ.type[i] === B.CRITTER || B.occ.type[i] === B.RIVAL) {
            const e = G.run.enemies[B.occ.ref[i]];
            if (e && e.alive) killEnemy(e, 'venom');
          }
        }
    }
  }

  function smash(i) {
    const ch = G.run.level.tiles[i];
    B.setTile(i, T.FLOOR);
    const col = ch === T.ROCK ? ['#8a6a4a', '#5a4a3a', '#c8a070'] : ['#b07a40', '#7a4a20', '#e0b070'];
    fx.burst(fx.cx(i), fx.cy(i), 16, col, 240, 0.7, 8, fx.SQUARE, 600);
    fx.shake(3);
    sfx('smallExplode');
    if (ch === T.CRATE && G.rng() < 0.35) NS.food.add(i, G.rng() < 0.3 ? 'gem' : 'cherry', 10);
  }

  /* cause: venom, ram, quake, crash (rival into the player), self (rival into anything else), boss */
  function killEnemy(e, cause) {
    const run = G.run;
    if (!e.alive) return;
    e.alive = false;
    e.respawnT = run.mode === 'story' ? 7 : 5;
    const def = ENEMIES[e.type];
    const cells = e.body || [e.i];
    for (let k = 0; k < cells.length; ++k) {
      const c = cells[k];
      fx.burst(fx.cx(c), fx.cy(c), k === 0 ? 18 : 5, [e.color || def.color, '#ffffff'], k === 0 ? 260 : 140, 0.6, k === 0 ? 8 : 5);
    }
    if (e.body) {
      for (let k = 1; k < cells.length && k < 6; k += 2)
        if (B.isFree(cells[k])) NS.food.add(cells[k], 'apple', 9);
    }
    if (cause !== 'self' && cause !== 'boss') {
      const pts = Math.round(def.score * (1 + G.stats.critterScore) * NS.food.multiplier());
      NS.food.addScore(pts, fx.cx(e.i), fx.cy(e.i) - 10);
      run.kills += 1;
      NS.progress.add('kills', 1);
      if (cause === 'crash') fx.text(fx.cx(e.i), fx.cy(e.i) - 40, 'Rival crashed!', '#ffd25a', 18);
      fx.hitstop(0.04);
    }
    fx.shake(cause === 'self' ? 2 : 5);
    sfx('smallExplode', { pitch: e.body ? 0.8 : 1.3 });
    B.rebuildOcc();
  }

  function quake(center, radius) {
    const run = G.run;
    const cx0 = center % COLS, cy0 = (center / COLS) | 0;
    for (let y = cy0 - radius; y <= cy0 + radius; ++y)
      for (let x = cx0 - radius; x <= cx0 + radius; ++x) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        if (Math.abs(x - cx0) + Math.abs(y - cy0) > radius + 1) continue;
        const i = y * COLS + x;
        const ch = run.level.tiles[i];
        if (ch === T.CRATE || ch === T.ROCK) smash(i);
      }
    for (let k = 0; k < run.enemies.length; ++k) {
      const e = run.enemies[k];
      if (e.alive && B.dist(e.i, center) <= radius + 1) killEnemy(e, 'quake');
    }
    if (run.boss && run.boss.hp > 0 && !run.boss.hidden) {
      const cells = NS.bosses.cells(run.boss);
      for (let k = 0; k < cells.length; ++k)
        if (B.dist(cells[k], center) <= radius) { NS.bosses.hit(1, cells[k]); break; }
    }
    const x = fx.cx(center), y = fx.cy(center);
    fx.ring(x, y, 10, radius * 44, 0.6, '#c88a4a', 12);
    fx.ring(x, y, 10, radius * 30, 0.45, '#ffffff', 5);
    fx.shake(14);
    fx.flash('#ffe0b0', 0.3);
    sfx('explode', { volume: 0.8 });
  }

  /* a warning turned into its strike at cell i */
  function onHazardStrike(i, kind) {
    const x = fx.cx(i), y = fx.cy(i);
    if (G.rng() < 0.5) {
      const col = kind === 'fire' ? ['#ff8a3a', '#ffe07a'] : kind === 'laser' ? ['#c08cff', '#ffffff'] : ['#ffffff', '#ffd8a0'];
      fx.burst(x, y, 3, col, 90, 0.35, 6);
    }
    const o = B.occ.type[i];
    if (o === B.CRITTER || o === B.RIVAL) {
      const e = G.run.enemies[B.occ.ref[i]];
      if (e && e.alive && e.type !== 'imp' && !ENEMIES[e.type].flies) killEnemy(e, 'quake');
    }
  }

  Object.assign(NS.combat, {
    venomMax, addVenom, spit, update, smash, killEnemy, quake, onHazardStrike, FRUITS
  });
})();
