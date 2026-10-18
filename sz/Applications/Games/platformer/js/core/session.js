/*
 * Game flow: switching screens, toasts, applying tree stats, and starting levels in every mode.
 * Owns G.screen, G.run (creates it), G.stats, G.toast; resets the world effects on a new level.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, ZOOM, INTRO_TIME } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Levels = SZ.PlatformerLevels;
  const Prog = SZ.PlatformerProgress;
  const Ent = SZ.PlatformerEntities;
  const Scene = SZ.PlatformerScene;
  const Tiles = SZ.PlatformerTiles;
  const Storage = NS.module('storage');
  const Camera = NS.module('camera');
  const Controls = NS.module('controls');
  const App = NS.module('app');
  const { sfx } = NS.module('sound');
  const { visibleRect, bakeScale, bakeCtx } = NS.module('view');
  const { localDate } = NS.module('util');
  const fxWorld = G.fxWorld;
  const fxMenu = G.fxMenu;
  const shake = G.shake;
  const hitStop = G.hitStop;
  const flash = G.flash;
  const texts = G.texts;
  const hitAreas = G.hitAreas;
  const held = G.held;
  const pressed = G.pressed;

  /* tree purchases take effect at once, mid-level included */
  function refreshStats() {
    const before = G.stats;
    G.stats = Prog.computeStats(G.save);
    if (G.run && G.run.player) {
      if (G.stats.maxHearts > G.run.maxHearts)
        G.run.hearts += G.stats.maxHearts - G.run.maxHearts;
      G.run.maxHearts = G.stats.maxHearts;
      G.run.hearts = Math.min(G.run.hearts, G.run.maxHearts);
      if (G.stats.fire > 0)
        G.run.fire = true;
      if (G.stats.shield && !before.shield)
        G.run.shield = true;
    }
  }

  function currentSkin() {
    return Prog.SKINS.find(s => s.id === G.save.skin) || Prog.SKINS[0];
  }

  function setScreen(name) {
    G.screen = name;
    G.menuCursor = 0;
    G.fade = 1;
    hitAreas.length = 0;
    fxMenu.clear();
    Controls.syncTouch();
  }

  function showToast(text, color) {
    G.toast = { text: text, color: color || '#ffd75a', t: 0 };
  }

  const DYNAMIC = { [T.QBLOCK]: true, [T.USED]: true, [T.CRATE]: true, [T.CRUMBLE]: true, [T.SPRING]: true };

  /* mode: 'adventure' | 'trial' | 'endless' | 'daily' */
  function startLevel(mode, spec, carry) {
    const level = Levels.build(spec);
    const world = level.world;
    const rec = G.save.levels[spec.id];
    const r = {
      mode: mode, spec: spec, level: level, world: world,
      tiles: Tiles.create(level, { scale: bakeScale() }),
      scene: Scene.create(world),
      platforms: Ent.createPlatforms(level),
      enemies: level.enemies.map(e => Ent.createEnemy(e.type, e.c, e.r, world)),
      shots: [], coins: [], gems: [], items: [], checkpoints: [], dyn: [], springs: {}, crumbles: new Map(), bumps: {},
      goal: { x: level.goal.c * TS + TS / 2, y: (level.goal.r + 1) * TS },
      boss: level.boss ? Ent.createBoss(level.boss, level) : null, bossDone: false, gateClosed: false,
      t: 0, simT: 0, acc: 0, introT: INTRO_TIME, clearT: 0,
      hearts: carry ? carry.hearts : G.stats.maxHearts, maxHearts: G.stats.maxHearts,
      inv: 0, shield: G.stats.shield, fire: G.stats.fire > 0, star: 0, fireCd: 0,
      coinsRun: carry ? carry.coins : 0, gemsRun: [false, false, false], gemBank: carry ? carry.gemBank : 0,
      stage: carry ? carry.stage : 0, deaths: 0, stomps: 0, combo: 0, comboT: 0,
      koT: 0, fallT: 0, safeT: 0, landT: 0, squash: 0, stretch: 0, runFrame: 0, idleT: 0, trailT: 0, afterT: 0,
      cam: { x: 0, y: 0, look: 0 }, zoom: ZOOM,
      ghostRec: [], ghostT: 0, ghost: null, ghostPos: {},
      radarT: 0, prevBottom: 0, fakeAlpha: 1, clock: 0
    };
    r.player = Ph.createPlayer(level.start.c * TS + (TS - Ph.P.w) / 2, (level.start.r + 1) * TS - Ph.P.h);
    r.respawn = { x: r.player.x, y: r.player.y };
    r.safe = { x: r.player.x, y: r.player.y };
    for (const c of level.coins)
      r.coins.push({ x: c.c * TS + TS / 2, y: c.r * TS + TS / 2, taken: false, vx: 0, vy: 0, pull: false, pop: 0, t: Math.random() * 3 });
    level.gems.forEach((g, i) => {
      r.gems.push({ x: g.c * TS + TS / 2, y: g.r * TS + TS / 2, i: i, taken: false, old: !!(rec && rec.gems && rec.gems[i]) });
    });
    for (const cp of level.checkpoints)
      r.checkpoints.push({ x: cp.c * TS + TS / 2, y: (cp.r + 1) * TS, on: false, t: 0 });
    for (let i = 0; i < level.tiles.length; ++i)
      if (DYNAMIC[level.tiles[i]])
        r.dyn.push(i);
    if (mode === 'trial' && rec && rec.ghost)
      r.ghost = Prog.decodeGhost(rec.ghost);
    G.run = r;
    const vz = visibleRect();
    r.zoom = Math.max(ZOOM, (vz.y1 - vz.y0) / (level.rows * TS - 96));
    Camera.snapCamera();
    shake.reset();
    hitStop.reset();
    flash.reset();
    fxWorld.clear();
    texts.clear();
    held.clear();
    pressed.clear();
    G.results = null;
    /* bake what the camera sees now so the first frames never stall */
    const v = visibleRect();
    r.tiles.draw(bakeCtx(), { x0: r.cam.x + v.x0 / ZOOM, y0: 0, x1: r.cam.x + v.x1 / ZOOM, y1: level.rows * TS });
    setScreen('play');
    G.fade = 1;
    App.updateWindowTitle();
    sfx('select');
  }

  function startCampaign(world, index, mode) {
    G.mapWorld = world;
    G.mapLevel = index;
    startLevel(mode || 'adventure', Levels.CAMPAIGN[world][index], null);
  }

  function startEndless(carry) {
    const seed = carry ? carry.seed : (Date.now() % 100000);
    const stage = carry ? carry.stage : 0;
    const spec = Levels.endlessSpec(seed, stage);
    startLevel('endless', spec, carry ? carry : { hearts: G.stats.maxHearts, coins: 0, stage: 0, gemBank: 0 });
    G.run.seed = seed;
  }

  function startDaily() {
    const date = localDate();
    if (G.save.daily.date !== date) {
      G.save.daily = { date: date, bestTime: 0, cleared: false, rewarded: false };
      Storage.writeSave();
    }
    startLevel('daily', Levels.dailySpec(date), null);
  }

  function restartLevel() {
    if (!G.run)
      return;
    if (G.run.mode === 'endless')
      startEndless(null);
    else
      startLevel(G.run.mode, G.run.spec, null);
  }

  Object.assign(NS.module('session'), {
    refreshStats,
    currentSkin,
    setScreen,
    showToast,
    startCampaign,
    startEndless,
    startDaily,
    restartLevel
  });
})();
