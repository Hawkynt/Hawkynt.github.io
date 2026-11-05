/* Field hazards: frost fields that slow, burning patches, proximity mines, black holes (the
   chapter V wells and the friendly Singularity that eats rocks), gravity bending of ships, rocks
   and shots, implosions and the Maw's pull, telegraphed lightning strikes in the Storm Nebula,
   comets in the Ember Belt, and the fading chain-lightning arcs. Owns G.zones, G.mines, G.holes,
   G.strikes and G.arcs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, FIELD_W, FIELD_H } = NS.constants;
  const { wrap, wrapD, fx: R } = NS.rng;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  function rng() {
    return NS.sim.rng();
  }

  function zone(kind, x, y, r, life) {
    if (G.zones.length > 60) G.zones.shift();
    G.zones.push({ alive: true, kind: kind, x: wrap(x, FIELD_W), y: wrap(y, FIELD_H), r: r, life: life, max: life, seed: Math.floor(R() * 1000) });
  }

  function inside(z, x, y, pad) {
    const dx = wrapD(x - z.x, FIELD_W), dy = wrapD(y - z.y, FIELD_H);
    const r = z.r + (pad || 0);
    return dx * dx + dy * dy < r * r;
  }

  function slowAt(x, y) {
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      if (z.kind === 'ice' && inside(z, x, y)) return true;
    }
    return false;
  }

  function fireAt(x, y, pad) {
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      if (z.kind === 'fire' && z.life > 0.3 && inside(z, x, y, pad)) return z;
    }
    return null;
  }

  function mine(x, y) {
    if (G.mines.length > 14) return;
    G.mines.push({ alive: true, x: x, y: y, r: 10, arm: 0.8, life: 22, t: 0 });
    sfx('drop', { volume: 0.3 });
  }

  function detonate(m) {
    if (!m.alive) return;
    m.alive = false;
    fx.explode(m.x, m.y, 40, fx.FIRE);
    NS.collision.blast(m.x, m.y, 85, 2, false, 200);
    sfx('explode', { volume: 0.5, pitch: 1.3 });
  }

  function hole(x, y, friendly) {
    G.holes.push({ alive: true, x: x, y: y, r: friendly ? 18 : 26, reach: friendly ? 300 : 320, pull: friendly ? 420 : 210,
      life: friendly ? 6.5 : 1e9, friendly: !!friendly, t: 0, eaten: 0 });
    if (friendly) {
      fx.shockwave(x, y, 140, '#ff4ad0');
      sfx('whoosh', { pitch: 0.5 });
    }
  }

  /* gravity on anything with x, y, vx, vy: wells pull by reach falloff; void rocks pull lightly */
  function bend(o, dt, k) {
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      if (h.friendly && o === G.ship) continue;
      const dx = wrapD(h.x - o.x, FIELD_W), dy = wrapD(h.y - o.y, FIELD_H);
      const d2 = dx * dx + dy * dy;
      if (d2 > h.reach * h.reach || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const f = h.pull * (1 - d / h.reach) * k * (h.friendly && o.type ? 3 : 1);
      o.vx += dx / d * f * dt;
      o.vy += dy / d * f * dt;
    }
    if (o.type || o === G.ship) return;
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (r.type !== 'void' || !r.alive) continue;
      const dx = wrapD(r.x - o.x, FIELD_W), dy = wrapD(r.y - o.y, FIELD_H);
      const d2 = dx * dx + dy * dy;
      const reach = 70 + r.r * 2;
      if (d2 > reach * reach || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const f = 380 * (1 - d / reach) * k;
      o.vx += dx / d * f * dt;
      o.vy += dy / d * f * dt;
    }
  }

  /* the ship feels the void rocks too */
  function shipPull(dt) {
    const s = G.ship;
    if (!s || s.dead) return;
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (r.type !== 'void' || !r.alive) continue;
      const dx = wrapD(r.x - s.x, FIELD_W), dy = wrapD(r.y - s.y, FIELD_H);
      const d2 = dx * dx + dy * dy;
      const reach = 80 + r.r * 2.4;
      if (d2 > reach * reach || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const f = 160 * (1 - d / reach);
      s.vx += dx / d * f * dt;
      s.vy += dy / d * f * dt;
    }
    bend(s, dt, 1);
  }

  function pullTo(x, y, reach, strength, dt) {
    const s = G.ship;
    if (!s || s.dead) return;
    const dx = wrapD(x - s.x, FIELD_W), dy = wrapD(y - s.y, FIELD_H);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > reach) return;
    s.vx += dx / d * strength * (1 - d / reach * 0.5) * dt;
    s.vy += dy / d * strength * (1 - d / reach * 0.5) * dt;
  }

  function implode(x, y, reach) {
    const lists = [G.rocks, G.enemies];
    for (let l = 0; l < lists.length; ++l)
      for (let i = 0; i < lists[l].length; ++i) push(lists[l][i], x, y, reach, -160);
    if (G.ship && !G.ship.dead) push(G.ship, x, y, reach, -220);
    fx.ring(x, y, reach, 8, 0.4, '#ff4ad0', 5);
    sfx('whoosh', { pitch: 0.6, volume: 0.5 });
  }

  /* an impulse away from (positive) or toward (negative) a point */
  function push(o, x, y, reach, power) {
    const dx = wrapD(o.x - x, FIELD_W), dy = wrapD(o.y - y, FIELD_H);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > reach) return;
    const f = power * (1 - d / reach);
    o.vx += dx / d * f;
    o.vy += dy / d * f;
  }

  function strike(x, y) {
    G.strikes.push({ alive: true, x: wrap(x, FIELD_W), y: wrap(y, FIELD_H), r: 64, warn: 1.25, t: 0, hit: false });
  }

  function update(dt) {
    const k = NS.sim.worldScale();
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      z.life -= dt * k;
      if (z.life <= 0) z.alive = false;
      else if (z.kind === 'fire' && R() < 0.25) fx.embers(z.x + (R() - 0.5) * z.r, z.y + (R() - 0.5) * z.r, 1, 40, fx.FIRE);
    }
    compact(G.zones);

    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      m.t += dt;
      m.arm = Math.max(0, m.arm - dt);
      m.life -= dt;
      if (m.life <= 0) { detonate(m); continue; }
      const s = G.ship;
      if (m.arm <= 0 && s && !s.dead && s.hyperT <= 0) {
        const dx = wrapD(s.x - m.x, FIELD_W), dy = wrapD(s.y - m.y, FIELD_H);
        if (dx * dx + dy * dy < 60 * 60) detonate(m);
      }
    }
    compact(G.mines);

    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      h.t += dt;
      h.life -= dt;
      if (h.life <= 0) {
        h.alive = false;
        fx.shockwave(h.x, h.y, 160, '#ff4ad0');
        continue;
      }
      if (R() < 0.5) {
        const a = R() * TAU, d = h.reach * (0.5 + R() * 0.5);
        const p = fx.glow(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 5, h.friendly ? '#ff8ae0' : '#ff5a7a', 0.6, -Math.cos(a) * d * 1.4, -Math.sin(a) * d * 1.4);
        if (p) p.drag = 0;
      }
      /* the well's core eats rocks; a friendly well scores them */
      for (let j = 0; j < G.rocks.length; ++j) {
        const r = G.rocks[j];
        if (!r.alive) continue;
        const dx = wrapD(r.x - h.x, FIELD_W), dy = wrapD(r.y - h.y, FIELD_H);
        const rr = h.r + r.r * 0.6;
        if (dx * dx + dy * dy < rr * rr) {
          if (h.friendly) NS.rocks.damage(r, 40 * dt + 0.5, undefined, 'hole');
          else if (r.size <= 1) { r.alive = false; fx.glow(h.x, h.y, 30, '#ff5a7a', 0.3); }
        }
      }
    }
    compact(G.holes);

    for (let i = 0; i < G.strikes.length; ++i) {
      const st = G.strikes[i];
      st.t += dt;
      if (!st.hit && st.t >= st.warn) {
        st.hit = true;
        fx.flash('#e8ffb0', 0.25);
        fx.sparks(st.x, st.y, 0, TAU, 26, '#f0ffc0', 420, 0.35);
        fx.ring(st.x, st.y, 10, st.r * 1.4, 0.35, '#f0ffc0', 6);
        fx.shake(0.3);
        sfx('zap', { pitch: 0.7 });
        NS.collision.blast(st.x, st.y, st.r, 3, false, 160);
      }
      if (st.t > st.warn + 0.35) st.alive = false;
    }
    compact(G.strikes);

    for (let i = 0; i < G.arcs.length; ++i) {
      G.arcs[i].t -= dt;
      if (G.arcs[i].t <= 0) G.arcs[i].alive = false;
    }
    compact(G.arcs);
    shipPull(dt);
    ambient(dt);
  }

  /* the level hazard's ambient threats */
  function ambient(dt) {
    const L = G.level, run = G.run;
    if (!L || !run || run.cleared) return;
    run.hazT = (run.hazT || 0) - dt;
    if (run.hazT > 0) return;
    const s = G.ship;
    switch (L.hazard) {
      case 'storm':
        run.hazT = 3.4 + rng() * 2;
        if (s && !s.dead) strike(s.x + (rng() - 0.5) * 300, s.y + (rng() - 0.5) * 300);
        else strike(rng() * FIELD_W, rng() * FIELD_H);
        break;
      case 'comets': {
        run.hazT = 6 + rng() * 4;
        const fromLeft = rng() < 0.5;
        const y = rng() * FIELD_H;
        const r = NS.rocks.spawn('lava', 1, fromLeft ? 1 : FIELD_W - 1, y, (fromLeft ? 1 : -1) * 420, (rng() - 0.5) * 120);
        if (r) r.comet = 1;
        sfx('whoosh', { volume: 0.4, pitch: 1.3 });
        break;
      }
      default:
        run.hazT = 5;
    }
  }

  Object.assign(NS.hazards, {
    zone, slowAt, fireAt, mine, detonate, hole, bend, pullTo, implode, push, strike, update
  });
})();
