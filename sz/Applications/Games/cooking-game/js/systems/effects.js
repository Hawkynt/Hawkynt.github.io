;(function() {
  'use strict';

  /* Bookkeeping of the short-lived juice: dish arcs to the pass, step pops,
     rings, HUD bumps, the bin wobble, station presses, flashes, banners and
     the VIP carpet. Owns those G lists and timers. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_PLAYING, ARC_TIME, RING_MAX } = NS.C;
  const { sfx } = NS.juice;

  /* Shared bookkeeping for the short-lived effect lists. */
  function updateFx(dt) {
    for (let i = G.arcs.length - 1; i >= 0; --i) {
      const a = G.arcs[i];
      a.t += dt;
      if (a.t >= ARC_TIME) {
        G.arcs.splice(i, 1);
        for (const d of G.pass)
          if (d.ticket === a.ticket) { d.bounce = 0.3; break; }
        /* the dish settling on the pass */
        sfx('bounce', { pitch: 1.4, volume: 0.3 });
      }
    }
    for (const d of G.pass)
      if (d.bounce > 0) d.bounce -= dt;
    for (let i = G.pops.length - 1; i >= 0; --i) {
      G.pops[i].t += dt;
      if (G.pops[i].t > 0.7) G.pops.splice(i, 1);
    }
    if (G.hudBump > 0) G.hudBump = Math.max(0, G.hudBump - dt);
    if (G.trashWobble > 0) G.trashWobble = Math.max(0, G.trashWobble - dt);
    for (let i = 0; i < G.stationPress.length; ++i)
      if (G.stationPress[i] > 0) G.stationPress[i] = Math.max(0, G.stationPress[i] - dt);
    if (G.hitFlash) {
      G.hitFlash.t -= dt;
      if (G.hitFlash.t <= 0) G.hitFlash = null;
    }
    for (let i = G.rings.length - 1; i >= 0; --i) {
      G.rings[i].t += dt;
      if (G.rings[i].t > 0.5) G.rings.splice(i, 1);
    }
    if (G.meterTick > 0) G.meterTick = Math.max(0, G.meterTick - dt);
    if (G.dayIntro > 0 && G.state === STATE_PLAYING) G.dayIntro = Math.max(0, G.dayIntro - dt);
    if (G.edgeGlow > 0) G.edgeGlow = Math.max(0, G.edgeGlow - dt);
    if (G.comboBanner) {
      G.comboBanner.t += dt;
      if (G.comboBanner.t > 1.5) G.comboBanner = null;
    }
    if (G.carpet) {
      G.carpet.t -= dt;
      if (G.carpet.t <= 0) G.carpet = null;
    }
  }

  function pushRing(x, y, r, color) {
    if (G.rings.length >= RING_MAX) G.rings.shift();
    G.rings.push({ x: x, y: y, r: r, t: 0, color: color });
  }

  function pushPop(x, y, text, color, size) {
    if (G.pops.length >= 16) G.pops.shift();
    G.pops.push({ x: x, y: y, text: text, color: color, size: size, t: 0 });
  }

  NS.effects = { pushRing, pushPop, updateFx };

})();
