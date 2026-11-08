/* Guardians: a big foe that bounces around the room. Flying bubbles that reach it burst for one
   point of damage (big bubbles two), lightning bolts from popped lightning bubbles - which drift
   in often during a fight - hit for four. It throws a fan of shots at the player (the nearer
   newt in co-op), calls in helpers now and then (never more than three) and touching it hurts.
   At half health it rages: faster, more shots, more helpers. Each world's guardian has its own
   pattern of shots. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const E = NS.engine;
  const { BOSSES } = NS.worldData;
  const { TILE, FIELD_W, FIELD_H } = C;

  function attach(g, w, scale, damageMul) {
    const b = BOSSES[w];
    const hp = Math.round(b.hp * (scale || 1));
    g.boss = { w: w, x: FIELD_W / 2, y: TILE * 6, r: 46, vx: b.speed, vy: b.speed * 0.6, hp: hp, max: hp, shootT: b.shoot, spawnT: 8, rage: false,
      hurtT: 0, damageMul: damageMul || 1 };
    g.enemies.length = 0;
    g.elementEvery = 6;
    g.elementT = 3;
  }

  function damage(g, n) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0) return;
    bs.hp = Math.max(0, bs.hp - n * bs.damageMul);
    bs.hurtT = 0.3;
    g.events.push({ type: 'bosshit', x: bs.x, y: bs.y, dmg: n });
    if (!bs.rage && bs.hp <= bs.max / 2) { bs.rage = true; g.events.push({ type: 'rage' }); }
    if (bs.hp <= 0) {
      g.cleared = true;
      g.score += bs.max * 500 * g.scoreMul;
      g.enemies.length = 0;
      g.events.push({ type: 'bossdown', x: bs.x, y: bs.y });
    }
  }

  function bubbleHit(g, b) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0 || b.trap || b.elem) return false;
    if (Math.hypot(b.x - bs.x, b.y - bs.y) > bs.r + b.r) return false;
    damage(g, b.r > C.BUBBLE_R ? 2 : 1);
    return true;
  }

  function boltHit(g, bolt) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0 || Math.abs(bolt.x - bs.x) > bs.r || Math.abs(bolt.y - bs.y) > bs.r) return false;
    damage(g, 4);
    return true;
  }

  function step(g, dt) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0) return;
    const def = BOSSES[bs.w];
    const k = bs.rage ? 1.4 : 1;
    if (g.freezeT > 0) return;
    bs.hurtT = Math.max(0, bs.hurtT - dt);
    bs.x += bs.vx * k * dt;
    bs.y += bs.vy * k * dt;
    if (bs.x < TILE + bs.r || bs.x > FIELD_W - TILE - bs.r) { bs.vx = -bs.vx; bs.x = Math.max(TILE + bs.r, Math.min(FIELD_W - TILE - bs.r, bs.x)); }
    if (bs.y < TILE + bs.r || bs.y > FIELD_H - TILE - bs.r) { bs.vy = -bs.vy; bs.y = Math.max(TILE + bs.r, Math.min(FIELD_H - TILE - bs.r, bs.y)); }
    for (const q of E.newts(g)) if (!q.dead && Math.hypot(q.x - bs.x, q.y - 12 - bs.y) < bs.r + 10) E.hurt(g, 'boss', q);
    const p = E.nearest(g, bs.x, bs.y);
    bs.shootT -= dt;
    if (bs.shootT <= 0) {
      bs.shootT = def.shoot / k;
      const n = def.fan + (bs.rage ? 2 : 0);
      const a0 = Math.atan2(p.y - 12 - bs.y, p.x - bs.x);
      for (let i = 0; i < n; ++i) {
        const a = a0 + (i - (n - 1) / 2) * 0.32;
        g.shots.push({ x: bs.x, y: bs.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, t: 0, boss: true });
      }
      g.events.push({ type: 'bossshoot' });
    }
    for (const s of g.shots) if (s.boss) s.y += s.vy * dt;
    bs.spawnT -= dt;
    if (bs.spawnT <= 0) {
      bs.spawnT = bs.rage ? 7 : 11;
      if (g.enemies.length < 3) {
        g.enemies.push(E.newEnemy(g, def.minion, bs.x, bs.y + bs.r));
        g.events.push({ type: 'summon' });
      }
    }
  }

  Object.assign(NS.boss, { attach, damage, bubbleHit, boltHit, step });
})();
