/* world/projectiles.js -- projectiles, missiles, explosions, poison clouds, burning and icy ground, short-lived beams.
   Reads: constants, env, effects, abilities, waves, combat, towerAttacks and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, TWO_PI, clamp } = NS.constants;
  const { playThrottled } = NS.env;
  const { fxRandom, PK_SMOKE, emit, particles, floatingText, addDecal, explosionFx } = NS.effects;
  const { airbombHit } = NS.abilities;
  const { enemyFlags } = NS.waves;
  const { hurt, applySlow, nearbyEnemies, enemiesNear, canHit, findTargets } = NS.combat;
  const { rollCrit } = NS.towerAttacks;

  /* ══════════════════════════════════════════════════════════════════
     PROJECTILES
     ══════════════════════════════════════════════════════════════════ */

  // Rockets steer towards their target, accelerating as they go
  function updateMissile(p, i, dt) {
    p.t += dt;
    let t = p.target;
    if (!t || t.hp <= 0) {
      // Pick a new target nearby or fizzle out
      t = p.target = findTargets({ x: p.x, y: p.y, target: 'close' }, p.s, 1)[0];
      if (!t) {
        G.projectiles.splice(i, 1);
        particles.smoke(p.x, p.y, 2, '#8a8a8a', 5);
        return;
      }
    }
    const tx = t.x, ty = t.y - (enemyFlags(t).flying ? 12 : 4);
    const dx = tx - p.x, dy = ty - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = Math.min(p.speed * 1.8, p.speed * (0.5 + p.t * 1.6));
    const steer = Math.min(1, dt * 7);
    p.vx += (dx / dist * speed - p.vx) * steer;
    p.vy += (dy / dist * speed - p.vy) * steer;
    const step = Math.hypot(p.vx, p.vy) * dt;
    p.trail.push(p.x, p.y);
    if (p.trail.length > 12) p.trail.splice(0, 2);
    if (G.fxBudget > 0 && fxRandom() < dt * 20)
      emit(p.x, p.y, (fxRandom() - 0.5) * 10, (fxRandom() - 0.5) * 10, 0.5, 4, '#8a8580', PK_SMOKE, -6, 1);
    if (dist <= step + t.radius + 2 || p.t > 4) {
      G.projectiles.splice(i, 1);
      const s = p.s;
      const mul = enemyFlags(t).flying ? s.airBonus || 1 : 1;
      explode(t.x, t.y, Math.max(s.splashPx, CELL * 0.5), p.damage * mul, p.tower, s);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  function explode(x, y, radius, damage, src, s) {
    for (const e of enemiesNear(x, y, radius, o => canHit(s, o))) {
      const d = Math.hypot(e.x - x, e.y - y);
      const fall = d < radius * 0.4 ? 1 : 0.6;
      hurt(e, damage * fall, src, 'phys', { pierce: s.pierce || 0, area: true });
      if (s.shred) e.shred = Math.max(e.shred, s.shred);
      if (s.stun && !enemyFlags(e).boss) e.stunTimer = Math.max(e.stunTimer, s.stun);
      if (s.burn && (e.burnTimer <= 0 || s.burn >= e.burnDps)) {
        e.burnDps = s.burn;
        e.burnTimer = s.burnTime || 2;
        e.burnSrc = src;
      }
    }
    if (s.lava) {
      const c0 = Math.floor(x / CELL), r0 = Math.floor(y / CELL);
      for (let dr = -1; dr <= 1; ++dr)
        for (let dc = -1; dc <= 1; ++dc)
          if (Math.abs(dc) + Math.abs(dr) <= 1)
            addFloorEffect(c0 + dc, r0 + dr, 'lava', 4, s.lava);
    }
    explosionFx(x, y, radius, s.bomblets && radius < CELL ? '#ffcf6a' : '#ff8a3a');
    if (radius >= CELL)
      playThrottled('boom', 'smallExplode', { pitch: 0.7 + fxRandom() * 0.2, volume: radius > CELL * 1.5 ? 0.6 : 0.4 }, 90);
    else
      playThrottled('pop', 'hit', { pitch: 1.4 + fxRandom() * 0.3, volume: 0.25 }, 60);
  }

  function updateProjectiles(dt) {
    for (let i = G.projectiles.length - 1; i >= 0; --i) {
      const p = G.projectiles[i];
      if (p.kind === 'shell' || p.kind === 'glob' || p.kind === 'bomblet' || p.kind === 'airbomb') {
        p.t += dt;
        const k = clamp(p.t / p.dur, 0, 1);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        p.z = p.kind === 'airbomb' ? (1 - k * k) * 70 : Math.sin(k * Math.PI) * Math.min(70, 20 + p.dur * 60) * (p.kind === 'bomblet' ? 0.4 : 1);
        if (k >= 1) {
          G.projectiles.splice(i, 1);
          if (p.kind === 'airbomb') {
            airbombHit(p);
            continue;
          }
          if (p.kind === 'glob') {
            particles.burst(p.tx, p.ty, 8, { color: p.s.acid ? '#c8ff4a' : '#7ce35a', speed: 2, life: 0.4 });
            addDecal(p.tx, p.ty, p.s.cloudPx * 0.5, 'slime');
          }
          if (p.kind === 'glob')
            G.clouds.push({ x: p.tx, y: p.ty, r: p.s.cloudPx, t: 0, life: p.s.cloudTime, dps: p.s.cloudDps, acid: !!p.s.acid, plague: !!p.s.plague, tower: p.tower, seed: fxRandom() * 100 });
          else {
            explode(p.tx, p.ty, p.kind === 'bomblet' ? CELL * 0.6 : p.s.splashPx, p.damage, p.tower, p.s);
            if (p.kind === 'shell' && p.s.bomblets) {
              for (let b = 0; b < p.s.bomblets; ++b) {
                const a = (b / p.s.bomblets) * TWO_PI + Math.random() * 0.5;
                const r = p.s.splashPx * (0.8 + Math.random() * 0.6);
                G.projectiles.push({ kind: 'bomblet', x: p.tx, y: p.ty, sx: p.tx, sy: p.ty, tx: p.tx + Math.cos(a) * r, ty: p.ty + Math.sin(a) * r, t: 0, dur: 0.35 + Math.random() * 0.15, damage: p.damage * 0.3, tower: p.tower, s: p.s, color: '#ffcf6a' });
              }
            }
          }
        }
        continue;
      }
      if (p.kind === 'missile') {
        updateMissile(p, i, dt);
        continue;
      }
      const t = p.target;
      if (!t || t.hp <= 0) {
        G.projectiles.splice(i, 1);
        continue;
      }
      p.trail.push(p.x, p.y);
      if (p.trail.length > 10) p.trail.splice(0, 2);
      const dx = t.x - p.x, dy = t.y - p.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= move + t.radius) {
        G.projectiles.splice(i, 1);
        const s = p.s;
        if (p.kind === 'arrow') {
          particles.sparks(t.x, t.y - 6, 2, '#fff0c0', 90);
          const crit = rollCrit(s);
          hurt(t, p.damage * crit, p.tower, 'phys', { pierce: s.pierce || 0 });
          if (crit > 1) {
            floatingText.add(t.x, t.y - 14, 'CRIT', { color: '#ffd75a', font: 'bold 10px sans-serif' });
            playThrottled('crit', 'hit', { pitch: 1.3, volume: 0.4 }, 120);
          }
        } else if (p.kind === 'orb') {
          const extra = s.maxHpDmg * t.maxHp * (enemyFlags(t).boss ? 0.6 : 1);
          hurt(t, p.damage + extra, p.tower, 'arcane');
          particles.burst(t.x, t.y - 6, 8, { color: '#e8a0ff', speed: 2, life: 0.35 });
          particles.glow(t.x, t.y - 6, 16, '#e070ff', 0.25);
          playThrottled('arcane', 'blip', { pitch: 0.9, volume: 0.3 }, 110);
          p.hit.push(t);
          if (p.bounces > 0) {
            let next = null, bd = CELL * 2.6;
            for (const o of nearbyEnemies(t.x, t.y, CELL * 2.6)) {
              if (o.hp <= 0 || p.hit.indexOf(o) >= 0 || !canHit(s, o)) continue;
              const d = Math.hypot(o.x - t.x, o.y - t.y);
              if (d < bd) { bd = d; next = o; }
            }
            if (next)
              G.projectiles.push({ kind: 'orb', x: t.x, y: t.y - 6, target: next, speed: p.speed * 1.2, damage: p.damage * 0.8, tower: p.tower, s, color: p.color, trail: [], bounces: p.bounces - 1, hit: p.hit });
          }
        } else if (p.kind === 'bolt') {
          particles.flakes(t.x, t.y - 6, 4);
          hurt(t, p.damage, p.tower, 'cold');
          applySlow(t, 1 - s.slow, s.slowTime);
          if (s.freeze && Math.random() < s.freeze && !enemyFlags(t).boss) {
            t.freezeTimer = s.freezeTime;
            particles.flakes(t.x, t.y - 6, 10);
            playThrottled('freeze', 'blip', { pitch: 2.2, volume: 0.3 }, 150);
            particles.glow(t.x, t.y - 6, 18, '#bfeaff', 0.3);
            if (Math.random() < 0.5)
              addFloorEffect(Math.floor(t.x / CELL), Math.floor(t.y / CELL), 'ice', 4, 0);
          }
        }
      } else {
        p.x += dx / dist * move;
        p.y += dy / dist * move;
      }
    }
  }

  function updateClouds(dt) {
    for (let i = G.clouds.length - 1; i >= 0; --i) {
      const c = G.clouds[i];
      c.t += dt;
      if (c.t >= c.life) {
        G.clouds.splice(i, 1);
        continue;
      }
      for (const e of enemiesNear(c.x, c.y, c.r)) {
        hurt(e, c.dps * dt, c.tower, 'poison', { dot: true, area: true });
        e.poisonTimer = Math.max(e.poisonTimer, 0.6);
        if (c.acid) e.acidTimer = Math.max(e.acidTimer, 1.2);
        if (c.plague) e.plague = c.tower;
      }
    }
  }

  function addFloorEffect(col, row, type, time, damage) {
    if (!G.pathCells.has(`${col},${row}`)) return;
    const existing = G.floorEffects.find(fe => fe.col === col && fe.row === row && fe.type === type);
    if (existing) {
      existing.timer = Math.max(existing.timer, time);
      existing.damage = Math.max(existing.damage, damage);
      return;
    }
    if (G.floorEffects.length > 60) return;
    G.floorEffects.push({ col, row, x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, type, timer: time, damage });
  }

  function updateFloorEffects(dt) {
    for (let i = G.floorEffects.length - 1; i >= 0; --i) {
      G.floorEffects[i].timer -= dt;
      if (G.floorEffects[i].timer <= 0)
        G.floorEffects.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (let i = G.fxLines.length - 1; i >= 0; --i) {
      G.fxLines[i].t += dt;
      if (G.fxLines[i].t >= G.fxLines[i].life)
        G.fxLines.splice(i, 1);
    }
  }

  NS.projectiles = { updateProjectiles, updateClouds, addFloorEffect, updateFloorEffects, updateFx };

})();
