/* Pooled projectiles: player bolts, homing missiles, flak shells and their shrapnel, proximity
   mines; enemy bolts, pellets, plasma orbs and homing rockets. Movement, homing, fuses, trails,
   time warp and clearing. Owns G.pBullets and G.eBullets; collisions live in combat.js. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { MAX_PLAYER_BULLETS, MAX_ENEMY_BULLETS, TAU } = NS.constants;
  const { createPool } = NS.grid;
  const { turnToward } = NS.rng;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfxAt } = NS.audio;

  const pool = createPool(() => ({ alive: false }));
  const near = [];

  function init(b, kind, x, y, vx, vy, life, dmg, r, color) {
    b.alive = true;
    b.kind = kind;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.life = life; b.max = life;
    b.dmg = dmg; b.r = r; b.color = color;
    b.t = 0; b.target = null; b.blast = 0; b.crit = false; b.pierce = 0;
    b.ang = Math.atan2(vy, vx);
    b.arm = 0; b.frags = 0; b.speed = 0; b.reflected = false;
    return b;
  }

  function player(kind, x, y, vx, vy, life, dmg, r, color) {
    if (G.pBullets.length >= MAX_PLAYER_BULLETS) {
      const old = G.pBullets.shift();
      pool.put(old);
    }
    const b = init(pool.get(), kind, x, y, vx, vy, life, dmg, r, color);
    G.pBullets.push(b);
    return b;
  }

  function enemy(kind, x, y, vx, vy, life, dmg, r, color) {
    if (G.eBullets.length >= MAX_ENEMY_BULLETS) return null;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const sp = mut && mut.speed ? mut.speed : 1;
    const b = init(pool.get(), kind, x, y, vx * sp, vy * sp, life, dmg * (G.stage ? G.stage.dmgMul : 1), r, color);
    G.eBullets.push(b);
    return b;
  }

  /* An aimed enemy shot at speed toward angle a */
  function enemyShot(kind, x, y, a, speed, dmg, color) {
    const r = kind === 'orb' ? 9 : kind === 'pellet' ? 5 : kind === 'rocket' ? 7 : 4;
    const life = kind === 'orb' ? 5 : kind === 'rocket' ? 4.5 : 2.6;
    return enemy(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, life, dmg, r, color);
  }

  function update(dt) {
    updatePlayer(dt);
    updateEnemy(dt);
  }

  function updatePlayer(dt) {
    const list = G.pBullets;
    let j = 0;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (b.alive) {
        b.t += dt;
        b.life -= dt;
        if (b.kind === 'missile') steerMissile(b, dt, false);
        else if (b.kind === 'pmine') updateMine(b, dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.life <= 0) {
          if (b.kind === 'flak') burstFlak(b);
          else if (b.kind === 'missile' || b.kind === 'pmine') detonate(b);
          b.alive = false;
        }
      }
      if (b.alive) {
        list[j] = b;
        ++j;
      } else
        pool.put(b);
    }
    list.length = j;
  }

  function updateEnemy(dt) {
    const list = G.eBullets;
    const slow = G.warp > 0 ? 0.3 : 1;
    const k = dt * slow;
    let j = 0;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (b.alive) {
        b.t += k;
        b.life -= k;
        if (b.kind === 'rocket') steerMissile(b, k, true);
        b.x += b.vx * k;
        b.y += b.vy * k;
        if (b.life <= 0) b.alive = false;
      }
      if (b.alive) {
        list[j] = b;
        ++j;
      } else
        pool.put(b);
    }
    list.length = j;
  }

  function steerMissile(b, dt, hostile) {
    let tx, ty;
    if (hostile) {
      const p = G.player;
      if (!p || !p.alive || b.t > 3) return;
      tx = p.x; ty = p.y;
    } else {
      if (!b.target || !b.target.alive) {
        b.target = b.t > 0.15 ? NS.weapons.nearestTarget(b.x, b.y, 600, b.ang, 1.4) : null;
      }
      if (!b.target) {
        const s = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const ns = Math.min(b.speed || 600, s + 900 * dt);
        b.vx *= ns / (s || 1);
        b.vy *= ns / (s || 1);
        b.ang = Math.atan2(b.vy, b.vx);
        trail(b);
        return;
      }
      tx = b.target.x; ty = b.target.y;
    }
    const want = Math.atan2(ty - b.y, tx - b.x);
    const turn = hostile ? 2.4 : 6 + b.t * 4;
    b.ang = turnToward(b.ang, want, turn * dt);
    const s = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const ns = Math.min(hostile ? 330 : (b.speed || 640) * 1.25, s + (hostile ? 300 : 1200) * dt);
    b.vx = Math.cos(b.ang) * ns;
    b.vy = Math.sin(b.ang) * ns;
    trail(b);
  }

  function trail(b) {
    if (R() < 0.6)
      fx.exhaust(b.x - Math.cos(b.ang) * 8, b.y - Math.sin(b.ang) * 8, -b.vx * 0.1, -b.vy * 0.1, 5, b.kind === 'rocket' ? '#ff7050' : '#ffc070', fx.FIRE);
    if (R() < 0.25) {
      const s = fx.spawn(fx.SMOKE, b.x, b.y, (R() - 0.5) * 20, (R() - 0.5) * 20, 0.6, 4, '#5a5a66');
      if (s) { s.grow = 14; s.alpha = 0.35; s.drag = 1; }
    }
  }

  function updateMine(b, dt) {
    b.vx *= 1 - 2 * dt;
    b.vy *= 1 - 2 * dt;
    if (b.arm > 0) { b.arm -= dt; return; }
    const grid = NS.combat.grid;
    grid.query(b.x, b.y, 70, near);
    for (let i = 0; i < near.length; ++i) {
      const t = near[i];
      if (t.alive && t.kind !== 'rock' && t.kind !== 'mine') {
        const dx = t.x - b.x, dy = t.y - b.y;
        if (dx * dx + dy * dy < (t.r + 50) * (t.r + 50)) {
          b.life = 0;
          return;
        }
      }
    }
  }

  function detonate(b) {
    const radius = b.blast || 60;
    NS.combat.blast(b.x, b.y, radius, b.dmg, 'player', {});
    fx.explode(b.x, b.y, radius * 0.4, fx.FIRE, { noDebris: true });
    sfxAt(radius > 90 ? 'explode' : 'smallExplode', b.x, b.y, { volume: 0.7 });
  }

  function burstFlak(b) {
    const n = b.frags || 10;
    const off = R() * TAU;
    for (let i = 0; i < n; ++i) {
      const a = off + i * TAU / n + (R() - 0.5) * 0.3;
      const s = 520 + R() * 260;
      const f = player('frag', b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 0.22 + R() * 0.12, b.fragDmg || 6, 4, 'amber');
      f.crit = b.crit;
    }
    NS.combat.blast(b.x, b.y, 48, b.dmg, 'player', {});
    fx.glow(b.x, b.y, 50, '#ffd27a', 0.16, 0, 0, 120);
    fx.ring(b.x, b.y, 8, 70, 0.22, '#ffc070', 3);
    fx.smoke(b.x, b.y, 2, 18, false);
    sfxAt('smallExplode', b.x, b.y, { volume: 0.4, pitch: 1.5 });
  }

  /* Enemy shots near a point become harmless sparks (nova, EMP, last stand) */
  function clearEnemyBullets(x, y, r) {
    const r2 = r * r;
    for (let i = 0; i < G.eBullets.length; ++i) {
      const b = G.eBullets[i];
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < r2) {
        b.alive = false;
        if (i % 2 === 0) fx.glow(b.x, b.y, 10, '#ffffff', 0.2);
      }
    }
  }

  function clearAll() {
    for (let i = 0; i < G.pBullets.length; ++i) pool.put(G.pBullets[i]);
    for (let i = 0; i < G.eBullets.length; ++i) pool.put(G.eBullets[i]);
    G.pBullets.length = 0;
    G.eBullets.length = 0;
  }

  Object.assign(NS.projectiles, {
    player, enemy, enemyShot, update, clearEnemyBullets, clearAll, detonate
  });
})();
