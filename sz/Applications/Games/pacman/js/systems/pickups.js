/* Things to pick up in the maze: power-up capsules on a timer (weighted, unlocked by maze
   number, Rare Finds and Twin Drops), bonus fruit at dot thresholds under the house, and the
   season's tokens that fill the event track. Spawns away from Pac-Man, blinks before vanishing.
   Owns G.run.lvl.items. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { POWERUPS, FRUITS } = NS.items;
  const grid = NS.grid;
  const FX = NS.fx;
  const R = NS.rules;
  const { sfx } = NS.audio;
  const rnd = NS.rng.fx;

  const RARE = { mega: 1, bomb: 1, life: 1 };

  function rollPowerup(run, rng) {
    const n = run.mode === 'story' ? run.world * 4 + run.stage : run.n;
    let total = 0;
    const pool = [];
    for (let i = 0; i < POWERUPS.length; ++i) {
      const p = POWERUPS[i];
      if (p.min > n + 1) continue;
      if (p.id === 'life' && run.mode === 'zen') continue;
      const w = p.weight * (RARE[p.id] ? G.stats.rareBoost : 1);
      pool.push([p.id, w]);
      total += w;
    }
    let r = rng() * total;
    for (let i = 0; i < pool.length; ++i) {
      r -= pool[i][1];
      if (r <= 0) return pool[i][0];
    }
    return pool[0][0];
  }

  /* a random open tile at least minD tiles from Pac-Man, outside the house zone */
  function freeTile(lvl, minD) {
    const m = lvl.maze;
    for (let tries = 0; tries < 60; ++tries) {
      const x = 1 + Math.floor(rnd() * (C.COLS - 2)), y = 1 + Math.floor(rnd() * (C.ROWS - 2));
      if (m.walls[y * C.COLS + x] !== C.W_OPEN || NS.mazes.inHouseZone(x, y)) continue;
      if (m.feat[y * C.COLS + x]) continue;
      if (grid.dist2(x + 0.5, y + 0.5, lvl.pac.x, lvl.pac.y) < minD * minD) continue;
      let busy = false;
      for (let i = 0; i < lvl.items.length; ++i) if (Math.abs(lvl.items[i].x - x - 0.5) < 1 && Math.abs(lvl.items[i].y - y - 0.5) < 1) busy = true;
      if (!busy) return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  }

  function spawn(lvl, kind, id, pos, life) {
    lvl.items.push({ kind: kind, id: id, x: pos.x, y: pos.y, t: 0, life: life });
    FX.ring(grid.px(pos.x), grid.py(pos.y), 30, 4, 0.4, '#ffffff', 3);
  }

  function update(run, dt) {
    const lvl = run.lvl;
    /* capsules */
    lvl.nextPowerT -= dt;
    if (lvl.nextPowerT <= 0) {
      lvl.nextPowerT = lvl.cfg.powerEvery * G.stats.powerRate * (0.8 + rnd() * 0.4);
      const caps = lvl.items.filter(i => i.kind === 'power').length;
      if (caps < 2) {
        const n = rnd() < G.stats.twin ? 2 : 1;
        for (let k = 0; k < n; ++k) {
          const pos = freeTile(lvl, 6);
          if (pos) spawn(lvl, 'power', rollPowerup(run, rnd), pos, 12);
        }
      }
    }
    /* fruit at dot thresholds */
    const fd = lvl.cfg.fruitDots;
    if (lvl.kind === 'maze' && lvl.fruitIdx < fd.length && lvl.dotsEaten >= fd[lvl.fruitIdx]) {
      ++lvl.fruitIdx;
      const n = run.mode === 'story' ? run.world * 4 + run.stage : run.n;
      const f = FRUITS[Math.min(n, FRUITS.length - 1)];
      spawn(lvl, 'fruit', f.id, { x: 14, y: 17.5 }, 9.5 * (G.stats.fruitBonus > 1 ? 1.4 : 1));
      sfx('drop', { volume: 0.5 });
    }
    /* seasonal tokens at a third and two thirds of the dots */
    if (!run.demo && lvl.kind === 'maze' && lvl.tokenIdx < 2 && lvl.dotsEaten >= lvl.dotsTotal * (lvl.tokenIdx + 1) / 3) {
      ++lvl.tokenIdx;
      const pos = freeTile(lvl, 5);
      if (pos) spawn(lvl, 'token', G.season.token, pos, 14);
    }
    /* age and collect */
    const pac = lvl.pac;
    for (let i = lvl.items.length - 1; i >= 0; --i) {
      const it = lvl.items[i];
      it.t += dt;
      if (it.t >= it.life) {
        lvl.items.splice(i, 1);
        continue;
      }
      if (grid.dist2(pac.x, pac.y, it.x, it.y) < 0.5) {
        lvl.items.splice(i, 1);
        collect(run, it);
      }
    }
  }

  function collect(run, it) {
    const lvl = run.lvl;
    const x = grid.px(it.x), y = grid.py(it.y);
    if (it.kind === 'power') {
      NS.powerups.activate(it.id);
      NS.level.addMult(run, 3);
      return;
    }
    if (it.kind === 'fruit') {
      const f = FRUITS.find(q => q.id === it.id);
      const pts = NS.level.addScore(run, Math.round(f.points * G.stats.fruitBonus));
      FX.floater(x, y - 8, String(pts), f.color, 22, 1.3);
      FX.burst(x, y, 24, f.color, 240, 0.6, 6, 0);
      FX.ring(x, y, 8, 80, 0.45, f.color, 4);
      sfx('coin');
      NS.level.addMult(run, 5);
      if (!run.demo) {
        ++run.tally.fruits;
        R.bump(G.profile, 'fruits', 1);
      }
      return;
    }
    if (it.kind === 'token') {
      const p = G.profile;
      let n = 1;
      if (rnd() < G.stats.tokenBonus) n = 2;
      p.season.tokens += n;
      ++run.tally.tokens;
      R.bump(p, 'tokens', n);
      FX.floater(x, y - 8, '+' + n + ' ' + G.season.tokenName.toUpperCase(), G.season.color, 18, 1.4);
      FX.burst(x, y, 30, G.season.color, 260, 0.7, 6, 0);
      FX.confetti(x, y, 16, 2);
      sfx('pickup', { pitch: 1.2 });
      const tiers = NS.seasons.claimTiers(p, G.date);
      for (let i = 0; i < tiers.length; ++i) NS.screens.toast(G.season.name + ' tier ' + (tiers[i].tier + 1) + ': ' + tiers[i].label, G.season.color);
      if (tiers.length) NS.save.refreshStats();
    }
  }

  Object.assign(NS.pickups, {
    rollPowerup, freeTile, update, collect
  });
})();
