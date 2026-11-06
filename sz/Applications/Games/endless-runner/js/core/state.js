/* G, the one shared mutable state object: the active screen and its return targets, the clock,
   the saved profile and the stats derived from it, today's festival, weekly mutator and Daily Run
   recipe, the open run (course, runner, score, powers, guardian - everything a save restores),
   the open cinematic, the camera, input, the feel controls (shake, flash, hit-stop, slow motion),
   toasts, menu hit areas and the frame-time measurements. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  const G = NS.state;
  Object.assign(G, {
    screen: 'title',
    screenT: 0,
    time: 0,
    back: {},
    ui: { mapWorld: 0, mapStage: 0, treeSel: 'magnetCoil', wardrobeTab: 'char', journalTab: 'goals', helpPage: 0,
      pauseConfirm: false, modeSel: 0, scroll: 0 },
    hitAreas: [],
    menuCursor: 0,

    save: null,
    stats: null,
    season: null,
    eventId: '',
    weekly: null,
    daily: null,

    run: null,
    cine: null,
    demo: null,
    cam: { x: 0, y: 0, zoom: 1, lookY: 0 },

    input: { keys: {}, mouseX: 0, mouseY: 0, mouseMoved: 0, touch: false, downHeld: false, jumpHeld: false,
      queue: [], swipe: null },

    shake: 0,
    flash: { color: '#ffffff', a: 0 },
    hitstop: 0,
    slowmo: 0,
    toasts: [],
    perf: { sim: 0, simAvg: 0, draw: 0, drawAvg: 0, frames: 0 },
  });
})();
