;(function() {
  'use strict';

  // HUD fading: panels turn see-through while something is behind them; clicks pass through to monsters.
  // Owns: NS.hudFading and these state fields:
  //   G.hudFrame, G.frameDt
  // Reads: constants, dom
  // Reads state of: gameState, waves, weapon, bombs, drones

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { VIEW_SURFACE, VIEW_UNDERGROUND, STATE_PLAYING, TILE_SIZE } = NS.constants;
  const { ctx } = NS.dom;

  /* ======================================================================
     HUD FADING -- panels turn see-through while the keeper, a monster, a
     shot or a drone is behind them; a click on a monster under a faded
     panel goes to the monster
     ====================================================================== */

  const HUD_FADED = 0.3;             // opacity of a panel with something behind it
  const hudFade = {};                // panel id -> { a, rect, frame }
  G.hudFrame = 0; G.frameDt = 1 / 60;
  let hudActorCache = null, hudActorFrame = -1;

  // Screen rectangles of everything that must stay visible
  function hudActors() {
    if (hudActorFrame === G.hudFrame && hudActorCache) return hudActorCache;
    const out = [];
    const add = (x, y, w, h) => out.push({ x, y, w, h });
    if (G.currentView === VIEW_SURFACE) {
      for (const e of G.enemies) {
        if (e.hidden) continue;
        const s = e.size || 16;
        add(e.x - s * 1.5, e.y - s * (e.boss ? 1.9 : 1.4) - 22, s * 3, s * (e.boss ? 2.9 : 2.4) + 22);
      }
      for (const sh of G.enemyShots) {
        const x = sh.x0 + (sh.tx - sh.x0) * sh.t, y = sh.y0 + (sh.ty - sh.y0) * sh.t - (sh.kind === 'lance' ? 0 : Math.sin(sh.t * Math.PI) * 150);
        add(x - 14, y - 14, 28, 28);
      }
      for (const g of G.gunDrones) add(g.x - 22, g.y - 22, 44, 44);
      for (const r of G.repairBots) add(r.x - 22, r.y - 22, 44, 44);
      for (const b of G.surfaceBombs) {
        const x = b.x0 + (b.tx - b.x0) * b.t, y = b.y0 + (b.ty - b.y0) * b.t - Math.sin(b.t * Math.PI) * (90 + Math.abs(b.tx - b.x0) * 0.25);
        add(x - 18, y - 18, 36, 36);
      }
      for (const r of G.reflected) add(r.x0 + (r.tx - r.x0) * r.t - 12, r.y0 + (r.ty - r.y0) * r.t - 52, 24, 64);
    } else if (G.currentView === VIEW_UNDERGROUND) {
      add(G.drillX * TILE_SIZE - G.cameraX - 8, G.drillY * TILE_SIZE - G.cameraY - 22, TILE_SIZE + 16, TILE_SIZE + 30);
      for (const d of G.drones)
        if (d.state !== 'dock') add(d.x - G.cameraX - 20, d.y - G.cameraY - 20, 40, 44);
      for (const b of G.placedBombs) add(b.c * TILE_SIZE - G.cameraX - 6, b.r * TILE_SIZE - G.cameraY - 34, TILE_SIZE + 12, TILE_SIZE + 40);
    }
    hudActorCache = out;
    hudActorFrame = G.hudFrame;
    return out;
  }

  function overlapsActor(x, y, w, h) {
    for (const a of hudActors())
      if (a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y)
        return true;
    return false;
  }

  // Opacity of a HUD panel this frame, easing towards faded or solid
  function hudAlpha(id, x, y, w, h) {
    const f = hudFade[id] || (hudFade[id] = { a: 1 });
    const live = G.state === STATE_PLAYING;
    const target = live && overlapsActor(x, y, w, h) ? HUD_FADED : 1;
    f.a += (target - f.a) * (1 - Math.exp(-G.frameDt * 9));
    f.rect = { x, y, w, h };
    f.frame = G.hudFrame;
    return f.a;
  }

  function beginHudPanel(id, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha *= hudAlpha(id, x, y, w, h);
  }

  function endHudPanel() {
    ctx.restore();
  }

  // A click on a monster (or the keeper) seen through a faded panel goes to the world
  function hudPassThrough(mx, my) {
    for (const id in hudFade) {
      const f = hudFade[id];
      if (f.frame < G.hudFrame - 2 || f.a > 0.6 || !f.rect) continue;
      const r = f.rect;
      if (mx < r.x || mx > r.x + r.w || my < r.y || my > r.y + r.h) continue;
      for (const a of hudActors())
        if (mx >= a.x - 10 && mx <= a.x + a.w + 10 && my >= a.y - 10 && my <= a.y + a.h + 10)
          return true;
    }
    return false;
  }

  NS.hudFading = { beginHudPanel, endHudPanel, hudPassThrough };
})();
