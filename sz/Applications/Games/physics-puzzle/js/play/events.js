;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Physics events to feedback: particles, sound, shake, flashes, slow motion
   * and floating texts for impacts, springs, bumpers, glass, TNT, portals,
   * water, lava, targets and stars, near-miss slow motion and the win burst.
   * Reads G.run and G.time; writes the effect systems on G, marks gadgets hit
   * and counts glass, TNT and stars in G.save.
   */

  const G = NS.G;
  const Fx = G.Fx;

  function matOf(b) {
    return b.mat || 'wood';
  }

  function handleEvents(events) {
    const run = G.run;
    const fxWorld = G.fxWorld;
    for (const e of events) {
      switch (e.type) {
        case 'impact': {
          const ball = e.a.tag === 'ball' ? e.a : e.b.tag === 'ball' ? e.b : null;
          const other = ball === e.a ? e.b : e.a;
          const s = Math.min(1, e.speed / 1100);
          if (ball) {
            Fx.impact(fxWorld, e.x, e.y, e.nx * (ball === e.b ? 1 : -1), e.ny * (ball === e.b ? 1 : -1), matOf(other), s);
            if (s > 0.15)
              G.sfx(other.mat === 'metal' ? 'hit' : 'bounce', { volume: 0.3 + s * 0.6, pitch: 0.8 + Math.random() * 0.4 });
            if (s > 0.6)
              G.shake.add(0.08 * s);
          } else if (e.speed > 140) {
            const dyn = e.a.type === 'dynamic' ? e.a : e.b;
            Fx.dust(fxWorld, e.x, e.y, '#d8c8a8', s);
            if (dyn.mat === 'wood' && s > 0.3)
              G.sfx('thud', { volume: 0.3 + s * 0.5 });
          }
          break;
        }
        case 'boost': {
          const gadget = e.a.boost ? e.a : e.b;
          gadget.data.hitAt = G.time;
          if (gadget.tag === 'spring') {
            Fx.springPop(fxWorld, e.x, e.y, Math.sin(gadget.a), -Math.cos(gadget.a));
            G.sfx('jump', { pitch: 1.2 });
          } else {
            Fx.bumperPop(fxWorld, gadget.x, gadget.y, gadget.r || 24, '#ff7ad0');
            G.sfx('zap', { volume: 0.7 });
          }
          G.shake.add(0.06);
          break;
        }
        case 'break':
          Fx.shatter(fxWorld, e.body.x, e.body.y, e.body.data && e.body.data.w || 100, e.body.a);
          G.sfx('smallExplode', { pitch: 1.8 });
          G.shake.add(0.2);
          ++G.save.stats.glass;
          break;
        case 'explode':
          Fx.explosion(fxWorld, e.x, e.y, e.radius);
          NS.field.scorch(e.x, e.y + 14, 70);
          G.sfx('explode');
          G.shake.add(0.6);
          G.flash.fire('#ffd8a0', 0.35, 3);
          G.timeScale.slow(0.45, 0.15);
          ++G.save.stats.tnt;
          break;
        case 'portal':
          Fx.portal(fxWorld, e.x, e.y, '#ffb05a');
          Fx.portal(fxWorld, e.x2, e.y2, '#5ac8ff');
          G.sfx('laser', { pitch: 1.4, volume: 0.6 });
          break;
        case 'splash':
          Fx.splash(fxWorld, e.x, e.y, false);
          G.sfx('drop', { pitch: 0.6, volume: 0.6 });
          break;
        case 'burn':
          Fx.sizzle(fxWorld, e.x, e.y);
          G.sfx('hurt', { volume: 0.6 });
          break;
        case 'target': {
          Fx.targetHit(fxWorld, e.x, e.y, '#ffb84a');
          G.texts.add(e.x, e.y - 40, run.att.targets.length > 1 ? 'TARGET!' : 'BULLSEYE!', { color: '#ffe066', size: 30, life: 1.3 });
          G.sfx('powerup');
          G.shake.add(0.35);
          G.flash.fire('#ffffff', 0.25, 4);
          G.timeScale.slow(0.3, 0.35);
          break;
        }
        case 'star':
          Fx.starPickup(fxWorld, e.x, e.y);
          G.texts.add(e.x, e.y - 26, '+STAR', { color: '#ffd84a', size: 20 });
          G.sfx('coin', { pitch: 1 + 0.12 * run.att.stars.filter(s => s.got).length });
          ++G.save.stats.starsTaken;
          break;
        case 'lost':
          if (e.body.tag === 'ball')
            Fx.poof(fxWorld, Math.max(10, Math.min(1270, e.x)), Math.max(10, Math.min(630, e.y)));
          break;
        case 'sleep':
          break;
      }
    }
    /* near misses: a ball streaking close past an unlit target slows time a moment */
    const shot = run.att.shot;
    if (!shot)
      return;
    for (const b of shot.balls) {
      if (!b.alive)
        continue;
      run.att.targets.forEach((t, i) => {
        if (t.lit || run.nearMiss[i])
          return;
        const dx = t.x - b.x, dy = t.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80 && d > 40 && dx * b.vx + dy * b.vy > 0) {
          run.nearMiss[i] = true;
          G.timeScale.slow(0.35, 0.3);
        }
      });
    }
  }

  function winBurst() {
    const run = G.run;
    const t = run.att.targets[run.att.targets.length - 1];
    Fx.confetti(G.fxWorld, t.x, t.y - 20, 50);
    for (let k = 0; k < 3; ++k)
      Fx.firework(G.fxView, 260 + k * 380, 520, null);
  }

  NS.events = { handleEvents: handleEvents, winBurst: winBurst };
})();
