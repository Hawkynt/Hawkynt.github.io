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
  const MAX_TIER = 5;          // I-III linear, IV picks a branch, V masters it
  const BRANCH_TIER = 4;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_BUILD = 'BUILD';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_VICTORY = 'VICTORY';
  const STATE_MAP_SELECT = 'MAP_SELECT';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-tower-defense';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_SAVE_V1 = STORAGE_PREFIX + '-save-v1';
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const STORAGE_META = STORAGE_PREFIX + '-meta-v1';
  const MAX_HIGH_SCORES = 10;

  /* ── Wave timing ── */
  const WARNING_DURATION = 3;
  const AUTO_WAVE_DELAY = 5;

  /* ══════════════════════════════════════════════════════════════════
     TOWER FAMILIES
     Stats are base values; tiers and branches multiply damage, range
     and reload and may set any special value. Range is in tiles.
     ══════════════════════════════════════════════════════════════════ */

  const MUL_KEYS = { damage: 1, range: 1, reload: 1 };

  const TOWER_TYPES = [
    {
      id: 'arrow', name: 'Archer', cost: 50, color: '#8fd16a', hits: 'both', kind: 'arrow',
      damage: 9, range: 3.6, reload: 0.7, speed: 460,
      desc: 'Quick arrows at a single target. Hits flyers.',
      strong: 'Flyers, fast enemies', weak: 'Heavy armor',
      tiers: [{}, { damage: 1.6, range: 1.08, reload: 0.92 }, { damage: 2.4, range: 1.15, reload: 0.85 }],
      branches: [
        { id: 'longbow', name: 'Longbow', desc: 'Long-range heavy shots that pierce armor and crit; spots stealth.',
          t4: { damage: 5.2, range: 1.5, reload: 1.15, pierce: 0.5, crit: 0.25, critMul: 2.5, trueSight: true },
          t5: { damage: 8.4, range: 1.65, reload: 1.1, pierce: 0.7, crit: 0.35, critMul: 3, trueSight: true } },
        { id: 'volley', name: 'Volley', desc: 'Looses arrows at three enemies at once.',
          t4: { damage: 2.9, range: 1.15, reload: 0.75, multishot: 3 },
          t5: { damage: 4.2, range: 1.2, reload: 0.68, multishot: 5 } }
      ]
    },
    {
      id: 'cannon', name: 'Cannon', cost: 80, color: '#e0894a', hits: 'ground', kind: 'shell',
      damage: 24, range: 3.0, reload: 1.5, speed: 260, splash: 1.1,
      desc: 'Lobs shells that blast every enemy near the impact.',
      strong: 'Groups, swarms', weak: 'Flyers (cannot hit them)',
      tiers: [{}, { damage: 1.6, range: 1.05, reload: 0.95 }, { damage: 2.4, range: 1.1, splash: 1.25, reload: 0.9 }],
      branches: [
        { id: 'mortar', name: 'Siege Mortar', desc: 'Enormous range and a huge blast radius.',
          t4: { damage: 5.0, range: 1.9, reload: 1.25, splash: 1.7 },
          t5: { damage: 8.2, range: 2.1, reload: 1.15, splash: 2.0 } },
        { id: 'shrapnel', name: 'Shrapnel', desc: 'Shells burst into bomblets that shred armor.',
          t4: { damage: 3.6, reload: 0.9, splash: 1.25, bomblets: 5, shred: 2 },
          t5: { damage: 5.2, reload: 0.85, splash: 1.35, bomblets: 8, shred: 4 } }
      ]
    },
    {
      id: 'frost', name: 'Frost', cost: 70, color: '#7fd4ff', hits: 'both', kind: 'bolt',
      damage: 5, range: 3.0, reload: 1.0, speed: 320, slow: 0.4, slowTime: 2,
      desc: 'Ice bolts slow their target down.',
      strong: 'Fast enemies, bosses', weak: 'Low damage',
      tiers: [{}, { damage: 1.6, range: 1.08, slow: 0.45 }, { damage: 2.2, range: 1.15, slow: 0.5, slowTime: 2.5 }],
      branches: [
        { id: 'glacier', name: 'Glacier', desc: 'Bolts may freeze enemies solid; frozen enemies shatter for extra damage.',
          t4: { damage: 4, range: 1.2, slow: 0.5, slowTime: 2.5, freeze: 0.2, freezeTime: 1.4 },
          t5: { damage: 6.5, range: 1.25, slow: 0.55, slowTime: 3, freeze: 0.33, freezeTime: 1.8 } },
        { id: 'blizzard', name: 'Blizzard', desc: 'A freezing storm slows everything in range.',
          t4: { damage: 2.6, range: 1.05, reload: 0.9, slow: 0.5, slowTime: 1.2, aura: true },
          t5: { damage: 4.2, range: 1.15, reload: 0.8, slow: 0.62, slowTime: 1.4, aura: true } }
      ]
    },
    {
      id: 'tesla', name: 'Tesla', cost: 120, color: '#7ae8ff', hits: 'both', kind: 'chain',
      damage: 16, range: 2.8, reload: 1.15, chains: 3, chainRange: 2.0,
      desc: 'Lightning jumps between enemies. Double damage to shields.',
      strong: 'Shields, packs', weak: 'Lone tough targets',
      tiers: [{}, { damage: 1.55, range: 1.05 }, { damage: 2.2, range: 1.1, chains: 4 }],
      branches: [
        { id: 'storm', name: 'Storm Spire', desc: 'Bolts arc through many more enemies.',
          t4: { damage: 3.0, range: 1.15, chains: 7, chainRange: 2.4 },
          t5: { damage: 4.2, range: 1.2, chains: 10, chainRange: 2.8 } },
        { id: 'overload', name: 'Overload', desc: 'Massive bolts that stun what they hit.',
          t4: { damage: 4.4, range: 1.1, reload: 1.1, chains: 3, stun: 0.6 },
          t5: { damage: 6.8, range: 1.15, reload: 1.05, chains: 4, stun: 0.9 } }
      ]
    },
    {
      id: 'flame', name: 'Flamer', cost: 100, color: '#ff8a3a', hits: 'ground', kind: 'flame',
      damage: 4, range: 2.0, reload: 0.15, cone: 0.5, burn: 6, burnTime: 2.5,
      desc: 'Short-range jet of fire that burns everything in its cone.',
      strong: 'Swarms, groups', weak: 'Flyers, range',
      tiers: [{}, { damage: 1.55, range: 1.05, burn: 9 }, { damage: 2.2, range: 1.1, burn: 13 }],
      branches: [
        { id: 'inferno', name: 'Inferno', desc: 'Leaves pools of burning ground on the path.',
          t4: { damage: 3.0, range: 1.15, burn: 18, lava: 14 },
          t5: { damage: 4.2, range: 1.2, burn: 26, lava: 22 } },
        { id: 'dragon', name: 'Dragon Breath', desc: 'Longer flames that melt armor.',
          t4: { damage: 3.2, range: 1.5, burn: 16, melt: 3, cone: 0.42 },
          t5: { damage: 4.6, range: 1.7, burn: 22, melt: 6, cone: 0.42 } }
      ]
    },
    {
      id: 'poison', name: 'Venom', cost: 90, color: '#7ce35a', hits: 'both', kind: 'glob',
      damage: 4, range: 3.0, reload: 1.6, speed: 240, cloud: 0.9, cloudTime: 3, cloudDps: 9,
      desc: 'Toxic clouds that ignore armor and shields.',
      strong: 'Armor, shields', weak: 'Fast enemies',
      tiers: [{}, { damage: 1.5, range: 1.05, cloudDps: 14 }, { damage: 2.1, range: 1.1, cloudDps: 20, cloud: 1.0 }],
      branches: [
        { id: 'plague', name: 'Plague', desc: 'Poisoned enemies burst into new clouds when they die.',
          t4: { damage: 3, range: 1.15, cloudDps: 30, cloud: 1.1, plague: true },
          t5: { damage: 4, range: 1.2, cloudDps: 44, cloud: 1.2, plague: true } },
        { id: 'acid', name: 'Acid', desc: 'Corrodes armor and makes enemies take more damage.',
          t4: { damage: 3, range: 1.15, cloudDps: 26, cloud: 1.05, acid: true },
          t5: { damage: 4, range: 1.2, cloudDps: 38, cloud: 1.15, acid: true } }
      ]
    },
    {
      id: 'laser', name: 'Laser', cost: 150, color: '#ff5ad2', hits: 'both', kind: 'beam',
      damage: 22, range: 3.2, reload: 0, ramp: 2.5, rampTime: 2.2, pierce: 0.5,
      desc: 'Continuous beam that heats up on the same target. Half ignores armor.',
      strong: 'Bosses, armor', weak: 'Swarms',
      tiers: [{}, { damage: 1.5, range: 1.05 }, { damage: 2.1, range: 1.1, ramp: 3 }],
      branches: [
        { id: 'prism', name: 'Prism', desc: 'Splits into three beams.',
          t4: { damage: 2.4, range: 1.15, beams: 3, ramp: 2.5 },
          t5: { damage: 3.4, range: 1.2, beams: 4, ramp: 2.8 } },
        { id: 'solar', name: 'Solar Lance', desc: 'Searing beam that ramps far higher.',
          t4: { damage: 2.8, range: 1.25, ramp: 5, rampTime: 2.6, pierce: 0.8 },
          t5: { damage: 4.0, range: 1.35, ramp: 7, rampTime: 2.8, pierce: 1 } }
      ]
    },
    {
      id: 'sniper', name: 'Sniper', cost: 160, color: '#e8e8f0', hits: 'both', kind: 'snipe',
      damage: 75, range: 6.5, reload: 2.4, pierce: 0.6, trueSight: true,
      desc: 'Very long range, heavy single shots. Spots stealthed enemies.',
      strong: 'Stealth, healers, bosses', weak: 'Swarms',
      tiers: [{}, { damage: 1.5, range: 1.05, reload: 0.95 }, { damage: 2.1, range: 1.1, reload: 0.9 }],
      branches: [
        { id: 'railgun', name: 'Railgun', desc: 'Slugs pierce every enemy along the line.',
          t4: { damage: 3.6, range: 1.2, reload: 0.95, rail: true, pierce: 1 },
          t5: { damage: 5.4, range: 1.3, reload: 0.9, rail: true, pierce: 1 } },
        { id: 'assassin', name: 'Assassin', desc: 'Crits often and executes weakened enemies.',
          t4: { damage: 3.0, range: 1.15, reload: 0.75, crit: 0.3, critMul: 2.5, execute: 0.2 },
          t5: { damage: 4.4, range: 1.2, reload: 0.7, crit: 0.4, critMul: 3, execute: 0.3 } }
      ]
    },
    {
      id: 'spikes', name: 'Spikes', cost: 30, color: '#b8c0cc', hits: 'ground', kind: 'trap', trap: true,
      damage: 12, range: 0.5, reload: 0,
      desc: 'Trap on the path; hurts every enemy walking over it.',
      strong: 'Chokepoints, swarms', weak: 'Flyers',
      tiers: [{}, { damage: 1.7 }, { damage: 2.6 }],
      branches: [
        { id: 'tar', name: 'Tar Pit', desc: 'Sticky tar slows enemies crossing it.',
          t4: { damage: 3.4, slow: 0.45, slowTime: 0.6 },
          t5: { damage: 4.8, slow: 0.6, slowTime: 0.8 } },
        { id: 'razor', name: 'Razor Field', desc: 'Blades that tear through armor.',
          t4: { damage: 6, pierce: 1 },
          t5: { damage: 9, pierce: 1 } }
      ]
    },
    {
      id: 'mine', name: 'Gold Mine', cost: 110, color: '#ffd75a', hits: 'none', kind: 'mine',
      damage: 0, range: 0, reload: 0, income: 14,
      desc: 'Digs up gold at the end of every wave.',
      strong: 'Economy', weak: 'Cannot attack',
      tiers: [{}, { income: 24 }, { income: 36 }],
      branches: [
        { id: 'bank', name: 'Bank', desc: 'Pays interest on the gold you keep (up to a limit).',
          t4: { income: 40, interest: 0.03, interestCap: 60 },
          t5: { income: 50, interest: 0.05, interestCap: 110 } },
        { id: 'alchemist', name: 'Alchemist', desc: 'Enemies dying nearby drop extra gold.',
          t4: { income: 40, range: 3, bounty: 2 },
          t5: { income: 50, range: 3.5, bounty: 4 } }
      ]
    }
  ];

  const TOWER_BY_ID = {};
  for (let i = 0; i < TOWER_TYPES.length; ++i) {
    TOWER_TYPES[i].index = i;
    TOWER_BY_ID[TOWER_TYPES[i].id] = TOWER_TYPES[i];
    TOWER_TYPES[i].colorDark = shade(TOWER_TYPES[i].color, -0.45);
  }

  // Upgrade cost to reach tier n (index n), as a multiple of the build cost
  const TIER_COST = [0, 0, 0.7, 1.1, 1.8, 2.8];

  const TARGET_MODES = ['first', 'last', 'strong', 'close'];
  const TARGET_LABELS = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };
  const TARGET_DESC = {
    first: 'The enemy furthest along the path',
    last: 'The enemy that just entered the range',
    strong: 'The enemy with the most health',
    close: 'The enemy nearest to the tower'
  };

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEFINITIONS
     hp/speed/bounty are wave-1 values; cost is the share of a wave's
     budget; unlock is the share of the map's waves after which the type
     can appear. The first eight keys are kept from format 1 saves.
     ══════════════════════════════════════════════════════════════════ */

  const ENEMY_TYPES = {
    normal:   { name: 'Grunt', hp: 42, speed: 36, bounty: 5, radius: 7, color: '#d8584a', cost: 1, unlock: 0,
                info: 'Basic foot soldier.', counter: 'Anything' },
    fast:     { name: 'Runner', hp: 28, speed: 70, bounty: 5, radius: 6, color: '#5ad86a', cost: 1.1, unlock: 0.1, gap: 0.4,
                info: 'Quick and fragile.', counter: 'Frost, Archer' },
    swarm:    { name: 'Swarmling', hp: 14, speed: 58, bounty: 2, radius: 5, color: '#ffb03a', cost: 0.45, unlock: 0.16, gap: 0.22, pack: 6,
                info: 'Tiny, arrives in packs.', counter: 'Cannon, Flamer, Spikes' },
    flying:   { name: 'Bat', hp: 34, speed: 50, bounty: 7, radius: 6, color: '#9a8aff', cost: 1.6, unlock: 0.24, flying: true,
                info: 'Flies straight across the map, ignoring the path.', counter: 'Archer, Tesla, Frost' },
    armored:  { name: 'Brute', hp: 130, speed: 26, bounty: 13, radius: 9, color: '#9aa4b4', cost: 3.2, unlock: 0.3, armor: 5, gap: 1.0, batters: 1.2,
                info: 'Heavy armor shrugs off small hits; dents towers it passes.', counter: 'Laser, Venom, Sniper' },
    splitter: { name: 'Slime', hp: 80, speed: 32, bounty: 8, radius: 8, color: '#5ae0b4', cost: 3, unlock: 0.36, split: 'slimelet', splitCount: 3,
                info: 'Splits into three slimelets when it dies.', counter: 'Cannon, Flamer' },
    slimelet: { name: 'Slimelet', hp: 22, speed: 46, bounty: 1, radius: 5, color: '#8ff0d0', cost: 0, unlock: 2,
                info: 'Leftover of a slime.', counter: 'Splash' },
    healer:   { name: 'Shaman', hp: 60, speed: 33, bounty: 12, radius: 7, color: '#6aff8a', cost: 3, unlock: 0.44, heals: true,
                info: 'Heals nearby enemies every few seconds.', counter: 'Sniper (Strong targeting)' },
    stealth:  { name: 'Phantom', hp: 55, speed: 46, bounty: 10, radius: 7, color: '#b89aff', cost: 2.6, unlock: 0.5, stealth: true,
                info: 'Invisible to towers until spotted or caught by area damage.', counter: 'Sniper, Longbow, splash' },
    shield:   { name: 'Warden', hp: 75, speed: 30, bounty: 14, radius: 8, color: '#5ad8ff', cost: 3.6, unlock: 0.56, shielded: 0.5, shielder: true,
                info: 'Carries an energy shield and shields allies around it.', counter: 'Tesla, Venom' },
    drake:    { name: 'Wyvern', hp: 190, speed: 34, bounty: 18, radius: 10, color: '#ff7a5a', cost: 6, unlock: 0.68, flying: true, armor: 3, gap: 1.1,
                info: 'Armored flyer.', counter: 'Sniper, Laser, Tesla' },
    golem:    { name: 'Juggernaut', hp: 420, speed: 18, bounty: 32, radius: 12, color: '#b08a6a', cost: 11, unlock: 0.8, armor: 10, gap: 1.6, batters: 3,
                info: 'Walking fortress with massive armor.', counter: 'Venom, Acid, Solar Lance' },
    skeleton: { name: 'Skeleton', hp: 30, speed: 40, bounty: 1, radius: 6, color: '#e8e2d4', cost: 0, unlock: 2,
                info: 'Raised by the Lich.', counter: 'Anything' },
    boss:     { name: 'Warlord', hp: 1100, speed: 20, bounty: 120, radius: 15, color: '#ff4ad8', boss: true, armor: 6, lives: 5, batters: 5, gap: 2,
                info: 'Boss. Huge health and armor; smashes towers it passes.', counter: 'Everything you have' },
    dragon:   { name: 'Dragon', hp: 1250, speed: 26, bounty: 140, radius: 16, color: '#ff5a3a', boss: true, flying: true, armor: 4, lives: 5, gap: 2,
                info: 'Flying boss that crosses the map in a straight line.', counter: 'Anti-air: Archer, Tesla, Sniper' },
    lich:     { name: 'Lich King', hp: 1450, speed: 18, bounty: 160, radius: 15, color: '#8affd8', boss: true, armor: 2, lives: 5, summons: true, gap: 2,
                info: 'Boss. Raises skeletons and grows furious when hurt.', counter: 'Splash for the skeletons, focus the Lich' }
  };

  for (const k in ENEMY_TYPES)
    ENEMY_TYPES[k].key = k;

  const BOSS_ORDER = ['boss', 'dragon', 'lich'];
  const ELITE_HP = 2.2;

  /* ══════════════════════════════════════════════════════════════════
     BIOMES AND MAPS -- paths are waypoint sequences on a 25 x 17 grid;
     features are blocked rectangles [col0, row0, col1, row1]. Map order
     and names are kept from format 1 so old saves land on the same map.
     ══════════════════════════════════════════════════════════════════ */

  const BIOMES = {
    meadow:  { name: 'Greenvale', color: '#6fd06a', ground: '#4f8a3a', path: '#a8834e', feature: 'water', desc: 'Rolling meadows, ponds and old forests.' },
    desert:  { name: 'Sunscar Desert', color: '#ffc25a', ground: '#c9a25e', path: '#8e7350', feature: 'water', desc: 'Dunes, mesas and the odd oasis.' },
    tundra:  { name: 'Frostreach', color: '#9fe0ff', ground: '#dfe9f2', path: '#8a9bb0', feature: 'ice', desc: 'Snowfields and frozen lakes.' },
    volcano: { name: 'Ashen Wastes', color: '#ff7a3a', ground: '#4a3a3a', path: '#2a2026', feature: 'lava', desc: 'Basalt, ash and rivers of lava.' }
  };
  const BIOME_ORDER = ['meadow', 'desert', 'tundra', 'volcano'];

  const MAPS = [
    { name: 'Serpentine', biome: 'meadow', waves: 15, startGold: 220, startLives: 20, hpMul: 0.85,
      desc: 'A gentle road winding through the meadow. A fine place to learn the ropes.',
      paths: [[[0,8],[4,8],[4,3],[10,3],[10,13],[16,13],[16,5],[21,5],[21,11],[24,11]]],
      features: [['water', 12, 6, 14, 9], ['water', 0, 15, 6, 16], ['rock', 19, 14, 20, 15]] },
    { name: 'Crossroads', biome: 'meadow', waves: 15, startGold: 240, startLives: 20, hpMul: 0.9,
      desc: 'Two roads cross twice. Enemies come from the west and the north.',
      paths: [[[0,4],[17,4],[17,16]], [[7,0],[7,12],[24,12]]],
      features: [['water', 19, 0, 23, 2], ['water', 1, 13, 4, 15], ['rock', 11, 7, 13, 9]] },
    { name: 'Spiral', biome: 'meadow', waves: 18, startGold: 230, startLives: 20, hpMul: 0.95,
      desc: 'The road coils inward to the old keep. Long, but every turn is a chance.',
      paths: [[[0,1],[22,1],[22,15],[2,15],[2,5],[18,5],[18,11],[7,11],[7,8],[13,8]]],
      features: [['water', 10, 12, 14, 13], ['rock', 15, 7, 16, 9]] },
    { name: 'Zigzag', biome: 'desert', waves: 18, startGold: 240, startLives: 20, hpMul: 1.0,
      desc: 'Long switchbacks through the dunes, past a shaded oasis.',
      paths: [[[0,2],[6,2],[6,14],[12,14],[12,2],[18,2],[18,14],[24,14]]],
      features: [['water', 20, 5, 23, 9], ['rock', 8, 6, 10, 9], ['rock', 14, 9, 16, 11]] },
    { name: 'Diamond', biome: 'desert', waves: 20, startGold: 250, startLives: 20, hpMul: 1.05,
      desc: 'The road circles a great mesa and doubles back across itself.',
      paths: [[[0,8],[3,8],[3,2],[21,2],[21,14],[6,14],[6,6],[17,6],[17,10],[24,10]]],
      features: [['rock', 9, 9, 14, 12], ['water', 23, 13, 24, 16]] },
    { name: 'Fortress', biome: 'desert', waves: 20, startGold: 260, startLives: 20, hpMul: 1.05,
      desc: 'Two caravan routes join before the fortress gate.',
      paths: [[[0,3],[8,3],[8,8],[16,8],[16,4],[24,4]], [[0,13],[8,13],[8,8],[16,8],[16,4],[24,4]]],
      features: [['rock', 11, 11, 14, 14], ['water', 19, 9, 23, 12], ['rock', 11, 1, 13, 2]] },
    { name: 'Canyon', biome: 'tundra', waves: 22, startGold: 250, startLives: 18, hpMul: 1.1,
      desc: 'A frozen canyon cut into deep switchbacks.',
      paths: [[[0,14],[4,14],[4,2],[9,2],[9,14],[14,14],[14,2],[19,2],[19,14],[24,14]]],
      features: [['ice', 21, 4, 23, 9], ['rock', 6, 6, 7, 9], ['rock', 16, 6, 17, 9]] },
    { name: 'Labyrinth', biome: 'tundra', waves: 22, startGold: 260, startLives: 18, hpMul: 1.15,
      desc: 'An icy maze of twists and blind turns.',
      paths: [[[0,2],[5,2],[5,8],[1,8],[1,14],[10,14],[10,5],[15,5],[15,12],[20,12],[20,2],[24,2]]],
      features: [['ice', 12, 7, 13, 11], ['rock', 4, 10, 7, 11], ['ice', 22, 6, 24, 10]] },
    { name: 'Twin Paths', biome: 'tundra', waves: 24, startGold: 280, startLives: 18, hpMul: 1.15,
      desc: 'Two mirrored roads run side by side through the snow.',
      paths: [[[0,2],[8,2],[8,7],[16,7],[16,2],[24,2]], [[0,14],[8,14],[8,9],[16,9],[16,14],[24,14]]],
      features: [['ice', 10, 11, 14, 12], ['ice', 10, 4, 14, 5], ['rock', 2, 6, 4, 10], ['rock', 20, 6, 22, 10]] },
    { name: 'Gauntlet', biome: 'volcano', waves: 25, startGold: 270, startLives: 15, hpMul: 1.2,
      desc: 'Narrow ridges between rivers of lava. Space is precious.',
      paths: [[[0,8],[3,8],[3,2],[7,2],[7,14],[11,14],[11,2],[15,2],[15,14],[19,14],[19,2],[22,2],[22,8],[24,8]]],
      features: [['lava', 5, 4, 5, 12], ['lava', 13, 4, 13, 12], ['lava', 17, 4, 17, 12], ['lava', 21, 11, 24, 16]] },
    { name: 'Wasteland', biome: 'volcano', waves: 25, startGold: 290, startLives: 15, hpMul: 1.25,
      desc: 'Ash plains where two war parties cut across each other.',
      paths: [[[0,2],[12,2],[12,14],[24,14]], [[24,2],[18,2],[18,8],[6,8],[6,16]]],
      features: [['lava', 1, 10, 4, 14], ['lava', 14, 3, 16, 6], ['rock', 19, 10, 22, 12]] },
    { name: 'Final Stand', biome: 'volcano', waves: 30, startGold: 320, startLives: 10, hpMul: 1.3,
      desc: 'The last citadel. Both armies march on the heart of the fortress.',
      paths: [[[0,2],[9,2],[9,5],[3,5],[3,12],[8,12],[8,8],[12,8]], [[24,14],[15,14],[15,11],[21,11],[21,4],[16,4],[16,8],[12,8]]],
      features: [['lava', 10, 11, 13, 13], ['lava', 11, 3, 13, 5], ['rock', 0, 14, 2, 16], ['rock', 23, 0, 24, 2]] }
  ];

  // Format 1 wave counts, used once to honour maps already won back then
  const V1_WAVES = [15, 18, 15, 20, 15, 12, 18, 20, 16, 25, 15, 30];

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
    arrow: ['shoot', 1.4], cannon: ['thud', 1.1], frost: ['blip', 1.6], tesla: ['zap', 1.1],
    flame: ['whoosh', 1.5], poison: ['bounce', 0.8], laser: ['laser', 1.3], sniper: ['shoot', 0.6]
  };
  const lastShotSoundAt = {};

  function playShotSound(def) {
    const now = performance.now();
    const snd = SHOT_SOUNDS[def.id];
    if (!snd || now - (lastShotSoundAt[def.id] || 0) < 110)
      return;
    lastShotSoundAt[def.id] = now;
    audio.play(snd[0], { pitch: snd[1] * (0.95 + Math.random() * 0.1), volume: 0.3 });
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

  let towers = [];
  let enemies = [];
  let projectiles = [];
  let clouds = [];              // poison clouds
  let fxLines = [];             // lightning arcs, sniper tracers (drawn briefly)
  let floorEffects = [];        // burning ground and ice patches
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

  /* ── Global animation timer ── */
  let animTime = 0;

  /* ── Run statistics and HUD bookkeeping ── */
  let runStats = { kills: 0, gold: 0, leaked: 0 };
  let waveSize = 0;                       // enemies in the current wave
  const goldHudPos = { x: 0, y: 0 };      // where gold counts up (UI units)

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE -- high scores and the saved game (format 2; format 1
     saves are converted once and then removed)
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      const list = raw ? JSON.parse(raw) : [];
      highScores = Array.isArray(list) ? list.filter(h => h && typeof h.map === 'string' && isFiniteNumber(h.waves)) : [];
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
      for (const v of [i + 1, highScores[i].map, highScores[i].waves]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ── Campaign progress: stars per map, kept apart from the saved game ── */
  let meta = null;
  let lastResult = null;     // outcome of the map just finished, for the end screen

  function defaultMeta() {
    return { version: 1, maps: MAPS.map(() => ({ stars: 0, best: 0, wins: 0 })), rp: 0, rpEarned: 0, tree: {} };
  }

  function loadMeta() {
    let d = null;
    try {
      const raw = localStorage.getItem(STORAGE_META);
      if (raw) d = JSON.parse(raw);
    } catch (_) {
      d = null;
    }
    meta = defaultMeta();
    if (d && typeof d === 'object') {
      if (Array.isArray(d.maps))
        d.maps.forEach((m, i) => {
          if (i < MAPS.length && m && typeof m === 'object')
            meta.maps[i] = {
              stars: clamp(Math.floor(num(m.stars, 0)), 0, 3),
              best: clamp(Math.floor(num(m.best, 0)), 0, MAPS[i].waves),
              wins: Math.max(0, Math.floor(num(m.wins, 0)))
            };
        });
      meta.rp = Math.max(0, Math.floor(num(d.rp, 0)));
      meta.rpEarned = Math.max(meta.rp, Math.floor(num(d.rpEarned, 0)));
      if (d.tree && typeof d.tree === 'object')
        meta.tree = d.tree;
    } else {
      // First start with campaign progress: honour maps already won before
      for (const h of highScores) {
        const i = MAPS.findIndex(m => m.name === h.map);
        if (i >= 0 && h.waves >= V1_WAVES[i])
          meta.maps[i].stars = Math.max(meta.maps[i].stars, 1);
      }
      saveMeta();
    }
  }

  function saveMeta() {
    try {
      localStorage.setItem(STORAGE_META, JSON.stringify(meta));
    } catch (_) {}
  }

  function starsForRun() {
    const ratio = lives / MAPS[currentMap].startLives;
    return ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
  }

  function totalStars() {
    return meta.maps.reduce((a, m) => a + m.stars, 0);
  }

  function mapUnlocked(i) {
    return i === 0 || meta.maps[i].stars > 0 || meta.maps[i - 1].stars > 0 || (!!savedGameInfo && savedGameInfo.map === i);
  }

  function recordResult(victory) {
    const m = meta.maps[currentMap];
    const waves = victory ? currentWave : Math.max(0, currentWave - 1);
    const prevStars = m.stars;
    const stars = victory ? starsForRun() : 0;
    const prevBest = m.best;
    m.best = Math.max(m.best, waves);
    if (victory) {
      m.stars = Math.max(m.stars, stars);
      ++m.wins;
    }
    lastResult = { victory, stars, prevStars, newBest: waves > prevBest, waves, t: 0, unlocked: victory && prevStars === 0 && currentMap + 1 < MAPS.length };
    saveMeta();
  }
  const SAVE_VERSION = 2;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  const ENEMY_SAVE_FIELDS = ['hp', 'maxHp', 'speed', 'bounty', 'radius', 'armor', 'dist', 'slowMul', 'slowTimer', 'freezeTimer', 'stunTimer',
    'burnDps', 'burnTimer', 'poisonTimer', 'acidTimer', 'shred', 'shieldHp', 'shieldMax', 'healCooldown', 'abilityTimer', 'revealTimer'];
  let autosaveTimer = 0;
  let savedGameInfo = null; // { map, wave, waves } summary for the start screen, null when no save exists
  let saveNotice = '';      // shown on the start screen when a save had to be discarded

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function num(v, fallback) {
    return isFiniteNumber(v) ? v : fallback;
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
      phase: state === STATE_BUILD || (state === STATE_PAUSED && pausedFrom === STATE_BUILD) ? 'build' : 'wave',
      gameSpeed, autoWaveMode, autoWaveTimer,
      waveComplete, waveCountdown, spawnTimer, waveSize, lastPaidWave,
      waveEnemies: waveEnemies.slice(),
      stats: { kills: runStats.kills, gold: runStats.gold, leaked: runStats.leaked },
      towers: towers.map(t => ({
        col: t.col, row: t.row, type: TOWER_TYPES[t.type].id, tier: t.tier, branch: t.branch,
        target: t.target, kills: t.kills, dealt: Math.round(t.dealt), hp: t.hp, maxHp: t.maxHp,
        spent: t.spent, builtWave: t.builtWave
      })),
      floor: floorEffects.map(fe => ({ col: fe.col, row: fe.row, type: fe.type, timer: fe.timer, damage: fe.damage })),
      enemies: enemies.filter(e => e.hp > 0).map(e => {
        const o = { type: e.type, pi: e.pi, elite: !!e.elite, enraged: !!e.enraged };
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
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
    savedGameInfo = null;
  }

  /* ── Format 1 conversion ── */

  // Format 1 tower types, in their old order, mapped to today's families
  const V1_TOWERS = ['arrow', 'cannon', 'frost', 'tesla', 'laser', 'poison', 'tesla', 'cannon', 'flame', 'frost', 'flame', 'tesla', 'sniper', 'spikes'];
  // Number of path tiles of each map in format 1 (enemy progress is kept as a share of it)
  const V1_PATH_TILES = [43, 49, 129, 49, 25, 45, 85, 65, 41, 57, 37, 25];

  function tierSpent(def, tier) {
    let spent = def.cost;
    for (let n = 2; n <= tier; ++n)
      spent += Math.round(def.cost * TIER_COST[n] / 5) * 5;
    return spent;
  }

  function migrateV1(d) {
    if (!d || d.version !== 1 || !Number.isInteger(d.map) || d.map < 0 || d.map >= MAPS.length)
      throw new Error('v1');
    const out = {
      version: 2, map: d.map, gold: num(d.gold, 0), lives: d.lives, wave: d.wave,
      phase: d.phase === 'build' ? 'build' : 'wave',
      gameSpeed: d.gameSpeed, autoWaveMode: !!d.autoWaveMode, autoWaveTimer: num(d.autoWaveTimer, 0),
      waveComplete: !!d.waveComplete, waveCountdown: num(d.waveCountdown, 3), spawnTimer: num(d.spawnTimer, 0),
      waveEnemies: Array.isArray(d.waveEnemies) ? d.waveEnemies.filter(t => ENEMY_TYPES[t]) : [],
      towers: [], floor: [], enemies: []
    };
    for (const t of Array.isArray(d.towers) ? d.towers : []) {
      if (!t || !Number.isInteger(t.type) || !V1_TOWERS[t.type]) continue;
      const def = TOWER_BY_ID[V1_TOWERS[t.type]];
      const tier = clamp(Number.isInteger(t.tier) ? t.tier : 1, 1, 3);
      out.towers.push({ col: t.col, row: t.row, type: def.id, tier, branch: -1, target: 'first', kills: num(t.kills, 0), dealt: 0,
        hp: num(t.hp, 100), maxHp: num(t.maxHp, 100), spent: tierSpent(def, tier), builtWave: -1 });
    }
    for (const fe of Array.isArray(d.floorEffects) ? d.floorEffects : []) {
      if (!fe) continue;
      if (fe.type === 'spike')
        out.towers.push({ col: fe.col, row: fe.row, type: 'spikes', tier: 1, branch: -1, target: 'first', kills: 0, dealt: 0, hp: 100, maxHp: 100, spent: TOWER_BY_ID.spikes.cost, builtWave: -1 });
      else if ((fe.type === 'lava' || fe.type === 'ice') && isFiniteNumber(fe.timer) && fe.timer > 0)
        out.floor.push({ col: fe.col, row: fe.row, type: fe.type, timer: fe.timer, damage: num(fe.damage, 0) });
    }
    const tiles = V1_PATH_TILES[d.map] || 2;
    for (const e of Array.isArray(d.enemies) ? d.enemies : []) {
      if (!e || !ENEMY_TYPES[e.type] || !isFiniteNumber(e.hp) || e.hp <= 0) continue;
      const def = ENEMY_TYPES[e.type];
      const share = clamp((num(e.pathIndex, 0) + num(e.pathProgress, 0)) / Math.max(1, tiles - 1), 0, 0.98);
      out.enemies.push({ type: e.type, pi: 0, share, hp: e.hp, maxHp: num(e.maxHp, e.hp), speed: num(e.baseSpeed, def.speed),
        bounty: num(e.bounty, def.bounty), radius: num(e.radius, def.radius), armor: def.armor || 0,
        shieldHp: num(e.shieldHp, 0), shieldMax: num(e.shieldHp, 0), slowTimer: num(e.slowTimer, 0), freezeTimer: num(e.freezeTimer, 0) });
    }
    return out;
  }

  // Parses and validates a save; returns plain format-2 data or null (with saveNotice set) when unusable
  function readSavedGame() {
    let raw = null, rawV1 = null;
    try {
      raw = localStorage.getItem(STORAGE_SAVE);
      if (!raw)
        rawV1 = localStorage.getItem(STORAGE_SAVE_V1);
    } catch (_) {
      return null;
    }
    if (!raw && !rawV1)
      return null;

    try {
      const d = raw ? JSON.parse(raw) : migrateV1(JSON.parse(rawV1));
      if (!d || d.version !== SAVE_VERSION)
        throw new Error('version');
      if (!Number.isInteger(d.map) || d.map < 0 || d.map >= MAPS.length)
        throw new Error('map');
      const mapDef = MAPS[d.map];
      if (!Number.isInteger(d.wave) || d.wave < 0 || d.wave > mapDef.waves)
        throw new Error('wave');
      if (!isFiniteNumber(d.gold) || !Number.isInteger(d.lives) || d.lives <= 0)
        throw new Error('stats');
      if (!Array.isArray(d.towers) || !Array.isArray(d.enemies) || !Array.isArray(d.waveEnemies))
        throw new Error('lists');
      if (rawV1) {
        // Converted once: from now on the game lives in the new slot
        try {
          localStorage.setItem(STORAGE_SAVE, JSON.stringify(d));
          localStorage.removeItem(STORAGE_SAVE_V1);
        } catch (_) {}
      }
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
    gold = Math.max(0, Math.floor(d.gold));
    lives = d.lives;
    currentWave = d.wave;
    gameSpeed = [1, 2, 3].indexOf(d.gameSpeed) >= 0 ? d.gameSpeed : (isFiniteNumber(d.gameSpeed) && d.gameSpeed > 3 ? 3 : 1);
    autoWaveMode = !!d.autoWaveMode;
    autoWaveTimer = num(d.autoWaveTimer, 0);
    waveComplete = d.phase === 'build' ? true : !!d.waveComplete;
    waveCountdown = num(d.waveCountdown, 3);
    spawnTimer = num(d.spawnTimer, 0);
    waveEnemies = d.waveEnemies.filter(isQueueToken);
    lastPaidWave = Number.isInteger(d.lastPaidWave) ? clamp(d.lastPaidWave, 0, currentWave) : (d.phase === 'build' ? currentWave : Math.max(0, currentWave - 1));
    if (d.stats)
      runStats = { kills: num(d.stats.kills, 0), gold: num(d.stats.gold, 0), leaked: num(d.stats.leaked, 0) };

    // Towers: anything that no longer fits the map is refunded
    for (const o of d.towers) {
      const def = o && TOWER_BY_ID[o.type];
      if (!def || !Number.isInteger(o.col) || !Number.isInteger(o.row)) continue;
      const tier = clamp(Number.isInteger(o.tier) ? o.tier : 1, 1, MAX_TIER);
      const branch = tier >= BRANCH_TIER ? (o.branch === 1 ? 1 : 0) : -1;
      const spent = num(o.spent, tierSpent(def, tier));
      if (!canBuildAt(def.index, o.col, o.row)) {
        gold += spent;
        continue;
      }
      const t = makeTower(o.col, o.row, def.index, tier, branch);
      t.target = TARGET_MODES.indexOf(o.target) >= 0 ? o.target : 'first';
      t.kills = num(o.kills, 0);
      t.dealt = num(o.dealt, 0);
      t.maxHp = Math.max(1, num(o.maxHp, 100));
      t.hp = clamp(num(o.hp, t.maxHp), 1, t.maxHp);
      t.spent = spent;
      t.builtWave = num(o.builtWave, -1);
      towers.push(t);
    }

    floorEffects = [];
    for (const fe of Array.isArray(d.floor) ? d.floor : [])
      if (fe && (fe.type === 'lava' || fe.type === 'ice') && isFiniteNumber(fe.timer) && fe.timer > 0)
        addFloorEffect(fe.col, fe.row, fe.type, fe.timer, num(fe.damage, 0));

    enemies = [];
    for (const o of d.enemies) {
      if (!o || !ENEMY_TYPES[o.type] || !isFiniteNumber(o.hp) || o.hp <= 0) continue;
      const pi = Number.isInteger(o.pi) && o.pi >= 0 && o.pi < paths.length ? o.pi : 0;
      const e = spawnEnemy(o.type + (o.elite ? '!' : ''), pi, 1);
      e.enraged = !!o.enraged;
      for (const k of ENEMY_SAVE_FIELDS)
        if (isFiniteNumber(o[k]))
          e[k] = o[k];

      const path = enemyPath(e);
      if (isFiniteNumber(o.share))
        e.dist = o.share * path.total;
      e.dist = clamp(e.dist, 0, path.total - 1);
      e.maxHp = Math.max(e.maxHp, e.hp);
      e.spawnT = 1;
      pathPos(path, e.dist, e);
    }
    waveSize = Math.max(num(d.waveSize, 0), waveEnemies.filter(t => t !== '|').length + enemies.length);

    shownGold = gold;

    // A wave in progress resumes paused so the player can get their bearings
    if (d.phase === 'build')
      state = STATE_BUILD;
    else {
      state = STATE_PAUSED;
      pausedFrom = STATE_PLAYING;
    }
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
    if (state === STATE_PLAYING) {
      pausedFrom = state;
      state = STATE_PAUSED;
    }
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
     PATHS -- polylines with cumulative lengths; enemies store how far
     along their path they are
     ══════════════════════════════════════════════════════════════════ */

  let paths = [];
  let pathPoints = [];          // points of the first path (markers, previews)

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

  function mapPaths(mapDef) {
    return mapDef.paths;
  }

  let blockedCells = new Map();    // 'col,row' -> 'water' | 'ice' | 'lava' | 'rock' | 'tree'

  function buildPathCells(mapDef) {
    pathCells = new Set();
    for (const wp of mapPaths(mapDef))
      walkPath(wp, (x, y) => pathCells.add(`${x},${y}`));
    buildBlockedCells(mapDef);
  }

  // Map features plus a sprinkling of trees and boulders well away from the road
  function buildBlockedCells(mapDef) {
    blockedCells = new Map();
    for (const [type, c0, r0, c1, r1] of mapDef.features || [])
      for (let r = r0; r <= r1; ++r)
        for (let c = c0; c <= c1; ++c)
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !pathCells.has(`${c},${r}`))
            blockedCells.set(`${c},${r}`, type);
    const rng = makeRng(MAPS.indexOf(mapDef) * 31337 + 7);
    const near = (c, r, d) => {
      for (let y = r - d; y <= r + d; ++y)
        for (let x = c - d; x <= c + d; ++x)
          if (pathCells.has(`${x},${y}`)) return true;
      return false;
    };
    let placed = 0;
    for (let i = 0; i < 400 && placed < 16; ++i) {
      const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
      const key = `${c},${r}`;
      if (blockedCells.has(key) || near(c, r, 2)) continue;
      blockedCells.set(key, rng() < 0.65 ? 'tree' : 'rock');
      ++placed;
    }
  }

  function isEdge(p) {
    return p[0] === 0 || p[1] === 0 || p[0] === COLS - 1 || p[1] === ROWS - 1;
  }

  function makePath(points) {
    const cum = [0];
    for (let i = 1; i < points.length; ++i)
      cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return { pts: points, cum, total: cum[cum.length - 1] };
  }

  function getPathPoints(waypoints) {
    const points = [];
    walkPath(waypoints, (x, y) => points.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));
    // Enemies enter from just outside the field and leave past an exit on the edge
    const extend = (a, b) => ({ x: a.x + (a.x - b.x) * 1.2, y: a.y + (a.y - b.y) * 1.2 });
    if (points.length > 1) {
      if (isEdge(waypoints[0]))
        points.unshift(extend(points[0], points[1]));
      if (isEdge(waypoints[waypoints.length - 1]))
        points.push(extend(points[points.length - 1], points[points.length - 2]));
    }
    return points;
  }

  function buildPaths(mapDef) {
    paths = mapPaths(mapDef).map(wp => makePath(getPathPoints(wp)));
    // Flyers cut straight from the spawn to the exit
    airPaths = paths.map(p => makePath([p.pts[0], p.pts[p.pts.length - 1]]));
    pathPoints = paths[0].pts;
  }
  let airPaths = [];

  function enemyPath(e) {
    return ENEMY_TYPES[e.type].flying ? airPaths[e.pi] : paths[e.pi];
  }
  // Position (and heading) at a distance along a path
  function pathPos(path, dist, out) {
    const cum = path.cum, pts = path.pts;
    if (dist <= 0) {
      out.x = pts[0].x; out.y = pts[0].y;
      out.angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      return out;
    }
    let lo = 0, hi = cum.length - 1;
    if (dist >= path.total) {
      out.x = pts[hi].x; out.y = pts[hi].y;
      out.angle = Math.atan2(pts[hi].y - pts[hi - 1].y, pts[hi].x - pts[hi - 1].x);
      return out;
    }
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= dist) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (dist - cum[lo]) / seg;
    out.x = pts[lo].x + (pts[hi].x - pts[lo].x) * t;
    out.y = pts[lo].y + (pts[hi].y - pts[lo].y) * t;
    out.angle = Math.atan2(pts[hi].y - pts[lo].y, pts[hi].x - pts[lo].x);
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     MAP LOADING
     ══════════════════════════════════════════════════════════════════ */

  function resetBattlefield() {
    towers = [];
    enemies = [];
    projectiles = [];
    clouds = [];
    fxLines = [];
    floorEffects = [];
    selectedTower = null;
    selectedTowerType = -1;
    waveEnemies = [];
    spawnTimer = 0;
    waveComplete = true;
    waveCountdown = 3;
    warningActive = false;
    warningTimer = 0;
    autoWaveTimer = 0;
    waveSize = 0;
    lastPaidWave = 0;
    bossIntro = null;
    previewCache.key = '';
  }


  function loadMap(index) {
    currentMap = index;
    const mapDef = MAPS[currentMap];
    gold = mapDef.startGold;
    lives = mapDef.startLives;
    totalWaves = mapDef.waves;
    currentWave = 0;
    gameSpeed = 1;
    resetBattlefield();
    buildPathCells(mapDef);
    buildPaths(mapDef);
    runStats = { kills: 0, gold: 0, leaked: 0 };
    shownGold = gold;
    state = STATE_BUILD;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER STATS
     ══════════════════════════════════════════════════════════════════ */

  // Effective stats of a tower type at a tier / branch (range and splash in px)
  function computeStats(def, tier, branch) {
    const s = {};
    for (const k in def)
      if (typeof def[k] === 'number' || typeof def[k] === 'boolean')
        s[k] = def[k];
    s.kind = def.kind;
    s.hits = def.hits;
    let mods;
    if (tier <= 3)
      mods = def.tiers[tier - 1] || {};
    else {
      const b = def.branches[branch] || def.branches[0];
      mods = tier >= 5 ? b.t5 : b.t4;
    }
    for (const k in mods)
      s[k] = MUL_KEYS[k] ? def[k] * mods[k] : mods[k];
    s.damage = Math.round(s.damage * 10) / 10;
    s.rangePx = s.range * CELL;
    s.splashPx = (s.splash || 0) * CELL;
    s.chainPx = (s.chainRange || 0) * CELL;
    s.cloudPx = (s.cloud || 0) * CELL;
    return s;
  }

  function towerStats(t) {
    if (!t.stats)
      t.stats = computeStats(TOWER_TYPES[t.type], t.tier, t.branch);
    return t.stats;
  }

  function towerDef(t) {
    return TOWER_TYPES[t.type];
  }

  // Display name: the branch name once a branch is chosen
  function towerName(t) {
    const def = towerDef(t);
    return t.branch >= 0 ? def.branches[t.branch].name : def.name;
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER PLACEMENT & UPGRADE & SELL
     ══════════════════════════════════════════════════════════════════ */

  function towerAt(col, row) {
    for (const t of towers)
      if (t.col === col && t.row === row)
        return t;
    return null;
  }

  function canPlace(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const key = `${col},${row}`;
    if (pathCells.has(key) || blockedCells.has(key)) return false;
    return !towerAt(col, row);
  }

  function canPlaceTrap(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (!pathCells.has(`${col},${row}`)) return false;
    return !towerAt(col, row);
  }

  function canBuildAt(typeIndex, col, row) {
    return TOWER_TYPES[typeIndex].trap ? canPlaceTrap(col, row) : canPlace(col, row);
  }

  function makeTower(col, row, typeIndex, tier, branch) {
    return {
      col, row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      type: typeIndex,
      tier: tier || 1,
      branch: branch === undefined ? -1 : branch,
      target: 'first',
      cooldown: 0,
      angle: -Math.PI / 2,
      kills: 0,
      dealt: 0,
      hp: 100,
      maxHp: 100,
      spent: 0,
      builtWave: -1,
      flash: 0,
      recoil: 0,
      beamTarget: null,
      beamTime: 0,
      beamTargets: [],
      stats: null
    };
  }

  function placeTower(col, row, typeIndex) {
    const def = TOWER_TYPES[typeIndex];
    if (!canBuildAt(typeIndex, col, row))
      return false;
    if (gold < def.cost) {
      audio.play('error');
      return false;
    }
    gold -= def.cost;
    const tower = makeTower(col, row, typeIndex, 1, -1);
    tower.spent = def.cost;
    tower.builtWave = state === STATE_BUILD ? currentWave : -1;
    towers.push(tower);
    particles.sparkle(tower.x, tower.y, 12, { color: def.color, speed: 3 });
    audio.play(def.trap ? 'click' : 'drop', def.trap ? { pitch: 0.8 } : undefined);
    floatingText.add(tower.x, tower.y - 16, `-${def.cost}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    return true;
  }

  function getUpgradeCost(tower) {
    if (tower.tier >= MAX_TIER) return 0;
    return Math.round(TOWER_TYPES[tower.type].cost * TIER_COST[tower.tier + 1] / 5) * 5;
  }

  // branch: required when going from tier 3 to 4
  function upgradeTower(tower, branch) {
    if (tower.tier >= MAX_TIER) return false;
    if (tower.tier + 1 === BRANCH_TIER && branch !== 0 && branch !== 1) return false;
    const def = TOWER_TYPES[tower.type];
    const cost = getUpgradeCost(tower);
    if (gold < cost) return false;
    gold -= cost;
    tower.spent += cost;
    ++tower.tier;
    if (tower.tier === BRANCH_TIER)
      tower.branch = branch;
    tower.stats = null;
    const hpBefore = tower.hp / tower.maxHp;
    tower.maxHp = 100 + (tower.tier - 1) * 25;
    tower.hp = tower.maxHp * hpBefore;
    particles.sparkle(tower.x, tower.y, 15, { color: '#ffd75a', speed: 4 });
    particles.burst(tower.x, tower.y, 8, { color: def.color, speed: 2, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, tower.tier === BRANCH_TIER ? towerName(tower) + '!' : `Tier ${toRoman(tower.tier)}!`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
    screenShake.trigger(2, 80);
    audio.play('powerup', { pitch: 0.85 + tower.tier * 0.08 });
    return true;
  }

  function getSellValue(tower) {
    // Full refund for a tower built during this build phase
    if (state === STATE_BUILD && tower.builtWave === currentWave)
      return tower.spent;
    return Math.floor(tower.spent * 0.6);
  }

  function sellTower(tower) {
    const refund = getSellValue(tower);
    gold += refund;
    const idx = towers.indexOf(tower);
    if (idx !== -1) towers.splice(idx, 1);
    floatingText.add(tower.x, tower.y - 16, `+${refund}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    particles.burst(tower.x, tower.y, 8, { color: '#aaa', speed: 2, life: 0.4 });
    audio.play('coin');
    if (selectedTower === tower)
      selectedTower = null;
  }

  function repairCost(t) {
    return t.hp >= t.maxHp ? 0 : Math.max(1, Math.floor((t.maxHp - t.hp) * 0.3));
  }

  function repairTower(tower) {
    const cost = repairCost(tower);
    if (cost <= 0 || gold < cost) return false;
    gold -= cost;
    tower.hp = tower.maxHp;
    particles.sparkle(tower.x, tower.y, 8, { color: '#4f4', speed: 2 });
    audio.play('pickup');
    floatingText.add(tower.x, tower.y - 16, `Repaired -${cost}`, { color: '#8f8', font: 'bold 9px sans-serif' });
    return true;
  }

  function destroyTower(tower) {
    const idx = towers.indexOf(tower);
    if (idx === -1) return;
    towers.splice(idx, 1);
    if (selectedTower === tower)
      selectedTower = null;
    particles.burst(tower.x, tower.y, 15, { color: '#f44', speed: 4, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, 'DESTROYED!', { color: '#f44', font: 'bold 10px sans-serif' });
    screenShake.trigger(4, 200);
    audio.play('explode', { pitch: 1.3, volume: 0.7 });
  }

  function cycleTargeting(tower, dir) {
    const i = TARGET_MODES.indexOf(tower.target);
    tower.target = TARGET_MODES[(i + (dir || 1) + TARGET_MODES.length) % TARGET_MODES.length];
    audio.play('click', { pitch: 1.1 });
  }

  /* ══════════════════════════════════════════════════════════════════
     WAVES
     ══════════════════════════════════════════════════════════════════ */

  // Small deterministic generator so a wave can be previewed before it starts
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Queue tokens: an enemy key, optionally followed by '!' for an elite, or '|' for a pause
  function parseToken(tok) {
    if (typeof tok !== 'string' || tok === '|') return null;
    const elite = tok.charAt(tok.length - 1) === '!';
    const type = elite ? tok.slice(0, -1) : tok;
    return ENEMY_TYPES[type] ? { type, elite } : null;
  }

  function isQueueToken(tok) {
    return tok === '|' || !!parseToken(tok);
  }

  function isBossWave(waveNo, waves) {
    return waveNo === waves || waveNo % 5 === 0;
  }

  // waveNo is 1-based. Picks a few enemy groups from the types unlocked so far
  // and fills the wave's budget; every fifth wave and the last one bring a boss.
  function generateWave(waveNo, mapIndex) {
    const mi = mapIndex === undefined ? currentMap : mapIndex;
    const mapDef = MAPS[mi];
    const waves = mapDef.waves;
    const rng = makeRng(mi * 7919 + waveNo * 104729 + 17);
    const progress = (waveNo - 1) / Math.max(1, waves - 1);
    const pool = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].cost > 0 && !ENEMY_TYPES[k].boss && ENEMY_TYPES[k].unlock <= progress + 1e-6);
    let budget = (7 + waveNo * 3.2 + waveNo * waveNo * 0.12) * (mapDef.budgetMul || 1);
    const queue = [];
    // The newest type gets the spotlight in the wave it first appears
    const fresh = pool.filter(k => ENEMY_TYPES[k].unlock > (waveNo - 2) / Math.max(1, waves - 1));
    const groups = [];
    const nGroups = waveNo <= 2 ? 1 : Math.min(pool.length, 2 + Math.floor(rng() * 2));
    for (let g = 0; g < nGroups; ++g) {
      const k = g === 0 && fresh.length ? fresh[Math.floor(rng() * fresh.length)] : pool[Math.floor(rng() * pool.length)];
      if (groups.indexOf(k) < 0) groups.push(k);
    }
    if (groups.indexOf('normal') < 0 && waveNo <= 4) groups.push('normal');
    const eliteChance = clamp((progress - 0.4) * 0.5, 0, 0.22);
    const boss = isBossWave(waveNo, waves);
    if (boss) budget *= 0.6;
    for (let g = 0; g < groups.length; ++g) {
      const def = ENEMY_TYPES[groups[g]];
      const share = budget / (groups.length - g);
      let n = Math.max(1, Math.round(share / def.cost));
      if (def.pack) n = Math.max(def.pack, Math.round(n / def.pack) * def.pack);
      budget -= n * def.cost;
      if (queue.length) queue.push('|');
      for (let i = 0; i < n; ++i)
        queue.push(groups[g] + (rng() < eliteChance && !def.pack ? '!' : ''));
    }
    if (boss) {
      const bossType = waveNo === waves ? BOSS_ORDER[mi % BOSS_ORDER.length] : BOSS_ORDER[(Math.floor(waveNo / 5) - 1) % BOSS_ORDER.length];
      queue.push('|');
      queue.push(bossType + (waveNo === waves ? '!' : ''));
    }
    return queue;
  }

  // Count of each enemy kind in a queue, for the preview
  function summarizeWave(queue) {
    const out = [];
    for (const tok of queue) {
      const p = parseToken(tok);
      if (!p) continue;
      let row = out.find(r => r.type === p.type);
      if (!row) out.push(row = { type: p.type, count: 0, elite: 0 });
      ++row.count;
      if (p.elite) ++row.elite;
    }
    return out;
  }

  let previewCache = { key: '', list: [] };
  function nextWavePreview() {
    const key = currentMap + ':' + (currentWave + 1);
    if (previewCache.key !== key)
      previewCache = { key, list: currentWave < totalWaves ? summarizeWave(generateWave(currentWave + 1)) : [] };
    return previewCache.list;
  }
  function triggerVictory() {
    state = STATE_VICTORY;
    clearSavedGame();
    addHighScore(MAPS[currentMap].name, currentWave);
    recordResult(true);
    particles.confetti(WORLD_W / 2, WORLD_H / 2, 40, { speed: 6, gravity: 0.08 });
    screenShake.trigger(6, 300);
    audio.play('win');
    updateWindowTitle();
  }

  function startNextWave() {
    if (state !== STATE_BUILD && !canCallEarly()) return;
    if (currentWave >= totalWaves) {
      if (state === STATE_BUILD)
        triggerVictory();
      return;
    }
    const early = state === STATE_PLAYING;
    const queue = generateWave(currentWave + 1);
    if (early) {
      waveEnemies = waveEnemies.concat(['|', '|'], queue);
      waveSize += queue.filter(t => t !== '|').length;
      const bonus = 8 + currentWave * 2;
      gold += bonus;
      runStats.gold += bonus;
      goldPulse = 1;
      floatingText.add(WORLD_W / 2, 60, `Called early  +${bonus} gold`, { color: '#ffd75a', font: 'bold 13px sans-serif' });
    } else {
      waveEnemies = queue;
      waveSize = queue.filter(t => t !== '|').length;
      spawnTimer = 0;
    }
    waveComplete = false;
    ++currentWave;
    state = STATE_PLAYING;
    warningActive = false;
    warningTimer = 0;
    announceWave();
    audio.play('select', { pitch: 0.75 });
    updateWindowTitle();
    saveGame();
  }

  // During a wave the next one may be called once the current one is fully on the field
  function canCallEarly() {
    return state === STATE_PLAYING && currentWave < totalWaves && waveEnemies.length === 0;
  }

  function announceWave() {
    const boss = isBossWave(currentWave, totalWaves);
    floatingText.add(WORLD_W / 2, WORLD_H / 2 - 20, currentWave === totalWaves ? 'FINAL WAVE' : `WAVE ${currentWave}`, { color: boss ? '#ff6a6a' : '#ffd75a', font: 'bold 26px sans-serif' });
  }
  // Gold paid when a wave is cleared: flat bonus plus mines and banks
  function payWaveIncome(count) {
    let bonus = 0;
    for (let w = currentWave - count + 1; w <= currentWave; ++w)
      bonus += 10 + w * 2;
    let bankInterest = 0, bankCap = 0;
    for (const t of towers) {
      const s = towerStats(t);
      if (s.income) {
        bonus += s.income * count;
        floatingText.add(t.x, t.y - 16, `+${s.income * count}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
        particles.sparkle(t.x, t.y, 6, { color: '#ffd75a', speed: 2 });
      }
      if (s.interest) {
        bankInterest += s.interest;
        bankCap += s.interestCap;
      }
    }
    if (bankInterest > 0)
      bonus += Math.min(bankCap, Math.floor(gold * bankInterest));
    gold += bonus;
    runStats.gold += bonus;
    floatingText.add(WORLD_W / 2, 40, `Wave cleared  +${bonus} gold`, { color: '#ffd75a', font: 'bold 14px sans-serif' });
    goldPulse = 1;
  }

  function beginPreWaveWarning() {
    warningActive = true;
    audio.play('blip', { pitch: 0.6 });
    warningTimer = WARNING_DURATION;
    warningPulse = 0;
  }

  // Health multiplier of a wave (1-based) on the current map
  function waveHpScale(waveNo) {
    const w = Math.max(0, waveNo - 1);
    return (1 + 0.11 * w + 0.009 * w * w) * (MAPS[currentMap].hpMul || 1);
  }

  function spawnEnemy(token, pathIndex, atDist) {
    const p = parseToken(token) || { type: 'normal', elite: false };
    const type = p.type;
    const def = ENEMY_TYPES[type];
    const scale = waveHpScale(Math.max(1, currentWave));
    const pi = pathIndex === undefined ? (spawnCounter++ % paths.length) : pathIndex;
    const hp = Math.floor(def.hp * scale * (p.elite ? ELITE_HP : 1));
    const shield = def.shielded ? Math.floor(hp * def.shielded) : 0;
    const e = {
      type, elite: p.elite,
      hp, maxHp: hp,
      speed: def.speed * (p.elite ? 1.1 : 1),
      bounty: Math.round(def.bounty * (1 + currentWave * 0.03) * (p.elite ? 2 : 1)),
      radius: def.radius * (p.elite ? 1.15 : 1),
      armor: (def.armor || 0) + (p.elite && def.armor ? 2 : 0),
      pi, dist: atDist || 0,
      x: 0, y: 0, angle: 0,
      slowMul: 1, slowTimer: 0, freezeTimer: 0, stunTimer: 0,
      burnDps: 0, burnTimer: 0, poisonDps: 0, poisonTimer: 0, acidTimer: 0, shred: 0,
      shieldHp: shield, shieldMax: shield,
      healCooldown: 1.5 + Math.random(), abilityTimer: 3 + Math.random() * 2,
      revealTimer: 0, revealed: false, haste: 1, enraged: false,
      hitFlash: 0, walk: Math.random() * 10, spawnT: 0,
      lastHitBy: null, plague: false
    };
    pathPos(enemyPath(e), e.dist, e);
    enemies.push(e);
    if (def.boss && !atDist)
      onBossSpawn(e);
    return e;
  }
  let spawnCounter = 0;

  function onBossSpawn(e) {
    bossIntro = { e, t: 0 };
    floatingText.add(WORLD_W / 2, WORLD_H / 2 + 10, ENEMY_TYPES[e.type].name.toUpperCase() + ' APPROACHES', { color: '#ff6a6a', font: 'bold 18px sans-serif' });
    screenShake.trigger(5, 500);
    audio.play('explode', { pitch: 0.5, volume: 0.6 });
  }
  let bossIntro = null;
  function enemyFlags(e) {
    return ENEMY_TYPES[e.type];
  }

  /* ══════════════════════════════════════════════════════════════════
     DAMAGE
     ══════════════════════════════════════════════════════════════════ */

  // kind: 'phys' | 'fire' | 'cold' | 'energy' | 'poison'
  // opts: { pierce: 0..1 share of armor ignored, dot: true for damage over time }
  function hurt(e, amount, src, kind, opts) {
    if (e.hp <= 0 || amount <= 0) return 0;
    let dmg = amount;
    if (e.freezeTimer > 0 && kind !== 'cold') dmg *= 1.25;
    if (e.acidTimer > 0) dmg *= 1.25;
    // Shields soak everything but poison; energy hits them twice as hard
    if (e.shieldHp > 0 && kind !== 'poison') {
      const mul = kind === 'energy' ? 2 : 1;
      const absorb = Math.min(e.shieldHp, dmg * mul);
      e.shieldHp -= absorb;
      dmg -= absorb / mul;
      if (e.shieldHp <= 0)
        particles.burst(e.x, e.y, 10, { color: '#7ae8ff', speed: 3, life: 0.4 });
    }
    // Armor takes a flat bite out of every hit (not out of poison or burns)
    if (dmg > 0 && kind !== 'poison' && !(opts && opts.dot)) {
      const armor = Math.max(0, e.armor - e.shred) * (e.acidTimer > 0 ? 0.5 : 1) * (1 - ((opts && opts.pierce) || 0));
      if (armor > 0)
        dmg = Math.max(dmg * 0.25, dmg - armor);
    }
    e.hp -= dmg;
    if (opts && opts.area)
      e.revealTimer = Math.max(e.revealTimer, 2);
    if (!(opts && opts.dot))
      e.hitFlash = 0.1;

    if (src) {
      e.lastHitBy = src;
      src.dealt += dmg;
    }
    return dmg;
  }

  function applySlow(e, mul, time) {
    if (enemyFlags(e).boss) mul = 1 - (1 - mul) * 0.6;
    if (mul < e.slowMul || e.slowTimer <= 0) e.slowMul = Math.min(e.slowTimer > 0 ? e.slowMul : 1, mul);
    e.slowTimer = Math.max(e.slowTimer, time);
  }

  function enemiesNear(x, y, r, filter) {
    const out = [];
    const r2 = r * r;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= (r + e.radius) * (r + e.radius) && (!filter || filter(e)))
        out.push(e);
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     TARGETING
     ══════════════════════════════════════════════════════════════════ */

  function canHit(s, e) {
    const f = enemyFlags(e);
    if (s.hits === 'ground' && f.flying) return false;
    if (s.hits === 'air' && !f.flying) return false;
    if (f.stealth && !e.revealed) return false;
    return true;
  }

  // Phantoms show up while a true-sight tower has them in range or after area damage
  function updateReveal(dt) {
    for (const e of enemies) {
      if (!enemyFlags(e).stealth) continue;
      if (e.revealTimer > 0) e.revealTimer -= dt;
      let seen = e.revealTimer > 0;
      for (let i = 0; i < towers.length && !seen; ++i) {
        const t = towers[i];
        const s = towerStats(t);
        if (s.trueSight && Math.hypot(t.x - e.x, t.y - e.y) <= s.rangePx + e.radius)
          seen = true;
      }
      e.revealed = seen;
    }
  }

  function targetScore(mode, t, e) {
    switch (mode) {
      case 'last': return -e.dist;
      case 'strong': return e.hp + e.shieldHp;
      case 'close': return -Math.hypot(e.x - t.x, e.y - t.y);
      default: return e.dist - enemyPath(e).total;   // closest to its exit
    }
  }

  function findTargets(t, s, count, exclude) {
    const r = s.rangePx;
    const list = [];
    for (const e of enemies) {
      if (e.hp <= 0 || !canHit(s, e) || (exclude && exclude.indexOf(e) >= 0)) continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy > (r + e.radius * 0.5) * (r + e.radius * 0.5)) continue;
      list.push(e);
    }
    if (list.length <= 1)
      return list;
    const scored = list.map(e => [targetScore(t.target, t, e), e]);
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, count).map(p => p[1]);
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER ATTACKS
     ══════════════════════════════════════════════════════════════════ */

  function aimAt(t, e) {
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
  }

  function rollCrit(s) {
    return s.crit && Math.random() < s.crit ? s.critMul : 1;
  }

  function fireTower(t, s, def) {
    switch (s.kind) {
      case 'arrow': {
        const targets = findTargets(t, s, s.multishot || 1);
        if (!targets.length) return false;
        for (const e of targets)
          projectiles.push({ kind: 'arrow', x: t.x, y: t.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: def.color, trail: [] });
        aimAt(t, targets[0]);
        break;
      }
      case 'bolt': {
        if (s.aura) {
          const hit = enemiesNear(t.x, t.y, s.rangePx, e => canHit(s, e));
          if (!hit.length) return false;
          for (const e of hit) {
            hurt(e, s.damage, t, 'cold', { area: true });
            applySlow(e, 1 - s.slow, s.slowTime);
          }
          fxLines.push({ kind: 'ring', x: t.x, y: t.y, r: s.rangePx, color: '#bfeaff', t: 0, life: 0.45 });
          break;
        }
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        projectiles.push({ kind: 'bolt', x: t.x, y: t.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: '#bfeaff', trail: [] });
        aimAt(t, e);
        break;
      }
      case 'shell': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        // Aim where the target will be when the shell lands
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.15;
        const lead = predictPos(e, flight);
        projectiles.push({ kind: 'shell', x: t.x, y: t.y, sx: t.x, sy: t.y, tx: lead.x, ty: lead.y, t: 0, dur: flight, damage: s.damage, tower: t, s, color: '#ffb36a' });
        aimAt(t, e);
        break;
      }
      case 'glob': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.1;
        const lead = predictPos(e, flight);
        projectiles.push({ kind: 'glob', x: t.x, y: t.y, sx: t.x, sy: t.y, tx: lead.x, ty: lead.y, t: 0, dur: flight, damage: s.damage, tower: t, s, color: '#7ce35a' });
        aimAt(t, e);
        break;
      }
      case 'chain': {
        const first = findTargets(t, s, 1)[0];
        if (!first) return false;
        const hit = [first];
        const pts = [{ x: t.x, y: t.y - 10 }, { x: first.x, y: first.y }];
        let cur = first;
        for (let i = 1; i < s.chains; ++i) {
          let best = null, bd = s.chainPx;
          for (const e of enemies) {
            if (e.hp <= 0 || hit.indexOf(e) >= 0 || !canHit(s, e)) continue;
            const d = Math.hypot(e.x - cur.x, e.y - cur.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hit.push(best);
          pts.push({ x: best.x, y: best.y });
          cur = best;
        }
        hit.forEach((e, i) => {
          hurt(e, s.damage * Math.pow(0.85, i), t, 'energy', { area: i > 0 });
          if (s.stun) e.stunTimer = Math.max(e.stunTimer, s.stun * (i === 0 ? 1 : 0.5));
        });
        fxLines.push({ kind: 'zap', pts, color: '#bff4ff', t: 0, life: 0.18, seed: Math.random() * 1000 });
        aimAt(t, first);
        break;
      }
      case 'flame': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        aimAt(t, e);
        const cosCone = Math.cos(s.cone);
        const ax = Math.cos(t.angle), ay = Math.sin(t.angle);
        for (const o of enemies) {
          if (o.hp <= 0 || !canHit(s, o)) continue;
          const dx = o.x - t.x, dy = o.y - t.y;
          const d = Math.hypot(dx, dy);
          if (d > s.rangePx + o.radius) continue;
          if (d > 6 && (dx * ax + dy * ay) / d < cosCone) continue;
          hurt(o, s.damage, t, 'fire', { area: true });
          if (o.burnTimer <= 0 || s.burn >= o.burnDps) {
            o.burnDps = s.burn;
            o.burnTimer = s.burnTime;
            o.burnSrc = t;
          }
          if (s.melt) o.shred = Math.max(o.shred, s.melt);
          if (s.lava && Math.random() < 0.08)
            addFloorEffect(Math.floor(o.x / CELL), Math.floor(o.y / CELL), 'lava', 5, s.lava);
        }
        t.flameT = 0.25;
        break;
      }
      case 'beam': {
        const n = s.beams || 1;
        const targets = findTargets(t, s, n);
        if (!targets.length) {
          t.beamTargets = [];
          t.beamTime = 0;
          return false;
        }
        if (targets[0] !== t.beamTargets[0])
          t.beamTime = 0;
        t.beamTargets = targets;
        aimAt(t, targets[0]);
        return true;
      }
      case 'snipe': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        aimAt(t, e);
        const crit = rollCrit(s);
        const ex = t.x + Math.cos(t.angle) * s.rangePx * (s.rail ? 1.4 : 0), ey = t.y + Math.sin(t.angle) * s.rangePx * (s.rail ? 1.4 : 0);
        if (s.rail) {
          // Every enemy on the line takes the hit
          const ax = Math.cos(t.angle), ay = Math.sin(t.angle);
          for (const o of enemies) {
            if (o.hp <= 0 || !canHit(s, o)) continue;
            const dx = o.x - t.x, dy = o.y - t.y;
            const along = dx * ax + dy * ay;
            if (along < 0 || along > s.rangePx * 1.4) continue;
            if (Math.abs(dx * ay - dy * ax) <= o.radius + 4)
              hurt(o, s.damage * crit, t, 'phys', { pierce: s.pierce });
          }
          fxLines.push({ kind: 'tracer', pts: [{ x: t.x, y: t.y }, { x: ex, y: ey }], color: '#9ad8ff', t: 0, life: 0.3, w: 4 });
        } else {
          if (s.execute && e.hp - s.damage * crit <= e.maxHp * s.execute && !enemyFlags(e).boss) {
            hurt(e, e.hp + e.shieldHp + 999, t, 'phys', { pierce: 1 });
            floatingText.add(e.x, e.y - 14, 'EXECUTE', { color: '#ff5a5a', font: 'bold 11px sans-serif' });
          } else
            hurt(e, s.damage * crit, t, 'phys', { pierce: s.pierce });
          fxLines.push({ kind: 'tracer', pts: [{ x: t.x, y: t.y }, { x: e.x, y: e.y }], color: '#ffffff', t: 0, life: 0.18, w: 2 });
          if (crit > 1)
            floatingText.add(e.x, e.y - 14, 'CRIT', { color: '#ffd75a', font: 'bold 11px sans-serif' });
        }
        break;
      }
      default:
        return false;
    }
    t.flash = 0.1;
    t.recoil = 1;
    playShotSound(def);
    return true;
  }

  function predictPos(e, time) {
    const path = enemyPath(e);
    const sp = enemySpeed(e);
    const out = { x: 0, y: 0, angle: 0 };
    return pathPos(path, Math.min(path.total, e.dist + sp * time), out);
  }

  function updateTowers(dt) {
    for (const t of towers) {
      const def = TOWER_TYPES[t.type];
      const s = towerStats(t);
      t.flash = Math.max(0, t.flash - dt);
      t.recoil = Math.max(0, t.recoil - dt * 6);
      if (t.flameT) t.flameT = Math.max(0, t.flameT - dt);
      if (s.kind === 'mine' || s.kind === 'trap') continue;
      if (s.kind === 'beam') {
        fireTower(t, s, def);
        if (t.beamTargets.length) {
          t.beamTime += dt;
          const ramp = 1 + (s.ramp - 1) * Math.min(1, t.beamTime / s.rampTime);
          for (let i = 0; i < t.beamTargets.length; ++i) {
            const e = t.beamTargets[i];
            if (e.hp <= 0) continue;
            hurt(e, s.damage * (i === 0 ? ramp : 1) * dt, t, 'energy', { pierce: s.pierce, dot: true });
          }
          t.beamSound = (t.beamSound || 0) - dt;
          if (t.beamSound <= 0) {
            t.beamSound = 0.6;
            playShotSound(def);
          }
        }
        continue;
      }
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        if (fireTower(t, s, def))
          t.cooldown = s.reload;
        else
          t.cooldown = 0.05;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PROJECTILES
     ══════════════════════════════════════════════════════════════════ */

  function explode(x, y, radius, damage, src, s) {
    for (const e of enemiesNear(x, y, radius, o => canHit(s, o))) {
      const d = Math.hypot(e.x - x, e.y - y);
      const fall = d < radius * 0.4 ? 1 : 0.6;
      hurt(e, damage * fall, src, 'phys', { pierce: s.pierce || 0, area: true });
      if (s.shred) e.shred = Math.max(e.shred, s.shred);
    }
    particles.burst(x, y, 14, { color: '#ffb36a', speed: 3.5, life: 0.4 });
    if (radius > CELL * 1.5) screenShake.trigger(2, 90);
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; --i) {
      const p = projectiles[i];
      if (p.kind === 'shell' || p.kind === 'glob' || p.kind === 'bomblet') {
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        p.z = Math.sin(k * Math.PI) * Math.min(70, 20 + p.dur * 60) * (p.kind === 'bomblet' ? 0.4 : 1);
        if (k >= 1) {
          projectiles.splice(i, 1);
          if (p.kind === 'glob')
            clouds.push({ x: p.tx, y: p.ty, r: p.s.cloudPx, t: 0, life: p.s.cloudTime, dps: p.s.cloudDps, acid: !!p.s.acid, plague: !!p.s.plague, tower: p.tower, seed: Math.random() * 100 });
          else {
            explode(p.tx, p.ty, p.kind === 'bomblet' ? CELL * 0.6 : p.s.splashPx, p.damage, p.tower, p.s);
            if (p.kind === 'shell' && p.s.bomblets) {
              for (let b = 0; b < p.s.bomblets; ++b) {
                const a = (b / p.s.bomblets) * TWO_PI + Math.random() * 0.5;
                const r = p.s.splashPx * (0.8 + Math.random() * 0.6);
                projectiles.push({ kind: 'bomblet', x: p.tx, y: p.ty, sx: p.tx, sy: p.ty, tx: p.tx + Math.cos(a) * r, ty: p.ty + Math.sin(a) * r, t: 0, dur: 0.35 + Math.random() * 0.15, damage: p.damage * 0.3, tower: p.tower, s: p.s, color: '#ffcf6a' });
              }
            }
          }
        }
        continue;
      }
      const t = p.target;
      if (!t || t.hp <= 0) {
        projectiles.splice(i, 1);
        continue;
      }
      p.trail.push(p.x, p.y);
      if (p.trail.length > 10) p.trail.splice(0, 2);
      const dx = t.x - p.x, dy = t.y - p.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= move + t.radius) {
        projectiles.splice(i, 1);
        const s = p.s;
        if (p.kind === 'arrow') {
          const crit = rollCrit(s);
          hurt(t, p.damage * crit, p.tower, 'phys', { pierce: s.pierce || 0 });
          if (crit > 1)
            floatingText.add(t.x, t.y - 14, 'CRIT', { color: '#ffd75a', font: 'bold 10px sans-serif' });
        } else if (p.kind === 'bolt') {
          hurt(t, p.damage, p.tower, 'cold');
          applySlow(t, 1 - s.slow, s.slowTime);
          if (s.freeze && Math.random() < s.freeze && !enemyFlags(t).boss) {
            t.freezeTimer = s.freezeTime;
            particles.sparkle(t.x, t.y, 8, { color: '#e8fbff', speed: 1.5 });
            if (Math.random() < 0.5)
              addFloorEffect(Math.floor(t.x / CELL), Math.floor(t.y / CELL), 'ice', 4, 0);
          }
        }
      } else {
        p.x += dx / dist * move;
        p.y += dy / dist * move;
      }
    }
  }

  function updateClouds(dt) {
    for (let i = clouds.length - 1; i >= 0; --i) {
      const c = clouds[i];
      c.t += dt;
      if (c.t >= c.life) {
        clouds.splice(i, 1);
        continue;
      }
      for (const e of enemiesNear(c.x, c.y, c.r)) {
        hurt(e, c.dps * dt, c.tower, 'poison', { dot: true, area: true });
        e.poisonTimer = Math.max(e.poisonTimer, 0.6);
        if (c.acid) e.acidTimer = Math.max(e.acidTimer, 1.2);
        if (c.plague) e.plague = c.tower;
      }
    }
  }

  function addFloorEffect(col, row, type, time, damage) {
    if (!pathCells.has(`${col},${row}`)) return;
    const existing = floorEffects.find(fe => fe.col === col && fe.row === row && fe.type === type);
    if (existing) {
      existing.timer = Math.max(existing.timer, time);
      existing.damage = Math.max(existing.damage, damage);
      return;
    }
    if (floorEffects.length > 60) return;
    floorEffects.push({ col, row, x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, type, timer: time, damage });
  }

  function updateFloorEffects(dt) {
    for (let i = floorEffects.length - 1; i >= 0; --i) {
      floorEffects[i].timer -= dt;
      if (floorEffects[i].timer <= 0)
        floorEffects.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (let i = fxLines.length - 1; i >= 0; --i) {
      fxLines[i].t += dt;
      if (fxLines[i].t >= fxLines[i].life)
        fxLines.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMIES
     ══════════════════════════════════════════════════════════════════ */

  function enemySpeed(e) {
    if (e.freezeTimer > 0 || e.stunTimer > 0) return 0;
    return e.speed * e.haste * (e.enraged ? 1.4 : 1) * (e.slowTimer > 0 ? e.slowMul : 1);
  }

  function killEnemy(e) {
    const f = enemyFlags(e);
    particles.burst(e.x, e.y, 12, { color: f.color, speed: 3, life: 0.6 });
    let bounty = e.bounty;
    for (const t of towers) {
      const s = towerStats(t);
      if (s.bounty && Math.hypot(t.x - e.x, t.y - e.y) <= s.rangePx)
        bounty += s.bounty;
    }
    gold += bounty;
    goldPulse = Math.max(goldPulse, 0.5);
    ++runStats.kills;
    runStats.gold += bounty;
    if (e.lastHitBy)
      ++e.lastHitBy.kills;
    floatingText.add(e.x, e.y - 16, `+${bounty}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    // Slimes burst into slimelets
    if (f.split) {
      for (let i = 0; i < f.splitCount; ++i) {
        const c = spawnEnemy(f.split, e.pi, Math.max(0, e.dist - 6 + i * 6));
        c.maxHp = c.hp = Math.max(4, Math.floor(e.maxHp * 0.28));
        c.spawnT = 0;
      }
      particles.burst(e.x, e.y, 16, { color: f.color, speed: 3, life: 0.5 });
    }
    if (e.plague)
      clouds.push({ x: e.x, y: e.y, r: CELL * 0.8, t: 0, life: 2.2, dps: towerStats(e.plague).cloudDps * 0.6, acid: false, plague: true, tower: e.plague, seed: Math.random() * 100 });
    if (f.boss) {
      screenShake.trigger(8, 400);
      particles.confetti(e.x, e.y, 20, { speed: 5, gravity: 0.06 });
      floatingText.add(e.x, e.y - 30, 'BOSS DOWN!', { color: '#f0f', font: 'bold 14px sans-serif' });
      audio.play('explode');
    } else {
      screenShake.trigger(1.5, 60);
      audio.play('smallExplode', { pitch: 0.9 + Math.random() * 0.3, volume: 0.5 });
    }
  }

  function enemyReachedGoal(e) {
    const f = enemyFlags(e);
    const cost = f.lives || 1;
    lives = Math.max(0, lives - cost);
    runStats.leaked += cost;
    screenShake.trigger(4, 150);
    floatingText.add(e.x, e.y - 12, `-${cost} ${cost > 1 ? 'lives' : 'life'}`, { color: '#f44', font: 'bold 12px sans-serif' });
    livesPulse = 1;
    audio.play('hurt');
    if (lives <= 0 && state === STATE_PLAYING) {
      audio.play('lose');
      state = STATE_GAME_OVER;
      clearSavedGame();
      addHighScore(MAPS[currentMap].name, Math.max(0, currentWave - 1));
      recordResult(false);
      screenShake.trigger(8, 500);
      updateWindowTitle();
    }
  }

  function updateEnemies(dt) {
    // Elites hurry the enemies around them along
    for (const e of enemies)
      e.haste = 1;
    for (const e of enemies) {
      if (!e.elite || e.hp <= 0) continue;
      for (const o of enemiesNear(e.x, e.y, CELL * 1.6))
        if (o !== e) o.haste = 1.2;
    }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const f = enemyFlags(e);
      e.spawnT += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        hurt(e, e.burnDps * dt, e.burnSrc, 'fire', { dot: true });
      }
      if (e.poisonTimer > 0) e.poisonTimer -= dt;
      if (e.acidTimer > 0) e.acidTimer -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.freezeTimer > 0) e.freezeTimer -= dt;
      if (e.stunTimer > 0) e.stunTimer -= dt;
      if (e.hp <= 0) continue;

      if (f.heals) {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 2.5;
          let any = false;
          for (const o of enemiesNear(e.x, e.y, CELL * 2)) {
            if (o === e || o.hp >= o.maxHp || enemyFlags(o).boss) continue;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
            particles.sparkle(o.x, o.y, 3, { color: '#6aff8a', speed: 1 });
            any = true;
          }
          if (any)
            fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 2, color: '#6aff8a', t: 0, life: 0.5 });
        }
      }
      if (f.shielder) {
        e.abilityTimer -= dt;
        if (e.abilityTimer <= 0) {
          e.abilityTimer = 4;
          for (const o of enemiesNear(e.x, e.y, CELL * 1.8)) {
            if (o === e || enemyFlags(o).boss) continue;
            const cap = Math.floor(o.maxHp * 0.25);
            if (o.shieldHp < cap) {
              o.shieldHp = cap;
              o.shieldMax = Math.max(o.shieldMax, cap);
            }
          }
          fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 1.8, color: '#5ad8ff', t: 0, life: 0.5 });
        }
      }
      if (f.summons) {
        e.abilityTimer -= dt;
        if (e.abilityTimer <= 0) {
          e.abilityTimer = e.enraged ? 4 : 6;
          for (let i = 0; i < 3; ++i) {
            const sk = spawnEnemy('skeleton', e.pi, Math.max(0, e.dist - 10 - i * 12));
            sk.spawnT = 0;
            particles.burst(sk.x, sk.y, 6, { color: '#8affd8', speed: 2, life: 0.4 });
          }
          audio.play('whoosh', { pitch: 0.6, volume: 0.5 });
        }
        if (!e.enraged && e.hp < e.maxHp * 0.5) {
          e.enraged = true;
          floatingText.add(e.x, e.y - 30, 'ENRAGED!', { color: '#ff5a5a', font: 'bold 14px sans-serif' });
          screenShake.trigger(4, 300);
        }
      }

      // Traps and burning ground
      const col = Math.floor(e.x / CELL), row = Math.floor(e.y / CELL);
      if (!f.flying) {
        const trap = towerAt(col, row);
        if (trap) {
          const s = towerStats(trap);
          if (s.trap) {
            hurt(e, s.damage * dt, trap, 'phys', { pierce: s.pierce || 0, dot: !s.pierce, area: true });
            if (s.slow) applySlow(e, 1 - s.slow, s.slowTime);
          }
        }
        for (const fe of floorEffects) {
          if (fe.col !== col || fe.row !== row) continue;
          if (fe.type === 'lava') {
            hurt(e, fe.damage * dt, null, 'fire', { dot: true, area: true });
            if (e.burnTimer <= 0) { e.burnDps = fe.damage * 0.5; e.burnTimer = 1; }
          } else if (fe.type === 'ice')
            applySlow(e, 0.6, 0.4);
        }
      }

      const sp = enemySpeed(e);
      e.walk += sp * dt * 0.25;
      e.dist += sp * dt;
      const path = enemyPath(e);
      pathPos(path, e.dist, e);
      if (e.dist >= path.total) {
        e.hp = 0;
        e.leaked = true;
        enemyReachedGoal(e);
        continue;
      }

      // Heavy enemies batter the towers they pass
      if (f.batters && !f.flying) {
        const reach = e.radius + CELL * 0.7;
        for (const t of towers) {
          if (towerStats(t).trap) continue;
          const dx = t.x - e.x, dy = t.y - e.y;
          if (dx * dx + dy * dy < reach * reach) {
            t.hp -= f.batters * dt;
            t.hurtFlash = 0.15;
            if (t.hp <= 0) destroyTower(t);
          }
        }
      }
    }
  }
  // Remove dead enemies, paying out for the ones killed
  function sweepEnemies() {
    let w = 0;
    for (let i = 0; i < enemies.length; ++i) {
      const e = enemies[i];
      if (e.hp > 0) {
        enemies[w++] = e;
        continue;
      }
      if (!e.leaked)
        killEnemy(e);
    }
    enemies.length = w;
    if (selectedTower && towers.indexOf(selectedTower) < 0)
      selectedTower = null;
  }

  function updateSpawner(dt) {
    if (waveEnemies.length > 0) {
      spawnTimer -= dt;
      while (spawnTimer <= 0 && waveEnemies.length > 0) {
        const tok = waveEnemies.shift();
        if (tok === '|') {
          spawnTimer += 1.4;
          continue;
        }
        spawnEnemy(tok);
        const p = parseToken(tok);
        spawnTimer += (p && ENEMY_TYPES[p.type].gap) || 0.65;
      }
    }
    if (waveEnemies.length === 0 && enemies.length === 0 && !waveComplete && state === STATE_PLAYING) {
      waveComplete = true;
      waveCountdown = 3;
      state = STATE_BUILD;
      warningActive = false;
      projectiles = [];
      bossIntro = null;
      for (const t of towers) {
        t.beamTargets = [];
        t.beamTime = 0;
      }
      if (autoWaveMode)
        autoWaveTimer = AUTO_WAVE_DELAY;
      if (currentWave >= totalWaves)
        triggerVictory();
      else {
        payWaveIncome(Math.max(1, currentWave - lastPaidWave));
        lastPaidWave = currentWave;
        audio.play('levelup');
        saveGame();
      }
    }
  }
  let lastPaidWave = 0;
  function updateBuildCountdown(dt) {
    if (state !== STATE_BUILD) return;
    if (waveCountdown > 0)
      waveCountdown -= dt;
    if (!warningActive && waveCountdown <= WARNING_DURATION && waveCountdown > 0)
      beginPreWaveWarning();
    if (warningActive) {
      warningTimer -= dt;
      warningPulse += dt * 4;
      if (warningTimer <= 0)
        warningActive = false;
    }
    if (autoWaveMode && waveComplete) {
      autoWaveTimer -= dt;
      if (autoWaveTimer <= 0)
        startNextWave();
    }
  }

  function updateGame(dt) {
    animTime += dt;
    if (state === STATE_PLAYING) {
      const sdt = dt * gameSpeed;
      // Sub-steps keep fast-forward as accurate as normal speed
      const steps = Math.ceil(sdt / 0.034);
      const h = sdt / steps;
      for (let i = 0; i < steps && state === STATE_PLAYING; ++i)
        stepBattle(h);
    } else if (state === STATE_BUILD) {
      updateBuildCountdown(dt);
      updateFloorEffects(dt);
      updateFx(dt);
    }
    if (state === STATE_PLAYING || state === STATE_BUILD) {
      autosaveTimer += dt;
      if (autosaveTimer >= AUTOSAVE_INTERVAL)
        saveGame();
    }
  }

  function stepBattle(h) {
    updateSpawner(h);
    updateEnemies(h);
    updateReveal(h);
    updateTowers(h);
    updateProjectiles(h);
    updateClouds(h);
    updateFloorEffects(h);
    updateFx(h);
    sweepEnemies();
  }
  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- IMPROVED VISUALS
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    const b = BIOMES[MAPS[currentMap].biome];
    ctx.fillStyle = b.ground;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    for (const [key, type] of blockedCells) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillStyle = type === 'water' ? '#3a7ad8' : type === 'ice' ? '#a8e0ff' : type === 'lava' ? '#ff6a1a' : type === 'tree' ? '#2a5a2a' : shade(b.ground, -0.3);
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    ctx.fillStyle = b.path;
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 0; c <= COLS; ++c) {
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
    }
    for (let r = 0; r <= ROWS; ++r) {
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
    }
    ctx.stroke();
  }

  /* ── Path visualization: direction arrows and spawn/exit markers ── */
  function drawPathVisualization() {
    const pulse = 0.4 + 0.3 * Math.sin(animTime * 2);
    const tmp = { x: 0, y: 0, angle: 0 };
    for (const p of paths) {
      for (let d = CELL * 1.5; d < p.total - CELL; d += CELL * 3) {
        pathPos(p, d, tmp);
        ctx.save();
        ctx.translate(tmp.x, tmp.y);
        ctx.rotate(tmp.angle);
        ctx.fillStyle = `rgba(255, 220, 120, ${pulse * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const s = p.pts[1] || p.pts[0], e = p.pts[p.pts.length - 2] || p.pts[p.pts.length - 1];
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(80,255,120,${0.4 + pulse})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 13, 0, TWO_PI);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,80,80,${0.4 + pulse})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 13, 0, TWO_PI);
      ctx.stroke();
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
  function drawTowerShape(def, tier, angle, branch) {
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

      case 'mine':
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

      case 'spikes':
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
      const angle = tower.angle;
      const baseSize = 11 * (1 + (tower.tier - 1) * 0.1);
      ctx.save();
      ctx.translate(tower.x, tower.y);
      drawTowerShape(def, tower.tier, angle, tower.branch);

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
          grad.addColorStop(1, ENEMY_TYPES[e.type].color);
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
          grad.addColorStop(1, ENEMY_TYPES[e.type].color);
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
        ctx.fillStyle = ENEMY_TYPES[e.type].color;
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
          grad.addColorStop(0.5, ENEMY_TYPES[e.type].color);
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
          grad.addColorStop(1, ENEMY_TYPES[e.type].color);
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
        ctx.fillStyle = ENEMY_TYPES[e.type].color;
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
          grad.addColorStop(1, ENEMY_TYPES[e.type].color);
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // Shield ring (fades as shield depletes)
        if (e.shieldHp > 0) {
          const shieldRatio = e.shieldHp / Math.max(1, e.shieldMax);
          ctx.strokeStyle = `rgba(80, 255, 255, ${shieldRatio * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r + 3, 0, Math.PI * 2 * shieldRatio);
          ctx.stroke();
        }
        break;
      default:
        ctx.fillStyle = ENEMY_TYPES[e.type].color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
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
      faceAngle = e.angle;

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
      if (e.shieldHp > 0) {
        const shieldRatio = e.shieldHp / Math.max(1, e.shieldMax);
        ctx.fillStyle = '#048';
        ctx.fillRect(barX, barY + barH + 1, barW, 2);
        ctx.fillStyle = '#4ff';
        ctx.fillRect(barX, barY + barH + 1, barW * shieldRatio, 2);
      }
    }
  }

  function drawProjectiles() {
    ctx.lineCap = 'round';
    for (const p of projectiles) {
      if (p.trail && p.trail.length > 3) {
        ctx.strokeStyle = hexToRgba(p.color.length === 7 ? p.color : '#ffffff', 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.trail[0], p.trail[1]);
        for (let i = 2; i < p.trail.length; i += 2)
          ctx.lineTo(p.trail[i], p.trail[i + 1]);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const z = p.z || 0;
      if (z) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 2, 4, 2, 0, 0, TWO_PI);
        ctx.fill();
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - z, p.kind === 'shell' ? 4 : p.kind === 'bomblet' ? 2.5 : 3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.lineCap = 'butt';
  }

  function drawClouds() {
    for (const c of clouds) {
      const a = Math.min(1, c.t * 4, (c.life - c.t) * 2) * 0.35;
      ctx.fillStyle = c.acid ? `rgba(200,255,60,${a})` : `rgba(90,220,70,${a})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, TWO_PI);
      ctx.fill();
    }
  }

  function drawFxLines() {
    ctx.lineCap = 'round';
    for (const f of fxLines) {
      const k = 1 - f.t / f.life;
      if (f.kind === 'ring') {
        ctx.strokeStyle = hexToRgba(f.color, k * 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 - k * 0.5), 0, TWO_PI);
        ctx.stroke();
        continue;
      }
      ctx.strokeStyle = hexToRgba(f.color, k);
      ctx.lineWidth = (f.w || 2) * k + 0.5;
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; ++i) {
        const a = f.pts[i - 1], b = f.pts[i];
        if (f.kind === 'zap') {
          const mx = (a.x + b.x) / 2 + Math.sin(f.seed + i * 7.1 + f.t * 60) * 6;
          const my = (a.y + b.y) / 2 + Math.cos(f.seed + i * 3.3 + f.t * 60) * 6;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    // Beams and flames come straight from the towers
    for (const t of towers) {
      const s = towerStats(t);
      if (s.kind === 'beam' && t.beamTargets.length && state === STATE_PLAYING) {
        const heat = Math.min(1, t.beamTime / s.rampTime);
        for (const e of t.beamTargets) {
          if (e.hp <= 0) continue;
          ctx.strokeStyle = `rgba(255,90,210,${0.35 + heat * 0.3})`;
          ctx.lineWidth = 3 + heat * 3;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - 6);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1 + heat;
          ctx.stroke();
        }
      }
      if (s.kind === 'flame' && t.flameT > 0) {
        ctx.fillStyle = `rgba(255,140,40,${t.flameT * 1.6})`;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.arc(t.x, t.y, s.rangePx, t.angle - s.cone, t.angle + s.cone);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
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
    const bw = Math.min(150, w * 0.42);
    const bx = x + w - bw - 5;
    const hasNext = currentWave < totalWaves;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (!hasNext) {
      fitText(state === STATE_PLAYING ? 'Final wave on the field' : 'All waves cleared', x + 10, y + h / 2, w - 20, 14, { weight: 'bold', color: state === STATE_PLAYING ? UI.bad : UI.good });
      endHudPanel();
      return;
    }
    const nextNo = currentWave + 1;
    const boss = isBossWave(nextNo, totalWaves);
    const labelW = 62;
    fitText('NEXT', x + 10, y + 12, labelW - 8, 9, { weight: 'bold', color: UI.textDim });
    fitText(nextNo === totalWaves ? 'Final' : `Wave ${nextNo}`, x + 10, y + 27, labelW - 6, 13, { weight: 'bold', color: boss ? UI.bad : '#ffffff' });
    // Enemy icons with counts
    const list = nextWavePreview();
    const ix = x + labelW + 4, iw = bx - ix - 6;
    const cell = Math.min(46, iw / Math.max(1, list.length));
    for (let i = 0; i < list.length; ++i) {
      const row = list[i];
      const cx = ix + i * cell;
      if (cx + cell > ix + iw + 1) break;
      const def = ENEMY_TYPES[row.type];
      roundRectPath(cx + 1, y + 4, cell - 2, h - 8, 6);
      ctx.fillStyle = def.boss ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.fill();
      drawEnemyIcon(row.type, cx + cell / 2, y + h / 2 - 5, Math.min(cell - 10, 20));
      if (row.elite)
        drawIcon('crown', cx + cell - 8, y + 9, 9);
      ctx.textAlign = 'center';
      fitText(`×${row.count}`, cx + cell / 2, y + h - 9, cell - 4, 10, { weight: 'bold', color: def.boss ? UI.bad : UI.text });
      addRegion({ id: 'preview-' + row.type, x: cx, y, w: cell, h, anchorTip: true, tip: () => enemyTypeTooltip(row) });
    }
    ctx.textAlign = 'left';
    if (state === STATE_BUILD) {
      const autoIn = autoWaveMode && waveComplete && autoWaveTimer > 0 ? `in ${Math.ceil(autoWaveTimer)}s` : null;
      uiButton('startwave', bx, y + 4, bw, h - 8, 'Start', {
        style: 'gold', icon: 'play', px: 13, key: 'Space', sub: autoIn,
        onClick: () => startNextWave(),
        tip: () => [`Start wave ${nextNo}`, 'Send the next wave now.', boss ? '⚠ A boss is coming' : '• Enemies listed on the left']
      });
    } else {
      const bonus = 8 + currentWave * 2;
      uiButton('startwave', bx, y + 4, bw, h - 8, 'Call early', {
        style: 'green', icon: 'play', px: 12, key: 'N', sub: `+${bonus} gold`, disabled: !canCallEarly(),
        onClick: () => startNextWave(), onDisabled: () => audio.play('error'),
        tip: () => ['Call the next wave early', canCallEarly() ? `Sends wave ${nextNo} right away for ${bonus} bonus gold.` : 'Possible once the current wave is fully on the field.', '• N calls early']
      });
    }
    endHudPanel();
  }

  function enemyTypeTooltip(row) {
    const def = ENEMY_TYPES[row.type];
    const hp = Math.round(def.hp * waveHpScale(currentWave + 1));
    const lines = [`${def.name}  ×${row.count}`, def.info];
    lines.push(`[[heart]] ~${hp} health   Speed ${def.speed}${def.armor ? `   [[shield]] Armor ${def.armor}` : ''}`);
    if (row.elite) lines.push(`⚠ ${row.elite} elite (crowned): twice the health, hurries its neighbours`);
    if (def.boss) lines.push(`⚠ Costs ${def.lives} lives if it gets through`);
    lines.push(`✔ Counter: ${def.counter}`);
    return lines;
  }

  // Boss health bar under the top bar while a boss is on the field
  function drawBossBar() {
    let boss = null;
    for (const e of enemies)
      if (e.hp > 0 && ENEMY_TYPES[e.type].boss && (!boss || e.maxHp > boss.maxHp))
        boss = e;
    if (!boss) return;
    const def = ENEMY_TYPES[boss.type];
    const w = Math.min(360, UW * 0.4), h = 34;
    const x = UW / 2 - w / 2, y = TOP_H + 2;
    hudPanel('bossbar', x, y, w, h, UI.bad);
    drawIcon('skull', x + 18, y + h / 2, 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(def.name + (boss.enraged ? ' · enraged' : ''), x + 32, y + 11, w * 0.5, 11, { weight: 'bold', color: boss.enraged ? UI.bad : '#ffffff' });
    const mx = x + 32, mw = w - 44;
    drawMeter(mx, y + 19, mw, 9, boss.hp / boss.maxHp, boss.enraged ? '#ff3a3a' : '#d84ad8');
    if (boss.shieldHp > 0)
      drawMeter(mx, y + 19, mw * Math.min(1, boss.shieldHp / boss.maxHp), 4, 1, '#5ad8ff', { track: 'rgba(0,0,0,0)' });
    ctx.textAlign = 'right';
    fitText(`${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`, x + w - 12, y + 11, w * 0.4, 10, { weight: 'bold', color: UI.textDim });
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

  /* ══════════════════════════════════════════════════════════════════
     INSPECTOR -- stats, targeting, upgrade paths and sell of the
     selected tower
     ══════════════════════════════════════════════════════════════════ */

  const INSPECT_W = 252;

  function fmt(v) {
    return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  }

  // Damage per second against a single unarmored target (rough guide)
  function towerDps(s) {
    switch (s.kind) {
      case 'beam': return s.damage * (s.ramp + 1) / 2;
      case 'trap': return s.damage;
      case 'mine': return 0;
      case 'glob': return s.damage / s.reload + s.cloudDps;
      case 'flame': return s.damage / s.reload + s.burn;
      default: return s.damage * (s.crit ? 1 + s.crit * (s.critMul - 1) : 1) / Math.max(0.05, s.reload);
    }
  }

  // Short feature list of a stat block
  function towerSpecials(s) {
    const out = [];
    if (s.kind === 'mine') {
      out.push(`+${s.income} gold per wave`);
      if (s.interest) out.push(`${Math.round(s.interest * 100)}% interest (max ${s.interestCap})`);
      if (s.bounty) out.push(`+${s.bounty} gold per kill nearby`);
      return out;
    }
    if (s.splash) out.push(`Splash ${fmt(s.splash)} tiles`);
    if (s.bomblets) out.push(`${s.bomblets} bomblets`);
    if (s.shred) out.push(`Shreds ${s.shred} armor`);
    if (s.multishot) out.push(`${s.multishot} targets`);
    if (s.slow) out.push(`Slows ${Math.round(s.slow * 100)}%`);
    if (s.freeze) out.push(`${Math.round(s.freeze * 100)}% freeze`);
    if (s.aura) out.push('Hits all in range');
    if (s.chains) out.push(`Chains ×${s.chains}`);
    if (s.stun) out.push(`Stuns ${fmt(s.stun)}s`);
    if (s.burn) out.push(`Burns ${fmt(s.burn)}/s`);
    if (s.melt) out.push(`Melts ${s.melt} armor`);
    if (s.lava) out.push('Burning ground');
    if (s.cloudDps) out.push(`Cloud ${fmt(s.cloudDps)}/s`);
    if (s.acid) out.push('Acid: +25% damage taken');
    if (s.plague) out.push('Spreads on death');
    if (s.beams) out.push(`${s.beams} beams`);
    if (s.ramp && s.kind === 'beam') out.push(`Heats up to ×${fmt(s.ramp)}`);
    if (s.crit) out.push(`${Math.round(s.crit * 100)}% crit ×${fmt(s.critMul)}`);
    if (s.execute) out.push(`Executes below ${Math.round(s.execute * 100)}%`);
    if (s.rail) out.push('Pierces the line');
    if (s.pierce && !s.rail) out.push(`Ignores ${Math.round(s.pierce * 100)}% armor`);
    if (s.trueSight) out.push('Spots stealth');
    if (s.hits === 'ground') out.push('Ground only');
    return out;
  }

  function hitsLabel(s) {
    return s.hits === 'both' ? 'Ground & air' : s.hits === 'ground' ? 'Ground only' : s.hits === 'air' ? 'Air only' : '—';
  }

  function buildTooltip(i) {
    const def = TOWER_TYPES[i];
    const s = computeStats(def, 1, -1);
    const lines = [def.name, def.desc];
    lines.push('--- Stats ---');
    if (s.kind === 'mine')
      lines.push(`[[coin]] +${s.income} gold after every wave`);
    else if (s.kind === 'trap')
      lines.push(`[[sword]] ${fmt(s.damage)} damage per second on its tile`);
    else
      lines.push(`[[sword]] ${fmt(towerDps(s))} dps   [[range]] ${fmt(s.range)} tiles   ${hitsLabel(s)}`);
    const sp = towerSpecials(s).filter(x => x !== 'Ground only');
    if (sp.length) lines.push('• ' + sp.join(' · '));
    lines.push(`✔ Strong vs: ${def.strong}`);
    lines.push(`⚠ Weak vs: ${def.weak}`);
    lines.push('--- Specializations at tier IV ---');
    lines.push(`• ${def.branches[0].name} / ${def.branches[1].name}`);
    lines.push(gold >= def.cost ? `★ ${def.cost} gold` : `✘ ${def.cost} gold (need ${def.cost - gold} more)`);
    return lines;
  }

  function inspectorLayout(t) {
    const s = towerStats(t);
    const attacks = s.kind !== 'mine' && s.kind !== 'trap';
    let h = 34 + 76 + 30;                         // header, portrait/stats, specials
    if (attacks) h += 30;                         // targeting
    h += t.tier === 3 ? 122 : 44;                 // upgrade area
    if (t.hp < t.maxHp) h += 22;
    h += 38;                                      // sell / repair
    return { attacks, h };
  }

  function inspectorRect() {
    const t = selectedTower;
    const L = inspectorLayout(t);
    // Use the side of the screen away from the tower
    const p = worldToUi(t.x, t.y);
    const left = p.x > UW * 0.55;
    return { x: left ? 8 : UW - 8 - INSPECT_W, y: TOP_H + 4, w: INSPECT_W, h: Math.min(L.h, UH - TOP_H - BOT_H - 8), L };
  }

  function drawInspector() {
    const t = selectedTower;
    if (!t || (state !== STATE_BUILD && state !== STATE_PLAYING)) return;
    const def = TOWER_TYPES[t.type];
    const s = towerStats(t);
    const r = inspectorRect();
    addRegion({ id: 'inspector-bg', x: r.x, y: r.y, w: r.w, h: r.h });
    beginHudPanel('inspector', r.x, r.y, r.w, r.h);
    let y = drawPanel(r.x, r.y, r.w, r.h, { title: towerName(t), titleRight: 'Tier ' + toRoman(t.tier), titleRightPad: 24, accent: t.branch >= 0 ? def.color : UI.gold });
    uiButton('insp-close', r.x + r.w - 26, r.y + 6, 20, 18, '×', { px: 13, onClick: () => { selectedTower = null; }, tip: () => ['Close', 'Esc'] });

    // Portrait with tier pips
    const px = r.x + 10, pw = 64;
    roundRectPath(px, y, pw, pw, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(def.color, 0.45);
    ctx.stroke();
    drawTowerIcon(t.type, t.tier, px + pw / 2, y + pw / 2, pw - 8, t.branch);
    const pipW = (pw - 8) / MAX_TIER;
    for (let i = 0; i < MAX_TIER; ++i) {
      ctx.fillStyle = i < t.tier ? (i >= 3 ? def.color : UI.gold) : 'rgba(255,255,255,0.15)';
      ctx.fillRect(px + 4 + i * pipW, y + pw + 4, pipW - 2, 4);
    }

    // Stat rows
    const sx = px + pw + 10, sw = r.x + r.w - 10 - sx;
    const rows = towerStatRows(t, s);
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 7 + i * 16;
      ctx.textAlign = 'left';
      drawIcon(rows[i][0], sx + 6, ry, 12);
      fitText(rows[i][1], sx + 16, ry + 1, sw * 0.5 - 16, 11, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(rows[i][2], sx + sw, ry + 1, sw * 0.5, 12, { weight: 'bold', color: rows[i][3] || '#ffffff' });
    }
    y += pw + 12;

    // Specials as chips
    const sp = towerSpecials(s);
    ctx.save();
    roundRectPath(r.x + 8, y - 2, r.w - 16, 26, 6);
    ctx.clip();
    let cx = r.x + 10;
    for (const text of sp) {
      ctx.font = uiFont(10, 'bold');
      const w = Math.min(r.w - 20, ctx.measureText(text).width + 14);
      if (cx + w > r.x + r.w - 10) break;
      drawChip(text, cx, y + 2, 18, { px: 10, bg: hexToRgba(def.color, 0.16), border: hexToRgba(def.color, 0.4), color: '#e8eef8', maxW: r.w - 20 });
      cx += w + 4;
    }
    ctx.restore();
    y += 30;

    // Targeting
    if (r.L.attacks) {
      const n = TARGET_MODES.length;
      const bw = (r.w - 20 - (n - 1) * 4) / n;
      for (let i = 0; i < n; ++i) {
        const m = TARGET_MODES[i];
        uiButton('insp-target-' + m, r.x + 10 + i * (bw + 4), y, bw, 24, TARGET_LABELS[m], {
          style: t.target === m ? 'blue' : 'dark', px: 11,
          onClick: () => { t.target = m; },
          tip: () => [`Target: ${TARGET_LABELS[m]}`, TARGET_DESC[m], '• T cycles the targeting']
        });
      }
      y += 30;
    }

    // Upgrade paths
    const bw = r.w - 20;
    const uc = getUpgradeCost(t);
    if (t.tier < 3 || t.tier === 4) {
      const label = t.tier === 4 ? `Master ${towerName(t)}` : `Upgrade to Tier ${toRoman(t.tier + 1)}`;
      uiButton('insp-up', r.x + 10, y, bw, 38, label, {
        style: 'gold', icon: 'up', key: 'U', sub: `${uc} gold`, disabled: gold < uc,
        onClick: () => upgradeTower(t), onDisabled: () => audio.play('error'),
        tip: () => upgradeTooltip(t, t.branch)
      });
      y += 44;
    } else if (t.tier === 3) {
      ctx.textAlign = 'left';
      fitText('Choose a specialization', r.x + 12, y + 7, bw, 11, { weight: 'bold', color: UI.gold });
      const cw = (bw - 6) / 2;
      for (let b = 0; b < 2; ++b)
        drawBranchCard(t, b, r.x + 10 + b * (cw + 6), y + 16, cw, 100, uc);
      y += 122;
    } else {
      uiButton('insp-up', r.x + 10, y, bw, 38, 'Fully mastered', { style: 'dark', icon: 'crown', disabled: true });
      y += 44;
    }

    if (t.hp < t.maxHp) {
      const ratio = t.hp / t.maxHp;
      drawMeter(r.x + 12, y + 2, r.w - 24, 12, ratio, ratio > 0.5 ? UI.good : ratio > 0.25 ? UI.warn : UI.bad, { label: `Structure ${Math.ceil(ratio * 100)}%`, labelPx: 9 });
      y += 22;
    }

    const half = (bw - 6) / 2;
    const sv = getSellValue(t);
    uiButton('insp-sell', r.x + 10, y, half, 30, `Sell +${sv}`, { style: 'red', key: 'S', px: 12, onClick: () => sellTower(t),
      tip: () => ['Sell tower', sv === t.spent ? `Full refund of ${sv} gold: it was built during this break.` : `Refunds ${sv} gold (60% of the ${t.spent} spent).`] });
    const rc = repairCost(t);
    uiButton('insp-repair', r.x + 16 + half, y, half, 30, rc > 0 ? `Repair ${rc}` : 'Intact', { style: 'green', key: 'R', px: 12, disabled: rc <= 0 || gold < rc,
      onClick: () => repairTower(t), onDisabled: () => rc > 0 && audio.play('error'),
      tip: () => ['Repair', rc > 0 ? `Restores the structure for ${rc} gold.` : 'The tower is undamaged.'] });
    endHudPanel();
  }

  function drawBranchCard(t, b, x, y, w, h, cost) {
    const def = TOWER_TYPES[t.type];
    const br = def.branches[b];
    const id = 'insp-branch' + b;
    const hover = hoverId === id;
    const afford = gold >= cost;
    const press = pressAmount(id);
    ctx.save();
    roundRectPath(x, y + press * 2, w, h, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hover ? 'rgba(70,60,30,0.95)' : 'rgba(40,46,70,0.95)');
    g.addColorStop(1, 'rgba(14,16,30,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hover ? 2 : 1;
    ctx.strokeStyle = hover ? UI.gold : hexToRgba(def.color, 0.5);
    ctx.stroke();
    if (!afford) ctx.globalAlpha *= 0.6;
    drawTowerIcon(t.type, BRANCH_TIER, x + 20, y + 21 + press * 2, 30, b);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawTextBlock(br.name, x + 38, y + 5 + press * 2, w - 42, 32, 12, { weight: 'bold', color: '#ffffff', valign: 'middle', lineGap: 1.1 });
    drawTextBlock(br.desc, x + 6, y + 40 + press * 2, w - 12, h - 62, 10, { color: '#c4cde0', lineGap: 1.2 });
    ctx.textAlign = 'left';
    fitText(`[[coin]]${cost}`, x + 6, y + h - 11 + press * 2, w - 32, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad });
    drawKeycap(b === 0 ? 'U' : 'I', x + w - 20, y + h - 19 + press * 2, 9);
    ctx.restore();
    addRegion({ id, x, y, w, h, disabled: !afford, onDisabled: () => audio.play('error'),
      onClick: () => upgradeTower(t, b), tip: () => upgradeTooltip(t, b) });
  }

  function towerStatRows(t, s) {
    const rows = [];
    if (s.kind === 'mine') {
      rows.push(['coin', 'Income', `+${s.income}`, UI.gold]);
      if (s.interest) rows.push(['coin', 'Interest', `${Math.round(s.interest * 100)}%`]);
      if (s.bounty) rows.push(['skull', 'Kill bonus', `+${s.bounty}`]);
      return rows;
    }
    rows.push(['sword', s.kind === 'trap' || s.kind === 'beam' ? 'Dmg/sec' : 'Damage', fmt(s.damage) + (s.multishot ? ` ×${s.multishot}` : '')]);
    if (s.kind !== 'trap') {
      rows.push(['range', 'Range', fmt(s.range)]);
      rows.push(['clock', 'Rate', s.kind === 'beam' ? 'beam' : `${fmt(1 / s.reload)}/s`]);
    }
    rows.push(['bolt', 'DPS', fmt(towerDps(s)), UI.warn]);
    rows.push(['skull', 'Kills', String(t.kills || 0)]);
    return rows;
  }

  function upgradeTooltip(t, branch) {
    const def = TOWER_TYPES[t.type];
    const next = t.tier + 1;
    const nb = next >= BRANCH_TIER ? branch : -1;
    const cur = towerStats(t);
    const nxt = computeStats(def, next, nb);
    const uc = getUpgradeCost(t);
    const title = next === BRANCH_TIER ? `Specialize: ${def.branches[branch].name}` : next === 5 ? `Master ${def.branches[t.branch].name}` : `Upgrade to Tier ${toRoman(next)}`;
    const lines = [title];
    if (next === BRANCH_TIER) lines.push(def.branches[branch].desc);
    lines.push('--- Changes ---');
    const cmp = (label, a, b, unit) => {
      if (Math.abs(a - b) > 1e-6)
        lines.push(`${b > a ? '✔' : '•'} ${label} ${fmt(a)}${unit || ''} → ${fmt(b)}${unit || ''}`);
    };
    if (cur.kind === 'mine') {
      cmp('Income', cur.income, nxt.income);
    } else {
      cmp('Damage', cur.damage, nxt.damage);
      cmp('Range', cur.range, nxt.range, ' tiles');
      if (cur.kind !== 'beam' && cur.kind !== 'trap') cmp('Shots/sec', 1 / cur.reload, 1 / nxt.reload);
      cmp('DPS', towerDps(cur), towerDps(nxt));
    }
    const before = towerSpecials(cur);
    for (const sp of towerSpecials(nxt))
      if (before.indexOf(sp) < 0)
        lines.push(`★ ${sp}`);
    lines.push(gold >= uc ? `✔ ${uc} gold` : `✘ ${uc} gold (need ${uc - gold} more)`);
    return lines;
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

  function drawMapOverlays() {
    const c = cursorCell();
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 6);
    // Selected tower: range and brackets
    if (selectedTower) {
      const t = selectedTower;
      ctx.fillStyle = 'rgba(255,215,90,0.06)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(towerStats(t).rangePx, 1), 0, TWO_PI);
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
      const ok = canBuildAt(selectedTowerType, c.col, c.row);
      const afford = gold >= def.cost;
      const cx = c.col * CELL + CELL / 2, cy = c.row * CELL + CELL / 2;
      const good = ok && afford;
      ctx.fillStyle = good ? 'rgba(80,255,120,0.18)' : 'rgba(255,70,70,0.22)';
      ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
      const range = def.range * CELL;
      if (def.range > 0 && ok && !def.trap) {
        ctx.fillStyle = good ? 'rgba(120,255,150,0.07)' : 'rgba(255,120,120,0.06)';
        ctx.beginPath();
        ctx.arc(cx, cy, range, 0, TWO_PI);
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

  function enemyTooltip(e) {
    const f = enemyFlags(e);
    const lines = [(e.elite ? 'Elite ' : '') + f.name, f.info, `[[heart]] ${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}   Speed ${Math.round(enemySpeed(e))}   [[coin]] ${e.bounty}`];
    if (e.armor > 0) lines.push(`[[shield]] Armor ${Math.max(0, e.armor - e.shred)}${e.shred ? ' (shredded)' : ''}`);
    if (e.shieldHp > 0) lines.push(`[[bolt]] Shield ${Math.ceil(e.shieldHp)}`);
    if (f.stealth) lines.push(e.revealed ? '✔ Spotted: towers can shoot it' : '⚠ Hidden: needs a Sniper, Longbow or area damage');
    if (e.elite) lines.push('⚠ Elite: hurries nearby enemies');
    if (f.boss) lines.push(`⚠ Boss: costs ${f.lives} lives if it gets through`);
    lines.push(`✔ Counter: ${f.counter}`);
    return lines;
  }
  /* ══════════════════════════════════════════════════════════════════
     SCREENS -- title, pause, game over, victory, help
     ══════════════════════════════════════════════════════════════════ */

  function drawTitleScreen() {
    drawScrim(0.5);
    const cx = UW / 2;
    const top = Math.max(46, UH * 0.17);
    drawHeadline('TOWER DEFENSE', cx, top, UW - 60, 66, UI.gold, '#ff9a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('Hold the line. Build, upgrade, survive every wave.', cx, top + 46, UW - 80, 15, { color: '#c4cde0' });

    const pw = Math.min(380, UW - 40), ph = savedGameInfo ? 218 : 166;
    const px = cx - pw / 2, py = Math.min(top + 78, UH - ph - 60);
    drawPanel(px, py, pw, ph, { accent: UI.gold, radius: 12 });
    let y = py + 16;
    const bw = pw - 40;
    if (savedGameInfo) {
      const sm = MAPS[savedGameInfo.map];
      uiButton('title-continue', px + 20, y, bw, 52, 'Continue', { style: 'gold', icon: 'play', px: 17, key: 'Enter', sub: `${sm.name} · wave ${savedGameInfo.wave} of ${savedGameInfo.waves}`, onClick: () => continueSavedGame() });
      y += 60;
    }
    uiButton('title-campaign', px + 20, y, bw, savedGameInfo ? 42 : 52, 'Campaign', { style: savedGameInfo ? 'dark' : 'gold', icon: 'flag', px: savedGameInfo ? 15 : 17, key: savedGameInfo ? 'C' : 'Enter',
      sub: `${totalStars()} of ${MAPS.length * 3} stars`, onClick: () => openMapSelect() });
    y += savedGameInfo ? 50 : 60;
    uiButton('title-help', px + 20, y, bw, 36, 'How to play', { style: 'blue', icon: 'help', px: 13, key: 'H', onClick: () => openHelp() });
    if (saveNotice) {
      ctx.textAlign = 'center';
      fitText(saveNotice, cx, py + ph + 18, UW - 40, 12, { color: UI.warn });
    }
    drawKeyHints(savedGameInfo
      ? [{ key: 'Enter', label: 'Continue' }, { key: 'C', label: 'Campaign' }, { key: 'H', label: 'Help' }]
      : [{ key: 'Enter', label: 'Campaign' }, { key: 'H', label: 'Help' }], cx, UH - 22, UW - 40);
  }

  /* ── Campaign map select ── */
  let mapSelectIndex = 0;

  function openMapSelect() {
    state = STATE_MAP_SELECT;
    mapSelectIndex = savedGameInfo ? savedGameInfo.map : Math.min(currentMap, MAPS.length - 1);
    if (!mapUnlocked(mapSelectIndex)) mapSelectIndex = 0;
    previewMap(mapSelectIndex);
    audio.play('select');
    updateWindowTitle();
  }

  function previewMap(i) {
    mapSelectIndex = i;
    currentMap = i;
    loadMapPreview();
  }

  function playSelectedMap() {
    if (!mapUnlocked(mapSelectIndex)) {
      audio.play('error');
      return;
    }
    currentMap = mapSelectIndex;
    requestNewGame();
  }

  function difficultyOf(i) {
    return clamp(Math.round((MAPS[i].hpMul - 0.8) / 0.11) + 1, 1, 5);
  }

  const thumbCache = {};
  // Small overview of a map: ground, features, roads
  function mapThumb(i) {
    if (thumbCache[i]) return thumbCache[i];
    const k = 4;
    const c = makeCanvas(COLS * k, ROWS * k);
    const g = c.getContext('2d');
    const m = MAPS[i], b = BIOMES[m.biome];
    g.fillStyle = b.ground;
    g.fillRect(0, 0, c.width, c.height);
    const cells = new Set();
    for (const wp of m.paths) walkPath(wp, (x, y) => cells.add(x + ',' + y));
    for (const [type, c0, r0, c1, r1] of m.features) {
      g.fillStyle = type === 'water' ? '#3a7ad8' : type === 'ice' ? '#a8e0ff' : type === 'lava' ? '#ff6a1a' : shade(b.ground, -0.3);
      for (let r = r0; r <= r1; ++r) for (let cc = c0; cc <= c1; ++cc)
        if (!cells.has(cc + ',' + r)) g.fillRect(cc * k, r * k, k, k);
    }
    g.fillStyle = b.path;
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      g.fillRect(x * k, y * k, k, k);
    }
    for (const wp of m.paths) {
      g.fillStyle = '#5aff7a';
      g.fillRect(wp[0][0] * k, wp[0][1] * k, k, k);
      const e = wp[wp.length - 1];
      g.fillStyle = '#ff4a4a';
      g.fillRect(e[0] * k, e[1] * k, k, k);
    }
    thumbCache[i] = c;
    return c;
  }

  function drawThumb(i, x, y, w, h) {
    const img = mapThumb(i);
    ctx.save();
    roundRectPath(x, y, w, h, 6);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    roundRectPath(x, y, w, h, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }

  function drawStars(n, cx, cy, size, total) {
    total = total || 3;
    const gap = size * 1.05;
    for (let i = 0; i < total; ++i)
      drawIcon(i < n ? 'star' : 'starEmpty', cx + (i - (total - 1) / 2) * gap, cy, size);
  }

  function drawMapSelect() {
    drawScrim(0.72);
    const pad = 12;
    // Header
    const hh = 46;
    drawPanel(pad, 8, UW - pad * 2, hh, { accent: UI.gold, radius: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Campaign', pad + 16, 8 + hh / 2 + 1, 220, 22, { weight: 'bold', color: UI.gold });
    ctx.textAlign = 'right';
    fitText(`[[star]] ${totalStars()} / ${MAPS.length * 3}`, UW - pad - 120, 8 + hh / 2 + 1, 160, 16, { weight: 'bold', color: '#ffffff' });
    uiButton('ms-back', UW - pad - 108, 16, 96, hh - 16, 'Back', { px: 13, key: 'Esc', onClick: () => quitToTitle() });

    // Layout: grid of biomes (columns) x maps (rows), details on the right
    const top = 8 + hh + 10, bottom = UH - 34;
    const detailW = UW >= 900 ? Math.min(300, UW * 0.3) : 0;
    const gx = pad, gw = UW - pad * 2 - (detailW ? detailW + 10 : 0);
    const colGap = 8, rowGap = 8, headH = 24;
    const cw = (gw - colGap * 3) / 4;
    const ch = (bottom - top - headH - rowGap * 2 - (detailW ? 0 : 150)) / 3;
    BIOME_ORDER.forEach((bk, bi) => {
      const b = BIOMES[bk];
      const x = gx + bi * (cw + colGap);
      roundRectPath(x, top, cw, headH, 6);
      ctx.fillStyle = hexToRgba(b.color, 0.2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(b.color, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      fitText(b.name, x + cw / 2, top + headH / 2 + 1, cw - 10, 12, { weight: 'bold', color: b.color });
      for (let j = 0; j < 3; ++j) {
        const i = bi * 3 + j;
        drawMapCard(i, x, top + headH + 6 + j * (ch + rowGap), cw, ch);
      }
    });
    if (detailW)
      drawMapDetails(UW - pad - detailW, top, detailW, bottom - top);
    else
      drawMapDetails(gx, bottom - 144, gw, 140);
    drawKeyHints([{ key: '←↑→↓', label: 'Choose' }, { key: 'Enter', label: 'Play' }, { key: 'Esc', label: 'Back' }], UW / 2, UH - 16, UW - 40);
  }

  function drawMapCard(i, x, y, w, h) {
    const m = MAPS[i];
    const id = 'mapcard' + i;
    const sel = mapSelectIndex === i;
    const hover = hoverId === id;
    const locked = !mapUnlocked(i);
    const rec = meta.maps[i];
    ctx.save();
    roundRectPath(x, y, w, h, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, sel ? 'rgba(86,68,24,0.96)' : hover ? 'rgba(44,54,84,0.96)' : 'rgba(26,32,54,0.96)');
    g.addColorStop(1, sel ? 'rgba(40,28,8,0.96)' : 'rgba(12,15,28,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = sel ? 2.5 : 1;
    ctx.strokeStyle = sel ? UI.gold : hover ? 'rgba(255,215,90,0.5)' : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    const tw = w - 12, th = Math.min(h - 40, tw * ROWS / COLS);
    const tx = x + 6, ty = y + 6;
    if (locked) ctx.globalAlpha *= 0.35;
    drawThumb(i, tx + (tw - th * COLS / ROWS) / 2, ty, th * COLS / ROWS, th);
    ctx.globalAlpha = 1;
    if (locked) drawIcon('lock', x + w / 2, ty + th / 2, Math.min(28, th * 0.5));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ny = ty + th + (h - th - 6) / 2 - 1;
    fitText(`${i + 1}. ${m.name}`, x + 8, ny - 7, w * 0.62, 12, { weight: 'bold', color: locked ? UI.textMute : '#ffffff' });
    fitText(rec.best ? `Best ${rec.best}/${m.waves}` : `${m.waves} waves`, x + 8, ny + 8, w * 0.6, 10, { color: UI.textDim });
    drawStars(rec.stars, x + w - 8 - Math.min(13, w * 0.09) * 1.6, ny, Math.min(13, w * 0.09));
    ctx.restore();
    addRegion({ id, x, y, w, h, onClick: () => {
      if (mapSelectIndex === i && !locked) playSelectedMap();
      else { previewMap(i); audio.play('click'); }
    }, tip: () => locked ? [m.name, '✘ Win the previous map to unlock it.'] : null, sound: false });
  }

  function drawMapDetails(x, y, w, h) {
    const i = mapSelectIndex;
    const m = MAPS[i], b = BIOMES[m.biome], rec = meta.maps[i];
    const locked = !mapUnlocked(i);
    drawPanel(x, y, w, h, { title: m.name, titleRight: b.name, titleRightColor: b.color, accent: b.color, radius: 10 });
    const wide = h < 200;
    let cy = y + 38;
    if (!wide) {
      const tw = w - 24, th = tw * ROWS / COLS;
      drawThumb(i, x + 12, cy, tw, th);
      cy += th + 10;
      ctx.textAlign = 'left';
      drawTextBlock(m.desc, x + 12, cy, w - 24, 46, 12, { color: '#c4cde0' });
      cy += 52;
    }
    const rows = [
      ['flag', 'Waves', String(m.waves)],
      ['coin', 'Starting gold', String(m.startGold)],
      ['heart', 'Lives', String(m.startLives)],
      ['skull', 'Difficulty', '●'.repeat(difficultyOf(i)) + '○'.repeat(5 - difficultyOf(i))],
      ['range', 'Roads', m.paths.length > 1 ? `${m.paths.length} (enemies split)` : '1'],
      ['crown', 'Best', rec.best ? `wave ${rec.best}` : '—']
    ];
    const colW = wide ? (w - 24 - 170) / 2 : w - 24;
    rows.forEach((r, k) => {
      const col = wide ? Math.floor(k / 3) : 0, row = wide ? k % 3 : k;
      const rx = x + 12 + col * colW, ry = cy + row * 19;
      drawIcon(r[0], rx + 7, ry + 8, 13);
      ctx.textAlign = 'left';
      fitText(r[1], rx + 18, ry + 9, colW * 0.5 - 18, 11, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(r[2], rx + colW - 6, ry + 9, colW * 0.5, 12, { weight: 'bold', color: '#ffffff' });
    });
    const by = wide ? y + h - 52 : y + h - 98;
    const bx = wide ? x + w - 170 : x + 12, bw = wide ? 158 : w - 24;
    if (!wide) {
      drawStars(rec.stars, x + w / 2, by - 6, 20);
    }
    uiButton('ms-play', bx, wide ? y + 40 : by + 14, bw, 48, locked ? 'Locked' : (savedGameInfo && savedGameInfo.map === i ? 'Restart' : 'Play'), {
      style: locked ? 'dark' : 'gold', icon: locked ? 'lock' : 'play', px: 16, key: 'Enter', disabled: locked,
      sub: locked ? 'Win the previous map first' : `${['', '★', '★★', '★★★'][rec.stars] || 'Not yet won'}`,
      onClick: playSelectedMap, onDisabled: () => audio.play('error')
    });
    if (!wide && savedGameInfo && savedGameInfo.map !== i) {
      ctx.textAlign = 'center';
      fitText('⚠ Starting replaces your saved game', x + w / 2, by + 74, w - 20, 10, { color: UI.warn });
    }
  }

  function moveMapSelect(dx, dy) {
    const bi = Math.floor(mapSelectIndex / 3), j = mapSelectIndex % 3;
    const nb = clamp(bi + dx, 0, 3), nj = clamp(j + dy, 0, 2);
    const ni = nb * 3 + nj;
    if (ni !== mapSelectIndex) {
      previewMap(ni);
      audio.play('click', { pitch: 1.3 });
    }
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
    const res = lastResult || { stars: 0, prevStars: 0 };
    res.t = (res.t || 0) + frameDt;
    const pw = Math.min(440, UW - 40), ph = victory ? 312 : 236;
    const px = cx - pw / 2, py = clamp(UH / 2 - ph / 2 + 30, 80, UH - ph - 10);
    drawHeadline(victory ? 'VICTORY' : 'DEFEAT', cx, py - 40, UW - 40, 58, victory ? UI.gold : '#ff5a5a', victory ? '#ff9a2a' : '#9a1a1a');
    drawPanel(px, py, pw, ph, { title: MAPS[currentMap].name, titleRight: victory ? 'Map cleared' : `Fell at wave ${currentWave}`, accent: victory ? UI.gold : UI.bad, radius: 12 });
    let y = py + 44;
    if (victory) {
      // Stars pop in one after another
      for (let i = 0; i < 3; ++i) {
        const t = clamp((res.t - 0.3 - i * 0.35) / 0.3, 0, 1);
        const earned = i < res.stars;
        const s = earned ? 34 * (t < 1 ? 0.4 + 0.9 * Math.sin(t * Math.PI * 0.75) : 1) : 30;
        drawIcon(earned && t > 0 ? 'star' : 'starEmpty', cx + (i - 1) * 46, y + 22, s);
        if (earned && t > 0 && t < 1 && !res['snd' + i]) {
          res['snd' + i] = true;
          audio.play('coin', { pitch: 1 + i * 0.2 });
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = res.stars > res.prevStars ? (res.prevStars ? 'New best rating!' : res.unlocked ? 'Next map unlocked!' : 'Map won!') : 'Map won again';
      fitText(msg, cx, y + 52, pw - 40, 12, { weight: 'bold', color: UI.good });
      y += 66;
    }
    const stats = [
      ['flag', 'Waves survived', `${victory ? currentWave : Math.max(0, currentWave - 1)} / ${totalWaves}`],
      ['skull', 'Enemies defeated', String(runStats.kills)],
      ['coin', 'Gold earned', String(runStats.gold)],
      ['heart', 'Lives left', `${lives} / ${MAPS[currentMap].startLives}`]
    ];
    for (const [icon, label, value] of stats) {
      drawIcon(icon, px + 30, y + 9, 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, px + 46, y + 10, pw * 0.5, 13, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(value, px + pw - 24, y + 10, pw * 0.35, 15, { weight: 'bold', color: '#ffffff' });
      y += 24;
    }
    y += 10;
    const bw = (pw - 52) / 2;
    if (victory) {
      const hasNext = currentMap + 1 < MAPS.length;
      uiButton('end-next', px + 20, y, bw, 44, hasNext ? 'Next map' : 'Campaign', { style: 'gold', icon: 'play', key: 'Enter', px: 14,
        onClick: () => { if (hasNext) { currentMap += 1; resetAndStart(); } else openMapSelect(); } });
      uiButton('end-retry', px + 32 + bw, y, bw, 44, 'Play again', { style: 'dark', key: 'R', px: 14, onClick: resetAndStart });
      uiButton('end-maps', px + 20, y + 52, pw - 40, 30, 'Campaign map', { style: 'dark', key: 'M', px: 12, onClick: openMapSelect });
    } else {
      uiButton('end-retry', px + 20, y, bw, 44, 'Try again', { style: 'gold', icon: 'play', key: 'Enter', px: 14, onClick: resetAndStart });
      uiButton('end-maps', px + 32 + bw, y, bw, 44, 'Campaign map', { style: 'dark', key: 'M', px: 13, onClick: openMapSelect });
    }
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
      drawHelpGrid(cx, cy, cw, ch, Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].unlock <= 1).map(k => ({ draw: (x, y, s) => drawEnemyIcon(k, x, y, s), name: ENEMY_TYPES[k].name, text: `${ENEMY_TYPES[k].info} Counter: ${ENEMY_TYPES[k].counter}.` })));
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
    const cellH = Math.min(70, (h - (rowsN - 1) * 5) / rowsN);
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

  /* ══════════════════════════════════════════════════════════════════
     ICON HELPERS -- towers and enemies drawn into UI boxes
     ══════════════════════════════════════════════════════════════════ */

  function drawTowerIcon(typeIndex, tier, cx, cy, size, branch) {
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / 30;
    ctx.scale(k, k);
    drawTowerShape(TOWER_TYPES[typeIndex], tier, -Math.PI / 4, branch === undefined ? -1 : branch);
    ctx.restore();
  }

  function drawTowerIconWorld(typeIndex, tier, x, y) {
    ctx.save();
    ctx.translate(x, y);
    drawTowerShape(TOWER_TYPES[typeIndex], tier, -Math.PI / 4, -1);
    ctx.restore();
  }

  function drawEnemyIcon(type, cx, cy, size) {
    const def = ENEMY_TYPES[type];
    const fake = { type, radius: def.radius, shieldHp: def.shielded ? 1 : 0, shieldMax: 1, maxHp: 1 };
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
    if (state !== STATE_READY && state !== STATE_MAP_SELECT) {
      drawPathVisualization();
      drawFloorEffects();
      drawClouds();
      drawPreWaveWarning();
      drawMapOverlays();
      drawTowers();
      drawEnemies();
      drawProjectiles();
      drawFxLines();
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
    } else if (state === STATE_MAP_SELECT) {
      drawMapSelect();
    } else {
      drawTopBar();
      drawBossBar();
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
    lastResult = null;
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
    if (savedGameInfo)
      currentMap = savedGameInfo.map;
    loadMapPreview();
    updateWindowTitle();
  }

  // Shows the chosen map behind the title screen
  function loadMapPreview() {
    const mapDef = MAPS[currentMap];
    buildPathCells(mapDef);
    buildPaths(mapDef);
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
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        if (savedGameInfo) continueSavedGame();
        else openMapSelect();
      } else if (code === 'KeyC') {
        e.preventDefault();
        openMapSelect();
      }
      return;
    }

    if (state === STATE_MAP_SELECT) {
      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (dirs[code]) {
        e.preventDefault();
        moveMapSelect(dirs[code][0], dirs[code][1]);
      } else if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        pressFx['ms-play'] = performance.now();
        playSelectedMap();
      } else if (code === 'Escape') {
        e.preventDefault();
        quitToTitle();
      }
      return;
    }

    if (state === STATE_GAME_OVER || state === STATE_VICTORY) {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        if (state === STATE_VICTORY && currentMap + 1 < MAPS.length) {
          currentMap += 1;
          resetAndStart();
        } else if (state === STATE_VICTORY)
          openMapSelect();
        else
          resetAndStart();
      } else if (code === 'KeyR') {
        resetAndStart();
      } else if (code === 'KeyM' || code === 'Escape') {
        openMapSelect();
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

    if (code === 'KeyN') {
      if (state === STATE_BUILD || canCallEarly())
        startNextWave();
      else
        audio.play('error');
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

    if ((code === 'KeyU' || code === 'KeyI') && selectedTower) {
      const t = selectedTower;
      const branch = t.tier === BRANCH_TIER - 1 ? (code === 'KeyI' ? 1 : 0) : t.branch;
      if (code === 'KeyI' && t.tier !== BRANCH_TIER - 1)
        return;
      if (!upgradeTower(t, branch))
        audio.play('error');
      else
        pressFx[t.tier === BRANCH_TIER ? 'insp-branch' + branch : 'insp-up'] = performance.now();
      return;
    }

    if (code === 'KeyT' && selectedTower) {
      const s = towerStats(selectedTower);
      if (s.kind !== 'mine' && s.kind !== 'trap') {
        cycleTargeting(selectedTower, e.shiftKey ? -1 : 1);
        pressFx['insp-target-' + selectedTower.target] = performance.now();
      }
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
      : state === STATE_MAP_SELECT
        ? 'Tower Defense -- Campaign'
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
  loadMeta();
  refreshSavedGameInfo();
  if (savedGameInfo)
    currentMap = savedGameInfo.map;
  loadMapPreview();
  updateWindowTitle();
  audio.attachMuteButton();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
