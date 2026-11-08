/* Mining drones: launched from the ship, each picks an ore rock near the ship (the most
   valuable one with Prospector AI), hovers and drills it with its own small laser, sweeps up the
   nuggets it breaks loose, flies its basket home and unloads into the hold - or, when the hold
   has no room, hauls it to the station, banks it there and flies straight back out. F recalls or
   relaunches the swarm; destroyed drones are rebuilt aboard after a while. Owns G.drones. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ORE_BY_ID } = NS.ores;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;
  const near = [];

  function setup(stats) {
    G.drones.length = 0;
    for (let i = 0; i < stats.drones; ++i)
      G.drones.push({ alive: true, idx: i, x: 0, y: 0, vx: 0, vy: 0, angle: 0, state: 'docked', target: null, load: 0, ore: null,
        hp: 30 * stats.droneArmor, maxHp: 30 * stats.droneArmor, rebuild: 0, beam: false, hover: R() * TAU, exhaustT: 0 });
    G.run.dronesOut = stats.drones > 0;
    if (G.run.mode === 'career') NS.rules.record(G.save, 'maxDrones', stats.drones);
  }

  function toggle() {
    if (!G.drones.length) return false;
    G.run.dronesOut = !G.run.dronesOut;
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      if (!G.run.dronesOut && d.state !== 'docked') d.state = 'return';
    }
    NS.audio.sfx(G.run.dronesOut ? 'powerup' : 'blip', { volume: 0.4 });
    return true;
  }

  function taken(rock, self) {
    for (let i = 0; i < G.drones.length; ++i)
      if (G.drones[i] !== self && G.drones[i].target === rock) return true;
    return false;
  }

  function pickTarget(d) {
    const s = G.ship;
    const list = NS.asteroids.queryRocks(s.x, s.y, 950, near);
    let best = null, bs = -Infinity;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (!o.alive || !o.ore || o.kind !== 'rock' || o.volatile || taken(o, d)) continue;
      const dist = Math.sqrt((o.x - d.x) * (o.x - d.x) + (o.y - d.y) * (o.y - d.y));
      const score = G.stats.smartDrones ? ORE_BY_ID[o.ore].value * o.rich / (o.maxHp + 20) * 100 - dist * 0.02 : -dist - o.tier * 60;
      if (score > bs) { bs = score; best = o; }
    }
    return best;
  }

  function fly(d, tx, ty, dt, speed) {
    const dx = tx - d.x, dy = ty - d.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = Math.min(speed, dist * 3);
    d.vx += (dx / dist * want - d.vx) * Math.min(1, dt * 4);
    d.vy += (dy / dist * want - d.vy) * Math.min(1, dt * 4);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return dist;
  }

  function update(dt) {
    const s = G.ship;
    const st = G.stats;
    const speed = 380 * st.droneSpeed;
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      d.beam = false;
      if (!d.alive) {
        d.rebuild -= dt;
        if (d.rebuild <= 0) {
          d.alive = true;
          d.hp = d.maxHp;
          d.state = 'docked';
        }
        continue;
      }
      d.hover += dt;
      if (d.state === 'docked') {
        const a = s.angle + Math.PI + (i - (G.drones.length - 1) / 2) * 0.7;
        d.x = s.x + Math.cos(a) * (s.r + 12);
        d.y = s.y + Math.sin(a) * (s.r + 12);
        d.vx = s.vx;
        d.vy = s.vy;
        d.angle = s.angle;
        if (G.run.dronesOut) d.state = d.load > 0 ? 'haul' : 'seek';
        continue;
      }
      if (d.state === 'seek') {
        if (!d.target || !d.target.alive) d.target = pickTarget(d);
        if (!d.target) {
          if (fly(d, s.x, s.y, dt, speed) < 60 && d.load > 0) d.state = 'return';
        } else {
          const o = d.target;
          const a = Math.atan2(d.y - o.y, d.x - o.x);
          if (fly(d, o.x + Math.cos(a) * (o.r + 36), o.y + Math.sin(a) * (o.r + 36), dt, speed) < 30) d.state = 'mine';
        }
      } else if (d.state === 'mine') {
        const o = d.target;
        if (!o || !o.alive) {
          d.target = null;
          d.state = d.load >= st.droneHaul ? 'return' : 'seek';
        } else {
          const a = Math.atan2(d.y - o.y, d.x - o.x) + dt * 0.4;
          fly(d, o.x + Math.cos(a) * (o.r + 34), o.y + Math.sin(a) * (o.r + 34), dt, speed * 0.6);
          d.beam = true;
          const hx = o.x + Math.cos(a) * o.r * 0.85, hy = o.y + Math.sin(a) * o.r * 0.85;
          G.beams.push({ x0: d.x, y0: d.y, x1: hx, y1: hy, hit: true, primary: false, drone: true, color: '#5cff9a' });
          if (R() < dt * 10) NS.fx.sparks(hx, hy, a, 1.6, 1, '#b4ffc8', 160, 0.25);
          NS.asteroids.damage(o, 11 * st.droneLaser * dt, hx, hy, 'drone');
        }
        sweep(d, st);
      } else if (d.state === 'return') {
        if (G.run.dronesOut && d.load > 0 && !roomFor(d)) d.state = 'haul';
        else if (fly(d, s.x, s.y, dt, speed * 1.2) < s.r + 14) unload(d);
      } else if (d.state === 'haul') {
        if (fly(d, G.dock.x, G.dock.y, dt, speed * 1.2) < 70) haulIn(d);
      }
      const ta = Math.atan2(d.vy, d.vx);
      if (d.vx * d.vx + d.vy * d.vy > 400) d.angle += clamp(angleDiff(d.angle, ta), -8 * dt, 8 * dt);
      d.exhaustT -= dt;
      if (d.exhaustT <= 0 && d.state !== 'mine') {
        d.exhaustT = 1 / 20;
        NS.fx.exhaust(d.x - Math.cos(d.angle) * 8, d.y - Math.sin(d.angle) * 8, -d.vx * 0.3, -d.vy * 0.3, 5, '#5cff9a', null);
      }
    }
  }

  /* drone tractor: free nuggets close by go into the basket */
  function sweep(d, st) {
    for (let i = 0; i < G.nuggets.length && d.load < st.droneHaul; ++i) {
      const n = G.nuggets[i];
      if (!n.alive || n.credits || n.pulled) continue;
      if ((n.x - d.x) * (n.x - d.x) + (n.y - d.y) * (n.y - d.y) > 110 * 110) continue;
      if (d.ore && d.ore !== n.ore) continue;
      n.alive = false;
      d.ore = n.ore;
      d.load += n.units;
      NS.fx.glow(n.x, n.y, 14, ORE_BY_ID[n.ore].color, 0.2);
    }
    if (d.load >= st.droneHaul) {
      d.state = 'return';
      d.target = null;
    }
  }

  function roomFor(d) {
    return d.ore && NS.mining.spaceLeft() >= NS.rules.oreSpace(G.stats, d.ore);
  }

  /* a basket banked at the station; the drone goes straight back to work */
  function haulIn(d) {
    if (d.load > 0 && d.ore) {
      NS.trip.bank(d.ore, d.load);
      NS.fx.text(G.dock.x, G.dock.y - 60, '+' + d.load + ' ' + ORE_BY_ID[d.ore].name + ' banked', '#b4ffc8', 14, 1.2);
      NS.audio.sfxAt('pickup', G.dock.x, G.dock.y, { volume: 0.25, pitch: 1.3 });
    }
    d.load = 0;
    d.ore = null;
    d.target = null;
    d.state = G.run.dronesOut ? 'seek' : 'return';
  }

  function unload(d) {
    if (d.load > 0 && d.ore) {
      const room = Math.floor(NS.mining.spaceLeft() / NS.rules.oreSpace(G.stats, d.ore));
      const n = Math.min(room, d.load);
      if (n > 0) {
        NS.mining.addCargo(d.ore, n);
        NS.fx.text(G.ship.x, G.ship.y - 60, '+' + n + ' ' + ORE_BY_ID[d.ore].name, '#b4ffc8', 14, 1);
        NS.audio.sfx('pickup', { volume: 0.25, pitch: 1.6 });
      }
      d.load -= n;
      if (!d.load) d.ore = null;
    }
    d.state = d.load > 0 && G.run.dronesOut ? 'haul' : 'docked';
    d.target = null;
  }

  function hurt(d, amount) {
    d.hp -= amount;
    if (d.hp > 0) return;
    d.alive = false;
    d.rebuild = 25;
    d.target = null;
    d.load = 0;
    d.ore = null;
    NS.fx.explode(d.x, d.y, 12, NS.fx.TOXIC, { noDebris: true });
    NS.audio.sfxAt('smallExplode', d.x, d.y, { volume: 0.5 });
  }

  function blast(x, y, radius) {
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      if (d.alive && d.state !== 'docked' && (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y) < radius * radius) hurt(d, 40);
    }
  }

  /* drones still carrying ore when the trip ends hand it over if there is room */
  function flush() {
    for (let i = 0; i < G.drones.length; ++i) if (G.drones[i].alive && G.drones[i].load) unload(G.drones[i]);
  }

  Object.assign(NS.drones, {
    setup, toggle, update, hurt, blast, flush
  });
})();
