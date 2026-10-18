/* world/combat.js -- damage and slows, the enemy spatial grid and target selection.
   Owns state: G.runStartLives, G.enemySeq
   Reads: constants, maps, env, effects, research, bossRewards, paths, towers, waves and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, COLS, ROWS } = NS.constants;
  const { MAPS } = NS.maps;
  const { playThrottled } = NS.env;
  const { particles } = NS.effects;
  const { techLevel } = NS.research;
  const { hasRelic } = NS.bossRewards;
  const { enemyPath } = NS.paths;
  const { towerStats } = NS.towers;
  const { enemyFlags } = NS.waves;

  /* ══════════════════════════════════════════════════════════════════
     DAMAGE
     ══════════════════════════════════════════════════════════════════ */

  // kind: 'phys' | 'fire' | 'cold' | 'energy' | 'poison'
  // opts: { pierce: 0..1 share of armor ignored, dot: true for damage over time }
  function hurt(e, amount, src, kind, opts) {
    if (e.hp <= 0 || amount <= 0) return 0;
    let dmg = amount;
    if (e.freezeTimer > 0 && kind !== 'cold') dmg *= 1.25;
    if (e.acidTimer > 0) dmg *= 1.25;
    if (src && src.type !== undefined && lastStandActive()) dmg *= 1.25;
    if (src && src.buffDmg > 1) dmg *= src.buffDmg;
    // Shields soak everything but poison and arcane; energy hits them twice as hard
    if (e.shieldHp > 0 && kind !== 'poison' && kind !== 'arcane') {
      const mul = kind === 'energy' ? 2 : 1;
      const absorb = Math.min(e.shieldHp, dmg * mul);
      e.shieldHp -= absorb;
      dmg -= absorb / mul;
      if (e.shieldHp <= 0) {
        playThrottled('shield', 'hit', { pitch: 1.7, volume: 0.45 }, 120);
        particles.burst(e.x, e.y - 6, 14, { color: '#7ae8ff', speed: 3, life: 0.4 });
        particles.glow(e.x, e.y - 6, e.radius * 2.5, '#5ad8ff', 0.25);
      }
    }
    // Armor takes a flat bite out of every hit (not out of poison, arcane or burns)
    if (dmg > 0 && kind !== 'poison' && kind !== 'arcane' && !(opts && opts.dot)) {
      const armor = Math.max(0, e.armor - e.shred) * (e.acidTimer > 0 ? 0.5 : 1) * (1 - ((opts && opts.pierce) || 0));
      if (armor > 0)
        dmg = Math.max(dmg * 0.25, dmg - armor);
    }
    e.hp -= dmg;
    if (opts && opts.area)
      e.revealTimer = Math.max(e.revealTimer, 2);
    if (!(opts && opts.dot))
      e.hitFlash = 0.1;

    if (src) {
      e.lastHitBy = src;
      src.dealt += dmg;
    }
    return dmg;
  }

  function lastStandActive() {
    return techLevel('laststand') > 0 && G.lives <= G.runStartLives * 0.3;
  }

  // New maps and previews
  function startLives() {
    return MAPS[G.currentMap].startLives + techLevel('fortify') * 3 + (hasRelic('scale') ? 5 : 0);
  }

  function applySlow(e, mul, time) {
    if (enemyFlags(e).boss) mul = 1 - (1 - mul) * 0.6;
    if (mul < e.slowMul || e.slowTimer <= 0) e.slowMul = Math.min(e.slowTimer > 0 ? e.slowMul : 1, mul);
    e.slowTimer = Math.max(e.slowTimer, time);
  }

  /* ── Spatial index: enemies bucketed by tile, rebuilt once a step after
     they move; enemies spawned in between are added straight away. Queries
     widen their search by the farthest an enemy can move in one step and
     then test live positions, so results match a scan of every enemy. Ties
     are broken by spawn order, which is also the order of `enemies`. ── */
  const GRID_MARGIN = 12;
  const enemyGrid = [];
  for (let i = 0; i < COLS * ROWS; ++i) enemyGrid.push([]);
  const gridOverflow = [];    // enemies outside the field (just spawned, flyers)
  let maxEnemyRadius = 8;

  function gridInsert(e) {
    const c = Math.floor(e.x / CELL), r = Math.floor(e.y / CELL);
    const cell = c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
    e._cell = cell;
    if (cell < 0) gridOverflow.push(e);
    else enemyGrid[cell].push(e);
    if (e.radius > maxEnemyRadius) maxEnemyRadius = e.radius;
  }

  function rebuildEnemyGrid() {
    for (let i = 0; i < enemyGrid.length; ++i) enemyGrid[i].length = 0;
    gridOverflow.length = 0;
    maxEnemyRadius = 8;
    for (const e of G.enemies)
      if (e.hp > 0) gridInsert(e);
  }

  // An enemy that changed tile since the rebuild is filed again under its new
  // tile; the stamp keeps a query from visiting it twice
  function gridMoved(e) {
    const c = Math.floor(e.x / CELL), r = Math.floor(e.y / CELL);
    const cell = c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
    if (cell !== e._cell) gridInsert(e);
  }

  let queryStamp = 0;
  // Calls visit(e) for every live enemy that may lie within r of (x, y)
  function forEnemiesAround(x, y, r, visit) {
    const stamp = ++queryStamp;
    const reach = r + maxEnemyRadius + GRID_MARGIN;
    const c0 = Math.max(0, Math.floor((x - reach) / CELL)), c1 = Math.min(COLS - 1, Math.floor((x + reach) / CELL));
    const r0 = Math.max(0, Math.floor((y - reach) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((y + reach) / CELL));
    for (let row = r0; row <= r1; ++row)
      for (let col = c0; col <= c1; ++col) {
        const b = enemyGrid[row * COLS + col];
        for (let i = 0; i < b.length; ++i) {
          const e = b[i];
          if (e.hp > 0 && e._q !== stamp) { e._q = stamp; visit(e); }
        }
      }
    for (let i = 0; i < gridOverflow.length; ++i) {
      const e = gridOverflow[i];
      if (e.hp > 0 && e._q !== stamp) { e._q = stamp; visit(e); }
    }
  }

  const bySeq = (a, b) => a._seq - b._seq;

  // Live enemies that may be within r of (x, y), in spawn order; callers test the exact distance
  function nearbyEnemies(x, y, r) {
    const out = [];
    forEnemiesAround(x, y, r, (e) => out.push(e));
    if (out.length > 1) out.sort(bySeq);
    return out;
  }

  function enemiesNear(x, y, r, filter) {
    const out = [];
    forEnemiesAround(x, y, r, (e) => {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= (r + e.radius) * (r + e.radius) && (!filter || filter(e)))
        out.push(e);
    });
    if (out.length > 1) out.sort(bySeq);
    return out;
  }
  /* ══════════════════════════════════════════════════════════════════
     TARGETING
     ══════════════════════════════════════════════════════════════════ */

  function canHit(s, e) {
    const f = enemyFlags(e);
    if (s.hits === 'ground' && f.flying) return false;
    if (s.hits === 'air' && !f.flying) return false;
    if (f.stealth && !e.revealed) return false;
    if (e.burrowT > 0) return false;
    return true;
  }

  // Phantoms show up while a true-sight tower has them in range or after area damage
  function updateReveal(dt) {
    for (const e of G.enemies) {
      if (!enemyFlags(e).stealth) continue;
      if (e.revealTimer > 0) e.revealTimer -= dt;
      let seen = e.revealTimer > 0;
      if (!seen && techLevel('scouts'))
        for (let i = 0; i < G.towers.length && !seen; ++i)
          if (Math.hypot(G.towers[i].x - e.x, G.towers[i].y - e.y) <= CELL * 1.5 + e.radius) seen = true;
      for (let i = 0; i < G.towers.length && !seen; ++i) {
        const t = G.towers[i];
        const s = towerStats(t);
        if ((s.trueSight || t.revealBuff) && Math.hypot(t.x - e.x, t.y - e.y) <= Math.max(s.rangePx, CELL) + e.radius)
          seen = true;
      }
      e.revealed = seen;
    }
  }

  function targetScore(mode, t, e) {
    switch (mode) {
      case 'last': return -e.dist;
      case 'strong': return e.hp + e.shieldHp;
      case 'close': return -Math.hypot(e.x - t.x, e.y - t.y);
      default: return e.dist - enemyPath(e).total;   // closest to its exit
    }
  }

  const targetScratch = [];
  function findTargets(t, s, count, exclude) {
    const r = s.rangePx;
    const minR = (s.minRange || 0) * CELL;
    const list = targetScratch;
    list.length = 0;
    forEnemiesAround(t.x, t.y, r, (e) => {
      if (!canHit(s, e) || (exclude && exclude.indexOf(e) >= 0)) return;
      const dx = e.x - t.x, dy = e.y - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > (r + e.radius * 0.5) * (r + e.radius * 0.5) || (minR && d2 < minR * minR)) return;
      list.push(e);
    });
    if (list.length <= 1)
      return list.slice();
    // Best score first; equal scores keep spawn order. Missiles go for flyers first.
    const score = (e) => targetScore(t.target, t, e) + (s.airBonus && enemyFlags(e).flying ? 1e7 : 0);
    if (count === 1) {
      let best = null, bs = -Infinity;
      for (const e of list) {
        const v = score(e);
        if (v > bs || (v === bs && e._seq < best._seq)) { bs = v; best = e; }
      }
      return [best];
    }
    const scored = list.map(e => [score(e), e]);
    scored.sort((a, b) => b[0] - a[0] || a[1]._seq - b[1]._seq);
    return scored.slice(0, count).map(p => p[1]);
  }

  NS.combat = { hurt, startLives, applySlow, gridInsert, rebuildEnemyGrid, gridMoved, nearbyEnemies,
      enemiesNear, canHit, updateReveal, findTargets };

})();
