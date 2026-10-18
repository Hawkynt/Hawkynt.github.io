/* Hostile ships: spawning with a warp-in, target choice (player, freighter or station), the ten
   behaviours (strafe, pursue, kamikaze, bomber, turret, station, frigate, cloak, carrier,
   lancer), burst fire, separation, stun and time warp. Owns G.enemies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { MAX_ENEMIES, TAU } = NS.constants;
  const { ENEMIES } = NS.enemyData;
  const { turnToward, angleDiff, segPointDist2 } = NS.rng;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfxAt } = NS.audio;

  const near = [];

  function spawn(type, x, y, opts) {
    if (G.enemies.length >= MAX_ENEMIES) return null;
    const def = ENEMIES[type];
    const st = G.stage;
    const hpMul = (st ? st.hpMul : 1) * (opts && opts.hpMul || 1);
    const e = {
      alive: true, kind: type === 'station' ? 'station' : 'enemy', type: type, def: def, id: ++G.nextId,
      x: x, y: y, vx: 0, vy: 0, angle: R() * TAU, r: def.r,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul, flash: 0, t: 0,
      cd: 1 + R() * (def.fire ? def.fire.rate : 2), burst: 0, burstT: 0,
      stun: 0, cloak: 1, mode: 0, modeT: 2 + R() * 2, orbitDir: R() < 0.5 ? -1 : 1,
      target: null, focusAlly: R() < 0.35, spawnT: opts && opts.instant ? 0 : 0.6,
      spawnCd: def.spawn ? def.spawn.every * (0.5 + R() * 0.5) : 0, spawnAlt: false,
      charge: 0, beamA: 0, shieldHit: 0, parent: opts && opts.parent || null,
      objective: !!(opts && opts.objective), untargetable: false, inNebula: false, sepT: R() * 0.2,
      barrel: R() * TAU, wobble: R() * TAU, scoreMul: (opts && opts.scoreMul) || 1,
    };
    if (type === 'turret' || type === 'station') e.angle = 0;
    G.enemies.push(e);
    if (e.spawnT > 0) {
      fx.glow(x, y, e.r * 3, '#ff6a8a', 0.5, 0, 0, -e.r * 3);
      fx.ring(x, y, e.r * 2.5, 4, 0.5, '#ff9ab0', 3);
    }
    if (type === 'station') {
      const n = def.turrets;
      for (let i = 0; i < n; ++i) {
        const a = i * TAU / n + 0.4;
        const tu = spawn('turret', x + Math.cos(a) * 92, y + Math.sin(a) * 92, { parent: e, instant: true, hpMul: opts && opts.hpMul });
        if (tu) tu.mountA = a;
      }
    }
    return e;
  }

  /* Who this enemy is after: the convoy or station if it hunts allies, else the player */
  function chooseTarget(e) {
    const ally = G.allies.length ? G.allies[0] : null;
    const p = G.player;
    if (ally && ally.alive && (e.type === 'bomber' || e.focusAlly || !p || !p.alive)) return ally;
    if (p && p.alive) return p;
    return ally && ally.alive ? ally : null;
  }

  function update(dt) {
    const k = G.warp > 0 ? 0.3 : 1;
    const step = dt * k;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const spMul = mut && mut.speed ? mut.speed : 1;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive) continue;
      e.t += step;
      if (e.flash > 0) e.flash -= dt;
      if (e.shieldHit > 0) e.shieldHit -= dt * 3;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      e.target = chooseTarget(e);
      if (e.stun > 0) {
        e.stun -= dt;
        e.vx *= 1 - 1.5 * dt;
        e.vy *= 1 - 1.5 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle += dt * 2;
        if (R() < 0.15) fx.sparks(e.x, e.y, R() * TAU, 1, 1, '#8ad8ff', 160, 0.2);
        continue;
      }
      think(e, step, spMul);
      fireBurst(e, step);
      /* integrate (static ones never move) */
      if (e.def.speed > 0) {
        const drag = e.type === 'interceptor' ? 0.6 : 1.4;
        e.vx *= 1 - drag * step;
        e.vy *= 1 - drag * step;
        const cap = e.def.speed * spMul * (e.inNebula ? 0.65 : 1);
        const s2 = e.vx * e.vx + e.vy * e.vy;
        if (s2 > cap * cap) {
          const s = Math.sqrt(s2);
          e.vx *= cap / s;
          e.vy *= cap / s;
        }
        separate(e, step);
        e.x += e.vx * step;
        e.y += e.vy * step;
        if (e.x < 30) e.vx += 400 * step;
        if (e.y < 30) e.vy += 400 * step;
        if (e.x > G.world.w - 30) e.vx -= 400 * step;
        if (e.y > G.world.h - 30) e.vy -= 400 * step;
      }
    }
  }

  function accelToward(e, dx, dy, dt, mul) {
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const a = e.def.accel * (mul || 1);
    e.vx += dx / l * a * dt;
    e.vy += dy / l * a * dt;
  }

  /* Can this enemy see its target? Nebulae hide the player beyond close range */
  function canSee(e, t) {
    if (t === G.player && t.inNebula) {
      const dx = t.x - e.x, dy = t.y - e.y;
      return dx * dx + dy * dy < 320 * 320;
    }
    return true;
  }

  function think(e, dt, spMul) {
    const t = e.target;
    if (!t) {
      e.vx *= 1 - dt;
      e.vy *= 1 - dt;
      return;
    }
    const dx = t.x - e.x, dy = t.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const aim = Math.atan2(dy, dx);
    const def = e.def;
    const visible = canSee(e, t);
    switch (def.ai) {
      case 'strafe': {
        e.modeT -= dt;
        if (e.modeT <= 0) { e.orbitDir = -e.orbitDir; e.modeT = 2.5 + R() * 2.5; }
        const want = def.range + (t.r || 0);
        const radial = (d - want) / 120;
        const tx = -dy / d * e.orbitDir, ty = dx / d * e.orbitDir;
        accelToward(e, dx / d * radial + tx, dy / d * radial + ty, dt);
        e.angle = turnToward(e.angle, aim, 4 * dt);
        if (visible && d < want + 260) tryFire(e, dt, t);
        break;
      }
      case 'pursue': {
        const lead = d / 600;
        const px = t.x + (t.vx || 0) * lead * 0.5, py = t.y + (t.vy || 0) * lead * 0.5;
        const want = Math.atan2(py - e.y, px - e.x);
        e.angle = turnToward(e.angle, want, 3.2 * dt);
        accelToward(e, Math.cos(e.angle), Math.sin(e.angle), dt);
        if (visible && d < 460 && Math.abs(angleDiff(e.angle, want)) < 0.35) tryFire(e, dt, t, true);
        break;
      }
      case 'kamikaze': {
        e.wobble += dt * 6;
        const w = d > 200 ? 0.5 : 0.1;
        const ox = -dy / d * Math.sin(e.wobble) * w, oy = dx / d * Math.sin(e.wobble) * w;
        accelToward(e, dx / d + ox, dy / d + oy, dt, d < 260 ? 1.6 : 1);
        e.angle = Math.atan2(e.vy, e.vx);
        if (d < e.r + (t.r || 18) + 4) NS.combat.droneBlast(e);
        break;
      }
      case 'bomber': {
        const want = def.range;
        const radial = (d - want) / 160;
        accelToward(e, dx / d * radial - dy / d * 0.3, dy / d * radial + dx / d * 0.3, dt);
        e.angle = turnToward(e.angle, aim, 1.4 * dt);
        if (visible && d < want + 200) tryFire(e, dt, t);
        break;
      }
      case 'turret': {
        e.barrel = turnToward(e.barrel, aim, 2.4 * dt);
        if (e.parent) {
          if (!e.parent.alive) { NS.combat.kill(e, null); break; }
          e.angle = e.parent.angle;
          e.x = e.parent.x + Math.cos(e.mountA + e.parent.angle) * 92;
          e.y = e.parent.y + Math.sin(e.mountA + e.parent.angle) * 92;
        }
        if (visible && d < def.range && Math.abs(angleDiff(e.barrel, aim)) < 0.3) tryFire(e, dt, t);
        break;
      }
      case 'station': {
        e.angle += dt * 0.12;
        spawnChildren(e, dt);
        break;
      }
      case 'frigate': {
        const want = def.range;
        const radial = (d - want) / 200;
        accelToward(e, dx / d * radial, dy / d * radial, dt, 0.8);
        e.angle = turnToward(e.angle, aim, 0.75 * dt);
        if (visible && d < want + 260 && Math.abs(angleDiff(e.angle, aim)) < 0.6) tryFire(e, dt, t);
        break;
      }
      case 'cloak':
        thinkCloak(e, dt, t, dx, dy, d, aim);
        break;
      case 'carrier': {
        const radial = (d - 640) / 300;
        accelToward(e, dx / d * radial + -dy / d * 0.2, dy / d * radial + dx / d * 0.2, dt);
        e.angle = turnToward(e.angle, aim, 0.3 * dt);
        spawnChildren(e, dt);
        if (visible && d < 760) tryFire(e, dt, t);
        break;
      }
      case 'lancer':
        thinkLancer(e, dt, t, dx, dy, d, aim, visible);
        break;
    }
  }

  function thinkCloak(e, dt, t, dx, dy, d, aim) {
    e.modeT -= dt;
    if (e.mode === 0) {
      /* cloaked: slip around behind the target */
      e.cloak = Math.max(0.05, e.cloak - dt * 2.5);
      e.untargetable = e.cloak < 0.3;
      const ta = (t.angle || 0) + Math.PI;
      const gx = t.x + Math.cos(ta) * 230 - e.x, gy = t.y + Math.sin(ta) * 230 - e.y;
      accelToward(e, gx, gy, dt, 1.2);
      e.angle = turnToward(e.angle, Math.atan2(e.vy, e.vx), 5 * dt);
      if (e.modeT <= 0 && d < 520) { e.mode = 1; e.modeT = 0.45; sfxAt('zap', e.x, e.y, { pitch: 0.7, volume: 0.5 }); }
      if (e.modeT < -6) { e.mode = 1; e.modeT = 0.45; }
    } else if (e.mode === 1) {
      /* decloaking shimmer */
      e.cloak = Math.min(1, e.cloak + dt * 2.4);
      e.untargetable = false;
      e.angle = turnToward(e.angle, aim, 6 * dt);
      e.vx *= 1 - 3 * dt;
      e.vy *= 1 - 3 * dt;
      if (e.modeT <= 0) { e.mode = 2; e.modeT = 1.6; e.cd = 0; }
    } else {
      e.cloak = 1;
      e.angle = turnToward(e.angle, aim, 5 * dt);
      accelToward(e, -dy / d, dx / d, dt, 0.5);
      tryFire(e, dt, t, true);
      if (e.modeT <= 0) { e.mode = 0; e.modeT = 3 + R() * 1.5; }
    }
  }

  function thinkLancer(e, dt, t, dx, dy, d, aim, visible) {
    const def = e.def;
    if (e.charge > 0) {
      /* tracks during the first half of the charge, then the line is locked */
      e.charge -= dt;
      if (e.charge > def.beam.charge * 0.5) e.beamA = turnToward(e.beamA, aim, 1.6 * dt);
      e.angle = e.beamA;
      e.vx *= 1 - 3 * dt;
      e.vy *= 1 - 3 * dt;
      if (e.charge <= 0) fireLance(e);
      return;
    }
    const radial = (d - def.range) / 180;
    accelToward(e, dx / d * radial - dy / d * e.orbitDir * 0.5, dy / d * radial + dx / d * e.orbitDir * 0.5, dt);
    e.angle = turnToward(e.angle, aim, 2.5 * dt);
    e.cd -= dt;
    if (e.cd <= 0 && visible && d < def.range + 300) {
      e.cd = def.beam.every * (0.8 + R() * 0.4);
      e.charge = def.beam.charge;
      e.beamA = aim;
      sfxAt('laser', e.x, e.y, { pitch: 0.4, volume: 0.4 });
    }
  }

  function fireLance(e) {
    const def = e.def.beam;
    const len = 1400;
    const x0 = e.x + Math.cos(e.beamA) * e.r, y0 = e.y + Math.sin(e.beamA) * e.r;
    const x1 = x0 + Math.cos(e.beamA) * len, y1 = y0 + Math.sin(e.beamA) * len;
    G.beams.push({ alive: true, x0: x0, y0: y0, x1: x1, y1: y1, t: 0, life: 0.3, w: def.width, color: 'red', hostile: true });
    const p = G.player;
    if (p && p.alive && segPointDist2(x0, y0, x1, y1, p.x, p.y) < (p.r + def.width) * (p.r + def.width))
      NS.player.damage(def.dmg * (G.stage ? G.stage.dmgMul : 1), e.x, e.y);
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      if (a.alive && segPointDist2(x0, y0, x1, y1, a.x, a.y) < (a.r + def.width) * (a.r + def.width))
        NS.combat.damageAlly(a, def.dmg * 0.6);
    }
    fx.glow(x0, y0, 40, '#ff6a6a', 0.2);
    sfxAt('laser', e.x, e.y, { pitch: 0.7, volume: 0.8 });
  }

  function spawnChildren(e, dt) {
    const sp = e.def.spawn;
    e.spawnCd -= dt;
    if (e.spawnCd > 0) return;
    e.spawnCd = sp.every;
    if (G.enemies.length >= (G.stage ? G.stage.maxAlive + 8 : 30)) return;
    const type = sp.alt && e.spawnAlt ? sp.alt : sp.type;
    e.spawnAlt = !e.spawnAlt;
    const n = type === 'drone' ? sp.count + 1 : sp.count;
    for (let i = 0; i < n; ++i) {
      const a = e.angle + Math.PI + (i - (n - 1) / 2) * 0.5;
      const c = spawn(type, e.x + Math.cos(a) * (e.r + 10), e.y + Math.sin(a) * (e.r + 10), { instant: true });
      if (c) {
        c.vx = Math.cos(a) * 260;
        c.vy = Math.sin(a) * 260;
        c.spawnT = 0.2;
      }
    }
    fx.glow(e.x, e.y, e.r * 1.2, '#ff8a6a', 0.3);
    sfxAt('drop', e.x, e.y, { pitch: 0.6, volume: 0.5 });
  }

  /* Starts a burst when the cooldown allows */
  function tryFire(e, dt, t, lead) {
    if (!e.def.fire || e.burst > 0) return;
    e.cd -= dt;
    if (e.cd > 0) return;
    const f = e.def.fire;
    e.cd = f.rate * (0.85 + R() * 0.3);
    e.burst = f.burst;
    e.burstT = 0;
    e.lead = !!lead;
  }

  function fireBurst(e, dt) {
    if (e.burst <= 0) return;
    e.burstT -= dt;
    if (e.burstT > 0) return;
    const f = e.def.fire;
    e.burstT = f.gap;
    --e.burst;
    const t = e.target;
    if (!t) { e.burst = 0; return; }
    let tx = t.x, ty = t.y;
    if (e.lead) {
      const d = Math.sqrt((tx - e.x) * (tx - e.x) + (ty - e.y) * (ty - e.y));
      const tt = d / f.speed;
      tx += (t.vx || 0) * tt * 0.8;
      ty += (t.vy || 0) * tt * 0.8;
    }
    const base = e.type === 'turret' ? e.barrel : Math.atan2(ty - e.y, tx - e.x);
    const n = f.count || 1;
    const muzzle = e.r * 0.9;
    const mx = e.x + Math.cos(base) * muzzle, my = e.y + Math.sin(base) * muzzle;
    for (let i = 0; i < n; ++i) {
      const a = n > 1 ? (f.arc >= 6 ? base + i * TAU / n : base + (i / (n - 1) - 0.5) * f.arc) : base + (R() - 0.5) * 0.06;
      NS.projectiles.enemyShot(f.kind, mx, my, a, f.speed, f.dmg, f.color);
    }
    fx.muzzle(mx, my, base, f.color === 'violet' ? '#e0b0ff' : '#ffb090');
    sfxAt(f.kind === 'orb' ? 'thud' : 'shoot', e.x, e.y, { volume: f.kind === 'orb' ? 0.4 : 0.18, pitch: f.kind === 'orb' ? 0.8 : 0.7 });
  }

  /* Ships nudge apart (checked a few times per second each, staggered) */
  function separate(e, dt) {
    e.sepT -= dt;
    if (e.sepT > 0) return;
    e.sepT = 0.12;
    const grid = NS.combat.grid;
    grid.query(e.x, e.y, e.r * 2, near);
    for (let i = 0; i < near.length; ++i) {
      const o = near[i];
      if (o === e || !o.alive || o.kind === 'mine') continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      const min = e.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 6;
        e.vx += dx / d * push;
        e.vy += dy / d * push;
      }
    }
  }

  function clear() {
    G.enemies.length = 0;
  }

  Object.assign(NS.enemies, {
    spawn, update, clear, chooseTarget
  });
})();
