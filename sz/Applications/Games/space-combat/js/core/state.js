/* The one shared game state object, SZ.SpaceCombat.state (G in every module): screen and menu
   cursor, the run and stage, world entity lists, player, camera, feel timers, score and combo,
   input and per-screen UI state. Systems mutate it; render and UI read it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  NS.state = {
    /* screens: title, map, briefing, hangar, tree, help, playing, paused, results */
    screen: 'title',
    screenT: 0,
    treeReturn: 'title',
    helpReturn: 'title',
    hangarReturn: 'title',
    fade: 0,
    time: 0,

    save: null,
    stats: null,

    /* run: mode and the stage being flown */
    mode: 'campaign',
    run: null,
    mission: null,
    stage: null,
    sector: 0,

    /* world */
    world: { w: 3400, h: 3400 },
    enemies: [],
    pBullets: [],
    eBullets: [],
    pickups: [],
    allies: [],
    drones: [],
    rocks: [],
    mines: [],
    nebulae: [],
    holes: [],
    flare: null,
    boss: null,
    beams: [],
    arcs: [],
    rails: [],
    telegraphs: [],
    zones: [],
    player: null,

    /* effects: additive and alpha-blended particles, shockwave rings, floating texts */
    fxAdd: [],
    fxNormal: [],
    rings: [],
    texts: [],

    /* camera in world coordinates (centre of the view) */
    cam: { x: 0, y: 0, tx: 0, ty: 0, trauma: 0, ox: 0, oy: 0, zoom: 1 },

    /* feel */
    hitStop: 0,
    slowMo: 0,
    slowScale: 1,
    warp: 0,
    flash: 0,
    flashColor: '#ffffff',
    vignette: 0,
    banner: null,

    /* scoring */
    score: 0,
    combo: 0,
    comboT: 0,
    multiplier: 1,
    bestCombo: 0,
    kills: 0,
    runScrap: 0,

    /* input: keys by code, pointer in view coordinates */
    input: {
      keys: {},
      mouseX: 640, mouseY: 360, mouseDown: false, rightDown: false, mouseMoved: 0,
      aimMode: 'mouse', touch: false,
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: false, aiming: false,
    },
    hitAreas: [],
    menuCursor: 0,

    /* per-screen UI state */
    ui: {
      mapSector: 0,
      briefing: null,
      hangarTab: 'ships',
      hangarSel: 0,
      treeSel: 'w_dmg',
      treeFlash: 0,
      helpPage: 0,
      results: null,
      toast: null,
    },

    nextId: 1,
  };

})();
