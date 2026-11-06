/* G, the one shared mutable state object: the current screen and its return targets, the
   profile (permanent progress), the classic run, an optional Bake-Off run, the derived stats
   cache with its dirty flag, the season and day context, UI bookkeeping (store tab and
   scroll, buy amount, tree and collection selection, toasts, hover), the pointer and
   keyboard input, the per-frame hit areas, the running cinematic and screen-shake. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const E = NS.economy;

  const G = NS.state = NS.state || {};
  Object.assign(G, {
    screen: 'title', time: 0, frame: 0,
    profile: E.newProfile(),
    run: null, bake: null,
    st: null, dirty: true,
    season: 'winter', today: '', modifier: null,
    ui: {
      storeTab: 'buildings', buyIndex: 0, storeScroll: 0, sceneScroll: 0, upgScroll: 0,
      treePage: 0, treeSel: 'o_heat', treeFlash: 0, treeFlashId: '', treeReturn: 'game',
      collTab: 0, journalTab: 0, journalScroll: 0, panelReturn: 'game',
      toasts: [], offline: null, confirm: null, hover: null, displayCookies: 0, cpsShown: 0,
      lastBuy: '', lastBuyT: 0, pulse: 0, zenStage: 0, zenSkin: 'classic', zenT: 0, bakeResult: null,
    },
    input: { mx: -1, my: -1, moved: 0, down: false, touch: false, dragging: false, dragY: 0, dragStart: 0, dragArea: '' },
    hitAreas: [], menuCursor: -1,
    cine: null, shake: 0, flash: 0, flashColor: '#fff', treatSquash: 0, treatSquashV: 0,
    goldens: [], storm: null, autoSaveT: 0, checkT: 0, pendingCine: null,
  });

  /* the run the player is in: a Bake-Off while one is going, else the classic bakery */
  NS.state.active = function() {
    return G.bake || G.run;
  };
})();
