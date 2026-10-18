/*
 * Combat: fireballs, getting hurt, pits, knock-outs and respawns, foes (stomps, shockwaves) and shots.
 * Writes G.run (hearts, player, enemies, shots) and G.save.stats.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, STEP, RESPAWN_TIME, KO_TIME, FIRE_SPEED, WORLDS } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const Events = NS.module('events');
  const Camera = NS.module('camera');
  const Boss = NS.module('boss');
  const Finish = NS.module('finish');
  const { sfx } = NS.module('sound');
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const hitStop = G.hitStop;
  const flash = G.flash;
  const texts = G.texts;
  const inp = G.inp;
  const game = G.game;

  function shootFire() {
    const r = G.run, p = r.player;
    if (!r.fire || r.fireCd > 0)
      return;
    const lv = Math.max(1, G.stats.fire);
    const alive = r.shots.filter(s => s.alive && s.owner === 'player').length;
    if (alive >= (lv >= 2 ? 2 : 1))
      return;
    r.fireCd = 0.22;
    const big = lv >= 3;
    const s = Ent.spawnShot(game, {
      kind: 'fireball', owner: 'player', x: p.x + p.w / 2 + p.facing * 18, y: p.y + 16, vx: p.facing * FIRE_SPEED + p.vx * 0.3, vy: 120,
      gravity: 1500, r: big ? 14 : 10, life: 1.8, bounce: true, pierce: big
    });
    s.highBounce = lv >= 2;
    sfx('shoot', { pitch: 1.3, volume: 0.5 });
  }

  function hurtPlayer(fromX, spike) {
    const r = G.run, p = r.player;
    if (r.inv > 0 || r.star > 0)
      return;
    const dir = p.x + p.w / 2 < fromX ? -1 : 1;
    p.vx = dir * 300;
    p.vy = -520;
    p.onGround = false;
    p.dashT = 0;
    if (r.shield) {
      r.shield = false;
      r.inv = 1;
      Fx.flash(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#8ad8ff', 160, 0.4);
      fxWorld.spawn({ kind: 'ring', color: '#8ad8ff', x: p.x + p.w / 2, y: p.y + p.h / 2, size: 40, size1: 120, life: 0.4 });
      sfx('zap', { pitch: 0.8 });
      Session.showToast('Shield broken!', '#8ad8ff');
      return;
    }
    r.hearts -= 1;
    r.inv = G.stats.mercy;
    Fx.hurt(fxWorld, p.x + p.w / 2, p.y + p.h / 2);
    shake.add(0.4);
    hitStop.hit(0.07);
    flash.fire('#ff2a3a', 0.25, 3);
    sfx('hurt');
    if (spike)
      p.vy = -700;
    if (r.hearts <= 0)
      knockOut();
  }

  function fallIn(kind) {
    const r = G.run, p = r.player;
    const hot = G.run.world === 3;
    if (kind === 'liquid')
      Fx.splash(fxWorld, p.x + p.w / 2, p.y + p.h, ['#7ad0ff', '#6ae0ff', '#bfe8ff', '#ff8a2a', '#c8a8ff'][r.world], hot);
    sfx(kind === 'liquid' ? (hot ? 'explode' : 'drop') : 'lose', { volume: 0.6, pitch: kind === 'liquid' ? 0.8 : 1.4 });
    r.hearts -= 1;
    shake.add(0.3);
    if (r.hearts <= 0) {
      knockOut();
      return;
    }
    r.fallT = RESPAWN_TIME;
  }

  function knockOut() {
    const r = G.run, p = r.player;
    r.koT = KO_TIME;
    r.deaths++;
    G.save.stats.deaths++;
    Fx.death(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#ffd75a');
    shake.add(0.6);
    hitStop.hit(0.15);
    flash.fire('#ffffff', 0.5, 2);
    sfx('lose');
  }

  function afterKnockOut() {
    const r = G.run;
    if (r.mode === 'endless') {
      Finish.endEndless();
      return;
    }
    r.hearts = r.maxHearts;
    r.shield = G.stats.shield;
    if (r.boss && r.gateClosed && !r.bossDone)
      resetBossFight();
    respawnAt(r.respawn, true);
  }

  /* knocked out in the arena: the gate opens and the boss waits, fully healed */
  function resetBossFight() {
    const r = G.run, a = r.level.arena;
    for (let rr = a.r - 4; rr <= a.r; ++rr)
      if (Ph.tileAt(r.level, a.gate, rr) === T.GATE)
        Ph.setTile(r.level, a.gate, rr, T.EMPTY);
    r.tiles.refresh(a.gate, a.r);
    r.gateClosed = false;
    r.boss = Ent.createBoss(r.level.boss, r.level);
    r.shots = game.shots = [];
    r.enemies = game.enemies = r.enemies.filter(e => e.x < a.gate * TS);
  }

  function respawnAt(pos, full) {
    const r = G.run, p = r.player;
    p.x = pos.x;
    p.y = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.dashT = 0;
    p.onGround = false;
    r.inv = full ? 1.5 : 1.2;
    r.fallT = 0;
    r.koT = 0;
    fxWorld.spawn({ kind: 'ring', color: '#ffffff', x: p.x + p.w / 2, y: p.y + p.h / 2, size: 120, size1: 20, life: 0.4 });
    Fx.flash(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#fff4c0', 120, 0.4);
    Camera.snapCamera();
    sfx('pickup', { pitch: 0.7 });
  }

  function killEnemy(e, how) {
    if (!e.alive)
      return;
    e.alive = false;
    const r = G.run;
    r.stomps++;
    G.save.stats.stomps++;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    Fx.pop(fxWorld, cx, cy, enemyColor(e));
    sfx(how === 'stomp' ? 'bounce' : 'smallExplode', { pitch: how === 'stomp' ? 1 + Math.min(r.combo, 6) * 0.08 : 1 });
    /* a defeated foe leaves a coin behind */
    r.coins.push({ x: cx, y: cy, taken: false, vx: 0, vy: -380, pull: false, pop: 0.4, t: 0 });
  }

  function enemyColor(e) {
    const pal = {
      walker: ['#6ad04a', '#4a5a8a', '#2a3a5a', '#ff6a2a', '#c8c0e0'],
      charger: ['#8a5a3a', '#6a7a9a', '#e8e8f0', '#c83a1a', '#8a7ab8'],
      hopper: ['#5ab83a', '#3a8a6a', '#ffffff', '#c8642a', '#d8b860']
    };
    const p = pal[e.type];
    return p ? p[e.world] : WORLDS[e.world].color;
  }

  function updateEnemies() {
    const r = G.run, p = r.player;
    for (const e of r.enemies) {
      if (!e.alive)
        continue;
      /* sleep far off-screen */
      if (Math.abs(e.x - p.x) > 1300 && e.state === 'normal')
        continue;
      Ent.updateEnemy(e, game, STEP);
      if (!e.alive || r.koT > 0)
        continue;
      if (!Ph.overlaps(p, e))
        continue;
      if (r.star > 0) {
        killEnemy(e, 'star');
        continue;
      }
      const fromAbove = r.prevBottom <= e.y + 14 && p.vy >= -20;
      if (fromAbove && e.stomp) {
        stompEnemy(e);
      } else if (fromAbove && !e.stomp) {
        /* spikes on its back: bounce off, and it hurts */
        p.vy = -Ph.P.stompBounce * 0.8;
        hurtPlayer(e.x + e.w / 2, false);
      } else {
        hurtPlayer(e.x + e.w / 2, false);
      }
    }
    /* drop the dead now and then */
    if (r.enemies.length > 40)
      r.enemies = r.enemies.filter(e => e.alive);
  }

  function stompEnemy(e) {
    const r = G.run, p = r.player;
    p.vy = -(inp.jump ? Ph.P.jumpV * 0.95 : Ph.P.stompBounce);
    p.jumping = inp.jump;
    p.airJumps = G.stats.doubleJump ? 1 : 0;
    if (G.stats.dash >= 2)
      p.dashReady = true;
    r.stretch = 1;
    r.combo++;
    r.comboT = 0.4;
    const cx = e.x + e.w / 2;
    Fx.stomp(fxWorld, cx, e.y, Events.dustColor());
    hitStop.hit(0.045);
    shake.add(0.12);
    killEnemy(e, 'stomp');
    if (r.combo >= 2)
      texts.add(cx, e.y - 20, 'x' + r.combo + ' COMBO', { color: '#ffd75a', size: 18 + Math.min(r.combo, 6) * 2 });
    if (G.stats.shockwave > 0) {
      const radius = (G.stats.shockwave >= 2 ? 2.8 : 1.8) * TS;
      Fx.shockwave(fxWorld, cx, e.y + e.h, radius);
      for (const o of r.enemies) {
        if (!o.alive || o === e)
          continue;
        const dx = o.x + o.w / 2 - cx, dy = o.y + o.h - (e.y + e.h);
        if (dx * dx + dy * dy < radius * radius)
          killEnemy(o, 'wave');
      }
    }
  }

  const boxTmp = { x: 0, y: 0, w: 0, h: 0 };

  function updateShots() {
    const r = G.run, p = r.player;
    for (const s of r.shots) {
      Ent.updateShot(s, game, STEP);
      if (!s.alive || s.delay > 0)
        continue;
      if (s.owner === 'player') {
        if (Math.random() < 0.6)
          Fx.emberTrail(fxWorld, s.x, s.y);
        for (const e of r.enemies) {
          if (!e.alive || !Ph.overlaps(Ent.shotBox(s, boxTmp), e))
            continue;
          e.hp -= 1;
          e.flash = 0.15;
          Fx.flash(fxWorld, s.x, s.y, '#ff8a2a', 70, 0.2);
          if (e.hp <= 0)
            killEnemy(e, 'fire');
          else
            sfx('hit', { volume: 0.5 });
          if (!s.pierce)
            s.alive = false;
          break;
        }
        if (s.alive && r.boss && r.boss.alive && Ph.overlaps(Ent.shotBox(s, boxTmp), r.boss)) {
          if (Ent.hurtBoss(r.boss, 0.34 * G.stats.bossMul, game)) {
            sfx('hit', { pitch: 0.8 });
            Fx.explosion(fxWorld, s.x, s.y, '#ff8a2a', 0.4);
            Boss.bossHitFx();
          }
          s.alive = false;
        }
        /* fireballs cancel enemy shots */
        for (const o of r.shots) {
          if (o.alive && o.owner !== 'player' && o.kind !== 'bolt' && o.kind !== 'wave' && Math.abs(o.x - s.x) < o.r + s.r && Math.abs(o.y - s.y) < o.r + s.r) {
            o.alive = false;
            s.alive = s.pierce;
            Fx.flash(fxWorld, o.x, o.y, '#ffffff', 60, 0.2);
          }
        }
        continue;
      }
      if (r.koT > 0 || r.fallT > 0)
        continue;
      if (Ph.overlaps(Ent.shotBox(s, boxTmp), p)) {
        if (s.kind !== 'bolt' && s.kind !== 'wave')
          s.alive = false;
        hurtPlayer(s.x, false);
      }
    }
    if (r.shots.length > 30)
      r.shots = game.shots = r.shots.filter(s => s.alive);
  }

  Object.assign(NS.module('combat'), {
    shootFire,
    hurtPlayer,
    fallIn,
    afterKnockOut,
    respawnAt,
    killEnemy,
    updateEnemies,
    updateShots
  });
})();
