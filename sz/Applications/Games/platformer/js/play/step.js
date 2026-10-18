/*
 * The fixed-step simulation of one level: the step accumulator, the order of the systems in a step,
 * safe respawn ground and the effects of the hero's own movement events.
 * Reads G.inp; drives every play system.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, STEP, MAX_STEPS, COYOTE_SAFE } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Input = NS.module('input');
  const Events = NS.module('events');
  const Blocks = NS.module('blocks');
  const Combat = NS.module('combat');
  const Boss = NS.module('boss');
  const Pickups = NS.module('pickups');
  const Finish = NS.module('finish');
  const { sfx } = NS.module('sound');
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const hitStop = G.hitStop;
  const inp = G.inp;

  function updatePlay(dt) {
    const r = G.run;
    r.introT = Math.max(0, r.introT - dt);
    if (r.introT > 0.35) {
      Input.readInput();
      return;
    }
    const gdt = hitStop.filter(dt);
    Input.readInput();
    let first = true;
    r.acc += gdt;
    let steps = 0;
    while (r.acc >= STEP && steps < MAX_STEPS) {
      r.acc -= STEP;
      ++steps;
      stepPlay(first);
      first = false;
      inp.jumpPressed = false;
      inp.dashPressed = false;
      G.firePressed = false;
      if (G.screen !== 'play' || G.run !== r)
        return;
    }
    if (steps >= MAX_STEPS)
      r.acc = 0;
  }

  function stepPlay() {
    const r = G.run, p = r.player, level = r.level;
    r.simT += STEP;
    Events.bindGame();
    Ent.updatePlatforms(r.platforms, r.simT);

    if (r.clearT > 0) {
      r.clearT -= STEP;
      p.vx *= 0.9;
      if (r.clearT <= 0)
        Finish.finishLevel();
      return;
    }
    if (r.koT > 0) {
      r.koT -= STEP;
      if (r.koT <= 0)
        Combat.afterKnockOut();
      return;
    }
    if (r.fallT > 0) {
      r.fallT -= STEP;
      if (r.fallT <= 0)
        Combat.respawnAt(r.safe, false);
      return;
    }

    r.t += STEP;
    r.inv = Math.max(0, r.inv - STEP);
    r.star = Math.max(0, r.star - STEP);
    r.fireCd = Math.max(0, r.fireCd - STEP);
    r.comboT = Math.max(0, r.comboT - STEP);
    if (r.comboT <= 0 && p.onGround)
      r.combo = 0;

    r.prevBottom = p.y + p.h;
    const wasGround = p.onGround;
    Ph.stepPlayer(p, inp, { level: level, platforms: r.platforms }, G.stats, STEP);
    playerEvents(p, wasGround);

    if (G.firePressed)
      Combat.shootFire();

    /* crumbling floors under the feet */
    if (p.onGround && p.ground === T.CRUMBLE)
      Blocks.standOnCrumble(p);
    Blocks.updateCrumbles();

    /* hazards */
    const hz = Ph.hazardAt(p, level);
    if (hz === 'spike')
      Combat.hurtPlayer(p.x + p.w / 2, true);
    else if (hz)
      Combat.fallIn(hz);
    if (r.fallT > 0 || r.koT > 0)
      return;

    /* safe ground for pit respawns */
    if (p.onGround && p.platform < 0 && (p.ground === T.SOLID || p.ground === T.ICE || p.ground === T.ONEWAY)) {
      r.safeT += STEP;
      if (r.safeT > COYOTE_SAFE && safeSpot(p)) {
        r.safe.x = p.x;
        r.safe.y = p.y;
      }
    } else {
      r.safeT = 0;
    }

    Combat.updateEnemies();
    Combat.updateShots();
    Boss.updateBoss();
    Pickups.updateItems();
    Pickups.recordGhost();

    /* fall-through safety */
    if (p.x < 0)
      p.x = 0;
  }

  function safeSpot(p) {
    const level = G.run.level;
    const c0 = Math.floor((p.x - TS) / TS), c1 = Math.floor((p.x + p.w + TS) / TS), r = Math.floor((p.y + p.h + 2) / TS);
    for (let c = c0; c <= c1; ++c) {
      if (!Ph.solidAt(level, c, r) && Ph.tileAt(level, c, r) !== T.ONEWAY)
        return false;
      if (Ph.tileAt(level, c, r - 1) === T.SPIKE)
        return false;
    }
    for (const e of G.run.enemies)
      if (e.alive && Math.abs(e.x - p.x) < 3 * TS && Math.abs(e.y - p.y) < 2 * TS)
        return false;
    return true;
  }

  function playerEvents(p, wasGround) {
    const r = G.run, ev = p.ev;
    const feetX = p.x + p.w / 2, feetY = p.y + p.h;
    if (ev.jump) {
      sfx('jump', { volume: 0.6 });
      Fx.jump(fxWorld, feetX, feetY, Events.dustColor());
      r.stretch = 1;
      G.save.stats.jumps++;
    }
    if (ev.doubleJump) {
      sfx('jump', { pitch: 1.35, volume: 0.6 });
      Fx.doubleJump(fxWorld, feetX, feetY);
      r.stretch = 1;
    }
    if (ev.wallJump) {
      sfx('jump', { pitch: 1.15, volume: 0.6 });
      Fx.wallJump(fxWorld, p.facing > 0 ? p.x : p.x + p.w, p.y + p.h / 2, p.facing, Events.dustColor());
      r.stretch = 1;
    }
    if (ev.wallSlide && Math.random() < 0.3)
      Fx.wallSlide(fxWorld, p.wall > 0 ? p.x + p.w : p.x, p.y + p.h * 0.7, Events.dustColor());
    if (ev.dash) {
      sfx('whoosh', { pitch: 1.4 });
      Fx.dash(fxWorld, feetX, p.y + p.h / 2, p.dashDir, '#bfe8ff');
      shake.add(0.08);
      r.afterT = 0;
    }
    if (ev.land) {
      const k = Math.min(1, ev.land / 1000);
      if (k > 0.25) {
        Fx.land(fxWorld, feetX, feetY, Events.dustColor(), k);
        sfx('thud', { volume: 0.25 + k * 0.4, pitch: 1.4 - k * 0.4 });
      }
      if (k > 0.85)
        shake.add(0.12);
      r.squash = 0.6 + k * 0.4;
    }
    if (ev.spring) {
      sfx('bounce', { pitch: 0.8 });
      Fx.springPuff(fxWorld, ev.spring.c * TS + TS / 2, ev.spring.r * TS);
      r.springs[ev.spring.r * r.level.cols + ev.spring.c] = 0.25;
      r.stretch = 1;
    }
    if (ev.head)
      Blocks.hitBlock(ev.head.c, ev.head.r, true);
    if (ev.crate)
      Blocks.breakCrate(ev.crate.c, ev.crate.r);
    /* running dust */
    if (p.onGround && Math.abs(p.vx) > 200 && Math.random() < 0.18)
      Fx.dust(fxWorld, feetX, feetY, Events.dustColor(), 1, Math.sign(p.vx));
    if (p.onGround && p.ground === T.ICE && Math.abs(p.vx) > 120 && Math.random() < 0.25)
      fxWorld.spawn({ kind: 'flake', x: feetX, y: feetY - 2, vx: -p.vx * 0.2, vy: -60, ay: 300, life: 0.5, size: 4 });
    if (!wasGround && p.onGround)
      r.combo = 0;
  }

  Object.assign(NS.module('step'), {
    updatePlay
  });
})();
