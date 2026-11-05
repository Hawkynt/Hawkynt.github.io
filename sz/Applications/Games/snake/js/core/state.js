/* The one shared game state object, SZ.Snake.state (G in every module): the screen and where
   sub-screens return to, the profile save and the stats the tech tree adds up to, the run being
   played (plain data, so it can be autosaved and restored whole) and its seeded generator, the
   calendar context, feel timers, input, menu hit areas and per-screen UI state. Systems mutate
   it; render and UI read it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  NS.state = {
    /* screens: title, modes, map, playing, paused, results, tree, wardrobe, journal, help, cine */
    screen: 'title',
    screenT: 0,
    time: 0,
    back: { tree: 'title', wardrobe: 'title', journal: 'title', help: 'title' },

    save: null,
    stats: null,

    /* the run: all plain data (see run.js); null on the menus */
    run: null,
    rng: null,
    /* the snake body before the last step, for smooth movement between steps */
    prevBody: [],
    prevEnemy: [],

    /* calendar: today's key, the running festival and its event id, this week's mutator */
    today: '',
    season: null,
    eventId: '',
    weekly: null,

    /* feel */
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    flashColor: '#ffffff',
    hitstop: 0,
    slowmo: 0,
    zoom: 0,

    /* the active cinematic: { id, shots, i, t, typed, then } */
    cine: null,

    input: {
      keys: {}, mouseX: 0, mouseY: 0, mouseMoved: 0, touch: false, touchSeen: false,
      spitQ: false,
    },

    hitAreas: [],
    menuCursor: 0,

    ui: {
      toast: null,
      toasts: [],
      treeSel: 'hide',
      treeFlash: 0,
      treeFlashId: '',
      wardrobeTab: 'skin',
      wardrobeSel: 'garden',
      journalTab: 'goals',
      mapWorld: 0,
      mapSel: 0,
      modeSel: 'story',
      results: null,
      helpPage: 0,
      pauseConfirm: false,
    },

    perf: { sim: 0, draw: 0, simAvg: 0, drawAvg: 0, frames: 0 },
  };
})();
