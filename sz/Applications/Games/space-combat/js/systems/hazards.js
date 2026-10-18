/* Sector hazards: breakable asteroids that split and bump, proximity space mines, nebula clouds
   that slow ships and hide them, black holes that pull ships, shots and scrap, and solar flares
   that sweep the sector (dodge-roll through them). Owns G.rocks, G.mines, G.nebulae, G.holes,
   G.flare. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfx, sfxAt } = NS.audio;
  const { compact } = NS.grid;

  const ROCK_R = [0, 22, 42, 70];
  const ROCK_HP = [0, 30, 95, 230];

  function addRock(x, y, size, seed, vx, vy) {
    const r = {
      alive: true, kind: 'rock', x: x, y: y, vx: vx || (R() - 0.5) * 40, vy: vy || (R() - 0.5) * 40,
      size: size, r: ROCK_R[size], hp: ROCK_HP[size], maxHp: ROCK_HP[size], rot: R() * TAU, vr: (R() - 0.5) * 0.8,
      seed: seed || Math.floor(R() * 1e9), flash: 0, variant: (seed || 0) % 4,
    };
    G.rocks.push(r);
    return r;
  }

  function spawnMine(x, y, bossMine) {
    G.mines.push({ alive: true, kind: 'mine', x: x, y: y, vx: 0, vy: 0, r: 15, hp: 18, maxHp: 18, armed: true, trig: 0, t: R() * 5, flash: 0, bossMine: !!bossMine });
  }

  function setup(layout, stage) {
    G.rocks.length = 0;
    G.mines.length = 0;
    G.nebulae.length = 0;
    G.holes.length = 0;
    G.flare = null;
    for (let i = 0; i < layout.rocks.length; ++i) {
      const q = layout.rocks[i];
      addRock(q.x, q.y, q.size, q.seed);
    }
    for (let i = 0; i < layout.mines.length; ++i) spawnMine(layout.mines[i].x, layout.mines[i].y, false);
    for (let i = 0; i < layout.nebulae.length; ++i) G.nebulae.push(Object.assign({}, layout.nebulae[i]));
    if (layout.hole) G.holes.push(Object.assign({ t: 0 }, layout.hole));
    if (stage.hazards.flares) G.flare = { state: 'idle', t: 14, dir: 0, pos: 0, hitPlayer: false };
  }

  function update(dt) {
    updateRocks(dt);
    updateMines(dt);
    updateNebulae();
    updateHoles(dt);
    updateFlare(dt);
  }

  function updateRocks(dt) {
    const p = G.player;
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (!r.alive) continue;
      if (r.flash > 0) r.flash -= dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vr * dt;
      if (r.x < r.r || r.x > G.world.w - r.r) r.vx = -r.vx;
      if (r.y < r.r || r.y > G.world.h - r.r) r.vy = -r.vy;
      if (p && p.alive) {
        const dx = p.x - r.x, dy = p.y - r.y;
        const min = p.r + r.r * 0.9;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1;
          const nx = dx / d, ny = dy / d;
          const rel = (p.vx - r.vx) * nx + (p.vy - r.vy) * ny;
          p.x = r.x + nx * min;
          p.y = r.y + ny * min;
          if (rel < 0) {
            p.vx -= rel * nx * 1.6;
            p.vy -= rel * ny * 1.6;
            r.vx += rel * nx * 0.12 / r.size;
            r.vy += rel * ny * 0.12 / r.size;
            const impact = -rel;
            if (impact > 160) {
              if (p.rollT > 0 && G.stats.ram > 0) hitRock(r, G.stats.ram * 2, p.x - nx * p.r, p.y - ny * p.r);
              else NS.player.damage(4 + (impact - 160) * 0.05, r.x, r.y);
              fx.sparks(p.x - nx * p.r, p.y - ny * p.r, Math.atan2(ny, nx), 1.4, 8, '#d0c0a0', 280, 0.3);
              sfx('thud', { volume: 0.6 });
            }
          }
        }
      }
    }
    compact(G.rocks);
  }

  function hitRock(r, dmg, x, y) {
    r.hp -= dmg;
    r.flash = 0.05;
    if (R() < 0.3) fx.debris(x, y, 1, 90, '#8a7a68');
    if (r.hp > 0) return false;
    r.alive = false;
    fx.explode(r.x, r.y, r.r * 0.8, ['#ffffff', '#ffe0b0', '#c8a070', '#6a5040', '#2a2018'], { debrisColor: '#8a7a68' });
    fx.smoke(r.x, r.y, 3 + r.size * 2, r.r * 0.8, false);
    fx.debris(r.x, r.y, 4 + r.size * 3, 140, '#9a8a74');
    sfxAt(r.size >= 2 ? 'explode' : 'smallExplode', r.x, r.y, { volume: 0.5, pitch: 1.2 });
    if (r.size > 1) {
      const n = r.size === 3 ? 3 : 2;
      for (let i = 0; i < n; ++i) {
        const a = R() * TAU;
        const s = 60 + R() * 70;
        addRock(r.x + Math.cos(a) * r.r * 0.4, r.y + Math.sin(a) * r.r * 0.4, r.size - 1, r.seed + i * 7919, Math.cos(a) * s + r.vx, Math.sin(a) * s + r.vy);
      }
    }
    NS.combat.addScore(20 * r.size, r.x, r.y, true);
    NS.pickups.dropScrap(r.x, r.y, r.size === 1 ? 2 : 1);
    if (R() < 0.06) NS.pickups.dropPowerup(r.x, r.y, false);
    return true;
  }

  function updateMines(dt) {
    const p = G.player;
    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      if (!m.alive) continue;
      m.t += dt;
      if (m.flash > 0) m.flash -= dt;
      if (m.trig > 0) {
        m.trig -= dt;
        if (m.trig <= 0) detonateMine(m);
        continue;
      }
      if (p && p.alive) {
        const dx = p.x - m.x, dy = p.y - m.y;
        if (dx * dx + dy * dy < 120 * 120) {
          m.trig = 0.55;
          sfxAt('blip', m.x, m.y, { pitch: 1.6, volume: 0.6 });
        }
      }
    }
    compact(G.mines);
  }

  function detonateMine(m) {
    if (!m.alive) return;
    m.alive = false;
    const radius = 125;
    fx.explode(m.x, m.y, 40, fx.FIRE);
    sfxAt('explode', m.x, m.y, { volume: 0.8 });
    NS.combat.blast(m.x, m.y, radius, 60, 'hazard', {});
    const p = G.player;
    if (p && p.alive) {
      const dx = p.x - m.x, dy = p.y - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius + p.r) {
        NS.player.damage(30 * (1 - d / (radius + p.r) * 0.5) * (G.stage ? G.stage.dmgMul : 1), m.x, m.y);
        p.vx += dx / (d || 1) * 380;
        p.vy += dy / (d || 1) * 380;
      }
    }
  }

  function hitMine(m, dmg) {
    m.hp -= dmg;
    m.flash = 0.05;
    if (m.hp <= 0) {
      detonateMine(m);
      NS.combat.addScore(40, m.x, m.y, true);
    }
    return true;
  }

  function insideNebula(x, y) {
    for (let i = 0; i < G.nebulae.length; ++i) {
      const n = G.nebulae[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy < n.r * n.r * 0.72) return true;
    }
    return false;
  }

  let nebT = 0;
  function updateNebulae() {
    if (!G.nebulae.length) return;
    const p = G.player;
    if (p) p.inNebula = insideNebula(p.x, p.y);
    /* enemies are re-checked in slices, a quarter per step */
    nebT = (nebT + 1) % 4;
    for (let i = nebT; i < G.enemies.length; i += 4) {
      const e = G.enemies[i];
      e.inNebula = insideNebula(e.x, e.y);
    }
  }

  function pull(o, h, dt, k) {
    const dx = h.x - o.x, dy = h.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1600 * 1600) return 1e9;
    const d = Math.sqrt(d2) || 1;
    const a = Math.min(900, h.pull * 260000 / (d2 + 40000)) * k;
    o.vx += dx / d * a * dt;
    o.vy += dy / d * a * dt;
    return d;
  }

  function updateHoles(dt) {
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      h.t += dt;
      if (!h.pull) continue;
      const p = G.player;
      if (p && p.alive) {
        const d = pull(p, h, dt, 1);
        if (d < h.r + p.r) {
          NS.player.damage(70 * dt * 3, h.x, h.y);
          G.vignette = Math.min(1, G.vignette + dt * 2);
        }
      }
      for (let j = 0; j < G.enemies.length; ++j) {
        const e = G.enemies[j];
        if (!e.alive || e.def.speed === 0) continue;
        const d = pull(e, h, dt, 0.8);
        if (d < h.r) NS.combat.kill(e, 'hole');
      }
      for (let j = 0; j < G.eBullets.length; ++j) {
        const d = pull(G.eBullets[j], h, dt, 0.6);
        if (d < h.r) G.eBullets[j].alive = false;
      }
      for (let j = 0; j < G.pBullets.length; ++j) {
        const d = pull(G.pBullets[j], h, dt, 0.4);
        if (d < h.r) G.pBullets[j].alive = false;
      }
      for (let j = 0; j < G.pickups.length; ++j) pull(G.pickups[j], h, dt, 0.5);
      if (R() < 0.5) {
        const a = R() * TAU, rr = h.r * (2.2 + R() * 2.5);
        const pt = fx.spawn(fx.EMBER, h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr,
          -Math.sin(a) * 160 - Math.cos(a) * 60, Math.cos(a) * 160 - Math.sin(a) * 60, 1.2, 2.5, '#ffc080');
        if (pt) { pt.drag = 0; pt.ramp = fx.FIRE; }
      }
    }
  }

  /* Solar flares: idle -> warn (3 s) -> sweep across the whole sector */
  function updateFlare(dt) {
    const f = G.flare;
    if (!f) return;
    f.t -= dt;
    if (f.state === 'idle') {
      if (f.t <= 0) {
        f.state = 'warn';
        f.t = 3;
        f.dir = R() < 0.5 ? 0 : Math.PI / 2;
        f.sign = R() < 0.5 ? 1 : -1;
        G.banner = { title: 'SOLAR FLARE', sub: 'Dodge-roll through the wave!', t: 0, life: 2.6, color: '#ffb347' };
        sfx('lose', { pitch: 1.6, volume: 0.5 });
      }
    } else if (f.state === 'warn') {
      if (f.t <= 0) {
        f.state = 'sweep';
        f.pos = f.sign > 0 ? -200 : (f.dir === 0 ? G.world.w : G.world.h) + 200;
        f.hitPlayer = false;
        f.hitSet = {};
        sfx('whoosh', { pitch: 0.4 });
      }
    } else if (f.state === 'sweep') {
      const prev = f.pos;
      f.pos += f.sign * 1150 * dt;
      const p = G.player;
      const coord = o => (f.dir === 0 ? o.x : o.y);
      const crossed = c => (f.sign > 0 ? prev <= c && f.pos > c : prev >= c && f.pos < c);
      if (p && p.alive && !f.hitPlayer && crossed(coord(p))) {
        f.hitPlayer = true;
        if (p.iframes > 0 || p.aegis > 0) {
          fx.text(p.x, p.y - 36, 'DODGED', '#ffd25a', 18);
          NS.combat.addScore(250, p.x, p.y);
        } else {
          NS.player.damage(24, p.x - (f.dir === 0 ? f.sign * 40 : 0), p.y - (f.dir === 0 ? 0 : f.sign * 40));
          p.shield = Math.max(0, p.shield - 25);
        }
        fx.flash('#ffd890', 0.4);
        fx.shake(0.4);
      }
      for (let i = 0; i < G.enemies.length; ++i) {
        const e = G.enemies[i];
        if (e.alive && !f.hitSet[e.id] && crossed(coord(e))) {
          f.hitSet[e.id] = true;
          NS.combat.hit(e, 14, e.x, e.y, 0, {});
        }
      }
      const end = f.dir === 0 ? G.world.w : G.world.h;
      if (f.pos < -400 || f.pos > end + 400) {
        f.state = 'idle';
        f.t = 15 + R() * 8;
      }
    }
  }

  Object.assign(NS.hazards, {
    setup, update, addRock, spawnMine, hitRock, hitMine, detonateMine, insideNebula
  });
})();
