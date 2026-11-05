/* The collision pass on the wrapping field, with rocks bucketed in a toroidal grid each step:
   shots against rocks, raiders, titan parts and mines (criticals, lance piercing, ricochet), the
   ship against everything that hurts (rocks unless rammed, raiders, enemy shots, fire, beams,
   lightning, well cores), orbit blades and the Sunbeam, area blasts with knock-back, and the
   nearest-target query used by seekers and drones. Owns the grid. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, FIELD_W, FIELD_H } = C;
  const { wrapD, fx: R } = NS.rng;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  const grid = NS.grid.createGrid(FIELD_W, FIELD_H, C.GRID_CELL);
  const found = [];
  const found2 = [];
  const found3 = [];
  const blade = { x: 0, y: 0, a: 0 };
  const MAX_R = C.ROCK_R[4];

  function d2(ax, ay, bx, by) {
    const dx = wrapD(bx - ax, FIELD_W), dy = wrapD(by - ay, FIELD_H);
    return dx * dx + dy * dy;
  }

  function rebuild() {
    grid.clear();
    for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].alive) grid.insert(G.rocks[i]);
  }

  function update(dt) {
    rebuild();
    shots();
    shipHits(dt);
    blades(dt);
  }

  /* ── player shots ── */
  function shotDamage(b) {
    let dmg = b.dmg * (G.run && G.run.mods && G.run.mods.indexOf('glass') >= 0 ? 2 : 1);
    if (G.stats.crit > 0 && NS.sim.rng() < G.stats.crit) {
      dmg *= 3;
      fx.text(b.x, b.y - 10, 'CRIT', '#ffd25a', 13, 0.6);
    }
    return dmg;
  }

  /* after a hit: pierce on, ricochet to another target, or stop */
  function afterHit(b, id) {
    b.last = id;
    if (b.pierce > 0) { --b.pierce; return; }
    if (b.ric > 0) {
      --b.ric;
      const t = nearestTarget(b.x, b.y, 360, id);
      if (t) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const a = Math.atan2(wrapD(t.y - b.y, FIELD_H), wrapD(t.x - b.x, FIELD_W));
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.life = Math.max(b.life, 0.5);
        fx.sparks(b.x, b.y, a, 0.8, 4, '#ffffff', 260, 0.2);
        return;
      }
    }
    b.alive = false;
  }

  function shots() {
    const list = G.bullets;
    const ramp = NS.weapons.shotRamp();
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (!b.alive) continue;
      /* rocks */
      grid.query(b.x, b.y, b.r + MAX_R, found);
      for (let k = 0; k < found.length && b.alive; ++k) {
        const r = found[k];
        if (!r.alive || r.id === b.last) continue;
        const rr = r.r * 0.92 + b.r;
        if (d2(b.x, b.y, r.x, r.y) < rr * rr) {
          const ang = Math.atan2(b.vy, b.vx);
          fx.hitSpark(b.x, b.y, ang + Math.PI, ramp[1]);
          NS.rocks.damage(r, shotDamage(b), ang, 'shot');
          afterHit(b, r.id);
        }
      }
      if (!b.alive) continue;
      /* raiders */
      for (let k = 0; k < G.enemies.length; ++k) {
        const e = G.enemies[k];
        if (!e.alive || e.id === b.last || !NS.enemies.hittable(e)) continue;
        const rr = e.r + b.r;
        if (d2(b.x, b.y, e.x, e.y) < rr * rr) {
          NS.enemies.damage(e, shotDamage(b));
          afterHit(b, e.id);
          if (!b.alive) break;
        }
      }
      if (!b.alive) continue;
      /* titan */
      const boss = G.boss;
      if (boss && boss.dying <= 0) {
        let hit = false;
        for (let k = 0; k < boss.parts.length; ++k) {
          const p = boss.parts[k];
          if (!p.alive) continue;
          const rr = p.r + b.r;
          if (d2(b.x, b.y, p.x, p.y) < rr * rr) {
            NS.bosses.damagePart(boss, p, shotDamage(b));
            fx.hitSpark(b.x, b.y, R() * TAU, ramp[1]);
            b.alive = false;
            hit = true;
            break;
          }
        }
        if (!hit) {
          const rr = boss.r * 0.9 + b.r;
          if (d2(b.x, b.y, boss.x, boss.y) < rr * rr) {
            NS.bosses.damageCore(boss, shotDamage(b), b.x, b.y);
            b.alive = false;
          }
        }
      }
      if (!b.alive) continue;
      for (let k = 0; k < G.mines.length; ++k) {
        const m = G.mines[k];
        if (m.alive && d2(b.x, b.y, m.x, m.y) < 14 * 14) {
          NS.hazards.detonate(m);
          b.alive = false;
          break;
        }
      }
    }
  }

  /* ── the ship ── */
  function shipHits(dt) {
    const s = G.ship;
    if (!s || s.dead || s.hyperT > 0) return;
    const sr = s.r * 0.8;
    /* rocks: rammed when the prow is rated for them, else a crash */
    grid.query(s.x, s.y, sr + MAX_R, found);
    for (let k = 0; k < found.length; ++k) {
      const r = found[k];
      if (!r.alive || r.spawnT > 0) continue;
      const rr = r.r * 0.85 + sr;
      if (d2(s.x, s.y, r.x, r.y) < rr * rr) {
        const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (G.stats.ram >= r.size && sp > 140) {
          NS.rocks.damage(r, 99, Math.atan2(s.vy, s.vx), 'ram');
          fx.punch(0.015);
          s.vx *= 0.8;
          s.vy *= 0.8;
          continue;
        }
        if (s.power.shield || s.shield) {
          NS.hazards.push(r, s.x, s.y, rr + 40, 220);
          NS.rocks.damage(r, 1, undefined, 'shield');
        }
        if (NS.ship.hit(r.x, r.y)) return;
      }
    }
    for (let k = 0; k < G.enemies.length; ++k) {
      const e = G.enemies[k];
      if (!e.alive || e.enterT > 0.3 || (e.kind === 'phantom' && e.phase === 1)) continue;
      const rr = e.r + sr;
      if (d2(s.x, s.y, e.x, e.y) < rr * rr) {
        if (e.kind === 'hunter') NS.enemies.destroy(e);
        if (NS.ship.hit(e.x, e.y)) return;
      }
    }
    for (let k = 0; k < G.eBullets.length; ++k) {
      const b = G.eBullets[k];
      if (!b.alive) continue;
      const rr = b.r + sr;
      if (d2(s.x, s.y, b.x, b.y) < rr * rr) {
        b.alive = false;
        if (NS.ship.hit(b.x, b.y)) return;
      }
    }
    const z = NS.hazards.fireAt(s.x, s.y, sr * 0.5);
    if (z && NS.ship.hit(z.x, z.y)) return;
    for (let k = 0; k < G.holes.length; ++k) {
      const h = G.holes[k];
      if (!h.friendly && d2(s.x, s.y, h.x, h.y) < (h.r + sr) * (h.r + sr) && NS.ship.hit(h.x, h.y)) return;
    }
    const boss = G.boss;
    if (boss && boss.intro <= 0 && boss.dying <= 0) {
      const rr = boss.r * 0.85 + sr;
      if (d2(s.x, s.y, boss.x, boss.y) < rr * rr && NS.ship.hit(boss.x, boss.y)) return;
      for (let k = 0; k < boss.parts.length; ++k) {
        const p = boss.parts[k];
        if (p.alive && d2(s.x, s.y, p.x, p.y) < (p.r + sr) * (p.r + sr) && NS.ship.hit(p.x, p.y)) return;
      }
      for (let k = 0; k < boss.beams.length; ++k) {
        const bm = boss.beams[k];
        if (bm.warn > 0 || bm.on <= 0) continue;
        if (segHit(boss.x, boss.y, boss.x + Math.cos(bm.a) * 1400, boss.y + Math.sin(bm.a) * 1400, s.x, s.y, sr + 8) && NS.ship.hit(boss.x, boss.y)) return;
      }
      const links = NS.bosses.tempestLinks(boss);
      for (let k = 0; k < links.length; ++k) {
        const l = links[k];
        if (l.live && segHit(l.x0, l.y0, l.x1, l.y1, s.x, s.y, sr + 6) && NS.ship.hit(s.x - 1, s.y - 1)) return;
      }
    }
  }

  /* a point within w of a segment (straight, not wrapped) */
  function segHit(x0, y0, x1, y1, px, py, w) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x0) * dx + (py - y0) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x0 + dx * t - px, cy = y0 + dy * t - py;
    return cx * cx + cy * cy < w * w;
  }

  /* ── orbit blades ── */
  function blades(dt) {
    const s = G.ship;
    if (!s || s.dead || !s.power.orbit) return;
    for (let i = 0; i < 3; ++i) {
      NS.weapons.bladeAt(i, blade);
      grid.query(blade.x, blade.y, 14 + MAX_R, found3);
      for (let k = 0; k < found3.length; ++k) {
        const r = found3[k];
        if (!r.alive) continue;
        const rr = r.r + 12;
        if (d2(blade.x, blade.y, r.x, r.y) < rr * rr) {
          if (R() < 0.3) fx.sparks(blade.x, blade.y, blade.a + Math.PI / 2, 0.8, 2, '#c0ff80', 300, 0.2);
          NS.rocks.damage(r, 10 * dt * G.stats.dmg, blade.a + Math.PI / 2, 'blade');
        }
      }
      for (let k = 0; k < G.enemies.length; ++k) {
        const e = G.enemies[k];
        if (e.alive && d2(blade.x, blade.y, e.x, e.y) < (e.r + 12) * (e.r + 12)) NS.enemies.damage(e, 8 * dt * G.stats.dmg);
      }
    }
  }

  /* ── area effects ── */
  function blast(x, y, radius, dmg, friendly, power) {
    grid.query(x, y, radius + MAX_R, found2);
    const hits = found2.slice();
    for (let k = 0; k < hits.length; ++k) {
      const r = hits[k];
      if (!r.alive) continue;
      const rr = radius + r.r * 0.5;
      if (d2(x, y, r.x, r.y) < rr * rr) {
        NS.hazards.push(r, x, y, radius * 1.4, power || 200);
        NS.rocks.damage(r, dmg, Math.atan2(wrapD(r.y - y, FIELD_H), wrapD(r.x - x, FIELD_W)), friendly ? 'blast' : 'chain');
      }
    }
    for (let k = 0; k < G.enemies.length; ++k) {
      const e = G.enemies[k];
      if (e.alive && d2(x, y, e.x, e.y) < (radius + e.r) * (radius + e.r)) NS.enemies.damage(e, dmg);
    }
    const b = G.boss;
    if (b && friendly && b.dying <= 0) {
      for (let k = 0; k < b.parts.length; ++k)
        if (b.parts[k].alive && d2(x, y, b.parts[k].x, b.parts[k].y) < (radius + b.parts[k].r) * (radius + b.parts[k].r)) NS.bosses.damagePart(b, b.parts[k], dmg);
      if (d2(x, y, b.x, b.y) < (radius + b.r) * (radius + b.r)) NS.bosses.damageCore(b, dmg, b.x, b.y);
    }
    if (friendly) {
      for (let k = 0; k < G.eBullets.length; ++k)
        if (d2(x, y, G.eBullets[k].x, G.eBullets[k].y) < radius * radius) G.eBullets[k].alive = false;
      return;
    }
    const s = G.ship;
    if (s && !s.dead && d2(x, y, s.x, s.y) < radius * radius * 0.55) NS.ship.hit(x, y);
  }

  /* the Sunbeam: damages everything the beam crosses; returns its drawn length */
  function beamHit(x0, y0, nx, ny, len, dmg) {
    const x1 = x0 + nx * len, y1 = y0 + ny * len;
    const rocks = G.rocks.slice();
    for (let i = 0; i < rocks.length; ++i) {
      const r = rocks[i];
      if (r.alive && segHit(x0, y0, x1, y1, unwrapNear(r.x, x0, FIELD_W), unwrapNear(r.y, y0, FIELD_H), r.r)) {
        if (R() < 0.2) fx.hitSpark(r.x, r.y, R() * TAU, '#fff0a0');
        NS.rocks.damage(r, dmg, Math.atan2(ny, nx), 'beam');
      }
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive && segHit(x0, y0, x1, y1, unwrapNear(e.x, x0, FIELD_W), unwrapNear(e.y, y0, FIELD_H), e.r)) NS.enemies.damage(e, dmg);
    }
    const b = G.boss;
    if (b && b.dying <= 0) {
      for (let k = 0; k < b.parts.length; ++k) {
        const p = b.parts[k];
        if (p.alive && segHit(x0, y0, x1, y1, unwrapNear(p.x, x0, FIELD_W), unwrapNear(p.y, y0, FIELD_H), p.r)) NS.bosses.damagePart(b, p, dmg);
      }
      if (segHit(x0, y0, x1, y1, unwrapNear(b.x, x0, FIELD_W), unwrapNear(b.y, y0, FIELD_H), b.r * 0.9)) NS.bosses.damageCore(b, dmg, b.x, b.y);
    }
    return len;
  }

  /* the copy of a wrapped coordinate nearest to a reference */
  function unwrapNear(v, ref, size) {
    return ref + wrapD(v - ref, size);
  }

  /* nearest rock, raider or titan within maxD (skipping one id) */
  function nearestTarget(x, y, maxD, skip) {
    let best = null, bd = maxD * maxD;
    grid.query(x, y, maxD, found2);
    for (let i = 0; i < found2.length; ++i) {
      const r = found2[i];
      if (!r.alive || r.id === skip) continue;
      const d = d2(x, y, r.x, r.y);
      if (d < bd) { bd = d; best = r; }
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.id === skip || !NS.enemies.hittable(e)) continue;
      const d = d2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    const b = G.boss;
    if (b && b.intro <= 0 && b.dying <= 0) {
      for (let k = 0; k < b.parts.length; ++k) {
        const p = b.parts[k];
        const d = d2(x, y, p.x, p.y);
        if (p.alive && d < bd) { bd = d; best = p; }
      }
      if (NS.bosses.coreOpen(b)) {
        const d = d2(x, y, b.x, b.y);
        if (d < bd) { bd = d; best = b; }
      }
    }
    return best;
  }

  Object.assign(NS.collision, {
    update, rebuild, blast, beamHit, nearestTarget, segHit, grid
  });
})();
