;(function() {
  'use strict';

  /* ── Constants ── */
  const STORAGE_KEY = 'sz-flappy-bird-highscores';
  const SAVE_KEY = 'sz-flappy-bird-save-v2';
  const MAX_HIGH_SCORES = 5;
  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const MAX_DT = 0.05;

  /* Physics */
  const GRAVITY = 0.48;
  const FLAP_IMPULSE = -9;
  const TERMINAL_VELOCITY = 14.4;

  /* Bird */
  const BIRD_X = 360;
  const BIRD_W = 41;
  const BIRD_H = 29;
  const BIRD_RADIUS = 14;           // circular hitbox
  const COIN_RADIUS = 26;           // pickup distance
  const INVULN_TIME = 1.2;
  const TIME_ATTACK_SECONDS = 60;

  /* Course */
  const GROUND_Y = SZ.FlappyCourse.GROUND_Y;
  const GATE_W = SZ.FlappyCourse.GATE_W;
  const CAP_EXTRA_W = 8;            // gate caps stick out this far on each side
  const CAP_H = 30;                 // gate cap height at the gap ends
  const LEVELUP_INTERVAL = 12;

  /* Power-ups */
  const BUBBLE_COLORS = { shield: '#4aa3ff', magnet: '#ff4a4a', slow: '#b06aff', ghost: '#bff4ff', double: '#ffc21a', tiny: '#5ad06a' };
  const POWER_NAMES = { shield: 'SHIELD!', magnet: 'MAGNET!', slow: 'SLOW-MO!', ghost: 'GHOST!', double: 'DOUBLE COINS!', tiny: 'TINY!' };
  const POWER_TIMED = ['magnet', 'slow', 'ghost', 'double', 'tiny'];

  /* Medal tiers */
  const MEDAL_TIERS = [
    { name: 'Platinum', min: 100, color: '#e5e4e2' },
    { name: 'Gold', min: 50, color: '#ffd700' },
    { name: 'Silver', min: 25, color: '#c0c0c0' },
    { name: 'Bronze', min: 10, color: '#cd7f32' }
  ];

  /* Stage Clear panel — the height is the sum of the blocks it draws */
  const CLEAR_PW = 420;
  const CLEAR_HEAD_H = 36, CLEAR_STARS_H = 96, CLEAR_PAD_H = 14;
  const CLEAR_LINES_H = 32 + 28 + 26 + 30 + 28;   // coins, earned, total, hits, combo
  const CLEAR_PH = CLEAR_HEAD_H + CLEAR_STARS_H + CLEAR_LINES_H + CLEAR_PAD_H;
  const CLEAR_STAR_CY = CLEAR_HEAD_H + CLEAR_STARS_H / 2;

  /* Nest tech tree */
  const TREE_BRANCHES = [
    { id: 'wings', name: 'Wings', color: '#5ab8ff' },
    { id: 'armor', name: 'Armor', color: '#6fe08a' },
    { id: 'magnet', name: 'Magnet', color: '#ffd23f' },
    { id: 'power', name: 'Power', color: '#c04cff' },
    { id: 'spirit', name: 'Spirit', color: '#ff7a3a' }
  ];

  const TREE = [
    { id: 'w_light', branch: 'wings', name: 'Light Feathers', desc: 'Gravity 4% weaker per level', costs: [150, 300, 600], req: [] },
    { id: 'w_glide', branch: 'wings', name: 'Glide', desc: 'Hold flap while falling to sink 35% slower', costs: [800], req: [['w_light', 1]] },
    { id: 'w_wind', branch: 'wings', name: 'Storm Rider', desc: 'Wind gusts push 40% less per level', costs: [400, 900], req: [['w_light', 1]] },
    { id: 'a_heart', branch: 'armor', name: 'Extra Heart', desc: '+1 heart per level', costs: [500, 1500], req: [] },
    { id: 'a_shield', branch: 'armor', name: 'Starting Shield', desc: 'Start every run with a shield', costs: [1200], req: [['a_heart', 1]] },
    { id: 'a_down', branch: 'armor', name: 'Thick Down', desc: '+0.4 s safety after a hit per level', costs: [300, 700], req: [['a_heart', 1]] },
    { id: 'm_magnet', branch: 'magnet', name: 'Coin Magnet', desc: 'Always pull in coins within 60 px per level', costs: [200, 450, 900], req: [] },
    { id: 'm_value', branch: 'magnet', name: 'Golden Touch', desc: '+10% coins per level', costs: [400, 900, 1600], req: [['m_magnet', 1]] },
    { id: 'm_super', branch: 'magnet', name: 'Super Magnet', desc: 'Magnet power-up range +50% per level', costs: [500, 1000], req: [['m_magnet', 2]] },
    { id: 'p_long', branch: 'power', name: 'Long Lasting', desc: 'Power-ups last 20% longer per level', costs: [300, 650, 1200], req: [] },
    { id: 'p_more', branch: 'power', name: 'Bubble Luck', desc: 'Power-up bubbles 25% more often per level', costs: [600, 1300], req: [['p_long', 1]] },
    { id: 'p_kit', branch: 'power', name: 'Starter Kit', desc: 'Begin every run with a random power-up', costs: [2000], req: [['p_long', 2], ['p_more', 1]] },
    { id: 's_eye', branch: 'spirit', name: 'Eagle Eye', desc: 'Perfect zone 15% wider per level', costs: [250, 550, 1000], req: [] },
    { id: 's_keep', branch: 'spirit', name: 'Combo Keeper', desc: 'An imperfect pass keeps the combo, once per level each run', costs: [700, 1500], req: [['s_eye', 1]] },
    { id: 's_phoenix', branch: 'spirit', name: 'Phoenix Feather', desc: 'Come back to life once per run', costs: [3000], req: [['s_eye', 2]] }
  ];

  /* Aviary birds — the art lives in SZ.FlappyBirdArt.BIRDS */
  const BIRD_DEFS = [
    { id: 'sunny', perk: 'Balanced all-rounder', price: 0 },
    { id: 'ruby', perk: 'Light: gravity 6% weaker', price: 400 },
    { id: 'jay', perk: 'Shiny eyes: +50 px coin magnet', price: 900 },
    { id: 'pip', perk: 'Lucky: +15% coins', unlock: '2-4' },
    { id: 'snowy', perk: 'Tough: +1 heart', unlock: '4-4' },
    { id: 'phoenix', perk: 'Reborn: revive once per run', unlock: '6-4' }
  ];

  /* States */
  const STATE_TITLE = 'TITLE';
  const STATE_WORLDS = 'WORLDS';
  const STATE_NEST = 'NEST';
  const STATE_AVIARY = 'AVIARY';
  const STATE_HELP = 'HELP';
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DYING = 'DYING';
  const STATE_DEAD = 'DEAD';
  const STATE_CLEAR = 'CLEAR';      // adventure stage finished

  let viewScale = 1;   // logical pixels -> backing-store pixels
  let viewOffX = 0;    // letterbox offset in backing-store pixels
  let viewOffY = 0;
  let mouseX = -1;     // pointer in logical coordinates
  let mouseY = -1;

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.FlappyUI.create(ctx);
  const statusScore = document.getElementById('statusScore');
  const statusBest = document.getElementById('statusBest');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Sound ── */
  // one gate per name so nothing spams: the same sound plays at most once per 45 ms
  const sfxLast = {};
  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || -45) < 45)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  /* ── Game State ── */
  let state = STATE_READY;
  let bird = { x: BIRD_X, y: 300, vy: 0, angle: 0 };
  let score = 0;
  let highScores = [];
  let animFrameId = null;
  let lastTimestamp = 0;
  let readyBobT = 0;
  let dyingTimer = 0;
  let dpr = 1;
  let scorePopTimer = 0;

  /* Run */
  let mode = 'classic';             // 'classic' | 'adventure' | 'time' | 'daily'
  let stageIndex = 0;               // adventure: index into SZ.FlappyCourse.STAGES
  let course = null, dist = 0, runTime = 0, coinsRun = 0, coinsPicked = 0, hearts = 1, hitsTaken = 0, invuln = 0, timeLeft = 0;

  /* Power-ups & combo */
  let power = { shield: false, magnet: 0, slow: 0, ghost: 0, double: 0, tiny: 0 };
  let combo = 0, bestCombo = 0, perfects = 0;
  let coinCarry = 0, comboSaves = 0, revives = 0;
  let coinStreak = 0, coinStreakTime = 0;

  /* Glide */
  let flapHeld = false, glideTick = 0;

  /* Scenery */
  let scene = null, sceneBiome = '', sceneCache = {}, biomeBanner = 0, biomeBannerText = '';

  /* Animation & results */
  let wingFrame = 0, flapAnim = 0, globalTime = 0, lastStars = 0, newBest = false;

  /* Juice — feathers, biome weather, hit-stop, flashes, fades */
  const feathers = [];
  const weather = [];
  const rings = [];
  let weatherCarry = 0, hitStop = 0, flash = 0, flashColor = '#ffffff', fade = 0;
  let afterimages = [], afterimageTick = 0, coinBump = 0, lastCoinsShown = 0;
  let panelAt = 0, clearStarFx = 0;

  /* Menus — hit areas are rebuilt by every menu draw, the cursor indexes them */
  let hitAreas = [], menuCursor = 0, prevState = STATE_TITLE;
  let treeBranch = 0, treeSelected = null, treeLayout = null, treeBuyFlash = null;
  let aviaryIndex = 0, helpPage = 0;
  let menuBiomeIndex = 0, menuBiomeAt = 0;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    // never render more than ~1.5 backing pixels per logical pixel; the browser upscales the rest
    const dprRaw = window.devicePixelRatio || 1;
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / CANVAS_W, cssH / CANVAS_H);
    dpr = Math.max(0.5, Math.min(dprRaw, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H);
    viewOffX = Math.round((canvas.width - CANVAS_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - CANVAS_H * viewScale) / 2);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
    ctx.imageSmoothingEnabled = true;
  }

  /* Fill the whole canvas (letterbox bars too), then return to logical coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10202a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  /* The logical rectangle the canvas really shows: the 1280 x 720 game area
     plus the letterbox bars whenever the window aspect ratio is not 16:9.
     Game logic stays inside the game area, scenery and overlays use this. */
  function visibleRect() {
    return {
      x0: -viewOffX / viewScale,
      y0: -viewOffY / viewScale,
      x1: (canvas.width - viewOffX) / viewScale,
      y1: (canvas.height - viewOffY) / viewScale
    };
  }

  /* Pointer event -> logical coordinates */
  function pointerToLogical(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) * dpr - viewOffX) / viewScale;
    mouseY = ((e.clientY - rect.top) * dpr - viewOffY) / viewScale;
  }

  /* ── Medal ── */
  function getMedal(s) {
    for (const tier of MEDAL_TIERS)
      if (s >= tier.min)
        return tier;
    return null;
  }

  /* ── High Score Persistence (classic table) ── */
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(s) {
    highScores.push(s);
    highScores.sort((a, b) => b - a);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function getBestScore() {
    return highScores.length > 0 ? highScores[0] : 0;
  }

  /* ── Save v2 ── */
  function defaultSave() {
    return {
      v: 2,
      coins: 0,
      stars: {},
      best: { classic: 0, time: 0, daily: { date: '', score: 0 } },
      stats: { runs: 0, gates: 0, coins: 0 },
      tree: {},
      birds: ['sunny'],
      bird: 'sunny'
    };
  }

  let save = defaultSave();

  function loadSave() {
    const d = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (typeof s.coins === 'number')
            d.coins = s.coins;
          if (s.stars && typeof s.stars === 'object')
            d.stars = s.stars;
          if (s.best && typeof s.best === 'object') {
            if (typeof s.best.classic === 'number')
              d.best.classic = s.best.classic;
            if (typeof s.best.time === 'number')
              d.best.time = s.best.time;
            if (s.best.daily && typeof s.best.daily === 'object') {
              if (typeof s.best.daily.date === 'string')
                d.best.daily.date = s.best.daily.date;
              if (typeof s.best.daily.score === 'number')
                d.best.daily.score = s.best.daily.score;
            }
          }
          if (s.stats && typeof s.stats === 'object') {
            if (typeof s.stats.runs === 'number')
              d.stats.runs = s.stats.runs;
            if (typeof s.stats.gates === 'number')
              d.stats.gates = s.stats.gates;
            if (typeof s.stats.coins === 'number')
              d.stats.coins = s.stats.coins;
          }
          if (s.tree && typeof s.tree === 'object')
            d.tree = s.tree;
          if (Array.isArray(s.birds))
            d.birds = s.birds;
          if (typeof s.bird === 'string')
            d.bird = s.bird;
        }
      }
    } catch (_) {}
    if (d.birds.indexOf('sunny') < 0)
      d.birds.push('sunny');
    save = d;
    // Migration: carry the best score of the old high-score table into the save
    if (highScores.length > 0 && highScores[0] > save.best.classic)
      save.best.classic = highScores[0];
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {}
  }

  /* ── Nest tech tree ── */
  function treeLevel(id) {
    return save.tree[id] || 0;
  }

  function nodeMax(node) {
    return node.costs.length;
  }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= nodeMax(node))
      return 'maxed';
    for (const req of node.req)
      if (treeLevel(req[0]) < req[1])
        return 'locked';
    return save.coins >= node.costs[level] ? 'available' : 'expensive';
  }

  function buyNode(node) {
    if (nodeState(node) !== 'available') {
      sfx('error');
      return false;
    }
    const level = treeLevel(node.id);
    save.coins -= node.costs[level];
    save.tree[node.id] = level + 1;
    writeSave();
    sfx('powerup');
    sfx('coin');
    return true;
  }

  /* ── Aviary ── */
  function birdDef(id) {
    return BIRD_DEFS.find(d => d.id === id) || null;
  }

  function birdName(id) {
    const art = SZ.FlappyBirdArt.BIRDS.find(b => b.id === id);
    return art ? art.name : id;
  }

  function birdOwned(id) {
    return save.birds.indexOf(id) >= 0;
  }

  function birdAvailable(def) {
    return def.unlock ? (save.stars[def.unlock] || 0) >= 1 : true;
  }

  function buyBird(id) {
    const def = birdDef(id);
    if (!def)
      return false;
    if (birdOwned(id)) {
      save.bird = id;
      writeSave();
      sfx('select');
      return true;
    }
    // Stage-star unlocks come free once the stage is cleared, otherwise the bird is bought
    const free = def.unlock && birdAvailable(def);
    if (free || save.coins >= def.price) {
      if (!free)
        save.coins -= def.price;
      save.birds.push(id);
      save.bird = id;
      writeSave();
      sfx('powerup');
      sfx('coin');
      return true;
    }
    sfx('error');
    return false;
  }

  function currentBird() {
    return birdOwned(save.bird) ? save.bird : 'sunny';
  }

  function birdArt() {
    return SZ.FlappyBirdArt.BIRDS.find(b => b.id === currentBird()) || SZ.FlappyBirdArt.BIRDS[0];
  }

  function stageUnlocked(i) {
    if (i === 0)
      return true;
    const prev = SZ.FlappyCourse.STAGES[i - 1];
    return (save.stars[prev.id] || 0) >= 1;
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function modeName() {
    if (mode === 'adventure')
      return 'Adventure';
    if (mode === 'time')
      return 'Time Attack';
    if (mode === 'daily')
      return 'Daily';
    return 'Classic';
  }

  function modeBest() {
    if (mode === 'classic')
      return save.best.classic;
    if (mode === 'time')
      return save.best.time;
    if (mode === 'daily')
      return save.best.daily.date === todayKey() ? save.best.daily.score : 0;
    return 0;
  }

  /* ── Menu screens ── */
  function isMenuState(s) {
    return s === STATE_TITLE || s === STATE_WORLDS || s === STATE_NEST ||
      s === STATE_AVIARY || s === STATE_HELP || s === STATE_DEAD || s === STATE_CLEAR;
  }

  function totalStars() {
    let n = 0;
    for (const id in save.stars)
      n += save.stars[id];
    return n;
  }

  function worldStars(w) {
    let n = 0;
    for (const st of SZ.FlappyCourse.STAGES)
      if (st.world === w)
        n += save.stars[st.id] || 0;
    return n;
  }

  function treeComplete() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= nodeMax(node))
        ++n;
    return n;
  }

  function romanNumeral(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const pair of map)
      while (n >= pair[0]) {
        out += pair[1];
        n -= pair[0];
      }
    return out || '0';
  }

  function updateWindowTitle() {
    if (state === STATE_READY || state === STATE_PLAYING || state === STATE_PAUSED ||
      state === STATE_DYING || state === STATE_DEAD || state === STATE_CLEAR)
      SZ.Dlls.User32.SetWindowText('Flappy Bird -- ' + (mode === 'adventure' ? SZ.FlappyCourse.STAGES[stageIndex].name : modeName()));
    else
      SZ.Dlls.User32.SetWindowText('Flappy Bird');
  }

  function goTitle() {
    state = STATE_TITLE;
    menuCursor = 0;
    updateStatus();
    updateWindowTitle();
  }

  function goWorlds() {
    state = STATE_WORLDS;
    menuCursor = 0;
    updateStatus();
    updateWindowTitle();
  }

  function goNest() {
    prevState = state;
    treeLayout = buildTreeLayout();
    selectFirstInBranch();
    state = STATE_NEST;
    updateStatus();
    updateWindowTitle();
  }

  function goAviary() {
    prevState = state;
    aviaryIndex = Math.max(0, BIRD_DEFS.findIndex(d => d.id === currentBird()));
    menuCursor = aviaryIndex;
    state = STATE_AVIARY;
    updateStatus();
    updateWindowTitle();
  }

  function goHelp() {
    prevState = state;
    helpPage = 0;
    state = STATE_HELP;
    updateStatus();
    updateWindowTitle();
  }

  function backToPrev() {
    if (prevState === STATE_WORLDS)
      goWorlds();
    else
      goTitle();
  }

  function quitToMenu() {
    fade = 1;
    if (mode === 'adventure')
      goWorlds();
    else
      goTitle();
  }

  function menuEscape() {
    if (state === STATE_WORLDS)
      goTitle();
    else if (state === STATE_NEST || state === STATE_AVIARY || state === STATE_HELP)
      backToPrev();
    else if (state === STATE_DEAD || state === STATE_CLEAR)
      quitToMenu();
  }

  /* ── Course & Scene ── */
  function sceneFor(biome) {
    return sceneCache[biome] || (sceneCache[biome] = SZ.FlappySceneArt.create(biome));
  }

  function maxHearts() {
    return 1 + treeLevel('a_heart') + (currentBird() === 'snowy' ? 1 : 0);
  }

  function runSpeed() {
    return mode === 'adventure'
      ? SZ.FlappyCourse.STAGES[stageIndex].speed
      : SZ.FlappyCourse.endlessParams(score).speed;
  }

  /* ── Tunables ── */
  function powerDuration(kind) {
    return ({ magnet: 8, slow: 5, ghost: 4, double: 10, tiny: 8 }[kind] || 0) * (1 + 0.2 * treeLevel('p_long'));
  }

  function magnetRadius() {
    return Math.max(
      60 * treeLevel('m_magnet') + (currentBird() === 'jay' ? 50 : 0),
      power.magnet > 0 ? 190 * (1 + 0.5 * treeLevel('m_super')) : 0
    );
  }

  function perfectBand() {
    return 0.22 * (1 + 0.15 * treeLevel('s_eye'));
  }

  function coinBonus() {
    return 1 + 0.1 * treeLevel('m_value') + (currentBird() === 'pip' ? 0.15 : 0);
  }

  /* Holding the flap while falling sinks the bird slower (Glide upgrade) */
  function glideActive() {
    return treeLevel('w_glide') > 0 && flapHeld && bird.vy > 0;
  }

  function gravityNow() {
    return GRAVITY * (1 - 0.04 * treeLevel('w_light')) * (currentBird() === 'ruby' ? 0.94 : 1) * (glideActive() ? 0.65 : 1);
  }

  function comboMult() {
    return combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
  }

  function coinValue() {
    return coinBonus() * (power.double > 0 ? 2 : 1) * comboMult();
  }

  function birdRadius() {
    return power.tiny > 0 ? BIRD_RADIUS * 0.65 : BIRD_RADIUS;
  }

  /* Circle (cx, cy, r) against axis-aligned rect (x, y, w, h) */
  function circleRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  /* ── Run Control ── */
  function startRun() {
    const stage = mode === 'adventure' ? SZ.FlappyCourse.STAGES[stageIndex] : null;
    let seed;
    if (mode === 'daily')
      seed = SZ.FlappyCourse.dailySeed(new Date());
    else if (mode === 'adventure')
      seed = SZ.FlappyCourse.hashSeed(stage.id);
    else
      seed = (Math.random() * 4294967296) >>> 0;

    const bubbleBase = mode === 'adventure' ? 6 : 7;
    course = SZ.FlappyCourse.createCourse({
      seed: seed,
      stage: stage,
      bubbleEvery: Math.max(3, Math.round(bubbleBase / (1 + 0.25 * treeLevel('p_more'))))
    });
    dist = 0;
    runTime = 0;
    score = 0;
    coinsRun = 0;
    coinsPicked = 0;
    hitsTaken = 0;
    invuln = 0;
    hearts = maxHearts();
    timeLeft = TIME_ATTACK_SECONDS;
    power = { shield: false, magnet: 0, slow: 0, ghost: 0, double: 0, tiny: 0 };
    combo = 0;
    bestCombo = 0;
    perfects = 0;
    coinCarry = 0;
    coinStreak = 0;
    comboSaves = treeLevel('s_keep');
    revives = (treeLevel('s_phoenix') > 0 || currentBird() === 'phoenix') ? 1 : 0;
    glideTick = 0;
    if (treeLevel('a_shield') > 0)
      power.shield = true;
    let kitKind = null;
    if (treeLevel('p_kit') > 0) {
      kitKind = POWER_TIMED[Math.floor(Math.random() * POWER_TIMED.length)];
      power[kitKind] = powerDuration(kitKind);
    }
    bird = { x: BIRD_X, y: 300, vy: 0, angle: 0 };
    sceneBiome = course.gates[0].biome;
    scene = sceneFor(sceneBiome);
    biomeBanner = 2.5;
    biomeBannerText = mode === 'adventure' ? stage.name : SZ.FlappyCourse.BIOMES[sceneBiome].name;
    readyBobT = 0;
    dyingTimer = 0;
    scorePopTimer = 0;
    wingFrame = 0;
    flapAnim = 0;
    particles.clear();
    floatingText.clear();
    feathers.length = 0;
    weather.length = 0;
    rings.length = 0;
    afterimages.length = 0;
    weatherCarry = 0;
    hitStop = 0;
    flash = 0;
    coinBump = 0;
    lastCoinsShown = 0;
    fade = 1;
    if (kitKind)
      floatingText.add(BIRD_X, bird.y - 40, POWER_NAMES[kitKind], { color: BUBBLE_COLORS[kitKind], font: 'bold 26px sans-serif' });
    state = STATE_READY;
    menuCursor = 0;
    updateStatus();
    updateWindowTitle();
    newBest = false;
  }

  function resetGame() {
    startRun();
  }

  /* ── Flap ── */
  function flap() {
    bird.vy = FLAP_IMPULSE;
    flapAnim = 0.25;
    sfx('jump', { pitch: 1.15 + Math.random() * 0.12, volume: 0.45 });
    // Flap particle puff effect
    particles.burst(BIRD_X - 10, bird.y + 8, 6, {
      color: '#ddd',
      speed: 2,
      gravity: 0.05,
      size: 2,
      life: 0.5,
      decay: 0.03
    });
    // A couple of feathers drift off the back of the wings
    const art = birdArt();
    addFeather(BIRD_X - 14, bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.wing);
    addFeather(BIRD_X - 14, bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.body);
  }

  /* ── Damage & Death ── */
  function takeHit(source) {
    if (invuln > 0)
      return;

    // A shield eats the first non-ground hit
    if (power.shield && source !== 'ground') {
      power.shield = false;
      invuln = 0.8;
      sfx('zap');
      particles.burst(BIRD_X, bird.y, 24, { color: '#4aa3ff', speed: 6 });
      screenShake.trigger(3, 150);
      flash = 0.25;
      flashColor = BUBBLE_COLORS.shield;
      return;
    }

    // Ghost mode walks through everything but the ground
    if (power.ghost > 0 && source !== 'ground')
      return;

    combo = 0;
    ++hitsTaken;
    screenShake.trigger(6, 250);
    sfx('hurt');
    // The hit lands with a beat of frozen frame, a white flash and loose feathers
    hitStop = 0.07;
    flash = 0.5;
    flashColor = '#ffffff';
    burstFeathers(BIRD_X, bird.y, 10);

    if (mode === 'time') {
      timeLeft = Math.max(0, timeLeft - 3);
      invuln = INVULN_TIME;
      floatingText.add(BIRD_X, bird.y - 30, '-3 s', { color: '#ff6a6a' });
      return;
    }

    hearts -= 1;
    if (hearts > 0) {
      invuln = INVULN_TIME + 0.4 * treeLevel('a_down');
      bird.vy = Math.min(bird.vy, -4);
      return;
    }
    // The last heart can be paid for with a revive — once per run
    if (revives > 0) {
      --revives;
      hearts = 1;
      invuln = 2;
      bird.vy = FLAP_IMPULSE;
      particles.burst(BIRD_X, bird.y, 40, { color: '#ff7a3a', speed: 7, size: 4 });
      particles.burst(BIRD_X, bird.y, 20, { color: '#ffd23f', speed: 4 });
      floatingText.add(BIRD_X, bird.y - 60, 'REBORN!', { color: '#ff7a3a', font: 'bold 40px sans-serif' });
      sfx('powerup', { pitch: 0.8 });
      sfx('win', { volume: 0.4 });
      screenShake.trigger(8, 400);
      return;
    }
    die();
  }

  function die() {
    state = STATE_DYING;
    dyingTimer = 0;
    // Death hits harder: red flash, a longer freeze and a burst of feathers
    afterimages.length = 0;
    hitStop = 0.07;
    flash = 0.5;
    flashColor = '#ff4a4a';
    burstFeathers(BIRD_X, bird.y, 10);
    // Screen shake on death
    screenShake.trigger(6, 300);
    sfx('hit');
  }

  /* ── Run Finish ── */
  function finishRun(reason) {
    ++save.stats.runs;
    save.stats.coins += coinsRun;
    save.coins += coinsRun;

    if (mode === 'classic') {
      addHighScore(score);
      if (score > save.best.classic) {
        save.best.classic = score;
        newBest = true;
      }
    } else if (mode === 'time') {
      if (score > save.best.time) {
        save.best.time = score;
        newBest = true;
      }
    } else if (mode === 'daily') {
      const today = todayKey();
      if (save.best.daily.date !== today) {
        save.best.daily = { date: today, score: score };
        newBest = score > 0;
      } else if (score > save.best.daily.score) {
        save.best.daily.score = score;
        newBest = true;
      }
    } else if (mode === 'adventure' && reason === 'clear') {
      const stars = 1 + (coinsPicked >= 0.6 * course.totalCoins ? 1 : 0) + (hitsTaken === 0 ? 1 : 0);
      lastStars = stars;
      const id = SZ.FlappyCourse.STAGES[stageIndex].id;
      save.stars[id] = Math.max(save.stars[id] || 0, stars);
      state = STATE_CLEAR;
      sfx('win');
      particles.confetti(CANVAS_W / 2, 200, 60);
    }

    writeSave();
    if (state !== STATE_CLEAR) {
      state = STATE_DEAD;
      sfx('lose', { volume: 0.7 });
      if (newBest) {
        particles.confetti(CANVAS_W / 2, 200, 60);
        sfx('levelup', { pitch: 1.2 });
      }
    }
    fade = 1;
    panelAt = globalTime;
    clearStarFx = 0;
    menuCursor = 0;
    updateStatus();
    updateWindowTitle();
  }

  /* ── Feathers ── */
  function addFeather(x, y, vx, vy, color) {
    if (feathers.length >= 60)
      feathers.shift();
    feathers.push({
      x: x, y: y, vx: vx, vy: vy,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      life: 0.7 + Math.random() * 0.7,
      color: color,
      size: 5 + Math.random() * 3
    });
  }

  function burstFeathers(x, y, count) {
    const art = birdArt();
    for (let i = 0; i < count; ++i) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      addFeather(x, y, Math.cos(a) * sp, Math.sin(a) * sp, i % 2 === 0 ? art.wing : art.body);
    }
  }

  function updateFeathers(dt) {
    const step = dt * 60;
    const scroll = state === STATE_PLAYING ? runSpeed() * step * 0.6 : 0;
    for (let i = feathers.length - 1; i >= 0; --i) {
      const f = feathers[i];
      f.vy += 0.06 * step;
      f.vx *= Math.pow(0.99, step);
      f.x += f.vx * step - scroll + Math.sin(f.life * 6 + f.rot) * 0.3 * step;
      f.y += f.vy * step;
      f.rot += f.vrot * step;
      f.life -= dt;
      if (f.life <= 0 || f.x < -40 || f.y > CANVAS_H + 40)
        feathers.splice(i, 1);
    }
  }

  function drawFeathers() {
    for (let i = 0; i < feathers.length; ++i) {
      const f = feathers[i];
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-f.size, 0);
      ctx.lineTo(f.size, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Biome weather ── */
  /* particles enter at the edges of the visible rect, so they keep filling the
     picture even in the bars beside the game area; the ground-hugging kinds
     (sand, embers) stay at their distance from the ground line */
  function spawnWeather(sc, v) {
    const w = sc.theme.weather;
    const p = {
      kind: w.kind, color: w.color,
      x: 0, y: 0, vx: 0, vy: 0,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      size: 2, alpha: 1,
      seed: Math.random() * Math.PI * 2
    };
    if (w.kind === 'leaves') {
      if (Math.random() < 0.5) {
        p.x = v.x1 + 10;
        p.y = v.y0 + Math.random() * (420 - v.y0);
      } else {
        p.x = v.x0 + Math.random() * (v.x1 - v.x0);
        p.y = v.y0 - 10;
      }
      p.vx = -1 - Math.random() - 0.3 * runSpeed();
      p.vy = 0.4 + Math.random() * 0.6;
      p.alpha = 0.6 + Math.random() * 0.4;
    } else if (w.kind === 'sand') {
      p.x = v.x1 + 10;
      p.y = 300 + Math.random() * 340;
      p.vx = -6 - Math.random() * 3;
      p.alpha = 0.5;
    } else if (w.kind === 'snow') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 40) - 20;
      p.y = v.y0 - 10;
      p.vy = 0.6 + Math.random() * 0.8;
      p.size = 1.5 + Math.random() * 2;
      p.alpha = 0.7 + Math.random() * 0.3;
    } else if (w.kind === 'fireflies') {
      p.x = v.x1 + 10;
      p.y = 200 + Math.random() * 400;
      p.vx = -0.4 - Math.random() * 0.3;
      p.size = 2;
    } else if (w.kind === 'rain') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 120) - 60;
      p.y = v.y0 - 16;
      p.vx = -3;
      p.vy = 11 + Math.random() * 3;
      p.size = 14;
      p.alpha = 0.45;
    } else if (w.kind === 'embers') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0);
      p.y = 640;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = -1 - Math.random() * 1.2;
      p.size = 2;
    }
    weather.push(p);
  }

  function updateWeather(dt, sc, canSpawn, rateScale) {
    const step = dt * 60;
    const v = visibleRect();
    if (canSpawn) {
      weatherCarry += sc.theme.weather.rate * 40 * dt * (rateScale || 1);
      while (weatherCarry >= 1) {
        weatherCarry -= 1;
        if (weather.length < 90)
          spawnWeather(sc, v);
      }
    }
    for (let i = weather.length - 1; i >= 0; --i) {
      const p = weather[i];
      if (p.kind === 'leaves') {
        p.rot += p.vrot * step;
        p.y += Math.sin(globalTime * 2 + p.seed) * 0.3 * step;
      } else if (p.kind === 'snow') {
        p.x += Math.sin(globalTime * 2 + p.seed) * 0.6 * step;
      } else if (p.kind === 'fireflies') {
        p.x += Math.sin(globalTime * 0.8 + p.seed) * 0.5 * step;
        p.y += Math.cos(globalTime * 0.6 + p.seed * 2) * 0.5 * step;
      } else if (p.kind === 'embers') {
        p.x += Math.sin(globalTime * 3 + p.seed) * 0.2 * step;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.x < v.x0 - 40 || p.x > v.x1 + 60 || p.y < v.y0 - 40 || p.y > v.y1 + 40)
        weather.splice(i, 1);
    }
  }

  /* Fireflies glow behind the gates, everything else drifts in front of the ground */
  function drawWeather(layer) {
    for (let i = 0; i < weather.length; ++i) {
      const p = weather[i];
      if ((p.kind === 'fireflies') !== (layer === 'back'))
        continue;
      ctx.save();
      if (p.kind === 'leaves') {
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sand') {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 1);
      } else if (p.kind === 'snow') {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fireflies') {
        const pulse = 0.5 + 0.5 * Math.sin(globalTime * 4 + p.seed);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.18 * (0.4 + 0.6 * pulse);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'rain') {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        const inv = 14 / Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * inv, p.y - p.vy * inv);
        ctx.stroke();
      } else if (p.kind === 'embers') {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(globalTime * 20 + p.seed);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ── Coin pickup rings ── */
  function addRing(x, y) {
    if (rings.length >= 20)
      rings.shift();
    rings.push({ x: x, y: y, t: 0 });
  }

  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; --i) {
      rings[i].t += dt;
      if (rings[i].t > 0.25)
        rings.splice(i, 1);
    }
  }

  function drawRings() {
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      const u = r.t / 0.25;
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = ui.UI.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + 18 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* The CLEAR panel reveals its stars one by one, each with its own chime */
  function updateClearStars() {
    const t = globalTime - panelAt;
    const starY = (CANVAS_H - CLEAR_PH) / 2 + CLEAR_STAR_CY;
    for (let i = 0; i < 3; ++i) {
      if (t < 0.4 + i * 0.35 || (clearStarFx & (1 << i)) !== 0)
        continue;
      clearStarFx |= 1 << i;
      if (i < lastStars) {
        sfx('coin', { pitch: 1 + 0.25 * i });
        particles.sparkle(CANVAS_W / 2 + (i - 1) * 92, starY, 14, { color: '#ffd700' });
      } else {
        sfx('thud', { volume: 0.3 });
      }
    }
  }

  /* Full-screen flash and fade overlays, drawn only while they are visible */
  function drawScreenFx() {
    if (flash > 0) {
      const v = visibleRect();
      ctx.save();
      ctx.globalAlpha = Math.min(1, flash * 0.5);
      ctx.fillStyle = flashColor;
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      ctx.restore();
    }
    if (fade > 0) {
      const v = visibleRect();
      ctx.save();
      ctx.globalAlpha = Math.min(1, fade);
      ctx.fillStyle = '#000';
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      ctx.restore();
    }
  }

  /* ── Update ── */
  function update(dt) {
    globalTime += dt;

    // Hit-stop — one frozen beat right after damage lands, drawing continues
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }

    fade = Math.max(0, fade - dt * 3.5);
    flash = Math.max(0, flash - dt * 2.5);

    if (state === STATE_TITLE || state === STATE_WORLDS || state === STATE_NEST ||
      state === STATE_AVIARY || state === STATE_HELP) {
      updateWeather(dt, sceneFor(SZ.FlappyCourse.BIOME_ORDER[menuBiomeIndex]), true, 0.5);
      particles.update();
      floatingText.update();
      return;
    }

    if (state === STATE_READY) {
      readyBobT += dt * 3;
      bird.y = 300 + Math.sin(readyBobT) * 8;
      bird.angle = 0;
      updateWeather(dt, scene, true);
      return;
    }

    if (state === STATE_DYING) {
      dyingTimer += dt;
      screenShake.update(dt * 1000);
      // The first half second of the tumble plays in slow motion
      const slow = dyingTimer < 0.45 ? 0.35 : 1;
      const step = dt * slow * 60;
      bird.vy += GRAVITY * step;
      bird.vy = Math.min(bird.vy, TERMINAL_VELOCITY);
      bird.y += bird.vy * step;
      bird.angle = Math.min(Math.PI / 2, bird.angle + 0.1 * step);
      if (slow === 1) {
        particles.update();
        floatingText.update();
      }
      updateFeathers(dt * slow);
      updateWeather(dt, scene, false);
      updateRings(dt);
      if (dyingTimer > 0.5)
        finishRun('dead');
      return;
    }

    if (state === STATE_DEAD || state === STATE_CLEAR) {
      particles.update();
      floatingText.update();
      updateFeathers(dt);
      updateRings(dt);
      if (state === STATE_CLEAR)
        updateClearStars();
      return;
    }

    if (state !== STATE_PLAYING)
      return;

    // dt * 60 normalizes all per-frame values to 60 fps behaviour
    const step = dt * 60;
    const speed = runSpeed();

    runTime += dt;
    dist += speed * (power.slow > 0 ? 0.6 : 1) * step;
    course.ensure(dist + CANVAS_W);
    course.prune(dist);

    // Power-up timers
    for (const kind of POWER_TIMED) {
      if (power[kind] <= 0)
        continue;
      power[kind] = Math.max(0, power[kind] - dt);
      if (power[kind] === 0)
        sfx('drop', { volume: 0.35 });
    }

    // Bird physics
    bird.vy += gravityNow() * step;
    bird.vy = Math.min(bird.vy, TERMINAL_VELOCITY);
    bird.y += bird.vy * step;

    // Gliding leaves a faint white trail under the wings
    if (glideActive()) {
      ++glideTick;
      if (glideTick % 4 === 0)
        particles.trail(BIRD_X - 6, bird.y + 9, { color: 'rgba(255,255,255,0.45)', size: 2, life: 0.4 });
    }

    // Ceiling clamp — bird does not die from ceiling
    bird.y = Math.max(BIRD_H / 2, bird.y);
    if (bird.y <= BIRD_H / 2)
      bird.vy = Math.max(0, bird.vy);

    // Bird rotation based on velocity
    const rotTarget = (bird.vy / TERMINAL_VELOCITY) * (Math.PI / 2);
    bird.angle += (rotTarget - bird.angle) * (1 - Math.pow(0.85, step));
    bird.angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 2, bird.angle));

    invuln = Math.max(0, invuln - dt);

    // Wing animation — fast right after a flap, lazy cruise otherwise
    flapAnim = Math.max(0, flapAnim - dt);
    wingFrame += dt * (flapAnim > 0 ? 26 : 9);

    // Time attack countdown
    if (mode === 'time') {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        finishRun('time');
        return;
      }
    }

    // Gates — collision with the four rects of the gate, then pass scoring
    for (const gate of course.gates) {
      const sx = gate.x - dist;
      if (sx <= -GATE_W - 20 || sx >= CANVAS_W + 20)
        continue;
      const shape = SZ.FlappyCourse.gateShape(gate, runTime);
      const topBottom = shape.y - shape.gap / 2;
      const botTop = shape.y + shape.gap / 2;
      const birdR = birdRadius();

      // Remember the hit counter and the narrowest clearance while inside the gate
      if (gate.hitsAtEntry === undefined && sx < BIRD_X + CAP_EXTRA_W + birdR)
        gate.hitsAtEntry = hitsTaken;
      if (sx - 8 < BIRD_X && BIRD_X < sx + GATE_W + 8) {
        const clearance = Math.min(bird.y - birdR - topBottom, botTop - (bird.y + birdR));
        gate.minClear = Math.min(gate.minClear ?? Infinity, clearance);
      }

      const hit =
        circleRect(BIRD_X, bird.y, birdR, sx, 0, GATE_W, topBottom) ||
        circleRect(BIRD_X, bird.y, birdR, sx, botTop, GATE_W, GROUND_Y - botTop) ||
        circleRect(BIRD_X, bird.y, birdR, sx - CAP_EXTRA_W, topBottom - CAP_H, GATE_W + CAP_EXTRA_W * 2, CAP_H) ||
        circleRect(BIRD_X, bird.y, birdR, sx - CAP_EXTRA_W, botTop, GATE_W + CAP_EXTRA_W * 2, CAP_H);
      if (hit)
        takeHit('pipe');
      if (state !== STATE_PLAYING)
        break;

      if (!gate.passed && sx + GATE_W < BIRD_X - birdR) {
        gate.passed = true;
        ++score;
        ++save.stats.gates;
        scorePopTimer = 0.2;
        if (score % LEVELUP_INTERVAL === 0)
          sfx('levelup');
        else
          sfx('blip', { pitch: 0.9, volume: 0.35 });

        // Gate-pass sparkle effect at the gap edges
        particles.sparkle(sx + GATE_W, topBottom, 6, { color: '#ffd700' });
        particles.sparkle(sx + GATE_W, botTop, 6, { color: '#ffd700' });
        floatingText.add(BIRD_X, bird.y - 20, '+1', { color: '#fff', decay: 0.03 });

        // Perfect pass — dead centre of the gap keeps the combo alive
        const offset = Math.abs(bird.y - shape.y) / (shape.gap / 2);
        if (offset <= perfectBand()) {
          ++combo;
          ++perfects;
          bestCombo = Math.max(bestCombo, combo);
          floatingText.add(BIRD_X, bird.y - 48, combo >= 2 ? 'PERFECT! x' + combo : 'PERFECT!', { color: '#7affd8', font: 'bold 24px sans-serif' });
          sfx('blip', { pitch: 1 + Math.min(combo, 12) * 0.06, volume: 0.6 });
          particles.sparkle(BIRD_X, bird.y, 10, { color: '#7affd8' });
          if (combo === 5 || combo === 10 || combo === 20) {
            floatingText.add(CANVAS_W / 2, 260, 'COMBO x' + comboMult(), { color: '#7affd8', font: 'bold 40px sans-serif' });
            sfx('levelup');
          }
        } else if (combo > 0 && comboSaves > 0) {
          // Combo Keeper — an imperfect pass may spend a save instead of breaking the streak
          --comboSaves;
          floatingText.add(BIRD_X, bird.y - 48, 'COMBO KEPT', { color: '#ff7a3a' });
        } else {
          combo = 0;
        }

        // Near miss — a clean pass within a hair of the pipes pays a coin
        if (gate.minClear !== undefined && gate.minClear < 7 && hitsTaken === gate.hitsAtEntry) {
          coinCarry += coinValue();
          const whole = Math.floor(coinCarry);
          coinCarry -= whole;
          coinsRun += whole;
          floatingText.add(BIRD_X, bird.y - 74, 'CLOSE!', { color: '#ffb03a' });
          particles.burst(BIRD_X, bird.y, 8, { color: '#ffffff', speed: 3, size: 2 });
          sfx('whoosh', { pitch: 1.5, volume: 0.4 });
        }

        updateStatus();
      }
    }

    if (state === STATE_PLAYING) {
      // Coins — an active magnet drags nearby coins into the bird
      const magnetR = magnetRadius();
      const pull = 1 - Math.pow(0.82, step);
      for (const coin of course.coins) {
        if (coin.taken)
          continue;
        let cx = coin.x - dist;
        if (magnetR > 0) {
          const mx = cx - BIRD_X;
          const my = coin.y - bird.y;
          if (mx * mx + my * my < magnetR * magnetR) {
            coin.x += (dist + BIRD_X - coin.x) * pull;
            coin.y += (bird.y - coin.y) * pull;
            cx = coin.x - dist;
          }
        }
        if (Math.abs(cx - BIRD_X) >= 60)
          continue;
        const dx = cx - BIRD_X;
        const dy = coin.y - bird.y;
        if (dx * dx + dy * dy < COIN_RADIUS * COIN_RADIUS) {
          coin.taken = true;
          ++coinsPicked;
          // Fractional coin values accumulate in the carry, only whole coins are paid out
          coinCarry += coinValue();
          const whole = Math.floor(coinCarry);
          coinCarry -= whole;
          coinsRun += whole;
          // A streak of coins picked up in quick succession climbs in pitch
          coinStreak = globalTime - coinStreakTime < 0.6 ? Math.min(coinStreak + 1, 12) : 0;
          coinStreakTime = globalTime;
          sfx('coin', { pitch: 1.1 + coinStreak * 0.05, volume: 0.45 });
          particles.sparkle(cx, coin.y, 5, { color: '#ffd23f' });
          addRing(cx, coin.y);
          if (whole > 1)
            floatingText.add(cx, coin.y - 24, '+' + whole, { color: ui.UI.gold });
        }
      }

      // Power-up bubbles
      for (const bubble of course.bubbles) {
        if (bubble.taken)
          continue;
        const bx = bubble.x - dist;
        if (Math.abs(bx - BIRD_X) >= 60)
          continue;
        const dx = bx - BIRD_X;
        const dy = bubble.y - bird.y;
        if (dx * dx + dy * dy >= 36 * 36)
          continue;
        bubble.taken = true;
        if (bubble.kind === 'shield')
          power.shield = true;
        else
          power[bubble.kind] = powerDuration(bubble.kind);
        sfx('powerup');
        particles.burst(bx, bubble.y, 18, { color: BUBBLE_COLORS[bubble.kind], speed: 5, size: 3, life: 0.7 });
        floatingText.add(BIRD_X, bird.y - 40, POWER_NAMES[bubble.kind], { color: BUBBLE_COLORS[bubble.kind], font: 'bold 26px sans-serif' });
        flash = 0.25;
        flashColor = BUBBLE_COLORS[bubble.kind];
      }

      // Ground
      const birdR = birdRadius();
      if (bird.y + birdR >= GROUND_Y) {
        if (mode === 'classic' || mode === 'daily' || (hearts <= 1 && mode !== 'time')) {
          takeHit('ground');
        } else {
          // A spare heart (or time attack) lets the bird bounce off the ground
          bird.y = GROUND_Y - birdR;
          bird.vy = FLAP_IMPULSE * 0.9;
          particles.burst(BIRD_X, GROUND_Y - 4, 14, { color: scene.theme.groundTop, speed: 3, gravity: 0.15, life: 0.5 });
          takeHit('ground');
        }
      }

      // Biome change in the endless modes — the next gate ahead decides the scenery
      if (mode !== 'adventure') {
        for (const gate of course.gates) {
          if (gate.x - dist > BIRD_X - 40) {
            if (gate.biome !== sceneBiome) {
              sceneBiome = gate.biome;
              scene = sceneFor(sceneBiome);
              biomeBanner = 2.5;
              biomeBannerText = SZ.FlappyCourse.BIOMES[sceneBiome].name;
              sfx('whoosh', { pitch: 0.8 });
            }
            break;
          }
        }
      }

      // Adventure stage finish
      if (mode === 'adventure' && dist + BIRD_X >= course.finishX) {
        finishRun('clear');
        return;
      }

      // Biome hazards — they keep moving while ghosted, they just cannot hurt
      for (const hz of course.hazards) {
        const sx = hz.x - dist;
        if (sx < -300 || sx > CANVAS_W + 300)
          continue;

        if (hz.type === 'gust') {
          if (dist + BIRD_X >= hz.x && dist + BIRD_X <= hz.x + hz.w) {
            if (!hz.entered) {
              hz.entered = true;
              sfx('whoosh', { volume: 0.3 });
            }
            bird.vy += hz.dir * hz.strength * (1 - 0.4 * treeLevel('w_wind')) * step;
          }
        } else if (hz.type === 'icicle') {
          if (hz.sy === undefined)
            hz.sy = hz.len;
          if (!hz.warnStarted && hz.x - (dist + BIRD_X) < 420) {
            hz.warnStarted = true;
            hz.warn = 0.35;
          }
          if (hz.warnStarted && !hz.falling) {
            hz.warn -= dt;
            if (hz.warn <= 0) {
              hz.falling = true;
              hz.vy = 0;
              sfx('drop');
            }
          }
          if (!hz.smashed) {
            if (hz.falling) {
              hz.vy += 0.55 * step;
              hz.sy += hz.vy * step;
            }
            if (circleRect(BIRD_X, bird.y, birdRadius(), sx - 9, hz.sy - hz.len, 18, hz.len))
              takeHit('icicle');
            if (hz.sy >= GROUND_Y) {
              hz.smashed = true;
              particles.burst(sx, GROUND_Y - 4, 14, { color: '#cfefff', speed: 4, size: 3, gravity: 0.2 });
              sfx('smallExplode', { volume: 0.35 });
            }
          }
        } else if (hz.type === 'bat') {
          hz.x -= 1.4 * step;
          const bx = hz.x - dist;
          const by = hz.y + hz.amp * Math.sin(Math.PI * 2 * runTime / hz.period + hz.phase);
          const rr = 15 + birdRadius();
          const dx = bx - BIRD_X;
          const dy = by - bird.y;
          if (dx * dx + dy * dy < rr * rr)
            takeHit('bat');
        } else if (hz.type === 'laser') {
          const gate = course.gates.find(g => g.index === hz.gate);
          if (!gate)
            continue;
          const cycle = hz.on + hz.off;
          const tt = (runTime + hz.phase) % cycle;
          const lit = tt < hz.on;
          const beamX = gate.x - dist + GATE_W / 2;
          if (lit) {
            if (!hz.wasOn && beamX > 0 && beamX < CANVAS_W)
              sfx('laser', { volume: 0.25 });
            if (Math.abs(BIRD_X - beamX) < birdRadius() + 3)
              takeHit('laser');
          }
          hz.wasOn = lit;
        } else if (hz.type === 'fireball') {
          const u = ((runTime + hz.phase) % hz.period) / hz.period;
          const fy = GROUND_Y + 20 - hz.height * GROUND_Y * Math.sin(Math.PI * u);
          if (fy < GROUND_Y + 10) {
            // the launch is heard once per cycle, only while the column is on screen
            const cycle = Math.floor((runTime + hz.phase) / hz.period);
            if (hz.soundCycle !== cycle && u < 0.5 && sx > -40 && sx < CANVAS_W + 40) {
              hz.soundCycle = cycle;
              sfx('shoot', { pitch: 0.6, volume: 0.3 });
            }
            const rr = 17 + birdRadius();
            const dx = sx - BIRD_X;
            const dy = fy - bird.y;
            if (dx * dx + dy * dy < rr * rr)
              takeHit('fireball');
            hz.ember = (hz.ember || 0) + 1;
            if (hz.ember % 4 === 0)
              particles.trail(sx, fy + 12, { color: '#ff8a3a', size: 3, life: 0.4, vy: 1 });
          }
        }

        if (state !== STATE_PLAYING)
          break;
      }
    }

    if (scorePopTimer > 0)
      scorePopTimer -= dt;
    if (coinBump > 0)
      coinBump -= dt;
    if (coinsRun !== lastCoinsShown) {
      lastCoinsShown = coinsRun;
      coinBump = 0.2;
    }
    biomeBanner = Math.max(0, biomeBanner - dt);

    // Afterimage trail while the combo is hot or the world runs in slow-mo
    if (combo >= 10 || power.slow > 0) {
      ++afterimageTick;
      if (afterimageTick % 2 === 0) {
        afterimages.push({ x: BIRD_X, y: bird.y, angle: bird.angle, frame: wingFrame });
        if (afterimages.length > 6)
          afterimages.shift();
      }
    } else {
      afterimages.length = 0;
    }

    updateFeathers(dt);
    updateWeather(dt, scene, true);
    updateRings(dt);

    // Effects
    particles.update();
    floatingText.update();
    screenShake.update(dt * 1000);
  }

  /* ── Small Shapes ── */
  /* A heart `w` px wide: two round lobes and a point; a lost heart is only an outline */
  function drawHeart(cx, cy, w, filled) {
    const r = w / 4;
    const lobeY = cy - r * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.4);
    ctx.lineTo(cx - 2 * r, lobeY);
    ctx.arc(cx - r, lobeY, r, Math.PI, Math.PI * 2);
    ctx.arc(cx + r, lobeY, r, Math.PI, Math.PI * 2);
    ctx.lineTo(cx, cy + r * 1.4);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#ff4a5a';
      ctx.fill();
      ctx.strokeStyle = '#8c1220';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // the glint rides on the left lobe
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.6, lobeY - r * 0.45, r * 0.34, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStarShape(x, y, r, filled) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = ui.UI.gold;
      ctx.fill();
      ctx.strokeStyle = ui.UI.goldDeep;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function dimBackdrop() {
    const v = visibleRect();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* Register one clickable / keyboard-selectable item for this frame */
  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  /* True when the keyboard cursor or the mouse rests on the item; hovering selects it */
  function isHot(index, x, y, w, h) {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    if (hovered)
      menuCursor = index;
    return hovered || menuCursor === index;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.55;
    if (hot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.03, 1.03);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ui.drawPanel(x, y, w, h, {
      radius: 10,
      noStuds: true,
      accent: hot ? ui.UI.gold : (opts.accent || ui.UI.accent),
      glow: hot,
      top: hot ? 'rgba(36,46,76,0.96)' : undefined,
      bottom: hot ? 'rgba(15,19,36,0.96)' : undefined
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 24, opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 11, w - 24, 11, { color: ui.UI.textDim });
    ctx.restore();
  }

  function moveMenuCursor(d) {
    const n = hitAreas.length;
    if (!n)
      return;
    menuCursor = (menuCursor + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error');
      return;
    }
    sfx('select');
    item.action();
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  /* Gold coin chip: the amount right-aligned at x, a spinning coin to its left */
  function drawCoinChip(amount, x, y) {
    const w = ui.drawChip(String(amount), x, y, 30, {
      align: 'right',
      color: ui.UI.gold,
      bg: 'rgba(0,0,0,0.45)',
      border: ui.hexToRgba(ui.UI.gold, 0.4)
    });
    sceneFor('meadow').drawCoin(ctx, x - w - 22, y + 15, globalTime);
    return w;
  }

  /* ── Menu background: a drifting biome that slowly cycles through all six ── */
  function drawMenuBackground() {
    if (globalTime - menuBiomeAt >= 12) {
      menuBiomeAt = globalTime;
      menuBiomeIndex = (menuBiomeIndex + 1) % SZ.FlappyCourse.BIOME_ORDER.length;
    }
    const ms = sceneFor(SZ.FlappyCourse.BIOME_ORDER[menuBiomeIndex]);
    const v = visibleRect();
    ms.drawSky(ctx, v);
    ms.drawBackdrop(ctx, globalTime * 60, globalTime, v);
    drawWeather('back');
    ms.drawGround(ctx, globalTime * 60, v);
    drawWeather('front');
    ctx.fillStyle = 'rgba(6, 10, 24, 0.35)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* ── Title screen ── */
  function drawTitleScreen() {
    const t = globalTime;
    ui.drawHeadline('FLAPPY BIRD', 640, 130, 900, 96, '#ffd23f', '#ff8a1e');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Flap. Dodge. Collect. Soar.', 640, 200, 600, 22, { color: ui.UI.textDim });

    // the decoration birds stay in the left and right thirds — they never cross the
    // headline, the subtitle or the column of buttons
    const others = BIRD_DEFS.filter(d => birdOwned(d.id) && d.id !== currentBird()).map(d => d.id);
    while (others.length < 2)
      others.push(others.length === 0 ? 'ruby' : 'jay');
    for (let i = 0; i < 2; ++i) {
      const home = i === 0 ? 250 : 1040;
      const x = home + Math.sin(t * (0.5 + i * 0.17) + i) * 130;
      const y = 420 + i * 90 + Math.sin(t * 1.5 + i * 2) * 60;
      SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: y, angle: 0, birdId: others[i], frame: t * 8, scale: 1.4 });
    }
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: 250 + 80 * Math.sin(t),
      y: 450 + 70 * Math.sin(2 * t),
      angle: 0.2 * Math.cos(2 * t),
      birdId: currentBird(),
      frame: t * 10,
      scale: 3
    });

    const bx = 640 - 170;
    let y = 236;
    drawButton('t-adventure', 'Adventure', bx, y, 340, 50, { sub: totalStars() + ' / 72 stars', action: goWorlds });
    y += 58;
    drawButton('t-classic', 'Classic', bx, y, 340, 50, { sub: 'Best ' + save.best.classic, action: () => { mode = 'classic'; startRun(); } });
    y += 58;
    drawButton('t-time', 'Time Attack', bx, y, 340, 50, { sub: 'Best ' + save.best.time, action: () => { mode = 'time'; startRun(); } });
    y += 58;
    drawButton('t-daily', 'Daily Run', bx, y, 340, 50, {
      sub: save.best.daily.date === todayKey() ? 'Best ' + save.best.daily.score : 'New seed today',
      action: () => { mode = 'daily'; startRun(); }
    });
    y += 58;
    drawButton('t-nest', 'Nest', bx, y, 340, 50, { sub: treeComplete() + ' / 15 upgrades', action: goNest });
    y += 58;
    drawButton('t-aviary', 'Aviary', bx, y, 340, 50, { sub: save.birds.length + '/6 birds', action: goAviary });
    y += 58;
    drawButton('t-help', 'Help', bx, y, 340, 50, { action: goHelp });

    drawCoinChip(save.coins, CANVAS_W - 24, 20);
    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'H', label: 'Help' }
    ], 640, 690, 420, 1.2);
  }

  /* ── Adventure world map ── */
  function drawWorldsScreen() {
    ui.drawHeadline('Adventure', 640, 62, 500, 44, ui.UI.gold);
    const stages = SZ.FlappyCourse.STAGES;
    for (let w = 0; w < 6; ++w) {
      const cx = 40 + (w % 3) * 404;
      const cy = 120 + Math.floor(w / 3) * 274;
      const biome = SZ.FlappyCourse.BIOME_ORDER[w];
      const worldLocked = !stageUnlocked(w * 4);

      ui.drawPanel(cx, cy, 380, 250, { accent: ui.UI.gold });

      // miniature of the biome sky, clipped into the card
      ctx.save();
      ui.roundRectPath(cx, cy, 380, 250, 9);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(0.3, 0.3);
      sceneFor(biome).drawSky(ctx);
      ctx.restore();
      const g = ctx.createLinearGradient(0, cy + 110, 0, cy + 250);
      g.addColorStop(0, 'rgba(6,10,24,0)');
      g.addColorStop(1, 'rgba(6,10,24,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(cx, cy + 110, 380, 140);

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ui.fitText(SZ.FlappyCourse.BIOMES[biome].name, cx + 16, cy + 26, 250, 26, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.6)' });
      // the star counter sits on a dark chip, right-aligned at the card edge
      ui.drawChip(worldStars(w) + ' / 12', cx + 380 - 16, cy + 26 - 13, 26, {
        align: 'right',
        color: '#ffd23f',
        bg: 'rgba(0,0,0,0.45)'
      });
      ctx.textAlign = 'left';

      if (worldLocked) {
        drawLock(cx + 190, cy + 110, 64);
        ctx.textAlign = 'center';
        ui.fitText('Clear ' + SZ.FlappyCourse.BIOMES[SZ.FlappyCourse.BIOME_ORDER[w - 1]].name, cx + 190, cy + 162, 340, 18, { weight: 'bold', color: ui.UI.warn });
        ctx.textAlign = 'left';
      }

      for (let s = 0; s < 4; ++s) {
        const idx = w * 4 + s;
        const bx = cx + 12 + s * 92, by = cy + 170;
        const locked = !stageUnlocked(idx);
        const action = () => { mode = 'adventure'; stageIndex = idx; startRun(); };
        const index = registerHit('stage' + idx, bx, by, 80, 64, action, locked);
        const hot = isHot(index, bx, by, 80, 64);
        ctx.save();
        if (locked)
          ctx.globalAlpha *= 0.45;
        if (hot) {
          ctx.translate(bx + 40, by + 32);
          ctx.scale(1.05, 1.05);
          ctx.translate(-(bx + 40), -(by + 32));
        }
        ui.drawPanel(bx, by, 80, 64, { radius: 8, noStuds: true, accent: hot ? ui.UI.gold : ui.UI.accent, glow: hot });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(String(s + 1), bx + 40, by + 22, 60, 26, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
        const earned = save.stars[stages[idx].id] || 0;
        for (let k = 0; k < 3; ++k)
          drawStarShape(bx + 26 + k * 14, by + 48, 6, k < earned);
        if (locked)
          drawLock(bx + 40, by + 32, 26);
        ctx.restore();
      }
    }
    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Stage' },
      { key: 'Enter', label: 'Play' },
      { key: 'Esc', label: 'Title' }
    ], 640, 692, 900, 1);
  }

  /* ── Nest tech tree ── */
  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

  function treeNodeById(id) {
    return TREE.find(n => n.id === id) || null;
  }

  /* Column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (let i = 0; i < node.req.length; ++i) {
      const parent = treeNodeById(node.req[i][0]);
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  /* Tabs plus the card grid of the active branch, centered in the card area */
  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE_BRANCHES.length - 1) * 8) / TREE_BRANCHES.length;
    for (let i = 0; i < TREE_BRANCHES.length; ++i) {
      const b = TREE_BRANCHES[i];
      const nodes = TREE.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCHES[treeBranch];
    const cols = [];
    for (const node of TREE) {
      if (node.branch !== branch.id)
        continue;
      const d = treeDepth(node);
      if (!cols[d])
        cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c])
        rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c])
        continue;
      for (let r = 0; r < cols[c].length; ++r) {
        const node = cols[c][r];
        cards.push({
          node: node,
          col: c,
          row: r,
          x: startX + c * (TREE_CARD_W + TREE_COL_GAP),
          y: startY + r * (TREE_CARD_H + gap),
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          state: nodeState(node)
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout)
      return null;
    return treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCHES[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(c => c.node.branch === branchId) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout)
      treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCHES[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId)
        continue;
      if (!cols[card.col])
        cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      treeBranch = (treeBranch + (ci < 0 ? -1 : 1) + TREE_BRANCHES.length) % TREE_BRANCHES.length;
      treeLayout = buildTreeLayout();
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    treeSelected = col[ri].node.id;
    sfx('click', { volume: 0.4 });
  }

  function drawNestScreen() {
    const layout = buildTreeLayout();
    treeLayout = layout;

    // keep a valid selection for the active branch
    if (!treeSelected || !layout.cards.some(c => c.node.id === treeSelected))
      selectFirstInBranch();

    // hover selects the card under the cursor
    if (mouseX >= 0) {
      for (const card of layout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    // header: title, coins, progress
    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Nest', 130, 58, 220, 40, ui.UI.gold);
    drawCoinChip(save.coins, 1236, 30);
    ctx.textAlign = 'right';
    ui.fitText(treeComplete() + ' / ' + TREE.length + ' upgrades complete', 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    // branch tabs
    for (const tab of layout.tabs) {
      const active = tab.index === treeBranch;
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = '#0d1020';
      ctx.fill();
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = ui.hexToRgba(tab.branch.color, active ? 0.55 : 0.25);
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = tab.branch.color;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(tab.branch.name + ' ' + tab.maxed + '/' + tab.total, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // connectors under the cards
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from)
          continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.8) : '#3a4058';
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    for (const card of layout.cards)
      drawNestNodeCard(card);

    // selection outline
    for (const card of layout.cards) {
      if (card.node.id !== treeSelected)
        continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 690, 900, 1);
  }

  function drawNestNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES.find(b => b.id === node.branch);
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    // buyable cards breathe with a pulsing outline
    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(globalTime * 4));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

    // level pips
    for (let l = 0; l < max; ++l) {
      const px = card.x + 16 + l * 20;
      const py = card.y + card.h - 18;
      ui.roundRectPath(px, py, 16, 8, 2);
      ctx.fillStyle = l < level ? branch.color : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (l >= level) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    }

    // cost or MAX, bottom right — the cost carries a small coin instead of a currency word
    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      const cw = ui.fitText(String(node.costs[level]), card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
      sceneFor('meadow').drawCoin(ctx, card.x + card.w - 16 - cw - 16, card.y + card.h - 18, globalTime);
    }

    // locked cards say what is still missing
    if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(treeNodeById(node.req[i][0]).name + ' ' + romanNumeral(node.req[i][1]));
      }
      ctx.textAlign = 'center';
      ui.fitText('Requires ' + missing.join(', '), card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    // white flash over a just-bought card
    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (globalTime - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ── Aviary ── */
  function drawAviaryScreen() {
    ui.drawHeadline('Aviary', 640, 62, 500, 44, ui.UI.gold);
    const def = BIRD_DEFS[aviaryIndex];

    // glowing round pedestal with the big preview bird
    const px = 320, py = 400;
    const glow = ctx.createRadialGradient(px, py, 20, px, py, 150);
    glow.addColorStop(0, 'rgba(255,215,90,0.35)');
    glow.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,215,90,0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py + 84, 120, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,215,90,0.5)';
    ctx.stroke();
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: px,
      y: py - 6 + Math.sin(globalTime * 2) * 6,
      angle: 0,
      birdId: def.id,
      frame: globalTime * 10,
      scale: 4.5
    });

    // info panel
    const rx = 560, ry = 110, rw = 680, rh = 330;
    ui.drawPanel(rx, ry, rw, rh, { accent: ui.UI.gold });
    ui.drawHeadline(birdName(def.id), rx + rw / 2, ry + 62, rw - 80, 44, ui.UI.text);
    ui.drawTextBlock(def.perk, rx + 40, ry + 110, rw - 80, 60, 22, { color: ui.UI.textDim, valign: 'middle' });
    let status, statusColor;
    if (def.id === currentBird()) {
      status = 'Selected';
      statusColor = ui.UI.good;
    } else if (birdOwned(def.id)) {
      status = 'Owned — Enter to select';
      statusColor = ui.UI.text;
    } else if (!birdAvailable(def)) {
      status = 'Clear stage ' + def.unlock + ' to unlock';
      statusColor = ui.UI.warn;
    } else {
      status = 'Buy for ' + def.price;
      statusColor = ui.UI.gold;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(status, rx + rw / 2, ry + rh - 52, rw - 80, 24, { weight: 'bold', color: statusColor });

    // the six birds in a row along the bottom
    for (let i = 0; i < BIRD_DEFS.length; ++i) {
      const d = BIRD_DEFS[i];
      const cx = 140 + i * 170, cy = 556;
      const index = registerHit('bird' + i, cx, cy, 150, 120, () => { aviaryIndex = i; buyBird(d.id); }, false);
      const hot = isHot(index, cx, cy, 150, 120);
      if (hot)
        aviaryIndex = i;
      const owned = birdOwned(d.id);
      const avail = birdAvailable(d);
      const sel = d.id === currentBird();
      ctx.save();
      if (!avail)
        ctx.globalAlpha *= 0.55;
      ui.drawPanel(cx, cy, 150, 120, { radius: 8, noStuds: true, accent: sel ? ui.UI.good : (hot ? ui.UI.gold : ui.UI.accent), glow: hot });
      SZ.FlappyBirdArt.drawBird(ctx, { x: cx + 75, y: cy + 42, angle: 0, birdId: d.id, frame: globalTime * 8, scale: 1.6 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(birdName(d.id), cx + 75, cy + 82, 130, 15, { weight: 'bold', color: ui.UI.text });
      if (!avail) {
        drawLock(cx + 75, cy + 104, 18);
      } else if (owned) {
        ui.fitText(sel ? 'Active' : 'Owned', cx + 75, cy + 104, 120, 12, { color: sel ? ui.UI.good : ui.UI.textDim });
      } else {
        ctx.textAlign = 'left';
        ui.fitText(String(d.price), cx + 68, cy + 104, 70, 14, { weight: 'bold', color: ui.UI.gold });
        sceneFor('meadow').drawCoin(ctx, cx + 52, cy + 104, globalTime);
      }
      if (i === aviaryIndex) {
        ui.roundRectPath(cx - 3, cy - 3, 156, 126, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Bird' },
      { key: 'Enter', label: 'Buy / Select' },
      { key: 'Esc', label: 'Back' }
    ], 640, 700, 900, 1);
  }

  /* ── Help ── */
  const HELP_PAGES = [
    {
      title: 'Flying',
      lines: [
        'Space, click or tap to flap.',
        'Hold the flap while falling to glide, once Glide is learned.',
        'Steer through the gaps between the pipes.',
        'The pipes move and close — watch the openings.',
        'Esc pauses the run.'
      ]
    },
    {
      title: 'Coins & combos',
      lines: [
        'Coins pay for Nest upgrades and Aviary birds.',
        'A pass through the middle of a gap is PERFECT and builds the combo.',
        'Combo 5, 10 and 20 multiply coins x2, x3 and x4.',
        'A close shave past a pipe pays a bonus coin.',
        'A hit breaks the combo — the Combo Keeper can save it.'
      ]
    },
    {
      title: 'Power-ups',
      bubbles: ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny'],
      lines: [
        'Shield — eats the next hit.',
        'Magnet — pulls coins in for a while.',
        'Slow-mo — the whole world slows down.',
        'Ghost — pass through everything but the ground.',
        'Double coins — every coin pays twice.',
        'Tiny — the bird and its hitbox shrink.'
      ]
    },
    {
      title: 'Modes',
      lines: [
        'Adventure stars: finish the stage, collect 60% of the coins, take no hits.',
        'Classic medals: Bronze 10, Silver 25, Gold 50, Platinum 100.',
        'Time Attack: 60 seconds on the clock, every hit costs 3 seconds.',
        'Daily Run: the same course for everyone today.'
      ]
    }
  ];

  function drawHelpScreen() {
    const pw = 900, ph = 520;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
    ui.drawPanel(px, py, pw, ph, { title: 'Help', titlePx: 20, titleRight: (helpPage + 1) + ' / ' + HELP_PAGES.length });
    const page = HELP_PAGES[helpPage];
    ui.drawHeadline(page.title, 640, py + 84, pw - 120, 36, ui.UI.gold);
    let ly = py + 150;
    for (let i = 0; i < page.lines.length; ++i) {
      if (page.bubbles) {
        ctx.save();
        ctx.translate(px + 100, ly);
        ctx.scale(0.55, 0.55);
        sceneFor('meadow').drawBubble(ctx, page.bubbles[i], 0, 0, globalTime);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(page.lines[i], px + 150, ly, pw - 270, 20, { color: ui.UI.text });
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(page.lines[i], 640, ly, pw - 160, 20, { color: ui.UI.text });
      }
      ly += 52;
    }
    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Close' }
    ], 640, py + ph - 26, 500, 1.1);
  }

  /* ── Draw ── */
  function draw() {
    hitAreas.length = 0;

    // Menu screens replace the frozen run with a drifting biome backdrop
    if (state === STATE_TITLE || state === STATE_WORLDS || state === STATE_NEST ||
      state === STATE_AVIARY || state === STATE_HELP) {
      drawMenuBackground();
      if (state === STATE_TITLE)
        drawTitleScreen();
      else if (state === STATE_WORLDS)
        drawWorldsScreen();
      else if (state === STATE_NEST)
        drawNestScreen();
      else if (state === STATE_AVIARY)
        drawAviaryScreen();
      else
        drawHelpScreen();
      return;
    }

    ctx.save();

    // Apply screen shake
    screenShake.apply(ctx);

    // A slight camera push-in during the death tumble (the HUD stays put)
    if (state === STATE_DYING) {
      const z = 1 + 0.06 * Math.min(1, dyingTimer / 0.5);
      ctx.translate(BIRD_X, bird.y);
      ctx.scale(z, z);
      ctx.translate(-BIRD_X, -bird.y);
    }

    // Biome scenery — it covers everything the canvas shows, the shake shift included
    const view = visibleRect();
    view.x0 -= 12;
    view.y0 -= 12;
    view.x1 += 12;
    view.y1 += 12;
    scene.drawSky(ctx, view);
    scene.drawBackdrop(ctx, dist, globalTime, view);

    // Gust streaks go behind the gates so the columns cover them
    for (const hz of course.hazards) {
      if (hz.type !== 'gust')
        continue;
      const sx = hz.x - dist;
      if (sx + hz.w < -40 || sx > CANVAS_W + 40)
        continue;
      scene.drawHazard(ctx, { type: 'gust', sx: sx, w: hz.w, dir: hz.dir, strength: hz.strength }, globalTime);
    }

    // Fireflies glow behind the gates
    drawWeather('back');

    // Gates
    for (const gate of course.gates) {
      const sx = gate.x - dist;
      if (sx <= -100 || sx >= CANVAS_W + 100)
        continue;
      const shape = SZ.FlappyCourse.gateShape(gate, runTime);
      scene.drawGate(ctx, sx, shape.y - shape.gap / 2, shape.y + shape.gap / 2);
    }

    // The remaining hazards pass in front of the gates
    for (const hz of course.hazards) {
      if (hz.type === 'gust')
        continue;
      const sx = hz.x - dist;
      if (sx < -300 || sx > CANVAS_W + 300)
        continue;

      if (hz.type === 'icicle') {
        if (hz.smashed)
          continue;
        const shake = hz.warn > 0 ? Math.random() * 4 - 2 : 0;
        scene.drawHazard(ctx, { type: 'icicle', sx: sx + shake, sy: hz.sy ?? hz.len, len: hz.len }, globalTime);
      } else if (hz.type === 'bat') {
        const by = hz.y + hz.amp * Math.sin(Math.PI * 2 * runTime / hz.period + hz.phase);
        scene.drawHazard(ctx, { type: 'bat', sx: sx, sy: by, frame: Math.floor(globalTime * 8) % 2 }, globalTime);
      } else if (hz.type === 'laser') {
        const gate = course.gates.find(g => g.index === hz.gate);
        if (!gate)
          continue;
        const shape = SZ.FlappyCourse.gateShape(gate, runTime);
        const cycle = hz.on + hz.off;
        const tt = (runTime + hz.phase) % cycle;
        const lit = tt < hz.on;
        scene.drawHazard(ctx, {
          type: 'laser',
          sx: gate.x - dist,
          y1: shape.y - shape.gap / 2,
          y2: shape.y + shape.gap / 2,
          on: lit,
          warn: !lit && tt > cycle - 0.45
        }, globalTime);
      } else if (hz.type === 'fireball') {
        const u = ((runTime + hz.phase) % hz.period) / hz.period;
        const fy = GROUND_Y + 20 - hz.height * GROUND_Y * Math.sin(Math.PI * u);
        if (fy >= GROUND_Y + 10)
          continue;
        scene.drawHazard(ctx, { type: 'fireball', sx: sx, sy: fy, vy: -Math.cos(Math.PI * u) }, globalTime);
      }
    }

    // Coins
    for (const coin of course.coins) {
      if (coin.taken)
        continue;
      const cx = coin.x - dist;
      if (cx < -40 || cx > CANVAS_W + 40)
        continue;
      scene.drawCoin(ctx, cx, coin.y, globalTime);
    }

    // Power-up bubbles (drawn only — picked up in a later step)
    for (const bubble of course.bubbles) {
      if (bubble.taken)
        continue;
      const bx = bubble.x - dist;
      if (bx < -60 || bx > CANVAS_W + 60)
        continue;
      scene.drawBubble(ctx, bubble.kind, bx, bubble.y, globalTime);
    }

    scene.drawGround(ctx, dist, view);

    // Leaves, sand, snow, rain and embers drift in front of the ground
    drawWeather('front');

    // Afterimage trail, faintest first
    const birdScale = power.tiny > 0 ? 1.05 * 0.65 : 1.05;
    for (let k = 0; k < afterimages.length; ++k) {
      const a = afterimages[k];
      SZ.FlappyBirdArt.drawBird(ctx, {
        x: a.x,
        y: a.y,
        angle: a.angle,
        birdId: currentBird(),
        frame: a.frame,
        scale: birdScale,
        alpha: 0.08 * (k + 1)
      });
    }

    // Bird — ghosted it turns translucent, tiny it shrinks with its hitbox
    let birdAlpha = invuln > 0 && Math.floor(globalTime * 16) % 2 === 0 ? 0.35 : 1;
    if (power.ghost > 0)
      birdAlpha = power.ghost < 1 && Math.floor(globalTime * 10) % 2 === 0 ? 0.25 : 0.55;
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: BIRD_X,
      y: bird.y,
      angle: bird.angle,
      birdId: currentBird(),
      frame: wingFrame,
      scale: birdScale,
      alpha: birdAlpha
    });

    // Shield ring
    if (power.shield) {
      ctx.save();
      ctx.strokeStyle = '#4aa3ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(BIRD_X, bird.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(BIRD_X, bird.y, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Loose feathers and the rings left by picked-up coins
    drawFeathers();
    drawRings();

    // Particles and floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);

    // Slow-motion vignette
    if (power.slow > 0) {
      const v = visibleRect();
      ctx.fillStyle = 'rgba(120, 60, 200, 0.18)';
      ctx.fillRect(v.x0, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x1 - 40, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 40);
      ctx.fillRect(v.x0, v.y1 - 40, v.x1 - v.x0, 40);
    }

    /* ── HUD ── */
    if (state === STATE_PLAYING || state === STATE_DYING || state === STATE_PAUSED) {
      // Adventure progress — the bar sits at the very top, a flag marks its end
      if (mode === 'adventure') {
        ui.drawMeter(440, 14, 400, 10, Math.min(1, (dist + BIRD_X) / course.finishX), '#ffd23f');
        ctx.save();
        ctx.strokeStyle = '#e8eefc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(848, 10);
        ctx.lineTo(848, 28);
        ctx.stroke();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(848, 10);
        ctx.lineTo(864, 15);
        ctx.lineTo(848, 20);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Score display during play — a dark copy sits under the outlined number
      ctx.save();
      const popScale = scorePopTimer > 0 ? 1 + 0.2 * (scorePopTimer / 0.2) : 1;
      const scorePx = Math.round(64 * popScale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.35;
      ui.fitText(String(score), CANVAS_W / 2 + 3, 82, 500, scorePx, { weight: 'bold', color: '#000' });
      ctx.globalAlpha = 1;
      ui.fitText(String(score), CANVAS_W / 2, 78, 500, scorePx, {
        weight: 'bold',
        color: '#fff',
        outline: '#000'
      });
      ctx.restore();

      // Combo streak under the score
      if (combo >= 2)
        ui.drawChip('COMBO ' + combo + '  x' + comboMult(), CANVAS_W / 2, 148, 30, {
          align: 'center',
          color: '#7affd8',
          bg: 'rgba(0,0,0,0.45)'
        });

      // Coins & hearts panel — the counter bumps whenever coins come in
      ui.drawPanel(20, 16, 210, 92);
      scene.drawCoin(ctx, 50, 44, globalTime);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (coinBump > 0) {
        const bs = 1 + 0.25 * (coinBump / 0.2);
        ctx.translate(76, 44);
        ctx.scale(bs, bs);
        ctx.translate(-76, -44);
      }
      ui.fitText(String(coinsRun), 76, 44, 142, 30, { weight: 'bold', color: ui.UI.gold });
      ctx.restore();
      const maxH = maxHearts();
      for (let i = 0; i < maxH; ++i) {
        // The last heart left breathes when there were more to lose
        if (hearts === 1 && maxH > 1 && i === 0) {
          const hs = 1 + 0.12 * Math.sin(globalTime * 8);
          ctx.save();
          ctx.translate(40, 84);
          ctx.scale(hs, hs);
          ctx.translate(-40, -84);
          drawHeart(40, 84, 22, true);
          ctx.restore();
        } else {
          drawHeart(40 + i * 28, 84, 22, i < hearts);
        }
      }

      // Time attack clock
      if (mode === 'time') {
        const t = Math.max(0, timeLeft);
        ui.drawChip(t.toFixed(1) + ' s', CANVAS_W - 24, 20, 36, {
          align: 'right',
          color: t < 10 ? ui.UI.bad : ui.UI.text,
          bg: 'rgba(0,0,0,0.45)'
        });
      }

      // Active power-ups, top right below the clock
      const chips = [];
      if (power.shield)
        chips.push({ kind: 'shield', frac: 1 });
      for (const kind of POWER_TIMED)
        if (power[kind] > 0)
          chips.push({ kind: kind, frac: power[kind] / powerDuration(kind) });
      let chipX = CANVAS_W - 40;
      const chipY = mode === 'time' ? 96 : 40;
      for (const chip of chips) {
        ctx.save();
        ctx.translate(chipX, chipY);
        ctx.scale(0.6, 0.6);
        scene.drawBubble(ctx, chip.kind, 0, 0, globalTime);
        ctx.restore();
        if (chip.kind !== 'shield') {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(chipX, chipY, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chip.frac);
          ctx.stroke();
          ctx.restore();
        }
        chipX -= 56;
      }
    }

    // Biome banner — slides in from the top, stays, then fades out; the READY screen
    // keeps it armed so the banner belongs to the run, not to the wait before it
    if (biomeBanner > 0 && state !== STATE_READY) {
      const age = 2.5 - biomeBanner;
      const inU = Math.min(1, age / 0.35);
      const inEase = 1 - Math.pow(1 - inU, 3);
      const bannerY = -60 + inEase * 260;
      ctx.save();
      ctx.globalAlpha = Math.min(1, biomeBanner);
      ui.drawPanel(CANVAS_W / 2 - 240, bannerY, 480, 84);
      ctx.fillStyle = scene.theme.sun.glow;
      ctx.globalAlpha = Math.min(1, biomeBanner) * 0.8;
      ctx.fillRect(CANVAS_W / 2 - 200, bannerY + 66, 400, 3);
      ctx.globalAlpha = Math.min(1, biomeBanner);
      ui.drawHeadline(biomeBannerText, CANVAS_W / 2, bannerY + 42, 440, 40, ui.UI.gold);
      ctx.restore();
    }

    // Ready screen overlay — a compact panel beside the bird, never over it
    if (state === STATE_READY) {
      const pw = 460;
      const ph = 150;
      const px = 700;
      const py = 250;
      const cx = px + pw / 2;
      let title;
      if (mode === 'adventure') {
        const st = SZ.FlappyCourse.STAGES[stageIndex];
        title = 'Adventure ' + st.id + ' ' + st.name;
      } else if (mode === 'time')
        title = 'Time Attack';
      else if (mode === 'daily')
        title = 'Daily Run';
      else
        title = 'Classic';
      ui.drawPanel(px, py, pw, ph, { title: title, titlePx: 20 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (mode === 'adventure') {
        const st = SZ.FlappyCourse.STAGES[stageIndex];
        const n = save.stars[st.id] || 0;
        let starsStr = '';
        for (let i = 0; i < 3; ++i)
          starsStr += i < n ? '★' : '☆';
        ui.fitText('Stars: ' + starsStr, cx, py + 62, pw - 40, 22, { color: ui.UI.gold });
      } else {
        ui.fitText('Best: ' + modeBest(), cx, py + 62, pw - 40, 22, { color: ui.UI.textDim });
      }
      ui.fitText('Tap or Space to start', cx, py + 96, pw - 40, 26, { weight: 'bold', color: ui.UI.text });
      ctx.restore();

      ui.drawKeyHints([
        { key: 'Space', label: 'Start' },
        { key: 'Esc', label: 'Menu' }
      ], cx, py + ph - 24, pw - 40, 1);

      // Dotted preview of where the first flap would carry the bird
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      let tvy = FLAP_IMPULSE, ty = bird.y;
      for (let f = 1; f <= 30; ++f) {
        tvy += gravityNow();
        ty += tvy;
        if (f % 4 === 0 || f === 30) {
          ctx.beginPath();
          ctx.arc(BIRD_X, ty, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Bouncing chevron pair and a pulsing TAP! under the bird
      ctx.save();
      const tapBounce = Math.sin(globalTime * 4) * 4;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(globalTime * 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let c = 0; c < 2; ++c) {
        const cy = bird.y + 42 + c * 13 + tapBounce;
        ctx.beginPath();
        ctx.moveTo(BIRD_X - 10, cy);
        ctx.lineTo(BIRD_X, cy + 8);
        ctx.lineTo(BIRD_X + 10, cy);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText('TAP!', BIRD_X + 52, bird.y + 55 + tapBounce, 100, 22, { weight: 'bold', color: '#ffffff' });
      ctx.restore();
    }

    // Paused overlay
    if (state === STATE_PAUSED) {
      dimBackdrop();
      const pw = 360;
      const ph = 240;
      const px = (CANVAS_W - pw) / 2;
      const py = (CANVAS_H - ph) / 2 - 60;
      ui.drawPanel(px, py, pw, ph);
      ui.drawHeadline('PAUSED', CANVAS_W / 2, py + 52, pw - 40, 44, ui.UI.text);
      drawButton('p-resume', 'Resume', px + 40, py + 96, pw - 80, 40, { action: () => { state = STATE_PLAYING; updateStatus(); } });
      drawButton('p-restart', 'Restart', px + 40, py + 144, pw - 80, 40, { action: () => startRun() });
      drawButton('p-quit', 'Quit to Menu', px + 40, py + 192, pw - 80, 40, { action: quitToMenu });
    }

    // Death screen — the panel is only as tall as the rows it actually shows
    if (state === STATE_DEAD) {
      dimBackdrop();
      const pw = 380;
      const medal = (mode === 'classic' || mode === 'daily') ? getMedal(score) : null;
      const headH = 36, scoreH = 34, bestH = 32, coinH = 28, comboH = 28, medalH = 118, chipH = 44, padH = 14;
      let ph = headH + scoreH + bestH + coinH + comboH + padH;
      if (medal)
        ph += medalH;
      if (newBest)
        ph += chipH;
      const px = (CANVAS_W - pw) / 2;
      const py = (CANVAS_H - ph) / 2;
      const rowsH = headH + scoreH + bestH + coinH + comboH;
      const medalCY = py + rowsH + 52;
      const chipCY = py + rowsH + (medal ? medalH : 0) + chipH / 2;
      const pt = Math.min(1, (globalTime - panelAt) / 0.3);
      const pEase = 1 - Math.pow(1 - pt, 3);
      const pOff = (1 - pEase) * 60;
      ctx.save();
      ctx.globalAlpha *= pEase;
      ctx.translate(0, pOff);
      ui.drawPanel(px, py, pw, ph, { title: mode === 'time' ? 'Time!' : 'Game Over', titlePx: 24 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText('Score: ' + score, CANVAS_W / 2, py + headH + scoreH / 2, pw - 60, 26, { weight: 'bold', color: ui.UI.text });
      if (mode === 'adventure') {
        // Adventure has no running best score — the stage and its saved stars stand in for it
        const st = SZ.FlappyCourse.STAGES[stageIndex];
        const stars = Math.min(3, save.stars[st.id] || 0);
        ui.fitText('Stage ' + st.id + ' · best ' + '★'.repeat(stars) + '☆'.repeat(3 - stars), CANVAS_W / 2, py + headH + scoreH + bestH / 2, pw - 60, 20, { color: ui.UI.gold });
      } else {
        ui.fitText('Best: ' + modeBest(), CANVAS_W / 2, py + headH + scoreH + bestH / 2, pw - 60, 20, { color: ui.UI.textDim });
      }
      ui.fitText('+' + coinsRun + ' coins  ·  ' + save.coins + ' total', CANVAS_W / 2, py + headH + scoreH + bestH + coinH / 2, pw - 60, 20, { color: ui.UI.gold });
      ui.fitText('Best combo ' + bestCombo + '  ·  Perfect passes ' + perfects, CANVAS_W / 2, py + rowsH - comboH / 2, pw - 60, 18, { color: ui.UI.textDim });

      if (medal) {
        // Slowly rotating light rays behind the medal
        ctx.save();
        ctx.translate(CANVAS_W / 2, medalCY);
        ctx.rotate(globalTime * 0.5);
        ctx.globalAlpha *= 0.12;
        ctx.fillStyle = medal.color;
        for (let i = 0; i < 8; ++i) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(78, -7);
          ctx.lineTo(78, 7);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        // The medal disc, with a wider translucent fill in place of a blur shadow
        ctx.save();
        ctx.fillStyle = medal.color;
        ctx.globalAlpha *= 0.3;
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, medalCY, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha /= 0.3;
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, medalCY, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ui.fitText(medal.name, CANVAS_W / 2, medalCY + 54, pw - 60, 20, { weight: 'bold', color: ui.UI.text });
      }

      if (newBest) {
        // The NEW BEST! chip breathes
        const cs = 1 + 0.06 * Math.sin(globalTime * 6);
        ctx.save();
        ctx.translate(CANVAS_W / 2, chipCY);
        ctx.scale(cs, cs);
        ctx.translate(-CANVAS_W / 2, -chipCY);
        ui.drawChip('NEW BEST!', CANVAS_W / 2, chipCY - 15, 30, {
          align: 'center',
          color: '#1a1200',
          bg: ui.UI.gold,
          border: ui.UI.goldDeep
        });
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      drawButton('d-retry', 'Retry', CANVAS_W / 2 - 178, py + ph + 16 + pOff, 170, 50, { action: () => startRun() });
      drawButton('d-menu', 'Menu', CANVAS_W / 2 + 8, py + ph + 16 + pOff, 170, 50, { action: quitToMenu });
    }

    // Adventure stage clear screen — the panel slides in and the stars pop in one by one
    if (state === STATE_CLEAR) {
      dimBackdrop();
      const pw = CLEAR_PW;
      const ph = CLEAR_PH;
      const px = (CANVAS_W - pw) / 2;
      const py = (CANVAS_H - ph) / 2;
      const linesY = py + CLEAR_HEAD_H + CLEAR_STARS_H;
      const panelT = globalTime - panelAt;
      const pt = Math.min(1, panelT / 0.3);
      const pEase = 1 - Math.pow(1 - pt, 3);
      const pOff = (1 - pEase) * 60;
      ctx.save();
      ctx.globalAlpha *= pEase;
      ctx.translate(0, pOff);
      ui.drawPanel(px, py, pw, ph, { title: 'Stage Clear!', titlePx: 24, accent: ui.UI.gold, glow: true });

      for (let i = 0; i < 3; ++i) {
        const sx = CANVAS_W / 2 + (i - 1) * 92, sy = py + CLEAR_STAR_CY;
        const st = panelT - (0.4 + i * 0.35);
        if (st < 0) {
          drawStarShape(sx, sy, 34, false);
          continue;
        }
        // Each star overshoots at 1.6 and settles to 1
        const su = Math.min(1, st / 0.25);
        const sScale = 1.6 - 0.6 * (1 - Math.pow(1 - su, 3));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(sScale, sScale);
        ctx.translate(-sx, -sy);
        drawStarShape(sx, sy, 34, i < lastStars);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Both coin tallies count up over the first second — the pickups and the paid-out value differ
      const ramp = Math.min(1, panelT / 0.8);
      const shownPicked = Math.round(coinsPicked * ramp);
      const shownEarned = Math.round(coinsRun * ramp);
      ui.fitText('Coins: ' + shownPicked + ' / ' + course.totalCoins, CANVAS_W / 2, linesY + 16, pw - 60, 22, { color: ui.UI.gold });
      ui.fitText('+' + shownEarned + ' coins earned', CANVAS_W / 2, linesY + 44, pw - 60, 20, { color: ui.UI.gold });
      ui.fitText('Total coins: ' + save.coins, CANVAS_W / 2, linesY + 70, pw - 60, 18, { color: ui.UI.textDim });
      ui.fitText('Hits taken: ' + hitsTaken, CANVAS_W / 2, linesY + 100, pw - 60, 20, { color: hitsTaken === 0 ? ui.UI.good : ui.UI.textDim });
      ui.fitText('Best combo ' + bestCombo + '  ·  Perfect passes ' + perfects, CANVAS_W / 2, linesY + 128, pw - 60, 18, { color: ui.UI.textDim });
      ctx.restore();
      ctx.restore();

      const next = stageIndex + 1;
      const hasNext = next < SZ.FlappyCourse.STAGES.length;
      drawButton('c-next', 'Next Stage', CANVAS_W / 2 - 207, py + ph + 16 + pOff, 130, 50, { action: () => { stageIndex = next; startRun(); }, disabled: !hasNext });
      drawButton('c-replay', 'Replay', CANVAS_W / 2 - 65, py + ph + 16 + pOff, 130, 50, { action: () => startRun() });
      drawButton('c-map', 'World Map', CANVAS_W / 2 + 77, py + ph + 16 + pOff, 130, 50, { action: goWorlds });
    }

    ctx.restore();
  }

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    update(dt);
    beginFrame();
    draw();
    drawScreenFx();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Status Bar ── */
  function updateStatus() {
    statusScore.textContent = 'Score: ' + score;
    if (mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[stageIndex];
      const earned = Math.min(3, save.stars[st.id] || 0);
      let pips = '';
      for (let i = 0; i < 3; ++i)
        pips += i < earned ? '★' : '☆';
      statusBest.textContent = 'Best: ' + pips + ' (stage ' + st.id + ')';
    } else {
      statusBest.textContent = 'Best: ' + modeBest();
    }
    if (state === STATE_TITLE) {
      statusState.textContent = 'Title';
      return;
    }
    if (state === STATE_WORLDS) {
      statusState.textContent = 'Adventure';
      return;
    }
    if (state === STATE_NEST) {
      statusState.textContent = 'Nest';
      return;
    }
    if (state === STATE_AVIARY) {
      statusState.textContent = 'Aviary';
      return;
    }
    if (state === STATE_HELP) {
      statusState.textContent = 'Help';
      return;
    }
    const label = state === STATE_PAUSED ? 'Paused' :
      state === STATE_DEAD || state === STATE_DYING ? 'Game Over' :
      state === STATE_CLEAR ? 'Stage Clear' :
      state === STATE_PLAYING ? 'Playing' : 'Ready';
    statusState.textContent = modeName() + ' - ' + label;
  }

  /* ── Input Handling ── */
  function togglePause() {
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
    else
      return;
    sfx('click', { volume: 0.4 });
    updateStatus();
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: togglePause
  });

  function handleInput() {
    if (state === STATE_READY) {
      state = STATE_PLAYING;
      flap();
      // the first flap out of READY is also the run start
      sfx('whoosh', { pitch: 1.2, volume: 0.4 });
      updateStatus();
    } else if (state === STATE_PLAYING) {
      flap();
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      if (state === STATE_READY || state === STATE_PLAYING || state === STATE_PAUSED ||
        state === STATE_DYING || state === STATE_DEAD || state === STATE_CLEAR)
        resetGame();
      else
        goTitle();
      return;
    }

    if ((e.key === 'h' || e.key === 'H') && !e.repeat) {
      if (state === STATE_HELP) {
        e.preventDefault();
        backToPrev();
        return;
      }
      if (isMenuState(state)) {
        e.preventDefault();
        goHelp();
        return;
      }
    }

    // ── Nest tech tree navigation ──
    if (state === STATE_NEST) {
      e.preventDefault();
      if (e.repeat)
        return;
      if (e.code === 'Escape') {
        backToPrev();
      } else if (e.code === 'Tab') {
        treeBranch = (treeBranch + 1) % TREE_BRANCHES.length;
        treeLayout = buildTreeLayout();
        selectFirstInBranch();
        sfx('click', { volume: 0.4 });
      } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const b = Number(e.code.slice(5)) - 1;
        if (b < TREE_BRANCHES.length) {
          treeBranch = b;
          treeLayout = buildTreeLayout();
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        moveTreeSelection(-1, 0);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveTreeSelection(1, 0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        moveTreeSelection(0, -1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        moveTreeSelection(0, 1);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        const node = treeNodeById(treeSelected);
        if (node && buyNode(node))
          treeBuyFlash = { id: node.id, at: globalTime };
      }
      return;
    }

    // ── Help pages ──
    if (state === STATE_HELP) {
      e.preventDefault();
      if (e.repeat)
        return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        helpPage = (helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length;
        sfx('click', { volume: 0.4 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        helpPage = (helpPage + 1) % HELP_PAGES.length;
        sfx('click', { volume: 0.4 });
      } else if (e.code === 'Escape')
        backToPrev();
      return;
    }

    // ── Menu screen navigation (all screens share the hit-area cursor) ──
    if (isMenuState(state) || state === STATE_PAUSED) {
      e.preventDefault();
      if (e.repeat)
        return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
        moveMenuCursor(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
        moveMenuCursor(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
        activateMenuItem(hitAreas[menuCursor]);
      else if (e.code === 'Escape') {
        if (state === STATE_PAUSED)
          togglePause();
        else
          menuEscape();
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        togglePause();
      else if (state === STATE_READY) {
        if (mode === 'adventure')
          goWorlds();
        else
          goTitle();
      }
      return;
    }

    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      flapHeld = true;
      handleInput();
    }
  });

  document.addEventListener('keyup', function(e) {
    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp')
      flapHeld = false;
  });

  canvas.addEventListener('pointerdown', function(e) {
    if (document.activeElement !== document.body || !document.hasFocus())
      window.focus();
    pointerToLogical(e);
    e.preventDefault();

    // the tree screen selects and buys by card, not by hit area
    if (state === STATE_NEST) {
      if (!treeLayout)
        treeLayout = buildTreeLayout();
      for (const tab of treeLayout.tabs) {
        if (mouseX >= tab.x && mouseX <= tab.x + tab.w && mouseY >= tab.y && mouseY <= tab.y + tab.h) {
          treeBranch = tab.index;
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
          return;
        }
      }
      for (const card of treeLayout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          if (buyNode(card.node))
            treeBuyFlash = { id: card.node.id, at: globalTime };
          return;
        }
      }
      return;
    }

    if (isMenuState(state) || state === STATE_PAUSED) {
      for (let i = 0; i < hitAreas.length; ++i) {
        const a = hitAreas[i];
        if (mouseX >= a.x && mouseX <= a.x + a.w && mouseY >= a.y && mouseY <= a.y + a.h) {
          menuCursor = i;
          activateMenuItem(a);
          return;
        }
      }
      return;
    }

    flapHeld = true;
    handleInput();
  });

  canvas.addEventListener('pointerup', function() {
    flapHeld = false;
  });

  canvas.addEventListener('pointercancel', function() {
    flapHeld = false;
  });

  window.addEventListener('pointerup', function() {
    flapHeld = false;
  });

  canvas.addEventListener('pointermove', pointerToLogical);

  /* ── Resize Handling ── */
  window.addEventListener('resize', setupCanvas);

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => goTitle(),
      pause: togglePause,
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
          const s = highScores[i] || 0;
          const medal = getMedal(s);
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${s}</td><td>${medal ? medal.name : '-'}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          highScores = [];
          saveHighScores();
          updateStatus();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — nothing specific needed, CSS handles it
    }
  });

  SZ.Dlls.User32.SetWindowText('Flappy Bird');

  /* ── Init ── */
  document.body.tabIndex = -1;
  loadHighScores();
  loadSave();
  setupCanvas();
  state = STATE_TITLE;
  updateStatus();
  updateWindowTitle();
  SZ.GameAudio.attachMuteButton();
  animFrameId = requestAnimationFrame(gameLoop);

})();
