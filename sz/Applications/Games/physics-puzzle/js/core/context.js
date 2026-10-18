;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * The game's constants and its one shared context object G. G owns the
   * live game state (screen, run, results, save, stats, pointer, menu cursor,
   * toast, view transform, baked layer) and holds the canvas, the drawing kit,
   * the pure modules and the effect systems. Every other controller module
   * reads and writes G; the menu screens (screens.js) receive G as their
   * context. Functions are attached to G by the modules that own them.
   */

  const Lv = SZ.PhysicsPuzzleLevels;
  const Prog = SZ.PhysicsPuzzleProgress;
  const Fx = SZ.PhysicsPuzzleFx;

  NS.C = Object.freeze({
    VIEW_W: 1280,
    VIEW_H: 720,
    FIELD_H: 640,
    BAR_Y: 640,
    MAX_DT: 0.05,
    MAX_STEPS: 24,
    FAST_RATE: 6,           // fast-forward once a shot can no longer change much
    DEAD_SPEED: 140,        // balls slower than this are only rolling out
    FADE_RATE: 3.2,
    AIM_MAX_DRAG: 220,
    WIN_TIME: 1.7,
    STORAGE_SAVE: 'sz-physics-puzzle-v2',
    DEG: Math.PI / 180,
    WORLDS: Lv.WORLDS,
    SANDBOX_CAP: 30,
    TARGET_COLOR: '#ff4a32'
  });

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.PhysicsPuzzleUI.create(ctx);
  const save = Prog.defaultSave();

  NS.G = {
    /* the canvas, the drawing kit and the pure modules */
    canvas: canvas, ctx: ctx, ui: ui,
    Art: SZ.PhysicsPuzzleArt, Scene: SZ.PhysicsPuzzleScene, Fx: Fx, Lv: Lv, Prog: Prog,
    Ph: SZ.PhysicsPuzzlePhysics, Parts: SZ.PhysicsPuzzleParts, Sim: SZ.PhysicsPuzzleSim,
    SOLUTIONS: SZ.PhysicsPuzzleSolutions || {},
    VIEW_W: NS.C.VIEW_W, VIEW_H: NS.C.VIEW_H,

    /* effect systems: field particles, view-space particles, menu particles */
    fxWorld: Fx.create(420),
    fxView: Fx.create(260),
    fxMenu: Fx.create(160),
    shake: Fx.createShake(),
    timeScale: Fx.createTimeScale(),
    flash: Fx.createFlash(),
    texts: Fx.createTexts(20),

    /* view: a 1280 x 720 logical view, letterboxed, DPR aware */
    viewScale: 1, viewOffX: 0, viewOffY: 0, dpr: 1,
    layer: null,             // the baked static picture of the current level
    layerKey: '',

    /* live state */
    save: save,
    stats: null,
    state: 'title',
    time: 0,
    frameDt: 0,
    fade: 0,
    mouseX: -1, mouseY: -1, mouseDown: false,
    pointerMoved: false,
    menuCursor: 0,
    hitAreas: [],
    run: null,
    results: null,
    toast: null,
    frameMs: 0, frameMsAvg: 0,
    held: new Set(),
    touchSlow: false,

    /* shared functions, attached by their modules */
    visibleRect: null, registerHit: null, isHot: null, drawButton: null, hoverLevel: null, veil: null,
    sfx: null, showToast: null, writeSave: null, refreshStats: null, localDate: null,
    currentSkin: null, dailyLevel: null, drawField: null, drawHUD: null,
    actions: null
  };
  NS.G.stats = Prog.computeStats(save);
})();
