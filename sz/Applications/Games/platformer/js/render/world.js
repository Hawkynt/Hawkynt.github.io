/*
 * Drawing the level: backdrop, terrain, dynamic tiles, checkpoints, the goal, pickups, foes, the boss,
 * the ghost, the hero with trails, shots, world particles and the gem radar.
 * Reads G.run; advances purely visual timers in it (bumps, springs, squash, run frames, radar chime).
 * Every animation runs on the level clock G.run.clock, which only moves by the dt passed to drawWorld:
 * drawWorld(0) behind the pause, Tech Tree, Wardrobe, How to Play and results screens draws a frozen
 * world that resumes exactly where it stopped.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, VIEW_W, VIEW_H, GEM_COLORS, BOSS_SHOT_COLORS, WORLDS } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Prog = SZ.PlatformerProgress;
  const Ent = SZ.PlatformerEntities;
  const Spr = SZ.PlatformerSprites;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { drawSprite, drawGlow, glowSprite } = NS.module('kit');
  const ctx = G.ctx;
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const texts = G.texts;
  /* the level clock and the step of the current drawWorld call */
  let clock = 0, wdt = 0;

  function heroPose(r) {
    const p = r.player;
    if (r.clearT > 0)
      return 'win';
    if (r.inv > G.stats.mercy - 0.35 && r.inv > 0 && !p.onGround)
      return 'hurt';
    if (r.squash > 0.75 && p.onGround)
      return 'land';
    return Ph.poseOf(p);
  }

  function heroFrame(r, pose, dt) {
    const p = r.player;
    if (pose === 'run') {
      r.runFrame += Math.abs(p.vx) * dt / 26;
      return Math.floor(r.runFrame);
    }
    if (pose === 'idle' || pose === 'win') {
      r.idleT += dt;
      return Math.floor(r.idleT * (pose === 'win' ? 8 : 4));
    }
    if (pose === 'jump' || pose === 'fall')
      return Math.abs(p.vy) < 200 ? 1 : 0;
    if (pose === 'dash')
      return Math.floor(clock * 20);
    return 0;
  }

  function worldRect(v) {
    const z = G.run.zoom;
    return { x0: G.run.cam.x + v.x0 / z, y0: G.run.cam.y + v.y0 / z, x1: G.run.cam.x + v.x1 / z, y1: G.run.cam.y + v.y1 / z };
  }

  function drawWorld(dt) {
    const r = G.run, level = r.level, p = r.player;
    wdt = dt;
    r.clock += dt;
    clock = r.clock;
    const v = visibleRect();
    const sh = shake.update(dt);
    const camX = r.cam.x + sh.x, camY = r.cam.y + sh.y;
    r.scene.drawBack(ctx, v, camX, camY, clock);
    const z = r.zoom;
    const rect = { x0: camX + v.x0 / z, y0: camY + v.y0 / z, x1: camX + v.x1 / z, y1: camY + v.y1 / z };
    ctx.save();
    if (sh.a) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(sh.a);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.scale(z, z);
    const px = G.viewScale * z;
    ctx.translate(-Math.round(camX * px) / px, -Math.round(camY * px) / px);

    r.tiles.prepare(rect);
    r.tiles.draw(ctx, rect);
    /* secret walls fade while the hero is inside or next to them */
    const inFake = fakeNear(p);
    r.fakeAlpha += ((inFake ? 0.25 : 1) - r.fakeAlpha) * Math.min(1, dt * 6);
    r.tiles.drawLive(ctx, rect, clock, r.fakeAlpha);

    drawDynamicTiles(rect);
    for (const pl of r.platforms)
      if (pl.x + pl.w > rect.x0 && pl.x < rect.x1)
        drawSprite(Spr.item('platform', 0, r.world), pl.x, pl.y);
    drawCheckpoints(rect);
    drawGoal(rect);
    drawItems(rect);
    drawEnemies(rect);
    drawBoss();
    drawGhost();
    drawHero(dt);
    drawShots(rect);
    fxWorld.draw(ctx, rect);
    texts.draw(ctx);
    drawRadar();
    ctx.restore();
    r.scene.drawFront(ctx, v, camX, camY, clock);
  }

  function fakeNear(p) {
    const level = G.run.level;
    const c0 = Math.floor((p.x - 4) / TS), c1 = Math.floor((p.x + p.w + 4) / TS);
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 1) / TS);
    for (let rr = r0; rr <= r1; ++rr)
      for (let c = c0; c <= c1; ++c)
        if (Ph.tileAt(level, c, rr) === T.FAKE)
          return true;
    return false;
  }

  function drawDynamicTiles(rect) {
    const r = G.run, level = r.level;
    const cols = level.cols;
    const c0 = Math.floor(rect.x0 / TS) - 1, c1 = Math.floor(rect.x1 / TS) + 1;
    for (const idx of r.dyn) {
      const c = idx % cols;
      if (c < c0 || c > c1)
        continue;
      const rr = (idx / cols) | 0;
      const code = level.tiles[idx];
      const x = c * TS + TS / 2;
      let y = rr * TS + TS / 2;
      const bump = r.bumps[idx];
      if (bump > 0) {
        y -= Math.sin((1 - bump / 0.2) * Math.PI) * 10;
        r.bumps[idx] = bump - wdt;
      }
      let s = null;
      if (code === T.QBLOCK)
        s = Spr.item('qblock', Math.floor(clock * 6 + c) % 4, r.world);
      else if (code === T.USED)
        s = Spr.item('used', 0, r.world);
      else if (code === T.CRATE)
        s = Spr.item('crate', 0, r.world);
      else if (code === T.CRUMBLE) {
        const k = r.crumbles.get(idx);
        const stage = k && k.t > 0 ? Math.min(2, Math.floor(k.t / 0.18)) : 0;
        if (stage > 0)
          y += Math.sin(clock * 97 + idx) * 1.5;
        s = Spr.item('crumble', stage, r.world);
      } else if (code === T.SPRING) {
        const sq = r.springs[idx] || 0;
        if (sq > 0)
          r.springs[idx] = sq - wdt;
        s = Spr.item('spring', 0, sq > 0.1 ? 1 : 0);
      }
      if (s) {
        if (code === T.QBLOCK)
          drawGlow(x, y, 90, '#ffd75a', 0.18 + 0.08 * Math.sin(clock * 3 + c));
        drawSprite(s, x, y);
      }
    }
    /* the arena gate */
    if (r.gateClosed) {
      const a = level.arena;
      for (let rr = a.r - 4; rr <= a.r; ++rr)
        if (Ph.tileAt(level, a.gate, rr) === T.GATE)
          drawSprite(Spr.item('gate', 0, r.world), a.gate * TS + TS / 2, rr * TS + TS / 2);
    }
  }

  function drawCheckpoints(rect) {
    for (const cp of G.run.checkpoints) {
      if (cp.x < rect.x0 - 80 || cp.x > rect.x1 + 80)
        continue;
      cp.t += wdt;
      if (cp.on)
        drawGlow(cp.x, cp.y - 60, 160, WORLDS[G.run.world].color, 0.25 + 0.08 * Math.sin(clock * 3));
      drawSprite(Spr.item('checkpoint', Math.floor(clock * 6) % 4, cp.on ? 1 : 0), cp.x, cp.y);
    }
  }

  function drawGoal(rect) {
    const r = G.run;
    if (r.goal.x < rect.x0 - 120 || r.goal.x > rect.x1 + 120)
      return;
    if (r.boss && !r.bossDone)
      return;
    drawGlow(r.goal.x, r.goal.y - 70, 260, '#ffe9a0', 0.35 + 0.1 * Math.sin(clock * 2.4));
    drawSprite(Spr.item('goal', Math.floor(clock * 8) % 6, r.world), r.goal.x, r.goal.y);
    if (wdt > 0 && Math.random() < 0.3)
      fxWorld.spawn({ kind: 'spark', color: '#ffe9a0', x: r.goal.x + (Math.random() - 0.5) * 70, y: r.goal.y - Math.random() * 120, vy: -40, life: 0.8, size: 6, size1: 1, ambient: true });
  }

  function drawItems(rect) {
    const r = G.run;
    const cf = Math.floor(clock * 12);
    for (const c of r.coins) {
      if (c.taken || c.x < rect.x0 - 30 || c.x > rect.x1 + 30 || c.y < rect.y0 - 30 || c.y > rect.y1 + 30)
        continue;
      const bob = c.pop > 0 || c.pull ? 0 : Math.sin(clock * 3 + c.x * 0.05) * 2;
      drawSprite(Spr.item('coin', (cf + ((c.x / TS) | 0)) % 8), c.x, c.y + bob);
    }
    for (const g of r.gems) {
      if (g.taken || g.x < rect.x0 - 40 || g.x > rect.x1 + 40)
        continue;
      const bob = Math.sin(clock * 2.5 + g.i) * 4;
      ctx.save();
      if (g.old)
        ctx.globalAlpha = 0.55;
      drawGlow(g.x, g.y + bob, 110, GEM_COLORS[g.i], 0.45 + 0.15 * Math.sin(clock * 4));
      drawSprite(Spr.item('gem', Math.floor(clock * 8) % 6, g.i), g.x, g.y + bob);
      ctx.restore();
    }
    for (const it of r.items) {
      if (it.taken)
        continue;
      const rising = it.t < Ent.ITEM_RISE;
      const bob = rising ? 0 : Math.sin(clock * 4) * 3;
      ctx.save();
      if (rising) {
        /* it climbs out of the block: hide the part still inside */
        ctx.beginPath();
        ctx.rect(it.x - TS, it.y0 - TS * 2, TS * 2, TS * 2.5);
        ctx.clip();
      }
      drawGlow(it.x, it.y + bob, 90, it.kind === 'fire' ? '#ff8a3a' : it.kind === 'star' ? '#ffe14a' : '#ff6a86', 0.4);
      drawSprite(Spr.item(it.kind, Math.floor(clock * 8) % 4), it.x, it.y + bob);
      ctx.restore();
    }
  }

  function drawEnemies(rect) {
    const r = G.run;
    for (const e of r.enemies) {
      if (!e.alive || e.x + e.w < rect.x0 - 40 || e.x > rect.x1 + 40 || e.y > rect.y1 + 40 || e.y + e.h < rect.y0 - 40)
        continue;
      const frames = Spr.ENEMY_FRAMES[e.type] || 4;
      const fps = e.state === 'charge' ? 16 : e.type === 'flyer' || e.type === 'diver' ? 12 : 7;
      const st = e.state === 'windup' || e.state === 'stunned' ? e.state : e.state === 'charge' ? 'windup' : 'normal';
      const s = Spr.enemy(e.type, e.world, Math.floor(e.frameT * fps) % frames, st);
      const air = e.type === 'flyer' || e.type === 'diver';
      const x = e.x + e.w / 2, y = air ? e.y + e.h / 2 : e.y + e.h;
      let sx = 1, sy = 1;
      if (e.type === 'hopper' && e.squash > 0) { sx = 1.2; sy = 0.8; }
      if (e.state === 'windup' && e.type !== 'turret') {
        sx = 1 + Math.sin(e.stateT * 40) * 0.04;
      }
      drawSprite(s, x, y, e.dir < 0, sx, sy);
      if (e.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = e.flash / 0.15 * 0.6;
        drawSprite(s, x, y, e.dir < 0, sx, sy);
        ctx.restore();
      }
    }
  }

  function drawBoss() {
    const b = G.run.boss;
    if (!b || !b.alive)
      return;
    let pose = 'idle';
    if (b.dying > 0)
      pose = 'hurt';
    else if (b.state === 'windup' || b.state === 'cast' || b.state === 'throw' || b.state === 'swoop' || b.state === 'charge')
      pose = 'attack';
    else if (b.state === 'stunned' || b.state === 'tired' || b.state === 'rest' || b.state === 'teleport')
      pose = 'special';
    const frames = Spr.BOSS_FRAMES[pose];
    const s = Spr.boss(b.kind, pose, Math.floor(b.t * (pose === 'idle' ? 6 : 10)) % frames);
    const x = b.x + b.w / 2, y = b.y + b.h;
    ctx.save();
    if (b.state === 'teleport')
      ctx.globalAlpha = Math.abs(Math.cos(b.stateT * 14)) * 0.8;
    if (b.dying > 0) {
      ctx.globalAlpha = Math.min(1, b.dying / 1.2);
    }
    let sx = 1, sy = 1;
    if (b.kind === 'slime') {
      const k = b.onGround ? Math.sin(b.t * 5) * 0.04 : -0.08;
      sx = 1 - k;
      sy = 1 + k;
    }
    if (b.inv > 0 && Math.floor(b.inv * 20) % 2 === 0)
      ctx.globalAlpha *= 0.6;
    drawGlow(x, y - b.h / 2, b.w * 2.4, ['#7ad04a', '#6ab8ff', '#bfe6ff', '#ff7a3a', '#c8a8ff'][G.run.world], 0.18);
    drawSprite(s, x, y, b.dir < 0, sx, sy);
    if (b.flash > 0 && b.dying <= 0) {
      /* a white flash on every hit */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, b.flash / 0.25) * 0.75;
      drawSprite(s, x, y, b.dir < 0, sx, sy);
    }
    ctx.restore();
  }

  function drawGhost() {
    const r = G.run;
    if (!r.ghost || !r.ghost.length || r.introT > 0)
      return;
    const g = Prog.ghostAt(r.ghost, r.t, r.ghostPos);
    if (!g)
      return;
    const pose = g.pose === 'hurt' ? 'fall' : g.pose;
    const s = Spr.hero(Session.currentSkin(), pose, Math.floor(r.t * 12) % (Spr.HERO_FRAMES[pose] || 1));
    ctx.save();
    ctx.globalAlpha = 0.38;
    drawSprite(s, g.x, g.y, g.facing < 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    drawSprite(s, g.x, g.y, g.facing < 0);
    ctx.restore();
  }

  function drawHero(dt) {
    const r = G.run, p = r.player;
    if (r.fallT > 0 || r.koT > 0)
      return;
    const pose = heroPose(r);
    const frame = heroFrame(r, pose, dt);
    const s = Spr.hero(Session.currentSkin(), pose, frame);
    const x = p.x + p.w / 2, y = p.y + p.h;
    /* squash and stretch */
    r.squash = Math.max(0, r.squash - dt * 5);
    r.stretch = Math.max(0, r.stretch - dt * 5);
    const sx = 1 + r.squash * 0.22 - r.stretch * 0.12;
    const sy = 1 - r.squash * 0.2 + r.stretch * 0.14;
    /* trails */
    r.afterT += dt;
    if (dt > 0 && p.dashT > 0 && r.afterT > 0.025) {
      r.afterT = 0;
      fxWorld.spawn({ kind: 'image', img: s, flipX: p.facing < 0, x: x, y: y, life: 0.28, alpha: 0.5, add: true });
    } else if (dt > 0 && G.save.trail === 'shadow' && Math.abs(p.vx) > 150 && r.afterT > 0.06) {
      r.afterT = 0;
      fxWorld.spawn({ kind: 'image', img: s, flipX: p.facing < 0, x: x, y: y, life: 0.35, alpha: 0.35 });
    }
    if (G.save.trail !== 'none' && G.save.trail !== 'shadow' && (Math.abs(p.vx) > 60 || !p.onGround))
      Fx.trail(fxWorld, G.save.trail, x, y - 10, dt, clock);
    if (r.star > 0) {
      drawGlow(x, y - 24, 120, ['#ff5a5a', '#ffe14a', '#6ae06a', '#4ab8ff'][Math.floor(clock * 10) % 4], 0.5);
      if (dt > 0 && Math.random() < 0.5)
        fxWorld.spawn({ kind: 'star', color: '#ffe14a', x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 44, vy: -40, life: 0.4, size: 10, size1: 2 });
    }
    ctx.save();
    if (r.inv > 0 && Math.floor(r.inv * 16) % 2 === 0)
      ctx.globalAlpha = 0.35;
    drawSprite(s, x, y, p.facing < 0, sx, sy);
    ctx.restore();
    if (r.shield)
      drawSprite(Spr.item('shield', 0), x, y - 22, false, 1 + Math.sin(clock * 4) * 0.03, 1 + Math.cos(clock * 4) * 0.03);
    if (dt > 0 && r.fire && Math.random() < 0.15)
      Fx.emberTrail(fxWorld, x + p.facing * 10, y - 26, '#ff8a2a');
  }

  function drawShots(rect) {
    const r = G.run;
    for (const s of r.shots) {
      if (!s.alive || s.x < rect.x0 - 60 || s.x > rect.x1 + 60)
        continue;
      if (s.kind === 'bolt') {
        if (s.delay > 0) {
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.25 * Math.sin(clock * 30);
          ctx.fillStyle = '#ffe08a';
          ctx.fillRect(s.x - 18, rect.y0, 36, s.ground - rect.y0);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite('#c8a8ff'), s.x - 60, rect.y0, 120, s.ground - rect.y0);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          let y = rect.y0, x = s.x;
          ctx.moveTo(x, y);
          while (y < s.ground) {
            y += 36;
            x = s.x + Math.sin(Math.floor(clock * 30) * 7.3 + y * 0.37) * 13;
            ctx.lineTo(x, Math.min(y, s.ground));
          }
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#fff6c0';
          ctx.stroke();
          ctx.restore();
          if (wdt > 0 && Math.random() < 0.5)
            shake.add(0.05);
        }
        continue;
      }
      if (s.kind === 'fall' && s.delay > 0) {
        /* a shadow where the rock or icicle will land */
        const k = 1 - s.delay / 0.85;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.45;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(s.x, G.run.boss ? G.run.boss.floor - 2 : s.y, 10 + k * 18, 5 + k * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (s.kind === 'wave') {
        drawGlow(s.x, s.ground - 14, 90, '#9aff6a', 0.6);
        drawSprite(Spr.item('bossShot', Math.floor(clock * 12) % 4, 0), s.x, s.ground - 16, s.vx < 0, 1.4, 0.8);
        continue;
      }
      if (s.owner === 'player') {
        drawGlow(s.x, s.y, s.r * 7, '#ff8a2a', 0.6);
        drawSprite(Spr.item('fireball', Math.floor(clock * 16) % 4), s.x, s.y, s.vx < 0, s.r / 10, s.r / 10);
      } else if (s.owner === 'boss') {
        drawGlow(s.x, s.y, 80, BOSS_SHOT_COLORS[s.boss], 0.5);
        drawSprite(Spr.item('bossShot', Math.floor(clock * 12) % 4, s.boss), s.x, s.y);
      } else {
        drawGlow(s.x, s.y, 60, '#ff6a6a', 0.4);
        drawSprite(Spr.item('shot', Math.floor(clock * 12) % 4, s.world), s.x, s.y);
      }
    }
  }

  /* gem radar: an arrow at the hero pointing to the nearest missing gem */
  function drawRadar() {
    const r = G.run, p = r.player;
    if (!G.stats.radar || r.koT > 0)
      return;
    let best = null, bd = Infinity;
    for (const g of r.gems) {
      if (g.taken)
        continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bd) { bd = d; best = g; }
    }
    if (!best || bd < 90)
      return;
    const a = Math.atan2(best.y - (p.y + p.h / 2), best.x - (p.x + p.w / 2));
    const x = p.x + p.w / 2 + Math.cos(a) * 52, y = p.y + p.h / 2 + Math.sin(a) * 52;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(clock * 5);
    ctx.translate(x, y);
    ctx.rotate(a);
    const s = Spr.item('arrow', 0);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
    r.radarT -= wdt;
    if (r.radarT <= 0 && bd < 8 * TS) {
      r.radarT = Math.max(0.35, bd / TS * 0.18);
      sfx('blip', { pitch: 2 - Math.min(1, bd / (8 * TS)), volume: 0.25 });
    }
  }

  Object.assign(NS.module('world'), {
    worldRect,
    drawWorld
  });
})();
