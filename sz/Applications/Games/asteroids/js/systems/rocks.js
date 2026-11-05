/* The rocks: spawning (at the field edge, away from the ship), drifting and tumbling on the
   wrapping field (slowed by frost and the chrono field), magma drips, taking damage with hit
   flashes, and shattering into children with each type's death effect - volatile blasts, frost
   fields, fire, chain lightning, gravity snaps, gold jackpots, seasonal tokens - plus stardust,
   shards and power-up drops. Owns G.rocks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, FIELD_W, FIELD_H, ROCK_R, ROCK_SPEED } = C;
  const { ROCK_TYPES } = NS.rockData;
  const { wrap, wrapD } = NS.rng;
  const fx = NS.fx;
  const rules = NS.rules;
  const { sfx, zenNote } = NS.audio;
  const { compact } = NS.grid;

  const near = [];

  function rng() {
    return NS.sim.rng();
  }

  function spawn(type, size, x, y, vx, vy) {
    if (G.rocks.length >= C.MAX_ROCKS) return null;
    const hp = rules.rockHp(type, size);
    const r = {
      alive: true, id: G.nextId++, type: type, size: size, x: x, y: y, vx: vx, vy: vy, r: ROCK_R[size],
      a: rng() * TAU, va: (rng() - 0.5) * (3.2 - size * 0.6), hp: hp, maxHp: hp, hitT: 0, variant: Math.floor(rng() * 6),
      dripT: 1 + rng(), spawnT: 0.4,
    };
    G.rocks.push(r);
    return r;
  }

  /* a rock arriving from the edge of the field, heading roughly inward */
  function spawnEdge(type, size, speedMul) {
    const s = G.ship;
    let x = 0, y = 0;
    for (let k = 0; k < 12; ++k) {
      const side = Math.floor(rng() * 4);
      x = side < 2 ? rng() * FIELD_W : side === 2 ? -ROCK_R[size] * 0.5 : FIELD_W + ROCK_R[size] * 0.5;
      y = side >= 2 ? rng() * FIELD_H : side === 0 ? -ROCK_R[size] * 0.5 : FIELD_H + ROCK_R[size] * 0.5;
      x = wrap(x, FIELD_W);
      y = wrap(y, FIELD_H);
      if (!s || s.dead) break;
      const dx = wrapD(x - s.x, FIELD_W), dy = wrapD(y - s.y, FIELD_H);
      if (dx * dx + dy * dy > 260 * 260) break;
    }
    const tx = FIELD_W * (0.3 + rng() * 0.4), ty = FIELD_H * (0.3 + rng() * 0.4);
    const a = Math.atan2(wrapD(ty - y, FIELD_H), wrapD(tx - x, FIELD_W)) + (rng() - 0.5) * 0.9;
    const sp = ROCK_SPEED[size] * (ROCK_TYPES[type].speed || 1) * (speedMul || 1) * (0.8 + rng() * 0.45);
    return spawn(type, size, x, y, Math.cos(a) * sp, Math.sin(a) * sp);
  }

  function update(dt) {
    const k = NS.sim.worldScale();
    const list = G.rocks;
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      r.hitT = Math.max(0, r.hitT - dt);
      r.spawnT = Math.max(0, r.spawnT - dt);
      const slow = NS.hazards.slowAt(r.x, r.y) ? 0.35 : 1;
      NS.hazards.bend(r, dt, 0.25);
      r.x = wrap(r.x + r.vx * dt * k * slow, FIELD_W);
      r.y = wrap(r.y + r.vy * dt * k * slow, FIELD_H);
      r.a += r.va * dt * k * slow;
      if (r.type === 'lava' && r.size >= 2) {
        r.dripT -= dt * k;
        if (r.dripT <= 0) {
          r.dripT = 1.6 + rng();
          NS.hazards.zone('fire', r.x - r.vx * 0.2, r.y - r.vy * 0.2, 16 + r.size * 4, 2.6);
        }
      }
    }
    compact(list);
  }

  /* applies damage; returns true when the rock shattered */
  function damage(r, dmg, angle, cause) {
    if (!r.alive) return false;
    r.hp -= dmg;
    r.hitT = 0.12;
    if (r.hp > 0) {
      fx.chips(r.x, r.y, 2, 120, ROCK_TYPES[r.type].pal, 2.5);
      sfx('thud', { volume: 0.25, pitch: 1.2 + r.size * -0.15 });
      return false;
    }
    shatter(r, angle, cause);
    return true;
  }

  function shatter(r, angle, cause) {
    r.alive = false;
    const T = ROCK_TYPES[r.type];
    const pal = T.pal;
    const x = r.x, y = r.y;
    /* children */
    if (r.size > 1) {
      const n = r.size === 4 ? 3 : r.type === 'crystal' ? 3 : 2;
      const childType = r.type === 'gold' && r.size === 3 ? 'gold' : r.type === 'gold' ? 'normal' : r.type;
      const base = angle === undefined ? rng() * TAU : angle;
      for (let i = 0; i < n; ++i) {
        const a = base + Math.PI / 2 + (i - (n - 1) / 2) * (TAU / (n + 1)) + (rng() - 0.5) * 0.5;
        const sp = ROCK_SPEED[r.size - 1] * (T.speed || 1) * (0.9 + rng() * 0.6) * (G.run ? G.run.speed || 1 : 1);
        const off = ROCK_R[r.size - 1] * 0.5;
        const c = spawn(childType, r.size - 1, wrap(x + Math.cos(a) * off, FIELD_W), wrap(y + Math.sin(a) * off, FIELD_H),
          r.vx * 0.4 + Math.cos(a) * sp, r.vy * 0.4 + Math.sin(a) * sp);
        if (c) c.spawnT = 0;
      }
    }
    /* look and feel */
    fx.shatter(x, y, r.r, pal, pal[3]);
    if (r.size >= 3) {
      fx.hitStop(r.size === 4 ? 0.08 : 0.03);
      fx.punch(r.size === 4 ? 0.03 : 0.01);
    }
    if (G.run && G.run.mode === 'zen') zenNote(r.size);
    else sfx(r.size >= 3 ? 'explode' : 'smallExplode', { volume: r.size >= 3 ? 0.6 : 0.45, pitch: 0.9 + (3 - Math.min(3, r.size)) * 0.18 });

    deathEffect(r, T);

    if (!G.run) return;
    /* scoring and loot */
    const pts = rules.rockScore(r.type, r.size);
    NS.progress.kill(x, y, pts, T.pal[3]);
    NS.progress.count('rocks', 1);
    if (r.type === 'gold') NS.progress.count('gold', 1);
    let dust = (r.size === 4 ? 6 : r.size) * (T.dust || 1);
    if (G.cal.featured && G.cal.featured.rock === r.type) dust *= 2;
    NS.powerups.motes(x, y, dust, NS.campaign.CHAPTERS[G.run.chapter || 0].theme.dust);
    const luck = G.stats.luck * (G.run.mods && G.run.mods.indexOf('frenzy') >= 0 ? 2 : 1);
    const chance = [0, 0.035, 0.06, 0.09, 0.5][r.size] * luck * (G.run.mode === 'zen' ? 1.4 : 1);
    if (cause !== 'nova' && rng() < chance) NS.powerups.drop(x, y);
    const L = G.level;
    if (L && L.obj === 'collect' && (r.type === 'gold' || (r.size >= 2 && rng() < 0.3)))
      NS.powerups.spawnPickup('shard', x, y, r.type === 'gold' ? 2 : 1);
    if (T.season) NS.powerups.spawnPickup('token', x, y, r.size >= 3 ? 2 : 1);
  }

  function deathEffect(r, T) {
    const x = r.x, y = r.y;
    switch (T.fx) {
      case 'blast':
        fx.explode(x, y, 40 + r.size * 14, fx.FIRE, { pal: T.pal });
        NS.collision.blast(x, y, 70 + r.size * 28, 3, false, 260);
        fx.flash('#ffa040', 0.18);
        sfx('explode', { pitch: 0.8 });
        break;
      case 'freeze':
        NS.hazards.zone('ice', x, y, 30 + r.size * 18, 6);
        fx.shapes(x, y, 6 + r.size * 2, 120, 0, '#e8faff');
        break;
      case 'fire':
        for (let i = 0; i < r.size; ++i)
          NS.hazards.zone('fire', wrap(x + (rng() - 0.5) * r.r * 1.6, FIELD_W), wrap(y + (rng() - 0.5) * r.r * 1.6, FIELD_H), 18 + r.size * 5, 3.2);
        fx.embers(x, y, 12, 200, fx.FIRE);
        break;
      case 'arc':
        chain(x, y, Math.min(3, r.size + 1), 170);
        break;
      case 'pull':
        NS.hazards.implode(x, y, 130 + r.size * 30);
        break;
      case 'jackpot':
        fx.sparks(x, y, 0, TAU, 24, '#ffd25a', 380, 0.5);
        fx.ring(x, y, 10, 90, 0.45, '#ffd25a', 6);
        sfx('coin', { pitch: 0.9 });
        break;
      case 'shards':
        fx.sparks(x, y, 0, TAU, 14, '#b0f0ff', 420, 0.3);
        break;
      case 'token': {
        const sd = G.cal.seasonDef;
        fx.shapes(x, y, 10, 160, decorShape(G.cal.season), sd.tokenCol);
        break;
      }
    }
  }

  function decorShape(season) {
    return season === 'winter' ? 0 : season === 'spring' ? 1 : season === 'autumn' || season === 'halloween' ? 2 : 3;
  }

  /* storm rocks: lightning jumps to the nearest rocks */
  function chain(x, y, jumps, reach) {
    let cx = x, cy = y;
    for (let j = 0; j < jumps; ++j) {
      let best = null, bd = reach * reach;
      for (let i = 0; i < G.rocks.length; ++i) {
        const o = G.rocks[i];
        if (!o.alive || o._arc === G.time) continue;
        const dx = wrapD(o.x - cx, FIELD_W), dy = wrapD(o.y - cy, FIELD_H);
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) break;
      best._arc = G.time;
      G.arcs.push({ x0: cx, y0: cy, x1: cx + wrapD(best.x - cx, FIELD_W), y1: cy + wrapD(best.y - cy, FIELD_H), t: 0.25, seed: Math.floor(NS.rng.fx() * 1000) });
      cx = best.x;
      cy = best.y;
      damage(best, 1, undefined, 'arc');
    }
    if (jumps) sfx('zap', { volume: 0.5 });
  }

  /* counts rocks still on the field */
  function count() {
    let n = 0;
    for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].alive) ++n;
    return n;
  }

  Object.assign(NS.rocks, {
    spawn, spawnEdge, update, damage, shatter, chain, count, decorShape, near
  });
})();
