;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     MODULES & CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const Ph = SZ.PlatformerPhysics;
  const Levels = SZ.PlatformerLevels;
  const Prog = SZ.PlatformerProgress;
  const Ent = SZ.PlatformerEntities;
  const Spr = SZ.PlatformerSprites;
  const Scene = SZ.PlatformerScene;
  const Tiles = SZ.PlatformerTiles;
  const Fx = SZ.PlatformerFx;

  const TS = Ph.TS;
  const T = Ph.T;
  const STEP = Ph.STEP;
  const VIEW_W = 1280;
  const VIEW_H = 720;
  const ZOOM = 1.2;              // world pixels are drawn this much larger than view pixels
  const MAX_DT = 0.05;
  const MAX_STEPS = 8;
  const FADE_RATE = 3.2;
  const COYOTE_SAFE = 0.25;      // seconds on solid ground before it counts as a safe respawn spot
  const RESPAWN_TIME = 0.7;
  const KO_TIME = 1.6;
  const STAR_TIME = 9;
  const INTRO_TIME = 1.9;
  const FIRE_SPEED = 600;
  const STORAGE_SAVE = 'sz-platformer-v2';
  const STORAGE_HIGHSCORES = 'sz-platformer-highscores';
  const MAX_HIGH_SCORES = 5;
  const GEM_COLORS = ['#ff4a6a', '#4aff8a', '#4ac8ff'];
  const WORLDS = Levels.WORLDS;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.PlatformerUI.create(ctx);
  const { User32 } = SZ?.Dlls ?? {};
  const statusScore = document.getElementById('statusScore');
  const statusLevel = document.getElementById('statusLevel');
  const statusLives = document.getElementById('statusLives');
  const statusState = document.getElementById('statusState');

  /* particle systems: world space and view space */
  const fxWorld = Fx.create(500);
  const fxView = Fx.create(300);
  const fxMenu = Fx.create(200);
  const shake = Fx.createShake();
  const hitStop = Fx.createHitStop();
  const flash = Fx.createFlash();
  const texts = Fx.createTexts(24);
  const viewTexts = Fx.createTexts(12);

  /* ══════════════════════════════════════════════════════════════════
     CANVAS: a 1280 x 720 logical view, letterboxed, DPR aware
     ══════════════════════════════════════════════════════════════════ */

  let viewScale = 1, viewOffX = 0, viewOffY = 0, dpr = 1;

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewOffX = Math.round((canvas.width - VIEW_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - VIEW_H * viewScale) / 2);
    if (run && run.tiles)
      run.tiles.setScale(bakeScale());
  }

  function bakeScale() {
    return Math.max(0.75, Math.min(1.5, viewScale * ZOOM));
  }

  /* the visible rect in world units relative to the camera */
  function zoomNow() {
    return run ? run.zoom : ZOOM;
  }

  function zoomRect(v) {
    const z = zoomNow();
    return { x0: v.x0 / z, y0: v.y0 / z, x1: v.x1 / z, y1: v.y1 / z };
  }

  /* visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -viewOffX / viewScale, y0: -viewOffY / viewScale, x1: (canvas.width - viewOffX) / viewScale, y1: (canvas.height - viewOffY) / viewScale };
  }

  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - viewOffX) / viewScale, y: ((e.clientY - rect.top) * d - viewOffY) / viewScale };
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  let save = Prog.defaultSave();
  let highScores = [];

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      save = Prog.migrate(raw ? JSON.parse(raw) : null);
    } catch (_) {
      save = Prog.defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
    } catch (_) {
      /* storage full or blocked: drop the ghosts and try once more */
      try {
        for (const id of Object.keys(save.levels))
          save.levels[id].ghost = '';
        localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
      } catch (_) {}
    }
  }

  function loadHighScores() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_HIGHSCORES) || '[]');
      highScores = Array.isArray(raw) ? raw.filter(h => h && typeof h.score === 'number' && h.mode) : [];
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(score, mode, detail) {
    highScores.push({ score: Math.round(score), mode: mode, detail: detail, date: Date.now() });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body)
      return;
    body.innerHTML = '';
    if (!highScores.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No runs yet - try Endless or the Daily Run.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    highScores.forEach((h, i) => {
      const tr = document.createElement('tr');
      for (const v of [i + 1, h.score.toLocaleString(), h.mode + (h.detail ? ' - ' + h.detail : '')]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SOUND
     ══════════════════════════════════════════════════════════════════ */

  const sfxLast = {};
  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || 0) < 40)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT: held keys plus edges, read once per fixed step
     ══════════════════════════════════════════════════════════════════ */

  const held = new Set();
  const pressed = new Set();
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyL: 'dash',
    KeyC: 'fire', KeyF: 'fire', KeyJ: 'fire'
  };
  const inp = { left: false, right: false, down: false, jump: false, jumpPressed: false, dashPressed: false };
  let firePressed = false;

  function readInput() {
    inp.left = held.has('left');
    inp.right = held.has('right');
    inp.down = held.has('down');
    inp.jump = held.has('jump');
    inp.jumpPressed = pressed.has('jump');
    inp.dashPressed = pressed.has('dash');
    firePressed = pressed.has('fire');
    pressed.clear();
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  /* screens: title, map, tree, wardrobe, help, play, pause, results, over */
  let state = 'title';
  let time = 0;
  let frameDt = 0;
  let fade = 0;
  let mouseX = -1, mouseY = -1;
  let menuCursor = 0;
  const hitAreas = [];
  let stats = Prog.computeStats(save);
  let run = null;               // the level being played
  let mapWorld = 0, mapLevel = 0, mapMode = 'adventure';
  let treeBranch = 0, treeSelected = null, treeFrom = 'title', treeFlash = null;
  let wardrobeFrom = 'title';
  let helpPage = 0, helpFrom = 'title';
  let pauseCursor = 0;
  let results = null;
  let toast = null;

  /* tree purchases take effect at once, mid-level included */
  function refreshStats() {
    const before = stats;
    stats = Prog.computeStats(save);
    if (run && run.player) {
      if (stats.maxHearts > run.maxHearts)
        run.hearts += stats.maxHearts - run.maxHearts;
      run.maxHearts = stats.maxHearts;
      run.hearts = Math.min(run.hearts, run.maxHearts);
      if (stats.fire > 0)
        run.fire = true;
      if (stats.shield && !before.shield)
        run.shield = true;
    }
  }

  function currentSkin() {
    return Prog.SKINS.find(s => s.id === save.skin) || Prog.SKINS[0];
  }

  function setScreen(name) {
    state = name;
    menuCursor = 0;
    fade = 1;
    hitAreas.length = 0;
    fxMenu.clear();
    syncTouch();
  }

  function showToast(text, color) {
    toast = { text: text, color: color || '#ffd75a', t: 0 };
  }

  /* ══════════════════════════════════════════════════════════════════
     STARTING A LEVEL
     ══════════════════════════════════════════════════════════════════ */

  const DYNAMIC = { [T.QBLOCK]: true, [T.USED]: true, [T.CRATE]: true, [T.CRUMBLE]: true, [T.SPRING]: true };

  function localDate() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* mode: 'adventure' | 'trial' | 'endless' | 'daily' */
  function startLevel(mode, spec, carry) {
    const level = Levels.build(spec);
    const world = level.world;
    const rec = save.levels[spec.id];
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
      hearts: carry ? carry.hearts : stats.maxHearts, maxHearts: stats.maxHearts,
      inv: 0, shield: stats.shield, fire: stats.fire > 0, star: 0, fireCd: 0,
      coinsRun: carry ? carry.coins : 0, gemsRun: [false, false, false], gemBank: carry ? carry.gemBank : 0,
      stage: carry ? carry.stage : 0, deaths: 0, stomps: 0, combo: 0, comboT: 0,
      koT: 0, fallT: 0, safeT: 0, landT: 0, squash: 0, stretch: 0, runFrame: 0, idleT: 0, trailT: 0, afterT: 0,
      cam: { x: 0, y: 0, look: 0 }, zoom: ZOOM,
      ghostRec: [], ghostT: 0, ghost: null, ghostPos: {},
      radarT: 0, prevBottom: 0, fakeAlpha: 1
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
    run = r;
    const vz = visibleRect();
    r.zoom = Math.max(ZOOM, (vz.y1 - vz.y0) / (level.rows * TS - 96));
    snapCamera();
    shake.reset();
    hitStop.reset();
    flash.reset();
    fxWorld.clear();
    texts.clear();
    held.clear();
    pressed.clear();
    results = null;
    /* bake what the camera sees now so the first frames never stall */
    const v = visibleRect();
    r.tiles.draw(bakeCtx(), { x0: r.cam.x + v.x0 / ZOOM, y0: 0, x1: r.cam.x + v.x1 / ZOOM, y1: level.rows * TS });
    setScreen('play');
    fade = 1;
    updateWindowTitle();
    sfx('select');
  }

  /* a scratch context for warming chunk caches without painting anything visible */
  let scratch = null;
  function bakeCtx() {
    if (!scratch) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      scratch = c.getContext('2d');
    }
    return scratch;
  }

  function startCampaign(world, index, mode) {
    mapWorld = world;
    mapLevel = index;
    startLevel(mode || 'adventure', Levels.CAMPAIGN[world][index], null);
  }

  function startEndless(carry) {
    const seed = carry ? carry.seed : (Date.now() % 100000);
    const stage = carry ? carry.stage : 0;
    const spec = Levels.endlessSpec(seed, stage);
    startLevel('endless', spec, carry ? carry : { hearts: stats.maxHearts, coins: 0, stage: 0, gemBank: 0 });
    run.seed = seed;
  }

  function startDaily() {
    const date = localDate();
    if (save.daily.date !== date) {
      save.daily = { date: date, bestTime: 0, cleared: false, rewarded: false };
      writeSave();
    }
    startLevel('daily', Levels.dailySpec(date), null);
  }

  function restartLevel() {
    if (!run)
      return;
    if (run.mode === 'endless')
      startEndless(null);
    else
      startLevel(run.mode, run.spec, null);
  }

  /* ══════════════════════════════════════════════════════════════════
     THE GAME WORLD SEEN BY ENTITIES
     ══════════════════════════════════════════════════════════════════ */

  const game = {
    level: null, player: null, t: 0, shots: null, enemies: null,
    emit: function(type, d) { onEntityEvent(type, d); }
  };

  function bindGame() {
    game.level = run.level;
    game.player = run.player;
    game.t = run.simT;
    game.shots = run.shots;
    game.enemies = run.enemies;
  }

  function onEntityEvent(type, d) {
    const W = WORLDS[run.world];
    switch (type) {
      case 'windup':
        if (d && d.kind)
          sfx('zap', { pitch: 0.6, volume: 0.6 });
        else if (onScreen(d.x + d.w / 2, d.y))
          sfx('blip', { pitch: 0.7, volume: 0.35 });
        break;
      case 'shot':
        if (onScreen(d.x + d.w / 2, d.y))
          sfx(d.kind ? 'laser' : 'shoot', { pitch: d.kind ? 0.6 : 0.9, volume: 0.45 });
        break;
      case 'land':
        Fx.land(fxWorld, d.x, d.y, dustColor(), d.power || 0.5);
        if (d.shard)
          Fx.debris(fxWorld, d.x, d.y - 8, run.world === 2 ? '#d8f4ff' : '#8a7a6a', 6);
        if (onScreen(d.x, d.y)) {
          shake.add(0.15 * (d.power || 0.5));
          sfx('thud', { volume: 0.5 });
        }
        break;
      case 'quake':
        shake.add(0.35 * d.power);
        Fx.land(fxWorld, d.x, d.y, dustColor(), 1);
        sfx('thud', { pitch: 0.6 });
        break;
      case 'telegraph':
        fxWorld.spawn({ kind: 'ring', color: d.kind === 'bolt' ? '#ffe08a' : '#ff6a6a', x: d.x, y: d.y - 4, size: 70, size1: 20, life: 0.85, alpha: 0.9 });
        break;
      case 'teleport':
        Fx.flash(fxWorld, d.x + d.w / 2, d.y + d.h / 2, '#c88aff', 180, 0.4);
        for (let k = 0; k < 14; ++k)
          fxWorld.spawn({ kind: 'spark', color: '#c88aff', x: d.x + d.w / 2, y: d.y + d.h / 2, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, drag: 3, life: 0.5, size: 8, size1: 1 });
        sfx('zap', { pitch: 1.2 });
        break;
      case 'summon': {
        const e = Ent.createEnemy(d.type, Math.floor(d.x / TS), Math.floor(d.y / TS), run.world);
        e.x = d.x - e.w / 2;
        e.y = d.y;
        e.vy = -500;
        e.dir = Math.random() < 0.5 ? -1 : 1;
        run.enemies.push(e);
        Fx.pop(fxWorld, d.x, d.y, W.color);
        break;
      }
      case 'phase':
        shake.add(0.5);
        flash.fire('#ffffff', 0.35, 3);
        sfx('explode', { pitch: 1.3, volume: 0.6 });
        showToast(d.phase === 3 ? d.name + ' is furious!' : d.name + ' grows angry!', '#ff8a6a');
        break;
      case 'roar':
        shake.add(0.4);
        sfx('explode', { pitch: 0.5, volume: 0.7 });
        break;
      case 'fizzle':
        if (d.owner === 'player') {
          fxWorld.spawn({ kind: 'smoke', color: '#5a4a48', x: d.x, y: d.y, vy: -30, life: 0.4, size: 10, size1: 26, alpha: 0.6 });
          Fx.emberTrail(fxWorld, d.x, d.y);
        }
        break;
    }
  }

  function dustColor() {
    return ['#d8c8a0', '#8a90a8', '#ffffff', '#6a5a5a', '#f0eaff'][run.world];
  }

  function onScreen(x, y) {
    const v = zoomRect(visibleRect());
    return x > run.cam.x + v.x0 - 60 && x < run.cam.x + v.x1 + 60 && y > run.cam.y + v.y0 - 60 && y < run.cam.y + v.y1 + 60;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE: one fixed step of play
     ══════════════════════════════════════════════════════════════════ */

  function updatePlay(dt) {
    const r = run;
    r.introT = Math.max(0, r.introT - dt);
    if (r.introT > 0.35) {
      readInput();
      return;
    }
    const gdt = hitStop.filter(dt);
    readInput();
    let first = true;
    r.acc += gdt;
    let steps = 0;
    while (r.acc >= STEP && steps < MAX_STEPS) {
      r.acc -= STEP;
      ++steps;
      stepPlay(first);
      first = false;
      inp.jumpPressed = false;
      inp.dashPressed = false;
      firePressed = false;
      if (state !== 'play' || run !== r)
        return;
    }
    if (steps >= MAX_STEPS)
      r.acc = 0;
  }

  function stepPlay() {
    const r = run, p = r.player, level = r.level;
    r.simT += STEP;
    bindGame();
    Ent.updatePlatforms(r.platforms, r.simT);

    if (r.clearT > 0) {
      r.clearT -= STEP;
      p.vx *= 0.9;
      if (r.clearT <= 0)
        finishLevel();
      return;
    }
    if (r.koT > 0) {
      r.koT -= STEP;
      if (r.koT <= 0)
        afterKnockOut();
      return;
    }
    if (r.fallT > 0) {
      r.fallT -= STEP;
      if (r.fallT <= 0)
        respawnAt(r.safe, false);
      return;
    }

    r.t += STEP;
    r.inv = Math.max(0, r.inv - STEP);
    r.star = Math.max(0, r.star - STEP);
    r.fireCd = Math.max(0, r.fireCd - STEP);
    r.comboT = Math.max(0, r.comboT - STEP);
    if (r.comboT <= 0 && p.onGround)
      r.combo = 0;

    r.prevBottom = p.y + p.h;
    const wasGround = p.onGround;
    Ph.stepPlayer(p, inp, { level: level, platforms: r.platforms }, stats, STEP);
    playerEvents(p, wasGround);

    if (firePressed)
      shootFire();

    /* crumbling floors under the feet */
    if (p.onGround && p.ground === T.CRUMBLE)
      standOnCrumble(p);
    updateCrumbles();

    /* hazards */
    const hz = Ph.hazardAt(p, level);
    if (hz === 'spike')
      hurtPlayer(p.x + p.w / 2, true);
    else if (hz)
      fallIn(hz);
    if (r.fallT > 0 || r.koT > 0)
      return;

    /* safe ground for pit respawns */
    if (p.onGround && p.platform < 0 && (p.ground === T.SOLID || p.ground === T.ICE || p.ground === T.ONEWAY)) {
      r.safeT += STEP;
      if (r.safeT > COYOTE_SAFE && safeSpot(p)) {
        r.safe.x = p.x;
        r.safe.y = p.y;
      }
    } else {
      r.safeT = 0;
    }

    updateEnemies();
    updateShots();
    updateBoss();
    updateItems();
    recordGhost();

    /* fall-through safety */
    if (p.x < 0)
      p.x = 0;
  }

  function safeSpot(p) {
    const level = run.level;
    const c0 = Math.floor((p.x - TS) / TS), c1 = Math.floor((p.x + p.w + TS) / TS), r = Math.floor((p.y + p.h + 2) / TS);
    for (let c = c0; c <= c1; ++c) {
      if (!Ph.solidAt(level, c, r) && Ph.tileAt(level, c, r) !== T.ONEWAY)
        return false;
      if (Ph.tileAt(level, c, r - 1) === T.SPIKE)
        return false;
    }
    for (const e of run.enemies)
      if (e.alive && Math.abs(e.x - p.x) < 3 * TS && Math.abs(e.y - p.y) < 2 * TS)
        return false;
    return true;
  }

  function playerEvents(p, wasGround) {
    const r = run, ev = p.ev;
    const feetX = p.x + p.w / 2, feetY = p.y + p.h;
    if (ev.jump) {
      sfx('jump', { volume: 0.6 });
      Fx.jump(fxWorld, feetX, feetY, dustColor());
      r.stretch = 1;
      save.stats.jumps++;
    }
    if (ev.doubleJump) {
      sfx('jump', { pitch: 1.35, volume: 0.6 });
      Fx.doubleJump(fxWorld, feetX, feetY);
      r.stretch = 1;
    }
    if (ev.wallJump) {
      sfx('jump', { pitch: 1.15, volume: 0.6 });
      Fx.wallJump(fxWorld, p.facing > 0 ? p.x : p.x + p.w, p.y + p.h / 2, p.facing, dustColor());
      r.stretch = 1;
    }
    if (ev.wallSlide && Math.random() < 0.3)
      Fx.wallSlide(fxWorld, p.wall > 0 ? p.x + p.w : p.x, p.y + p.h * 0.7, dustColor());
    if (ev.dash) {
      sfx('whoosh', { pitch: 1.4 });
      Fx.dash(fxWorld, feetX, p.y + p.h / 2, p.dashDir, '#bfe8ff');
      shake.add(0.08);
      r.afterT = 0;
    }
    if (ev.land) {
      const k = Math.min(1, ev.land / 1000);
      if (k > 0.25) {
        Fx.land(fxWorld, feetX, feetY, dustColor(), k);
        sfx('thud', { volume: 0.25 + k * 0.4, pitch: 1.4 - k * 0.4 });
      }
      if (k > 0.85)
        shake.add(0.12);
      r.squash = 0.6 + k * 0.4;
    }
    if (ev.spring) {
      sfx('bounce', { pitch: 0.8 });
      Fx.springPuff(fxWorld, ev.spring.c * TS + TS / 2, ev.spring.r * TS);
      r.springs[ev.spring.r * r.level.cols + ev.spring.c] = 0.25;
      r.stretch = 1;
    }
    if (ev.head)
      hitBlock(ev.head.c, ev.head.r, true);
    if (ev.crate)
      breakCrate(ev.crate.c, ev.crate.r);
    /* running dust */
    if (p.onGround && Math.abs(p.vx) > 200 && Math.random() < 0.18)
      Fx.dust(fxWorld, feetX, feetY, dustColor(), 1, Math.sign(p.vx));
    if (p.onGround && p.ground === T.ICE && Math.abs(p.vx) > 120 && Math.random() < 0.25)
      fxWorld.spawn({ kind: 'flake', x: feetX, y: feetY - 2, vx: -p.vx * 0.2, vy: -60, ay: 300, life: 0.5, size: 4 });
    if (!wasGround && p.onGround)
      r.combo = 0;
  }

  /* ── blocks ── */

  function hitBlock(c, rr, fromBelow) {
    const r = run, level = r.level;
    const code = Ph.tileAt(level, c, rr);
    const idx = rr * level.cols + c;
    const x = c * TS + TS / 2, y = rr * TS + TS / 2;
    if (code === T.QBLOCK) {
      r.bumps[idx] = 0.2;
      const power = r.level.powerBlocks[idx];
      Ph.setTile(level, c, rr, T.USED);
      if (power) {
        const kind = !r.fire ? 'fire' : r.hearts < r.maxHearts ? 'heart' : 'star';
        r.items.push({ kind: kind, x: x, y: y, y0: y - TS, t: 0, taken: false });
        sfx('powerup', { pitch: 0.8, volume: 0.6 });
      } else {
        for (let k = 0; k < stats.blockCoins; ++k)
          r.coins.push({ x: x, y: y - 10, taken: false, vx: (k - (stats.blockCoins - 1) / 2) * 70, vy: -520 - k * 30, pull: false, pop: 0.45 + k * 0.05, t: 0 });
        sfx('coin');
      }
      Fx.debris(fxWorld, x, y - TS / 2, '#ffd75a', 4);
      bonkAbove(c, rr);
    } else if (code === T.CRATE && fromBelow) {
      breakCrate(c, rr);
    } else if (fromBelow && code !== T.EMPTY) {
      sfx('thud', { volume: 0.3, pitch: 1.6 });
      r.bumps[idx] = 0.12;
    }
  }

  function breakCrate(c, rr) {
    const r = run, level = r.level;
    if (Ph.tileAt(level, c, rr) !== T.CRATE)
      return;
    Ph.setTile(level, c, rr, T.EMPTY);
    r.tiles.refresh(c, rr);
    Fx.debris(fxWorld, c * TS + TS / 2, rr * TS + TS / 2, ['#b07a3a', '#6a5a6a', '#8ab0c8', '#5a4a48', '#c8b8e8'][r.world], 12);
    sfx('smallExplode');
    shake.add(0.1);
    bonkAbove(c, rr);
  }

  /* foes standing on a block that gets hit from below are knocked out */
  function bonkAbove(c, rr) {
    for (const e of run.enemies) {
      if (!e.alive || e.air)
        continue;
      if (Math.abs(e.y + e.h - rr * TS) < 4 && e.x + e.w > c * TS && e.x < (c + 1) * TS)
        killEnemy(e, 'bonk');
    }
  }

  function standOnCrumble(p) {
    const level = run.level;
    const rr = Math.floor((p.y + p.h + 2) / TS);
    for (let c = Math.floor(p.x / TS); c <= Math.floor((p.x + p.w - 1) / TS); ++c) {
      if (Ph.tileAt(level, c, rr) !== T.CRUMBLE)
        continue;
      const idx = rr * level.cols + c;
      let k = run.crumbles.get(idx);
      if (!k) {
        k = { c: c, r: rr, t: 0, gone: 0 };
        run.crumbles.set(idx, k);
      }
      if (!k.gone)
        k.t += STEP;
    }
  }

  function updateCrumbles() {
    const r = run, level = r.level, p = r.player;
    for (const [idx, k] of r.crumbles) {
      if (!k.gone && k.t > 0) {
        if (k.t > 0.5) {
          Ph.setTile(level, k.c, k.r, T.EMPTY);
          k.gone = 4;
          Fx.debris(fxWorld, k.c * TS + TS / 2, k.r * TS + TS / 2, ['#8a6a4a', '#5a6480', '#a8b8cc', '#4a383c', '#d8d0e8'][r.world], 8);
          sfx('smallExplode', { volume: 0.5 });
        }
      } else if (k.gone) {
        k.gone -= STEP;
        if (k.gone <= 0) {
          const box = { x: k.c * TS, y: k.r * TS, w: TS, h: TS };
          if (Ph.overlaps(p, box)) {
            k.gone = 0.5;
          } else {
            Ph.setTile(level, k.c, k.r, T.CRUMBLE);
            r.crumbles.delete(idx);
            fxWorld.spawn({ kind: 'glow', color: '#ffffff', x: box.x + TS / 2, y: box.y + TS / 2, size: 30, size1: 60, life: 0.3, alpha: 0.5 });
          }
        }
      }
    }
  }

  /* ── fire ── */

  function shootFire() {
    const r = run, p = r.player;
    if (!r.fire || r.fireCd > 0)
      return;
    const lv = Math.max(1, stats.fire);
    const alive = r.shots.filter(s => s.alive && s.owner === 'player').length;
    if (alive >= (lv >= 2 ? 2 : 1))
      return;
    r.fireCd = 0.22;
    const big = lv >= 3;
    const s = Ent.spawnShot(game, {
      kind: 'fireball', owner: 'player', x: p.x + p.w / 2 + p.facing * 18, y: p.y + 16, vx: p.facing * FIRE_SPEED + p.vx * 0.3, vy: 120,
      gravity: 1500, r: big ? 14 : 10, life: 1.8, bounce: true, pierce: big
    });
    s.highBounce = lv >= 2;
    sfx('shoot', { pitch: 1.3, volume: 0.5 });
  }

  /* ── harm ── */

  function hurtPlayer(fromX, spike) {
    const r = run, p = r.player;
    if (r.inv > 0 || r.star > 0)
      return;
    const dir = p.x + p.w / 2 < fromX ? -1 : 1;
    p.vx = dir * 300;
    p.vy = -520;
    p.onGround = false;
    p.dashT = 0;
    if (r.shield) {
      r.shield = false;
      r.inv = 1;
      Fx.flash(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#8ad8ff', 160, 0.4);
      fxWorld.spawn({ kind: 'ring', color: '#8ad8ff', x: p.x + p.w / 2, y: p.y + p.h / 2, size: 40, size1: 120, life: 0.4 });
      sfx('zap', { pitch: 0.8 });
      showToast('Shield broken!', '#8ad8ff');
      return;
    }
    r.hearts -= 1;
    r.inv = stats.mercy;
    Fx.hurt(fxWorld, p.x + p.w / 2, p.y + p.h / 2);
    shake.add(0.4);
    hitStop.hit(0.07);
    flash.fire('#ff2a3a', 0.25, 3);
    sfx('hurt');
    if (spike)
      p.vy = -700;
    if (r.hearts <= 0)
      knockOut();
  }

  function fallIn(kind) {
    const r = run, p = r.player;
    const hot = run.world === 3;
    if (kind === 'liquid')
      Fx.splash(fxWorld, p.x + p.w / 2, p.y + p.h, ['#7ad0ff', '#6ae0ff', '#bfe8ff', '#ff8a2a', '#c8a8ff'][r.world], hot);
    sfx(kind === 'liquid' ? (hot ? 'explode' : 'drop') : 'lose', { volume: 0.6, pitch: kind === 'liquid' ? 0.8 : 1.4 });
    r.hearts -= 1;
    shake.add(0.3);
    if (r.hearts <= 0) {
      knockOut();
      return;
    }
    r.fallT = RESPAWN_TIME;
  }

  function knockOut() {
    const r = run, p = r.player;
    r.koT = KO_TIME;
    r.deaths++;
    save.stats.deaths++;
    Fx.death(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#ffd75a');
    shake.add(0.6);
    hitStop.hit(0.15);
    flash.fire('#ffffff', 0.5, 2);
    sfx('lose');
  }

  function afterKnockOut() {
    const r = run;
    if (r.mode === 'endless') {
      endEndless();
      return;
    }
    r.hearts = r.maxHearts;
    r.shield = stats.shield;
    if (r.boss && r.gateClosed && !r.bossDone)
      resetBossFight();
    respawnAt(r.respawn, true);
  }

  /* knocked out in the arena: the gate opens and the boss waits, fully healed */
  function resetBossFight() {
    const r = run, a = r.level.arena;
    for (let rr = a.r - 4; rr <= a.r; ++rr)
      if (Ph.tileAt(r.level, a.gate, rr) === T.GATE)
        Ph.setTile(r.level, a.gate, rr, T.EMPTY);
    r.tiles.refresh(a.gate, a.r);
    r.gateClosed = false;
    r.boss = Ent.createBoss(r.level.boss, r.level);
    r.shots = game.shots = [];
    r.enemies = game.enemies = r.enemies.filter(e => e.x < a.gate * TS);
  }

  function respawnAt(pos, full) {
    const r = run, p = r.player;
    p.x = pos.x;
    p.y = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.dashT = 0;
    p.onGround = false;
    r.inv = full ? 1.5 : 1.2;
    r.fallT = 0;
    r.koT = 0;
    fxWorld.spawn({ kind: 'ring', color: '#ffffff', x: p.x + p.w / 2, y: p.y + p.h / 2, size: 120, size1: 20, life: 0.4 });
    Fx.flash(fxWorld, p.x + p.w / 2, p.y + p.h / 2, '#fff4c0', 120, 0.4);
    snapCamera();
    sfx('pickup', { pitch: 0.7 });
  }

  /* ── foes ── */

  function killEnemy(e, how) {
    if (!e.alive)
      return;
    e.alive = false;
    const r = run;
    r.stomps++;
    save.stats.stomps++;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    Fx.pop(fxWorld, cx, cy, enemyColor(e));
    sfx(how === 'stomp' ? 'bounce' : 'smallExplode', { pitch: how === 'stomp' ? 1 + Math.min(r.combo, 6) * 0.08 : 1 });
    /* a defeated foe leaves a coin behind */
    r.coins.push({ x: cx, y: cy, taken: false, vx: 0, vy: -380, pull: false, pop: 0.4, t: 0 });
  }

  function enemyColor(e) {
    const pal = {
      walker: ['#6ad04a', '#4a5a8a', '#2a3a5a', '#ff6a2a', '#c8c0e0'],
      charger: ['#8a5a3a', '#6a7a9a', '#e8e8f0', '#c83a1a', '#8a7ab8'],
      hopper: ['#5ab83a', '#3a8a6a', '#ffffff', '#c8642a', '#d8b860']
    };
    const p = pal[e.type];
    return p ? p[e.world] : WORLDS[e.world].color;
  }

  function updateEnemies() {
    const r = run, p = r.player;
    for (const e of r.enemies) {
      if (!e.alive)
        continue;
      /* sleep far off-screen */
      if (Math.abs(e.x - p.x) > 1300 && e.state === 'normal')
        continue;
      Ent.updateEnemy(e, game, STEP);
      if (!e.alive || r.koT > 0)
        continue;
      if (!Ph.overlaps(p, e))
        continue;
      if (r.star > 0) {
        killEnemy(e, 'star');
        continue;
      }
      const fromAbove = r.prevBottom <= e.y + 14 && p.vy >= -20;
      if (fromAbove && e.stomp) {
        stompEnemy(e);
      } else if (fromAbove && !e.stomp) {
        /* spikes on its back: bounce off, and it hurts */
        p.vy = -Ph.P.stompBounce * 0.8;
        hurtPlayer(e.x + e.w / 2, false);
      } else {
        hurtPlayer(e.x + e.w / 2, false);
      }
    }
    /* drop the dead now and then */
    if (r.enemies.length > 40)
      r.enemies = r.enemies.filter(e => e.alive);
  }

  function stompEnemy(e) {
    const r = run, p = r.player;
    p.vy = -(inp.jump ? Ph.P.jumpV * 0.95 : Ph.P.stompBounce);
    p.jumping = inp.jump;
    p.airJumps = stats.doubleJump ? 1 : 0;
    if (stats.dash >= 2)
      p.dashReady = true;
    r.stretch = 1;
    r.combo++;
    r.comboT = 0.4;
    const cx = e.x + e.w / 2;
    Fx.stomp(fxWorld, cx, e.y, dustColor());
    hitStop.hit(0.045);
    shake.add(0.12);
    killEnemy(e, 'stomp');
    if (r.combo >= 2)
      texts.add(cx, e.y - 20, 'x' + r.combo + ' COMBO', { color: '#ffd75a', size: 18 + Math.min(r.combo, 6) * 2 });
    if (stats.shockwave > 0) {
      const radius = (stats.shockwave >= 2 ? 2.8 : 1.8) * TS;
      Fx.shockwave(fxWorld, cx, e.y + e.h, radius);
      for (const o of r.enemies) {
        if (!o.alive || o === e)
          continue;
        const dx = o.x + o.w / 2 - cx, dy = o.y + o.h - (e.y + e.h);
        if (dx * dx + dy * dy < radius * radius)
          killEnemy(o, 'wave');
      }
    }
  }

  /* ── shots ── */

  const boxTmp = { x: 0, y: 0, w: 0, h: 0 };

  function updateShots() {
    const r = run, p = r.player;
    for (const s of r.shots) {
      Ent.updateShot(s, game, STEP);
      if (!s.alive || s.delay > 0)
        continue;
      if (s.owner === 'player') {
        if (Math.random() < 0.6)
          Fx.emberTrail(fxWorld, s.x, s.y);
        for (const e of r.enemies) {
          if (!e.alive || !Ph.overlaps(Ent.shotBox(s, boxTmp), e))
            continue;
          e.hp -= 1;
          e.flash = 0.15;
          Fx.flash(fxWorld, s.x, s.y, '#ff8a2a', 70, 0.2);
          if (e.hp <= 0)
            killEnemy(e, 'fire');
          else
            sfx('hit', { volume: 0.5 });
          if (!s.pierce)
            s.alive = false;
          break;
        }
        if (s.alive && r.boss && r.boss.alive && Ph.overlaps(Ent.shotBox(s, boxTmp), r.boss)) {
          if (Ent.hurtBoss(r.boss, 0.34 * stats.bossMul, game)) {
            sfx('hit', { pitch: 0.8 });
            Fx.explosion(fxWorld, s.x, s.y, '#ff8a2a', 0.4);
            bossHitFx();
          }
          s.alive = false;
        }
        /* fireballs cancel enemy shots */
        for (const o of r.shots) {
          if (o.alive && o.owner !== 'player' && o.kind !== 'bolt' && o.kind !== 'wave' && Math.abs(o.x - s.x) < o.r + s.r && Math.abs(o.y - s.y) < o.r + s.r) {
            o.alive = false;
            s.alive = s.pierce;
            Fx.flash(fxWorld, o.x, o.y, '#ffffff', 60, 0.2);
          }
        }
        continue;
      }
      if (r.koT > 0 || r.fallT > 0)
        continue;
      if (Ph.overlaps(Ent.shotBox(s, boxTmp), p)) {
        if (s.kind !== 'bolt' && s.kind !== 'wave')
          s.alive = false;
        hurtPlayer(s.x, false);
      }
    }
    if (r.shots.length > 30)
      r.shots = game.shots = r.shots.filter(s => s.alive);
  }

  /* ── boss ── */

  function updateBoss() {
    const r = run, b = r.boss, p = r.player;
    if (!b)
      return;
    const a = r.level.arena;
    if (!r.gateClosed && p.x > (a.gate + 1.5) * TS) {
      r.gateClosed = true;
      for (let rr = a.r - 4; rr <= a.r; ++rr)
        if (Ph.tileAt(r.level, a.gate, rr) === T.EMPTY)
          Ph.setTile(r.level, a.gate, rr, T.GATE);
      r.tiles.refresh(a.gate, a.r);
      b.active = true;
      shake.add(0.4);
      sfx('thud', { pitch: 0.5 });
      showToast(b.name, '#ff8a6a');
    }
    if (!b.alive) {
      if (!r.bossDone) {
        r.bossDone = true;
        Fx.explosion(fxWorld, b.x + b.w / 2, b.y + b.h / 2, '#ffd75a', 1.6);
        for (let k = 0; k < 12; ++k)
          r.coins.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, taken: false, vx: (k - 5.5) * 45, vy: -600 - (k % 3) * 120, pull: false, pop: 0.7, t: 0 });
        Fx.checkpoint(fxWorld, r.goal.x, r.goal.y - 60, WORLDS[r.world].color);
        flash.fire('#ffffff', 0.6, 1.5);
        shake.add(0.8);
        sfx('win');
        showToast(b.name + ' defeated!', '#ffd75a');
      }
      return;
    }
    const wasDying = b.dying > 0;
    Ent.updateBoss(b, game, STEP);
    if (b.dying > 0) {
      if (!wasDying) {
        hitStop.hit(0.25);
        shake.add(0.8);
        sfx('explode');
      }
      if (Math.random() < 0.15)
        Fx.explosion(fxWorld, b.x + Math.random() * b.w, b.y + Math.random() * b.h, ['#ffd75a', '#ff8a3a', '#ffffff'][(Math.random() * 3) | 0], 0.6);
      return;
    }
    if (!b.active || r.koT > 0 || r.fallT > 0 || !Ph.overlaps(p, b))
      return;
    const fromAbove = r.prevBottom <= b.y + 26 && p.vy >= -20;
    if (fromAbove && Ent.bossStompable(b)) {
      p.vy = -Ph.P.jumpV * 1.05;
      p.airJumps = stats.doubleJump ? 1 : 0;
      if (stats.dash >= 2)
        p.dashReady = true;
      if (Ent.hurtBoss(b, stats.bossMul, game)) {
        Fx.stomp(fxWorld, p.x + p.w / 2, b.y, '#ffffff');
        bossHitFx();
        hitStop.hit(0.1);
        sfx('hit');
      }
      p.vx = (p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1) * 260;
    } else if (fromAbove) {
      p.vy = -Ph.P.stompBounce;
      sfx('thud', { pitch: 1.5 });
    } else if (r.star <= 0) {
      hurtPlayer(b.x + b.w / 2, false);
    }
  }

  function bossHitFx() {
    const b = run.boss;
    shake.add(0.35);
    texts.add(b.x + b.w / 2, b.y - 10, '-' + Math.ceil((b.maxHp - b.hp) / b.maxHp * 100) + '%', { color: '#ff8a6a', size: 20 });
  }

  /* ── pickups ── */

  function updateItems() {
    const r = run, p = r.player;
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    const magnet = stats.magnet * TS;
    for (const c of r.coins) {
      if (c.taken)
        continue;
      c.t += STEP;
      if (c.pop > 0) {
        /* popped from a block or a foe: arc up, then fly into the hero */
        c.vy += 1500 * STEP;
        c.x += c.vx * STEP;
        c.y += c.vy * STEP;
        c.pop -= STEP;
        if (c.pop <= 0)
          c.pull = true;
        continue;
      }
      const dx = px - c.x, dy = py - c.y;
      const d2 = dx * dx + dy * dy;
      if (!c.pull && magnet > 0 && d2 < magnet * magnet)
        c.pull = true;
      if (c.pull) {
        const d = Math.max(1, Math.sqrt(d2));
        const sp = 260 + c.t * 400;
        c.x += dx / d * Math.min(d, sp * STEP);
        c.y += dy / d * Math.min(d, sp * STEP);
      }
      if (d2 < 30 * 30)
        takeCoin(c);
    }
    for (const g of r.gems) {
      if (g.taken)
        continue;
      const dx = px - g.x, dy = py - g.y;
      if (dx * dx + dy * dy < 34 * 34)
        takeGem(g);
    }
    for (const it of r.items) {
      if (it.taken)
        continue;
      it.t += STEP;
      if (it.t < 0.4)
        it.y = it.y0 + TS - TS * Math.min(1, it.t / 0.4);
      const dx = px - it.x, dy = py - it.y;
      if (it.t > 0.3 && dx * dx + dy * dy < 34 * 34)
        takeItem(it);
    }
    for (const cp of r.checkpoints) {
      if (cp.on)
        continue;
      if (Math.abs(px - cp.x) < 30 && p.y + p.h > cp.y - 110 && p.y < cp.y)
        touchCheckpoint(cp);
    }
    if ((!r.boss || r.bossDone) && Math.abs(px - r.goal.x) < 34 && p.y + p.h > r.goal.y - 130 && p.y < r.goal.y)
      reachGoal();
  }

  function takeCoin(c) {
    const r = run;
    c.taken = true;
    r.coinsRun += stats.coinMul;
    Fx.coin(fxWorld, c.x, c.y);
    sfx('coin', { volume: 0.5, pitch: 1 + (r.coinsRun % 5) * 0.03 });
  }

  function takeGem(g) {
    const r = run;
    g.taken = true;
    r.gemsRun[g.i] = true;
    if (r.mode === 'endless')
      r.gemBank++;
    Fx.gem(fxWorld, g.x, g.y, GEM_COLORS[g.i]);
    hitStop.hit(0.06);
    shake.add(0.15);
    flash.fire(GEM_COLORS[g.i], 0.15, 3);
    sfx('levelup', { pitch: 1.2 });
    const n = r.gemsRun.filter(Boolean).length;
    showToast((g.old ? 'Gem found again' : 'Hidden gem found!') + '  ' + n + ' / 3', GEM_COLORS[g.i]);
  }

  function takeItem(it) {
    const r = run, p = r.player;
    it.taken = true;
    Fx.gem(fxWorld, it.x, it.y, it.kind === 'fire' ? '#ff8a3a' : it.kind === 'star' ? '#ffe14a' : '#ff6a86');
    sfx('powerup');
    if (it.kind === 'fire') {
      r.fire = true;
      showToast('Fireballs! Press C or F', '#ff8a3a');
    } else if (it.kind === 'star') {
      r.star = STAR_TIME;
      showToast('Invincible!', '#ffe14a');
    } else {
      r.hearts = Math.min(r.maxHearts, r.hearts + 1);
      showToast('+1 heart', '#ff6a86');
    }
    texts.add(p.x + p.w / 2, p.y - 10, it.kind === 'heart' ? '+1' : it.kind.toUpperCase(), { color: '#ffffff', size: 18 });
  }

  function touchCheckpoint(cp) {
    const r = run, p = r.player;
    for (const o of r.checkpoints)
      if (o.x < cp.x)
        o.on = true;
    cp.on = true;
    cp.t = 0;
    r.respawn = { x: cp.x - p.w / 2, y: cp.y - p.h };
    r.safe = { x: r.respawn.x, y: r.respawn.y };
    Fx.checkpoint(fxWorld, cp.x, cp.y - 70, WORLDS[r.world].color);
    sfx('powerup', { pitch: 1.2 });
    if (stats.mender && r.hearts < r.maxHearts) {
      r.hearts = r.maxHearts;
      showToast('Checkpoint - hearts restored', '#ff6a86');
    } else {
      showToast('Checkpoint', WORLDS[r.world].color);
    }
    if (stats.shield)
      r.shield = true;
  }

  /* ── ghosts ── */

  function recordGhost() {
    const r = run;
    if (r.mode !== 'adventure' && r.mode !== 'trial')
      return;
    r.ghostT += STEP;
    if (r.ghostT >= 1 / Prog.GHOST_HZ - 1e-9) {
      r.ghostT -= 1 / Prog.GHOST_HZ;
      const p = r.player;
      if (r.ghostRec.length < 20 * 60 * 6)
        r.ghostRec.push({ x: p.x + p.w / 2, y: p.y + p.h, pose: Ph.poseOf(p), facing: p.facing });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     FINISHING
     ══════════════════════════════════════════════════════════════════ */

  function reachGoal() {
    const r = run, p = r.player;
    if (r.clearT > 0)
      return;
    r.clearT = 1.3;
    p.vx = 0;
    Fx.checkpoint(fxWorld, r.goal.x, r.goal.y - 60, '#ffd75a');
    for (let k = 0; k < 3; ++k)
      Fx.firework(fxWorld, r.goal.x + (k - 1) * 120, r.goal.y - 40, null);
    flash.fire('#ffffff', 0.4, 2);
    sfx('win');
  }

  function finishLevel() {
    const r = run;
    const coins = Math.floor(r.coinsRun);
    if (r.mode === 'endless') {
      /* straight into the next stage, keeping hearts and coins */
      const carry = { seed: r.seed, stage: r.stage + 1, hearts: r.hearts, coins: r.coinsRun, gemBank: r.gemBank };
      startEndless(carry);
      run.introT = INTRO_TIME;
      return;
    }
    const res = { mode: r.mode, name: r.level.name, world: r.world, time: r.t, coins: coins, gems: r.gemsRun.slice(), deaths: r.deaths, t: 0, target: r.level.timeTarget };
    if (r.mode === 'daily') {
      const first = !save.daily.cleared;
      res.prevBest = save.daily.bestTime;
      res.newBest = !save.daily.bestTime || r.t < save.daily.bestTime;
      if (res.newBest)
        save.daily.bestTime = r.t;
      save.daily.cleared = true;
      res.bonus = 0;
      if (first && !save.daily.rewarded) {
        save.daily.rewarded = true;
        res.bonus = 150;
        save.gems += 2;
        res.newGems = 2;
      }
      save.coins += coins + res.bonus;
      res.stars = [true, r.gemsRun.every(Boolean), r.t <= r.level.timeTarget];
      addHighScore(Math.max(0, 10000 - Math.round(r.t * 50)) + coins * 10, 'Daily', save.daily.date + ' ' + formatTime(r.t));
    } else {
      const id = r.spec.id;
      const prev = save.levels[id];
      res.prevBest = prev ? prev.bestTime : 0;
      const ghost = Prog.encodeGhost(r.ghostRec);
      const out = Prog.completeLevel(save, id, r.level.timeTarget, { coins: coins, gems: r.gemsRun, time: r.t, ghost: ghost });
      Object.assign(res, out);
      res.prevStars = prev ? Prog.starsOf(prev) : [false, false, false];
      if (r.world < 4 && r.spec.index === 5 && out.firstClear)
        res.unlockedWorld = r.world + 1;
    }
    save.stats.playTime += r.t;
    writeSave();
    results = res;
    setScreen('results');
    fade = 0.6;
    menuCursor = 0;
    for (let k = 0; k < 4; ++k)
      setTimeout(() => { if (state === 'results') Fx.firework(fxView, 260 + Math.random() * 760, 700, null); }, k * 380);
  }

  function endEndless() {
    const r = run;
    const coins = Math.floor(r.coinsRun);
    const score = r.stage * 1000 + coins * 10 + Math.round(r.t);
    save.coins += coins;
    save.gems += r.gemBank;
    const best = score > save.endless.best;
    if (best)
      save.endless.best = score;
    save.endless.bestStage = Math.max(save.endless.bestStage, r.stage);
    save.stats.playTime += r.t;
    writeSave();
    addHighScore(score, 'Endless', 'stage ' + (r.stage + 1));
    results = { mode: 'endless', stage: r.stage, coins: coins, gems: r.gemBank, score: score, best: best, t: 0, time: r.t };
    setScreen('results');
  }

  /* ══════════════════════════════════════════════════════════════════
     CAMERA
     ══════════════════════════════════════════════════════════════════ */

  function cameraBounds(vv) {
    const v = zoomRect(vv);
    const r = run, level = r.level;
    let minX = 0, maxX = level.cols * TS;
    if (r.boss && r.gateClosed && !r.bossDone) {
      minX = r.level.arena.gate * TS;
      maxX = (r.level.arena.c1 + 1) * TS;
    }
    const w = v.x1 - v.x0, h = v.y1 - v.y0;
    const levelH = level.rows * TS;
    const out = {};
    if (maxX - minX <= w) {
      out.x0 = out.x1 = (minX + maxX) / 2 - (v.x0 + v.x1) / 2;
    } else {
      out.x0 = minX - v.x0;
      out.x1 = maxX - v.x1;
    }
    if (levelH <= h) {
      out.y0 = out.y1 = levelH - v.y1;
    } else {
      out.y0 = -v.y0;
      out.y1 = levelH - v.y1;
    }
    return out;
  }

  function cameraTarget(v) {
    const r = run, p = r.player;
    const z = zoomNow();
    const tx = p.x + p.w / 2 + r.cam.look - VIEW_W / z / 2;
    let ty = p.y + p.h / 2 - VIEW_H / z * 0.56;
    if (r.boss && r.gateClosed && !r.bossDone)
      ty = 1e9;
    const b = cameraBounds(v);
    return { x: Math.max(b.x0, Math.min(b.x1, tx)), y: Math.max(b.y0, Math.min(b.y1, ty)) };
  }

  function snapCamera() {
    const v = visibleRect();
    run.cam.look = 0;
    const t = cameraTarget(v);
    run.cam.x = t.x;
    run.cam.y = t.y;
  }

  function updateCamera(dt) {
    const r = run, p = r.player;
    const v = visibleRect();
    /* look ahead in the running direction, eased */
    const want = Math.abs(p.vx) > 60 ? Math.sign(p.vx) * 120 : r.cam.look * 0.98;
    r.cam.look += (want - r.cam.look) * Math.min(1, dt * 2.2);
    const t = cameraTarget(v);
    r.cam.x += (t.x - r.cam.x) * Math.min(1, dt * 7);
    /* the camera eases out a little for boss fights so the whole arena shows */
    /* tall windows zoom in so the level still fills the height */
    const fill = (v.y1 - v.y0) / (r.level.rows * TS - 96);
    const zt = Math.max(r.boss && r.gateClosed && !r.bossDone ? 1 : ZOOM, fill);
    r.zoom += (zt - r.zoom) * Math.min(1, dt * 2.5);
    const z = r.zoom;
    const vy = p.onGround || p.y + p.h > r.cam.y + VIEW_H / z * 0.8 || p.y < r.cam.y + VIEW_H / z * 0.2 ? 5 : 1.6;
    r.cam.y += (t.y - r.cam.y) * Math.min(1, dt * vy);
    const b = cameraBounds(v);
    r.cam.x = Math.max(b.x0, Math.min(b.x1, r.cam.x));
    r.cam.y = Math.max(b.y0, Math.min(b.y1, r.cam.y));
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = s - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(2);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING THE WORLD
     ══════════════════════════════════════════════════════════════════ */

  function drawSprite(s, x, y, flip, sx, sy) {
    if (!flip && !sx) {
      ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
  }

  function glowSprite(color) {
    return Fx.sprite('glow', color);
  }

  function drawGlow(x, y, size, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(color), x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  function heroPose(r) {
    const p = r.player;
    if (r.clearT > 0)
      return 'win';
    if (r.inv > stats.mercy - 0.35 && r.inv > 0 && !p.onGround)
      return 'hurt';
    if (r.squash > 0.75 && p.onGround)
      return 'land';
    return Ph.poseOf(p);
  }

  function heroFrame(r, pose, dt) {
    const p = r.player;
    if (pose === 'run') {
      r.runFrame += Math.abs(p.vx) * dt / 26;
      return Math.floor(r.runFrame);
    }
    if (pose === 'idle' || pose === 'win') {
      r.idleT += dt;
      return Math.floor(r.idleT * (pose === 'win' ? 8 : 4));
    }
    if (pose === 'jump' || pose === 'fall')
      return Math.abs(p.vy) < 200 ? 1 : 0;
    if (pose === 'dash')
      return Math.floor(time * 20);
    return 0;
  }

  function worldRect(v) {
    const z = run.zoom;
    return { x0: run.cam.x + v.x0 / z, y0: run.cam.y + v.y0 / z, x1: run.cam.x + v.x1 / z, y1: run.cam.y + v.y1 / z };
  }

  function drawWorld(dt) {
    const r = run, level = r.level, p = r.player;
    const v = visibleRect();
    const sh = shake.update(dt);
    const camX = r.cam.x + sh.x, camY = r.cam.y + sh.y;
    r.scene.drawBack(ctx, v, camX, camY, time);
    const z = r.zoom;
    const rect = { x0: camX + v.x0 / z, y0: camY + v.y0 / z, x1: camX + v.x1 / z, y1: camY + v.y1 / z };
    ctx.save();
    if (sh.a) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(sh.a);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.scale(z, z);
    const px = viewScale * z;
    ctx.translate(-Math.round(camX * px) / px, -Math.round(camY * px) / px);

    r.tiles.prepare(rect);
    r.tiles.draw(ctx, rect);
    /* secret walls fade while the hero is inside or next to them */
    const inFake = fakeNear(p);
    r.fakeAlpha += ((inFake ? 0.25 : 1) - r.fakeAlpha) * Math.min(1, dt * 6);
    r.tiles.drawLive(ctx, rect, time, r.fakeAlpha);

    drawDynamicTiles(rect);
    for (const pl of r.platforms)
      if (pl.x + pl.w > rect.x0 && pl.x < rect.x1)
        drawSprite(Spr.item('platform', 0, r.world), pl.x, pl.y);
    drawCheckpoints(rect);
    drawGoal(rect);
    drawItems(rect);
    drawEnemies(rect);
    drawBoss();
    drawGhost();
    drawHero(dt);
    drawShots(rect);
    fxWorld.draw(ctx, rect);
    texts.draw(ctx);
    drawRadar();
    ctx.restore();
    r.scene.drawFront(ctx, v, camX, camY, time);
  }

  function fakeNear(p) {
    const level = run.level;
    const c0 = Math.floor((p.x - 4) / TS), c1 = Math.floor((p.x + p.w + 4) / TS);
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 1) / TS);
    for (let rr = r0; rr <= r1; ++rr)
      for (let c = c0; c <= c1; ++c)
        if (Ph.tileAt(level, c, rr) === T.FAKE)
          return true;
    return false;
  }

  function drawDynamicTiles(rect) {
    const r = run, level = r.level;
    const cols = level.cols;
    const c0 = Math.floor(rect.x0 / TS) - 1, c1 = Math.floor(rect.x1 / TS) + 1;
    for (const idx of r.dyn) {
      const c = idx % cols;
      if (c < c0 || c > c1)
        continue;
      const rr = (idx / cols) | 0;
      const code = level.tiles[idx];
      const x = c * TS + TS / 2;
      let y = rr * TS + TS / 2;
      const bump = r.bumps[idx];
      if (bump > 0) {
        y -= Math.sin((1 - bump / 0.2) * Math.PI) * 10;
        r.bumps[idx] = bump - frameDt;
      }
      let s = null;
      if (code === T.QBLOCK)
        s = Spr.item('qblock', Math.floor(time * 6 + c) % 4, r.world);
      else if (code === T.USED)
        s = Spr.item('used', 0, r.world);
      else if (code === T.CRATE)
        s = Spr.item('crate', 0, r.world);
      else if (code === T.CRUMBLE) {
        const k = r.crumbles.get(idx);
        const stage = k && k.t > 0 ? Math.min(2, Math.floor(k.t / 0.18)) : 0;
        if (stage > 0)
          y += (Math.random() - 0.5) * 3;
        s = Spr.item('crumble', stage, r.world);
      } else if (code === T.SPRING) {
        const sq = r.springs[idx] || 0;
        if (sq > 0)
          r.springs[idx] = sq - frameDt;
        s = Spr.item('spring', 0, sq > 0.1 ? 1 : 0);
      }
      if (s) {
        if (code === T.QBLOCK)
          drawGlow(x, y, 90, '#ffd75a', 0.18 + 0.08 * Math.sin(time * 3 + c));
        drawSprite(s, x, y);
      }
    }
    /* the arena gate */
    if (r.gateClosed) {
      const a = level.arena;
      for (let rr = a.r - 4; rr <= a.r; ++rr)
        if (Ph.tileAt(level, a.gate, rr) === T.GATE)
          drawSprite(Spr.item('gate', 0, r.world), a.gate * TS + TS / 2, rr * TS + TS / 2);
    }
  }

  function drawCheckpoints(rect) {
    for (const cp of run.checkpoints) {
      if (cp.x < rect.x0 - 80 || cp.x > rect.x1 + 80)
        continue;
      cp.t += frameDt;
      if (cp.on)
        drawGlow(cp.x, cp.y - 60, 160, WORLDS[run.world].color, 0.25 + 0.08 * Math.sin(time * 3));
      drawSprite(Spr.item('checkpoint', Math.floor(time * 6) % 4, cp.on ? 1 : 0), cp.x, cp.y);
    }
  }

  function drawGoal(rect) {
    const r = run;
    if (r.goal.x < rect.x0 - 120 || r.goal.x > rect.x1 + 120)
      return;
    if (r.boss && !r.bossDone)
      return;
    drawGlow(r.goal.x, r.goal.y - 70, 260, '#ffe9a0', 0.35 + 0.1 * Math.sin(time * 2.4));
    drawSprite(Spr.item('goal', Math.floor(time * 8) % 6, r.world), r.goal.x, r.goal.y);
    if (Math.random() < 0.3)
      fxWorld.spawn({ kind: 'spark', color: '#ffe9a0', x: r.goal.x + (Math.random() - 0.5) * 70, y: r.goal.y - Math.random() * 120, vy: -40, life: 0.8, size: 6, size1: 1, ambient: true });
  }

  function drawItems(rect) {
    const r = run;
    const cf = Math.floor(time * 12);
    for (const c of r.coins) {
      if (c.taken || c.x < rect.x0 - 30 || c.x > rect.x1 + 30 || c.y < rect.y0 - 30 || c.y > rect.y1 + 30)
        continue;
      const bob = c.pop > 0 || c.pull ? 0 : Math.sin(time * 3 + c.x * 0.05) * 2;
      drawSprite(Spr.item('coin', (cf + ((c.x / TS) | 0)) % 8), c.x, c.y + bob);
    }
    for (const g of r.gems) {
      if (g.taken || g.x < rect.x0 - 40 || g.x > rect.x1 + 40)
        continue;
      const bob = Math.sin(time * 2.5 + g.i) * 4;
      ctx.save();
      if (g.old)
        ctx.globalAlpha = 0.55;
      drawGlow(g.x, g.y + bob, 110, GEM_COLORS[g.i], 0.45 + 0.15 * Math.sin(time * 4));
      drawSprite(Spr.item('gem', Math.floor(time * 8) % 6, g.i), g.x, g.y + bob);
      ctx.restore();
    }
    for (const it of r.items) {
      if (it.taken)
        continue;
      const bob = it.t > 0.4 ? Math.sin(time * 4) * 3 : 0;
      drawGlow(it.x, it.y + bob, 90, it.kind === 'fire' ? '#ff8a3a' : it.kind === 'star' ? '#ffe14a' : '#ff6a86', 0.4);
      drawSprite(Spr.item(it.kind, Math.floor(time * 8) % 4), it.x, it.y + bob);
    }
  }

  function drawEnemies(rect) {
    const r = run;
    for (const e of r.enemies) {
      if (!e.alive || e.x + e.w < rect.x0 - 40 || e.x > rect.x1 + 40 || e.y > rect.y1 + 40 || e.y + e.h < rect.y0 - 40)
        continue;
      const frames = Spr.ENEMY_FRAMES[e.type] || 4;
      const fps = e.state === 'charge' ? 16 : e.type === 'flyer' || e.type === 'diver' ? 12 : 7;
      const st = e.state === 'windup' || e.state === 'stunned' ? e.state : e.state === 'charge' ? 'windup' : 'normal';
      const s = Spr.enemy(e.type, e.world, Math.floor(e.frameT * fps) % frames, st);
      const air = e.type === 'flyer' || e.type === 'diver';
      const x = e.x + e.w / 2, y = air ? e.y + e.h / 2 : e.y + e.h;
      let sx = 1, sy = 1;
      if (e.type === 'hopper' && e.squash > 0) { sx = 1.2; sy = 0.8; }
      if (e.state === 'windup' && e.type !== 'turret') {
        sx = 1 + Math.sin(e.stateT * 40) * 0.04;
      }
      drawSprite(s, x, y, e.dir < 0, sx, sy);
      if (e.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = e.flash / 0.15 * 0.6;
        drawSprite(s, x, y, e.dir < 0, sx, sy);
        ctx.restore();
      }
    }
  }

  function drawBoss() {
    const b = run.boss;
    if (!b || !b.alive)
      return;
    let pose = 'idle';
    if (b.dying > 0)
      pose = 'hurt';
    else if (b.state === 'windup' || b.state === 'cast' || b.state === 'throw' || b.state === 'swoop' || b.state === 'charge')
      pose = 'attack';
    else if (b.state === 'stunned' || b.state === 'tired' || b.state === 'rest' || b.state === 'teleport')
      pose = 'special';
    const frames = Spr.BOSS_FRAMES[pose];
    const s = Spr.boss(b.kind, pose, Math.floor(b.t * (pose === 'idle' ? 6 : 10)) % frames);
    const x = b.x + b.w / 2, y = b.y + b.h;
    ctx.save();
    if (b.state === 'teleport')
      ctx.globalAlpha = Math.abs(Math.cos(b.stateT * 14)) * 0.8;
    if (b.dying > 0) {
      ctx.globalAlpha = Math.min(1, b.dying / 1.2);
    }
    let sx = 1, sy = 1;
    if (b.kind === 'slime') {
      const k = b.onGround ? Math.sin(b.t * 5) * 0.04 : -0.08;
      sx = 1 - k;
      sy = 1 + k;
    }
    if (b.inv > 0 && Math.floor(b.inv * 20) % 2 === 0)
      ctx.globalAlpha *= 0.6;
    drawGlow(x, y - b.h / 2, b.w * 2.4, ['#7ad04a', '#6ab8ff', '#bfe6ff', '#ff7a3a', '#c8a8ff'][run.world], 0.18);
    drawSprite(s, x, y, b.dir < 0, sx, sy);
    if (b.flash > 0 && b.dying <= 0) {
      /* a white flash on every hit */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, b.flash / 0.25) * 0.75;
      drawSprite(s, x, y, b.dir < 0, sx, sy);
    }
    ctx.restore();
  }

  function drawGhost() {
    const r = run;
    if (!r.ghost || !r.ghost.length || r.introT > 0)
      return;
    const g = Prog.ghostAt(r.ghost, r.t, r.ghostPos);
    if (!g)
      return;
    const pose = g.pose === 'hurt' ? 'fall' : g.pose;
    const s = Spr.hero(currentSkin(), pose, Math.floor(r.t * 12) % (Spr.HERO_FRAMES[pose] || 1));
    ctx.save();
    ctx.globalAlpha = 0.38;
    drawSprite(s, g.x, g.y, g.facing < 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    drawSprite(s, g.x, g.y, g.facing < 0);
    ctx.restore();
  }

  function drawHero(dt) {
    const r = run, p = r.player;
    if (r.fallT > 0 || r.koT > 0)
      return;
    const pose = heroPose(r);
    const frame = heroFrame(r, pose, dt);
    const s = Spr.hero(currentSkin(), pose, frame);
    const x = p.x + p.w / 2, y = p.y + p.h;
    /* squash and stretch */
    r.squash = Math.max(0, r.squash - dt * 5);
    r.stretch = Math.max(0, r.stretch - dt * 5);
    const sx = 1 + r.squash * 0.22 - r.stretch * 0.12;
    const sy = 1 - r.squash * 0.2 + r.stretch * 0.14;
    /* trails */
    r.afterT += dt;
    if (p.dashT > 0 && r.afterT > 0.025) {
      r.afterT = 0;
      fxWorld.spawn({ kind: 'image', img: s, flipX: p.facing < 0, x: x, y: y, life: 0.28, alpha: 0.5, add: true });
    } else if (save.trail === 'shadow' && Math.abs(p.vx) > 150 && r.afterT > 0.06) {
      r.afterT = 0;
      fxWorld.spawn({ kind: 'image', img: s, flipX: p.facing < 0, x: x, y: y, life: 0.35, alpha: 0.35 });
    }
    if (save.trail !== 'none' && save.trail !== 'shadow' && (Math.abs(p.vx) > 60 || !p.onGround))
      Fx.trail(fxWorld, save.trail, x, y - 10, dt, time);
    if (r.star > 0) {
      drawGlow(x, y - 24, 120, ['#ff5a5a', '#ffe14a', '#6ae06a', '#4ab8ff'][Math.floor(time * 10) % 4], 0.5);
      if (Math.random() < 0.5)
        fxWorld.spawn({ kind: 'star', color: '#ffe14a', x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 44, vy: -40, life: 0.4, size: 10, size1: 2 });
    }
    ctx.save();
    if (r.inv > 0 && Math.floor(r.inv * 16) % 2 === 0)
      ctx.globalAlpha = 0.35;
    drawSprite(s, x, y, p.facing < 0, sx, sy);
    ctx.restore();
    if (r.shield)
      drawSprite(Spr.item('shield', 0), x, y - 22, false, 1 + Math.sin(time * 4) * 0.03, 1 + Math.cos(time * 4) * 0.03);
    if (r.fire && Math.random() < 0.15)
      Fx.emberTrail(fxWorld, x + p.facing * 10, y - 26, '#ff8a2a');
  }

  function drawShots(rect) {
    const r = run;
    for (const s of r.shots) {
      if (!s.alive || s.x < rect.x0 - 60 || s.x > rect.x1 + 60)
        continue;
      if (s.kind === 'bolt') {
        if (s.delay > 0) {
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 30);
          ctx.fillStyle = '#ffe08a';
          ctx.fillRect(s.x - 18, rect.y0, 36, s.ground - rect.y0);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite('#c8a8ff'), s.x - 60, rect.y0, 120, s.ground - rect.y0);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          let y = rect.y0, x = s.x;
          ctx.moveTo(x, y);
          while (y < s.ground) {
            y += 36;
            x = s.x + (Math.random() - 0.5) * 26;
            ctx.lineTo(x, Math.min(y, s.ground));
          }
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#fff6c0';
          ctx.stroke();
          ctx.restore();
          if (Math.random() < 0.5)
            shake.add(0.05);
        }
        continue;
      }
      if (s.kind === 'fall' && s.delay > 0) {
        /* a shadow where the rock or icicle will land */
        const k = 1 - s.delay / 0.85;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.45;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(s.x, run.boss ? run.boss.floor - 2 : s.y, 10 + k * 18, 5 + k * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (s.kind === 'wave') {
        drawGlow(s.x, s.ground - 14, 90, '#9aff6a', 0.6);
        drawSprite(Spr.item('bossShot', Math.floor(time * 12) % 4, 0), s.x, s.ground - 16, s.vx < 0, 1.4, 0.8);
        continue;
      }
      if (s.owner === 'player') {
        drawGlow(s.x, s.y, s.r * 7, '#ff8a2a', 0.6);
        drawSprite(Spr.item('fireball', Math.floor(time * 16) % 4), s.x, s.y, s.vx < 0, s.r / 10, s.r / 10);
      } else if (s.owner === 'boss') {
        drawGlow(s.x, s.y, 80, ['#9aff6a', '#6ae0ff', '#ffffff', '#ff8a2a', '#c8a8ff'][s.boss], 0.5);
        drawSprite(Spr.item('bossShot', Math.floor(time * 12) % 4, s.boss), s.x, s.y);
      } else {
        drawGlow(s.x, s.y, 60, '#ff6a6a', 0.4);
        drawSprite(Spr.item('shot', Math.floor(time * 12) % 4, s.world), s.x, s.y);
      }
    }
  }

  /* gem radar: an arrow at the hero pointing to the nearest missing gem */
  function drawRadar() {
    const r = run, p = r.player;
    if (!stats.radar || r.koT > 0)
      return;
    let best = null, bd = Infinity;
    for (const g of r.gems) {
      if (g.taken)
        continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bd) { bd = d; best = g; }
    }
    if (!best || bd < 90)
      return;
    const a = Math.atan2(best.y - (p.y + p.h / 2), best.x - (p.x + p.w / 2));
    const x = p.x + p.w / 2 + Math.cos(a) * 52, y = p.y + p.h / 2 + Math.sin(a) * 52;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 5);
    ctx.translate(x, y);
    ctx.rotate(a);
    const s = Spr.item('arrow', 0);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
    r.radarT -= frameDt;
    if (r.radarT <= 0 && bd < 8 * TS) {
      r.radarT = Math.max(0.35, bd / TS * 0.18);
      sfx('blip', { pitch: 2 - Math.min(1, bd / (8 * TS)), volume: 0.25 });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD
     ══════════════════════════════════════════════════════════════════ */

  function drawIcon(name, color, x, y, size) {
    const s = Spr.icon(name, color, size);
    ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  }

  function drawHUD() {
    const r = run;
    const v = visibleRect();
    /* anchored to the visible corners, wide or tall windows alike */
    const left = v.x0 + 16, right = v.x1 - 16, top = v.y0 + 12;
    /* hearts */
    const hw = 38 + r.maxHearts * 34;
    ui.drawPanel(left, top, hw + (r.shield ? 34 : 0), 52, { radius: 14, noStuds: true, alpha: 0.92 });
    for (let k = 0; k < r.maxHearts; ++k) {
      const full = k < r.hearts;
      const pulse = full && r.hearts === 1 ? 1 + 0.12 * Math.sin(time * 9) : 1;
      drawIcon(full ? 'heart' : 'heartEmpty', '#ff4a6a', left + 30 + k * 34, top + 26, 30 * pulse);
    }
    if (r.shield)
      drawIcon('shield', '#8ad8ff', left + 30 + r.maxHearts * 34, top + 26, 28);
    /* coins and gems */
    const cx = left;
    const cy = top + 60;
    ui.drawPanel(cx, cy, 150, 40, { radius: 12, noStuds: true, alpha: 0.92 });
    drawIcon('coin', '#ffd75a', cx + 24, cy + 20, 26);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(String(Math.floor(r.coinsRun)), cx + 44, cy + 21, 96, 22, { weight: 'bold', color: '#ffe9a0', outline: 'rgba(0,0,0,0.6)' });
    ui.drawPanel(cx + 158, cy, 122, 40, { radius: 12, noStuds: true, alpha: 0.92 });
    for (let k = 0; k < 3; ++k) {
      const g = r.gems[k];
      const have = r.gemsRun[k];
      ctx.save();
      ctx.globalAlpha = have ? 1 : g && g.old ? 0.45 : 0.22;
      drawSprite(Spr.item('gem', have ? Math.floor(time * 6) % 6 : 0, k), cx + 186 + k * 34, cy + 20, false, 0.75, 0.75);
      ctx.restore();
    }
    /* timer and mode */
    const tw = 210;
    ui.drawPanel(right - tw, top, tw, 52, { radius: 14, noStuds: true, alpha: 0.92 });
    drawIcon('clock', '#bfe8ff', right - tw + 28, top + 26, 26);
    ctx.textAlign = 'left';
    const target = r.level.timeTarget;
    const over = r.mode !== 'endless' && r.t > target;
    ui.fitText(formatTime(r.t), right - tw + 50, top + 27, 100, 24, { weight: 'bold', color: over ? '#ffb0a0' : '#ffffff', outline: 'rgba(0,0,0,0.6)' });
    ctx.textAlign = 'right';
    ui.fitText(r.mode === 'endless' ? 'STAGE ' + (r.stage + 1) : 'par ' + target + 's', right - 14, top + 27, 64, 12, { weight: 'bold', color: over ? ui.UI.bad : ui.UI.textDim });
    /* powers */
    let px = right - tw;
    const py = top + 60;
    if (r.fire) {
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: 0.92 });
      drawSprite(Spr.item('fire', Math.floor(time * 8) % 4), px + 23, py + 20, false, 0.8, 0.8);
      px += 52;
    }
    if (r.star > 0) {
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: 0.92, glow: r.star < 2 && Math.floor(time * 6) % 2 === 0 });
      drawSprite(Spr.item('star', Math.floor(time * 8) % 4), px + 23, py + 18, false, 0.7, 0.7);
      ui.drawMeter(px + 6, py + 32, 34, 5, r.star / STAR_TIME, '#ffe14a');
      px += 52;
    }
    if (stats.dash > 0) {
      const ready = r.player.dashReady && r.player.dashCd <= 0;
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: ready ? 0.92 : 0.5 });
      drawIcon('boot', ready ? '#5ad1ff' : '#5a6a80', px + 23, py + 20, 24);
      px += 52;
    }
    if (r.ghost && r.mode === 'trial') {
      const prev = save.levels[r.spec.id] && save.levels[r.spec.id].bestTime;
      if (prev) {
        ctx.textAlign = 'right';
        ui.fitText('best ' + formatTime(prev), right - 4, py + 54, 200, 13, { weight: 'bold', color: '#bfe8ff', outline: 'rgba(0,0,0,0.6)' });
      }
    }
    /* boss bar */
    const b = r.boss;
    if (b && b.active && b.alive) {
      const bw = 520, bx = VIEW_W / 2 - bw / 2, by = v.y1 - 62;
      ui.drawPanel(bx, by, bw, 46, { radius: 14, accent: '#ff6a6a', noStuds: true, alpha: 0.94 });
      drawIcon('skull', '#ff8a6a', bx + 26, by + 23, 26);
      ctx.textAlign = 'left';
      ui.fitText(b.name, bx + 46, by + 15, 240, 13, { weight: 'bold', color: '#ffd8c8' });
      ui.drawMeter(bx + 46, by + 26, bw - 64, 12, b.hp / b.maxHp, b.phase === 3 ? '#ff4a3a' : b.phase === 2 ? '#ff8a3a' : '#ffc84a');
    }
    /* toast */
    if (toast) {
      toast.t += frameDt;
      const k = toast.t;
      if (k > 2.4) {
        toast = null;
      } else {
        const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
        const y = 150 - (k < 0.2 ? (1 - k / 0.2) * 20 : 0);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = ui.uiFont(22, 'bold');
        const w = Math.min(640, ctx.measureText(toast.text).width + 60);
        ui.drawPanel(VIEW_W / 2 - w / 2, y - 22, w, 44, { radius: 18, noStuds: true, accent: toast.color, glow: true });
        ctx.textAlign = 'center';
        ui.fitText(toast.text, VIEW_W / 2, y + 1, w - 30, 21, { weight: 'bold', color: toast.color, outline: 'rgba(0,0,0,0.6)' });
        ctx.restore();
      }
    }
    if (r.introT > 0)
      drawIntroCard(r);
    if (r.koT > 0)
      drawKnockOut(r);
    if (r.clearT > 0) {
      const k = 1 - r.clearT / 1.3;
      ui.drawHeadline(r.mode === 'endless' ? 'Stage Clear!' : 'Level Clear!', VIEW_W / 2, 300 - (1 - Math.min(1, k * 3)) * 40, 900, 84, '#ffe9a0', '#ff9a2a');
    }
  }

  function drawIntroCard(r) {
    const k = r.introT / INTRO_TIME;
    const appear = Math.min(1, (1 - k) * 5);
    const leave = Math.min(1, r.introT / 0.35);
    const a = Math.min(appear, leave);
    const W = WORLDS[r.world];
    ctx.save();
    ctx.globalAlpha = a;
    const y = 230 + (1 - appear) * 30;
    ui.drawPanel(VIEW_W / 2 - 330, y, 660, 210, { accent: W.color, radius: 18 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let sub;
    if (r.mode === 'endless')
      sub = 'ENDLESS - ' + W.name.toUpperCase();
    else if (r.mode === 'daily')
      sub = 'DAILY RUN - ' + W.name.toUpperCase();
    else
      sub = W.name.toUpperCase() + ' - ' + (r.spec.index + 1) + (r.mode === 'trial' ? ' - TIME TRIAL' : '');
    ui.fitText(sub, VIEW_W / 2, y + 34, 600, 15, { weight: 'bold', color: W.color });
    ui.drawHeadline(r.level.name, VIEW_W / 2, y + 88, 600, 54, '#ffffff', W.accent);
    const gemsHave = r.gems.filter(g => g.old).length;
    const items = [];
    items.push({ icon: 'gem', text: gemsHave + ' / 3 gems', color: '#4aff8a' });
    items.push({ icon: 'clock', text: 'par ' + r.level.timeTarget + 's', color: '#bfe8ff' });
    if (r.boss)
      items.push({ icon: 'skull', text: r.boss.name, color: '#ff8a6a' });
    else if (r.mode === 'endless')
      items.push({ icon: 'heart', text: r.hearts + ' hearts', color: '#ff6a86' });
    else
      items.push({ icon: 'flag', text: r.checkpoints.length + ' checkpoints', color: '#ffe08a' });
    const w = 190;
    items.forEach((it, i) => {
      const x = VIEW_W / 2 + (i - (items.length - 1) / 2) * w;
      drawIcon(it.icon, it.color, x - 60, y + 152, 26);
      ctx.textAlign = 'left';
      ui.fitText(it.text, x - 42, y + 153, 130, 15, { weight: 'bold', color: '#e4eaf6' });
    });
    ctx.restore();
    if (r.introT < 0.55 && r.introT > 0) {
      const g = 1 - r.introT / 0.55;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - g) * 3);
      ui.drawHeadline('GO!', VIEW_W / 2, 340, 400, 90 + g * 60, '#fff2a0', '#ff8a2a');
      ctx.restore();
    }
  }

  function drawKnockOut(r) {
    const k = 1 - r.koT / KO_TIME;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3) * 0.55;
    const v = visibleRect();
    ctx.fillStyle = '#0a0410';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.globalAlpha = Math.min(1, k * 3);
    ui.drawHeadline(r.mode === 'endless' ? 'Run Over' : 'Knocked Out!', VIEW_W / 2, 320, 800, 80, '#ffb0a0', '#c82a3a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(r.mode === 'endless' ? 'Tallying your run...' : 'Back to the last checkpoint', VIEW_W / 2, 390, 600, 18, { color: '#e4eaf6' });
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU KIT: hit areas, keyboard cursor, buttons
     ══════════════════════════════════════════════════════════════════ */

  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    if (hovered && pointerMoved)
      menuCursor = index;
    return hovered || menuCursor === index;
  }

  let pointerMoved = false;
  const hoverAnim = {};

  function hoverLevel(id, hot) {
    const v = hoverAnim[id] || 0;
    const nv = hot ? Math.min(1, v + frameDt * 8) : Math.max(0, v - frameDt * 5);
    hoverAnim[id] = nv;
    return nv;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h) && !opts.disabled;
    const hv = hoverLevel(id, hot);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.5;
    if (hv > 0) {
      const sc = 1 + 0.04 * hv;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.4 * hv;
      ctx.drawImage(glowSprite(opts.accent || '#5ab8ff'), x - 30, y - h * 0.6, w + 60, h * 2.2);
      ctx.restore();
    }
    ui.drawButtonFrame(x, y, w, h, hot, opts.accent, time);
    let tx = x + w / 2;
    if (opts.icon) {
      drawIcon(opts.icon, opts.iconColor || '#ffd75a', x + 34, y + h / 2, Math.min(34, h - 14));
      tx += 16;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? 90 : 40), opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : '#e4ecff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
    if (opts.sub)
      ui.fitText(opts.sub, tx, y + h - 14, w - (opts.icon ? 90 : 30), 12, { color: hot ? '#cfe4ff' : ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 34, y + 7, 10);
    ctx.restore();
  }

  function moveCursor(d) {
    const n = hitAreas.length;
    if (!n)
      return;
    let k = menuCursor;
    for (let i = 0; i < n; ++i) {
      k = (k + d + n) % n;
      if (!hitAreas[k].disabled)
        break;
    }
    menuCursor = k;
    sfx('click', { volume: 0.4 });
  }

  function activate(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.4 });
      return;
    }
    sfx('select');
    item.action();
  }

  function veil(alpha) {
    const v = visibleRect();
    ctx.fillStyle = 'rgba(6,10,24,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function menuBackdrop(world, alpha) {
    const v = visibleRect();
    Scene.create(world).drawMenu(ctx, v, time);
    fxMenu.update(frameDt);
    Fx.ambient(fxMenu, world, v, frameDt);
    fxMenu.draw(ctx);
    if (alpha)
      veil(alpha);
  }

  function currencyChips(x, y) {
    ctx.font = ui.uiFont(18, 'bold');
    const gemsText = String(save.gems), coinText = save.coins.toLocaleString();
    const gw = Math.max(70, ctx.measureText(gemsText).width + 56);
    const cw = Math.max(90, ctx.measureText(coinText).width + 56);
    ui.drawPanel(x - gw, y, gw, 40, { radius: 14, noStuds: true });
    drawSprite(Spr.item('gem', Math.floor(time * 6) % 6, 1), x - gw + 22, y + 20, false, 0.7, 0.7);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(gemsText, x - gw + 40, y + 21, gw - 48, 18, { weight: 'bold', color: '#bfffd0' });
    ui.drawPanel(x - gw - cw - 10, y, cw, 40, { radius: 14, noStuds: true });
    drawIcon('coin', '#ffd75a', x - gw - cw + 12, y + 20, 24);
    ui.fitText(coinText, x - gw - cw + 30, y + 21, cw - 38, 18, { weight: 'bold', color: '#ffe9a0' });
  }

  /* ══════════════════════════════════════════════════════════════════
     TITLE: a living diorama of the current world
     ══════════════════════════════════════════════════════════════════ */

  const dioramas = {};
  function diorama(world) {
    if (dioramas[world])
      return dioramas[world];
    const cols = 44, rows = 18;
    const tiles = new Uint8Array(cols * rows);
    for (let c = 0; c < cols; ++c) {
      const h = c % 22 > 15 && c % 22 < 19 ? 13 : 14;
      for (let r = h; r < rows; ++r)
        tiles[r * cols + c] = 1;
    }
    for (const [c0, r0, n] of [[5, 10, 4], [27, 9, 3], [36, 11, 3]])
      for (let k = 0; k < n; ++k)
        tiles[r0 * cols + c0 + k] = 2;
    const level = { cols: cols, rows: rows, tiles: tiles, world: world };
    dioramas[world] = { level: level, tiles: Tiles.create(level, { scale: bakeScale() }), w: cols * TS };
    return dioramas[world];
  }

  function drawTitle() {
    const world = Math.floor(time / 14) % 5;
    const d = diorama(world);
    const v = visibleRect();
    const camX = (time * 150) % d.w;
    const camY = 864 - 720;
    const sc = Scene.create(world);
    sc.drawBack(ctx, v, camX, camY, time);
    ctx.save();
    ctx.translate(-camX, -camY);
    for (const off of [0, d.w, -d.w]) {
      if (camX + v.x1 < off || camX + v.x0 > off + d.w)
        continue;
      ctx.save();
      ctx.translate(off, 0);
      const rect = { x0: camX + v.x0 - off, y0: camY + v.y0, x1: camX + v.x1 - off, y1: camY + v.y1 };
      d.tiles.draw(ctx, rect);
      ctx.restore();
    }
    /* the hero runs and hops, a foe trundles ahead, coins spin overhead */
    const heroX = camX + 430;
    const hopT = (time % 1.6) / 1.6;
    const hop = hopT < 0.45 ? Math.sin(hopT / 0.45 * Math.PI) * 120 : 0;
    const groundY = 14 * TS;
    const pose = hop > 0 ? (hopT < 0.22 ? 'jump' : 'fall') : 'run';
    drawSprite(Spr.hero(currentSkin(), pose, Math.floor(time * 14) % (Spr.HERO_FRAMES[pose] || 1)), heroX, groundY - hop);
    if (hop === 0 && Math.random() < 0.3)
      Fx.dust(fxMenu, 430, groundY - camY, '#d8c8a0', 1, 1);
    const foeX = camX + 780 + Math.sin(time * 0.7) * 30;
    drawSprite(Spr.enemy(['walker', 'charger', 'hopper', 'spiky', 'walker'][world], world, Math.floor(time * 7) % 4, 'normal'), foeX, groundY, true);
    for (let k = 0; k < 5; ++k) {
      const cx = camX + 560 + k * 70 - ((time * 150) % 70);
      drawSprite(Spr.item('coin', Math.floor(time * 12 + k) % 8), cx, groundY - 170 - Math.sin(k * 0.9) * 20);
    }
    ctx.restore();
    sc.drawFront(ctx, v, camX, camY, time);
    fxMenu.update(frameDt);
    Fx.ambient(fxMenu, world, v, frameDt);
    fxMenu.draw(ctx);

    /* logo */
    const bob = Math.sin(time * 1.6) * 6;
    drawGlow(VIEW_W / 2, 120 + bob, 700, '#ffd75a', 0.25);
    ui.drawHeadline('PLATFORMER', VIEW_W / 2, 112 + bob, 900, 96, '#ffe9a0', '#ff8a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Five worlds, thirty levels, one brave wanderer', VIEW_W / 2, 182 + bob, 700, 20, { weight: 'bold', color: '#ffffff', outline: 'rgba(10,20,40,0.8)' });
    currencyChips(Math.min(v.x1, VIEW_W) - 20, Math.max(v.y0, 0) + 16);

    const stars = Prog.totalStars(save);
    const bx = VIEW_W / 2 - 300, by = 228;
    drawButton('adv', 'Adventure', bx, by, 290, 66, { icon: 'map', iconColor: '#7ad04a', sub: stars + ' / 90 stars', action: () => openMap('adventure'), accent: '#7ad04a' });
    drawButton('trial', 'Time Trial', bx + 310, by, 290, 66, { icon: 'clock', iconColor: '#5ad1ff', sub: 'race your best ghost', action: () => openMap('trial'), accent: '#5ad1ff', disabled: !Object.keys(save.levels).length });
    drawButton('endless', 'Endless', bx, by + 82, 290, 66, { icon: 'bolt', iconColor: '#ff8a3a', sub: save.endless.best ? 'best ' + save.endless.best.toLocaleString() : 'how far can you go?', action: () => startEndless(null), accent: '#ff8a3a' });
    const daily = save.daily.date === localDate() && save.daily.bestTime ? 'today ' + formatTime(save.daily.bestTime) : 'a new course every day';
    drawButton('daily', 'Daily Run', bx + 310, by + 82, 290, 66, { icon: 'flag', iconColor: '#ffe08a', sub: daily, action: startDaily, accent: '#ffe08a' });
    const tp = Prog.treeProgress(save);
    drawButton('tree', 'Tech Tree', bx, by + 164, 290, 66, { icon: 'star', iconColor: '#c88aff', sub: tp.have + ' / ' + tp.total + ' upgrades', action: () => openTree('title'), accent: '#c88aff' });
    drawButton('wardrobe', 'Wardrobe', bx + 310, by + 164, 290, 66, { icon: 'trophy', iconColor: '#ff6a86', sub: 'skins and trails', action: () => openWardrobe('title'), accent: '#ff6a86' });
    drawButton('help', 'How to Play', VIEW_W / 2 - 145, by + 246, 290, 50, { icon: 'bolt', iconColor: '#bfe8ff', action: () => openHelp('title'), key: 'H' });
    ui.drawKeyHints([{ key: 'Arrows', label: 'Choose' }, { key: 'Enter', label: 'Select' }, { key: 'H', label: 'Help' }], VIEW_W / 2, Math.min(v.y1, VIEW_H) - 24, 600, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     WORLD MAP
     ══════════════════════════════════════════════════════════════════ */

  function openMap(mode) {
    mapMode = mode;
    if (mode === 'trial' && !Prog.levelDone(save, mapWorld, mapLevel)) {
      outer: for (let w = 0; w < 5; ++w)
        for (let i = 0; i < 6; ++i)
          if (Prog.levelDone(save, w, i)) { mapWorld = w; mapLevel = i; break outer; }
    } else if (!Prog.levelUnlocked(save, mapWorld, mapLevel)) {
      mapWorld = 0;
      mapLevel = 0;
    }
    setScreen('map');
  }

  function mapNode(i) {
    const x = 170 + i * 188;
    const y = 360 + Math.sin(i * 1.3 + mapWorld) * 70;
    return { x: x, y: y };
  }

  function mapPlayable(w, i) {
    return mapMode === 'trial' ? Prog.levelDone(save, w, i) : Prog.levelUnlocked(save, w, i);
  }

  function selectMapLevel(i) {
    if (i < 0 || i > 5)
      return;
    mapLevel = i;
    sfx('click', { volume: 0.5 });
  }

  function changeMapWorld(d) {
    const w = mapWorld + d;
    if (w < 0 || w > 4)
      return;
    if (!Prog.worldUnlocked(save, w)) {
      sfx('error', { volume: 0.4 });
      showToast('Defeat ' + WORLDS[w - 1].bossName + ' to reach ' + WORLDS[w].name, '#ffb0a0');
      return;
    }
    mapWorld = w;
    mapLevel = 0;
    fade = 0.6;
    sfx('whoosh');
  }

  function playMapLevel() {
    if (!mapPlayable(mapWorld, mapLevel)) {
      sfx('error', { volume: 0.4 });
      return;
    }
    startCampaign(mapWorld, mapLevel, mapMode);
  }

  const parCache = {};
  function parTime(spec) {
    if (!parCache[spec.id])
      parCache[spec.id] = Levels.build(spec).timeTarget;
    return parCache[spec.id];
  }

  function drawMap() {
    const W = WORLDS[mapWorld];
    menuBackdrop(mapWorld, 0.25);
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: W.color });
    ui.drawHeadline(mapMode === 'trial' ? 'Time Trial' : W.name, 330, 56, 560, 44, '#ffffff', W.accent);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('World ' + (mapWorld + 1) + ' of 5  -  ' + Prog.worldStars(save, mapWorld) + ' / 18 stars', 640, 56, 300, 15, { weight: 'bold', color: W.color });
    currencyChips(1236, 35);
    /* world arrows */
    drawButton('wprev', '<', 40, 330, 56, 70, { action: () => changeMapWorld(-1), disabled: mapWorld === 0, px: 28 });
    drawButton('wnext', '>', 1184, 330, 56, 70, { action: () => changeMapWorld(1), disabled: mapWorld === 4 || !Prog.worldUnlocked(save, mapWorld + 1), px: 28 });

    /* the trail between the nodes */
    ctx.save();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; ++pass) {
      ctx.beginPath();
      for (let i = 0; i < 6; ++i) {
        const n = mapNode(i);
        if (i === 0) ctx.moveTo(n.x, n.y);
        else {
          const p = mapNode(i - 1);
          ctx.bezierCurveTo((p.x + n.x) / 2, p.y, (p.x + n.x) / 2, n.y, n.x, n.y);
        }
      }
      ctx.lineWidth = pass ? 6 : 16;
      ctx.strokeStyle = pass ? 'rgba(255,240,200,0.85)' : 'rgba(20,14,30,0.55)';
      if (pass)
        ctx.setLineDash([2, 16]);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 6; ++i) {
      const n = mapNode(i);
      const unlocked = Prog.levelUnlocked(save, mapWorld, i);
      const playable = mapPlayable(mapWorld, i);
      const rec = save.levels['w' + mapWorld + 'l' + i];
      const sel = i === mapLevel;
      const boss = i === 5;
      const rad = boss ? 46 : 36;
      const index = registerHit('node' + i, n.x - rad, n.y - rad, rad * 2, rad * 2, ((k) => () => {
        if (mapLevel === k) playMapLevel();
        else selectMapLevel(k);
      })(i), !unlocked);
      if (mouseX >= n.x - rad && mouseX <= n.x + rad && mouseY >= n.y - rad && mouseY <= n.y + rad && pointerMoved)
        menuCursor = index;
      if (sel)
        drawGlow(n.x, n.y, 220, W.color, 0.45 + 0.15 * Math.sin(time * 4));
      ui.drawPanel(n.x - rad, n.y - rad, rad * 2, rad * 2, { radius: rad, noStuds: true, accent: sel ? '#ffd75a' : W.color, glow: sel,
        top: playable ? ui.hexToRgba(ui.shade(W.color, -0.35), 0.96) : 'rgba(40,44,60,0.95)', bottom: playable ? ui.hexToRgba(ui.shade(W.color, -0.75), 0.96) : 'rgba(16,18,28,0.95)' });
      if (!unlocked) {
        drawIcon('lock', '#a0a8c0', n.x, n.y, 30);
      } else if (boss) {
        drawIcon('skull', rec && rec.done ? '#ffd75a' : '#ff8a6a', n.x, n.y, 44);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(String(i + 1), n.x, n.y + 2, 50, 30, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.6)' });
      }
      const stars = Prog.starsOf(rec);
      for (let k = 0; k < 3; ++k) {
        ctx.save();
        ctx.globalAlpha = stars[k] ? 1 : 0.3;
        drawIcon('star', stars[k] ? '#ffd75a' : '#8a90a8', n.x - 26 + k * 26, n.y + rad + 16, 24);
        ctx.restore();
      }
      if (mapMode === 'trial' && rec && rec.bestTime) {
        ctx.textAlign = 'center';
        ui.fitText(formatTime(rec.bestTime), n.x, n.y - rad - 14, 120, 13, { weight: 'bold', color: '#bfe8ff', outline: 'rgba(0,0,0,0.7)' });
      }
    }
    /* the hero waits on the selected node */
    const sn = mapNode(mapLevel);
    drawSprite(Spr.hero(currentSkin(), 'idle', Math.floor(time * 4) % 4), sn.x, sn.y - (mapLevel === 5 ? 46 : 36) + 4);

    /* level card */
    const spec = Levels.CAMPAIGN[mapWorld][mapLevel];
    const rec = save.levels[spec.id];
    const cy = Math.min(v.y1, VIEW_H) - 178;
    ui.drawPanel(150, cy, 980, 150, { accent: W.color, title: (mapLevel === 5 ? 'Boss - ' : 'Level ' + (mapLevel + 1) + ' - ') + spec.name, titleRight: mapLevel === 5 ? W.bossName : spec.chunks.length - 2 + ' sections' });
    const stars = Prog.starsOf(rec);
    const labels = ['Reach the goal', 'Find all 3 gems', 'Beat par ' + parTime(spec) + 's'];
    for (let k = 0; k < 3; ++k) {
      const x = 180 + k * 220;
      drawIcon('star', stars[k] ? '#ffd75a' : '#5a6078', x, cy + 64, 30);
      ctx.textAlign = 'left';
      ui.fitText(labels[k], x + 22, cy + 65, 180, 15, { weight: 'bold', color: stars[k] ? '#ffe9a0' : ui.UI.textDim });
    }
    ctx.textAlign = 'left';
    ui.fitText(rec && rec.bestTime ? 'Best time ' + formatTime(rec.bestTime) : 'Not cleared yet', 180, cy + 112, 300, 15, { color: ui.UI.textDim });
    for (let k = 0; k < 3; ++k) {
      ctx.save();
      ctx.globalAlpha = rec && rec.gems[k] ? 1 : 0.25;
      drawSprite(Spr.item('gem', 0, k), 500 + k * 36, cy + 112, false, 0.7, 0.7);
      ctx.restore();
    }
    const playable = mapPlayable(mapWorld, mapLevel);
    drawButton('play', mapMode === 'trial' ? 'Start Trial' : 'Play', 840, cy + 44, 260, 56, { icon: mapMode === 'trial' ? 'clock' : 'flag', action: playMapLevel, disabled: !playable, accent: W.color, key: 'Enter' });
    drawButton('mback', 'Back', 40, 104, 130, 46, { action: () => setScreen('title'), key: 'Esc', px: 16 });
    ui.drawKeyHints([{ key: '<- ->', label: 'Level' }, { key: 'Q / E', label: 'World' }, { key: 'Enter', label: 'Play' }, { key: 'T', label: 'Tech Tree' }, { key: 'Esc', label: 'Back' }], VIEW_W / 2, Math.min(v.y1, VIEW_H) - 14, 700, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     TECH TREE
     ══════════════════════════════════════════════════════════════════ */

  function openTree(from) {
    treeFrom = from;
    if (!treeSelected)
      treeSelected = Prog.TREE[0].id;
    setScreen('tree');
  }

  function closeTree() {
    refreshStats();
    if (treeFrom === 'pause' && run) {
      state = 'pause';
      syncTouch();
    } else if (treeFrom === 'results') {
      state = 'results';
    } else {
      setScreen(treeFrom === 'map' ? 'map' : 'title');
    }
  }

  function treeDepth(node) {
    let d = 0;
    for (const r of node.req)
      d = Math.max(d, 1 + treeDepth(Prog.TREE_BY_ID[r[0]]));
    return d;
  }

  function treeLayout() {
    const branch = Prog.BRANCH_ORDER[treeBranch];
    const nodes = Prog.TREE.filter(n => n.branch === branch);
    const cols = [];
    for (const n of nodes) {
      const d = treeDepth(n);
      (cols[d] = cols[d] || []).push(n);
    }
    const GX = cols.length >= 4 ? 46 : 70, GY = 22, CH = 118;
    const CW = Math.min(300, Math.floor((1200 - (cols.length - 1) * GX) / cols.length));
    const totalW = cols.length * CW + (cols.length - 1) * GX;
    const x0 = VIEW_W / 2 - totalW / 2;
    const cards = [];
    cols.forEach((list, ci) => {
      const totalH = list.length * CH + (list.length - 1) * GY;
      const y0 = 190 + (440 - totalH) / 2;
      list.forEach((n, ri) => cards.push({ node: n, x: x0 + ci * (CW + GX), y: y0 + ri * (CH + GY), w: CW, h: CH, col: ci, row: ri }));
    });
    return cards;
  }

  function buyTreeNode(id) {
    const st = Prog.nodeState(save, id);
    if (st !== 'available') {
      sfx('error', { volume: 0.5 });
      if (st === 'expensive')
        showToast('Not enough coins or gems yet', '#ffb0a0');
      return;
    }
    Prog.buy(save, id);
    writeSave();
    refreshStats();
    treeFlash = { id: id, at: time };
    sfx('levelup');
    const n = Prog.TREE_BY_ID[id];
    showToast(n.name + ' ' + Prog.level(save, id) + ' unlocked!', Prog.BRANCHES[n.branch].color);
    const card = treeLayout().find(c => c.node.id === id);
    if (card) {
      Fx.starBurst(fxView, card.x + card.w / 2, card.y + card.h / 2);
      Fx.confetti(fxView, card.x + card.w / 2, card.y + 20, 20);
    }
    if (n.skin && save.skin === 'classic') {
      save.skin = n.skin;
      writeSave();
    }
    if (n.trail) {
      save.trail = n.trail;
      writeSave();
    }
  }

  function moveTree(dc, dr) {
    const cards = treeLayout();
    const cur = cards.find(c => c.node.id === treeSelected) || cards[0];
    let best = null, bd = Infinity;
    for (const c of cards) {
      if (c === cur)
        continue;
      const dx = c.col - cur.col, dy = (c.y - cur.y) / 140;
      if (dc && Math.sign(dx) !== dc) continue;
      if (dr && (dx !== 0 || Math.sign(dy) !== dr)) continue;
      const d = Math.abs(dx) * 3 + Math.abs(dy);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      treeSelected = best.node.id;
      sfx('click', { volume: 0.4 });
    } else if (dc) {
      treeBranch = (treeBranch + dc + 5) % 5;
      treeSelected = treeLayout()[0].node.id;
      sfx('click', { volume: 0.4 });
    }
  }

  function drawTree() {
    const branch = Prog.BRANCHES[Prog.BRANCH_ORDER[treeBranch]];
    if (treeFrom === 'pause' && run) {
      drawWorld(0);
      veil(0.78);
    } else {
      menuBackdrop(Math.floor(time / 14) % 5, 0.7);
    }
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: branch.color });
    ui.drawHeadline('Tech Tree', 190, 56, 300, 46, '#ffffff', branch.color);
    const tp = Prog.treeProgress(save);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(tp.have + ' / ' + tp.total + ' upgrades  -  effects apply at once', 380, 56, 380, 14, { weight: 'bold', color: ui.UI.textDim });
    currencyChips(1236, 35);
    /* branch tabs */
    for (let i = 0; i < 5; ++i) {
      const b = Prog.BRANCHES[Prog.BRANCH_ORDER[i]];
      const x = 90 + i * 224, y = 106, w = 204, h = 46;
      const active = i === treeBranch;
      const nodes = Prog.TREE.filter(n => n.branch === b.id);
      const have = nodes.reduce((a, n) => a + Prog.level(save, n.id), 0), total = nodes.reduce((a, n) => a + n.costs.length, 0);
      registerHit('tab' + i, x, y, w, h, ((k) => () => { treeBranch = k; treeSelected = treeLayout()[0].node.id; })(i));
      hitAreas[hitAreas.length - 1].tab = true;
      if (active)
        drawGlow(x + w / 2, y + h / 2, w * 1.5, b.color, 0.4);
      ui.drawPanel(x, y, w, h, { radius: 12, noStuds: true, glow: active, accent: b.color,
        top: ui.hexToRgba(ui.shade(b.color, -0.5), active ? 0.96 : 0.6), bottom: ui.hexToRgba(ui.shade(b.color, -0.85), active ? 0.96 : 0.6) });
      drawIcon(b.icon, b.color, x + 26, y + h / 2, 26);
      ctx.textAlign = 'left';
      ui.fitText(b.name, x + 46, y + h / 2 - 6, 110, 16, { weight: 'bold', color: active ? '#ffffff' : '#c8d2ea' });
      ui.fitText(have + ' / ' + total, x + 46, y + h / 2 + 12, 110, 11, { color: ui.UI.textDim });
    }
    const cards = treeLayout();
    if (!cards.some(c => c.node.id === treeSelected))
      treeSelected = cards[0].node.id;
    for (const card of cards)
      if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h && pointerMoved)
        treeSelected = card.node.id;
    /* connectors */
    const byId = {};
    for (const c of cards)
      byId[c.node.id] = c;
    for (const c of cards) {
      for (const [rid, rl] of c.node.req) {
        const from = byId[rid];
        if (!from)
          continue;
        const met = Prog.level(save, rid) >= rl;
        const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = c.x, y2 = c.y + c.h / 2, mx = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = met ? ui.hexToRgba(branch.color, 0.25) : 'rgba(0,0,0,0.4)';
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = met ? branch.color : '#3a4058';
        ctx.stroke();
        if (met) {
          const k = (time * 0.6) % 1;
          const bx = (1 - k) * (1 - k) * (1 - k) * x1 + 3 * (1 - k) * (1 - k) * k * mx + 3 * (1 - k) * k * k * mx + k * k * k * x2;
          const by = (1 - k) * (1 - k) * (1 - k) * y1 + 3 * (1 - k) * (1 - k) * k * y1 + 3 * (1 - k) * k * k * y2 + k * k * k * y2;
          drawGlow(bx, by, 26, branch.color, 0.9);
        }
      }
    }
    for (const card of cards)
      drawTreeCard(card, branch);
    /* the selected card's detail and buy button */
    const sel = byId[treeSelected];
    if (sel) {
      const n = sel.node, lv = Prog.level(save, n.id), st = Prog.nodeState(save, n.id);
      const y = Math.min(v.y1, VIEW_H) - 110;
      ui.drawPanel(90, y, 1100, 84, { accent: branch.color, radius: 14 });
      drawIcon(branch.icon, branch.color, 132, y + 42, 44);
      ctx.textAlign = 'left';
      ui.fitText(n.name + (n.costs.length > 1 ? '  ' + lv + ' / ' + n.costs.length : ''), 170, y + 26, 560, 20, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.fitText(n.desc[Math.min(lv, n.costs.length - 1)], 170, y + 56, 600, 15, { color: '#d0daf0' });
      const label = st === 'maxed' ? 'Owned' : 'Buy ' + costText(n.costs[lv]);
      drawButton('buy', label, 900, y + 14, 270, 56, { action: () => buyTreeNode(n.id), disabled: st !== 'available', accent: branch.color, key: 'Enter' });
    }
    ui.drawKeyHints([{ key: 'Arrows', label: 'Select' }, { key: 'Tab', label: 'Branch' }, { key: 'Enter', label: 'Buy' }, { key: 'Esc', label: 'Back' }], VIEW_W / 2, 172, 600, 0.95);
  }

  function costText(cost) {
    return cost.coins + ' coins' + (cost.gems ? ' + ' + cost.gems + (cost.gems === 1 ? ' gem' : ' gems') : '');
  }

  function drawTreeCard(card, branch) {
    const n = card.node, lv = Prog.level(save, n.id), st = Prog.nodeState(save, n.id);
    const sel = n.id === treeSelected;
    ctx.save();
    if (st === 'locked')
      ctx.globalAlpha = 0.5;
    if (sel)
      drawGlow(card.x + card.w / 2, card.y + card.h / 2, card.w * 1.4, branch.color, 0.45 + 0.1 * Math.sin(time * 3));
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: st === 'maxed' ? ui.UI.good : branch.color, glow: sel });
    if (st === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.45 + 0.35 * Math.sin(time * 4));
      ctx.stroke();
    }
    ui.drawPanel(card.x + 12, card.y + 14, 52, 52, { radius: 26, noStuds: true, accent: branch.color, top: ui.hexToRgba(ui.shade(branch.color, -0.4), 0.95), bottom: ui.hexToRgba(ui.shade(branch.color, -0.85), 0.95) });
    if (n.skin) {
      const skin = Prog.SKINS.find(s => s.id === n.skin);
      drawSprite(Spr.hero(skin, 'idle', Math.floor(time * 4) % 4), card.x + 38, card.y + 66, false, 0.7, 0.7);
    } else if (n.trail) {
      drawIcon('star', branch.color, card.x + 38, card.y + 40, 30);
    } else {
      drawIcon(nodeIcon(n), branch.color, card.x + 38, card.y + 40, 30);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(n.name, card.x + 76, card.y + 26, card.w - 140, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.drawChip(lv + ' / ' + n.costs.length, card.x + card.w - 12, card.y + 14, 22, { align: 'right', px: 12, color: st === 'maxed' ? ui.UI.good : ui.UI.textDim });
    ui.drawTextBlock(n.desc[Math.min(lv, n.costs.length - 1)], card.x + 76, card.y + 40, card.w - 90, 40, 13, { color: ui.UI.textDim });
    for (let l = 0; l < n.costs.length; ++l) {
      ui.roundRectPath(card.x + 76 + l * 22, card.y + card.h - 22, 18, 8, 3);
      ctx.fillStyle = l < lv ? branch.color : 'rgba(255,255,255,0.08)';
      ctx.fill();
    }
    ctx.textAlign = 'right';
    if (st === 'maxed') {
      ui.fitText('MAX', card.x + card.w - 14, card.y + card.h - 18, 80, 13, { weight: 'bold', color: ui.UI.good });
    } else if (st === 'locked') {
      const miss = n.req.filter(r => Prog.level(save, r[0]) < r[1]).map(r => Prog.TREE_BY_ID[r[0]].name);
      ui.fitText('needs ' + miss.join(', '), card.x + card.w - 14, card.y + card.h - 18, 190, 12, { color: ui.UI.warn });
    } else {
      const c = n.costs[lv];
      ui.fitText(costText(c), card.x + card.w - 14, card.y + card.h - 18, 190, 13, { weight: 'bold', color: st === 'expensive' ? ui.UI.bad : ui.UI.gold });
    }
    if (treeFlash && treeFlash.id === n.id && time - treeFlash.at < 0.35) {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - (time - treeFlash.at) / 0.35)).toFixed(3) + ')';
      ctx.fill();
    }
    ctx.restore();
    const idx = registerHit('card' + n.id, card.x, card.y, card.w, card.h, () => {
      if (treeSelected === n.id) buyTreeNode(n.id);
      else treeSelected = n.id;
    });
    hitAreas[idx].card = true;
  }

  function nodeIcon(n) {
    return {
      wallJump: 'boot', airControl: 'boot', dash: 'bolt', doubleJump: 'boot',
      hearts: 'heart', mercy: 'shield', mender: 'flag', shield: 'shield',
      magnet: 'magnet', coinBonus: 'coin', lucky: 'coin', radar: 'gem',
      fire: 'flame', shockwave: 'bolt', slayer: 'skull'
    }[n.id] || 'star';
  }

  /* ══════════════════════════════════════════════════════════════════
     WARDROBE
     ══════════════════════════════════════════════════════════════════ */

  function openWardrobe(from) {
    wardrobeFrom = from;
    setScreen('wardrobe');
  }

  function closeWardrobe() {
    if (wardrobeFrom === 'pause' && run) {
      state = 'pause';
      syncTouch();
    } else {
      setScreen('title');
    }
  }

  function drawWardrobe() {
    if (wardrobeFrom === 'pause' && run) {
      drawWorld(0);
      veil(0.78);
    } else {
      menuBackdrop(Math.floor(time / 14) % 5, 0.62);
    }
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: '#ff6a86' });
    ui.drawHeadline('Wardrobe', 180, 56, 300, 46, '#ffffff', '#ff6a86');
    currencyChips(1236, 35);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('HERO', 90, 122, 200, 16, { weight: 'bold', color: '#ffb0c0' });
    Prog.SKINS.forEach((k, i) => {
      const x = 90 + i * 186, y = 136, w = 170, h = 250;
      const owned = Prog.skinOwned(save, k.id);
      const on = save.skin === k.id;
      const idx = registerHit('skin' + k.id, x, y, w, h, () => {
        if (!owned) { sfx('error', { volume: 0.4 }); showToast(skinRequirement(k), '#ffb0a0'); return; }
        save.skin = k.id;
        writeSave();
      });
      const hot = isHot(idx, x, y, w, h);
      if (on)
        drawGlow(x + w / 2, y + h / 2, w * 1.6, k.tunic, 0.4);
      ui.drawPanel(x, y, w, h, { accent: on ? '#ffd75a' : k.trim, glow: on || hot });
      ctx.save();
      if (!owned)
        ctx.globalAlpha = 0.4;
      const pose = hot || on ? 'run' : 'idle';
      drawSprite(Spr.hero(k, pose, Math.floor(time * (pose === 'run' ? 12 : 4)) % Spr.HERO_FRAMES[pose]), x + w / 2, y + 170, false, 1.7, 1.7);
      ctx.restore();
      ctx.textAlign = 'center';
      ui.fitText(k.name, x + w / 2, y + 196, w - 20, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.fitText(on ? 'Wearing' : owned ? 'Click to wear' : skinRequirement(k), x + w / 2, y + 224, w - 20, 12, { color: on ? ui.UI.good : owned ? ui.UI.textDim : ui.UI.warn });
      if (!owned)
        drawIcon('lock', '#c0c8e0', x + w / 2, y + 96, 36);
    });
    ctx.textAlign = 'left';
    ui.fitText('TRAIL', 90, 418, 200, 16, { weight: 'bold', color: '#ffb0c0' });
    Prog.TRAILS.forEach((t, i) => {
      const x = 90 + i * 280, y = 432, w = 260, h = 92;
      const owned = Prog.trailOwned(save, t.id);
      const on = save.trail === t.id;
      const idx = registerHit('trail' + t.id, x, y, w, h, () => {
        if (!owned) { sfx('error', { volume: 0.4 }); showToast('Unlock ' + Prog.TREE_BY_ID[t.node].name + ' in the Style branch', '#ffb0a0'); return; }
        save.trail = t.id;
        writeSave();
      });
      const hot = isHot(idx, x, y, w, h);
      ui.drawPanel(x, y, w, h, { accent: on ? '#ffd75a' : '#c88aff', glow: on || hot });
      /* a swatch of the trail */
      for (let k = 0; k < 7; ++k) {
        const px = x + 30 + k * 14, py = y + 46 + Math.sin(time * 6 + k) * 6;
        const col = t.id === 'rainbow' ? ['#ff5a5a', '#ffa83a', '#ffe14a', '#6ae06a', '#4ab8ff', '#a87aff', '#ff5a5a'][k] : t.id === 'spark' ? '#ffd75a' : t.id === 'shadow' ? '#6a5a9a' : '#3a4058';
        if (t.id !== 'none')
          drawGlow(px, py, 26 - k * 2, col, owned ? 0.9 - k * 0.1 : 0.3);
      }
      ctx.textAlign = 'left';
      ui.fitText(t.name, x + 140, y + 34, 110, 18, { weight: 'bold', color: owned ? '#ffffff' : ui.UI.textMute, font: ui.TITLE_FONT });
      ui.fitText(on ? 'Active' : owned ? 'Click to use' : 'Style branch', x + 140, y + 62, 110, 12, { color: on ? ui.UI.good : ui.UI.textDim });
    });
    drawButton('wback', 'Back', VIEW_W / 2 - 110, Math.min(v.y1, VIEW_H) - 96, 220, 54, { action: closeWardrobe, key: 'Esc' });
  }

  function skinRequirement(k) {
    if (k.stars)
      return 'Earn ' + k.stars + ' stars (' + Prog.totalStars(save) + ')';
    return 'Tech Tree: ' + Prog.TREE_BY_ID[k.node].name;
  }

  /* ══════════════════════════════════════════════════════════════════
     HELP
     ══════════════════════════════════════════════════════════════════ */

  const HELP_PAGES = ['Basics', 'Moves', 'Things', 'Foes', 'Modes'];

  function openHelp(from) {
    helpFrom = from;
    helpPage = 0;
    if (from === 'pause') {
      state = 'help';
      syncTouch();
    } else {
      setScreen('help');
    }
  }

  function closeHelp() {
    if (!save.tutorialSeen) {
      save.tutorialSeen = true;
      writeSave();
    }
    if (helpFrom === 'pause' && run) {
      state = 'pause';
      syncTouch();
    } else {
      setScreen('title');
    }
  }

  function helpRow(y, sprite, title, text, x0) {
    const x = x0 || 150;
    if (sprite)
      sprite();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(title, x + 90, y - 12, 380, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.drawTextBlock(text, x + 90, y + 2, 400, 40, 14, { color: '#c8d2ea' });
  }

  function drawHelp() {
    if (helpFrom === 'pause' && run) {
      drawWorld(0);
      veil(0.8);
    } else {
      menuBackdrop(0, 0.66);
    }
    const v = visibleRect();
    ui.drawPanel(110, 30, 1060, 600, { accent: '#5ab8ff', title: 'How to Play - ' + HELP_PAGES[helpPage], titleRight: (helpPage + 1) + ' / ' + HELP_PAGES.length, headerH: 40, titlePx: 20 });
    const skin = currentSkin();
    const hero = (pose, x, y) => () => drawSprite(Spr.hero(skin, pose, Math.floor(time * 10) % Spr.HERO_FRAMES[pose]), x, y, false, 1.2, 1.2);
    const icon = (name, color, x, y) => () => drawIcon(name, color, x, y, 44);
    const item = (kind, x, y, variant, k) => () => drawSprite(Spr.item(kind, Math.floor(time * 8) % (Spr.ITEM_FRAMES[kind] || 1), variant), x, y, false, k || 1, k || 1);
    const foe = (type, x, y) => () => drawSprite(Spr.enemy(type, Math.floor(time / 3) % 5, Math.floor(time * 7) % Spr.ENEMY_FRAMES[type], 'normal'), x, y);
    if (helpPage === 0) {
      helpRow(130, hero('run', 190, 162), 'Run', 'Arrow keys or A / D. Touch: the stick on the left.');
      helpRow(210, hero('jump', 190, 242), 'Jump', 'Space, Up, W or Z. Hold for a higher jump, tap for a hop. A jump pressed just before landing still counts, and so does one just after running off a ledge.');
      helpRow(290, hero('fall', 190, 322), 'Drop down', 'Hold Down and press Jump to drop through a ledge.');
      helpRow(370, icon('flag', '#ffe08a', 190, 360), 'Reach the goal', 'Every level ends at a glowing gate. Checkpoint banners save your progress on the way.');
      helpRow(450, icon('heart', '#ff4a6a', 190, 440), 'Hearts', 'Spikes, foes and shots cost a heart; falling into a pit or liquid costs one and puts you back on safe ground. Lose them all and you restart at the last checkpoint.');
      helpRow(130, icon('star', '#ffd75a', 640, 120), 'Three stars', 'One for reaching the goal, one for finding all three hidden gems, one for beating the par time.', 600);
      helpRow(210, icon('coin', '#ffd75a', 640, 200), 'Coins and gems', 'Spend them in the Tech Tree on new moves, hearts, magnets, fire and style.', 600);
      helpRow(290, icon('shield', '#8ad8ff', 640, 280), 'Pause', 'Escape or P. From the pause menu you can open the Tech Tree mid-level - upgrades work at once.', 600);
    } else if (helpPage === 1) {
      helpRow(140, hero('wall', 190, 172), 'Wall Kick (Movement)', 'Slide down walls by pushing into them; with Wall Kick press Jump to kick off and climb.');
      helpRow(230, hero('dash', 190, 262), 'Dash (Movement)', 'Shift or X bursts sideways, once per jump. It smashes crates. Dash II lasts longer and every stomp refreshes it.');
      helpRow(320, hero('jump', 190, 352), 'Cloud Step (Movement)', 'Jump again in mid-air.');
      helpRow(410, item('fireball', 190, 400), 'Fireballs (C or F)', 'From a power block or the Ember Heart upgrade. They bounce along the ground and burn foes, even spiky ones.');
      helpRow(500, hero('fall', 190, 532), 'Stomp', 'Land on a foe to defeat it and bounce. Hold Jump while stomping to bounce higher. Chain stomps for a combo.');
      helpRow(140, icon('bolt', '#ff8a3a', 640, 130), 'Stomp Shockwave', 'An Arsenal upgrade: stomps flatten every foe close by.', 600);
      helpRow(230, icon('magnet', '#ffd75a', 640, 220), 'Coin Magnet', 'A Fortune upgrade: coins fly to you from further away.', 600);
      helpRow(320, icon('gem', '#4aff8a', 640, 310), 'Gem Radar', 'An arrow and a chime lead you to the nearest hidden gem.', 600);
    } else if (helpPage === 2) {
      helpRow(130, item('qblock', 190, 120, 0), 'Coin block', 'Hit it from below for coins. Power blocks hold fireballs, a heart or an invincibility star.');
      helpRow(210, item('crate', 190, 200, 0), 'Crate', 'Breaks when hit from below, dashed into or burned.');
      helpRow(290, item('crumble', 190, 280, 0), 'Crumbling block', 'Gives way a moment after you land on it, and grows back a few seconds later.');
      helpRow(370, item('spring', 190, 360, 0), 'Spring', 'Launches you high into the air.');
      helpRow(450, item('checkpoint', 190, 478, 1, 0.62), 'Checkpoint', 'Touch the banner to raise it: you restart here.');
      helpRow(130, item('gem', 640, 120, 0), 'Hidden gems', 'Three per level, tucked behind fake walls, up high or across danger. Some need upgrades.', 600);
      helpRow(210, item('star', 640, 200), 'Star', 'Invincible for a while: run straight through foes.', 600);
      helpRow(290, item('heart', 640, 280), 'Heart', 'Restores one heart.', 600);
      helpRow(370, item('platform', 604, 362, 0, 0.5), 'Moving platforms', 'Ride sliding platforms and lifts - wait for the right moment.', 600);
    } else if (helpPage === 3) {
      helpRow(130, foe('walker', 190, 150), 'Walker', 'Patrols its ledge. Stomp it.');
      helpRow(210, foe('charger', 190, 230), 'Charger', 'Lowers its head and charges when it sees you, then stands dazed.');
      helpRow(290, foe('hopper', 190, 310), 'Hopper', 'Leaps toward you every few seconds.');
      helpRow(370, foe('spiky', 190, 390), 'Spiky', 'Cannot be stomped. Burn it, flatten it with a shockwave or jump over it.');
      helpRow(130, () => drawSprite(Spr.enemy('flyer', Math.floor(time / 3) % 5, Math.floor(time * 10) % 4, 'normal'), 640, 130), 'Flyer', 'Drifts through the air in loops.', 600);
      helpRow(210, () => drawSprite(Spr.enemy('diver', Math.floor(time / 3) % 5, Math.floor(time * 10) % 4, 'normal'), 640, 210), 'Diver', 'Waits high up and swoops at you when you pass below.', 600);
      helpRow(290, foe('turret', 640, 310), 'Turret', 'Glows, then fires at you. Stomp it or burn it.', 600);
      helpRow(370, icon('skull', '#ff8a6a', 640, 360), 'Bosses', 'Each world ends with a boss in three phases. Stomp it when it is open - watch for its tells.', 600);
    } else {
      helpRow(140, icon('map', '#7ad04a', 190, 130), 'Adventure', 'Five worlds of six levels, each ending in a boss. Win stars, coins and gems; beat a boss to open the next world.');
      helpRow(230, icon('clock', '#5ad1ff', 190, 220), 'Time Trial', 'Replay any cleared level against the ghost of your best run.');
      helpRow(320, icon('bolt', '#ff8a3a', 190, 310), 'Endless', 'Stage after stage of fresh courses through every world. Your hearts carry over; how far can you get?');
      helpRow(410, icon('flag', '#ffe08a', 190, 400), 'Daily Run', 'One long course a day, the same for everyone. The first clear of the day pays a bonus.');
      helpRow(500, icon('star', '#c88aff', 190, 490), 'Tech Tree', 'Five branches: Movement, Survival, Fortune, Arsenal and Style. Open it from the title or the pause menu.');
    }
    drawButton('hprev', 'Back', 150, 556, 200, 52, { action: () => { if (helpPage > 0) --helpPage; else closeHelp(); } });
    drawButton('hnext', helpPage < HELP_PAGES.length - 1 ? 'Next' : 'Done', 930, 556, 200, 52, { action: () => { if (helpPage < HELP_PAGES.length - 1) ++helpPage; else closeHelp(); }, key: 'Enter' });
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      drawGlow(560 + i * 40, 582, i === helpPage ? 40 : 20, '#5ab8ff', i === helpPage ? 1 : 0.4);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PAUSE & RESULTS
     ══════════════════════════════════════════════════════════════════ */

  function pauseGame() {
    if (state === 'play' && run && run.clearT <= 0 && run.koT <= 0) {
      state = 'pause';
      menuCursor = 0;
      held.clear();
      sfx('click');
      syncTouch();
    }
  }

  function resumeGame() {
    if (state === 'pause') {
      state = 'play';
      held.clear();
      pressed.clear();
      syncTouch();
    }
  }

  function quitToMenu() {
    if (run && (run.mode === 'adventure' || run.mode === 'trial')) {
      mapMode = run.mode;
      setScreen('map');
    } else {
      setScreen('title');
    }
    run = null;
  }

  function drawPause() {
    veil(0.6);
    const x = VIEW_W / 2 - 220, y = 120;
    ui.drawPanel(x, y, 440, 470, { accent: WORLDS[run.world].color, title: 'Paused', titleRight: run.level.name, headerH: 38, titlePx: 20 });
    const items = [
      ['Resume', resumeGame, 'Esc'],
      ['Restart', restartLevel, 'R'],
      ['Tech Tree', () => openTree('pause'), 'T'],
      ['Wardrobe', () => openWardrobe('pause'), ''],
      ['How to Play', () => openHelp('pause'), 'H'],
      [run.mode === 'adventure' || run.mode === 'trial' ? 'Quit to Map' : 'Quit to Title', quitToMenu, 'Q']
    ];
    items.forEach((it, i) => drawButton('p' + i, it[0], x + 40, y + 60 + i * 66, 360, 54, { action: it[1], key: it[2] || undefined }));
  }

  function drawResults(dt) {
    if (run) {
      drawWorld(0);
    }
    veil(0.55);
    const res = results;
    res.t += dt;
    const v = visibleRect();
    if (res.mode === 'endless') {
      ui.drawPanel(VIEW_W / 2 - 330, 110, 660, 470, { accent: '#ff8a3a' });
      ui.drawHeadline('Run Over', VIEW_W / 2, 170, 560, 64, '#ffe9a0', '#ff8a3a');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rows = [['Stages cleared', String(res.stage)], ['Coins', String(Math.floor(Math.min(1, res.t / 1.2) * res.coins))], ['Gems', String(res.gems)], ['Time', formatTime(res.time)]];
      rows.forEach((rw, i) => {
        ctx.textAlign = 'left';
        ui.fitText(rw[0], VIEW_W / 2 - 230, 250 + i * 40, 240, 18, { color: ui.UI.textDim });
        ctx.textAlign = 'right';
        ui.fitText(rw[1], VIEW_W / 2 + 230, 250 + i * 40, 200, 20, { weight: 'bold', color: '#ffffff' });
      });
      ctx.textAlign = 'center';
      ui.drawHeadline(res.score.toLocaleString(), VIEW_W / 2, 430, 400, 46, '#ffd75a', '#ff8a2a');
      if (res.best)
        ui.fitText('New best run!', VIEW_W / 2, 468, 300, 16, { weight: 'bold', color: ui.UI.good });
      drawButton('again', 'Run Again', VIEW_W / 2 - 300, 500, 190, 54, { action: () => startEndless(null), key: 'Enter' });
      drawButton('rtree', 'Tech Tree', VIEW_W / 2 - 95, 500, 190, 54, { action: () => openTree('results') });
      drawButton('rtitle', 'Title', VIEW_W / 2 + 110, 500, 190, 54, { action: () => { run = null; setScreen('title'); } });
      return;
    }
    const W = WORLDS[res.world];
    ui.drawPanel(VIEW_W / 2 - 360, 70, 720, 560, { accent: W.color });
    ui.drawHeadline(res.mode === 'daily' ? 'Daily Run Clear!' : 'Level Clear!', VIEW_W / 2, 128, 640, 58, '#ffe9a0', '#ff9a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(res.name, VIEW_W / 2, 172, 600, 18, { weight: 'bold', color: W.color });
    /* stars pop in one by one */
    const stars = res.stars;
    const labels = ['Goal', 'All gems', 'Par ' + res.target + 's'];
    for (let k = 0; k < 3; ++k) {
      const at = 0.4 + k * 0.45;
      const x = VIEW_W / 2 + (k - 1) * 150, y = 250;
      const kk = Math.max(0, Math.min(1, (res.t - at) / 0.35));
      if (stars[k] && kk > 0 && !res['pop' + k]) {
        res['pop' + k] = true;
        Fx.starBurst(fxView, x, y);
        sfx('coin', { pitch: 1 + k * 0.2 });
      }
      drawIcon('star', '#3a4058', x, y, 84);
      if (stars[k] && kk > 0) {
        const s = kk < 0.7 ? 0.4 + kk / 0.7 * 0.8 : 1.2 - (kk - 0.7) / 0.3 * 0.2;
        drawGlow(x, y, 160, '#ffd75a', 0.5 * kk);
        drawIcon('star', '#ffd75a', x, y, 84 * s);
      }
      ui.fitText(labels[k], x, y + 56, 140, 14, { weight: 'bold', color: stars[k] ? '#ffe9a0' : ui.UI.textMute });
    }
    /* tallies */
    const shown = Math.floor(Math.min(1, Math.max(0, res.t - 1.6) / 1.0) * res.coins);
    if (shown !== res.lastShown && shown > 0) {
      res.lastShown = shown;
      if (shown % 3 === 0)
        sfx('coin', { volume: 0.25, pitch: 1.4 });
    }
    const rows = [
      ['coin', '#ffd75a', 'Coins', shown + (res.bonus ? '  + ' + res.bonus + ' bonus' : '')],
      ['clock', '#bfe8ff', 'Time', formatTime(res.time) + (res.newBest && res.prevBest ? '   new best!' : res.prevBest ? '   best ' + formatTime(Math.min(res.prevBest, res.time)) : '')],
      ['gem', '#4aff8a', 'Gems', res.gems.filter(Boolean).length + ' / 3' + (res.newGems ? '   +' + res.newGems + ' to spend' : '')]
    ];
    if (res.mode !== 'daily')
      rows.push(['skull', '#ff8a6a', 'Knock-outs', String(res.deaths)]);
    rows.forEach((rw, i) => {
      const y = 350 + i * 40;
      drawIcon(rw[0], rw[1], VIEW_W / 2 - 250, y, 26);
      ctx.textAlign = 'left';
      ui.fitText(rw[2], VIEW_W / 2 - 226, y + 1, 160, 17, { color: ui.UI.textDim });
      ctx.textAlign = 'right';
      ui.fitText(rw[3], VIEW_W / 2 + 260, y + 1, 360, 18, { weight: 'bold', color: '#ffffff' });
    });
    if (res.unlockedWorld)
      ui.drawChip(WORLDS[res.unlockedWorld].name + ' unlocked!', VIEW_W / 2, 518, 30, { align: 'center', px: 15, color: WORLDS[res.unlockedWorld].color });
    const y = 560;
    const hasNext = res.mode === 'adventure' && !(res.world === 4 && Levels.CAMPAIGN[res.world][5].id === run.spec.id);
    const next = () => {
      const idx = run.spec.index;
      if (idx < 5) startCampaign(res.world, idx + 1, 'adventure');
      else if (res.world < 4) startCampaign(res.world + 1, 0, 'adventure');
    };
    if (hasNext)
      drawButton('rnext', 'Next', VIEW_W / 2 - 330, y, 150, 54, { action: next, key: 'Enter', accent: W.color });
    drawButton('rretry', 'Retry', VIEW_W / 2 - 165, y, 150, 54, { action: restartLevel, key: 'R' });
    drawButton('rtree', 'Tech Tree', VIEW_W / 2, y, 160, 54, { action: () => openTree('results'), key: 'T' });
    drawButton('rmap', res.mode === 'daily' ? 'Title' : 'Map', VIEW_W / 2 + 175, y, 150, 54, { action: quitToMenu, key: 'Esc' });
  }

  /* ══════════════════════════════════════════════════════════════════
     LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const raw = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(raw, MAX_DT));
    lastTimestamp = timestamp;
    frameDt = dt;
    time += dt;
    beginFrame();
    hitAreas.length = 0;
    const v = visibleRect();

    if (state === 'play' && run) {
      updatePlay(dt);
      if (state === 'play' && run) {
        updateCamera(dt);
        fxWorld.update(dt);
        texts.update(dt);
        Fx.ambient(fxWorld, run.world, worldRect(v), dt);
        drawWorld(dt);
        drawHUD();
      }
    }
    if (state === 'pause' && run) {
      drawWorld(0);
      drawHUD();
      drawPause();
    } else if (state === 'results' && results) {
      drawResults(dt);
    } else if (state === 'title') {
      drawTitle();
    } else if (state === 'map') {
      drawMap();
    } else if (state === 'tree') {
      drawTree();
    } else if (state === 'wardrobe') {
      drawWardrobe();
    } else if (state === 'help') {
      drawHelp();
    }
    if (state !== 'play' && toast)
      drawToastOnly();
    fxView.update(dt);
    fxView.draw(ctx);
    viewTexts.update(dt);
    viewTexts.draw(ctx);
    flash.update(dt);
    flash.draw(ctx, v);
    drawFade(dt, v);
    updateStatusBar();
    requestAnimationFrame(gameLoop);
  }

  function drawToastOnly() {
    toast.t += frameDt;
    if (toast.t > 2.4) {
      toast = null;
      return;
    }
    const k = toast.t;
    const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = ui.uiFont(20, 'bold');
    const w = Math.min(700, ctx.measureText(toast.text).width + 60);
    ui.drawPanel(VIEW_W / 2 - w / 2, 640, w, 42, { radius: 18, noStuds: true, accent: toast.color, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(toast.text, VIEW_W / 2, 662, w - 30, 19, { weight: 'bold', color: toast.color });
    ctx.restore();
  }

  function drawFade(dt, v) {
    if (fade <= 0)
      return;
    ctx.fillStyle = 'rgba(6,10,24,' + Math.min(1, fade).toFixed(3) + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    fade = Math.max(0, fade - dt * FADE_RATE);
  }

  const STATE_NAMES = { title: 'Title', map: 'World Map', tree: 'Tech Tree', wardrobe: 'Wardrobe', help: 'How to Play', play: 'Playing', pause: 'Paused', results: 'Results' };
  let statusCache = '';

  function updateStatusBar() {
    const coins = run && (state === 'play' || state === 'pause') ? Math.floor(run.coinsRun) : save.coins;
    const lvl = run ? run.level.name : '--';
    const hearts = run ? run.hearts + ' / ' + run.maxHearts : '--';
    const st = STATE_NAMES[state] || state;
    const key = coins + '|' + lvl + '|' + hearts + '|' + st;
    if (key === statusCache)
      return;
    statusCache = key;
    statusScore.textContent = 'Coins: ' + coins;
    statusLevel.textContent = 'Level: ' + lvl;
    statusLives.textContent = 'Hearts: ' + hearts;
    statusState.textContent = st;
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT HANDLERS
     ══════════════════════════════════════════════════════════════════ */

  function back() {
    switch (state) {
      case 'play': pauseGame(); break;
      case 'pause': resumeGame(); break;
      case 'map': setScreen('title'); break;
      case 'tree': closeTree(); break;
      case 'wardrobe': closeWardrobe(); break;
      case 'help': closeHelp(); break;
      case 'results': quitToMenu(); break;
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))
      return;
    if (document.querySelector('.dialog-overlay.visible'))
      return;
    const code = e.code;
    if (code === 'F2') {
      e.preventDefault();
      run = null;
      setScreen('title');
      return;
    }
    if (code === 'Escape' || code === 'KeyP' && (state === 'play' || state === 'pause')) {
      e.preventDefault();
      if (!e.repeat)
        back();
      return;
    }
    if (state === 'play') {
      const a = KEYMAP[code];
      if (a) {
        e.preventDefault();
        if (!e.repeat && !held.has(a))
          pressed.add(a);
        held.add(a);
      } else if (code === 'KeyR' && !e.repeat) {
        restartLevel();
      } else if (code === 'KeyH' && !e.repeat) {
        pauseGame();
        openHelp('pause');
      } else if (code === 'KeyT' && !e.repeat) {
        pauseGame();
        openTree('pause');
      }
      return;
    }
    if (e.repeat && (code === 'Enter' || code === 'Space'))
      return;
    if (state === 'tree') {
      if (code === 'ArrowLeft' || code === 'KeyA') moveTree(-1, 0);
      else if (code === 'ArrowRight' || code === 'KeyD') moveTree(1, 0);
      else if (code === 'ArrowUp' || code === 'KeyW') moveTree(0, -1);
      else if (code === 'ArrowDown' || code === 'KeyS') moveTree(0, 1);
      else if (code === 'Tab') { treeBranch = (treeBranch + (e.shiftKey ? 4 : 1)) % 5; treeSelected = treeLayout()[0].node.id; sfx('click'); }
      else if (/^Digit[1-5]$/.test(code)) { treeBranch = Number(code.charAt(5)) - 1; treeSelected = treeLayout()[0].node.id; }
      else if (code === 'Enter' || code === 'Space') buyTreeNode(treeSelected);
      e.preventDefault();
      return;
    }
    if (state === 'map') {
      if (code === 'ArrowLeft' || code === 'KeyA') selectMapLevel(mapLevel - 1);
      else if (code === 'ArrowRight' || code === 'KeyD') selectMapLevel(mapLevel + 1);
      else if (code === 'KeyQ' || code === 'PageUp' || code === 'ArrowUp' || code === 'KeyW') changeMapWorld(-1);
      else if (code === 'KeyE' || code === 'PageDown' || code === 'ArrowDown' || code === 'KeyS') changeMapWorld(1);
      else if (code === 'Enter' || code === 'Space') playMapLevel();
      else if (code === 'KeyT') openTree('map');
      e.preventDefault();
      return;
    }
    if (state === 'help') {
      if (code === 'ArrowRight' || code === 'Enter' || code === 'Space' || code === 'KeyD') {
        if (helpPage < HELP_PAGES.length - 1) ++helpPage;
        else closeHelp();
        sfx('click');
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        if (helpPage > 0) { --helpPage; sfx('click'); }
      }
      e.preventDefault();
      return;
    }
    if (state === 'title' && code === 'KeyH') {
      openHelp('title');
      return;
    }
    if (state === 'pause') {
      if (code === 'KeyR') { restartLevel(); return; }
      if (code === 'KeyT') { openTree('pause'); return; }
      if (code === 'KeyH') { openHelp('pause'); return; }
      if (code === 'KeyQ') { quitToMenu(); return; }
    }
    if (state === 'results') {
      if (code === 'KeyR') { restartLevel(); return; }
      if (code === 'KeyT') { openTree('results'); return; }
    }
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
      moveCursor(-1);
      pointerMoved = false;
      e.preventDefault();
    } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD' || code === 'Tab') {
      moveCursor(1);
      pointerMoved = false;
      e.preventDefault();
    } else if (code === 'Enter' || code === 'Space') {
      e.preventDefault();
      activate(hitAreas[menuCursor]);
    }
  });

  document.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a)
      held.delete(a);
  });

  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerToView(e);
    if (Math.abs(p.x - mouseX) > 0.5 || Math.abs(p.y - mouseY) > 0.5)
      pointerMoved = true;
    mouseX = p.x;
    mouseY = p.y;
  });

  canvas.addEventListener('pointerleave', () => {
    mouseX = -1;
    mouseY = -1;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = pointerToView(e);
    mouseX = p.x;
    mouseY = p.y;
    pointerMoved = true;
    if (state === 'play')
      return;
    for (let i = hitAreas.length - 1; i >= 0; --i) {
      const h = hitAreas[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        menuCursor = i;
        activate(h);
        return;
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     TOUCH CONTROLS: only during play on touch screens
     ══════════════════════════════════════════════════════════════════ */

  let touch = null;
  let touchUsed = false;

  function syncTouch() {
    if (!touch)
      return;
    if (touch.visible)
      touchUsed = true;
    if (!touchUsed)
      return;
    if (state === 'play')
      touch.show();
    else
      touch.hide();
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR & OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        run = null;
        setScreen('title');
        break;
      case 'pause':
        if (state === 'play') pauseGame();
        else if (state === 'pause') resumeGame();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'tech-tree':
        if (state === 'play') pauseGame();
        openTree(state === 'pause' ? 'pause' : 'title');
        break;
      case 'tutorial':
        if (state === 'play') pauseGame();
        openHelp(state === 'pause' ? 'pause' : 'title');
        break;
      case 'controls':
        if (state === 'play') pauseGame();
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        if (state === 'play') pauseGame();
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  function updateWindowTitle() {
    const title = run ? 'Platformer - ' + run.level.name : 'Platformer';
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  function handleResize() {
    setupCanvas();
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }
  window.addEventListener('resize', handleResize);
  if (window.ResizeObserver)
    new ResizeObserver(handleResize).observe(canvas);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();
  new SZ.MenuBar({ onAction: handleAction });

  loadSave();
  loadHighScores();
  refreshStats();
  setupCanvas();
  SZ.GameAudio.attachMuteButton();
  touch = SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'horizontal',
    buttons: [
      { label: 'Jump', code: 'Space' },
      { label: 'Dash', code: 'KeyX' },
      { label: 'Fire', code: 'KeyC' }
    ],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });
  window.addEventListener('touchstart', () => {
    if (!touchUsed) {
      touchUsed = true;
      setTimeout(syncTouch, 0);
    }
  }, { capture: true, passive: true });
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    touchUsed = true;

  SZ.GameAutoPause.attach({
    isRunning: () => state === 'play',
    pause: pauseGame
  });

  document.body.tabIndex = -1;
  setScreen('title');
  if (!save.tutorialSeen)
    openHelp('title');
  updateWindowTitle();
  requestAnimationFrame(gameLoop);
})();
