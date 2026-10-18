/* Sector backdrops: one cached painting per theme, the current one and which theme a level uses.
   Owns the backdrop cache; reads G.gameMode, G.level, G.wave, G.gameTime. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { THEME_ORDER } = NS.constants;
  const { ctx, visibleRect } = NS.view;

  let backdrop = null;
  let backdropTheme = '';
  const backdropCache = {};

  function setBackdrop(theme) {
    if (theme === backdropTheme && backdrop) return;
    if (!backdropCache[theme])
      backdropCache[theme] = SZ.InvaderBackdrop.create(theme);
    backdrop = backdropCache[theme];
    backdropTheme = theme;
  }

  /* Sector backdrop, out to the edges of the canvas */
  function drawBackdrop() {
    if (backdrop)
      backdrop.draw(ctx, G.gameTime / 1000, visibleRect());
  }

  function levelTheme() {
    if (G.gameMode === 'survival')
      return THEME_ORDER[Math.floor((G.wave - 1) / 5) % THEME_ORDER.length];
    return THEME_ORDER[(G.level - 1) % THEME_ORDER.length];
  }

  function getBackdrop(theme) {
    if (!backdropCache[theme])
      backdropCache[theme] = SZ.InvaderBackdrop.create(theme);
    return backdropCache[theme];
  }

  Object.assign(NS.backdrop, {
    setBackdrop, drawBackdrop, levelTheme, getBackdrop
  });
})();
