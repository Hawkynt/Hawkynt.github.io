/* Ship-launched mining drones drill rocks, collect nuggets and deliver to the ship, outpost
   or station. F recalls or relaunches the swarm. Owns G.drones. */
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
      if (!o.alive || !o.ore || (d.ore && o.ore !== d.ore) || o.kind !== 'rock' || o.volatile || taken(o, d)) continue;
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
        if (G.run.dronesOut) d.state = d.load > 0 ? 'return' : 'seek';
        continue;
      }
      if (d.state === 'seek') {
        if (!d.target || !d.target.alive) d.target = pickTarget(d);
        if (!d.target) {
          if (d.load > 0) d.state = 'return';
          else fly(d, s.x, s.y, dt, speed);
        } else {
          const o = d.target;
          const a = Math.atan2(d.y - o.y, d.x - o.x);
          if (fly(d, o.x + Math.cos(a) * (o.r + 36), o.y + Math.sin(a) * (o.r + 36), dt, speed) < 30) d.state = 'mine';
        }
      } else if (d.state === 'mine') {
        const o = d.target;
        if (!o || !o.alive) {
          d.target = null;
          d.state = d.load >= capacity(st.droneHaul) ? 'return' : 'seek';
        } else {
          const a = Math.atan2(d.y - o.y, d.x - o.x) + dt * 0.4;
          fly(d, o.x + Math.cos(a) * (o.r + 34), o.y + Math.sin(a) * (o.r + 34), dt, speed * 0.6);
          d.beam = true;
          const hx = o.x + Math.cos(a) * o.r * 0.85, hy = o.y + Math.sin(a) * o.r * 0.85;
          G.beams.push({ x0: d.x, y0: d.y, x1: hx, y1: hy, hit: true, primary: false, drone: true, color: '#5cff9a' });
          if (R() < dt * 10) NS.fx.sparks(hx, hy, a, 1.6, 1, '#b4ffc8', 160, 0.25);
          NS.asteroids.damage(o, 11 * st.droneLaser * dt, hx, hy, 'drone');
        }
        const limit = capacity(st.droneHaul);
        if (sweep(d, limit, 110, true)) NS.fx.glow(d.x, d.y, 14, ORE_BY_ID[d.ore].color, 0.2);
        if (d.load >= limit) {
          d.state = 'return';
          d.target = null;
        }
      } else if (d.state === 'return' || d.state === 'haul') {
        if (G.run.dronesOut && d.load > 0) {
          const to = destination(d);
          if (fly(d, to.x, to.y, dt, speed * 1.2) < deliveryRange(to)) {
            deliver(d, to);
            if (!d.load) d.state = 'seek';
          }
        } else if (fly(d, s.x, s.y, dt, speed * 1.2) < s.r + 14) {
          unload(d);
          d.state = G.run.dronesOut ? 'seek' : 'docked';
          d.target = null;
        }
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

  function capacity(slots, press = G.stats) {
    return slots * NS.rules.blockSize(press);
  }

  /* Take only what fits, leaving any remainder in the field. */
  function sweep(d, limit, range, avoidPulled) {
    const before = d.load;
    for (let i = 0; i < G.nuggets.length && d.load < limit; ++i) {
      const n = G.nuggets[i];
      if (!n.alive || n.credits || (avoidPulled && n.pulled) || (d.ore && d.ore !== n.ore)) continue;
      if ((n.x - d.x) ** 2 + (n.y - d.y) ** 2 > range * range) continue;
      const units = Math.min(n.units, limit - d.load);
      d.ore = n.ore;
      d.load += units;
      n.units -= units;
      if (!n.units) n.alive = false;
    }
    return d.load - before;
  }

  function distanceSquared(d, to) {
    return (d.x - to.x) ** 2 + (d.y - to.y) ** 2;
  }

  function destination(d) {
    const dock = G.dock;
    if (d.stationFallback) return dock;
    const ship = G.ship, hub = NS.base.cargoHub();
    const stationDistance = distanceSquared(d, dock);
    const shipDistance = ship && ship.alive && NS.mining.roomFor(d.ore) > 0 ? distanceSquared(d, ship) : Infinity;
    if (hub && distanceSquared(d, hub) <= Math.min(stationDistance, shipDistance)) {
      if (NS.base.oreRoom(d.ore) > 0) return hub;
      d.stationFallback = true;
      return dock;
    }
    return shipDistance < stationDistance ? ship : dock;
  }

  function deliveryRange(to) {
    return to === G.dock ? 70 : to.r + 14;
  }

  function unload(d) {
    if (!d.load || !d.ore) return 0;
    const n = Math.min(NS.mining.roomFor(d.ore), d.load);
    if (n > 0) NS.mining.addCargo(d.ore, n);
    d.load -= n;
    if (!d.load) {
      d.ore = null;
      d.stationFallback = false;
    }
    return n;
  }

  function deliver(d, to) {
    const id = d.ore;
    let n = d.load;
    if (to === G.ship) n = unload(d);
    else {
      if (to === G.dock) NS.trip.bank(id, n);
      else n = NS.base.receiveOre(id, n, d);
      d.load -= n;
      if (!d.load) {
        d.ore = null;
        d.stationFallback = false;
      } else d.stationFallback = true;
    }
    if (n > 0) {
      NS.fx.text(to.x, to.y - 60, '+' + n + ' ' + ORE_BY_ID[id].name + (to === G.dock ? ' banked' : ''), '#b4ffc8', 14, 1.2);
      NS.audio.sfxAt('pickup', to.x, to.y, { volume: 0.25, pitch: 1.3 });
    }
    d.target = null;
  }

  function hurt(d, amount) {
    d.hp -= amount;
    if (d.hp > 0) return;
    d.alive = false;
    d.rebuild = 25;
    d.stationFallback = false;
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

  function loaded(d) {
    return d.alive && d.load > 0 && d.ore;
  }

  function fleetMiner(u) {
    return u.side === 'player' && u.type === 'miner';
  }

  function hasCargo() {
    return G.drones.some(loaded) || G.units.some(u => fleetMiner(u) && loaded(u));
  }

  /* Station docking settles every friendly mining basket without using the ship's hold. */
  function settleAtDock() {
    const hub = NS.base.cargoHub();
    let units = 0;
    const settle = (d) => {
      if (!loaded(d)) return false;
      units += d.load;
      if (hub && distanceSquared(d, hub) < distanceSquared(d, G.dock)) deliver(d, hub);
      if (d.load) deliver(d, G.dock);
      return true;
    };
    for (const d of G.drones) {
      if (settle(d) && d.state !== 'docked') d.state = G.run.dronesOut ? 'seek' : 'return';
    }
    for (const u of G.units) {
      if (!fleetMiner(u) || !settle(u)) continue;
      u.job = 'idle';
      u.rock = null;
    }
    return units;
  }

  /* drones still carrying ore when the trip ends hand it over if there is room */
  function flush() {
    for (let i = 0; i < G.drones.length; ++i) if (G.drones[i].alive && G.drones[i].load) unload(G.drones[i]);
  }

  Object.assign(NS.drones, {
    setup, toggle, update, hurt, blast, flush, hasCargo, settleAtDock, capacity, sweep, destination, deliveryRange, deliver
  });
})();
