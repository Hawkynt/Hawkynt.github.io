/* Belt hazards: radiation fields (hull burn inside, uranium-rich), gravity wells (pull the ship,
   ore and small rocks, crush at the core, spiral infall), and solar storms on a schedule
   (warning, then a sweeping front that burns hull and shoves the ship). Lead Lining and the
   shield soak the damage. Owns G.radZones, G.wells and G.storm. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const R = NS.rng.fx;
  let geiger = 0;

  function farFromDock(x, y, d) {
    const k = G.dock;
    return (x - k.x) * (x - k.x) + (y - k.y) * (y - k.y) > d * d;
  }

  /* Places the zone's fields and wells (before the rocks, so uranium can gather in the glow) */
  function setup(zone, rng) {
    G.radZones.length = 0;
    G.wells.length = 0;
    G.storm = null;
    const w = G.world.w, h = G.world.h;
    const nRad = zone.hazards.radiation || 0;
    for (let i = 0, tries = 0; i < nRad && tries < 200; ++tries) {
      const x = 500 + rng() * (w - 1000), y = 500 + rng() * (h - 1000);
      if (!farFromDock(x, y, 900)) continue;
      G.radZones.push({ x: x, y: y, r: 300 + rng() * 200, seed: Math.floor(rng() * 1e6), phase: rng() * TAU });
      ++i;
    }
    const nWell = zone.hazards.gravity || 0;
    for (let i = 0, tries = 0; i < nWell && tries < 200; ++tries) {
      const x = 600 + rng() * (w - 1200), y = 600 + rng() * (h - 1200);
      if (!farFromDock(x, y, 1100)) continue;
      let ok = true;
      for (let k = 0; k < G.wells.length; ++k)
        if (Math.abs(G.wells[k].x - x) + Math.abs(G.wells[k].y - y) < 1400) ok = false;
      if (!ok) continue;
      G.wells.push({ x: x, y: y, r: 640, core: 64, pull: 780, spin: rng() < 0.5 ? -1 : 1, rot: 0, emitT: 0 });
      ++i;
    }
    if (zone.hazards.storm) G.storm = { phase: 'calm', t: 40 + rng() * 40, angle: rng() * TAU, front: 0, freq: zone.hazards.storm };
  }

  function update(dt) {
    const s = G.ship;
    const st = G.stats;
    if (!s || !s.alive) return;
    /* radiation */
    G.run.inRad = 0;
    for (let i = 0; i < G.radZones.length; ++i) {
      const z = G.radZones[i];
      const dx = s.x - z.x, dy = s.y - z.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > z.r * z.r) continue;
      const k = 1 - Math.sqrt(d2) / z.r;
      G.run.inRad = Math.max(G.run.inRad, 0.35 + k * 0.65);
    }
    if (G.run.inRad > 0) {
      NS.ship.hurt(6 * G.run.inRad * (1 - st.radResist) * dt, 'radiation');
      geiger -= dt;
      if (geiger <= 0) {
        geiger = 0.05 + R() * (0.4 - G.run.inRad * 0.3);
        NS.audio.sfx('blip', { volume: 0.12, pitch: 2.4 + R() });
      }
      if (R() < dt * 20) NS.fx.glow(s.x + (R() - 0.5) * 60, s.y + (R() - 0.5) * 60, 6, '#7cff4a', 0.4, (R() - 0.5) * 40, (R() - 0.5) * 40);
    }
    /* gravity wells */
    G.run.inWell = 0;
    for (let i = 0; i < G.wells.length; ++i) wellUpdate(G.wells[i], dt, s);
    stormUpdate(dt, s, st);
  }

  function pullOn(o, wl, dt, mul) {
    const dx = wl.x - o.x, dy = wl.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > wl.r * wl.r) return -1;
    const d = Math.sqrt(d2) || 1;
    const k = 1 - d / wl.r;
    const a = wl.pull * k * k * mul;
    o.vx += (dx / d * a + -dy / d * a * 0.35 * wl.spin) * dt;
    o.vy += (dy / d * a + dx / d * a * 0.35 * wl.spin) * dt;
    return d;
  }

  function wellUpdate(wl, dt, s) {
    wl.rot += dt * 0.6 * wl.spin;
    const d = pullOn(s, wl, dt, 1);
    if (d >= 0 && d < wl.core + s.r) {
      NS.ship.hurt(30 * dt, 'well');
      NS.fx.shake(0.04);
    }
    if (d >= 0) G.run.inWell = Math.max(G.run.inWell, 1 - d / wl.r);
    for (let i = 0; i < G.nuggets.length; ++i) {
      const n = G.nuggets[i];
      const nd = pullOn(n, wl, dt, 1.4);
      if (nd >= 0 && nd < wl.core * 0.6) n.alive = false;
    }
    const near = NS.asteroids.queryRocks(wl.x, wl.y, wl.r, []);
    for (let i = 0; i < near.length; ++i) {
      const o = near[i];
      if (o.tier > 2 || o.kind !== 'rock') continue;
      const od = pullOn(o, wl, dt, 0.25);
      if (od >= 0 && od < wl.core * 0.7) {
        o.alive = false;
        NS.fx.glow(o.x, o.y, 30, '#ffb070', 0.4);
      }
    }
    /* infall: glowing motes spiralling toward the core */
    wl.emitT -= dt;
    if (wl.emitT <= 0) {
      wl.emitT = 0.05;
      const a = R() * TAU, rr = wl.r * (0.45 + R() * 0.4);
      const x = wl.x + Math.cos(a) * rr, y = wl.y + Math.sin(a) * rr;
      const sp = 90 + R() * 60;
      const p = NS.fx.glow(x, y, 7 + R() * 6, R() < 0.5 ? '#ffb070' : '#ff6a8a', 2.2,
        (-Math.cos(a) * 0.6 - Math.sin(a) * wl.spin) * sp, (-Math.sin(a) * 0.6 + Math.cos(a) * wl.spin) * sp);
      if (p) p.drag = 0;
    }
  }

  function stormUpdate(dt, s, st) {
    const sm = G.storm;
    if (!sm) return;
    sm.t -= dt;
    if (sm.phase === 'calm' && sm.t <= 0) {
      sm.phase = 'warn';
      sm.t = 8;
      sm.angle = R() * TAU;
      NS.trip.banner('SOLAR STORM INBOUND', 'Shields up - the front hits in 8 seconds', '#ffb347');
      NS.audio.sfx('zap', { volume: 0.5, pitch: 0.5 });
    } else if (sm.phase === 'warn' && sm.t <= 0) {
      sm.phase = 'active';
      sm.t = 12;
      NS.fx.flash('#ffb060', 0.5);
      NS.fx.shake(0.4);
      NS.audio.sfx('whoosh', { volume: 0.8, pitch: 0.5 });
    } else if (sm.phase === 'active') {
      NS.ship.hurt(3.6 * (1 - st.radResist) * dt, 'storm');
      s.vx += Math.cos(sm.angle) * 70 * dt;
      s.vy += Math.sin(sm.angle) * 70 * dt;
      if (R() < dt * 14) NS.fx.sparks(s.x + (R() - 0.5) * 40, s.y + (R() - 0.5) * 40, R() * TAU, 0.8, 3, '#bfe8ff', 220, 0.2);
      if (sm.t <= 0) {
        sm.phase = 'calm';
        sm.t = (50 + R() * 50) / sm.freq;
        NS.trip.banner('STORM PASSED', '', '#5cff9a');
      }
    }
  }

  Object.assign(NS.hazards, {
    setup, update
  });
})();
