/*
 * The world the entity logic sees (G.game) and the reactions to its events: sounds, particles, shakes,
 * summoned foes and boss phase toasts.
 * Owns G.game. Reads G.run.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, BOSS_SHOT_COLORS, WORLDS } = NS.config;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const { sfx } = NS.module('sound');
  const { visibleRect, zoomRect } = NS.module('view');
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const flash = G.flash;

  G.game = {
    level: null, player: null, t: 0, shots: null, enemies: null,
    emit: function(type, d) { onEntityEvent(type, d); }
  };

  const game = G.game;

  function bindGame() {
    game.level = G.run.level;
    game.player = G.run.player;
    game.t = G.run.simT;
    game.shots = G.run.shots;
    game.enemies = G.run.enemies;
  }

  function onEntityEvent(type, d) {
    const W = WORLDS[G.run.world];
    switch (type) {
      case 'windup':
        if (d && d.kind)
          sfx('zap', { pitch: 0.6, volume: 0.6 });
        else if (onScreen(d.x + d.w / 2, d.y))
          sfx('blip', { pitch: 0.7, volume: 0.35 });
        break;
      case 'shot':
        if (onScreen(d.x + d.w / 2, d.y))
          sfx(d.kind ? 'laser' : 'shoot', { pitch: d.kind ? 0.6 : 0.9, volume: 0.45 });
        break;
      case 'land':
        Fx.land(fxWorld, d.x, d.y, dustColor(), d.power || 0.5);
        if (d.shard)
          Fx.debris(fxWorld, d.x, d.y - 8, G.run.world === 2 ? '#d8f4ff' : '#8a7a6a', 6);
        if (onScreen(d.x, d.y)) {
          shake.add(0.15 * (d.power || 0.5));
          sfx('thud', { volume: 0.5 });
        }
        break;
      case 'quake':
        shake.add(0.35 * d.power);
        Fx.land(fxWorld, d.x, d.y, dustColor(), 1);
        sfx('thud', { pitch: 0.6 });
        break;
      case 'telegraph':
        fxWorld.spawn({ kind: 'ring', color: d.kind === 'bolt' ? '#ffe08a' : '#ff6a6a', x: d.x, y: d.y - 4, size: 70, size1: 20, life: 0.85, alpha: 0.9 });
        break;
      case 'teleport':
        Fx.flash(fxWorld, d.x + d.w / 2, d.y + d.h / 2, '#c88aff', 180, 0.4);
        for (let k = 0; k < 14; ++k)
          fxWorld.spawn({ kind: 'spark', color: '#c88aff', x: d.x + d.w / 2, y: d.y + d.h / 2, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, drag: 3, life: 0.5, size: 8, size1: 1 });
        sfx('zap', { pitch: 1.2 });
        break;
      case 'summon': {
        const e = Ent.createEnemy(d.type, Math.floor(d.x / TS), Math.floor(d.y / TS), G.run.world);
        e.x = d.x - e.w / 2;
        e.y = d.y;
        e.vy = -500;
        e.dir = Math.random() < 0.5 ? -1 : 1;
        G.run.enemies.push(e);
        Fx.pop(fxWorld, d.x, d.y, W.color);
        break;
      }
      case 'phase':
        shake.add(0.5);
        flash.fire('#ffffff', 0.35, 3);
        sfx('explode', { pitch: 1.3, volume: 0.6 });
        Session.showToast(d.phase === 3 ? d.name + ' is furious!' : d.name + ' grows angry!', '#ff8a6a');
        break;
      case 'roar':
        shake.add(0.4);
        sfx('explode', { pitch: 0.5, volume: 0.7 });
        break;
      case 'fizzle':
        if (d.owner === 'player') {
          fxWorld.spawn({ kind: 'smoke', color: '#5a4a48', x: d.x, y: d.y, vy: -30, life: 0.4, size: 10, size1: 26, alpha: 0.6 });
          Fx.emberTrail(fxWorld, d.x, d.y);
        } else if (d.owner === 'boss') {
          const y = d.kind === 'wave' ? d.ground - 14 : d.kind === 'bolt' ? d.ground - 30 : d.y;
          Fx.flash(fxWorld, d.x, y, BOSS_SHOT_COLORS[d.boss] || '#ffffff', 70, 0.25);
          fxWorld.spawn({ kind: 'smoke', color: '#ffffff', x: d.x, y: y, vy: -40, life: 0.45, size: 12, size1: 30, alpha: 0.5 });
        }
        break;
      case 'muzzle': {
        /* a boss projectile bursts out of the boss */
        const color = BOSS_SHOT_COLORS[d.boss] || '#ffffff';
        Fx.flash(fxWorld, d.x, d.y, color, 90, 0.22);
        for (let k = 0; k < 6; ++k)
          fxWorld.spawn({ kind: 'spark', color: color, x: d.x, y: d.y, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 160, drag: 3, life: 0.35, size: 6, size1: 1 });
        break;
      }
    }
  }

  function dustColor() {
    return ['#d8c8a0', '#8a90a8', '#ffffff', '#6a5a5a', '#f0eaff'][G.run.world];
  }

  function onScreen(x, y) {
    const v = zoomRect(visibleRect());
    return x > G.run.cam.x + v.x0 - 60 && x < G.run.cam.x + v.x1 + 60 && y > G.run.cam.y + v.y0 - 60 && y < G.run.cam.y + v.y1 + 60;
  }

  Object.assign(NS.module('events'), {
    bindGame,
    dustColor
  });
})();
