/* Player weapons: the six primaries (bolts, beam, rail, flak, ion arcs) with fire rate, crits and
   power-up multipliers; the four secondaries (missiles, mines, EMP, drones) with ammo; and the
   wingman drones' AI. Owns G.drones, G.beams, G.rails and G.arcs entries of the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { segPointDist2, dist2 } = NS.rng;
  const R = NS.rng.fx;
  const { hitDamage } = NS.rules;
  const fx = NS.fx;
  const { sfx, sfxAt } = NS.audio;
  const { COLORS } = NS.ships;
  const { compact } = NS.grid;

  const near = [];
  const seg = { t: 0 };
  let twin = 1;

  function dmgExtra(p) {
    let m = 1;
    if (p.overdrive > 0) m *= 1.25;
    if (p.overcharge > 0) m *= 1.5;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    if (mut && mut.dmgOut) m *= mut.dmgOut;
    return m;
  }

  function rateMul(p) {
    return G.stats.rateMul * (p.overdrive > 0 ? 2 : 1) * (p.overcharge > 0 ? 1.3 : 1);
  }

  function roll(base, p) {
    return hitDamage(base, G.stats, R(), dmgExtra(p));
  }

  /* The nearest hostile to a point within range, optionally inside an aim cone */
  function nearestTarget(x, y, range, ang, cone, skip) {
    const grid = NS.combat.grid;
    grid.query(x, y, range, near);
    let best = null, bestD = range * range;
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (!t.alive || t.kind === 'rock' || t.kind === 'mine' || t.untargetable) continue;
      if (skip && skip.indexOf(t) >= 0) continue;
      const d = dist2(x, y, t.x, t.y);
      if (d >= bestD) continue;
      if (cone) {
        const a = Math.atan2(t.y - y, t.x - x);
        let da = Math.abs(a - ang) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da > cone) continue;
      }
      best = t;
      bestD = d;
    }
    return best;
  }

  /* ── primary ── */
  function updatePrimary(p, dt) {
    const w = p.primary;
    if (p.primaryCd > 0) p.primaryCd -= dt;
    p.beamOn = false;
    if (!G.input.firing || !p.alive || p.rollT > 0.25) return;
    if (w.kind === 'beam') {
      fireBeam(p, w, dt);
      return;
    }
    if (p.primaryCd > 0) return;
    p.primaryCd += w.rate / rateMul(p);
    if (p.primaryCd < 0) p.primaryCd = 0;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const nx = p.x + ca * 24, ny = p.y + sa * 24;
    const ps = G.stats.projSpeed;
    const col = COLORS[w.color];
    if (w.kind === 'bolt') {
      twin = -twin;
      for (let i = 0; i < w.count; ++i) {
        const off = w.count > 1 ? (i / (w.count - 1) - 0.5) * w.arc : 0;
        const a = p.angle + off + (R() - 0.5) * w.jitter;
        const side = w.count === 1 ? twin * 7 : 0;
        const bx = nx - sa * side, by = ny + ca * side;
        const d = roll(w.dmg, p);
        const b = NS.projectiles.player('bolt', bx, by, Math.cos(a) * w.speed * ps + p.vx * 0.3,
          Math.sin(a) * w.speed * ps + p.vy * 0.3, w.life * ps, d.dmg, 5, w.color);
        b.crit = d.crit;
      }
      fx.muzzle(nx, ny, p.angle, col[1]);
      sfx('shoot', { volume: 0.32, pitch: w.count > 1 ? 0.8 : 1.15 });
    } else if (w.kind === 'rail') {
      fireRail(p, w, nx, ny);
    } else if (w.kind === 'flak') {
      const dx = p.aimX - nx, dy = p.aimY - ny;
      const dist = Math.max(140, Math.min(w.speed * w.life * ps, Math.sqrt(dx * dx + dy * dy)));
      const sp = w.speed * ps;
      const b = NS.projectiles.player('flak', nx, ny, ca * sp + p.vx * 0.3, sa * sp + p.vy * 0.3, dist / sp, roll(w.dmg, p).dmg, 7, w.color);
      b.frags = w.frags;
      b.fragDmg = roll(w.frag, p).dmg;
      fx.muzzle(nx, ny, p.angle, col[1]);
      sfx('thud', { volume: 0.5, pitch: 1.3 });
    } else if (w.kind === 'ion') {
      fireIon(p, w, nx, ny);
    }
    ++p.shots;
  }

  function fireBeam(p, w, dt) {
    p.beamOn = true;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const x0 = p.x + ca * 24, y0 = p.y + sa * 24;
    const range = w.range * G.stats.projSpeed;
    let x1 = x0 + ca * range, y1 = y0 + sa * range;
    const grid = NS.combat.grid;
    grid.querySegment(x0, y0, x1, y1, 60, near);
    let hit = null, hitT = 1;
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (!t.alive || t.kind === 'mine' && !t.armed) continue;
      const d2 = segPointDist2(x0, y0, x1, y1, t.x, t.y, seg);
      if (d2 < (t.r + 6) * (t.r + 6) && seg.t < hitT) {
        hitT = seg.t;
        hit = t;
      }
    }
    if (hit) {
      x1 = x0 + (x1 - x0) * hitT;
      y1 = y0 + (y1 - y0) * hitT;
      const d = roll(w.dps * dt, p);
      NS.combat.hit(hit, d.dmg, x1, y1, p.angle + Math.PI, { beam: true });
      if (R() < 0.5) fx.sparks(x1, y1, p.angle + Math.PI, 2, 1, '#ffb0f0', 320, 0.25);
      if (R() < 0.2) fx.glow(x1, y1, 26, '#ff9af0', 0.1);
    }
    p.beam = { x0: x0, y0: y0, x1: x1, y1: y1, hit: !!hit };
    if (R() < 0.12) sfx('laser', { volume: 0.18, pitch: 2 });
  }

  function fireRail(p, w, nx, ny) {
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const range = w.range * G.stats.projSpeed;
    const x1 = nx + ca * range, y1 = ny + sa * range;
    const grid = NS.combat.grid;
    grid.querySegment(nx, ny, x1, y1, 80, near);
    const hits = [];
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (!t.alive) continue;
      const d2 = segPointDist2(nx, ny, x1, y1, t.x, t.y, seg);
      if (d2 < (t.r + 8) * (t.r + 8)) hits.push({ t: t, k: seg.t });
    }
    hits.sort((a, b) => a.k - b.k);
    let end = 1;
    const n = Math.min(w.pierce, hits.length);
    for (let i = 0; i < n; ++i) {
      const h = hits[i];
      const d = roll(w.dmg, p);
      NS.combat.hit(h.t, d.dmg, nx + (x1 - nx) * h.k, ny + (y1 - ny) * h.k, p.angle + Math.PI, { crit: d.crit });
      if (h.t.kind === 'boss' || h.t.kind === 'station') { end = h.k; break; }
      if (i === w.pierce - 1) end = h.k;
    }
    const ex = nx + (x1 - nx) * end, ey = ny + (y1 - ny) * end;
    G.rails.push({ alive: true, x0: nx, y0: ny, x1: ex, y1: ey, t: 0, life: 0.38 });
    fx.glow(nx, ny, 30, '#ffffff', 0.1);
    fx.sparks(ex, ey, p.angle + Math.PI, 1.6, 8, '#cfe0ff', 500, 0.3);
    p.vx -= ca * 60;
    p.vy -= sa * 60;
    fx.shake(0.12);
    sfx('laser', { pitch: 0.55, volume: 0.6 });
  }

  function fireIon(p, w, nx, ny) {
    const range = w.range * G.stats.projSpeed;
    const chain = [];
    let t = nearestTarget(nx, ny, range, p.angle, 0.55);
    const pts = [{ x: nx, y: ny }];
    let lx = nx, ly = ny;
    while (t && chain.length <= w.chains) {
      chain.push(t);
      pts.push({ x: t.x, y: t.y });
      lx = t.x; ly = t.y;
      t = nearestTarget(lx, ly, w.chainRange, 0, 0, chain);
    }
    if (!chain.length) {
      /* fizzle: a short arc into empty space */
      pts.push({ x: nx + Math.cos(p.angle) * range * 0.45, y: ny + Math.sin(p.angle) * range * 0.45 });
    }
    for (let i = 0; i < chain.length; ++i) {
      const d = roll(w.dmg * (1 - i * 0.12), p);
      NS.combat.hit(chain[i], d.dmg, chain[i].x, chain[i].y, 0, { crit: d.crit, stun: 0.12 });
      fx.glow(chain[i].x, chain[i].y, 30, '#a8c8ff', 0.12);
    }
    G.arcs.push({ alive: true, pts: pts, t: 0, life: 0.12, seed: Math.floor(R() * 1e6), color: 'blue' });
    sfx('zap', { volume: 0.35, pitch: 1.3 });
  }

  /* ── secondary ── */
  function updateSecondary(p, dt) {
    if (p.secondaryCd > 0) p.secondaryCd -= dt;
    if (!G.input.secondary || !p.alive || p.secondaryCd > 0) return;
    if (p.ammo <= 0) {
      sfx('error', { volume: 0.3 });
      p.secondaryCd = 0.4;
      return;
    }
    const w = p.secondary;
    p.secondaryCd = w.rate;
    --p.ammo;
    const st = G.stats;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    if (w.id === 'missiles') {
      const target = nearestTarget(p.aimX, p.aimY, 700, 0, 0) || nearestTarget(p.x, p.y, 900, p.angle, 1.2);
      for (let i = 0; i < w.count; ++i) {
        const side = i === 0 ? -1 : 1;
        const a = p.angle + side * 0.8;
        const b = NS.projectiles.player('missile', p.x - sa * side * 12, p.y + ca * side * 12,
          Math.cos(a) * 260 + p.vx, Math.sin(a) * 260 + p.vy, 3, w.dmg * st.secDmg * st.dmgMul * dmgExtra(p), 6, 'amber');
        b.target = target;
        b.speed = w.speed;
        b.blast = w.radius;
        b.ang = a;
      }
      sfx('whoosh', { pitch: 1.6, volume: 0.6 });
    } else if (w.id === 'mines') {
      const b = NS.projectiles.player('pmine', p.x - ca * 26, p.y - sa * 26, p.vx * 0.15 - ca * 40, p.vy * 0.15 - sa * 40, 30,
        w.dmg * st.secDmg * st.dmgMul * dmgExtra(p), 12, 'red');
      b.blast = w.radius;
      b.arm = 0.45;
      sfx('drop');
    } else if (w.id === 'emp') {
      NS.combat.blast(p.x, p.y, w.radius, w.dmg * st.secDmg * st.dmgMul, 'player', { stun: w.stun, shieldBreak: true });
      NS.projectiles.clearEnemyBullets(p.x, p.y, w.radius);
      fx.shockwave(p.x, p.y, w.radius, '#8ad8ff');
      fx.ring(p.x, p.y, 30, w.radius * 1.1, 0.7, '#ffffff', 2);
      fx.flash('#bfe8ff', 0.25);
      sfx('zap', { pitch: 0.4 });
    } else if (w.id === 'drones') {
      spawnDrone(p, w.life * (1 + st.droneAi * 0.2), false);
      sfx('powerup', { pitch: 1.5, volume: 0.5 });
    }
  }

  /* ── drones ── */
  function spawnDrone(p, life, escort) {
    const n = G.drones.length;
    G.drones.push({
      alive: true, x: p.x, y: p.y, vx: 0, vy: 0, angle: p.angle, life: life, max: life,
      cd: 0.3, orbit: n * 2.1 + R(), escort: escort, r: 9, t: 0,
    });
    fx.ring(p.x, p.y, 10, 50, 0.3, '#8affe0', 3);
  }

  function updateDrones(dt) {
    const p = G.player;
    const st = G.stats;
    const w = NS.ships.SECONDARIES[3];
    const power = 1 + st.droneAi * 0.2;
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      d.t += dt;
      if (!d.escort) {
        d.life -= dt;
        if (d.life <= 0) {
          d.alive = false;
          fx.explode(d.x, d.y, 10, fx.PLASMA, { noDebris: true });
          continue;
        }
      }
      if (!p || !p.alive) continue;
      d.orbit += dt * 1.4;
      const tx = p.x + Math.cos(d.orbit) * 70, ty = p.y + Math.sin(d.orbit) * 70;
      d.vx += (tx - d.x) * 9 * dt - d.vx * 3.5 * dt;
      d.vy += (ty - d.y) * 9 * dt - d.vy * 3.5 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const target = nearestTarget(d.x, d.y, 560, 0, 0);
      if (target) {
        d.angle = Math.atan2(target.y - d.y, target.x - d.x);
        d.cd -= dt;
        if (d.cd <= 0) {
          d.cd = w.fire / power;
          const lead = 0.12;
          const a = Math.atan2(target.y + (target.vy || 0) * lead - d.y, target.x + (target.vx || 0) * lead - d.x);
          NS.projectiles.player('bolt', d.x, d.y, Math.cos(a) * 900, Math.sin(a) * 900, 0.7, w.dmg * power * st.dmgMul, 4, 'green');
          sfxAt('shoot', d.x, d.y, { volume: 0.12, pitch: 1.7 });
        }
      } else
        d.angle += (p.angle - d.angle) * Math.min(1, dt * 4);
    }
    compact(G.drones);
  }

  function update(dt) {
    const p = G.player;
    if (!p) return;
    updatePrimary(p, dt);
    updateSecondary(p, dt);
    updateDrones(dt);
    for (let i = 0; i < G.rails.length; ++i) {
      const r = G.rails[i];
      r.t += dt;
      if (r.t >= r.life) r.alive = false;
    }
    compact(G.rails);
    for (let i = 0; i < G.arcs.length; ++i) {
      const a = G.arcs[i];
      a.t += dt;
      if (a.t >= a.life) a.alive = false;
    }
    compact(G.arcs);
  }

  Object.assign(NS.weapons, {
    update, nearestTarget, spawnDrone
  });
})();
