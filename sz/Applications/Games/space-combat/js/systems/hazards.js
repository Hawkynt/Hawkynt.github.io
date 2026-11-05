/* Sector hazards riding the forward scroll: asteroids that drift down, split and bump, strings of
   proximity mines, nebula patches that slow ships and hide them, black holes that cross the
   field pulling ships, shots and scrap, and solar flares that sear a telegraphed band of the
   screen (dash through or step out). Spawns them from the stage's hazard mix.
   Owns G.rocks, G.mines, G.nebulae, G.holes, G.flare and the hazard timers. */
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
  const MINE_TRIGGER = 95, MINE_BLAST = 110, MINE_FUSE = 0.55;
  const FLARE_WARN = 2.2, FLARE_BURN = 0.5;

  /* spawn timers for the current stage */
  const hz = { rockT: 0, mineT: 0, nebT: 0, holeT: 0, rate: 1, mix: null };

  function addRock(x, y, size, seed, vx, vy) {
    const r = {
      alive: true, kind: 'rock', x: x, y: y, vx: vx !== undefined ? vx : (R() - 0.5) * 50,
      vy: vy !== undefined ? vy : G.scroll.speed + 10 + R() * 50,
      size: size, r: ROCK_R[size], hp: ROCK_HP[size], maxHp: ROCK_HP[size], rot: R() * TAU, vr: (R() - 0.5) * 0.8,
      seed: seed || Math.floor(R() * 1e9), flash: 0, variant: (seed || 0) % 4, bumpT: 0,
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
    for (let i = 0; i < layout.nebulae.length; ++i) G.nebulae.push(Object.assign({ alive: true, vy: G.scroll.speed * 0.8 }, layout.nebulae[i]));
    hz.mix = stage.hazards;
    /* boss fights keep the field clearer */
    hz.rate = stage.type === 'boss' ? 0.45 : 1;
    hz.rockT = 2 + R() * 2;
    hz.mineT = 6 + R() * 4;
    hz.nebT = 4 + R() * 6;
    hz.holeT = stage.hazards.hole && stage.boss !== 'maw' ? 9 : Infinity;
    if (stage.hazards.flares) G.flare = { state: 'idle', t: 8, band: null, hitPlayer: false, hitSet: {} };
  }

  function update(dt) {
    spawn(dt);
    updateRocks(dt);
    updateMines(dt);
    updateNebulae(dt);
    updateHoles(dt);
    updateFlare(dt);
  }

  /* ── the hazard stream ── */
  function spawn(dt) {
    const m = hz.mix;
    if (!m) return;
    const W = G.world.w;
    if (m.rocks > 0) {
      hz.rockT -= dt * hz.rate;
      if (hz.rockT <= 0) {
        hz.rockT = 60 / (m.rocks * 1.3) * (0.6 + R() * 0.8);
        const size = R() < 0.12 ? 3 : R() < 0.4 ? 2 : 1;
        addRock(ROCK_R[size] + R() * (W - 2 * ROCK_R[size]), -ROCK_R[size] - 10, size);
      }
    }
    if (m.mines > 0) {
      hz.mineT -= dt * hz.rate;
      if (hz.mineT <= 0) {
        hz.mineT = 240 / m.mines * (0.7 + R() * 0.6);
        mineString(W);
      }
    }
    if (m.nebulae > 0) {
      hz.nebT -= dt;
      if (hz.nebT <= 0) {
        hz.nebT = 90 / m.nebulae * (0.7 + R() * 0.6);
        const r = 150 + R() * 90;
        G.nebulae.push({ alive: true, x: r * 0.5 + R() * (W - r), y: -r, r: r, seed: Math.floor(R() * 1e9), vy: G.scroll.speed * 0.8 });
      }
    }
    if (hz.holeT < Infinity && !G.holes.length) {
      hz.holeT -= dt;
      if (hz.holeT <= 0) {
        hz.holeT = 16 + R() * 10;
        G.holes.push({ alive: true, x: 170 + R() * (W - 340), y: -160, r: 46, pull: 170, t: 0, vy: 24 });
        G.banner = { title: 'GRAVITY WELL', sub: 'A black hole drifts across your path', t: 0, life: 2, color: '#6ad0ff' };
      }
    }
  }

  /* three to five mines in a line, a slant or a V */
  function mineString(W) {
    const n = 3 + Math.floor(R() * 3);
    const shape = Math.floor(R() * 3);
    const cx = 120 + R() * (W - 240);
    for (let i = 0; i < n; ++i) {
      const k = i - (n - 1) / 2;
      const x = shape === 0 ? cx + k * 70 : shape === 1 ? cx + k * 60 : cx + k * 64;
      const y = shape === 0 ? -30 : shape === 1 ? -30 - i * 50 : -30 - Math.abs(k) * 46;
      if (x > 20 && x < W - 20) spawnMine(x, y, false);
    }
  }

  function updateRocks(dt) {
    const p = G.player;
    const W = G.world.w, H = G.world.h;
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (!r.alive) continue;
      if (r.flash > 0) r.flash -= dt;
      if (r.bumpT > 0) r.bumpT -= dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vr * dt;
      if (r.x < r.r * 0.6) r.vx = Math.abs(r.vx);
      if (r.x > W - r.r * 0.6) r.vx = -Math.abs(r.vx);
      if (r.y > H + r.r + 30) { r.alive = false; continue; }
      if (p && p.alive) bumpPlayer(r, p);
    }
    compact(G.rocks);
  }

  /* rocks shove the ship aside; a hard knock hurts unless it is dashing with Ram Field */
  function bumpPlayer(r, p) {
    const dx = p.x - r.x, dy = p.y - r.y;
    const min = p.r * 0.7 + r.r * 0.85;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, ny = dy / d;
    p.x = r.x + nx * min;
    p.y = r.y + ny * min;
    NS.player.keepInside(p);
    NS.player.push(nx * 120, ny * 120);
    if (r.bumpT > 0) return;
    r.bumpT = 0.5;
    r.vx -= nx * 40 / r.size;
    if (p.dashT > 0 && G.stats.ram > 0) hitRock(r, G.stats.ram * 2, p.x - nx * p.r, p.y - ny * p.r);
    else NS.player.damage(5 + r.size * 3, r.x, r.y);
    fx.sparks(p.x - nx * p.r, p.y - ny * p.r, Math.atan2(ny, nx), 1.4, 8, '#d0c0a0', 280, 0.3);
    sfx('thud', { volume: 0.6 });
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
        addRock(r.x + Math.cos(a) * r.r * 0.4, r.y + Math.sin(a) * r.r * 0.4, r.size - 1, r.seed + i * 7919, Math.cos(a) * s + r.vx, Math.max(G.scroll.speed * 0.6, Math.sin(a) * s * 0.6 + r.vy));
      }
    }
    NS.combat.addScore(20 * r.size, r.x, r.y, true);
    NS.pickups.dropScrap(r.x, r.y, r.size === 1 ? 2 : 1);
    if (R() < 0.06) NS.pickups.dropPowerup(r.x, r.y, false);
    return true;
  }

  function updateMines(dt) {
    const p = G.player;
    const H = G.world.h;
    const sv = G.scroll.speed;
    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      if (!m.alive) continue;
      m.t += dt;
      m.y += sv * dt;
      if (m.y > H + 40) { m.alive = false; continue; }
      if (m.flash > 0) m.flash -= dt;
      if (m.trig > 0) {
        m.trig -= dt;
        if (m.trig <= 0) detonateMine(m);
        continue;
      }
      if (p && p.alive && m.y > 0) {
        const dx = p.x - m.x, dy = p.y - m.y;
        if (dx * dx + dy * dy < MINE_TRIGGER * MINE_TRIGGER) {
          m.trig = MINE_FUSE;
          sfxAt('blip', m.x, m.y, { pitch: 1.6, volume: 0.6 });
        }
      }
    }
    compact(G.mines);
  }

  function detonateMine(m) {
    if (!m.alive) return;
    m.alive = false;
    fx.explode(m.x, m.y, 40, fx.FIRE);
    sfxAt('explode', m.x, m.y, { volume: 0.8 });
    NS.combat.blast(m.x, m.y, MINE_BLAST, 60, 'hazard', {});
    const p = G.player;
    if (p && p.alive) {
      const dx = p.x - m.x, dy = p.y - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < MINE_BLAST + p.hitR) {
        NS.player.damage(28 * (1 - d / (MINE_BLAST + p.hitR) * 0.5) * (G.stage ? G.stage.dmgMul : 1), m.x, m.y);
        NS.player.push(dx / (d || 1) * 300, dy / (d || 1) * 300);
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
  function updateNebulae(dt) {
    const p = G.player;
    if (!G.nebulae.length) {
      if (p) p.inNebula = false;
      return;
    }
    for (let i = 0; i < G.nebulae.length; ++i) {
      const n = G.nebulae[i];
      n.y += (n.vy || 0) * dt;
      if (n.y - n.r > G.world.h) n.alive = false;
    }
    compact(G.nebulae);
    if (p) p.inNebula = insideNebula(p.x, p.y);
    /* enemies are re-checked in slices, a quarter per step */
    nebT = (nebT + 1) % 4;
    for (let i = nebT; i < G.enemies.length; i += 4) {
      const e = G.enemies[i];
      e.inNebula = insideNebula(e.x, e.y);
    }
  }

  /* inverse-square-ish pull, capped; the player is pushed, everything else accelerated */
  function pullOf(o, h, k) {
    const dx = h.x - o.x, dy = h.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 700 * 700) return null;
    const d = Math.sqrt(d2) || 1;
    const a = Math.min(900, h.pull * 260000 / (d2 + 40000)) * k;
    return { x: dx / d * a, y: dy / d * a, d: d };
  }

  function pull(o, h, dt, k) {
    const f = pullOf(o, h, k);
    if (!f) return 1e9;
    o.vx += f.x * dt;
    o.vy += f.y * dt;
    return f.d;
  }

  function updateHoles(dt) {
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      h.t += dt;
      h.y += (h.vy || 0) * dt;
      if (h.y > G.world.h + 260) { h.alive = false; continue; }
      if (!h.pull) continue;
      const p = G.player;
      if (p && p.alive) {
        const f = pullOf(p, h, 1);
        if (f) {
          NS.player.push(f.x * dt, f.y * dt);
          if (f.d < h.r + p.hitR) {
            NS.player.damage(70 * dt * 3, h.x, h.y);
            G.vignette = Math.min(1, G.vignette + dt * 2);
          }
        }
      }
      for (let j = 0; j < G.enemies.length; ++j) {
        const e = G.enemies[j];
        if (!e.alive || e.def.speed === 0 || e.phase === 'enter') continue;
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
      for (let j = 0; j < G.pickups.length; ++j) if (G.pickups[j].type !== 'core') pull(G.pickups[j], h, dt, 0.5);
      if (R() < 0.5) {
        const a = R() * TAU, rr = h.r * (2.2 + R() * 2.5);
        const pt = fx.spawn(fx.EMBER, h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr,
          -Math.sin(a) * 160 - Math.cos(a) * 60, Math.cos(a) * 160 - Math.sin(a) * 60, 1.2, 2.5, '#ffc080');
        if (pt) { pt.drag = 0; pt.ramp = fx.FIRE; }
      }
    }
    compact(G.holes);
  }

  /* Solar flares: idle -> warn (the band flashes) -> burn across that band of the screen */
  function inBand(b, x, y, r) {
    return b.axis === 'h' ? Math.abs(y - b.pos) < b.half + r : Math.abs(x - b.pos) < b.half + r;
  }

  function updateFlare(dt) {
    const f = G.flare;
    if (!f) return;
    f.t -= dt;
    const p = G.player;
    if (f.state === 'idle') {
      if (f.t <= 0 && p && p.alive) {
        f.state = 'warn';
        f.t = FLARE_WARN;
        /* the band lands where the pilot is: a row or a column */
        const h = R() < 0.55;
        f.band = h ? { axis: 'h', pos: Math.max(160, Math.min(G.world.h - 60, p.y)), half: 64 }
          : { axis: 'v', pos: Math.max(70, Math.min(G.world.w - 70, p.x)), half: 70 };
        G.banner = { title: 'SOLAR FLARE', sub: 'Get out of the band - or dash through it', t: 0, life: 2, color: '#ffb347' };
        sfx('lose', { pitch: 1.6, volume: 0.5 });
      }
    } else if (f.state === 'warn') {
      if (f.t <= 0) {
        f.state = 'burn';
        f.t = FLARE_BURN;
        f.hitPlayer = false;
        f.hitSet = {};
        fx.flash('#ffd890', 0.25);
        fx.shake(0.35);
        sfx('whoosh', { pitch: 0.4 });
      }
    } else if (f.state === 'burn') {
      const b = f.band;
      if (p && p.alive && !f.hitPlayer && inBand(b, p.x, p.y, p.hitR)) {
        f.hitPlayer = true;
        if (p.iframes > 0 || p.aegis > 0) {
          fx.text(p.x, p.y - 36, 'DODGED', '#ffd25a', 18);
          NS.combat.addScore(250, p.x, p.y);
        } else {
          NS.player.damage(24, p.x, p.y + 30);
          p.shield = Math.max(0, p.shield - 25);
        }
      }
      for (let i = 0; i < G.enemies.length; ++i) {
        const e = G.enemies[i];
        if (e.alive && !f.hitSet[e.id] && inBand(b, e.x, e.y, e.r)) {
          f.hitSet[e.id] = true;
          NS.combat.hit(e, 14, e.x, e.y, 0, {});
        }
      }
      if (f.t <= 0) {
        f.state = 'idle';
        f.t = 9 + R() * 5;
      }
    }
  }

  Object.assign(NS.hazards, {
    setup, update, addRock, spawnMine, hitRock, hitMine, detonateMine, insideNebula, inBand,
    FLARE_WARN, FLARE_BURN, MINE_BLAST
  });
})();
