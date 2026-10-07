;(function() {
  'use strict';

  const { User32 } = SZ.Dlls || {};
  const { ParticleSystem, ScreenShake, FloatingText } = SZ.GameEffects;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const STORAGE_KEY = 'sz-space-invaders-high-scores';
  const SAVE_KEY = 'sz-space-invaders-save-v2';
  const MAX_HIGH_SCORES = 10;

  const GAME_W = 1280;
  const GAME_H = 720;

  const ALIEN_W = 36;
  const ALIEN_H = 27;
  const ALIEN_PAD_X = 18;
  const ALIEN_PAD_Y = 15;

  const PLAYER_W = 45;
  const PLAYER_H = 24;
  const PLAYER_SPEED = 6;
  const PLAYER_Y_OFFSET = 60;

  const BULLET_W = 4;
  const BULLET_H = 15;
  const BULLET_SPEED = 10.5;
  const LASER_W = 9;

  const ALIEN_BULLET_SPEED = 4.5;
  const ALIEN_BULLET_W = 4;
  const ALIEN_BULLET_H = 18;

  const SHIELD_COUNT = 5;
  const SHIELD_BLOCK_SIZE = 6;
  const SHIELD_COLS = 16;
  const SHIELD_ROWS = 12;
  const SHIELD_Y_OFFSET = 120;

  const UFO_W = 48;
  const UFO_H = 21;
  const UFO_SPEED = 3;
  const UFO_MIN_INTERVAL = 10000;
  const UFO_MAX_INTERVAL = 25000;

  const BOSS_W = 180;
  const BOSS_H = 90;
  /* The painted boss art is a fixed 120 x 60 box, scaled up into the boss box */
  const BOSS_SPRITE_W = 120;
  const BOSS_SPRITE_H = 60;
  const BOSS_ESCORT_MIN_Y = 280;
  const BOSS_BASE_HP = 15;
  const BOSS_HP_PER_BOSS = 5;

  const DRONE_W = 24;
  const DRONE_H = 15;
  const DRONE_SHOOT_INTERVAL = 800;

  const ALIEN_DROP = 18;
  const BASE_MOVE_INTERVAL = 800;
  const MIN_MOVE_INTERVAL = 60;

  const POWERUP_SIZE = 24;
  const POWERUP_FALL_SPEED = 1.8;
  const POWERUP_DROP_CHANCE = 0.08;
  const POWERUP_DROP_CHANCE_SPECIAL = 0.20;

  const COMBO_TIMEOUT = 1500;
  const COMBO_MULTIPLIERS = [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5];

  /* ================================================================
   *  ALIEN TYPE INFO
   * ================================================================ */

  const ALIEN_TYPE_INFO = [
    null,
    { points: 30, color: '#f44', drawIndex: 0 },
    { points: 20, color: '#ff4', drawIndex: 1 },
    { points: 10, color: '#4f4', drawIndex: 2 },
    { points: 50, color: '#f80', drawIndex: 0 },
    { points: 40, color: '#4ff', drawIndex: 1 },
    { points: 60, color: '#9aa6c0', drawIndex: 2 },
  ];

  /* Death cry pitch per species, so the fleet sounds different kill by kill */
  const SPECIES_DEATH_PITCH = { 1: 1.2, 2: 1.05, 3: 0.95, 4: 1.3, 5: 1.1, 6: 0.8 };

  /* ================================================================
   *  POWER-UP DEFINITIONS
   * ================================================================ */

  const POWERUPS = [
    { id: 'tripleShot', name: 'Triple Shot', abbr: 'TRI', color: '#0ff', duration: 8000, weight: 20 },
    { id: 'rapidFire', name: 'Rapid Fire', abbr: 'RPD', color: '#ff0', duration: 6000, weight: 20 },
    { id: 'shield', name: 'Shield', abbr: 'SHD', color: '#88f', duration: 5000, weight: 12 },
    { id: 'laser', name: 'Laser', abbr: 'LAS', color: '#f0f', duration: 4000, weight: 10 },
    { id: 'slowMo', name: 'Slow-Mo', abbr: 'SLO', color: '#aaf', duration: 5000, weight: 15 },
    { id: 'extraLife', name: 'Extra Life', abbr: '+HP', color: '#f88', duration: 0, weight: 5 },
    { id: 'bomb', name: 'Bomb', abbr: 'BOM', color: '#fa0', duration: 0, weight: 5 },
    { id: 'drone', name: 'Drone', abbr: 'DRN', color: '#8f8', duration: 10000, weight: 13 },
  ];

  const TOTAL_POWERUP_WEIGHT = POWERUPS.reduce((s, p) => s + p.weight, 0);

  function pickRandomPowerup() {
    let r = rand() * TOTAL_POWERUP_WEIGHT;
    for (const p of POWERUPS) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return POWERUPS[0];
  }

  /* ================================================================
   *  WAVE FORMATIONS
   * ================================================================ */

  const FORMATIONS = [
    { name: 'Classic Grid', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'V-Formation', grid: [
      [1,0,0,0,0,0,0,0,0,0,1],
      [2,2,0,0,0,0,0,0,0,2,2],
      [0,2,2,0,0,0,0,0,2,2,0],
      [0,0,3,3,0,0,0,3,3,0,0],
      [0,0,0,3,3,0,3,3,0,0,0],
    ]},
    { name: 'Diamond Strike', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,2,2,2,2,2,2,2,2,2,0],
      [0,0,0,3,3,3,3,3,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
    ]},
    { name: 'Arrow Assault', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,0,3,3,3,3,3,3,3,0,0],
      [0,3,3,0,0,0,0,0,3,3,0],
    ]},
    { name: 'Cross Attack', grid: [
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,0,0,3,3,3,0,0,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { name: 'Zigzag', grid: [
      [1,1,0,1,1,0,1,1,0,1,1],
      [0,2,2,0,2,2,0,2,2,0,0],
      [2,0,2,2,0,2,2,0,2,2,0],
      [0,3,0,3,3,0,3,3,0,3,3],
      [3,3,3,0,3,3,0,3,3,0,3],
    ]},
    { name: 'Fortress', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,2,0,0,0,0,0,2,0,0],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,0,0,0,3,3,3,0,0,0,3],
    ]},
    { name: 'Wings', grid: [
      [1,1,0,0,0,0,0,0,0,1,1],
      [2,2,2,0,0,0,0,0,2,2,2],
      [0,2,2,2,0,0,0,2,2,2,0],
      [0,0,3,3,3,0,3,3,3,0,0],
      [0,0,0,3,3,3,3,3,0,0,0],
    ]},
    { name: 'Scatter', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,0,3,0,3,0,3,0,3,0,3],
    ]},
    { name: 'Phalanx', grid: [
      [5,1,1,1,1,1,1,1,1,1,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [4,2,2,2,4,2,4,2,2,2,4],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Diver Squadron', grid: [
      [4,0,4,0,4,0,4,0,4,0,4],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Shield Wall', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [5,5,5,5,5,5,5,5,5,5,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
  ];

  const BOSS_ESCORTS = [
    { grid: [
      [0,0,2,0,2,0,2,0,2,0,0],
      [0,0,0,3,0,3,0,3,0,0,0],
    ]},
    { grid: [
      [0,4,0,0,0,0,0,0,0,4,0],
      [0,0,2,2,0,0,0,2,2,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { grid: [
      [5,0,0,5,0,0,0,5,0,0,5],
      [0,2,2,0,2,2,2,0,2,2,0],
    ]},
    { grid: [
      [4,0,4,0,0,0,0,0,4,0,4],
      [0,2,0,2,0,0,0,2,0,2,0],
      [0,0,3,0,3,0,3,0,3,0,0],
    ]},
  ];

  /* ================================================================
   *  PLAY MODES
   * ================================================================ */

  const MODES = {
    classic: { name: 'Classic', bossEvery: 5, powerupMult: 1.0 },
    survival: { name: 'Survival', bossEvery: 0, powerupMult: 1.5 },
    bossRush: { name: 'Boss Rush', bossEvery: 1, powerupMult: 2.0 },
    campaign: { name: 'Campaign', bossEvery: 0, powerupMult: 1.0 },
    daily: { name: 'Daily', bossEvery: 5, powerupMult: 1.0 },
  };

  /* ================================================================
   *  HANGAR SHIPS
   * ================================================================ */

  const SHIP_DEFS = {
    interceptor: { speed: 1.0, fire: 1.0, damage: 1.0, lives: 0, price: 0, special: 'overdrive', specialName: 'Overdrive', desc: 'Balanced fighter. Special: 4 s of triple rapid fire.' },
    striker: { speed: 0.95, fire: 0.85, damage: 1.25, lives: 0, price: 1500, special: 'railgun', specialName: 'Railgun', desc: 'Hard-hitting. Special: a piercing rail beam for 1.2 s.' },
    guardian: { speed: 0.9, fire: 1.1, damage: 1.0, lives: 1, price: 2500, special: 'barrier', specialName: 'Barrier', desc: 'Extra hull. Special: a dome that eats enemy shots for 5 s.' },
    phantom: { speed: 1.25, fire: 0.95, damage: 1.0, lives: 0, unlock: '3-5', special: 'phase', specialName: 'Phase', desc: 'Fast. Special: 3 s untouchable while the enemy slows down.' },
    titan: { speed: 0.85, fire: 1.15, damage: 1.6, lives: 0, unlock: '5-5', special: 'nova', specialName: 'Nova', desc: 'Heavy gunship. Special: a shockwave that wipes nearby aliens.' },
  };

  const SHIP_ORDER = ['interceptor', 'striker', 'guardian', 'phantom', 'titan'];

  /* Names and colours of the fleet live in the sprite art, SHIP_DEFS holds the stats */
  function shipArtFor(id) {
    for (let i = 0; i < SZ.InvaderArt.SHIPS.length; ++i)
      if (SZ.InvaderArt.SHIPS[i].id === id)
        return SZ.InvaderArt.SHIPS[i];
    return SZ.InvaderArt.SHIPS[0];
  }

  function shipName(id) {
    return shipArtFor(id).name;
  }

  /* Largest value of each hangar stat across the whole fleet, for the bars */
  const HANGAR_STAT_MAX = (function() {
    const max = { Speed: 0, 'Fire rate': 0, Damage: 0, Hull: 0 };
    for (const id of SHIP_ORDER) {
      const d = SHIP_DEFS[id];
      max.Speed = Math.max(max.Speed, d.speed);
      max['Fire rate'] = Math.max(max['Fire rate'], 1 / d.fire);
      max.Damage = Math.max(max.Damage, d.damage);
      max.Hull = Math.max(max.Hull, 3 + d.lives);
    }
    return max;
  })();

  /* ================================================================
   *  ARMORY TECH TREE
   * ================================================================ */

  const TREE_BRANCHES = {
    weapons: { color: '#ff5a5a', name: 'Weapons' },
    defense: { color: '#5ab8ff', name: 'Defense' },
    engine: { color: '#6fe08a', name: 'Engine' },
    power: { color: '#c04cff', name: 'Power' },
    special: { color: '#ffd23f', name: 'Special' },
  };

  const TREE = [
    { id: 'w_rate', branch: 'weapons', name: 'Rapid Cycler', desc: 'Fire 15% faster per level', costs: [200, 400, 800], req: [] },
    { id: 'w_dmg', branch: 'weapons', name: 'Plasma Rounds', desc: '+40% damage per level', costs: [300, 700, 1400], req: [] },
    { id: 'w_speed', branch: 'weapons', name: 'Accelerators', desc: 'Shots fly 15% faster per level', costs: [250, 500], req: [] },
    { id: 'w_twin', branch: 'weapons', name: 'Twin Cannons', desc: 'Every shot fires two parallel bolts', costs: [1500], req: [['w_rate', 2]] },
    { id: 'd_hull', branch: 'defense', name: 'Extra Hull', desc: '+1 life per level', costs: [600, 1500], req: [] },
    { id: 'd_bunker', branch: 'defense', name: 'Hardened Bunkers', desc: 'Bunker blocks take 1 more hit per level', costs: [300, 700], req: [] },
    { id: 'd_shield', branch: 'defense', name: 'Deflector', desc: 'Start every run with a Shield', costs: [1200], req: [['d_hull', 1]] },
    { id: 'e_speed', branch: 'engine', name: 'Thrusters', desc: 'Move 8% faster per level', costs: [150, 300, 600], req: [] },
    { id: 'e_dash', branch: 'engine', name: 'Dash Jets', desc: 'Double-tap left/right to dash', costs: [900], req: [['e_speed', 1]] },
    { id: 'p_dur', branch: 'power', name: 'Long Charge', desc: 'Power-ups last 20% longer per level', costs: [250, 550, 1100], req: [] },
    { id: 'p_luck', branch: 'power', name: 'Salvage Scanner', desc: '25% more power-up drops per level', costs: [400, 900], req: [] },
    { id: 'p_magnet', branch: 'power', name: 'Tractor Beam', desc: 'Falling power-ups drift toward you', costs: [700], req: [['p_luck', 1]] },
    { id: 's_charge', branch: 'special', name: 'Capacitors', desc: 'Special charges 20% faster per level', costs: [300, 700, 1400], req: [] },
    { id: 's_power', branch: 'special', name: 'Amplifier', desc: 'Special lasts 30% longer / hits harder per level', costs: [600, 1300], req: [['s_charge', 1]] },
    { id: 's_drone', branch: 'special', name: 'Wingman', desc: 'Start every run with a drone for 12 s', costs: [1500], req: [['s_charge', 2]] },
    { id: 's_double', branch: 'special', name: 'Twin Charge', desc: 'Store two special charges', costs: [2500], req: [['s_power', 1], ['s_charge', 3]] },
  ];

  const TREE_BRANCH_LIST = Object.keys(TREE_BRANCHES).map(id => ({
    id: id, name: TREE_BRANCHES[id].name, color: TREE_BRANCHES[id].color,
  }));

  function treeNodeById(id) {
    return TREE.find(n => n.id === id) || null;
  }

  function shipOwned(id) {
    return save.ships.indexOf(id) >= 0;
  }

  function shipAvailable(id) {
    const def = SHIP_DEFS[id];
    if (!def) return false;
    if (def.unlock)
      return (save.stars[def.unlock] || 0) >= 1;
    return true;
  }

  function buyShip(id) {
    const def = SHIP_DEFS[id];
    if (!def || !shipAvailable(id)) {
      playSfx('error');
      return false;
    }
    if (!shipOwned(id)) {
      if (def.price > 0) {
        if (save.credits < def.price) {
          playSfx('error');
          return false;
        }
        save.credits -= def.price;
      }
      save.ships.push(id);
    }
    save.ship = id;
    writeSave();
    updateStatusBar();
    playSfx('powerup');
    playSfx('coin');
    return true;
  }

  function treeLevel(id) {
    return save.tree[id] || 0;
  }

  function nodeState(node) {
    const lvl = treeLevel(node.id);
    if (lvl >= node.costs.length)
      return 'maxed';
    for (const r of node.req)
      if (treeLevel(r[0]) < r[1])
        return 'locked';
    if (save.credits < node.costs[lvl])
      return 'expensive';
    return 'available';
  }

  function buyNode(node) {
    if (nodeState(node) !== 'available') {
      playSfx('error');
      return false;
    }
    save.credits -= node.costs[treeLevel(node.id)];
    save.tree[node.id] = treeLevel(node.id) + 1;
    writeSave();
    updateStatusBar();
    playSfx('powerup');
    playSfx('coin');
    return true;
  }

  /* ================================================================
   *  SECTOR BACKDROPS
   * ================================================================ */

  const THEME_ORDER = ['moon', 'mars', 'asteroids', 'jupiter', 'saturn', 'mothership'];
  let backdrop = null;
  let backdropTheme = '';
  const backdropCache = {};

  function setBackdrop(theme) {
    if (theme === backdropTheme && backdrop) return;
    if (!backdropCache[theme])
      backdropCache[theme] = SZ.InvaderBackdrop.create(theme);
    backdrop = backdropCache[theme];
    backdropTheme = theme;
  }

  function levelTheme() {
    if (gameMode === 'survival')
      return THEME_ORDER[Math.floor((wave - 1) / 5) % THEME_ORDER.length];
    return THEME_ORDER[(level - 1) % THEME_ORDER.length];
  }

  /* ================================================================
   *  CANVAS SETUP
   * ================================================================ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = GAME_W;
  let canvasH = GAME_H;
  let dpr = 1;
  let gameScale = 1;
  let gameOffsetX = 0;
  let gameOffsetY = 0;

  function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    canvasW = Math.max(1, rect.width);
    canvasH = Math.max(1, rect.height);
    // never render more than ~1.5 backing pixels per logical pixel
    const fit = Math.min(canvasW / GAME_W, canvasH / GAME_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    gameScale = fit;
    gameOffsetX = (canvasW - GAME_W * gameScale) / 2;
    gameOffsetY = (canvasH - GAME_H * gameScale) / 2;
  }

  window.addEventListener('resize', resizeCanvas);

  /* The part of the game plane the canvas actually shows. The play field stays
     1280x720 and is centred, so on any other aspect ratio the visible plane
     reaches past it - only the backdrop and the full-screen overlays follow. */
  function visibleRect() {
    return {
      x0: -gameOffsetX / gameScale,
      y0: -gameOffsetY / gameScale,
      x1: (canvasW - gameOffsetX) / gameScale,
      y1: (canvasH - gameOffsetY) / gameScale,
    };
  }

  /* Paint over every visible pixel, in game coordinates. */
  function fillVisible() {
    const v = visibleRect();
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function canvasToGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - gameOffsetX) / gameScale,
      y: (clientY - rect.top - gameOffsetY) / gameScale,
    };
  }

  const ui = SZ.InvadersUI.create(ctx);

  /* ================================================================
   *  GAME EFFECTS
   * ================================================================ */

  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const floatingText = new FloatingText();
  const sfx = SZ.GameAudio;
  const MARCH_PITCHES = [1, 0.89, 0.79, 0.75];
  let marchStep = 0;

  /* One sound per name per 40 ms: bursts of hits stay a rhythm, never a buzz */
  const sfxLast = {};
  function playSfx(name, opts) {
    const now = performance.now();
    const last = sfxLast[name];
    if (last !== undefined && now - last < 40)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let gameMode = 'classic';

  /* Random source: plain Math.random, or a seeded generator for the daily run */
  let rand = Math.random;

  /* Campaign run state */
  let stageIndex = 0, stageInfo = null, livesLost = 0, maxMultiplier = 1, bossStart = 0, stageResult = null;
  let runResult = null;
  /* Star-pop jingle on the stage-clear screen: one 'coin' per earned star */
  let stageStarBeats = 0, stageClearTime = 0;

  let aliens = [];
  let alienDir = 1;
  let alienMoveTimer = 0;
  let alienMoveInterval = BASE_MOVE_INTERVAL;
  let alienBullets = [];
  let alienShootTimer = 0;
  let alienShootInterval = 2000;
  let divers = [];

  let flares = [];
  const SPECIES_FLARE = { 1: 'orange', 2: 'orange', 3: 'cyan', 4: 'orange', 5: 'cyan', 6: 'white' };

  function addFlare(x, y, color, r, life) {
    flares.push({ x, y, color, r, t: 0, life });
    if (flares.length > 40)
      flares.splice(0, flares.length - 40);
  }

  /* Debris shards, shockwave rings and engine trails: own capped lists, cheap to draw */
  let debris = [];
  let rings = [];
  let trails = [];
  let trailFrame = 0;

  /* Hit-stop freezes the simulation for a beat on big impacts; fade/sweep are overlays */
  let hitStop = 0;
  let fade = 0;
  let sweep = 0;
  let comboPop = null;
  let dyingSlow = 0;
  let bossFinale = 0, bossFinaleTick = 0, bossFinaleBox = null;

  const COMBO_COLORS = { 2: '#5af2ff', 3: '#5ae06a', 4: '#ffd23f', 5: '#ff4a5a' };

  function darkenColor(hex, f) {
    let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3)
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    const r = Math.round(parseInt(h.slice(0, 2), 16) * f);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * f);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function addDebris(x, y, count, colors) {
    for (let i = 0; i < count; ++i) {
      const ang = rand() * Math.PI * 2;
      const v = 1 + rand() * 3;
      debris.push({
        x, y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - 1,
        rot: rand() * Math.PI * 2,
        vrot: (rand() - 0.5) * 0.3,
        life: 0.6,
        color: colors[Math.floor(rand() * colors.length)],
        size: 2 + rand() * 3,
      });
    }
    if (debris.length > 120)
      debris.splice(0, debris.length - 120);
  }

  function addRing(x, y, color, r0, maxR, life) {
    rings.push({ x, y, r: r0, r0, maxR, life, maxLife: life, color });
    if (rings.length > 24)
      rings.splice(0, rings.length - 24);
  }

  /* The ship's death spectacle, shared by bullet kills and the swarm reaching the row */
  function playerDeathFx() {
    const cx = player.x + PLAYER_W / 2, cy = player.y + PLAYER_H / 2;
    const shipColor = shipArtFor(currentShipId()).color;
    addFlare(cx, cy, 'white', 130, 0.5);
    addDebris(cx, cy, 30, [shipColor, darkenColor(shipColor, 0.5)]);
    addRing(cx, cy, '#ffffff', 10, 90, 0.4);
    addRing(cx, cy, '#5af2ff', 10, 150, 0.5);
    shake.trigger(10, 500);
    hitStop = 0.08;
    dyingSlow = 0.6;
  }

  /* Advance every cosmetic list; runs even while the simulation is frozen */
  function updateFx(dt) {
    for (let i = flares.length - 1; i >= 0; --i) {
      flares[i].t += dt / 1000;
      if (flares[i].t >= flares[i].life)
        flares.splice(i, 1);
    }
    for (let i = debris.length - 1; i >= 0; --i) {
      const d = debris[i];
      d.vy += 0.05;
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.vrot;
      d.life -= dt / 1000;
      if (d.life <= 0)
        debris.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; --i) {
      const r = rings[i];
      r.life -= dt / 1000;
      r.r = r.r0 + (r.maxR - r.r0) * (1 - r.life / r.maxLife);
      if (r.life <= 0)
        rings.splice(i, 1);
    }
    for (let i = trails.length - 1; i >= 0; --i) {
      const t = trails[i];
      t.y += t.vy;
      t.life -= dt / 1000;
      if (t.life <= 0)
        trails.splice(i, 1);
    }
    if (comboPop) {
      comboPop.t += dt / 1000;
      if (comboPop.t >= 0.5)
        comboPop = null;
    }
  }

  let player = { x: 0, y: 0, alive: true, tilt: 0 };
  let playerBullets = [];
  let playerShootCooldown = 0;

  /* Special ability: meter 0..100 fills, converts to charges, one fires at a time */
  let special = 0, specialCharges = 0, specialActive = 0, specialKind = '';
  let specialTick = 0;
  let novaRing = null;

  /* Dash / brief invulnerability */
  let invuln = 0;
  let dash = null, dashCooldown = 0, lastTapDir = 0, lastTapTime = -1e9;

  let shields = [];

  let ufo = null;
  let ufoTimer = 0;
  let ufoNextSpawn = 0;
  let ufoBlipTimer = 0;

  let fallingPowerups = [];
  let activePowerups = {};

  let drone = null;
  let droneShootTimer = 0;

  let comboCount = 0;
  let comboTimer = 0;
  let comboMultiplier = 1;

  let boss = null;
  let bossActive = false;
  let bossWarningTimer = 0;
  let bossWarnBeats = 0;
  let bossDescendY = 0;
  let bossVictoryTimer = 0;

  let screenFlashAlpha = 0;
  let screenFlashColor = '#fff';

  let score = 0;
  let lives = 3;
  let level = 1;
  let wave = 0;
  let gameState = 'title';
  let deathTimer = 0;
  let levelCompleteTimer = 0;
  let waveNameTimer = 0;
  let waveNameText = '';

  /* Menu flow: clickable items rebuilt every draw, one shared keyboard cursor */
  let hitAreas = [], menuCursor = 0, prevScreen = 'title';
  let mouseX = -1, mouseY = -1;
  let hangarCursor = 0, helpPage = 0, helpFrom = 'title';
  let treeBranch = 0, treeSelected = null, treeLayout = null, treeBuyFlash = null;

  let keys = {};
  let mouseGameX = -1;
  let mouseDown = false;
  let mouseActive = false;
  let lastTime = 0;
  let simAccumulator = 0;

  /* Simulation runs in fixed 60 Hz steps regardless of display refresh rate */
  const SIM_STEP = 1000 / 60;
  const SIM_MAX_STEPS = 3;
  const SIM_SNAP = 0.5;
  let gameTime = 0;
  let alienFrame = 0;

  /* ================================================================
   *  SHIELD SHAPE
   * ================================================================ */

  const SHIELD_SHAPE = [
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
    [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1],
  ];

  /* Energy-crystal wall: one precomputed colour per bunker row, top to bottom */
  const BUNKER_ROW_COLORS = (function() {
    const top = [0x5a, 0xf2, 0xff];
    const bot = [0x1a, 0x8a, 0xa8];
    const out = [];
    for (let r = 0; r < SHIELD_ROWS; ++r) {
      const t = r / (SHIELD_ROWS - 1);
      out.push('rgb(' + top.map((v, k) => Math.round(v + (bot[k] - v) * t)).join(',') + ')');
    }
    return out;
  })();

  /* ================================================================
   *  WAVE CREATION
   * ================================================================ */

  function createWaveFromFormation(formation) {
    aliens = [];
    divers = [];
    const grid = formation.grid;
    const rows = grid.length;
    const maxCols = Math.max(...grid.map(r => r.length));

    const totalW = maxCols * (ALIEN_W + ALIEN_PAD_X) - ALIEN_PAD_X;
    const startX = (GAME_W - totalW) / 2;
    const startY = 90;

    for (let row = 0; row < rows; ++row)
      for (let col = 0; col < grid[row].length; ++col) {
        const type = grid[row][col];
        if (type === 0) continue;

        const info = ALIEN_TYPE_INFO[type];
        if (!info) continue;

        aliens.push({
          row, col,
          x: startX + col * (ALIEN_W + ALIEN_PAD_X),
          y: startY + row * (ALIEN_H + ALIEN_PAD_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          alive: true,
          points: info.points,
          color: info.color,
          species: type,
          typeIndex: Math.min(info.drawIndex, 2),
          flash: 0,
          hp: type === 6 ? 2 : 1,
          shielded: type === 5,
          shieldHP: type === 5 ? 1 : 0,
          isDiver: type === 4,
          diving: false,
          divePhase: 0,
        });
      }
  }

  /* ================================================================
   *  SHIELDS
   * ================================================================ */

  function createShields() {
    shields = [];
    const blockHp = 1 + treeLevel('d_bunker');
    const totalShieldWidth = SHIELD_COUNT * SHIELD_COLS * SHIELD_BLOCK_SIZE;
    const gap = (GAME_W - totalShieldWidth) / (SHIELD_COUNT + 1);

    for (let i = 0; i < SHIELD_COUNT; ++i) {
      const sx = gap + i * (SHIELD_COLS * SHIELD_BLOCK_SIZE + gap);
      const sy = GAME_H - SHIELD_Y_OFFSET - SHIELD_ROWS * SHIELD_BLOCK_SIZE;
      const blocks = [];
      for (let r = 0; r < SHIELD_ROWS; ++r)
        for (let c = 0; c < SHIELD_COLS; ++c)
          if (SHIELD_SHAPE[r][c])
            blocks.push({
              x: sx + c * SHIELD_BLOCK_SIZE,
              y: sy + r * SHIELD_BLOCK_SIZE,
              w: SHIELD_BLOCK_SIZE,
              h: SHIELD_BLOCK_SIZE,
              row: r,
              alive: true,
              hp: blockHp,
              maxHp: blockHp,
            });
      shields.push(blocks);
    }
  }

  /* ================================================================
   *  NEW GAME / NEXT LEVEL
   * ================================================================ */

  function newGame(mode, skipWave) {
    gameMode = mode || 'classic';
    rand = mode === 'daily'
      ? SZ.InvaderCampaign.rng(SZ.InvaderCampaign.dailySeed(new Date()))
      : Math.random;
    score = 0;
    lives = 3 + SHIP_DEFS[currentShipId()].lives + treeLevel('d_hull');
    level = 1;
    wave = 1;
    alienDir = 1;
    alienMoveTimer = 0;
    alienMoveInterval = BASE_MOVE_INTERVAL;
    alienBullets = [];
    alienShootTimer = 0;
    alienShootInterval = 2000;
    playerBullets = [];
    playerShootCooldown = 0;
    ufo = null;
    ufoTimer = 0;
    ufoNextSpawn = UFO_MIN_INTERVAL + rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    flares = [];
    deathTimer = 0;
    levelCompleteTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];
    activePowerups = {};
    drone = null;
    droneShootTimer = 0;
    comboCount = 0;
    comboTimer = 0;
    comboMultiplier = 1;
    boss = null;
    bossActive = false;
    bossWarningTimer = 0;
    bossVictoryTimer = 0;
    screenFlashAlpha = 0;
    waveNameTimer = 0;
    debris = [];
    rings = [];
    trails = [];
    trailFrame = 0;
    hitStop = 0;
    sweep = 0;
    comboPop = null;
    dyingSlow = 0;
    bossFinale = 0;
    bossFinaleTick = 0;
    bossFinaleBox = null;
    fade = 1;

    player.x = GAME_W / 2 - PLAYER_W / 2;
    player.y = GAME_H - PLAYER_Y_OFFSET;
    player.alive = true;
    player.tilt = 0;

    special = 0;
    specialCharges = 0;
    specialActive = 0;
    specialKind = '';
    specialTick = 0;
    novaRing = null;
    invuln = 0;
    dash = null;
    dashCooldown = 0;
    lastTapDir = 0;
    lastTapTime = -1e9;

    if (treeLevel('d_shield') > 0)
      activePowerups.shield = powerupDuration(POWERUPS.find(p => p.id === 'shield'));
    if (treeLevel('s_drone') > 0) {
      drone = {
        x: player.x + PLAYER_W / 2 - DRONE_W / 2 + 30,
        y: player.y - 30,
      };
      droneShootTimer = 0;
      activePowerups.drone = 12000;
    }

    setBackdrop(levelTheme());

    particles.clear();
    floatingText.clear();
    marchStep = 0;
    playSfx('select');

    if (!skipWave) {
      const modeConf = MODES[gameMode];
      const isBossLevel = modeConf.bossEvery > 0 && level % modeConf.bossEvery === 0;

      if (isBossLevel) {
        startBossPhase();
      } else {
        const formIdx = (level - 1) % FORMATIONS.length;
        createWaveFromFormation(FORMATIONS[formIdx]);
        createShields();
        waveNameText = FORMATIONS[formIdx].name;
        waveNameTimer = 2000;
        gameState = 'playing';
      }
    }

    updateStatusBar();
  }

  function startNextLevel() {
    ++level;
    ++wave;
    alienDir = 1;
    alienMoveTimer = 0;
    alienBullets = [];
    alienShootTimer = 0;
    playerBullets = [];
    playerShootCooldown = 0;
    ufo = null;
    ufoTimer = 0;
    ufoNextSpawn = UFO_MIN_INTERVAL + rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    deathTimer = 0;
    levelCompleteTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];
    bossVictoryTimer = 0;

    alienShootInterval = Math.max(400, 2000 - (level - 1) * 200);

    player.x = GAME_W / 2 - PLAYER_W / 2;
    player.alive = true;

    setBackdrop(levelTheme());

    const modeConf = MODES[gameMode];
    const isBossLevel = modeConf.bossEvery > 0 && level % modeConf.bossEvery === 0;

    if (isBossLevel) {
      startBossPhase();
    } else {
      const formIdx = (level - 1) % FORMATIONS.length;
      createWaveFromFormation(FORMATIONS[formIdx]);
      createShields();
      waveNameText = FORMATIONS[formIdx].name;
      waveNameTimer = 2000;
      gameState = 'playing';
    }

    updateStatusBar();
  }

  function startSurvivalNextWave() {
    ++wave;
    alienDir = 1;
    alienMoveTimer = 0;
    alienBullets = [];
    alienShootTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];

    alienShootInterval = Math.max(400, 2000 - (wave - 1) * 100);

    const formIdx = (wave - 1) % FORMATIONS.length;
    createWaveFromFormation(FORMATIONS[formIdx]);
    setBackdrop(levelTheme());
    waveNameText = 'Wave ' + wave + ': ' + FORMATIONS[formIdx].name;
    waveNameTimer = 2000;
    gameState = 'playing';
    updateStatusBar();
  }

  function startBossPhase() {
    const stage = gameMode === 'campaign' ? stageInfo : null;
    const escortIdx = (level - 1) % BOSS_ESCORTS.length;
    createWaveFromFormation(BOSS_ESCORTS[escortIdx]);
    if (stage) {
      if (stage.escorts <= 0)
        aliens = [];
      else if (aliens.length > stage.escorts)
        aliens.length = stage.escorts;
    }
    /* the escorts march below the boss, never inside its bigger box */
    if (aliens.length > 0) {
      let escortTop = aliens[0].y;
      for (const a of aliens)
        if (a.y < escortTop)
          escortTop = a.y;
      if (escortTop < BOSS_ESCORT_MIN_Y) {
        const drop = BOSS_ESCORT_MIN_Y - escortTop;
        for (const a of aliens)
          a.y += drop;
      }
    }
    createShields();

    let hp, design, name;
    if (stage && stage.boss) {
      hp = stage.boss.hp;
      design = stage.boss.design;
      name = stage.boss.name;
    } else {
      const bossNum = Math.ceil(level / (MODES[gameMode].bossEvery || 1));
      hp = BOSS_BASE_HP + (bossNum - 1) * BOSS_HP_PER_BOSS;
      design = (bossNum - 1) % 6;
    }

    boss = {
      x: GAME_W / 2 - BOSS_W / 2,
      y: -BOSS_H - 30,
      targetY: 170,
      hp,
      maxHp: hp,
      design,
      name,
      flash: 0,
      movePhase: 0,
      moveSpeed: 1.5,
      attackTimer: 0,
      attackInterval: 2000,
      currentPattern: 0,
      patterns: ['spread', 'aimed', 'rain'],
      enraged: false,
    };
    setBackdrop(stage ? stage.theme : levelTheme());
    bossActive = true;
    bossWarningTimer = 2000;
    bossWarnBeats = 0;
    bossDescendY = -BOSS_H - 30;
    gameState = 'bossIntro';
    waveNameText = 'BOSS FIGHT';
    waveNameTimer = 2500;
    updateStatusBar();
  }

  /* ================================================================
   *  CAMPAIGN STAGES
   * ================================================================ */

  function applyArmored(share) {
    if (!(share > 0) || aliens.length === 0) return;
    let lowestRow = 0;
    for (const a of aliens)
      if (a.row > lowestRow)
        lowestRow = a.row;
    const info = ALIEN_TYPE_INFO[6];
    for (const a of aliens) {
      if (a.row !== lowestRow || rand() >= share) continue;
      a.species = 6;
      a.points = info.points;
      a.color = info.color;
      a.typeIndex = Math.min(info.drawIndex, 2);
      a.hp = 2;
      a.isDiver = false;
    }
  }

  function startStage(index) {
    stageIndex = index;
    stageInfo = SZ.InvaderCampaign.STAGES[index];
    livesLost = 0;
    maxMultiplier = 1;
    stageResult = null;
    newGame('campaign', true);
    setBackdrop(stageInfo.theme);

    if (stageInfo.boss) {
      startBossPhase();
      bossStart = gameTime;
      const carried = save.carry && save.carry.stage === stageInfo.id ? Math.min(save.carry.charges, maxSpecialCharges()) : 0;
      if (carried > 0) {
        specialCharges = carried;
        floatingText.add(GAME_W / 2, GAME_H - 190, carried === 1 ? 'Special charge carried over' : carried + ' special charges carried over', { color: '#ffd23f', font: 'bold 24px sans-serif', decay: 0.008 });
      }
    } else {
      createWaveFromFormation(FORMATIONS[stageInfo.formation]);
      applyArmored(stageInfo.armored);
      createShields();
      alienMoveInterval = calcMoveInterval();
      alienShootInterval = 2000 / stageInfo.fire;
      waveNameText = stageInfo.id + ' · ' + stageInfo.name;
      waveNameTimer = 2000;
      gameState = 'playing';
    }

    updateStatusBar();
  }

  function finishStage() {
    const stars = SZ.InvaderCampaign.starsFor(stageInfo, {
      cleared: true,
      livesLost,
      maxMultiplier,
      bossSeconds: (gameTime - bossStart) / 1000,
    });
    const id = stageInfo.id;
    save.stars[id] = Math.max(save.stars[id] || 0, stars);
    const credits = SZ.InvaderCampaign.creditsFor(score, stageInfo, stars);
    save.credits += credits;
    ++save.stats.runs;
    // charges built up right before a boss carry into that boss fight; beating the boss uses them up
    const nextInfo = SZ.InvaderCampaign.nextStage(id);
    if (nextInfo && nextInfo.boss)
      save.carry = { stage: nextInfo.id, charges: specialCharges };
    else if (stageInfo.boss && save.carry && save.carry.stage === id)
      save.carry = null;
    stageResult = { stars, credits, score, livesLost, maxMultiplier };
    writeSave();
    gameState = 'stageClear';
    menuCursor = 0;
    sweep = 0.6;
    particles.confetti(GAME_W / 2, GAME_H * 0.4, 30);
    playSfx('win');
    stageStarBeats = 0;
    stageClearTime = gameTime;
  }

  /* ================================================================
   *  COLLISION HELPERS
   * ================================================================ */

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* ================================================================
   *  ALIEN MOVEMENT + DIVING
   * ================================================================ */

  function calcMoveInterval() {
    const aliveCount = aliens.filter(a => a.alive && !a.diving).length;
    const total = aliens.length || 1;
    if (aliveCount === 0)
      return BASE_MOVE_INTERVAL;
    const ratio = aliveCount / total;
    const speedBoost = Math.max(0, (level - 1) * 30);
    const interval = Math.max(MIN_MOVE_INTERVAL, BASE_MOVE_INTERVAL * ratio - speedBoost);
    if (gameMode === 'campaign' && stageInfo)
      return interval / stageInfo.speed;
    return interval;
  }

  function moveAliens() {
    let hitEdge = false;
    const alive = aliens.filter(a => a.alive && !a.diving);
    if (alive.length > 0)
      playSfx('thud', { pitch: MARCH_PITCHES[marchStep++ % MARCH_PITCHES.length], volume: 0.35 });

    for (const a of alive) {
      a.x += alienDir * 6;
      if (a.x + a.w > GAME_W - 15 || a.x < 15)
        hitEdge = true;
    }

    if (hitEdge) {
      alienDir *= -1;
      for (const a of alive) {
        a.x += alienDir * 6;
        a.y += ALIEN_DROP;
      }
    }

    alienFrame = 1 - alienFrame;
    alienMoveInterval = calcMoveInterval();
  }

  function tryDiveAttack() {
    if (divers.length >= 2) return;
    if (level < 3 && gameMode === 'classic' && !aliens.some(a => a.isDiver)) return;

    const diveChance = 0.015 + level * 0.003;
    if (rand() > diveChance) return;

    const candidates = aliens.filter(a => a.alive && !a.diving);
    if (candidates.length === 0) return;

    const diverCandidates = candidates.filter(a => a.isDiver);
    const pool = diverCandidates.length > 0 && rand() < 0.7 ? diverCandidates : candidates;
    const alien = pool[Math.floor(rand() * pool.length)];

    alien.diving = true;
    alien.divePhase = 0;
    playSfx('whoosh', { pitch: 0.7, volume: 0.6 });
    divers.push(alien);
  }

  function updateDivers(dt) {
    for (let i = divers.length - 1; i >= 0; --i) {
      const d = divers[i];
      if (!d.alive) {
        divers.splice(i, 1);
        continue;
      }

      d.divePhase += dt * 0.005;
      const targetX = player.alive ? player.x + PLAYER_W / 2 : GAME_W / 2;
      const dx = targetX - (d.x + d.w / 2);
      d.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.02, 2.25) + Math.sin(d.divePhase * 4) * 3;
      d.y += 3.75 + level * 0.225;

      particles.trail(d.x + d.w / 2, d.y + d.h, {
        vy: 0.5,
        color: d.color,
        size: 1.5,
        life: 0.2,
      });

      if (player.alive && rectsOverlap(d.x, d.y, d.w, d.h, player.x, player.y, PLAYER_W, PLAYER_H)) {
        d.alive = false;
        divers.splice(i, 1);
        killPlayer();
        continue;
      }

      if (d.y > GAME_H + 30) {
        d.alive = false;
        divers.splice(i, 1);
      }
    }
  }

  /* ================================================================
   *  ALIEN SHOOTING
   * ================================================================ */

  function alienShoot() {
    const alive = aliens.filter(a => a.alive && !a.diving);
    if (alive.length === 0) return;

    const bottomAliens = new Map();
    for (const a of alive) {
      const existing = bottomAliens.get(a.col);
      if (!existing || a.y > existing.y)
        bottomAliens.set(a.col, a);
    }

    const shooters = [...bottomAliens.values()];
    const shooter = shooters[Math.floor(rand() * shooters.length)];
    playSfx('shoot', { pitch: 0.6, volume: 0.2 });
    addFlare(shooter.x + shooter.w / 2, shooter.y + shooter.h, 'orange', 8, 0.05);

    alienBullets.push({
      x: shooter.x + shooter.w / 2 - ALIEN_BULLET_W / 2,
      y: shooter.y + shooter.h,
      w: ALIEN_BULLET_W,
      h: ALIEN_BULLET_H,
      vx: 0,
      vy: ALIEN_BULLET_SPEED,
    });
  }

  /* ================================================================
   *  UFO
   * ================================================================ */

  function spawnUfo() {
    const goRight = rand() < 0.5;
    ufo = {
      x: goRight ? -UFO_W : GAME_W,
      y: 37.5,
      w: UFO_W,
      h: UFO_H,
      dir: goRight ? 1 : -1,
      points: [50, 100, 150, 200, 300][Math.floor(rand() * 5)],
    };
    ufoBlipTimer = 0;
    playSfx('whoosh', { pitch: 1.6 });
  }

  /* ================================================================
   *  POWERUP LOGIC
   * ================================================================ */

  function spawnPowerup(x, y) {
    const def = pickRandomPowerup();
    fallingPowerups.push({
      x: x - POWERUP_SIZE / 2,
      y,
      def,
      time: gameTime,
    });
  }

  function powerupDuration(def) {
    return def.duration * (1 + 0.2 * treeLevel('p_dur'));
  }

  function updateFallingPowerups(dt) {
    for (let i = fallingPowerups.length - 1; i >= 0; --i) {
      const p = fallingPowerups[i];
      p.y += POWERUP_FALL_SPEED;
      p.time = gameTime;

      if (treeLevel('p_magnet') > 0 && player.alive && p.y < player.y) {
        const pull = player.x + PLAYER_W / 2 - (p.x + POWERUP_SIZE / 2);
        if (Math.abs(pull) > 1)
          p.x += Math.sign(pull) * 1.5;
      }

      if (p.y > GAME_H + 30) {
        fallingPowerups.splice(i, 1);
        continue;
      }

      if (player.alive && rectsOverlap(
        p.x, p.y + Math.sin(gameTime * 0.004) * 4.5, POWERUP_SIZE, POWERUP_SIZE,
        player.x, player.y, PLAYER_W, PLAYER_H
      )) {
        playSfx('powerup');
        collectPowerup(p.def);
        particles.sparkle(p.x + POWERUP_SIZE / 2, p.y + POWERUP_SIZE / 2, 12, { color: p.def.color });
        floatingText.add(p.x + POWERUP_SIZE / 2, p.y, p.def.name, {
          color: p.def.color,
          font: 'bold 18px sans-serif',
        });
        fallingPowerups.splice(i, 1);
      }
    }
  }

  function collectPowerup(def) {
    triggerFlash(def.color, 0.15);

    if (def.id === 'extraLife') {
      ++lives;
      updateStatusBar();
      return;
    }

    if (def.id === 'bomb') {
      activateBomb();
      return;
    }

    if (def.id === 'drone') {
      drone = {
        x: player.x + PLAYER_W / 2 - DRONE_W / 2 + 30,
        y: player.y - 30,
      };
      droneShootTimer = 0;
      activePowerups.drone = powerupDuration(def);
      return;
    }

    activePowerups[def.id] = powerupDuration(def);
  }

  function activateBomb() {
    let bombScore = 0;
    for (const a of aliens) {
      if (!a.alive) continue;
      a.alive = false;
      ++save.stats.kills;
      bombScore += a.points;
      addSpecialCharge(4);
      addFlare(a.x + a.w / 2, a.y + a.h / 2, SPECIES_FLARE[a.species] || 'white', 46, 0.25);
      particles.burst(a.x + a.w / 2, a.y + a.h / 2, 8, {
        speed: 3,
        color: a.color,
        gravity: 0.05,
        size: 2,
      });
    }

    for (const d of divers) {
      if (!d.alive) continue;
      d.alive = false;
      ++save.stats.kills;
      bombScore += d.points || 50;
      addSpecialCharge(4);
      addFlare(d.x + d.w / 2, d.y + d.h / 2, 'orange', 46, 0.25);
      particles.burst(d.x + d.w / 2, d.y + d.h / 2, 8, {
        speed: 3,
        color: '#f80',
        gravity: 0.05,
        size: 2,
      });
    }
    divers = [];

    score += bombScore;
    triggerFlash('#fa0', 0.4);
    shake.trigger(6, 300);
    if (bombScore > 0)
      floatingText.add(GAME_W / 2, GAME_H / 2, '+' + bombScore, {
        color: '#fa0',
        font: 'bold 30px sans-serif',
      });
  }

  function updateActivePowerups(dt) {
    for (const id of Object.keys(activePowerups)) {
      activePowerups[id] -= dt;
      if (activePowerups[id] <= 0) {
        delete activePowerups[id];
        playSfx('drop', { volume: 0.3 });
        if (id === 'drone')
          drone = null;
      }
    }
  }

  /* ================================================================
   *  COMBO SYSTEM
   * ================================================================ */

  function addComboKill(points) {
    ++comboCount;
    comboTimer = COMBO_TIMEOUT;
    const prevMult = comboMultiplier;
    const idx = Math.min(comboCount, COMBO_MULTIPLIERS.length - 1);
    comboMultiplier = COMBO_MULTIPLIERS[idx];
    if (comboMultiplier > maxMultiplier)
      maxMultiplier = comboMultiplier;
    const gained = points * comboMultiplier;
    score += gained;

    if (comboMultiplier > prevMult && comboMultiplier > 1) {
      playSfx('levelup', { pitch: 1 + comboMultiplier * 0.1 });
      comboPop = { text: 'x' + comboMultiplier, color: COMBO_COLORS[comboMultiplier] || '#ffd23f', t: 0 };
    }

    return gained;
  }

  function updateCombo(dt) {
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboCount = 0;
        comboMultiplier = 1;
        comboTimer = 0;
      }
    }
  }

  /* Common death for any alien, whatever killed it */
  function destroyAlien(a) {
    a.alive = false;
    ++save.stats.kills;
    const gained = addComboKill(a.points);
    playSfx('smallExplode', { pitch: SPECIES_DEATH_PITCH[a.species] || 1, volume: 0.45 });

    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    addFlare(acx, acy, SPECIES_FLARE[a.species] || 'white', 46, 0.25);
    addDebris(acx, acy, 8 + Math.floor(rand() * 5), [a.color, darkenColor(a.color, 0.45)]);
    addRing(acx, acy, a.color, 6, 40, 0.25);

    particles.burst(acx, acy, 15, {
      speed: 3,
      color: a.color,
      gravity: 0.05,
      size: 3,
    });
    particles.sparkle(acx, acy, 6, { color: a.color });

    floatingText.add(acx, a.y, '+' + gained, {
      color: '#ff0',
      font: 'bold 13px sans-serif',
    });

    const dropChance = (a.isDiver ? POWERUP_DROP_CHANCE_SPECIAL : POWERUP_DROP_CHANCE)
      * (MODES[gameMode].powerupMult || 1)
      * (1 + 0.25 * treeLevel('p_luck'));
    if (rand() < dropChance)
      spawnPowerup(a.x + a.w / 2, a.y + a.h / 2);

    addSpecialCharge(4);
  }

  /* ================================================================
   *  SPECIAL ABILITY
   * ================================================================ */

  function bulletDamage() {
    return SHIP_DEFS[currentShipId()].damage * (1 + 0.4 * treeLevel('w_dmg'));
  }

  function maxSpecialCharges() {
    return treeLevel('s_double') > 0 ? 2 : 1;
  }

  function addSpecialCharge(base) {
    if (specialCharges >= maxSpecialCharges())
      return;
    special += base * (1 + 0.2 * treeLevel('s_charge'));
    if (special >= 100) {
      ++specialCharges;
      special = 0;
      playSfx('pickup');
    }
  }

  function fireSpecial() {
    if (specialActive > 0)
      return;
    if (specialCharges <= 0) {
      playSfx('error');
      return;
    }
    --specialCharges;

    const ship = SHIP_DEFS[currentShipId()];
    const f = 1 + 0.3 * treeLevel('s_power');
    specialKind = ship.special;
    specialTick = 0;

    if (ship.special === 'overdrive') {
      specialActive = 4000 * f;
      activePowerups.tripleShot = Math.max(activePowerups.tripleShot || 0, specialActive);
      activePowerups.rapidFire = Math.max(activePowerups.rapidFire || 0, specialActive);
      playSfx('powerup');
    } else if (ship.special === 'railgun') {
      specialActive = 1200 * f;
      playSfx('laser');
    } else if (ship.special === 'barrier') {
      specialActive = 5000 * f;
      playSfx('zap');
    } else if (ship.special === 'phase') {
      specialActive = 3000 * f;
      invuln = Math.max(invuln, specialActive);
      playSfx('whoosh');
    } else if (ship.special === 'nova') {
      specialActive = 500;
      novaRing = {
        cx: player.x + PLAYER_W / 2,
        cy: player.y + PLAYER_H / 2,
        t: 0,
        maxR: 380 * (1 + 0.15 * treeLevel('s_power')),
        hitBoss: false,
      };
      addFlare(novaRing.cx, novaRing.cy, 'white', 160, 0.5);
      triggerFlash('#fff', 0.4);
      shake.trigger(12, 500);
      playSfx('explode', { pitch: 0.7 });
    }
  }

  /* Railgun: every 0.1 s the 18 px column under the ship takes damage */
  function tickRailgun(dt) {
    specialTick += dt;
    while (specialTick >= 100) {
      specialTick -= 100;
      const cx = player.x + PLAYER_W / 2;
      let tickKills = 0;
      for (const a of aliens) {
        if (!a.alive) continue;
        if (a.x + a.w > cx - 9 && a.x < cx + 9) {
          --a.hp;
          if (a.hp <= 0) {
            destroyAlien(a);
            ++tickKills;
          } else
            a.flash = 0.08;
        }
      }
      if (tickKills >= 3)
        hitStop = 0.05;
      if (bossActive && boss && boss.x < cx + 9 && boss.x + BOSS_W > cx)
        damageBoss(2 * bulletDamage(), true);
    }
  }

  /* Nova: shockwave ring expanding from the ship, wiping everything it touches */
  function updateNova(dt) {
    if (!novaRing) return;
    novaRing.t += dt;
    const r = novaRing.maxR * Math.min(1, novaRing.t / 500);
    for (const a of aliens) {
      if (!a.alive) continue;
      const dx = a.x + a.w / 2 - novaRing.cx;
      const dy = a.y + a.h / 2 - novaRing.cy;
      if (dx * dx + dy * dy <= r * r)
        destroyAlien(a);
    }
    if (!novaRing.hitBoss && bossActive && boss) {
      const bx = boss.x + BOSS_W / 2 - novaRing.cx;
      const by = boss.y + BOSS_H / 2 - novaRing.cy;
      if (bx * bx + by * by <= r * r) {
        novaRing.hitBoss = true;
        damageBoss(10 * bulletDamage(), true);
      }
    }
    if (novaRing.t >= 500)
      novaRing = null;
  }

  function tryDash(dir) {
    if (dash || dashCooldown > 0)
      return;
    dash = { dir, t: 0 };
    invuln = Math.max(invuln, 300);
    dashCooldown = 1200;
    playSfx('whoosh', { pitch: 1.5, volume: 0.5 });
  }

  /* ================================================================
   *  DRONE LOGIC
   * ================================================================ */

  function updateDrone(dt) {
    if (!drone) return;

    const targetX = player.x + PLAYER_W / 2 - DRONE_W / 2 + 37.5;
    const targetY = player.y - 33;
    drone.x += (targetX - drone.x) * 0.08;
    drone.y += (targetY - drone.y) * 0.08;

    droneShootTimer += dt;
    if (droneShootTimer >= DRONE_SHOOT_INTERVAL && player.alive) {
      droneShootTimer = 0;
      playerBullets.push({
        x: drone.x + DRONE_W / 2 - 1.5,
        y: drone.y - BULLET_H,
        vx: 0,
        vy: -BULLET_SPEED * 0.8,
        w: 3,
        h: BULLET_H - 3,
        piercing: false,
        fromDrone: true,
      });
    }
  }

  /* ================================================================
   *  BOSS LOGIC
   * ================================================================ */

  function updateBoss(dt) {
    if (!boss || !bossActive) return;

    if (boss.flash > 0)
      boss.flash = Math.max(0, boss.flash - dt / 1000);

    if (gameState === 'bossIntro') {
      bossWarningTimer -= dt;
      /* three low warning klaxons across the 2 s entrance */
      if (bossWarnBeats < 3 && bossWarningTimer <= 2000 - bossWarnBeats * 650) {
        ++bossWarnBeats;
        playSfx('hurt', { pitch: 0.5 });
      }
      bossDescendY += (boss.targetY - bossDescendY) * 0.03;
      boss.y = bossDescendY;
      if (bossWarningTimer <= 0) {
        boss.y = boss.targetY;
        gameState = 'playing';
        shake.trigger(2, 300);
      }
      return;
    }

    boss.movePhase += boss.moveSpeed * dt * 0.001;
    boss.x = GAME_W / 2 + Math.sin(boss.movePhase) * (GAME_W / 2 - BOSS_W / 2 - 30) - BOSS_W / 2;

    const phase2 = boss.hp <= boss.maxHp / 2;
    if (phase2) {
      boss.moveSpeed = 2.5;
      boss.attackInterval = 1200;
      if (boss.patterns.length === 3)
        boss.patterns.push('spiral');
      if (!boss.enraged) {
        boss.enraged = true;
        const ecx = boss.x + BOSS_W / 2, ecy = boss.y + BOSS_H / 2;
        addFlare(ecx, ecy, 'orange', 120, 0.45);
        addRing(ecx, ecy, '#ff4a5a', 10, 150, 0.4);
        floatingText.add(ecx, ecy - 60, 'ENRAGED!', {
          color: '#ff4a5a',
          font: 'bold 30px sans-serif',
        });
        playSfx('explode', { pitch: 0.7 });
        shake.trigger(6, 300);
      }
    }

    boss.attackTimer += dt;
    if (boss.attackTimer >= boss.attackInterval) {
      boss.attackTimer = 0;
      bossAttack();
    }
  }

  function bossAttack() {
    if (!boss) return;
    const pattern = boss.patterns[boss.currentPattern % boss.patterns.length];
    playSfx('laser', { pitch: 0.6 });
    const bx = boss.x + BOSS_W / 2;
    const by = boss.y + BOSS_H;

    switch (pattern) {
      case 'spread':
        for (let i = -2; i <= 2; ++i) {
          const angle = Math.PI / 2 + i * 0.2;
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W + 1.5,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 3.75,
            vy: Math.sin(angle) * 3.75,
            bossBullet: true,
          });
        }
        break;
      case 'aimed': {
        const px = player.alive ? player.x + PLAYER_W / 2 : GAME_W / 2;
        const py = player.alive ? player.y : GAME_H - 60;
        const dx = px - bx;
        const dy = py - by;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        for (let i = -1; i <= 1; ++i)
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: nx * 5.25 + i * 0.9,
            vy: ny * 5.25,
            bossBullet: true,
          });
        break;
      }
      case 'rain':
        for (let i = 0; i < 7; ++i)
          alienBullets.push({
            x: boss.x + (i / 6) * BOSS_W,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: 0,
            vy: 3 + rand() * 2.25,
            bossBullet: true,
          });
        break;
      case 'spiral':
        for (let i = 0; i < 8; ++i) {
          const angle = (i / 8) * Math.PI * 2 + boss.movePhase;
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3 + 2.25,
            bossBullet: true,
          });
        }
        break;
    }
    ++boss.currentPattern;
  }

  function damageBoss(amount, fromSpecial) {
    if (!boss) return;
    boss.hp -= (amount === undefined ? 1 : amount);
    addSpecialCharge(1);
    boss.flash = 0.06;
    if (fromSpecial)
      hitStop = 0.05;
    playSfx('hit', { pitch: 1.4, volume: 0.4 });

    addFlare(boss.x + BOSS_W / 2, boss.y + BOSS_H / 2, 'white', 30, 0.12);

    particles.burst(boss.x + BOSS_W / 2, boss.y + BOSS_H / 2, 6, {
      speed: 2,
      color: '#ff0',
      size: 2,
      life: 0.3,
    });

    if (boss.hp <= 0)
      bossDeath();
  }

  function bossDeath() {
    ++save.stats.bosses;
    const bossScore = boss.maxHp * 100;
    score += bossScore;

    const bx = boss.x;
    const by = boss.y;

    /* 1.6 s cascade of explosions across the boss box, driven by the update loop */
    bossFinaleBox = { x: bx, y: by };
    bossFinale = 1.6;
    bossFinaleTick = 0;
    hitStop = 0.12;

    shake.trigger(12, 600);
    playSfx('explode', { pitch: 0.7 });
    playSfx('win');

    floatingText.add(bx + BOSS_W / 2, by, '+' + bossScore, {
      color: '#ff0',
      font: 'bold 33px sans-serif',
    });

    for (let i = 0; i < 3; ++i)
      spawnPowerup(
        bx + BOSS_W * (0.2 + i * 0.3),
        by + BOSS_H / 2
      );

    boss = null;
    bossActive = false;
    bossVictoryTimer = 2500;
    gameState = 'bossVictory';
    updateStatusBar();
  }

  /* ================================================================
   *  KILL PLAYER
   * ================================================================ */

  function killPlayer() {
    if (!player.alive) return;
    if (invuln > 0) return;
    if (activePowerups.shield && activePowerups.shield > 0) {
      activePowerups.shield = 0;
      delete activePowerups.shield;
      particles.sparkle(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 15, { color: '#88f' });
      playSfx('zap', { pitch: 1.2, volume: 0.5 });
      triggerFlash('#88f', 0.3);
      shake.trigger(4, 200);
      return;
    }

    player.alive = false;
    --lives;
    ++livesLost;
    deathTimer = 2000;
    gameState = 'dying';
    specialActive = 0;
    specialKind = '';
    novaRing = null;
    dash = null;

    particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 30, {
      speed: 5,
      color: '#f80',
      gravity: 0.08,
      size: 4,
    });
    particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 15, {
      speed: 3,
      color: '#f00',
      gravity: 0.05,
      size: 3,
    });
    playerDeathFx();
    triggerFlash('#f44', 0.3);
    playSfx('explode');
  }

  /* ================================================================
   *  SCREEN FLASH
   * ================================================================ */

  function triggerFlash(color, intensity) {
    screenFlashAlpha = intensity;
    screenFlashColor = color;
  }

  /* ================================================================
   *  UPDATE
   * ================================================================ */

  function update(dt) {
    gameTime += dt;

    if (screenFlashAlpha > 0)
      screenFlashAlpha = Math.max(0, screenFlashAlpha - dt * 0.0012);

    if (fade > 0)
      fade = Math.max(0, fade - dt * 0.0035);
    if (sweep > 0)
      sweep = Math.max(0, sweep - dt / 1000);

    updateFx(dt);

    /* Hit-stop: the world keeps drawing and its effects keep moving, but the
       simulation itself holds for a beat so heavy impacts read as heavy */
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt / 1000);
      particles.update();
      shake.update(dt);
      floatingText.update();
      return;
    }

    if (isMenuState(gameState) || gameState === 'gameover' || gameState === 'stageClear') {
      shake.update(dt);   // let a shake from the last fight die out on menus
      return;
    }

    if (gameState === 'paused')
      return;

    if (gameState === 'bossIntro') {
      updateBoss(dt);
      particles.update();
      return;
    }

    if (gameState === 'bossVictory') {
      bossVictoryTimer -= dt;
      if (bossFinale > 0 && bossFinaleBox) {
        bossFinale -= dt / 1000;
        bossFinaleTick += dt / 1000;
        while (bossFinaleTick >= 0.12 && bossFinale > 0) {
          bossFinaleTick -= 0.12;
          const ox = bossFinaleBox.x + rand() * BOSS_W;
          const oy = bossFinaleBox.y + rand() * BOSS_H;
          addFlare(ox, oy, 'white', 100, 0.4);
          addDebris(ox, oy, 8, ['#f44', '#fa0', '#ff0', '#f0f']);
          addRing(ox, oy, '#ff8a3a', 6, 70, 0.3);
          particles.burst(ox, oy, 14, { speed: 4, color: '#fa0', gravity: 0.05, size: 3 });
        }
        if (bossFinale <= 0) {
          triggerFlash('#fff', 0.8);
          particles.confetti(bossFinaleBox.x + BOSS_W / 2, bossFinaleBox.y + BOSS_H / 2, 40);
          playSfx('explode', { pitch: 0.6 });
          bossFinaleBox = null;
        }
      }
      particles.update();
      floatingText.update();
      shake.update(dt);
      if (bossVictoryTimer <= 0) {
        const allDead = aliens.every(a => !a.alive);
        if (allDead) {
          if (gameMode === 'campaign') {
            finishStage();
          } else {
            gameState = 'levelComplete';
            levelCompleteTimer = 1500;
            sweep = 0.6;
            particles.confetti(GAME_W / 2, GAME_H / 2, 30);
          }
        } else
          gameState = 'playing';
      }
      return;
    }

    if (gameState === 'dying') {
      deathTimer -= dt;
      /* Slow motion: for the first beat after the crash the field keeps moving at 30 % */
      if (dyingSlow > 0) {
        dyingSlow = Math.max(0, dyingSlow - dt / 1000);
        for (let i = alienBullets.length - 1; i >= 0; --i) {
          const b = alienBullets[i];
          b.x += (b.vx || 0) * 0.3;
          b.y += (b.vy || ALIEN_BULLET_SPEED) * 0.3;
          if (b.y > GAME_H + 15 || b.x < -45 || b.x > GAME_W + 45)
            alienBullets.splice(i, 1);
        }
        alienMoveTimer += dt * 0.3;
        if (alienMoveTimer >= alienMoveInterval) {
          alienMoveTimer = 0;
          moveAliens();
        }
        updateDivers(dt * 0.3);
      }
      particles.update();
      shake.update(dt);
      floatingText.update();
      if (deathTimer <= 0) {
        if (lives <= 0) {
          gameState = 'gameover';
          menuCursor = 0;
          playSfx('lose');
          endRun();
          if (gameMode === 'classic' || gameMode === 'survival' || gameMode === 'bossRush')
            checkHighScore();
        } else {
          player.x = GAME_W / 2 - PLAYER_W / 2;
          player.alive = true;
          playerBullets = [];
          alienBullets = [];
          gameState = 'playing';
        }
      }
      return;
    }

    if (gameState === 'levelComplete') {
      levelCompleteTimer -= dt;
      particles.update();
      floatingText.update();
      if (levelCompleteTimer <= 0) {
        if (gameMode === 'survival')
          startSurvivalNextWave();
        else
          startNextLevel();
      }
      return;
    }

    const slowMoActive = activePowerups.slowMo > 0 || (specialActive > 0 && specialKind === 'phase');
    const alienDt = slowMoActive ? dt * 0.4 : dt;

    // Wave name fade
    if (waveNameTimer > 0)
      waveNameTimer -= dt;

    // Alien hit flash
    for (const a of aliens)
      if (a.flash > 0)
        a.flash = Math.max(0, a.flash - dt / 1000);

    // Player movement
    if (player.alive) {
      const ship = SHIP_DEFS[currentShipId()];
      const moveSpeed = PLAYER_SPEED * ship.speed * (1 + 0.08 * treeLevel('e_speed'));

      if (dash) {
        dash.t += dt;
        player.x += dash.dir * 140 * dt / 120;
        player.x = Math.max(15, Math.min(GAME_W - 15 - PLAYER_W, player.x));
        particles.trail(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, {
          vy: 0,
          color: '#5af2ff',
          size: 2.5,
          life: 0.25,
        });
        if (dash.t >= 120)
          dash = null;
      }

      let tiltDir = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) {
        player.x = Math.max(15, player.x - moveSpeed);
        tiltDir = -1;
      }
      if (keys['ArrowRight'] || keys['KeyD']) {
        player.x = Math.min(GAME_W - 15 - PLAYER_W, player.x + moveSpeed);
        tiltDir = 1;
      }

      /* Mouse: move player toward cursor X */
      if (mouseActive && mouseGameX >= 0) {
        const targetX = mouseGameX - PLAYER_W / 2;
        const dx = targetX - player.x;
        if (Math.abs(dx) > 1) {
          const step = Math.min(Math.abs(dx), moveSpeed);
          player.x += Math.sign(dx) * step;
          if (tiltDir === 0) tiltDir = Math.sign(dx);
        }
        player.x = Math.max(15, Math.min(GAME_W - 15 - PLAYER_W, player.x));
      }

      player.tilt += (tiltDir - player.tilt) * 0.2;

      /* Engine trail: a puff under the ship every other frame while moving */
      if (tiltDir !== 0 || dash) {
        ++trailFrame;
        if (trailFrame % 2 === 0) {
          trails.push({
            x: player.x + PLAYER_W / 2 + (rand() - 0.5) * 8,
            y: player.y + PLAYER_H + 3,
            vy: 1.5,
            life: 0.3,
            color: '#bfe8ff',
          });
          if (trails.length > 60)
            trails.splice(0, trails.length - 60);
        }
      }

      // Shooting
      if (playerShootCooldown > 0)
        playerShootCooldown -= dt;

      const cooldown = (activePowerups.rapidFire > 0 ? 100 : 300)
        * ship.fire * (1 - 0.15 * treeLevel('w_rate'));
      const maxBullets = 2
        + (activePowerups.rapidFire > 0 ? 2 : 0)
        + (activePowerups.tripleShot > 0 ? 4 : 0);
      const nonDroneBullets = playerBullets.filter(b => !b.fromDrone).length;

      if ((keys['Space'] || keys['ArrowUp'] || mouseDown) && playerShootCooldown <= 0 && nonDroneBullets < maxBullets) {
        const isLaser = activePowerups.laser > 0;
        const bw = isLaser ? LASER_W : BULLET_W;
        const bspd = BULLET_SPEED * (1 + 0.15 * treeLevel('w_speed'));
        const offsets = treeLevel('w_twin') > 0 ? [-8, 8] : [0];

        for (const off of offsets) {
          const bx = player.x + PLAYER_W / 2 + off - bw / 2;
          if (activePowerups.tripleShot > 0) {
            playerBullets.push(
              { x: bx, y: player.y - BULLET_H, vx: 0, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser },
              { x: bx - 12, y: player.y - BULLET_H + 6, vx: -1.8, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser },
              { x: bx + 12, y: player.y - BULLET_H + 6, vx: 1.8, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser }
            );
          } else
            playerBullets.push({
              x: bx,
              y: player.y - BULLET_H,
              vx: 0,
              vy: -bspd,
              w: bw,
              h: BULLET_H,
              piercing: isLaser,
            });
        }

        addFlare(player.x + PLAYER_W / 2, player.y - 4, 'cyan', 14, 0.06);
        playerShootCooldown = cooldown;
        if (isLaser)
          playSfx('laser', { volume: 0.3 });
        else
          playSfx('shoot', { pitch: 1.1 + rand() * 0.1, volume: 0.35 });
      }
    }

    // Player bullets
    for (let i = playerBullets.length - 1; i >= 0; --i) {
      const b = playerBullets[i];
      b.x += (b.vx || 0);
      b.y += (b.vy || -BULLET_SPEED);
      if (b.y + (b.h || BULLET_H) < 0 || b.x < -30 || b.x > GAME_W + 30)
        playerBullets.splice(i, 1);
      else if (Math.random() < 0.25) {
        const bw = b.w || BULLET_W;
        particles.trail(b.x + bw / 2, b.y + (b.h || BULLET_H), {
          vy: 0.8,
          color: b.piercing ? '#f0f' : (b.fromDrone ? '#8f8' : '#0f0'),
          size: 1,
          life: 0.2,
        });
      }
    }

    // Alien movement
    alienMoveTimer += alienDt;
    if (alienMoveTimer >= alienMoveInterval) {
      alienMoveTimer = 0;
      moveAliens();
      tryDiveAttack();
    }

    // Alien shooting
    alienShootTimer += alienDt;
    if (alienShootTimer >= alienShootInterval) {
      alienShootTimer = 0;
      alienShoot();
    }

    // Alien bullets
    const barrierOn = specialActive > 0 && specialKind === 'barrier';
    for (let i = alienBullets.length - 1; i >= 0; --i) {
      const b = alienBullets[i];
      b.x += (b.vx || 0) * (slowMoActive ? 0.4 : 1);
      b.y += (b.vy || ALIEN_BULLET_SPEED) * (slowMoActive ? 0.4 : 1);
      if (b.y > GAME_H + 15 || b.x < -45 || b.x > GAME_W + 45) {
        alienBullets.splice(i, 1);
        continue;
      }
      if (barrierOn && player.alive) {
        const bcx = b.x + b.w / 2 - (player.x + PLAYER_W / 2);
        const bcy = b.y + b.h / 2 - (player.y + PLAYER_H / 2);
        if (bcx * bcx + bcy * bcy <= 70 * 70) {
          particles.sparkle(b.x + b.w / 2, b.y + b.h / 2, 4, { color: '#3af2ff' });
          alienBullets.splice(i, 1);
        }
      }
    }

    // Divers
    updateDivers(slowMoActive ? dt * 0.4 : dt);

    // UFO
    if (!ufo && !bossActive) {
      ufoTimer += dt;
      if (ufoTimer >= ufoNextSpawn) {
        spawnUfo();
        ufoTimer = 0;
        ufoNextSpawn = UFO_MIN_INTERVAL + rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
      }
    } else if (ufo) {
      ufo.x += ufo.dir * UFO_SPEED;
      /* soft sonar ping while the bonus UFO crosses the screen */
      ufoBlipTimer += dt;
      if (ufoBlipTimer >= 500) {
        ufoBlipTimer = 0;
        playSfx('blip', { volume: 0.15 });
      }
      if ((ufo.dir > 0 && ufo.x > GAME_W + UFO_W) || (ufo.dir < 0 && ufo.x + UFO_W < -UFO_W))
        ufo = null;
    }

    // Boss
    if (bossActive && gameState === 'playing')
      updateBoss(dt);

    // Drone
    updateDrone(dt);

    // Powerups
    updateFallingPowerups(dt);
    updateActivePowerups(dt);

    // Combo
    updateCombo(dt);

    // Special ability + dash timers
    if (specialActive > 0) {
      specialActive -= dt;
      if (specialActive <= 0) {
        specialActive = 0;
        specialKind = '';
      }
    }
    if (invuln > 0)
      invuln = Math.max(0, invuln - dt);
    if (dashCooldown > 0)
      dashCooldown = Math.max(0, dashCooldown - dt);
    if (specialKind === 'railgun' && specialActive > 0)
      tickRailgun(dt);
    updateNova(dt);

    // Collision: player bullets vs aliens
    for (let bi = playerBullets.length - 1; bi >= 0; --bi) {
      const b = playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let hitSomething = false;

      for (const a of aliens) {
        if (!a.alive) continue;
        if (!rectsOverlap(b.x, b.y, bw, bh, a.x, a.y, a.w, a.h)) continue;

        if (a.shielded && a.shieldHP > 0) {
          --a.shieldHP;
          if (a.shieldHP <= 0) a.shielded = false;
          a.flash = 0.08;
          particles.sparkle(a.x + a.w / 2, a.y + a.h / 2, 8, { color: '#4ff' });
          particles.burst(b.x + bw / 2, b.y + bh / 2, 4, { speed: 2.5, color: '#ffd23f', size: 1.5, life: 0.25 });
          playSfx('click', { pitch: 0.7 });
          if (!b.piercing) {
            playerBullets.splice(bi, 1);
            hitSomething = true;
            break;
          }
          continue;
        }

        a.hp -= bulletDamage();
        if (a.hp > 0) {
          a.flash = 0.08;
          playSfx('hit', { pitch: 1.2, volume: 0.5 });
          particles.burst(b.x + bw / 2, b.y + bh / 2, 4, { speed: 2.5, color: '#ffd23f', size: 1.5, life: 0.25 });
          if (!b.piercing) {
            playerBullets.splice(bi, 1);
            hitSomething = true;
            break;
          }
          continue;
        }

        destroyAlien(a);

        if (!b.piercing) {
          playerBullets.splice(bi, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Player bullets vs UFO
      if (ufo && rectsOverlap(b.x, b.y, bw, bh, ufo.x, ufo.y, ufo.w, ufo.h)) {
        score += ufo.points;
        playSfx('explode', { pitch: 1.4, volume: 0.7 });
        playSfx('coin');
        addFlare(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, 'purple', 80, 0.4);
        addRing(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, '#ffd23f', 8, 70, 0.35);
        particles.burst(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, 20, {
          speed: 4,
          color: '#f0f',
          gravity: 0.03,
        });
        particles.sparkle(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, 14, { color: '#ffd23f' });
        floatingText.add(ufo.x + ufo.w / 2, ufo.y, '+' + ufo.points, {
          color: '#ffd23f',
          font: 'bold 30px sans-serif',
        });
        spawnPowerup(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2);
        ufo = null;
        if (!b.piercing)
          playerBullets.splice(bi, 1);
        continue;
      }

      // Player bullets vs boss
      if (bossActive && boss && rectsOverlap(b.x, b.y, bw, bh, boss.x, boss.y, BOSS_W, BOSS_H)) {
        damageBoss(bulletDamage());
        if (!b.piercing)
          playerBullets.splice(bi, 1);
        continue;
      }
    }

    // Player bullets vs shields
    for (let bi = playerBullets.length - 1; bi >= 0; --bi) {
      if (playerBullets[bi].piercing) continue;
      const b = playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let destroyed = false;
      for (const shieldBlocks of shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, bw, bh, s.x, s.y, s.w, s.h)) {
            --s.hp;
            if (s.hp <= 0) s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            playSfx('thud', { volume: 0.25 });
            playerBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }

    // Alien bullets vs shields
    for (let bi = alienBullets.length - 1; bi >= 0; --bi) {
      const b = alienBullets[bi];
      let destroyed = false;
      for (const shieldBlocks of shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) {
            --s.hp;
            if (s.hp <= 0) s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            playSfx('thud', { volume: 0.25 });
            alienBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }

    // Alien bullets vs player
    if (player.alive) {
      for (let bi = alienBullets.length - 1; bi >= 0; --bi) {
        const b = alienBullets[bi];
        if (rectsOverlap(b.x, b.y, b.w, b.h, player.x, player.y, PLAYER_W, PLAYER_H)) {
          alienBullets.splice(bi, 1);
          killPlayer();
          break;
        }
      }
    }

    // Aliens reaching player row (instant game over, shield cannot save this)
    for (const a of aliens) {
      if (a.alive && !a.diving && a.y + a.h >= player.y) {
        if (activePowerups.shield > 0)
          delete activePowerups.shield;
        player.alive = false;
        lives = 0;
        ++livesLost;
        deathTimer = 2000;
        gameState = 'dying';
        playerDeathFx();
        particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 30, {
          speed: 5, color: '#f80', gravity: 0.08, size: 4,
        });
        triggerFlash('#f44', 0.3);
        playSfx('explode');
        break;
      }
    }

    // Level complete check
    const allAliensDead = aliens.every(a => !a.alive) && divers.length === 0;

    if (allAliensDead && gameState === 'playing' && !bossActive) {
      if (gameMode === 'campaign') {
        playSfx('levelup');
        finishStage();
      } else if (gameMode === 'survival') {
        gameState = 'levelComplete';
        levelCompleteTimer = 800;
        sweep = 0.6;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 20);
        playSfx('levelup');
      } else {
        gameState = 'levelComplete';
        levelCompleteTimer = 1500;
        sweep = 0.6;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 30);
        playSfx('levelup');
      }
    }

    // Boss level: if boss is active and all escorts dead, boss still fights alone
    // (boss defeat triggers bossVictory → levelComplete automatically)

    // Update effects
    particles.update();
    shake.update(dt);
    floatingText.update();

    updateStatusBar();
  }

  /* ================================================================
   *  DRAW
   * ================================================================ */

  function drawStarShape(cx, cy, r, earned) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = earned ? ui.UI.gold : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = earned ? ui.UI.goldDeep : ui.UI.textMute;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawTick(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x - 2, y + 6);
    ctx.lineTo(x + 8, y - 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawCross(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    hitAreas.length = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.translate(gameOffsetX, gameOffsetY);
    ctx.scale(gameScale, gameScale);

    ctx.save();

    // Sector backdrop, out to the edges of the canvas
    if (backdrop)
      backdrop.draw(ctx, gameTime / 1000, visibleRect());

    shake.apply(ctx);

    // Menu screens replace the whole battlefield
    if (isMenuState(gameState)) {
      if (gameState === 'title')
        drawTitleScreen();
      else if (gameState === 'campaignMap')
        drawCampaignMap();
      else if (gameState === 'hangar')
        drawHangar();
      else if (gameState === 'armory')
        drawArmory();
      else
        drawHelp();
      shake.restore(ctx);
      ctx.restore();
      if (screenFlashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = screenFlashAlpha;
        ctx.fillStyle = screenFlashColor;
        fillVisible();
        ctx.restore();
      }
      drawFade();
      return;
    }

    // Bunkers: energy-crystal wall, damaged blocks sit darker
    for (const shieldBlocks of shields)
      for (const s of shieldBlocks)
        if (s.alive) {
          ctx.globalAlpha = s.hp < s.maxHp ? 0.55 : 1;
          ctx.fillStyle = BUNKER_ROW_COLORS[s.row];
          ctx.fillRect(s.x, s.y, s.w, s.h);
        }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(200,251,255,0.6)';
    for (const shieldBlocks of shields)
      for (const s of shieldBlocks)
        if (s.alive && s.hp >= s.maxHp)
          ctx.fillRect(s.x, s.y, s.w, 1);

    // Aliens
    for (const a of aliens) {
      if (!a.alive) continue;
      SZ.InvaderArt.drawAlien(ctx, a.diving ? 4 : (a.species || 3), a.x, a.y, alienFrame % 2, a.flash > 0);

      if (a.shielded && a.shieldHP > 0) {
        ctx.save();
        ctx.strokeStyle = '#3af2ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7 + 4, a.h * 0.7 + 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7 + 7, a.h * 0.7 + 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Boss
    if (boss) {
      const phase2 = boss.hp <= boss.maxHp / 2;

      /* During the entrance the descending boss drags a growing shadow along */
      if (gameState === 'bossIntro') {
        const prog = Math.max(0, Math.min(1, (boss.y + BOSS_H + 30) / (boss.targetY + BOSS_H + 30)));
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.25 * prog;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(boss.x + BOSS_W / 2, boss.y + BOSS_H + 30, BOSS_W * (0.25 + 0.3 * prog), 14 + 10 * prog, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.scale(BOSS_W / BOSS_SPRITE_W, BOSS_H / BOSS_SPRITE_H);
      SZ.InvaderArt.drawBoss(ctx, boss.design !== undefined ? boss.design : 0, 0, 0, phase2, boss.flash > 0);
      ctx.restore();
    }

    // Player
    if (player.alive) {
      const moving = (keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])
        || (mouseActive && mouseGameX >= 0 && Math.abs(mouseGameX - (player.x + PLAYER_W / 2)) > 1);
      let thrust = (moving ? 3 : 1) + (Math.floor(gameTime / 60) % 2);
      thrust = Math.max(0, Math.min(3, thrust));
      const phaseOn = specialActive > 0 && specialKind === 'phase';
      SZ.InvaderArt.drawShip(ctx, currentShipId(), player.x + PLAYER_W / 2, player.y, thrust, player.tilt, phaseOn ? 0.45 : 1);

      if (phaseOn) {
        ctx.save();
        ctx.strokeStyle = '#b06aff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(gameTime * 0.012);
        ctx.beginPath();
        ctx.ellipse(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W * 0.85, PLAYER_H * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (activePowerups.shield > 0) {
        ctx.save();
        const shieldAlpha = 0.25 + Math.sin(gameTime * 0.008) * 0.1;
        ctx.globalAlpha = shieldAlpha;
        ctx.strokeStyle = '#88f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W * 0.8, PLAYER_H * 1.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,100,255,0.08)';
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.ellipse(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W * 0.95, PLAYER_H * 1.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Drone
    if (drone)
      SZ.InvaderArt.drawDrone(ctx, drone.x + DRONE_W / 2, drone.y + DRONE_H / 2, gameTime / 1000);

    // Special ability visuals
    if (specialActive > 0 && specialKind === 'railgun' && player.alive) {
      const rx = player.x + PLAYER_W / 2;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(rx - 9, 0, 18, player.y);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx - 2.5, 0, 5, player.y);
      ctx.restore();
    }
    if (specialActive > 0 && specialKind === 'barrier' && player.alive) {
      const bx = player.x + PLAYER_W / 2, by = player.y + PLAYER_H / 2;
      ctx.save();
      ctx.strokeStyle = '#3af2ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(gameTime * 0.01);
      ctx.beginPath();
      ctx.arc(bx, by, 70, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, 78, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (novaRing) {
      const prog = Math.min(1, novaRing.t / 500);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 10 * (1 - prog) + 2;
      ctx.beginPath();
      ctx.arc(novaRing.cx, novaRing.cy, novaRing.maxR * prog, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Player bullets
    for (const b of playerBullets) {
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      if (b.piercing)
        SZ.InvaderArt.drawBullet(ctx, 'laser', b.x + bw / 2, b.y + bh, bh);
      else
        SZ.InvaderArt.drawBullet(ctx, 'player', b.x + bw / 2, b.y + bh / 2);
    }

    // Alien bullets
    for (const b of alienBullets)
      SZ.InvaderArt.drawBullet(ctx, b.bossBullet ? 'orb' : 'alien', b.x + b.w / 2, b.y + b.h / 2);

    // UFO
    if (ufo)
      SZ.InvaderArt.drawUfo(ctx, ufo.x, ufo.y, gameTime / 1000);

    // Falling powerups
    for (const p of fallingPowerups)
      SZ.InvaderArt.drawCapsule(ctx, p.def.id, p.x + POWERUP_SIZE / 2,
        p.y + POWERUP_SIZE / 2 + Math.sin(gameTime * 0.004) * 4.5, gameTime / 1000);

    // Explosion flares
    for (const f of flares)
      SZ.InvaderArt.drawFlare(ctx, f.color, f.x, f.y,
        f.r * (0.6 + 0.4 * f.t / f.life), 1 - f.t / f.life);

    // Engine trails
    for (const t of trails) {
      ctx.globalAlpha = Math.max(0, t.life / 0.3) * 0.6;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Debris shards: small rotating triangles fading out
    for (const d of debris) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / 0.6);
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(0, -d.size);
      ctx.lineTo(d.size * 0.8, d.size * 0.7);
      ctx.lineTo(-d.size * 0.8, d.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shockwave rings
    for (const r of rings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    shake.restore(ctx);
    ctx.restore();

    // HUD (logical coordinates, above the shaken world)
    if (!isMenuState(gameState))
      drawHud();

    // Overlays (drawn in game coordinate space)
    ctx.save();

    // Wave name announcement
    if (waveNameTimer > 0 && gameState === 'playing') {
      const alpha = Math.min(1, waveNameTimer / 500);
      ctx.save();
      ctx.globalAlpha = alpha;
      const bw = 460, bh = 120;
      const bx = GAME_W / 2 - bw / 2, by = GAME_H / 2 - 30 - bh / 2;
      ui.drawPanel(bx, by, bw, bh, { accent: ui.UI.accent });
      ui.drawHeadline(waveNameText, GAME_W / 2, by + 44, bw - 48, 26, '#e4eaf6', ui.UI.accent);
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Level ' + level, GAME_W / 2, by + 84);
      ctx.restore();
    }

    if (gameState === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      fillVisible();
      const pw = 420, ph = 280;
      const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
      ui.drawPanel(px, py, pw, ph, { accent: ui.UI.accent });
      ui.drawHeadline('PAUSED', GAME_W / 2, py + 48, pw - 48, 42, '#e4eaf6', ui.UI.accent);
      drawButton('pause-resume', 'Resume', GAME_W / 2 - 160, py + 92, 320, 48,
        { action: () => { gameState = 'playing'; } });
      drawButton('pause-restart', 'Restart', GAME_W / 2 - 160, py + 148, 320, 48,
        { action: restartRun });
      drawButton('pause-quit', 'Quit to Menu', GAME_W / 2 - 160, py + 204, 320, 48,
        { action: quitToMenu });
    }

    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      fillVisible();
      const pw = 520, ph = 360;
      const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
      ui.drawPanel(px, py, pw, ph, { accent: ui.UI.bad });
      ui.drawHeadline('GAME OVER', GAME_W / 2, py + 56, pw - 48, 48, ui.UI.bad, '#8a1424');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ui.UI.gold;
      ctx.font = ui.uiFont(27, 'bold');
      ctx.fillText('Score: ' + score, GAME_W / 2, py + 118);
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(21);
      const runLabel = gameMode === 'campaign' && stageInfo
        ? stageInfo.id + ' ' + stageInfo.name
        : MODES[gameMode].name + ' - Level ' + level;
      ctx.fillText(runLabel, GAME_W / 2, py + 158);
      if (runResult) {
        ctx.fillStyle = ui.UI.gold;
        ctx.font = ui.uiFont(22, 'bold');
        ctx.fillText('+' + runResult.credits + ' credits' + (runResult.newBest ? '  ·  NEW BEST' : ''),
          GAME_W / 2, py + 200);
      }
      drawButton('go-retry', 'Retry', GAME_W / 2 - 210, py + 262, 200, 48,
        { px: 18, action: restartRun });
      drawButton('go-menu', 'Menu', GAME_W / 2 + 10, py + 262, 200, 48,
        { px: 18, action: quitToMenu });
    }

    if (gameState === 'stageClear') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      fillVisible();
      const pw = 560, ph = 440;
      const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
      ui.drawPanel(px, py, pw, ph, { accent: ui.UI.gold });
      ui.drawHeadline(stageInfo.name, GAME_W / 2, py + 52, pw - 48, 36, ui.UI.gold, ui.UI.goldDeep);

      const stars = stageResult ? stageResult.stars : 0;
      for (let i = 0; i < 3; ++i)
        drawStarShape(GAME_W / 2 + (i - 1) * 64, py + 112, 22, i < stars);
      /* one rising coin pop per earned star, spaced a third of a second apart */
      if (stageStarBeats < stars && gameTime >= stageClearTime + stageStarBeats * 300) {
        playSfx('coin', { pitch: 1 + stageStarBeats * 0.15 });
        ++stageStarBeats;
      }

      const starText = SZ.InvaderCampaign.STAR_TEXT(stageInfo);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; ++i) {
        const y = py + 172 + i * 34;
        const earned = i < stars;
        if (earned) drawTick(GAME_W / 2 - 190, y, ui.UI.good);
        else drawCross(GAME_W / 2 - 190, y, ui.UI.bad);
        ctx.fillStyle = earned ? ui.UI.text : ui.UI.textMute;
        ctx.font = ui.uiFont(19);
        ctx.fillText(starText[i], GAME_W / 2 - 166, y);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = ui.UI.text;
      ctx.font = ui.uiFont(24, 'bold');
      ctx.fillText('Score: ' + (stageResult ? stageResult.score : score), GAME_W / 2, py + 292);
      ctx.fillStyle = ui.UI.gold;
      ctx.font = ui.uiFont(22, 'bold');
      ctx.fillText('+' + (stageResult ? stageResult.credits : 0) + ' credits', GAME_W / 2, py + 326);
      const scButtons = [];
      const nextStageInfo = SZ.InvaderCampaign.nextStage(stageInfo.id);
      if (nextStageInfo)
        scButtons.push({ label: 'Next Stage', action: () => startStage(SZ.InvaderCampaign.stageIndexById(nextStageInfo.id)) });
      scButtons.push({ label: 'Replay', action: () => startStage(stageIndex) });
      scButtons.push({ label: 'Campaign Map', action: () => setScreen('campaignMap') });
      const scW = 160, scGap = 12;
      const scTotal = scButtons.length * scW + (scButtons.length - 1) * scGap;
      for (let i = 0; i < scButtons.length; ++i)
        drawButton('sc-' + i, scButtons[i].label, GAME_W / 2 - scTotal / 2 + i * (scW + scGap), py + ph - 66, scW, 44,
          { px: 16, action: scButtons[i].action });
    }

    if (gameState === 'levelComplete') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      fillVisible();
      const pw = 460, ph = 120;
      const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
      ui.drawPanel(px, py, pw, ph, { accent: ui.UI.accent });
      const text = gameMode === 'survival' ? 'WAVE CLEAR' : 'LEVEL CLEAR';
      ui.drawHeadline(text, GAME_W / 2, GAME_H / 2, pw - 48, 36, '#5af2ff', ui.UI.accent);
    }

    // Wave-clear light sweep, only while visible
    if (sweep > 0) {
      const v = visibleRect();
      const sp = 1 - sweep / 0.6;
      const scx = (v.x0 - 160) + sp * ((v.x1 - v.x0) + 320);
      const sg = ctx.createLinearGradient(scx - 80, 0, scx + 80, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(scx - 80, v.y0, 160, v.y1 - v.y0);
    }

    // Combo pop-up: big multiplier scaling down from 1.6
    if (comboPop) {
      const cp = comboPop.t / 0.5;
      const cscale = 1.6 - 0.6 * cp;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - cp);
      ctx.translate(GAME_W / 2, GAME_H / 2 - 60);
      ctx.scale(cscale, cscale);
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      ctx.strokeText(comboPop.text, 0, 0);
      ctx.fillStyle = comboPop.color;
      ctx.fillText(comboPop.text, 0, 0);
      ctx.restore();
    }

    if (gameState === 'bossIntro') {
      drawWarningStripes();
      if (bossWarningTimer > 1000 && boss) {
        const flash = Math.sin(gameTime * 0.015) > 0;
        const pulse = 1 + 0.05 * Math.sin(gameTime * 0.012);
        const pw = 460, ph = 150;
        const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - 30 - ph / 2;
        ui.drawPanel(px, py, pw, ph, { accent: flash ? ui.UI.bad : '#800' });
        ctx.save();
        ctx.translate(GAME_W / 2, GAME_H / 2 - 30);
        ctx.scale(pulse, pulse);
        ctx.translate(-GAME_W / 2, -(GAME_H / 2 - 30));
        ui.drawHeadline('WARNING', GAME_W / 2, GAME_H / 2 - 30, pw - 48, 54,
          flash ? '#ff5a5a' : '#aa3333', '#800');
        ctx.restore();
        const bspec = SZ.InvaderArt.BOSSES[boss.design] || SZ.InvaderArt.BOSSES[0];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = bspec.color || ui.UI.gold;
        ctx.font = ui.uiFont(24, 'bold');
        ctx.fillText(boss.name || bspec.name, GAME_W / 2, GAME_H / 2 + 12);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(18);
        ctx.fillText('Boss approaching...', GAME_W / 2, GAME_H / 2 + 36);
      }
    }

    if (gameState === 'bossVictory')
      ui.drawHeadline('BOSS DEFEATED!', GAME_W / 2, GAME_H / 2 - 15, 520, 42, ui.UI.gold, ui.UI.goldDeep);

    ctx.restore();

    // Screen flash (in game coordinates)
    if (screenFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = screenFlashAlpha;
      ctx.fillStyle = screenFlashColor;
      fillVisible();
      ctx.restore();
    }

    drawFade();
  }

  /* Black veil over everything while a screen transition runs */
  function drawFade() {
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#000';
    fillVisible();
    ctx.restore();
  }

  /* Diagonal red hazard bands scrolling across top and bottom during a boss entrance */
  function drawWarningStripes() {
    const bandH = 44, step = 48;
    const off = (gameTime * 0.15) % step;
    const v = visibleRect();
    ctx.save();
    for (let band = 0; band < 2; ++band) {
      const y0 = band === 0 ? v.y0 : v.y1 - bandH;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(26,2,6,0.75)';
      ctx.fillRect(v.x0, y0, v.x1 - v.x0, bandH);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ff2a2a';
      for (let x = v.x0 - step + off; x < v.x1 + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x + 22, y0);
        ctx.lineTo(x + 8, y0 + bandH);
        ctx.lineTo(x - 14, y0 + bandH);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ================================================================
   *  MENU SCREENS — shared widgets
   * ================================================================ */

  const MENU_SCREENS = ['title', 'campaignMap', 'hangar', 'armory', 'help'];

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  function setScreen(name) {
    gameState = name;
    menuCursor = 0;
    hitAreas.length = 0;
    fade = 1;
    updateStatusBar();
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
    if (!n) return;
    menuCursor = (menuCursor + d + n) % n;
    playSfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      playSfx('error');
      return;
    }
    playSfx('select');
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

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function getBackdrop(theme) {
    if (!backdropCache[theme])
      backdropCache[theme] = SZ.InvaderBackdrop.create(theme);
    return backdropCache[theme];
  }

  function countStars() {
    let n = 0;
    for (const id of Object.keys(save.stars))
      n += save.stars[id] || 0;
    return n;
  }

  function countTreeMaxed() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  function restartRun() {
    if (gameMode === 'campaign')
      startStage(stageIndex);
    else
      newGame(gameMode);
  }

  function quitToMenu() {
    setScreen(gameMode === 'campaign' ? 'campaignMap' : 'title');
  }

  function openHelp() {
    helpFrom = isMenuState(gameState) ? gameState : 'title';
    helpPage = 0;
    setScreen('help');
  }

  /* ================================================================
   *  TITLE SCREEN
   * ================================================================ */

  function drawTitleScreen() {
    setBackdrop(THEME_ORDER[Math.floor(gameTime / 9000) % THEME_ORDER.length]);
    ctx.fillStyle = 'rgba(3,4,10,0.5)';
    fillVisible();

    ui.drawHeadline('SPACE INVADERS', 640, 120, 1100, 92, '#5af2ff', '#c04cff');
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Defend Earth. Upgrade your fleet.', 640, 180);

    /* one row with each species, marching slowly left and right and bobbing up and down */
    const frame = Math.floor(gameTime / 480) % 2;
    const drift = Math.sin(gameTime * 0.0006) * 90;
    const bob = Math.sin(gameTime * 0.0012) * 10;
    const alienScale = 1.6;
    for (let s = 1; s <= 6; ++s)
      SZ.InvaderArt.drawAlien(ctx, s, 640 + (s - 3.5) * 90 + drift - alienScale * ALIEN_W / 2, 224 + bob, frame, false, alienScale);

    ui.drawChip(save.credits + ' CR', 1256, 20, 30, { align: 'right', color: ui.UI.gold });

    const ownedShips = SHIP_ORDER.filter(id => shipOwned(id)).length;
    const daily = save.best.daily;
    const items = [
      { id: 't-campaign', label: 'Campaign', sub: countStars() + ' / 90 stars', action: () => setScreen('campaignMap') },
      { id: 't-classic', label: 'Classic', sub: 'Best: ' + save.best.classic, action: () => newGame('classic') },
      { id: 't-survival', label: 'Survival', sub: 'Best: ' + save.best.survival, action: () => newGame('survival') },
      { id: 't-bossRush', label: 'Boss Rush', sub: 'Best: ' + save.best.bossRush, action: () => newGame('bossRush') },
      { id: 't-daily', label: 'Daily', sub: daily.date === todayKey() ? 'Today: ' + daily.score : 'New seed today', action: () => newGame('daily') },
      { id: 't-hangar', label: 'Hangar', sub: ownedShips + '/5 ships', action: () => { prevScreen = 'title'; setScreen('hangar'); } },
      { id: 't-armory', label: 'Armory', sub: countTreeMaxed() + '/16 upgrades', action: () => { prevScreen = 'title'; setScreen('armory'); } },
      { id: 't-help', label: 'Help', action: openHelp },
    ];

    for (let i = 0; i < items.length; ++i) {
      const x = 640 - 308 + (i % 2) * 316;
      const y = 300 + Math.floor(i / 2) * 58;
      drawButton(items[i].id, items[i].label, x, y, 300, 50, { sub: items[i].sub, action: items[i].action });
    }

    /* the ship you fly, below the buttons, burning at full thrust */
    ctx.save();
    ctx.translate(640, 592);
    ctx.scale(2, 2);
    SZ.InvaderArt.drawShip(ctx, currentShipId(), 0, 0, 3, 0, 1);
    ctx.restore();

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' },
    ], 640, 694, 900, 1);
  }

  /* ================================================================
   *  CAMPAIGN MAP SCREEN
   * ================================================================ */

  function drawCampaignMap() {
    ctx.fillStyle = 'rgba(3,4,10,0.55)';
    fillVisible();
    ui.drawHeadline('Campaign', 640, 46, 600, 40, '#5af2ff', ui.UI.accent);

    const SECTORS = SZ.InvaderCampaign.SECTORS;
    const STAGES = SZ.InvaderCampaign.STAGES;

    for (let s = 0; s < SECTORS.length; ++s) {
      const cx = 24 + (s % 3) * 421;
      const cy = 96 + Math.floor(s / 3) * 266;
      const sector = SECTORS[s];
      const unlocked = SZ.InvaderCampaign.sectorUnlocked(save.stars, s);
      let stars = 0;
      for (let k = 0; k < 5; ++k)
        stars += save.stars[(s + 1) + '-' + (k + 1)] || 0;

      /* mini backdrop of the sector theme, clipped into the card */
      ctx.save();
      ui.roundRectPath(cx, cy, 390, 250, 9);
      ctx.clip();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.3, 0.3);
      getBackdrop(sector.theme).draw(ctx, gameTime / 1000);
      ctx.restore();
      ctx.fillStyle = unlocked ? 'rgba(6,9,18,0.45)' : 'rgba(4,6,12,0.78)';
      ctx.fillRect(cx, cy, 390, 250);
      ctx.restore();
      ui.drawPanel(cx, cy, 390, 250, {
        flat: true, noStuds: true,
        accent: unlocked ? sector.boss.color : ui.UI.textMute,
        top: 'rgba(10,14,26,0.25)', bottom: 'rgba(6,8,16,0.35)',
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(sector.name, cx + 16, cy + 26, 250, 21, { weight: 'bold', color: unlocked ? ui.UI.text : ui.UI.textMute });
      ui.drawChip(stars + ' / 15', cx + 374, cy + 14, 24, {
        align: 'right', px: 13,
        color: stars ? ui.UI.gold : ui.UI.textMute,
        bg: 'rgba(4,6,14,0.8)',
      });

      if (!unlocked) {
        drawLock(cx + 195, cy + 116, 64);
        ctx.textAlign = 'center';
        ui.fitText('Defeat ' + SECTORS[s - 1].boss.name, cx + 195, cy + 184, 350, 16, { color: ui.UI.warn });
        continue;
      }

      for (let k = 0; k < 5; ++k) {
        const index = s * 5 + k;
        const stage = STAGES[index];
        const bx = cx + 18 + k * 72;
        const by = cy + 112;
        const open = SZ.InvaderCampaign.stageUnlocked(save.stars, index);
        const got = save.stars[stage.id] || 0;

        const hit = registerHit('stage-' + index, bx, by, 56, 56, () => startStage(index), !open);
        const hot = isHot(hit, bx, by, 56, 56);
        ctx.save();
        if (!open) ctx.globalAlpha *= 0.45;
        ui.drawPanel(bx, by, 56, 56, {
          radius: 8, noStuds: true, glow: hot,
          accent: hot ? ui.UI.gold : got >= 3 ? ui.UI.good : ui.UI.accent,
        });
        if (k === 4) {
          ctx.save();
          ctx.translate(bx + 28, by + 28);
          ctx.scale(0.3, 0.3);
          SZ.InvaderArt.drawBoss(ctx, s, -BOSS_SPRITE_W / 2, -BOSS_SPRITE_H / 2, false, false);
          ctx.restore();
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = ui.UI.text;
          ctx.font = ui.uiFont(22, 'bold');
          ctx.fillText(String(k + 1), bx + 28, by + 28);
        }
        if (!open) drawLock(bx + 28, by + 28, 26);
        ctx.restore();

        for (let t = 0; t < 3; ++t)
          drawStarShape(bx + 14 + t * 14, by + 70, 5, t < got);
      }
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select stage' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' },
    ], 640, 694, 900, 1);
  }

  /* ================================================================
   *  HANGAR SCREEN
   * ================================================================ */

  function drawHangar() {
    ctx.fillStyle = 'rgba(3,4,10,0.62)';
    fillVisible();
    ui.drawHeadline('Hangar', 640, 46, 600, 40, '#5af2ff', ui.UI.accent);
    ui.drawChip(save.credits + ' CR', 1256, 20, 30, { align: 'right', color: ui.UI.gold });

    const id = SHIP_ORDER[hangarCursor];
    const def = SHIP_DEFS[id];

    /* left: big preview hovering over a glowing pad */
    const padX = 300, padY = 470;
    ctx.save();
    const glow = 0.35 + 0.15 * Math.sin(gameTime * 0.003);
    const g = ctx.createRadialGradient(padX, padY, 10, padX, padY, 190);
    g.addColorStop(0, ui.hexToRgba('#5af2ff', glow));
    g.addColorStop(1, 'rgba(90,242,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(padX, padY, 190, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const hover = Math.sin(gameTime * 0.002) * 8;
    const thrust = 1 + Math.floor(gameTime / 120) % 3;
    ctx.save();
    ctx.translate(padX, padY - 110 + hover);
    ctx.scale(3.5, 3.5);
    SZ.InvaderArt.drawShip(ctx, id, 0, 0, thrust, 0, 1);
    ctx.restore();

    /* right: the ship's name as a headline, its description, stat bars vs. the Interceptor */
    ui.drawPanel(600, 100, 640, 400, { accent: ui.UI.accent });
    ui.drawHeadline(shipName(id), 920, 134, 600, 30, shipArtFor(id).color, ui.UI.accent);
    ui.drawTextBlock(def.desc, 620, 162, 600, 44, 17, { color: ui.UI.textDim });

    const rows = [
      { label: 'Speed', v: def.speed, base: 1 },
      { label: 'Fire rate', v: 1 / def.fire, base: 1 },
      { label: 'Damage', v: def.damage, base: 1 },
      { label: 'Hull', v: 3 + def.lives, base: 3 },
    ];
    for (let i = 0; i < rows.length; ++i) {
      const r = rows[i];
      const y = 210 + i * 44;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(15, 'bold');
      ctx.fillText(r.label, 620, y);
      const better = r.v > r.base, worse = r.v < r.base;
      ui.drawMeter(760, y - 6, 380, 12, r.v / HANGAR_STAT_MAX[r.label],
        better ? ui.UI.good : worse ? ui.UI.warn : ui.UI.accent);
      const markerX = 760 + 380 * (r.base / HANGAR_STAT_MAX[r.label]);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(markerX, y - 9);
      ctx.lineTo(markerX, y + 9);
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = ui.UI.text;
    ctx.font = ui.uiFont(17, 'bold');
    ctx.fillText('Special: ' + def.specialName, 620, 400);

    let status, statusColor;
    if (save.ship === id && shipOwned(id)) {
      status = 'Selected';
      statusColor = ui.UI.good;
    } else if (shipOwned(id)) {
      status = 'Owned - Enter to select';
      statusColor = ui.UI.text;
    } else if (!shipAvailable(id)) {
      status = 'Defeat stage ' + def.unlock + ' to unlock';
      statusColor = ui.UI.warn;
    } else if (def.unlock) {
      status = 'Free - Enter to claim';
      statusColor = ui.UI.gold;
    } else {
      status = 'Buy for ' + def.price + ' credits';
      statusColor = ui.UI.gold;
    }
    ctx.fillStyle = statusColor;
    ctx.font = ui.uiFont(19, 'bold');
    ctx.fillText(status, 620, 450);

    /* bottom: five ship cards */
    for (let i = 0; i < SHIP_ORDER.length; ++i) {
      const sid = SHIP_ORDER[i];
      const sdef = SHIP_DEFS[sid];
      const x = 33 + i * 246;
      const y = 540;
      const sel = i === hangarCursor;
      const hit = registerHit('ship-' + sid, x, y, 230, 140, () => {
        if (hangarCursor !== i) {
          hangarCursor = i;
          playSfx('click', { volume: 0.4 });
        } else {
          buyShip(sid);
        }
      });
      const hot = isHot(hit, x, y, 230, 140);
      ctx.save();
      if (!shipAvailable(sid)) ctx.globalAlpha *= 0.55;
      ui.drawPanel(x, y, 230, 140, {
        accent: sel ? ui.UI.gold : hot ? ui.UI.accent : ui.UI.textMute,
        glow: sel,
      });
      SZ.InvaderArt.drawShip(ctx, sid, x + 115, y + 44, 1, 0, 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(shipName(sid), x + 115, y + 92, 200, 16, { weight: 'bold', color: sel ? '#ffffff' : ui.UI.text });
      let tag, tagColor;
      if (!shipAvailable(sid)) { tag = 'Stage ' + sdef.unlock; tagColor = ui.UI.warn; }
      else if (shipOwned(sid)) { tag = shipIdOwnedTag(sid); tagColor = ui.UI.good; }
      else if (sdef.unlock) { tag = 'Free - Enter'; tagColor = ui.UI.gold; }
      else { tag = sdef.price + ' CR'; tagColor = ui.UI.gold; }
      ctx.fillStyle = tagColor;
      ctx.font = ui.uiFont(13, 'bold');
      ctx.fillText(tag, x + 115, y + 116);
      if (!shipAvailable(sid)) drawLock(x + 115, y + 48, 34);
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Select ship' },
      { key: 'Enter', label: 'Buy / Select' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function shipIdOwnedTag(sid) {
    return save.ship === sid ? 'Selected' : 'Owned';
  }

  /* ================================================================
   *  ARMORY TECH TREE SCREEN
   * ================================================================ */

  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

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
    const tabW = (1232 - (TREE_BRANCH_LIST.length - 1) * 8) / TREE_BRANCH_LIST.length;
    for (let i = 0; i < TREE_BRANCH_LIST.length; ++i) {
      const b = TREE_BRANCH_LIST[i];
      const nodes = TREE.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCH_LIST[treeBranch];
    const cols = [];
    for (const node of TREE) {
      if (node.branch !== branch.id) continue;
      const d = treeDepth(node);
      if (!cols[d]) cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c]) rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c]) continue;
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
          state: nodeState(node),
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout) return null;
    return treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(c => c.node.branch === branchId) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout) treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      playSfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId) continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      treeBranch = (treeBranch + (ci < 0 ? -1 : 1) + TREE_BRANCH_LIST.length) % TREE_BRANCH_LIST.length;
      treeLayout = buildTreeLayout();
      selectFirstInBranch();
      playSfx('click', { volume: 0.4 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    treeSelected = col[ri].node.id;
    playSfx('click', { volume: 0.4 });
  }

  function drawArmory() {
    const layout = buildTreeLayout();
    treeLayout = layout;

    if (!treeSelected || !layout.cards.some(c => c.node.id === treeSelected))
      selectFirstInBranch();

    if (mouseX >= 0) {
      for (const card of layout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    ctx.fillStyle = 'rgba(3,4,10,0.72)';
    fillVisible();

    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Armory', 130, 58, 220, 40, ui.UI.gold);
    ui.drawChip(save.credits + ' CR', 1236, 44, 30, { align: 'right', color: ui.UI.gold });
    ctx.textAlign = 'right';
    ui.fitText(countTreeMaxed() + ' / ' + TREE.length + ' upgrades complete', 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

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

    /* connectors under the cards */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
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
      drawTreeNodeCard(card);

    for (const card of layout.cards) {
      if (card.node.id !== treeSelected) continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(gameTime * 0.004));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

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

    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText(node.costs[level] + ' CR', card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

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

    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (gameTime / 1000 - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ================================================================
   *  HELP SCREEN
   * ================================================================ */

  const HELP_PAGES = ['Controls', 'Power-ups', 'Enemies', 'Progress'];

  const POWERUP_HELP = {
    tripleShot: 'Three bullets in a fan',
    rapidFire: 'Shoot much faster',
    shield: 'Blocks the next hit',
    laser: 'Piercing shots',
    slowMo: 'Slows the enemy down',
    extraLife: '+1 life',
    bomb: 'Wipes the whole screen',
    drone: 'A helper ship fights with you',
  };

  const ENEMY_HELP = [
    { species: 1, text: 'Squid · 30 points' },
    { species: 2, text: 'Crab · 20 points' },
    { species: 3, text: 'Octopus · 10 points' },
    { species: 4, text: 'Diver · 50 points, swoops at you' },
    { species: 5, text: 'Warden · 40 points, shielded' },
    { species: 6, text: 'Armored · 60 points, takes 2 hits' },
  ];

  function drawHelp() {
    ctx.fillStyle = 'rgba(3,4,10,0.6)';
    fillVisible();

    const pw = 900, ph = 520, px = 190, py = 100;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[helpPage], accent: ui.UI.accent, titlePx: 20 });

    const t = gameTime / 1000;
    if (helpPage === 0) {
      const lines = [
        ['Move', '← / → or A / D or mouse'],
        ['Fire', 'Space or click'],
        ['Special', 'E or Shift or right click'],
        ['Dash', 'double-tap ← / → (Armory upgrade)'],
        ['Pause', 'P or Esc'],
      ];
      for (let i = 0; i < lines.length; ++i) {
        const y = py + 90 + i * 56;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(21, 'bold');
        ctx.fillText(lines[i][0], px + 50, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(19);
        ctx.fillText(lines[i][1], px + 240, y);
      }
    } else if (helpPage === 1) {
      for (let i = 0; i < POWERUPS.length; ++i) {
        const p = POWERUPS[i];
        const y = py + 78 + i * 48;
        SZ.InvaderArt.drawCapsule(ctx, p.id, px + 66, y, t);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = p.color;
        ctx.font = ui.uiFont(19, 'bold');
        ctx.fillText(p.name, px + 110, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(17);
        ctx.fillText(POWERUP_HELP[p.id] || '', px + 320, y);
      }
    } else if (helpPage === 2) {
      for (let i = 0; i < ENEMY_HELP.length; ++i) {
        const e = ENEMY_HELP[i];
        const y = py + 74 + i * 48;
        SZ.InvaderArt.drawAlien(ctx, e.species, px + 50, y - ALIEN_H / 2, Math.floor(gameTime / 480) % 2, false);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(19);
        ctx.fillText(e.text, px + 110, y);
      }
      SZ.InvaderArt.drawUfo(ctx, px + 40, py + 366 - UFO_H / 2, t);
      ctx.fillStyle = ui.UI.text;
      ctx.font = ui.uiFont(19);
      ctx.fillText('UFO · bonus points, always drops a power-up', px + 110, py + 366);
      ctx.save();
      ctx.translate(px + 76, py + 420);
      ctx.scale(0.45, 0.45);
      SZ.InvaderArt.drawBoss(ctx, 0, -BOSS_SPRITE_W / 2, -BOSS_SPRITE_H / 2, false, false);
      ctx.restore();
      ctx.fillText('Bosses · heavy firepower, watch for phase two', px + 110, py + 420);
    } else {
      const lines = [
        'Campaign: 30 stages in six sectors, up to 90 stars.',
        'Stars unlock the next stages and sectors.',
        'Credits: every run pays credits, spend them in the Hangar and Armory.',
        'Hangar: five ships, each with its own special ability.',
        'Armory: 16 permanent upgrades across five branches.',
        'Modes: Classic, Survival, Boss Rush, Daily and Campaign.',
      ];
      for (let i = 0; i < lines.length; ++i) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = i % 2 === 0 ? ui.UI.text : ui.UI.textDim;
        ctx.font = ui.uiFont(19);
        ctx.fillText(lines[i], px + 50, py + 90 + i * 52);
      }
    }

    for (let i = 0; i < HELP_PAGES.length; ++i) {
      ctx.beginPath();
      ctx.arc(640 + (i - 1.5) * 22, py + ph - 34, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === helpPage ? ui.UI.gold : 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
    drawButton('help-prev', '←', px + 24, py + ph - 56, 80, 40, {
      px: 18, disabled: helpPage === 0,
      action: () => { helpPage = Math.max(0, helpPage - 1); },
    });
    drawButton('help-next', '→', px + pw - 104, py + ph - 56, 80, 40, {
      px: 18, disabled: helpPage === HELP_PAGES.length - 1,
      action: () => { helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1); },
    });

    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Close' },
    ], 640, py + ph + 34, 900, 1);
  }

  /* ================================================================
   *  HUD
   * ================================================================ */

  function currentShipId() {
    return SHIP_DEFS[save.ship] && shipOwned(save.ship) ? save.ship : 'interceptor';
  }

  function drawHud() {
    /* Score panel, top left */
    ui.drawPanel(16, 12, 300, 64, { accent: ui.UI.accent });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(11, 'bold');
    ctx.fillText('SCORE', 30, 26);
    ctx.fillStyle = ui.UI.text;
    ctx.font = ui.uiFont(30, 'bold');
    ctx.fillText(String(score), 30, 52);
    if (comboMultiplier > 1 && comboTimer > 0) {
      ui.drawChip('COMBO x' + comboMultiplier, 302, 22, 24, {
        align: 'right',
        color: ui.UI.gold,
        bg: 'rgba(255,215,90,0.14)',
        border: 'rgba(255,215,90,0.5)',
      });
      ui.drawMeter(206, 54, 96, 6, comboTimer / COMBO_TIMEOUT, ui.UI.gold);
    }

    /* Mode / level / wave chip, top centre; a boss fight replaces it with the boss panel */
    const bossHud = boss && bossActive && gameState === 'playing';
    if (!bossHud) {
      let chipText;
      if (gameMode === 'campaign' && stageInfo)
        chipText = stageInfo.id + ' ' + stageInfo.name;
      else if (gameMode === 'daily')
        chipText = 'Daily · Level ' + level;
      else if (gameMode === 'survival')
        chipText = 'Survival · Wave ' + wave;
      else if (gameMode === 'bossRush')
        chipText = 'Boss Rush · Boss ' + Math.ceil(level / (MODES.bossRush.bossEvery || 1));
      else
        chipText = 'Classic · Level ' + level;
      ui.drawChip(chipText, GAME_W / 2, 16, 28, {
        align: 'center',
        color: ui.UI.text,
        bg: 'rgba(24,32,56,0.9)',
        border: ui.UI.rim,
      });
    }

    /* Lives + active power-ups panel, top right */
    ui.drawPanel(964, 12, 300, 64, { accent: ui.UI.accent });
    const shipId = currentShipId();
    const shownLives = Math.min(lives, 5);
    for (let i = 0; i < shownLives; ++i) {
      ctx.save();
      ctx.translate(980 + i * 30, 22);
      ctx.scale(0.55, 0.55);
      SZ.InvaderArt.drawShip(ctx, shipId, PLAYER_W / 2, 0, 1, 0, 1);
      ctx.restore();
    }
    if (lives > 5) {
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(13, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + (lives - 5), 980 + 5 * 30, 30);
    }

    let capX = 1250;
    for (const id of Object.keys(activePowerups)) {
      const def = POWERUPS.find(p => p.id === id);
      if (!def || def.duration === 0 || activePowerups[id] <= 0) continue;
      const ratio = Math.min(1, activePowerups[id] / def.duration);
      ctx.save();
      ctx.translate(capX, 46);
      ctx.scale(0.8, 0.8);
      SZ.InvaderArt.drawCapsule(ctx, id, 0, 0, gameTime / 1000);
      ctx.restore();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(capX, 46, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      capX -= 36;
    }

    /* Boss health panel, in place of the mode chip */
    if (bossHud) {
      const phase2 = boss.hp <= boss.maxHp / 2;
      const spec = SZ.InvaderArt.BOSSES[boss.design] || SZ.InvaderArt.BOSSES[0];
      const meterColor = phase2 ? (Math.sin(gameTime * 0.012) > 0 ? '#ff4a3a' : '#ff9a4a') : '#ffb03a';
      ui.drawPanel(400, 12, 480, 60, { accent: spec.color });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(boss.name || spec.name, 416, 28, 448, 20, { weight: 'bold', color: spec.color });
      ui.drawMeter(416, 46, 448, 14, boss.hp / boss.maxHp, meterColor);
    }

    /* Special ability meter, bottom left */
    const shipDef = SHIP_DEFS[currentShipId()];
    const maxCharges = maxSpecialCharges();
    const chargeReady = specialCharges > 0;
    const specialColor = TREE_BRANCHES.special.color;
    ui.drawPanel(16, 650, 260, 56, { accent: chargeReady ? specialColor : ui.UI.textMute });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(11, 'bold');
    ctx.fillText('SPECIAL', 30, 664);
    ctx.fillStyle = chargeReady ? specialColor : ui.UI.text;
    ctx.font = ui.uiFont(15, 'bold');
    ctx.fillText(shipDef.specialName, 92, 664);
    ui.drawMeter(30, 680, 170, 10, special / 100, specialColor);
    for (let i = 0; i < maxCharges; ++i) {
      ctx.beginPath();
      ctx.arc(222 + i * 20, 685, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < specialCharges ? specialColor : 'rgba(255,255,255,0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (chargeReady) {
      ctx.save();
      ui.roundRectPath(17.5, 651.5, 257, 53, 8);
      ctx.strokeStyle = ui.hexToRgba(specialColor, 0.35 + 0.35 * Math.sin(gameTime * 0.01));
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ui.drawKeycap('E', 236, 656, 12);
    }
  }

  /* ================================================================
   *  GAME LOOP
   * ================================================================ */

  function gameLoop(timestamp) {
    if (!lastTime)
      lastTime = timestamp;
    let elapsed = timestamp - lastTime;
    lastTime = timestamp;

    /* Snap refresh jitter around 60 Hz to exactly one step; cap catch-up after stalls */
    if (Math.abs(elapsed - SIM_STEP) < SIM_SNAP)
      elapsed = SIM_STEP;
    simAccumulator = Math.min(simAccumulator + elapsed, SIM_STEP * SIM_MAX_STEPS);
    while (simAccumulator >= SIM_STEP) {
      simAccumulator -= SIM_STEP;
      update(SIM_STEP);
    }
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  const SCREEN_NAMES = {
    title: 'Title', campaignMap: 'Campaign', hangar: 'Hangar', armory: 'Armory', help: 'Help',
  };

  function updateStatusBar() {
    if (isMenuState(gameState)) {
      statusScore.textContent = 'Credits: ' + save.credits;
      statusLives.textContent = '';
      statusLevel.textContent = SCREEN_NAMES[gameState];
      return;
    }
    statusScore.textContent = 'Score: ' + score;
    statusLives.textContent = 'Lives: ' + lives;
    if (gameMode === 'survival')
      statusLevel.textContent = 'Wave: ' + wave;
    else
      statusLevel.textContent = 'Level: ' + level;
  }

  /* ================================================================
   *  HIGH SCORES
   * ================================================================ */

  function loadHighScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function saveHighScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (_) {}
  }

  function checkHighScore() {
    const scores = loadHighScores();
    scores.push({ score, level, wave, mode: gameMode });
    scores.sort((a, b) => b.score - a.score);
    scores.length = Math.min(scores.length, MAX_HIGH_SCORES);
    saveHighScores(scores);
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    tbody.innerHTML = '';
    if (scores.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet</td>';
      tbody.appendChild(tr);
    } else {
      for (let i = 0; i < scores.length; ++i) {
        const s = scores[i];
        const modeName = MODES[s.mode] ? MODES[s.mode].name : (s.mode || '?');
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td>' + s.score + '</td>' +
          '<td>' + (s.mode === 'survival' ? 'W' + (s.wave || s.level) : 'L' + s.level) + '</td>' +
          '<td>' + modeName + '</td>';
        tbody.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        saveHighScores([]);
        showHighScores();
      }
    });
  }

  /* ================================================================
   *  SAVE (v2): credits, stage stars, per-mode bests, stats
   * ================================================================ */

  function loadSave() {
    const def = {
      v: 2,
      credits: 0,
      stars: {},
      best: { classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } },
      tree: {},
      ships: ['interceptor'],
      ship: 'interceptor',
      stats: { runs: 0, kills: 0, bosses: 0 },
      carry: null,
    };
    try {
      const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (stored && typeof stored === 'object') {
        Object.assign(def, stored);
        if (def.best && typeof def.best === 'object')
          def.best = Object.assign({ classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } }, def.best);
        else
          def.best = { classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } };
        if (!def.best.daily || typeof def.best.daily !== 'object')
          def.best.daily = { date: '', score: 0 };
        if (def.stats && typeof def.stats === 'object')
          def.stats = Object.assign({ runs: 0, kills: 0, bosses: 0 }, def.stats);
        else
          def.stats = { runs: 0, kills: 0, bosses: 0 };
        if (!def.stars || typeof def.stars !== 'object') def.stars = {};
        if (!def.tree || typeof def.tree !== 'object') def.tree = {};
        if (!Array.isArray(def.ships)) def.ships = ['interceptor'];
        if (!def.carry || typeof def.carry !== 'object' || typeof def.carry.stage !== 'string' || !(def.carry.charges >= 0)) def.carry = null;
      }
    } catch (_) {}
    return def;
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {}
  }

  let save = loadSave();

  function todayKey() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* Run end: credits from the score, per-mode best, stats — written once */
  function endRun() {
    const credits = SZ.InvaderCampaign.creditsFor(score, null, 0);
    save.credits += credits;
    ++save.stats.runs;

    let newBest = false;
    if (gameMode === 'daily') {
      const today = todayKey();
      if (save.best.daily.date !== today) {
        save.best.daily = { date: today, score };
        newBest = true;
      } else if (score > save.best.daily.score) {
        save.best.daily.score = score;
        newBest = true;
      }
    } else if (save.best[gameMode] !== undefined && score > save.best[gameMode]) {
      save.best[gameMode] = score;
      newBest = true;
    }

    if (gameMode === 'campaign')
      stageResult = { stars: 0, credits, score, livesLost, maxMultiplier };
    runResult = { credits, newBest };
    writeSave();
  }

  /* ================================================================
   *  INPUT
   * ================================================================ */

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => gameState === 'playing',
    pause: () => {
      gameState = 'paused';
      menuCursor = 0;
    }
  });

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    /* Keyboard input disables mouse movement to avoid conflicts */
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')
      mouseActive = false;

    if (gameState === 'playing') {
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
        e.preventDefault();
        fireSpecial();
      }
      /* Double-tap left/right dashes, if the Dash Jets upgrade is owned */
      if (!e.repeat && treeLevel('e_dash') > 0) {
        let tapDir = 0;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') tapDir = -1;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') tapDir = 1;
        if (tapDir !== 0) {
          if (tapDir === lastTapDir && gameTime - lastTapTime <= 250)
            tryDash(tapDir);
          lastTapDir = tapDir;
          lastTapTime = gameTime;
        }
      }
    }

    if (e.key === 'F2') {
      e.preventDefault();
      setScreen('title');
      return;
    }

    /* ── Armory tech tree navigation ── */
    if (gameState === 'armory') {
      e.preventDefault();
      if (e.code === 'Escape') {
        setScreen(prevScreen);
      } else if (e.code === 'Tab') {
        treeBranch = (treeBranch + 1) % TREE_BRANCH_LIST.length;
        treeLayout = buildTreeLayout();
        selectFirstInBranch();
        playSfx('click', { volume: 0.4 });
      } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const b = Number(e.code.slice(5)) - 1;
        if (b < TREE_BRANCH_LIST.length) {
          treeBranch = b;
          treeLayout = buildTreeLayout();
          selectFirstInBranch();
          playSfx('click', { volume: 0.4 });
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
          treeBuyFlash = { id: node.id, at: gameTime / 1000 };
      } else if (e.code === 'KeyH') {
        openHelp();
      }
      return;
    }

    /* ── Hangar: Left/Right pick the ship, Enter buys or selects it ── */
    if (gameState === 'hangar') {
      e.preventDefault();
      if (e.code === 'Escape') {
        setScreen(prevScreen);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        hangarCursor = (hangarCursor + SHIP_ORDER.length - 1) % SHIP_ORDER.length;
        playSfx('click', { volume: 0.4 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        hangarCursor = (hangarCursor + 1) % SHIP_ORDER.length;
        playSfx('click', { volume: 0.4 });
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        buyShip(SHIP_ORDER[hangarCursor]);
      } else if (e.code === 'KeyH') {
        openHelp();
      }
      return;
    }

    /* ── Help pages ── */
    if (gameState === 'help') {
      e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyH') {
        setScreen(helpFrom);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        helpPage = Math.max(0, helpPage - 1);
        playSfx('click', { volume: 0.4 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1);
        playSfx('click', { volume: 0.4 });
      }
      return;
    }

    /* ── Menu screen navigation (all screens share the hit-area cursor) ── */
    if (isMenuState(gameState) || gameState === 'paused' || gameState === 'gameover' || gameState === 'stageClear') {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
        moveMenuCursor(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
        moveMenuCursor(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
        activateMenuItem(hitAreas[menuCursor]);
      else if (e.code === 'KeyH' && isMenuState(gameState))
        openHelp();
      else if (e.code === 'KeyP' && gameState === 'paused')
        gameState = 'playing';
      else if (e.code === 'Escape') {
        if (gameState === 'campaignMap')
          setScreen('title');
        else if (gameState === 'paused')
          gameState = 'playing';
        else if (gameState === 'stageClear')
          setScreen('campaignMap');
        else if (gameState === 'gameover')
          quitToMenu();
      }
      return;
    }

    if (e.code === 'Escape' && gameState === 'playing') {
      e.preventDefault();
      gameState = 'paused';
      menuCursor = 0;
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (gameState === 'playing') {
        gameState = 'paused';
        menuCursor = 0;
      } else if (gameState === 'paused')
        gameState = 'playing';
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')
      e.preventDefault();
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Menu clicks + mouse controls ── */
  canvas.addEventListener('pointerdown', (e) => {
    /* the frame must keep keyboard focus after clicks */
    window.focus();

    /* Right mouse button fires the ship's special */
    if (e.button === 2) {
      if (gameState === 'playing')
        fireSpecial();
      return;
    }

    const p = canvasToGame(e.clientX, e.clientY);
    mouseX = p.x;
    mouseY = p.y;

    if (gameState === 'armory') {
      if (!treeLayout) treeLayout = buildTreeLayout();
      for (const tab of treeLayout.tabs) {
        if (mouseX >= tab.x && mouseX <= tab.x + tab.w && mouseY >= tab.y && mouseY <= tab.y + tab.h) {
          treeBranch = tab.index;
          selectFirstInBranch();
          playSfx('click', { volume: 0.4 });
          return;
        }
      }
      for (const card of treeLayout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          if (buyNode(card.node))
            treeBuyFlash = { id: card.node.id, at: gameTime / 1000 };
          return;
        }
      }
      return;
    }

    if (isMenuState(gameState) || gameState === 'paused' || gameState === 'gameover' || gameState === 'stageClear') {
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

    mouseGameX = p.x;
    mouseDown = true;
    mouseActive = true;
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = canvasToGame(e.clientX, e.clientY);
    mouseX = p.x;
    mouseY = p.y;
    mouseGameX = p.x;
    mouseActive = true;
  });

  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ================================================================
   *  MENU
   * ================================================================ */

  new SZ.MenuBar({
    onAction(action) {
      switch (action) {
        case 'new':
          setScreen('title');
          break;
        case 'pause':
          if (gameState === 'playing') {
            gameState = 'paused';
            menuCursor = 0;
          } else if (gameState === 'paused')
            gameState = 'playing';
          break;
        case 'high-scores':
          showHighScores();
          break;
        case 'exit':
          User32.DestroyWindow();
          break;
        case 'controls':
          SZ.Dialog.show('controlsBackdrop');
          break;
        case 'about':
          SZ.Dialog.show('dlg-about');
          break;
      }
    },
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  User32.EnableVisualStyles();
  sfx.attachMuteButton();

  /* let the page accept keyboard focus on the body so clicks keep the keys alive */
  document.body.tabIndex = -1;

  resizeCanvas();
  setBackdrop(THEME_ORDER[0]);
  updateStatusBar();
  requestAnimationFrame(gameLoop);
})();
