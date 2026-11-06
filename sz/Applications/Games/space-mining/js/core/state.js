/* The one shared game state object, SZ.SpaceMining.state (G in every module): screen and menu
   cursor, the save and derived stats, the trip being flown, world entity lists, ship, the
   outpost, units, invaders and the command view, camera, effects and feel timers, the running
   cinematic, input and per-screen UI state.
   Systems mutate it; render and UI read it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { WORLD_W, WORLD_H } = NS.constants;

  NS.state = {
    /* screens: title, station, map, tree, help, playing, paused, results, cine */
    screen: 'title',
    screenT: 0,
    treeReturn: 'title',
    helpReturn: 'title',
    time: 0,

    save: null,
    stats: null,

    /* the trip in flight (null in menus) */
    run: null,

    /* world */
    world: { w: WORLD_W, h: WORLD_H },
    rocks: [],
    nuggets: [],
    pirates: [],
    bolts: [],
    drones: [],
    charges: [],
    radZones: [],
    wells: [],
    storm: null,
    specials: [],
    dock: null,
    ship: null,
    beams: [],

    /* the outpost war: the outpost in this belt, units, invaders, shots, cargo pods, turret and
       repair beams, gas and bio clouds, the distress mission */
    base: null,
    units: [],
    enemies: [],
    shots: [],
    pods: [],
    tbeams: [],
    clouds: [],
    distress: null,

    /* the command view: camera, pause-and-plan, selection, groups, formation, placement */
    cmd: { on: false, x: 0, y: 0, zoom: 0.42, plan: false, sel: [], selB: null, groups: {}, form: 'wedge', place: null, pending: null,
      cat: 'core', box: null, marks: [], msg: null, hover: null, panel: 'build' },

    /* effects: additive and alpha-blended particles, shockwave rings, floating texts */
    fxAdd: [],
    fxNormal: [],
    rings: [],
    texts: [],

    /* camera in world coordinates (centre of the view) */
    cam: { x: 0, y: 0, tx: 0, ty: 0, trauma: 0, ox: 0, oy: 0, zoom: 1, tzoom: 1, focus: null },

    /* feel */
    hitStop: 0,
    slowMo: 0,
    slowScale: 1,
    flash: 0,
    flashColor: '#ffffff',
    banner: null,

    /* the running cinematic: { kind, t, dur, data, onEnd } */
    cine: null,

    /* input: keys by code, pointer in view coordinates */
    input: {
      keys: {},
      mouseX: 640, mouseY: 360, mouseDown: false, rightDown: false, mouseMoved: 0,
      aimMode: 'mouse', touch: false,
      moveX: 0, moveY: 0, aimWX: 0, aimWY: 0, firing: false, boost: false, tractor: false,
    },
    hitAreas: [],
    menuCursor: 0,

    /* per-screen UI state */
    ui: {
      stationTab: 'market',
      shipyardTab: 'upgrades',
      marketSel: 'iron',
      mapSel: 0,
      treeSel: 'd_focus',
      treePage: 0,
      logSel: 0,
      treeFlash: 0,
      treeFlashId: '',
      helpPage: 0,
      results: null,
      toast: null,
      popups: [],
      ticker: 0,
    },
  };
})();
