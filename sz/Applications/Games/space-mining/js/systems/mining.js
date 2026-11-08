/* Mining: the laser (ray cast through the rock grid to the first rock, pirate or wreck; heat,
   sparks, fault cracks), the split beam, ore nuggets (spawned by fractures and chips, drifting,
   pulled in by the tractor beam, stored by hold space), salvage credits, the scanner pulse and
   seismic charges. Owns G.nuggets, G.beams and G.charges; writes the trip's hold. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, LASER_RANGE, COLLECT_R, MAX_NUGGETS, NUGGET_LIFE } = C;
  const { ORE_BY_ID } = NS.ores;
  const { compact, createPool } = NS.grid;
  const rules = NS.rules;
  const R = NS.rng.fx;
  const near = [];
  const near2 = [];
  const near3 = [];
  const hit = { t: 0, obj: null, kind: '' };
  const pool = createPool(() => ({ alive: false }));
  let laserSfx = 0, fullT = 0;
  /* the laser fires along the nose and bends at most this far to either side; a lock off the nose
     turns the ship toward it only this fast (rad/s) */
  const AIM_CONE = 0.6;
  const AIM_TURN = 1.1;

  /* ── hold ── */
  function spaceLeft() {
    return G.run.cargoMax - G.run.cargoUsed;
  }

  function fits(oreId, units) {
    return spaceLeft() + 1e-6 >= rules.oreSpace(G.stats, oreId) * units;
  }

  function addCargo(oreId, units) {
    const run = G.run;
    const ore = ORE_BY_ID[oreId];
    run.cargo[oreId] = (run.cargo[oreId] || 0) + units;
    run.cargoUsed += rules.oreSpace(G.stats, oreId) * units;
    run.units += units;
    run.rdAcc += ore.rd * units * G.stats.dataMul;
    while (run.rdAcc >= 1) {
      run.rdAcc -= 1;
      run.rd += 1;
      NS.fx.text(G.ship.x, G.ship.y - 56, '+1 DATA', '#b48aff', 15, 1.2);
    }
    NS.life.onCargo(oreId, units);
    if (run.mode === 'career') {
      rules.bump(G.save, 'nuggets', 1);
      if (oreId === 'voidCrystal') rules.bump(G.save, 'voidCrystals', units);
    }
  }

  /* ── nuggets ── */
  function spawnNugget(x, y, oreId, units, from, speed) {
    if (G.nuggets.length >= MAX_NUGGETS) return null;
    const n = pool.get();
    const a = R() * TAU, sp = (speed || 90) * (0.4 + R() * 0.8);
    n.alive = true;
    n.x = x + Math.cos(a) * (from ? from.r * 0.3 : 0);
    n.y = y + Math.sin(a) * (from ? from.r * 0.3 : 0);
    n.vx = Math.cos(a) * sp + (from ? from.vx : 0);
    n.vy = Math.sin(a) * sp + (from ? from.vy : 0);
    n.ore = oreId;
    n.credits = 0;
    n.units = units;
    n.rot = R() * TAU;
    n.vr = (R() - 0.5) * 6;
    n.life = NUGGET_LIFE;
    n.pulled = false;
    n.age = 0;
    n.variant = Math.floor(R() * 3);
    G.nuggets.push(n);
    return n;
  }

  function spawnSalvage(x, y, credits, n) {
    for (let i = 0; i < n; ++i) {
      const g = spawnNugget(x, y, null, 0, null, 160);
      if (g) g.credits = Math.round(credits / n);
    }
  }

  function updateNuggets(dt) {
    const s = G.ship;
    const st = G.stats;
    const range = st.tractor, range2 = range * range;
    const list = G.nuggets;
    G.run.pulled = 0;
    for (let i = 0; i < list.length; ++i) {
      const n = list[i];
      n.age += dt;
      n.life -= dt;
      if (n.life <= 0) { n.alive = false; continue; }
      const k = Math.max(0, 1 - 1.1 * dt);
      n.vx *= k;
      n.vy *= k;
      n.pulled = false;
      if (s && s.alive && n.age > 0.25) {
        const dx = s.x - n.x, dy = s.y - n.y;
        const d2 = dx * dx + dy * dy;
        const room = n.credits || fits(n.ore, n.units);
        if (d2 < range2 && room) {
          const d = Math.sqrt(d2) || 1;
          const pull = st.tractorPull * (0.35 + 0.65 * (1 - d / range));
          n.vx += dx / d * pull * dt;
          n.vy += dy / d * pull * dt;
          /* damp the sideways drift so nuggets spiral in, not orbit */
          const tx = -dy / d, ty = dx / d;
          const side = n.vx * tx + n.vy * ty;
          n.vx -= tx * side * Math.min(1, 5 * dt);
          n.vy -= ty * side * Math.min(1, 5 * dt);
          n.pulled = true;
          ++G.run.pulled;
        }
        const cr = COLLECT_R + s.r;
        if (d2 < cr * cr) {
          if (room) collect(n);
          else if (fullT <= 0) {
            fullT = 1.5;
            NS.fx.text(s.x, s.y - 50, 'HOLD FULL', '#ff6a5c', 18, 1.2);
            NS.audio.sfx('drop', { volume: 0.4 });
          }
        }
      }
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.rot += n.vr * dt;
    }
    if (fullT > 0) fullT -= dt;
    compact(list, (n) => pool.put(n));
  }

  function collect(n) {
    n.alive = false;
    const s = G.ship;
    if (n.credits) {
      G.run.salvage += n.credits;
      NS.fx.text(s.x, s.y - 40, '+' + n.credits + ' cr', '#ffd25a', 16, 1);
      NS.audio.sfx('coin', { volume: 0.5 });
      return;
    }
    addCargo(n.ore, n.units);
    const ore = ORE_BY_ID[n.ore];
    NS.fx.glow(s.x, s.y, 26, ore.color, 0.2);
    G.run.pickT = 0.25;
    G.run.lastOre = n.ore;
    /* merge rapid pickups of one ore into a single rising counter */
    const t = G.run.pickText;
    if (t && t.alive && t.ore === n.ore && t.t < 0.5) {
      t.amount += n.units;
      t.str = '+' + t.amount + ' ' + ore.name;
      t.t = 0.05;
      t.y = Math.min(t.y, s.y - 40);
    } else {
      NS.fx.text(s.x, s.y - 40, '+' + n.units + ' ' + ore.name, ore.glow, 15 + ore.rarity, 1.1);
      const last = G.texts[G.texts.length - 1];
      last.ore = n.ore;
      last.amount = n.units;
      G.run.pickText = last;
    }
    NS.audio.sfx('pickup', { volume: 0.32, pitch: 0.9 + ore.rarity * 0.12 });
  }

  /* ── laser ── */

  /* First thing along the segment: rocks from the grid, pirates and wrecks by list */
  function raycast(x0, y0, x1, y1, skip) {
    hit.t = 2;
    hit.obj = null;
    hit.kind = '';
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    const test = (o, r, kind) => {
      if (o === skip) return;
      const fx = x0 - o.x, fy = y0 - o.y;
      const b = fx * dx + fy * dy;
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - len2 * c;
      if (disc < 0) return;
      let t = (-b - Math.sqrt(disc)) / len2;
      if (t < 0) t = c < 0 ? 0 : 2;
      if (t <= 1 && t < hit.t) {
        hit.t = t;
        hit.obj = o;
        hit.kind = kind;
      }
    };
    const rocks = NS.asteroids.querySegment(x0, y0, x1, y1, 100, near);
    for (let i = 0; i < rocks.length; ++i) if (rocks[i].alive) test(rocks[i], rocks[i].r * 0.88, 'rock');
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].alive) test(G.pirates[i], G.pirates[i].r, 'pirate');
    for (let i = 0; i < G.specials.length; ++i) if (G.specials[i].alive && G.specials[i].kind === 'derelict') test(G.specials[i], G.specials[i].r * 0.8, 'wreck');
    const foes = NS.enemies.queryHostile((x0 + x1) / 2, (y0 + y1) / 2, Math.sqrt(len2) / 2 + 100, near2);
    for (let i = 0; i < foes.length; ++i) if (foes[i].alive) test(foes[i], foes[i].r, foes[i].side ? 'unit' : 'enemy');
    if (G.base) for (let i = 0; i < G.base.data.buildings.length; ++i) if (G.base.data.buildings[i].rogue) test(G.base.data.buildings[i], G.base.data.buildings[i].r, 'building');
    return hit.obj;
  }

  /* The lock for keyboard firing: the pirate or ore rock inside the cone whose edge sits closest
     to the nose, within laser reach. Barren and volatile rocks are skipped. */
  function coneTarget(s) {
    const reach = LASER_RANGE * 0.95;
    let best = null, bs = Infinity;
    const consider = (o, pad) => {
      const dx = o.x - s.x, dy = o.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d - o.r > reach) return;
      const off = Math.max(0, Math.abs(NS.rng.angleDiff(s.angle, Math.atan2(dy, dx))) - Math.asin(Math.min(1, o.r / d)));
      if (off > AIM_CONE) return;
      const score = off + d * 0.0004 + pad;
      if (score < bs) { bs = score; best = o; }
    };
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].alive) consider(G.pirates[i], -1);
    const list = NS.asteroids.queryRocks(s.x, s.y, reach + 120, near3);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.alive && o.ore && !o.volatile) consider(o, 0);
    }
    return best;
  }

  /* the beam's heading: toward the aim, clamped to the cone around the nose */
  function beamAngle(s, ox, oy, ax, ay) {
    const off = NS.rng.angleDiff(s.angle, Math.atan2(ay - oy, ax - ox));
    return s.angle + Math.max(-AIM_CONE, Math.min(AIM_CONE, off));
  }

  function updateLaser(dt) {
    G.beams.length = 0;
    const s = G.ship;
    const inp = G.input;
    if (!s || !s.alive || !inp.firing || !s.control) {
      G.run.lasering = false;
      return;
    }
    const st = G.stats;
    const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
    const ox = s.x + ca * s.r * 0.9, oy = s.y + sa * s.r * 0.9;
    const d = Math.sqrt((inp.aimWX - ox) * (inp.aimWX - ox) + (inp.aimWY - oy) * (inp.aimWY - oy)) || 1;
    const reach = LASER_RANGE * (1 + (st.scale - 1) * 0.5);
    const ba = beamAngle(s, ox, oy, inp.aimWX, inp.aimWY);
    const dx = Math.cos(ba), dy = Math.sin(ba);
    const len = Math.max(60, Math.min(reach, d + 40));
    const main = fire(ox, oy, ox + dx * len, oy + dy * len, st.laser, dt, true, null);
    G.run.lasering = true;
    if (st.twin > 0 && main) {
      /* the split beam finds another rock close to the first */
      const list = NS.asteroids.queryRocks(main.x, main.y, 260, near);
      let best = null, bd = Infinity;
      for (let i = 0; i < list.length; ++i) {
        const o = list[i];
        if (o === main || !o.alive || o.kind !== 'rock') continue;
        const q = (o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y);
        if (q < reach * reach && q < bd) { bd = q; best = o; }
      }
      if (best) fire(ox, oy, best.x, best.y, st.laser * st.twin, dt, false, main);
    }
    laserSfx -= dt;
    if (laserSfx <= 0) {
      laserSfx = 0.16;
      NS.audio.sfx('laser', { volume: 0.12, pitch: main ? 0.55 : 0.8 });
    }
  }

  function fire(x0, y0, x1, y1, dps, dt, primary, skip) {
    const obj = raycast(x0, y0, x1, y1, skip);
    const t = obj ? hit.t : 1;
    const hx = x0 + (x1 - x0) * t, hy = y0 + (y1 - y0) * t;
    G.beams.push({ x0: x0, y0: y0, x1: hx, y1: hy, hit: !!obj, primary: primary, color: G.stats.colors.glow });
    if (!obj) return null;
    let dmg = dps * dt;
    if (primary && G.stats.crit > 0 && R() < G.stats.crit * dt * 2.5) {
      dmg += dps * 0.9;
      NS.fx.sparks(hx, hy, 0, TAU, 14, '#ffffff', 380, 0.35);
      NS.fx.text(hx, hy - 20, 'FAULT', '#ffe08a', 14, 0.7);
      NS.audio.sfx('hit', { volume: 0.3, pitch: 1.4 });
    }
    const kind = hit.kind;
    const back = Math.atan2(y0 - y1, x0 - x1);
    if (R() < dt * 30) NS.fx.sparks(hx, hy, back, 2.2, 2, kind === 'rock' && obj.ore ? ORE_BY_ID[obj.ore].glow : '#ffd8a0', 240, 0.3);
    if (R() < dt * 6 && kind === 'rock') NS.fx.dust(hx, hy, 1, 10 + obj.tier * 3, G.run.zone.theme.rock[0], 40);
    if (kind === 'rock') {
      if (obj.bio) NS.life.disturb(obj);
      NS.asteroids.damage(obj, dmg, hx, hy, 'laser');
    } else if (kind === 'pirate') NS.pirates.damage(obj, dmg * 1.4, hx, hy);
    else if (kind === 'enemy') NS.enemies.damage(obj, dmg * 1.4, null);
    else if (kind === 'unit') NS.units.damage(obj, dmg * 1.4, null);
    else if (kind === 'building') NS.base.damage(obj, dmg);
    else NS.trip.cutWreck(obj, dmg, hx, hy);
    return obj;
  }

  /* ── scanner pulse and seismic charges ── */
  function pulse() {
    const run = G.run, st = G.stats, s = G.ship;
    if (!run || st.scan <= 0 || run.pulseCd > 0 || !s) return false;
    run.pulseCd = 9 - st.scan;
    const r = 900 + st.scan * 320;
    run.pulse = { x: s.x, y: s.y, r: r, t: 0 };
    NS.fx.ring(s.x, s.y, 20, r, 1.1, '#4fd8ff', 8);
    NS.fx.ring(s.x, s.y, 10, r * 0.6, 0.8, '#ffffff', 3);
    NS.audio.sfx('zap', { volume: 0.5, pitch: 0.6 });
    const list = NS.asteroids.queryRocks(s.x, s.y, r, []);
    for (let i = 0; i < list.length; ++i) list[i].scanT = G.time;
    for (let i = 0; i < G.specials.length; ++i) {
      const o = G.specials[i];
      if ((o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y) < r * r) o.known = true;
    }
    return true;
  }

  function dropCharge() {
    const run = G.run, s = G.ship;
    if (!run || run.charges <= 0 || !s) return false;
    --run.charges;
    G.charges.push({ alive: true, x: s.x, y: s.y, vx: s.vx * 0.4, vy: s.vy * 0.4, t: 1.6 });
    NS.audio.sfx('drop', { volume: 0.5 });
    return true;
  }

  function updateCharges(dt) {
    for (let i = 0; i < G.charges.length; ++i) {
      const c = G.charges[i];
      c.t -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.t > 0) continue;
      c.alive = false;
      const radius = 240;
      NS.fx.shockwave(c.x, c.y, radius, '#ffd8a0');
      NS.fx.explode(c.x, c.y, 26, NS.fx.FIRE, { noDebris: true });
      NS.fx.hitStop(0.05);
      NS.audio.sfxAt('explode', c.x, c.y, { volume: 0.8, pitch: 0.8 });
      const list = NS.asteroids.queryRocks(c.x, c.y, radius, []);
      for (let k = 0; k < list.length; ++k) {
        const o = list[k];
        const d = Math.sqrt((o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y));
        if (!o.alive || d > radius + o.r) continue;
        const f = 1 - Math.min(1, d / (radius + o.r)) * 0.5;
        if (o.volatile) o.fuse = 0.2;
        else NS.asteroids.damage(o, (o.kind === 'rock' ? 300 : 120) * f, o.x, o.y, 'blast');
      }
      NS.pirates.blast(c.x, c.y, radius, 120);
      const foes = NS.enemies.queryHostile(c.x, c.y, radius, near2);
      for (let k = 0; k < foes.length; ++k) if (foes[k].alive && !foes[k].side) NS.enemies.damage(foes[k], 140, null);
    }
    compact(G.charges);
  }

  function update(dt) {
    const run = G.run;
    if (run.pulseCd > 0) run.pulseCd -= dt;
    if (run.pulse) {
      run.pulse.t += dt;
      if (run.pulse.t > 1.2) run.pulse = null;
    }
    if (run.pickT > 0) run.pickT -= dt;
    updateLaser(dt);
    updateNuggets(dt);
    updateCharges(dt);
  }

  function clear() {
    for (let i = 0; i < G.nuggets.length; ++i) pool.put(G.nuggets[i]);
    G.nuggets.length = 0;
    G.beams.length = 0;
    G.charges.length = 0;
  }

  Object.assign(NS.mining, {
    AIM_CONE, AIM_TURN, spaceLeft, fits, addCargo, spawnNugget, spawnSalvage, raycast, update, updateLaser, coneTarget, beamAngle, pulse, dropCharge, clear
  });
})();
