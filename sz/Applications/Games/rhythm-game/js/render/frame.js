/* One frame: the letterboxed plane with screen shake, the district backdrop (with the crowd and lights
   during a song), then the screen - title, modes, map, library, the song (highway, HUD, juice),
   paused, results, tree, shop, collection, journal, settings, help - then a cinematic, the toasts, a
   confirmation, the flash and the vignette (red while the groove runs low). Overlays reset the hit
   areas so only the top layer takes clicks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const W = NS.widgets;
  const { ctx } = NS.view;

  const MENUS = {
    title: () => NS.title.draw(), modes: () => NS.title.drawModes(), map: () => NS.map.draw(), library: () => NS.library.draw(), tree: () => NS.tree.draw(),
    shop: () => NS.shop.draw(), wardrobe: () => NS.wardrobe.draw(), journal: () => NS.journal.draw(), settings: () => NS.settings.draw(), help: () => NS.help.draw(),
  };

  function world() {
    const s = G.screen;
    if (s === 'map') return G.ui.world;
    if (G.run && (s === 'game' || s === 'paused' || s === 'results' || s === 'title')) return G.run.world || 0;
    return { frost: 1, bloom: 1, sunfest: 0, harvest: 2, hollow: 3, starfall: 4 }[G.season ? G.season.id : 'bloom'] || 0;
  }

  function dim(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(4,2,12,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function draw() {
    W.beginFrame();
    NS.view.begin();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    const s = G.screen;
    const r = G.run;
    const inSong = r && (s === 'game' || s === 'paused' || (s === 'title' && r.mode === 'demo'));
    const beat = inSong ? NS.conductor.beatOf(r.cond, r.cond.t).f : (G.time * 104 / 60) % 1;
    NS.backdrop.draw(world(), { play: inSong, beat: beat, surge: inSong && r.eng.surgeOn > r.eng.t });
    let danger = 0;
    if ((s === 'game' || s === 'paused') && r) {
      NS.highway.draw(r);
      NS.hud.draw();
      NS.fxRender.draw();
      if (r.eng.groove < 0.25 && !r.eng.noFail) danger = 0.7 - r.eng.groove * 2;
      if (s === 'paused') { W.beginFrame(); NS.pause.draw(); }
    } else if (s === 'results') {
      dim(0.5);
      NS.results.draw();
      NS.fxRender.draw();
    } else if (MENUS[s]) {
      if (s !== 'title' && s !== 'map') dim(0.55);
      MENUS[s]();
      NS.fxRender.draw();
    }
    if (G.cine) {
      W.beginFrame();
      NS.cineRender.draw();
      NS.fxRender.draw();
    }
    NS.screens.drawToasts();
    if (G.ui.confirm) {
      W.beginFrame();
      NS.screens.drawConfirm();
    }
    NS.fxRender.drawFlash();
    NS.backdrop.drawVignette(danger);
  }

  Object.assign(NS.frame, { MENUS, world, draw });
})();
