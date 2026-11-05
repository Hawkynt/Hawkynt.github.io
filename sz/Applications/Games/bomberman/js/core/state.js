/* The one shared state object, SZ.Bomberman.state (G in every module): the screen and its
   return targets, the save and derived perks, the season, the run (a plain JSON-safe object so
   autosave can store it whole), the effect pools, feel timers, input, hit areas and per-screen
   UI state. Systems mutate it; render and UI read it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  NS.state = {
    /* screens: title, modes, map, cine, playing, paused, results, tree, wardrobe, goals, stats, help */
    screen: 'title',
    screenT: 0,
    back: { tree: 'title', wardrobe: 'title', goals: 'title', stats: 'title', help: 'title' },
    time: 0,
    fade: 0,

    save: null,
    perks: null,
    season: null,
    daily: null,
    weekly: null,
    hasContinue: false,
    continueInfo: null,

    /* the run in progress (see systems/run.js for its shape); null outside a run */
    run: null,
    /* cached per-level helpers rebuilt from run.level (never saved) */
    lvl: { bombAt: null, enemyAt: null, teleTo: null, dirty: true },

    /* effects: pooled particles, rings, floating texts, debris */
    fx: { parts: [], rings: [], texts: [], live: 0 },
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    hitStop: 0,
    flash: 0,
    flashColor: '#ffffff',
    banner: null,
    slowMo: 0,

    /* input */
    input: {
      keys: {}, mouseX: 640, mouseY: 360, mouseMoved: 0, touch: false,
      moveX: 0, moveY: 0, bombQ: false, detonateQ: false, megaQ: false, dashQ: false,
      path: null, pathT: 0
    },
    hitAreas: [],
    menuCursor: 0,

    ui: {
      toast: null,
      toasts: [],
      mapWorld: 0,
      mapSel: 0,
      treeSel: 'a_bombs',
      treeFlash: 0,
      treeFlashId: '',
      wardTab: 'skin',
      wardSel: 0,
      goalsTab: 'quests',
      helpPage: 0,
      results: null,
      modeSel: 0,
      confirmQuit: false
    },

    /* the cinematic being played: { id, shot, t, chars, then } */
    cine: null,

    perf: { sim: 0, draw: 0, simAvg: 0, drawAvg: 0, frames: 0 }
  };
})();
