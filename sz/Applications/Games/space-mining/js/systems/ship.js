/* The mining ship: built from the trip stats, inertia flight with thrust toward the stick or
   the cursor, afterburner boost, banking turns, fuel burn, world-edge push, bouncing off rocks
   with impact damage, a recharging shield in front of the hull, blast damage, and engine
   exhaust. Owns G.ship. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, SHIP_R, SHIP_DRAG, SHIP_TURN, BOOST_MUL, BOUNDARY_PUSH } = C;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;
  const near = [];

  function create(stats, x, y) {
    G.ship = {
      alive: true, x: x, y: y, vx: 0, vy: 0, angle: -Math.PI / 2, bank: 0, turnRate: 0,
      r: SHIP_R * stats.scale,
      hull: stats.hull, maxHull: stats.hull, shield: stats.shield, maxShield: stats.shield, shieldT: 0,
      fuel: stats.fuel, maxFuel: stats.fuel,
      thrusting: false, boosting: false, thrust: 0, hitFlash: 0, iframes: 0, exhaustT: 0, shieldHit: 0,
      control: true,
    };
    return G.ship;
  }

  /* Tech bought mid-trip (from the pause menu) applies at once; ratios are kept */
  function applyStats(stats) {
    const s = G.ship;
    if (!s) return;
    const hk = s.hull / s.maxHull, fk = s.fuel / s.maxFuel;
    s.maxHull = stats.hull;
    s.hull = Math.max(1, Math.round(stats.hull * hk));
    s.maxFuel = stats.fuel;
    s.fuel = stats.fuel * fk;
    if (stats.shield > s.maxShield) s.shield += stats.shield - s.maxShield;
    s.maxShield = stats.shield;
    s.r = SHIP_R * stats.scale;
  }

  function update(dt) {
    const s = G.ship;
    if (!s || !s.alive) return;
    const st = G.stats;
    const inp = G.input;
    let mx = s.control ? inp.moveX : 0, my = s.control ? inp.moveY : 0;
    /* ship-relative keys: turn the nose, thrust along it (reverse at half power) */
    const turnKey = s.control ? inp.turn || 0 : 0;
    const axis = s.control ? inp.thrustAxis || 0 : 0;
    const relative = turnKey !== 0 || axis !== 0;
    if (turnKey) s.angle += turnKey * SHIP_TURN * dt;
    if (axis) {
      const f = axis > 0 ? 1 : -0.5;
      mx += Math.cos(s.angle) * f;
      my += Math.sin(s.angle) * f;
    }
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const want = ml > 0.1 && s.fuel > 0;
    s.boosting = want && inp.boost && st.boost > 0;
    s.thrusting = want;
    s.thrust += ((want ? (s.boosting ? 1.6 : 1) : 0) - s.thrust) * Math.min(1, dt * 10);
    if (want) {
      const acc = st.thrust * (s.boosting ? BOOST_MUL : 1);
      s.vx += mx * acc * dt;
      s.vy += my * acc * dt;
      const burn = (s.boosting ? 3.6 - st.boost * 0.5 : 1) * Math.min(1, ml) * st.fuelEff;
      s.fuel = Math.max(0, s.fuel - burn * dt);
    }
    s.fuel = Math.max(0, s.fuel - 0.06 * dt * st.fuelEff);
    /* drag: space is slippery, vanes add grip, letting go brakes harder */
    const drag = (want ? SHIP_DRAG * 0.4 : SHIP_DRAG * 1.6) * st.grip;
    const k = Math.max(0, 1 - drag * dt);
    s.vx *= k;
    s.vy *= k;
    const cap = st.maxSpeed * (s.boosting ? 1.5 : 1);
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > cap) {
      const f = 1 - Math.min(1, (sp - cap) / sp * dt * 6);
      s.vx *= f;
      s.vy *= f;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    /* face the thrust, else the laser aim, else keep heading */
    let target = s.angle;
    if (relative) target = s.angle;
    else if (want) target = Math.atan2(my, mx);
    else if (inp.firing) target = Math.atan2(inp.aimWY - s.y, inp.aimWX - s.x);
    /* the laser bends inside its cone, so firing only eases the nose toward the lock */
    const rate = !want && inp.firing ? NS.mining.AIM_TURN : 7;
    const d = angleDiff(s.angle, target);
    const auto = clamp(d, -rate * dt, rate * dt);
    s.angle += auto;
    const turn = auto + turnKey * SHIP_TURN * dt;
    s.turnRate += (turn / Math.max(dt, 1e-4) - s.turnRate) * Math.min(1, dt * 8);
    s.bank = clamp(s.turnRate / 6, -1, 1);
    edges(s, dt);
    collideRocks(s);
    shields(s, dt);
    if (s.hitFlash > 0) s.hitFlash -= dt;
    if (s.iframes > 0) s.iframes -= dt;
    if (s.shieldHit > 0) s.shieldHit -= dt;
    exhaust(s, dt);
  }

  function edges(s, dt) {
    const m = 60, w = G.world.w, h = G.world.h;
    if (s.x < m) s.vx += BOUNDARY_PUSH * dt;
    if (s.x > w - m) s.vx -= BOUNDARY_PUSH * dt;
    if (s.y < m) s.vy += BOUNDARY_PUSH * dt;
    if (s.y > h - m) s.vy -= BOUNDARY_PUSH * dt;
    s.x = clamp(s.x, 0, w);
    s.y = clamp(s.y, 0, h);
  }

  function collideRocks(s) {
    const list = NS.asteroids.queryRocks(s.x, s.y, s.r + 100, near);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (!o.alive) continue;
      const dx = s.x - o.x, dy = s.y - o.y;
      const min = s.r * 0.8 + o.r * 0.92;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1;
      const nx = dx / d, ny = dy / d;
      s.x = o.x + nx * min;
      s.y = o.y + ny * min;
      const rvx = s.vx - o.vx, rvy = s.vy - o.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0) continue;
      const mass = o.tier * o.tier * 0.5;
      const share = mass / (mass + 1);
      s.vx -= vn * nx * (1.45) * share;
      s.vy -= vn * ny * (1.45) * share;
      o.vx += vn * nx * 0.6 * (1 - share);
      o.vy += vn * ny * 0.6 * (1 - share);
      const impact = -vn;
      if (impact > 130) {
        hurt((impact - 110) * 0.09 * (1 - G.stats.impact), 'impact');
        NS.fx.sparks(s.x - nx * s.r, s.y - ny * s.r, Math.atan2(ny, nx), 1.6, 8, '#ffd8a0', 260, 0.3);
        NS.fx.chunks(s.x - nx * s.r, s.y - ny * s.r, 3, 80, G.run.zone.theme.rock[0], 3);
        NS.audio.sfx('thud', { volume: Math.min(1, impact / 400) });
      } else if (impact > 50) NS.audio.sfx('bounce', { volume: 0.25 });
    }
  }

  function shields(s, dt) {
    if (s.maxShield <= 0) return;
    if (s.shieldT > 0) s.shieldT -= dt;
    else s.shield = Math.min(s.maxShield, s.shield + s.maxShield * 0.18 * dt);
  }

  /* Damage through the shield into the hull; kind: impact, bolt, blast, radiation, storm, well */
  function hurt(amount, kind) {
    const s = G.ship;
    if (!s || !s.alive || amount <= 0 || G.cine) return;
    if (kind === 'bolt' && s.iframes > 0) return;
    s.shieldT = 3;
    if (s.shield > 0) {
      const a = Math.min(s.shield, amount);
      s.shield -= a;
      amount -= a;
      s.shieldHit = 0.3;
    }
    if (amount <= 0) return;
    s.hull -= amount;
    if (kind !== 'radiation' && kind !== 'storm') {
      s.hitFlash = 0.15;
      NS.fx.shake(Math.min(0.5, 0.08 + amount / 60));
      if (amount > 6) NS.fx.flash('#ff3020', Math.min(0.35, amount / 80));
      NS.audio.sfx('hurt', { volume: 0.5 });
    }
    if (G.run) G.run.damage += amount;
    if (s.hull <= 0) {
      s.hull = 0;
      NS.trip.shipDestroyed();
    }
  }

  function blast(x, y, radius, dmg) {
    const s = G.ship;
    if (!s || !s.alive) return;
    const dx = s.x - x, dy = s.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius) return;
    const k = 1 - d / radius;
    s.vx += dx / (d || 1) * 420 * k;
    s.vy += dy / (d || 1) * 420 * k;
    hurt(dmg * k * (1 - G.stats.blastResist), 'blast');
  }

  function exhaust(s, dt) {
    if (s.thrust < 0.05) return;
    s.exhaustT -= dt;
    if (s.exhaustT > 0) return;
    s.exhaustT = s.boosting ? 1 / 70 : 1 / 45;
    const col = G.stats.colors.glow;
    const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
    const back = s.r * 1.05;
    const nozzles = G.stats.hullId === 'leviathan' || G.stats.hullId === 'hauler' ? [-0.45, 0.45] : [0];
    for (let i = 0; i < nozzles.length; ++i) {
      const off = nozzles[i] * s.r;
      const ex = s.x - ca * back - sa * off, ey = s.y - sa * back + ca * off;
      const sp = (s.boosting ? 420 : 240) * (0.8 + R() * 0.4);
      const spread = (R() - 0.5) * 0.35;
      NS.fx.exhaust(ex, ey, s.vx * 0.3 - Math.cos(s.angle + spread) * sp, s.vy * 0.3 - Math.sin(s.angle + spread) * sp,
        (s.boosting ? 13 : 9) * s.thrust * G.stats.scale, s.boosting ? '#bfe8ff' : col, s.boosting ? NS.fx.PLASMA : null);
    }
  }

  Object.assign(NS.ship, {
    create, applyStats, update, hurt, blast
  });
})();
