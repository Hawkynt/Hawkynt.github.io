/* Pirates: waves announced by a warning and arriving from out of sight, three kinds (skimmers
   that dart in to steal ore from the hold, raiders that circle and shoot, gunships that stand
   off and fire bursts), rock avoidance, bolts from both sides (pirates and the point-defense
   turret), damage, blasts, death with loot and the stolen ore spilled back.
   Owns G.pirates and G.bolts. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { PIRATES } = NS.ships;
  const { ORE_BY_ID } = NS.ores;
  const { compact } = NS.grid;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;
  const near = [];
  let turretCd = 0;

  function spawn(kind, x, y) {
    const d = PIRATES[kind];
    const hpMul = 1 + 0.35 * (G.run.zone.danger - 1);
    const p = {
      alive: true, kind: kind, x: x, y: y, vx: 0, vy: 0, angle: 0, r: d.r, hp: d.hp * hpMul, maxHp: d.hp * hpMul,
      fireT: 1 + R() * 2, burst: 0, orbit: R() < 0.5 ? 1 : -1, stolen: null, flee: 0, hitFlash: 0, exhaustT: 0, bank: 0,
    };
    G.pirates.push(p);
    return p;
  }

  /* A wave beyond the edge of the screen; size and kinds grow with the belt's danger */
  function wave() {
    const s = G.ship;
    const z = G.run.zone;
    const n = 1 + Math.floor(R() * (1 + z.danger * 0.6)) + Math.floor(G.run.t / 240);
    const a = R() * TAU;
    for (let i = 0; i < Math.min(6, n); ++i) {
      const aa = a + (R() - 0.5) * 0.8;
      const d = 1050 + R() * 250;
      const roll = R() * z.danger;
      const kind = roll > 3.4 ? 'gunship' : roll > 1.3 ? 'raider' : 'skimmer';
      spawn(kind, s.x + Math.cos(aa) * d, s.y + Math.sin(aa) * d);
    }
    NS.trip.banner('PIRATE SIGNAL', 'Raiders inbound - the laser cuts hulls too', '#ff5c6c');
    NS.audio.sfx('zap', { volume: 0.6, pitch: 0.4 });
  }

  function schedule(dt) {
    const run = G.run;
    if (!run.zone.pirates) return;
    run.pirateT -= dt;
    if (run.pirateT <= 0) {
      run.pirateT = (75 + R() * 50) / run.zone.pirates;
      if (G.pirates.length < 8) wave();
    }
  }

  /* the most valuable ore in the hold */
  function richest() {
    let best = null, bv = 0;
    for (const id in G.run.cargo)
      if (G.run.cargo[id] > 0 && ORE_BY_ID[id].value > bv) { bv = ORE_BY_ID[id].value; best = id; }
    return best;
  }

  function steer(p, tx, ty, speed, accel, dt) {
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    let ax = dx / d * accel, ay = dy / d * accel;
    /* push away from close rocks */
    const list = NS.asteroids.queryRocks(p.x, p.y, 140, near);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      const ox = p.x - o.x, oy = p.y - o.y;
      const od = Math.sqrt(ox * ox + oy * oy) || 1;
      const clear = o.r + p.r + 40;
      if (od < clear) {
        ax += ox / od * accel * 2 * (1 - od / clear);
        ay += oy / od * accel * 2 * (1 - od / clear);
        if (od < o.r + p.r) {
          p.x = o.x + ox / od * (o.r + p.r);
          p.y = o.y + oy / od * (o.r + p.r);
        }
      }
    }
    p.vx += ax * dt;
    p.vy += ay * dt;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > speed) { p.vx *= speed / sp; p.vy *= speed / sp; }
    const ta = Math.atan2(p.vy, p.vx);
    const turn = clamp(angleDiff(p.angle, ta), -6 * dt, 6 * dt);
    p.bank = clamp(turn / dt / 6, -1, 1);
    p.angle += turn;
  }

  function shoot(p, target, speed, dmg) {
    const lead = Math.sqrt((target.x - p.x) * (target.x - p.x) + (target.y - p.y) * (target.y - p.y)) / speed;
    const tx = target.x + (target.vx || 0) * lead * 0.7, ty = target.y + (target.vy || 0) * lead * 0.7;
    const a = Math.atan2(ty - p.y, tx - p.x) + (R() - 0.5) * 0.08;
    G.bolts.push({ alive: true, friendly: false, x: p.x + Math.cos(a) * p.r, y: p.y + Math.sin(a) * p.r, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1.6, dmg: dmg, angle: a });
    NS.fx.muzzle(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, a, '#ff5a3a');
    NS.audio.sfxAt('shoot', p.x, p.y, { volume: 0.3, pitch: 0.8 });
  }

  function update(dt) {
    schedule(dt);
    const s = G.ship;
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      if (!p.alive) continue;
      const d = PIRATES[p.kind];
      if (p.hitFlash > 0) p.hitFlash -= dt;
      /* target: the ship, or a drone that is closer */
      let tgt = s;
      for (let k = 0; k < G.drones.length; ++k) {
        const dr = G.drones[k];
        if (dr.alive && dr.state !== 'docked' && Math.abs(dr.x - p.x) + Math.abs(dr.y - p.y) < Math.abs(s.x - p.x) + Math.abs(s.y - p.y) - 200) tgt = dr;
      }
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (p.flee > 0 || p.stolen) {
        p.flee -= dt;
        steer(p, p.x - (s.x - p.x) * 3, p.y - (s.y - p.y) * 3, d.speed * 1.15, d.accel, dt);
        if (dist > 1700) p.alive = false;
      } else if (p.kind === 'skimmer') {
        steer(p, s.x + s.vx * 0.3, s.y + s.vy * 0.3, d.speed, d.accel, dt);
        const sd = Math.sqrt((s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y));
        if (sd < p.r + s.r + 6) grab(p, s, d);
      } else {
        const want = p.kind === 'gunship' ? 380 : 270;
        const ox = -dy / dist * p.orbit, oy = dx / dist * p.orbit;
        const k = (dist - want) / want;
        steer(p, p.x + dx / dist * k * 300 + ox * 220, p.y + dy / dist * k * 300 + oy * 220, d.speed, d.accel, dt);
        p.fireT -= dt;
        if (p.fireT <= 0 && dist < 620 && tgt.alive) {
          if (p.kind === 'gunship') {
            shoot(p, tgt, 560, d.dmg);
            if (++p.burst >= 3) { p.burst = 0; p.fireT = d.fire * 4; } else p.fireT = 0.14;
          } else {
            shoot(p, tgt, 620, d.dmg);
            p.fireT = d.fire * (0.8 + R() * 0.4);
          }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.exhaustT -= dt;
      if (p.exhaustT <= 0) {
        p.exhaustT = 1 / 30;
        NS.fx.exhaust(p.x - Math.cos(p.angle) * p.r, p.y - Math.sin(p.angle) * p.r, -Math.cos(p.angle) * 160, -Math.sin(p.angle) * 160, p.r * 0.45, '#ff5a3a', null);
      }
    }
    compact(G.pirates);
    turret(dt);
    bolts(dt);
  }

  function grab(p, s, d) {
    const id = richest();
    if (!id) {
      NS.ship.hurt(d.dmg, 'impact');
      p.flee = 2;
      return;
    }
    const n = Math.min(G.run.cargo[id], 2 + Math.floor(R() * 3));
    G.run.cargo[id] -= n;
    G.run.cargoUsed -= NS.rules.oreSpace(G.stats, id) * n;
    if (!G.run.cargo[id]) delete G.run.cargo[id];
    p.stolen = { ore: id, units: n };
    NS.fx.text(s.x, s.y - 50, '-' + n + ' ' + ORE_BY_ID[id].name + '!', '#ff5c6c', 18, 1.4);
    NS.fx.sparks(s.x, s.y, 0, TAU, 12, '#ff8a5a', 260, 0.3);
    NS.audio.sfx('hurt', { volume: 0.5, pitch: 1.3 });
    s.vx += p.vx * 0.4;
    s.vy += p.vy * 0.4;
  }

  function turret(dt) {
    const st = G.stats, s = G.ship;
    if (!st.turret || !s || !s.alive) return;
    turretCd -= dt;
    if (turretCd > 0) return;
    let best = null, bd = 460 * 460;
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      const q = (p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y);
      if (p.alive && q < bd) { bd = q; best = p; }
    }
    if (!best) return;
    turretCd = 0.7 - st.turret * 0.12;
    const a = Math.atan2(best.y - s.y, best.x - s.x);
    G.run.turretAngle = a;
    G.bolts.push({ alive: true, friendly: true, x: s.x, y: s.y, vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100, life: 0.6, dmg: 10 + st.turret * 6, angle: a });
    NS.audio.sfx('shoot', { volume: 0.22, pitch: 1.5 });
  }

  function bolts(dt) {
    const s = G.ship;
    for (let i = 0; i < G.bolts.length; ++i) {
      const b = G.bolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0) { b.alive = false; continue; }
      if (b.friendly) {
        for (let k = 0; k < G.pirates.length; ++k) {
          const p = G.pirates[k];
          if (p.alive && (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y) < p.r * p.r) {
            damage(p, b.dmg, b.x, b.y);
            b.alive = false;
            break;
          }
        }
      } else {
        if (s.alive && (s.x - b.x) * (s.x - b.x) + (s.y - b.y) * (s.y - b.y) < s.r * s.r) {
          NS.ship.hurt(b.dmg, 'bolt');
          NS.fx.hitSpark(b.x, b.y, b.angle + Math.PI, '#ff8a5a');
          b.alive = false;
          continue;
        }
        for (let k = 0; k < G.drones.length; ++k) {
          const dr = G.drones[k];
          if (dr.alive && dr.state !== 'docked' && (dr.x - b.x) * (dr.x - b.x) + (dr.y - b.y) * (dr.y - b.y) < 144) {
            NS.drones.hurt(dr, b.dmg);
            b.alive = false;
            break;
          }
        }
      }
      if (!b.alive) continue;
      const list = NS.asteroids.queryRocks(b.x, b.y, 4, near);
      for (let k = 0; k < list.length; ++k) {
        const o = list[k];
        if ((o.x - b.x) * (o.x - b.x) + (o.y - b.y) * (o.y - b.y) < o.r * o.r * 0.8) {
          NS.fx.hitSpark(b.x, b.y, b.angle + Math.PI, b.friendly ? '#9ae0ff' : '#ff8a5a');
          b.alive = false;
          break;
        }
      }
    }
    compact(G.bolts);
  }

  function damage(p, amount, hx, hy) {
    if (!p.alive) return;
    p.hp -= amount;
    p.hitFlash = 0.08;
    if (p.hp > 0) return;
    p.alive = false;
    const d = PIRATES[p.kind];
    NS.fx.explode(p.x, p.y, p.r * 1.3, NS.fx.FIRE, { debrisColor: '#5a4a4a' });
    NS.audio.sfxAt('explode', p.x, p.y, { volume: 0.7 });
    NS.fx.hitStop(0.04);
    NS.mining.spawnSalvage(p.x, p.y, Math.round(d.loot * G.stats.salvage * (0.8 + R() * 0.4)), 3 + Math.floor(p.r / 10));
    if (p.stolen) for (let i = 0; i < p.stolen.units; ++i) NS.mining.spawnNugget(p.x, p.y, p.stolen.ore, 1, null, 140);
    if (R() < 0.35) {
      G.run.rd += 1;
      NS.fx.text(p.x, p.y - 30, '+1 DATA', '#b48aff', 15, 1.2);
    }
    ++G.run.kills;
    if (G.run.mode === 'career') NS.rules.bump(G.save, 'pirates', 1);
  }

  function blast(x, y, radius, dmg) {
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      const d = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y));
      if (p.alive && d < radius) damage(p, dmg * (1 - d / radius), p.x, p.y);
    }
  }

  function clear() {
    G.pirates.length = 0;
    G.bolts.length = 0;
    turretCd = 0;
  }

  Object.assign(NS.pirates, {
    spawn, wave, update, damage, blast, clear
  });
})();
