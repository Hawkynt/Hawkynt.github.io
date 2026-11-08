/* Guardians: a guardian floats at the top of the field, sweeps from side to side and is wrapped
   in a ring of shield bricks that orbit it and grow back one by one. Balls that reach its body
   hurt it (two points a hit, fire three, mega five), lasers chip at it. It shoots at the paddle - seeds and
   bolts stun, ice shrinks, ink also clouds the field, void does both - and each has a move of its
   own: the Hedge Colossus sprouts a row of regrowing bricks, the Frost Warden freezes its shield
   back faster, the Gear Tyrant spins its ring hard and fires in threes, the Kraken inks the
   field, the Gloom Engine pulls the balls toward its core. At half health it rages. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const E = NS.engine;
  const { BOSSES } = NS.worldData;

  function attach(g, w, scale, damageMul) {
    const b = BOSSES[w];
    const hp = Math.round(b.hp * (scale || 1));
    g.boss = { w: w, x: g.w / 2, y: 150, bw: 150, bh: 96, hp: hp, max: hp, dir: 1, shootT: b.shoot, specialT: 9, regrowT: 6, ang: 0, spin: 0.7,
      rage: false, hurtT: 0, inkT: 0, chip: 0, damageMul: damageMul || 1 };
    g.projectiles = [];
    g.bricks = g.bricks.filter(br => !br.shield);
    for (let i = 0; i < b.ring; ++i)
      g.bricks.push({ x: 0, y: 0, w: 40, h: 18, ch: 's', kind: 'steel', hp: 2, max: 2, alive: true, regenT: 0, flash: 0, shield: true, a: i / b.ring * Math.PI * 2 });
    place(g);
  }

  function place(g) {
    const bs = g.boss;
    const rx = 120, ry = 78;
    for (const br of g.bricks) {
      if (!br.shield) continue;
      const a = br.a + bs.ang;
      br.x = bs.x + Math.cos(a) * rx - br.w / 2;
      br.y = bs.y + Math.sin(a) * ry - br.h / 2;
    }
  }

  function damage(g, n) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0) return;
    bs.hp = Math.max(0, bs.hp - n * bs.damageMul);
    bs.hurtT = 0.3;
    g.events.push({ type: 'bosshit', x: bs.x, y: bs.y, dmg: n });
    if (!bs.rage && bs.hp <= bs.max / 2) {
      bs.rage = true;
      g.events.push({ type: 'rage' });
    }
    if (bs.hp <= 0) {
      g.cleared = true;
      g.score += Math.round(bs.max * 50 * g.scoreMul);
      g.events.push({ type: 'bossdown', x: bs.x, y: bs.y });
    }
  }

  function inBody(bs, x, y, r) {
    const cx = Math.max(bs.x - bs.bw / 2, Math.min(x, bs.x + bs.bw / 2)), cy = Math.max(bs.y - bs.bh / 2, Math.min(y, bs.y + bs.bh / 2));
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
  }

  /* called by the engine for every ball sub-step */
  function ballHit(g, b, px, py, r) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0 || !inBody(bs, b.x, b.y, r)) return;
    const wasOutX = px < bs.x - bs.bw / 2 || px > bs.x + bs.bw / 2;
    if (wasOutX) b.vx = -b.vx;
    else b.vy = -b.vy;
    b.x = px;
    b.y = py;
    if (b.vy < 0 && b.y > bs.y) b.vy = Math.abs(b.vy);
    damage(g, g.megaT > 0 ? 5 : g.fireT > 0 ? 3 : 2);
  }

  function laserHit(g, l) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0 || !inBody(bs, l.x, l.y, 2)) return false;
    bs.chip += 0.34;
    if (bs.chip >= 1) { bs.chip -= 1; damage(g, 1); }
    return true;
  }

  function shoot(g, kind, x, vx) {
    g.projectiles.push({ x: x, y: g.boss.y + g.boss.bh / 2, vx: vx || 0, vy: 230, kind: kind });
  }

  function step(g, dt) {
    const bs = g.boss;
    if (!bs || bs.hp <= 0) return;
    const def = BOSSES[bs.w];
    const k = bs.rage ? 1.5 : 1;
    bs.hurtT = Math.max(0, bs.hurtT - dt);
    bs.x += bs.dir * def.speed * k * dt;
    if (bs.x > g.w - 140) { bs.x = g.w - 140; bs.dir = -1; }
    if (bs.x < 140) { bs.x = 140; bs.dir = 1; }
    bs.ang += bs.spin * k * dt;
    place(g);
    bs.regrowT -= dt;
    if (bs.regrowT <= 0) {
      bs.regrowT = def.id === 'frost' ? 3 : 6;
      const dead = g.bricks.find(br => br.shield && !br.alive);
      if (dead) { dead.alive = true; dead.hp = dead.max; g.events.push({ type: 'regen', x: dead.x + dead.w / 2, y: dead.y + dead.h / 2 }); }
    }
    bs.shootT -= dt;
    if (bs.shootT <= 0) {
      bs.shootT = def.shoot / k;
      const tx = g.paddle.x;
      const vx = (tx - bs.x) * 0.35;
      if (def.id === 'gear' || (bs.rage && def.id === 'engine')) { shoot(g, def.shot, bs.x, vx - 90); shoot(g, def.shot, bs.x, vx); shoot(g, def.shot, bs.x, vx + 90); }
      else shoot(g, def.shot, bs.x, vx);
      g.events.push({ type: 'bossshoot' });
    }
    bs.specialT -= dt;
    if (bs.specialT <= 0) {
      bs.specialT = bs.rage ? 9 : 13;
      special(g, def.id);
    }
    if (bs.inkT > 0) bs.inkT = Math.max(0, bs.inkT - dt);
    if (def.id === 'engine' && bs.rage)
      for (const b of g.balls) if (!b.stuck) { const dx = bs.x - b.x, dy = bs.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx += dx / d * 160 * dt; b.vy += dy / d * 160 * dt; }
    const p = g.paddle;
    for (let i = g.projectiles.length - 1; i >= 0; --i) {
      const s = g.projectiles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0 || s.x > g.w) s.vx = -s.vx;
      if (s.y >= C.PADDLE_Y - 6 && s.y <= C.PADDLE_Y + C.PADDLE_H && Math.abs(s.x - p.x) < p.w / 2 + 6) {
        g.projectiles.splice(i, 1);
        if (s.kind === 'ice' || s.kind === 'void') p.shrinkT = Math.max(p.shrinkT, 6);
        if (s.kind !== 'ice') p.stunT = 1.2;
        if (s.kind === 'ink') bs.inkT = 4;
        ++g.stats.hitsTaken;
        g.events.push({ type: 'stung', kind: s.kind, x: s.x });
      } else if (s.y > g.h + 20) g.projectiles.splice(i, 1);
    }
  }

  function special(g, id) {
    const bs = g.boss;
    if (id === 'hedge') {
      const y = C.BRICK_TOP + 10 * C.BRICK_H;
      for (let x = 0; x < C.COLS; x += 2) if (!g.bricks.some(br => br.alive && !br.shield && br.y === y && br.x === x * C.BRICK_W))
        g.bricks.push({ x: x * C.BRICK_W, y: y, w: C.BRICK_W, h: C.BRICK_H, ch: 'r', kind: 'regen', hp: 1, max: 1, alive: true, regenT: 0, flash: 0.2 });
    } else if (id === 'frost') {
      for (const br of g.bricks) if (br.shield && !br.alive) { br.alive = true; br.hp = br.max; }
      g.paddle.stunT = Math.max(g.paddle.stunT, 0.8);
    } else if (id === 'gear') bs.spin = -bs.spin * 2.2;
    else if (id === 'kraken') bs.inkT = 5;
    else if (id === 'engine') for (let i = 0; i < 5; ++i) shoot(g, 'void', 100 + i * 125, 0);
    if (id === 'gear') setTimeout0(bs);
    g.events.push({ type: 'special', id: id });
  }

  /* the gear ring calms down again in the next specials cycle */
  function setTimeout0(bs) {
    bs.spin = Math.max(-2.4, Math.min(2.4, bs.spin));
  }

  Object.assign(NS.boss, { attach, place, damage, inBody, ballHit, laserHit, step, special });
})();
