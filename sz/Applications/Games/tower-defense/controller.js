;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const _hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const MAX_DT = 0.05;
  const CELL = 32;
  const COLS = 25;
  const ROWS = 17;
  const MAX_TIER = 3;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_BUILD = 'BUILD';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_VICTORY = 'VICTORY';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-tower-defense';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v1';
  const MAX_HIGH_SCORES = 10;

  /* ── Pre-wave warning timing ── */
  const WARNING_DURATION = 3;
  const AUTO_WAVE_DELAY = 5;

  /* ══════════════════════════════════════════════════════════════════
     TOWER DEFINITIONS
     13 tower types with unique abilities
     ══════════════════════════════════════════════════════════════════ */

  const TOWER_TYPES = [
    {
      id: 'arrow', name: 'Arrow', cost: 50, damage: 10, range: 120, fireRate: 0.8,
      color: '#6b4', colorDark: '#3a2', projectileColor: '#8d6', projectileSpeed: 300,
      desc: 'Fast, cheap'
    },
    {
      id: 'cannon', name: 'Cannon', cost: 80, damage: 35, range: 90, fireRate: 1.5,
      color: '#a63', colorDark: '#742', projectileColor: '#f80', projectileSpeed: 200,
      splash: 30, desc: 'Splash dmg'
    },
    {
      id: 'frost', name: 'Frost', cost: 70, damage: 8, range: 100, fireRate: 1.0,
      color: '#6af', colorDark: '#38c', projectileColor: '#aef', projectileSpeed: 250,
      slow: 0.5, desc: 'Slows enemies'
    },
    {
      id: 'lightning', name: 'Lightning', cost: 120, damage: 25, range: 140, fireRate: 1.2,
      color: '#ff0', colorDark: '#aa0', projectileColor: '#ff8', projectileSpeed: 600,
      chain: 2, desc: 'Chain hits'
    },
    {
      id: 'laser', name: 'Laser', cost: 150, damage: 50, range: 160, fireRate: 2.0,
      color: '#f0f', colorDark: '#a0a', projectileColor: '#f8f', projectileSpeed: 800,
      desc: 'High damage'
    },
    {
      id: 'poison', name: 'Poison', cost: 90, damage: 5, range: 110, fireRate: 0.9,
      color: '#0c4', colorDark: '#083', projectileColor: '#4f8', projectileSpeed: 220,
      dot: 15, dotDuration: 3, desc: 'Damage/time'
    },
    {
      id: 'tesla', name: 'Tesla', cost: 140, damage: 18, range: 100, fireRate: 0.6,
      color: '#4df', colorDark: '#29a', projectileColor: '#8ff', projectileSpeed: 500,
      chain: 4, desc: 'Multi-chain'
    },
    {
      id: 'mortar', name: 'Mortar', cost: 110, damage: 45, range: 180, fireRate: 2.5,
      color: '#a86', colorDark: '#754', projectileColor: '#da8', projectileSpeed: 150,
      splash: 50, desc: 'Long-range AoE'
    },
    {
      id: 'flame', name: 'Flame', cost: 100, damage: 12, range: 60, fireRate: 0.3,
      color: '#f60', colorDark: '#a40', projectileColor: '#fa4', projectileSpeed: 400,
      aoe: 40, dot: 8, dotDuration: 2, desc: 'Close AoE + burn'
    },
    {
      id: 'ice', name: 'Ice', cost: 130, damage: 15, range: 100, fireRate: 1.4,
      color: '#8ef', colorDark: '#4ac', projectileColor: '#cff', projectileSpeed: 280,
      freeze: 1.5, desc: 'Freezes enemies'
    },
    {
      id: 'fire', name: 'Fire', cost: 110, damage: 8, range: 80, fireRate: 0.8,
      color: '#f44', colorDark: '#a22', projectileColor: '#f88', projectileSpeed: 300,
      splash: 35, dot: 20, dotDuration: 3, desc: 'AoE burn zone'
    },
    {
      id: 'chainlightning', name: 'ChainLt', cost: 160, damage: 30, range: 130, fireRate: 1.3,
      color: '#af0', colorDark: '#7a0', projectileColor: '#df4', projectileSpeed: 550,
      chain: 3, desc: 'Chains to 3'
    },
    {
      id: 'sniper', name: 'Sniper', cost: 180, damage: 80, range: 250, fireRate: 3.0,
      color: '#ddd', colorDark: '#888', projectileColor: '#fff', projectileSpeed: 900,
      desc: 'Long-range snipe'
    },
    {
      id: 'spike', name: 'Spikes', cost: 30, damage: 3, range: 0, fireRate: 0,
      color: '#999', colorDark: '#555', projectileColor: '#999', projectileSpeed: 0,
      isFloorTrap: true, desc: 'Ground trap'
    }
  ];

  /* ── Upgrade multipliers per tier ── */
  const UPGRADE_COST_MULT = [0, 0.6, 1.0, 1.5];
  const UPGRADE_DAMAGE_MULT = [1, 1.4, 1.8, 2.4];
  const UPGRADE_RANGE_MULT = [1, 1.1, 1.2, 1.35];

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEFINITIONS
     Types: normal, fast, armored, flying, boss, healer, swarm, shield
     ══════════════════════════════════════════════════════════════════ */

  const ENEMY_TYPES = {
    normal:  { hp: 40,  speed: 40, bounty: 10, color: '#c44', radius: 6 },
    fast:    { hp: 25,  speed: 70, bounty: 12, color: '#4c4', radius: 5 },
    armored: { hp: 120, speed: 25, bounty: 25, color: '#888', radius: 8 },
    flying:  { hp: 35,  speed: 50, bounty: 15, color: '#88f', radius: 5 },
    boss:    { hp: 500, speed: 20, bounty: 100, color: '#f0f', radius: 12 },
    healer:  { hp: 60,  speed: 35, bounty: 20, color: '#4f4', radius: 6, heals: true },
    swarm:   { hp: 15,  speed: 60, bounty: 5,  color: '#fa0', radius: 4 },
    shield:  { hp: 80,  speed: 30, bounty: 30, color: '#4ff', radius: 7, shielded: true }
  };

  /* ══════════════════════════════════════════════════════════════════
     MAPS -- 12 maps with paths defined as waypoint sequences
     Grid: 0 = buildable, 1 = path, 2 = blocked
     ══════════════════════════════════════════════════════════════════ */

  const MAPS = [
    { name: 'Serpentine',     startGold: 200, startLives: 20, waves: 15, path: [[0,8],[4,8],[4,4],[10,4],[10,12],[16,12],[16,6],[24,6]] },
    { name: 'Crossroads',     startGold: 220, startLives: 18, waves: 18, path: [[0,4],[6,4],[6,12],[12,12],[12,4],[18,4],[18,12],[24,12]] },
    { name: 'Spiral',         startGold: 200, startLives: 20, waves: 15, path: [[0,0],[0,16],[24,16],[24,0],[4,0],[4,12],[20,12],[20,4],[8,4],[8,8]] },
    { name: 'Zigzag',         startGold: 180, startLives: 15, waves: 20, path: [[0,2],[8,2],[8,14],[16,14],[16,2],[24,2]] },
    { name: 'Diamond',        startGold: 250, startLives: 20, waves: 15, path: [[0,8],[6,2],[12,8],[18,14],[24,8]] },
    { name: 'Fortress',       startGold: 300, startLives: 25, waves: 12, path: [[0,8],[5,8],[5,3],[10,3],[10,13],[15,13],[15,8],[24,8]] },
    { name: 'Canyon',         startGold: 200, startLives: 18, waves: 18, path: [[0,14],[4,14],[4,2],[8,2],[8,14],[12,14],[12,2],[16,2],[16,14],[20,14],[20,2],[24,2]] },
    { name: 'Labyrinth',      startGold: 250, startLives: 15, waves: 20, path: [[0,0],[0,8],[6,8],[6,0],[12,0],[12,16],[18,16],[18,8],[24,8]] },
    { name: 'Twin Paths',     startGold: 220, startLives: 20, waves: 16, path: [[0,4],[10,4],[10,12],[20,12],[20,4],[24,4]] },
    { name: 'Gauntlet',       startGold: 180, startLives: 12, waves: 25, path: [[0,8],[3,4],[6,12],[9,4],[12,12],[15,4],[18,12],[21,4],[24,8]] },
    { name: 'Wasteland',      startGold: 200, startLives: 20, waves: 15, path: [[0,2],[12,2],[12,14],[24,14]] },
    { name: 'Final Stand',    startGold: 350, startLives: 10, waves: 30, path: [[0,8],[4,4],[8,8],[12,4],[16,8],[20,4],[24,8]] }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusWave = document.getElementById('statusWave');
  const statusGold = document.getElementById('statusGold');
  const statusLives = document.getElementById('statusLives');
  const highScoresBody = document.getElementById('highScoresBody');

  const { User32 } = SZ?.Dlls ?? {};

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = { trigger: (intensity, ms) => addShake(intensity, ms) };
  const floatingText = new SZ.GameEffects.FloatingText();
  const audio = SZ.GameAudio;

  /* Tower shots are throttled so a full board does not turn into noise */
  const SHOT_SOUNDS = {
    arrow: ['shoot', 1.4], cannon: ['thud', 1.2], frost: ['blip', 1.6], lightning: ['zap', 1],
    laser: ['laser', 1.3], poison: ['bounce', 0.8], tesla: ['zap', 1.3], mortar: ['thud', 0.8],
    flame: ['whoosh', 1.5], ice: ['blip', 1.3], fire: ['whoosh', 1.2], chainlightning: ['zap', 0.8],
    sniper: ['shoot', 0.7]
  };
  let lastShotSoundAt = 0;

  function playShotSound(def) {
    const now = performance.now();
    const snd = SHOT_SOUNDS[def.id];
    if (!snd || now - lastShotSoundAt < 90)
      return;
    lastShotSoundAt = now;
    audio.play(snd[0], { pitch: snd[1] * (0.95 + Math.random() * 0.1), volume: 0.35 });
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_READY;
  let currentMap = 0;
  let gold = 200;
  let lives = 20;
  let currentWave = 0;
  let totalWaves = 15;
  let gameSpeed = 1;
  let selectedTowerType = -1;   // tower type chosen in the build bar, -1 = none
  let selectedTower = null;
  let hoverCell = null;
  let hoverPoint = null;

  let towers = [];
  let enemies = [];
  let projectiles = [];
  let floorEffects = [];
  let pathCells = new Set();
  let waveEnemies = [];
  let spawnTimer = 0;
  let waveComplete = false;
  let waveCountdown = 0;
  let highScores = [];

  /* ── Auto-wave mode ── */
  let autoWaveMode = false;
  let autoWaveTimer = 0;

  /* ── Pre-wave warning state ── */
  let warningTimer = 0;
  let warningActive = false;
  let warningPulse = 0;

  /* ── Tower angle tracking for turret rotation ── */
  let towerAngles = new Map();

  /* ── Global animation timer ── */
  let animTime = 0;

  /* ── Run statistics and HUD bookkeeping ── */
  let runStats = { kills: 0, gold: 0 };
  let waveSize = 0;                       // enemies in the current wave
  const goldHudPos = { x: 0, y: 0 };      // where gold counts up (UI units)

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw) highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(mapName, wavesCompleted) {
    highScores.push({ map: mapName, waves: wavesCompleted });
    highScores.sort((a, b) => b.waves - a.waves);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].map}</td><td>${highScores[i].waves}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ── Saved game (plain data only; objects are rebuilt on load) ── */

  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  const ENEMY_SAVE_FIELDS = ['hp', 'maxHp', 'speed', 'baseSpeed', 'bounty', 'radius', 'pathIndex', 'pathProgress', 'x', 'y',
    'slowTimer', 'freezeTimer', 'dotTimer', 'dotDamage', 'shieldHp', 'healCooldown'];
  let autosaveTimer = 0;
  let savedGameInfo = null; // { map, wave, waves } summary for the start screen, null when no save exists
  let saveNotice = '';      // shown on the start screen when a save had to be discarded

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isInGameState() {
    return state === STATE_PLAYING || state === STATE_BUILD || state === STATE_PAUSED;
  }

  function serializeGame() {
    return {
      version: SAVE_VERSION,
      map: currentMap,
      gold, lives,
      wave: currentWave,
      phase: state === STATE_BUILD ? 'build' : 'wave',
      gameSpeed, autoWaveMode, autoWaveTimer,
      waveComplete, waveCountdown, spawnTimer,
      waveEnemies: waveEnemies.slice(),
      stats: { kills: runStats.kills, gold: runStats.gold },
      towers: towers.map(t => ({
        col: t.col, row: t.row, type: t.type, tier: t.tier,
        damage: t.damage, range: t.range, fireRate: t.fireRate,
        kills: t.kills, hp: t.hp, maxHp: t.maxHp
      })),
      floorEffects: floorEffects.map(fe => ({
        col: fe.col, row: fe.row, type: fe.type,
        timer: fe.timer === Infinity ? -1 : fe.timer,
        damage: fe.damage, cost: fe.cost
      })),
      enemies: enemies.filter(e => e.hp > 0).map(e => {
        const o = { type: e.type };
        for (const k of ENEMY_SAVE_FIELDS)
          o[k] = e[k];
        return o;
      })
    };
  }

  function saveGame() {
    if (!isInGameState())
      return;
    try {
      const data = serializeGame();
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      savedGameInfo = { map: data.map, wave: data.wave, waves: MAPS[data.map].waves };
    } catch (_) {}
    autosaveTimer = 0;
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_SAVE);
    } catch (_) {}
    savedGameInfo = null;
  }

  // Parses and validates a save; returns the plain data or null (with saveNotice set) when unusable.
  function readSavedGame() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_SAVE);
    } catch (_) {
      return null;
    }
    if (!raw)
      return null;

    try {
      const d = JSON.parse(raw);
      if (!d || d.version !== SAVE_VERSION)
        throw new Error('version');
      if (!Number.isInteger(d.map) || d.map < 0 || d.map >= MAPS.length)
        throw new Error('map');
      const mapDef = MAPS[d.map];
      if (!Number.isInteger(d.wave) || d.wave < 0 || d.wave > mapDef.waves)
        throw new Error('wave');
      if (!isFiniteNumber(d.gold) || !Number.isInteger(d.lives) || d.lives <= 0)
        throw new Error('stats');
      if (!Array.isArray(d.towers) || !Array.isArray(d.enemies) || !Array.isArray(d.floorEffects) || !Array.isArray(d.waveEnemies))
        throw new Error('lists');
      for (const t of d.towers)
        if (!t || !Number.isInteger(t.type) || !TOWER_TYPES[t.type] || !Number.isInteger(t.col) || !Number.isInteger(t.row)
          || t.col < 0 || t.col >= COLS || t.row < 0 || t.row >= ROWS
          || !Number.isInteger(t.tier) || t.tier < 1 || t.tier > MAX_TIER
          || !['damage', 'range', 'fireRate', 'kills', 'hp', 'maxHp'].every(k => isFiniteNumber(t[k])))
          throw new Error('tower');
      for (const fe of d.floorEffects)
        if (!fe || ['spike', 'lava', 'ice'].indexOf(fe.type) < 0 || !Number.isInteger(fe.col) || !Number.isInteger(fe.row)
          || !isFiniteNumber(fe.timer) || !isFiniteNumber(fe.damage || 0))
          throw new Error('floor');
      const pathLen = getPathPoints(mapDef).length;
      for (const e of d.enemies)
        if (!e || !ENEMY_TYPES[e.type] || !ENEMY_SAVE_FIELDS.every(k => isFiniteNumber(e[k]))
          || !Number.isInteger(e.pathIndex) || e.pathIndex < 0 || e.pathIndex >= pathLen - 1)
          throw new Error('enemy');
      for (const type of d.waveEnemies)
        if (!ENEMY_TYPES[type])
          throw new Error('queue');
      return d;
    } catch (_) {
      clearSavedGame();
      saveNotice = 'The saved game could not be read and was discarded.';
      return null;
    }
  }

  function refreshSavedGameInfo() {
    const d = readSavedGame();
    savedGameInfo = d ? { map: d.map, wave: d.wave, waves: MAPS[d.map].waves } : null;
  }

  function continueSavedGame() {
    const d = readSavedGame();
    if (!d) {
      savedGameInfo = null;
      return false;
    }

    loadMap(d.map);
    gold = d.gold;
    lives = d.lives;
    currentWave = d.wave;
    gameSpeed = [1, 2, 3].indexOf(d.gameSpeed) >= 0 ? d.gameSpeed : (isFiniteNumber(d.gameSpeed) && d.gameSpeed > 3 ? 3 : 1);
    autoWaveMode = !!d.autoWaveMode;
    autoWaveTimer = isFiniteNumber(d.autoWaveTimer) ? d.autoWaveTimer : 0;
    waveComplete = d.phase === 'build' ? true : !!d.waveComplete;
    waveCountdown = isFiniteNumber(d.waveCountdown) ? d.waveCountdown : 3;
    spawnTimer = isFiniteNumber(d.spawnTimer) ? d.spawnTimer : 0;
    waveEnemies = d.waveEnemies.slice();
    waveSize = waveEnemies.length + d.enemies.length;
    if (d.stats && isFiniteNumber(d.stats.kills) && isFiniteNumber(d.stats.gold))
      runStats = { kills: d.stats.kills, gold: d.stats.gold };
    shownGold = gold;

    towers = d.towers.map(t => ({
      col: t.col, row: t.row,
      x: t.col * CELL + CELL / 2,
      y: t.row * CELL + CELL / 2,
      type: t.type, tier: t.tier,
      damage: t.damage, range: t.range, fireRate: t.fireRate,
      fireCooldown: 0,
      kills: t.kills, hp: t.hp, maxHp: t.maxHp
    }));
    for (const t of towers)
      towerAngles.set(t, 0);

    floorEffects = d.floorEffects.map(fe => ({
      col: fe.col, row: fe.row,
      x: fe.col * CELL + CELL / 2,
      y: fe.row * CELL + CELL / 2,
      type: fe.type,
      timer: fe.timer < 0 ? Infinity : fe.timer,
      damage: fe.damage,
      cost: fe.cost
    }));

    enemies = d.enemies.map(e => {
      const def = ENEMY_TYPES[e.type];
      const enemy = {
        type: e.type,
        color: def.color,
        isBoss: e.type === 'boss',
        isHealer: def.heals || false,
        isShielded: def.shielded || false
      };
      for (const k of ENEMY_SAVE_FIELDS)
        enemy[k] = e[k];
      return enemy;
    });

    // A wave in progress resumes paused so the player can get their bearings
    state = d.phase === 'build' ? STATE_BUILD : STATE_PAUSED;
    saveNotice = '';
    autosaveTimer = 0;
    updateWindowTitle();
    return true;
  }

  // New Game: asks first when it would overwrite an existing save.
  function requestNewGame() {
    if (!savedGameInfo) {
      resetAndStart();
      return;
    }
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    // The inner box may still carry the hidden flag from the previous answer
    for (const box of document.querySelectorAll('#dlg-new-game .dialog'))
      box.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      if (result !== 'yes')
        return;
      clearSavedGame();
      resetAndStart();
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     PATH UTILITIES
     ══════════════════════════════════════════════════════════════════ */

  function walkPath(waypoints, visit) {
    for (let i = 0; i < waypoints.length - 1; ++i) {
      let [x0, y0] = waypoints[i];
      const [x1, y1] = waypoints[i + 1];
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      while (x0 !== x1 || y0 !== y1) {
        visit(x0, y0);
        if (x0 !== x1) x0 += dx;
        if (y0 !== y1) y0 += dy;
      }
    }
    const last = waypoints[waypoints.length - 1];
    visit(last[0], last[1]);
  }

  function buildPathCells(mapDef) {
    pathCells = new Set();
    walkPath(mapDef.path, (x, y) => pathCells.add(`${x},${y}`));
  }

  function getPathPoints(mapDef) {
    const points = [];
    walkPath(mapDef.path, (x, y) => points.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));
    return points;
  }

  let pathPoints = [];

  /* ══════════════════════════════════════════════════════════════════
     MAP LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadMap(index) {
    currentMap = index;
    const mapDef = MAPS[currentMap];
    gold = mapDef.startGold;
    lives = mapDef.startLives;
    totalWaves = mapDef.waves;
    currentWave = 0;
    towers = [];
    enemies = [];
    projectiles = [];
    floorEffects = [];
    selectedTower = null;
    gameSpeed = 1;
    waveEnemies = [];
    spawnTimer = 0;
    waveComplete = true;
    waveCountdown = 3;
    towerAngles = new Map();
    warningActive = false;
    warningTimer = 0;
    autoWaveTimer = 0;

    buildPathCells(mapDef);
    pathPoints = getPathPoints(mapDef);
    runStats = { kills: 0, gold: 0 };
    shownGold = gold;
    selectedTowerType = -1;

    state = STATE_BUILD;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER PLACEMENT & UPGRADE & SELL
     ══════════════════════════════════════════════════════════════════ */

  function canPlace(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (pathCells.has(`${col},${row}`)) return false;
    for (const t of towers)
      if (t.col === col && t.row === row) return false;
    return true;
  }

  function canPlaceSpike(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (!pathCells.has(`${col},${row}`)) return false; // spikes must go ON the path
    // No duplicate spikes on same cell
    for (const fe of floorEffects)
      if (fe.col === col && fe.row === row && fe.type === 'spike') return false;
    return true;
  }

  function placeTower(col, row, typeIndex) {
    const def = TOWER_TYPES[typeIndex];
    if (gold < def.cost) {
      audio.play('error');
      return false;
    }

    // Spike traps are placed as floor effects on path cells
    if (def.isFloorTrap) {
      if (!canPlaceSpike(col, row)) return false;
      gold -= def.cost;
      const fx = col * CELL + CELL / 2;
      const fy = row * CELL + CELL / 2;
      floorEffects.push({
        col, row,
        x: fx, y: fy,
        type: 'spike',
        timer: Infinity, // permanent until sold
        damage: def.damage,
        cost: def.cost
      });
      particles.sparkle(fx, fy, 8, { color: '#999', speed: 2 });
      audio.play('click', { pitch: 0.8 });
      floatingText.add(fx, fy - 16, `-${def.cost}g`, { color: '#fa0', font: 'bold 11px sans-serif' });
      return true;
    }

    if (!canPlace(col, row)) return false;

    gold -= def.cost;
    const tower = {
      col, row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      type: typeIndex,
      tier: 1,
      damage: def.damage,
      range: def.range,
      fireRate: def.fireRate,
      fireCooldown: 0,
      kills: 0,
      hp: 100,
      maxHp: 100
    };
    towers.push(tower);
    towerAngles.set(tower, 0);

    particles.sparkle(tower.x, tower.y, 12, { color: def.color, speed: 3 });
    audio.play('drop');
    floatingText.add(tower.x, tower.y - 16, `-${def.cost}g`, { color: '#fa0', font: 'bold 11px sans-serif' });

    return true;
  }

  function upgradeTower(tower) {
    if (tower.tier >= MAX_TIER) return false;
    const def = TOWER_TYPES[tower.type];
    const upgradeCost = Math.floor(def.cost * UPGRADE_COST_MULT[tower.tier]);
    if (gold < upgradeCost) return false;

    gold -= upgradeCost;
    ++tower.tier;
    tower.damage = Math.floor(def.damage * UPGRADE_DAMAGE_MULT[tower.tier - 1]);
    tower.range = Math.floor(def.range * UPGRADE_RANGE_MULT[tower.tier - 1]);
    tower.fireRate = def.fireRate * 0.85;

    particles.sparkle(tower.x, tower.y, 15, { color: '#ff0', speed: 4 });
    particles.burst(tower.x, tower.y, 8, { color: def.color, speed: 2, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, `Tier ${tower.tier}!`, { color: '#ff0', font: 'bold 12px sans-serif' });
    screenShake.trigger(2, 80);
    audio.play('powerup', { pitch: 0.9 + tower.tier * 0.1 });

    return true;
  }

  function sellTower(tower) {
    const def = TOWER_TYPES[tower.type];
    // Calculate total investment: base cost + all upgrade costs
    let totalInvested = def.cost;
    for (let t = 1; t < tower.tier; ++t)
      totalInvested += Math.floor(def.cost * UPGRADE_COST_MULT[t]);
    const refund = Math.floor(totalInvested * 0.5);
    gold += refund;
    const idx = towers.indexOf(tower);
    if (idx !== -1) towers.splice(idx, 1);
    towerAngles.delete(tower);
    floatingText.add(tower.x, tower.y - 16, `+${refund}g`, { color: '#8f8', font: 'bold 11px sans-serif' });
    particles.burst(tower.x, tower.y, 8, { color: '#aaa', speed: 2, life: 0.4 });
    audio.play('coin');
    if (selectedTower === tower)
      selectedTower = null;
  }

  function getUpgradeCost(tower) {
    if (tower.tier >= MAX_TIER) return 0;
    return Math.floor(TOWER_TYPES[tower.type].cost * UPGRADE_COST_MULT[tower.tier]);
  }

  function getSellValue(tower) {
    const def = TOWER_TYPES[tower.type];
    let totalInvested = def.cost;
    for (let t = 1; t < tower.tier; ++t)
      totalInvested += Math.floor(def.cost * UPGRADE_COST_MULT[t]);
    return Math.floor(totalInvested * 0.5);
  }

  /* ══════════════════════════════════════════════════════════════════
     WAVE SPAWNING
     ══════════════════════════════════════════════════════════════════ */

  function generateWave(waveNum) {
    const queue = [];
    const count = 5 + Math.floor(waveNum * 1.5);
    for (let i = 0; i < count; ++i) {
      let type = 'normal';
      const roll = Math.random();
      if (waveNum >= 8 && roll < 0.05)
        type = 'boss';
      else if (waveNum >= 6 && roll < 0.1)
        type = 'shield';
      else if (waveNum >= 5 && roll < 0.15)
        type = 'healer';
      else if (waveNum >= 4 && roll < 0.25)
        type = 'armored';
      else if (waveNum >= 2 && roll < 0.4)
        type = 'fast';
      else if (waveNum >= 3 && roll < 0.5)
        type = 'flying';
      else if (waveNum >= 1 && roll < 0.55)
        type = 'swarm';
      queue.push(type);
    }
    // Swarm burst on even waves
    if (waveNum % 2 === 1 && waveNum >= 3)
      for (let i = 0; i < 4; ++i)
        queue.push('swarm');

    // Boss wave every 5 waves
    if (waveNum % 5 === 4)
      queue.push('boss');
    return queue;
  }

  function triggerVictory() {
    state = STATE_VICTORY;
    clearSavedGame();
    addHighScore(MAPS[currentMap].name, currentWave);
    particles.confetti(WORLD_W / 2, WORLD_H / 2, 40, { speed: 6, gravity: 0.08 });
    screenShake.trigger(6, 300);
    audio.play('win');
    updateWindowTitle();
  }

  function startNextWave() {
    if (currentWave >= totalWaves) {
      triggerVictory();
      return;
    }

    waveEnemies = generateWave(currentWave);
    waveSize = waveEnemies.length;
    spawnTimer = 0;
    waveComplete = false;
    ++currentWave;
    state = STATE_PLAYING;
    warningActive = false;
    warningTimer = 0;

    audio.play('select', { pitch: 0.75 });

    // Wave bonus/interest
    const bonus = Math.floor(gold * 0.05) + 10;
    gold += bonus;
    runStats.gold += bonus;
    floatingText.add(WORLD_W / 2, 40, `+${bonus} gold wave bonus`, { color: '#8f8', font: 'bold 12px sans-serif' });
    updateWindowTitle();
    saveGame();
  }

  function beginPreWaveWarning() {
    warningActive = true;
    audio.play('blip', { pitch: 0.6 });
    warningTimer = WARNING_DURATION;
    warningPulse = 0;
  }

  function spawnEnemy(type) {
    const def = ENEMY_TYPES[type];
    const waveScale = 1 + currentWave * 0.1;
    enemies.push({
      type,
      hp: Math.floor(def.hp * waveScale),
      maxHp: Math.floor(def.hp * waveScale),
      speed: def.speed,
      baseSpeed: def.speed,
      bounty: def.bounty,
      color: def.color,
      radius: def.radius,
      pathIndex: 0,
      pathProgress: 0,
      x: pathPoints[0].x,
      y: pathPoints[0].y,
      slowTimer: 0,
      freezeTimer: 0,
      dotTimer: 0,
      dotDamage: 0,
      isBoss: type === 'boss',
      isHealer: def.heals || false,
      isShielded: def.shielded || false,
      shieldHp: def.shielded ? Math.floor(def.hp * waveScale * 0.4) : 0,
      healCooldown: 0
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     TARGETING & PROJECTILES
     ══════════════════════════════════════════════════════════════════ */

  function findTarget(tower) {
    let closest = null;
    let bestDist = tower.range + 1;
    for (const enemy of enemies) {
      if (enemy.hp <= 0)
        continue;
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  function fireProjectile(tower, target) {
    const def = TOWER_TYPES[tower.type];
    projectiles.push({
      x: tower.x,
      y: tower.y,
      targetEnemy: target,
      speed: def.projectileSpeed,
      damage: tower.damage,
      color: def.projectileColor,
      splash: def.splash || 0,
      slow: def.slow || 0,
      freeze: def.freeze ? def.freeze * (1 + (tower.tier - 1) * 0.2) : 0,
      chain: def.chain || 0,
      dot: def.dot ? Math.floor(def.dot * UPGRADE_DAMAGE_MULT[tower.tier - 1]) : 0,
      dotDuration: def.dotDuration || 0,
      aoe: def.aoe || 0,
      towerType: tower.type,
      tower,
      trail: []
    });

    playShotSound(def);

    // Update turret angle
    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    towerAngles.set(tower, Math.atan2(dy, dx));
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEATH & LEAK
     ══════════════════════════════════════════════════════════════════ */

  function killEnemy(enemy, index) {
    // Guard: if already removed from array, skip
    if (index < 0 || index >= enemies.length || enemies[index] !== enemy)
      return;

    particles.burst(enemy.x, enemy.y, 12, { color: enemy.color, speed: 3, life: 0.6 });

    gold += enemy.bounty;
    ++runStats.kills;
    runStats.gold += enemy.bounty;
    if (enemy.lastHitBy)
      ++enemy.lastHitBy.kills;
    floatingText.add(enemy.x, enemy.y - 16, `+${enemy.bounty}g`, { color: '#ff0', font: 'bold 11px sans-serif' });

    if (enemy.isBoss) {
      screenShake.trigger(8, 400);
      particles.confetti(enemy.x, enemy.y, 20, { speed: 5, gravity: 0.06 });
      floatingText.add(enemy.x, enemy.y - 30, 'BOSS KILL!', { color: '#f0f', font: 'bold 14px sans-serif' });
      audio.play('explode');
    } else {
      screenShake.trigger(2, 60);
      audio.play('smallExplode', { pitch: 0.9 + Math.random() * 0.3, volume: 0.6 });
    }

    enemies.splice(index, 1);
  }

  function enemyReachedGoal(enemy, index) {
    --lives;
    enemies.splice(index, 1);
    screenShake.trigger(4, 150);
    floatingText.add(enemy.x, enemy.y - 12, '-1 life', { color: '#f44', font: 'bold 12px sans-serif' });
    livesPulse = 1;
    audio.play('hurt');

    if (lives <= 0) {
      audio.play('lose');
      state = STATE_GAME_OVER;
      clearSavedGame();
      addHighScore(MAPS[currentMap].name, currentWave);
      screenShake.trigger(8, 500);
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      // Skip dead enemies (will be cleaned up in sweep)
      if (e.hp <= 0)
        continue;

      // DoT (damage over time)
      if (e.dotTimer > 0) {
        e.dotTimer -= dt;
        e.hp -= e.dotDamage * dt;
        // Poison particle trail
        if (Math.random() < 0.3)
          particles.sparkle(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, 1, { color: '#0f4', speed: 1 });
        if (e.hp <= 0) {
          killEnemy(e, i);
          continue;
        }
      }

      // Healer: heal nearby enemies
      if (e.isHealer) {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 2;
          for (const other of enemies) {
            if (other === e || other.hp <= 0) continue;
            const hdx = other.x - e.x;
            const hdy = other.y - e.y;
            if (Math.sqrt(hdx * hdx + hdy * hdy) < 60) {
              other.hp = Math.min(other.maxHp, other.hp + Math.floor(other.maxHp * 0.05));
              particles.sparkle(other.x, other.y, 3, { color: '#4f4', speed: 1 });
            }
          }
        }
      }

      // Freeze effect (completely stops enemy)
      if (e.freezeTimer > 0) {
        e.freezeTimer -= dt;
        e.speed = 0;
        // Frozen visual particle
        if (Math.random() < 0.15)
          particles.sparkle(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, 1, { color: '#cff', speed: 0.5 });
      }
      // Slow effect
      else if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        e.speed = e.baseSpeed * 0.5;
      } else {
        e.speed = e.baseSpeed;
      }

      // Move along path
      if (e.pathIndex < pathPoints.length - 1) {
        const from = pathPoints[e.pathIndex];
        const to = pathPoints[e.pathIndex + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        e.pathProgress += (e.speed * dt) / segLen;

        if (e.pathProgress >= 1) {
          e.pathProgress -= 1;
          ++e.pathIndex;
          if (e.pathIndex >= pathPoints.length - 1) {
            enemyReachedGoal(e, i);
            continue;
          }
        }

        const t = e.pathProgress;
        const cfrom = pathPoints[e.pathIndex];
        const cto = pathPoints[Math.min(e.pathIndex + 1, pathPoints.length - 1)];
        e.x = cfrom.x + (cto.x - cfrom.x) * t;
        e.y = cfrom.y + (cto.y - cfrom.y) * t;
      }

      // Boss and armored enemies deal splash damage to nearby towers
      if (e.isBoss || e.type === 'armored') {
        const splashRange = e.isBoss ? 50 : 30;
        const splashDmg = e.isBoss ? 3 : 1;
        for (const tower of towers) {
          const tdx = tower.x - e.x;
          const tdy = tower.y - e.y;
          if (tdx * tdx + tdy * tdy < splashRange * splashRange) {
            tower.hp -= splashDmg * dt;
            if (tower.hp <= 0)
              destroyTower(tower);
          }
        }
      }
    }
  }

  function destroyTower(tower) {
    const idx = towers.indexOf(tower);
    if (idx === -1) return;
    towers.splice(idx, 1);
    towerAngles.delete(tower);
    if (selectedTower === tower)
      selectedTower = null;
    particles.burst(tower.x, tower.y, 15, { color: '#f44', speed: 4, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, 'DESTROYED!', { color: '#f44', font: 'bold 10px sans-serif' });
    screenShake.trigger(4, 200);
    audio.play('explode', { pitch: 1.3, volume: 0.7 });
  }

  function repairTower(tower) {
    if (tower.hp >= tower.maxHp) return false;
    const repairCost = Math.floor((tower.maxHp - tower.hp) * 0.3);
    if (repairCost < 1 || gold < repairCost) return false;
    gold -= repairCost;
    tower.hp = tower.maxHp;
    particles.sparkle(tower.x, tower.y, 8, { color: '#4f4', speed: 2 });
    audio.play('pickup');
    floatingText.add(tower.x, tower.y - 16, `Repaired -${repairCost}g`, { color: '#8f8', font: 'bold 9px sans-serif' });
    return true;
  }

  function updateTowers(dt) {
    for (const tower of towers) {
      tower.fireCooldown -= dt;
      if (tower.fireCooldown <= 0) {
        const target = findTarget(tower);
        if (target) {
          fireProjectile(tower, target);
          tower.fireCooldown = tower.fireRate;
        }
      }
    }
  }

  function applyProjectileHit(p, target) {
    // Shield absorbs damage first
    if (target.isShielded && target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, p.damage);
      target.shieldHp -= absorbed;
      const remaining = p.damage - absorbed;
      if (remaining > 0)
        target.hp -= remaining;
      particles.sparkle(target.x, target.y, 4, { color: '#4ff', speed: 2 });
    } else {
      target.hp -= p.damage;
    }
    target.lastHitBy = p.tower;

    // Freeze (stronger than slow -- stops enemy completely)
    if (p.freeze > 0) {
      target.freezeTimer = p.freeze;
      particles.sparkle(target.x, target.y, 6, { color: '#cff', speed: 1 });
    }

    // Slow
    if (p.slow > 0)
      target.slowTimer = 2;

    // DoT (poison/flame)
    if (p.dot > 0) {
      target.dotTimer = p.dotDuration;
      target.dotDamage = p.dot;
    }

    // Splash damage
    if (p.splash > 0) {
      for (const other of enemies) {
        if (other === target || other.hp <= 0) continue;
        const sdx = other.x - target.x;
        const sdy = other.y - target.y;
        if (Math.sqrt(sdx * sdx + sdy * sdy) < p.splash) {
          other.hp -= Math.floor(p.damage * 0.5);
          if (p.dot > 0) {
            other.dotTimer = p.dotDuration;
            other.dotDamage = Math.floor(p.dot * 0.5);
          }
        }
      }
      // Splash visual
      particles.burst(target.x, target.y, 10, { color: p.color, speed: 3, life: 0.3 });
    }

    // AoE cone (flame tower)
    if (p.aoe > 0) {
      for (const other of enemies) {
        if (other === target || other.hp <= 0) continue;
        const adx = other.x - p.x;
        const ady = other.y - p.y;
        if (Math.sqrt(adx * adx + ady * ady) < p.aoe) {
          other.hp -= Math.floor(p.damage * 0.6);
          if (p.dot > 0) {
            other.dotTimer = p.dotDuration;
            other.dotDamage = Math.floor(p.dot * 0.5);
          }
        }
      }
    }

    // Chain (lightning/tesla)
    if (p.chain > 0) {
      let chainTarget = target;
      let chainsLeft = p.chain;
      const hit = new Set([target]);
      while (chainsLeft > 0) {
        let bestDist = 80;
        let nextTarget = null;
        for (const other of enemies) {
          if (hit.has(other) || other.hp <= 0) continue;
          const cdx = other.x - chainTarget.x;
          const cdy = other.y - chainTarget.y;
          const d = Math.sqrt(cdx * cdx + cdy * cdy);
          if (d < bestDist) {
            bestDist = d;
            nextTarget = other;
          }
        }
        if (!nextTarget) break;
        hit.add(nextTarget);
        nextTarget.hp -= Math.floor(p.damage * 0.6);
        // Chain lightning visual line
        particles.sparkle(
          (chainTarget.x + nextTarget.x) / 2,
          (chainTarget.y + nextTarget.y) / 2,
          3, { color: p.color, speed: 2 }
        );
        chainTarget = nextTarget;
        --chainsLeft;
      }
    }

    // Floor effect: Fire Tower projectile creates lava tile at impact
    if (TOWER_TYPES[p.towerType]?.id === 'fire') {
      const impactCol = Math.floor(target.x / CELL);
      const impactRow = Math.floor(target.y / CELL);
      if (pathCells.has(`${impactCol},${impactRow}`)) {
        // Don't stack lava on same cell -- refresh timer instead
        const existing = floorEffects.find(fe => fe.col === impactCol && fe.row === impactRow && fe.type === 'lava');
        if (existing) {
          existing.timer = 5 + Math.random() * 3;
        } else {
          floorEffects.push({
            col: impactCol, row: impactRow,
            x: impactCol * CELL + CELL / 2,
            y: impactRow * CELL + CELL / 2,
            type: 'lava',
            timer: 5 + Math.random() * 3,
            damage: Math.floor(p.dot * 0.6) || 8
          });
        }
      }
    }

    // Floor effect: Ice Tower projectile creates ice tile at impact
    if (TOWER_TYPES[p.towerType]?.id === 'ice') {
      const impactCol = Math.floor(target.x / CELL);
      const impactRow = Math.floor(target.y / CELL);
      if (pathCells.has(`${impactCol},${impactRow}`)) {
        const existing = floorEffects.find(fe => fe.col === impactCol && fe.row === impactRow && fe.type === 'ice');
        if (existing) {
          existing.timer = 5 + Math.random() * 3;
        } else {
          floorEffects.push({
            col: impactCol, row: impactRow,
            x: impactCol * CELL + CELL / 2,
            y: impactRow * CELL + CELL / 2,
            type: 'ice',
            timer: 5 + Math.random() * 3,
            damage: 0
          });
        }
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; --i) {
      const p = projectiles[i];
      const t = p.targetEnemy;

      if (!t || t.hp <= 0 || !enemies.includes(t)) {
        projectiles.splice(i, 1);
        continue;
      }

      // Store trail position
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6)
        p.trail.shift();

      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveBy = p.speed * dt;

      if (dist <= moveBy + t.radius) {
        applyProjectileHit(p, t);

        // Check death
        if (t.hp <= 0) {
          const idx = enemies.indexOf(t);
          if (idx !== -1) killEnemy(t, idx);
        }

        projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * moveBy;
        p.y += (dy / dist) * moveBy;
      }
    }
  }

  function updateSpawner(dt) {
    if (waveEnemies.length > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy(waveEnemies.shift());
        spawnTimer = 0.6;
      }
    }

    // Wave complete check
    if (waveEnemies.length === 0 && enemies.length === 0 && !waveComplete) {
      waveComplete = true;
      waveCountdown = 3;
      state = STATE_BUILD;
      warningActive = false;

      // Start auto-wave timer
      if (autoWaveMode)
        autoWaveTimer = AUTO_WAVE_DELAY;

      if (currentWave >= totalWaves)
        triggerVictory();
      else {
        audio.play('levelup');
        saveGame();
      }
    }
  }

  function updateFloorEffects(dt) {
    // Expire timed floor effects
    for (let i = floorEffects.length - 1; i >= 0; --i) {
      const fe = floorEffects[i];
      if (fe.timer !== Infinity) {
        fe.timer -= dt;
        if (fe.timer <= 0) {
          floorEffects.splice(i, 1);
          continue;
        }
      }
    }

    // Apply floor effects to enemies standing on them
    for (const e of enemies) {
      if (e.hp <= 0)
        continue;
      const eCol = Math.floor(e.x / CELL);
      const eRow = Math.floor(e.y / CELL);

      for (const fe of floorEffects) {
        if (fe.col !== eCol || fe.row !== eRow)
          continue;

        if (fe.type === 'lava') {
          // Burn damage over time
          e.hp -= fe.damage * dt;
          // Apply burn DoT if not already burning
          if (e.dotTimer <= 0) {
            e.dotTimer = 1;
            e.dotDamage = fe.damage;
          }
          // Lava particle effect on enemy
          if (Math.random() < 0.2)
            particles.sparkle(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, 1, { color: '#f60', speed: 1.5 });
          if (e.hp <= 0) {
            const idx = enemies.indexOf(e);
            if (idx !== -1) killEnemy(e, idx);
            break;
          }
        } else if (fe.type === 'ice') {
          // Significant slow (50% speed reduction)
          if (e.freezeTimer <= 0)
            e.slowTimer = Math.max(e.slowTimer, 0.5);
          // Ice particle effect on enemy
          if (Math.random() < 0.15)
            particles.sparkle(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, 1, { color: '#aef', speed: 0.8 });
        } else if (fe.type === 'spike') {
          // Constant small damage
          e.hp -= fe.damage * dt;
          // Spark on contact
          if (Math.random() < 0.1)
            particles.sparkle(e.x, e.y + e.radius, 1, { color: '#ccc', speed: 1 });
          if (e.hp <= 0) {
            const idx = enemies.indexOf(e);
            if (idx !== -1) killEnemy(e, idx);
            break;
          }
        }
      }
    }
  }

  function updateBuildCountdown(dt) {
    if (state !== STATE_BUILD) return;

    if (waveCountdown > 0)
      waveCountdown -= dt;

    // Pre-wave warning: activate when countdown gets low
    if (!warningActive && waveCountdown <= WARNING_DURATION && waveCountdown > 0)
      beginPreWaveWarning();

    if (warningActive) {
      warningTimer -= dt;
      warningPulse += dt * 4;
      if (warningTimer <= 0)
        warningActive = false;
    }

    // Auto-wave mode
    if (autoWaveMode && waveComplete) {
      autoWaveTimer -= dt;
      if (autoWaveTimer <= 0)
        startNextWave();
    }
  }

  function updateGame(dt) {
    animTime += dt;

    if (state === STATE_PLAYING) {
      const scaledDt = dt * gameSpeed;
      updateSpawner(scaledDt);
      updateEnemies(scaledDt);
      updateTowers(scaledDt);
      updateProjectiles(scaledDt);
      // Cleanup pass: remove any enemies that reached 0 hp from splash/AoE/chain
      for (let i = enemies.length - 1; i >= 0; --i)
        if (enemies[i].hp <= 0)
          killEnemy(enemies[i], i);
      updateFloorEffects(scaledDt);
    } else if (state === STATE_BUILD) {
      updateBuildCountdown(dt);
      updateFloorEffects(dt); // Decay lava/ice tiles between waves
    }

    if (state === STATE_PLAYING || state === STATE_BUILD) {
      autosaveTimer += dt;
      if (autosaveTimer >= AUTOSAVE_INTERVAL)
        saveGame();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- IMPROVED VISUALS
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    // Background grass texture
    const bgGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    bgGrad.addColorStop(0, '#1a3a1a');
    bgGrad.addColorStop(1, '#153015');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Path tiles with gradient
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      const px = c * CELL;
      const py = r * CELL;
      const pathGrad = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
      pathGrad.addColorStop(0, '#5c3d1f');
      pathGrad.addColorStop(1, '#4a3018');
      ctx.fillStyle = pathGrad;
      ctx.fillRect(px, py, CELL, CELL);

      // Subtle path border
      ctx.strokeStyle = 'rgba(120, 80, 40, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; ++c) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; ++r) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }

  }

  /* ── Path visualization: direction arrows and spawn/exit markers ── */
  function drawPathVisualization() {
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;

    const mapDef = MAPS[currentMap];
    const wp = mapDef.path;

    // Draw direction arrows along path
    const arrowSpacing = 3;
    let stepCount = 0;
    const pulse = 0.4 + 0.3 * Math.sin(animTime * 2);

    walkPath(wp, (x, y) => {
      ++stepCount;
      if (stepCount % arrowSpacing !== 0) return;
      if (stepCount >= pathPoints.length - 1) return;

      const idx = stepCount;
      if (idx >= pathPoints.length - 1) return;

      const from = pathPoints[idx];
      const to = pathPoints[Math.min(idx + 1, pathPoints.length - 1)];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;

      const angle = Math.atan2(dy, dx);
      const cx = from.x;
      const cy = from.y;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(255, 200, 80, ${pulse * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Spawn point marker (pulsing)
    if (pathPoints.length > 0) {
      const spawn = pathPoints[0];
      const spawnPulse = 0.5 + 0.5 * Math.sin(animTime * 3);

      ctx.save();
      ctx.strokeStyle = `rgba(0, 255, 100, ${spawnPulse * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, 14 + spawnPulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(0, 255, 100, ${spawnPulse * 0.4})`;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SPAWN', spawn.x, spawn.y - 18);
      ctx.restore();

      // Exit point marker
      const exit = pathPoints[pathPoints.length - 1];
      const exitPulse = 0.5 + 0.5 * Math.sin(animTime * 3 + 1);

      ctx.save();
      ctx.strokeStyle = `rgba(255, 60, 60, ${exitPulse * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, 14 + exitPulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 60, 60, ${exitPulse * 0.4})`;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('EXIT', exit.x, exit.y - 18);
      ctx.restore();
    }
  }

  /* ── Pre-wave warning animation ── */
  function drawPreWaveWarning() {
    if (!warningActive || pathPoints.length === 0) return;

    const spawn = pathPoints[0];
    const pulse = Math.abs(Math.sin(warningPulse));

    // Flashing exclamation near spawn
    ctx.save();
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse * 0.9})`;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', spawn.x, spawn.y - 28);

    // Expanding warning rings
    for (let ring = 0; ring < 3; ++ring) {
      const ringPhase = (warningPulse + ring * 0.7) % 3;
      const ringRadius = 10 + ringPhase * 15;
      const ringAlpha = Math.max(0, 0.6 - ringPhase * 0.2);
      ctx.strokeStyle = `rgba(255, 80, 40, ${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Directional arrow from spawn showing entry direction
    if (pathPoints.length > 1) {
      const next = pathPoints[1];
      const dx = next.x - spawn.x;
      const dy = next.y - spawn.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const angle = Math.atan2(dy, dx);
        const arrowX = spawn.x - Math.cos(angle) * 30;
        const arrowY = spawn.y - Math.sin(angle) * 30;

        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(255, 100, 40, ${pulse * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

  }

  /* ── Improved tower drawing with distinct shapes ── */
  function drawTowerShape(def, tier, angle) {
    const tierScale = 1 + (tier - 1) * 0.1;
    const baseSize = 11 * tierScale;
    // Glow under tower
    const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 14 * tierScale);
    glowGrad.addColorStop(0, _hexAlpha(def.color, '40'));
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(-16, -16, 32, 32);

    // Base platform
        const baseGrad = ctx.createLinearGradient(-baseSize, -baseSize, baseSize, baseSize);
    baseGrad.addColorStop(0, def.color);
    baseGrad.addColorStop(1, def.colorDark);
    ctx.fillStyle = baseGrad;

    // Different shapes per tower type
    switch (def.id) {
      case 'arrow':
        // Diamond base
        ctx.beginPath();
        ctx.moveTo(0, -baseSize);
        ctx.lineTo(baseSize, 0);
        ctx.lineTo(0, baseSize);
        ctx.lineTo(-baseSize, 0);
        ctx.closePath();
        ctx.fill();
        // Turret
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#8d6';
        ctx.fillRect(-2, -2, 14, 4);
        ctx.fillRect(10, -4, 4, 8); // arrowhead
        ctx.restore();
        break;

      case 'cannon':
        // Round base
        ctx.beginPath();
        ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
        ctx.fill();
        // Barrel
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#a64';
        ctx.fillRect(-3, -3, 16, 6);
        ctx.fillStyle = '#888';
        ctx.fillRect(10, -5, 6, 10); // muzzle
        ctx.restore();
        break;

      case 'frost':
        // Hexagonal base
        ctx.beginPath();
        for (let p = 0; p < 6; ++p) {
          const a = (Math.PI / 3) * p - Math.PI / 6;
          const px = Math.cos(a) * baseSize;
          const py = Math.sin(a) * baseSize;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Ice crystal on top (rotating)
        ctx.save();
        ctx.rotate(animTime * 0.5);
        ctx.strokeStyle = '#aef';
        ctx.lineWidth = 2;
        for (let p = 0; p < 6; ++p) {
          const a = (Math.PI / 3) * p;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
          ctx.stroke();
        }
        ctx.restore();
        break;

      case 'lightning':
        // Square base with notched corners
        ctx.fillRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
        // Lightning bolt symbol
        ctx.save();
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(-3, -7);
        ctx.lineTo(3, -2);
        ctx.lineTo(0, -2);
        ctx.lineTo(3, 7);
        ctx.lineTo(-3, 2);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
        // Electric crackle effect
        if (Math.random() < 0.3) {
          ctx.strokeStyle = `rgba(255, 255, 100, ${0.3 + Math.random() * 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const ex = (Math.random() - 0.5) * 20;
          const ey = (Math.random() - 0.5) * 20;
          ctx.moveTo(0, 0);
          ctx.lineTo(ex * 0.5, ey * 0.5);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.restore();
        break;

      case 'laser':
        // Octagonal base
        ctx.beginPath();
        for (let p = 0; p < 8; ++p) {
          const a = (Math.PI / 4) * p;
          const px = Math.cos(a) * baseSize;
          const py = Math.sin(a) * baseSize;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Laser emitter
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#f8f';
        ctx.fillRect(-2, -1.5, 16, 3);
        // Lens
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(14, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'poison':
        // Bubbling cauldron shape
        ctx.beginPath();
        ctx.arc(0, 2, baseSize, 0, Math.PI);
        ctx.lineTo(-baseSize, -3);
        ctx.quadraticCurveTo(-baseSize - 2, -baseSize, 0, -baseSize);
        ctx.quadraticCurveTo(baseSize + 2, -baseSize, baseSize, -3);
        ctx.closePath();
        ctx.fill();
        // Bubbles
        const bubblePhase = animTime * 2;
        for (let b = 0; b < 3; ++b) {
          const bx = Math.sin(bubblePhase + b * 2) * 5;
          const by = -5 - ((bubblePhase + b * 1.3) % 2) * 6;
          const br = 1.5 + Math.sin(bubblePhase + b) * 0.5;
          ctx.fillStyle = `rgba(80, 255, 120, ${0.5 - ((bubblePhase + b * 1.3) % 2) * 0.2})`;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'tesla':
        // Cylindrical coil shape
        ctx.beginPath();
        ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
        ctx.fill();
        // Tesla coil rings
        ctx.strokeStyle = '#8ff';
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 3; ++r) {
          const rr = 4 + r * 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, rr, rr * 0.4, animTime * 1.5 + r, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Sparks
        if (Math.random() < 0.4) {
          ctx.strokeStyle = `rgba(100, 220, 255, ${0.5 + Math.random() * 0.5})`;
          ctx.lineWidth = 1;
          const sa = Math.random() * Math.PI * 2;
          const sr = baseSize + Math.random() * 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * (baseSize - 2), Math.sin(sa) * (baseSize - 2));
          ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
          ctx.stroke();
        }
        break;

      case 'mortar':
        // Sturdy square with reinforced corners
        ctx.fillRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
        // Corner reinforcements
        ctx.fillStyle = def.colorDark;
        const cs = 4;
        ctx.fillRect(-baseSize, -baseSize, cs, cs);
        ctx.fillRect(baseSize - cs, -baseSize, cs, cs);
        ctx.fillRect(-baseSize, baseSize - cs, cs, cs);
        ctx.fillRect(baseSize - cs, baseSize - cs, cs, cs);
        // Mortar tube (angled up)
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#b09878';
        ctx.fillRect(-4, -4, 12, 8);
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(8, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'flame':
        // Triangular/flame-shaped base
        ctx.beginPath();
        ctx.moveTo(0, -baseSize);
        ctx.lineTo(baseSize, baseSize * 0.7);
        ctx.lineTo(-baseSize, baseSize * 0.7);
        ctx.closePath();
        ctx.fill();
        // Animated flame on top
        ctx.save();
        ctx.rotate(angle);
        const flicker = Math.sin(animTime * 8) * 2;
        const flameGrad = ctx.createRadialGradient(8, 0, 1, 8, 0, 8 + flicker);
        flameGrad.addColorStop(0, '#fff');
        flameGrad.addColorStop(0.3, '#fa4');
        flameGrad.addColorStop(0.7, '#f60');
        flameGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(8, 0, 8 + flicker, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'ice':
        // Snowflake-shaped base
        ctx.beginPath();
        for (let p = 0; p < 6; ++p) {
          const a = (Math.PI / 3) * p - Math.PI / 6;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * baseSize, Math.sin(a) * baseSize);
        }
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Icy center
        ctx.fillStyle = '#cff';
        ctx.beginPath();
        ctx.arc(0, 0, baseSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Rotating frost ring
        ctx.save();
        ctx.rotate(-animTime * 0.8);
        ctx.strokeStyle = 'rgba(200,240,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, baseSize * 0.8, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
        break;

      case 'fire':
        // Circular fiery base
        ctx.beginPath();
        ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
        ctx.fill();
        // Animated fire rings
        for (let r = 0; r < 2; ++r) {
          const firePhase = animTime * 6 + r * 1.5;
          const fr = baseSize * (0.5 + 0.3 * Math.sin(firePhase));
          ctx.strokeStyle = r === 0 ? '#f84' : '#fa4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, fr, firePhase, firePhase + Math.PI);
          ctx.stroke();
        }
        break;

      case 'chainlightning':
        // Pentagon base
        ctx.beginPath();
        for (let p = 0; p < 5; ++p) {
          const a = (Math.PI * 2 / 5) * p - Math.PI / 2;
          if (p === 0) ctx.moveTo(Math.cos(a) * baseSize, Math.sin(a) * baseSize);
          else ctx.lineTo(Math.cos(a) * baseSize, Math.sin(a) * baseSize);
        }
        ctx.closePath();
        ctx.fill();
        // Lightning arcs between vertices
        ctx.strokeStyle = '#df4';
        ctx.lineWidth = 1.5;
        if (Math.random() < 0.5) {
          const a1 = Math.random() * Math.PI * 2;
          const a2 = a1 + 1.2 + Math.random();
          ctx.beginPath();
          ctx.moveTo(Math.cos(a1) * baseSize * 0.9, Math.sin(a1) * baseSize * 0.9);
          const mx = (Math.random() - 0.5) * baseSize;
          const my = (Math.random() - 0.5) * baseSize;
          ctx.lineTo(mx, my);
          ctx.lineTo(Math.cos(a2) * baseSize * 0.9, Math.sin(a2) * baseSize * 0.9);
          ctx.stroke();
        }
        break;

      case 'sniper':
        // Long thin rectangle base
        ctx.fillRect(-baseSize * 0.6, -baseSize, baseSize * 1.2, baseSize * 2);
        // Crosshair
        ctx.save();
        ctx.rotate(angle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -baseSize); ctx.lineTo(0, baseSize);
        ctx.moveTo(-baseSize, 0); ctx.lineTo(baseSize, 0);
        ctx.stroke();
        // Scope lens
        ctx.strokeStyle = '#f44';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
        // Long barrel
        ctx.fillStyle = '#aaa';
        ctx.fillRect(-1.5, -2, 20, 4);
        ctx.restore();
        break;
    }

  }

  function drawTowers() {
    for (const tower of towers) {
      const def = TOWER_TYPES[tower.type];
      const angle = towerAngles.get(tower) || 0;
      const baseSize = 11 * (1 + (tower.tier - 1) * 0.1);
      ctx.save();
      ctx.translate(tower.x, tower.y);
      drawTowerShape(def, tower.tier, angle);

      // Tower HP bar (shown only when damaged)
      if (tower.hp < tower.maxHp) {
        const hpBarW = baseSize * 2;
        const hpBarH = 2;
        const hpRatio = Math.max(0, tower.hp / tower.maxHp);
        ctx.fillStyle = '#300';
        ctx.fillRect(-baseSize, baseSize + 7, hpBarW, hpBarH);
        ctx.fillStyle = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
        ctx.fillRect(-baseSize, baseSize + 7, hpBarW * hpRatio, hpBarH);
      }

      // Tier pips (small dots)
      for (let p = 0; p < tower.tier; ++p) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-6 + p * 6, baseSize + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

    }
  }

  function drawEnemyShape(e, faceAngle) {
    const r = e.radius;
    switch (e.type) {
      case 'normal':
        // Circle with inner gradient
        {
          const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
          grad.addColorStop(0, '#f88');
          grad.addColorStop(1, e.color);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'fast':
        // Elongated diamond (shows speed)
        ctx.save();
        ctx.rotate(faceAngle);
        {
          const grad = ctx.createLinearGradient(-r, 0, r, 0);
          grad.addColorStop(0, '#2a2');
          grad.addColorStop(0.5, '#8f8');
          grad.addColorStop(1, e.color);
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.moveTo(r + 2, 0);
        ctx.lineTo(0, -r + 1);
        ctx.lineTo(-r - 1, 0);
        ctx.lineTo(0, r - 1);
        ctx.closePath();
        ctx.fill();
        // Speed lines
        ctx.strokeStyle = `rgba(100, 255, 100, ${0.3 + Math.sin(animTime * 10) * 0.2})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-r - 3, -2);
        ctx.lineTo(-r - 7, -2);
        ctx.moveTo(-r - 2, 2);
        ctx.lineTo(-r - 6, 2);
        ctx.stroke();
        ctx.restore();
        break;

      case 'armored':
        // Thick square with border (tank)
        {
          const grad = ctx.createLinearGradient(-r, -r, r, r);
          grad.addColorStop(0, '#aaa');
          grad.addColorStop(0.5, '#ccc');
          grad.addColorStop(1, '#666');
          ctx.fillStyle = grad;
        }
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r + 1, -r + 1, r * 2 - 2, r * 2 - 2);
        break;

      case 'flying':
        // Wing shape
        ctx.save();
        ctx.rotate(faceAngle);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r, -r - 2);
        ctx.lineTo(-r + 3, 0);
        ctx.lineTo(-r, r + 2);
        ctx.closePath();
        ctx.fill();
        // Animated wing flap
        {
          const wingFlap = Math.sin(animTime * 12) * 3;
          ctx.strokeStyle = '#aaf';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-2, 0);
          ctx.lineTo(-4, -r - wingFlap);
          ctx.moveTo(-2, 0);
          ctx.lineTo(-4, r + wingFlap);
          ctx.stroke();
        }
        ctx.restore();
        break;

      case 'boss':
        // Large spiked circle
        {
          const grad = ctx.createRadialGradient(0, -2, 2, 0, 0, r);
          grad.addColorStop(0, '#f8f');
          grad.addColorStop(0.5, e.color);
          grad.addColorStop(1, '#808');
          ctx.fillStyle = grad;
        }
        // Spikes
        ctx.beginPath();
        const spikes = 8;
        for (let s = 0; s < spikes; ++s) {
          const a = (Math.PI * 2 / spikes) * s + animTime * 0.3;
          const outerR = r + 4;
          const innerR = r - 2;
          ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
          const midA = a + Math.PI / spikes;
          ctx.lineTo(Math.cos(midA) * innerR, Math.sin(midA) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        // Inner eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0f';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'healer':
        // Green circle with cross
        {
          const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
          grad.addColorStop(0, '#8f8');
          grad.addColorStop(1, e.color);
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // Plus/cross symbol
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -r + 2, 2, r * 2 - 4);
        ctx.fillRect(-r + 2, -1, r * 2 - 4, 2);
        // Healing aura pulse
        {
          const auraPulse = 0.2 + 0.2 * Math.sin(animTime * 4);
          ctx.strokeStyle = `rgba(100, 255, 100, ${auraPulse})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case 'swarm':
        // Tiny triangle (fast and numerous)
        ctx.save();
        ctx.rotate(faceAngle);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r, -r);
        ctx.lineTo(-r, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;

      case 'shield':
        // Circle with shield ring
        {
          const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
          grad.addColorStop(0, '#8ff');
          grad.addColorStop(1, e.color);
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // Shield ring (fades as shield depletes)
        if (e.shieldHp > 0) {
          const shieldRatio = e.shieldHp / (e.maxHp * 0.4);
          ctx.strokeStyle = `rgba(80, 255, 255, ${shieldRatio * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r + 3, 0, Math.PI * 2 * shieldRatio);
          ctx.stroke();
        }
        break;
    }

  }

  /* ── Improved enemy drawing with distinct shapes ── */
  function drawEnemies() {
    for (const e of enemies) {
      if (e.hp <= 0)
        continue;
      const ex = e.x;
      const ey = e.y;
      const r = e.radius;

      ctx.save();
      ctx.translate(ex, ey);

      // Direction for facing
      let faceAngle = 0;
      if (e.pathIndex < pathPoints.length - 1) {
        const to = pathPoints[Math.min(e.pathIndex + 1, pathPoints.length - 1)];
        faceAngle = Math.atan2(to.y - ey, to.x - ex);
      }

      drawEnemyShape(e, faceAngle);


      // Freeze indicator
      if (e.freezeTimer > 0) {
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        // Icicle marks
        ctx.fillStyle = 'rgba(200, 240, 255, 0.5)';
        for (let ic = 0; ic < 4; ++ic) {
          const ia = (Math.PI / 2) * ic;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ia) * (r + 1), Math.sin(ia) * (r + 1));
          ctx.lineTo(Math.cos(ia) * (r + 5), Math.sin(ia) * (r + 5));
          ctx.lineTo(Math.cos(ia + 0.3) * (r + 2), Math.sin(ia + 0.3) * (r + 2));
          ctx.closePath();
          ctx.fill();
        }
      }
      // Slow indicator
      else if (e.slowTimer > 0) {
        ctx.strokeStyle = 'rgba(100, 170, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // DoT indicator
      if (e.dotTimer > 0) {
        ctx.strokeStyle = 'rgba(0, 200, 80, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      // Health bar (above enemy)
      const barW = r * 2 + 4;
      const barH = 3;
      const barX = ex - barW / 2;
      const barY = ey - r - 7;
      const hpRatio = Math.max(0, e.hp / e.maxHp);

      ctx.fillStyle = '#600';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Shield bar (below health bar)
      if (e.isShielded && e.shieldHp > 0) {
        const shieldRatio = e.shieldHp / (e.maxHp * 0.4);
        ctx.fillStyle = '#048';
        ctx.fillRect(barX, barY + barH + 1, barW, 2);
        ctx.fillStyle = '#4ff';
        ctx.fillRect(barX, barY + barH + 1, barW * shieldRatio, 2);
      }
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      // Trail
      if (p.trail.length > 1) {
        ctx.strokeStyle = _hexAlpha(p.color, '40');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; ++t)
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Projectile body
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawFloorEffects() {
    for (const fe of floorEffects) {
      const fx = fe.col * CELL;
      const fy = fe.row * CELL;
      const cx = fe.x;
      const cy = fe.y;

      ctx.save();

      if (fe.type === 'lava') {
        // Pulsing orange/red lava tile
        const pulse = 0.6 + 0.4 * Math.sin(animTime * 4 + fe.col * 0.7 + fe.row * 1.3);
        const fadeAlpha = fe.timer < 1.5 ? fe.timer / 1.5 : 1;
        ctx.globalAlpha = fadeAlpha;

        const lavaGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL / 2);
        lavaGrad.addColorStop(0, `rgba(255, 200, 50, ${pulse * 0.8})`);
        lavaGrad.addColorStop(0.4, `rgba(255, 100, 0, ${pulse * 0.6})`);
        lavaGrad.addColorStop(0.8, `rgba(200, 40, 0, ${pulse * 0.4})`);
        lavaGrad.addColorStop(1, 'rgba(100, 20, 0, 0)');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(fx, fy, CELL, CELL);

        // Lava bubbles
        if (Math.random() < 0.08)
          particles.sparkle(cx + (Math.random() - 0.5) * CELL * 0.6, cy + (Math.random() - 0.5) * CELL * 0.6, 1, { color: '#fa0', speed: 0.8 });
      } else if (fe.type === 'ice') {
        // Light blue crystalline tile
        const shimmer = 0.5 + 0.3 * Math.sin(animTime * 3 + fe.col + fe.row);
        const fadeAlpha = fe.timer < 1.5 ? fe.timer / 1.5 : 1;
        ctx.globalAlpha = fadeAlpha;

        const iceGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, CELL / 2);
        iceGrad.addColorStop(0, `rgba(200, 240, 255, ${shimmer * 0.7})`);
        iceGrad.addColorStop(0.5, `rgba(100, 180, 255, ${shimmer * 0.5})`);
        iceGrad.addColorStop(1, 'rgba(60, 120, 200, 0)');
        ctx.fillStyle = iceGrad;
        ctx.fillRect(fx, fy, CELL, CELL);

        // Crystal cross pattern
        ctx.strokeStyle = `rgba(200, 240, 255, ${shimmer * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, fy + 4);
        ctx.lineTo(cx, fy + CELL - 4);
        ctx.moveTo(fx + 4, cy);
        ctx.lineTo(fx + CELL - 4, cy);
        ctx.stroke();

        // Diagonal crystal lines
        ctx.beginPath();
        ctx.moveTo(fx + 6, fy + 6);
        ctx.lineTo(fx + CELL - 6, fy + CELL - 6);
        ctx.moveTo(fx + CELL - 6, fy + 6);
        ctx.lineTo(fx + 6, fy + CELL - 6);
        ctx.stroke();
      } else if (fe.type === 'spike') {
        // Metallic grey spikes
        ctx.fillStyle = 'rgba(120, 120, 130, 0.6)';
        ctx.fillRect(fx + 2, fy + 2, CELL - 4, CELL - 4);

        // Draw spike triangles in a grid pattern
        ctx.fillStyle = '#aaa';
        const spikePad = 5;
        const spikeSize = 4;
        for (let sx = 0; sx < 3; ++sx) {
          for (let sy = 0; sy < 3; ++sy) {
            const spx = fx + spikePad + sx * (CELL - spikePad * 2) / 2;
            const spy = fy + spikePad + sy * (CELL - spikePad * 2) / 2;
            ctx.beginPath();
            ctx.moveTo(spx, spy - spikeSize);
            ctx.lineTo(spx - spikeSize * 0.5, spy + spikeSize * 0.3);
            ctx.lineTo(spx + spikeSize * 0.5, spy + spikeSize * 0.3);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Metallic highlight
        ctx.strokeStyle = 'rgba(200, 200, 210, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(fx + 3, fy + 3, CELL - 6, CELL - 6);
      }

      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LAYOUT -- the canvas fills the window; the HUD lives on a virtual
     screen of UI units (uiS screen px each), the map is scaled into the
     space between the top bar and the build bar
     ══════════════════════════════════════════════════════════════════ */

  const TWO_PI = Math.PI * 2;
  const WORLD_W = COLS * CELL;
  const WORLD_H = ROWS * CELL;
  const TOP_H = 54;            // top HUD bar (UI units)
  const BOT_H = 92;            // build bar (UI units)

  let canvasW = 960, canvasH = 640, dpr = 1;
  let uiS = 1, UW = 960, UH = 640;
  const view = { x: 0, y: 0, s: 1 };   // world -> screen px
  let shakeX = 0, shakeY = 0;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function setupCanvas() {
    canvas.style.width = '0';
    canvas.style.height = '0';
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    canvasW = Math.max(240, Math.floor(rect.width) || 960);
    canvasH = Math.max(180, Math.floor(rect.height) || 640);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    uiS = clamp(Math.min(canvasW / 1000, canvasH / 660), 0.5, 1.8);
    UW = canvasW / uiS;
    UH = canvasH / uiS;
    layoutView();
  }

  function layoutView() {
    const top = (TOP_H + 2) * uiS;
    const bottom = canvasH - (BOT_H + 2) * uiS;
    const availW = canvasW - 8 * uiS;
    const availH = Math.max(40, bottom - top);
    view.s = Math.min(availW / WORLD_W, availH / WORLD_H);
    view.x = (canvasW - WORLD_W * view.s) / 2;
    view.y = top + (availH - WORLD_H * view.s) / 2;
  }

  function setUiTransform() {
    ctx.setTransform(dpr * uiS, 0, 0, dpr * uiS, dpr * shakeX, dpr * shakeY);
  }

  function setWorldTransform() {
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * (view.x + shakeX), dpr * (view.y + shakeY));
  }

  // World point -> UI units
  function worldToUi(wx, wy) {
    return { x: (view.x + wx * view.s) / uiS, y: (view.y + wy * view.s) / uiS };
  }

  /* ══════════════════════════════════════════════════════════════════
     PIXEL ART -- shapes are drawn at art resolution, then every pixel is
     snapped to opaque/transparent and outlined; results are cached
     ══════════════════════════════════════════════════════════════════ */

  const OUTLINE = '#120c18';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function pixelize(c, outline) {
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4)
      d[i] = d[i] >= 100 ? 255 : 0;
    if (outline) {
      const solid = new Uint8Array(w * h);
      for (let i = 0; i < w * h; ++i)
        solid[i] = d[i * 4 + 3] ? 1 : 0;
      const [or, og, ob] = parseHex(outline);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          if (solid[y * w + x]) continue;
          if ((x > 0 && solid[y * w + x - 1]) || (x < w - 1 && solid[y * w + x + 1]) || (y > 0 && solid[(y - 1) * w + x]) || (y < h - 1 && solid[(y + 1) * w + x])) {
            const i = (y * w + x) * 4;
            d[i] = or; d[i + 1] = og; d[i + 2] = ob; d[i + 3] = 255;
          }
        }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // draw(g, w, h) paints at art resolution; a 1px border is left for the outline
  function pixelArt(w, h, draw, outline) {
    const c = makeCanvas(w + 2, h + 2);
    const g = c.getContext('2d');
    g.translate(1, 1);
    draw(g, w, h);
    return pixelize(c, outline === undefined ? OUTLINE : outline);
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function shade(hex, f) {
    const [r, g, b] = parseHex(hex);
    const k = (v) => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
    return '#' + [k(r), k(g), k(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* ── HUD icons (16x16 art pixels) ── */
  const ICONS = {
    heart: (g) => {
      g.fillStyle = '#e8354a';
      g.beginPath();
      g.moveTo(8, 14); g.lineTo(1.5, 7); g.arc(4.6, 4.8, 3.6, Math.PI * 0.85, Math.PI * 1.9); g.arc(11.4, 4.8, 3.6, Math.PI * 1.1, Math.PI * 0.15); g.closePath();
      g.fill();
      g.fillStyle = '#ff8fa0'; g.fillRect(3, 3, 2, 2);
      g.fillStyle = '#a3162b'; g.fillRect(8, 11, 2, 2); g.fillRect(11, 8, 2, 2);
    },
    coin: (g) => {
      g.fillStyle = '#b8801a'; g.beginPath(); g.arc(8, 8.6, 6.6, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(8, 7.6, 6.2, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffeea0'; g.fillRect(4, 3, 3, 2);
      g.fillStyle = '#c99220'; g.fillRect(7, 4, 2, 7); g.fillRect(5, 5, 6, 1); g.fillRect(5, 9, 6, 1);
    },
    flag: (g) => {
      g.fillStyle = '#8a6a48'; g.fillRect(2, 1, 2, 14);
      g.fillStyle = '#e8354a'; g.beginPath(); g.moveTo(4, 2); g.lineTo(14, 4.5); g.lineTo(4, 8.5); g.fill();
      g.fillStyle = '#ff8fa0'; g.fillRect(5, 3, 3, 1);
    },
    skull: (g) => {
      g.fillStyle = '#e8e2d4'; g.beginPath(); g.arc(8, 7, 6, 0, TWO_PI); g.fill(); g.fillRect(4, 10, 8, 4);
      g.fillStyle = '#2a1e2e'; g.fillRect(4, 6, 3, 3); g.fillRect(9, 6, 3, 3); g.fillRect(7, 10, 2, 2);
      g.fillStyle = '#9a9284'; g.fillRect(5, 13, 1, 2); g.fillRect(8, 13, 1, 2); g.fillRect(11, 13, 1, 1);
    },
    star: (g) => {
      g.fillStyle = '#ffcf3a'; g.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.4;
        g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
      }
      g.fill();
      g.fillStyle = '#fff3a8'; g.fillRect(7, 4, 2, 3); g.fillRect(5, 7, 2, 1);
    },
    starEmpty: (g) => {
      g.fillStyle = '#3a3a52'; g.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.4;
        g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
      }
      g.fill();
    },
    lock: (g) => {
      g.strokeStyle = '#a8b0c8'; g.lineWidth = 2; g.beginPath(); g.arc(8, 6, 3.5, Math.PI, 0); g.stroke();
      g.fillRect(4.5, 6, 0.1, 0.1);
      g.fillStyle = '#d8a83a'; g.fillRect(3, 7, 10, 8);
      g.fillStyle = '#ffd86a'; g.fillRect(3, 7, 10, 2);
      g.fillStyle = '#5a3a10'; g.fillRect(7, 10, 2, 3);
    },
    check: (g) => {
      g.strokeStyle = '#5ee07a'; g.lineWidth = 3; g.lineCap = 'square';
      g.beginPath(); g.moveTo(2.5, 8.5); g.lineTo(6.5, 12.5); g.lineTo(13.5, 3.5); g.stroke();
    },
    pause: (g) => {
      g.fillStyle = '#e4eaf6'; g.fillRect(3, 2, 4, 12); g.fillRect(9, 2, 4, 12);
    },
    play: (g) => {
      g.fillStyle = '#e4eaf6'; g.beginPath(); g.moveTo(4, 2); g.lineTo(14, 8); g.lineTo(4, 14); g.fill();
    },
    help: (g) => {
      g.fillStyle = '#5ab8ff'; g.beginPath(); g.arc(8, 8, 7, 0, TWO_PI); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 8, 8.5);
    },
    menu: (g) => {
      g.fillStyle = '#e4eaf6'; g.fillRect(2, 3, 12, 2); g.fillRect(2, 7, 12, 2); g.fillRect(2, 11, 12, 2);
    },
    loop: (g) => {
      g.strokeStyle = '#7ad8ff'; g.lineWidth = 2; g.beginPath(); g.arc(8, 8, 5, 0.3, Math.PI * 1.6); g.stroke();
      g.fillStyle = '#7ad8ff'; g.beginPath(); g.moveTo(13, 3); g.lineTo(14, 9); g.lineTo(8.5, 6.5); g.fill();
    },
    sword: (g) => {
      g.save(); g.translate(8, 8); g.rotate(-Math.PI / 4);
      g.fillStyle = '#d8e0f0'; g.fillRect(-1.5, -7.5, 3, 10);
      g.fillStyle = '#ffffff'; g.fillRect(-1.5, -7.5, 1, 10);
      g.fillStyle = '#d8a83a'; g.fillRect(-4, 2.5, 8, 2);
      g.fillStyle = '#7a4a2a'; g.fillRect(-1, 4.5, 2, 3);
      g.restore();
    },
    range: (g) => {
      g.strokeStyle = '#7ad8ff'; g.lineWidth = 1.6; g.beginPath(); g.arc(8, 8, 6, 0, TWO_PI); g.stroke();
      g.beginPath(); g.arc(8, 8, 2.6, 0, TWO_PI); g.stroke();
      g.fillStyle = '#7ad8ff'; g.fillRect(7, 0, 2, 4); g.fillRect(7, 12, 2, 4); g.fillRect(0, 7, 4, 2); g.fillRect(12, 7, 4, 2);
    },
    clock: (g) => {
      g.fillStyle = '#e4eaf6'; g.beginPath(); g.arc(8, 8, 7, 0, TWO_PI); g.fill();
      g.fillStyle = '#2a3248'; g.fillRect(7, 3, 2, 6); g.fillRect(7, 7, 5, 2);
    },
    hammer: (g) => {
      g.save(); g.translate(8, 8); g.rotate(Math.PI / 4);
      g.fillStyle = '#8a5a30'; g.fillRect(-1, -2, 2, 10);
      g.fillStyle = '#b8c0d8'; g.fillRect(-5, -7, 10, 5);
      g.fillStyle = '#e8eef8'; g.fillRect(-5, -7, 10, 1);
      g.restore();
    },
    up: (g) => {
      g.fillStyle = '#5ee07a'; g.beginPath(); g.moveTo(8, 1); g.lineTo(15, 8); g.lineTo(11, 8); g.lineTo(11, 15); g.lineTo(5, 15); g.lineTo(5, 8); g.lineTo(1, 8); g.fill();
      g.fillStyle = '#b8ffc8'; g.fillRect(7, 3, 2, 3);
    },
    wrench: (g) => {
      g.save(); g.translate(8, 8); g.rotate(Math.PI / 4);
      g.fillStyle = '#b8c0d8'; g.fillRect(-1.5, -3, 3, 11);
      g.beginPath(); g.arc(0, -4, 4, 0, TWO_PI); g.fill();
      g.fillStyle = '#2a3248'; g.fillRect(-1.2, -9, 2.4, 5);
      g.restore();
    },
    crown: (g) => {
      g.fillStyle = '#ffcf3a'; g.beginPath(); g.moveTo(1, 13); g.lineTo(2, 4); g.lineTo(5.5, 8); g.lineTo(8, 2); g.lineTo(10.5, 8); g.lineTo(14, 4); g.lineTo(15, 13); g.fill();
      g.fillStyle = '#e8354a'; g.fillRect(7, 9, 2, 2);
      g.fillStyle = '#c99220'; g.fillRect(1, 12, 14, 2);
    },
    bolt: (g) => {
      g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(9, 1); g.lineTo(3, 9); g.lineTo(7.5, 9); g.lineTo(6, 15); g.lineTo(13, 6); g.lineTo(8.5, 6); g.lineTo(10.5, 1); g.fill();
    },
    target: (g) => {
      g.strokeStyle = '#ff6a6a'; g.lineWidth = 2; g.beginPath(); g.arc(8, 8, 6, 0, TWO_PI); g.stroke();
      g.fillStyle = '#ff6a6a'; g.fillRect(7, 7, 2, 2); g.fillRect(7, 0, 2, 4); g.fillRect(7, 12, 2, 4); g.fillRect(0, 7, 4, 2); g.fillRect(12, 7, 4, 2);
    },
    shield: (g) => {
      g.fillStyle = '#5ab8ff'; g.beginPath(); g.moveTo(8, 1); g.lineTo(14, 3); g.lineTo(13, 10); g.lineTo(8, 15); g.lineTo(3, 10); g.lineTo(2, 3); g.fill();
      g.fillStyle = '#b8e4ff'; g.fillRect(5, 4, 2, 5);
    },
    flask: (g) => {
      g.fillStyle = '#c8d4ec'; g.fillRect(6, 1, 4, 2);
      g.fillStyle = '#7ad8ff'; g.beginPath(); g.moveTo(6.5, 3); g.lineTo(9.5, 3); g.lineTo(9.5, 7); g.lineTo(14, 14); g.lineTo(2, 14); g.lineTo(6.5, 7); g.fill();
      g.fillStyle = '#c890ff'; g.beginPath(); g.moveTo(4.5, 10); g.lineTo(11.5, 10); g.lineTo(13.5, 13.5); g.lineTo(2.5, 13.5); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(5, 11, 1, 1); g.fillRect(9, 12, 1, 1);
    }
  };

  const iconCache = {};

  function getIcon(key) {
    let c = iconCache[key];
    if (c === undefined) {
      const fn = ICONS[key];
      c = iconCache[key] = fn ? pixelArt(16, 16, fn) : null;
    }
    return c;
  }

  // Draw a cached pixel image centred at (cx, cy) with the given height
  function drawPixelImage(img, cx, cy, size, alpha) {
    if (!img) return;
    const prevA = ctx.globalAlpha;
    if (alpha !== undefined)
      ctx.globalAlpha = prevA * alpha;
    ctx.imageSmoothingEnabled = false;
    const h = size, w = size * img.width / img.height;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = prevA;
  }

  function drawIcon(key, cx, cy, size, alpha) {
    drawPixelImage(getIcon(key), cx, cy, size, alpha);
  }

  /* ══════════════════════════════════════════════════════════════════
     TEXT LAYOUT -- every label is measured against the box it lives in
     ══════════════════════════════════════════════════════════════════ */

  const UI_FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

  function uiFont(px, weight) {
    return (weight ? weight + ' ' : '') + px + 'px ' + UI_FONT;
  }

  // Text with inline [[icon]] tokens -- honours the current textAlign/textBaseline
  function splitIconText(text) {
    return String(text).split(/\[\[(\w+)\]\]/);
  }

  function getFontPx() {
    const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
    return m ? parseFloat(m[1]) : 16;
  }

  function measureIconText(text) {
    const parts = splitIconText(text);
    const iconSize = Math.round(getFontPx() * 1.2);
    let w = 0;
    for (let i = 0; i < parts.length; ++i)
      w += i % 2 ? iconSize + 2 : ctx.measureText(parts[i]).width;
    return w;
  }

  function fillIconText(text, x, y) {
    const parts = splitIconText(text);
    if (parts.length === 1) {
      ctx.fillText(text, x, y);
      return;
    }
    const fontPx = getFontPx();
    const iconSize = Math.round(fontPx * 1.2);
    const align = ctx.textAlign;
    const total = measureIconText(text);
    let cx = x;
    if (align === 'center')
      cx = x - total / 2;
    else if (align === 'right' || align === 'end')
      cx = x - total;
    const base = ctx.textBaseline;
    let iconY = y;
    if (base === 'top' || base === 'hanging')
      iconY = y + fontPx * 0.55;
    else if (base === 'alphabetic' || base === 'bottom' || base === 'ideographic')
      iconY = y - fontPx * 0.35;
    ctx.textAlign = 'left';
    for (let i = 0; i < parts.length; ++i) {
      if (i % 2) {
        drawIcon(parts[i], cx + iconSize / 2 + 1, iconY, iconSize);
        cx += iconSize + 2;
      } else if (parts[i]) {
        ctx.fillText(parts[i], cx, y);
        cx += ctx.measureText(parts[i]).width;
      }
    }
    ctx.textAlign = align;
  }

  const textFitCache = new Map();
  function cachedLayout(key, build) {
    let v = textFitCache.get(key);
    if (v === undefined) {
      if (textFitCache.size > 3000)
        textFitCache.clear();
      v = build();
      textFitCache.set(key, v);
    }
    return v;
  }

  function textUnits(text) {
    const parts = splitIconText(text);
    const units = [];
    for (let i = 0; i < parts.length; ++i)
      if (i % 2)
        units.push('[[' + parts[i] + ']]');
      else
        for (const ch of parts[i])
          units.push(ch);
    return units;
  }

  function ellipsize(text, maxW) {
    text = String(text);
    if (measureIconText(text) <= maxW)
      return text;
    const units = textUnits(text);
    let lo = 0, hi = units.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measureIconText(units.slice(0, mid).join('').trimEnd() + '…') <= maxW)
        lo = mid;
      else
        hi = mid - 1;
    }
    return lo > 0 ? units.slice(0, lo).join('').trimEnd() + '…' : '';
  }

  // Largest font size in [minPx, px] that fits; ellipsizes if minPx is still too wide
  function layoutLine(text, maxW, px, minPx, weight) {
    text = String(text);
    return cachedLayout('L' + text + '|' + Math.round(maxW) + '|' + px + '|' + minPx + '|' + (weight || ''), () => {
      let size = px;
      ctx.font = uiFont(size, weight);
      let w = measureIconText(text);
      if (w > maxW && size > minPx) {
        size = Math.max(minPx, Math.floor(px * maxW / w));
        ctx.font = uiFont(size, weight);
        w = measureIconText(text);
        while (w > maxW && size > minPx) {
          size -= 0.5;
          ctx.font = uiFont(size, weight);
          w = measureIconText(text);
        }
      }
      const out = w > maxW ? ellipsize(text, maxW) : text;
      return { size, text: out, width: Math.min(w, maxW) };
    });
  }

  // One line of text that never exceeds maxW; returns the drawn width
  function fitText(text, x, y, maxW, px, opts) {
    opts = opts || {};
    const l = layoutLine(text, Math.max(1, maxW), px, opts.minPx || Math.max(7, Math.round(px * 0.6)), opts.weight);
    ctx.font = uiFont(l.size, opts.weight);
    if (opts.color)
      ctx.fillStyle = opts.color;
    if (opts.outline) {
      ctx.save();
      ctx.strokeStyle = opts.outline;
      ctx.lineWidth = Math.max(2, l.size / 5);
      ctx.lineJoin = 'round';
      if (l.text.indexOf('[[') < 0)
        ctx.strokeText(l.text, x, y);
      ctx.restore();
    }
    fillIconText(l.text, x, y);
    return l.width;
  }

  function wrapText(text, maxW) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const trial = line ? line + ' ' + word : word;
        if (!line || measureIconText(trial) <= maxW)
          line = trial;
        else {
          lines.push(line);
          line = word;
        }
        if (measureIconText(line) > maxW && line === word)
          line = ellipsize(word, maxW);
      }
      lines.push(line);
    }
    return lines;
  }

  function layoutBlock(text, w, h, px, minPx, weight, lineGap) {
    return cachedLayout('B' + text + '|' + Math.round(w) + '|' + Math.round(h) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + lineGap, () => {
      let size = px, lines;
      for (;;) {
        ctx.font = uiFont(size, weight);
        lines = wrapText(text, w);
        if (lines.length * size * lineGap <= h || size <= minPx)
          break;
        size -= 0.5;
      }
      const maxLines = Math.max(1, Math.floor(h / (size * lineGap)));
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = ellipsize(lines[maxLines - 1] + '…', w);
      }
      return { size, lines, lineH: size * lineGap };
    });
  }

  // Wrapped text inside a box. align: 'left' | 'center'; valign: 'top' | 'middle'
  function drawTextBlock(text, x, y, w, h, px, opts) {
    opts = opts || {};
    const b = layoutBlock(text, w, h, px, opts.minPx || Math.max(7, Math.round(px * 0.6)), opts.weight, opts.lineGap || 1.3);
    ctx.font = uiFont(b.size, opts.weight);
    if (opts.color)
      ctx.fillStyle = opts.color;
    const align = opts.align || 'left';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const tx = align === 'center' ? x + w / 2 : x;
    let ty = y + b.lineH / 2;
    if (opts.valign === 'middle')
      ty += (h - b.lines.length * b.lineH) / 2;
    for (const line of b.lines) {
      fillIconText(line, tx, ty);
      ty += b.lineH;
    }
    return b.lines.length * b.lineH;
  }

  /* ══════════════════════════════════════════════════════════════════
     UI PANELS -- one frame style for every box on screen
     ══════════════════════════════════════════════════════════════════ */

  const UI = {
    panelTop: 'rgba(24,32,56,0.95)',
    panelBottom: 'rgba(10,13,26,0.95)',
    edge: '#05070e',
    rim: 'rgba(150,180,255,0.16)',
    accent: '#5ab8ff',
    gold: '#ffd75a',
    goldDeep: '#c9952a',
    text: '#e4eaf6',
    textDim: '#93a0bb',
    textMute: '#5d6884',
    good: '#6fe08a',
    bad: '#ff6a6a',
    warn: '#ffb648'
  };

  function roundRectPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Framed panel: offset shadow, vertical gradient, dark edge, light rim,
  // gold corner studs, accent strip and an optional title header
  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 9;
    const accent = opts.accent || UI.gold;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    if (!opts.flat) {
      roundRectPath(x + 2, y + 4, w, h, r);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opts.top || UI.panelTop);
    g.addColorStop(1, opts.bottom || UI.panelBottom);
    roundRectPath(x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI.edge;
    ctx.stroke();
    roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.glow ? hexToRgba(accent, 0.8) : UI.rim;
    ctx.stroke();
    // Accent strip along the top edge
    const sg = ctx.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, hexToRgba(accent, 0));
    sg.addColorStop(0.5, hexToRgba(accent, 0.9));
    sg.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x + r, y + 1, w - r * 2, 2);
    // Gold corner studs
    if (!opts.noStuds && w > 40 && h > 30) {
      ctx.fillStyle = hexToRgba(accent, 0.75);
      const s = 3;
      ctx.fillRect(x + 4, y + h - 4 - s, s, s);
      ctx.fillRect(x + w - 4 - s, y + h - 4 - s, s, s);
    }
    let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
    if (opts.title) {
      const hh = opts.headerH || 30;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x + 2, y + 3, w - 4, hh - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 8, y + hh, w - 16, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 8, y + hh + 1, w - 16, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const rpad = opts.titleRightPad || 0;
      const rightW = opts.titleRight ? Math.min(w * 0.45, 170) : 0;
      fitText(opts.title, x + 12, y + hh / 2 + 1, w - 24 - rightW - rpad, opts.titlePx || 16, { weight: 'bold', color: accent });
      if (opts.titleRight) {
        ctx.textAlign = 'right';
        fitText(opts.titleRight, x + w - 12 - rpad, y + hh / 2 + 1, rightW - 6, 12, { color: opts.titleRightColor || UI.textDim, weight: 'bold' });
      }
      contentY = y + hh + 6;
    }
    ctx.restore();
    return contentY;
  }

  function drawMeter(x, y, w, h, ratio, color, opts) {
    opts = opts || {};
    ratio = clamp(ratio, 0, 1);
    ctx.save();
    roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = opts.track || 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    if (ratio > 0) {
      ctx.save();
      roundRectPath(x, y, w, h, h / 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * ratio, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x, y, w * ratio, h * 0.42);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + h * 0.75, w * ratio, h * 0.25);
      ctx.restore();
    }
    if (opts.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.75), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
    }
    ctx.restore();
  }

  function drawChip(text, x, y, h, opts) {
    opts = opts || {};
    const px = opts.px || Math.round(h * 0.62);
    ctx.font = uiFont(px, opts.weight || 'bold');
    const w = Math.min(opts.maxW || 1e9, Math.ceil(measureIconText(text)) + h * 0.8);
    const x0 = opts.align === 'right' ? x - w : (opts.align === 'center' ? x - w / 2 : x);
    roundRectPath(x0, y, w, h, h / 2);
    ctx.fillStyle = opts.bg || 'rgba(255,255,255,0.08)';
    ctx.fill();
    if (opts.border) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = opts.border;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(text, x0 + w / 2, y + h / 2 + 1, w - h * 0.5, px, { weight: opts.weight || 'bold', color: opts.color || UI.text });
    return w;
  }

  // Keycap hints ("[S] Sell") centred on cx and scaled to stay within maxW
  function drawKeyHints(hints, cx, cy, maxW, scale) {
    const k = scale || 1;
    const keyPx = 10 * k, labelPx = 11 * k, keyH = 16 * k, gap = 12 * k;
    const parts = hints.map(h => {
      ctx.font = uiFont(keyPx, 'bold');
      const kw = Math.max(keyH, ctx.measureText(h.key).width + 8 * k);
      ctx.font = uiFont(labelPx);
      return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
    });
    let total = -gap;
    for (const p of parts)
      total += p.kw + 4 * k + p.lw + gap;
    const s = Math.min(1, maxW / Math.max(1, total));
    ctx.save();
    ctx.translate(cx - total * s / 2, cy);
    ctx.scale(s, s);
    let x = 0;
    for (const p of parts) {
      roundRectPath(x, -keyH / 2, p.kw, keyH, 3 * k);
      ctx.fillStyle = 'rgba(20,26,42,0.92)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,215,90,0.45)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 3, keyH / 2 - 3, p.kw - 6, 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = uiFont(keyPx, 'bold');
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(p.key, x + p.kw / 2, 1);
      ctx.textAlign = 'left';
      ctx.font = uiFont(labelPx);
      ctx.fillStyle = 'rgba(200,210,230,0.8)';
      ctx.fillText(p.label, x + p.kw + 4 * k, 1);
      x += p.kw + 4 * k + p.lw + gap;
    }
    ctx.restore();
  }

  // Small keycap in a corner (build cards, buttons)
  function drawKeycap(key, x, y, px) {
    ctx.font = uiFont(px, 'bold');
    const w = Math.max(px + 4, ctx.measureText(key).width + 6);
    const h = px + 5;
    roundRectPath(x, y, w, h, 3);
    ctx.fillStyle = 'rgba(8,10,20,0.85)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,215,90,0.4)';
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key, x + w / 2, y + h / 2 + 0.5);
    return w;
  }

  function drawHeadline(text, x, y, maxW, px, color, glow) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const l = layoutLine(text, maxW, px, Math.round(px * 0.4), 'bold');
    ctx.font = uiFont(l.size, 'bold');
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, l.size / 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(l.text, x, y + 3);
    ctx.strokeStyle = shade(glow || color, -0.55);
    ctx.lineWidth = Math.max(2, l.size / 10);
    ctx.strokeText(l.text, x, y);
    const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, glow || color);
    ctx.fillStyle = g;
    ctx.fillText(l.text, x, y);
    ctx.restore();
  }

  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(-20, -20, UW + 40, UH + 40);
    if (!vignetteCanvas) {
      vignetteCanvas = makeCanvas(160, 120);
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(80, 60, 20, 80, 60, 100);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      v.fillStyle = g;
      v.fillRect(0, 0, 160, 120);
    }
    ctx.drawImage(vignetteCanvas, -20, -20, UW + 40, UH + 40);
  }

  /* ══════════════════════════════════════════════════════════════════
     INTERACTIVE REGIONS -- every button registers itself while drawing;
     clicks and hovers test last frame's list (what the player sees)
     ══════════════════════════════════════════════════════════════════ */

  let regions = [];
  let prevRegions = [];
  const pointer = { px: -1, py: -1, ux: -1, uy: -1, wx: -1, wy: -1, inside: false, type: 'mouse' };
  let hoverId = null;
  const pressFx = {};        // id -> time of the last press (button feedback)
  let frameDt = 0.016;
  let frameNo = 0;

  function addRegion(r) {
    regions.push(r);
    return r;
  }

  function regionAt(ux, uy) {
    for (let i = prevRegions.length - 1; i >= 0; --i) {
      const r = prevRegions[i];
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return r;
    }
    return null;
  }

  function pressAmount(id) {
    const t = pressFx[id];
    if (t === undefined) return 0;
    const k = (performance.now() - t) / 160;
    if (k >= 1) {
      delete pressFx[id];
      return 0;
    }
    return 1 - k;
  }

  const BUTTON_STYLES = {
    gold: ['#ffd75a', '#c9952a', '#3a2606', '#fff1b8'],
    blue: ['#4aa0ff', '#1f4c98', '#ffffff', '#bfe0ff'],
    green: ['#5ccf74', '#21783a', '#ffffff', '#c8ffd2'],
    red: ['#ff6a6a', '#9a2a2a', '#ffffff', '#ffd0d0'],
    dark: ['#2e3852', '#171c2c', '#d0d8ea', '#8a9ac0']
  };

  // Gradient button; registers a click region. opts: style, icon, px, disabled, key, onClick, tip, sub
  function uiButton(id, x, y, w, h, label, opts) {
    opts = opts || {};
    const st = BUTTON_STYLES[opts.style || 'dark'];
    const disabled = !!opts.disabled;
    const hover = hoverId === id;
    const press = pressAmount(id);
    ctx.save();
    if (disabled)
      ctx.globalAlpha *= 0.45;
    const dy = press * 2;
    roundRectPath(x + 1, y + 3, w, h, Math.min(8, h / 3));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
    g.addColorStop(0, hover && !disabled ? shade(st[0], 0.18) : st[0]);
    g.addColorStop(1, hover && !disabled ? shade(st[1], 0.12) : st[1]);
    roundRectPath(x, y + dy, w, h, Math.min(8, h / 3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = opts.active ? 2 : 1.5;
    ctx.strokeStyle = opts.active ? UI.gold : (hover && !disabled ? st[3] : UI.edge);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRectPath(x + 2, y + dy + 2, w - 4, h * 0.42, Math.min(6, h / 4));
    ctx.fill();
    if (press > 0) {
      roundRectPath(x - press * 4, y + dy - press * 4, w + press * 8, h + press * 8, 10);
      ctx.strokeStyle = `rgba(255,240,180,${press * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const px = opts.px || Math.min(15, Math.round(h * 0.42));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let keyW = 0;
    if (opts.key && w > 70) {
      const kpx = Math.max(8, px - 3);
      ctx.font = uiFont(kpx, 'bold');
      const kw = Math.max(kpx + 4, ctx.measureText(opts.key).width + 6);
      drawKeycap(opts.key, x + w - 6 - kw, y + dy + (h - kpx - 5) / 2, kpx);
      keyW = kw + 6;
    }
    const iconW = opts.icon ? px * 1.3 : 0;
    const avail = w - 12 - keyW - iconW;
    const cy = y + dy + (opts.sub ? h * 0.38 : h / 2) + 1;
    const lw = label ? layoutLine(label, avail, px, Math.max(7, px * 0.6), 'bold').width : 0;
    const startX = x + 6 + (avail + iconW - (lw + iconW)) / 2;
    if (opts.icon)
      drawIcon(opts.icon, startX + iconW / 2 - 1, cy - 0.5, px * 1.15);
    if (label) {
      ctx.textAlign = 'left';
      fitText(label, startX + iconW, cy, avail, px, { weight: 'bold', color: st[2] });
    }
    if (opts.sub) {
      ctx.textAlign = 'center';
      fitText(opts.sub, x + (w - keyW) / 2, y + dy + h * 0.74, w - 12 - keyW, Math.round(px * 0.72), { color: hexToRgba(st[2] === '#ffffff' ? '#ffffff' : st[2], 0.75) });
    }
    ctx.restore();
    addRegion({ id, x, y, w, h, disabled, onClick: opts.onClick, onDisabled: opts.onDisabled, tip: opts.tip, sound: opts.sound });
  }

  /* ── Tooltip ── */
  const tooltip = { id: null, t: 0, lines: null, anchor: null };
  const TOOLTIP_DELAY = 0.25;

  // lines: [title, ...] strings; a leading '✔' / '✘' / '⚠' / '•' colours the line;
  // '--- Header ---' draws a divider
  function drawTooltip() {
    if (!tooltip.lines || tooltip.t < TOOLTIP_DELAY || !pointer.inside) return;
    const lines = tooltip.lines;
    const pad = 10;
    const maxTextW = Math.min(300, UW * 0.42);
    let fontSize = 12.5;
    let rows, boxW, boxH;
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 6 });
          continue;
        }
        ctx.font = uiFont(i === 0 ? fontSize + 2 : fontSize, i === 0 ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: i === 0 ? 'title' : 'text', text: w, h: (i === 0 ? fontSize + 2 : fontSize) * 1.38, src: line });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + pad * 2;
      boxH = pad * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= UH - 16 || fontSize <= 9)
        break;
      fontSize -= 0.5;
    }
    boxW = Math.max(boxW, 140);
    let bx, by;
    const a = tooltip.anchor;
    if (a) {
      bx = a.x + a.w / 2 - boxW / 2;
      by = a.y - boxH - 8;
      if (by < 8) by = a.y + a.h + 8;
    } else {
      bx = pointer.ux + 18;
      by = pointer.uy + 18;
      if (bx + boxW > UW - 8) bx = pointer.ux - boxW - 12;
      if (by + boxH > UH - 8) by = pointer.uy - boxH - 12;
    }
    bx = clamp(bx, 8, UW - 8 - boxW);
    by = clamp(by, 8, UH - 8 - boxH);
    ctx.save();
    drawPanel(bx, by, boxW, boxH, { radius: 8 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + pad;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(8, fontSize - 3), 'bold');
        ctx.fillStyle = UI.gold;
        ctx.globalAlpha = 0.8;
        ctx.fillText(r.text, bx + pad, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,215,90,0.25)';
        ctx.fillRect(bx + pad + tw + 6, cy, boxW - pad * 2 - tw - 6, 1);
        ctx.globalAlpha = 1;
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = '#c4cde0';
        if (title) color = '#ffffff';
        else if (r.src.startsWith('✔')) color = UI.good;
        else if (r.src.startsWith('✘')) color = UI.bad;
        else if (r.src.startsWith('⚠')) color = UI.warn;
        else if (r.src.startsWith('★')) color = UI.gold;
        ctx.fillStyle = color;
        fillIconText(r.text, bx + pad, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  function updateTooltip(dt) {
    let id = null, lines = null, anchor = null;
    if (pointer.inside && !overlay) {
      const r = regionAt(pointer.ux, pointer.uy);
      if (r && r.tip) {
        id = r.id;
        lines = r.tip();
        anchor = r.anchorTip ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
      } else if (!r && isInGameState()) {
        const e = enemyAtPointer();
        if (e) {
          id = 'enemy';
          lines = enemyTooltip(e);
        }
      }
    }
    if (id !== tooltip.id) {
      tooltip.id = id;
      tooltip.t = 0;
    }
    tooltip.t += dt;
    tooltip.lines = lines;
    tooltip.anchor = anchor;
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD FADE -- panels with an enemy or tower behind them turn see-through
     ══════════════════════════════════════════════════════════════════ */

  const hudFade = {};
  let hudActorCache = null, hudActorFrame = -1;

  function hudActors() {
    if (hudActorFrame === frameNo && hudActorCache) return hudActorCache;
    const out = [];
    const k = view.s / uiS;
    for (const e of enemies) {
      const p = worldToUi(e.x, e.y);
      const r = (e.radius + 6) * k;
      out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
    }
    for (const t of towers) {
      const p = worldToUi(t.x, t.y);
      const r = CELL * 0.5 * k;
      out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, tower: t });
    }
    hudActorCache = out;
    hudActorFrame = frameNo;
    return out;
  }

  function overlapsActor(x, y, w, h, skipTower) {
    for (const a of hudActors())
      if (a.tower !== skipTower && a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y)
        return true;
    return false;
  }

  function hudAlpha(id, x, y, w, h, skipTower) {
    const f = hudFade[id] || (hudFade[id] = { a: 1 });
    const mouseInside = pointer.inside && pointer.ux >= x && pointer.ux <= x + w && pointer.uy >= y && pointer.uy <= y + h;
    const live = (state === STATE_PLAYING || state === STATE_BUILD) && !overlay;
    const target = live && !mouseInside && overlapsActor(x, y, w, h, skipTower) ? 0.28 : 1;
    f.a += (target - f.a) * (1 - Math.exp(-frameDt * 10));
    f.rect = { x, y, w, h };
    f.frame = frameNo;
    return f.a;
  }

  function beginHudPanel(id, x, y, w, h, skipTower) {
    ctx.save();
    ctx.globalAlpha *= hudAlpha(id, x, y, w, h, skipTower);
  }

  function endHudPanel() {
    ctx.restore();
  }

  // A click on a faded panel with a tower behind it goes to the map
  function hudPassThrough(ux, uy) {
    for (const id in hudFade) {
      const f = hudFade[id];
      if (f.frame < frameNo - 2 || f.a > 0.6 || !f.rect) continue;
      const r = f.rect;
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREEN SHAKE
     ══════════════════════════════════════════════════════════════════ */

  let shakeMag = 0, shakeTime = 0, shakeDur = 1;

  function addShake(intensity, ms) {
    if (intensity >= shakeMag * (shakeTime / shakeDur)) {
      shakeMag = intensity;
      shakeDur = shakeTime = Math.max(0.05, ms / 1000);
    }
  }

  function updateShake(dt) {
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt);
      const k = shakeMag * (shakeTime / shakeDur) * view.s * 0.8;
      shakeX = (Math.random() * 2 - 1) * k;
      shakeY = (Math.random() * 2 - 1) * k;
    } else
      shakeX = shakeY = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD -- top bar: lives, gold, wave, next wave, speed and menu
     ══════════════════════════════════════════════════════════════════ */

  let shownGold = 0;
  let goldPulse = 0, livesPulse = 0;
  let overlay = null;          // 'help' while the help pages are open
  let helpPage = 0;
  const kbCursor = { col: 12, row: 8, active: false };

  function hudPanel(id, x, y, w, h, accent) {
    beginHudPanel(id, x, y, w, h);
    drawPanel(x, y, w, h, { accent, noStuds: true, radius: 8 });
  }

  function speedButtons(x, y, h) {
    const speeds = [1, 2, 3];
    const bw = 34;
    for (let i = 0; i < speeds.length; ++i) {
      const s = speeds[i];
      uiButton('speed' + s, x + i * (bw + 3), y, bw, h, s + '×', {
        style: gameSpeed === s ? 'gold' : 'dark', px: 13,
        onClick: () => setGameSpeed(s),
        tip: () => [`Game speed ${s}×`, s === 1 ? 'Normal speed' : `Everything runs ${s} times as fast`, '• F cycles the speed']
      });
    }
    return speeds.length * (bw + 3) - 3;
  }

  function drawTopBar() {
    const y = 6, h = TOP_H - 12;
    let x = 8;

    // Lives
    const lw = 88;
    hudPanel('lives', x, y, lw, h, UI.bad);
    drawIcon('heart', x + 21, y + h / 2, 22 * (1 + livesPulse * 0.35));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(String(lives), x + 37, y + h / 2 + 1, lw - 44, 21, { weight: 'bold', color: lives <= 5 ? UI.bad : '#ffffff' });
    endHudPanel();
    addRegion({ id: 'hud-lives', x, y, w: lw, h, tip: () => ['Lives', `${lives} of ${MAPS[currentMap].startLives} left`, 'Every enemy that reaches the exit costs a life (bosses cost more).'] });
    x += lw + 6;

    // Gold
    const gw = 112;
    hudPanel('gold', x, y, gw, h, UI.gold);
    drawIcon('coin', x + 21, y + h / 2, 22 * (1 + goldPulse * 0.3));
    ctx.textAlign = 'left';
    fitText(String(Math.round(shownGold)), x + 37, y + h / 2 + 1, gw - 44, 21, { weight: 'bold', color: goldPulse > 0.05 ? '#fff5c0' : UI.gold });
    endHudPanel();
    addRegion({ id: 'hud-gold', x, y, w: gw, h, tip: () => ['Gold', `${gold} gold`, 'Earned by defeating enemies and clearing waves.', 'Spend it on towers and upgrades.'] });
    goldHudPos.x = x + 21;
    goldHudPos.y = y + h / 2;
    x += gw + 6;

    // Wave
    const ww = 150;
    hudPanel('wave', x, y, ww, h, UI.accent);
    drawIcon('flag', x + 19, y + h / 2, 20);
    ctx.textAlign = 'left';
    fitText('WAVE', x + 34, y + 12, 50, 9, { weight: 'bold', color: UI.textDim });
    fitText(`${currentWave} / ${totalWaves}`, x + 34, y + 27, ww - 42, 16, { weight: 'bold', color: '#ffffff' });
    const left = waveEnemies.length + enemies.length;
    const prog = state === STATE_PLAYING && waveSize > 0 ? 1 - left / waveSize : (currentWave >= totalWaves ? 1 : 0);
    drawMeter(x + 92, y + h / 2 - 4, ww - 102, 8, state === STATE_PLAYING ? prog : currentWave / totalWaves, state === STATE_PLAYING ? UI.warn : UI.accent);
    endHudPanel();
    addRegion({ id: 'hud-wave', x, y, w: ww, h, tip: () => state === STATE_PLAYING
      ? [`Wave ${currentWave} of ${totalWaves}`, `${left} enemies left in this wave`]
      : [`Wave ${currentWave} of ${totalWaves}`, currentWave >= totalWaves ? 'All waves cleared' : `Next: wave ${currentWave + 1}`] });
    x += ww + 6;

    // Right group: speed, auto, help, pause
    const bh = h - 8, by = y + 4;
    const rightW = 3 * 37 - 3 + 6 + 56 + 6 + 34 + 4 + 34;
    let rx = UW - 8 - rightW;
    hudPanel('controls', rx - 6, y, rightW + 12, h, '#6a8ac8');
    rx += speedButtons(rx, by, bh) + 6;
    uiButton('auto', rx, by, 56, bh, 'AUTO', {
      style: autoWaveMode ? 'blue' : 'dark', px: 11, icon: 'loop',
      onClick: toggleAutoWave,
      tip: () => ['Auto-wave ' + (autoWaveMode ? 'on' : 'off'), `Starts the next wave ${AUTO_WAVE_DELAY} seconds after a wave is cleared.`, '• A toggles']
    });
    rx += 62;
    uiButton('help', rx, by, 34, bh, '', { icon: 'help', px: 14, onClick: () => openHelp(), tip: () => ['Help', 'How to play, towers, enemies and controls', '• H opens the help'] });
    rx += 38;
    uiButton('pause', rx, by, 34, bh, '', { icon: 'pause', px: 14, onClick: togglePause, tip: () => ['Pause', 'Pause menu', '• Esc pauses'] });
    endHudPanel();

    // Next wave panel fills the middle
    const nx = x, nw = UW - 8 - rightW - 12 - x - 6;
    if (nw > 120)
      drawNextWavePanel(nx, y, nw, h);
  }

  function drawNextWavePanel(x, y, w, h) {
    hudPanel('next', x, y, w, h, UI.warn);
    const bw = Math.min(170, w * 0.5);
    const bx = x + w - bw - 5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (state === STATE_BUILD && currentWave < totalWaves) {
      fitText('NEXT', x + 10, y + 12, 60, 9, { weight: 'bold', color: UI.textDim });
      const autoIn = autoWaveMode && waveComplete && autoWaveTimer > 0 ? `  · auto in ${Math.ceil(autoWaveTimer)}s` : '';
      fitText(`Wave ${currentWave + 1}${autoIn}`, x + 10, y + 27, bx - x - 16, 14, { weight: 'bold', color: '#ffffff' });
      uiButton('startwave', bx, y + 4, bw, h - 8, 'Start Wave', {
        style: 'gold', icon: 'play', px: 13, key: 'Space',
        onClick: () => startNextWave(),
        tip: () => [`Start wave ${currentWave + 1}`, 'Send the next wave now.']
      });
    } else if (state === STATE_PLAYING) {
      const left = waveEnemies.length + enemies.length;
      fitText('IN PROGRESS', x + 10, y + 12, 90, 9, { weight: 'bold', color: UI.textDim });
      fitText(`${left} enemies left`, x + 10, y + 27, w - 20, 14, { weight: 'bold', color: UI.warn });
    } else {
      fitText(currentWave >= totalWaves ? 'All waves cleared' : '', x + 10, y + h / 2, w - 20, 14, { weight: 'bold', color: UI.good });
    }
    endHudPanel();
  }

  /* ══════════════════════════════════════════════════════════════════
     BUILD BAR -- one card per tower type
     ══════════════════════════════════════════════════════════════════ */

  function towerHotkey(i) {
    return i < 9 ? String(i + 1) : i === 9 ? '0' : '';
  }

  function buildBarRect() {
    return { x: 8, y: UH - BOT_H + 4, w: UW - 16, h: BOT_H - 10 };
  }

  function drawBuildBar() {
    const r = buildBarRect();
    beginHudPanel('build', r.x, r.y, r.w, r.h);
    drawPanel(r.x, r.y, r.w, r.h, { accent: UI.gold, radius: 10 });
    const n = TOWER_TYPES.length;
    const gap = 5;
    const innerX = r.x + 8, innerW = r.w - 16;
    const cw = Math.min(92, (innerW - gap * (n - 1)) / n);
    const ch = r.h - 14;
    const total = n * cw + (n - 1) * gap;
    let cx = innerX + (innerW - total) / 2;
    const cy = r.y + 7;
    for (let i = 0; i < n; ++i) {
      drawBuildCard(i, cx, cy, cw, ch);
      cx += cw + gap;
    }
    endHudPanel();
  }

  function drawBuildCard(i, x, y, w, h) {
    const def = TOWER_TYPES[i];
    const id = 'build' + i;
    const selected = selectedTowerType === i;
    const afford = gold >= def.cost;
    const hover = hoverId === id;
    const press = pressAmount(id);
    const lift = (selected ? 3 : hover ? 1.5 : 0) - press * 2;
    ctx.save();
    roundRectPath(x, y - lift, w, h, 7);
    const g = ctx.createLinearGradient(0, y - lift, 0, y - lift + h);
    g.addColorStop(0, selected ? 'rgba(90,70,20,0.95)' : hover ? 'rgba(46,56,86,0.95)' : 'rgba(30,38,62,0.95)');
    g.addColorStop(1, selected ? 'rgba(40,28,8,0.95)' : 'rgba(12,16,30,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? UI.gold : hover ? 'rgba(255,215,90,0.55)' : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    if (selected) {
      roundRectPath(x - 2, y - lift - 2, w + 4, h + 4, 9);
      ctx.strokeStyle = `rgba(255,215,90,${0.35 + 0.25 * Math.sin(animTime * 5)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Icon
    const iconSize = Math.min(w - 10, h - 30);
    ctx.globalAlpha *= afford ? 1 : 0.5;
    drawTowerIcon(i, 1, x + w / 2, y - lift + 4 + iconSize / 2, iconSize);
    ctx.globalAlpha = afford ? ctx.globalAlpha : ctx.globalAlpha * 2;
    // Name and cost
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(def.name, x + w / 2, y - lift + h - 21, w - 6, 11, { weight: 'bold', color: afford ? UI.text : UI.textDim, minPx: 7 });
    fitText(`[[coin]]${def.cost}`, x + w / 2, y - lift + h - 8, w - 6, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad, minPx: 7 });
    const hk = towerHotkey(i);
    if (hk)
      drawKeycap(hk, x + 3, y - lift + 3, 9);
    ctx.restore();
    addRegion({
      id, x, y: y - lift, w, h, anchorTip: true,
      onClick: () => selectBuildType(i),
      tip: () => buildTooltip(i)
    });
  }

  function buildTooltip(i) {
    const def = TOWER_TYPES[i];
    const lines = [def.name + ' Tower', def.desc];
    lines.push('--- Stats ---');
    if (def.isFloorTrap)
      lines.push(`[[sword]] ${def.damage} damage per second to enemies on it`, 'Placed on the path');
    else {
      lines.push(`[[sword]] Damage ${def.damage}   [[range]] Range ${Math.round(def.range / CELL * 10) / 10} tiles`);
      lines.push(`[[clock]] Fires every ${def.fireRate}s`);
    }
    lines.push(gold >= def.cost ? `✔ Costs ${def.cost} gold` : `✘ Costs ${def.cost} gold (need ${def.cost - gold} more)`);
    const hk = towerHotkey(i);
    if (hk)
      lines.push(`• Hotkey ${hk}`);
    return lines;
  }

  function selectBuildType(i) {
    if (selectedTowerType === i) {
      selectedTowerType = -1;
      audio.play('click', { pitch: 0.8 });
      return;
    }
    selectedTowerType = i;
    selectedTower = null;
    audio.play('click');
  }

  /* ══════════════════════════════════════════════════════════════════
     INSPECTOR -- stats and actions of the selected tower
     ══════════════════════════════════════════════════════════════════ */

  const INSPECT_W = 236;

  function inspectorRect() {
    const t = selectedTower;
    const h = 236 + (t && t.hp < t.maxHp ? 34 : 0);
    // Stay clear of the tower: use the side of the screen away from it
    const p = t ? worldToUi(t.x, t.y) : { x: UW };
    const left = p.x > UW * 0.55;
    return { x: left ? 8 : UW - 8 - INSPECT_W, y: TOP_H + 4, w: INSPECT_W, h };
  }

  function drawInspector() {
    const t = selectedTower;
    if (!t || (state !== STATE_BUILD && state !== STATE_PLAYING)) return;
    const def = TOWER_TYPES[t.type];
    const r = inspectorRect();
    addRegion({ id: 'inspector-bg', x: r.x, y: r.y, w: r.w, h: r.h });
    beginHudPanel('inspector', r.x, r.y, r.w, r.h);
    let y = drawPanel(r.x, r.y, r.w, r.h, { title: def.name + ' Tower', titleRight: 'Tier ' + toRoman(t.tier), titleRightPad: 24, accent: UI.gold });
    uiButton('insp-close', r.x + r.w - 26, r.y + 6, 20, 18, '×', { px: 13, onClick: () => { selectedTower = null; }, tip: () => ['Close', 'Esc'] });

    // Portrait
    const px = r.x + 10, pw = 64;
    roundRectPath(px, y, pw, pw, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,215,90,0.35)';
    ctx.stroke();
    drawTowerIcon(t.type, t.tier, px + pw / 2, y + pw / 2, pw - 10);
    // Tier pips
    for (let i = 0; i < MAX_TIER; ++i) {
      ctx.fillStyle = i < t.tier ? UI.gold : 'rgba(255,255,255,0.15)';
      ctx.fillRect(px + 8 + i * ((pw - 16) / MAX_TIER), y + pw + 4, (pw - 16) / MAX_TIER - 3, 4);
    }

    // Stats
    const sx = px + pw + 10, sw = r.x + r.w - 10 - sx;
    const rows = towerStatRows(t);
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 8 + i * 17;
      ctx.textAlign = 'left';
      drawIcon(rows[i][0], sx + 7, ry, 13);
      fitText(rows[i][1], sx + 17, ry + 1, sw * 0.5 - 17, 11, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(rows[i][2], sx + sw, ry + 1, sw * 0.5, 12, { weight: 'bold', color: rows[i][3] || '#ffffff' });
    }
    y += pw + 14;

    // Description
    ctx.textAlign = 'left';
    drawTextBlock(def.desc, r.x + 12, y, r.w - 24, 30, 11, { color: '#c4cde0', valign: 'middle' });
    y += 34;

    // Health
    if (t.hp < t.maxHp) {
      const ratio = t.hp / t.maxHp;
      drawMeter(r.x + 12, y + 4, r.w - 24, 12, ratio, ratio > 0.5 ? UI.good : ratio > 0.25 ? UI.warn : UI.bad, { label: `Structure ${Math.ceil(ratio * 100)}%`, labelPx: 9 });
      y += 22;
    }

    // Actions
    const bw = r.w - 20;
    if (t.tier < MAX_TIER) {
      const uc = getUpgradeCost(t);
      uiButton('insp-up', r.x + 10, y, bw, 38, `Upgrade to Tier ${toRoman(t.tier + 1)}`, {
        style: 'gold', icon: 'up', key: 'U', sub: `${uc} gold`, disabled: gold < uc,
        onClick: () => upgradeTower(t), onDisabled: () => audio.play('error'),
        tip: () => upgradeTooltip(t)
      });
    } else
      uiButton('insp-up', r.x + 10, y, bw, 38, 'Maximum tier', { style: 'dark', icon: 'crown', disabled: true });
    y += 44;
    const half = (bw - 6) / 2;
    uiButton('insp-sell', r.x + 10, y, half, 30, `Sell +${getSellValue(t)}`, { style: 'red', key: 'S', px: 12, onClick: () => sellTower(t), tip: () => ['Sell tower', `Refunds ${getSellValue(t)} gold (half of everything spent).`] });
    const rc = repairCost(t);
    uiButton('insp-repair', r.x + 16 + half, y, half, 30, rc > 0 ? `Repair ${rc}` : 'Repaired', { style: 'green', key: 'R', px: 12, disabled: rc <= 0 || gold < rc, onClick: () => repairTower(t), onDisabled: () => rc > 0 && audio.play('error'), tip: () => ['Repair', rc > 0 ? `Restores the structure for ${rc} gold.` : 'The tower is undamaged.'] });
    endHudPanel();
  }

  function towerStatRows(t) {
    const def = TOWER_TYPES[t.type];
    const rows = [];
    if (def.isFloorTrap)
      return [['sword', 'Damage', `${t.damage}/s`]];
    rows.push(['sword', 'Damage', String(t.damage)]);
    rows.push(['range', 'Range', (t.range / CELL).toFixed(1)]);
    rows.push(['clock', 'Rate', `${(1 / t.fireRate).toFixed(2)}/s`]);
    rows.push(['skull', 'Kills', String(t.kills || 0)]);
    return rows;
  }

  function upgradeTooltip(t) {
    const def = TOWER_TYPES[t.type];
    const next = t.tier + 1;
    const dmg = Math.floor(def.damage * UPGRADE_DAMAGE_MULT[next - 1]);
    const rng = Math.floor(def.range * UPGRADE_RANGE_MULT[next - 1]);
    const uc = getUpgradeCost(t);
    return [`Upgrade to Tier ${toRoman(next)}`,
      `[[sword]] Damage ${t.damage} → ${dmg}`,
      `[[range]] Range ${(t.range / CELL).toFixed(1)} → ${(rng / CELL).toFixed(1)}`,
      gold >= uc ? `✔ ${uc} gold` : `✘ ${uc} gold (need ${uc - gold} more)`];
  }

  function repairCost(t) {
    return t.hp >= t.maxHp ? 0 : Math.max(1, Math.floor((t.maxHp - t.hp) * 0.3));
  }

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1] || String(n);
  }

  /* ══════════════════════════════════════════════════════════════════
     MAP OVERLAYS -- placement ghost, cursor, selection
     ══════════════════════════════════════════════════════════════════ */

  function cursorCell() {
    if (kbCursor.active)
      return { col: kbCursor.col, row: kbCursor.row };
    if (!pointer.inside || pointer.wx < 0 || pointer.wy < 0 || pointer.wx >= WORLD_W || pointer.wy >= WORLD_H)
      return null;
    if (regionAt(pointer.ux, pointer.uy) && !hudPassThrough(pointer.ux, pointer.uy))
      return null;
    return { col: Math.floor(pointer.wx / CELL), row: Math.floor(pointer.wy / CELL) };
  }

  function canBuildAt(typeIndex, col, row) {
    const def = TOWER_TYPES[typeIndex];
    return def.isFloorTrap ? canPlaceSpike(col, row) : canPlace(col, row);
  }

  function towerAt(col, row) {
    for (const t of towers)
      if (t.col === col && t.row === row)
        return t;
    return null;
  }

  function drawMapOverlays() {
    const c = cursorCell();
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 6);
    // Selected tower: range and brackets
    if (selectedTower) {
      const t = selectedTower;
      ctx.fillStyle = 'rgba(255,215,90,0.06)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,90,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -animTime * 12;
      ctx.stroke();
      ctx.setLineDash([]);
      drawBrackets(t.col * CELL, t.row * CELL, CELL, UI.gold, 2 + pulse * 1.5);
    }
    if (!c || (state !== STATE_BUILD && state !== STATE_PLAYING)) return;
    if (selectedTowerType >= 0) {
      const def = TOWER_TYPES[selectedTowerType];
      const ok = canBuildAt(selectedTowerType, c.col, c.row) && !towerAt(c.col, c.row);
      const afford = gold >= def.cost;
      const cx = c.col * CELL + CELL / 2, cy = c.row * CELL + CELL / 2;
      const good = ok && afford;
      ctx.fillStyle = good ? 'rgba(80,255,120,0.18)' : 'rgba(255,70,70,0.22)';
      ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
      if (def.range > 0 && ok) {
        ctx.fillStyle = good ? 'rgba(120,255,150,0.07)' : 'rgba(255,120,120,0.06)';
        ctx.beginPath();
        ctx.arc(cx, cy, def.range, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = good ? 'rgba(140,255,170,0.6)' : 'rgba(255,140,140,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (ok) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawTowerIconWorld(selectedTowerType, 1, cx, cy);
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(255,90,90,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
        ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
        ctx.stroke();
      }
      drawBrackets(c.col * CELL, c.row * CELL, CELL, good ? '#8fff9f' : '#ff7a7a', 1.5 + pulse);
    } else if (kbCursor.active || towerAt(c.col, c.row)) {
      drawBrackets(c.col * CELL, c.row * CELL, CELL, kbCursor.active ? '#ffffff' : 'rgba(255,255,255,0.7)', 1 + pulse);
    }
  }

  function drawBrackets(x, y, s, color, inset) {
    const l = s * 0.3;
    const i = -inset;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + i, y + i + l); ctx.lineTo(x + i, y + i); ctx.lineTo(x + i + l, y + i);
    ctx.moveTo(x + s - i - l, y + i); ctx.lineTo(x + s - i, y + i); ctx.lineTo(x + s - i, y + i + l);
    ctx.moveTo(x + s - i, y + s - i - l); ctx.lineTo(x + s - i, y + s - i); ctx.lineTo(x + s - i - l, y + s - i);
    ctx.moveTo(x + i + l, y + s - i); ctx.lineTo(x + i, y + s - i); ctx.lineTo(x + i, y + s - i - l);
    ctx.stroke();
  }

  function enemyAtPointer() {
    if (!pointer.inside) return null;
    let best = null, bd = 1e9;
    for (const e of enemies) {
      const d = Math.hypot(e.x - pointer.wx, e.y - pointer.wy);
      if (d < e.radius + 6 && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  const ENEMY_NAMES = { normal: 'Grunt', fast: 'Runner', armored: 'Brute', flying: 'Bat', boss: 'Warlord', healer: 'Shaman', swarm: 'Swarmling', shield: 'Warden' };

  function enemyTooltip(e) {
    const lines = [ENEMY_NAMES[e.type] || e.type, `HP ${Math.ceil(e.hp)} / ${e.maxHp}`, `Speed ${Math.round(e.baseSpeed)}   Bounty ${e.bounty} gold`];
    if (e.isShielded && e.shieldHp > 0) lines.push(`[[shield]] Shield ${Math.ceil(e.shieldHp)}`);
    if (e.isHealer) lines.push('⚠ Heals nearby enemies');
    if (e.isBoss) lines.push('⚠ Boss: damages nearby towers');
    return lines;
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREENS -- title, pause, game over, victory, help
     ══════════════════════════════════════════════════════════════════ */

  function drawTitleScreen() {
    drawScrim(0.55);
    const cx = UW / 2;
    const top = Math.max(40, UH * 0.16);
    drawHeadline('TOWER DEFENSE', cx, top, UW - 60, 64, UI.gold, '#ff9a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('Hold the line. Build, upgrade, survive every wave.', cx, top + 44, UW - 80, 15, { color: UI.textDim });

    const pw = Math.min(380, UW - 40), ph = savedGameInfo ? 222 : 172;
    const px = cx - pw / 2, py = Math.min(top + 74, UH - ph - 50);
    drawPanel(px, py, pw, ph, { accent: UI.gold, radius: 12 });
    let y = py + 16;
    // Map chooser
    const m = MAPS[currentMap];
    uiButton('map-prev', px + 14, y, 34, 34, '◀', { px: 14, onClick: () => cycleTitleMap(-1), tip: () => ['Previous map', '←'] });
    uiButton('map-next', px + pw - 48, y, 34, 34, '▶', { px: 14, onClick: () => cycleTitleMap(1), tip: () => ['Next map', '→'] });
    ctx.textAlign = 'center';
    fitText(m.name, cx, y + 10, pw - 120, 17, { weight: 'bold', color: '#ffffff' });
    fitText(`${m.waves} waves · ${m.startGold} gold · ${m.startLives} lives`, cx, y + 27, pw - 120, 11, { color: UI.textDim });
    y += 48;
    const bw = pw - 40;
    if (savedGameInfo) {
      const sm = MAPS[savedGameInfo.map];
      uiButton('title-continue', px + 20, y, bw, 50, 'Continue', { style: 'gold', icon: 'play', px: 17, key: 'Enter', sub: `${sm.name} · wave ${savedGameInfo.wave} of ${savedGameInfo.waves}`, onClick: () => continueSavedGame() });
      y += 58;
      uiButton('title-new', px + 20, y, bw, 40, 'New Game', { style: 'dark', px: 14, key: 'N', onClick: () => requestNewGame(), tip: () => ['New game', `Starts ${m.name} from wave 1.`, '⚠ Replaces the saved game'] });
      y += 48;
    } else {
      uiButton('title-start', px + 20, y, bw, 50, 'Start', { style: 'gold', icon: 'play', px: 17, key: 'Enter', sub: m.name, onClick: () => requestNewGame() });
      y += 58;
    }
    uiButton('title-help', px + 20, y, bw, 36, 'How to play', { style: 'blue', icon: 'help', px: 13, key: 'H', onClick: () => openHelp() });
    if (saveNotice) {
      ctx.textAlign = 'center';
      fitText(saveNotice, cx, py + ph + 18, UW - 40, 12, { color: UI.warn });
    }
    drawKeyHints([{ key: '←→', label: 'Map' }, { key: 'Enter', label: savedGameInfo ? 'Continue' : 'Start' }, { key: 'H', label: 'Help' }], cx, UH - 22, UW - 40);
  }

  function cycleTitleMap(dir) {
    currentMap = (currentMap + dir + MAPS.length) % MAPS.length;
    loadMapPreview();
    audio.play('click');
  }

  function drawPauseScreen() {
    drawScrim(0.6);
    const pw = Math.min(320, UW - 40), ph = 262;
    const px = UW / 2 - pw / 2, py = UH / 2 - ph / 2;
    drawPanel(px, py, pw, ph, { title: 'Paused', titleRight: `${MAPS[currentMap].name} · wave ${currentWave}/${totalWaves}`, accent: UI.gold, radius: 12 });
    let y = py + 44;
    const bw = pw - 40;
    uiButton('p-resume', px + 20, y, bw, 42, 'Resume', { style: 'gold', icon: 'play', key: 'Esc', px: 15, onClick: togglePause });
    y += 50;
    uiButton('p-help', px + 20, y, bw, 36, 'Help', { style: 'blue', icon: 'help', key: 'H', onClick: () => openHelp() });
    y += 44;
    uiButton('p-restart', px + 20, y, bw, 36, 'Restart map', { style: 'dark', key: 'F2', onClick: () => requestNewGame(), tip: () => ['Restart', 'Starts this map again from wave 1.'] });
    y += 44;
    uiButton('p-title', px + 20, y, bw, 36, 'Main menu', { style: 'dark', key: 'M', onClick: quitToTitle, tip: () => ['Main menu', 'Your game is saved; Continue picks it up again.'] });
  }

  function drawEndScreen(victory) {
    drawScrim(0.62);
    const cx = UW / 2;
    const pw = Math.min(420, UW - 40), ph = victory ? 270 : 220;
    const px = cx - pw / 2, py = Math.max(80, UH / 2 - ph / 2 + 20);
    drawHeadline(victory ? 'VICTORY' : 'DEFEAT', cx, py - 40, UW - 40, 56, victory ? UI.gold : '#ff5a5a', victory ? '#ff9a2a' : '#9a1a1a');
    drawPanel(px, py, pw, ph, { title: MAPS[currentMap].name, titleRight: victory ? 'Map cleared' : `Fell at wave ${currentWave}`, accent: victory ? UI.gold : UI.bad, radius: 12 });
    const stats = [
      ['flag', 'Waves survived', `${victory ? currentWave : Math.max(0, currentWave - 1)} / ${totalWaves}`],
      ['skull', 'Enemies defeated', String(runStats.kills)],
      ['coin', 'Gold earned', String(runStats.gold)],
      ['heart', 'Lives left', `${lives} / ${MAPS[currentMap].startLives}`]
    ];
    let y = py + 48;
    for (const [icon, label, value] of stats) {
      drawIcon(icon, px + 30, y + 9, 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, px + 46, y + 10, pw * 0.5, 13, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(value, px + pw - 24, y + 10, pw * 0.35, 15, { weight: 'bold', color: '#ffffff' });
      y += 26;
    }
    y += 12;
    const bw = (pw - 52) / 2;
    if (victory) {
      uiButton('end-next', px + 20, y, bw, 44, 'Next map', { style: 'gold', icon: 'play', key: 'Enter', px: 14, onClick: () => { currentMap = (currentMap + 1) % MAPS.length; resetAndStart(); } });
      uiButton('end-retry', px + 32 + bw, y, bw, 44, 'Play again', { style: 'dark', key: 'R', px: 14, onClick: resetAndStart });
    } else {
      uiButton('end-retry', px + 20, y, bw, 44, 'Try again', { style: 'gold', icon: 'play', key: 'Enter', px: 14, onClick: resetAndStart });
      uiButton('end-title', px + 32 + bw, y, bw, 44, 'Main menu', { style: 'dark', key: 'M', px: 14, onClick: quitToTitle });
    }
    if (victory)
      uiButton('end-title2', px + 20, y + 52, pw - 40, 30, 'Main menu', { style: 'dark', key: 'M', px: 12, onClick: quitToTitle });
  }

  /* ── Help pages ── */
  const HELP_PAGES = [
    { title: 'Basics', body: [
      ['flag', 'Enemies walk the path from the green spawn gate to the red exit. Each one that gets through costs a life; lose them all and the map is lost.'],
      ['hammer', 'Pick a tower in the build bar (or press 1-0), then click a free tile next to the path. Spike traps go on the path itself.'],
      ['up', 'Click a tower to inspect it: upgrade it, repair it or sell it for half of what it cost.'],
      ['coin', 'Defeated enemies drop gold. Every wave also pays a small bonus.'],
      ['play', 'Press Start Wave (Space) when you are ready. Speed buttons run the battle 2× or 3× as fast; AUTO sends waves on its own.']
    ] },
    { title: 'Towers', towers: true },
    { title: 'Enemies', enemies: true },
    { title: 'Controls', keys: [
      ['1 - 0', 'Choose a tower to build'], ['Click / Enter', 'Build or select'], ['Right click / Esc', 'Cancel building'],
      ['Arrow keys', 'Move the build cursor'], ['U', 'Upgrade the selected tower'], ['S', 'Sell the selected tower'], ['R', 'Repair the selected tower'],
      ['Space', 'Start the next wave'], ['F', 'Cycle game speed'], ['A', 'Auto-wave on/off'], ['H', 'Help'], ['Esc', 'Pause menu'], ['F2', 'New game']
    ] }
  ];

  function openHelp(page) {
    if (state === STATE_PLAYING)
      togglePause();
    overlay = 'help';
    helpPage = page || 0;
    audio.play('select');
  }

  function closeHelp() {
    overlay = null;
    audio.play('click', { pitch: 0.8 });
  }

  function drawHelp() {
    drawScrim(0.7);
    const pw = Math.min(720, UW - 32), ph = Math.min(500, UH - 32);
    const px = UW / 2 - pw / 2, py = UH / 2 - ph / 2;
    drawPanel(px, py, pw, ph, { title: 'How to play', titleRight: `${helpPage + 1} / ${HELP_PAGES.length}`, titleRightPad: 28, accent: UI.gold, radius: 12, headerH: 34 });
    uiButton('help-close', px + pw - 30, py + 7, 22, 20, '×', { px: 14, onClick: closeHelp, tip: () => ['Close', 'Esc'] });
    // Tabs
    const tabW = Math.min(150, (pw - 24 - (HELP_PAGES.length - 1) * 6) / HELP_PAGES.length);
    for (let i = 0; i < HELP_PAGES.length; ++i)
      uiButton('help-tab' + i, px + 12 + i * (tabW + 6), py + 42, tabW, 28, HELP_PAGES[i].title, { style: i === helpPage ? 'gold' : 'dark', px: 12, onClick: () => { helpPage = i; audio.play('click'); } });
    const cx = px + 16, cy = py + 82, cw = pw - 32, ch = ph - 82 - 40;
    const page = HELP_PAGES[helpPage];
    if (page.body) {
      const rowH = Math.min(62, ch / page.body.length);
      page.body.forEach(([icon, text], i) => {
        const y = cy + i * rowH;
        roundRectPath(cx, y + 2, 36, 36, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        drawIcon(icon, cx + 18, y + 20, 22);
        drawTextBlock(text, cx + 48, y, cw - 48, rowH - 6, 13, { color: UI.text, valign: 'middle' });
      });
    } else if (page.towers) {
      drawHelpGrid(cx, cy, cw, ch, TOWER_TYPES.map((def, i) => ({ draw: (x, y, s) => drawTowerIcon(i, 1, x, y, s), name: def.name, text: `${def.desc} · ${def.cost} gold` })));
    } else if (page.enemies) {
      drawHelpGrid(cx, cy, cw, ch, Object.keys(ENEMY_TYPES).map(k => ({ draw: (x, y, s) => drawEnemyIcon(k, x, y, s), name: ENEMY_NAMES[k], text: ENEMY_INFO[k] })));
    } else if (page.keys) {
      const cols = cw > 520 ? 2 : 1;
      const perCol = Math.ceil(page.keys.length / cols);
      const colW = cw / cols;
      const rowH = Math.min(30, ch / perCol);
      page.keys.forEach(([key, label], i) => {
        const col = Math.floor(i / perCol), row = i % perCol;
        const x = cx + col * colW, y = cy + row * rowH;
        ctx.font = uiFont(11, 'bold');
        const kw = Math.min(colW * 0.45, Math.max(26, ctx.measureText(key).width + 12));
        roundRectPath(x, y + 3, kw, rowH - 8, 4);
        ctx.fillStyle = 'rgba(20,26,42,0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,90,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(key, x + kw / 2, y + rowH / 2 - 1, kw - 6, 11, { weight: 'bold', color: '#ffe9a8' });
        ctx.textAlign = 'left';
        fitText(label, x + kw + 10, y + rowH / 2, colW - kw - 18, 13, { color: UI.text });
      });
    }
    drawKeyHints([{ key: '←→', label: 'Page' }, { key: 'Esc', label: 'Close' }], UW / 2, py + ph - 18, pw - 40);
  }

  function drawHelpGrid(x, y, w, h, items) {
    const cols = w > 560 ? 3 : 2;
    const rowsN = Math.ceil(items.length / cols);
    const cellW = (w - (cols - 1) * 8) / cols;
    const cellH = Math.min(70, (h - (rowsN - 1) * 6) / rowsN);
    items.forEach((it, i) => {
      const cx = x + (i % cols) * (cellW + 8), cy = y + Math.floor(i / cols) * (cellH + 6);
      roundRectPath(cx, cy, cellW, cellH, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      const s = Math.min(cellH - 10, 40);
      it.draw(cx + 6 + s / 2, cy + cellH / 2, s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(it.name, cx + s + 14, cy + 13, cellW - s - 20, 13, { weight: 'bold', color: UI.gold });
      drawTextBlock(it.text, cx + s + 14, cy + 22, cellW - s - 20, cellH - 25, 11, { color: '#c4cde0' });
    });
  }

  const ENEMY_INFO = {
    normal: 'Basic foot soldier.',
    fast: 'Quick and fragile. Slow it down.',
    armored: 'Lots of health; damages nearby towers.',
    flying: 'Flies along the route.',
    boss: 'Huge health; damages nearby towers.',
    healer: 'Heals nearby enemies. Kill it first.',
    swarm: 'Comes in packs. Use splash damage.',
    shield: 'Its shield soaks damage first.'
  };

  /* ══════════════════════════════════════════════════════════════════
     ICON HELPERS -- towers and enemies drawn into UI boxes
     ══════════════════════════════════════════════════════════════════ */

  function drawTowerIcon(typeIndex, tier, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / 30;
    ctx.scale(k, k);
    drawTowerShape(TOWER_TYPES[typeIndex], tier, -Math.PI / 4);
    ctx.restore();
  }

  function drawTowerIconWorld(typeIndex, tier, x, y) {
    ctx.save();
    ctx.translate(x, y);
    drawTowerShape(TOWER_TYPES[typeIndex], tier, -Math.PI / 4);
    ctx.restore();
  }

  function drawEnemyIcon(type, cx, cy, size) {
    const def = ENEMY_TYPES[type];
    const fake = { type, color: def.color, radius: def.radius, shieldHp: def.shielded ? 1 : 0, maxHp: 2.5 };
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / ((def.radius + 5) * 2);
    ctx.scale(k, k);
    drawEnemyShape(fake, 0);
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     FRAME
     ══════════════════════════════════════════════════════════════════ */

  function drawWorld() {
    setWorldTransform();
    // Frame around the battlefield
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-6, -4, WORLD_W + 12, WORLD_H + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
    drawGrid();
    if (state !== STATE_READY) {
      drawPathVisualization();
      drawFloorEffects();
      drawPreWaveWarning();
      drawMapOverlays();
      drawTowers();
      drawEnemies();
      drawProjectiles();
      particles.draw(ctx);
      floatingText.draw(ctx);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,215,90,0.35)';
    ctx.lineWidth = 2 / view.s;
    ctx.strokeRect(-1, -1, WORLD_W + 2, WORLD_H + 2);
  }

  function drawFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld();

    setUiTransform();
    regions = [];
    if (state === STATE_READY) {
      drawTitleScreen();
    } else {
      drawTopBar();
      drawBuildBar();
      drawInspector();
      // Modal screens: the HUD underneath stops reacting
      if (state === STATE_PAUSED && !overlay) {
        regions = [];
        drawPauseScreen();
      } else if (state === STATE_GAME_OVER || state === STATE_VICTORY) {
        regions = [];
        drawEndScreen(state === STATE_VICTORY);
      }
    }
    if (overlay === 'help') {
      regions = [];
      drawHelp();
    }
    drawTooltip();
    prevRegions = regions;
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusWave) statusWave.textContent = `Wave: ${currentWave}/${totalWaves}`;
    if (statusGold) statusGold.textContent = `Gold: ${gold}`;
    if (statusLives) statusLives.textContent = `Lives: ${lives}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    frameDt = dt || 0.016;
    ++frameNo;

    if (!overlay)
      updateGame(dt);
    else
      animTime += dt;

    particles.update();
    floatingText.update();
    updateShake(dt);
    shownGold += (gold - shownGold) * (1 - Math.exp(-dt * 10));
    if (Math.abs(gold - shownGold) < 0.5)
      shownGold = gold;
    goldPulse = Math.max(0, goldPulse - dt * 3);
    livesPulse = Math.max(0, livesPulse - dt * 2.5);
    updateTooltip(dt);
    updateHover();

    drawFrame();
    updateStatusBar();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function togglePause() {
    if (state === STATE_PLAYING || state === STATE_BUILD) {
      pausedFrom = state;
      state = STATE_PAUSED;
      saveGame();
      audio.play('click', { pitch: 0.7 });
    } else if (state === STATE_PAUSED) {
      state = pausedFrom || STATE_PLAYING;
      audio.play('click');
    }
  }
  let pausedFrom = null;

  /* Save when the page is hidden or closed */
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveGame();
  });

  /* Pause when the window is hidden */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: togglePause
  });

  function resetAndStart() {
    overlay = null;
    loadMap(currentMap);
    audio.play('select');
  }

  function quitToTitle() {
    if (isInGameState())
      saveGame();
    overlay = null;
    selectedTower = null;
    state = STATE_READY;
    refreshSavedGameInfo();
    loadMapPreview();
    updateWindowTitle();
  }

  // Shows the chosen map behind the title screen
  function loadMapPreview() {
    const mapDef = MAPS[currentMap];
    buildPathCells(mapDef);
    pathPoints = getPathPoints(mapDef);
    totalWaves = mapDef.waves;
  }

  function setGameSpeed(s) {
    gameSpeed = s;
    audio.play('click', { pitch: 0.8 + s * 0.15 });
  }

  function toggleFastForward() {
    setGameSpeed(gameSpeed >= 3 ? 1 : gameSpeed + 1);
  }

  function toggleAutoWave() {
    autoWaveMode = !autoWaveMode;
    if (autoWaveMode && state === STATE_BUILD && waveComplete)
      autoWaveTimer = AUTO_WAVE_DELAY;
    audio.play('click', { pitch: autoWaveMode ? 1.2 : 0.8 });
  }

  // Click or Enter on a map cell
  function mapAction(col, row) {
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;
    const t = towerAt(col, row);
    if (selectedTowerType >= 0) {
      if (t) {
        selectedTowerType = -1;
        selectedTower = t;
        audio.play('select');
        return;
      }
      if (!placeTower(col, row, selectedTowerType))
        audio.play('error');
      return;
    }
    if (t) {
      selectedTower = selectedTower === t ? null : t;
      audio.play('select');
      return;
    }
    selectedTower = null;
  }

  function cancelBuild() {
    if (selectedTowerType >= 0) {
      selectedTowerType = -1;
      audio.play('click', { pitch: 0.7 });
      return true;
    }
    if (selectedTower) {
      selectedTower = null;
      return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT -- mouse, touch and keyboard
     ══════════════════════════════════════════════════════════════════ */

  function readPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.px = (e.clientX - rect.left) * (canvasW / rect.width);
    pointer.py = (e.clientY - rect.top) * (canvasH / rect.height);
    pointer.ux = pointer.px / uiS;
    pointer.uy = pointer.py / uiS;
    pointer.wx = (pointer.px - view.x) / view.s;
    pointer.wy = (pointer.py - view.y) / view.s;
    pointer.inside = true;
    pointer.type = e.pointerType || 'mouse';
  }

  function updateHover() {
    const r = pointer.inside ? regionAt(pointer.ux, pointer.uy) : null;
    const id = r && !r.disabled ? r.id : null;
    if (id !== hoverId) {
      hoverId = id;
      canvas.style.cursor = id && r.onClick ? 'pointer' : 'default';
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    readPointer(e);
    kbCursor.active = false;
  });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  let touchPending = null;   // first tap of a touch placement: { col, row }

  canvas.addEventListener('pointerdown', (e) => {
    readPointer(e);
    kbCursor.active = false;
    if (e.button === 2) return;
    const r = regionAt(pointer.ux, pointer.uy);
    if (r && !hudPassThrough(pointer.ux, pointer.uy)) {
      if (r.disabled) {
        if (r.onDisabled) r.onDisabled();
        return;
      }
      if (r.onClick) {
        pressFx[r.id] = performance.now();
        if (r.sound !== false && !/^build/.test(r.id))
          audio.play('click');
        r.onClick();
      }
      return;
    }
    if (overlay) return;
    if (state === STATE_PAUSED) return;
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;
    if (pointer.wx < 0 || pointer.wy < 0 || pointer.wx >= WORLD_W || pointer.wy >= WORLD_H) {
      cancelBuild();
      return;
    }
    const col = Math.floor(pointer.wx / CELL), row = Math.floor(pointer.wy / CELL);
    // Touch: the first tap shows the ghost, a second tap on the same tile builds
    if (pointer.type === 'touch' && selectedTowerType >= 0 && !towerAt(col, row)) {
      if (!touchPending || touchPending.col !== col || touchPending.row !== row) {
        touchPending = { col, row };
        kbCursor.col = col;
        kbCursor.row = row;
        kbCursor.active = true;
        return;
      }
      touchPending = null;
    }
    mapAction(col, row);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    readPointer(e);
    if (overlay || (state !== STATE_BUILD && state !== STATE_PLAYING)) return;
    if (cancelBuild()) return;
    const col = Math.floor(pointer.wx / CELL), row = Math.floor(pointer.wy / CELL);
    const t = towerAt(col, row);
    if (t) {
      selectedTower = t;
      audio.play('select');
      return;
    }
    // Right-click on a spike trap sells it
    const spike = floorEffects.find(fe => fe.col === col && fe.row === row && fe.type === 'spike');
    if (spike) {
      const refund = Math.floor(spike.cost * 0.5);
      gold += refund;
      floatingText.add(spike.x, spike.y - 16, `+${refund}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
      particles.burst(spike.x, spike.y, 6, { color: '#aaa', speed: 2, life: 0.3 });
      audio.play('coin');
      floorEffects.splice(floorEffects.indexOf(spike), 1);
    }
  });

  function moveCursor(dc, dr) {
    if (!kbCursor.active) {
      const c = selectedTower ? { col: selectedTower.col, row: selectedTower.row } : { col: kbCursor.col, row: kbCursor.row };
      kbCursor.col = c.col;
      kbCursor.row = c.row;
      kbCursor.active = true;
    } else {
      kbCursor.col = clamp(kbCursor.col + dc, 0, COLS - 1);
      kbCursor.row = clamp(kbCursor.row + dr, 0, ROWS - 1);
    }
    audio.play('click', { pitch: 1.6, volume: 0.4 });
  }

  window.addEventListener('keydown', (e) => {
    // Leave keys to an open dialog
    if (document.querySelector('.dialog-overlay.visible'))
      return;
    const code = e.code;

    if (code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    if (overlay === 'help') {
      if (code === 'Escape' || code === 'KeyH') closeHelp();
      else if (code === 'ArrowRight' || code === 'Tab') { helpPage = (helpPage + 1) % HELP_PAGES.length; audio.play('click'); }
      else if (code === 'ArrowLeft') { helpPage = (helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length; audio.play('click'); }
      e.preventDefault();
      return;
    }

    if (code === 'KeyH') {
      e.preventDefault();
      openHelp();
      return;
    }

    if (state === STATE_READY) {
      if (code === 'Enter' || code === 'Space' || code === 'KeyC') {
        e.preventDefault();
        if (savedGameInfo) continueSavedGame();
        else requestNewGame();
      } else if (code === 'KeyN') {
        e.preventDefault();
        requestNewGame();
      } else if (code === 'ArrowLeft' || code === 'ArrowRight') {
        e.preventDefault();
        cycleTitleMap(code === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }

    if (state === STATE_GAME_OVER || state === STATE_VICTORY) {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        if (state === STATE_VICTORY)
          currentMap = (currentMap + 1) % MAPS.length;
        resetAndStart();
      } else if (code === 'KeyR') {
        resetAndStart();
      } else if (code === 'KeyM' || code === 'Escape') {
        quitToTitle();
      }
      return;
    }

    if (state === STATE_PAUSED) {
      if (code === 'Escape' || code === 'Space' || code === 'Enter') {
        e.preventDefault();
        togglePause();
      } else if (code === 'KeyM') {
        quitToTitle();
      }
      return;
    }

    if (code === 'Escape') {
      e.preventDefault();
      if (!cancelBuild())
        togglePause();
      return;
    }

    if (code === 'Space') {
      e.preventDefault();
      if (state === STATE_BUILD)
        startNextWave();
      else if (state === STATE_PLAYING)
        toggleFastForward();
      return;
    }

    if (code === 'KeyF') {
      toggleFastForward();
      return;
    }

    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[code]) {
      e.preventDefault();
      moveCursor(arrows[code][0], arrows[code][1]);
      return;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      e.preventDefault();
      if (kbCursor.active)
        mapAction(kbCursor.col, kbCursor.row);
      return;
    }

    // Tower type selection (1-9, 0 for the 10th)
    if (/^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)) {
      const n = parseInt(code.slice(-1), 10);
      const idx = n === 0 ? 9 : n - 1;
      if (idx < TOWER_TYPES.length)
        selectBuildType(idx);
      return;
    }

    if (code === 'KeyU' && selectedTower) {
      if (!upgradeTower(selectedTower))
        audio.play('error');
      else
        pressFx['insp-up'] = performance.now();
      return;
    }

    if (code === 'KeyS' && selectedTower) {
      sellTower(selectedTower);
      return;
    }

    if (code === 'KeyR' && selectedTower) {
      if (!repairTower(selectedTower))
        audio.play('error');
      return;
    }

    if (code === 'KeyA')
      toggleAutoWave();
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        requestNewGame();
        break;
      case 'pause':
        togglePause();
        break;
      case 'auto-wave':
        toggleAutoWave();
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
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const mapName = MAPS[currentMap]?.name || '';
    const title = state === STATE_READY
      ? 'Tower Defense'
      : state === STATE_VICTORY
        ? `Tower Defense -- ${mapName} Victory!`
        : state === STATE_GAME_OVER
          ? `Tower Defense -- ${mapName} Game Over`
          : `Tower Defense -- ${mapName} Wave ${currentWave}/${totalWaves}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
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

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadHighScores();
  refreshSavedGameInfo();
  if (savedGameInfo)
    currentMap = savedGameInfo.map;
  loadMapPreview();
  updateWindowTitle();
  audio.attachMuteButton();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
