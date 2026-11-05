/* G, the one shared mutable state object: the clock, the active screen and its transition, the
   persistent save (filled by save.js), the derived perks, the running cave (run, built by
   run.js), the playing cinematic, the input bookkeeping, the sim-to-effects event queue, the
   menu hit areas and the per-screen UI selections. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  NS.state = NS.state || {
    time: 0,
    screen: 'title',
    returnTo: 'title',
    fade: 0,                /* screen transition curtain, 1 = just switched */
    save: null,
    perks: null,
    season: null,           /* the current season record (or null) */
    today: '',
    run: null,
    cine: null,
    dialogue: null,
    results: null,
    events: [],
    hitAreas: [],
    menuCursor: 0,
    toast: { text: '', color: '#fff', t: 0 },
    input: {
      keys: {},
      held: [],             /* direction stack, most recent last */
      grab: false,
      bombQ: false,
      pointer: { x: 0, y: 0, down: false, id: -1 },
      touch: false,
      swipeDir: -1,
      lastInput: 0
    },
    ui: {
      mapChapter: 0,
      mapLevel: 0,
      treeSel: 'hardhat',
      wardrobeTab: 0,
      journalTab: 0,
      titleMode: 0,
      scroll: 0
    },
    demo: null,             /* the bot-played title cave */
    perf: { sim: 0, draw: 0, avgSim: 0, avgDraw: 0 }
  };
})();
