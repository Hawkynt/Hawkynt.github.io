;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  let canvasW = 700;
  let canvasH = 500;
  let uiS = 1;                       // HUD scale (screen px per UI unit)
  let UW = 700, UH = 500;            // HUD size in UI units
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* ── Grid ── */
  const GRID_COLS = 8;
  const BASE_GRID_ROWS = 6;
  // MAX_EXPANSION_ROWS removed: unlimited expansion via plotExpansion upgrade
  const BASE_TILE_SIZE = 56;
  const GRID_OFFSET_X = 30;
  const GRID_OFFSET_Y = 60;

  /* ── Tile types ── */
  const TILE_FARMLAND = 0;
  const TILE_ROCK = 1;
  const TILE_WATER = 2;
  const TILE_SAND = 3;

  /* ── Soil quality per expansion tier ── */
  const SOIL_QUALITY_TIERS = [1.0, 0.8, 0.65, 0.5]; // original, 1st exp, 2nd, 3rd

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-farming';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const STORAGE_SAVE_V1 = STORAGE_PREFIX + '-save-v1';
  const SAVE_VERSION = 2;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  const MAX_HIGH_SCORES = 5;

  /* ── Crop Definitions ── */
  // weather affinity: 'any' = unaffected, 'solar' = boosted by solar flare,
  //                   'cold-vulnerable' = damaged by meteor shower cold snap
  const CROPS = [
    { name: 'Space Wheat',   sprite: 'wheat', color: '#da2',  growTime: 8,  stages: 4, sellPrice: 10, seedCost: 5,  weatherAffinity: null, favorite: 1 },
    { name: 'Star Fruit',    sprite: 'starfruit', color: '#f80',  growTime: 14, stages: 4, sellPrice: 25, seedCost: 12, weatherAffinity: null, favorite: 1 },
    { name: 'Nebula Berry',  sprite: 'berry', color: '#a3f',  growTime: 10, stages: 4, sellPrice: 15, seedCost: 8,  weatherAffinity: null, favorite: 0 },
    { name: 'Lunar Lettuce', sprite: 'lettuce', color: '#5d5',  growTime: 6,  stages: 3, sellPrice: 8,  seedCost: 3,  weatherAffinity: null, favorite: 0 },
    { name: 'Cosmic Corn',   sprite: 'corn', color: '#ec3',  growTime: 12, stages: 4, sellPrice: 20, seedCost: 10, weatherAffinity: null, favorite: 2 },
    { name: 'Crystal Melon', sprite: 'melon', color: '#0da',  growTime: 18, stages: 5, sellPrice: 40, seedCost: 20, weatherAffinity: null, favorite: 1 },
    { name: 'Solar Tomato',  sprite: 'tomato', color: '#e33',  growTime: 9,  stages: 4, sellPrice: 12, seedCost: 6,  weatherAffinity: null, favorite: 0 },
    { name: 'Void Mushroom', sprite: 'mushroom', color: '#728',  growTime: 11, stages: 4, sellPrice: 18, seedCost: 9,  weatherAffinity: 'any', favorite: 2 },
    { name: 'Plasma Pepper', sprite: 'pepper', color: '#f52',  growTime: 6,  stages: 3, sellPrice: 30, seedCost: 15, weatherAffinity: 'cold-vulnerable', favorite: 1 },
    { name: 'Astral Flower', sprite: 'flower', color: '#8af',  growTime: 20, stages: 5, sellPrice: 55, seedCost: 28, weatherAffinity: 'solar', favorite: 0 },
    { name: 'Lunar Moss',   sprite: 'moss', color: '#679',  growTime: 35, stages: 4, sellPrice: 28, seedCost: 15, weatherAffinity: null, nightOnly: true, favorite: 3 },
    { name: 'Solar Vine',   sprite: 'solarvine', color: '#fc0',  growTime: 30, stages: 4, sellPrice: 35, seedCost: 20, weatherAffinity: 'solar', dayOnly: true, favorite: 1 },
    { name: 'Comet Pumpkin', sprite: 'pumpkin', color: '#f82', growTime: 22, stages: 5, sellPrice: 60, seedCost: 30, weatherAffinity: null, favorite: 2 },
    { name: 'Frost Kale',    sprite: 'kale', color: '#8df', growTime: 12, stages: 4, sellPrice: 22, seedCost: 10, weatherAffinity: null, favorite: 3, hardy: true }
  ];

  /* ── Livestock Definitions ── */
  const LIVESTOCK = [
    { name: 'Space Cow',     sprite: 'cow', color: '#ddd', feedInterval: 12, produce: 'Milk',      produceSprite: 'milk', produceValue: 18, cost: 50 },
    { name: 'Star Hen',      sprite: 'hen', color: '#fb4', feedInterval: 8,  produce: 'Egg',       produceSprite: 'egg', produceValue: 10, cost: 30 },
    { name: 'Nebula Goat',   sprite: 'goat', color: '#c96', feedInterval: 10, produce: 'Wool',      produceSprite: 'wool', produceValue: 14, cost: 40 },
    { name: 'Crystal Chick', sprite: 'chick', color: '#ff8', feedInterval: 6,  produce: 'Feather',   produceSprite: 'feather', produceValue: 6,  cost: 15 },
    { name: 'Moon Rabbit',   sprite: 'rabbit', color: '#eef', feedInterval: 14, produce: 'Moon Fur',  produceSprite: 'fur', produceValue: 24, cost: 70 },
    { name: 'Star Bees',     sprite: 'bee', color: '#fd4', feedInterval: 16, produce: 'Star Honey', produceSprite: 'honey', produceValue: 32, cost: 90 }
  ];

  /* ── Weather ── */
  const WEATHER_NONE = 'none';
  const WEATHER_SOLAR_FLARE = 'solarFlare';
  const WEATHER_METEOR_SHOWER = 'meteorShower';
  const WEATHER_RAIN = 'rain';
  const WEATHER_THUNDERSTORM = 'thunderstorm';
  const WEATHER_SNOW = 'snow';
  const WEATHER_DUST = 'dust';
  const WEATHER_DURATION = 8;
  const WEATHER_MIN_INTERVAL = 25;
  const WEATHER_MAX_INTERVAL = 50;

  /* ── Shop modes ── */
  const TOOL_PLANT = 'plant';
  const TOOL_HARVEST = 'harvest';
  const TOOL_FEED = 'feed';
  const TOOL_HOE = 'hoe';

  /* ── Building Definitions ── */
  const BUILDINGS = [
    { name: 'Sprinkler',  sprite: 'sprinkler', cost: 50,  desc: 'Waters adjacent crops (+20% growth)', range: 1 },
    { name: 'Harvester',  sprite: 'harvester', cost: 120, desc: 'Auto-harvests adjacent mature crops',   range: 1 },
    { name: 'Greenhouse', sprite: 'greenhouse', cost: 200, desc: 'Protects adjacent crops from weather',  range: 1 },
    { name: 'Silo',       sprite: 'silo', cost: 80,  desc: 'Increases sell price by 10% (global)', range: 0 },
    { name: 'Solar Panel',  sprite: 'solarpanel', cost: 150, desc: 'Generates 2 credits/cycle',              range: 0 },
    { name: 'Wind Turbine', sprite: 'turbine', cost: 250, desc: 'Generates 5 credits/cycle + adj growth +10%', range: 1 },
    { name: 'Compost Bin',  sprite: 'compost', cost: 100, desc: 'Boosts adjacent fertility +25%',         range: 1 },
    { name: 'Scarecrow',    sprite: 'scarecrow', cost: 75, desc: 'Protects 3x3 area from animals', range: 1 },
    { name: 'Fence',        sprite: 'fence', cost: 30,  desc: 'Blocks animal movement on this tile',     range: 0 },
    { name: 'Auto-Planter L1', sprite: 'planter1', cost: 200, desc: 'Plants selected crop on adj. empty land (15s)', range: 1 },
    { name: 'Auto-Planter L2', sprite: 'planter2', cost: 500, desc: 'Plants highest-price crop on adj. land (15s)',  range: 1 },
    { name: 'Auto-Collector', sprite: 'collector', cost: 300, desc: 'Auto-collects adjacent livestock produce', range: 1 },
    { name: 'Grow Lamp',    sprite: 'lamp', cost: 140, desc: 'Lights nearby crops at night: +15% growth, day crops keep growing', range: 1 },
    { name: 'Pest Zapper',  sprite: 'zapper', cost: 180, desc: 'Zaps space mice that come close (+5 cr each)', range: 2 },
  ];

  const BUILDING_MAX_LEVEL = 6; // levels 1-6 (5 upgrades from L1)

  /* ── Building placement mode ── */
  const TOOL_BUILD = 'build';

  /* ── Price Fluctuation ── */
  const PRICE_CHANGE_INTERVAL = 60; // seconds between price shifts
  const PRICE_MIN_MULT = 0.5;
  const PRICE_MAX_MULT = 2.0;

  /* ── Seasons ── */
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const SEASON_DURATION = 4; // days per season
  const SEASON_SPRITES = ['spring', 'sun', 'autumn', 'winter']; // icons per season

  /* ── Day/Night ── */
  const DAY_CYCLE_PERIOD = 30; // same as game day length in seconds

  /* ── Animals ── */
  const ANIMAL_SPAWN_MIN = 60;
  const ANIMAL_SPAWN_MAX = 120;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCredits = document.getElementById('statusCredits');
  const statusTool = document.getElementById('statusTool');
  const statusWeather = document.getElementById('statusWeather');
  const statusDay = document.getElementById('statusDay');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  /* Pooled particle system with the shared burst/trail/sparkle/confetti API;
     the pool has a hard cap, so big bursts never pile up */
  class FarmParticles {
    constructor(cap) {
      this.cap = cap;
      this.list = [];
      this.free = [];
      this.last = 0;
    }

    get count() { return this.list.length; }

    add(x, y, o) {
      if (this.list.length >= this.cap * (lowQuality ? 0.5 : 1))
        return;
      const p = this.free.pop() || {};
      p.x = x; p.y = y;
      p.vx = o.vx; p.vy = o.vy;
      p.life = o.life; p.decay = o.decay;
      p.size = o.size; p.shrink = o.shrink;
      p.color = o.color; p.gravity = o.gravity || 0; p.friction = o.friction || 1;
      p.shape = o.shape || 'circle';
      p.rot = Math.random() * TWO_PI;
      p.spin = o.spin !== undefined ? o.spin : (Math.random() - 0.5) * 0.2;
      this.list.push(p);
    }

    burst(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const speed = opts.speed ?? 4, angle = Math.random() * TWO_PI, v = Math.random() * speed;
        this.add(x, y, { vx: Math.cos(angle) * v + (opts.vx ?? 0), vy: Math.sin(angle) * v + (opts.vy ?? 0), life: opts.life ?? (0.6 + Math.random() * 0.4),
          decay: opts.decay ?? 0.02, size: opts.size ?? (2 + Math.random() * 3), shrink: opts.shrink ?? 0.97, color: opts.color ?? '#fff', gravity: opts.gravity, friction: opts.friction, shape: opts.shape });
      }
    }

    trail(x, y, opts = {}) {
      this.add(x, y, { vx: (opts.vx ?? 0) + (Math.random() - 0.5) * 0.5, vy: (opts.vy ?? 0) + (Math.random() - 0.5) * 0.5, life: opts.life ?? 0.5,
        decay: opts.decay ?? 0.03, size: opts.size ?? 2, shrink: opts.shrink ?? 0.95, color: opts.color ?? '#ff0', gravity: opts.gravity, shape: opts.shape });
    }

    sparkle(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const angle = Math.random() * TWO_PI, v = Math.random() * (opts.speed ?? 2);
        this.add(x, y, { vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.3 + Math.random() * 0.5, decay: 0.04,
          size: 1 + Math.random() * 2, shrink: 0.98, color: opts.color ?? '#fff', shape: opts.shape ?? 'star' });
      }
    }

    confetti(x, y, count, opts = {}) {
      const colors = opts.colors ?? ['#f44', '#4f4', '#44f', '#ff4', '#f4f', '#4ff'];
      for (let i = 0; i < count; ++i) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8, v = 2 + Math.random() * (opts.speed ?? 5);
        this.add(x, y, { vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 1, decay: 0.01, size: 3 + Math.random() * 3, shrink: 0.99,
          color: colors[Math.floor(Math.random() * colors.length)], gravity: opts.gravity ?? 0.1, friction: 0.99, shape: 'square', spin: (Math.random() - 0.5) * 0.3 });
      }
    }

    update() {
      // steps are measured in 60 Hz frames, like the shared effects
      const now = performance.now();
      const f = this.last ? Math.min(3, (now - this.last) / (1000 / 60)) : 1;
      this.last = now;
      const list = this.list;
      let j = 0;
      for (let i = 0; i < list.length; ++i) {
        const p = list[i];
        p.vy += p.gravity * f;
        if (p.friction !== 1) {
          const fr = Math.pow(p.friction, f);
          p.vx *= fr;
          p.vy *= fr;
        }
        p.x += p.vx * f;
        p.y += p.vy * f;
        p.life -= p.decay * f;
        p.size *= Math.pow(p.shrink, f);
        p.rot += p.spin * f;
        if (p.life <= 0 || p.size < 0.3)
          this.free.push(p);
        else
          list[j++] = p;
      }
      list.length = j;
    }

    draw(c) {
      const base = c.getTransform();
      const a0 = c.globalAlpha;
      for (const p of this.list) {
        c.globalAlpha = a0 * Math.min(1, p.life);
        c.fillStyle = p.color;
        const s = p.size;
        if (p.shape === 'square') {
          const co = Math.cos(p.rot), si = Math.sin(p.rot);
          c.setTransform(base.a * co + base.c * si, base.b * co + base.d * si, base.c * co - base.a * si, base.d * co - base.b * si,
            base.a * p.x + base.c * p.y + base.e, base.b * p.x + base.d * p.y + base.f);
          c.fillRect(-s / 2, -s / 2, s, s);
        } else if (p.shape === 'star') {
          c.setTransform(base);
          c.beginPath();
          for (let i = 0; i < 5; ++i) {
            const a = p.rot + (i * 4 * Math.PI) / 5 - Math.PI / 2;
            if (i) c.lineTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
            else c.moveTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
          }
          c.closePath();
          c.fill();
        } else if (s < 2.2) {
          c.setTransform(base);
          c.fillRect(p.x - s, p.y - s, s * 2, s * 2);
        } else {
          c.setTransform(base);
          c.beginPath();
          c.arc(p.x, p.y, s, 0, TWO_PI);
          c.fill();
        }
      }
      c.setTransform(base);
      c.globalAlpha = a0;
    }

    clear() {
      this.free.push(...this.list);
      this.list.length = 0;
    }
  }

  const particles = new FarmParticles(700);
  const screenShake = new SZ.GameEffects.ScreenShake();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  /* ── Tutorial ── */
  let tutorialSeen = false;

  let state = STATE_READY;
  let credits = 100;
  let selectedCropIndex = 0;
  let selectedTool = TOOL_PLANT;
  let gameTime = 0;
  let dayCount = 0;

  // Effective grid rows (base + expansion)
  let gridRows = BASE_GRID_ROWS;
  // Per-tile soil quality (2D array matching farmGrid dimensions)
  let soilQuality = [];

  // Farm grid: each cell is null or { cropIndex, growthProgress, growthStage, plantAnim }
  let farmGrid = [];

  // Tile types: 2D array of TILE_FARMLAND / TILE_ROCK / TILE_WATER / TILE_SAND
  let tileTypes = [];

  // Per-tile fertility: 2D array of 0.0..1.0 values
  let tileFertility = [];

  // Hoed tiles: 2D array of booleans — true if hoe-fertilized for visual indicator
  let hoedTiles = [];

  // Buildings placed on the grid: 2D array (null or { typeIndex })
  let buildings = [];

  // Selected building index (-1 = none)
  let selectedBuildingIndex = -1;

  // Building auto-harvest timer
  let buildingHarvestTimer = 0;

  // Livestock pens: array of { typeIndex, feedTimer, produceReady, gridRow, gridCol }
  let livestockPens = [];

  // Price fluctuation: per-crop multiplier
  let priceMultipliers = [];
  let priceChangeTimer = 0;

  // Inventory: { cropName: count }
  let inventory = {};

  // Weather
  let weatherType = WEATHER_NONE;
  let weatherTimer = 0;
  let weatherInterval = 0;
  let weatherEffect = 0; // visual overlay alpha



  // Auto-harvest timer (ticks every second-ish based on upgrade level)
  let autoHarvestTimer = 0;

  // High scores
  let highScores = [];

  // Input
  const keys = {};

  // Seasons
  let currentSeason = 0; // index into SEASONS

  // Day/Night phase: 0..1 within each 30s game day
  let dayPhase = 0;

  // Animals (Feature 8)
  let wildAnimals = []; // {x, y, targetCol, targetRow, moveTimer, hp}
  let nextAnimalSpawn = 0;

  // Solar/Wind income timer (Feature 3)
  let buildingIncomeTimer = 0;

  // Energy system
  let energy = 100;
  const ENERGY_BASE_MAX = 100;
  const ENERGY_REGEN_BASE = 2; // per second

  let gridCols = GRID_COLS; // now mutable for east/west expansion
  let gridColOffset = 0; // tracks how many columns were added to the left (west)

  // Expansion direction: cycles L(0), R(1), T(2), B(3)
  let expansionDirection = 0;

  // Auto-planter timer
  let autoPlanterTimer = 0;

  // Cached shuffle arrays for auto-harvester/planter (re-randomize every 60s)
  let shuffleCacheTimer = 0;
  const SHUFFLE_CACHE_INTERVAL = 60;
  let cachedHarvestOrder = [];
  let cachedPlantOrder = [];

  // Auto-collector timer (for livestock produce)
  let autoCollectorTimer = 0;

  // Zoom & pan
  let viewZoom = 1.0;
  let viewPanX = 0;
  let viewPanY = 0;
  const VIEW_ZOOM_MIN = 0.1;
  const VIEW_ZOOM_MAX = 2.0;
  let isPanning = false;
  let panLastX = 0;
  let panLastY = 0;
  let panButton = -1; // which button started panning

  // Right-click pan vs. remove tracking (Feature 1)
  let rightClickStartX = 0;
  let rightClickStartY = 0;

  // Drag selection
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragCurrentY = 0;
  let dragStartedOnGrid = false;

  // Saved farm
  let savedGameAvailable = false;
  let autosaveTimer = 0;
  let saveNotice = '';
  let newGameConfirmOpen = false;

  /* ══════════════════════════════════════════════════════════════════
     SPRITES — 16x16 pixel art drawn once into offscreen canvases
     ══════════════════════════════════════════════════════════════════ */

  const SPRITE_SIZE = 16;
  const SPRITE_OUTLINE = '#1a1424';

  const PAL = {
    white: '#f4f0e8', cream: '#ffe6a8', yellow: '#ffd23f', gold: '#f2a516', orange: '#f57a1f',
    red: '#e23b3b', maroon: '#9c2a4a', pink: '#ff8fb8', purple: '#a54be0', violet: '#6a3bb5',
    blue: '#3d8ef0', sky: '#8fd3ff', cyan: '#4fe0d0', teal: '#1fa39a', green: '#4cc341',
    leaf: '#2f8f3a', lime: '#a8e04a', brown: '#9a5b34', dbrown: '#5e3820', tan: '#d8a868',
    grey: '#9aa0b0', dgrey: '#5a5f70', steel: '#c8d0dc', black: '#2a2438', slate: '#7186b0',
    soil: '#6b4429'
  };

  function shadeColor(hex, amount) {
    let h = hex.replace('#', '');
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    const mix = (v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* Pixel painter on a 16x16 grid; every primitive works in whole pixels */
  function createPixelPainter() {
    const N = SPRITE_SIZE;
    const px = new Array(N * N).fill(null);
    const flat = new Array(N * N).fill(false);
    const set = (x, y, c, noShade) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      px[y * N + x] = c;
      flat[y * N + x] = !!noShade;
    };
    const p = {
      px: set,
      clear: (x, y) => set(x, y, null),
      rect: (x, y, w, h, c, noShade) => {
        for (let j = 0; j < h; ++j)
          for (let i = 0; i < w; ++i)
            set(x + i, y + j, c, noShade);
      },
      ell: (cx, cy, rx, ry, c, noShade) => {
        for (let y = 0; y < N; ++y)
          for (let x = 0; x < N; ++x) {
            const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
            if (dx * dx + dy * dy <= 1)
              set(x, y, c, noShade);
          }
      },
      disc: (cx, cy, r, c, noShade) => p.ell(cx, cy, r, r, c, noShade),
      line: (x0, y0, x1, y1, c, noShade) => {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; ++s)
          set(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, c, noShade);
      },
      poly: (pts, c, noShade) => {
        for (let y = 0; y < N; ++y)
          for (let x = 0; x < N; ++x) {
            const tx = x + 0.5, ty = y + 0.5;
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
              if ((yi > ty) !== (yj > ty) && tx < (xj - xi) * (ty - yi) / (yj - yi) + xi)
                inside = !inside;
            }
            if (inside)
              set(x, y, c, noShade);
          }
      },
      map: (x0, y0, rows, colors, noShade) => {
        for (let j = 0; j < rows.length; ++j)
          for (let i = 0; i < rows[j].length; ++i) {
            const ch = rows[j][i];
            if (ch !== '.')
              set(x0 + i, y0 + j, colors[ch], noShade);
          }
      },
      _px: px,
      _flat: flat
    };
    return p;
  }

  /* Bakes a painter into a canvas: light rim top-left, shadow bottom-right, 1px dark outline */
  function bakeSprite(paint) {
    const N = SPRITE_SIZE;
    const p = createPixelPainter();
    paint(p, PAL);
    const src = p._px;
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? null : src[y * N + x];
    const out = src.slice();
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x) {
        const c = src[y * N + x];
        if (!c || p._flat[y * N + x]) continue;
        if (at(x + 1, y) !== c && at(x, y + 1) !== c && (at(x + 1, y) === null || at(x, y + 1) === null))
          out[y * N + x] = shadeColor(c, -0.3);
        else if (at(x, y + 1) === null || at(x + 1, y) === null)
          out[y * N + x] = shadeColor(c, -0.22);
        else if (at(x, y - 1) === null || at(x - 1, y) === null)
          out[y * N + x] = shadeColor(c, 0.25);
      }
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x)
        if (!src[y * N + x] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)))
          out[y * N + x] = SPRITE_OUTLINE;
    const cv = document.createElement('canvas');
    cv.width = N;
    cv.height = N;
    const g = cv.getContext('2d');
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x)
        if (out[y * N + x]) {
          g.fillStyle = out[y * N + x];
          g.fillRect(x, y, 1, 1);
        }
    return cv;
  }

  function paintSun(p, P, cx, cy, r) {
    for (let a = 0; a < 8; ++a) {
      const ang = a * Math.PI / 4;
      p.line(cx + Math.cos(ang) * (r + 2), cy + Math.sin(ang) * (r + 2), cx + Math.cos(ang) * (r + 3), cy + Math.sin(ang) * (r + 3), P.orange);
    }
    p.disc(cx, cy, r, P.yellow);
    p.px(cx - 1, cy - 1, P.cream, true);
  }

  function paintRobot(p, P) {
    p.line(7.5, 1, 7.5, 3, P.dgrey);
    p.disc(7.5, 1, 0, P.red, true);
    p.rect(3, 4, 10, 7, P.steel);
    p.rect(5, 6, 2, 2, P.cyan, true);
    p.rect(9, 6, 2, 2, P.cyan, true);
    p.rect(6, 9, 4, 1, P.dgrey, true);
    p.rect(4, 12, 8, 3, P.grey);
    p.rect(1, 6, 2, 3, P.grey);
    p.rect(13, 6, 2, 3, P.grey);
  }

  function paintPot(p, P) {
    p.poly([[4, 10], [12, 10], [11, 15], [5, 15]], P.brown);
    p.rect(3, 9, 10, 2, P.orange);
    p.rect(5, 9, 6, 1, P.soil, true);
  }

  const SPRITE_PAINTERS = {
    /* ── Crops (mature) ── */
    wheat: (p, P) => {
      p.line(7, 14, 7, 6, P.lime); p.line(7, 14, 4, 8, P.lime); p.line(8, 14, 11, 8, P.lime);
      p.ell(7, 4, 1, 3, P.gold); p.ell(4, 6, 1, 3, P.gold); p.ell(11, 6, 1, 3, P.gold);
      p.px(7, 3, P.yellow, true); p.px(4, 5, P.yellow, true); p.px(11, 5, P.yellow, true);
    },
    starfruit: (p, P) => {
      const pts = [];
      for (let i = 0; i < 10; ++i) {
        const ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7;
        pts.push([8 + Math.cos(ang) * r, 8.6 + Math.sin(ang) * r]);
      }
      p.poly(pts, P.gold);
      p.px(7, 6, P.cream, true); p.px(7, 7, P.yellow, true);
      p.line(8, 4, 8, 9, P.yellow, true);
    },
    berry: (p, P) => {
      p.line(7, 2, 8, 6, P.leaf); p.ell(10, 3, 2, 1, P.green);
      p.disc(4.5, 8, 2.5, P.purple); p.disc(10.5, 8, 2.5, P.violet); p.disc(7.5, 11.5, 2.5, P.purple);
      p.px(4, 7, P.pink, true); p.px(10, 7, P.pink, true); p.px(7, 11, P.pink, true);
    },
    lettuce: (p, P) => {
      p.ell(7.5, 9, 6, 5, P.leaf);
      p.ell(7.5, 8.5, 4, 4, P.green);
      p.ell(7.5, 8, 2, 2, P.lime);
      p.line(7.5, 5, 7.5, 13, P.lime, true);
      p.line(4, 8, 6, 11, P.lime, true); p.line(11, 8, 9, 11, P.lime, true);
    },
    corn: (p, P) => {
      p.ell(7.5, 6.5, 2.5, 5.5, P.yellow);
      for (let y = 2; y <= 11; y += 2)
        for (let x = 6; x <= 9; x += 2)
          p.px(x + (y % 4 ? 1 : 0), y, P.gold, true);
      p.poly([[3, 6], [7, 15], [5, 15], [2, 9]], P.green);
      p.poly([[13, 6], [9, 15], [11, 15], [14, 9]], P.leaf);
      p.rect(6, 13, 4, 2, P.leaf);
    },
    melon: (p, P) => {
      p.disc(7.5, 8.5, 6, P.teal);
      for (let i = -1; i <= 1; ++i) {
        p.line(7.5 + i * 3, 3, 7.5 + i * 4, 14, P.cyan, true);
      }
      p.px(5, 5, P.white, true);
      p.rect(7, 1, 2, 2, P.leaf);
    },
    tomato: (p, P) => {
      p.ell(7.5, 9, 6, 5, P.red);
      p.poly([[4, 4], [8, 5.5], [12, 4], [10, 6.5], [8, 7.5], [6, 6.5]], P.green);
      p.rect(7, 2, 2, 3, P.leaf);
      p.px(4, 8, P.pink, true); p.px(5, 7, P.pink, true);
    },
    mushroom: (p, P) => {
      p.rect(6, 9, 4, 6, P.cream);
      p.ell(7.5, 7, 6.5, 4.5, P.violet);
      p.rect(0, 9, 16, 3, null);
      p.rect(6, 9, 4, 6, P.cream);
      p.rect(1, 8, 14, 1, P.purple);
      p.px(5, 4, P.pink, true); p.px(9, 3, P.pink, true); p.px(11, 6, P.pink, true); p.px(4, 7, P.pink, true); p.px(8, 6, P.pink, true);
    },
    pepper: (p, P) => {
      p.poly([[4, 5], [10, 4], [12, 7], [11, 11], [7, 14], [3, 15], [6, 11], [5, 8]], P.red);
      p.line(6, 6, 6, 9, P.pink, true);
      p.line(10, 4, 12, 1, P.leaf); p.rect(8, 3, 4, 2, P.green);
    },
    flower: (p, P) => {
      p.line(7.5, 10, 7.5, 15, P.leaf); p.ell(10, 13, 2, 1, P.green);
      for (let i = 0; i < 5; ++i) {
        const ang = -Math.PI / 2 + i * 2 * Math.PI / 5;
        p.disc(7.5 + Math.cos(ang) * 4, 6.5 + Math.sin(ang) * 4, 2.2, P.sky);
      }
      p.disc(7.5, 6.5, 1.5, P.yellow);
      p.px(7, 6, P.white, true);
    },
    moss: (p, P) => {
      p.ell(7.5, 11, 6.5, 3.5, P.slate);
      p.ell(5, 9, 3, 2.5, P.slate); p.ell(10, 8.5, 3, 3, P.slate);
      p.px(4, 10, P.sky, true); p.px(9, 7, P.sky, true); p.px(11, 11, P.sky, true); p.px(6, 12, P.sky, true);
      p.ell(7.5, 6, 2, 2, P.slate);
      p.px(12, 3, P.cream, true); p.px(3, 4, P.cream, true); p.px(8, 2, P.sky, true);
    },
    solarvine: (p, P) => {
      p.line(3, 15, 4, 11, P.leaf); p.line(4, 11, 7, 10, P.leaf); p.line(7, 10, 8, 13, P.leaf); p.line(8, 13, 11, 12, P.leaf);
      p.ell(3, 9, 1, 1, P.green); p.ell(11, 14, 1, 1, P.green);
      paintSun(p, P, 8, 5, 2.5);
    },

    /* ── Growth stages ── */
    sprout: (p, P) => {
      p.ell(7.5, 13, 5, 1.5, P.soil);
      p.line(7.5, 12, 7.5, 8, P.lime);
      p.ell(5, 7, 2, 1, P.green); p.ell(10, 6, 2, 1, P.green);
    },

    /* ── Livestock ── */
    cow: (p, P) => {
      p.rect(4, 6, 10, 6, P.white);
      p.rect(5, 12, 2, 3, P.white); p.rect(11, 12, 2, 3, P.white);
      p.ell(3, 7, 2.5, 2.5, P.white);
      p.rect(0, 8, 3, 2, P.pink);
      p.px(2, 6, P.black, true);
      p.px(1, 4, P.cream); p.px(4, 4, P.cream);
      p.rect(7, 7, 3, 2, P.black, true); p.rect(11, 9, 2, 2, P.black, true); p.px(9, 10, P.black, true);
      p.line(14, 6, 15, 10, P.white);
      p.rect(8, 12, 2, 1, P.pink, true);
    },
    hen: (p, P) => {
      p.ell(8.5, 9.5, 5, 4, P.white);
      p.disc(4.5, 5, 2.5, P.white);
      p.rect(3, 1, 3, 2, P.red);
      p.rect(0, 5, 2, 2, P.gold);
      p.px(2, 7, P.red, true);
      p.px(4, 4, P.black, true);
      p.poly([[12, 6], [15, 3], [15, 8], [13, 10]], P.cream);
      p.ell(9, 9.5, 2.5, 1.5, P.cream);
      p.line(7, 14, 7, 15, P.orange); p.line(10, 14, 10, 15, P.orange);
    },
    goat: (p, P) => {
      p.rect(5, 6, 9, 5, P.tan);
      p.rect(6, 11, 2, 4, P.tan); p.rect(12, 11, 2, 4, P.tan);
      p.ell(3.5, 5.5, 2, 2.5, P.tan);
      p.line(3, 2, 6, 0, P.grey); p.line(4, 2, 7, 1, P.grey);
      p.px(3, 5, P.black, true);
      p.line(2, 8, 2, 10, P.white);
      p.px(14, 5, P.tan);
      p.ell(9, 7, 2, 1, P.cream, true);
    },
    chick: (p, P) => {
      p.disc(7.5, 6, 4, P.yellow);
      p.poly([[2, 9], [4, 8], [6, 10], [8, 8], [10, 10], [12, 8], [14, 9], [13, 15], [3, 15]], P.white);
      p.rect(1, 5, 2, 2, P.orange);
      p.px(5, 5, P.black, true); p.px(10, 5, P.black, true);
      p.px(6, 3, P.cream, true);
    },

    /* ── Produce ── */
    milk: (p, P) => {
      p.rect(6, 1, 4, 2, P.blue);
      p.rect(6, 3, 4, 2, P.white);
      p.poly([[6, 5], [10, 5], [12, 8], [12, 15], [4, 15], [4, 8]], P.white);
      p.rect(4, 9, 8, 3, P.sky, true);
    },
    egg: (p, P) => {
      p.ell(7.5, 8.5, 4.5, 6, P.cream);
      p.px(6, 5, P.white, true); p.px(5, 6, P.white, true);
    },
    wool: (p, P) => {
      p.disc(7.5, 8.5, 6, P.pink);
      p.line(3, 5, 12, 12, P.maroon, true); p.line(2, 9, 9, 15, P.maroon, true); p.line(6, 3, 14, 9, P.maroon, true);
      p.line(13, 13, 15, 15, P.pink);
    },
    feather: (p, P) => {
      p.poly([[13, 1], [15, 3], [8, 11], [4, 12], [5, 8]], P.white);
      p.poly([[13, 1], [9, 3], [4, 9], [5, 8]], P.sky);
      p.line(2, 14, 13, 2, P.grey, true);
    },

    /* ── Upgrades ── */
    growth: (p, P) => {
      p.ell(5.5, 13, 4, 1.5, P.soil);
      p.line(5.5, 12, 5.5, 8, P.lime); p.ell(3, 7, 2, 1, P.green); p.ell(8, 6, 2, 1, P.green);
      p.poly([[12, 2], [15, 6], [13, 6], [13, 12], [11, 12], [11, 6], [9, 6]], P.lime);
    },
    crate: (p, P) => {
      p.rect(2, 4, 12, 11, P.tan);
      p.rect(2, 4, 12, 2, P.brown, true); p.rect(2, 9, 12, 1, P.brown, true); p.rect(2, 14, 12, 1, P.brown, true);
      p.line(3, 6, 12, 13, P.brown, true);
    },
    shield: (p, P) => {
      p.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], P.blue);
      p.rect(7, 4, 2, 8, P.white, true); p.rect(4, 6, 8, 2, P.white, true);
    },
    robot: paintRobot,
    map: (p, P) => {
      p.poly([[1, 3], [5, 2], [10, 4], [15, 3], [15, 13], [10, 14], [5, 12], [1, 13]], P.cream);
      p.line(5, 2, 5, 12, P.tan, true); p.line(10, 4, 10, 14, P.tan, true);
      p.line(3, 10, 7, 7, P.red, true); p.line(7, 7, 12, 9, P.red, true);
      p.px(12, 8, P.red, true); p.px(13, 9, P.red, true); p.px(12, 10, P.red, true); p.px(11, 9, P.red, true);
      p.ell(4, 5, 1, 1, P.green, true);
    },
    flask: (p, P) => {
      p.rect(6, 1, 4, 5, P.steel);
      p.poly([[6, 5], [10, 5], [15, 14], [1, 14]], P.steel);
      p.poly([[4.5, 9], [11.5, 9], [14, 13.5], [2, 13.5]], P.lime, true);
      p.px(6, 11, P.white, true); p.px(9, 12, P.white, true);
      p.rect(5, 0, 6, 1, P.brown);
    },
    chart: (p, P) => {
      p.rect(1, 1, 14, 14, P.white);
      p.rect(3, 10, 2, 3, P.blue, true); p.rect(6, 8, 2, 5, P.blue, true); p.rect(9, 6, 2, 7, P.blue, true); p.rect(12, 3, 2, 10, P.blue, true);
      p.line(2, 9, 13, 2, P.red, true);
    },
    drop: (p, P) => {
      p.poly([[8, 1], [12, 8], [12.5, 11], [10, 14.5], [6, 14.5], [3.5, 11], [4, 8]], P.blue);
      p.disc(8, 10.5, 4, P.blue);
      p.px(6, 9, P.sky, true); p.px(6, 10, P.sky, true); p.px(7, 7, P.sky, true);
    },

    /* ── Buildings ── */
    sprinkler: (p, P) => {
      p.rect(7, 8, 2, 6, P.steel);
      p.rect(4, 13, 8, 2, P.dgrey);
      p.rect(5, 6, 6, 2, P.grey);
      const drops = [[2, 4], [4, 2], [7, 1], [11, 2], [13, 4], [1, 7], [14, 7], [3, 5.5], [12, 5.5]];
      for (const d of drops) p.px(d[0], d[1], P.sky, true);
    },
    harvester: (p, P) => {
      paintRobot(p, P);
      p.rect(13, 6, 2, 3, null);
      p.line(13, 7, 15, 10, P.grey); p.rect(14, 10, 2, 1, P.yellow); p.px(14, 11, P.yellow);
      p.px(5, 6, P.lime, true); p.px(9, 6, P.lime, true);
    },
    greenhouse: (p, P) => {
      p.poly([[1, 7], [8, 1], [15, 7], [15, 15], [1, 15]], P.sky);
      p.line(1, 7, 8, 1, P.white, true); p.line(8, 1, 15, 7, P.white, true);
      p.line(8, 1, 8, 15, P.white, true); p.line(1, 11, 15, 11, P.white, true);
      p.line(4.5, 4, 4.5, 15, P.white, true); p.line(11.5, 4, 11.5, 15, P.white, true);
      p.ell(6, 13, 1, 1, P.green, true); p.ell(10, 13, 1, 1, P.green, true);
    },
    silo: (p, P) => {
      p.rect(4, 5, 8, 10, P.red);
      p.ell(7.5, 5, 4, 3, P.steel);
      p.rect(4, 8, 8, 1, P.maroon, true); p.rect(4, 12, 8, 1, P.maroon, true);
      p.rect(7, 11, 2, 4, P.dbrown, true);
      p.rect(12, 9, 3, 6, P.grey);
    },
    solarpanel: (p, P) => {
      p.poly([[3, 3], [15, 3], [13, 11], [1, 11]], P.blue);
      for (let i = 1; i < 4; ++i) p.line(3 + i * 3, 3, 1 + i * 3, 11, P.sky, true);
      p.line(2, 7, 14, 7, P.sky, true);
      p.rect(7, 12, 2, 3, P.grey);
      p.rect(4, 14, 8, 1, P.dgrey);
    },
    turbine: (p, P) => {
      p.poly([[7, 7], [9, 7], [10, 15], [6, 15]], P.white);
      p.poly([[8, 6], [7, 0], [9, 0]], P.steel);
      p.poly([[8, 6], [14, 10], [13, 11]], P.steel);
      p.poly([[8, 6], [2, 10], [3, 11]], P.steel);
      p.disc(8, 6, 1, P.grey);
    },
    compost: (p, P) => {
      p.poly([[3, 5], [13, 5], [12, 15], [4, 15]], P.green);
      p.rect(2, 3, 12, 2, P.leaf);
      p.rect(7, 2, 2, 1, P.leaf);
      p.poly([[8, 7], [11, 10], [9, 10], [9, 13], [7, 13], [7, 10], [5, 10]], P.lime, true);
    },
    scarecrow: (p, P) => {
      p.rect(7, 6, 2, 9, P.brown);
      p.rect(1, 7, 14, 2, P.brown);
      p.poly([[4, 7], [12, 7], [11, 12], [5, 12]], P.blue);
      p.disc(8, 4, 2, P.tan);
      p.rect(3, 1, 10, 1, P.gold); p.rect(5, 0, 6, 1, P.gold);
      p.px(7, 4, P.black, true); p.px(9, 4, P.black, true);
      p.px(1, 9, P.yellow); p.px(14, 9, P.yellow); p.px(6, 13, P.yellow); p.px(10, 13, P.yellow);
    },
    fence: (p, P) => {
      for (const x of [2, 7, 12]) {
        p.rect(x, 3, 2, 12, P.tan);
        p.px(x, 2, P.tan);
      }
      p.rect(1, 6, 14, 2, P.brown); p.rect(1, 11, 14, 2, P.brown);
    },
    planter1: (p, P) => {
      paintPot(p, P);
      p.line(8, 9, 8, 5, P.lime); p.ell(5.5, 4, 2, 1, P.green); p.ell(10.5, 4, 2, 1, P.green);
    },
    planter2: (p, P) => {
      paintPot(p, P);
      p.line(8, 9, 8, 2, P.leaf);
      p.ell(5, 7, 2, 1, P.green); p.ell(11, 7, 2, 1, P.green);
      p.ell(5.5, 4, 2, 1, P.green); p.ell(10.5, 4, 2, 1, P.green);
      p.ell(8, 1, 1, 1, P.lime);
    },
    collector: (p, P) => {
      p.poly([[1, 9], [5, 9], [6, 11], [10, 11], [11, 9], [15, 9], [15, 15], [1, 15]], P.grey);
      p.poly([[8, 10], [12, 5], [10, 5], [10, 0], [6, 0], [6, 5], [4, 5]], P.lime);
    },

    /* ── Seasons, time of day, tools ── */
    spring: (p, P) => {
      p.line(7.5, 15, 7.5, 7, P.leaf);
      p.ell(4, 9, 3, 1.5, P.green); p.ell(11, 7, 3, 1.5, P.green);
      p.disc(7.5, 4, 2.5, P.pink); p.disc(7.5, 4, 0.8, P.yellow, true);
    },
    sun: (p, P) => paintSun(p, P, 7.5, 7.5, 3.5),
    autumn: (p, P) => {
      p.poly([[8, 1], [10, 5], [14, 4], [12, 9], [15, 11], [9, 12], [8, 15], [7, 12], [1, 11], [4, 9], [2, 4], [6, 5]], P.orange);
      p.line(8, 4, 8, 15, P.red, true); p.line(8, 9, 4, 6, P.red, true); p.line(8, 9, 12, 6, P.red, true);
    },
    winter: (p, P) => {
      for (let a = 0; a < 3; ++a) {
        const ang = a * Math.PI / 3, dx = Math.cos(ang) * 6.5, dy = Math.sin(ang) * 6.5;
        p.line(7.5 - dx, 7.5 - dy, 7.5 + dx, 7.5 + dy, P.sky);
      }
      for (let a = 0; a < 6; ++a) {
        const ang = a * Math.PI / 3, bx = 7.5 + Math.cos(ang) * 4.5, by = 7.5 + Math.sin(ang) * 4.5;
        p.px(bx + Math.cos(ang + 1) * 1.4, by + Math.sin(ang + 1) * 1.4, P.sky);
        p.px(bx + Math.cos(ang - 1) * 1.4, by + Math.sin(ang - 1) * 1.4, P.sky);
      }
      p.px(7.5, 7.5, P.white, true);
    },
    moon: (p, P) => {
      p.disc(7.5, 7.5, 6, P.cream);
      p.disc(10.5, 5.5, 5, null);
      p.px(4, 9, P.tan, true); p.px(6, 12, P.tan, true);
    },
    hoe: (p, P) => {
      p.line(3, 14, 12, 3, P.brown); p.line(4, 14, 13, 3, P.tan);
      p.poly([[9, 1], [15, 1], [15, 4], [12, 7], [11, 5]], P.steel);
    },
    mouse: (p, P) => {
      p.ell(8, 10, 5, 3, P.grey);
      p.disc(4, 8, 2.5, P.grey);
      p.disc(4, 5, 1.5, P.pink);
      p.px(1, 9, P.pink, true);
      p.px(3, 8, P.black, true);
      p.line(13, 11, 15, 8, P.pink);
      p.px(6, 13, P.pink, true); p.px(10, 13, P.pink, true);
    },
    trap: (p, P) => {
      p.rect(1, 10, 14, 4, P.tan);
      p.rect(1, 13, 14, 1, P.brown, true);
      p.line(3, 9, 9, 3, P.steel); p.line(9, 3, 11, 9, P.steel);
      p.rect(10, 8, 3, 2, P.yellow);
    },

    /* ── Interface icons ── */
    coin: (p, P) => {
      p.disc(7.5, 7.5, 6.5, P.gold);
      p.disc(7.5, 7.5, 4.5, P.yellow);
      p.rect(7, 4, 2, 7, P.gold, true);
      p.rect(5, 5, 5, 1, P.gold, true); p.rect(6, 7, 3, 1, P.gold, true); p.rect(5, 9, 5, 1, P.gold, true);
      p.px(4, 3, P.cream, true); p.px(3, 4, P.cream, true);
    },
    lock: (p, P) => {
      p.rect(4, 2, 8, 2, P.steel); p.rect(4, 2, 2, 6, P.steel); p.rect(10, 2, 2, 6, P.steel);
      p.rect(2, 7, 12, 8, P.gold);
      p.rect(7, 9, 2, 4, P.dbrown, true);
      p.rect(3, 8, 10, 1, P.yellow, true);
    },
    check: (p, P) => {
      p.disc(7.5, 7.5, 7, P.green);
      p.line(4, 8, 6, 11, P.white, true); p.line(6, 11, 11, 4, P.white, true);
      p.line(4, 7, 6, 10, P.white, true); p.line(6, 10, 11, 3, P.white, true);
    },
    bolt: (p, P) => {
      p.poly([[9, 0], [3, 9], [7.5, 9], [5, 16], [13, 6], [8.5, 6], [11, 0]], P.yellow);
      p.line(9, 2, 6, 7, P.cream, true);
    },
    seedbag: (p, P) => {
      p.poly([[3, 6], [13, 6], [14, 15], [2, 15]], P.tan);
      p.rect(5, 3, 6, 3, P.tan);
      p.rect(4, 5, 8, 1, P.brown, true);
      p.line(8, 4, 8, 1, P.leaf); p.ell(6, 1, 1.5, 0.8, P.green); p.ell(10, 1.5, 1.5, 0.8, P.green);
      p.disc(8, 11, 2, P.lime, true); p.px(8, 11, P.leaf, true);
    },
    hammer: (p, P) => {
      p.line(4, 15, 10, 6, P.brown); p.line(5, 15, 11, 6, P.tan);
      p.poly([[6, 2], [12, 1], [15, 4], [13, 9], [10, 7], [8, 5]], P.steel);
      p.line(12, 2, 14, 5, P.white, true);
    },
    paw: (p, P) => {
      p.ell(8, 11, 4, 3.5, P.pink);
      p.disc(3, 6, 1.6, P.pink); p.disc(6, 3, 1.6, P.pink); p.disc(10, 3, 1.6, P.pink); p.disc(13, 6, 1.6, P.pink);
      p.ell(8, 11.5, 2, 1.5, P.maroon, true);
    },
    techtree: (p, P) => {
      p.line(8, 14, 8, 4, P.cyan); p.line(8, 9, 3, 5, P.cyan); p.line(8, 9, 13, 5, P.cyan); p.line(8, 14, 3, 11, P.cyan);
      p.disc(8, 3, 2, P.yellow); p.disc(3, 4.5, 1.6, P.lime); p.disc(13, 4.5, 1.6, P.pink); p.disc(2.5, 11, 1.6, P.sky);
      p.rect(5, 13, 6, 3, P.steel);
    },
    star: (p, P) => {
      const pts = [];
      for (let i = 0; i < 10; ++i) {
        const ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 7;
        pts.push([7.5 + Math.cos(ang) * r, 8.3 + Math.sin(ang) * r]);
      }
      p.poly(pts, P.yellow);
      p.px(7, 6, P.cream, true); p.px(6, 7, P.cream, true);
    },
    basket: (p, P) => {
      p.poly([[1, 7], [15, 7], [13, 15], [3, 15]], P.tan);
      for (let x = 3; x < 14; x += 3) p.line(x, 8, x - 0.5, 14, P.brown, true);
      p.rect(1, 7, 14, 1, P.brown, true);
      p.disc(5, 5, 2, P.red); p.disc(9, 4.5, 2, P.lime); p.disc(12, 5.5, 1.6, P.purple);
    },
    cloud: (p, P) => {
      p.ell(8, 10, 6.5, 3.5, P.white);
      p.disc(5, 8, 3, P.white); p.disc(9.5, 6.5, 3.5, P.white);
      p.rect(2, 12, 12, 1, P.steel, true);
    },
    rain: (p, P) => {
      p.ell(8, 6, 6.5, 3, P.steel); p.disc(5, 4.5, 2.5, P.steel); p.disc(9.5, 3.5, 3, P.steel);
      for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 15]]) p.line(x, y, x - 1, y + 1, P.sky, true);
    },
    storm: (p, P) => {
      p.ell(8, 6, 6.5, 3, P.dgrey); p.disc(5, 4.5, 2.5, P.dgrey); p.disc(9.5, 3.5, 3, P.dgrey);
      p.poly([[9, 8], [5, 12], [8, 12], [6, 16], [12, 10], [9, 10], [11, 8]], P.yellow);
    },
    meteor: (p, P) => {
      p.line(1, 1, 9, 9, P.orange); p.line(2, 1, 10, 8, P.red); p.line(1, 2, 8, 9, P.yellow);
      p.disc(11, 11, 3.5, P.brown); p.px(10, 10, P.tan, true); p.px(12, 12, P.dbrown, true);
    },
    flare: (p, P) => {
      paintSun(p, P, 7.5, 7.5, 3.5);
      p.px(1, 1, P.yellow, true); p.px(14, 2, P.yellow, true); p.px(13, 14, P.yellow, true);
    },
    dust: (p, P) => {
      for (const [y, x0, x1] of [[4, 2, 12], [7, 4, 15], [10, 1, 11], [13, 5, 13]]) p.line(x0, y, x1, y, P.tan);
      p.disc(13, 4, 1.5, P.tan); p.disc(3, 10, 1.5, P.tan);
      p.px(6, 4, P.cream, true); p.px(9, 7, P.cream, true);
    },
    snow: (p, P) => {
      p.ell(8, 5.5, 6.5, 3, P.steel); p.disc(5, 4, 2.5, P.steel); p.disc(9.5, 3, 3, P.steel);
      for (const [x, y] of [[4, 11], [8, 12], [12, 10], [6, 14], [11, 14]]) { p.px(x, y, P.white, true); p.px(x + 1, y, P.white, true); p.px(x, y + 1, P.white, true); }
    },
    target: (p, P) => {
      p.disc(7.5, 7.5, 7, P.red); p.disc(7.5, 7.5, 5, P.white); p.disc(7.5, 7.5, 3, P.red); p.disc(7.5, 7.5, 1, P.white, true);
    },
    scroll: (p, P) => {
      p.rect(3, 2, 10, 12, P.cream);
      p.rect(2, 1, 12, 2, P.tan); p.rect(2, 13, 12, 2, P.tan);
      for (let y = 5; y <= 11; y += 2) p.line(5, y, 11, y, P.tan, true);
      p.disc(11, 11, 1.5, P.red, true);
    },
    pause: (p, P) => {
      p.rect(3, 2, 4, 12, P.steel); p.rect(9, 2, 4, 12, P.steel);
    },
    book: (p, P) => {
      p.rect(2, 2, 12, 12, P.blue); p.rect(4, 2, 10, 11, P.cream); p.rect(2, 12, 12, 2, P.violet);
      p.line(6, 5, 11, 5, P.tan, true); p.line(6, 7, 11, 7, P.tan, true); p.line(6, 9, 10, 9, P.tan, true);
    },
    market: (p, P) => {
      p.rect(2, 8, 12, 7, P.tan);
      p.poly([[1, 7], [3, 2], [13, 2], [15, 7]], P.red);
      for (let x = 3; x < 14; x += 4) p.poly([[x, 2], [x + 2, 2], [x + 2.5, 7], [x - 0.5, 7]], P.white, true);
      p.rect(4, 9, 3, 3, P.lime, true); p.rect(9, 9, 3, 3, P.orange, true);
      p.rect(2, 14, 12, 1, P.brown, true);
    },
    eye: (p, P) => {
      p.ell(7.5, 8, 7, 4, P.white); p.disc(7.5, 8, 3, P.blue); p.disc(7.5, 8, 1.4, P.black, true); p.px(6, 7, P.white, true);
    },
    /* ── Tree-unlocked crops, animals and buildings ── */
    pumpkin: (p, P) => {
      p.ell(7.5, 10, 7, 5, P.orange);
      p.ell(4, 10, 2.5, 4.5, P.gold); p.ell(11, 10, 2.5, 4.5, P.gold);
      p.line(7.5, 6, 7.5, 15, P.brown, true);
      p.rect(7, 2, 2, 4, P.leaf); p.ell(10.5, 3.5, 2, 1, P.green);
      p.px(4, 8, P.cream, true); p.px(5, 7, P.yellow, true);
      p.px(13, 6, P.cyan, true); p.px(2, 5, P.cyan, true);
    },
    kale: (p, P) => {
      p.ell(7.5, 10, 6.5, 5, P.teal);
      p.ell(4.5, 8, 3, 3.5, P.cyan); p.ell(10.5, 7.5, 3, 4, P.cyan); p.ell(7.5, 6, 2.5, 4, P.sky);
      p.line(7.5, 4, 7.5, 14, P.white, true); p.line(4, 7, 6, 12, P.white, true); p.line(11, 6, 9, 12, P.white, true);
      p.px(3, 5, P.white, true); p.px(12, 4, P.white, true);
    },
    rabbit: (p, P) => {
      p.ell(9, 10.5, 5, 3.5, P.white);
      p.disc(4.5, 8, 2.5, P.white);
      p.rect(3, 1, 2, 6, P.white); p.rect(5, 2, 2, 5, P.white);
      p.px(3, 3, P.pink, true); p.px(3, 4, P.pink, true); p.px(5, 4, P.pink, true);
      p.px(3, 8, P.black, true); p.px(2, 9, P.pink, true);
      p.disc(14, 9.5, 1.2, P.sky);
      p.rect(6, 13, 2, 2, P.white); p.rect(11, 13, 2, 2, P.white);
    },
    bee: (p, P) => {
      p.poly([[3, 15], [13, 15], [14, 9], [8, 4], [2, 9]], P.gold);
      for (const y of [9, 11, 13]) p.line(3, y, 13, y, P.brown, true);
      p.rect(6, 12, 4, 3, P.dbrown, true);
      p.ell(12, 3, 2.5, 2, P.yellow); p.line(10, 3, 14, 3, P.black, true);
      p.ell(12, 1, 2, 1, P.sky);
      p.ell(4, 4, 2, 1.5, P.yellow); p.px(4, 3, P.black, true);
    },
    fur: (p, P) => {
      p.ell(7.5, 9, 6.5, 5, P.steel);
      p.ell(5, 7, 3, 2.5, P.white); p.ell(10, 8, 3, 2.5, P.white); p.ell(7.5, 11, 3, 2, P.white);
      p.px(4, 6, P.sky, true); p.px(11, 7, P.sky, true);
    },
    honey: (p, P) => {
      p.rect(4, 5, 8, 10, P.gold);
      p.rect(3, 3, 10, 2, P.tan); p.rect(5, 1, 6, 2, P.cream);
      p.rect(5, 7, 6, 3, P.cream, true);
      p.px(6, 8, P.orange, true); p.px(9, 8, P.orange, true);
      p.line(5, 12, 5, 14, P.yellow, true);
    },
    lamp: (p, P) => {
      p.rect(7, 5, 2, 9, P.dgrey);
      p.rect(5, 14, 6, 2, P.grey);
      p.poly([[4, 5], [12, 5], [10, 1], [6, 1]], P.steel);
      p.rect(5, 5, 6, 2, P.yellow, true);
      p.px(7, 6, P.white, true);
    },
    zapper: (p, P) => {
      p.rect(6, 6, 4, 8, P.grey);
      for (const y of [7, 9, 11]) p.rect(5, y, 6, 1, P.orange, true);
      p.rect(4, 14, 8, 2, P.dgrey);
      p.disc(8, 3.5, 2.5, P.cyan);
      p.px(7, 2, P.white, true);
      p.px(3, 2, P.sky, true); p.px(13, 4, P.sky, true); p.px(2, 5, P.sky, true);
    },
    order: (p, P) => {
      p.rect(2, 3, 12, 11, P.cream);
      p.rect(2, 3, 12, 3, P.green);
      p.line(4, 8, 11, 8, P.tan, true); p.line(4, 10, 9, 10, P.tan, true);
      p.disc(11.5, 11.5, 2.5, P.gold); p.px(11, 11, P.yellow, true);
    },
    rockpile: (p, P) => {
      p.ell(6, 10, 5.5, 4.5, P.dgrey);
      p.ell(10.5, 11, 4.5, 3.5, P.grey);
      p.ell(6, 8.5, 4, 3.5, P.grey);
      p.ell(5, 7.5, 2, 1.5, P.steel, true);
      p.ell(11, 10, 2, 1, P.steel, true);
      p.line(7, 9, 9, 12, P.black, true);
      p.line(3, 11, 5, 13, P.black, true);
      p.rect(2, 14, 13, 1, P.dgrey);
    },
    rockpile2: (p, P) => {
      p.poly([[2, 14], [3, 7], [7, 3], [11, 4], [14, 9], [14, 14]], P.grey);
      p.poly([[3, 9], [7, 4], [10, 5], [8, 9], [4, 11]], P.steel);
      p.line(8, 9, 12, 13, P.dgrey, true);
      p.line(8, 9, 6, 13, P.dgrey, true);
      p.px(6, 5, P.white, true);
      p.ell(12.5, 13, 2, 1.5, P.dgrey);
    },
    pick: (p, P) => {
      p.line(4, 15, 10, 5, P.brown); p.line(5, 15, 11, 5, P.tan);
      p.poly([[3, 4], [8, 1], [13, 2], [15, 5], [12, 4], [8, 3.5], [5, 6]], P.steel);
      p.px(13, 3, P.white, true);
    },
    soil: (p, P) => {
      p.rect(1, 9, 14, 6, P.soil);
      p.rect(1, 9, 14, 1, P.brown, true);
      for (const x of [3, 7, 11]) {
        p.line(x, 9, x, 4, P.leaf);
        p.ell(x - 1, 5, 1.2, 0.8, P.green);
        p.ell(x + 1, 4, 1.2, 0.8, P.lime);
      }
      p.px(4, 12, P.lime, true); p.px(9, 13, P.lime, true); p.px(12, 11, P.lime, true);
    },
    heart: (p, P) => {
      p.disc(5, 6, 3.5, P.red); p.disc(10.5, 6, 3.5, P.red);
      p.poly([[1.5, 7], [14, 7], [7.75, 14.5]], P.red);
      p.px(4, 4, P.pink, true); p.px(5, 4, P.pink, true); p.px(4, 5, P.pink, true);
    },
    zoom: (p, P) => {
      p.disc(6.5, 6.5, 5, P.steel); p.disc(6.5, 6.5, 3.5, P.sky); p.px(5, 5, P.white, true);
      p.line(10, 10, 14, 14, P.brown); p.line(11, 10, 15, 14, P.brown);
    },
  };

  const spriteCache = {};

  function getSprite(key) {
    let spr = spriteCache[key];
    if (!spr) {
      const paint = SPRITE_PAINTERS[key];
      if (!paint) return null;
      spr = spriteCache[key] = bakeSprite(paint);
    }
    return spr;
  }

  /* Young plant tinted with the crop's colour */
  function getYoungCropSprite(crop) {
    const key = 'young:' + crop.sprite;
    let spr = spriteCache[key];
    if (!spr)
      spr = spriteCache[key] = bakeSprite((p, P) => {
        p.ell(7.5, 13.5, 5.5, 1.5, P.soil);
        p.line(7.5, 13, 7.5, 4, P.leaf);
        p.ell(4.5, 10, 2.5, 1, P.green); p.ell(10.5, 9, 2.5, 1, P.green);
        p.ell(5, 6, 2, 1, P.green); p.ell(10, 5, 2, 1, P.green);
        p.disc(7.5, 3, 1.5, crop.color);
        p.disc(3, 7.5, 1, crop.color); p.disc(12, 6.5, 1, crop.color);
      });
    return spr;
  }

  let spriteScale = 1;                // device pixels per drawing unit of the current pass

  /* Draws a sprite centred on (cx, cy) with the given on-screen size */
  function drawSprite(key, cx, cy, size, alpha) {
    const spr = typeof key === 'string' ? getSprite(key) : key;
    if (!spr) return;
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevAlpha = ctx.globalAlpha;
    // crisp pixels when enlarged, smooth when shrunk
    ctx.imageSmoothingEnabled = size * spriteScale / spr.width < 1.5;
    if (alpha !== undefined)
      ctx.globalAlpha = prevAlpha * alpha;
    const s = Math.round(size);
    ctx.drawImage(spr, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.globalAlpha = prevAlpha;
  }

  function getCropStageSprite(crop, stage) {
    const maxStage = crop.stages - 1;
    if (stage >= maxStage) return getSprite(crop.sprite);
    if (stage <= 0) return getSprite('sprout');
    return getYoungCropSprite(crop);
  }


  /* ══════════════════════════════════════════════════════════════════
     TEXT LAYOUT — every label is measured against the box it lives in
     ══════════════════════════════════════════════════════════════════ */

  const UI_FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

  function uiFont(px, weight) {
    return (weight ? weight + ' ' : '') + px + 'px ' + UI_FONT;
  }

  /* Text with inline [[sprite]] tokens; odd entries of the split are sprite keys */
  function splitIconText(text) {
    return String(text).split(/\[\[(\w+)\]\]/);
  }

  function getFontPx() {
    const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
    return m ? parseFloat(m[1]) : 16;
  }

  function measureIconText(text) {
    const parts = splitIconText(text);
    const iconSize = Math.round(getFontPx() * 1.25);
    let w = 0;
    for (let i = 0; i < parts.length; ++i)
      w += i % 2 ? iconSize : ctx.measureText(parts[i]).width;
    return w;
  }

  /* Draws icon text honouring the current textAlign / textBaseline */
  function fillIconText(text, x, y) {
    const parts = splitIconText(text);
    if (parts.length === 1) {
      ctx.fillText(text, x, y);
      return;
    }
    const fontPx = getFontPx();
    const iconSize = Math.round(fontPx * 1.25);
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
        drawSprite(parts[i], cx + iconSize / 2, iconY, iconSize);
        cx += iconSize;
      } else if (parts[i]) {
        ctx.fillText(parts[i], cx, y);
        cx += ctx.measureText(parts[i]).width;
      }
    }
    ctx.textAlign = align;
  }

  /* Layouts are cached per (text, box, font) since the same labels repeat every frame */
  const textFitCache = new Map();
  function cachedLayout(key, build) {
    let v = textFitCache.get(key);
    if (v === undefined) {
      if (textFitCache.size > 4000)
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

  /* Shortens text with an ellipsis until it fits maxW in the current font */
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

  /* Largest font size in [minPx, px] that fits; ellipsizes when even minPx is too wide */
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
          --size;
          ctx.font = uiFont(size, weight);
          w = measureIconText(text);
        }
      }
      const out = w > maxW ? ellipsize(text, maxW) : text;
      if (out !== text) {
        ctx.font = uiFont(size, weight);
        w = measureIconText(out);
      }
      return { size, text: out, width: Math.min(w, maxW) };
    });
  }

  /* One line of (icon) text that never exceeds maxW; returns the drawn width */
  function fitText(text, x, y, maxW, px, opts) {
    opts = opts || {};
    if (maxW <= 4)
      return 0;
    const l = layoutLine(text, maxW, px, opts.minPx || Math.max(8, Math.round(px * 0.62)), opts.weight);
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

  /* Greedy word wrap in the current font; overlong words are ellipsized */
  let wrapCut = false;               // set when the last wrap had to cut a word
  function wrapText(text, maxW) {
    wrapCut = false;
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
        if (line === word && measureIconText(line) > maxW) {
          line = ellipsize(word, maxW);
          wrapCut = true;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /* Wraps text into a w x h box, shrinking the font until all lines fit */
  function layoutBlock(text, w, h, px, minPx, weight, lineGap) {
    return cachedLayout('B' + text + '|' + Math.round(w) + '|' + Math.round(h) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + lineGap, () => {
      let size = px, lines;
      for (;;) {
        ctx.font = uiFont(size, weight);
        lines = wrapText(text, w);
        if ((lines.length * size * lineGap <= h && !wrapCut) || size <= minPx)
          break;
        --size;
      }
      const maxLines = Math.max(1, Math.floor(h / (size * lineGap)));
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = ellipsize(lines[maxLines - 1] + '…', w);
      }
      return { size, lines, lineH: size * lineGap };
    });
  }

  /* Wrapped text inside a box; align 'left' | 'center', valign 'top' | 'middle' */
  function drawTextBlock(text, x, y, w, h, px, opts) {
    opts = opts || {};
    const b = layoutBlock(text, w, h, px, opts.minPx || Math.max(8, Math.round(px * 0.62)), opts.weight, opts.lineGap || 1.3);
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
     UI PANELS — one frame style for every box on screen
     ══════════════════════════════════════════════════════════════════ */

  const UI = {
    panelTop: 'rgba(22,30,52,0.94)',
    panelBottom: 'rgba(9,12,24,0.94)',
    edge: '#05070e',
    rim: 'rgba(150,180,255,0.16)',
    accent: '#5ab8ff',
    gold: '#ffd75a',
    text: '#e4eaf6',
    textDim: '#93a0bb',
    textMute: '#5d6884',
    good: '#6fe08a',
    bad: '#ff6a6a',
    warn: '#ffb648',
    energy: '#4fd8ff',
    leaf: '#7ee06a'
  };

  function parseHex(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

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

  /* Framed panel: shadow, gradient, dark edge, light rim, accent strip and an
     optional title header. Returns the y where the content starts. */
  /* Frame (shadow, gradient, edges, accent strip, header band) of a panel,
     baked into a bitmap per size and style: blurred shadows are costly to
     draw every frame */
  const panelCache = new Map();

  function paintPanelFrame(g, x, y, w, h, opts) {
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    const path = (px, py, pw, ph, pr) => {
      pr = Math.max(0, Math.min(pr, pw / 2, ph / 2));
      g.beginPath();
      g.moveTo(px + pr, py);
      g.arcTo(px + pw, py, px + pw, py + ph, pr);
      g.arcTo(px + pw, py + ph, px, py + ph, pr);
      g.arcTo(px, py + ph, px, py, pr);
      g.arcTo(px, py, px + pw, py, pr);
      g.closePath();
    };
    if (!opts.flat) {
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = opts.shadow !== undefined ? opts.shadow : 16;
      g.shadowOffsetY = 3;
    }
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, opts.top || UI.panelTop);
    grad.addColorStop(1, opts.bottom || UI.panelBottom);
    path(x, y, w, h, r);
    g.fillStyle = grad;
    g.fill();
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.lineWidth = 2;
    g.strokeStyle = UI.edge;
    g.stroke();
    path(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    g.lineWidth = 1;
    g.strokeStyle = opts.glow ? hexToRgba(accent, 0.75) : UI.rim;
    g.stroke();
    const sg = g.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, hexToRgba(accent, 0));
    sg.addColorStop(0.5, hexToRgba(accent, 0.9));
    sg.addColorStop(1, hexToRgba(accent, 0));
    g.fillStyle = sg;
    g.fillRect(x + r, y + 1, w - r * 2, 2);
    if (opts.title) {
      const hh = opts.headerH || 34;
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x + 2, y + 3, w - 4, hh - 3);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + 8, y + hh, w - 16, 1);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x + 8, y + hh + 1, w - 16, 1);
    }
  }

  /* Draws a w x h shape (plus pad around it) from a bitmap cache; paint(g, x, y)
     fills it on first use at the current scale */
  function drawBaked(key, x, y, w, h, pad, paint) {
    const m = ctx.getTransform();
    const s = Math.max(0.25, Math.round(Math.hypot(m.a, m.b) * 8) / 8);
    const W = Math.round(w), H = Math.round(h);
    const full = key + '|' + W + '|' + H + '|' + s;
    let cv = panelCache.get(full);
    if (!cv) {
      if (panelCache.size > 400)
        panelCache.clear();
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil((W + pad * 2) * s));
      cv.height = Math.max(1, Math.ceil((H + pad * 2) * s));
      const g = cv.getContext('2d');
      g.scale(s, s);
      paint(g, pad, pad, W, H);
      panelCache.set(full, cv);
    }
    ctx.drawImage(cv, x - pad, y - pad, W + pad * 2, H + pad * 2);
  }

  function rrPath(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawPanelFrame(x, y, w, h, opts) {
    const pad = opts.flat ? 3 : Math.ceil((opts.shadow !== undefined ? opts.shadow : 16) + 6);
    const key = ['panel', opts.radius, opts.accent, opts.glow ? 1 : 0, opts.flat ? 1 : 0, opts.shadow, opts.top, opts.bottom, opts.title ? (opts.headerH || 34) : 0].join('|');
    drawBaked(key, x, y, w, h, pad, (g, px, py, W, H) => paintPanelFrame(g, px, py, W, H, opts));
  }

  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    drawPanelFrame(x, y, w, h, opts);
    let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
    if (opts.title) {
      const hh = opts.headerH || 34;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let titleX = x + 12;
      if (opts.icon) {
        drawSprite(opts.icon, titleX + 10, y + hh / 2 + 1, 20);
        titleX += 26;
      }
      const rightW = opts.titleRight ? Math.min(w * 0.42, 170) : 0;
      const closeW = opts.closeId ? 30 : 0;
      fitText(opts.title, titleX, y + hh / 2 + 1, x + w - 12 - rightW - closeW - titleX, opts.titlePx || 17, { weight: 'bold', color: accent });
      if (opts.titleRight) {
        ctx.textAlign = 'right';
        fitText(opts.titleRight, x + w - 12 - closeW, y + hh / 2 + 1, rightW - 8, 13, { weight: 'bold', color: opts.titleRightColor || UI.textDim });
      }
      contentY = y + hh + 8;
    }
    ctx.restore();
    if (opts.closeId)
      drawCloseButton(opts.closeId, x + w - 32, y + 6, 24, opts.onClose);
    return contentY;
  }

  /* Rounded meter with a glossy fill and an optional centred label */
  function drawMeter(x, y, w, h, ratio, color, opts) {
    opts = opts || {};
    ratio = Math.max(0, Math.min(1, ratio));
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
      if (opts.shine) {
        const sx = x + ((uiTime * 90) % (w + 60)) - 30;
        const sg = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x, y, w * ratio, h);
      }
      ctx.restore();
    }
    if (opts.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.78), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
    }
    ctx.restore();
  }

  /* Rounded pill with centred text; returns its width */
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

  /* Keycap hints ("[S] Sell") centred on cx and scaled to stay within maxW */
  function drawKeyHints(hints, cx, cy, maxW, scale) {
    const k = scale || 1;
    const keyPx = 11 * k, labelPx = 12 * k, keyH = 18 * k, gap = 14 * k;
    const parts = hints.map(h => {
      ctx.font = uiFont(keyPx, 'bold');
      const kw = Math.max(keyH, ctx.measureText(h.key).width + 10 * k);
      ctx.font = uiFont(labelPx);
      return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
    });
    let total = -gap;
    for (const p of parts)
      total += p.kw + 5 * k + p.lw + gap;
    const s = Math.min(1, maxW / Math.max(1, total));
    ctx.save();
    ctx.translate(cx - total * s / 2, cy);
    ctx.scale(s, s);
    let x = 0;
    for (const p of parts) {
      roundRectPath(x, -keyH / 2, p.kw, keyH, 4 * k);
      ctx.fillStyle = 'rgba(20,26,42,0.9)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(170,190,230,0.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 3, keyH / 2 - 3, p.kw - 6, 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = uiFont(keyPx, 'bold');
      ctx.fillStyle = '#dfe6f5';
      ctx.fillText(p.key, x + p.kw / 2, 1);
      ctx.textAlign = 'left';
      ctx.font = uiFont(labelPx);
      ctx.fillStyle = 'rgba(200,210,230,0.78)';
      ctx.fillText(p.label, x + p.kw + 5 * k, 1);
      x += p.kw + 5 * k + p.lw + gap;
    }
    ctx.restore();
  }

  /* Large glowing headline (title, pause and celebration banners) */
  function drawHeadline(text, x, y, maxW, px, color, glow) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const l = layoutLine(text, maxW, px, Math.round(px * 0.5), 'bold');
    ctx.font = uiFont(l.size, 'bold');
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, l.size / 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(l.text, x, y + 3);
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, glow || color);
    ctx.fillStyle = g;
    ctx.fillText(l.text, x, y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* Dims the whole screen and darkens the corners */
  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(0, 0, UW, UH);
    if (!vignetteCanvas) {
      vignetteCanvas = document.createElement('canvas');
      vignetteCanvas.width = 160;
      vignetteCanvas.height = 100;
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(80, 50, 20, 80, 50, 95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      v.fillStyle = g;
      v.fillRect(0, 0, 160, 100);
    }
    ctx.drawImage(vignetteCanvas, 0, 0, UW, UH);
  }

  /* ══════════════════════════════════════════════════════════════════
     UI REGIONS — every interactive box registers itself while drawing;
     pointer input is routed to the topmost region of the last frame
     ══════════════════════════════════════════════════════════════════ */

  let uiRegions = [];
  let frameRegions = [];
  let hoverRegionId = null;
  let pressRegionId = null;
  const uiAnim = {};                 // region id -> eased hover value 0..1
  let uiTime = 0;
  let frameDt = 1 / 60;

  /* r: { id, x, y, w, h, onClick, onWheel, tip, disabled, modal } in UI units */
  function addRegion(r) {
    frameRegions.push(r);
    return r;
  }

  function hitRegion(ux, uy) {
    for (let i = uiRegions.length - 1; i >= 0; --i) {
      const r = uiRegions[i];
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return r;
    }
    return null;
  }

  /* Eased hover amount of a region (for lift / glow animations) */
  function hoverAmount(id) {
    const target = hoverRegionId === id ? 1 : 0;
    const a = uiAnim[id] === undefined ? target : uiAnim[id];
    const next = a + (target - a) * Math.min(1, frameDt * 14);
    uiAnim[id] = next;
    return next;
  }

  function isPressed(id) {
    return pressRegionId === id;
  }

  /* Standard button: gradient face, hover lift, press dip */
  function drawButton(b, opts) {
    opts = opts || {};
    const hv = hoverAmount(b.id);
    const pressed = isPressed(b.id) && hoverRegionId === b.id;
    const color = opts.color || UI.accent;
    const lift = pressed ? 1 : -hv * 1.5;
    const disabled = !!opts.disabled;
    ctx.save();
    if (disabled)
      ctx.globalAlpha *= 0.55;
    // the face is baked per size, colour and (stepped) hover amount
    const hq = Math.round(hv * 8) / 8;
    const radius = opts.radius || 9;
    drawBaked(['btn', radius, color, opts.primary ? 1 : 0, opts.active ? 1 : 0, pressed ? 1 : 0, hq].join('|'), b.x, b.y + lift, b.w, b.h, 6, (g, x, y, w, h) => {
      rrPath(g, x + 1, y + (pressed ? 2 : 4), w, h, radius);
      g.fillStyle = `rgba(0,0,0,${0.32 + hq * 0.1})`;
      g.fill();
      rrPath(g, x, y, w, h, radius);
      const gr = g.createLinearGradient(0, y, 0, y + h);
      if (opts.primary) {
        gr.addColorStop(0, hexToRgba(color, 0.55 + hq * 0.2));
        gr.addColorStop(1, hexToRgba(color, 0.22 + hq * 0.15));
      } else {
        gr.addColorStop(0, hq ? 'rgba(58,69,96,0.92)' : 'rgba(42,50,72,0.92)');
        gr.addColorStop(1, hq ? 'rgba(35,42,62,0.92)' : 'rgba(24,29,44,0.92)');
      }
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = opts.active ? 2.5 : 1.5;
      g.strokeStyle = opts.active ? color : (opts.primary ? hexToRgba(color, 0.9) : `rgba(140,160,210,${0.35 + hq * 0.4})`);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      rrPath(g, x + 3, y + 3, w - 6, h * 0.42, 6);
      g.fill();
    });
    const hasIcon = !!opts.icon;
    const keyW = opts.key ? 20 : 0;
    if (opts.chevron) {
      const cx = b.x + b.w / 2, cy = b.y + lift + b.h / 2, s = Math.min(b.w, b.h) * 0.22;
      ctx.strokeStyle = '#d0d8ea';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5 * opts.chevron, cy - s);
      ctx.lineTo(cx + s * 0.5 * opts.chevron, cy);
      ctx.lineTo(cx - s * 0.5 * opts.chevron, cy + s);
      ctx.stroke();
    } else if (hasIcon && opts.vertical) {
      drawSprite(opts.icon, b.x + b.w / 2, b.y + lift + b.h * 0.38, Math.min(b.h * 0.46, 30));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, b.x + b.w / 2, b.y + lift + b.h * 0.8, b.w - 8, opts.px || 11, { weight: 'bold', color: opts.textColor || (opts.primary ? '#fff' : '#d0d8ea'), minPx: 8 });
    } else {
      const iconW = hasIcon ? Math.min(b.h - 10, 22) + 6 : 0;
      ctx.font = uiFont(opts.px || 14, 'bold');
      const l = layoutLine(opts.label, b.w - 16 - iconW - keyW, opts.px || 14, 9, 'bold');
      const total = iconW + l.width;
      let cx = b.x + (b.w - keyW) / 2 - total / 2;
      if (hasIcon) {
        drawSprite(opts.icon, cx + (iconW - 6) / 2, b.y + lift + b.h / 2, iconW - 6);
        cx += iconW;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(opts.label, cx, b.y + lift + b.h / 2 + 1, b.w - 16 - iconW - keyW, opts.px || 14, { weight: 'bold', color: opts.textColor || (opts.primary ? '#fff' : '#d0d8ea'), minPx: 9 });
    }
    if (opts.key)
      drawChip(opts.key, b.x + b.w - 6, b.y + lift + (b.h - 16) / 2, 16, { align: 'right', px: 10, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.22)', color: UI.textDim });
    ctx.restore();
    addRegion({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, onClick: disabled ? null : opts.onClick, tip: opts.tip, disabledClick: disabled ? opts.onDisabled : null });
  }

  function drawCloseButton(id, x, y, s, onClose) {
    const hv = hoverAmount(id);
    ctx.save();
    roundRectPath(x, y, s, s, 6);
    ctx.fillStyle = `rgba(255,${110 - hv * 40},${110 - hv * 40},${0.12 + hv * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,140,140,${0.35 + hv * 0.5})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#ffd0d0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.32, y + s * 0.32);
    ctx.lineTo(x + s * 0.68, y + s * 0.68);
    ctx.moveTo(x + s * 0.68, y + s * 0.32);
    ctx.lineTo(x + s * 0.32, y + s * 0.68);
    ctx.stroke();
    ctx.restore();
    addRegion({ id, x, y, w: s, h: s, onClick: onClose || closeDialog, tip: () => ['Close', 'Esc'] });
  }

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    // Reset canvas size so it doesn't inflate parent measurement
    canvas.style.width = '0';
    canvas.style.height = '0';

    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    canvasW = Math.floor(rect.width) || 700;
    canvasH = Math.floor(rect.height) || 500;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the HUD is laid out on a virtual screen about 690 units tall
    uiS = Math.max(0.7, Math.min(1.6, canvasW / 1060, canvasH / 690));
    UW = canvasW / uiS;
    UH = canvasH / uiS;
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(earned, days) {
    highScores.push({ credits: earned, days });
    highScores.sort((a, b) => b.credits - a.credits);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].credits}</td><td>${highScores[i].days}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ── Saved farm ── */

  function readSavedGameRaw() {
    try {
      return localStorage.getItem(STORAGE_SAVE) || localStorage.getItem(STORAGE_SAVE_V1);
    } catch (_) {
      return null;
    }
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_SAVE);
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
    savedGameAvailable = false;
  }

  /* A farm from before the tech tree: its upgrade levels become owned tree
     tiers, and everything it could already plant, raise or build stays unlocked */
  function migrateV1Save(d) {
    const levels = {};
    const up = d.upgradeLevels || {};
    for (const key in LEGACY_CHAINS) {
      const lv = Math.max(0, Math.floor(Number(up[key]) || 0));
      for (let i = 1; i <= lv && TECH_BY_ID[LEGACY_CHAINS[key] + i]; ++i)
        levels[LEGACY_CHAINS[key] + i] = 1;
    }
    const land = Math.max(0, Math.floor(Number(up.plotExpansion) || 0));
    if (land)
      levels.eng_land = land;
    const NEW_CONTENT = ['agri_kale', 'agri_pumpkin', 'husb_rabbit', 'husb_bees', 'eng_lamp', 'sci_zapper'];
    for (const n of TECH)
      if (n.unlock && !NEW_CONTENT.includes(n.id))
        levels[n.id] = 1;
    d.techLevels = levels;
    d.version = SAVE_VERSION;
    delete d.upgradeLevels;
    return d;
  }

  function saveGame() {
    if (state !== STATE_PLAYING && state !== STATE_PAUSED) return;
    autosaveTimer = 0;
    const data = {
      version: SAVE_VERSION,
      credits, selectedCropIndex, gameTime, dayCount,
      gridRows, gridCols, gridColOffset, expansionDirection,
      soilQuality, tileTypes, tileFertility, hoedTiles,
      farmGrid: farmGrid.map(row => row.map(cell => cell ? { cropIndex: cell.cropIndex, growthProgress: cell.growthProgress, growthStage: cell.growthStage } : null)),
      buildings: buildings.map(row => row.map(bld => bld ? { typeIndex: bld.typeIndex, level: bld.level || 1 } : null)),
      livestockPens: livestockPens.map(pen => ({ typeIndex: pen.typeIndex, feedTimer: pen.feedTimer, produceReady: !!pen.produceReady, gridRow: pen.gridRow, gridCol: pen.gridCol })),
      wildAnimals: wildAnimals.map(a => ({ x: a.x, y: a.y, targetCol: a.targetCol, targetRow: a.targetRow, moveTimer: a.moveTimer, hp: a.hp })),
      priceMultipliers, priceChangeTimer, inventory, techLevels, rainMakerDay, techBoughtTotal,
      stats, goalIndex, orders, orderTimer, orderSerial,
      weatherType, weatherTimer, weatherInterval,
      currentSeason, dayPhase, energy, nextAnimalSpawn,
      buildingHarvestTimer, autoHarvestTimer, autoCollectorTimer, autoPlanterTimer,
      buildingIncomeTimer, buildingIncomeAccum, buildingIncomeSurplusAccum,
      viewZoom, viewPanX, viewPanY
    };
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      savedGameAvailable = true;
    } catch (_) {}
  }

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isIndex(v, length) {
    return Number.isInteger(v) && v >= 0 && v < length;
  }

  function isGridOf(grid, rows, cols, check) {
    return Array.isArray(grid) && grid.length === rows
      && grid.every(row => Array.isArray(row) && row.length === cols && row.every(check));
  }

  function isValidSave(d) {
    if (!d || typeof d !== 'object' || (d.version !== 1 && d.version !== SAVE_VERSION)) return false;
    const rows = d.gridRows, cols = d.gridCols;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 400 || cols > 400) return false;
    if (!isFiniteNumber(d.credits) || !Number.isInteger(d.dayCount) || !isFiniteNumber(d.gameTime)) return false;
    if (!isGridOf(d.tileTypes, rows, cols, t => t === TILE_FARMLAND || t === TILE_ROCK || t === TILE_WATER || t === TILE_SAND)) return false;
    if (!isGridOf(d.tileFertility, rows, cols, isFiniteNumber)) return false;
    if (!isGridOf(d.hoedTiles, rows, cols, h => typeof h === 'boolean')) return false;
    if (!isGridOf(d.farmGrid, rows, cols, cell => cell === null || (cell && isIndex(cell.cropIndex, CROPS.length)
      && isFiniteNumber(cell.growthProgress) && Number.isInteger(cell.growthStage) && cell.growthStage >= 0))) return false;
    if (!isGridOf(d.buildings, rows, cols, bld => bld === null || (bld && isIndex(bld.typeIndex, BUILDINGS.length)
      && Number.isInteger(bld.level) && bld.level >= 1 && bld.level <= BUILDING_MAX_LEVEL))) return false;
    if (!Array.isArray(d.soilQuality) || !d.soilQuality.every(isFiniteNumber)) return false;
    if (!Array.isArray(d.livestockPens) || !d.livestockPens.every(pen => pen && isIndex(pen.typeIndex, LIVESTOCK.length)
      && isFiniteNumber(pen.feedTimer) && Number.isInteger(pen.gridRow) && Number.isInteger(pen.gridCol))) return false;
    if (!Array.isArray(d.wildAnimals) || !d.wildAnimals.every(a => a && isFiniteNumber(a.x) && isFiniteNumber(a.y))) return false;
    if (!Array.isArray(d.priceMultipliers) || d.priceMultipliers.length > CROPS.length || !d.priceMultipliers.every(isFiniteNumber)) return false;
    if (!d.inventory || typeof d.inventory !== 'object' || Array.isArray(d.inventory)) return false;
    const levels = d.version === 1 ? d.upgradeLevels : d.techLevels;
    if (!levels || typeof levels !== 'object' || Array.isArray(levels)) return false;
    if (!isIndex(d.currentSeason, SEASONS.length)) return false;
    return true;
  }

  /* Returns the parsed save, or null after discarding an unreadable or outdated one */
  function readValidSave() {
    const raw = readSavedGameRaw();
    if (!raw) {
      savedGameAvailable = false;
      return null;
    }
    let d = null;
    try {
      d = JSON.parse(raw);
    } catch (_) {
      d = null;
    }
    if (!isValidSave(d)) {
      clearSavedGame();
      saveNotice = 'The saved farm could not be loaded and was discarded.';
      return null;
    }
    if (d.version === 1)
      migrateV1Save(d);
    savedGameAvailable = true;
    return d;
  }

  function checkSavedGame() {
    readValidSave();
  }

  function restoreSavedGame() {
    const d = readValidSave();
    if (!d)
      return false;

    const num = (v, def) => isFiniteNumber(v) ? v : def;
    const plainCounts = (obj) => {
      const out = {};
      for (const k of Object.keys(obj))
        if (isFiniteNumber(obj[k]))
          out[k] = obj[k];
      return out;
    };

    credits = d.credits;
    selectedCropIndex = isIndex(d.selectedCropIndex, CROPS.length) ? d.selectedCropIndex : 0;
    selectedTool = TOOL_PLANT;
    selectedBuildingIndex = -1;
    gameTime = d.gameTime;
    dayCount = d.dayCount;
    gridRows = d.gridRows;
    gridCols = d.gridCols;
    gridColOffset = Number.isInteger(d.gridColOffset) ? d.gridColOffset : 0;
    expansionDirection = isIndex(d.expansionDirection, 4) ? d.expansionDirection : 0;
    soilQuality = d.soilQuality.slice();
    tileTypes = d.tileTypes.map(row => row.slice());
    tileFertility = d.tileFertility.map(row => row.slice());
    hoedTiles = d.hoedTiles.map(row => row.slice());
    farmGrid = d.farmGrid.map(row => row.map(cell => cell ? {
      cropIndex: cell.cropIndex,
      growthProgress: cell.growthProgress,
      growthStage: Math.min(cell.growthStage, CROPS[cell.cropIndex].stages - 1),
      plantAnim: 0
    } : null));
    buildings = d.buildings.map(row => row.map(bld => bld ? { typeIndex: bld.typeIndex, level: bld.level } : null));
    livestockPens = d.livestockPens.map(pen => ({
      typeIndex: pen.typeIndex,
      feedTimer: pen.feedTimer,
      produceReady: !!pen.produceReady,
      gridRow: pen.gridRow,
      gridCol: pen.gridCol
    }));
    wildAnimals = d.wildAnimals.map(a => ({
      x: a.x,
      y: a.y,
      targetCol: Number.isInteger(a.targetCol) ? a.targetCol : -1,
      targetRow: Number.isInteger(a.targetRow) ? a.targetRow : -1,
      moveTimer: num(a.moveTimer, 0),
      hp: num(a.hp, 1)
    }));
    priceMultipliers = d.priceMultipliers.slice();
    if (dialog === 'tree')
      dialog = null;
    priceChangeTimer = num(d.priceChangeTimer, PRICE_CHANGE_INTERVAL);
    inventory = plainCounts(d.inventory);
    techLevels = {};
    for (const id in d.techLevels)
      if (TECH_BY_ID[id] && isFiniteNumber(d.techLevels[id]) && d.techLevels[id] > 0)
        techLevels[id] = Math.floor(d.techLevels[id]);
    rainMakerDay = num(d.rainMakerDay, 0);
    stats = newStats();
    if (d.stats && typeof d.stats === 'object')
      for (const k in stats)
        stats[k] = num(d.stats[k], 0);
    goalIndex = Math.max(0, Math.min(GOALS.length, Math.floor(num(d.goalIndex, 0))));
    orders = Array.isArray(d.orders) ? d.orders.filter(o => o && typeof o.item === 'string' && isFiniteNumber(o.qty) && isFiniteNumber(o.reward) && isFiniteNumber(o.until) && itemSprite(o.item) !== 'crate')
      .map(o => ({ id: Math.floor(num(o.id, 0)), item: o.item, qty: o.qty, reward: o.reward, until: o.until })) : [];
    orderTimer = num(d.orderTimer, 25);
    orderSerial = Math.floor(num(d.orderSerial, orders.length));
    ++penVersion;
    techBoughtTotal = num(d.techBoughtTotal, 0);
    priceNext = null;
    nextWeather = null;
    while (priceMultipliers.length < CROPS.length)
      priceMultipliers.push(1);
    if (!isCropUnlocked(selectedCropIndex))
      selectedCropIndex = 0;

    const weathers = [WEATHER_NONE, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW, WEATHER_DUST];
    weatherType = weathers.includes(d.weatherType) ? d.weatherType : WEATHER_NONE;
    weatherTimer = num(d.weatherTimer, 0);
    weatherInterval = num(d.weatherInterval, WEATHER_MIN_INTERVAL);
    resetWeatherVisuals();

    currentSeason = d.currentSeason;
    dayPhase = num(d.dayPhase, 0);
    energy = num(d.energy, ENERGY_BASE_MAX);
    nextAnimalSpawn = num(d.nextAnimalSpawn, ANIMAL_SPAWN_MIN);
    buildingHarvestTimer = num(d.buildingHarvestTimer, 0);
    autoHarvestTimer = num(d.autoHarvestTimer, 0);
    autoCollectorTimer = num(d.autoCollectorTimer, 0);
    autoPlanterTimer = num(d.autoPlanterTimer, 0);
    buildingIncomeTimer = num(d.buildingIncomeTimer, 0);
    buildingIncomeAccum = num(d.buildingIncomeAccum, 0);
    buildingIncomeSurplusAccum = num(d.buildingIncomeSurplusAccum, 0);

    viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, num(d.viewZoom, 1)));
    viewPanX = num(d.viewPanX, 0);
    viewPanY = num(d.viewPanY, 0);
    isPanning = false;
    panButton = -1;

    closeAllDialogs();
    lastSeason = -1;
    screenFade = 1;
    shuffleCacheTimer = 0;
    cachedHarvestOrder = [];
    cachedPlantOrder = [];
    autosaveTimer = 0;
    saveNotice = '';
    invalidateField();
    return true;
  }

  function continueSavedGame() {
    if (!restoreSavedGame()) {
      SZ.GameAudio.play('error');
      return;
    }
    treeLayout = null;
    treeCam.init = false;
    state = STATE_PLAYING;
    // an older save now lives on under the current version
    saveGame();
    try { localStorage.removeItem(STORAGE_SAVE_V1); } catch (_) {}
    resetView();
    lastCredits = null;
    creditsShown = credits;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  /* Starts a new farm, asking first when that would replace a running or saved one */
  function requestNewGame() {
    if (newGameConfirmOpen) return;
    const running = state === STATE_PLAYING || state === STATE_PAUSED;
    if (!running && !savedGameAvailable) {
      resetGame();
      return;
    }
    const resumeAfter = state === STATE_PLAYING;
    if (resumeAfter) {
      state = STATE_PAUSED;
      saveGame();
    }
    newGameConfirmOpen = true;
    // the inner panel gets hidden along with the overlay when a button closes it, so show it again
    const panel = document.querySelector('#dlg-new-game .dialog');
    if (panel)
      panel.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      newGameConfirmOpen = false;
      if (result === 'yes') {
        clearSavedGame();
        resetGame();
      } else if (resumeAfter && state === STATE_PAUSED)
        state = STATE_PLAYING;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  /* ── Upgrade Helpers ── */

  /* Levels of the old flat upgrades, now counted from their tree chains */
  function getUpgradeLevel(id) {
    const prefix = LEGACY_CHAINS[id];
    return prefix ? techChainCount(prefix) : 0;
  }

  function getSeedCost(crop) {
    return Math.max(1, Math.round(crop.seedCost * (techOwned('agri_seedbank') ? 0.8 : 1)));
  }

  function getBuildingCost(bdef) {
    return Math.round(bdef.cost * (techOwned('eng_builder') ? 0.85 : 1));
  }

  function getGrowthSpeedMultiplier() {
    const base = 1 + getUpgradeLevel('growSpeed') * 0.25;
    const soil = 1 + getUpgradeLevel('soilQuality') * 0.15;
    return base * soil;
  }

  function getYieldMultiplier() {
    const lvl = getUpgradeLevel('yieldMultiplier');
    // level 1 = 1 extra 25% chance, level 5 = guaranteed double
    return 1 + lvl * 0.2;
  }

  function getWeatherResistance() {
    // Weather Shield: 0..3 => 0%, 25%, 50%, 75%
    // Irrigation: 0..3 => 0%, 15%, 30%, 45%
    // They stack multiplicatively: combined = 1 - (1 - shield) * (1 - irrigation)
    const shield = getUpgradeLevel('weatherResist') * 0.25;
    const irrigation = getUpgradeLevel('irrigation') * 0.15;
    return 1 - (1 - shield) * (1 - irrigation);
  }

  function getMarketPriceMultiplier() {
    return 1 + getUpgradeLevel('marketAccess') * 0.10;
  }

  function getTileSoilQuality(row, col) {
    let base;
    // Use per-tile fertility if available, fallback to row-based tiers
    if (col !== undefined && tileFertility[row] && tileFertility[row][col] !== undefined)
      base = tileFertility[row][col];
    else {
      const tierIdx = (row < BASE_GRID_ROWS) ? 0 : Math.min(SOIL_QUALITY_TIERS.length - 1, row - BASE_GRID_ROWS + 1);
      base = SOIL_QUALITY_TIERS[tierIdx];
    }

    let bonus = getUpgradeLevel('soilQuality') * 0.15;

    // Compost Bin bonus (scales with building level and range)
    if (col !== undefined && row >= 0 && row < gridRows && col >= 0 && col < gridCols)
      bonus += getField().compost[row * gridCols + col];

    return Math.min(1.5, base + bonus);
  }

  function getSiloBonusMultiplier() {
    let bonus = 0;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          bonus += getSiloSellBonus(bld);
      }
    return 1 + bonus;
  }

  function getStorageCapacity() {
    let totalStorage = 50 + techChainCount('com_storage') * 40;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          totalStorage += getSiloStorageBonus(bld);
      }
    return totalStorage;
  }

  function getTotalInventoryCount() {
    let total = 0;
    for (const key in inventory)
      total += inventory[key] || 0;
    return total;
  }

  function getSeasonGrowthMultiplier() {
    switch (currentSeason) {
      case 0: return 1.10; // Spring: +10%
      case 1: return 1.25; // Summer: +25%
      case 2: return 0.90; // Autumn: -10%
      case 3: return techOwned('sci_frost') ? 0.8 : 0.60; // Winter: -40% (-20% with frost hardiness)
      default: return 1.0;
    }
  }

  function getSeasonHarvestMultiplier() {
    return currentSeason === 2 ? 1.15 : 1.0; // Autumn: +15% harvest
  }

  function getEffectiveSellPrice(crop) {
    const cropIdx = CROPS.indexOf(crop);
    let priceMult = (cropIdx >= 0 && cropIdx < priceMultipliers.length) ? priceMultipliers[cropIdx] : 1;
    if (techOwned('com_floor'))
      priceMult = Math.max(0.8, priceMult);
    return Math.round(crop.sellPrice * getMarketPriceMultiplier() * priceMult * getSiloBonusMultiplier());
  }

  function getEffectiveProduceValue(live) {
    return Math.round(live.produceValue * getMarketPriceMultiplier() * (1 + techChainCount('husb_premium') * 0.15));
  }

  function getEnergyMax() {
    let total = ENERGY_BASE_MAX + techChainCount('eng_grid') * 25;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel')
          total += getSolarPanelEnergyBonus(bld);
        else if (bname === 'Wind Turbine')
          total += getWindTurbineEnergyBonus(bld);
      }
    return total;
  }

  function getEnergyRegenRate() {
    let rate = ENERGY_REGEN_BASE + techChainCount('eng_grid') * 0.5;
    const isNight = dayPhase >= 0.5;

    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          let bonus = getSolarPanelRegenBonus(bld);
          // Solar: 0 at night, double in summer, triple during solar flares
          if (isNight)
            bonus = 0;
          else {
            if (currentSeason === 1) bonus *= 2; // summer
            if (weatherType === WEATHER_SOLAR_FLARE) bonus *= 3;
            if (weatherType === WEATHER_DUST) bonus *= 0.3;
          }
          rate += bonus;
        } else if (bname === 'Wind Turbine') {
          let bonus = getWindTurbineRegenBonus(bld);
          // Wind: +50% at night, double in autumn, triple during thunderstorms
          if (isNight) bonus *= 1.5;
          if (currentSeason === 2) bonus *= 2; // autumn
          if (weatherType === WEATHER_THUNDERSTORM) bonus *= 3;
          rate += bonus;
        }
      }
    return rate;
  }

  function getEstimatedStorageValue() {
    let totalValue = 0;
    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0)
        totalValue += count * getEffectiveSellPrice(crop);
    }
    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0)
        totalValue += count * getEffectiveProduceValue(live);
    }
    return totalValue;
  }

  function isAdjacentToWater(row, col) {
    if (row > 0 && tileTypes[row - 1]?.[col] === TILE_WATER) return true;
    if (row < gridRows - 1 && tileTypes[row + 1]?.[col] === TILE_WATER) return true;
    if (col > 0 && tileTypes[row]?.[col - 1] === TILE_WATER) return true;
    if (col < gridCols - 1 && tileTypes[row]?.[col + 1] === TILE_WATER) return true;
    return false;
  }

  function getAutoHarvestInterval() {
    const lvl = getUpgradeLevel('autoHarvest');
    if (lvl <= 0) return 0; // disabled
    // level 1 = every 5s, level 2 = every 3s, level 3 = every 1.5s
    return [0, 5, 3, 1.5][lvl] || 0;
  }

  /* ── Building Level Upgrade Helpers ── */

  function getBuildingUpgradeCost(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    return Math.round(bdef.cost * 0.5 * (techOwned('eng_builder') ? 0.85 : 1));
  }

  function canUpgradeBuilding(bld) {
    if (!bld) return false;
    return (bld.level || 1) < BUILDING_MAX_LEVEL;
  }

  function upgradeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    const bld = buildings[row]?.[col];
    if (!bld || !canUpgradeBuilding(bld)) return;

    const cost = getBuildingUpgradeCost(bld);
    if (credits < cost) return;

    credits -= cost;
    bld.level = (bld.level || 1) + 1;
    invalidateField();

    const bdef = BUILDINGS[bld.typeIndex];
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 24, `${bdef.name} Lv ${bld.level}!`, { color: '#7ad8ff', font: 'bold 13px' });
    particles.confetti(tx, ty, 14, { speed: 3 });
    for (let i = 0; i < 12; ++i) {
      const a = i / 12 * TWO_PI;
      particles.trail(tx, ty, { vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, color: '#ffd75a', life: 0.5, size: 2.5, decay: 0.04, shape: 'star' });
    }
    SZ.GameAudio.play('powerup', { pitch: 1 + Math.min(bld.level, 10) * 0.04 });
  }

  /** Get the effective range of a building based on its level. Base range + (level - 1). */
  function getBuildingRange(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    // Silo and Fence have range 0 (global/self), no range scaling
    if (bdef.range === 0) return 0;
    return bdef.range + (lvl - 1);
  }

  /** Get the scarecrow scare radius in Chebyshev distance based on level. */
  function getScarecrowRadius(bld) {
    const lvl = bld.level || 1;
    // L1: 3x3 (radius 1), L2: 5x5 (radius 2), ..., L6: 13x13 (radius 6)
    return lvl;
  }

  /** Check if a tile (tr, tc) is within building range of building at (br, bc). */
  function isInBuildingRange(bld, br, bc, tr, tc) {
    const range = getBuildingRange(bld);
    return Math.abs(tr - br) <= range && Math.abs(tc - bc) <= range;
  }

  /** Get sprinkler growth bonus for a given level. */
  function getSprinklerBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20%, L2: +24%, L3: +28%, L4: +32%, L5: +36%, L6: +40%
    return 0.20 + (lvl - 1) * 0.04;
  }

  /** Get wind turbine growth bonus for a given level. */
  function getWindTurbineGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +15%, L3: +20%, L4: +25%, L5: +30%, L6: +35%
    return 0.10 + (lvl - 1) * 0.05;
  }

  /** Get compost bin fertility bonus for a given level. */
  function getCompostBinBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +25%, L2: +35%, L3: +45%, L4: +55%, L5: +65%, L6: +75%
    return 0.25 + (lvl - 1) * 0.10;
  }

  /** Get greenhouse growth bonus for a given level (small bonus on top of protection). */
  function getGreenhouseGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +5%, L2: +10%, L3: +15%, L4: +20%, L5: +25%, L6: +30%
    return (lvl - 1) * 0.05;
  }

  /** Get silo storage bonus for a given level. */
  function getSiloStorageBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +50, L2: +75, L3: +100, L4: +125, L5: +150, L6: +175
    return 50 + (lvl - 1) * 25;
  }

  /** Get silo sell bonus multiplier for a given level. */
  function getSiloSellBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +12%, L3: +14%, L4: +16%, L5: +18%, L6: +20%
    return 0.10 + (lvl - 1) * 0.02;
  }

  /** Get solar panel max energy bonus per panel based on level. */
  function getSolarPanelEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +30, L2: +45, L3: +60, L4: +75, L5: +90, L6: +105
    return 30 + (lvl - 1) * 15;
  }

  /** Get solar panel income per cycle based on level. */
  function getSolarPanelIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 2cr, L2: 3cr, L3: 4cr, L4: 5cr, L5: 6cr, L6: 7cr
    return 2 + (lvl - 1);
  }

  /** Get wind turbine income per cycle based on level. */
  function getWindTurbineIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 5cr, L2: 7cr, L3: 9cr, L4: 11cr, L5: 13cr, L6: 15cr
    return 5 + (lvl - 1) * 2;
  }

  /** Get wind turbine max energy bonus per turbine based on level. */
  function getWindTurbineEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20, L2: +40, L3: +60, L4: +80, L5: +100, L6: +120
    return 20 * lvl;
  }

  /** Get wind turbine energy regen bonus per turbine based on level. */
  function getWindTurbineRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +0.5, L2: +1.0, L3: +1.5, L4: +2.0, L5: +2.5, L6: +3.0
    return 0.5 * lvl;
  }

  /** Get solar panel energy regen bonus based on level. */
  function getSolarPanelRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: 1.0, L2: 1.4, L3: 1.8, L4: 2.2, L5: 2.6, L6: 3.0
    return 1.0 + (lvl - 1) * 0.4;
  }

  /** Get harvester interval based on level. */
  function getHarvesterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 2s, L2: 1.6s, L3: 1.2s, L4: 0.9s, L5: 0.7s, L6: 0.5s
    return [2.0, 2.0, 1.6, 1.2, 0.9, 0.7, 0.5][lvl] || 2.0;
  }

  /** Get auto-collector interval based on level. */
  function getAutoCollectorInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 8s, L2: 5s, L3: 3s, L4: 2s, L5: 1.5s, L6: 1s
    return [8, 8, 5, 3, 2, 1.5, 1][lvl] || 8;
  }

  /** Get auto-planter interval based on level. */
  function getAutoPlanterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 15s, L2: 12s, L3: 9s, L4: 7s, L5: 5s, L6: 3s
    return [15, 15, 12, 9, 7, 5, 3][lvl] || 15;
  }

  /** Find the fastest harvester interval on the grid (for the shared timer). */
  function getMinHarvesterInterval() {
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Harvester')
          minInterval = Math.min(minInterval, getHarvesterInterval(bld));
      }
    return minInterval === Infinity ? 0 : minInterval;
  }

  /** Number of tiles the next plot expansion strip will add. */
  function getNextExpansionTileCount() {
    // L(0), R(1) add a column (gridRows tiles); T(2), B(3) add a row (gridCols tiles)
    return (expansionDirection < 2) ? gridRows : gridCols;
  }


  /** WFC-inspired tile generation: weighted random based on neighbor types. */
  function wfcTileType(neighbors) {
    // Count neighbor types
    let waterCount = 0, rockCount = 0, sandCount = 0, farmCount = 0;
    for (const n of neighbors) {
      if (n === TILE_WATER) ++waterCount;
      else if (n === TILE_ROCK) ++rockCount;
      else if (n === TILE_SAND) ++sandCount;
      else ++farmCount;
    }
    const total = neighbors.length || 1;

    // Weighted probabilities based on adjacency
    let wWater = 0.06 + (waterCount / total) * 0.45;
    let wRock = 0.05 + (rockCount / total) * 0.40;
    let wSand = 0.08 + (sandCount / total) * 0.35;
    // Sand also appears near water edges
    if (waterCount > 0 && sandCount === 0) wSand += 0.15;
    let wFarm = 1 - wWater - wRock - wSand;
    if (wFarm < 0.2) wFarm = 0.2;

    // Normalize
    const sum = wWater + wRock + wSand + wFarm;
    wWater /= sum;
    wRock /= sum;
    wSand /= sum;

    const roll = Math.random();
    if (roll < wWater) return TILE_WATER;
    if (roll < wWater + wRock) return TILE_ROCK;
    if (roll < wWater + wRock + wSand) return TILE_SAND;
    return TILE_FARMLAND;
  }

  /** Collect existing neighbor tile types for a position (row, col). */
  function getNeighborTypes(row, col) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && tileTypes[nr]?.[nc] !== undefined)
          neighbors.push(tileTypes[nr][nc]);
      }
    return neighbors;
  }

  function makeExpansionFertility(tileType) {
    let fert = 0.5 + Math.random() * 0.5;
    if (tileType === TILE_SAND) fert *= 0.7;
    // Expansion tiles start with slightly lower base fertility
    fert *= 0.75;
    return fert;
  }

  function expandGrid() {
    // Expand one strip at a time, cycling L(0), R(1), T(2), B(3)
    const dir = expansionDirection;

    if (dir === 0) {
      // LEFT: add column at left
      for (let r = 0; r < gridRows; ++r) {
        const neighbors = [];
        if (tileTypes[r]?.[0] !== undefined) neighbors.push(tileTypes[r][0]);
        if (r > 0 && tileTypes[r - 1]?.[0] !== undefined) neighbors.push(tileTypes[r - 1][0]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        farmGrid[r].unshift(null);
        tileTypes[r].unshift(tt);
        tileFertility[r].unshift(makeExpansionFertility(tt));
        if (hoedTiles[r]) hoedTiles[r].unshift(false);
        buildings[r].unshift(null);
      }
      ++gridCols;
      ++gridColOffset;
      for (const animal of wildAnimals) ++animal.x;
      for (const pen of livestockPens) ++pen.gridCol;
    } else if (dir === 1) {
      // RIGHT: add column at right
      for (let r = 0; r < gridRows; ++r) {
        const neighbors = [];
        const lastC = gridCols - 1;
        if (tileTypes[r]?.[lastC] !== undefined) neighbors.push(tileTypes[r][lastC]);
        if (r > 0 && tileTypes[r - 1]?.[lastC] !== undefined) neighbors.push(tileTypes[r - 1][lastC]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        farmGrid[r].push(null);
        tileTypes[r].push(tt);
        tileFertility[r].push(makeExpansionFertility(tt));
        if (hoedTiles[r]) hoedTiles[r].push(false);
        buildings[r].push(null);
      }
      ++gridCols;
    } else if (dir === 2) {
      // TOP: add row at top
      const northRow = [];
      const northType = [];
      const northFert = [];
      const northBuild = [];
      for (let c = 0; c < gridCols; ++c) {
        northRow.push(null);
        northBuild.push(null);
        const neighbors = [];
        if (tileTypes[0]?.[c] !== undefined) neighbors.push(tileTypes[0][c]);
        if (c > 0 && northType[c - 1] !== undefined) neighbors.push(northType[c - 1]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        northType.push(tt);
        northFert.push(makeExpansionFertility(tt));
      }
      farmGrid.unshift(northRow);
      tileTypes.unshift(northType);
      tileFertility.unshift(northFert);
      hoedTiles.unshift(new Array(gridCols).fill(false));
      buildings.unshift(northBuild);
      ++gridRows;
      soilQuality.unshift(getTileSoilQuality(0));
      for (const animal of wildAnimals) ++animal.y;
      for (const pen of livestockPens) ++pen.gridRow;
    } else {
      // BOTTOM: add row at bottom
      const southRow = [];
      const southType = [];
      const southFert = [];
      const southBuild = [];
      for (let c = 0; c < gridCols; ++c) {
        southRow.push(null);
        southBuild.push(null);
        const neighbors = getNeighborTypes(gridRows, c);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        southType.push(tt);
        southFert.push(makeExpansionFertility(tt));
      }
      farmGrid.push(southRow);
      tileTypes.push(southType);
      tileFertility.push(southFert);
      hoedTiles.push(new Array(gridCols).fill(false));
      buildings.push(southBuild);
      ++gridRows;
      soilQuality.push(getTileSoilQuality(gridRows - 1));
    }

    // Advance direction: L -> R -> T -> B -> L -> ...
    expansionDirection = (expansionDirection + 1) % 4;
    invalidateField();

    // Refresh shuffle cache since grid dimensions changed
    refreshShuffleCache();
  }

  function resetGame() {
    credits = 100;
    selectedCropIndex = 0;
    selectedTool = TOOL_PLANT;
    gameTime = 0;
    dayCount = 1;
    inventory = {};

    // Reset upgrades and goals
    techLevels = {};
    stats = newStats();
    goalIndex = 0;
    orders = [];
    orderTimer = 25;
    orderSerial = 0;
    ++penVersion;
    rainMakerDay = 0;
    techBoughtTotal = 0;
    priceNext = null;
    nextWeather = null;
    treeCam.init = false;
    closeAllDialogs();
    lastSeason = -1;
    screenFade = 1;
    autoHarvestTimer = 0;
    autoCollectorTimer = 0;

    // Reset grid to base size
    gridRows = BASE_GRID_ROWS;
    gridCols = GRID_COLS;
    gridColOffset = 0;
    expansionDirection = 0;

    // Energy reset
    energy = 100;

    // Auto-planter reset
    autoPlanterTimer = 0;

    // Shuffle cache reset
    shuffleCacheTimer = 0;
    cachedHarvestOrder = [];
    cachedPlantOrder = [];

    // Initialize empty farm grid with soil quality and tile types
    farmGrid = [];
    soilQuality = [];
    tileTypes = [];
    tileFertility = [];
    hoedTiles = [];
    buildings = [];
    selectedBuildingIndex = -1;
    buildingHarvestTimer = 0;

    // Generate tile types with natural clustering
    for (let r = 0; r < gridRows; ++r) {
      const row = [];
      tileTypes[r] = [];
      tileFertility[r] = [];
      hoedTiles[r] = [];
      buildings[r] = [];
      for (let c = 0; c < gridCols; ++c) {
        row.push(null); // empty tile
        buildings[r][c] = null;
        hoedTiles[r][c] = false;

        const noise = Math.random();
        // Check neighbors for clustering
        const leftType = c > 0 ? tileTypes[r][c - 1] : TILE_FARMLAND;
        const topType = r > 0 ? tileTypes[r - 1][c] : TILE_FARMLAND;
        if (noise < 0.08 || (leftType === TILE_ROCK && noise < 0.3) || (topType === TILE_ROCK && noise < 0.3))
          tileTypes[r][c] = TILE_ROCK;
        else if (noise < 0.12 || (leftType === TILE_WATER && noise < 0.25))
          tileTypes[r][c] = TILE_WATER;
        else if (noise < 0.18 || (leftType === TILE_SAND && noise < 0.35) || (topType === TILE_SAND && noise < 0.35))
          tileTypes[r][c] = TILE_SAND;
        else
          tileTypes[r][c] = TILE_FARMLAND;

        // Per-tile fertility
        let fert = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
        if (tileTypes[r][c] === TILE_SAND) fert *= 0.7;
        // Apply row-based tier penalty for expansion rows
        const tierPenalty = (r < BASE_GRID_ROWS) ? 1.0 : (SOIL_QUALITY_TIERS[r - BASE_GRID_ROWS + 1] || SOIL_QUALITY_TIERS[SOIL_QUALITY_TIERS.length - 1]);
        fert *= tierPenalty;
        tileFertility[r][c] = fert;
      }
      farmGrid.push(row);
      soilQuality.push(getTileSoilQuality(r));
    }

    // Start with no livestock
    livestockPens = [];

    // Weather reset
    weatherType = WEATHER_NONE;
    weatherTimer = 0;
    weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    resetWeatherVisuals();

    // Price fluctuation reset
    priceMultipliers = [];
    for (let i = 0; i < CROPS.length; ++i)
      priceMultipliers.push(1.0);
    priceChangeTimer = PRICE_CHANGE_INTERVAL;

    // Zoom & pan reset
    resetView();
    isPanning = false;
    panButton = -1;

    // Season & day/night reset
    currentSeason = 0;
    dayPhase = 0;

    // Animals reset
    wildAnimals = [];
    nextAnimalSpawn = (ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN)) * Math.pow(1.4, techChainCount('sci_repel'));

    // Building income timer reset
    buildingIncomeTimer = 0;
    buildingIncomeAccum = 0;
    buildingIncomeSurplusAccum = 0;

    autosaveTimer = 0;
    saveNotice = '';
    invalidateField();
    lastCredits = null;
    creditsShown = credits;
    state = STATE_PLAYING;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     FARM GRID OPERATIONS
     ══════════════════════════════════════════════════════════════════ */

  function gridToScreen(col, row) {
    const ts = BASE_TILE_SIZE * viewZoom;
    return {
      x: (GRID_OFFSET_X + col * BASE_TILE_SIZE) * viewZoom + viewPanX,
      y: (GRID_OFFSET_Y + row * BASE_TILE_SIZE) * viewZoom + viewPanY,
      size: ts
    };
  }

  /* Centre of a tile in world units */
  function tileCenter(col, row) {
    return { x: GRID_OFFSET_X + (col + 0.5) * BASE_TILE_SIZE, y: GRID_OFFSET_Y + (row + 0.5) * BASE_TILE_SIZE };
  }

  function penCenter(pen) {
    return tileCenter(pen.gridCol, pen.gridRow);
  }

  function plantCrop(row, col) {
    if (state !== STATE_PLAYING) return;
    const tt = tileTypes[row]?.[col];
    if (tt === TILE_WATER || tt === TILE_ROCK) return;
    if (buildings[row]?.[col]) return; // tile has a building
    if (farmGrid[row][col] !== null) return; // not empty
    const crop = CROPS[selectedCropIndex];
    if (!isCropUnlocked(selectedCropIndex)) return;
    const seedCost = getSeedCost(crop);
    if (credits < seedCost) return;

    credits -= seedCost;
    ++stats.planted;
    farmGrid[row][col] = {
      cropIndex: selectedCropIndex,
      growthProgress: 0,
      growthStage: 0,
      plantAnim: 1.0 // plantAnim scale bounce
    };

    // Planting animation: seed sparkle + water droplet splash
    const { x: tx, y: ty } = tileCenter(col, row);
    particles.sparkle(tx, ty, 6, { color: crop.color, speed: 2 });
    // Water droplet splash effect
    for (let i = 0; i < 5; ++i) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const v = 1.5 + Math.random() * 2;
      particles.trail(tx + (Math.random() - 0.5) * 10, ty + 6, {
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1,
        color: '#8fd3ff',
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
        gravity: 0.15,
        decay: 0.03
      });
    }
    particles.burst(tx, ty + 12, 6, { color: '#8a6038', speed: 1.8, life: 0.45, gravity: 0.12 });
    SZ.GameAudio.play('drop', { pitch: 1.3 + Math.random() * 0.3, volume: 0.6 });
  }

  function harvestCrop(row, col, auto) {
    if (state !== STATE_PLAYING) return;
    const cell = farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const maxStage = crop.stages - 1;
    if (cell.growthStage < maxStage) return; // not mature yet

    const { x: tx, y: ty } = tileCenter(col, row);

    // Check storage capacity (Feature 7)
    if (getTotalInventoryCount() >= getStorageCapacity()) {
      popText(tx, ty - 10, 'Storage Full!', { color: '#f44', font: 'bold 13px sans-serif' });
      if (!auto)
        SZ.GameAudio.play('error');
      return;
    }

    // Enhanced harvest: golden burst + crop-colored sparkle ring (scaled with zoom)
    if (viewZoom >= 0.5) {
      particles.burst(tx, ty, Math.ceil(10 * viewZoom), { color: '#fd0', speed: 3.5, life: 0.7, gravity: 0.05 });
      particles.burst(tx, ty, Math.ceil(6 * viewZoom), { color: crop.color, speed: 2, life: 0.5 });
      // Rising golden sparkles
      const trailCount = Math.ceil(4 * viewZoom);
      for (let i = 0; i < trailCount; ++i)
        particles.trail(tx + (Math.random() - 0.5) * 16, ty, {
          vx: (Math.random() - 0.5) * 1,
          vy: -1.5 - Math.random() * 2,
          color: '#ff0',
          size: 2 + Math.random(),
          life: 0.5 + Math.random() * 0.3,
          decay: 0.03,
          shape: 'star'
        });
    }

    // Yield multiplier: chance for bonus crops + season harvest bonus
    const yieldMul = getYieldMultiplier() * getSeasonHarvestMultiplier();
    let harvestCount = 1;
    const bonusChance = yieldMul - 1; // 0..1+
    if (bonusChance > 0 && Math.random() < bonusChance)
      ++harvestCount;

    if (!inventory[crop.name])
      inventory[crop.name] = 0;
    inventory[crop.name] += harvestCount;
    stats.harvested += harvestCount;

    flyProduce(crop.sprite, tx, ty, harvestCount, auto);
    if (harvestCount > 1)
      popText(tx, ty - 16, `×${harvestCount}!`, { color: '#ffd75a', font: 'bold 14px' });
    if (!auto) {
      ++harvestCombo;
      harvestComboT = 0.8;
      SZ.GameAudio.play('pickup', { pitch: 1 + Math.min(harvestCombo, 12) * 0.035 + (harvestCount > 1 ? 0.15 : 0) });
    }

    farmGrid[row][col] = null; // clear tile
  }

  const ROCK_CLEAR_COST = 25;

  /* The hoe (as a pick) breaks up a rock into poor farmland */
  function clearRock(row, col) {
    if (state !== STATE_PLAYING || tileTypes[row]?.[col] !== TILE_ROCK) return false;
    const { x: tx, y: ty } = tileCenter(col, row);
    if (buildings[row][col]) {
      popText(tx, ty - 14, 'A building stands here', { color: '#ffb080', font: 'bold 11px' });
      SZ.GameAudio.play('error', { volume: 0.5 });
      return false;
    }
    if (credits < ROCK_CLEAR_COST) {
      popText(tx, ty - 14, `Need ${ROCK_CLEAR_COST} cr`, { color: '#ff8a8a', font: 'bold 12px' });
      SZ.GameAudio.play('error', { volume: 0.5 });
      return false;
    }
    credits -= ROCK_CLEAR_COST;
    tileTypes[row][col] = TILE_FARMLAND;
    tileFertility[row][col] = Math.min(tileFertility[row][col] ?? 0.5, 0.55);
    farmGrid[row][col] = null;
    invalidateField();
    particles.burst(tx, ty + 6, 14, { color: '#8e8984', speed: 3, life: 0.6, gravity: 0.15 });
    particles.burst(tx, ty + 6, 8, { color: '#d8dee8', speed: 2, life: 0.4 });
    dustRing(tx, ty + 18, '#b8b0a8');
    popText(tx, ty - 14, `Rock cleared -${ROCK_CLEAR_COST}`, { color: '#e0d8c8', font: 'bold 12px' });
    screenShake.trigger(2, 100);
    SZ.GameAudio.play('smallExplode', { volume: 0.6, pitch: 1.3 });
    SZ.GameAudio.play('thud', { pitch: 0.8 });
    return true;
  }

  /** Hoe a single tile: boost fertility +0.2 (cap 1.5). Returns true if tile was fertilized. */
  function hoeFertilizeTile(row, col) {
    const tt = tileTypes[row]?.[col];
    if (tt === undefined || tt === TILE_WATER || tt === TILE_ROCK) return false;
    // Hoeing sand converts it to farmland
    if (tt === TILE_SAND) {
      tileTypes[row][col] = TILE_FARMLAND;
      const { x: tx, y: ty } = tileCenter(col, row);
      popText(tx, ty - 20, 'Soil improved!', { color: '#a84', font: 'bold 10px sans-serif' });
    }
    if (buildings[row]?.[col]) return false;
    const curFert = tileFertility[row]?.[col] ?? 0.5;
    const newFert = Math.min(1.5, curFert + 0.2);
    if (newFert <= curFert) return false;
    tileFertility[row][col] = newFert;
    if (hoedTiles[row])
      hoedTiles[row][col] = true;
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `+Fertility (${Math.round(newFert * 100)}%)`, { color: '#4d4', font: 'bold 11px sans-serif' });
    particles.sparkle(tx, ty, 5, { color: '#4a2', speed: 1.5 });
    SZ.GameAudio.play('thud', { pitch: 1.6, volume: 0.5 });
    return true;
  }

  /** Hoe left-click: clicking water fertilizes all 8 surrounding tiles; clicking land adjacent to water fertilizes that tile. */
  function hoeFertilize(row, col) {
    if (state !== STATE_PLAYING) return;
    const tt = tileTypes[row]?.[col];

    if (tt === TILE_WATER) {
      // Fertilize all 8 neighbors around the water tile
      for (let dr = -1; dr <= 1; ++dr)
        for (let dc = -1; dc <= 1; ++dc) {
          if (dr === 0 && dc === 0) continue;
          hoeFertilizeTile(row + dr, col + dc);
        }
      return;
    }

    if (tt === TILE_ROCK) {
      clearRock(row, col);
      return;
    }
    if (!isAdjacentToWater(row, col)) return;
    hoeFertilizeTile(row, col);
  }

  /** Hoe right-click: uproot/remove a plant, returning partial seed cost. */
  function hoeUproot(row, col) {
    if (state !== STATE_PLAYING) return;
    const cell = farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const refund = Math.floor(getSeedCost(crop) * 0.5);
    credits += refund;
    farmGrid[row][col] = null;

    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `Uprooted! +${refund}cr`, { color: '#fa0', font: 'bold 11px sans-serif' });
    particles.burst(tx, ty, 6, { color: '#a62', speed: 2, life: 0.4 });
    SZ.GameAudio.play('whoosh', { pitch: 0.8, volume: 0.7 });
  }

  /* ══════════════════════════════════════════════════════════════════
     CROP GROWTH
     ══════════════════════════════════════════════════════════════════ */

  function updateCrops(dt) {
    if (state !== STATE_PLAYING) return;

    // Base growth multiplier from weather
    let weatherGrowthBoost = 1;
    if (weatherType === WEATHER_SOLAR_FLARE)
      weatherGrowthBoost = 2;
    else if (weatherType === WEATHER_RAIN)
      weatherGrowthBoost = 1.5;
    else if (weatherType === WEATHER_THUNDERSTORM)
      weatherGrowthBoost = 2;
    else if (weatherType === WEATHER_SNOW)
      weatherGrowthBoost = techOwned('sci_frost') ? 1 : 0.8;
    else if (weatherType === WEATHER_DUST)
      weatherGrowthBoost = 0.75;

    // Upgrade growth speed multiplier
    const upgradeGrowthMul = getGrowthSpeedMultiplier();
    const field = getField();

    for (let r = 0; r < gridRows; ++r) {
      for (let c = 0; c < gridCols; ++c) {
        const cell = farmGrid[r][c];
        if (!cell) continue;

        const crop = CROPS[cell.cropIndex];
        const maxStage = crop.stages - 1;

        // Per-crop weather affinity modifier
        let cropWeatherMul = weatherGrowthBoost;
        const fi = r * gridCols + c;
        if (crop.weatherAffinity === 'any')
          cropWeatherMul = Math.max(1, weatherGrowthBoost); // never penalized
        else if (crop.weatherAffinity === 'solar' && weatherType === WEATHER_SOLAR_FLARE)
          cropWeatherMul = 3; // extra solar bonus
        else if (crop.weatherAffinity === 'cold-vulnerable' && weatherType === WEATHER_METEOR_SHOWER)
          cropWeatherMul = 0.3; // growth slows in cold

        // Per-tile fertility (replaces row-based soil quality)
        const tileSoil = getTileSoilQuality(r, c);

        // Tile type modifier: sand = 0.7x growth
        let tileTypeMul = 1.0;
        if (tileTypes[r]?.[c] === TILE_SAND) tileTypeMul = 0.7;

        // Water adjacency bonus: +0.15 per adjacent water tile
        let waterBonus = 0;
        if (r > 0 && tileTypes[r - 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (r < gridRows - 1 && tileTypes[r + 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (c > 0 && tileTypes[r]?.[c - 1] === TILE_WATER) waterBonus += 0.15;
        if (c < gridCols - 1 && tileTypes[r]?.[c + 1] === TILE_WATER) waterBonus += 0.15;

        // Sprinkler bonus, Wind Turbine bonus, and Greenhouse growth bonus (all scale with level and range)
        const sprinklerBonus = field.sprinkler[fi];
        const windTurbineBonus = field.wind[fi];
        const greenhouseBonus = field.green[fi];

        // Season growth modifier (Feature 5); every crop loves one season
        let seasonMul = getSeasonGrowthMultiplier();
        if (crop.hardy && currentSeason === 3)
          seasonMul = 1;
        if (crop.favorite === currentSeason)
          seasonMul *= 1.3;
        if (crop.hardy && weatherType === WEATHER_SNOW)
          cropWeatherMul = 1;

        // Day/night crop restrictions (Feature 6); grow lamps keep day crops going
        const isNight = dayPhase >= 0.5;
        const lamp = isNight ? field.lamp[fi] : 0;
        if (crop.nightOnly && !isNight) continue; // nightOnly crops skip during day
        if (crop.dayOnly && isNight && !lamp) continue;     // dayOnly crops skip during night

        // Winter: Astral Flower and some crops won't grow
        if (currentSeason === 3 && (crop.name === 'Astral Flower' || crop.dayOnly)) continue;

        // Advance growth progress (soil quality, tile type, water/sprinkler/wind/greenhouse bonuses are multiplicative/additive)
        cell.growthProgress += (dt / crop.growTime) * cropWeatherMul * upgradeGrowthMul * tileSoil * tileTypeMul * seasonMul * (1 + waterBonus + sprinklerBonus + windTurbineBonus + greenhouseBonus + lamp + field.bees[fi]);

        // Check stage advancement
        const newStage = Math.min(maxStage, Math.floor(cell.growthProgress * crop.stages));
        if (newStage > cell.growthStage) {
          cell.growthStage = newStage;
          // Enhanced growth particles: green sparkles rising (scaled with zoom)
          if (viewZoom >= 0.5) {
            const { x: tx, y: ty } = tileCenter(c, r);
            particles.sparkle(tx, ty, Math.ceil(4 * viewZoom), { color: crop.color, speed: 1.5 });
            const trailCount = Math.ceil(3 * viewZoom);
            for (let p = 0; p < trailCount; ++p)
              particles.trail(tx + (Math.random() - 0.5) * 12, ty + 5, {
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 1.5,
                color: '#4f4',
                size: 1.5 + Math.random(),
                life: 0.4 + Math.random() * 0.3,
                decay: 0.03,
                shape: 'star'
              });
          }
        }

        // Plant animation decay
        if (cell.plantAnim > 0)
          cell.plantAnim = Math.max(0, cell.plantAnim - dt * 3);
      }
    }

    // Auto-harvest upgrade (uses energy: 1 per harvest, speed scales with energy)
    const autoInterval = getAutoHarvestInterval();
    if (autoInterval > 0) {
      // Scale speed with energy: below 20% energy, auto-harvest slows to 3x interval
      const energyFraction = energy / getEnergyMax();
      const effectiveInterval = energyFraction < 0.2 ? autoInterval * 3 : autoInterval;
      autoHarvestTimer += dt;
      if (autoHarvestTimer >= effectiveInterval) {
        autoHarvestTimer -= effectiveInterval;
        if (energy >= 1) {
          energy -= 1;
          autoHarvestOneCrop();
        }
      }
    }

    // Building Harvester: auto-harvest crops in range (interval and range scale with level)
    buildingHarvestTimer += dt;
    const minHarvesterInterval = getMinHarvesterInterval();
    if (minHarvesterInterval > 0 && buildingHarvestTimer >= minHarvesterInterval) {
      buildingHarvestTimer -= minHarvesterInterval;
      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          const hBld = buildings[r]?.[c];
          if (!hBld) continue;
          if (BUILDINGS[hBld.typeIndex].name !== 'Harvester') continue;
          // Check if this harvester's interval has elapsed (for mixed-level harvesters, use fastest)
          const range = getBuildingRange(hBld);
          for (let dr = -range; dr <= range; ++dr)
            for (let dc = -range; dc <= range; ++dc) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
                const adjCell = farmGrid[nr][nc];
                if (adjCell && adjCell.growthStage >= CROPS[adjCell.cropIndex].stages - 1) {
                  if (energy >= 1) {
                    energy -= 1;
                    harvestCrop(nr, nc, true);
                  }
                }
              }
            }
        }
    }
  }

  /** Auto-harvest a mature crop using randomized selection for even distribution. */
  function autoHarvestOneCrop() {
    // Build list of all mature crop positions, then pick one at random
    const matureTiles = [];
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const cell = farmGrid[r]?.[c];
        if (!cell) continue;
        if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
          matureTiles.push({ r, c });
      }
    if (!matureTiles.length) return;
    const pick = matureTiles[Math.floor(Math.random() * matureTiles.length)];
    harvestCrop(pick.r, pick.c, true);
  }

  /* ══════════════════════════════════════════════════════════════════
     LIVESTOCK
     ══════════════════════════════════════════════════════════════════ */

  function updateLivestock(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];
      pen.feedTimer -= dt;
      if (pen.feedTimer <= 0)
        pen.produceReady = true;
    }
  }

  function feedAndCollect(penIndex) {
    if (state !== STATE_PLAYING) return;
    const pen = livestockPens[penIndex];
    if (!pen || !pen.produceReady) return;

    const def = LIVESTOCK[pen.typeIndex];
    pen.produceReady = false;
    pen.feedTimer = getFeedInterval(def);

    // Collect produce (happy herds sometimes give two)
    const amount = techOwned('husb_happy') && Math.random() < 0.2 ? 2 : 1;
    inventory[def.produce] = (inventory[def.produce] || 0) + amount;

    const scr = penCenter(pen);
    flyProduce(def.produceSprite, scr.x, scr.y, amount, false);
    if (amount > 1)
      popText(scr.x, scr.y - 20, '×2!', { color: '#ffd75a', font: 'bold 14px' });
    particles.sparkle(scr.x, scr.y, 6, { color: def.color, speed: 1.5 });
    SZ.GameAudio.play('pickup', { pitch: 0.85 });
    animalVoice(def.sprite);
  }

  /** Generate all perimeter positions around the current grid (one tile outside). */
  function getPerimeterPositions() {
    const positions = [];
    // Bottom edge: row = gridRows, col = -1..gridCols
    for (let c = -1; c <= gridCols; ++c)
      positions.push({ gridRow: gridRows, gridCol: c });
    // Right edge: col = gridCols, row = gridRows-1 down to -1
    for (let r = gridRows - 1; r >= -1; --r)
      positions.push({ gridRow: r, gridCol: gridCols });
    // Top edge: row = -1, col = gridCols-1 down to -1
    for (let c = gridCols - 1; c >= -1; --c)
      positions.push({ gridRow: -1, gridCol: c });
    // Left edge: col = -1, row = 0 up to gridRows-1
    for (let r = 0; r < gridRows; ++r)
      positions.push({ gridRow: r, gridCol: -1 });
    return positions;
  }

  /** Find the next available perimeter slot for a livestock pen. */
  function findNextPerimeterSlot() {
    const positions = getPerimeterPositions();
    for (const pos of positions) {
      const occupied = livestockPens.some(p => p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
      if (!occupied)
        return pos;
    }
    return null; // all perimeter slots full
  }

  /** Convert a livestock pen's grid position to screen coordinates (center of pen tile). */
  function livestockPenToScreen(pen) {
    const ts = BASE_TILE_SIZE * viewZoom;
    return {
      x: (GRID_OFFSET_X + pen.gridCol * BASE_TILE_SIZE) * viewZoom + viewPanX + ts / 2,
      y: (GRID_OFFSET_Y + pen.gridRow * BASE_TILE_SIZE) * viewZoom + viewPanY + ts / 2,
      size: ts
    };
  }

  /** Relocate all livestock pens to stay on the current grid perimeter after expansion. */
  function relocateLivestockToPerimeter() {
    const positions = getPerimeterPositions();
    let slotIdx = 0;
    for (const pen of livestockPens) {
      // Check if pen is still on the perimeter
      const onPerimeter = pen.gridRow === -1 || pen.gridRow === gridRows ||
                          pen.gridCol === -1 || pen.gridCol === gridCols;
      if (!onPerimeter) {
        // Find next available perimeter slot
        while (slotIdx < positions.length) {
          const pos = positions[slotIdx];
          const occupied = livestockPens.some(p => p !== pen && p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
          if (!occupied) {
            pen.gridRow = pos.gridRow;
            pen.gridCol = pos.gridCol;
            ++slotIdx;
            break;
          }
          ++slotIdx;
        }
      }
    }
  }

  function buyLivestock(typeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = LIVESTOCK[typeIndex];
    if (!isAnimalUnlocked(typeIndex) || credits < def.cost) return;

    const slot = findNextPerimeterSlot();
    if (!slot) {
      toast('No room left for another pen', UI.bad, 'paw');
      SZ.GameAudio.play('error');
      return;
    }

    credits -= def.cost;
    ++stats.animals;
    ++penVersion;
    livestockPens.push({
      typeIndex,
      feedTimer: getFeedInterval(def),
      produceReady: false,
      gridRow: slot.gridRow,
      gridCol: slot.gridCol
    });

    const scr = penCenter(livestockPens[livestockPens.length - 1]);
    popText(scr.x, scr.y - 15, `-${def.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
    SZ.GameAudio.play('select');
  }

  /* ══════════════════════════════════════════════════════════════════
     SHOP — SELL & BUY
     ══════════════════════════════════════════════════════════════════ */

  function sellAllProduce() {
    if (state !== STATE_PLAYING) return;
    let totalEarned = 0;
    const bulk = techOwned('com_broker') && getTotalInventoryCount() >= 20 ? 1.1 : 1;

    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0) {
        const earned = Math.round(count * getEffectiveSellPrice(crop) * bulk);
        credits += earned;
        totalEarned += earned;
        delete inventory[crop.name];
      }
    }

    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0) {
        const earned = Math.round(count * getEffectiveProduceValue(live) * bulk);
        credits += earned;
        totalEarned += earned;
        delete inventory[live.produce];
      }
    }

    if (totalEarned > 0) {
      stats.earned += totalEarned;
      toast(`Sold produce for ${totalEarned} credits`, UI.gold, 'coin');
      const L = hudLayout();
      const from = L.storage.h ? { x: L.storage.x + L.storage.w / 2, y: L.storage.y + L.storage.h - 30 } : { x: UW / 2, y: L.dock.y };
      flyCoins(Math.min(14, 3 + Math.ceil(totalEarned / 40)), from.x, from.y);
      screenShake.trigger(2, 120);
      SZ.GameAudio.play('coin');
    } else
      SZ.GameAudio.play('error', { volume: 0.6 });
  }

  function buySeed(cropIndex) {
    if (state !== STATE_PLAYING) return;
    selectedCropIndex = cropIndex;
    selectedTool = TOOL_PLANT;
  }

  function placeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    if (selectedBuildingIndex < 0 || selectedBuildingIndex >= BUILDINGS.length) return;
    const tt = tileTypes[row]?.[col];
    if (tt === TILE_WATER) return;
    if (buildings[row]?.[col]) return; // already has a building

    const bdef = BUILDINGS[selectedBuildingIndex];
    if (!isBuildingUnlocked(selectedBuildingIndex)) return;
    const bcost = getBuildingCost(bdef);
    if (credits < bcost) return;

    // Destroy existing crop if any
    if (farmGrid[row][col] !== null) {
      farmGrid[row][col] = null;
      const { x: dx, y: dy } = tileCenter(col, row);
      popText(dx, dy + 6, 'Crop removed', { color: '#ffb080', font: 'bold 11px' });
    }

    credits -= bcost;
    ++stats.built;
    buildings[row][col] = { typeIndex: selectedBuildingIndex, level: 1 };
    invalidateField();

    const { x: tx, y: ty } = tileCenter(col, row);
    buildAnim[row + ',' + col] = uiTime;
    dustRing(tx, ty + 20);
    popText(tx, ty - 24, `-${bcost} cr`, { color: '#ff9a8a', font: 'bold 12px' });
    SZ.GameAudio.play('whoosh', { pitch: 1.4, volume: 0.5 });
    SZ.GameAudio.noise(0.15, 0.12, 'lowpass', 500, 100, 0.3);
  }

  function removeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    if (!buildings[row]?.[col]) return;
    const bdef = BUILDINGS[buildings[row][col].typeIndex];
    buildings[row][col] = null;
    invalidateField();
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `Removed ${bdef.name}`, { color: '#fa0', font: 'bold 11px sans-serif' });
    SZ.GameAudio.play('smallExplode', { volume: 0.6 });
  }

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS
     ══════════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS — chosen per season; meteors and lightning strike
     real tiles, rain wets the soil, snow and dust slow the crops
     ══════════════════════════════════════════════════════════════════ */

  const WEATHER_TABLE = [
    [[WEATHER_RAIN, 45], [WEATHER_SOLAR_FLARE, 20], [WEATHER_METEOR_SHOWER, 15], [WEATHER_THUNDERSTORM, 15], [WEATHER_DUST, 5]],
    [[WEATHER_SOLAR_FLARE, 40], [WEATHER_THUNDERSTORM, 20], [WEATHER_DUST, 20], [WEATHER_METEOR_SHOWER, 10], [WEATHER_RAIN, 10]],
    [[WEATHER_RAIN, 30], [WEATHER_THUNDERSTORM, 20], [WEATHER_DUST, 20], [WEATHER_METEOR_SHOWER, 20], [WEATHER_SOLAR_FLARE, 10]],
    [[WEATHER_SNOW, 70], [WEATHER_METEOR_SHOWER, 15], [WEATHER_SOLAR_FLARE, 15]]
  ];

  let meteors = [];                  // { wx, wy, r, c, delay, t, smash }
  let strikeTimer = 0;
  let bolts = [];                    // { pts, t }
  let decals = [];                   // { wx, wy, t, life, kind }
  let splashes = [];                 // { wx, wy, t }
  let flashA = 0;
  let wxShown = WEATHER_NONE, wxK = 0;
  let wxDrops = [];

  let rainMakerDay = 0;              // first day the rain maker can be used again

  function canCallRain() {
    return techOwned('sci_rain') && weatherType === WEATHER_NONE && dayCount >= rainMakerDay && state === STATE_PLAYING;
  }

  function callRain() {
    if (!canCallRain()) {
      SZ.GameAudio.play('error');
      return;
    }
    rainMakerDay = dayCount + 1;
    triggerWeather(currentSeason === 3 ? WEATHER_SNOW : WEATHER_RAIN);
  }

  function updateWeather(dt) {
    if (state !== STATE_PLAYING) return;
    if (weatherType === WEATHER_NONE) {
      weatherInterval -= dt;
      if (weatherInterval <= 0)
        triggerWeather();
    } else {
      weatherTimer -= dt;
      if (weatherType === WEATHER_THUNDERSTORM) {
        strikeTimer -= dt;
        if (strikeTimer <= 0) {
          strikeTimer = 1.1 + Math.random() * 1.3;
          strikeLightning();
        }
      }
      if (weatherTimer <= 0) {
        weatherType = WEATHER_NONE;
        scheduleWeather();
      }
    }
    updateMeteors(dt);
  }

  function pickWeather() {
    const table = WEATHER_TABLE[currentSeason] || WEATHER_TABLE[0];
    let total = 0;
    for (const [, w] of table) total += w;
    let roll = Math.random() * total;
    for (const [kind, w] of table) {
      roll -= w;
      if (roll < 0) return kind;
    }
    return table[0][0];
  }

  function isSheltered(r, c) {
    return !!getField().shelter[r * gridCols + c];
  }

  let nextWeather = null;

  function scheduleWeather() {
    weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    nextWeather = null;
  }

  /* The forecast keeps the weather it promised unless the season changed meanwhile */
  function forecastWeather() {
    if (!nextWeather || !(WEATHER_TABLE[currentSeason] || []).some(([k]) => k === nextWeather))
      nextWeather = pickWeather();
    return nextWeather;
  }

  function triggerWeather(kind) {
    weatherType = kind || forecastWeather();
    nextWeather = null;
    weatherTimer = weatherType === WEATHER_SNOW || weatherType === WEATHER_DUST ? 12 : WEATHER_DURATION;
    switch (weatherType) {
      case WEATHER_SOLAR_FLARE:
        announce('Solar flare!', 'Crops grow twice as fast, sun-lovers three times', '#ffd23f', 'flare');
        SZ.GameAudio.play('powerup', { pitch: 0.8 });
        break;
      case WEATHER_RAIN:
        announce('Rain', 'Crops grow 50% faster', '#7ab8ff', 'rain');
        SZ.GameAudio.play('whoosh', { pitch: 0.6 });
        break;
      case WEATHER_SNOW:
        announce('Snowfall', 'Crops grow 20% slower while it snows', '#cfe8ff', 'snow');
        SZ.GameAudio.tone(1320, 0.4, 'sine', 0.04);
        SZ.GameAudio.tone(1760, 0.5, 'sine', 0.03, 0.15);
        break;
      case WEATHER_DUST:
        announce('Dust storm', 'Crops grow 25% slower, solar panels are blinded', '#e0b878', 'dust');
        SZ.GameAudio.noise(1.2, 0.08, 'bandpass', 300, 900);
        break;
      case WEATHER_THUNDERSTORM:
        announce('Thunderstorm!', 'Double growth, but lightning may strike', '#c8b0ff', 'storm');
        strikeTimer = 0.8;
        SZ.GameAudio.play('thud', { pitch: 0.7 });
        break;
      case WEATHER_METEOR_SHOWER: {
        announce('Meteor shower!', 'Unprotected crops may be smashed', '#ff7a4a', 'meteor');
        SZ.GameAudio.play('whoosh', { pitch: 0.5 });
        // the same odds as before, but each hit is a visible meteor
        const resist = getWeatherResistance();
        const span = WEATHER_DURATION - 1.5;
        for (let r = 0; r < gridRows; ++r)
          for (let c = 0; c < gridCols; ++c) {
            const cell = farmGrid[r][c];
            if (!cell) continue;
            const crop = CROPS[cell.cropIndex];
            if (crop.weatherAffinity === 'any' || isSheltered(r, c)) continue;
            const chance = (crop.weatherAffinity === 'cold-vulnerable' ? 0.4 : 0.2) * (1 - resist);
            if (Math.random() < chance) {
              const p = tileCenter(c, r);
              meteors.push({ wx: p.x, wy: p.y, r, c, delay: Math.random() * span, t: 0, smash: true });
            }
          }
        const strays = 6 + Math.floor(Math.random() * 6);
        for (let i = 0; i < strays; ++i) {
          const wx = GRID_OFFSET_X + (Math.random() * (gridCols + 6) - 3) * BASE_TILE_SIZE;
          const wy = GRID_OFFSET_Y + (Math.random() * (gridRows + 4) - 1) * BASE_TILE_SIZE;
          meteors.push({ wx, wy, r: -1, c: -1, delay: Math.random() * span, t: 0, smash: false });
        }
        break;
      }
    }
  }

  const METEOR_FLIGHT = 0.9;

  function updateMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; --i) {
      const m = meteors[i];
      if (m.delay > 0) {
        m.delay -= dt;
        continue;
      }
      m.t += dt;
      if (m.t >= METEOR_FLIGHT) {
        meteors.splice(i, 1);
        meteorImpact(m);
      }
    }
  }

  function meteorImpact(m) {
    particles.burst(m.wx, m.wy, 14, { color: '#ffb048', speed: 4, life: 0.6, gravity: 0.08 });
    particles.burst(m.wx, m.wy, 8, { color: '#6a5040', speed: 2.5, life: 0.8, gravity: 0.12 });
    decals.push({ wx: m.wx, wy: m.wy, t: 0, life: 22, kind: 'crater' });
    screenShake.trigger(m.smash ? 5 : 2.5, 200);
    SZ.GameAudio.play('smallExplode', { volume: m.smash ? 0.9 : 0.5, pitch: 0.8 + Math.random() * 0.4 });
    if (techOwned('sci_meteor')) {
      const gain = 8 + Math.floor(Math.random() * 10);
      credits += gain;
      popText(m.wx, m.wy - 32, `+${gain} stardust`, { color: '#d8c0ff', font: 'bold 12px' });
      const u = worldToUI(m.wx, m.wy);
      flyCoins(1, u.x, u.y, { size: 16 });
    }
    if (m.smash && farmGrid[m.r]?.[m.c] && !isSheltered(m.r, m.c)) {
      farmGrid[m.r][m.c] = null;
      popText(m.wx, m.wy - 16, 'Smashed!', { color: '#ff8a5a', font: 'bold 12px' });
      particles.burst(m.wx, m.wy, 10, { color: '#7ad04a', speed: 3, life: 0.5 });
    }
  }

  /* Picks a strike point: mostly the field, sometimes the meadow or a pen */
  function strikeLightning() {
    const resist = getWeatherResistance();
    let wx, wy;
    const roll = Math.random();
    if (roll < 0.08 && livestockPens.length) {
      const i = Math.floor(Math.random() * livestockPens.length);
      const pen = livestockPens[i];
      ({ x: wx, y: wy } = penCenter(pen));
      if (Math.random() < 0.5 * (1 - resist)) {
        popText(wx, wy - 18, `${LIVESTOCK[pen.typeIndex].name} ran off!`, { color: UI.bad, font: 'bold 12px' });
        livestockPens.splice(i, 1);
        ++penVersion;
      }
    } else if (roll < 0.55) {
      const r = Math.floor(Math.random() * gridRows), c = Math.floor(Math.random() * gridCols);
      ({ x: wx, y: wy } = tileCenter(c, r));
      wx += (Math.random() - 0.5) * 20;
      const cell = farmGrid[r][c];
      if (cell && CROPS[cell.cropIndex].weatherAffinity !== 'any' && !isSheltered(r, c) && !buildings[r][c] && Math.random() < 0.5 * (1 - resist)) {
        farmGrid[r][c] = null;
        popText(wx, wy - 16, 'Scorched!', { color: '#ffd75a', font: 'bold 12px' });
        particles.burst(wx, wy, 10, { color: '#ffd23f', speed: 3, life: 0.4 });
      }
    } else {
      wx = GRID_OFFSET_X + (Math.random() * (gridCols + 6) - 3) * BASE_TILE_SIZE;
      wy = GRID_OFFSET_Y + (Math.random() * (gridRows + 3) - 1) * BASE_TILE_SIZE;
    }
    // jagged bolt from the clouds (screen top) to the strike point
    const sx = viewPanX + wx * viewZoom, sy = viewPanY + wy * viewZoom;
    const pts = [[sx + (Math.random() - 0.5) * 120, -10]];
    const n = 9;
    for (let i = 1; i < n; ++i) {
      const k = i / n;
      pts.push([pts[0][0] + (sx - pts[0][0]) * k + (Math.random() - 0.5) * 40, -10 + (sy + 10) * k]);
    }
    pts.push([sx, sy]);
    bolts.push({ pts, t: 0, wx, wy });
    flashA = 0.55;
    decals.push({ wx, wy, t: 0, life: 12, kind: 'scorch' });
    particles.burst(wx, wy, 12, { color: '#e0f0ff', speed: 3.5, life: 0.35 });
    screenShake.trigger(4, 250);
    SZ.GameAudio.play('zap', { pitch: 0.7 });
    SZ.GameAudio.noise(1.1, 0.16, 'lowpass', 420, 60, 0.18);
  }

  /* Visual weather state eases in and out instead of switching hard */
  function updateWeatherVisuals(dt) {
    if (weatherType !== WEATHER_NONE && wxShown !== weatherType) {
      if (wxK < 0.05 || wxShown === WEATHER_NONE) {
        wxShown = weatherType;
        wxDrops = [];
      } else
        wxK = Math.max(0, wxK - dt * 1.5);
    }
    const target = weatherType !== WEATHER_NONE && wxShown === weatherType ? 1 : 0;
    wxK += (target - wxK) * Math.min(1, dt * 1.2);
    if (wxK < 0.01 && weatherType === WEATHER_NONE)
      wxShown = WEATHER_NONE;
    flashA = Math.max(0, flashA - dt * 2.2);
    for (let i = bolts.length - 1; i >= 0; --i) {
      bolts[i].t += dt;
      if (bolts[i].t > 0.35) bolts.splice(i, 1);
    }
    for (let i = decals.length - 1; i >= 0; --i) {
      decals[i].t += dt;
      if (decals[i].t > decals[i].life) decals.splice(i, 1);
    }
    for (let i = splashes.length - 1; i >= 0; --i) {
      splashes[i].t += dt;
      if (splashes[i].t > 0.45) splashes.splice(i, 1);
    }
    // falling drops, flakes and dust in screen space
    const area = canvasW * canvasH / (1000 * 700);
    const want = {
      [WEATHER_RAIN]: 160, [WEATHER_THUNDERSTORM]: 260, [WEATHER_SNOW]: 180, [WEATHER_DUST]: 140, [WEATHER_SOLAR_FLARE]: 40, [WEATHER_METEOR_SHOWER]: 0
    }[wxShown] || 0;
    const count = Math.round(want * area * wxK * (lowQuality ? 0.55 : 1));
    while (wxDrops.length < count)
      wxDrops.push(newDrop(wxShown, true));
    if (wxDrops.length > count)
      wxDrops.length = count;
    const wind = windStrength();
    for (let i = 0; i < wxDrops.length; ++i) {
      const d = wxDrops[i];
      d.x += d.vx * dt * (wxShown === WEATHER_DUST ? 1 : 0.6 + wind * 0.2);
      d.y += d.vy * dt;
      d.t += dt;
      if (wxShown === WEATHER_SNOW)
        d.x += Math.sin(d.t * 1.5 + d.ph) * 18 * dt;
      if (d.y > d.floor || d.x < -40 || d.x > canvasW + 40 || d.t > d.life) {
        if ((wxShown === WEATHER_RAIN || wxShown === WEATHER_THUNDERSTORM) && d.y > d.floor && Math.random() < 0.35) {
          const wx = (d.x - viewPanX) / viewZoom, wy = (d.y - viewPanY) / viewZoom;
          if (wy > horizonWorldY())
            splashes.push({ wx, wy, t: 0 });
        }
        wxDrops[i] = newDrop(wxShown, false);
      }
    }
  }

  function newDrop(kind, anywhere) {
    const d = { x: Math.random() * (canvasW + 80) - 40, y: anywhere ? Math.random() * canvasH : -10 - Math.random() * 40, t: 0, ph: Math.random() * TWO_PI, life: 20 };
    d.floor = canvasH * (0.35 + Math.random() * 0.7);
    switch (kind) {
      case WEATHER_RAIN:
      case WEATHER_THUNDERSTORM:
        d.vx = -60 - Math.random() * 40 - (kind === WEATHER_THUNDERSTORM ? 80 : 0);
        d.vy = 520 + Math.random() * 220;
        d.len = 10 + Math.random() * 10;
        break;
      case WEATHER_SNOW:
        d.vx = -10 - Math.random() * 20;
        d.vy = 40 + Math.random() * 50;
        d.size = 1.5 + Math.random() * 2.5;
        d.floor = canvasH + 10;
        break;
      case WEATHER_DUST:
        d.x = anywhere ? d.x : -30;
        d.y = Math.random() * canvasH;
        d.vx = 260 + Math.random() * 260;
        d.vy = (Math.random() - 0.5) * 40;
        d.size = 1 + Math.random() * 3;
        d.floor = canvasH + 10;
        break;
      default:
        d.vx = (Math.random() - 0.5) * 20;
        d.vy = -20 - Math.random() * 20;
        d.y = anywhere ? Math.random() * canvasH : canvasH + 10;
        d.floor = canvasH + 40;
        d.life = 4 + Math.random() * 4;
        d.size = 2 + Math.random() * 3;
    }
    return d;
  }

  /* World-space weather marks: craters, scorch marks, rain rings, incoming meteors */
  function drawWeatherWorld() {
    for (const d of decals) {
      const a = Math.min(1, (d.life - d.t) / 4) * (d.kind === 'crater' ? 0.75 : 0.55);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = d.kind === 'crater' ? '#2a1a12' : '#1a1418';
      ctx.beginPath();
      ctx.ellipse(d.wx, d.wy + 4, d.kind === 'crater' ? 14 : 10, d.kind === 'crater' ? 6 : 4, 0, 0, TWO_PI);
      ctx.fill();
      if (d.kind === 'crater' && d.t < 3) {
        ctx.globalAlpha = (1 - d.t / 3) * 0.8;
        ctx.fillStyle = '#ff8a3a';
        ctx.beginPath();
        ctx.ellipse(d.wx, d.wy + 4, 6, 2.5, 0, 0, TWO_PI);
        ctx.fill();
        lightAt(d.wx, d.wy, 50, '#ff8a3a', 1 - d.t / 3);
      }
      ctx.restore();
    }
    for (const s of splashes) {
      const k = s.t / 0.45;
      ctx.strokeStyle = `rgba(200,230,255,${0.6 * (1 - k)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.wx, s.wy, 2 + k * 7, 1 + k * 3, 0, 0, TWO_PI);
      ctx.stroke();
    }
  }

  function drawMeteorsWorld() {
    for (const m of meteors) {
      if (m.delay > 0) continue;
      const k = m.t / METEOR_FLIGHT;
      const sx = m.wx + 420 * (1 - k), sy = m.wy - 640 * (1 - k);
      const tx = sx + 420 * 0.16, ty = sy - 640 * 0.16;
      const g = ctx.createLinearGradient(sx, sy, tx, ty);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.3, 'rgba(255,140,60,0.7)');
      g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, TWO_PI);
      ctx.fill();
      lightAt(sx, sy, 70, '#ffa050', 1);
      // shadow of the incoming rock
      ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
      ctx.beginPath();
      ctx.ellipse(m.wx, m.wy + 4, 4 + k * 8, 2 + k * 3, 0, 0, TWO_PI);
      ctx.fill();
    }
  }

  /* Aurora ribbons in the sky during a solar flare */
  function drawAurora() {
    if (wxShown !== WEATHER_SOLAR_FLARE || wxK < 0.02) return;
    const hy = viewPanY + horizonWorldY() * viewZoom;
    if (hy <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cols = ['80,255,170', '120,200,255', '255,160,240'];
    for (let k = 0; k < 3; ++k) {
      ctx.beginPath();
      const base = hy * (0.25 + k * 0.15);
      for (let x = 0; x <= canvasW; x += 16) {
        const y = base + Math.sin(x * 0.006 + animT * 0.6 + k * 2) * 26 + Math.sin(x * 0.017 - animT * 0.9 + k) * 10;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = canvasW; x >= 0; x -= 16) {
        const y = base + 50 + Math.sin(x * 0.006 + animT * 0.6 + k * 2 + 0.4) * 26;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - 30, 0, base + 80);
      g.addColorStop(0, `rgba(${cols[k]},0)`);
      g.addColorStop(0.5, `rgba(${cols[k]},${0.22 * wxK})`);
      g.addColorStop(1, `rgba(${cols[k]},0)`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  let dustBandCanvas = null;
  function dustBand() {
    if (!dustBandCanvas) {
      dustBandCanvas = document.createElement('canvas');
      dustBandCanvas.width = 4;
      dustBandCanvas.height = 120;
      const g = dustBandCanvas.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 120);
      gr.addColorStop(0, 'rgba(210,160,90,0)');
      gr.addColorStop(0.5, 'rgba(210,160,90,0.18)');
      gr.addColorStop(1, 'rgba(210,160,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 120);
    }
    return dustBandCanvas;
  }

  /* Screen-space weather on top of the farm */

  function resetWeatherVisuals() {
    meteors = [];
    bolts = [];
    decals = [];
    splashes = [];
    wxDrops = [];
    wxK = 0;
    flashA = 0;
    wxShown = WEATHER_NONE;
  }



  /* ══════════════════════════════════════════════════════════════════
     DAY CYCLE
     ══════════════════════════════════════════════════════════════════ */

  function updateDayCycle(dt) {
    if (state !== STATE_PLAYING) return;
    const prevDay = Math.floor(gameTime / DAY_CYCLE_PERIOD);
    gameTime += dt;
    const curDay = Math.floor(gameTime / DAY_CYCLE_PERIOD);
    if (curDay > prevDay) {
      ++dayCount;
      updateWindowTitle();
    }

    // Day/night phase: 0..1 within each game day
    const prevPhase = dayPhase;
    dayPhase = (gameTime % DAY_CYCLE_PERIOD) / DAY_CYCLE_PERIOD;
    if (prevPhase < 0.5 && dayPhase >= 0.5)
      dayChime(false);
    else if (prevPhase > 0.9 && dayPhase < 0.1)
      dayChime(true);

    // Season: changes every SEASON_DURATION days
    currentSeason = Math.floor((dayCount - 1) / SEASON_DURATION) % SEASONS.length;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════════
     PRICE FLUCTUATION
     ══════════════════════════════════════════════════════════════════ */

  function updatePriceFluctuation(dt) {
    if (state !== STATE_PLAYING) return;
    priceChangeTimer -= dt;
    if (priceChangeTimer <= 0) {
      priceChangeTimer = PRICE_CHANGE_INTERVAL;
      const next = getNextPrices();
      for (let i = 0; i < CROPS.length; ++i)
        priceMultipliers[i] = next[i];
      priceNext = null;
      toast('Market prices changed', '#8cf', 'chart');
    }
  }

  let priceNext = null;

  /* The coming price change, rolled once so Market Insight can show it early */
  function getNextPrices() {
    if (!priceNext || priceNext.length !== CROPS.length) {
      priceNext = [];
      for (let i = 0; i < CROPS.length; ++i) {
        // Drift toward 1.0 with random perturbation
        const old = priceMultipliers[i] || 1;
        const drift = (1 - old) * 0.3; // mean-reversion
        const noise = (Math.random() - 0.5) * 0.6;
        priceNext.push(Math.max(PRICE_MIN_MULT, Math.min(PRICE_MAX_MULT, old + drift + noise)));
      }
    }
    return priceNext;
  }

  function updateGame(dt) {
    if (state === STATE_PAUSED) return;

    updateDayCycle(dt);
    updateCrops(dt);
    updateLivestock(dt);
    updateWeather(dt);
    updatePriceFluctuation(dt);
    updateBuildingIncome(dt);
    updateAnimals(dt);
    updateEnergy(dt);
    updateAutoPlanter(dt);
    updateAutoCollector(dt);
    updateShuffleCache(dt);
    updateGoals(dt);
    updateOrders(dt);
  }

  /* ── Auto-Collector Buildings ── */
  function updateAutoCollector(dt) {
    if (state !== STATE_PLAYING) return;
    if (!livestockPens.length) return;

    autoCollectorTimer += dt;

    // Find the fastest auto-collector interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;
        minInterval = Math.min(minInterval, getAutoCollectorInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (autoCollectorTimer < minInterval) return;
    autoCollectorTimer -= minInterval;

    // For each auto-collector building, check livestock pens within range
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;

        const range = getBuildingRange(bld);
        for (let pi = 0; pi < livestockPens.length; ++pi) {
          const pen = livestockPens[pi];
          if (!pen.produceReady) continue;

          // Check if pen is within range of this collector (using grid coordinates)
          const dr = Math.abs(pen.gridRow - r);
          const dc = Math.abs(pen.gridCol - c);
          if (dr > range || dc > range) continue;

          // Auto-collect the produce
          const def = LIVESTOCK[pen.typeIndex];
          pen.produceReady = false;
          pen.feedTimer = getFeedInterval(def);

          inventory[def.produce] = (inventory[def.produce] || 0) + (techOwned('husb_happy') && Math.random() < 0.2 ? 2 : 1);

          if (viewZoom >= 0.5) {
            const scr = penCenter(pen);
            flyProduce(def.produceSprite, scr.x, scr.y, 1, true);
            particles.sparkle(scr.x, scr.y, Math.ceil(4 * viewZoom), { color: '#0cf', speed: 1.5 });
          }
        }
      }
  }

  /* ── Shuffle Cache ── */

  function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function refreshShuffleCache() {
    // Build all grid positions in order, then shuffle
    const all = [];
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c)
        all.push({ r, c });
    cachedHarvestOrder = fisherYatesShuffle(all.slice());
    cachedPlantOrder = fisherYatesShuffle(all.slice());
  }

  function updateShuffleCache(dt) {
    if (state !== STATE_PLAYING) return;
    shuffleCacheTimer += dt;
    if (shuffleCacheTimer >= SHUFFLE_CACHE_INTERVAL) {
      shuffleCacheTimer -= SHUFFLE_CACHE_INTERVAL;
      refreshShuffleCache();
    }
  }

  /* ── Energy System ── */
  function updateEnergy(dt) {
    if (state !== STATE_PLAYING) return;
    const maxE = getEnergyMax();
    energy = Math.min(maxE, energy + getEnergyRegenRate() * dt);
  }

  /* ── Auto-Planter Buildings ── */
  function updateAutoPlanter(dt) {
    if (state !== STATE_PLAYING) return;
    autoPlanterTimer += dt;

    // Find the fastest auto-planter interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Auto-Planter L1' || bname === 'Auto-Planter L2')
          minInterval = Math.min(minInterval, getAutoPlanterInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (autoPlanterTimer < minInterval) return;
    autoPlanterTimer -= minInterval;

    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const pBld = buildings[r]?.[c];
        if (!pBld) continue;
        const bdef = BUILDINGS[pBld.typeIndex];
        if (bdef.name !== 'Auto-Planter L1' && bdef.name !== 'Auto-Planter L2') continue;

        // Determine crop candidates for L2 (diversification pool), or fixed crop for L1
        const isL2 = bdef.name === 'Auto-Planter L2';
        let l2Candidates = null;
        if (isL2) {
          // Find the best market factor first
          let bestFactor = -Infinity;
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = priceMultipliers[ci] || 1;
            if (factor > bestFactor && isCropUnlocked(ci))
              bestFactor = factor;
          }
          // Collect all crops within 0.15 of the best for diversification
          l2Candidates = [];
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = priceMultipliers[ci] || 1;
            if (bestFactor - factor <= 0.15 && isCropUnlocked(ci))
              l2Candidates.push(ci);
          }
        }

        const range = getBuildingRange(pBld);

        // Use cached plant order for even distribution across ticks
        if (!cachedPlantOrder.length)
          refreshShuffleCache();
        const plantable = [];
        for (const { r: pr, c: pc } of cachedPlantOrder) {
          const nr = pr, nc = pc;
          if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
          const dr = nr - r, dc = nc - c;
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) > range || Math.abs(dc) > range) continue;
          const adjTT = tileTypes[nr]?.[nc];
          if (adjTT === TILE_WATER || adjTT === TILE_ROCK) continue;
          if (buildings[nr]?.[nc]) continue;
          if (farmGrid[nr][nc] !== null) continue;
          plantable.push({ nr, nc });
        }
        for (const { nr, nc } of plantable) {
          // Each tile independently picks a crop for L2 diversification
          const cropIdx = isL2
            ? l2Candidates[Math.floor(Math.random() * l2Candidates.length)]
            : selectedCropIndex;
          const crop = CROPS[cropIdx];
          const seedCost = getSeedCost(crop);
          if (credits < seedCost) break;
          credits -= seedCost;
          farmGrid[nr][nc] = {
            cropIndex: cropIdx,
            growthProgress: 0,
            growthStage: 0,
            plantAnim: 1.0
          };
          if (viewZoom >= 0.5) {
            const { x: tx, y: ty } = tileCenter(nc, nr);
            particles.sparkle(tx, ty, Math.ceil(4 * viewZoom), { color: crop.color, speed: 1.5 });
            popText(tx, ty - 10, `-${seedCost}`, { color: '#8af', font: 'bold 10px' });
          }
        }
      }
  }

  /* ── Building Income (Solar Panel / Wind Turbine) ── */
  const BUILDING_INCOME_INTERVAL = 5; // seconds between income ticks (short for visible feedback)
  const BUILDING_INCOME_FRACTION = BUILDING_INCOME_INTERVAL / 30; // fraction of full cycle income per tick
  let buildingIncomeAccum = 0; // fractional credit accumulator for base income
  let buildingIncomeSurplusAccum = 0; // fractional credit accumulator for surplus

  function updateBuildingIncome(dt) {
    if (state !== STATE_PLAYING) return;
    buildingIncomeTimer += dt;
    if (buildingIncomeTimer < BUILDING_INCOME_INTERVAL) return;
    buildingIncomeTimer -= BUILDING_INCOME_INTERVAL;

    const energyFull = energy >= getEnergyMax();
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          const income = getSolarPanelIncome(bld) * BUILDING_INCOME_FRACTION;
          buildingIncomeAccum += income;
          if (energyFull)
            buildingIncomeSurplusAccum += income;
        } else if (bname === 'Wind Turbine') {
          const income = getWindTurbineIncome(bld) * BUILDING_INCOME_FRACTION;
          buildingIncomeAccum += income;
          if (energyFull)
            buildingIncomeSurplusAccum += income;
        }
      }

    // Only award whole credits; keep fractional remainder for next tick
    const earned = Math.floor(buildingIncomeAccum);
    const surplusBonus = Math.floor(buildingIncomeSurplusAccum);
    buildingIncomeAccum -= earned;
    buildingIncomeSurplusAccum -= surplusBonus;

    const total = earned + surplusBonus;
    if (total > 0) {
      credits += total;
      let shown = 0;
      for (let r = 0; r < gridRows && shown < 2; ++r)
        for (let c = 0; c < gridCols && shown < 2; ++c) {
          const bld = buildings[r]?.[c];
          if (!bld) continue;
          const bname = BUILDINGS[bld.typeIndex].name;
          if (bname !== 'Solar Panel' && bname !== 'Wind Turbine') continue;
          const p = tileCenter(c, r);
          const u = worldToUI(p.x, p.y - 20);
          flyCoins(1, u.x, u.y, { size: 14 });
          ++shown;
        }
    }
  }

  /* ── Wild Animals (Feature 8) ── */
  function updateAnimals(dt) {
    if (state !== STATE_PLAYING) return;

    // Spawn timer
    nextAnimalSpawn -= dt;
    if (nextAnimalSpawn <= 0) {
      nextAnimalSpawn = (ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN)) * Math.pow(1.4, techChainCount('sci_repel'));
      spawnAnimal();
    }

    // Update each animal
    for (let i = wildAnimals.length - 1; i >= 0; --i) {
      const animal = wildAnimals[i];
      animal.moveTimer -= dt;
      if (animal.moveTimer > 0) continue;
      animal.moveTimer = 0.5; // move every 0.5s

      // Pest zappers fry mice that come into range
      const zapper = findZapperNear(animal);
      if (zapper) {
        const from = tileCenter(zapper.c, zapper.r);
        const to = tileCenter(animal.rx !== undefined ? animal.rx : animal.x, animal.ry !== undefined ? animal.ry : animal.y);
        zapArcs.push({ x0: from.x, y0: from.y - 30, x1: to.x, y1: to.y, t: 0 });
        particles.burst(to.x, to.y, 10, { color: '#9ff0ff', speed: 3, life: 0.35 });
        popText(to.x, to.y - 12, 'Zapped! +5', { color: '#9ff0ff', font: 'bold 12px' });
        credits += 5;
        SZ.GameAudio.play('zap', { volume: 0.7 });
        wildAnimals.splice(i, 1);
        continue;
      }

      // Check if in scarecrow range -- flee (radius scales with level)
      let scared = false;
      for (let r = 0; r < gridRows && !scared; ++r)
        for (let c = 0; c < gridCols && !scared; ++c) {
          const sBld = buildings[r]?.[c];
          if (!sBld) continue;
          if (BUILDINGS[sBld.typeIndex].name !== 'Scarecrow') continue;
          const scareRadius = getScarecrowRadius(sBld);
          if (Math.abs(Math.round(animal.y) - r) <= scareRadius && Math.abs(Math.round(animal.x) - c) <= scareRadius)
            scared = true;
        }

      if (scared) {
        // Flee: move away from grid center
        const gridCenterR = gridRows / 2;
        const gridCenterC = gridCols / 2;
        const dr = animal.y - gridCenterR;
        const dc = animal.x - gridCenterC;
        const len = Math.sqrt(dr * dr + dc * dc) || 1;
        animal.y += (dr / len) * 0.8;
        animal.x += (dc / len) * 0.8;
        // Remove if off-grid
        if (animal.x < -2 || animal.x > gridCols + 2 || animal.y < -2 || animal.y > gridRows + 2) {
          wildAnimals.splice(i, 1);
        }
        continue;
      }

      // Find nearest crop
      let bestDist = Infinity;
      let bestR = -1, bestC = -1;
      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          if (!farmGrid[r][c]) continue;
          const d = Math.abs(r - animal.y) + Math.abs(c - animal.x);
          if (d < bestDist) {
            bestDist = d;
            bestR = r;
            bestC = c;
          }
        }

      if (bestR < 0) continue; // no crops to target

      // Move toward target
      const moveR = bestR - animal.y;
      const moveC = bestC - animal.x;
      const moveDist = Math.sqrt(moveR * moveR + moveC * moveC);
      if (moveDist < 0.3) {
        // Reached a crop tile -- eat it
        const eatenCell = farmGrid[bestR][bestC];
        if (eatenCell) {
          farmGrid[bestR][bestC] = null;
          const { x: tx, y: ty } = tileCenter(bestC, bestR);
          popText(tx, ty - 10, 'Eaten!', { color: '#f44', font: 'bold 11px sans-serif' });
          particles.burst(tx, ty, 6, { color: '#f88', speed: 2, life: 0.3 });
          SZ.GameAudio.play('hurt', { volume: 0.6 });
        }
        // Animal leaves after eating
        wildAnimals.splice(i, 1);
        continue;
      }

      // Check for fence blocking (L3+ slows, L5+ blocks and damages)
      const nextR = Math.round(animal.y + (moveR / moveDist) * 0.5);
      const nextC = Math.round(animal.x + (moveC / moveDist) * 0.5);
      if (nextR >= 0 && nextR < gridRows && nextC >= 0 && nextC < gridCols) {
        const fBld = buildings[nextR]?.[nextC];
        if (fBld && BUILDINGS[fBld.typeIndex].name === 'Fence') {
          const fLvl = fBld.level || 1;
          if (fLvl >= 5) {
            // L5+: block AND damage -- kill animal
            const { x: fx, y: fy } = tileCenter(nextC, nextR);
            popText(fx, fy - 10, 'Zapped!', { color: '#f44', font: 'bold 10px sans-serif' });
            particles.burst(fx, fy, 6, { color: '#ff0', speed: 2.5, life: 0.3 });
            SZ.GameAudio.play('zap', { volume: 0.6 });
            wildAnimals.splice(i, 1);
            continue;
          }
          if (fLvl >= 3) {
            // L3-L4: slow animals (reduced movement speed)
            animal.y += (moveR / moveDist) * 0.15;
            animal.x += (moveC / moveDist) * 0.15;
            continue;
          }
          // L1-L2: block completely
          continue;
        }
      }

      animal.y += (moveR / moveDist) * 0.5;
      animal.x += (moveC / moveDist) * 0.5;
    }
  }

  let miceWarned = false;
  const zapArcs = [];

  function findZapperNear(animal) {
    const ar = Math.round(animal.y), ac = Math.round(animal.x);
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const b = buildings[r]?.[c];
        if (!b || BUILDINGS[b.typeIndex].name !== 'Pest Zapper') continue;
        const range = getBuildingRange(b);
        if (Math.abs(ar - r) <= range && Math.abs(ac - c) <= range)
          return { r, c };
      }
    return null;
  }

  function spawnAnimal() {
    // Spawn at a random edge
    let x, y;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: x = -1; y = Math.random() * gridRows; break; // left
      case 1: x = gridCols; y = Math.random() * gridRows; break; // right
      case 2: x = Math.random() * gridCols; y = -1; break; // top
      default: x = Math.random() * gridCols; y = gridRows; break; // bottom
    }
    wildAnimals.push({ x, y, targetCol: -1, targetRow: -1, moveTimer: 0, hp: 1 });
    squeak();
    if (!miceWarned) {
      miceWarned = true;
      toast('A space mouse sneaks onto the farm: click it!', UI.warn, 'mouse');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */



  /* ══════════════════════════════════════════════════════════════════
     WORLD ART — sky, ground, tiles, crops, buildings, animals, light
     Everything below the HUD is drawn in world units inside the view
     transform; tile textures and decorations are baked once per season
     ══════════════════════════════════════════════════════════════════ */

  const TEX = 14;                    // texels per tile edge (4 world units each)
  let animT = 0;                     // world animation clock (stops while paused)

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function mixHex(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    const m = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
    return '#' + ((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1);
  }

  /* 0 at noon .. 1 at midnight, with soft dusk and dawn */
  function nightAmount() {
    const p = dayPhase;
    if (p < 0.42) return p < 0.04 ? 1 - smoothstep(-0.04, 0.04, p) : 0;
    if (p < 0.54) return smoothstep(0.42, 0.54, p);
    if (p < 0.92) return 1;
    return 1 - smoothstep(0.92, 1.04, p);
  }

  /* 0..1 how golden the light is (sunrise and sunset) */
  function duskAmount() {
    const p = dayPhase;
    return Math.max(0, 1 - Math.abs(p - 0.48) / 0.07, 1 - Math.abs(p - 0.97) / 0.06, p < 0.03 ? 1 - p / 0.06 : 0);
  }

  const SEASON_PAL = [
    { name: 'spring', turf: ['#1f6a54', '#2a8a62', '#3aa872', '#62c88a'], flower: ['#ff9ad0', '#ffffff', '#c890ff'], soil: ['#4e3220', '#64412a', '#7d5634'] },
    { name: 'summer', turf: ['#3a6a2a', '#4f8a32', '#6aa83a', '#9cc85a'], flower: ['#ffd23f', '#ff7a4a', '#ffffff'], soil: ['#5a3a20', '#73502c', '#906a3a'] },
    { name: 'autumn', turf: ['#5a4a26', '#7a6430', '#9a7a36', '#c49a4a'], flower: ['#ff7a2a', '#e23b3b', '#ffb648'], soil: ['#4a3020', '#62402a', '#7a5434'] },
    { name: 'winter', turf: ['#a8b8d0', '#c8d6ea', '#dfe9f5', '#ffffff'], flower: ['#8fd3ff', '#ffffff', '#c8d6ea'], soil: ['#40302a', '#54403a', '#6a564c'] }
  ];

  /* Bakes a TEX x TEX texture scaled to the full tile size with crisp pixels */
  const texCache = {};
  function bakeTexture(key, w, h, scale, paint) {
    let cv = texCache[key];
    if (cv) return cv;
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const g = src.getContext('2d');
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h || !c) return;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    };
    paint(put, g);
    cv = document.createElement('canvas');
    cv.width = w * scale;
    cv.height = h * scale;
    const g2 = cv.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.drawImage(src, 0, 0, w * scale, h * scale);
    texCache[key] = cv;
    return cv;
  }

  function tileTexture(type, variant, season, flags) {
    const pal = SEASON_PAL[season];
    const winter = season === 3;
    const key = `t${type}:${variant}:${season}:${flags}`;
    return bakeTexture(key, TEX, TEX, 4, (put) => {
      const rnd = mulberry32(variant * 7919 + type * 131 + season * 17 + flags * 3);
      const wet = flags & 1, rich = flags & 2;
      if (type === TILE_FARMLAND) {
        let [dk, md, lt] = pal.soil;
        if (wet) {
          dk = shadeColor(dk, -0.28); md = shadeColor(md, -0.28); lt = shadeColor(lt, -0.25);
        }
        if (rich) {
          dk = mixHex(dk, '#2a2a18', 0.3); md = mixHex(md, '#3a3420', 0.3);
        }
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x) {
            const row = (y + 1) % 4;
            let c = row === 0 ? lt : (row === 2 ? dk : md);
            if (rnd() < 0.08) c = row === 0 ? md : lt;
            put(x, y, c);
          }
        for (let i = 0; i < 3; ++i)
          put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), wet ? '#7a6a62' : '#a8927a');
        if (wet)
          for (let i = 0; i < 4; ++i)
            put(Math.floor(rnd() * TEX), (Math.floor(rnd() * 4) * 4 + 1) % TEX, '#8ab0d0');
        if (rich)
          for (let i = 0; i < 3; ++i)
            put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), '#5aa040');
        if (winter)
          for (let y = 3; y < TEX; y += 4)
            for (let x = 0; x < TEX; ++x)
              if (rnd() < 0.55) put(x, y, rnd() < 0.7 ? '#eef4ff' : '#c8d6ea');
      } else if (type === TILE_SAND) {
        const base = winter ? '#d8d0c0' : '#d6b46a', dark = winter ? '#bab4aa' : '#c09a52', light = winter ? '#f4f4f8' : '#ecd08c';
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x)
            put(x, y, base);
        for (let k = 0; k < 3; ++k) {
          const y0 = 2 + k * 4 + Math.floor(rnd() * 2);
          for (let x = 0; x < TEX; ++x) {
            const y = y0 + Math.round(Math.sin((x + k * 3) * 0.7));
            put(x, y, dark);
            put(x, y - 1, light);
          }
        }
        for (let i = 0; i < 4; ++i)
          put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), rnd() < 0.5 ? '#f8e6b0' : '#a88a4a');
      } else if (type === TILE_ROCK) {
        // grey gravel bed; the boulders on it are drawn as objects
        const base = winter ? '#9aa0ae' : '#6e6a66', dark = winter ? '#7e8494' : '#55514e', light = winter ? '#d8dee8' : '#8e8984';
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x) {
            const r = rnd();
            put(x, y, r < 0.25 ? dark : (r > 0.85 ? light : base));
          }
        for (let x = 0; x < TEX; ++x) {
          put(x, 0, dark);
          put(0, x, dark);
        }
      } else if (type === TILE_WATER) {
        // flags carries the animation frame for water
        const frame = flags;
        if (winter) {
          for (let y = 0; y < TEX; ++y)
            for (let x = 0; x < TEX; ++x)
              put(x, y, (x + y) % 7 === 0 ? '#c8e8f8' : '#9ccbe8');
          for (let i = 0; i < 6; ++i)
            put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), '#eef8ff');
          let x = Math.floor(rnd() * TEX), y = 0;
          while (y < TEX) {
            put(x, y, '#6a9cc0');
            x += Math.floor(rnd() * 3) - 1;
            ++y;
          }
        } else {
          for (let y = 0; y < TEX; ++y)
            for (let x = 0; x < TEX; ++x)
              put(x, y, y < 3 ? '#2f6ac8' : (y > 10 ? '#20509e' : '#2a5fb8'));
          for (let k = 0; k < 5; ++k) {
            const wx = (Math.floor(rnd() * TEX) + frame * 2) % TEX, wy = Math.floor(rnd() * TEX);
            put(wx, wy, '#8fd3ff');
            put((wx + 1) % TEX, wy, '#5aa8f0');
          }
        }
      }
    });
  }

  function turfPattern(season) {
    const key = 'turfpat:' + season;
    if (texCache[key]) return texCache[key];
    const pal = SEASON_PAL[season];
    const S = TEX * 4;
    const tex = bakeTexture('turf:' + season, S, S, 4, (put) => {
      const rnd = mulberry32(4242 + season);
      for (let y = 0; y < S; ++y)
        for (let x = 0; x < S; ++x) {
          const n = Math.sin(x * 0.31) + Math.cos(y * 0.27) + Math.sin((x + y) * 0.13);
          put(x, y, n > 1 ? pal.turf[2] : (n < -1 ? pal.turf[0] : pal.turf[1]));
        }
      for (let i = 0; i < 260; ++i) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        put(x, y, pal.turf[3]);
        put(x, y + 1, pal.turf[2]);
      }
      for (let i = 0; i < 14; ++i) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        const c = pal.flower[Math.floor(rnd() * pal.flower.length)];
        put(x, y, c);
        if (season !== 3) {
          put(x - 1, y, c); put(x + 1, y, c); put(x, y - 1, c); put(x, y + 1, '#2a5a3a');
          put(x, y, '#ffe48a');
        }
      }
    });
    const pat = ctx.createPattern(tex, 'repeat');
    texCache[key] = pat;
    return pat;
  }

  /* ── Decorations scattered on the meadow around the field ── */

  const DECOR_PAINTERS = {
    tree: (p, P, s) => {
      p.rect(7, 9, 2, 6, P.dbrown);
      const leaf = [P.teal, P.green, P.orange, '#e8f0ff'][s];
      const leaf2 = [P.cyan, P.lime, P.yellow, '#ffffff'][s];
      p.disc(8, 6, 5, leaf);
      p.disc(5, 8, 3, leaf); p.disc(11, 8, 3, leaf);
      p.disc(7, 4, 2, leaf2, true);
      if (s === 0) { p.px(5, 5, P.pink, true); p.px(10, 7, P.pink, true); p.px(8, 9, P.pink, true); }
      if (s === 1) { p.px(5, 6, P.red, true); p.px(10, 5, P.red, true); }
    },
    crystal: (p, P) => {
      p.poly([[6, 15], [4, 7], [7, 2], [9, 7], [8, 15]], P.cyan);
      p.poly([[9, 15], [10, 9], [13, 6], [13, 12], [11, 15]], P.violet);
      p.poly([[3, 15], [2, 11], [5, 10], [6, 15]], P.sky);
      p.line(6, 4, 6, 12, P.white, true);
    },
    boulder: (p, P, s) => {
      p.ell(8, 11, 6, 4, P.grey);
      p.ell(7, 9, 4, 3, P.steel);
      if (s === 3) p.ell(7, 8, 4, 1.5, P.white);
      else if (s < 2) p.px(4, 12, P.leaf, true);
    },
    shroom: (p, P) => {
      p.rect(4, 10, 2, 5, P.cream); p.rect(10, 8, 2, 7, P.cream); p.rect(13, 12, 1, 3, P.cream);
      p.ell(5, 9, 3.5, 1.5, P.teal); p.ell(11, 7, 3.5, 2, P.cyan); p.ell(13.5, 11.5, 1.5, 1, P.teal);
      p.px(4, 8, P.white, true); p.px(10, 6, P.white, true); p.px(12, 6, P.white, true);
    },
    reeds: (p, P, s) => {
      const c = [P.leaf, P.green, P.tan, P.steel][s];
      for (const x of [4, 7, 10, 12]) p.line(x, 15, x + 1, 5 + (x % 3), c);
      p.ell(5, 5, 0.8, 1.6, P.brown); p.ell(11, 6, 0.8, 1.6, P.brown);
    },
    bloom: (p, P, s) => {
      const col = [[P.pink, P.white], [P.yellow, P.orange], [P.orange, P.red], [P.sky, P.white]][s];
      for (const [x, y, i] of [[4, 8, 0], [9, 6, 1], [12, 10, 0], [6, 12, 1]]) {
        p.line(x, y + 1, x, 15, P.leaf);
        p.disc(x, y, 1.5, col[i]);
        p.px(x, y, P.yellow, true);
      }
    }
  };
  const DECOR_KINDS = ['tree', 'crystal', 'boulder', 'shroom', 'reeds', 'bloom', 'bloom', 'tree'];

  function decorSprite(kind, season) {
    const key = 'decor:' + kind + ':' + season;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => DECOR_PAINTERS[kind](p, P, season));
    return spriteCache[key];
  }

  /* Soft round glow (white or tinted), baked once and scaled with drawImage */
  const glowCache = {};
  function glowSprite(color) {
    const key = color || '#ffffff';
    let cv = glowCache[key];
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const [r, gg, b] = parseHex(key);
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache[key] = cv;
    }
    return cv;
  }

  /* Draws a glow of radius rad and opacity a (in the current transform) */
  function drawGlow(x, y, rad, color, a) {
    if (a <= 0.01 || rad <= 0.5) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * Math.min(1, a);
    ctx.drawImage(glowSprite(color), x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = prev;
  }

  /* ── Sky: gradient by time of day and season, stars, planets, sun, moon ── */

  const skyStars = [];
  for (let i = 0; i < 220; ++i)
    skyStars.push({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * TWO_PI });

  const MOUNTAINS = [0, 1, 2].map(k => {
    const pts = [];
    const rnd = mulberry32(99 + k * 31);
    const f = [rnd() * 3, rnd() * 3, rnd() * 3];
    for (let i = 0; i <= 256; ++i) {
      const x = i / 256 * TWO_PI;
      pts.push(Math.sin(x * 2 + f[0]) * 0.45 + Math.sin(x * 5 + f[1]) * 0.3 + Math.sin(x * 11 + f[2]) * 0.15 + (k === 0 ? Math.max(0, Math.sin(x * 3 + f[0])) * 0.5 : 0));
    }
    return pts;
  });

  function skyColors(n, d) {
    if (n === undefined) {
      n = nightAmount();
      d = duskAmount();
    }
    const season = currentSeason;
    let top = mixHex(['#3a7ae0', '#3a86e8', '#4a6ab8', '#7a9ad0'][season], '#070a1e', n);
    let mid = mixHex(['#8ad8e8', '#a8dcf0', '#e0a87a', '#c8dcef'][season], '#1a1840', n);
    let low = mixHex(['#c8f0d8', '#fff0b0', '#ffc890', '#f0f4ff'][season], '#2a2050', n);
    if (d > 0) {
      top = mixHex(top, '#4a3a8a', d * 0.6);
      mid = mixHex(mid, '#ff8a6a', d * 0.7);
      low = mixHex(low, '#ffc86a', d * 0.8);
    }
    return { top, mid, low, n, d };
  }

  /* World y of the horizon line (a few tiles above the field) */
  function horizonWorldY() {
    return GRID_OFFSET_Y - BASE_TILE_SIZE * 2.2;
  }

  /* The sky gradient, nebula, planets and mountains only change slowly, so
     they are baked into two screen-wide bitmaps (behind and in front of the
     sun and moon) and repainted when the light or the view changes */
  const skyLayers = { back: null, front: null, key: '' };

  function skyLayerCanvas(name, W, H) {
    let cv = skyLayers[name];
    if (!cv)
      cv = skyLayers[name] = document.createElement('canvas');
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    return cv;
  }

  function drawSky() {
    // the light is stepped in small increments so the layers are reused between steps
    const qn = Math.round(nightAmount() * 48) / 48, qd = Math.round(duskAmount() * 48) / 48;
    const sc = skyColors(qn, qd);
    const hy = viewPanY + horizonWorldY() * viewZoom;
    const R = Math.min(canvasW, canvasH) * 0.12;
    if (hy <= 0) {
      const g = ctx.createLinearGradient(0, Math.min(0, hy - canvasH), 0, Math.max(hy, 10));
      g.addColorStop(0, sc.top);
      g.addColorStop(0.65, sc.mid);
      g.addColorStop(1, sc.low);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvasW, Math.max(0, Math.min(canvasH, hy + 4)));
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const skyH = Math.max(1, Math.min(canvasH, Math.ceil(hy + 4)));
    const W = Math.round(canvasW * dpr), H = Math.round(skyH * dpr);
    const key = [W, H, dpr, qn, qd, currentSeason, viewZoom.toFixed(4), viewPanX.toFixed(1), viewPanY.toFixed(1)].join('|');
    const back = skyLayerCanvas('back', W, H), front = skyLayerCanvas('front', W, H);
    const gx = canvasW * 0.8 + viewPanX * 0.04, gy = Math.max(R * 0.75, hy - R * 1.6) + viewPanY * 0.02;
    if (key !== skyLayers.key) {
      skyLayers.key = key;
      let g = back.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, canvasW, skyH);
      const gr = g.createLinearGradient(0, Math.min(0, hy - canvasH), 0, Math.max(hy, 10));
      gr.addColorStop(0, sc.top);
      gr.addColorStop(0.65, sc.mid);
      gr.addColorStop(1, sc.low);
      g.fillStyle = gr;
      g.fillRect(0, 0, canvasW, Math.max(0, Math.min(canvasH, hy + 4)));
      if (sc.n > 0.05) {
        g.save();
        g.globalAlpha = sc.n * 0.25;
        const ng = g.createRadialGradient(canvasW * 0.3, hy * 0.35, 10, canvasW * 0.3, hy * 0.35, canvasW * 0.35);
        ng.addColorStop(0, '#a060d0');
        ng.addColorStop(1, 'rgba(160,96,208,0)');
        g.fillStyle = ng;
        g.fillRect(0, 0, canvasW, hy);
        g.restore();
      }
      // Ringed gas giant and a small moon, drifting with a hint of parallax
      g.save();
      g.globalAlpha = 0.55 + sc.n * 0.4;
      const pg = g.createRadialGradient(gx - R * 0.4, gy - R * 0.4, R * 0.1, gx, gy, R);
      pg.addColorStop(0, '#ffe0b0');
      pg.addColorStop(0.55, '#e08a6a');
      pg.addColorStop(1, '#6a3060');
      g.fillStyle = pg;
      g.beginPath();
      g.arc(gx, gy, R, 0, TWO_PI);
      g.fill();
      g.translate(gx, gy);
      g.rotate(-0.3);
      g.scale(1, 0.26);
      g.lineWidth = R * 0.22;
      g.strokeStyle = 'rgba(255,225,180,0.5)';
      g.beginPath();
      g.arc(0, 0, R * 1.6, Math.PI * 0.02, Math.PI * 0.98);
      g.stroke();
      g.restore();
      const mx = canvasW * 0.18 + viewPanX * 0.06, my = hy - R * 2.2 + viewPanY * 0.03;
      g.save();
      g.globalAlpha = 0.5 + sc.n * 0.5;
      g.fillStyle = '#c8d0e8';
      g.beginPath();
      g.arc(mx, my, R * 0.28, 0, TWO_PI);
      g.fill();
      g.fillStyle = 'rgba(120,130,170,0.6)';
      g.beginPath();
      g.arc(mx - R * 0.08, my - R * 0.06, R * 0.07, 0, TWO_PI);
      g.arc(mx + R * 0.1, my + R * 0.08, R * 0.05, 0, TWO_PI);
      g.fill();
      g.restore();

      g = front.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, canvasW, skyH);
      // Mountain layers with atmospheric perspective
      const layerCols = [
        mixHex(sc.mid, '#3a4a7a', 0.45 + sc.n * 0.2),
        mixHex(sc.mid, '#24405a', 0.65 + sc.n * 0.15),
        mixHex(SEASON_PAL[currentSeason].turf[0], '#0a1424', 0.25 + sc.n * 0.5)
      ];
      const heights = [1, 0.62, 0.3];
      const para = [0.15, 0.3, 0.55];
      for (let k = 0; k < 3; ++k) {
        const pts = MOUNTAINS[k];
        const period = 1600 * Math.max(0.5, viewZoom) * (1 + k * 0.3);
        const amp = Math.min(hy * 0.75, 160 * Math.max(0.5, Math.min(1.4, viewZoom))) * heights[k];
        const base = hy + 2 - k * 2;
        const off = ((viewPanX * para[k]) % period + period) % period;
        g.fillStyle = layerCols[k];
        g.beginPath();
        g.moveTo(0, base);
        for (let x = 0; x <= canvasW + 8; x += 8) {
          const u = ((x - off) / period % 1 + 1) % 1;
          const i = u * 256, i0 = Math.floor(i), fr = i - i0;
          const v = pts[i0] * (1 - fr) + pts[Math.min(256, i0 + 1)] * fr;
          g.lineTo(x, base - amp * (0.55 + v * 0.45));
        }
        g.lineTo(canvasW, base);
        g.closePath();
        g.fill();
        if (currentSeason === 3 && k < 2) {
          g.save();
          g.clip();
          g.fillStyle = 'rgba(240,246,255,0.55)';
          g.fillRect(0, base - amp * 1.1, canvasW, amp * 0.35);
          g.restore();
        }
      }
      // Summer haze / horizon glow
      const hz = g.createLinearGradient(0, hy - 60, 0, hy + 4);
      hz.addColorStop(0, 'rgba(255,255,255,0)');
      hz.addColorStop(1, currentSeason === 1 ? `rgba(255,236,180,${0.35 * (1 - sc.n)})` : `rgba(220,240,255,${0.18 * (1 - sc.n)})`);
      g.fillStyle = hz;
      g.fillRect(0, hy - 60, canvasW, 64);
    }
    ctx.drawImage(back, 0, 0, canvasW, skyH);

    // Stars at night (not in front of the planet)
    if (sc.n > 0.05) {
      ctx.save();
      for (const s of skyStars) {
        const sy = s.y * hy;
        if (sy > hy - 10) continue;
        const sx = ((s.x * canvasW + viewPanX * 0.03) % canvasW + canvasW) % canvasW;
        if ((sx - gx) * (sx - gx) + (sy - gy) * (sy - gy) < R * R * 1.1) continue;
        ctx.globalAlpha = sc.n * (0.3 + 0.7 * Math.abs(Math.sin(animT * (0.4 + s.s) + s.p)));
        ctx.fillStyle = s.s > 0.88 ? '#ffe8b0' : '#cfe0ff';
        const sz = s.s > 0.92 ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
      }
      ctx.restore();
    }

    // Sun by day, moon by night, travelling over the sky
    const arcX = (u) => canvasW * (0.1 + 0.8 * u);
    const arcY = (u) => hy - Math.sin(u * Math.PI) * Math.min(hy * 0.8, canvasH * 0.5) + 30;
    if (dayPhase < 0.55) {
      const u = dayPhase / 0.55;
      const sx = arcX(u), sy = arcY(u);
      const sr = Math.max(10, R * 0.32);
      drawGlow(sx, sy, sr * 4, '#fff0b4', 0.55 * (1 - sc.n));
      ctx.fillStyle = sc.d > 0.3 ? '#ffb070' : '#fff4c8';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TWO_PI);
      ctx.fill();
    } else {
      const u = (dayPhase - 0.5) / 0.5;
      const sx = arcX(u), sy = arcY(u);
      const sr = Math.max(8, R * 0.24);
      ctx.save();
      ctx.globalAlpha = Math.min(1, sc.n * 1.4);
      drawGlow(sx, sy, sr * 3.5, '#c8dcff', 0.35);
      ctx.fillStyle = '#eef2ff';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = sc.top;
      ctx.beginPath();
      ctx.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.85, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(front, 0, 0, canvasW, skyH);
  }

  /* ── Ground: meadow, decorations and the field's fence ── */

  function viewWorldRect() {
    return {
      x0: -viewPanX / viewZoom,
      y0: -viewPanY / viewZoom,
      x1: (canvasW - viewPanX) / viewZoom,
      y1: (canvasH - viewPanY) / viewZoom
    };
  }

  let groundCanvas = null, groundKey = '';

  /* The meadow only changes with the view and the season, so it is painted
     into a screen-sized bitmap and reused until one of them changes */
  function drawGround(v) {
    const hy = horizonWorldY();
    const top = Math.max(v.y0, hy);
    if (top >= v.y1) return;
    const key = [canvasW, canvasH, window.devicePixelRatio || 1, viewZoom.toFixed(4), viewPanX.toFixed(1), viewPanY.toFixed(1), currentSeason, gridRows, gridCols, gridColOffset, lowQuality].join('|');
    if (key !== groundKey || !groundCanvas) {
      if (!groundCanvas)
        groundCanvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(canvasW * dpr), H = Math.round(canvasH * dpr);
      if (groundCanvas.width !== W || groundCanvas.height !== H) {
        groundCanvas.width = W;
        groundCanvas.height = H;
      }
      const g = groundCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(viewPanX, viewPanY);
      g.scale(viewZoom, viewZoom);
      g.fillStyle = turfPattern(currentSeason);
      g.fillRect(v.x0 - 4, top, v.x1 - v.x0 + 8, v.y1 - top + 4);
      // soft shadow just below the horizon
      const sh = g.createLinearGradient(0, hy, 0, hy + 40);
      sh.addColorStop(0, 'rgba(10,20,30,0.45)');
      sh.addColorStop(1, 'rgba(10,20,30,0)');
      g.fillStyle = sh;
      g.fillRect(v.x0, hy, v.x1 - v.x0, 40);
      drawDecor(v, 'bake', g);
      groundKey = key;
    }
    // drawn in screen space, before the world transform
    ctx.drawImage(groundCanvas, 0, 0, canvasW, canvasH);
  }

  function isPenSlot(r, c) {
    for (const pen of livestockPens)
      if (pen.gridRow === r && pen.gridCol === c) return true;
    return false;
  }

  const SWAYING_DECOR = { tree: 1, reeds: 1, bloom: 1 };

  /* mode 'bake' paints shadows and still decorations into g (world units);
     mode 'live' draws the swaying ones and registers the glowing ones */
  function drawDecor(v, mode, g) {
    const T = BASE_TILE_SIZE;
    const c0 = Math.floor((v.x0 - GRID_OFFSET_X) / T) - 1, c1 = Math.ceil((v.x1 - GRID_OFFSET_X) / T) + 1;
    const r0 = Math.floor((Math.max(v.y0, horizonWorldY()) - GRID_OFFSET_Y) / T), r1 = Math.ceil((v.y1 - GRID_OFFSET_Y) / T) + 1;
    if ((c1 - c0) * (r1 - r0) > 6000) return;
    const offC = gridColOffset;
    const bake = mode === 'bake';
    const still = (kind) => !SWAYING_DECOR[kind] || lowQuality;
    if (bake)
      g.imageSmoothingEnabled = viewZoom < 0.5;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (r >= -1 && r <= gridRows && c >= -1 && c <= gridCols) continue;
        const h = hash2(c - offC, r);
        if (h > 0.2) continue;
        const kind = DECOR_KINDS[Math.floor(hash2(r + 7, c - offC + 3) * DECOR_KINDS.length)];
        const ox = (hash2(c - offC, r + 11) - 0.5) * T * 0.5, oy = (hash2(c - offC + 5, r) - 0.5) * T * 0.4;
        const x = GRID_OFFSET_X + (c + 0.5) * T + ox, y = GRID_OFFSET_Y + (r + 0.5) * T + oy;
        if (y - 30 < horizonWorldY()) continue;
        const big = kind === 'tree' ? 1.6 : 1;
        const size = T * 0.85 * big;
        const spr = decorSprite(kind, currentSeason);
        if (bake) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.beginPath();
          g.ellipse(x, y + size * 0.42, size * 0.35, size * 0.1, 0, 0, TWO_PI);
          g.fill();
          if (still(kind))
            g.drawImage(spr, x - size / 2, y + size * 0.5 - size, size, size);
          continue;
        }
        if (!still(kind)) {
          const sway = Math.sin(animT * 1.3 + h * 40) * 0.05 * windStrength();
          ctx.save();
          ctx.translate(x, y + size * 0.5);
          ctx.transform(1, 0, sway, 1, 0, 0);
          drawSprite(spr, 0, -size / 2, size);
          ctx.restore();
        }
        if (kind === 'shroom' || kind === 'crystal')
          lightAt(x, y, T * 0.9, kind === 'shroom' ? '#5ff0e0' : '#a8e8ff', 0.5);
      }
  }

  /* Wooden fence around the field with posts on every tile corner */
  function drawFieldFence() {
    const T = BASE_TILE_SIZE;
    const x0 = GRID_OFFSET_X - 3, y0 = GRID_OFFSET_Y - 3;
    const x1 = GRID_OFFSET_X + gridCols * T + 3, y1 = GRID_OFFSET_Y + gridRows * T + 3;
    const winter = currentSeason === 3;
    ctx.save();
    // dark border so the field reads as one plot of land
    ctx.fillStyle = 'rgba(30,18,10,0.55)';
    ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, 4);
    ctx.fillRect(x0 - 4, y1, x1 - x0 + 8, 6);
    ctx.fillRect(x0 - 4, y0, 4, y1 - y0);
    ctx.fillRect(x1, y0, 4, y1 - y0);
    const rail = (ax, ay, bx, by) => {
      ctx.fillStyle = '#5e3820';
      if (ay === by) {
        ctx.fillRect(ax, ay - 7, bx - ax, 3);
        ctx.fillRect(ax, ay - 2, bx - ax, 3);
        ctx.fillStyle = '#9a5b34';
        ctx.fillRect(ax, ay - 7, bx - ax, 1);
        ctx.fillRect(ax, ay - 2, bx - ax, 1);
      } else {
        ctx.fillRect(ax - 2, ay, 3, by - ay);
        ctx.fillStyle = '#9a5b34';
        ctx.fillRect(ax - 2, ay, 1, by - ay);
      }
    };
    rail(x0, y0, x1, y0);
    rail(x0, y1, x1, y1);
    rail(x0, y0, x0, y1);
    rail(x1, y0, x1, y1);
    const post = (px, py) => {
      ctx.fillStyle = '#4a2a16';
      ctx.fillRect(px - 3, py - 10, 6, 12);
      ctx.fillStyle = '#b07a4a';
      ctx.fillRect(px - 3, py - 10, 2, 12);
      if (winter) {
        ctx.fillStyle = '#f4f8ff';
        ctx.fillRect(px - 3, py - 12, 6, 3);
      }
    };
    for (let c = 0; c <= gridCols; ++c) {
      post(GRID_OFFSET_X + c * T, y0);
      post(GRID_OFFSET_X + c * T, y1);
    }
    for (let r = 1; r < gridRows; ++r) {
      post(x0, GRID_OFFSET_Y + r * T);
      post(x1, GRID_OFFSET_Y + r * T);
    }
    ctx.restore();
  }

  /* ── Field tiles ── */

  function drawTiles(v) {
    const T = BASE_TILE_SIZE;
    const F = getField();
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T)), c1 = Math.min(gridCols - 1, Math.floor((v.x1 - GRID_OFFSET_X) / T));
    const r0 = Math.max(0, Math.floor((v.y0 - GRID_OFFSET_Y) / T)), r1 = Math.min(gridRows - 1, Math.floor((v.y1 - GRID_OFFSET_Y) / T));
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = viewZoom < 0.5;
    const waterFrame = Math.floor(animT * 2.5) % 4;
    const rainWet = weatherType === WEATHER_RAIN || weatherType === WEATHER_THUNDERSTORM;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        const variant = Math.floor(hash2(c - gridColOffset, r) * 4);
        let flags = 0;
        if (tt === TILE_WATER)
          flags = waterFrame;
        else if (tt === TILE_FARMLAND) {
          if (F.wet[r * gridCols + c] || rainWet) flags |= 1;
          if (hoedTiles[r][c]) flags |= 2;
        }
        ctx.drawImage(tileTexture(tt, variant, currentSeason, flags), x, y, T, T);
      }
    ctx.imageSmoothingEnabled = smooth;

    // Shorelines, plot seams and soil quality tint
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        if (tt === TILE_WATER) {
          const foam = currentSeason === 3 ? 'rgba(255,255,255,0.7)' : `rgba(200,240,255,${0.55 + Math.sin(animT * 3 + r + c) * 0.2})`;
          ctx.fillStyle = foam;
          if (r > 0 && tileTypes[r - 1][c] !== TILE_WATER) ctx.fillRect(x, y, T, 3);
          if (r < gridRows - 1 && tileTypes[r + 1][c] !== TILE_WATER) ctx.fillRect(x, y + T - 3, T, 3);
          if (c > 0 && tileTypes[r][c - 1] !== TILE_WATER) ctx.fillRect(x, y, 3, T);
          if (c < gridCols - 1 && tileTypes[r][c + 1] !== TILE_WATER) ctx.fillRect(x + T - 3, y, 3, T);
          continue;
        }
        if (tt === TILE_FARMLAND || tt === TILE_SAND) {
          // poor soil looks pale and dusty, rich soil dark and green-flecked
          const q = getTileSoilQuality(r, c);
          if (q < 0.85) {
            ctx.fillStyle = `rgba(214,196,150,${Math.min(0.42, (0.85 - q) * 0.9)})`;
            ctx.fillRect(x, y, T, T);
          } else if (q > 1.0) {
            ctx.fillStyle = `rgba(20,40,14,${Math.min(0.35, (q - 1.0) * 0.7)})`;
            ctx.fillRect(x, y, T, T);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x + T - 1, y, 1, T);
        ctx.fillRect(x, y + T - 1, T, 1);
      }
  }

  /* ── Soil nutrients: pip bars on every plot, plus a heat-map overlay ── */

  let soilOverlay = false;           // toggled with N

  function showNutrients() {
    return soilOverlay || selectedTool === TOOL_HOE || (selectedTool === TOOL_PLANT && !dialog);
  }

  function nutrientColor(q) {
    return q < 0.65 ? '#ff6a5a' : (q < 0.9 ? '#ffc24a' : (q < 1.15 ? '#9be35a' : '#4fe08a'));
  }

  /* 5 pips: one per 30% of fertility */
  function nutrientPips(q) {
    return Math.max(1, Math.min(5, Math.round(q / 0.3)));
  }

  function drawNutrients(v) {
    if (!showNutrients()) return;
    const T = BASE_TILE_SIZE;
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T)), c1 = Math.min(gridCols - 1, Math.floor((v.x1 - GRID_OFFSET_X) / T));
    const r0 = Math.max(0, Math.floor((v.y0 - GRID_OFFSET_Y) / T)), r1 = Math.min(gridRows - 1, Math.floor((v.y1 - GRID_OFFSET_Y) / T));
    const full = soilOverlay || selectedTool === TOOL_HOE;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        if (tt === TILE_WATER) continue;
        if (tt === TILE_ROCK) {
          if (full) {
            ctx.fillStyle = 'rgba(40,40,52,0.35)';
            ctx.fillRect(x, y, T, T);
          }
          continue;
        }
        if (buildings[r][c]) continue;
        // seed mode marks the empty plots only, so ripe crops stay readable
        if (!full && farmGrid[r][c]) continue;
        const q = getTileSoilQuality(r, c);
        const col = nutrientColor(q);
        if (full) {
          ctx.fillStyle = hexToRgba(col, 0.2);
          ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        }
        const n = nutrientPips(q);
        const pw = 7, ph = 5, gap = 2, bx = x + 4, by = y + T - ph - 4;
        ctx.fillStyle = 'rgba(10,8,6,0.7)';
        ctx.fillRect(bx - 2, by - 2, 5 * (pw + gap) - gap + 4, ph + 4);
        for (let i = 0; i < 5; ++i) {
          ctx.fillStyle = i < n ? col : 'rgba(255,255,255,0.14)';
          ctx.fillRect(bx + i * (pw + gap), by, pw, ph);
        }
      }
  }

  /* ── Crops ── */

  function windStrength() {
    switch (weatherType) {
      case WEATHER_THUNDERSTORM: return 3;
      case WEATHER_RAIN: return 1.8;
      case WEATHER_METEOR_SHOWER: return 1.4;
      case WEATHER_DUST: return 2.6;
      case WEATHER_SNOW: return 1.3;
      default: return currentSeason === 2 ? 1.5 : 1;
    }
  }

  function youngFruitSprite(crop) {
    const key = 'bud:' + crop.sprite;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => {
        p.ell(7.5, 14, 6, 1.5, P.soil);
        p.line(7.5, 14, 7.5, 5, P.leaf);
        p.line(7.5, 11, 3, 8, P.leaf); p.line(7.5, 10, 12, 7, P.leaf);
        p.ell(3, 8, 2.5, 1.2, P.green); p.ell(12, 7, 2.5, 1.2, P.green);
        p.ell(6, 4, 2, 1, P.green); p.ell(10, 3.5, 2, 1, P.green);
        p.disc(7.5, 4, 2.2, shadeColor(crop.color, -0.15));
        p.disc(3.5, 11, 1.4, crop.color); p.disc(11.5, 10.5, 1.4, crop.color);
        p.px(7, 3, P.white, true);
      });
    return spriteCache[key];
  }

  function cropVisual(crop, cell) {
    const maxStage = crop.stages - 1;
    const st = Math.min(cell.growthStage, maxStage);
    if (st >= maxStage) return { spr: getSprite(crop.sprite), size: 46 };
    const within = Math.max(0, Math.min(1, cell.growthProgress * crop.stages - st));
    if (st === 0) return { spr: getSprite('sprout'), size: 26 + within * 8 };
    if (st === maxStage - 1 && maxStage >= 3) return { spr: youngFruitSprite(crop), size: 40 + within * 4 };
    return { spr: getYoungCropSprite(crop), size: 32 + (st / maxStage) * 8 + within * 4 };
  }

  function drawCrop(r, c, cell) {
    const T = BASE_TILE_SIZE;
    const crop = CROPS[cell.cropIndex];
    const mature = cell.growthStage >= crop.stages - 1;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, baseY = GRID_OFFSET_Y + (r + 1) * T - 7;
    const vis = cropVisual(crop, cell);
    const pop = cell.plantAnim > 0 ? 1 + Math.sin(cell.plantAnim * Math.PI) * 0.35 : 1;
    const ph = hash2(c * 3 + 1, r * 5 + 2) * TWO_PI;
    const shear = Math.sin(animT * 1.8 + ph + c * 0.4) * 0.06 * windStrength();
    const bob = mature ? Math.sin(animT * 2.4 + ph) * 0.6 : 0;
    const size = vis.size * pop;
    const sleeping = (crop.nightOnly && dayPhase < 0.5) || (crop.dayOnly && dayPhase >= 0.5);

    if (mature)
      drawGlow(cx, baseY - 14, T * 0.55, crop.color, 0.18 + Math.sin(animT * 3 + ph) * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, size * 0.32, size * 0.08, 0, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, baseY + bob);
    ctx.transform(1, 0, shear, 1, 0, 0);
    drawSprite(vis.spr, 0, -size / 2, size, sleeping ? 0.75 : 1);
    ctx.restore();
    if (currentSeason === 3) {
      ctx.fillStyle = 'rgba(240,248,255,0.55)';
      ctx.fillRect(cx - size * 0.25, baseY - size * 0.92, size * 0.5, 2);
    }
    if (sleeping) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(animT * 2 + ph) * 0.3;
      ctx.fillStyle = '#cfe0ff';
      ctx.font = uiFont(9, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText('z', cx + 12, baseY - size + 6 - (animT * 6 + ph) % 8);
      ctx.restore();
    }
    // Ripe sparkle
    if (mature) {
      const k = (animT * 0.9 + ph) % 1.6;
      if (k < 0.5) {
        const a = Math.sin(k / 0.5 * Math.PI);
        const sx = cx + (hash2(Math.floor(animT * 0.9 + ph), c) - 0.5) * T * 0.6;
        const sy = baseY - 10 - hash2(r, Math.floor(animT * 0.9 + ph)) * T * 0.6;
        drawTwinkle(sx, sy, 5 * a, a);
      }
      if (crop.name === 'Astral Flower' || crop.name === 'Lunar Moss' || crop.name === 'Solar Vine')
        lightAt(cx, baseY - 16, T * 0.9, crop.color, 0.7);
    }
    // Growth progress ring for growing crops
    if (!mature && viewZoom >= 0.55) {
      const prog = Math.min(1, cell.growthProgress);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx + T * 0.34, baseY - T + 16, 4, 0, TWO_PI);
      ctx.stroke();
      ctx.strokeStyle = '#9df08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + T * 0.34, baseY - T + 16, 4, -Math.PI / 2, -Math.PI / 2 + prog * TWO_PI);
      ctx.stroke();
    }
  }

  function drawTwinkle(x, y, s, a) {
    if (s < 0.5) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.25, y - s * 0.25);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.25, y + s * 0.25);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.25, y + s * 0.25);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.25, y - s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* Boulders on rock tiles: obstacles for crops, ground for buildings */
  function rockSprite(r, c) {
    const v = hash2(c - gridColOffset + 17, r + 3) < 0.5 ? 'rockpile' : 'rockpile2';
    const key = v + ':' + currentSeason;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => {
        SPRITE_PAINTERS[v](p, P);
        if (currentSeason === 3) {
          p.ell(6, 6, 3.5, 1.2, P.white, true);
          p.ell(10.5, 8.5, 2.5, 0.9, P.white, true);
        } else if (currentSeason < 2) {
          p.px(4, 12, P.leaf, true); p.px(12, 12, P.green, true);
        }
      });
    return spriteCache[key];
  }

  function drawRock(r, c) {
    const T = BASE_TILE_SIZE;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, baseY = GRID_OFFSET_Y + (r + 1) * T - 5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 2, T * 0.42, T * 0.12, 0, 0, TWO_PI);
    ctx.fill();
    drawSprite(rockSprite(r, c), cx, baseY - T * 0.42, T * 0.92);
  }

  /* ── Buildings with animated details ── */

  const BLADE_SPRITE_KEY = 'turbineBlades';
  SPRITE_PAINTERS[BLADE_SPRITE_KEY] = (p, P) => {
    p.poly([[8, 7.5], [7, 0], [9, 0]], P.white);
    p.poly([[8, 7.5], [15, 11], [14, 12.5]], P.white);
    p.poly([[8, 7.5], [1, 11], [2, 12.5]], P.white);
    p.disc(8, 7.5, 1.4, P.grey);
  };
  SPRITE_PAINTERS.turbineTower = (p, P) => {
    p.poly([[7, 6], [9, 6], [10.5, 15], [5.5, 15]], P.white);
    p.rect(6, 5, 4, 3, P.steel);
    p.rect(4, 14, 8, 2, P.dgrey);
  };

  function drawBuilding(r, c, bld) {
    const T = BASE_TILE_SIZE;
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, cy = GRID_OFFSET_Y + (r + 0.5) * T;
    const baseY = GRID_OFFSET_Y + (r + 1) * T - 6;
    const ph = hash2(c * 7, r * 3) * TWO_PI;
    const name = bdef.name;
    const night = nightAmount();

    if (name === 'Fence') {
      drawFenceTile(r, c, lvl);
      return;
    }
    // Stone pad
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 2, T * 0.42, T * 0.13, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = currentSeason === 3 ? '#c8d0dc' : '#7a7468';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 4, T * 0.38, T * 0.11, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 5, T * 0.3, T * 0.06, 0, Math.PI, TWO_PI);
    ctx.fill();

    const size = 44 + Math.min(lvl - 1, 5) * 1.2;
    const drop = buildingDrop(r, c);
    if (drop > 0 && drop < 1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, drop * 3);
      ctx.translate(0, -(1 - drop * drop) * 70);
    } else if (drop >= 1) {
      const sq = Math.sin((drop - 1) / 0.35 * Math.PI) * 0.12;
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(1 + sq, 1 - sq);
      ctx.translate(-cx, -baseY);
    }
    const top = baseY - 4 - size;
    if (name === 'Wind Turbine') {
      drawSprite('turbineTower', cx, top + size / 2, size);
      const speed = (1.2 + windStrength() * 1.4) * (dayPhase >= 0.5 ? 1.3 : 1);
      ctx.save();
      ctx.translate(cx, top + size * 0.34);
      ctx.rotate(animT * speed + ph);
      drawSprite(BLADE_SPRITE_KEY, 0, 0, size * 1.05);
      ctx.restore();
    } else if (name === 'Scarecrow') {
      ctx.save();
      ctx.translate(cx, baseY - 4);
      ctx.rotate(Math.sin(animT * 1.4 + ph) * 0.05 * windStrength());
      drawSprite(bdef.sprite, 0, -size / 2, size);
      ctx.restore();
    } else if (name === 'Harvester') {
      const bob = Math.abs(Math.sin(animT * 3 + ph)) * 2;
      drawSprite(bdef.sprite, cx, top + size / 2 - bob, size);
      ctx.fillStyle = `rgba(120,255,200,${0.6 + Math.sin(animT * 6) * 0.3})`;
      ctx.fillRect(cx - size * 0.16, top + size * 0.39 - bob, 3, 3);
      ctx.fillRect(cx + size * 0.09, top + size * 0.39 - bob, 3, 3);
      lightAt(cx, top + size * 0.4, T * 0.6, '#7affc8', 0.5);
    } else {
      drawSprite(bdef.sprite, cx, top + size / 2, size);
    }

    // Animated details
    switch (name) {
      case 'Sprinkler': {
        const n = 10;
        for (let i = 0; i < n; ++i) {
          const t = (animT * 0.9 + i / n) % 1;
          const ang = animT * 2.2 + i * (TWO_PI / n) + ph;
          const dist = t * T * (0.7 + Math.min(4, getBuildingRange(bld) - 1) * 0.12);
          const hgt = Math.sin(t * Math.PI) * 16;
          const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.5;
          ctx.fillStyle = `rgba(160,220,255,${0.85 * (1 - t)})`;
          ctx.fillRect(cx + dx - 1, top + size * 0.3 + dy - hgt + t * 14, 2, 3);
        }
        break;
      }
      case 'Solar Panel': {
        if (night < 0.5) {
          const k = (animT * 0.35 + ph) % 2;
          if (k < 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx - size * 0.45, top + size * 0.15, size * 0.9, size * 0.5);
            ctx.clip();
            const gx = cx - size * 0.6 + k * size * 1.2;
            const g = ctx.createLinearGradient(gx - 8, 0, gx + 8, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.65)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(gx - 10, top, 20, size);
            ctx.restore();
          }
        }
        break;
      }
      case 'Greenhouse':
        if (night > 0.2) {
          ctx.fillStyle = `rgba(200,255,190,${0.25 * night})`;
          ctx.fillRect(cx - size * 0.4, top + size * 0.35, size * 0.8, size * 0.55);
        }
        lightAt(cx, top + size * 0.6, T * 1.3, '#d0ffc0', 0.9);
        break;
      case 'Silo': {
        const blink = Math.sin(animT * 4 + ph) > 0.4;
        if (blink) {
          ctx.fillStyle = '#ff5a5a';
          ctx.fillRect(cx - 2, top + size * 0.12, 4, 4);
          lightAt(cx, top + size * 0.14, T * 0.5, '#ff6a5a', 0.5);
        }
        break;
      }
      case 'Compost Bin':
        for (let i = 0; i < 3; ++i) {
          const t = (animT * 0.4 + i / 3 + ph) % 1;
          ctx.fillStyle = `rgba(220,230,210,${0.35 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(cx + Math.sin(t * 6 + i) * 4, top + size * 0.15 - t * 22, 3 + t * 5, 0, TWO_PI);
          ctx.fill();
        }
        break;
      case 'Auto-Planter L1':
      case 'Auto-Planter L2': {
        const k = (animT * 1.5 + ph) % 2;
        if (k < 1) {
          ctx.fillStyle = '#c8a050';
          ctx.fillRect(cx - 2 + Math.sin(k * Math.PI) * 6, top + size * 0.2 - Math.sin(k * Math.PI) * 10, 3, 3);
        }
        break;
      }
      case 'Grow Lamp': {
        const n = nightAmount();
        if (n > 0.05)
          drawGlow(cx, top + size * 0.2, T * 1.2, '#ffeca0', 0.35 * n);
        lightAt(cx, top + size * 0.25, T * (1.6 + getBuildingRange(bld) * 0.8), '#ffe8a0', 1);
        break;
      }
      case 'Pest Zapper': {
        if (Math.sin(animT * 7 + ph) > 0.6) {
          ctx.strokeStyle = '#bff8ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, top + size * 0.15);
          for (let k = 1; k <= 3; ++k)
            ctx.lineTo(cx + (Math.random() - 0.5) * 16, top + size * 0.15 - k * 4);
          ctx.stroke();
        }
        lightAt(cx, top + size * 0.2, T * 0.8, '#9ff0ff', 0.7);
        break;
      }
      case 'Auto-Collector': {
        ctx.save();
        ctx.fillStyle = '#3a3e4a';
        ctx.fillRect(cx - size * 0.45, baseY - 12, size * 0.9, 6);
        ctx.fillStyle = '#7a7e8a';
        const off = (animT * 18) % 8;
        const bl = cx - size * 0.45, br = cx + size * 0.45;
        for (let x = bl - 8 + off; x < br; x += 8) {
          const x0 = Math.max(bl, x), x1 = Math.min(br, x + 3);
          if (x1 > x0)
            ctx.fillRect(x0, baseY - 12, x1 - x0, 6);
        }
        ctx.restore();
        break;
      }
    }

    if (drop > 0)
      ctx.restore();

    // Level pips
    if (lvl > 1) {
      const n = lvl - 1;
      const w = n * 6 - 2;
      for (let i = 0; i < n; ++i) {
        ctx.fillStyle = '#2a1a08';
        ctx.fillRect(cx - w / 2 + i * 6 - 1, baseY - 1, 6, 6);
        ctx.fillStyle = '#ffd75a';
        ctx.fillRect(cx - w / 2 + i * 6, baseY, 4, 4);
      }
    }
    if (inspect && inspect.row === r && inspect.col === c) {
      ctx.strokeStyle = `rgba(76,196,255,${0.6 + Math.sin(animT * 5) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(GRID_OFFSET_X + c * T + 2, GRID_OFFSET_Y + r * T + 2, T - 4, T - 4);
    }
  }

  function isFenceAt(r, c) {
    const b = buildings[r]?.[c];
    return !!b && BUILDINGS[b.typeIndex].name === 'Fence';
  }

  /* Fences join up with neighbouring fences */
  function drawFenceTile(r, c, lvl) {
    const T = BASE_TILE_SIZE;
    const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
    const cx = x + T / 2, cy = y + T / 2 + 6;
    const wood = lvl >= 5 ? '#8a8ea0' : '#9a5b34', dark = lvl >= 5 ? '#4a4e60' : '#5e3820', light = lvl >= 5 ? '#d0d8e8' : '#c88a54';
    const railTo = (tx, ty) => {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(tx, ty - 9);
      ctx.lineTo(tx, ty - 6);
      ctx.lineTo(cx, cy - 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2);
      ctx.lineTo(tx, ty - 2);
      ctx.lineTo(tx, ty + 1);
      ctx.lineTo(cx, cy + 1);
      ctx.fill();
    };
    const n = isFenceAt(r - 1, c), s = isFenceAt(r + 1, c), w = isFenceAt(r, c - 1), e = isFenceAt(r, c + 1);
    if (w || (!n && !s && !e)) railTo(x, cy);
    if (e || (!n && !s && !w)) railTo(x + T, cy);
    if (n) railTo(cx, y + 6);
    if (s) railTo(cx, y + T + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 7, 3, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 4, cy - 16, 8, 20);
    ctx.fillStyle = wood;
    ctx.fillRect(cx - 3, cy - 15, 6, 18);
    ctx.fillStyle = light;
    ctx.fillRect(cx - 3, cy - 15, 2, 18);
    if (currentSeason === 3) {
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(cx - 4, cy - 18, 8, 3);
    }
    if (lvl >= 5 && Math.sin(animT * 9 + r + c) > 0.85) {
      ctx.strokeStyle = '#9ff0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx + 5, cy - 10);
      ctx.lineTo(cx - 2, cy - 6);
      ctx.lineTo(cx + 4, cy);
      ctx.stroke();
      lightAt(cx, cy - 8, T * 0.5, '#9ff0ff', 0.6);
    }
  }

  /* ── Livestock pens with wandering animals ── */

  const penAnim = new WeakMap();

  function animalState(pen) {
    let a = penAnim.get(pen);
    if (!a) {
      a = { x: (Math.random() - 0.5) * 0.3, dir: Math.random() < 0.5 ? -1 : 1, mode: 'idle', t: Math.random() * 2, hop: 0 };
      penAnim.set(pen, a);
    }
    return a;
  }

  function updatePenAnimals(dt) {
    for (const pen of livestockPens) {
      const a = animalState(pen);
      a.t -= dt;
      if (a.t <= 0) {
        const roll = Math.random();
        a.mode = roll < 0.45 ? 'walk' : (roll < 0.75 ? 'idle' : 'eat');
        a.t = 1 + Math.random() * 2.5;
        if (a.mode === 'walk' && Math.random() < 0.5)
          a.dir = -a.dir;
      }
      if (a.mode === 'walk') {
        a.x += a.dir * dt * 0.12;
        if (a.x > 0.22) { a.x = 0.22; a.dir = -1; }
        if (a.x < -0.22) { a.x = -0.22; a.dir = 1; }
      }
      a.hop = Math.max(0, a.hop - dt * 4);
    }
  }

  function drawPen(pen) {
    const T = BASE_TILE_SIZE;
    const def = LIVESTOCK[pen.typeIndex];
    const x = GRID_OFFSET_X + pen.gridCol * T, y = GRID_OFFSET_Y + pen.gridRow * T;
    const cx = x + T / 2, cy = y + T / 2;
    const winter = currentSeason === 3;
    // paddock floor
    ctx.fillStyle = winter ? '#d8e2ee' : '#8aa848';
    ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
    ctx.fillStyle = winter ? '#eef4fc' : '#d8b860';
    ctx.fillRect(x + 6, y + T - 14, 14, 6);
    ctx.fillStyle = winter ? '#c8d4e4' : '#c09a40';
    ctx.fillRect(x + 6, y + T - 10, 14, 2);
    // trough
    ctx.fillStyle = '#5e3820';
    ctx.fillRect(x + T - 20, y + T - 15, 14, 7);
    ctx.fillStyle = winter ? '#bfe0f0' : '#4a8ad8';
    ctx.fillRect(x + T - 18, y + T - 14, 10, 3);
    // posts and rails
    ctx.fillStyle = '#6e4228';
    ctx.fillRect(x + 2, y + 6, T - 4, 2);
    ctx.fillRect(x + 2, y + T - 4, T - 4, 2);
    ctx.fillRect(x + 2, y + 6, 2, T - 10);
    ctx.fillRect(x + T - 4, y + 6, 2, T - 10);
    ctx.fillStyle = '#4a2a16';
    for (const [px, py] of [[x + 1, y + 2], [x + T - 5, y + 2], [x + 1, y + T - 8], [x + T - 5, y + T - 8]])
      ctx.fillRect(px, py, 4, 8);

    const a = animalState(pen);
    const walking = a.mode === 'walk';
    const ax = cx + a.x * T;
    const bob = walking ? Math.abs(Math.sin(animT * 9 + pen.gridCol)) * 2.5 : (a.mode === 'idle' ? Math.sin(animT * 2) * 0.6 : 0);
    const size = 36;
    const baseY = cy + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ax, baseY, size * 0.3, 3, 0, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(ax, baseY - bob - a.hop * 6);
    // sprites face left; flip when walking right
    ctx.scale(a.dir > 0 ? -1 : 1, 1);
    if (a.mode === 'eat')
      ctx.rotate(-Math.abs(Math.sin(animT * 5)) * 0.12);
    drawSprite(def.sprite, 0, -size / 2, size);
    ctx.restore();
    if (def.sprite === 'bee')
      for (let k = 0; k < 4; ++k) {
        const ang = animT * (2 + k * 0.4) + k * 1.7;
        const bx = cx + Math.cos(ang) * (12 + k * 3), by = cy - 6 + Math.sin(ang * 1.3) * (8 + k);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(bx - 1.5, by - 1, 3, 2);
        ctx.fillStyle = 'rgba(220,240,255,0.8)';
        ctx.fillRect(bx - 1, by - 3, 2, 2);
      }

    if (pen.produceReady) {
      const by = y - 2 + Math.sin(animT * 4 + pen.gridCol) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRectPath(cx - 11, by - 11, 22, 20, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 3, by + 9);
      ctx.lineTo(cx + 3, by + 9);
      ctx.lineTo(cx, by + 14);
      ctx.fill();
      drawSprite(def.produceSprite, cx, by - 1, 16);
      ctx.strokeStyle = `rgba(111,224,138,${0.5 + Math.sin(animT * 5) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
    } else {
      const prog = 1 - Math.max(0, pen.feedTimer / getFeedInterval(def));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 8, y + T - 6, T - 16, 3);
      ctx.fillStyle = '#9df08a';
      ctx.fillRect(x + 8, y + T - 6, (T - 16) * prog, 3);
    }
    lightAt(x + 4, y + 4, T * 0.5, '#ffc870', 0.45);
  }

  function drawZapArcs() {
    for (let i = zapArcs.length - 1; i >= 0; --i) {
      const z = zapArcs[i];
      z.t += frameDt;
      if (z.t > 0.3) {
        zapArcs.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(z.x0, z.y0);
      for (let k = 1; k < 6; ++k)
        ctx.lineTo(z.x0 + (z.x1 - z.x0) * k / 6 + (Math.random() - 0.5) * 14, z.y0 + (z.y1 - z.y0) * k / 6 + (Math.random() - 0.5) * 14);
      ctx.lineTo(z.x1, z.y1);
      // soft halo as a wide faint stroke under the bright core
      ctx.strokeStyle = `rgba(159,240,255,${0.3 * (1 - z.t / 0.3)})`;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `rgba(190,248,255,${1 - z.t / 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Wild space mice ── */

  function drawMice() {
    const T = BASE_TILE_SIZE;
    for (const m of wildAnimals) {
      if (m.rx === undefined) {
        m.rx = m.x;
        m.ry = m.y;
        m.face = 1;
      }
      const k = Math.min(1, frameDt * 6);
      const dx = m.x - m.rx;
      if (Math.abs(dx) > 0.01) m.face = dx > 0 ? -1 : 1;
      m.rx += (m.x - m.rx) * k;
      m.ry += (m.y - m.ry) * k;
      const moving = Math.hypot(m.x - m.rx, m.y - m.ry) > 0.02;
      const cx = GRID_OFFSET_X + (m.rx + 0.5) * T, cy = GRID_OFFSET_Y + (m.ry + 0.5) * T;
      const hop = moving ? Math.abs(Math.sin(animT * 14 + m.x)) * 4 : 0;
      const ar = Math.round(m.y), ac = Math.round(m.x);
      let nearCrop = false;
      for (let dr = -1; dr <= 1 && !nearCrop; ++dr)
        for (let dc = -1; dc <= 1 && !nearCrop; ++dc)
          if (farmGrid[ar + dr]?.[ac + dc]) nearCrop = true;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 9, 3, 0, 0, TWO_PI);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cy + 10 - hop);
      ctx.scale(m.face, 1);
      drawSprite('mouse', 0, -12, 26);
      ctx.restore();
      if (nearCrop) {
        const a = 0.6 + Math.sin(animT * 8) * 0.3;
        ctx.fillStyle = `rgba(255,80,80,${a})`;
        ctx.font = uiFont(14, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, cy - 14 - hop);
      }
      if (moving && Math.random() < 0.08)
        particles.burst(cx, cy + 10, 1, { color: currentSeason === 3 ? '#ffffff' : '#c8b088', speed: 0.6, life: 0.4, size: 2 });
    }
  }

  /* ── Lighting: the night darkens the world, lamps and glowing things cut holes ── */

  let lightCanvas = null, lightCtx = null;
  let lowQuality = false;            // set by the frame-time monitor when frames get slow
  let lights = [];

  function lightAt(wx, wy, radius, color, strength) {
    lights.push({ wx, wy, radius, color, strength });
  }

  function drawLighting() {
    const n = nightAmount();
    const storm = weatherType === WEATHER_THUNDERSTORM ? 0.25 : (weatherType === WEATHER_RAIN ? 0.12 : 0);
    const dark = Math.min(0.62, n * 0.55 + storm);
    if (dark <= 0.01) {
      lights = [];
      return;
    }
    // the mask is smooth, so a quarter-size canvas is plenty
    const div = lowQuality ? 3 : 2;
    const W = Math.ceil(canvasW / div), H = Math.ceil(canvasH / div);
    if (!lightCanvas) {
      lightCanvas = document.createElement('canvas');
      lightCtx = lightCanvas.getContext('2d');
    }
    if (lightCanvas.width !== W || lightCanvas.height !== H) {
      lightCanvas.width = W;
      lightCanvas.height = H;
    }
    const L = lightCtx;
    const white = glowSprite('#ffffff');
    L.globalCompositeOperation = 'source-over';
    L.globalAlpha = 1;
    L.clearRect(0, 0, W, H);
    L.fillStyle = `rgba(8,12,40,${dark})`;
    L.fillRect(0, 0, W, H);
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const sx = (viewPanX + l.wx * viewZoom) / div, sy = (viewPanY + l.wy * viewZoom) / div;
      const rr = l.radius * viewZoom / div;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > W || sy - rr > H) continue;
      L.globalAlpha = Math.min(1, l.strength);
      L.drawImage(white, sx - rr, sy - rr, rr * 2, rr * 2);
    }
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-over';
    // the horizon sky is lit by its own colours
    const hy = (viewPanY + horizonWorldY() * viewZoom) / div;
    if (hy > 0)
      L.clearRect(0, 0, W, hy);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lightCanvas, 0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;
    // warm colour glow on top
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const sx = viewPanX + l.wx * viewZoom, sy = viewPanY + l.wy * viewZoom;
      const rr = l.radius * viewZoom * 0.8;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > canvasW || sy - rr > canvasH) continue;
      drawGlow(sx, sy, rr, l.color, 0.22 * dark * l.strength);
    }
    ctx.restore();
    lights = [];
  }

  /* ── Seasonal ambience: petals, fireflies, leaves, snow ── */

  const ambient = [];

  function updateAmbient(dt) {
    const season = currentSeason;
    const night = nightAmount();
    const want = Math.round((season === 1 ? Math.round(18 * night) + 6 : (season === 3 ? 70 : 26)) * (lowQuality ? 0.5 : 1));
    while (ambient.length < want)
      ambient.push(spawnAmbient(season, true));
    if (ambient.length > want)
      ambient.length = want;
    const wind = windStrength();
    for (let i = 0; i < ambient.length; ++i) {
      const a = ambient[i];
      if (a.season !== season) {
        ambient[i] = spawnAmbient(season, false);
        continue;
      }
      a.t += dt;
      a.x += (a.vx + Math.sin(a.t * a.wob + a.ph) * a.sway) * dt * (0.6 + wind * 0.4);
      a.y += a.vy * dt;
      if (a.kind === 'firefly') {
        a.x += Math.sin(a.t * 1.3 + a.ph) * 8 * dt;
        a.y += Math.cos(a.t * 1.7 + a.ph) * 8 * dt;
      }
      if (a.y > canvasH + 10 || a.x < -20 || a.x > canvasW + 20 || a.t > a.life)
        ambient[i] = spawnAmbient(season, false);
    }
  }

  function spawnAmbient(season, anywhere) {
    const kinds = ['petal', 'firefly', 'leaf', 'snow'];
    const kind = season === 1 ? (Math.random() < 0.7 ? 'firefly' : 'mote') : kinds[season];
    const a = {
      kind, season, t: 0, ph: Math.random() * TWO_PI, wob: 1 + Math.random() * 2,
      x: Math.random() * canvasW, y: anywhere ? Math.random() * canvasH : -10,
      vx: 10 + Math.random() * 20, vy: 14 + Math.random() * 18, sway: 20 + Math.random() * 20,
      life: 30, size: 2 + Math.random() * 2, spin: Math.random() * TWO_PI
    };
    if (kind === 'firefly' || kind === 'mote') {
      a.vx = (Math.random() - 0.5) * 6;
      a.vy = (Math.random() - 0.5) * 4;
      a.y = Math.random() * canvasH;
      a.life = 6 + Math.random() * 6;
      a.sway = 4;
    } else if (kind === 'snow') {
      a.vx = -8 + Math.random() * 10;
      a.vy = 18 + Math.random() * 26;
      a.size = 1.5 + Math.random() * 2;
    } else if (kind === 'leaf') {
      a.colour = ['#ff7a2a', '#e23b3b', '#ffb648', '#c87a2a'][Math.floor(Math.random() * 4)];
    } else
      a.colour = ['#ffb0d8', '#ffffff', '#e0b0ff'][Math.floor(Math.random() * 3)];
    return a;
  }

  function drawAmbient() {
    const night = nightAmount();
    ctx.save();
    for (const a of ambient) {
      const fade = Math.min(1, a.t * 2, (a.life - a.t) * 2);
      if (a.kind === 'firefly') {
        const blink = 0.5 + 0.5 * Math.sin(a.t * 3 + a.ph);
        ctx.globalAlpha = night * fade * blink * 0.9;
        ctx.drawImage(glowSprite('#e6ff78'), a.x - 7, a.y - 7, 14, 14);
      } else if (a.kind === 'mote') {
        ctx.globalAlpha = (1 - night) * fade * 0.5;
        ctx.fillStyle = '#fff4c0';
        ctx.fillRect(a.x, a.y, 2, 2);
      } else if (a.kind === 'snow') {
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = a.colour;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.spin + a.t * 2);
        ctx.scale(1, Math.abs(Math.sin(a.t * 3 + a.ph)) * 0.7 + 0.3);
        ctx.fillRect(-a.size, -a.size * 0.6, a.size * 2, a.size * 1.2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /* ── Field cache: building effects per tile, rebuilt when anything changes ── */

  let buildVersion = 0;
  let penVersion = 0;
  let fieldCache = null, fieldKey = '';

  function getField() {
    const key = gridRows + 'x' + gridCols + ':' + buildVersion + ':' + penVersion + ':' + livestockPens.length;
    if (fieldCache && fieldKey === key) return fieldCache;
    const n = gridRows * gridCols;
    const f = {
      sprinkler: new Float32Array(n), wind: new Float32Array(n), green: new Float32Array(n),
      compost: new Float32Array(n), shelter: new Uint8Array(n), wet: new Uint8Array(n),
      lamp: new Float32Array(n), bees: new Float32Array(n)
    };
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const name = BUILDINGS[bld.typeIndex].name;
        const range = getBuildingRange(bld);
        if (!range) continue;
        for (let rr = Math.max(0, r - range); rr <= Math.min(gridRows - 1, r + range); ++rr)
          for (let cc = Math.max(0, c - range); cc <= Math.min(gridCols - 1, c + range); ++cc) {
            if (rr === r && cc === c) continue;
            const i = rr * gridCols + cc;
            if (name === 'Sprinkler') {
              f.sprinkler[i] += getSprinklerBonus(bld);
              f.wet[i] = 1;
            } else if (name === 'Wind Turbine')
              f.wind[i] += getWindTurbineGrowthBonus(bld);
            else if (name === 'Greenhouse') {
              f.green[i] += getGreenhouseGrowthBonus(bld);
              f.shelter[i] = 1;
            } else if (name === 'Compost Bin')
              f.compost[i] += getCompostBinBonus(bld);
            else if (name === 'Grow Lamp')
              f.lamp[i] = Math.max(f.lamp[i], 0.15 + ((bld.level || 1) - 1) * 0.05);
          }
      }
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c)
        if (tileTypes[r][c] !== TILE_WATER && isAdjacentToWater(r, c))
          f.wet[r * gridCols + c] = 1;
    // star bee hives pollinate crops within two tiles
    for (const pen of livestockPens)
      if (LIVESTOCK[pen.typeIndex].sprite === 'bee')
        for (let r = Math.max(0, pen.gridRow - 2); r <= Math.min(gridRows - 1, pen.gridRow + 2); ++r)
          for (let c = Math.max(0, pen.gridCol - 2); c <= Math.min(gridCols - 1, pen.gridCol + 2); ++c)
            f.bees[r * gridCols + c] = 0.15;
    fieldCache = f;
    fieldKey = key;
    return f;
  }

  function invalidateField() {
    ++buildVersion;
  }

  /* ── World pass ── */

  function drawWorldScene() {
    const v = viewWorldRect();
    drawSky();
    drawAurora();
    drawGround(v);
    ctx.save();
    ctx.translate(viewPanX, viewPanY);
    ctx.scale(viewZoom, viewZoom);
    spriteScale = viewZoom * (window.devicePixelRatio || 1);
    drawDecor(v, 'live');
    drawTiles(v);
    drawNutrients(v);
    drawWeatherWorld();
    drawFieldFence();
    // Row by row so taller sprites overlap the row behind them
    const T = BASE_TILE_SIZE;
    const r0 = Math.max(-1, Math.floor((v.y0 - GRID_OFFSET_Y) / T) - 1), r1 = Math.min(gridRows, Math.ceil((v.y1 - GRID_OFFSET_Y) / T) + 1);
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T) - 1), c1 = Math.min(gridCols - 1, Math.ceil((v.x1 - GRID_OFFSET_X) / T) + 1);
    const pensByRow = {};
    for (const pen of livestockPens)
      (pensByRow[pen.gridRow] = pensByRow[pen.gridRow] || []).push(pen);
    for (let r = r0; r <= r1; ++r) {
      if (pensByRow[r])
        for (const pen of pensByRow[r]) drawPen(pen);
      if (r < 0 || r >= gridRows) continue;
      for (let c = c0; c <= c1; ++c) {
        const bld = buildings[r][c];
        if (bld)
          drawBuilding(r, c, bld);
        else if (tileTypes[r][c] === TILE_ROCK)
          drawRock(r, c);
        else if (farmGrid[r][c] && tileTypes[r][c] !== TILE_WATER)
          drawCrop(r, c, farmGrid[r][c]);
      }
    }
    drawMice();
    drawZapArcs();
    drawMeteorsWorld();
    particles.draw(ctx);
    ctx.restore();
    spriteScale = window.devicePixelRatio || 1;
    drawLighting();
    drawAmbient();
  }


  /* Screen-space weather on top of the farm */
  function drawWeatherOverlay() {
    const k = wxK;
    if (k > 0.01) {
      ctx.save();
      switch (wxShown) {
        case WEATHER_SOLAR_FLARE: {
          ctx.fillStyle = `rgba(255,200,60,${0.10 * k})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          const g = ctx.createRadialGradient(canvasW * 0.5, -60, 20, canvasW * 0.5, -60, canvasH);
          g.addColorStop(0, `rgba(255,240,140,${0.35 * k})`);
          g.addColorStop(1, 'rgba(255,220,100,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, canvasW, canvasH);
          for (const d of wxDrops) {
            const a = Math.min(1, d.t, d.life - d.t) * 0.7 * k;
            ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(d.t * 4 + d.ph));
            drawTwinkle(d.x, d.y, d.size * 1.6, 1);
          }
          break;
        }
        case WEATHER_RAIN:
        case WEATHER_THUNDERSTORM: {
          ctx.fillStyle = wxShown === WEATHER_RAIN ? `rgba(30,50,110,${0.16 * k})` : `rgba(15,15,40,${0.28 * k})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.strokeStyle = wxShown === WEATHER_RAIN ? `rgba(170,210,255,${0.55 * k})` : `rgba(190,200,255,${0.6 * k})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (const d of wxDrops) {
            const f = d.len / Math.hypot(d.vx, d.vy);
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.vx * f, d.y - d.vy * f);
          }
          ctx.stroke();
          break;
        }
        case WEATHER_SNOW: {
          ctx.fillStyle = `rgba(220,235,255,${0.12 * k})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
          for (const d of wxDrops) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, TWO_PI);
            ctx.fill();
          }
          break;
        }
        case WEATHER_DUST: {
          ctx.fillStyle = `rgba(190,140,80,${0.28 * k})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          const band = dustBand();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = k;
          for (let i = 0; i < 3; ++i) {
            const y = canvasH * (0.2 + i * 0.3) + Math.sin(animT * 0.7 + i) * 40;
            ctx.drawImage(band, 0, y - 60, canvasW, 120);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(230,190,130,${0.6 * k})`;
          for (const d of wxDrops)
            ctx.fillRect(d.x, d.y, d.size * 4, d.size * 0.8);
          break;
        }
        case WEATHER_METEOR_SHOWER:
          ctx.fillStyle = `rgba(120,30,20,${0.12 * k})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          break;
      }
      ctx.restore();
    }
    // lightning bolts and flash
    for (const b of bolts) {
      const a = 1 - b.t / 0.35;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(b.pts[0][0], b.pts[0][1]);
      for (const p of b.pts) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = `rgba(160,200,255,${0.25 * a})`;
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = `rgba(200,220,255,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    if (flashA > 0) {
      ctx.fillStyle = `rgba(230,240,255,${flashA * 0.5})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  function drawDragSelection() {
    if (!isDragging || !dragStartedOnGrid) return;

    const { r0, c0, r1, c1 } = getDragGridRect();
    const ts = BASE_TILE_SIZE * viewZoom;

    // Highlight individual tiles within the selection
    const hoeMode = selectedTool === TOOL_HOE;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = tileTypes[r]?.[c] ?? TILE_FARMLAND;
        const tx = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * viewZoom + viewPanX;
        const ty = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * viewZoom + viewPanY;

        if (hoeMode) {
          // Hoe drag: highlight water tiles (fertilize 8 neighbors) and sand (convert to soil)
          if (tt === TILE_WATER) {
            ctx.fillStyle = 'rgba(0,150,255,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt === TILE_SAND) {
            ctx.fillStyle = 'rgba(160,130,60,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt === TILE_ROCK && !buildings[r]?.[c]) {
            ctx.fillStyle = 'rgba(220,210,190,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt !== TILE_ROCK && !buildings[r]?.[c]) {
            ctx.fillStyle = 'rgba(80,200,60,0.15)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
          continue;
        }

        // Water and rock take no crops
        if (tt === TILE_WATER) continue;
        if (tt === TILE_ROCK) {
          ctx.fillStyle = 'rgba(255,60,60,0.22)';
          ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          continue;
        }
        // Skip tiles with buildings
        if (buildings[r]?.[c]) continue;

        const cell = farmGrid[r][c];

        if (cell === null) {
          ctx.fillStyle = 'rgba(0,200,0,0.2)';
          ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
        } else {
          const crop = CROPS[cell.cropIndex];
          if (cell.growthStage >= crop.stages - 1) {
            ctx.fillStyle = 'rgba(255,200,0,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else {
            ctx.fillStyle = 'rgba(255,50,50,0.12)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
        }
      }

    // Draw outer selection rectangle border
    const rx = (GRID_OFFSET_X + c0 * BASE_TILE_SIZE) * viewZoom + viewPanX;
    const ry = (GRID_OFFSET_Y + r0 * BASE_TILE_SIZE) * viewZoom + viewPanY;
    const rw = (c1 - c0 + 1) * ts;
    const rh = (r1 - r0 + 1) * ts;

    ctx.strokeStyle = 'rgba(0,255,128,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }



  /* ══════════════════════════════════════════════════════════════════
     JUICE — produce and coins fly to their counters, buildings drop in,
     celebrations burst confetti, sounds follow every action
     ══════════════════════════════════════════════════════════════════ */

  const uiParticles = new FarmParticles(400);
  const flyers = [];                 // { sprite, x0, y0, target, t, dur, size, arc, onArrive }
  let storagePulse = 0;
  const buildAnim = {};              // "r,c" -> uiTime of placement
  let harvestCombo = 0, harvestComboT = 0;

  function worldToUI(wx, wy) {
    return { x: (viewPanX + wx * viewZoom) / uiS, y: (viewPanY + wy * viewZoom) / uiS };
  }

  function creditsTarget() {
    const L = hudLayout();
    return { x: L.farm.x + 26, y: L.farm.y + 26 };
  }

  function storageTarget() {
    const L = hudLayout();
    return { x: L.farm.x + 20, y: L.farm.y + 63 };
  }

  function addFlyer(sprite, x0, y0, targetFn, opts) {
    opts = opts || {};
    if (flyers.length > (lowQuality ? 40 : 80)) return;
    flyers.push({
      sprite, x0, y0, target: targetFn, t: -(opts.delay || 0), dur: opts.dur || 0.75 + Math.random() * 0.2,
      size: opts.size || 22, arc: opts.arc !== undefined ? opts.arc : 60 + Math.random() * 50,
      spread: (Math.random() - 0.5) * 40, onArrive: opts.onArrive
    });
  }

  /* Harvested produce hops up from the tile and flies into storage */
  function flyProduce(sprite, wx, wy, count, small) {
    const p = worldToUI(wx, wy);
    for (let i = 0; i < Math.min(count, 4); ++i)
      addFlyer(sprite, p.x, p.y - 10, storageTarget, {
        delay: i * 0.08, size: small ? 16 : 24, arc: small ? 40 : 90,
        onArrive: () => {
          storagePulse = 1;
          SZ.GameAudio.play('blip', { pitch: 1.6 + Math.random() * 0.3, volume: 0.25 });
        }
      });
  }

  /* Coins from a point (UI units) into the credit counter */
  function flyCoins(n, ux, uy, opts) {
    opts = opts || {};
    for (let i = 0; i < n; ++i)
      addFlyer('coin', ux + (Math.random() - 0.5) * 24, uy + (Math.random() - 0.5) * 12, creditsTarget, {
        delay: i * (opts.stagger || 0.05), size: opts.size || 20, arc: 50 + Math.random() * 60,
        onArrive: () => {
          creditsPulse = 1;
          SZ.GameAudio.play('coin', { pitch: 0.9 + Math.random() * 0.3, volume: 0.35 });
        }
      });
  }

  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; --i) {
      const f = flyers[i];
      f.t += dt;
      if (f.t >= f.dur) {
        flyers.splice(i, 1);
        if (f.onArrive) f.onArrive();
      }
    }
    storagePulse = Math.max(0, storagePulse - dt * 3);
    harvestComboT -= dt;
    if (harvestComboT <= 0)
      harvestCombo = 0;
  }

  function drawFlyers() {
    for (const f of flyers) {
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const tg = f.target();
      const cx = (f.x0 + tg.x) / 2 + f.spread, cy = Math.min(f.y0, tg.y) - f.arc;
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * cx + e * e * tg.x;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * cy + e * e * tg.y;
      const pop = k < 0.15 ? 0.5 + k / 0.15 * 0.7 : 1.2 - (k - 0.15) * 0.45;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 4 + 0.3);
      drawGlow(x, y, f.size * pop * 0.8, '#ffe68c', 0.55);
      drawSprite(f.sprite, x, y, f.size * pop);
      ctx.restore();
    }
  }

  function celebrate(ux, uy, n) {
    uiParticles.confetti(ux, uy, n || 26, { speed: 5 });
  }

  /* Building drop-in: falls from above, squashes on landing, dust ring */
  function buildingDrop(r, c) {
    const k = r + ',' + c;
    if (buildAnim[k] === undefined) return 0;
    const t = (uiTime - buildAnim[k]) / 0.45;
    if (t >= 1.35) {
      delete buildAnim[k];
      return 0;
    }
    return t;
  }

  function dustRing(wx, wy, color) {
    for (let i = 0; i < 14; ++i) {
      const a = (i / 14) * TWO_PI;
      particles.trail(wx + Math.cos(a) * 10, wy + Math.sin(a) * 4, {
        vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 0.8 - 0.3, color: color || '#d8c8a8',
        life: 0.5 + Math.random() * 0.2, size: 3 + Math.random() * 2, decay: 0.035
      });
    }
  }

  /* Animal voices when produce is collected */
  const ANIMAL_VOICES = {
    cow: () => { SZ.GameAudio.sweep(230, 150, 0.32, 'sawtooth', 0.045); },
    hen: () => { SZ.GameAudio.sweep(900, 1300, 0.07, 'square', 0.035); SZ.GameAudio.sweep(1000, 1400, 0.07, 'square', 0.03, 0.09); },
    goat: () => { SZ.GameAudio.sweep(520, 380, 0.22, 'sawtooth', 0.04); SZ.GameAudio.sweep(500, 400, 0.18, 'sawtooth', 0.03, 0.2); },
    chick: () => { SZ.GameAudio.sweep(1700, 2200, 0.05, 'square', 0.03); SZ.GameAudio.sweep(1800, 2300, 0.05, 'square', 0.025, 0.08); },
    rabbit: () => { SZ.GameAudio.sweep(1200, 900, 0.06, 'triangle', 0.05); },
    bee: () => { SZ.GameAudio.sweep(210, 240, 0.4, 'sawtooth', 0.03); }
  };
  let lastVoice = 0;

  function animalVoice(sprite) {
    if (uiTime - lastVoice < 0.25) return;
    lastVoice = uiTime;
    const v = ANIMAL_VOICES[sprite];
    if (v) v();
  }

  function squeak() {
    SZ.GameAudio.sweep(2400, 3000, 0.04, 'square', 0.025);
    SZ.GameAudio.sweep(2600, 3200, 0.04, 'square', 0.02, 0.07);
  }

  /* Soft chimes at dawn and dusk */
  function dayChime(dawn) {
    const notes = dawn ? [523, 659, 784] : [659, 523, 392];
    notes.forEach((f, i) => SZ.GameAudio.tone(f, 0.5, 'sine', 0.035, i * 0.18));
  }

  /* ══════════════════════════════════════════════════════════════════
     TECH TREE — five branches of upgrades bought with credits and
     produce; unlocks crops, animals and buildings
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCH_ORDER = ['agri', 'husb', 'eng', 'sci', 'com'];
  const TREE_BRANCH_LABELS = { agri: 'AGRICULTURE', husb: 'HUSBANDRY', eng: 'ENGINEERING', sci: 'SCIENCE', com: 'COMMERCE' };
  const TREE_BRANCH_SHORT = { agri: 'Crops', husb: 'Animals', eng: 'Engineering', sci: 'Science', com: 'Commerce' };
  const TREE_BRANCH_COLORS = { agri: '#7ee06a', husb: '#ff9ac0', eng: '#4cc4ff', sci: '#c890ff', com: '#ffc94a' };
  const TREE_BRANCH_ICONS = { agri: 'growth', husb: 'paw', eng: 'hammer', sci: 'flask', com: 'coin' };
  const TREE_REGION_ROWS = [['agri', 'husb', 'com'], ['eng', 'sci']];
  const TREE_CARD_W = 200, TREE_CARD_H = 88;
  const TREE_GAP_X = 40, TREE_GAP_Y = 24;
  const TREE_REGION_PAD = 30, TREE_REGION_HEADER = 74, TREE_REGION_GAP = 90;
  const TREE_MIN_ZOOM = 0.18, TREE_MAX_ZOOM = 1.6;

  /* Crops, animals and buildings available from the first day */
  const START_CROPS = [0, 2, 3, 6];
  const START_ANIMALS = [1, 3];
  const START_BUILDINGS = [0, 3, 6, 7, 8];

  const TECH = [];
  function node(id, branch, name, icon, prereqs, cost, desc, extra) {
    const n = Object.assign({ id, branch, name, icon, prereqs, cost, desc, chain: null, tier: 0 }, extra || {});
    TECH.push(n);
    return n;
  }
  /* A chain of tiers "Name I..N" where every tier needs the one before */
  function chain(prefix, branch, name, icon, rootPrereqs, crs, items, desc) {
    for (let i = 0; i < crs.length; ++i) {
      const cost = Object.assign({ cr: crs[i] }, items[i] || {});
      node(prefix + (i + 1), branch, name, icon, i === 0 ? rootPrereqs : [prefix + i], cost, desc, { chain: prefix, tier: i + 1, tiers: crs.length });
    }
  }

  // Agriculture
  chain('agri_growth', 'agri', 'Growth Boost', 'growth', [], [50, 90, 160, 290, 520],
    [null, { 'Space Wheat': 6 }, { 'Lunar Lettuce': 10 }, { 'Cosmic Corn': 10 }, { 'Crystal Melon': 8 }], 'All crops grow 25% faster.');
  chain('agri_soil', 'agri', 'Rich Soil', 'flask', [], [100, 190, 360, 690, 1300],
    [{ 'Space Wheat': 5 }, { 'Nebula Berry': 8 }, { 'Solar Tomato': 10 }, { 'Star Fruit': 10 }, { 'Crystal Melon': 10 }], 'Every plot grows 15% faster and gains 15% fertility.');
  chain('agri_yield', 'agri', 'Bountiful Harvest', 'crate', [], [80, 160, 320, 640, 1280],
    [{ 'Lunar Lettuce': 6 }, { 'Solar Tomato': 8 }, { 'Nebula Berry': 12 }, { 'Cosmic Corn': 12 }, { 'Astral Flower': 6 }], '+20% chance to harvest a bonus crop.');
  node('agri_orchard', 'agri', 'Orchard Seeds', 'starfruit', [], { cr: 120, 'Space Wheat': 8 }, 'Unlocks Star Fruit and Cosmic Corn.', { unlock: { crops: [1, 4] } });
  node('agri_melon', 'agri', 'Crystal Hydroponics', 'melon', ['agri_orchard'], { cr: 300, 'Star Fruit': 8 }, 'Unlocks the Crystal Melon.', { unlock: { crops: [5] } });
  node('agri_seedbank', 'agri', 'Seed Bank', 'seedbag', ['agri_soil2'], { cr: 400, 'Cosmic Corn': 10 }, 'All seeds cost 20% less.');

  // Husbandry
  node('husb_goat', 'husb', 'Goat Herding', 'goat', [], { cr: 150, 'Egg': 6 }, 'Unlocks the Nebula Goat.', { unlock: { animals: [2] } });
  node('husb_cow', 'husb', 'Space Dairy', 'cow', ['husb_goat'], { cr: 260, 'Wool': 6 }, 'Unlocks the Space Cow.', { unlock: { animals: [0] } });
  node('husb_collector', 'husb', 'Auto-Collectors', 'collector', ['husb_cow'], { cr: 300, 'Milk': 6 }, 'Unlocks the Auto-Collector building.', { unlock: { buildings: [11] } });
  chain('husb_care', 'husb', 'Animal Care', 'paw', [], [100, 220, 480], [{ 'Feather': 6 }, { 'Egg': 10 }, { 'Wool': 10 }], 'Animals produce 12% faster.');
  chain('husb_premium', 'husb', 'Premium Produce', 'star', ['husb_care1'], [140, 300, 640], [{ 'Egg': 8 }, { 'Wool': 8 }, { 'Milk': 10 }], 'Animal produce sells for 15% more.');
  node('husb_happy', 'husb', 'Happy Herds', 'heart', ['husb_premium2'], { cr: 500, 'Milk': 12 }, '20% chance to collect double produce.');

  // Engineering
  node('eng_solar', 'eng', 'Solar Power', 'solarpanel', [], { cr: 150, 'Space Wheat': 10 }, 'Unlocks the Solar Panel.', { unlock: { buildings: [4] } });
  node('eng_wind', 'eng', 'Wind Power', 'turbine', ['eng_solar'], { cr: 250, 'Solar Tomato': 10 }, 'Unlocks the Wind Turbine.', { unlock: { buildings: [5] } });
  node('eng_greenhouse', 'eng', 'Greenhouses', 'greenhouse', ['eng_solar'], { cr: 220, 'Lunar Lettuce': 12 }, 'Unlocks the Greenhouse.', { unlock: { buildings: [2] } });
  node('eng_harvester', 'eng', 'Harvester Bots', 'harvester', ['eng_solar'], { cr: 200, 'Nebula Berry': 10 }, 'Unlocks the Harvester building.', { unlock: { buildings: [1] } });
  chain('eng_drones', 'eng', 'Harvest Drones', 'robot', ['eng_harvester'], [200, 600, 1800], [{ 'Cosmic Corn': 8 }, { 'Star Fruit': 12 }, { 'Crystal Melon': 12 }], 'Drones harvest ripe crops anywhere on the farm, faster with every tier.');
  node('eng_planter', 'eng', 'Auto-Planters', 'planter1', ['eng_harvester'], { cr: 260, 'Nebula Berry': 12 }, 'Unlocks the Auto-Planter.', { unlock: { buildings: [9] } });
  node('eng_planter2', 'eng', 'Market Planters', 'planter2', ['eng_planter'], { cr: 600, 'Star Fruit': 12 }, 'Unlocks the Auto-Planter L2 that plants the best-paying crop.', { unlock: { buildings: [10] } });
  chain('eng_irr', 'eng', 'Irrigation', 'drop', [], [140, 322, 741], [{ 'Lunar Lettuce': 6 }, { 'Solar Tomato': 10 }, { 'Cosmic Corn': 12 }], 'Weather damages 15% fewer crops.');
  chain('eng_grid', 'eng', 'Power Grid', 'bolt', ['eng_solar'], [180, 400, 900], [{ 'Space Wheat': 10 }, { 'Cosmic Corn': 10 }, { 'Crystal Melon': 10 }], '+25 max energy and +0.5 energy per second.');
  node('eng_builder', 'eng', 'Efficient Construction', 'hammer', ['eng_grid1'], { cr: 450, 'Solar Tomato': 15 }, 'Buildings and building upgrades cost 15% less.');
  node('eng_land', 'eng', 'Land Survey', 'map', [], { cr: 0 }, 'Adds a new strip of land to the farm (west, east, north, south in turn).', { repeat: true });

  // Science
  node('sci_forecast', 'sci', 'Weather Forecast', 'eye', [], { cr: 90, 'Lunar Lettuce': 5 }, 'Shows the coming weather and when it arrives.');
  chain('sci_shield', 'sci', 'Weather Shield', 'shield', [], [120, 300, 750], [{ 'Nebula Berry': 6 }, { 'Star Fruit': 8 }, { 'Plasma Pepper': 8 }], 'Weather damages 25% fewer crops.');
  node('sci_rain', 'sci', 'Rain Maker', 'rain', ['sci_forecast', 'sci_shield1'], { cr: 350, 'Lunar Lettuce': 15 }, 'Call a rain shower from the clock panel once a day.');
  node('sci_fungi', 'sci', 'Fungal Lab', 'mushroom', [], { cr: 180, 'Nebula Berry': 8 }, 'Unlocks the Void Mushroom.', { unlock: { crops: [7] } });
  node('sci_plasma', 'sci', 'Plasma Botany', 'pepper', ['sci_fungi'], { cr: 320, 'Void Mushroom': 8 }, 'Unlocks the Plasma Pepper.', { unlock: { crops: [8] } });
  node('sci_astral', 'sci', 'Astral Botany', 'flower', ['sci_plasma'], { cr: 520, 'Plasma Pepper': 8 }, 'Unlocks the Astral Flower.', { unlock: { crops: [9] } });
  node('sci_cycles', 'sci', 'Day & Night Genetics', 'moss', ['sci_astral'], { cr: 700, 'Astral Flower': 6 }, 'Unlocks Lunar Moss and the Solar Vine.', { unlock: { crops: [10, 11] } });
  chain('sci_repel', 'sci', 'Pest Repellent', 'mouse', [], [120, 360], [{ 'Solar Tomato': 6 }, { 'Void Mushroom': 8 }], 'Space mice show up 40% less often.');
  node('sci_frost', 'sci', 'Frost Hardiness', 'winter', ['sci_shield1'], { cr: 380, 'Lunar Lettuce': 15 }, 'Winter only slows crops by 20% and snowfall no longer slows them.');
  node('sci_meteor', 'sci', 'Meteor Harvesting', 'meteor', ['sci_shield2'], { cr: 600, 'Plasma Pepper': 10 }, 'Every meteor leaves stardust worth 8-17 credits.');

  // Commerce
  chain('com_market', 'com', 'Market Access', 'chart', [], [120, 240, 480, 960, 1920],
    [{ 'Space Wheat': 8 }, { 'Solar Tomato': 10 }, { 'Star Fruit': 10 }, { 'Crystal Melon': 8 }, { 'Astral Flower': 8 }], 'Everything sells for 10% more.');
  chain('com_storage', 'com', 'Warehousing', 'basket', [], [100, 250, 600], [{ 'Nebula Berry': 6 }, { 'Cosmic Corn': 10 }, { 'Milk': 8 }], '+40 storage space.');
  node('com_insight', 'com', 'Market Insight', 'scroll', ['com_market1'], { cr: 200, 'Lunar Lettuce': 10 }, 'See the next price change before it happens.');
  node('com_floor', 'com', 'Price Floor', 'coin', ['com_insight'], { cr: 450, 'Star Fruit': 10 }, 'Prices never fall below 80% of normal.');
  node('com_broker', 'com', 'Bulk Broker', 'market', ['com_market2'], { cr: 380, 'Cosmic Corn': 12 }, 'Selling 20 or more items at once pays 10% extra.');

  node('agri_kale', 'agri', 'Frost Kale', 'kale', ['agri_soil1'], { cr: 220, 'Lunar Lettuce': 12 }, 'Unlocks Frost Kale, which shrugs off winter and snow.', { unlock: { crops: [13] } });
  node('agri_pumpkin', 'agri', 'Comet Pumpkins', 'pumpkin', ['agri_orchard'], { cr: 350, 'Cosmic Corn': 10 }, 'Unlocks the Comet Pumpkin, an autumn giant.', { unlock: { crops: [12] } });
  node('husb_rabbit', 'husb', 'Moon Rabbits', 'rabbit', ['husb_goat'], { cr: 300, 'Feather': 12 }, 'Unlocks the Moon Rabbit.', { unlock: { animals: [4] } });
  node('husb_bees', 'husb', 'Star Bees', 'bee', ['husb_cow'], { cr: 520, 'Milk': 8 }, 'Unlocks Star Bees: honey, and crops near the hive grow 15% faster.', { unlock: { animals: [5] } });
  node('eng_lamp', 'eng', 'Grow Lamps', 'lamp', ['eng_grid1'], { cr: 300, 'Solar Tomato': 12 }, 'Unlocks the Grow Lamp.', { unlock: { buildings: [12] } });
  node('sci_zapper', 'sci', 'Pest Zapper', 'zapper', ['sci_repel1'], { cr: 340, 'Void Mushroom': 8 }, 'Unlocks the Pest Zapper.', { unlock: { buildings: [13] } });
  chain('com_orders', 'com', 'Trade Network', 'order', ['com_market1'], [150, 450], [{ 'Space Wheat': 10 }, { 'Star Fruit': 10 }], 'One more trader order can be open at a time.');

  const TECH_BY_ID = {};
  for (const n of TECH)
    TECH_BY_ID[n.id] = n;

  /* Upgrades of the old flat shop and the tree chain each one became */
  const LEGACY_CHAINS = { growSpeed: 'agri_growth', soilQuality: 'agri_soil', yieldMultiplier: 'agri_yield', weatherResist: 'sci_shield', irrigation: 'eng_irr', autoHarvest: 'eng_drones', marketAccess: 'com_market' };

  let techLevels = {};               // node id -> level (1 = owned; repeatable nodes count up)

  function techLevel(id) {
    return techLevels[id] || 0;
  }

  function techOwned(id) {
    return techLevel(id) >= 1;
  }

  function techChainCount(prefix) {
    let n = 0;
    for (let i = 1; TECH_BY_ID[prefix + i]; ++i)
      if (techOwned(prefix + i)) ++n;
    return n;
  }

  function isNodeDone(n) {
    return !n.repeat && techOwned(n.id);
  }

  function arePrereqsMet(n) {
    for (const p of n.prereqs)
      if (!techOwned(p)) return false;
    return true;
  }

  function nodeCost(n) {
    if (n.id === 'eng_land')
      return { cr: getNextExpansionTileCount() * 8 };
    return n.cost;
  }

  function canPay(cost) {
    for (const k in cost) {
      const need = cost[k] || 0;
      if (!need) continue;
      if (k === 'cr' ? credits < need : (inventory[k] || 0) < need)
        return false;
    }
    return true;
  }

  function treeNodeState(n) {
    if (isNodeDone(n)) return 'owned';
    if (!arePrereqsMet(n)) return 'locked';
    return canPay(nodeCost(n)) ? 'ready' : 'poor';
  }

  function unlockedByTech(kind, index) {
    for (const n of TECH)
      if (n.unlock && n.unlock[kind] && n.unlock[kind].includes(index))
        return n;
    return null;
  }

  function isCropUnlocked(i) {
    if (START_CROPS.includes(i)) return true;
    const n = unlockedByTech('crops', i);
    return !!n && techOwned(n.id);
  }

  function isAnimalUnlocked(i) {
    if (START_ANIMALS.includes(i)) return true;
    const n = unlockedByTech('animals', i);
    return !!n && techOwned(n.id);
  }

  function isBuildingUnlocked(i) {
    if (START_BUILDINGS.includes(i)) return true;
    const n = unlockedByTech('buildings', i);
    return !!n && techOwned(n.id);
  }

  function itemSprite(name) {
    if (name === 'cr') return 'coin';
    for (const c of CROPS)
      if (c.name === name) return c.sprite;
    for (const l of LIVESTOCK)
      if (l.produce === name) return l.produceSprite;
    return 'crate';
  }

  function purchaseTreeNode(n) {
    if (state !== STATE_PLAYING || isNodeDone(n) || !arePrereqsMet(n)) return false;
    const cost = nodeCost(n);
    if (!canPay(cost)) return false;
    const title = nodeTitle(n);
    for (const k in cost) {
      if (!cost[k]) continue;
      if (k === 'cr') credits -= cost[k];
      else {
        inventory[k] -= cost[k];
        if (inventory[k] <= 0) delete inventory[k];
      }
    }
    techLevels[n.id] = techLevel(n.id) + 1;
    if (n.id === 'eng_land') {
      ++stats.surveys;
      ++penVersion;
      expandGrid();
      relocateLivestockToPerimeter();
    }
    invalidateField();
    const names = [];
    if (n.unlock) {
      for (const i of n.unlock.crops || []) names.push(CROPS[i].name);
      for (const i of n.unlock.animals || []) names.push(LIVESTOCK[i].name);
      for (const i of n.unlock.buildings || []) names.push(BUILDINGS[i].name);
    }
    if (names.length) {
      announce('Unlocked: ' + names.join(' & '), title, TREE_BRANCH_COLORS[n.branch], n.icon);
      SZ.GameAudio.play('win', { volume: 0.7 });
    } else {
      announce(title, n.desc, TREE_BRANCH_COLORS[n.branch], n.icon);
      SZ.GameAudio.play('levelup');
    }
    ++techBoughtTotal;
    saveGame();
    return true;
  }
  let techBoughtTotal = 0;

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  }

  function nodeTitle(n) {
    if (n.repeat) return n.name + ' ' + (techLevel(n.id) + 1);
    return n.chain ? n.name + ' ' + toRoman(n.tier) : n.name;
  }

  /* ── Layout (ported from the Dome Keeper tree): depth columns, lanes, regions ── */

  let treeLayout = null;

  function computeTreeLayout() {
    if (treeLayout) return treeLayout.nodes;
    const nodes = [];
    const regions = {};
    const pitchX = TREE_CARD_W + TREE_GAP_X;
    const pitchY = TREE_CARD_H + TREE_GAP_Y;
    const grids = [];
    for (const branch of TREE_BRANCH_ORDER) {
      const bn = TECH.filter(n => n.branch === branch);
      const map = {};
      bn.forEach((n, i) => { map[n.id] = { n, i }; });
      const depth = {};
      const assign = (n) => {
        if (depth[n.id] !== undefined) return depth[n.id];
        let d = -1;
        for (const p of n.prereqs)
          if (map[p]) d = Math.max(d, assign(map[p].n));
        depth[n.id] = d + 1;
        return depth[n.id];
      };
      bn.forEach(assign);
      const order = bn.slice().sort((a, b) => depth[a.id] - depth[b.id] || map[a.id].i - map[b.id].i);
      const lanes = [], laneOf = {}, continued = {};
      for (const n of order) {
        const parents = n.prereqs.filter(p => map[p]).sort((a, b) => depth[b] - depth[a]);
        const cont = parents.find(p => !continued[p]);
        let lane;
        if (cont) {
          lane = laneOf[cont];
          continued[cont] = true;
          lane.ids.push(n.id);
        } else {
          lane = { ids: [n.id], parent: parents.length ? laneOf[parents[0]] : null, kids: [] };
          lanes.push(lane);
          if (lane.parent) lane.parent.kids.push(lane);
        }
        laneOf[n.id] = lane;
      }
      const ordered = [];
      const visit = (l) => { ordered.push(l); l.kids.forEach(visit); };
      lanes.filter(l => !l.parent).forEach(visit);
      const rowSpans = [];
      for (const l of ordered) {
        const ds = l.ids.map(id => depth[id]);
        const lo = Math.min(...ds), hi = Math.max(...ds);
        let r = l.parent ? l.parent.row + 1 : rowSpans.length;
        for (;; ++r) {
          rowSpans[r] = rowSpans[r] || [];
          if (rowSpans[r].every(([a, b]) => hi < a - 1 || lo > b + 1)) break;
        }
        rowSpans[r].push([lo, hi]);
        l.row = r;
      }
      let maxDepth = 0;
      for (const n of bn) maxDepth = Math.max(maxDepth, depth[n.id]);
      grids.push({ branch, bn, depth, laneOf, rows: rowSpans.length, cols: maxDepth + 1 });
    }
    const regionW = (g) => g.cols * pitchX - TREE_GAP_X + TREE_REGION_PAD * 2;
    const regionH = (g) => TREE_REGION_HEADER + g.rows * pitchY - TREE_GAP_Y + TREE_REGION_PAD;
    const gridOf = {};
    for (const g of grids) gridOf[g.branch] = g;
    const rowWidth = TREE_REGION_ROWS.map(row => row.reduce((w, b) => w + regionW(gridOf[b]), 0) + (row.length - 1) * TREE_REGION_GAP);
    const totalW = Math.max(...rowWidth);
    const placeOf = {};
    let rowY = 0;
    TREE_REGION_ROWS.forEach((row, ri) => {
      let x = (totalW - rowWidth[ri]) / 2, h = 0;
      for (const b of row) {
        placeOf[b] = { x, y: rowY };
        x += regionW(gridOf[b]) + TREE_REGION_GAP;
        h = Math.max(h, regionH(gridOf[b]));
      }
      rowY += h + TREE_REGION_GAP;
    });
    for (const g of grids) {
      const p = placeOf[g.branch];
      regions[g.branch] = { x: p.x, y: p.y, w: regionW(g), h: regionH(g), branch: g.branch };
      for (const n of g.bn)
        nodes.push({ node: n, branch: g.branch, w: TREE_CARD_W, h: TREE_CARD_H,
          x: p.x + TREE_REGION_PAD + g.depth[n.id] * pitchX,
          y: p.y + TREE_REGION_HEADER + g.laneOf[n.id].row * pitchY });
    }
    const byId = {};
    for (const ln of nodes) byId[ln.node.id] = ln;
    regions.all = { x: 0, y: 0, w: totalW, h: rowY - TREE_REGION_GAP };
    treeLayout = { nodes, byId, regions };
    return nodes;
  }

  /* ── Tree dialog state ── */

  let treeTab = 'all';
  const treeCam = { tx: 0, ty: 0, tz: 0.5, x: 0, y: 0, z: 0.5, init: false };
  let treeFocusId = null;
  let treeHoverId = null;
  let treePanning = null;            // { x, y, tx, ty, moved }
  const treeFlash = {};

  function treeView() {
    return { x: 0, y: 112, w: UW, h: UH - 112 - 50 };
  }

  function fitTreeView(tab, instant) {
    computeTreeLayout();
    const r = treeLayout.regions[tab] || treeLayout.regions.all;
    const V = treeView();
    const pad = 20;
    const z = Math.max(TREE_MIN_ZOOM, Math.min(1, (V.w - pad * 2) / r.w, (V.h - pad * 2) / r.h));
    treeCam.tz = z;
    treeCam.tx = V.x + V.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = V.y + V.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      treeCam.z = treeCam.tz;
      treeCam.x = treeCam.tx;
      treeCam.y = treeCam.ty;
    }
  }

  function setTreeTab(tab) {
    if (treeTab !== tab) {
      treeTab = tab;
      SZ.GameAudio.play('select', { volume: 0.6 });
      if (tab !== 'all' && treeFocusId && treeLayout.byId[treeFocusId].branch !== tab)
        treeFocusId = null;
    }
    fitTreeView(tab);
  }

  function openTree(focusId, tab) {
    if (state !== STATE_PLAYING) return;
    computeTreeLayout();
    openDialog('tree');
    const focus = focusId && treeLayout.byId[focusId];
    if (focus || tab) {
      treeTab = focus ? focus.branch : tab;
      fitTreeView(treeTab, true);
      if (focus) {
        const V = treeView();
        treeCam.tz = treeCam.z = Math.max(treeCam.z, 0.8);
        treeCam.tx = treeCam.x = V.x + V.w / 2 - (focus.x + focus.w / 2) * treeCam.z;
        treeCam.ty = treeCam.y = V.y + V.h / 2 - (focus.y + focus.h / 2) * treeCam.z;
        treeFocusId = focus.node.id;
      }
    } else if (!treeCam.init)
      fitTreeView(treeTab, true);
    treeCam.init = true;
  }

  function zoomTreeAt(ux, uy, factor) {
    const z = Math.max(TREE_MIN_ZOOM, Math.min(TREE_MAX_ZOOM, treeCam.tz * factor));
    const ratio = z / treeCam.tz;
    treeCam.tx = ux - (ux - treeCam.tx) * ratio;
    treeCam.ty = uy - (uy - treeCam.ty) * ratio;
    treeCam.tz = z;
  }

  function revealTreeNode(ln) {
    const V = treeView();
    const z = treeCam.tz, m = 40;
    const sx = treeCam.tx + ln.x * z, sy = treeCam.ty + ln.y * z, sw = ln.w * z, sh = ln.h * z;
    if (sx < V.x + m) treeCam.tx += V.x + m - sx;
    else if (sx + sw > V.x + V.w - m) treeCam.tx -= sx + sw - (V.x + V.w - m);
    if (sy < V.y + m) treeCam.ty += V.y + m - sy;
    else if (sy + sh > V.y + V.h - m) treeCam.ty -= sy + sh - (V.y + V.h - m);
  }

  function hitTreeNode(ux, uy) {
    const V = treeView();
    if (uy < V.y || uy > V.y + V.h) return null;
    const tx = (ux - treeCam.x) / treeCam.z, ty = (uy - treeCam.y) / treeCam.z;
    for (const ln of computeTreeLayout())
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h)
        return ln;
    return null;
  }

  function tryPurchaseTreeNode(n) {
    if (purchaseTreeNode(n)) {
      treeFlash[n.id] = uiTime;
      const ln = treeLayout && treeLayout.byId[n.id];
      if (ln && dialog === 'tree')
        celebrate(treeCam.x + (ln.x + ln.w / 2) * treeCam.z, treeCam.y + (ln.y + ln.h / 2) * treeCam.z, 24);
      return true;
    }
    SZ.GameAudio.play('error');
    return false;
  }

  /* Keyboard control of the tree; returns true when the key was used */
  function handleTreeKey(e) {
    const nodes = computeTreeLayout();
    const tabs = ['all'].concat(TREE_BRANCH_ORDER);
    const V = treeView();
    if (e.code === 'Tab') {
      const i = tabs.indexOf(treeTab);
      setTreeTab(tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
      return true;
    }
    if (/^Digit[1-6]$/.test(e.code)) {
      setTreeTab(tabs[parseInt(e.code.slice(5), 10) - 1]);
      return true;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      zoomTreeAt(V.x + V.w / 2, V.y + V.h / 2, 1.2);
      return true;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      zoomTreeAt(V.x + V.w / 2, V.y + V.h / 2, 1 / 1.2);
      return true;
    }
    if (e.code === 'Digit0' || e.code === 'Home') {
      fitTreeView(treeTab);
      return true;
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    const dir = dirs[e.code];
    const inTab = (ln) => treeTab === 'all' || ln.branch === treeTab;
    if (dir) {
      const cur = treeFocusId && treeLayout.byId[treeFocusId];
      if (!cur || !inTab(cur)) {
        const first = nodes.find(ln => inTab(ln) && treeNodeState(ln.node) === 'ready') || nodes.find(inTab);
        if (first) {
          treeFocusId = first.node.id;
          revealTreeNode(first);
        }
        return true;
      }
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bestScore = Infinity;
      for (const ln of nodes) {
        if (ln === cur || !inTab(ln)) continue;
        const dx = ln.x + ln.w / 2 - cx, dy = ln.y + ln.h / 2 - cy;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 1) continue;
        const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        const score = along + across * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = ln;
        }
      }
      if (best) {
        treeFocusId = best.node.id;
        revealTreeNode(best);
        SZ.GameAudio.play('click', { volume: 0.4 });
      }
      return true;
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && treeFocusId) {
      tryPurchaseTreeNode(treeLayout.byId[treeFocusId].node);
      return true;
    }
    return false;
  }

  /* ── Tree drawing ── */

  let treeNebula = null;

  let treeBackCanvas = null, treeBackKey = '';

  /* Gradient and drifting nebula, baked at screen size whenever the drift moves */
  function drawTreeBackground() {
    if (!treeNebula) {
      treeNebula = document.createElement('canvas');
      treeNebula.width = 700;
      treeNebula.height = 500;
      const n = treeNebula.getContext('2d');
      for (const [bx, by, br, col] of [[160, 140, 220, '60,160,90'], [520, 120, 180, '150,60,190'], [420, 380, 240, '30,130,170'], [120, 420, 160, '190,150,60']]) {
        const rg = n.createRadialGradient(bx, by, 0, bx, by, br);
        rg.addColorStop(0, `rgba(${col},0.22)`);
        rg.addColorStop(1, `rgba(${col},0)`);
        n.fillStyle = rg;
        n.fillRect(0, 0, 700, 500);
      }
      n.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 140; ++i) {
        const s = ((i * 7919) % 97) / 97;
        n.globalAlpha = 0.15 + s * 0.5;
        n.fillRect((i * 7307) % 700, (i * 5279) % 500, s > 0.8 ? 1.5 : 1, s > 0.8 ? 1.5 : 1);
      }
      n.globalAlpha = 1;
    }
    const ox = Math.round(((treeCam.x * 0.05) % 140) - 70), oy = Math.round(((treeCam.y * 0.05) % 100) - 50);
    const s = uiS * (window.devicePixelRatio || 1);
    const W = Math.round(UW * s), H = Math.round(UH * s);
    const key = [W, H, ox, oy].join('|');
    if (key !== treeBackKey || !treeBackCanvas) {
      treeBackKey = key;
      if (!treeBackCanvas)
        treeBackCanvas = document.createElement('canvas');
      if (treeBackCanvas.width !== W || treeBackCanvas.height !== H) {
        treeBackCanvas.width = W;
        treeBackCanvas.height = H;
      }
      const b = treeBackCanvas.getContext('2d');
      b.setTransform(s, 0, 0, s, 0, 0);
      const g = b.createLinearGradient(0, 0, 0, UH);
      g.addColorStop(0, '#0b0f1e');
      g.addColorStop(1, '#05060c');
      b.fillStyle = g;
      b.fillRect(0, 0, UW, UH);
      b.drawImage(treeNebula, ox - 70, oy - 50, UW + 140, UH + 100);
    }
    ctx.drawImage(treeBackCanvas, 0, 0, UW, UH);
    const V = treeView();
    const step = 64 * treeCam.z;
    if (step >= 10) {
      ctx.beginPath();
      const sx = ((treeCam.x % step) + step) % step, sy = ((treeCam.y % step) + step) % step;
      for (let x = sx; x < UW; x += step) {
        ctx.moveTo(Math.round(x) + 0.5, V.y);
        ctx.lineTo(Math.round(x) + 0.5, V.y + V.h);
      }
      for (let y = sy; y < UH; y += step) {
        if (y < V.y || y > V.y + V.h) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(UW, Math.round(y) + 0.5);
      }
      ctx.strokeStyle = 'rgba(110,200,150,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* Cost as "120 [coin] 8 [wheat]", red where you are short, shrunk to maxW */
  function drawCostRow(cost, x, y, maxW, px) {
    const parts = [];
    for (const k in cost)
      if ((cost[k] || 0) > 0)
        parts.push({ k, n: cost[k], ok: k === 'cr' ? credits >= cost[k] : (inventory[k] || 0) >= cost[k] });
    if (!parts.length) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText('Free', x, y + 1, maxW, px, { weight: 'bold', color: UI.good });
      return;
    }
    let size = px, total;
    for (;;) {
      ctx.font = uiFont(size, 'bold');
      total = 0;
      for (const p of parts)
        total += ctx.measureText(String(p.n)).width + size * 1.15 + size * 0.6;
      total -= size * 0.6;
      if (total <= maxW || size <= 8) break;
      --size;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x;
    for (const p of parts) {
      if (cx > x + maxW) break;
      ctx.fillStyle = p.ok ? '#d8f5dc' : '#ff8a8a';
      const label = String(p.n);
      ctx.fillText(label, cx, y + 1);
      cx += ctx.measureText(label).width + 2;
      drawSprite(itemSprite(p.k), cx + size * 0.55, y, size * 1.15, p.ok ? 1 : 0.6);
      cx += size * 1.15 + size * 0.6;
    }
  }

  function drawNodeFrame(x, y, w, h, color, st, highlight) {
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') ctx.fillStyle = hexToRgba(color, 0.26);
    else if (st === 'ready') ctx.fillStyle = highlight ? hexToRgba(color, 0.3) : hexToRgba(color, 0.16);
    else if (st === 'poor') ctx.fillStyle = highlight ? 'rgba(54,48,38,0.95)' : 'rgba(40,36,30,0.95)';
    else ctx.fillStyle = 'rgba(16,18,26,0.95)';
    ctx.fill();
    // gloss on the upper part (a rounded strip instead of a clip, which is costly)
    roundRectPath(x + 1, y + 1, w - 2, h * 0.45, 11);
    ctx.fillStyle = st === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
    } else if (st === 'ready') {
      ctx.lineWidth = 7 + Math.sin(uiTime * 4) * 2;
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
    } else if (st === 'poor') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,182,72,0.65)';
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(120,130,160,0.3)';
      ctx.setLineDash([6, 5]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTreeCard(ln, st, compact) {
    const n = ln.node;
    const { x, y, w, h } = ln;
    const color = TREE_BRANCH_COLORS[ln.branch];
    const hover = treeHoverId === n.id, focus = treeFocusId === n.id;
    const dim = st === 'locked';
    ctx.save();
    roundRectPath(x + 3, y + 5, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    drawNodeFrame(x, y, w, h, color, st, hover || focus);
    if (hover || focus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 15);
      if (focus) {
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(255,215,90,0.25)';
        ctx.stroke();
      }
      ctx.lineWidth = focus ? 3 : 2;
      ctx.strokeStyle = focus ? UI.gold : 'rgba(255,255,255,0.85)';
      ctx.stroke();
    }
    roundRectPath(x + 10, y + 10, 44, 44, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dim ? 'rgba(255,255,255,0.06)' : hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(n.icon, x + 32, y + 32, 34, dim ? 0.4 : 1);
    if (n.chain) {
      const k = n.tiers;
      const pw = Math.min(8, (40 - (k - 1) * 2) / k);
      let px = x + 32 - (k * pw + (k - 1) * 2) / 2;
      for (let i = 1; i <= k; ++i) {
        const owned = techOwned(n.chain + i);
        ctx.fillStyle = owned ? color : (i === n.tier ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.14)');
        ctx.fillRect(px, y + 62, pw, 6);
        if (i === n.tier) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, y + 70, pw, 2);
        }
        px += pw + 2;
      }
    } else if (n.unlock) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('UNLOCK', x + 32, y + 68, 50, 10, { weight: 'bold', color: dim ? UI.textMute : hexToRgba(color, 0.95), minPx: 7 });
    } else if (n.repeat) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Lv ' + techLevel(n.id), x + 32, y + 68, 50, 11, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 7 });
    }
    if (st === 'owned')
      drawSprite('check', x + w - 18, y + 18, 22);
    else if (st === 'locked')
      drawSprite('lock', x + w - 18, y + 18, 20, 0.7);
    const textX = x + 64;
    const textW = w - 64 - (st === 'owned' || st === 'locked' ? 32 : 10);
    const nameColor = dim ? '#6a7288' : (st === 'owned' ? '#ffffff' : UI.text);
    if (compact)
      drawTextBlock(nodeTitle(n), textX, y + 8, textW, h - 16, 24, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 14, lineGap: 1.1 });
    else {
      drawTextBlock(nodeTitle(n), textX, y + 7, textW, 44, 17, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 11, lineGap: 1.15 });
      if (st === 'owned') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText('Owned', textX, y + h - 18, w - 64 - 12, 14, { weight: 'bold', color });
      } else {
        ctx.save();
        if (dim) ctx.globalAlpha *= 0.55;
        drawCostRow(nodeCost(n), textX, y + h - 18, w - 64 - 12, 15);
        ctx.restore();
      }
    }
    const flash = treeFlash[n.id];
    if (flash !== undefined) {
      const t = (uiTime - flash) / 0.6;
      if (t >= 1) delete treeFlash[n.id];
      else {
        roundRectPath(x - t * 16, y - t * 16, w + t * 32, h + t * 32, 12 + t * 10);
        ctx.lineWidth = 4 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
        roundRectPath(x, y, w, h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Orthogonal connector with rounded corners through the channels between cards */
  function strokeTreeConnector(parent, child) {
    const px = parent.x + parent.w, py = parent.y + parent.h / 2;
    const cx = child.x, cy = child.y + child.h / 2;
    const x1 = px + TREE_GAP_X / 2, x2 = cx - TREE_GAP_X / 2;
    const pts = [[px, py]];
    if (Math.abs(py - cy) < 0.5)
      pts.push([cx, cy]);
    else if (Math.abs(x1 - x2) < 0.5)
      pts.push([x1, py], [x1, cy], [cx, cy]);
    else {
      const chY = cy > py ? child.y - TREE_GAP_Y / 2 : child.y + child.h + TREE_GAP_Y / 2;
      pts.push([x1, py], [x1, chY], [x2, chY], [x2, cy], [cx, cy]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; ++i)
      ctx.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 10);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
  }

  function drawTreeContent() {
    const V = treeView();
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    ctx.translate(treeCam.x, treeCam.y);
    ctx.scale(treeCam.z, treeCam.z);
    spriteScale = uiS * treeCam.z * (window.devicePixelRatio || 1);
    const viewL = (V.x - treeCam.x) / treeCam.z, viewT = (V.y - treeCam.y) / treeCam.z;
    const viewR = viewL + V.w / treeCam.z, viewB = viewT + V.h / treeCam.z;
    const compact = treeCam.z < 0.6;
    for (const branch of TREE_BRANCH_ORDER) {
      const r = treeLayout.regions[branch];
      if (r.x > viewR || r.x + r.w < viewL || r.y > viewB || r.y + r.h < viewT) continue;
      const color = TREE_BRANCH_COLORS[branch];
      roundRectPath(r.x, r.y, r.w, r.h, 22);
      ctx.fillStyle = hexToRgba(color, 0.045);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.stroke();
      let owned = 0, total = 0;
      for (const n of TECH)
        if (n.branch === branch && !n.repeat) {
          ++total;
          if (techOwned(n.id)) ++owned;
        }
      const headPx = compact ? Math.min(48, 20 / treeCam.z) : 30;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawSprite(TREE_BRANCH_ICONS[branch], r.x + TREE_REGION_PAD + headPx * 0.6, r.y + TREE_REGION_HEADER / 2, headPx * 1.2);
      const lx = r.x + TREE_REGION_PAD + headPx * 1.4;
      const labelW = fitText(TREE_BRANCH_LABELS[branch], lx, r.y + TREE_REGION_HEADER / 2, r.w * 0.55, headPx, { weight: 'bold', color });
      const mx = lx + labelW + 24;
      const mw = Math.min(260, r.x + r.w - TREE_REGION_PAD - mx - 90);
      if (mw > 40) {
        drawMeter(mx, r.y + TREE_REGION_HEADER / 2 - 6, mw, 12, owned / total, color);
        fitText(`${owned} / ${total}`, mx + mw + 12, r.y + TREE_REGION_HEADER / 2, 80, compact ? headPx * 0.6 : 18, { weight: 'bold', color: UI.textDim });
      }
    }
    const edges = [[], [], []];
    for (const ln of treeLayout.nodes)
      for (const pid of ln.node.prereqs) {
        const parent = treeLayout.byId[pid];
        if (!parent || parent.branch !== ln.branch) continue;
        const minX = Math.min(parent.x, ln.x) - TREE_GAP_X, maxX = Math.max(parent.x + parent.w, ln.x + ln.w) + TREE_GAP_X;
        const minY = Math.min(parent.y, ln.y) - TREE_GAP_Y, maxY = Math.max(parent.y + parent.h, ln.y + ln.h) + TREE_GAP_Y;
        if (minX > viewR || maxX < viewL || minY > viewB || maxY < viewT) continue;
        const pOwned = techOwned(pid);
        edges[pOwned ? (isNodeDone(ln.node) ? 2 : 1) : 0].push([parent, ln]);
      }
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 3; ++pass)
      for (const [parent, ln] of edges[pass]) {
        const color = TREE_BRANCH_COLORS[ln.branch];
        if (pass === 0) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(130,140,170,0.28)';
          ctx.setLineDash([7, 7]);
        } else if (pass === 1) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = hexToRgba(color, 0.7);
          ctx.setLineDash([]);
        } else {
          ctx.lineWidth = 4;
          ctx.strokeStyle = color;
          ctx.setLineDash([]);
        }
        strokeTreeConnector(parent, ln);
      }
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    for (const ln of treeLayout.nodes) {
      if (ln.x > viewR || ln.x + ln.w < viewL || ln.y > viewB || ln.y + ln.h < viewT) continue;
      drawTreeCard(ln, treeNodeState(ln.node), compact);
    }
    ctx.restore();
    spriteScale = uiS * (window.devicePixelRatio || 1);
  }

  function treeTabs() {
    const ids = ['all'].concat(TREE_BRANCH_ORDER);
    const gap = 8;
    const tabW = Math.min(180, Math.floor((UW - 40 - (ids.length - 1) * gap) / ids.length));
    const x0 = UW / 2 - (ids.length * tabW + (ids.length - 1) * gap) / 2;
    return ids.map((id, i) => ({ id, x: x0 + i * (tabW + gap), y: 62, w: tabW, h: 32 }));
  }

  function drawTreeDialog() {
    computeTreeLayout();
    dialogT = Math.min(1, dialogT + frameDt * 6);
    if (!treePanning) {
      const all = treeLayout.regions.all, V = treeView(), keep = 140;
      treeCam.tx = Math.min(V.x + V.w - keep - all.x * treeCam.tz, Math.max(V.x + keep - (all.x + all.w) * treeCam.tz, treeCam.tx));
      treeCam.ty = Math.min(V.y + V.h - keep - all.y * treeCam.tz, Math.max(V.y + keep - (all.y + all.h) * treeCam.tz, treeCam.ty));
      const k = 1 - Math.exp(-frameDt * 14);
      treeCam.z += (treeCam.tz - treeCam.z) * k;
      treeCam.x += (treeCam.tx - treeCam.x) * k;
      treeCam.y += (treeCam.ty - treeCam.y) * k;
    }
    const e = 1 - Math.pow(1 - dialogT, 3);
    addRegion({ id: 'tree-scrim', x: 0, y: 0, w: UW, h: UH, modal: true });
    ctx.save();
    ctx.globalAlpha *= e;
    drawTreeBackground();
    const V = treeView();
    addRegion({
      id: 'tree-view', x: V.x, y: V.y, w: V.w, h: V.h, modal: true,
      onWheel: (dy) => zoomTreeAt(pointerUX, pointerUY, dy < 0 ? 1.12 : 1 / 1.12),
      onDragStart: () => { treePanning = { x: pointerUX, y: pointerUY, tx: treeCam.x, ty: treeCam.y, moved: false }; },
      onDrag: () => {
        if (!treePanning) return;
        const dx = pointerUX - treePanning.x, dy = pointerUY - treePanning.y;
        if (Math.hypot(dx, dy) > 4) treePanning.moved = true;
        treeCam.x = treeCam.tx = treePanning.tx + dx;
        treeCam.y = treeCam.ty = treePanning.ty + dy;
        treeCam.tz = treeCam.z;
      },
      onDragEnd: (button) => {
        const moved = treePanning && treePanning.moved;
        treePanning = null;
        // a left click on a card buys it; right and middle buttons only pan
        if (!moved && !button) {
          const ln = hitTreeNode(pointerUX, pointerUY);
          if (ln) {
            treeFocusId = ln.node.id;
            tryPurchaseTreeNode(ln.node);
          }
        }
      },
      tipKey: () => { const ln = hitTreeNode(pointerUX, pointerUY); return ln ? 'tree:' + ln.node.id + ':' + treeNodeState(ln.node) + ':' + techLevel(ln.node.id) : 'tree:none'; },
      tip: () => { const ln = hitTreeNode(pointerUX, pointerUY); return ln ? buildTechTooltip(ln.node) : null; }
    });
    const hv = hitTreeNode(pointerUX, pointerUY);
    treeHoverId = hv && pointerInside ? hv.node.id : null;
    drawTreeContent();
    drawTreeHeader();
    ctx.restore();
  }

  function drawTreeHeader() {
    drawPanel(10, 6, UW - 20, 100, { accent: UI.gold, radius: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawSprite('techtree', 34, 32, 28);
    fitText('Tech Tree', 54, 32, 220, 24, { weight: 'bold', color: UI.gold });
    let owned = 0, total = 0;
    for (const n of TECH)
      if (!n.repeat) {
        ++total;
        if (techOwned(n.id)) ++owned;
      }
    const mw = Math.min(220, UW * 0.2);
    drawMeter(UW - 70 - mw, 26, mw, 12, owned / total, UI.gold);
    ctx.textAlign = 'right';
    fitText(`${owned} / ${total}`, UW - 80 - mw, 32, 90, 15, { weight: 'bold', color: UI.textDim });
    // credits and storage at a glance
    ctx.textAlign = 'left';
    const credX = 290;
    const credW = UW - 70 - mw - 90 - credX - 40;
    if (credW > 120)
      fitText(`[[coin]] ${Math.round(credits).toLocaleString('en-US')}   [[basket]] ${getTotalInventoryCount()} / ${getStorageCapacity()}`, credX, 32, credW, 15, { weight: 'bold', color: UI.text });
    drawCloseButton('tree-close', UW - 46, 18, 26, closeDialog);
    for (const t of treeTabs()) {
      const active = treeTab === t.id;
      const hover = pointerUX >= t.x && pointerUX <= t.x + t.w && pointerUY >= t.y && pointerUY <= t.y + t.h;
      const color = t.id === 'all' ? UI.gold : TREE_BRANCH_COLORS[t.id];
      roundRectPath(t.x, t.y, t.w, t.h, 9);
      ctx.fillStyle = active ? hexToRgba(color, 0.24) : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeStyle = active ? color : 'rgba(255,255,255,0.1)';
      ctx.stroke();
      let label = t.id === 'all' ? 'All' : TREE_BRANCH_SHORT[t.id];
      if (t.id !== 'all') {
        let o = 0, c = 0, ready = 0;
        for (const n of TECH)
          if (n.branch === t.id && !n.repeat) {
            ++c;
            if (techOwned(n.id)) ++o;
            else if (treeNodeState(n) === 'ready') ++ready;
          }
        label += `  ${o}/${c}`;
        if (ready)
          drawChip(String(ready), t.x + t.w - 4, t.y - 6, 16, { align: 'right', px: 10, bg: color, color: '#10141e' });
      }
      if (t.id === 'all')
        drawSprite('techtree', t.x + 18, t.y + t.h / 2, 16);
      else
        drawSprite(TREE_BRANCH_ICONS[t.id], t.x + 18, t.y + t.h / 2, 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, t.x + 32, t.y + t.h / 2 + 1, t.w - 40, 14, { weight: 'bold', color: active ? '#fff' : UI.textDim });
      addRegion({ id: 'tree-tab-' + t.id, x: t.x, y: t.y, w: t.w, h: t.h, modal: true, onClick: () => setTreeTab(t.id), tip: () => t.id === 'all' ? ['All branches', 'Shortcut: 1 or Tab'] : [`[[${TREE_BRANCH_ICONS[t.id]}]] ${TREE_BRANCH_LABELS[t.id].charAt(0) + TREE_BRANCH_LABELS[t.id].slice(1).toLowerCase()}`, ['Crops, soil and harvests', 'Animals and their produce', 'Buildings, energy, automation and land', 'Weather, pests and new crop species', 'Prices, storage and trade'][TREE_BRANCH_ORDER.indexOf(t.id)], 'Shortcut: Tab'] });
    }
    // Footer: legend and controls
    const fy = UH - 44;
    drawPanel(10, fy, UW - 20, 38, { radius: 12, shadow: 8, accent: '#6a8ac8' });
    let lx = 26;
    for (const [label, st] of [['Owned', 'owned'], ['Can buy', 'ready'], ['Need more', 'poor'], ['Locked', 'locked']]) {
      roundRectPath(lx, fy + 11, 24, 16, 5);
      ctx.fillStyle = st === 'owned' ? hexToRgba(UI.leaf, 0.35) : (st === 'ready' ? hexToRgba(UI.leaf, 0.18) : (st === 'poor' ? 'rgba(40,36,30,0.95)' : 'rgba(16,18,26,0.95)'));
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : (st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.leaf);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lx += 30 + fitText(label, lx + 30, fy + 20, 110, 13, { color: UI.textDim }) + 18;
    }
    drawKeyHints([
      { key: 'Wheel', label: 'Zoom' }, { key: 'Drag', label: 'Pan' }, { key: '←↑→↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' }, { key: 'Tab', label: 'Branch' }, { key: 'Esc', label: 'Close' }
    ], (lx + UW - 20) / 2, fy + 19, UW - 20 - lx - 16);
  }

  function buildTechTooltip(n) {
    const st = treeNodeState(n);
    const lines = [`[[${n.icon}]] ${nodeTitle(n)}`, n.desc];
    lines.push(`${TREE_BRANCH_LABELS[n.branch].charAt(0) + TREE_BRANCH_LABELS[n.branch].slice(1).toLowerCase()}` + (n.chain ? ` · tier ${n.tier} of ${n.tiers}` : '') + (n.repeat ? ` · level ${techLevel(n.id)}` : ''));
    if (st === 'owned') {
      lines.push('✔ Owned');
      return lines;
    }
    if (n.prereqs.length) {
      lines.push('--- Requires ---');
      for (const p of n.prereqs)
        lines.push((techOwned(p) ? '✔ ' : '✘ ') + nodeTitle(TECH_BY_ID[p]));
    }
    const cost = nodeCost(n);
    lines.push('--- Cost ---');
    for (const k in cost) {
      if (!cost[k]) continue;
      const have = k === 'cr' ? Math.floor(credits) : (inventory[k] || 0);
      lines.push((have >= cost[k] ? '✔ ' : '✘ ') + `[[${itemSprite(k)}]] ${k === 'cr' ? 'Credits' : k}: ${have} / ${cost[k]}`);
    }
    if (st === 'ready')
      lines.push('Click or Enter to buy');
    return lines;
  }

  /* ── "Next upgrades" quick panel: the best next node of every branch ── */

  let quickCollapsed = false;
  const quickFlash = {};

  function itemWeight(k) {
    if (k === 'cr') return 1;
    for (const c of CROPS)
      if (c.name === k) return c.sellPrice;
    for (const l of LIVESTOCK)
      if (l.produce === k) return l.produceValue;
    return 10;
  }

  function getQuickPicks() {
    const picks = [];
    for (const branch of TREE_BRANCH_ORDER) {
      let best = null, bestScore = Infinity, buyable = 0, owned = 0, total = 0;
      for (const n of TECH) {
        if (n.branch !== branch) continue;
        if (!n.repeat) ++total;
        if (isNodeDone(n)) {
          ++owned;
          continue;
        }
        if (!arePrereqsMet(n)) continue;
        const cost = nodeCost(n);
        const afford = canPay(cost);
        if (afford) ++buyable;
        let price = 0, missing = 0;
        for (const k in cost) {
          const w = itemWeight(k);
          price += (cost[k] || 0) * w;
          const have = k === 'cr' ? credits : (inventory[k] || 0);
          missing += Math.max(0, (cost[k] || 0) - have) * w;
        }
        // repeatable land survey is offered last so real upgrades show first
        const score = (afford ? price : 1e7 + missing * 10 + price) + (n.repeat ? 5e6 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      picks.push({ branch, node: best, buyable, owned, total });
    }
    return picks;
  }

  function quickPanelLayout() {
    const w = 272, x = UW - w - HUD_M, y = HUD_M;
    const headerH = 36, rowH = 52, gap = 6;
    if (quickCollapsed)
      return { x, y, w, h: headerH + 4, rows: [], headerH };
    let ry = y + headerH + 8;
    const rows = getQuickPicks().map(p => {
      const r = Object.assign({ x: x + 8, y: ry, w: w - 16, h: rowH }, p);
      ry += rowH + gap;
      return r;
    });
    const button = { x: x + 8, y: ry + 2, w: w - 16, h: 32 };
    return { x, y, w, h: button.y + button.h + 8 - y, rows, button, headerH };
  }

  function activateQuickRow(r) {
    if (!r.node) {
      openTree(null, r.branch);
      return;
    }
    if (treeNodeState(r.node) === 'ready') {
      if (tryPurchaseTreeNode(r.node)) {
        quickFlash[r.branch] = uiTime;
        celebrate(r.x + r.w / 2, r.y + r.h / 2, 18);
      }
    } else
      openTree(r.node.id);
  }

  function drawQuickPanel() {
    const Q = quickPanelLayout();
    beginHudPanel('quick', Q.x, Q.y, Q.w, Q.h);
    let owned = 0, total = 0, ready = 0;
    for (const n of TECH)
      if (!n.repeat) {
        ++total;
        if (techOwned(n.id)) ++owned;
        else if (treeNodeState(n) === 'ready') ++ready;
      }
    drawPanel(Q.x, Q.y, Q.w, Q.h, { title: 'Next upgrades', icon: 'techtree', titlePx: 14, headerH: Q.headerH, titleRight: `${owned} / ${total}  ${quickCollapsed ? '▾' : '▴'}`, titleRightColor: UI.gold, accent: UI.gold });
    addRegion({ id: 'quick-header', x: Q.x, y: Q.y, w: Q.w, h: Q.headerH, onClick: () => { quickCollapsed = !quickCollapsed; SZ.GameAudio.play('click'); }, tip: () => ['Next upgrades', 'The best next upgrade of every branch.', ready ? `✔ ${ready} upgrade${ready === 1 ? '' : 's'} affordable now` : 'Nothing affordable right now', 'Click the header to fold the panel.'] });
    if (quickCollapsed && ready)
      drawChip(String(ready), Q.x + Q.w - 8, Q.y - 6, 18, { align: 'right', px: 11, bg: UI.leaf, color: '#10141e' });
    for (const r of Q.rows)
      drawQuickRow(r);
    if (Q.button)
      drawButton({ id: 'quick-tree', x: Q.button.x, y: Q.button.y, w: Q.button.w, h: Q.button.h }, { label: 'Open tech tree', icon: 'techtree', key: 'U', color: UI.gold, primary: true, px: 13, onClick: () => openTree(), tip: () => ['[[techtree]] Tech tree', 'All upgrades of every branch.', 'Shortcut: U'] });
    endHudPanel();
  }

  function drawQuickRow(r) {
    const color = TREE_BRANCH_COLORS[r.branch];
    const n = r.node;
    const complete = !n && r.owned >= r.total;
    const st = n ? treeNodeState(n) : (complete ? 'owned' : 'locked');
    const id = 'quick-' + r.branch;
    const hv = hoverAmount(id);
    ctx.save();
    drawNodeFrame(r.x, r.y, r.w, r.h, color, st, hv > 0.5);
    if (hv > 0.05) {
      roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * hv})`;
      ctx.stroke();
    }
    const ix = r.x + 7, iy = r.y + (r.h - 38) / 2;
    roundRectPath(ix, iy, 38, 38, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(n ? n.icon : (complete ? 'check' : 'lock'), ix + 19, iy + 19, 28, st === 'locked' ? 0.5 : 1);
    const tx = r.x + 52, tw = r.w - 52 - 8;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tagW = fitText(TREE_BRANCH_SHORT[r.branch].toUpperCase(), r.x + r.w - 8, r.y + 13, 74, 10, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 7 });
    ctx.textAlign = 'left';
    if (n) {
      fitText(nodeTitle(n), tx, r.y + 15, tw - tagW - 8, 14, { weight: 'bold', color: st === 'locked' ? '#7a8298' : UI.text, minPx: 9 });
      let extraW = 0;
      if (r.buyable > 1)
        extraW = drawChip('+' + (r.buyable - 1), r.x + r.w - 6, r.y + r.h - 25, 18, { align: 'right', px: 11, bg: hexToRgba(color, 0.2), border: hexToRgba(color, 0.6), color: '#fff' }) + 6;
      drawCostRow(nodeCost(n), tx, r.y + r.h - 15, tw - extraW, 13);
    } else {
      fitText(complete ? 'Branch complete' : 'Nothing unlocked yet', tx, r.y + 15, tw - tagW - 8, 14, { weight: 'bold', color: complete ? UI.good : UI.textMute });
      fitText(`${r.owned} / ${r.total} upgrades`, tx, r.y + r.h - 15, tw, 12, { color: UI.textDim });
    }
    const flash = quickFlash[r.branch];
    if (flash !== undefined) {
      const t = (uiTime - flash) / 0.6;
      if (t >= 1) delete quickFlash[r.branch];
      else {
        roundRectPath(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
    addRegion({ id, x: r.x, y: r.y, w: r.w, h: r.h, onClick: () => activateQuickRow(r), tip: () => {
      if (!n) return [TREE_BRANCH_LABELS[r.branch], complete ? '✔ Every upgrade of this branch is owned' : 'Unlock other branches first'];
      const lines = buildTechTooltip(n);
      lines.push(st === 'ready' ? '✔ Click to buy now' : 'Click to open it in the tree');
      return lines;
    } });
  }

  /* ══════════════════════════════════════════════════════════════════
     GOALS AND ORDERS — milestones with rewards, delivery orders from
     visiting traders, and the market where produce is sold
     ══════════════════════════════════════════════════════════════════ */

  let stats = newStats();
  let goalIndex = 0;
  let goalCooldown = 0;
  let orders = [];                   // { id, item, qty, reward, until }
  let orderTimer = 25;
  let orderSerial = 0;

  function newStats() {
    return { planted: 0, harvested: 0, earned: 0, orders: 0, built: 0, animals: 0, surveys: 0 };
  }

  function buildingCount() {
    let n = 0;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c)
        if (buildings[r]?.[c]) ++n;
    return n;
  }

  function ownedTechCount() {
    let n = 0;
    for (const t of TECH)
      if (!t.repeat && techOwned(t.id)) ++n;
    return n;
  }

  function unlockedCropCount() {
    let n = 0;
    for (let i = 0; i < CROPS.length; ++i)
      if (isCropUnlocked(i)) ++n;
    return n;
  }

  const GOALS = [
    { title: 'Green thumb', desc: 'Plant 5 crops', icon: 'seedbag', need: 5, value: () => stats.planted, reward: 25 },
    { title: 'First harvest', desc: 'Harvest 10 crops', icon: 'basket', need: 10, value: () => stats.harvested, reward: 40 },
    { title: 'Market day', desc: 'Earn 150 credits from sales', icon: 'coin', need: 150, value: () => stats.earned, reward: 50 },
    { title: 'Researcher', desc: 'Buy an upgrade in the tech tree', icon: 'techtree', need: 1, value: () => ownedTechCount(), reward: 60 },
    { title: 'Builder', desc: 'Build any building', icon: 'hammer', need: 1, value: () => Math.max(stats.built, buildingCount()), reward: 60 },
    { title: 'Rancher', desc: 'Buy an animal', icon: 'paw', need: 1, value: () => Math.max(stats.animals, livestockPens.length), reward: 60 },
    { title: 'Trader', desc: 'Deliver an order', icon: 'order', need: 1, value: () => stats.orders, reward: 100 },
    { title: 'New species', desc: 'Unlock a new crop', icon: 'starfruit', need: START_CROPS.length + 1, value: () => unlockedCropCount(), reward: 120 },
    { title: 'Sunny days', desc: 'Reach summer', icon: 'sun', need: SEASON_DURATION + 1, value: () => dayCount, reward: 120 },
    { title: 'Harvest moon', desc: 'Harvest 100 crops', icon: 'moon', need: 100, value: () => stats.harvested, reward: 200 },
    { title: 'Engineer', desc: 'Own 5 buildings', icon: 'turbine', need: 5, value: () => buildingCount(), reward: 200 },
    { title: 'Homesteader', desc: 'Survey new land twice', icon: 'map', need: 2, value: () => stats.surveys, reward: 250 },
    { title: 'Merchant', desc: 'Earn 2,000 credits from sales', icon: 'chart', need: 2000, value: () => stats.earned, reward: 300 },
    { title: 'Scientist', desc: 'Own 15 tech upgrades', icon: 'flask', need: 15, value: () => ownedTechCount(), reward: 400 },
    { title: 'Trade baron', desc: 'Deliver 5 orders', icon: 'scroll', need: 5, value: () => stats.orders, reward: 400 },
    { title: 'One full year', desc: 'Reach day 17', icon: 'winter', need: SEASON_DURATION * 4 + 1, value: () => dayCount, reward: 600 },
    { title: 'Tycoon', desc: 'Earn 10,000 credits from sales', icon: 'coin', need: 10000, value: () => stats.earned, reward: 1000 },
    { title: 'Master farmer', desc: 'Own 40 tech upgrades', icon: 'star', need: 40, value: () => ownedTechCount(), reward: 1500 },
    { title: 'Galactic farm', desc: 'Own every tech upgrade', icon: 'techtree', need: () => TECH.filter(t => !t.repeat).length, value: () => ownedTechCount(), reward: 5000 }
  ];

  function goalNeed(g) {
    return typeof g.need === 'function' ? g.need() : g.need;
  }

  function updateGoals(dt) {
    goalCooldown = Math.max(0, goalCooldown - dt);
    if (goalCooldown > 0 || goalIndex >= GOALS.length) return;
    const g = GOALS[goalIndex];
    if (g.value() >= goalNeed(g)) {
      ++goalIndex;
      credits += g.reward;
      goalCooldown = 1.8;
      announce('Goal reached: ' + g.title, `${g.desc} · +${g.reward} credits`, UI.good, g.icon);
      SZ.GameAudio.play('win', { volume: 0.8 });
      const L = hudLayout();
      const G = goalPanelLayout(L);
      celebrate(G.x + G.w / 2, G.y + 30, 34);
      flyCoins(Math.min(10, 3 + Math.round(g.reward / 100)), G.x + G.w / 2, G.y + 40);
    }
  }

  /* ── Orders ── */

  function orderSlots() {
    return 1 + techChainCount('com_orders');
  }

  function orderCandidates() {
    const list = [];
    CROPS.forEach((c, i) => {
      if (isCropUnlocked(i))
        list.push({ item: c.name, value: c.sellPrice, sprite: c.sprite, grow: c.growTime });
    });
    LIVESTOCK.forEach((l, i) => {
      if (livestockPens.some(p => p.typeIndex === i))
        list.push({ item: l.produce, value: l.produceValue, sprite: l.produceSprite, grow: l.feedInterval });
    });
    return list;
  }

  function newOrder() {
    const list = orderCandidates().filter(c => !orders.some(o => o.item === c.item));
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    // cheap goods come in bigger batches; the trader pays a premium
    const qty = Math.max(3, Math.min(30, Math.round((5 + Math.random() * 6 + dayCount * 0.35) * Math.min(2, 18 / pick.value))));
    const reward = Math.round(qty * pick.value * (1.6 + Math.random() * 0.5) / 5) * 5;
    orders.push({ id: ++orderSerial, item: pick.item, qty, reward, until: gameTime + DAY_CYCLE_PERIOD * (2.5 + Math.random()) });
    toast(`New order: ${qty} × ${pick.item}`, '#9df08a', 'order');
    SZ.GameAudio.play('blip', { pitch: 1.2 });
  }

  function updateOrders(dt) {
    if (state !== STATE_PLAYING) return;
    for (let i = orders.length - 1; i >= 0; --i)
      if (gameTime > orders[i].until) {
        toast(`Order for ${orders[i].item} expired`, UI.warn, 'order');
        orders.splice(i, 1);
      }
    if (orders.length < orderSlots()) {
      orderTimer -= dt;
      if (orderTimer <= 0) {
        orderTimer = 35 + Math.random() * 35;
        newOrder();
      }
    }
  }

  function orderSprite(o) {
    return itemSprite(o.item);
  }

  function canDeliver(o) {
    return (inventory[o.item] || 0) >= o.qty;
  }

  function deliverOrder(o, fromX, fromY) {
    if (state !== STATE_PLAYING) return;
    if (!canDeliver(o)) {
      SZ.GameAudio.play('error');
      toast(`Need ${o.qty - (inventory[o.item] || 0)} more ${o.item}`, UI.warn, orderSprite(o));
      return;
    }
    inventory[o.item] -= o.qty;
    if (inventory[o.item] <= 0) delete inventory[o.item];
    credits += o.reward;
    stats.earned += o.reward;
    ++stats.orders;
    orders.splice(orders.indexOf(o), 1);
    if (orders.length < orderSlots())
      orderTimer = Math.min(orderTimer, 20);
    announce('Order delivered!', `${o.qty} × ${o.item} · +${o.reward} credits`, '#9df08a', 'order');
    SZ.GameAudio.play('win', { volume: 0.7 });
    if (fromX !== undefined) {
      flyCoins(Math.min(12, 3 + Math.round(o.reward / 60)), fromX, fromY);
      celebrate(fromX, fromY, 22);
    }
  }

  /* ── HUD: current goal and open orders under the quick panel ── */

  function goalPanelLayout(L) {
    const Q = quickPanelLayout();
    const x = Q.x, w = Q.w, y = Q.y + Q.h + 8;
    const rowH = 30;
    const shown = Math.min(orders.length, 3);
    const h = 36 + 52 + (shown ? 8 + shown * (rowH + 4) : 26) + 6;
    return { x, y, w, h, rowH, shown };
  }

  function drawGoalPanel(L) {
    const G = goalPanelLayout(L);
    if (G.y + G.h > L.dock.y - 34) {
      // not enough room: only the goal line
      if (G.y + 96 > L.dock.y - 34) return;
    }
    const room = L.dock.y - 34 - G.y;
    const h = Math.min(G.h, room);
    beginHudPanel('goals', G.x, G.y, G.w, h);
    const top = drawPanel(G.x, G.y, G.w, h, { title: 'Goals & orders', icon: 'target', titlePx: 14, headerH: 34, titleRight: goalIndex < GOALS.length ? `${goalIndex + 1} / ${GOALS.length}` : 'All done', titleRightColor: UI.good, accent: UI.good });
    // goal
    const g = GOALS[goalIndex];
    const gy = top - 2;
    if (g) {
      const need = goalNeed(g), val = Math.min(need, g.value());
      drawSprite(g.icon, G.x + 26, gy + 20, 26);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const rw = fitText(`+${g.reward} [[coin]]`, G.x + G.w - 12, gy + 10, 90, 12, { weight: 'bold', color: UI.gold });
      ctx.textAlign = 'left';
      fitText(g.title, G.x + 46, gy + 10, G.w - 46 - 12 - rw - 8, 14, { weight: 'bold', color: UI.text });
      drawMeter(G.x + 46, gy + 24, G.w - 58, 14, val / need, UI.good, { label: `${g.desc}: ${Math.floor(val).toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`, labelPx: 10 });
      addRegion({ id: 'goal-row', x: G.x, y: gy, w: G.w, h: 44, tip: () => [`[[${g.icon}]] ${g.title}`, g.desc, `Progress: ${Math.floor(val)} / ${need}`, `Reward: ${g.reward} credits`, `Goal ${goalIndex + 1} of ${GOALS.length}`] });
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText('[[star]] Every goal reached!', G.x + 14, gy + 18, G.w - 28, 14, { weight: 'bold', color: UI.gold });
    }
    // orders
    let oy = gy + 50;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(G.x + 10, oy - 4, G.w - 20, 1);
    if (!orders.length) {
      ctx.textAlign = 'left';
      fitText(`[[order]] Next trader in ${Math.ceil(Math.max(0, orderTimer))}s`, G.x + 14, oy + 10, G.w - 28, 12, { color: UI.textMute });
    }
    for (let i = 0; i < G.shown; ++i) {
      const o = orders[i];
      const ry = oy + i * (G.rowH + 4);
      if (ry + G.rowH > G.y + h - 4) break;
      const ok = canDeliver(o);
      const id = 'order-' + o.id;
      const hv = hoverAmount(id);
      roundRectPath(G.x + 8, ry, G.w - 16, G.rowH, 8);
      ctx.fillStyle = ok ? `rgba(111,224,138,${0.14 + hv * 0.12})` : `rgba(255,255,255,${0.04 + hv * 0.05})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = ok ? 'rgba(111,224,138,0.6)' : 'rgba(255,255,255,0.12)';
      ctx.stroke();
      const left = (o.until - gameTime) / (DAY_CYCLE_PERIOD * 3);
      ctx.fillStyle = left < 0.25 ? UI.bad : 'rgba(255,215,90,0.6)';
      ctx.fillRect(G.x + 12, ry + G.rowH - 4, (G.w - 24) * Math.max(0, Math.min(1, left)), 2);
      drawSprite(orderSprite(o), G.x + 24, ry + G.rowH / 2 - 1, 20);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const rew = fitText(`${o.reward} [[coin]]`, G.x + G.w - 14, ry + G.rowH / 2 - 1, 80, 12, { weight: 'bold', color: UI.gold });
      ctx.textAlign = 'left';
      const have = Math.min(o.qty, inventory[o.item] || 0);
      fitText(`${have}/${o.qty} ${o.item}`, G.x + 40, ry + G.rowH / 2 - 1, G.w - 40 - 22 - rew, 12, { weight: 'bold', color: ok ? UI.good : UI.text });
      addRegion({ id, x: G.x + 8, y: ry, w: G.w - 16, h: G.rowH, onClick: () => deliverOrder(o, G.x + G.w / 2, ry + G.rowH / 2), tip: () => orderTooltip(o) });
    }
    if (orders.length > G.shown) {
      ctx.textAlign = 'left';
      fitText(`+${orders.length - G.shown} more in the market (M)`, G.x + 14, oy + G.shown * (G.rowH + 4) + 6, G.w - 28, 11, { color: UI.textMute });
    }
    endHudPanel();
  }

  function orderTooltip(o) {
    const have = inventory[o.item] || 0;
    const secs = Math.max(0, Math.ceil(o.until - gameTime));
    return [`[[order]] Order: ${o.qty} × ${o.item}`, `Pays ${o.reward} credits (about ${Math.round(o.reward / o.qty)} each)`,
      have >= o.qty ? '✔ Ready: click to deliver' : `✘ You have ${have} of ${o.qty}`,
      `Expires in ${secs}s`];
  }

  /* ── Market dialog: sell single items, see prices, deliver orders ── */

  function sellItem(name) {
    if (state !== STATE_PLAYING) return;
    const count = inventory[name] || 0;
    if (!count) return;
    let price = 0;
    for (const c of CROPS)
      if (c.name === name) price = getEffectiveSellPrice(c);
    for (const l of LIVESTOCK)
      if (l.produce === name) price = getEffectiveProduceValue(l);
    const bulk = techOwned('com_broker') && count >= 20 ? 1.1 : 1;
    const earned = Math.round(count * price * bulk);
    credits += earned;
    stats.earned += earned;
    delete inventory[name];
    SZ.GameAudio.play('coin');
    flyCoins(Math.min(8, 2 + Math.ceil(earned / 60)), pointerUX, pointerUY);
    toast(`Sold ${count} × ${name} for ${earned} credits`, UI.gold, 'coin');
  }

  function drawMarketDialog() {
    const c = beginDialog('Market', 820, 520, { icon: 'market', accent: UI.gold, titleRight: `${Math.round(credits).toLocaleString('en-US')} [[coin]]`, titleRightColor: UI.gold });
    const split = c.w >= 640;
    const leftW = split ? Math.round(c.w * 0.56) : c.w;
    const rightX = c.x + leftW + 16, rightW = c.w - leftW - 16;
    // Storage list
    const items = storageItems();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(`[[basket]] Storage ${getTotalInventoryCount()} / ${getStorageCapacity()}`, c.x, c.y + 8, leftW - 120, 14, { weight: 'bold', color: UI.text });
    const rowH = 34;
    const listY = c.y + 24, listH = c.h - 24 - 50;
    const maxScroll = Math.max(0, items.length * (rowH + 4) - listH);
    dialogScroll = Math.max(0, Math.min(maxScroll, dialogScroll));
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x - 2, listY, leftW + 4, listH);
    ctx.clip();
    if (!items.length) {
      ctx.textAlign = 'left';
      fitText('Nothing to sell yet: harvest some crops first.', c.x + 8, listY + 20, leftW - 16, 13, { color: UI.textMute });
    }
    items.forEach((it, i) => {
      const y = listY + i * (rowH + 4) - dialogScroll;
      if (y + rowH < listY || y > listY + listH) return;
      roundRectPath(c.x, y, leftW, rowH, 8);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      drawSprite(it.sprite, c.x + 20, y + rowH / 2, 24);
      const crop = CROPS.findIndex(cr => cr.name === it.name);
      let trend = '';
      if (crop >= 0) {
        const pm = priceMultipliers[crop] || 1;
        trend = pm > 1.05 ? ' ▲' : (pm < 0.95 ? ' ▼' : '');
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const bw = 92;
      fitText(it.name, c.x + 40, y + rowH / 2 - 7, leftW - 40 - bw - 120, 13, { weight: 'bold', color: UI.text });
      fitText(`${it.value} cr each${trend}`, c.x + 40, y + rowH / 2 + 8, leftW - 40 - bw - 120, 11, { color: trend === ' ▲' ? UI.good : (trend === ' ▼' ? UI.bad : UI.textDim) });
      ctx.textAlign = 'right';
      fitText(`×${it.count}`, c.x + leftW - bw - 16, y + rowH / 2, 100, 14, { weight: 'bold', color: UI.text });
      if (y >= listY && y + rowH <= listY + listH)
        drawButton({ id: 'sell-' + it.name, x: c.x + leftW - bw - 6, y: y + 4, w: bw, h: rowH - 8 }, { label: `${it.count * it.value} [[coin]]`, primary: true, color: '#59c96a', px: 12, onClick: () => sellItem(it.name), tip: () => [`Sell all ${it.name}`, `${it.count} × ${it.value} = ${it.count * it.value} credits`] });
    });
    ctx.restore();
    addRegion({ id: 'market-wheel', x: c.x, y: listY, w: leftW, h: listH, modal: true, passive: true, onWheel: (dy) => { dialogScroll += dy > 0 ? 50 : -50; } });
    reorderPassiveRegions();
    const total = getEstimatedStorageValue();
    drawButton({ id: 'market-sellall', x: c.x, y: c.y + c.h - 40, w: leftW, h: 36 }, { label: total ? `Sell everything · ${total} [[coin]]` : 'Sell everything', icon: 'coin', key: 'S', primary: total > 0, disabled: !total, color: '#59c96a', px: 14, onClick: sellAllProduce, tip: buildSellButtonTooltip });

    // Orders
    if (split) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(rightX - 9, c.y, 1, c.h);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(`[[order]] Orders ${orders.length} / ${orderSlots()}`, rightX, c.y + 8, rightW, 14, { weight: 'bold', color: UI.text });
      let y = c.y + 24;
      if (!orders.length)
        drawTextBlock(`Traders bring orders now and then; the next one arrives in about ${Math.ceil(Math.max(0, orderTimer))}s. Orders pay well above market prices.`, rightX, y + 4, rightW, 70, 12, { color: UI.textMute });
      for (const o of orders) {
        const h = 86;
        if (y + h > c.y + c.h) break;
        const ok = canDeliver(o);
        roundRectPath(rightX, y, rightW, h, 10);
        ctx.fillStyle = ok ? 'rgba(111,224,138,0.12)' : 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ok ? 'rgba(111,224,138,0.6)' : 'rgba(255,255,255,0.12)';
        ctx.stroke();
        drawSprite(orderSprite(o), rightX + 26, y + 26, 32);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(`${o.qty} × ${o.item}`, rightX + 50, y + 16, rightW - 60, 14, { weight: 'bold', color: UI.text });
        fitText(`Pays ${o.reward} [[coin]] · ${Math.max(0, Math.ceil(o.until - gameTime))}s left`, rightX + 50, y + 34, rightW - 60, 12, { color: UI.gold });
        const have = inventory[o.item] || 0;
        drawButton({ id: 'deliver-' + o.id, x: rightX + 10, y: y + h - 34, w: rightW - 20, h: 26 }, { label: ok ? 'Deliver' : `Have ${have} / ${o.qty}`, primary: ok, disabled: !ok, color: UI.good, px: 12, onClick: () => deliverOrder(o, rightX + rightW / 2, y + h - 20), onDisabled: () => SZ.GameAudio.play('error'), tip: () => orderTooltip(o) });
        y += h + 8;
      }
    }
    endDialog();
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD — farm status, storage, clock, tool dock
     ══════════════════════════════════════════════════════════════════ */

  const HUD_M = 10;                  // margin around HUD panels (UI units)
  const DOCK_H = 84;
  const SLOT_W = 58, SLOT_H = 64, SLOT_GAP = 6;
  const SEASON_COLORS = ['#8ef08a', '#ffd75a', '#ff9a4a', '#a8dcff'];

  let creditsShown = 100;            // eased counter value
  let creditsPulse = 0;
  let creditsDelta = 0, creditsDeltaT = 0;
  const dockScroll = { plant: 0, build: 0 };
  let banner = null;                 // { title, sub, color, icon, t }
  let screenFade = 1;                // fades the screen in after a state change

  function announce(title, sub, color, icon) {
    banner = { title, sub: sub || '', color: color || UI.gold, icon: icon || null, t: 0 };
  }

  function dockMode() {
    if (selectedTool === TOOL_BUILD) return 'build';
    if (selectedTool === TOOL_HOE) return 'hoe';
    return 'plant';
  }

  function hudLayout() {
    const farm = { x: HUD_M, y: HUD_M, w: 244, h: 112 };
    const clockW = Math.min(330, UW - 2 * (farm.w + HUD_M * 3));
    const clock = { x: Math.round(UW / 2 - clockW / 2), y: HUD_M, w: clockW, h: 64 };
    const dockW = Math.min(UW - HUD_M * 2, 1180);
    const dock = { x: Math.round((UW - dockW) / 2), y: UH - DOCK_H - HUD_M, w: dockW, h: DOCK_H };
    const storeTop = farm.y + farm.h + 8;
    const storage = { x: HUD_M, y: storeTop, w: farm.w, h: 0, maxH: dock.y - 68 - storeTop };
    return { farm, clock, dock, storage };
  }

  /* ── HUD fading: panels turn see-through while farm action is behind them ── */

  const HUD_FADED = 0.28;
  const hudFade = {};
  let hudFrame = 0;
  let hudActorCache = null, hudActorFrame = -1;

  /* Screen rectangles (UI units) of everything that should stay visible */
  function hudActors() {
    if (hudActorFrame === hudFrame && hudActorCache) return hudActorCache;
    const out = [];
    const ts = BASE_TILE_SIZE * viewZoom / uiS;
    const add = (x, y, w, h) => out.push({ x, y, w, h });
    for (const a of wildAnimals) {
      const g = gridToScreen(a.rx !== undefined ? a.rx : a.x, a.ry !== undefined ? a.ry : a.y);
      add(g.x / uiS, g.y / uiS, ts, ts);
    }
    for (const pen of livestockPens)
      if (pen.produceReady) {
        const s = livestockPenToScreen(pen);
        add(s.x / uiS - ts / 2, s.y / uiS - ts / 2, ts, ts);
      }
    if (isDragging && dragStartedOnGrid) {
      const x0 = Math.min(dragStartX, dragCurrentX) / uiS, y0 = Math.min(dragStartY, dragCurrentY) / uiS;
      add(x0, y0, Math.abs(dragCurrentX - dragStartX) / uiS, Math.abs(dragCurrentY - dragStartY) / uiS);
    }
    if (kbCursor.active) {
      const g = gridToScreen(kbCursor.col, kbCursor.row);
      add(g.x / uiS, g.y / uiS, ts, ts);
    }
    hudActorCache = out;
    hudActorFrame = hudFrame;
    return out;
  }

  function overlapsActor(x, y, w, h) {
    for (const a of hudActors())
      if (a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y)
        return true;
    return false;
  }

  function hudAlpha(id, x, y, w, h) {
    const f = hudFade[id] || (hudFade[id] = { a: 1 });
    const mouseInside = pointerUX >= x && pointerUX <= x + w && pointerUY >= y && pointerUY <= y + h && pointerInside;
    const live = state === STATE_PLAYING && !dialog;
    const target = live && !mouseInside && overlapsActor(x, y, w, h) ? (id === 'dock' ? 0.55 : HUD_FADED) : 1;
    f.a += (target - f.a) * (1 - Math.exp(-frameDt * 9));
    f.rect = { x, y, w, h };
    f.frame = hudFrame;
    return f.a;
  }

  function beginHudPanel(id, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha *= hudAlpha(id, x, y, w, h);
  }

  function endHudPanel() {
    ctx.restore();
  }

  /* A click on a pest or a ready animal seen through a faded panel goes to the farm */
  function hudPassThrough(ux, uy) {
    for (const id in hudFade) {
      const f = hudFade[id];
      if (f.frame < hudFrame - 2 || f.a > 0.6 || !f.rect) continue;
      const r = f.rect;
      if (ux < r.x || ux > r.x + r.w || uy < r.y || uy > r.y + r.h) continue;
      for (const a of hudActors())
        if (ux >= a.x - 6 && ux <= a.x + a.w + 6 && uy >= a.y - 6 && uy <= a.y + a.h + 6)
          return true;
    }
    return false;
  }

  /* ── Farm panel: credits, storage, energy ── */

  function drawFarmPanel(L) {
    const r = L.farm;
    beginHudPanel('farm', r.x, r.y, r.w, r.h);
    drawPanel(r.x, r.y, r.w, r.h, { accent: UI.gold });
    // Credits
    const pulse = 1 + creditsPulse * 0.18;
    ctx.save();
    ctx.translate(r.x + 26, r.y + 26);
    ctx.scale(pulse, pulse);
    drawSprite('coin', 0, 0, 28);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const credW = fitText(Math.round(creditsShown).toLocaleString('en-US'), r.x + 46, r.y + 27, r.w - 56 - 60, 26, { weight: 'bold', color: UI.gold, outline: 'rgba(0,0,0,0.6)' });
    if (creditsDeltaT > 0 && creditsDelta) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, creditsDeltaT);
      ctx.textAlign = 'left';
      fitText((creditsDelta > 0 ? '+' : '') + creditsDelta, r.x + 52 + credW, r.y + 27 - (1 - Math.min(1, creditsDeltaT)) * 8, r.x + r.w - 10 - (r.x + 52 + credW), 14, { weight: 'bold', color: creditsDelta > 0 ? UI.good : UI.bad });
      ctx.restore();
    }
    addRegion({ id: 'hud-credits', x: r.x, y: r.y, w: r.w, h: 48, tip: () => [
      '[[coin]] Credits',
      'Earned by selling produce, orders and building income.',
      'Spent on seeds, buildings, animals and upgrades.'
    ] });

    // Storage
    const cap = getStorageCapacity();
    const used = getTotalInventoryCount();
    const full = used >= cap;
    drawSprite('basket', r.x + 20, r.y + 63, 18 * (1 + storagePulse * 0.35));
    drawMeter(r.x + 36, r.y + 55, r.w - 48, 16, used / cap, full ? UI.bad : (used / cap > 0.8 ? UI.warn : '#7ed46a'), { label: `${used} / ${cap}`, labelPx: 11 });
    addRegion({ id: 'hud-storage', x: r.x, y: r.y + 50, w: r.w, h: 26, tip: () => {
      const lines = ['[[basket]] Storage', `${used} of ${cap} slots used.`];
      if (full)
        lines.push('✘ Storage is full: harvesting stops until you sell.');
      lines.push('Silos add room. Sell with S.');
      return lines;
    } });

    // Energy
    const eMax = getEnergyMax();
    const eFrac = energy / eMax;
    const regen = getEnergyRegenRate();
    drawSprite('bolt', r.x + 20, r.y + 89, 18);
    drawMeter(r.x + 36, r.y + 81, r.w - 48, 16, eFrac, eFrac > 0.5 ? UI.energy : (eFrac > 0.2 ? UI.warn : UI.bad), { label: `${Math.round(energy)} / ${eMax}  +${regen.toFixed(1)}/s`, labelPx: 11, shine: eFrac >= 1 });
    addRegion({ id: 'hud-energy', x: r.x, y: r.y + 76, w: r.w, h: 30, tip: () => [
      '[[bolt]] Energy',
      `${Math.round(energy)} of ${eMax}, regenerating ${regen.toFixed(1)} per second.`,
      'Harvesters and harvest drones use 1 energy per crop.',
      'Solar panels charge by day, wind turbines at night and in storms.',
      'Below 20% the drones slow down.'
    ] });
    endHudPanel();
  }

  /* ── Storage list ── */

  function storageItems() {
    const items = [];
    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0)
        items.push({ sprite: crop.sprite, name: crop.name, count, value: getEffectiveSellPrice(crop) });
    }
    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0)
        items.push({ sprite: live.produceSprite, name: live.produce, count, value: getEffectiveProduceValue(live) });
    }
    return items;
  }

  function drawStoragePanel(L) {
    const items = storageItems();
    const r = L.storage;
    const rowH = 22;
    const headerH = 30;
    const btnH = items.length ? 34 : 0;
    const maxRows = Math.max(1, Math.floor((r.maxH - headerH - btnH - 24) / rowH));
    const shown = items.length > maxRows ? maxRows - 1 : items.length;
    const rows = items.length ? shown + (items.length > shown ? 1 : 0) : 1;
    const h = headerH + 8 + rows * rowH + (btnH ? btnH + 10 : 4) + 4;
    if (h > r.maxH + 20) return;
    r.h = h;
    beginHudPanel('storage', r.x, r.y, r.w, h);
    const value = getEstimatedStorageValue();
    const top = drawPanel(r.x, r.y, r.w, h, { title: 'Storage', icon: 'basket', headerH: headerH, titlePx: 14, titleRight: items.length ? `≈ ${value.toLocaleString('en-US')} [[coin]]` : '', titleRightColor: UI.gold, accent: '#7ed46a' });
    ctx.textBaseline = 'middle';
    if (!items.length) {
      ctx.textAlign = 'left';
      fitText('Harvest crops to fill it', r.x + 12, top + rowH / 2, r.w - 24, 12, { color: UI.textMute });
    }
    for (let i = 0; i < shown; ++i) {
      const it = items[i];
      const y = top + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(r.x + 6, y, r.w - 12, rowH);
      }
      drawSprite(it.sprite, r.x + 18, y + rowH / 2, 18);
      ctx.textAlign = 'right';
      const cw = fitText('×' + it.count, r.x + r.w - 12, y + rowH / 2 + 1, 50, 13, { weight: 'bold', color: UI.text });
      ctx.textAlign = 'left';
      fitText(it.name, r.x + 32, y + rowH / 2 + 1, r.w - 32 - 16 - cw - 6, 12, { color: UI.textDim });
    }
    if (items.length > shown) {
      ctx.textAlign = 'left';
      fitText(`+${items.length - shown} more…`, r.x + 32, top + shown * rowH + rowH / 2 + 1, r.w - 44, 12, { color: UI.textMute });
    }
    addRegion({ id: 'hud-storage-list', x: r.x, y: r.y, w: r.w, h: h - btnH - 6, onClick: () => toggleDialog('market'), tip: () => {
      if (!items.length) return ['[[basket]] Storage', 'Harvested crops and animal produce wait here until you sell them.'];
      const lines = ['[[basket]] Storage', '--- Contents ---'];
      for (const it of items)
        lines.push(`[[${it.sprite}]] ${it.name}: ${it.count} × ${it.value} cr`);
      lines.push(`Worth about ${value} credits right now.`);
      lines.push('Click to open the market (M)');
      return lines;
    } });
    if (btnH)
      drawButton({ id: 'btn-sell-storage', x: r.x + 10, y: r.y + h - btnH - 8, w: r.w - 20, h: btnH }, { label: 'Sell all', icon: 'coin', key: 'S', primary: true, color: '#59c96a', px: 13, onClick: sellAllProduce, tip: buildSellButtonTooltip });
    endHudPanel();
  }

  /* ── Clock: season, day, time of day, weather ── */

  const WEATHER_INFO = {
    none: { name: 'Clear skies', icon: 'sun', color: '#ffe48a' },
    solarFlare: { name: 'Solar flare', icon: 'flare', color: '#ffd23f' },
    meteorShower: { name: 'Meteor shower', icon: 'meteor', color: '#ff7a4a' },
    rain: { name: 'Rain', icon: 'rain', color: '#7ab8ff' },
    thunderstorm: { name: 'Thunderstorm', icon: 'storm', color: '#c8b0ff' },
    snow: { name: 'Snowfall', icon: 'snow', color: '#cfe8ff' },
    dust: { name: 'Dust storm', icon: 'dust', color: '#e0b878' }
  };

  function weatherInfo() {
    const w = WEATHER_INFO[weatherType] || WEATHER_INFO.none;
    if (weatherType === WEATHER_NONE && dayPhase >= 0.5)
      return { name: 'Clear night', icon: 'moon', color: '#c8d8ff' };
    return w;
  }

  function drawClockPanel(L) {
    const r = L.clock;
    if (r.w < 180) return;
    beginHudPanel('clock', r.x, r.y, r.w, r.h);
    const sc = SEASON_COLORS[currentSeason];
    drawPanel(r.x, r.y, r.w, r.h, { accent: sc });
    // Season badge
    roundRectPath(r.x + 8, r.y + 8, 40, 40, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(sc, 0.5);
    ctx.stroke();
    drawSprite(SEASON_SPRITES[currentSeason], r.x + 28, r.y + 28, 28);
    const wi = weatherInfo();
    const weatherW = Math.min(118, r.w * 0.38);
    const tx = r.x + 56, tw = r.w - 56 - weatherW - 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const dayInSeason = ((dayCount - 1) % SEASON_DURATION) + 1;
    fitText(`${SEASONS[currentSeason]} · Day ${dayCount}`, tx, r.y + 18, tw, 16, { weight: 'bold', color: sc });
    const isNight = dayPhase >= 0.5;
    const secsLeft = Math.ceil((isNight ? 1 - dayPhase : 0.5 - dayPhase) * DAY_CYCLE_PERIOD);
    fitText(`Day ${dayInSeason}/${SEASON_DURATION} of season · ${isNight ? 'dawn' : 'dusk'} in ${secsLeft}s`, tx, r.y + 36, tw, 11, { color: UI.textDim });
    // Day / night bar
    const bx = tx, by = r.y + 47, bw = tw, bh = 8;
    roundRectPath(bx, by, bw, bh, 4);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ffcf6a');
    g.addColorStop(0.45, '#ffe9a0');
    g.addColorStop(0.5, '#6a7ad0');
    g.addColorStop(1, '#1c2660');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    drawSprite(isNight ? 'moon' : 'sun', bx + bw * dayPhase, by + bh / 2, 14);
    addRegion({ id: 'hud-clock', x: r.x, y: r.y, w: r.w - weatherW - 4, h: r.h, tip: buildClockTooltip });
    // Weather
    const wx = r.x + r.w - weatherW - 6;
    roundRectPath(wx, r.y + 8, weatherW, r.h - 16, 9);
    ctx.fillStyle = hexToRgba(wi.color, 0.12);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(wi.color, 0.4);
    ctx.stroke();
    drawSprite(wi.icon, wx + 20, r.y + r.h / 2, 24);
    ctx.textAlign = 'left';
    const twoLines = weatherType !== WEATHER_NONE || techOwned('sci_forecast');
    fitText(wi.name, wx + 36, r.y + r.h / 2 - (twoLines ? 7 : 0), weatherW - 42, 12, { weight: 'bold', color: wi.color });
    if (weatherType !== WEATHER_NONE)
      fitText(`${Math.ceil(weatherTimer)}s left`, wx + 36, r.y + r.h / 2 + 9, weatherW - 42, 11, { color: UI.textDim });
    else if (techOwned('sci_forecast')) {
      const nx = WEATHER_INFO[forecastWeather()] || WEATHER_INFO.none;
      fitText(`[[${nx.icon}]] in ${Math.ceil(weatherInterval)}s`, wx + 36, r.y + r.h / 2 + 9, weatherW - 42, 11, { color: UI.textDim });
    }
    addRegion({ id: 'hud-weather', x: wx, y: r.y, w: weatherW, h: r.h, tip: buildWeatherTooltip });
    if (techOwned('sci_rain')) {
      const ready = canCallRain();
      drawButton({ id: 'hud-rain', x: r.x + r.w - 96, y: r.y + r.h + 4, w: 90, h: 24 }, {
        label: ready || dayCount >= rainMakerDay ? 'Call rain' : `Day ${rainMakerDay}`, icon: currentSeason === 3 ? 'snow' : 'rain', px: 11, primary: ready, color: '#7ab8ff', disabled: !ready,
        onClick: callRain, onDisabled: () => SZ.GameAudio.play('error'),
        tip: () => ['[[rain]] Rain Maker', currentSeason === 3 ? 'Calls snowfall in winter.' : 'Calls a rain shower: crops grow 50% faster.', ready ? '✔ Ready' : (weatherType !== WEATHER_NONE ? '⚠ Wait for the current weather to pass' : `⚠ Recharges on day ${rainMakerDay}`)]
      });
    }
    endHudPanel();
  }

  /* ── Tool dock ── */

  function dockItems(mode) {
    if (mode === 'plant') {
      const open = [], shut = [];
      CROPS.forEach((c, i) => (isCropUnlocked(i) ? open : shut).push({ kind: 'crop', index: i, locked: !isCropUnlocked(i) }));
      return open.concat(shut);
    }
    if (mode === 'build') {
      const open = [], shut = [];
      BUILDINGS.forEach((b, i) => (isBuildingUnlocked(i) ? open : shut).push({ kind: 'building', index: i, locked: !isBuildingUnlocked(i) }));
      return open.concat(shut);
    }
    return [];
  }

  function selectCrop(i) {
    if (!isCropUnlocked(i)) {
      lockedHint(unlockedByTech('crops', i));
      return;
    }
    selectedCropIndex = i;
    selectedTool = TOOL_PLANT;
    selectedBuildingIndex = -1;
    SZ.GameAudio.play('click');
  }

  /* A locked item was picked: show where it is unlocked */
  function lockedHint(n) {
    SZ.GameAudio.play('error', { volume: 0.5 });
    if (n)
      openTree(n.id);
  }

  function selectBuilding(i) {
    if (!isBuildingUnlocked(i)) {
      lockedHint(unlockedByTech('buildings', i));
      return;
    }
    selectedBuildingIndex = i;
    selectedTool = TOOL_BUILD;
    SZ.GameAudio.play('click');
  }

  function setTool(mode) {
    if (mode === 'plant') {
      selectedTool = TOOL_PLANT;
      selectedBuildingIndex = -1;
    } else if (mode === 'build') {
      selectedTool = TOOL_BUILD;
      if (selectedBuildingIndex < 0 || !isBuildingUnlocked(selectedBuildingIndex))
        selectedBuildingIndex = 0;
    } else {
      selectedTool = TOOL_HOE;
      selectedBuildingIndex = -1;
    }
    SZ.GameAudio.play('click');
  }

  function drawDock(L) {
    const d = L.dock;
    beginHudPanel('dock', d.x, d.y, d.w, d.h);
    drawPanel(d.x, d.y, d.w, d.h, { accent: UI.leaf, radius: 14 });
    const mode = dockMode();
    const top = d.y + (d.h - SLOT_H) / 2;

    // Tools
    const tools = [
      { mode: 'plant', icon: 'seedbag', label: 'Seeds', key: 'P' },
      { mode: 'build', icon: 'hammer', label: 'Build', key: 'B' },
      { mode: 'hoe', icon: 'hoe', label: 'Hoe', key: 'T' }
    ];
    let x = d.x + 10;
    for (const t of tools) {
      drawButton({ id: 'tool-' + t.mode, x, y: top, w: 56, h: SLOT_H }, {
        label: t.label, icon: t.icon, vertical: true, active: mode === t.mode, color: UI.leaf, px: 11,
        onClick: () => setTool(t.mode), tip: () => toolTooltip(t.mode)
      });
      if (mode === t.mode) {
        ctx.fillStyle = UI.leaf;
        ctx.fillRect(x + 14, top + SLOT_H + 3, 28, 3);
      }
      x += 62;
    }
    x += 6;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x - 5, d.y + 12, 1, d.h - 24);

    // Actions (right)
    const actions = [
      { id: 'act-sell', icon: 'coin', label: 'Sell', key: 'S', onClick: sellAllProduce, tip: buildSellButtonTooltip, color: '#59c96a' },
      { id: 'act-market', icon: 'market', label: 'Market', key: 'M', onClick: () => toggleDialog('market'), tip: () => ['[[market]] Market', 'Sell single crops, check prices and deliver orders.', `${orders.length} order${orders.length === 1 ? '' : 's'} open`, 'Shortcut: M'], color: UI.gold },
      { id: 'act-animals', icon: 'paw', label: 'Animals', key: 'L', onClick: () => toggleDialog('livestock'), tip: () => ['[[paw]] Livestock', 'Buy animals for the pens around your farm.', `${livestockPens.length} animals on the farm.`, 'Shortcut: L'], color: '#ff9ac0' },
      { id: 'act-upgrades', icon: 'techtree', label: 'Tech tree', key: 'U', onClick: () => toggleTree(), tip: () => ['[[techtree]] Tech tree', 'Upgrades, new crops, animals and buildings.', 'Shortcut: U'], color: UI.gold }
    ];
    const actW = 62;
    const actX0 = d.x + d.w - 10 - actions.length * (actW + 6) + 6;
    actions.forEach((a, i) => {
      drawButton({ id: a.id, x: actX0 + i * (actW + 6), y: top, w: actW, h: SLOT_H }, {
        label: a.label, icon: a.icon, vertical: true, color: a.color, px: 11, onClick: a.onClick, tip: a.tip,
        active: (a.id === 'act-animals' && dialog === 'livestock') || (a.id === 'act-market' && dialog === 'market') || (a.id === 'act-upgrades' && dialog === 'tree')
      });
    });
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(actX0 - 7, d.y + 12, 1, d.h - 24);

    // Slots
    const sx0 = x, sx1 = actX0 - 12;
    const items = dockItems(mode);
    if (mode === 'hoe') {
      roundRectPath(sx0, top, sx1 - sx0, SLOT_H, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      drawSprite('hoe', sx0 + 30, top + SLOT_H / 2, 32);
      drawTextBlock(`Click soil beside water (or water itself) to enrich it: +20% nutrients, sand turns into farmland. Click a rock to break it up (${ROCK_CLEAR_COST} cr). Right-click a crop to uproot it for half its seed cost.`, sx0 + 56, top + 4, sx1 - sx0 - 66, SLOT_H - 8, 12, { color: UI.textDim, valign: 'middle' });
    } else {
      const areaW = sx1 - sx0;
      const total = items.length * (SLOT_W + SLOT_GAP) - SLOT_GAP;
      const overflow = total > areaW;
      const arrowW = overflow ? 22 : 0;
      const viewX0 = sx0 + arrowW, viewW = areaW - arrowW * 2;
      const maxScroll = Math.max(0, total - viewW);
      dockScroll[mode] = Math.max(0, Math.min(maxScroll, dockScroll[mode]));
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewX0, d.y + 2, viewW, d.h - 4);
      ctx.clip();
      items.forEach((it, i) => {
        const sx = viewX0 + i * (SLOT_W + SLOT_GAP) - dockScroll[mode];
        if (sx + SLOT_W < viewX0 || sx > viewX0 + viewW) return;
        drawDockSlot(it, sx, top, i, viewX0, viewX0 + viewW);
      });
      ctx.restore();
      if (overflow) {
        const step = (SLOT_W + SLOT_GAP) * 3;
        drawButton({ id: 'dock-left', x: sx0, y: top, w: arrowW - 2, h: SLOT_H }, { label: '', chevron: -1, disabled: dockScroll[mode] <= 0, onClick: () => { dockScroll[mode] -= step; } });
        drawButton({ id: 'dock-right', x: sx1 - arrowW + 2, y: top, w: arrowW - 2, h: SLOT_H }, { label: '', chevron: 1, disabled: dockScroll[mode] >= maxScroll, onClick: () => { dockScroll[mode] += step; } });
      }
      addRegion({ id: 'dock-slots-wheel', x: sx0, y: d.y, w: areaW, h: d.h, passive: true, onWheel: (dy) => { dockScroll[mode] += dy > 0 ? 64 : -64; } });
      // keep the selected slot visible
      const sel = items.findIndex(it => it.index === (mode === 'plant' ? selectedCropIndex : selectedBuildingIndex));
      if (sel >= 0 && dockFollow) {
        const sx = sel * (SLOT_W + SLOT_GAP);
        if (sx < dockScroll[mode]) dockScroll[mode] = sx;
        else if (sx + SLOT_W > dockScroll[mode] + viewW) dockScroll[mode] = sx + SLOT_W - viewW;
        dockFollow = false;
      }
    }
    addRegion({ id: 'dock-bg', x: d.x, y: d.y, w: d.w, h: d.h, passive: true });
    reorderPassiveRegions();
    endHudPanel();

    // Action hint above the dock
    drawActionHint(d);
  }
  let dockFollow = true;

  /* Wheel-only regions sit below the buttons they surround */
  function reorderPassiveRegions() {
    const passive = frameRegions.filter(r => r.passive);
    const active = frameRegions.filter(r => !r.passive);
    frameRegions = passive.concat(active);
  }

  function drawDockSlot(it, x, y, i, clipL, clipR) {
    const id = 'slot-' + it.kind + '-' + it.index;
    const hv = hoverAmount(id);
    const pressed = isPressed(id) && hoverRegionId === id;
    const isCrop = it.kind === 'crop';
    const def = isCrop ? CROPS[it.index] : BUILDINGS[it.index];
    const selected = isCrop ? (selectedTool === TOOL_PLANT && selectedCropIndex === it.index) : (selectedTool === TOOL_BUILD && selectedBuildingIndex === it.index);
    const cost = isCrop ? getSeedCost(def) : getBuildingCost(def);
    const afford = credits >= cost;
    const locked = it.locked;
    const lift = pressed ? 1 : -hv * 3;
    const yy = y + lift;
    ctx.save();
    if (selected) {
      roundRectPath(x, yy, SLOT_W, SLOT_H, 10);
      ctx.lineWidth = 7 + Math.sin(uiTime * 4) * 2;
      ctx.strokeStyle = 'rgba(126,224,106,0.22)';
      ctx.stroke();
    }
    const hq = Math.round(hv * 8) / 8;
    drawBaked(['slot', selected ? 1 : 0, hq].join('|'), x, yy, SLOT_W, SLOT_H, 3, (g, px, py, w, h) => {
      rrPath(g, px, py, w, h, 10);
      const gr = g.createLinearGradient(0, py, 0, py + h);
      gr.addColorStop(0, selected ? 'rgba(126,224,106,0.32)' : `rgba(44,54,80,${0.85 + hq * 0.1})`);
      gr.addColorStop(1, selected ? 'rgba(40,90,40,0.45)' : 'rgba(20,24,38,0.9)');
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = selected ? 2.5 : 1.2;
      g.strokeStyle = selected ? UI.leaf : `rgba(140,160,210,${0.25 + hq * 0.45})`;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.07)';
      rrPath(g, px + 2, py + 2, w - 4, h * 0.4, 8);
      g.fill();
    });
    // Icon
    const bob = selected ? Math.sin(uiTime * 3) * 1.5 : 0;
    if (locked) {
      drawSprite(def.sprite, x + SLOT_W / 2, yy + 25, 32, 0.25);
      drawSprite('lock', x + SLOT_W / 2, yy + 27, 20, 0.9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Tech tree', x + SLOT_W / 2, yy + SLOT_H - 11, SLOT_W - 6, 10, { weight: 'bold', color: UI.textMute });
      ctx.restore();
      const rx0 = Math.max(x, clipL), rx1 = Math.min(x + SLOT_W, clipR);
      if (rx1 - rx0 > 6)
        addRegion({ id, x: rx0, y, w: rx1 - rx0, h: SLOT_H, onClick: () => isCrop ? selectCrop(it.index) : selectBuilding(it.index), tip: () => lockedTooltip(isCrop ? 'crops' : 'buildings', it.index) });
      return;
    }
    drawSprite(def.sprite, x + SLOT_W / 2, yy + 25 + bob, 32, afford ? 1 : 0.55);
    // Number key
    if (i < 10)
      drawChip(String((i + 1) % 10), x + 3, yy + 3, 14, { px: 9, bg: 'rgba(0,0,0,0.5)', color: UI.textDim });
    // Market trend
    if (isCrop) {
      const pm = priceMultipliers[it.index] || 1;
      if (techOwned('com_insight')) {
        const nx = getNextPrices()[it.index];
        if (Math.abs(nx - pm) > 0.03) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          fitText(nx > pm ? '↗' : '↘', x + SLOT_W - 5, yy + 24, 14, 11, { weight: 'bold', color: nx > pm ? '#9df0ff' : '#ffb0a0' });
        }
      }
      if (pm > 1.05 || pm < 0.95) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        fitText(pm > 1 ? '▲' : '▼', x + SLOT_W - 5, yy + 10, 14, 11, { weight: 'bold', color: pm > 1 ? UI.good : UI.bad });
      }
    }
    if (isCrop && def.favorite === currentSeason)
      drawSprite(SEASON_SPRITES[def.favorite], x + SLOT_W - 9, yy + 36, 12);
    // Price
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`${cost} [[coin]]`, x + SLOT_W / 2, yy + SLOT_H - 11, SLOT_W - 6, 12, { weight: 'bold', color: afford ? '#e8f0ff' : UI.bad });
    ctx.restore();
    const rx0 = Math.max(x, clipL), rx1 = Math.min(x + SLOT_W, clipR);
    if (rx1 - rx0 > 6)
      addRegion({
        id, x: rx0, y, w: rx1 - rx0, h: SLOT_H,
        onClick: () => isCrop ? selectCrop(it.index) : selectBuilding(it.index),
        tip: () => isCrop ? buildCropBarTooltip(it.index) : buildBuildingShopTooltip(it.index)
      });
  }

  function lockedTooltip(kind, index) {
    const def = kind === 'crops' ? CROPS[index] : (kind === 'animals' ? LIVESTOCK[index] : BUILDINGS[index]);
    const n = unlockedByTech(kind, index);
    const lines = [`[[${def.sprite}]] ${def.name}`, '✘ Locked'];
    if (n) {
      lines.push(`Unlock it with [[${n.icon}]] ${nodeTitle(n)} in the ${TREE_BRANCH_SHORT[n.branch]} branch.`);
      lines.push(arePrereqsMet(n) ? (canPay(nodeCost(n)) ? '✔ You can unlock it now' : '⚠ Not affordable yet') : '⚠ Its branch needs earlier upgrades first');
      lines.push('Click to show it in the tech tree');
    }
    return lines;
  }

  function drawActionHint(d) {
    let text;
    const mode = dockMode();
    if (mode === 'plant')
      text = `[[${CROPS[selectedCropIndex].sprite}]] Plant ${CROPS[selectedCropIndex].name} (${getSeedCost(CROPS[selectedCropIndex])} cr) · drag to plant or harvest an area · click a building to inspect it`;
    else if (mode === 'build' && selectedBuildingIndex >= 0)
      text = `[[${BUILDINGS[selectedBuildingIndex].sprite}]] Place ${BUILDINGS[selectedBuildingIndex].name} (${getBuildingCost(BUILDINGS[selectedBuildingIndex])} cr) · right-click a building to upgrade it`;
    else
      text = '[[hoe]] Hoe · click soil beside water to enrich it · click a rock to clear it · right-click a crop to uproot it';
    ctx.save();
    ctx.globalAlpha *= hudFade.dock ? Math.max(0.35, hudFade.dock.a) : 1;
    drawChip(text, d.x + d.w / 2, d.y - 28, 22, { align: 'center', px: 12, weight: '', bg: 'rgba(8,12,24,0.78)', border: 'rgba(126,224,106,0.35)', color: UI.text, maxW: d.w - 40 });
    ctx.restore();
  }

  /* ── Zoom chip ── */

  let zoomChipT = 0, zoomChipLast = 1;

  function drawSoilLegend(L) {
    if (!showNutrients() || state !== STATE_PLAYING) return;
    const full = soilOverlay || selectedTool === TOOL_HOE;
    const y = L.dock.y - 58;
    let x = L.dock.x + 4;
    const items = [['#ff6a5a', 'Poor'], ['#ffc24a', 'Fair'], ['#9be35a', 'Good'], ['#4fe08a', 'Rich']];
    ctx.save();
    ctx.globalAlpha *= hudFade.dock ? Math.max(0.4, hudFade.dock.a) : 1;
    const w = 330, h = 24;
    roundRectPath(x, y, w, h, 12);
    ctx.fillStyle = 'rgba(8,12,24,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x + 10;
    cx += fitText('[[soil]] Nutrients', cx, y + h / 2 + 1, 90, 11, { weight: 'bold', color: UI.text }) + 8;
    for (const [col, label] of items) {
      ctx.fillStyle = col;
      ctx.fillRect(cx, y + h / 2 - 3, 10, 6);
      cx += 13;
      cx += fitText(label, cx, y + h / 2 + 1, 40, 11, { color: UI.textDim }) + 7;
    }
    fitText(full ? 'N hides' : 'N shows all', cx, y + h / 2 + 1, x + w - 8 - cx, 10, { color: UI.textMute });
    ctx.restore();
    addRegion({ id: 'soil-legend', x, y, w, h, onClick: toggleSoilOverlay, tip: () => ['[[soil]] Soil nutrients', 'Pips under each plot: one per 30% fertility.', 'More nutrients, faster crops (up to 150%).', 'Raise them with the hoe beside water, compost bins and the Rich Soil upgrades.', 'Click or press N to show the overlay on every plot.'] });
  }

  function toggleSoilOverlay() {
    soilOverlay = !soilOverlay;
    SZ.GameAudio.play('click');
  }

  function drawZoomChip(L) {
    if (Math.abs(viewZoom - zoomChipLast) > 0.001) {
      zoomChipLast = viewZoom;
      zoomChipT = 2;
    }
    zoomChipT = Math.max(0, zoomChipT - frameDt);
    if (zoomChipT <= 0) return;
    const text = `[[zoom]] ${Math.round(viewZoom * 100)}%  ·  Home fits the farm`;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, zoomChipT * 2) * 0.9;
    drawChip(text, UW - HUD_M, L.dock.y - 58, 22, { align: 'right', px: 11, weight: '', bg: 'rgba(8,12,24,0.75)', border: 'rgba(255,255,255,0.15)', color: UI.textDim });
    ctx.restore();
  }

  /* ── Banner (season changes, weather, purchases) ── */

  function drawBanner(L) {
    if (!banner) return;
    banner.t += frameDt;
    const dur = 3.2;
    if (banner.t > dur) {
      banner = null;
      return;
    }
    const t = banner.t;
    const inA = Math.min(1, t / 0.35), outA = Math.min(1, (dur - t) / 0.5);
    const a = Math.min(inA, outA);
    const ease = 1 - Math.pow(1 - inA, 3);
    const w = Math.min(480, UW - 40), h = banner.sub ? 66 : 48;
    const x = UW / 2 - w / 2, y = L.clock.y + L.clock.h + 12 - (1 - ease) * 20;
    ctx.save();
    ctx.globalAlpha *= a;
    drawPanel(x, y, w, h, { accent: banner.color, glow: true, radius: 12 });
    let tx = x + 16;
    if (banner.icon) {
      drawSprite(banner.icon, x + 34, y + h / 2, 34);
      tx = x + 60;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(banner.title, tx, y + (banner.sub ? 24 : h / 2 + 1), x + w - 16 - tx, 20, { weight: 'bold', color: banner.color });
    if (banner.sub)
      fitText(banner.sub, tx, y + 46, x + w - 16 - tx, 13, { color: UI.textDim });
    ctx.restore();
  }


  /* ── Pop texts (anchored to the farm) and toasts ── */

  const pops = [];
  const toasts = [];

  function popText(wx, wy, text, opts) {
    opts = opts || {};
    const m = /(\d+)px/.exec(opts.font || '');
    const size = m ? Math.max(11, parseInt(m[1], 10) + 1) : 13;
    pops.push({ wx, wy, text: String(text), color: opts.color || '#fff', size, t: 0, life: 1.3, dx: (Math.random() - 0.5) * 10 });
    if (pops.length > 60)
      pops.shift();
  }

  function toast(text, color, icon) {
    toasts.push({ text, color: color || UI.text, icon, t: 0 });
    if (toasts.length > 4)
      toasts.shift();
  }

  function updatePops(dt) {
    for (let i = pops.length - 1; i >= 0; --i) {
      pops[i].t += dt;
      if (pops[i].t >= pops[i].life)
        pops.splice(i, 1);
    }
    for (let i = toasts.length - 1; i >= 0; --i) {
      toasts[i].t += dt;
      if (toasts[i].t >= 3)
        toasts.splice(i, 1);
    }
  }

  function drawPops() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pops) {
      const k = p.t / p.life;
      const sx = (viewPanX + p.wx * viewZoom) / uiS + p.dx * k;
      const sy = (viewPanY + p.wy * viewZoom) / uiS - k * 34 - Math.sin(Math.min(1, k * 4) * Math.PI) * 6;
      const scale = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : (k < 0.25 ? 1.1 - (k - 0.12) / 0.13 * 0.1 : 1);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      fitText(p.text, 0, 0, 260, p.size, { weight: 'bold', color: p.color, outline: 'rgba(0,0,0,0.8)' });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawToasts(L) {
    let y = L.clock.y + L.clock.h + 10 + (banner ? 78 : 0);
    for (const tst of toasts) {
      const a = Math.min(1, tst.t * 5, (3 - tst.t) * 2);
      ctx.save();
      ctx.globalAlpha *= a;
      const text = (tst.icon ? `[[${tst.icon}]] ` : '') + tst.text;
      drawChip(text, UW / 2, y - (1 - Math.min(1, tst.t * 5)) * 8, 24, { align: 'center', px: 12, bg: 'rgba(8,12,24,0.85)', border: hexToRgba(tst.color, 0.6), color: tst.color, maxW: UW - 40 });
      ctx.restore();
      y += 30;
    }
  }

  function drawHUD() {
    const L = hudLayout();
    drawPops();
    drawFarmPanel(L);
    drawStoragePanel(L);
    drawClockPanel(L);
    drawQuickPanel();
    drawGoalPanel(L);
    drawDock(L);
    drawZoomChip(L);
    drawSoilLegend(L);
    drawBanner(L);
    drawToasts(L);
    if (inspect)
      drawInspector();
  }

  /* ══════════════════════════════════════════════════════════════════
     DIALOGS — modal panels that pause the farm
     ══════════════════════════════════════════════════════════════════ */

  let dialog = null;                 // 'tree' | 'market' | 'livestock' | 'help'
  let dialogT = 0;                   // open animation 0..1
  let helpPage = 0;
  let dialogScroll = 0;

  function openDialog(kind) {
    dialog = kind;
    dialogT = 0;
    dialogScroll = 0;
    inspect = null;
    clearTooltip();
    isDragging = false;
    SZ.GameAudio.play('select', { volume: 0.7 });
  }

  function closeDialog() {
    if (!dialog) return;
    if (dialog === 'help' && !tutorialSeen) {
      tutorialSeen = true;
      try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
    }
    dialog = null;
    clearTooltip();
    SZ.GameAudio.play('click');
  }

  function toggleDialog(kind) {
    if (state !== STATE_PLAYING && kind !== 'help') return;
    if (dialog === kind)
      closeDialog();
    else
      openDialog(kind);
  }

  function toggleTree() {
    if (dialog === 'tree')
      closeDialog();
    else
      openTree();
  }

  function closeAllDialogs() {
    dialog = null;
    inspect = null;
    dialogScroll = 0;
  }

  /* Scrim + centred animated panel; returns the content rect */
  function beginDialog(title, w, h, opts) {
    opts = opts || {};
    dialogT = Math.min(1, dialogT + frameDt * 6);
    const e = 1 - Math.pow(1 - dialogT, 3);
    ctx.save();
    ctx.globalAlpha *= e;
    drawScrim(0.55);
    ctx.restore();
    addRegion({ id: 'dlg-scrim', x: 0, y: 0, w: UW, h: UH, modal: true, onClick: opts.closeOnScrim === false ? null : closeDialog });
    w = Math.min(w, UW - 24);
    h = Math.min(h, UH - 24);
    const x = Math.round(UW / 2 - w / 2), y = Math.round(UH / 2 - h / 2);
    ctx.save();
    ctx.globalAlpha *= e;
    const s = 0.94 + 0.06 * e;
    ctx.translate(UW / 2, UH / 2);
    ctx.scale(s, s);
    ctx.translate(-UW / 2, -UH / 2);
    addRegion({ id: 'dlg-panel', x, y, w, h, modal: true });
    const top = drawPanel(x, y, w, h, { title, icon: opts.icon, accent: opts.accent || UI.gold, headerH: 42, titlePx: 20, titleRight: opts.titleRight, titleRightColor: opts.titleRightColor, closeId: 'dlg-close', radius: 14 });
    return { x: x + 16, y: top, w: w - 32, h: y + h - top - 12, px: x, py: y, pw: w, ph: h };
  }

  function endDialog() {
    ctx.restore();
  }

  /* ── Upgrade shop (permanent farm upgrades) ── */




  /* ── Livestock shop ── */

  function drawLivestockDialog() {
    const c = beginDialog('Livestock', 660, 470, { icon: 'paw', accent: '#ff9ac0', titleRight: `${Math.round(credits).toLocaleString('en-US')} [[coin]]`, titleRightColor: UI.gold });
    const cols = c.w >= 520 ? 2 : 1;
    const gap = 10;
    const cardW = (c.w - gap * (cols - 1)) / cols;
    const cardH = Math.min(104, (c.h - 30 - gap * 2) / 3);
    LIVESTOCK.forEach((def, i) => {
      const x = c.x + (i % cols) * (cardW + gap);
      const y = c.y + Math.floor(i / cols) * (cardH + gap);
      const owned = livestockPens.filter(p => p.typeIndex === i).length;
      const afford = credits >= def.cost;
      const id = 'buy-animal-' + i;
      const hv = hoverAmount(id);
      if (!isAnimalUnlocked(i)) {
        const n = unlockedByTech('animals', i);
        roundRectPath(x, y, cardW, cardH, 12);
        ctx.fillStyle = 'rgba(16,18,26,0.95)';
        ctx.fill();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(120,130,160,0.4)';
        ctx.stroke();
        ctx.setLineDash([]);
        roundRectPath(x + 10, y + 10, 60, 60, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        drawSprite(def.sprite, x + 40, y + 40, 48, 0.25);
        drawSprite('lock', x + 40, y + 42, 24);
        const tx = x + 80, tw = cardW - 92;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(def.name, tx, y + 20, tw, 16, { weight: 'bold', color: '#7a8298' });
        fitText(`[[${def.produceSprite}]] ${def.produce}, worth ${getEffectiveProduceValue(def)} cr`, tx, y + 42, tw, 12, { color: UI.textMute });
        if (n)
          drawButton({ id, x: tx, y: y + cardH - 34, w: tw, h: 26 }, { label: `Unlock: ${nodeTitle(n)}`, icon: 'techtree', px: 11, onClick: () => openTree(n.id), tip: () => lockedTooltip('animals', i) });
        return;
      }
      roundRectPath(x, y, cardW, cardH, 12);
      ctx.fillStyle = afford ? `rgba(255,154,192,${0.08 + hv * 0.06})` : 'rgba(40,36,30,0.9)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = afford ? 'rgba(255,154,192,0.5)' : 'rgba(255,182,72,0.45)';
      ctx.stroke();
      roundRectPath(x + 10, y + 10, 60, 60, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      drawSprite(def.sprite, x + 40, y + 40 + Math.sin(uiTime * 3 + i) * 1.5, 48);
      if (owned)
        drawChip(`×${owned}`, x + 40, y + 76, 18, { align: 'center', px: 11, bg: 'rgba(0,0,0,0.5)', color: UI.text });
      const tx = x + 80, tw = cardW - 80 - 12;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(def.name, tx, y + 20, tw, 16, { weight: 'bold', color: UI.text });
      fitText(`[[${def.produceSprite}]] ${def.produce} every ${getFeedInterval(def)}s`, tx, y + 42, tw, 12, { color: UI.textDim });
      fitText(`Worth ${getEffectiveProduceValue(def)} cr each`, tx, y + 60, tw, 12, { color: UI.gold });
      drawButton({ id, x: tx, y: y + cardH - 34, w: tw, h: 26 }, { label: `Buy · ${def.cost} [[coin]]`, primary: afford, color: '#ff9ac0', px: 12, disabled: !afford, onClick: () => buyLivestock(i), onDisabled: () => SZ.GameAudio.play('error'), tip: () => buildLivestockBuyTooltip(i) });
    });
    drawKeyHints([{ key: 'Click', label: 'Buy' }, { key: 'L', label: 'Close' }], c.x + c.w / 2, c.y + c.h - 8, c.w);
    endDialog();
  }

  function getFeedInterval(def) {
    return Math.round(def.feedInterval * (1 - techChainCount('husb_care') * 0.12) * 10) / 10;
  }

  /* ── Help ── */

  const HELP_PAGES = [
    { icon: 'seedbag', title: 'Welcome, farmer!', strip: [['wheat', 'Plant'], ['basket', 'Harvest'], ['coin', 'Sell'], ['techtree', 'Upgrade']],
      text: 'Your little farm sits on an alien planet. Plant seeds, harvest what grows, sell it for credits and turn those credits into a thriving space farm.\n\nPick a crop in the dock at the bottom (or press 1-9, 0), then click empty soil. Drag across the field to plant or harvest a whole area at once.' },
    { icon: 'coin', title: 'Harvest & sell', strip: [['basket', 'Storage'], ['coin', 'Sell all'], ['market', 'Market']],
      text: 'Ripe crops glow and sparkle. Click them to harvest; the produce flies into your storage. Storage is limited, so sell regularly with S, or open the market with M to sell single crops.\n\nPrices drift every minute: a green ▲ in the dock means a crop sells above its normal price, a red ▼ below.' },
    { icon: 'flask', title: 'Soil & terrain', strip: [['soil', 'Nutrients'], ['drop', 'Water'], ['hoe', 'Hoe'], ['rockpile', 'Rock']],
      text: 'Every plot has its own nutrients: the pips under empty plots show them (one pip per 30%), pale dusty soil is poor and dark soil is rich. Press N to colour every plot by its nutrients.\n\nNo crop grows on rock, but buildings can stand on it, or break it up with the Hoe (T) for 25 credits. The hoe also enriches soil beside water and turns sand into farmland.' },
    { icon: 'hammer', title: 'Buildings', strip: [['sprinkler', 'Water'], ['greenhouse', 'Shelter'], ['silo', 'Store'], ['harvester', 'Harvest'], ['turbine', 'Power']],
      text: 'Press B for the build dock. Sprinklers and wind turbines speed up crops around them, greenhouses shield them from weather, silos add storage, harvesters and planters work on their own.\n\nClick a building to inspect, upgrade (up to level 6) or remove it. Right-click upgrades directly, Shift+right-click removes.' },
    { icon: 'paw', title: 'Livestock', strip: [['hen', 'Eggs'], ['goat', 'Wool'], ['cow', 'Milk'], ['bee', 'Honey']],
      text: 'Animals live in pens around the field. Press L to buy them. When their produce is ready a bubble pops up: click the pen to collect it. Auto-collectors next to the pens do this for you, and star bees make nearby crops grow faster.' },
    { icon: 'storm', title: 'Weather', strip: [['rain', 'Rain'], ['flare', 'Flare'], ['storm', 'Storm'], ['meteor', 'Meteors'], ['snow', 'Snow'], ['dust', 'Dust']],
      text: 'Rain and solar flares make crops grow faster, snow and dust storms slow them down. Meteors and lightning hit real spots on the farm and can destroy crops that no greenhouse protects.\n\nVoid mushrooms ignore the weather, plasma peppers hate meteors, astral flowers and solar vines love the sun.' },
    { icon: 'spring', title: 'Seasons & day', strip: [['spring', 'Spring'], ['sun', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']],
      text: 'A day lasts 30 seconds and a season four days. Spring and summer speed up growth, autumn gives bigger harvests, winter slows everything down.\n\nEvery crop loves one season and grows 30% faster in it: look for the season badge in the dock. Lunar moss only grows at night, solar vines only by day or under a grow lamp.' },
    { icon: 'target', title: 'Goals & orders', strip: [['target', 'Goals'], ['order', 'Orders'], ['market', 'Market']],
      text: 'The Goals & orders panel shows your next milestone; reaching it pays a credit reward.\n\nTraders also post orders for a batch of produce. Orders pay far more than the market, but they expire after a few days: click an order to deliver it, or open the market with M.' },
    { icon: 'mouse', title: 'Pests & energy', strip: [['mouse', 'Mice'], ['scarecrow', 'Scare'], ['fence', 'Block'], ['zapper', 'Zap'], ['bolt', 'Energy']],
      text: 'Space mice sneak in from the edges and eat crops. Click a mouse to chase it off for a reward; scarecrows, fences and pest zappers keep them out.\n\nEnergy powers harvesters and drones. Solar panels charge by day, wind turbines at night and in storms.' },
    { icon: 'techtree', title: 'Tech tree', strip: [['growth', 'Crops'], ['paw', 'Animals'], ['hammer', 'Build'], ['flask', 'Science'], ['coin', 'Trade']],
      text: 'Press U for the tech tree. Its five branches improve crops, animals, buildings, science and trade, and unlock new crops, animals and buildings. Upgrades cost credits and produce, so keep some harvest in storage.\n\nThe Next upgrades panel always shows the best next step of every branch: click a row to buy it straight away.' },
    { icon: 'book', title: 'Controls', keys: [
      ['Click', 'Plant, harvest, collect, inspect'], ['Drag', 'Plant or harvest an area'],
      ['Right-drag', 'Pan the view'], ['Wheel  + −', 'Zoom'],
      ['Right-click', 'Upgrade building'], ['Shift+Right', 'Remove building'],
      ['←↑→↓  Space', 'Tile cursor and act'], ['Home', 'Fit the farm'],
      ['1-9  0', 'Pick crop or building'], ['P  B  T', 'Seeds, build, hoe'],
      ['S  M', 'Sell all, market'], ['L  U', 'Animals, tech tree'],
      ['N', 'Nutrient overlay'], ['H', 'This help'], ['Esc  F2', 'Pause, new farm']
    ] }
  ];

  function drawHelpDialog() {
    const c = beginDialog('How to play', 660, 470, { icon: 'book', accent: UI.accent, titleRight: `${helpPage + 1} / ${HELP_PAGES.length}` });
    const page = HELP_PAGES[helpPage];
    roundRectPath(c.x, c.y, 96, 96, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,184,255,0.35)';
    ctx.stroke();
    drawSprite(page.icon, c.x + 48, c.y + 48 + Math.sin(uiTime * 2) * 2, 64);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(page.title, c.x + 112, c.y + 20, c.w - 112, 22, { weight: 'bold', color: UI.gold });
    const bottom = c.y + c.h - 52;
    if (page.keys) {
      // two columns of keycaps with their actions
      const colW = (c.w - 112) / 2, rowH = Math.min(30, (bottom - c.y - 46) / Math.ceil(page.keys.length / 2));
      page.keys.forEach(([key, label], i) => {
        const x = c.x + 112 + (i % 2) * colW, y = c.y + 50 + Math.floor(i / 2) * rowH;
        ctx.font = uiFont(11, 'bold');
        const kw = Math.min(colW * 0.45, ctx.measureText(key).width + 14);
        roundRectPath(x, y - 10, kw, 20, 5);
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(170,190,230,0.35)';
        ctx.stroke();
        ctx.textAlign = 'center';
        fitText(key, x + kw / 2, y + 1, kw - 8, 11, { weight: 'bold', color: '#dfe6f5' });
        ctx.textAlign = 'left';
        fitText(label, x + kw + 8, y + 1, colW - kw - 16, 13, { color: UI.text });
      });
    } else {
      const stripH = page.strip ? 64 : 0;
      drawTextBlock(page.text, c.x + 112, c.y + 42, c.w - 112, bottom - c.y - 42 - stripH, 14, { color: UI.text, lineGap: 1.4 });
      if (page.strip) {
        const n = page.strip.length, gap = 10;
        const w = Math.min(84, (c.w - 112 - gap * (n - 1)) / n);
        const x0 = c.x + 112;
        page.strip.forEach(([icon, label], i) => {
          const x = x0 + i * (w + gap), y = bottom - stripH + 4;
          roundRectPath(x, y, w, stripH - 8, 10);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.stroke();
          drawSprite(icon, x + w / 2, y + 20 + Math.sin(uiTime * 2.5 + i) * 1.5, 28);
          ctx.textAlign = 'center';
          fitText(label, x + w / 2, y + stripH - 18, w - 8, 11, { weight: 'bold', color: UI.textDim });
        });
      }
    }
    // Page dots
    const dotsW = HELP_PAGES.length * 14;
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      const dx = c.x + c.w / 2 - dotsW / 2 + i * 14 + 7, dy = c.y + c.h - 24;
      ctx.beginPath();
      ctx.arc(dx, dy, i === helpPage ? 4.5 : 3, 0, TWO_PI);
      ctx.fillStyle = i === helpPage ? UI.gold : 'rgba(255,255,255,0.25)';
      ctx.fill();
      addRegion({ id: 'help-dot-' + i, x: dx - 7, y: dy - 9, w: 14, h: 18, modal: true, onClick: () => { helpPage = i; SZ.GameAudio.play('click'); }, tip: () => [HELP_PAGES[i].title] });
    }
    const by = c.y + c.h - 40;
    drawButton({ id: 'help-prev', x: c.x, y: by, w: 110, h: 32 }, { label: '‹ Back', px: 13, disabled: helpPage === 0, onClick: () => { helpPage = Math.max(0, helpPage - 1); SZ.GameAudio.play('click'); } });
    const last = helpPage >= HELP_PAGES.length - 1;
    drawButton({ id: 'help-next', x: c.x + c.w - 110, y: by, w: 110, h: 32 }, { label: last ? 'Done' : 'Next ›', primary: true, px: 13, onClick: () => helpNext() });
    endDialog();
  }

  function helpNext() {
    if (helpPage >= HELP_PAGES.length - 1)
      closeDialog();
    else {
      ++helpPage;
      SZ.GameAudio.play('click');
    }
  }

  function openHelp(page) {
    helpPage = page || 0;
    openDialog('help');
  }

  /* ── Building inspector (non-modal popover) ── */

  let inspect = null;                // { row, col }

  function drawInspector() {
    const bld = buildings[inspect.row]?.[inspect.col];
    if (!bld) {
      inspect = null;
      return;
    }
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const stats = buildingStatLines(bld, inspect.row, inspect.col);
    const w = 270;
    const h = 52 + 16 + stats.length * 20 + 50;
    const g = gridToScreen(inspect.col, inspect.row);
    let x = (g.x + g.size) / uiS + 12, y = g.y / uiS - 10;
    if (x + w > UW - 10) x = g.x / uiS - w - 12;
    x = Math.max(10, Math.min(UW - w - 10, x));
    y = Math.max(84, Math.min(UH - DOCK_H - 30 - h, y));
    addRegion({ id: 'insp-panel', x, y, w, h });
    const top = drawPanel(x, y, w, h, { title: bdef.name, icon: bdef.sprite, accent: '#4cc4ff', headerH: 40, titlePx: 16, titleRight: `Lv ${lvl}/${BUILDING_MAX_LEVEL}`, titleRightColor: UI.gold, closeId: 'insp-close', onClose: () => { inspect = null; } });
    // Level pips
    const pw = 16;
    for (let i = 0; i < BUILDING_MAX_LEVEL; ++i) {
      ctx.fillStyle = i < lvl ? '#4cc4ff' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 14 + i * (pw + 3), top, pw, 5);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    stats.forEach((s, i) => fitText(s, x + 14, top + 22 + i * 20, w - 28, 12, { color: i === 0 ? UI.textDim : UI.text }));
    const by = y + h - 42;
    if (canUpgradeBuilding(bld)) {
      const cost = getBuildingUpgradeCost(bld);
      drawButton({ id: 'insp-upgrade', x: x + 12, y: by, w: w - 24 - 96, h: 30 }, { label: `Upgrade · ${cost} [[coin]]`, primary: credits >= cost, color: '#4cc4ff', px: 12, disabled: credits < cost, onClick: () => upgradeBuilding(inspect.row, inspect.col), onDisabled: () => SZ.GameAudio.play('error'), tip: () => [`Upgrade to level ${lvl + 1}`, credits >= cost ? `✔ Costs ${cost} credits` : `✘ Needs ${cost} credits`, 'Shortcut: right-click the building'] });
    } else
      drawChip('Max level', x + 12, by + 5, 20, { px: 11, bg: 'rgba(111,224,138,0.18)', border: 'rgba(111,224,138,0.6)', color: UI.good });
    drawButton({ id: 'insp-remove', x: x + w - 12 - 88, y: by, w: 88, h: 30 }, { label: 'Remove', px: 12, color: UI.bad, onClick: () => { removeBuilding(inspect.row, inspect.col); inspect = null; }, tip: () => ['Remove building', '⚠ No refund.', 'Shortcut: Shift+right-click'] });
  }

  /* ── Pause and title screens ── */

  function drawPauseScreen() {
    drawScrim(0.55);
    addRegion({ id: 'pause-scrim', x: 0, y: 0, w: UW, h: UH, modal: true });
    const w = 340, h = 250;
    const x = UW / 2 - w / 2, y = UH / 2 - h / 2;
    drawPanel(x, y, w, h, { accent: UI.gold, radius: 14 });
    drawHeadline('Paused', UW / 2, y + 44, w - 40, 36, UI.gold, '#ff9a3a');
    const bw = w - 60;
    drawButton({ id: 'pause-resume', x: x + 30, y: y + 84, w: bw, h: 40 }, { label: 'Resume', key: 'Esc', primary: true, color: UI.leaf, px: 15, onClick: togglePause });
    drawButton({ id: 'pause-help', x: x + 30, y: y + 134, w: bw, h: 36 }, { label: 'How to play', icon: 'book', key: 'H', px: 14, onClick: () => openHelp(0) });
    drawButton({ id: 'pause-new', x: x + 30, y: y + 180, w: bw, h: 36 }, { label: 'New farm', icon: 'seedbag', key: 'F2', px: 14, onClick: requestNewGame });
  }

  const titleStars = [];
  for (let i = 0; i < 160; ++i)
    titleStars.push({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * TWO_PI });

  function drawTitleBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, UH);
    g.addColorStop(0, '#070a1c');
    g.addColorStop(0.6, '#1a1640');
    g.addColorStop(1, '#3a2050');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, UW, UH);
    for (const s of titleStars) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(uiTime * (0.5 + s.s) + s.p));
      ctx.fillStyle = s.s > 0.85 ? '#ffe8b0' : '#cfe0ff';
      const sz = s.s > 0.9 ? 2 : 1;
      ctx.fillRect(s.x * UW, s.y * UH * 0.8, sz, sz);
    }
    ctx.globalAlpha = 1;
    // Ringed planet
    const px = UW * 0.84, py = UH * 0.17, pr = Math.min(UW, UH) * 0.11;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#ffd7a0');
    pg.addColorStop(0.6, '#d0705a');
    pg.addColorStop(1, '#4a2040');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.28);
    ctx.lineWidth = pr * 0.25;
    ctx.strokeStyle = 'rgba(255,220,170,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, pr * 1.6, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
    // Rolling hills
    const hills = [['#1d3a3a', 0.72, 30, 0.004], ['#16302a', 0.8, 22, 0.006], ['#0f2420', 0.88, 16, 0.009]];
    for (const [col, base, amp, f] of hills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, UH);
      for (let x = 0; x <= UW; x += 8)
        ctx.lineTo(x, UH * base + Math.sin(x * f + uiTime * 0.1) * amp + Math.sin(x * f * 2.7) * amp * 0.4);
      ctx.lineTo(UW, UH);
      ctx.closePath();
      ctx.fill();
    }
    // Crops on the front hill
    for (let i = 0; i < 18; ++i) {
      const cx = (i + 0.5) * UW / 18;
      const cy = UH * 0.9 + Math.sin(cx * 0.009) * 16 - 6;
      const crop = CROPS[i % CROPS.length];
      drawSprite(crop.sprite, cx, cy + Math.sin(uiTime * 1.5 + i) * 1.5, 34);
    }
  }

  function drawTitleScreen() {
    drawTitleBackground();
    addRegion({ id: 'title-bg', x: 0, y: 0, w: UW, h: UH, modal: true, onClick: savedGameAvailable ? null : resetGame });
    const cx = UW / 2;
    drawHeadline('SPACE FARMING', cx, UH * 0.24, UW - 60, 64, '#9df08a', '#2a9a5a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('Grow alien crops, raise space critters and build the finest farm in the galaxy.', cx, UH * 0.24 + 52, UW - 80, 16, { color: '#c8d6f0' });
    const bw = 260, bh = 46;
    let y = UH * 0.42;
    if (savedGameAvailable) {
      drawButton({ id: 'title-continue', x: cx - bw / 2, y, w: bw, h: bh }, { label: 'Continue', icon: 'seedbag', key: 'Enter', primary: true, color: UI.leaf, px: 17, onClick: continueSavedGame });
      y += bh + 12;
    }
    drawButton({ id: 'title-new', x: cx - bw / 2, y, w: bw, h: bh }, { label: savedGameAvailable ? 'New farm' : 'Start farming', icon: 'hammer', key: 'F2', primary: !savedGameAvailable, color: UI.leaf, px: 17, onClick: requestNewGame });
    y += bh + 12;
    drawButton({ id: 'title-help', x: cx - bw / 2, y, w: bw, h: 40 }, { label: 'How to play', icon: 'book', key: 'H', px: 15, onClick: () => openHelp(0) });
    y += 52;
    if (saveNotice)
      drawChip(saveNotice, cx, y + 4, 24, { align: 'center', px: 12, weight: '', bg: 'rgba(80,20,10,0.75)', border: 'rgba(255,140,90,0.6)', color: '#ffb48a', maxW: UW - 40 });
  }

  /* ══════════════════════════════════════════════════════════════════
     TOOLTIP
     ══════════════════════════════════════════════════════════════════ */

  const TOOLTIP_DELAY = 0.3;
  const tooltip = { lines: [], key: '', timer: 0, visible: false, x: 0, y: 0 };

  function clearTooltip() {
    tooltip.lines = [];
    tooltip.key = '';
    tooltip.timer = 0;
    tooltip.visible = false;
  }

  function setTooltip(key, lines) {
    if (key !== tooltip.key) {
      tooltip.key = key;
      tooltip.timer = 0;
      tooltip.visible = false;
    }
    tooltip.lines = lines || [];
  }

  function updateTooltipTimer(dt) {
    if (tooltip.lines.length && !tooltip.visible) {
      tooltip.timer += dt;
      if (tooltip.timer >= TOOLTIP_DELAY)
        tooltip.visible = true;
    }
  }

  /* Re-evaluates what the pointer is over (regions first, then the farm) */
  function refreshHover() {
    if (!pointerInside || isPanning) {
      hoverRegionId = null;
      clearTooltip();
      return;
    }
    const r = hitRegion(pointerUX, pointerUY);
    const through = r && !r.modal && hudPassThrough(pointerUX, pointerUY);
    if (r && !through) {
      hoverRegionId = r.onClick || r.disabledClick ? r.id : null;
      const lines = r.tip ? r.tip() : null;
      if (lines)
        setTooltip(r.tipKey ? r.tipKey() : 'r:' + r.id, lines);
      else
        clearTooltip();
      return;
    }
    hoverRegionId = null;
    if (state !== STATE_PLAYING || dialog || isDragging) {
      clearTooltip();
      return;
    }
    const w = worldTooltip(pointerX, pointerY);
    if (w)
      setTooltip(w.key, w.lines);
    else
      clearTooltip();
  }

  function drawTooltip() {
    if (!tooltip.visible || !tooltip.lines.length) return;
    const padding = 10;
    const maxTextW = Math.min(340, UW * 0.4);
    let fontSize = 13;
    let rows, boxW, boxH;
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < tooltip.lines.length; ++i) {
        const raw = tooltip.lines[i];
        const line = typeof raw === 'object' ? raw.text : String(raw);
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 6 });
          ctx.font = uiFont(Math.max(9, fontSize - 3), 'bold');
          maxW = Math.max(maxW, ctx.measureText(header[1].toUpperCase()).width + 30);
          continue;
        }
        const title = i === 0;
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: title ? 'title' : 'text', text: w, h: (title ? fontSize + 2 : fontSize) * 1.42, src: line, color: typeof raw === 'object' ? raw.color : null });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + padding * 2;
      boxH = padding * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= UH - 16 || fontSize <= 10)
        break;
      --fontSize;
    }
    boxW = Math.max(boxW, 120);
    let bx = pointerUX + 18, by = pointerUY + 20;
    if (bx + boxW > UW - 8) bx = pointerUX - boxW - 12;
    if (by + boxH > UH - 8) by = pointerUY - boxH - 12;
    bx = Math.max(8, Math.min(UW - 8 - boxW, bx));
    by = Math.max(8, Math.min(UH - 8 - boxH, by));
    const a = Math.min(1, (tooltip.timer - TOOLTIP_DELAY) * 10 + 1);
    ctx.save();
    ctx.globalAlpha *= a;
    drawPanel(bx, by, boxW, boxH, { accent: UI.gold, radius: 9, shadow: 12 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + padding;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(9, fontSize - 3), 'bold');
        ctx.fillStyle = UI.textMute;
        ctx.fillText(r.text, bx + padding, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx + padding + tw + 8, cy, boxW - padding * 2 - tw - 8, 1);
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = r.color || (title ? UI.gold : '#c4cde0');
        if (!r.color && !title) {
          if (r.src.startsWith('✔')) color = UI.good;
          else if (r.src.startsWith('✘')) color = UI.bad;
          else if (r.src.startsWith('⚠')) color = UI.warn;
        }
        ctx.fillStyle = color;
        fillIconText(r.text, bx + padding, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  /* ── Tooltip content ── */

  function adjacentWaterCount(row, col) {
    let n = 0;
    if (tileTypes[row - 1]?.[col] === TILE_WATER) ++n;
    if (tileTypes[row + 1]?.[col] === TILE_WATER) ++n;
    if (tileTypes[row]?.[col - 1] === TILE_WATER) ++n;
    if (tileTypes[row]?.[col + 1] === TILE_WATER) ++n;
    return n;
  }

  function fertilityLine(row, col) {
    const sq = getTileSoilQuality(row, col);
    const pct = Math.round(sq * 100);
    const pips = '●'.repeat(nutrientPips(sq)) + '○'.repeat(5 - nutrientPips(sq));
    if (sq < 1)
      return `⚠ Nutrients ${pips} ${pct}%: crops grow ${100 - pct}% slower`;
    if (sq > 1)
      return `✔ Nutrients ${pips} ${pct}%: crops grow ${pct - 100}% faster`;
    return `Nutrients ${pips} ${pct}%`;
  }

  function buildCropTileTooltip(cell, row, col) {
    const crop = CROPS[cell.cropIndex];
    const mature = cell.growthStage >= crop.stages - 1;
    const progress = Math.min(100, Math.round(cell.growthProgress * 100));
    const effPrice = getEffectiveSellPrice(crop);
    const lines = [`[[${crop.sprite}]] ${crop.name}`];
    lines.push(mature ? '✔ Ripe: click to harvest' : `Stage ${cell.growthStage + 1} of ${crop.stages} · ${progress}% grown`);
    lines.push(`Sells for ${effPrice} cr` + (effPrice !== crop.sellPrice ? ` (normally ${crop.sellPrice})` : ''));
    lines.push('--- Plot ---');
    lines.push(fertilityLine(row, col));
    if (tileTypes[row]?.[col] === TILE_SAND)
      lines.push('⚠ Sandy soil: 70% growth');
    const water = adjacentWaterCount(row, col);
    if (water)
      lines.push(`✔ Water nearby: +${water * 15}% growth`);
    if (crop.favorite === currentSeason)
      lines.push(`✔ In season: +30% growth`);
    if (crop.nightOnly && dayPhase < 0.5)
      lines.push('⚠ Sleeping until night');
    if (crop.dayOnly && dayPhase >= 0.5)
      lines.push('⚠ Sleeping until morning');
    return lines;
  }

  function buildingStatLines(bld, row, col) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lines = [bdef.desc];
    switch (bdef.name) {
      case 'Sprinkler':
        lines.push(`Growth +${Math.round(getSprinklerBonus(bld) * 100)}% · range ${getBuildingRange(bld)}`);
        break;
      case 'Harvester':
        lines.push(`Harvests every ${getHarvesterInterval(bld).toFixed(1)}s · range ${getBuildingRange(bld)}`);
        break;
      case 'Greenhouse':
        lines.push(`Shields range ${getBuildingRange(bld)} · growth +${Math.round(getGreenhouseGrowthBonus(bld) * 100)}%`);
        break;
      case 'Silo':
        lines.push(`Storage +${getSiloStorageBonus(bld)} · sell prices +${Math.round(getSiloSellBonus(bld) * 100)}%`);
        break;
      case 'Solar Panel':
        lines.push(`+${getSolarPanelIncome(bld)} cr per 30s · energy +${getSolarPanelEnergyBonus(bld)}`);
        lines.push(`Charges +${getSolarPanelRegenBonus(bld).toFixed(1)}/s by day`);
        break;
      case 'Wind Turbine':
        lines.push(`+${getWindTurbineIncome(bld)} cr per 30s · growth +${Math.round(getWindTurbineGrowthBonus(bld) * 100)}%`);
        lines.push(`Energy +${getWindTurbineEnergyBonus(bld)} · +${getWindTurbineRegenBonus(bld).toFixed(1)}/s`);
        break;
      case 'Compost Bin':
        lines.push(`Fertility +${Math.round(getCompostBinBonus(bld) * 100)}% · range ${getBuildingRange(bld)}`);
        break;
      case 'Scarecrow': {
        const r = getScarecrowRadius(bld);
        lines.push(`Scares mice in a ${r * 2 + 1}×${r * 2 + 1} area`);
        break;
      }
      case 'Fence':
        lines.push((bld.level || 1) >= 5 ? 'Blocks and zaps mice' : ((bld.level || 1) >= 3 ? 'Slows mice down' : 'Blocks mice'));
        break;
      case 'Auto-Planter L1':
      case 'Auto-Planter L2':
        lines.push(`Plants every ${getAutoPlanterInterval(bld)}s · range ${getBuildingRange(bld)}`);
        break;
      case 'Auto-Collector': {
        const range = getBuildingRange(bld);
        let pens = 0;
        for (const pen of livestockPens)
          if (Math.abs(pen.gridRow - row) <= range && Math.abs(pen.gridCol - col) <= range)
            ++pens;
        lines.push(`Collects every ${getAutoCollectorInterval(bld)}s · range ${range}`);
        lines.push(`${pens} animal${pens === 1 ? '' : 's'} in range`);
        break;
      }
    }
    return lines;
  }

  function buildBuildingTileTooltip(bld, row, col) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const lines = [`[[${bdef.sprite}]] ${bdef.name} · Lv ${lvl}`].concat(buildingStatLines(bld, row, col));
    if (canUpgradeBuilding(bld)) {
      const cost = getBuildingUpgradeCost(bld);
      lines.push(credits >= cost ? `✔ Upgrade to Lv ${lvl + 1}: ${cost} cr` : `✘ Upgrade to Lv ${lvl + 1}: ${cost} cr`);
    } else
      lines.push('✔ Max level');
    lines.push('Click to inspect · right-click upgrades');
    return lines;
  }

  function buildEmptyTileTooltip(row, col) {
    const tt = tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_WATER)
      return ['Water', '✔ Crops next to it grow 15% faster', 'Click with the hoe to enrich the soil around it', '✘ Nothing can be planted or built here'];
    if (tt === TILE_ROCK) {
      const lines = ['[[rockpile]] Rock', '✘ Crops can\'t grow on rock', '✔ Buildings can stand on it'];
      if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
        const b = BUILDINGS[selectedBuildingIndex];
        lines.push((credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Click to build ${b.name} (${getBuildingCost(b)} cr)`);
      } else
        lines.push(selectedTool === TOOL_HOE ? ((credits >= ROCK_CLEAR_COST ? '✔ ' : '✘ ') + `Click to clear it (${ROCK_CLEAR_COST} cr)`) : `[[hoe]] Clear it with the hoe (T) for ${ROCK_CLEAR_COST} cr`);
      return lines;
    }
    const lines = [tt === TILE_SAND ? 'Sandy plot' : 'Empty plot'];
    if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
      const b = BUILDINGS[selectedBuildingIndex];
      lines.push((credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Click to build ${b.name} (${getBuildingCost(b)} cr)`);
    } else if (selectedTool === TOOL_HOE) {
      lines.push(isAdjacentToWater(row, col) ? '✔ Click to enrich the soil' : '⚠ Too far from water to enrich');
    } else {
      const crop = CROPS[selectedCropIndex];
      lines.push((credits >= getSeedCost(crop) ? '✔ ' : '✘ ') + `Click to plant ${crop.name} (${getSeedCost(crop)} cr)`);
    }
    lines.push(fertilityLine(row, col));
    if (tt === TILE_SAND)
      lines.push('⚠ Sandy soil: 70% growth');
    const water = adjacentWaterCount(row, col);
    if (water)
      lines.push(`✔ Water nearby: +${water * 15}% growth`);
    return lines;
  }

  function buildCropBarTooltip(cropIndex) {
    const crop = CROPS[cropIndex];
    const effPrice = getEffectiveSellPrice(crop);
    const pm = priceMultipliers[cropIndex] || 1;
    const lines = [`[[${crop.sprite}]] ${crop.name}`, `Seed ${getSeedCost(crop)} cr · sells for ${effPrice} cr`, `Grows in ${crop.growTime}s over ${crop.stages} stages`];
    if (pm > 1.05)
      lines.push(`✔ Market ${pm.toFixed(2)}×: good time to sell`);
    else if (pm < 0.95)
      lines.push(`⚠ Market ${pm.toFixed(2)}×: prices are low`);
    if (techOwned('com_insight')) {
      const nx = getNextPrices()[cropIndex];
      lines.push(`[[scroll]] In ${Math.ceil(priceChangeTimer)}s: ${nx.toFixed(2)}× ` + (nx > pm + 0.03 ? '(rising)' : (nx < pm - 0.03 ? '(falling)' : '(steady)')));
    }
    if (crop.weatherAffinity === 'any')
      lines.push('✔ Ignores weather and meteors');
    else if (crop.weatherAffinity === 'solar')
      lines.push('✔ Solar flares triple its growth');
    else if (crop.weatherAffinity === 'cold-vulnerable')
      lines.push('⚠ Meteor showers hit it hard');
    if (crop.nightOnly)
      lines.push('Grows only at night');
    if (crop.dayOnly)
      lines.push('Grows only by day (or under a grow lamp)');
    if (crop.hardy)
      lines.push('✔ Ignores winter and snowfall');
    lines.push(crop.favorite === currentSeason ? `✔ In season: [[${SEASON_SPRITES[crop.favorite]}]] +30% growth` : `Loves [[${SEASON_SPRITES[crop.favorite]}]] ${SEASONS[crop.favorite].toLowerCase()} (+30% growth)`);
    return lines;
  }

  function buildBuildingShopTooltip(i) {
    const b = BUILDINGS[i];
    const lines = [`[[${b.sprite}]] ${b.name}`, b.desc, (credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Costs ${getBuildingCost(b)} cr`];
    lines.push(b.range > 0 ? `Works on tiles within ${b.range} (grows with level)` : 'Affects the whole farm');
    if (b.name === 'Silo')
      lines.push(`Storage now ${getTotalInventoryCount()}/${getStorageCapacity()}: +50 per silo`);
    if (b.name === 'Solar Panel')
      lines.push('Also +30 max energy and +1/s charge by day');
    if (b.name === 'Wind Turbine')
      lines.push('Also +20 max energy and +0.5/s charge');
    if (b.name === 'Auto-Collector')
      lines.push('Place it beside the animal pens');
    lines.push('Upgradeable to level 6');
    return lines;
  }

  function buildSellButtonTooltip() {
    const items = storageItems();
    const lines = ['[[coin]] Sell all produce'];
    if (!items.length)
      lines.push('⚠ Storage is empty');
    else {
      let total = 0, count = 0;
      for (const it of items) {
        total += it.count * it.value;
        count += it.count;
      }
      lines.push(`✔ ${count} items for ${total} cr`);
    }
    lines.push('Shortcut: S');
    return lines;
  }

  function buildLivestockBuyTooltip(typeIndex) {
    const def = LIVESTOCK[typeIndex];
    return [`[[${def.sprite}]] ${def.name}`, (credits >= def.cost ? '✔ ' : '✘ ') + `Costs ${def.cost} cr`, `[[${def.produceSprite}]] ${def.produce} every ${getFeedInterval(def)}s, worth ${getEffectiveProduceValue(def)} cr`, 'Lives in a pen at the edge of the farm'];
  }

  function buildLivestockPenTooltip(pen) {
    const def = LIVESTOCK[pen.typeIndex];
    const lines = [`[[${def.sprite}]] ${def.name}`];
    if (pen.produceReady)
      lines.push(`✔ [[${def.produceSprite}]] ${def.produce} ready: click to collect`);
    else
      lines.push(`Next ${def.produce} in ${Math.max(0, Math.ceil(pen.feedTimer))}s`);
    lines.push(`Worth ${getEffectiveProduceValue(def)} cr each`);
    return lines;
  }

  function buildClockTooltip() {
    const isNight = dayPhase >= 0.5;
    const effects = [
      '✔ Spring: crops grow 10% faster',
      '✔ Summer: crops grow 25% faster, more solar flares',
      '✔ Autumn: 15% bigger harvests, 10% slower growth',
      '⚠ Winter: 40% slower growth, snowfall'
    ];
    return [
      `[[${SEASON_SPRITES[currentSeason]}]] ${SEASONS[currentSeason]} · Day ${dayCount}`,
      effects[currentSeason],
      'A day lasts 30 seconds, a season four days.',
      isNight ? 'Night: lunar moss grows, solar vines sleep.' : 'Day: solar vines grow, lunar moss sleeps.'
    ];
  }

  function buildWeatherTooltip() {
    const wi = weatherInfo();
    const lines = [`[[${wi.icon}]] ${wi.name}`];
    switch (weatherType) {
      case WEATHER_SOLAR_FLARE: lines.push('✔ Crops grow twice as fast, sun-lovers three times'); break;
      case WEATHER_METEOR_SHOWER: lines.push('✘ Meteors smash unprotected crops', 'Greenhouses and the weather shield help'); break;
      case WEATHER_RAIN: lines.push('✔ Crops grow 50% faster'); break;
      case WEATHER_THUNDERSTORM: lines.push('✔ Crops grow twice as fast', '✘ Lightning may destroy crops or scare off animals', 'Wind turbines charge three times faster'); break;
      case WEATHER_SNOW: lines.push('⚠ Crops grow 20% slower while it snows'); break;
      case WEATHER_DUST: lines.push('⚠ Crops grow 25% slower', '⚠ Solar panels barely charge'); break;
      default:
        if (techOwned('sci_forecast')) {
          const nx = WEATHER_INFO[forecastWeather()] || WEATHER_INFO.none;
          lines.push(`[[eye]] Forecast: ${nx.name} in ${Math.ceil(weatherInterval)}s`);
        }
        lines.push(['Spring brings rain and the odd storm.', 'Summer brings solar flares, storms and dust.', 'Autumn brings rain, dust and meteors.', 'Winter brings snow and the odd meteor shower.'][currentSeason], 'Weather changes every 25-50 seconds.');
        break;
    }
    return lines;
  }

  function toolTooltip(mode) {
    if (mode === 'plant')
      return ['[[seedbag]] Seeds', 'Pick a crop below, then click or drag over empty soil.', 'Clicking ripe crops harvests them.', 'Shortcut: P, number keys pick crops'];
    if (mode === 'build')
      return ['[[hammer]] Build', 'Pick a building below, then click a tile.', 'Buildings work on the tiles around them.', 'Shortcut: B'];
    return ['[[hoe]] Hoe', 'Enrich soil beside water (+20% nutrients).', 'Turns sand into farmland.', `Breaks up rocks for ${ROCK_CLEAR_COST} cr.`, 'Right-click a crop to uproot it.', 'Shortcut: T'];
  }

  function nearestAnimalAt(sx, sy) {
    for (let i = wildAnimals.length - 1; i >= 0; --i) {
      const a = wildAnimals[i];
      const g = gridToScreen(a.rx !== undefined ? a.rx : a.x, a.ry !== undefined ? a.ry : a.y);
      const ax = g.x + g.size / 2, ay = g.y + g.size / 2;
      if (Math.hypot(sx - ax, sy - ay) < Math.max(18, 22 * viewZoom))
        return i;
    }
    return -1;
  }

  function penAt(sx, sy) {
    const half = BASE_TILE_SIZE * viewZoom / 2;
    for (let i = 0; i < livestockPens.length; ++i) {
      const s = livestockPenToScreen(livestockPens[i]);
      if (sx >= s.x - half && sx <= s.x + half && sy >= s.y - half && sy <= s.y + half)
        return i;
    }
    return -1;
  }

  /* Tooltip for the farm under the pointer (screen px) */
  function worldTooltip(sx, sy) {
    const ai = nearestAnimalAt(sx, sy);
    if (ai >= 0)
      return { key: 'mouse:' + ai, lines: ['[[mouse]] Space mouse', '✘ Eats the nearest crop', '✔ Click it to chase it off: +10 cr', 'Scarecrows and fences keep mice out'] };
    const pi = penAt(sx, sy);
    if (pi >= 0)
      return { key: 'pen:' + pi + ':' + (livestockPens[pi].produceReady ? 1 : 0), lines: buildLivestockPenTooltip(livestockPens[pi]) };
    const { col, row } = canvasToGrid(sx, sy);
    if (!isInsideGrid(col, row))
      return null;
    const key = 'tile:' + row + ':' + col;
    const tt = tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_WATER)
      return { key, lines: buildEmptyTileTooltip(row, col) };
    const bld = buildings[row]?.[col];
    if (bld) {
      if (inspect && inspect.row === row && inspect.col === col)
        return null;
      return { key: key + ':b' + (bld.level || 1), lines: buildBuildingTileTooltip(bld, row, col) };
    }
    const cell = farmGrid[row][col];
    return { key: key + (cell ? ':c' + cell.growthStage : ':e'), lines: cell ? buildCropTileTooltip(cell, row, col) : buildEmptyTileTooltip(row, col) };
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusCredits) statusCredits.textContent = `Credits: ${credits}`;
    if (statusTool) {
      if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0)
        statusTool.textContent = `Tool: Build (${BUILDINGS[selectedBuildingIndex].name})`;
      else if (selectedTool === TOOL_HOE)
        statusTool.textContent = 'Tool: Hoe';
      else
        statusTool.textContent = `Tool: Plant (${CROPS[selectedCropIndex].name})`;
    }
    if (statusWeather) statusWeather.textContent = `Weather: ${weatherInfo().name}`;
    if (statusDay) statusDay.textContent = `Day: ${dayCount} | ${SEASONS[currentSeason]} | ${dayPhase < 0.5 ? 'Day' : 'Night'}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW FRAME
     ══════════════════════════════════════════════════════════════════ */

  function drawWorld() {
    drawWorldScene();
    drawCursorPreview();
    drawDragSelection();
    drawWeatherOverlay();
  }

  function drawFrame() {
    frameRegions = [];
    ++hudFrame;
    const playing = state === STATE_PLAYING || state === STATE_PAUSED;
    // the tech tree covers the whole screen once it is open
    const covered = dialog === 'tree' && dialogT >= 1;
    ctx.save();
    screenShake.apply(ctx);
    if (playing && !covered)
      drawWorld();
    screenShake.restore(ctx);
    ctx.restore();

    ctx.save();
    ctx.scale(uiS, uiS);
    spriteScale = uiS * (window.devicePixelRatio || 1);
    if (state === STATE_READY)
      drawTitleScreen();
    else if (playing && !covered) {
      drawHUD();
      if (dialog === 'livestock')
        drawLivestockDialog();
      else if (dialog === 'market')
        drawMarketDialog();
      if (state === STATE_PAUSED && dialog !== 'help')
        drawPauseScreen();
    }
    if (dialog === 'tree')
      drawTreeDialog();
    if (playing) {
      drawFlyers();
      uiParticles.draw(ctx);
    }
    if (dialog === 'help')
      drawHelpDialog();
    drawTooltip();
    if (screenFade > 0) {
      ctx.fillStyle = `rgba(3,5,12,${screenFade})`;
      ctx.fillRect(0, 0, UW, UH);
    }
    ctx.restore();
    uiRegions = frameRegions;
  }

  /* Ghost of the selected crop or building on the tile under the pointer */
  /* What the selected tool would do on a tile: { ok, ghost, blocked, hint } */
  function toolPreview(row, col) {
    const tt = tileTypes[row][col];
    const bld = buildings[row][col];
    const cell = farmGrid[row][col];
    if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
      const b = BUILDINGS[selectedBuildingIndex];
      if (tt === TILE_WATER) return { ok: false, blocked: true, hint: 'Water: nothing can be built here' };
      if (bld) return { ok: true, ghost: null, hint: null };
      return { ok: credits >= getBuildingCost(b), ghost: b.sprite, range: b.range, hint: credits >= getBuildingCost(b) ? null : `Need ${getBuildingCost(b)} cr` };
    }
    if (selectedTool === TOOL_HOE) {
      if (tt === TILE_ROCK)
        return bld ? { ok: false, blocked: true, hint: 'A building stands on this rock' }
          : { ok: credits >= ROCK_CLEAR_COST, pick: true, hint: credits >= ROCK_CLEAR_COST ? `Clear rock: ${ROCK_CLEAR_COST} cr` : `Clearing needs ${ROCK_CLEAR_COST} cr` };
      if (tt === TILE_WATER) return { ok: true, hint: null };
      if (bld) return { ok: false, blocked: true, hint: null };
      return isAdjacentToWater(row, col) ? { ok: true, hint: null } : { ok: false, hint: 'Too far from water to enrich' };
    }
    if (bld) return { ok: true, hint: null };
    if (tt === TILE_WATER) return { ok: false, blocked: true, hint: 'Water: crops can\'t grow here' };
    if (tt === TILE_ROCK) return { ok: false, blocked: true, hint: `Rock: clear it with the hoe (T) for ${ROCK_CLEAR_COST} cr` };
    if (cell) return { ok: cell.growthStage >= CROPS[cell.cropIndex].stages - 1, ripe: true, hint: null };
    const cost = getSeedCost(CROPS[selectedCropIndex]);
    return { ok: credits >= cost, ghost: CROPS[selectedCropIndex].sprite, hint: credits >= cost ? null : `Need ${cost} cr` };
  }

  /* Ghost of the selected crop or building on the tile under the pointer */
  function drawCursorPreview() {
    if (state !== STATE_PLAYING || dialog || isDragging || isPanning) return;
    let col, row;
    if (kbCursor.active) {
      col = kbCursor.col;
      row = kbCursor.row;
    } else {
      if (!pointerInside || hitRegion(pointerUX, pointerUY)) return;
      ({ col, row } = canvasToGrid(pointerX, pointerY));
    }
    if (!isInsideGrid(col, row)) return;
    const g = gridToScreen(col, row);
    const pv = toolPreview(row, col);
    if (pv.range > 0) {
      const r0 = gridToScreen(col - pv.range, row - pv.range);
      ctx.fillStyle = 'rgba(90,184,255,0.10)';
      ctx.fillRect(r0.x, r0.y, g.size * (pv.range * 2 + 1), g.size * (pv.range * 2 + 1));
      ctx.strokeStyle = 'rgba(90,184,255,0.55)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r0.x, r0.y, g.size * (pv.range * 2 + 1), g.size * (pv.range * 2 + 1));
      ctx.setLineDash([]);
    }
    const color = pv.ok ? (pv.ripe ? '#ffd75a' : '#7ee06a') : '#ff6a6a';
    const pulse = 0.6 + Math.sin(uiTime * 6) * 0.25;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(color, pulse);
    roundRectPath(g.x + 2, g.y + 2, g.size - 4, g.size - 4, Math.max(3, 6 * viewZoom));
    ctx.stroke();
    if (pv.blocked) {
      // a red cross over tiles where the tool can't act
      ctx.fillStyle = 'rgba(255,60,60,0.16)';
      ctx.fillRect(g.x + 2, g.y + 2, g.size - 4, g.size - 4);
      const m = g.size * 0.3;
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.lineWidth = Math.max(2, 3 * viewZoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.x + m, g.y + m);
      ctx.lineTo(g.x + g.size - m, g.y + g.size - m);
      ctx.moveTo(g.x + g.size - m, g.y + m);
      ctx.lineTo(g.x + m, g.y + g.size - m);
      ctx.stroke();
    }
    if (pv.pick)
      drawSprite('pick', g.x + g.size * 0.78, g.y + g.size * 0.24, 22 * viewZoom + 6);
    if (pv.ghost && pv.ok) {
      ctx.globalAlpha = 0.55;
      drawSprite(pv.ghost, g.x + g.size / 2, g.y + g.size / 2 - 2 * viewZoom, 40 * viewZoom);
    }
    ctx.restore();
    if (pv.hint) {
      // hint chip above the tile, in HUD units
      ctx.save();
      ctx.scale(uiS, uiS);
      const ux = (g.x + g.size / 2) / uiS, uy = g.y / uiS - 16;
      drawChip(pv.hint, ux, Math.max(4, uy - 11), 22, { align: 'center', px: 12, weight: '', bg: 'rgba(30,8,8,0.88)', border: pv.ok ? 'rgba(255,255,255,0.25)' : 'rgba(255,106,106,0.7)', color: pv.ok ? UI.text : '#ffc0b8', maxW: 360 });
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;
  let lastSeason = -1;

  /* Frame-time monitor: when frames stay slow the lighter path kicks in
     (coarser night mask, fewer drops, flakes and particles, still trees),
     and it switches back once there is headroom again */
  const frameMon = { avg: 16.7, slow: 0, fast: 0 };

  function monitorFrame(ms) {
    if (!(ms > 0) || ms > 250) return;
    frameMon.avg += (ms - frameMon.avg) * 0.05;
    if (!lowQuality) {
      frameMon.slow = frameMon.avg > 30 ? frameMon.slow + ms : 0;
      if (frameMon.slow > 2000) {
        lowQuality = true;
        frameMon.fast = 0;
      }
    } else {
      frameMon.fast = frameMon.avg < 19 ? frameMon.fast + ms : 0;
      if (frameMon.fast > 4000) {
        lowQuality = false;
        frameMon.slow = 0;
      }
    }
  }

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    if (state === STATE_PLAYING && !document.hidden)
      monitorFrame(rawDt * 1000);
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    frameDt = Math.max(0.001, dt);
    uiTime += dt;

    if (!dialog)
      updateGame(dt);
    if (state === STATE_PLAYING && !dialog) {
      animT += dt;
      updatePenAnimals(dt);
    }
    if (state === STATE_PLAYING || state === STATE_PAUSED)
      updateAmbient(state === STATE_PLAYING && !dialog ? dt : 0);
    updatePops(dt);
    updateFlyers(dt);
    uiParticles.update();
    updateWeatherVisuals(state === STATE_PLAYING && !dialog ? dt : 0);

    if (state === STATE_PLAYING) {
      autosaveTimer += dt;
      if (autosaveTimer >= AUTOSAVE_INTERVAL)
        saveGame();
      if (lastSeason !== currentSeason) {
        if (lastSeason >= 0)
          announce(`${SEASONS[currentSeason]} has arrived`, ['Crops grow 10% faster', 'Crops grow 25% faster', 'Harvests are 15% bigger', 'Crops grow 40% slower, snow falls'][currentSeason], SEASON_COLORS[currentSeason], SEASON_SPRITES[currentSeason]);
        lastSeason = currentSeason;
      }
    }

    // Eased credit counter
    const diff = credits - creditsShown;
    if (Math.abs(diff) < 0.5)
      creditsShown = credits;
    else
      creditsShown += diff * Math.min(1, dt * 10);
    creditsPulse = Math.max(0, creditsPulse - dt * 3);
    creditsDeltaT = Math.max(0, creditsDeltaT - dt * 0.8);
    screenFade = Math.max(0, screenFade - dt * 2.5);

    if (state !== STATE_PAUSED && !dialog)
      particles.update();
    screenShake.update(dt * 1000);
    refreshHover();
    updateTooltipTimer(dt);

    ctx.clearRect(0, 0, canvasW, canvasH);
    drawFrame();

    updateStatusBar();
    updateWindowTitle();
    trackCredits();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  let lastCredits = null;
  function trackCredits() {
    if (lastCredits === null || state !== STATE_PLAYING) {
      lastCredits = credits;
      return;
    }
    const d = Math.round(credits - lastCredits);
    if (d) {
      creditsDelta = creditsDeltaT > 0 ? creditsDelta + d : d;
      creditsDeltaT = 1.6;
      if (d > 0)
        creditsPulse = 1;
    }
    lastCredits = credits;
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  let pointerX = 0, pointerY = 0;            // canvas px
  let pointerUX = 0, pointerUY = 0;          // UI units
  let pointerInside = false;
  const kbCursor = { col: 0, row: 0, active: false };
  const touches = new Map();                 // pointerId -> { x, y }
  let pinch = null;                          // { dist, zoom, cx, cy }
  let pressStart = null;                     // { x, y, region }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: () => {
      state = STATE_PAUSED;
      saveGame();
    }
  });

  /* Keep the farm when the window is closed or the page goes away */
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveGame();
  });

  function togglePause() {
    if (state === STATE_PLAYING) {
      state = STATE_PAUSED;
      saveGame();
      SZ.GameAudio.play('click');
    } else if (state === STATE_PAUSED) {
      state = STATE_PLAYING;
      SZ.GameAudio.play('select', { volume: 0.6 });
    }
  }

  /* Plants, harvests or hoes the tile under the keyboard cursor */
  function actOnTile(row, col) {
    if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
      if (buildings[row][col])
        inspect = { row, col };
      else
        placeBuilding(row, col);
      return;
    }
    if (selectedTool === TOOL_HOE) {
      hoeFertilize(row, col);
      return;
    }
    if (buildings[row][col]) {
      inspect = inspect && inspect.row === row && inspect.col === col ? null : { row, col };
      return;
    }
    const cell = farmGrid[row][col];
    if (!cell)
      plantCrop(row, col);
    else if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
      harvestCrop(row, col);
    else
      SZ.GameAudio.play('error', { volume: 0.4 });
  }

  /* Pans the view so a tile stays inside the area between the HUD panels */
  function revealTile(col, row) {
    const g = gridToScreen(col, row);
    const left = 270 * uiS, right = canvasW - 300 * uiS, top = 90 * uiS, bottom = canvasH - (DOCK_H + 50) * uiS;
    if (g.x < left) viewPanX += left - g.x;
    else if (g.x + g.size > right) viewPanX -= g.x + g.size - right;
    if (g.y < top) viewPanY += top - g.y;
    else if (g.y + g.size > bottom) viewPanY -= g.y + g.size - bottom;
    clampPan();
  }

  function zoomAt(sx, sy, factor) {
    const oldZoom = viewZoom;
    viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, viewZoom * factor));
    const ratio = viewZoom / oldZoom;
    viewPanX = sx - (sx - viewPanX) * ratio;
    viewPanY = sy - (sy - viewPanY) * ratio;
    clampPan();
  }

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (newGameConfirmOpen)
      return;

    if (e.code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    if (dialog === 'help') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        helpNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (helpPage > 0) {
          --helpPage;
          SZ.GameAudio.play('click');
        }
      } else if (e.code === 'Escape' || e.code === 'KeyH') {
        e.preventDefault();
        closeDialog();
      }
      return;
    }

    if (e.code === 'KeyH') {
      openHelp(0);
      return;
    }

    if (state === STATE_READY) {
      if (savedGameAvailable && (e.code === 'Enter' || e.code === 'KeyC')) {
        e.preventDefault();
        continueSavedGame();
      } else if (!savedGameAvailable && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        resetGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (dialog)
        closeDialog();
      else if (inspect)
        inspect = null;
      else if (kbCursor.active)
        kbCursor.active = false;
      else
        togglePause();
      return;
    }

    if (state === STATE_PAUSED) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (state !== STATE_PLAYING)
      return;

    if (dialog) {
      if (dialog === 'tree' && e.code !== 'KeyU' && handleTreeKey(e)) {
        e.preventDefault();
        return;
      }
      if ((e.code === 'KeyU' && dialog === 'tree') || (e.code === 'KeyL' && dialog === 'livestock') || (e.code === 'KeyM' && dialog === 'market'))
        closeDialog();
      else if (e.code === 'KeyS' && dialog === 'market')
        sellAllProduce();
      return;
    }

    // Number keys pick crops (or buildings in build mode); 0 is the tenth
    const digit = /^Digit(\d)$/.exec(e.code) || /^Numpad(\d)$/.exec(e.code);
    if (digit) {
      const n = parseInt(digit[1], 10);
      const idx = n === 0 ? 9 : n - 1;
      const items = dockItems(selectedTool === TOOL_BUILD ? 'build' : 'plant');
      if (idx < items.length) {
        if (selectedTool === TOOL_BUILD)
          selectBuilding(items[idx].index);
        else
          selectCrop(items[idx].index);
      }
      dockFollow = true;
      return;
    }

    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.code]) {
      e.preventDefault();
      const [dx, dy] = arrows[e.code];
      if (e.shiftKey) {
        viewPanX -= dx * 60;
        viewPanY -= dy * 60;
        clampPan();
        return;
      }
      if (!kbCursor.active) {
        const c = canvasToGrid(canvasW / 2, canvasH / 2);
        kbCursor.col = Math.max(0, Math.min(gridCols - 1, c.col));
        kbCursor.row = Math.max(0, Math.min(gridRows - 1, c.row));
        kbCursor.active = true;
      } else {
        kbCursor.col = Math.max(0, Math.min(gridCols - 1, kbCursor.col + dx));
        kbCursor.row = Math.max(0, Math.min(gridRows - 1, kbCursor.row + dy));
      }
      revealTile(kbCursor.col, kbCursor.row);
      SZ.GameAudio.play('click', { volume: 0.3 });
      return;
    }
    if ((e.code === 'Space' || e.code === 'Enter') && kbCursor.active) {
      e.preventDefault();
      actOnTile(kbCursor.row, kbCursor.col);
      return;
    }

    switch (e.code) {
      case 'KeyS': sellAllProduce(); break;
      case 'KeyU': toggleTree(); break;
      case 'KeyL': toggleDialog('livestock'); break;
      case 'KeyM': toggleDialog('market'); break;
      case 'KeyP': setTool('plant'); dockFollow = true; break;
      case 'KeyB':
        if (selectedTool === TOOL_BUILD) {
          let i = selectedBuildingIndex;
          do i = (i + 1) % BUILDINGS.length; while (!isBuildingUnlocked(i));
          selectBuilding(i);
        } else
          setTool('build');
        dockFollow = true;
        break;
      case 'KeyT': setTool(selectedTool === TOOL_HOE ? 'plant' : 'hoe'); break;
      case 'Home': resetView(); break;
      case 'KeyN': toggleSoilOverlay(); break;
      case 'Equal': case 'NumpadAdd': zoomAt(canvasW / 2, canvasH / 2, 1.15); break;
      case 'Minus': case 'NumpadSubtract': zoomAt(canvasW / 2, canvasH / 2, 1 / 1.15); break;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Pointer coordinate helpers ── */

  function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasW / rect.width),
      y: (e.clientY - rect.top) * (canvasH / rect.height)
    };
  }

  function canvasToGrid(cx, cy) {
    const wx = (cx - viewPanX) / viewZoom;
    const wy = (cy - viewPanY) / viewZoom;
    return {
      col: Math.floor((wx - GRID_OFFSET_X) / BASE_TILE_SIZE),
      row: Math.floor((wy - GRID_OFFSET_Y) / BASE_TILE_SIZE)
    };
  }

  function isInsideGrid(col, row) {
    return col >= 0 && col < gridCols && row >= 0 && row < gridRows;
  }

  function getDragGridRect() {
    const a = canvasToGrid(dragStartX, dragStartY);
    const b = canvasToGrid(dragCurrentX, dragCurrentY);
    return {
      c0: Math.max(0, Math.min(a.col, b.col)),
      r0: Math.max(0, Math.min(a.row, b.row)),
      c1: Math.min(gridCols - 1, Math.max(a.col, b.col)),
      r1: Math.min(gridRows - 1, Math.max(a.row, b.row))
    };
  }

  /* Applies plant / harvest / hoe to every tile inside the drag selection */
  function applyDragAction() {
    if (selectedTool === TOOL_BUILD) return;
    const { r0, c0, r1, c1 } = getDragGridRect();
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (selectedTool === TOOL_HOE) {
          hoeFertilize(r, c);
          continue;
        }
        const tt = tileTypes[r]?.[c] ?? TILE_FARMLAND;
        if (tt === TILE_WATER || buildings[r]?.[c]) continue;
        const cell = farmGrid[r][c];
        if (cell === null)
          plantCrop(r, c);
        else if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
          harvestCrop(r, c);
      }
  }

  function updatePointer(e) {
    const { x, y } = pointerToCanvas(e);
    pointerX = x;
    pointerY = y;
    pointerUX = x / uiS;
    pointerUY = y / uiS;
    pointerInside = true;
  }

  function chaseMouse(i) {
    const animal = wildAnimals[i];
    credits += 10;
    const { x: tx, y: ty } = tileCenter(animal.rx !== undefined ? animal.rx : animal.x, animal.ry !== undefined ? animal.ry : animal.y);
    popText(tx, ty - 10, 'Chased off! +10', { color: '#ffd75a', font: 'bold 13px' });
    const up = worldToUI(tx, ty);
    flyCoins(2, up.x, up.y, { size: 18 });
    particles.burst(tx, ty, 10, { color: '#ffd0a0', speed: 3, life: 0.4 });
    screenShake.trigger(2, 100);
    SZ.GameAudio.play('hit');
    wildAnimals.splice(i, 1);
  }

  canvas.addEventListener('pointerdown', (e) => {
    updatePointer(e);
    kbCursor.active = false;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: pointerX, y: pointerY });
      if (touches.size === 2 && state === STATE_PLAYING && !dialog) {
        // second finger: switch to pinch zoom / two-finger pan
        isDragging = false;
        const [a, b] = [...touches.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        return;
      }
    }

    const region = hitRegion(pointerUX, pointerUY);
    const through = region && !region.modal && hudPassThrough(pointerUX, pointerUY);
    if (region && !through && region.onDragStart) {
      dragRegion = region;
      region.onDragStart(e.button);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (region && !through) {
      if (e.button !== 0 && e.pointerType === 'mouse') {
        if (!region.modal && state === STATE_PLAYING && !dialog && (e.button === 1 || e.button === 2))
          startPan(e);
        return;
      }
      pressRegionId = region.id;
      pressStart = { region };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (state !== STATE_PLAYING || dialog) return;

    // Middle mouse, right-click or Ctrl+left pans
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      startPan(e);
      return;
    }

    const ai = nearestAnimalAt(pointerX, pointerY);
    if (ai >= 0) {
      chaseMouse(ai);
      return;
    }

    const { col, row } = canvasToGrid(pointerX, pointerY);
    if (isInsideGrid(col, row)) {
      if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
        if (buildings[row][col])
          inspect = { row, col };
        else
          placeBuilding(row, col);
        return;
      }
      isDragging = true;
      dragStartedOnGrid = true;
      dragStartX = dragCurrentX = pointerX;
      dragStartY = dragCurrentY = pointerY;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const pi = penAt(pointerX, pointerY);
    if (pi >= 0) {
      feedAndCollect(pi);
      return;
    }
    inspect = null;
  });

  function startPan(e) {
    isPanning = true;
    panButton = e.button;
    panLastX = pointerX;
    panLastY = pointerY;
    if (e.button === 2) {
      rightClickStartX = pointerX;
      rightClickStartY = pointerY;
    }
    canvas.setPointerCapture(e.pointerId);
  }

  let dragRegion = null;

  canvas.addEventListener('pointermove', (e) => {
    updatePointer(e);
    if (dragRegion) {
      dragRegion.onDrag();
      return;
    }
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: pointerX, y: pointerY });
      if (pinch && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        viewPanX += cx - pinch.cx;
        viewPanY += cy - pinch.cy;
        zoomAt(cx, cy, dist / pinch.dist);
        pinch.dist = dist;
        pinch.cx = cx;
        pinch.cy = cy;
        return;
      }
    }
    if (e.pointerType === 'mouse')
      kbCursor.active = false;
    if (isPanning) {
      viewPanX += pointerX - panLastX;
      viewPanY += pointerY - panLastY;
      clampPan();
      panLastX = pointerX;
      panLastY = pointerY;
      return;
    }
    if (isDragging) {
      dragCurrentX = pointerX;
      dragCurrentY = pointerY;
    }
  });

  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    hoverRegionId = null;
    clearTooltip();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerup', (e) => {
    updatePointer(e);
    if (dragRegion) {
      const r = dragRegion;
      dragRegion = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      r.onDragEnd(e.button);
      return;
    }
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (pinch) {
        if (touches.size < 2)
          pinch = null;
        return;
      }
    }
    if (pressStart) {
      const r = pressStart.region;
      pressStart = null;
      pressRegionId = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      const now = hitRegion(pointerUX, pointerUY);
      if (now && now.id === r.id) {
        if (r.onClick)
          r.onClick();
        else if (r.disabledClick)
          r.disabledClick();
      }
      return;
    }
    if (isPanning) {
      isPanning = false;
      const releasedButton = panButton;
      panButton = -1;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      // a short right-click upgrades a building, Shift removes it, a mouse gets chased off
      if (releasedButton === 2 && state === STATE_PLAYING && !dialog && Math.hypot(pointerX - rightClickStartX, pointerY - rightClickStartY) < 5) {
        const ai = nearestAnimalAt(pointerX, pointerY);
        if (ai >= 0) {
          chaseMouse(ai);
          return;
        }
        const { col, row } = canvasToGrid(pointerX, pointerY);
        if (isInsideGrid(col, row)) {
          if (selectedTool === TOOL_HOE && farmGrid[row]?.[col])
            hoeUproot(row, col);
          else if (e.shiftKey)
            removeBuilding(row, col);
          else if (buildings[row]?.[col])
            upgradeBuilding(row, col);
        }
      }
      return;
    }
    if (!isDragging) return;
    isDragging = false;
    dragStartedOnGrid = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (state !== STATE_PLAYING) return;
    // A plain click on a building opens its inspector
    if (Math.hypot(dragCurrentX - dragStartX, dragCurrentY - dragStartY) < 6) {
      const { col, row } = canvasToGrid(dragStartX, dragStartY);
      if (isInsideGrid(col, row) && buildings[row][col] && selectedTool !== TOOL_HOE) {
        inspect = inspect && inspect.row === row && inspect.col === col ? null : { row, col };
        SZ.GameAudio.play('click');
        return;
      }
    }
    inspect = null;
    applyDragAction();
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (dragRegion) {
      dragRegion = null;
      treePanning = null;
    }
    touches.delete(e.pointerId);
    pinch = null;
    pressStart = null;
    pressRegionId = null;
    isPanning = false;
    panButton = -1;
    isDragging = false;
    dragStartedOnGrid = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  /* ── Zoom & pan helpers ── */

  function clampPan() {
    const ts = BASE_TILE_SIZE * viewZoom;
    const gridW = gridCols * ts;
    const gridH = gridRows * ts;
    const ox = GRID_OFFSET_X * viewZoom;
    const oy = GRID_OFFSET_Y * viewZoom;
    const margin = 80;
    viewPanX = Math.max(-gridW - ox + margin, Math.min(canvasW - ox - margin, viewPanX));
    viewPanY = Math.max(-gridH - oy + margin, Math.min(canvasH - oy - margin, viewPanY));
  }

  /* Fits the whole farm between the HUD panels, with a strip of sky above it */
  function resetView() {
    const T = BASE_TILE_SIZE;
    const left = 270 * uiS, right = canvasW - 300 * uiS;
    const top = canvasH * 0.03, bottom = canvasH - (DOCK_H + 56) * uiS;
    const wx0 = GRID_OFFSET_X - T * 1.2, wx1 = GRID_OFFSET_X + (gridCols + 1.2) * T;
    const wy0 = horizonWorldY() - T * 2.4, wy1 = GRID_OFFSET_Y + (gridRows + 1.3) * T;
    viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(1.5, (right - left) / (wx1 - wx0), (bottom - top) / (wy1 - wy0)));
    viewPanX = (left + right) / 2 - (wx0 + wx1) / 2 * viewZoom;
    viewPanY = (top + bottom) / 2 - (wy0 + wy1) / 2 * viewZoom;
    clampPan();
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { x, y } = pointerToCanvas(e);
    const region = hitRegion(x / uiS, y / uiS);
    if (region) {
      if (region.onWheel)
        region.onWheel(e.deltaY);
      else {
        for (let i = uiRegions.length - 1; i >= 0; --i) {
          const r = uiRegions[i];
          if (r.onWheel && x / uiS >= r.x && x / uiS <= r.x + r.w && y / uiS >= r.y && y / uiS <= r.y + r.h) {
            r.onWheel(e.deltaY);
            break;
          }
        }
      }
      if (!hudPassThrough(x / uiS, y / uiS) || region.modal)
        return;
    }
    if (state !== STATE_PLAYING || dialog) return;
    zoomAt(x, y, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

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
      case 'tutorial':
        openHelp(0);
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
    textFitCache.clear();
    if (state === STATE_PLAYING || state === STATE_PAUSED)
      clampPan();
  }

  let shownTitle = '';

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Space Farming — Season Over — ${credits}cr`
      : `Space Farming — Day ${dayCount} — ${SEASONS[currentSeason]} — ${credits}cr`;
    // called every frame: only a changed title goes to the desktop
    if (title === shownTitle)
      return;
    shownTitle = title;
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
  // the bottom-right corner holds the dock, so the sound switch sits in the menu bar
  const muteButton = SZ.GameAudio.attachMuteButton();
  Object.assign(muteButton.style, { top: '2px', bottom: 'auto', width: '20px', height: '20px', font: '11px/18px sans-serif' });
  loadHighScores();
  checkSavedGame();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  updateWindowTitle();

  if (!tutorialSeen)
    openHelp(0);

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
