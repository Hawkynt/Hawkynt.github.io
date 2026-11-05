/* Asteroids: the seeded belt layout of a zone (noise-banded density, clear space round the dock,
   ore picked by the zone mix), rock hit points and ore richness, damage with heat and fault
   cracks, fracture into smaller rocks plus ore nuggets with chunks, dust and shockwaves,
   volatile rocks that explode in chains, drift, and quiet respawning off screen.
   Owns G.rocks and the rock grid. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, ROCK_RADII, MAX_ROCKS, GRID_CELL } = C;
  const { ORES, ORE_BY_ID } = NS.ores;
  const { createGrid, compact } = NS.grid;
  const R = NS.rng.fx;

  const grid = createGrid(C.WORLD_W, C.WORLD_H, GRID_CELL);
  const near = [];
  let nextId = 1;
  let chain = { n: 0, t: 0 };

  /* hit points grow with area, belt hardness and ore rarity */
  function rockHp(tier, oreId, hardness) {
    const r = ROCK_RADII[tier];
    const rar = oreId ? ORE_BY_ID[oreId].rarity : 0;
    return (6 + r * r * 0.03) * hardness * (1 + rar * 0.2);
  }

  /* ore for a new rock: the zone mix, rare ores boosted by the Spectral Filter, null = barren */
  function pickOre(zone, rng, rareBoost, bias) {
    if (rng() < 0.12) return null;
    let total = 0;
    const ids = Object.keys(zone.ores);
    const w = [];
    for (let i = 0; i < ids.length; ++i) {
      const ore = ORE_BY_ID[ids[i]];
      let v = zone.ores[ids[i]] * (ore.rarity >= 3 ? 1 + rareBoost : 1);
      if (bias && ids[i] === bias) v *= 4;
      w.push(v);
      total += v;
    }
    let x = rng() * total;
    for (let i = 0; i < ids.length; ++i) {
      x -= w[i];
      if (x <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  function makeRock(x, y, tier, oreId, rich, rng) {
    const zone = G.run.zone;
    const hp = rockHp(tier, oreId, zone.hardness);
    const rock = {
      alive: true, id: nextId++, kind: 'rock', x: x, y: y, vx: (rng() - 0.5) * 16, vy: (rng() - 0.5) * 16,
      r: ROCK_RADII[tier] * (0.9 + rng() * 0.2), tier: tier, ore: oreId, rich: oreId ? rich : 0,
      hp: hp, maxHp: hp, rot: rng() * TAU, vr: (rng() - 0.5) * (0.8 / tier), variant: Math.floor(rng() * 4),
      volatile: false, heat: 0, chipAcc: 0, fuse: 0, fade: 1, hitX: 0, hitY: 0, flash: 0, scanT: -9,
    };
    if (oreId && zone.hazards.volatile && tier >= 2 && rng() < zone.hazards.volatile) {
      rock.volatile = true;
      rock.ore = null;
      rock.rich = 0;
    }
    return rock;
  }

  /* belt density 0..1 at a world point: two warped bands of rubble plus scattered clumps */
  function density(noise, x, y, w, h) {
    const u = x / w, v = y / h;
    const warp = NS.artKit.fbm(noise, u * 3, v * 3, 3) - 0.5;
    const b1 = Math.abs(Math.sin((v + warp * 0.25) * Math.PI * 2.2 + u * 1.3));
    const clump = NS.artKit.fbm(noise, u * 9 + 5, v * 9, 3);
    return Math.max(0, 1 - b1 * 1.25) * 0.75 + Math.max(0, clump - 0.52) * 2.2;
  }

  /* The whole belt for a trip: rocks laid out from the zone seed */
  function generate(zone, seed, stats) {
    const rng = NS.rng.makeRng(seed);
    const noise = NS.artKit.valueNoise(seed ^ 0x51ed);
    const w = G.world.w, h = G.world.h;
    const dock = G.dock;
    G.rocks.length = 0;
    const target = Math.round(300 * zone.density);
    let tries = 0;
    while (G.rocks.length < target && tries < target * 30) {
      ++tries;
      const x = 120 + rng() * (w - 240), y = 120 + rng() * (h - 240);
      const dd = (x - dock.x) * (x - dock.x) + (y - dock.y) * (y - dock.y);
      if (dd < 420 * 420) continue;
      if (rng() > density(noise, x, y, w, h)) continue;
      const roll = rng();
      const tier = roll < 0.26 ? 1 : roll < 0.6 ? 2 : roll < 0.88 ? 3 : 4;
      const bias = inRadiation(x, y) ? 'uranium' : null;
      const ore = pickOre(zone, rng, stats.rare, bias);
      const rock = makeRock(x, y, tier, ore, 0.45 + rng() * 0.55, rng);
      if (overlaps(rock)) continue;
      G.rocks.push(rock);
    }
    rebuildGrid();
  }

  function inRadiation(x, y) {
    for (let i = 0; i < G.radZones.length; ++i) {
      const z = G.radZones[i];
      if ((x - z.x) * (x - z.x) + (y - z.y) * (y - z.y) < z.r * z.r) return true;
    }
    return false;
  }

  function overlaps(rock) {
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      const d = rock.r + o.r + 6;
      if (Math.abs(o.x - rock.x) < d && Math.abs(o.y - rock.y) < d && (o.x - rock.x) * (o.x - rock.x) + (o.y - rock.y) * (o.y - rock.y) < d * d) return true;
    }
    return false;
  }

  function rebuildGrid() {
    grid.reset(G.world.w, G.world.h);
    for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].alive) grid.insert(G.rocks[i]);
  }

  function queryRocks(x, y, r, out) {
    return grid.query(x, y, r, out || near);
  }

  function querySegment(x0, y0, x1, y1, pad, out) {
    return grid.querySegment(x0, y0, x1, y1, pad, out || near);
  }

  /* Laser or blast damage at a world point; returns true when the rock fractured */
  function damage(rock, amount, hx, hy, source) {
    if (!rock.alive) return false;
    rock.hp -= amount;
    rock.heat = Math.min(1, rock.heat + amount / Math.max(8, rock.maxHp * 0.25));
    rock.hitX = hx;
    rock.hitY = hy;
    if (source === 'laser' && rock.ore) {
      rock.chipAcc += amount;
      const step = Math.max(10, rock.maxHp * 0.3);
      while (rock.chipAcc >= step) {
        rock.chipAcc -= step;
        if (R() < 0.45 * G.stats.chip) NS.mining.spawnNugget(hx, hy, rock.ore, 1, rock);
      }
    }
    if (rock.volatile && rock.hp < rock.maxHp * 0.6 && rock.fuse <= 0) rock.fuse = 1.6;
    if (rock.hp <= 0) {
      fracture(rock, hx, hy);
      return true;
    }
    return false;
  }

  /* Crack a rock: children one tier smaller, ore nuggets by richness, chunks, dust, shock */
  function fracture(rock, hx, hy) {
    if (!rock.alive) return;
    rock.alive = false;
    const ore = rock.ore ? ORE_BY_ID[rock.ore] : null;
    const pal = G.run.zone.theme.rock;
    const rng = R;
    const big = rock.tier >= 3;
    if (rock.volatile) {
      explode(rock.x, rock.y, 150 + rock.r * 1.4, rock);
      return;
    }
    /* children */
    if (rock.tier > 1 && rock.kind === 'rock') {
      const n = rock.tier === 4 ? 3 : rock.tier === 3 ? 2 + (rng() < 0.5 ? 1 : 0) : 2;
      const base = rng() * TAU;
      for (let i = 0; i < n && G.rocks.length < MAX_ROCKS; ++i) {
        const a = base + i * TAU / n + (rng() - 0.5) * 0.6;
        const c = makeRock(rock.x + Math.cos(a) * rock.r * 0.45, rock.y + Math.sin(a) * rock.r * 0.45, rock.tier - 1, rock.ore, rock.rich * 0.92, rng);
        c.volatile = false;
        c.ore = rock.ore;
        c.rich = rock.rich * 0.92;
        const sp = 40 + rng() * 60;
        c.vx = rock.vx + Math.cos(a) * sp;
        c.vy = rock.vy + Math.sin(a) * sp;
        c.vr = (rng() - 0.5) * 2.4;
        c.heat = 0.7;
        G.rocks.push(c);
        grid.insert(c);
      }
    }
    /* nuggets */
    if (ore) {
      let units = Math.round((rock.tier === 1 ? 2.2 : rock.tier * 1.4) * (0.5 + rock.rich) * G.stats.yieldMul);
      if (rock.kind === 'geode') units = 26 + Math.round(rng() * 10);
      units = Math.max(1, units);
      while (units > 0) {
        const u = units >= 4 && rng() < 0.3 ? 2 : 1;
        NS.mining.spawnNugget(rock.x, rock.y, rock.ore, u, rock, 70 + rock.r * 2);
        units -= u;
      }
    }
    /* effects */
    const glowC = ore ? ore.glow : '#d8d0c8';
    NS.fx.chunks(rock.x, rock.y, Math.min(16, 3 + rock.tier * 3), 90 + rock.r * 2.4, pal[0], 3 + rock.tier * 1.6);
    NS.fx.chunks(rock.x, rock.y, Math.min(10, 2 + rock.tier * 2), 70 + rock.r * 2, pal[1], 2 + rock.tier * 1.4);
    NS.fx.dust(rock.x, rock.y, 2 + rock.tier * 2, rock.r * 0.9, pal[0], 40 + rock.r);
    NS.fx.sparks(rock.x, rock.y, 0, TAU, 6 + rock.tier * 4, glowC, 260 + rock.r * 3, 0.5);
    NS.fx.glow(rock.x, rock.y, rock.r * 1.6, ore ? ore.color : '#ffd8a0', 0.25, 0, 0, rock.r * 2);
    NS.fx.ring(rock.x, rock.y, rock.r * 0.4, rock.r * (big ? 2.6 : 2), big ? 0.5 : 0.35, glowC, big ? 7 : 4);
    if (big) {
      NS.fx.shake(0.18 + rock.tier * 0.05);
      NS.fx.hitStop(rock.tier === 4 ? 0.06 : 0.035);
    }
    NS.audio.sfxAt(big ? 'explode' : 'smallExplode', rock.x, rock.y, { volume: big ? 0.55 : 0.4, pitch: 1.4 - rock.tier * 0.12 });
    if (G.run) {
      ++G.run.fractures;
      if (G.run.mode === 'career') NS.rules.bump(G.save, 'fractures', 1);
    }
    if (rock.kind !== 'rock') NS.trip.onSpecialBroken(rock);
  }

  /* Volatile blast: hurts everything in reach and may set off neighbours */
  function explode(x, y, radius, source) {
    NS.fx.explode(x, y, radius * 0.32, NS.fx.FIRE, { debrisColor: G.run.zone.theme.rock[1] });
    NS.fx.shockwave(x, y, radius, '#ffb070');
    NS.fx.flash('#ffa040', 0.25);
    NS.fx.hitStop(0.05);
    NS.audio.sfxAt('explode', x, y, { volume: 0.9, pitch: 0.7 });
    if (chain.t > 0) ++chain.n;
    else chain.n = 1;
    chain.t = 0.8;
    if (G.run && G.run.mode === 'career') NS.rules.record(G.save, 'bestChain', chain.n);
    if (chain.n >= 2) NS.fx.text(x, y - 30, 'CHAIN x' + chain.n, '#ffb070', 22, 1.3);
    const list = queryRocks(x, y, radius, []);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o === source || !o.alive) continue;
      const d = Math.sqrt((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y));
      if (d > radius + o.r) continue;
      const k = 1 - Math.min(1, d / (radius + o.r));
      const push = 260 * k / o.tier;
      o.vx += (o.x - x) / (d || 1) * push;
      o.vy += (o.y - y) / (d || 1) * push;
      if (o.volatile) o.fuse = Math.min(o.fuse > 0 ? o.fuse : 9, 0.18 + R() * 0.15);
      else if (o.kind === 'rock') damage(o, 160 * k, o.x, o.y, 'blast');
    }
    NS.ship.blast(x, y, radius, 38);
    NS.pirates.blast(x, y, radius, 160);
    NS.drones.blast(x, y, radius);
  }

  function update(dt) {
    if (chain.t > 0) chain.t -= dt;
    const w = G.world.w, h = G.world.h;
    const rocks = G.rocks;
    for (let i = 0; i < rocks.length; ++i) {
      const r = rocks[i];
      if (!r.alive) continue;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vr * dt;
      const sp2 = r.vx * r.vx + r.vy * r.vy;
      if (sp2 > 900) {
        const k = 1 - 0.6 * dt;
        r.vx *= k;
        r.vy *= k;
      }
      if (r.x < r.r) { r.x = r.r; r.vx = Math.abs(r.vx); }
      if (r.x > w - r.r) { r.x = w - r.r; r.vx = -Math.abs(r.vx); }
      if (r.y < r.r) { r.y = r.r; r.vy = Math.abs(r.vy); }
      if (r.y > h - r.r) { r.y = h - r.r; r.vy = -Math.abs(r.vy); }
      if (r.heat > 0) r.heat = Math.max(0, r.heat - dt * 0.8);
      if (r.flash > 0) r.flash -= dt;
      if (r.fade < 1) r.fade = Math.min(1, r.fade + dt * 0.8);
      if (r.fuse > 0) {
        r.fuse -= dt;
        if (r.fuse <= 0) fracture(r, r.x, r.y);
      }
    }
    compact(rocks);
    rebuildGrid();
  }

  /* keep the belt alive: new rocks drift in out of sight when it thins out */
  function respawn(dt, stats) {
    const run = G.run;
    run.respawnT -= dt;
    if (run.respawnT > 0) return;
    run.respawnT = 1.2;
    let normal = 0;
    for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].tier >= 2) ++normal;
    if (normal > run.rockTarget * 0.55 || G.rocks.length >= MAX_ROCKS - 10) return;
    const s = G.ship;
    const a = R() * TAU, d = 1100 + R() * 900;
    const x = Math.max(200, Math.min(G.world.w - 200, s.x + Math.cos(a) * d));
    const y = Math.max(200, Math.min(G.world.h - 200, s.y + Math.sin(a) * d));
    const tier = R() < 0.6 ? 3 : 2 + (R() < 0.3 ? 2 : 0);
    const rock = makeRock(x, y, Math.min(4, tier), pickOre(run.zone, R, stats.rare, null), 0.5 + R() * 0.5, R);
    if (overlaps(rock)) return;
    rock.fade = 0;
    G.rocks.push(rock);
    grid.insert(rock);
  }

  /* A named special rock (geode or the Crown Heart) */
  function special(kind, x, y, oreId) {
    const rock = makeRock(x, y, 4, oreId, 1, R);
    rock.kind = kind;
    rock.volatile = false;
    rock.ore = oreId;
    rock.rich = 1;
    rock.vx = rock.vy = 0;
    rock.vr = kind === 'crown' ? 0.06 : 0.15;
    if (kind === 'geode') {
      rock.r = 74;
      rock.hp = rock.maxHp = rockHp(4, oreId, G.run.zone.hardness) * 1.6;
    } else {
      rock.r = 170;
      rock.hp = rock.maxHp = 4200;
    }
    G.rocks.push(rock);
    grid.insert(rock);
    return rock;
  }

  Object.assign(NS.asteroids, {
    rockHp, pickOre, makeRock, density, generate, rebuildGrid, queryRocks, querySegment, damage, fracture, explode,
    update, respawn, special, grid, ORES
  });
})();
