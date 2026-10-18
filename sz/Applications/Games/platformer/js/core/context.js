/*
 * The shared game state (NS.state, called G everywhere): the canvas and drawing kit, the particle
 * pools, the input sets and every value the screens and systems hand to each other. Fields are
 * created here once, so all modules see the same long-lived objects; the comment on each group
 * names the module that owns (writes) it.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Prog = SZ.PlatformerProgress;
  const Fx = SZ.PlatformerFx;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const G = NS.state = {
    /* drawing */
    canvas: canvas,
    ctx: ctx,
    ui: SZ.PlatformerUI.create(ctx),

    /* particle systems: world space, view space and the menu backdrop; feedback effects */
    fxWorld: Fx.create(500),
    fxView: Fx.create(300),
    fxMenu: Fx.create(200),
    shake: Fx.createShake(),
    hitStop: Fx.createHitStop(),
    flash: Fx.createFlash(),
    texts: Fx.createTexts(24),
    viewTexts: Fx.createTexts(12),

    /* view mapping (core/view.js) */
    viewScale: 1, viewOffX: 0, viewOffY: 0, dpr: 1,

    /* persistence (core/storage.js) */
    save: Prog.defaultSave(),
    highScores: [],

    /* play input: held actions and fresh presses (ui/controls.js), read per step (core/input.js) */
    held: new Set(),
    pressed: new Set(),
    inp: { left: false, right: false, down: false, jump: false, jumpPressed: false, dashPressed: false },
    firePressed: false,

    /* screens: title, map, tree, wardrobe, help, play, pause, results (core/session.js) */
    screen: 'title',
    time: 0,                 // seconds since start, drives every animation (app.js)
    frameDt: 0,              // this frame's clamped delta (app.js)
    fade: 0,
    toast: null,
    stats: null,
    run: null,               // the level being played
    results: null,           // the results panel (play/finish.js)
    game: null,              // the world as the entity logic sees it (play/events.js)

    /* menus: pointer, keyboard cursor and this frame's hit areas (ui/menu-kit.js, ui/controls.js) */
    mouseX: -1, mouseY: -1,
    pointerMoved: false,
    menuCursor: 0,
    hitAreas: [],

    /* screen-specific state (ui/map.js, ui/tree.js, ui/wardrobe.js, ui/help.js) */
    mapWorld: 0, mapLevel: 0, mapMode: 'adventure',
    treeBranch: 0, treeSelected: null, treeFrom: 'title', treeFlash: null,
    wardrobeFrom: 'title',
    helpPage: 0, helpFrom: 'title',

    /* touch controls (ui/controls.js, app.js) */
    touch: null,
    touchUsed: false
  };
  G.stats = Prog.computeStats(G.save);
})();
