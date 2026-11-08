/* G, the one shared mutable state object: the screen and where panels return to, the profile,
   the running game (run) with its engine state, the demo game behind the title, the date context
   (day, festival, daily recipe), UI bookkeeping (selection, scroll, toasts, hover), the input,
   the per-frame hit areas, the cinematic and the screen juice. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  const G = NS.state = NS.state || {};
  Object.assign(G, {
    screen: 'title', back: 'title', time: 0, frame: 0,
    profile: NS.progress.newProfile(),
    run: null, demo: null, result: null,
    today: '', season: null, daily: null, weekly: null,
    ui: { world: 0, stage: 0, treeSel: 'width', wardTab: 0, journalTab: 0, scroll: 0, toasts: [], hover: null, confirm: null, mode: 'story', callout: null },
    input: { mx: -1, my: -1, moved: 0, touch: false, px: null, left: false, right: false, launch: false, fire: false, active: false },
    hitAreas: [], menuCursor: -1,
    cine: null, shake: 0, flash: 0, flashColor: '#fff', hitStop: 0, autoSaveT: 0, checkT: 0,
  });
})();
