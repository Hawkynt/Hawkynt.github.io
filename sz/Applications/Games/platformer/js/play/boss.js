/*
 * The boss fight: closing the arena gate, stomping and burning the boss, its death and rewards.
 * Writes G.run (boss, gate, coins).
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, STEP, WORLDS } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const Combat = NS.module('combat');
  const { sfx } = NS.module('sound');
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const hitStop = G.hitStop;
  const flash = G.flash;
  const texts = G.texts;
  const game = G.game;

  function updateBoss() {
    const r = G.run, b = r.boss, p = r.player;
    if (!b)
      return;
    const a = r.level.arena;
    if (!r.gateClosed && p.x > (a.gate + 1.5) * TS) {
      r.gateClosed = true;
      for (let rr = a.r - 4; rr <= a.r; ++rr)
        if (Ph.tileAt(r.level, a.gate, rr) === T.EMPTY)
          Ph.setTile(r.level, a.gate, rr, T.GATE);
      r.tiles.refresh(a.gate, a.r);
      b.active = true;
      shake.add(0.4);
      sfx('thud', { pitch: 0.5 });
      Session.showToast(b.name, '#ff8a6a');
    }
    if (!b.alive) {
      if (!r.bossDone) {
        r.bossDone = true;
        Fx.explosion(fxWorld, b.x + b.w / 2, b.y + b.h / 2, '#ffd75a', 1.6);
        for (let k = 0; k < 12; ++k)
          r.coins.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, taken: false, vx: (k - 5.5) * 45, vy: -600 - (k % 3) * 120, pull: false, pop: 0.7, t: 0 });
        Fx.checkpoint(fxWorld, r.goal.x, r.goal.y - 60, WORLDS[r.world].color);
        flash.fire('#ffffff', 0.6, 1.5);
        shake.add(0.8);
        sfx('win');
        Session.showToast(b.name + ' defeated!', '#ffd75a');
      }
      return;
    }
    const wasDying = b.dying > 0;
    Ent.updateBoss(b, game, STEP);
    if (b.dying > 0) {
      if (!wasDying) {
        hitStop.hit(0.25);
        shake.add(0.8);
        sfx('explode');
      }
      if (Math.random() < 0.15)
        Fx.explosion(fxWorld, b.x + Math.random() * b.w, b.y + Math.random() * b.h, ['#ffd75a', '#ff8a3a', '#ffffff'][(Math.random() * 3) | 0], 0.6);
      return;
    }
    if (!b.active || r.koT > 0 || r.fallT > 0 || !Ph.overlaps(p, b))
      return;
    const fromAbove = r.prevBottom <= b.y + 26 && p.vy >= -20;
    if (fromAbove && Ent.bossStompable(b)) {
      p.vy = -Ph.P.jumpV * 1.05;
      p.airJumps = G.stats.doubleJump ? 1 : 0;
      if (G.stats.dash >= 2)
        p.dashReady = true;
      if (Ent.hurtBoss(b, G.stats.bossMul, game)) {
        Fx.stomp(fxWorld, p.x + p.w / 2, b.y, '#ffffff');
        bossHitFx();
        hitStop.hit(0.1);
        sfx('hit');
      }
      p.vx = (p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1) * 260;
    } else if (fromAbove) {
      p.vy = -Ph.P.stompBounce;
      sfx('thud', { pitch: 1.5 });
    } else if (r.star <= 0) {
      Combat.hurtPlayer(b.x + b.w / 2, false);
    }
  }

  function bossHitFx() {
    const b = G.run.boss;
    shake.add(0.35);
    texts.add(b.x + b.w / 2, b.y - 10, '-' + Math.ceil((b.maxHp - b.hp) / b.maxHp * 100) + '%', { color: '#ff8a6a', size: 20 });
  }

  Object.assign(NS.module('boss'), {
    updateBoss,
    bossHitFx
  });
})();
