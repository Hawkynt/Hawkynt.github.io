/* G, the one shared mutable state object: the screen and where panels return to, the profile, the
   song in play (run) with its chart, engine state and conductor, the demo behind the title, the
   date context (day, festival, Daily and Weekly recipes), UI bookkeeping (selections, scroll,
   toasts, hover, confirmation, crate reveal), the input, the per-frame hit areas, the cinematic and
   the screen juice (shake, flash, beat pulse). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const G = NS.state = NS.state || {};
  Object.assign(G, {
    screen: 'title', back: 'title', time: 0, frame: 0,
    profile: NS.progress.newProfile(),
    run: null, demo: null, result: null,
    today: '', season: null, daily: null, weekly: null,
    ui: { world: 0, stage: 0, treeSel: 'win', wardTab: 0, journalTab: 0, shopTab: 0, scroll: 0, toasts: [], hover: null, confirm: null,
      mode: 'story', lib: 0, diff: 'normal', boosters: [], mutators: [], pick: null, crate: null, calib: null, callout: null, libFilter: 0 },
    input: { mx: -1, my: -1, moved: 0, touch: false, lanes: [false, false, false, false], laneFlash: [0, 0, 0, 0], pointers: {} },
    hitAreas: [], menuCursor: -1,
    cine: null, shake: 0, flash: 0, flashColor: '#fff', pulse: 0, autoSaveT: 0, checkT: 0,
  });
})();
