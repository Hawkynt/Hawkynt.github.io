/* Life and gas in the belts: nebula gas pockets the ship scoops by flying through them,
   drifting Bloom biomass clouds (rich, but they contaminate the hold), spore-crusted and
   crystalline living rocks that burst when disturbed (crystal ones shed swarmers), and
   dormant hive nests in hollow rocks. Contaminated cargo can carry the Bloom into an outpost.
   Owns G.clouds. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ORE_BY_ID } = NS.ores;
  const R = NS.rng.fx;

  function clear(pt, r, m) {
    if (G.dock && (pt.x - G.dock.x) * (pt.x - G.dock.x) + (pt.y - G.dock.y) * (pt.y - G.dock.y) < (r + 500) * (r + 500)) return false;
    if (NS.base.blocks(pt.x, pt.y, r + (m || 200))) return false;
    return true;
  }

  function spot(rng, r) {
    for (let i = 0; i < 60; ++i) {
      const p = { x: 300 + rng() * (G.world.w - 600), y: 300 + rng() * (G.world.h - 600) };
      if (clear(p, r)) return p;
    }
    return null;
  }

  /* lay out the pockets, clouds, living rocks and hives of a belt (seeded) */
  function setup(zone, seed, mods) {
    const rng = NS.rng.makeRng((seed ^ 0x3c6ef372) >>> 0);
    const m = mods || NS.calendar.NEUTRAL;
    G.clouds.length = 0;
    const gases = Object.keys(zone.gases || {});
    let total = 0;
    for (let i = 0; i < gases.length; ++i) total += zone.gases[gases[i]];
    const pockets = gases.length ? 5 + gases.length * 2 : 0;
    for (let i = 0; i < pockets; ++i) {
      let x = rng() * total, res = gases[0];
      for (let k = 0; k < gases.length; ++k) { x -= zone.gases[gases[k]]; if (x <= 0) { res = gases[k]; break; } }
      const r = 110 + rng() * 90;
      const p = spot(rng, r);
      if (!p) continue;
      G.clouds.push(cloud(p.x, p.y, r, res, false, rng));
    }
    const life = (zone.life || 0) * m.life;
    if (life <= 0) return;
    const blooms = Math.round(life * 5);
    for (let i = 0; i < blooms; ++i) {
      const r = 90 + rng() * 70;
      const p = spot(rng, r);
      if (p) G.clouds.push(cloud(p.x, p.y, r, 'biomass', true, rng));
    }
    /* living rocks: spores in the inner belts, crystal growths in the outer ones */
    const chance = Math.min(0.5, life * 0.22);
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (o.kind !== 'rock' || !o.ore || o.tier < 2 || o.volatile || rng() > chance) continue;
      o.ore = 'biomass';
      o.bio = zone.index >= 3 ? 'crystal' : 'spore';
    }
    const hives = life >= 0.25 ? 1 + Math.floor(life * 2.5) : 0;
    for (let i = 0; i < hives; ++i) {
      const p = spot(rng, 300);
      if (p) NS.enemies.spawn('hive', p.x, p.y, { dormant: true, angle: rng() * TAU });
    }
  }

  function cloud(x, y, r, res, bio, rng) {
    return { x: x, y: y, r: r, r0: r, res: res, bio: bio, amount: Math.round(r * (bio ? 0.25 : 0.35)), max: Math.round(r * (bio ? 0.25 : 0.35)),
      vx: (rng() - 0.5) * (bio ? 14 : 5), vy: (rng() - 0.5) * (bio ? 14 : 5), seed: Math.floor(rng() * 1e6), phase: rng() * TAU, acc: 0, alive: true };
  }

  function update(dt) {
    const s = G.ship;
    const run = G.run;
    for (let i = 0; i < G.clouds.length; ++i) {
      const c = G.clouds[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < 200 || c.x > G.world.w - 200) c.vx = -c.vx;
      if (c.y < 200 || c.y > G.world.h - 200) c.vy = -c.vy;
      c.phase += dt * 0.3;
      if (c.amount <= 0 || !s || !s.alive || !s.control) continue;
      const dx = s.x - c.x, dy = s.y - c.y;
      if (dx * dx + dy * dy > c.r * c.r * 0.8) continue;
      const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (sp < 20 || !NS.mining.fits(c.res, 1)) continue;
      c.acc += dt * (2 + sp / 160);
      while (c.acc >= 1 && c.amount > 0 && NS.mining.fits(c.res, 1)) {
        c.acc -= 1;
        --c.amount;
        NS.mining.addCargo(c.res, 1);
        const o = ORE_BY_ID[c.res];
        NS.fx.glow(s.x, s.y, 20, o.color, 0.25);
        if (R() < 0.3) NS.fx.text(s.x, s.y - 40, '+1 ' + o.name, o.glow, 13, 0.8);
      }
      c.r = c.r0 * (0.35 + 0.65 * c.amount / c.max);
      if (R() < dt * 20) NS.fx.glow(s.x - s.vx * 0.05, s.y - s.vy * 0.05, 16, ORE_BY_ID[c.res].glow, 0.4, -s.vx * 0.2, -s.vy * 0.2, 20);
    }
    for (let i = G.clouds.length - 1; i >= 0; --i) if (G.clouds[i].amount <= 0) G.clouds.splice(i, 1);
  }

  /* the laser touches a living rock: spores puff out (crystal ones also shed swarmers) */
  function disturb(rock) {
    if (rock.woke) return;
    rock.woke = true;
    const col = rock.bio === 'crystal' ? '#c8a0ff' : '#9ae04a';
    NS.fx.smoke(rock.x, rock.y, 10, rock.r * 0.6, false);
    for (let i = 0; i < 14; ++i) NS.fx.glow(rock.x, rock.y, 10 + R() * 12, col, 1.2 + R(), (R() - 0.5) * 140, (R() - 0.5) * 140, 14);
    const s = G.ship;
    if (s && (s.x - rock.x) * (s.x - rock.x) + (s.y - rock.y) * (s.y - rock.y) < 260 * 260) {
      G.run.contam += 2;
      NS.fx.text(s.x, s.y - 50, 'SPORES ON THE HULL', '#9ae04a', 14, 1.4);
    }
    if (rock.bio === 'crystal') {
      for (let i = 0; i < 2; ++i) {
        const a = R() * TAU;
        const e = NS.enemies.spawn('swarmer', rock.x + Math.cos(a) * rock.r, rock.y + Math.sin(a) * rock.r, {});
        e.vx = Math.cos(a) * 220;
        e.vy = Math.sin(a) * 220;
      }
    }
    NS.audio.sfxAt('hurt', rock.x, rock.y, { volume: 0.3, pitch: 0.5 });
  }

  /* bio-matter in the hold carries spores */
  function onCargo(oreId, units) {
    if (!ORE_BY_ID[oreId].bio) return;
    G.run.contam += units;
    if (G.run.mode === 'career') NS.rules.bump(G.save, 'bioHarvest', units);
  }

  Object.assign(NS.life, {
    setup, update, disturb, onCargo, cloud
  });
})();
