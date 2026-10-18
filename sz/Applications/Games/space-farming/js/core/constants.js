/* Space Farming - constants: grid, tiles, states, storage keys, crop, livestock and
   building definitions, weather kinds, tools, seasons and timings. Pure data, no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const HUD_MIN_UW = 560;            // narrowest virtual screen: farm panel plus quick panel
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
  const ENERGY_BASE_MAX = 100;
  const ENERGY_REGEN_BASE = 2; // per second
  const SHUFFLE_CACHE_INTERVAL = 60;
  const VIEW_ZOOM_MIN = 0.1;
  const VIEW_ZOOM_MAX = 2.0;

  Object.assign(NS, { HUD_MIN_UW, MAX_DT, TWO_PI, GRID_COLS, BASE_GRID_ROWS, BASE_TILE_SIZE, GRID_OFFSET_X,
    GRID_OFFSET_Y, TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, SOIL_QUALITY_TIERS, STATE_READY,
    STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, STORAGE_HIGHSCORES, STORAGE_TUTORIAL, STORAGE_SAVE,
    STORAGE_SAVE_V1, SAVE_VERSION, AUTOSAVE_INTERVAL, MAX_HIGH_SCORES, CROPS, LIVESTOCK, WEATHER_NONE,
    WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW,
    WEATHER_DUST, WEATHER_DURATION, WEATHER_MIN_INTERVAL, WEATHER_MAX_INTERVAL, TOOL_PLANT, TOOL_HOE,
    BUILDINGS, BUILDING_MAX_LEVEL, TOOL_BUILD, PRICE_CHANGE_INTERVAL, PRICE_MIN_MULT, PRICE_MAX_MULT,
    SEASONS, SEASON_DURATION, SEASON_SPRITES, DAY_CYCLE_PERIOD, ANIMAL_SPAWN_MIN, ANIMAL_SPAWN_MAX,
    ENERGY_BASE_MAX, ENERGY_REGEN_BASE, SHUFFLE_CACHE_INTERVAL, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX });

})();
