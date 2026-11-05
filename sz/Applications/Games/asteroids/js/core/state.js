/* The one shared game state object, SZ.Asteroids.state (G in every module): screen and return
   targets, the save and derived stats, the calendar context, the run, every world entity list,
   the ship, feel timers, scoring, input and per-screen UI state. Systems mutate it; render and
   UI read it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  NS.state = {
    /* screens: title, map, story, cine, playing, paused, results, tree, wardrobe, goals, help */
    screen: 'title',
    screenT: 0,
    returns: { tree: 'title', wardrobe: 'title', goals: 'title', help: 'title' },
    time: 0,
    fade: 0,

    save: null,
    stats: null,

    /* calendar: season id and key, today's daily spec, this week's featured chapter */
    cal: null,

    /* the run: mode, chapter/level or wave, lives, objective progress, timers; null when idle */
    run: null,
    level: null,

    /* world */
    ship: null,
    rocks: [],
    bullets: [],
    eBullets: [],
    enemies: [],
    boss: null,
    pickups: [],
    motes: [],
    pods: [],
    zones: [],
    mines: [],
    holes: [],
    strikes: [],
    drones: [],
    beams: [],
    arcs: [],

    /* effects */
    fxAdd: [],
    fxNormal: [],
    rings: [],
    texts: [],
    decor: [],

    /* feel */
    cam: { trauma: 0, ox: 0, oy: 0, zoom: 1, punch: 0 },
    hitStop: 0,
    slowMo: 0,
    slowScale: 1,
    flash: 0,
    flashColor: '#ffffff',
    banner: null,

    /* scoring */
    score: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    overdrive: 0,

    /* input: keys by code, pointer in plane coordinates */
    input: {
      keys: {},
      mouseX: 640, mouseY: 360, mouseDown: false, rightDown: false, mouseMoved: 0, aimMouse: false, touch: false,
      turn: 0, thrust: false, brake: false, fire: false, aimAngle: null, hyperQ: false, overQ: false,
    },
    hitAreas: [],
    menuCursor: 0,

    /* the cinematic and the dialogue being shown */
    cine: null,
    story: null,

    ui: {
      mapChapter: 0,
      mapLevel: 0,
      treeSel: 'c_dmg',
      treeFlash: 0,
      wardrobeTab: 'skin',
      wardrobeSel: 0,
      goalsTab: 'quests',
      helpPage: 0,
      results: null,
      toast: null,
      toasts: [],
      modeSel: 0,
    },

    nextId: 1,
  };
})();
