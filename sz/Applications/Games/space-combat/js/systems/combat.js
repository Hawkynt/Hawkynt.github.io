/* Combat resolution: the per-step spatial grid of everything the player can hit, shot and body
   collisions, damage routing (ships, frigate shield arcs, cloak reveal, boss core and parts,
   rocks, mines, allies), area blasts and burning zones, kills with explosions, drops, score,
   combo and multiplier. Owns the grid, G.zones, G.score, G.combo and the kill counters. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { GRID_CELL, COMBO_WINDOW } = NS.constants;
  const { createGrid, compact } = NS.grid;
  const { angleDiff } = NS.rng;
  const R = NS.rng.fx;
  const { comboMultiplier } = NS.rules;
  const fx = NS.fx;
  const { sfx, sfxAt } = NS.audio;

  const grid = createGrid(3400, 3400, GRID_CELL);
  const near = [];

  function resetGrid(w, h) {
    grid.reset(w, h);
  }

  function rebuildGrid() {
    grid.clear();
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive && e.spawnT <= 0) grid.insert(e);
    }
    const b = G.boss;
    if (b && b.alive && !b.dying) {
      if (b.fadeT < 0.5) grid.insert(b);
      for (let i = 0; i < b.parts.length; ++i)
        if (b.parts[i].alive) grid.insert(b.parts[i]);
    }
    for (let i = 0; i < G.rocks.length; ++i) grid.insert(G.rocks[i]);
    for (let i = 0; i < G.mines.length; ++i) grid.insert(G.mines[i]);
  }

  /* ── damage routing ── */
  function hit(t, dmg, x, y, ang, opts) {
    if (!t.alive) return false;
    switch (t.kind) {
      case 'enemy':
      case 'station':
        return damageEnemy(t, dmg, x, y, ang, opts || {});
      case 'boss':
        return NS.bosses.hitCore(t, dmg, x, y, ang);
      case 'part':
        return NS.bosses.hitPart(t, dmg);
      case 'rock':
        return NS.hazards.hitRock(t, dmg, x, y);
      case 'mine':
        return NS.hazards.hitMine(t, dmg);
    }
    return false;
  }

  function damageEnemy(e, dmg, x, y, ang, opts) {
    if (e.spawnT > 0) return false;
    /* frigates shrug off anything that arrives inside their front arc */
    if (e.def.shieldArc && e.stun <= 0 && !opts.shieldBreak && ang !== undefined && !opts.blast) {
      if (Math.abs(angleDiff(e.angle, ang)) < e.def.shieldArc) {
        e.shieldHit = 1;
        if (R() < 0.5) fx.sparks(x, y, ang, 1, 2, '#9ad8ff', 240, 0.18);
        return false;
      }
    }
    if (e.def.ai === 'cloak' && e.mode === 0) {
      e.mode = 1;
      e.modeT = 0.3;
    }
    if (opts.stun) e.stun = Math.max(e.stun, opts.stun);
    e.hp -= dmg;
    e.flash = 0.06;
    if (opts.crit && R() < 0.6) fx.text(x, y - 12, 'CRIT', '#ffd25a', 12, 0.45);
    if (e.hp <= 0) kill(e, 'player');
    return true;
  }

  function kill(e, cause) {
    if (!e.alive) return;
    e.alive = false;
    const big = e.r >= 40;
    const ramp = e.type === 'cloaker' ? fx.VIOLET : e.type === 'drone' ? fx.TOXIC : fx.FIRE;
    fx.explode(e.x, e.y, e.r * (big ? 1.5 : 1.1), ramp, { debrisColor: '#6a5050' });
    if (big) {
      fx.explode(e.x + (R() - 0.5) * e.r, e.y + (R() - 0.5) * e.r, e.r * 0.8, fx.FIRE);
      fx.hitStop(0.07);
      fx.flash('#ffe0c0', 0.18);
    }
    sfxAt(big ? 'explode' : 'smallExplode', e.x, e.y, { volume: big ? 1 : 0.7, pitch: 0.9 + R() * 0.3 });
    if (cause === null) return;
    ++G.kills;
    ++G.save.stats.kills;
    G.combo += 1;
    G.comboT = COMBO_WINDOW;
    if (G.combo > G.bestCombo) G.bestCombo = G.combo;
    const m = comboMultiplier(G.combo);
    if (m > G.multiplier) {
      fx.text(G.player ? G.player.x : e.x, (G.player ? G.player.y : e.y) - 50, 'x' + m + ' COMBO', '#ff9ab8', 20, 1.1);
      sfx('levelup', { pitch: 1 + m * 0.08, volume: 0.5 });
    }
    G.multiplier = m;
    addScore(e.def.score * e.scoreMul, e.x, e.y);
    NS.pickups.dropScrap(e.x, e.y, e.def.scrap);
    NS.pickups.dropPowerup(e.x, e.y, false, big ? 0.5 : 0.07);
    if (e.objective) NS.missions.outpostDestroyed(e);
  }

  function addScore(points, x, y, quiet) {
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const v = Math.round(points * G.multiplier * (mut && mut.score ? mut.score : 1));
    G.score += v;
    if (!quiet) fx.text(x, y - 16, '+' + v, G.multiplier > 1 ? '#ffd25a' : '#ffffff', v >= 1000 ? 20 : 14, 0.8);
  }

  /* Area damage around a point; team 'player' or 'hazard' hurts hostiles */
  function blast(x, y, radius, dmg, team, opts) {
    grid.query(x, y, radius, near);
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (!t.alive) continue;
      const dx = t.x - x, dy = t.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius + t.r) continue;
      const k = 1 - 0.5 * Math.min(1, d / radius);
      if (opts.push && t.vx !== undefined && t.kind === 'enemy' && t.def.speed > 0) {
        t.vx += dx / (d || 1) * opts.push;
        t.vy += dy / (d || 1) * opts.push;
      }
      if (t.kind === 'mine' && team === 'hazard') continue;
      hit(t, dmg * k, t.x, t.y, Math.atan2(-dy, -dx), { stun: opts.stun, shieldBreak: opts.shieldBreak, blast: true });
    }
  }

  /* A kamikaze swarmer goes off: it hurts the player and allies, never its own side */
  function droneBlast(e) {
    const bl = e.def.blast;
    const p = G.player;
    if (p && p.alive) {
      const dx = p.x - e.x, dy = p.y - e.y;
      if (dx * dx + dy * dy < (bl.radius + p.r) * (bl.radius + p.r))
        NS.player.damage(bl.dmg * (G.stage ? G.stage.dmgMul : 1), e.x, e.y);
    }
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      const dx = a.x - e.x, dy = a.y - e.y;
      if (a.alive && dx * dx + dy * dy < (bl.radius + a.r) * (bl.radius + a.r)) damageAlly(a, bl.dmg);
    }
    fx.ring(e.x, e.y, 10, bl.radius, 0.3, '#a0ff90', 4);
    kill(e, null);
  }

  function damageAlly(a, dmg) {
    if (!a.alive) return;
    a.hp -= dmg;
    a.flash = 0.08;
    a.hurtT = 1.5;
    if (a.hp <= 0) {
      a.hp = 0;
      a.alive = false;
      fx.explode(a.x, a.y, a.r * 1.8, fx.FIRE);
      fx.explode(a.x, a.y, a.r, fx.PLASMA);
      fx.shake(0.8);
      sfx('explode');
      NS.missions.allyDestroyed(a);
    }
  }

  /* ── per-step collisions ── */
  function collide(dt) {
    playerShots();
    enemyShots();
    bodies();
    zones(dt);
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) {
        G.combo = 0;
        G.multiplier = 1;
      }
    }
  }

  function playerShots() {
    const list = G.pBullets;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (!b.alive || b.kind === 'pmine') continue;
      grid.query(b.x, b.y, b.r, near);
      for (let j = 0; j < near.length; ++j) {
        const t = near[j];
        if (!t.alive) continue;
        const dx = t.x - b.x, dy = t.y - b.y;
        const rr = t.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const ang = Math.atan2(-b.vy, -b.vx);
        if (b.kind === 'missile') {
          b.life = 0;
          b.alive = false;
          NS.projectiles.detonate(b);
        } else if (b.kind === 'flak') {
          b.life = 0;
          break;
        } else {
          const landed = hit(t, b.dmg, b.x, b.y, ang, { crit: b.crit });
          if (landed) fx.hitSpark(b.x, b.y, ang, NS.ships.COLORS[b.color][1]);
          else if (t.kind !== 'enemy') fx.hitSpark(b.x, b.y, ang, '#9ad8ff');
          b.alive = false;
        }
        break;
      }
    }
  }

  function enemyShots() {
    const p = G.player;
    const live = p && p.alive;
    for (let i = 0; i < G.eBullets.length; ++i) {
      const b = G.eBullets[i];
      if (!b.alive) continue;
      if (live) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const rr = p.r + b.r - 3;
        if (dx * dx + dy * dy < rr * rr) {
          if (p.aegis > 0) {
            /* reflected back as a player shot */
            b.alive = false;
            const a = Math.atan2(b.y - p.y, b.x - p.x) + (R() - 0.5) * 0.3;
            const s = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 1.6 + 200;
            NS.projectiles.player('bolt', b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 1, b.dmg * 2, 5, 'gold');
            fx.hitSpark(b.x, b.y, a, '#ffd27a');
            continue;
          }
          if (p.iframes > 0) continue;
          b.alive = false;
          NS.player.damage(b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
          fx.hitSpark(b.x, b.y, Math.atan2(-b.vy, -b.vx), '#ff9a8a');
          continue;
        }
      }
      for (let j = 0; j < G.allies.length; ++j) {
        const a = G.allies[j];
        if (!a.alive) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < (a.r + b.r) * (a.r + b.r)) {
          b.alive = false;
          damageAlly(a, b.dmg * 0.7);
          fx.hitSpark(b.x, b.y, Math.atan2(-b.vy, -b.vx), '#ff9a8a');
          break;
        }
      }
    }
  }

  /* ramming: ships bump the player; a dodge roll with Ram Field hurts them instead */
  function bodies() {
    const p = G.player;
    if (!p || !p.alive) return;
    grid.query(p.x, p.y, p.r + 10, near);
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (!t.alive || t.kind === 'rock') continue;
      const dx = p.x - t.x, dy = p.y - t.y;
      const min = p.r + t.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      if (t.kind === 'mine') {
        NS.hazards.detonateMine(t);
        continue;
      }
      const d = Math.sqrt(d2) || 1;
      p.x = t.x + dx / d * min;
      p.y = t.y + dy / d * min;
      p.vx += dx / d * 260;
      p.vy += dy / d * 260;
      if (p.rollT > 0 && G.stats.ram > 0) {
        if (!p.ramHit[t.id || t.kind]) {
          p.ramHit[t.id || t.kind] = true;
          hit(t, G.stats.ram * G.stats.dmgMul, p.x, p.y, Math.atan2(dy, dx), { blast: true });
          fx.shockwave(t.x, t.y, 60, '#ffd27a');
        }
      } else if (t.kind === 'enemy' && t.def.ai !== 'kamikaze') {
        NS.player.damage(8, t.x, t.y);
      } else if (t.kind === 'boss' || t.kind === 'part' || t.kind === 'station') {
        NS.player.damage(12, t.x, t.y);
      }
    }
  }

  function zones(dt) {
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      z.t += dt;
      if (z.t >= z.life) { z.alive = false; continue; }
      grid.query(z.x, z.y, z.r, near);
      for (let j = 0; j < near.length; ++j) {
        const t = near[j];
        if (!t.alive || t.kind === 'mine') continue;
        const dx = t.x - z.x, dy = t.y - z.y;
        if (dx * dx + dy * dy < (z.r + t.r) * (z.r + t.r))
          hit(t, z.dps * dt * G.stats.dmgMul, t.x, t.y, undefined, { blast: true });
      }
      if (z.kind === 'burn' && R() < 0.3) {
        const e = fx.spawn(fx.EMBER, z.x + (R() - 0.5) * z.r, z.y + (R() - 0.5) * z.r, 0, -20, 0.5, 3, '#ff8a2a');
        if (e) e.ramp = fx.FIRE;
      }
    }
    compact(G.zones);
  }

  function resetScore() {
    G.score = 0;
    G.combo = 0;
    G.comboT = 0;
    G.multiplier = 1;
    G.bestCombo = 0;
    G.kills = 0;
    G.runScrap = 0;
  }

  Object.assign(NS.combat, {
    grid, resetGrid, rebuildGrid, hit, kill, addScore, blast, droneBlast, damageAlly, collide, resetScore
  });
})();
