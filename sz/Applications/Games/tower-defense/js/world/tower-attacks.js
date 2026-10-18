/* world/tower-attacks.js -- how every tower family fires, aura buffs and the per-step tower update.
   Reads: constants, towerTypes, env, effects, towerArt, paths, towers, waves, combat, projectiles, enemies and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { playThrottled, playShotSound } = NS.env;
  const { fxRandom, PK_PIXEL, emit, rnd, particles, floatingText, addDecal, addShake } = NS.effects;
  const { muzzleOf } = NS.towerArt;
  const { enemyPath, pathPos } = NS.paths;
  const { towerStats } = NS.towers;
  const { enemyFlags } = NS.waves;
  const { hurt, applySlow, nearbyEnemies, enemiesNear, canHit, findTargets } = NS.combat;

  /* ══════════════════════════════════════════════════════════════════
     TOWER ATTACKS
     ══════════════════════════════════════════════════════════════════ */

  function aimAt(t, e) {
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
  }

  function rollCrit(s) {
    return s.crit && Math.random() < s.crit ? s.critMul : 1;
  }

  function fireTower(t, s, def) {
    switch (s.kind) {
      case 'arrow': {
        const targets = findTargets(t, s, s.multishot || 1);
        if (!targets.length) return false;
        aimAt(t, targets[0]);
        const mz = muzzleOf(t);
        for (const e of targets)
          G.projectiles.push({ kind: 'arrow', x: mz.x, y: mz.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: def.color, trail: [] });
        aimAt(t, targets[0]);
        break;
      }
      case 'bolt': {
        if (s.aura) {
          const hit = enemiesNear(t.x, t.y, s.rangePx, e => canHit(s, e));
          if (!hit.length) return false;
          for (const e of hit) {
            hurt(e, s.damage, t, 'cold', { area: true });
            applySlow(e, 1 - s.slow, s.slowTime);
          }
          G.fxLines.push({ kind: 'ring', x: t.x, y: t.y, r: s.rangePx, color: '#bfeaff', t: 0, life: 0.45 });
          break;
        }
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        const mz = muzzleOf(t);
        G.projectiles.push({ kind: 'bolt', x: mz.x, y: mz.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: '#bfeaff', trail: [] });
        aimAt(t, e);
        break;
      }
      case 'shell': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        // Aim where the target will be when the shell lands
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.15;
        const lead = predictPos(e, flight);
        aimAt(t, e);
        const mz = muzzleOf(t);
        const salvo = s.salvo || 1;
        for (let k = 0; k < salvo; ++k) {
          const spread = salvo > 1 ? CELL * 0.9 : 0;
          const ox = salvo > 1 ? (Math.random() - 0.5) * spread * 2 : 0, oy = salvo > 1 ? (Math.random() - 0.5) * spread * 2 : 0;
          G.projectiles.push({ kind: 'shell', x: mz.x, y: mz.y, sx: mz.x, sy: mz.y, tx: lead.x + ox, ty: lead.y + oy, t: -k * 0.12, dur: flight, damage: s.damage, tower: t, s, color: '#ffb36a' });
        }
        break;
      }
      case 'skybolt': {
        const targets = findTargets(t, s, s.bolts || 1);
        if (!targets.length) return false;
        aimAt(t, targets[0]);
        for (const e of targets) {
          for (const o of enemiesNear(e.x, e.y, s.splashPx, q => canHit(s, q))) {
            hurt(o, s.damage * (o === e ? 1 : 0.5), t, 'energy', { area: o !== e });
            if (s.stun && !enemyFlags(o).boss) o.stunTimer = Math.max(o.stunTimer, s.stun);
          }
          G.fxLines.push({ kind: 'sky', pts: [{ x: e.x + (fxRandom() - 0.5) * 30, y: e.y - 240 }, { x: e.x, y: e.y - e.radius * 0.5 }], color: '#d8c8ff', t: 0, life: 0.28, seed: fxRandom() * 1000 });
          particles.glow(e.x, e.y - 4, 30, '#c8b8ff', 0.25);
          particles.sparks(e.x, e.y - 4, 6, '#e8e0ff', 160);
          addDecal(e.x, e.y + 3, 7, 'scorch');
        }
        addShake(2, 90);
        playThrottled('thunder', 'thud', { pitch: 0.7, volume: 0.6 }, 150);
        break;
      }
      case 'gust': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        aimAt(t, e);
        const cosCone = Math.cos(s.cone);
        const ax = Math.cos(t.angle), ay = Math.sin(t.angle);
        for (const o of nearbyEnemies(t.x, t.y, s.rangePx)) {
          if (o.hp <= 0 || !canHit(s, o)) continue;
          const dx = o.x - t.x, dy = o.y - t.y;
          const d = Math.hypot(dx, dy);
          if (d > s.rangePx + o.radius) continue;
          if (d > 6 && (dx * ax + dy * ay) / d < cosCone) continue;
          hurt(o, s.damage, t, 'phys', { area: true });
          const f = enemyFlags(o);
          if (!f.boss) {
            // Every gust an enemy weathers makes the next one weaker, so nothing is held forever
            o.pushRes = o.pushRes || 0;
            o.dist = Math.max(0, o.dist - s.push * (f.armor >= 8 ? 0.4 : 1) / (1 + o.pushRes));
            o.pushRes += 0.35;
            if (s.stun) o.stunTimer = Math.max(o.stunTimer, s.stun);
          }
        }
        G.fxLines.push({ kind: 'gust', x: t.x, y: t.y - 8, r: s.rangePx, a: t.angle, cone: s.cone, color: '#e8fff8', t: 0, life: 0.45 });
        playThrottled('gust', 'whoosh', { pitch: 1.6, volume: 0.35 }, 140);
        break;
      }
      case 'missile': {
        const targets = findTargets(t, s, s.multishot || 1);
        if (!targets.length) return false;
        aimAt(t, targets[0]);
        const mz = muzzleOf(t);
        targets.forEach((e, k) => {
          const a = t.angle + (k - (targets.length - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3;
          G.projectiles.push({ kind: 'missile', x: mz.x, y: mz.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: '#ffffff', trail: [], t: 0 });
        });
        break;
      }
      case 'orb': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        const mz = muzzleOf(t);
        G.projectiles.push({ kind: 'orb', x: mz.x, y: mz.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: '#e070ff', trail: [], bounces: s.bounces || 0, hit: [] });
        break;
      }
      case 'glob': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.1;
        const lead = predictPos(e, flight);
        const mz = muzzleOf(t);
        G.projectiles.push({ kind: 'glob', x: mz.x, y: mz.y, sx: mz.x, sy: mz.y, tx: lead.x, ty: lead.y, t: 0, dur: flight, damage: s.damage, tower: t, s, color: '#7ce35a' });
        aimAt(t, e);
        break;
      }
      case 'chain': {
        const first = findTargets(t, s, 1)[0];
        if (!first) return false;
        const hit = [first];
        const pts = [{ x: t.x, y: t.y - 10 }, { x: first.x, y: first.y }];
        let cur = first;
        for (let i = 1; i < s.chains; ++i) {
          let best = null, bd = s.chainPx;
          for (const e of nearbyEnemies(cur.x, cur.y, s.chainPx)) {
            if (e.hp <= 0 || hit.indexOf(e) >= 0 || !canHit(s, e)) continue;
            const d = Math.hypot(e.x - cur.x, e.y - cur.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hit.push(best);
          pts.push({ x: best.x, y: best.y });
          cur = best;
        }
        hit.forEach((e, i) => {
          hurt(e, s.damage * Math.pow(0.85, i), t, 'energy', { area: i > 0 });
          if (s.stun) e.stunTimer = Math.max(e.stunTimer, s.stun * (i === 0 ? 1 : 0.5));
          particles.sparks(e.x, e.y - 6, 3, '#bff4ff', 120);
        });
        const m0 = muzzleOf(t);
        pts[0] = { x: m0.x, y: m0.y };
        G.fxLines.push({ kind: 'zap', pts, color: '#bff4ff', t: 0, life: 0.18, seed: fxRandom() * 1000 });
        aimAt(t, first);
        break;
      }
      case 'flame': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        aimAt(t, e);
        const cosCone = Math.cos(s.cone);
        const ax = Math.cos(t.angle), ay = Math.sin(t.angle);
        for (const o of nearbyEnemies(t.x, t.y, s.rangePx)) {
          if (o.hp <= 0 || !canHit(s, o)) continue;
          const dx = o.x - t.x, dy = o.y - t.y;
          const d = Math.hypot(dx, dy);
          if (d > s.rangePx + o.radius) continue;
          if (d > 6 && (dx * ax + dy * ay) / d < cosCone) continue;
          hurt(o, s.damage, t, 'fire', { area: true });
          if (o.burnTimer <= 0 || s.burn >= o.burnDps) {
            o.burnDps = s.burn;
            o.burnTimer = s.burnTime;
            o.burnSrc = t;
          }
          if (s.melt) o.shred = Math.max(o.shred, s.melt);
          if (s.lava && Math.random() < 0.08)
            NS.projectiles.addFloorEffect(Math.floor(o.x / CELL), Math.floor(o.y / CELL), 'lava', 5, s.lava);
        }
        t.flameT = 0.25;
        if (fxRandom() < 0.5) {
          const m = muzzleOf(t);
          const a = t.angle + rnd(-s.cone, s.cone) * 0.7, v = rnd(80, 150);
          emit(m.x, m.y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.45), 2, fxRandom() < 0.5 ? '#ffd06a' : '#ff6a1a', PK_PIXEL, -40, 2);
        }
        break;
      }
      case 'beam': {
        const n = s.beams || 1;
        const targets = findTargets(t, s, n);
        if (!targets.length) {
          t.beamTargets = [];
          t.beamTime = 0;
          return false;
        }
        if (targets[0] !== t.beamTargets[0])
          t.beamTime = 0;
        t.beamTargets = targets;
        aimAt(t, targets[0]);
        return true;
      }
      case 'snipe': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        aimAt(t, e);
        const crit = rollCrit(s);
        const ex = t.x + Math.cos(t.angle) * s.rangePx * (s.rail ? 1.4 : 0), ey = t.y + Math.sin(t.angle) * s.rangePx * (s.rail ? 1.4 : 0);
        if (s.rail) {
          // Every enemy on the line takes the hit
          // The slug loses a fifth of its force with every enemy it passes through
          const ax = Math.cos(t.angle), ay = Math.sin(t.angle);
          const line = [];
          for (const o of nearbyEnemies(t.x, t.y, s.rangePx * 1.4)) {
            if (o.hp <= 0 || !canHit(s, o)) continue;
            const dx = o.x - t.x, dy = o.y - t.y;
            const along = dx * ax + dy * ay;
            if (along < 0 || along > s.rangePx * 1.4) continue;
            if (Math.abs(dx * ay - dy * ax) <= o.radius + 4) line.push([along, o]);
          }
          line.sort((a, b) => a[0] - b[0]);
          line.forEach(([, o], k) => hurt(o, s.damage * crit * Math.pow(0.8, k), t, 'phys', { pierce: s.pierce }));
          G.fxLines.push({ kind: 'tracer', pts: [muzzleOf(t), { x: ex, y: ey }], color: '#9ad8ff', t: 0, life: 0.3, w: 4 });
        } else {
          if (s.execute && e.hp - s.damage * crit <= e.maxHp * s.execute && !enemyFlags(e).boss) {
            hurt(e, e.hp + e.shieldHp + 999, t, 'phys', { pierce: 1 });
            floatingText.add(e.x, e.y - 14, 'EXECUTE', { color: '#ff5a5a', font: 'bold 11px sans-serif' });
            playThrottled('crit', 'hit', { pitch: 0.8, volume: 0.5 }, 120);
          } else
            hurt(e, s.damage * crit, t, 'phys', { pierce: s.pierce });
          G.fxLines.push({ kind: 'tracer', pts: [muzzleOf(t), { x: e.x, y: e.y - e.radius * 0.5 }], color: '#ffffff', t: 0, life: 0.18, w: 2 });
          if (crit > 1) {
            floatingText.add(e.x, e.y - 14, 'CRIT', { color: '#ffd75a', font: 'bold 11px sans-serif' });
            playThrottled('crit', 'hit', { pitch: 1.3, volume: 0.4 }, 120);
          }
        }
        break;
      }
      default:
        return false;
    }
    t.flash = 0.1;
    t.recoil = 1;
    playShotSound(def);
    return true;
  }

  function predictPos(e, time) {
    const path = enemyPath(e);
    const sp = NS.enemies.enemySpeed(e);
    const out = { x: 0, y: 0, angle: 0 };
    return pathPos(path, Math.min(path.total, e.dist + sp * time), out);
  }

  // Beacons inspire the towers around them (the best beacon counts, they do not stack)
  let buffVersion = -1;
  function updateBuffs() {
    if (buffVersion === G.towerVersion) return;
    buffVersion = G.towerVersion;
    for (const t of G.towers) {
      t.buffDmg = 1;
      t.buffRate = 1;
      t.revealBuff = false;
    }
    for (const b of G.towers) {
      const bs = towerStats(b);
      if (bs.kind !== 'support') continue;
      for (const t of G.towers) {
        if (t === b || towerStats(t).kind === 'support') continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) > bs.rangePx + 2) continue;
        t.buffDmg = Math.max(t.buffDmg, 1 + bs.buffDmg);
        t.buffRate = Math.max(t.buffRate, 1 + bs.buffRate);
        if (bs.reveal) t.revealBuff = true;
      }
    }
  }

  function updateTowers(dt) {
    updateBuffs();
    for (const t of G.towers) {
      const def = TOWER_TYPES[t.type];
      const s = towerStats(t);
      t.flash = Math.max(0, t.flash - dt);
      t.recoil = Math.max(0, t.recoil - dt * 6);
      if (t.flameT) t.flameT = Math.max(0, t.flameT - dt);
      if (s.kind === 'mine' || s.kind === 'trap' || s.kind === 'support') continue;
      if (t.jamT > 0) {
        t.jamT -= dt;
        t.beamTargets = [];
        continue;
      }
      if (s.kind === 'beam') {
        fireTower(t, s, def);
        if (t.beamTargets.length) {
          t.beamTime += dt;
          const ramp = 1 + (s.ramp - 1) * Math.min(1, t.beamTime / s.rampTime);
          for (let i = 0; i < t.beamTargets.length; ++i) {
            const e = t.beamTargets[i];
            if (e.hp <= 0) continue;
            hurt(e, s.damage * (i === 0 ? ramp : 1) * dt, t, 'energy', { pierce: s.pierce, dot: true });
            if (G.fxBudget > 0 && fxRandom() < dt * 14)
              particles.sparks(e.x, e.y - e.radius * 0.6, 1, i === 0 && ramp > 2 ? '#ffffff' : TOWER_TYPES[t.type].color, 110);
          }
          t.beamSound = (t.beamSound || 0) - dt;
          if (t.beamSound <= 0) {
            t.beamSound = 0.6;
            playShotSound(def);
          }
        }
        continue;
      }
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        if (fireTower(t, s, def))
          t.cooldown = s.reload / (t.buffRate || 1);
        else
          t.cooldown = 0.05;
      }
    }
  }

  NS.towerAttacks = { rollCrit, updateTowers };

})();
