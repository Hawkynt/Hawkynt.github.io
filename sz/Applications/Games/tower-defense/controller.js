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
  const STATE_RESEARCH = 'RESEARCH';

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

  const screenShake = { trigger: (intensity, ms) => addShake(intensity, ms) };
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
        for (const id in d.tree)
          if (TREE_BY_ID[id] && Number.isInteger(d.tree[id]) && d.tree[id] > 0)
            meta.tree[id] = Math.min(d.tree[id], TREE_BY_ID[id].max);
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
    const ratio = lives / startLives();
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

  function buildBlockedCells(mapDef) {
    blockedCells = blockedFor(mapDef, pathCells);
  }

  // Map features plus a sprinkling of trees and boulders well away from the road
  function blockedFor(mapDef, pathCells) {
    const blockedCells = new Map();
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
    return blockedCells;
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
    gold = mapDef.startGold + techLevel('chest') * 25;
    lives = startLives();
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
    // Research bonuses
    s.damage *= techDamageMul(def);
    s.range *= techRangeMul(def);
    if (s.cloudDps) s.cloudDps *= techDamageMul(def);
    if (s.burn) s.burn *= techDamageMul(def);
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
    if (!towerUnlocked(typeIndex) || !canBuildAt(typeIndex, col, row))
      return false;
    if (gold < def.cost) {
      audio.play('error');
      return false;
    }
    gold -= def.cost;
    const tower = makeTower(col, row, typeIndex, 1, -1);
    tower.spent = def.cost;
    tower.maxHp = tower.hp = towerMaxHp(1);
    tower.builtWave = state === STATE_BUILD ? currentWave : -1;
    tower.bornAt = animTime;
    towers.push(tower);
    particles.smoke(tower.x, tower.y + 10, 5, '#b8a080', 7);
    particles.debris(tower.x, tower.y + 8, 6, ['#8a7050', '#6a5038', '#a89070'], 0.7);
    particles.sparkle(tower.x, tower.y, 8, { color: def.color, speed: 2 });
    addShake(1.5, 80);
    audio.play(def.trap ? 'click' : 'drop', def.trap ? { pitch: 0.8 } : undefined);
    floatingText.add(tower.x, tower.y - 22, `-${def.cost}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    return true;
  }

  function getUpgradeCost(tower) {
    if (tower.tier >= MAX_TIER) return 0;
    return Math.round(TOWER_TYPES[tower.type].cost * TIER_COST[tower.tier + 1] / 5) * 5;
  }

  // branch: required when going from tier 3 to 4
  function towerMaxHp(tier) {
    return (100 + (tier - 1) * 25) * (1 + techLevel('masonry') * 0.4);
  }

  function upgradeTower(tower, branch) {
    if (tower.tier >= MAX_TIER) return false;
    if (tower.tier + 1 === MAX_TIER && !masteryUnlocked(tower.type)) return false;
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
    tower.maxHp = towerMaxHp(tower.tier);
    tower.hp = tower.maxHp * hpBefore;
    tower.upAt = animTime;
    for (let i = 0; i < 14; ++i)
      emit(tower.x + rnd(-10, 10), tower.y + rnd(-4, 12), 0, -rnd(40, 110), rnd(0.5, 0.9), rnd(1.5, 2.5), i % 3 ? '#ffd75a' : '#fff6c0', PK_PIXEL, 0, 1);
    particles.glow(tower.x, tower.y - 8, 34, '#ffd75a', 0.45);
    particles.sparkle(tower.x, tower.y, 10, { color: def.color, speed: 3 });
    floatingText.add(tower.x, tower.y - 30, tower.tier === BRANCH_TIER ? towerName(tower) + '!' : tower.tier === MAX_TIER ? 'Mastered!' : `Tier ${toRoman(tower.tier)}!`, { color: '#ffd75a', font: 'bold 13px sans-serif' });
    screenShake.trigger(2, 80);
    audio.play('powerup', { pitch: 0.85 + tower.tier * 0.08 });
    return true;
  }

  function getSellValue(tower) {
    // Full refund for a tower built during this build phase
    if (state === STATE_BUILD && tower.builtWave === currentWave)
      return tower.spent;
    return Math.floor(tower.spent * (techLevel('salvage') ? 0.75 : 0.6));
  }

  function sellTower(tower) {
    const refund = getSellValue(tower);
    gold += refund;
    const idx = towers.indexOf(tower);
    if (idx !== -1) towers.splice(idx, 1);
    floatingText.add(tower.x, tower.y - 22, `+${refund}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
    particles.debris(tower.x, tower.y, 10, ['#7a7a8a', '#5a4a3a', '#9a9aa8'], 1);
    particles.smoke(tower.x, tower.y + 6, 5, '#8a8078', 8);
    coinFly(tower.x, tower.y, Math.min(8, 2 + Math.floor(refund / 40)));
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
    explosionFx(tower.x, tower.y, CELL, '#ff6a3a');
    particles.debris(tower.x, tower.y, 14, ['#7a7a8a', '#5a4a3a', '#9a9aa8', '#3a3a44'], 1.3);
    floatingText.add(tower.x, tower.y - 20, 'DESTROYED!', { color: '#ff5a5a', font: 'bold 12px sans-serif' });
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
    awardResearch(true, Math.max(0, lastResult.stars - lastResult.prevStars));
    for (let i = 0; i < 5; ++i)
      particles.confetti(WORLD_W * (0.15 + i * 0.175), WORLD_H * 0.6, 24, {});
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
      const bonus = earlyBonus();
      gold += bonus;
      runStats.gold += bonus;
      goldPulse = 1;
      coinFly(WORLD_W / 2, WORLD_H * 0.3, 5);
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

  function earlyBonus() {
    return Math.round((8 + currentWave * 2) * (techLevel('early') ? 1.5 : 1));
  }

  // During a wave the next one may be called once the current one is fully on the field
  function canCallEarly() {
    return state === STATE_PLAYING && currentWave < totalWaves && waveEnemies.length === 0;
  }

  function announceWave() {
    const boss = isBossWave(currentWave, totalWaves);
    const list = summarizeWave(generateWave(currentWave)).filter(r => !ENEMY_TYPES[r.type].boss);
    const sub = list.slice(0, 3).map(r => `${r.count} ${ENEMY_TYPES[r.type].name}${r.count > 1 && !/s$/.test(ENEMY_TYPES[r.type].name) ? 's' : ''}`).join(' · ');
    showBanner(currentWave === totalWaves ? 'FINAL WAVE' : `WAVE ${currentWave}`, boss ? 'A boss is coming!' : sub, boss ? '#ff6a6a' : UI.gold);
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
        floatingText.add(t.x, t.y - 22, `+${s.income * count}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
        particles.sparkle(t.x, t.y, 6, { color: '#ffd75a', speed: 2 });
        coinFly(t.x, t.y, 3);
      }
      if (s.interest) {
        bankInterest += s.interest;
        bankCap += s.interestCap;
      }
    }
    if (bankInterest > 0)
      bonus += Math.min(bankCap, Math.floor(gold * bankInterest));
    const treasury = techLevel('interest');
    if (treasury)
      bonus += Math.min(25 * treasury, Math.floor(gold * 0.02 * treasury));
    // Masonry patches the towers up
    const mend = techLevel('masonry') * 0.2;
    if (mend > 0)
      for (const t of towers)
        if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * mend);
    gold += bonus;
    runStats.gold += bonus;
    showBanner('WAVE CLEARED', `+${bonus} gold`, UI.good, 2);
    coinFly(WORLD_W / 2, WORLD_H * 0.25, 6);
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
    if (src && src.type !== undefined && lastStandActive()) dmg *= 1.25;
    // Shields soak everything but poison; energy hits them twice as hard
    if (e.shieldHp > 0 && kind !== 'poison') {
      const mul = kind === 'energy' ? 2 : 1;
      const absorb = Math.min(e.shieldHp, dmg * mul);
      e.shieldHp -= absorb;
      dmg -= absorb / mul;
      if (e.shieldHp <= 0) {
        particles.burst(e.x, e.y - 6, 14, { color: '#7ae8ff', speed: 3, life: 0.4 });
        particles.glow(e.x, e.y - 6, e.radius * 2.5, '#5ad8ff', 0.25);
      }
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

  function lastStandActive() {
    return techLevel('laststand') > 0 && lives <= startLives() * 0.3;
  }

  function startLives() {
    return MAPS[currentMap].startLives + techLevel('fortify') * 3;
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
      if (!seen && techLevel('scouts'))
        for (let i = 0; i < towers.length && !seen; ++i)
          if (Math.hypot(towers[i].x - e.x, towers[i].y - e.y) <= CELL * 1.5 + e.radius) seen = true;
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
        aimAt(t, targets[0]);
        const mz = muzzleOf(t);
        for (const e of targets)
          projectiles.push({ kind: 'arrow', x: mz.x, y: mz.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: def.color, trail: [] });
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
        const mz = muzzleOf(t);
        projectiles.push({ kind: 'bolt', x: mz.x, y: mz.y, target: e, speed: s.speed, damage: s.damage, tower: t, s, color: '#bfeaff', trail: [] });
        aimAt(t, e);
        break;
      }
      case 'shell': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        // Aim where the target will be when the shell lands
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.15;
        const lead = predictPos(e, flight);
        aimAt(t, e);
        const mz = muzzleOf(t);
        projectiles.push({ kind: 'shell', x: mz.x, y: mz.y, sx: mz.x, sy: mz.y, tx: lead.x, ty: lead.y, t: 0, dur: flight, damage: s.damage, tower: t, s, color: '#ffb36a' });
        aimAt(t, e);
        break;
      }
      case 'glob': {
        const e = findTargets(t, s, 1)[0];
        if (!e) return false;
        const flight = Math.hypot(e.x - t.x, e.y - t.y) / s.speed + 0.1;
        const lead = predictPos(e, flight);
        const mz = muzzleOf(t);
        projectiles.push({ kind: 'glob', x: mz.x, y: mz.y, sx: mz.x, sy: mz.y, tx: lead.x, ty: lead.y, t: 0, dur: flight, damage: s.damage, tower: t, s, color: '#7ce35a' });
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
          particles.sparks(e.x, e.y - 6, 3, '#bff4ff', 120);
        });
        const m0 = muzzleOf(t);
        pts[0] = { x: m0.x, y: m0.y };
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
        if (Math.random() < 0.5) {
          const m = muzzleOf(t);
          const a = t.angle + rnd(-s.cone, s.cone) * 0.7, v = rnd(80, 150);
          emit(m.x, m.y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.45), 2, Math.random() < 0.5 ? '#ffd06a' : '#ff6a1a', PK_PIXEL, -40, 2);
        }
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
          fxLines.push({ kind: 'tracer', pts: [muzzleOf(t), { x: ex, y: ey }], color: '#9ad8ff', t: 0, life: 0.3, w: 4 });
        } else {
          if (s.execute && e.hp - s.damage * crit <= e.maxHp * s.execute && !enemyFlags(e).boss) {
            hurt(e, e.hp + e.shieldHp + 999, t, 'phys', { pierce: 1 });
            floatingText.add(e.x, e.y - 14, 'EXECUTE', { color: '#ff5a5a', font: 'bold 11px sans-serif' });
          } else
            hurt(e, s.damage * crit, t, 'phys', { pierce: s.pierce });
          fxLines.push({ kind: 'tracer', pts: [muzzleOf(t), { x: e.x, y: e.y - e.radius * 0.5 }], color: '#ffffff', t: 0, life: 0.18, w: 2 });
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
            if (Math.random() < dt * 14)
              particles.sparks(e.x, e.y - e.radius * 0.6, 1, i === 0 && ramp > 2 ? '#ffffff' : TOWER_TYPES[t.type].color, 110);
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
    explosionFx(x, y, radius, s.bomblets && radius < CELL ? '#ffcf6a' : '#ff8a3a');
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
          if (p.kind === 'glob') {
            particles.burst(p.tx, p.ty, 8, { color: p.s.acid ? '#c8ff4a' : '#7ce35a', speed: 2, life: 0.4 });
            addDecal(p.tx, p.ty, p.s.cloudPx * 0.5, 'slime');
          }
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
          particles.sparks(t.x, t.y - 6, 2, '#fff0c0', 90);
          const crit = rollCrit(s);
          hurt(t, p.damage * crit, p.tower, 'phys', { pierce: s.pierce || 0 });
          if (crit > 1)
            floatingText.add(t.x, t.y - 14, 'CRIT', { color: '#ffd75a', font: 'bold 10px sans-serif' });
        } else if (p.kind === 'bolt') {
          particles.flakes(t.x, t.y - 6, 4);
          hurt(t, p.damage, p.tower, 'cold');
          applySlow(t, 1 - s.slow, s.slowTime);
          if (s.freeze && Math.random() < s.freeze && !enemyFlags(t).boss) {
            t.freezeTimer = s.freezeTime;
            particles.flakes(t.x, t.y - 6, 10);
            particles.glow(t.x, t.y - 6, 18, '#bfeaff', 0.3);
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
    addCorpse(e);
    deathFx(e);
    let bounty = Math.round(e.bounty * (1 + techLevel('bounty') * 0.1));
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
    floatingText.add(e.x, e.y - 18, `+${bounty}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    coinFly(e.x, e.y, f.boss ? 10 : bounty >= 15 ? 2 : 1);
    // Slimes burst into slimelets
    if (f.split) {
      for (let i = 0; i < f.splitCount; ++i) {
        const c = spawnEnemy(f.split, e.pi, Math.max(0, e.dist - 6 + i * 6));
        c.maxHp = c.hp = Math.max(4, Math.floor(e.maxHp * 0.28));
        c.spawnT = 0;
      }

    }
    if (e.plague)
      clouds.push({ x: e.x, y: e.y, r: CELL * 0.8, t: 0, life: 2.2, dps: towerStats(e.plague).cloudDps * 0.6, acid: false, plague: true, tower: e.plague, seed: Math.random() * 100 });
    if (f.boss) {
      particles.confetti(e.x, e.y, 30, {});
      showBanner(`${f.name.toUpperCase()} DEFEATED`, `+${bounty} gold`, UI.gold, 2.4);
      if (techLevel('medic') && lives < startLives()) {
        lives = Math.min(startLives(), lives + 2);
        livesPulse = 1;
        floatingText.add(e.x, e.y - 40, '+2 lives', { color: '#6fe08a', font: 'bold 13px sans-serif' });
      }
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
    floatingText.add(e.x, e.y - 18, `-${cost} ${cost > 1 ? 'lives' : 'life'}`, { color: '#ff5a5a', font: 'bold 13px sans-serif' });
    particles.glow(e.x, e.y, 40, '#ff3a3a', 0.4);
    particles.burst(e.x, e.y, 10, { color: '#ff6a6a', speed: 2.5, life: 0.5 });
    livesPulse = 1;
    audio.play('hurt');
    if (lives <= 0 && state === STATE_PLAYING) {
      audio.play('lose');
      state = STATE_GAME_OVER;
      clearSavedGame();
      addHighScore(MAPS[currentMap].name, Math.max(0, currentWave - 1));
      recordResult(false);
      awardResearch(false, 0);
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
      let sdt = dt * gameSpeed;
      if (hitstop > 0) {
        hitstop -= dt;
        sdt *= 0.25;
      }
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
     ART TOOLKIT -- palettes, noise and small helpers for code-drawn
     pixel art. One art pixel is two world units: a tile is 16 x 16.
     ══════════════════════════════════════════════════════════════════ */

  const AP = 2;                 // world units per art pixel
  const TILE = CELL / AP;       // art pixels per tile

  const RAMPS = {
    wood:   ['#3a2414', '#5a3820', '#7a4e2c', '#9a663a', '#bb824c', '#d8a466'],
    stone:  ['#33333f', '#4a4a58', '#62627280', '#7c7c8c', '#9a9aa8', '#c0c0cc'],
    metal:  ['#1e2433', '#30384a', '#475266', '#647088', '#8c98b0', '#c4ccdc'],
    gold:   ['#5a3c0c', '#8a5e14', '#b8861f', '#e0b030', '#ffd860', '#fff2b0'],
    iron:   ['#141418', '#24242c', '#383842', '#50505c', '#70707e', '#9a9aa8'],
    brick:  ['#4a1e16', '#6e2c1e', '#8e3c28', '#ae5236', '#c86c48', '#e08c64'],
    marble: ['#7a7480', '#9a96a2', '#b8b4c0', '#d4d0dc', '#ece8f2', '#ffffff'],
    leaf:   ['#173a1c', '#22522a', '#2e6a34', '#3e8442', '#58a052', '#7cbc64'],
    pine:   ['#0f2a26', '#163a33', '#1e4c42', '#2a6052', '#3a7662', '#4e8c74'],
    snow:   ['#8aa2bc', '#a6bcd2', '#c2d4e6', '#dae6f2', '#eef4fa', '#ffffff'],
    ice:    ['#2a5f8c', '#3f7eb0', '#5a9cd0', '#80bce6', '#b0dcf6', '#e6f8ff'],
    lava:   ['#4a0e06', '#8a1e08', '#d03c0a', '#ff6a14', '#ffa63a', '#ffe48a'],
    water:  ['#173468', '#1f4888', '#2a5fae', '#3a7ad0', '#62a0e6', '#a8d4f6'],
    venom:  ['#163a10', '#22581a', '#348a26', '#4cb43a', '#7ce35a', '#c4ff9a'],
    flesh:  ['#5a3020', '#7a4430', '#9a5c40', '#ba7854', '#d4986c', '#ecbc94'],
    cloth:  ['#2a1838', '#3e2450', '#56346c', '#704a8a', '#8e64a8', '#b08cc8'],
    bone:   ['#5a5448', '#7a7464', '#9c9682', '#bcb6a0', '#dcd6c0', '#f6f2e2']
  };
  RAMPS.stone[2] = '#626272';

  // A 6-step ramp around any base colour
  const rampCache = {};
  function rampOf(hex) {
    let r = rampCache[hex];
    if (!r)
      r = rampCache[hex] = [shade(hex, -0.7), shade(hex, -0.48), shade(hex, -0.25), hex, shade(hex, 0.3), shade(hex, 0.62)];
    return r;
  }

  /* ── Noise ── */
  function hash2(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function valueNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x, y, seed) {
    return valueNoise(x, y, seed) * 0.55 + valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.15;
  }

  // 4x4 ordered dither threshold in [0,1)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) {
    return BAYER[(y & 3) * 4 + (x & 3)] / 16;
  }

  // Pick a ramp entry from a 0..1 value with ordered dithering between steps
  function rampPick(ramp, v, x, y, lo, hi) {
    lo = lo || 0;
    hi = hi === undefined ? ramp.length - 1 : hi;
    const f = lo + clamp(v, 0, 0.999) * (hi - lo + 1) - 0.5;
    let i = Math.floor(f);
    if (f - i > bayer(x, y)) ++i;
    return ramp[clamp(i, lo, hi)];
  }

  /* ── Drawing helpers (art pixels) ── */
  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }

  // Bevelled block: light top/left edge, dark bottom/right edge
  function block(g, x, y, w, h, ramp, k) {
    k = k === undefined ? 3 : k;
    px(g, x, y, w, h, ramp[k]);
    px(g, x, y, w, 1, ramp[k + 1] || ramp[k]);
    px(g, x, y, 1, h, ramp[k + 1] || ramp[k]);
    px(g, x, y + h - 1, w, 1, ramp[k - 1]);
    px(g, x + w - 1, y, 1, h, ramp[k - 1]);
  }

  function disc(g, cx, cy, r, ramp, k) {
    k = k === undefined ? 3 : k;
    g.fillStyle = ramp[k - 1];
    g.beginPath(); g.arc(cx, cy, r, 0, TWO_PI); g.fill();
    g.fillStyle = ramp[k];
    g.beginPath(); g.arc(cx - r * 0.12, cy - r * 0.15, r * 0.82, 0, TWO_PI); g.fill();
    g.fillStyle = ramp[k + 1] || ramp[k];
    g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.38, r * 0.34, 0, TWO_PI); g.fill();
  }

  function ellipseFill(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TWO_PI); g.fill();
  }

  function poly(g, pts, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  }

  function line(g, x0, y0, x1, y1, c, w) {
    g.strokeStyle = c;
    g.lineWidth = w || 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }

  /* ── Cached soft glows (one gradient per colour, drawn additively) ── */
  const glowCache = {};
  function getGlow(color) {
    let c = glowCache[color];
    if (!c) {
      c = glowCache[color] = makeCanvas(64, 64);
      const g = c.getContext('2d');
      const [r, gg, b] = parseHex(color);
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    return c;
  }

  function drawGlow(color, x, y, r, alpha) {
    if (alpha <= 0.01 || r <= 0) return;
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * Math.min(1, alpha);
    ctx.drawImage(getGlow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = prev;
  }

  // Soft dark blob used for ground shadows
  let shadowBlob = null;
  function drawShadow(x, y, rx, ry, alpha) {
    if (!shadowBlob) {
      shadowBlob = makeCanvas(32, 16);
      const g = shadowBlob.getContext('2d');
      const grad = g.createRadialGradient(16, 8, 0, 16, 8, 16);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.save(); g.scale(1, 0.5); g.fillRect(0, 0, 32, 32); g.restore();
    }
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(shadowBlob, x - rx, y - ry, rx * 2, ry * 2);
    ctx.globalAlpha = pa;
  }

  // Pixel sprite drawn at world position (cx, bottom) with art pixel scale
  function blitArt(img, cx, bottomY, flip, alpha, scale) {
    if (!img) return;
    const s = AP * (scale || 1);
    const w = img.width * s, h = img.height * s;
    const pa = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = pa * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, bottomY - h, w, h);
      ctx.restore();
    } else
      ctx.drawImage(img, cx - w / 2, bottomY - h, w, h);
    ctx.globalAlpha = pa;
  }

  // White silhouette of a sprite (hit flashes)
  const flashCache = new WeakMap();
  function flashOf(img) {
    let f = flashCache.get(img);
    if (!f) {
      f = makeCanvas(img.width, img.height);
      const g = f.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, f.width, f.height);
      flashCache.set(img, f);
    }
    return f;
  }

  /* ══════════════════════════════════════════════════════════════════
     TERRAIN -- every map is baked once into a pixel-art canvas: textured
     ground, roads with ragged edges, shores, cliffs, props and gates.
     Water and lava get four animation frames of their own.
     ══════════════════════════════════════════════════════════════════ */

  const TERRAIN = {
    meadow: {
      ground: ['#24461f', '#2f5a28', '#3b6d31', '#4a823a', '#5c9844', '#78b256'],
      path: ['#4e3520', '#664629', '#7c5733', '#93693e', '#a87d4c', '#c49864'], cobble: false,
      shore: '#6e5a36', feature: 'water', cliff: RAMPS.stone, blade: '#8cc864',
      decor: ['flower', 'flower2', 'tuft', 'tuft', 'pebble', 'mushroom'], tree: 'oak', boulder: 'mossrock'
    },
    desert: {
      ground: ['#9a6a34', '#b07c3e', '#c3904c', '#d4a35c', '#e2b86e', '#f0d08e'],
      path: ['#5e4a3a', '#715a46', '#866c54', '#9b8064', '#b09678', '#c8b090'], cobble: true,
      shore: '#e8d29a', feature: 'water', cliff: ['#5a3418', '#7a4824', '#9a6032', '#b87a44', '#d29a60', '#ecc084'], blade: '#f6dca0',
      decor: ['pebble', 'bones', 'drygrass', 'drygrass', 'pebble'], tree: 'cactus', boulder: 'sandrock'
    },
    tundra: {
      ground: ['#8ea6c2', '#a8bed6', '#c0d2e4', '#d6e4f0', '#e8f0f8', '#ffffff'],
      path: ['#46566c', '#56687f', '#687c94', '#7c91a9', '#92a7be', '#b0c4d8'], cobble: true,
      shore: '#f4f8fc', feature: 'ice', cliff: ['#2c3a4e', '#3e4e66', '#52647e', '#6a7e98', '#8aa0b8', '#b6c8dc'], blade: '#ffffff',
      decor: ['snowtuft', 'icecrystal', 'pebble', 'snowtuft'], tree: 'pine', boulder: 'snowrock'
    },
    volcano: {
      ground: ['#1a1214', '#241a1c', '#2f2224', '#3b2b2c', '#4a3634', '#5c4440'],
      path: ['#0e090e', '#171018', '#211722', '#2c1f2c', '#3a2938', '#4a3646'], cobble: true, seam: '#ff6a1a',
      shore: '#140c0c', feature: 'lava', cliff: ['#120c10', '#1e1418', '#2c1e22', '#3c2a2c', '#4e3838', '#644a46'], blade: '#6a4a40',
      decor: ['ember', 'pebble', 'crack', 'skull'], tree: 'deadtree', boulder: 'obsidian'
    }
  };

  /* ── Prop sprites ── */
  const PROP_ART = {
    oak: [16, 22, (g) => {
      px(g, 7, 14, 3, 8, RAMPS.wood[2]); px(g, 7, 14, 1, 8, RAMPS.wood[3]);
      disc(g, 8, 9, 7, RAMPS.leaf, 3);
      disc(g, 4.5, 11, 4, RAMPS.leaf, 2);
      disc(g, 11.5, 11, 4, RAMPS.leaf, 2);
      disc(g, 8, 6, 4.5, RAMPS.leaf, 4);
      px(g, 5, 4, 2, 1, RAMPS.leaf[5]); px(g, 9, 7, 1, 1, '#e85a5a'); px(g, 4, 10, 1, 1, '#e85a5a');
    }],
    pine: [14, 24, (g) => {
      px(g, 6, 19, 2, 5, RAMPS.wood[1]);
      for (let i = 0; i < 4; ++i) {
        const y = 3 + i * 4, w = 3 + i * 2;
        poly(g, [7, y - 3, 7 - w, y + 4, 7 + w, y + 4], RAMPS.pine[2 + (i % 2)]);
        px(g, 7 - w + 1, y + 3, w * 2 - 1, 1, RAMPS.snow[4]);
        px(g, 7 - Math.floor(w / 2), y + 2, Math.max(1, w), 1, RAMPS.snow[3]);
      }
      px(g, 6, 0, 2, 2, RAMPS.snow[5]);
    }],
    cactus: [12, 18, (g) => {
      const c = ['#1e4a24', '#2a6630', '#3a8440', '#52a454', '#78c470', '#a8e094'];
      px(g, 4, 2, 4, 16, c[2]); px(g, 4, 2, 1, 16, c[4]); px(g, 7, 2, 1, 16, c[1]);
      px(g, 0, 7, 3, 6, c[2]); px(g, 0, 11, 4, 2, c[2]); px(g, 0, 7, 1, 6, c[4]);
      px(g, 9, 4, 3, 6, c[2]); px(g, 8, 8, 4, 2, c[2]); px(g, 11, 4, 1, 6, c[1]);
      px(g, 5, 1, 2, 1, '#ff7aa8'); px(g, 5, 5, 1, 1, c[5]); px(g, 6, 10, 1, 1, c[5]); px(g, 5, 14, 1, 1, c[5]);
    }],
    deadtree: [16, 22, (g) => {
      const c = ['#0e0a0c', '#1c1418', '#2a2024', '#3a2c30', '#4c3c3e', '#5e4c4c'];
      px(g, 7, 8, 3, 14, c[2]); px(g, 7, 8, 1, 14, c[4]);
      line(g, 8, 12, 2, 5, c[2], 2); line(g, 9, 10, 14, 3, c[2], 2); line(g, 4, 8, 3, 2, c[3], 1); line(g, 12, 6, 13, 1, c[3], 1);
      px(g, 8, 15, 1, 1, '#ff6a1a'); px(g, 8, 18, 1, 1, '#ffa63a');
    }],
    mossrock: [14, 11, (g) => {
      disc(g, 7, 6.5, 6, RAMPS.stone, 3); disc(g, 3.5, 8, 3.2, RAMPS.stone, 2);
      px(g, 3, 1, 5, 2, RAMPS.leaf[3]); px(g, 4, 1, 3, 1, RAMPS.leaf[4]); px(g, 9, 4, 2, 1, RAMPS.leaf[3]);
    }],
    sandrock: [14, 11, (g) => {
      const c = TERRAIN.desert.cliff;
      disc(g, 7, 6.5, 6, c, 3); disc(g, 10.5, 8, 3.2, c, 2);
      px(g, 3, 5, 6, 1, c[1]); px(g, 4, 8, 4, 1, c[1]);
    }],
    snowrock: [14, 11, (g) => {
      const c = TERRAIN.tundra.cliff;
      disc(g, 7, 6.5, 6, c, 3); disc(g, 3.5, 8, 3.2, c, 2);
      ellipseFill(g, 6.5, 2.5, 4.5, 2, RAMPS.snow[4]); px(g, 4, 2, 3, 1, '#ffffff');
    }],
    obsidian: [12, 16, (g) => {
      const c = TERRAIN.volcano.cliff;
      poly(g, [5, 0, 10, 8, 9, 16, 1, 16, 2, 6], c[3]);
      poly(g, [5, 0, 6, 9, 4, 16, 1, 16, 2, 6], c[4]);
      poly(g, [9, 6, 12, 12, 11, 16, 8, 16], c[2]);
      px(g, 5, 9, 1, 3, '#ff6a1a');
    }],
    flower: [5, 5, (g) => {
      px(g, 2, 2, 1, 3, '#3a7a2a'); px(g, 1, 0, 3, 3, '#f4f4f4'); px(g, 2, 1, 1, 1, '#ffd84a');
    }],
    flower2: [5, 5, (g) => {
      px(g, 2, 2, 1, 3, '#3a7a2a'); px(g, 1, 0, 3, 3, '#e8507a'); px(g, 2, 1, 1, 1, '#ffe08a');
    }],
    tuft: [6, 4, (g) => {
      px(g, 0, 2, 1, 2, '#5c9844'); px(g, 2, 0, 1, 4, '#78b256'); px(g, 4, 1, 1, 3, '#5c9844'); px(g, 3, 2, 1, 2, '#4a823a');
    }],
    drygrass: [6, 4, (g) => {
      px(g, 0, 2, 1, 2, '#a8803e'); px(g, 2, 0, 1, 4, '#d8b06a'); px(g, 4, 1, 1, 3, '#b88c48');
    }],
    snowtuft: [7, 3, (g) => {
      ellipseFill(g, 3.5, 1.8, 3.4, 1.4, '#ffffff'); px(g, 1, 2, 5, 1, '#d6e4f0');
    }],
    pebble: [4, 3, (g) => {
      px(g, 0, 1, 3, 2, '#7a7a86'); px(g, 0, 1, 2, 1, '#a0a0ac'); px(g, 3, 2, 1, 1, '#4a4a56');
    }],
    mushroom: [5, 5, (g) => {
      px(g, 2, 3, 1, 2, '#e8e2d4'); px(g, 0, 1, 5, 2, '#d84a3a'); px(g, 1, 0, 3, 1, '#d84a3a'); px(g, 1, 1, 1, 1, '#ffffff'); px(g, 3, 2, 1, 1, '#ffffff');
    }],
    bones: [7, 4, (g) => {
      px(g, 0, 1, 7, 1, '#e8e2d4'); px(g, 0, 0, 1, 3, '#f6f2e2'); px(g, 6, 0, 1, 3, '#f6f2e2'); px(g, 2, 3, 3, 1, '#bcb6a0');
    }],
    icecrystal: [5, 7, (g) => {
      poly(g, [2, 0, 4, 4, 2, 7, 0, 4], '#8ac4e8'); px(g, 2, 1, 1, 4, '#e6f8ff');
    }],
    ember: [3, 3, (g) => {
      px(g, 1, 0, 1, 3, '#ff6a14'); px(g, 0, 1, 3, 1, '#ff6a14'); px(g, 1, 1, 1, 1, '#ffe48a');
    }],
    crack: [8, 4, (g) => {
      line(g, 0, 1, 3, 2, '#ff6a1a', 1); line(g, 3, 2, 7, 1, '#d03c0a', 1); px(g, 4, 3, 1, 1, '#ff6a1a');
    }],
    skull: [5, 5, (g) => {
      px(g, 0, 0, 5, 3, '#dcd6c0'); px(g, 1, 3, 3, 2, '#bcb6a0'); px(g, 1, 1, 1, 1, '#1a1214'); px(g, 3, 1, 1, 1, '#1a1214');
    }]
  };

  const propCache = {};
  function propArt(key) {
    let c = propCache[key];
    if (!c) {
      const [w, h, fn] = PROP_ART[key];
      const outline = ['flower', 'flower2', 'tuft', 'drygrass', 'snowtuft', 'pebble', 'ember', 'crack'].indexOf(key) >= 0 ? null : OUTLINE;
      c = propCache[key] = pixelArt(w, h, fn, outline);
    }
    return c;
  }

  /* ── Gates: a dark tunnel where enemies enter, a gatehouse where they leave ── */
  function gateArt(kind, biome) {
    const key = 'gate-' + kind + '-' + biome;
    if (propCache[key]) return propCache[key];
    const T = TERRAIN[biome];
    const st = T.cliff;
    let c;
    if (kind === 'spawn') {
      c = pixelArt(22, 22, (g) => {
        // Rock arch with a black mouth
        disc(g, 11, 11, 10.5, st, 3);
        disc(g, 11, 13, 7.5, ['#000000', '#05030a', '#0c0814', '#140c1e', '#1c1228', '#241834'], 2);
        px(g, 5, 19, 12, 3, st[1]);
        px(g, 3, 4, 3, 2, st[4]); px(g, 15, 3, 4, 2, st[4]);
        // Runes
        px(g, 3, 10, 1, 2, '#ff4a6a'); px(g, 18, 10, 1, 2, '#ff4a6a'); px(g, 10, 1, 2, 1, '#ff4a6a');
      });
    } else if (kind === 'exit') {
      c = pixelArt(26, 28, (g) => {
        const s = RAMPS.stone;
        // Two towers and a wall with an open gate
        block(g, 1, 8, 7, 20, s, 3); block(g, 18, 8, 7, 20, s, 3);
        block(g, 6, 13, 14, 15, s, 2);
        for (let i = 0; i < 3; ++i) { px(g, 1 + i * 3, 5, 2, 3, s[3]); px(g, 18 + i * 3, 5, 2, 3, s[3]); }
        for (let i = 0; i < 4; ++i) px(g, 7 + i * 3, 10, 2, 3, s[2]);
        px(g, 9, 17, 8, 11, '#120a08'); px(g, 10, 16, 6, 1, '#120a08');
        for (let i = 0; i < 3; ++i) px(g, 10 + i * 2, 18, 1, 10, '#3a2a1a');
        px(g, 3, 13, 2, 3, '#ffd75a'); px(g, 21, 13, 2, 3, '#ffd75a');
        px(g, 4, 0, 1, 6, RAMPS.wood[3]); px(g, 21, 0, 1, 6, RAMPS.wood[3]);
      });
    } else {
      c = pixelArt(34, 36, (g) => {
        const s = RAMPS.stone;
        // Central keep
        block(g, 2, 14, 30, 22, s, 2);
        block(g, 8, 4, 18, 22, s, 3);
        for (let i = 0; i < 5; ++i) px(g, 8 + i * 4, 1, 2, 3, s[3]);
        for (let i = 0; i < 8; ++i) px(g, 2 + i * 4, 11, 2, 3, s[2]);
        px(g, 13, 22, 8, 14, '#120a08'); px(g, 14, 21, 6, 1, '#120a08');
        px(g, 12, 9, 2, 3, '#ffd75a'); px(g, 20, 9, 2, 3, '#ffd75a');
        px(g, 16, 0, 1, 5, RAMPS.wood[3]);
      });
    }
    propCache[key] = c;
    return c;
  }

  /* ── The bake ── */
  const terrainCache = {};

  function getTerrain(mapIndex) {
    if (!terrainCache[mapIndex])
      terrainCache[mapIndex] = bakeTerrain(mapIndex);
    return terrainCache[mapIndex];
  }

  function bakeTerrain(mapIndex) {
    const m = MAPS[mapIndex];
    const T = TERRAIN[m.biome];
    const W = COLS * TILE, H = ROWS * TILE;
    const seed = mapIndex * 97 + 13;
    const cells = new Set();
    for (const wp of m.paths) walkPath(wp, (x, y) => cells.add(x + ',' + y));
    const feat = new Map();
    for (const [type, c0, r0, c1, r1] of m.features)
      for (let r = r0; r <= r1; ++r)
        for (let c = c0; c <= c1; ++c)
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !cells.has(c + ',' + r))
            feat.set(c + ',' + r, type);
    const props = blockedFor(m, cells);
    const kindAt = (c, r) => {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 'out';
      const k = c + ',' + r;
      return cells.has(k) ? 'path' : (feat.get(k) || 'ground');
    };
    // Distance (art px) from a pixel to the edge of its own region kind
    // Outer corners are rounded with radius R
    const edgeDist = (x, y, kind, R) => {
      R = R || 6;
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      const ex = x - c * TILE + 0.5, ey = y - r * TILE + 0.5;
      let d = 99;
      const other = (dc, dr) => { const k = kindAt(c + dc, r + dr); return k !== kind && k !== 'out'; };
      const L = other(-1, 0), Rt = other(1, 0), U = other(0, -1), D = other(0, 1);
      if (L) d = Math.min(d, ex);
      if (Rt) d = Math.min(d, TILE - ex);
      if (U) d = Math.min(d, ey);
      if (D) d = Math.min(d, TILE - ey);
      const corner = (ax, ay) => (ax < R && ay < R) ? R - Math.hypot(R - ax, R - ay) : 99;
      if (L && U) d = Math.min(d, corner(ex, ey));
      if (Rt && U) d = Math.min(d, corner(TILE - ex, ey));
      if (L && D) d = Math.min(d, corner(ex, TILE - ey));
      if (Rt && D) d = Math.min(d, corner(TILE - ex, TILE - ey));
      if (!L && !U && other(-1, -1)) d = Math.min(d, Math.hypot(ex, ey));
      if (!Rt && !U && other(1, -1)) d = Math.min(d, Math.hypot(TILE - ex, ey));
      if (!L && !D && other(-1, 1)) d = Math.min(d, Math.hypot(ex, TILE - ey));
      if (!Rt && !D && other(1, 1)) d = Math.min(d, Math.hypot(TILE - ex, TILE - ey));
      return d;
    };
    const canvas2 = makeCanvas(W, H);
    const g = canvas2.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    const rgbCache = {};
    const put = (x, y, hex) => {
      let rgb = rgbCache[hex];
      if (!rgb) rgb = rgbCache[hex] = parseHex(hex);
      const i = (y * W + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    };
    const animated = [];   // [x, y, kind, depth] for water / lava / ice pixels
    const fr = RAMPS[T.feature === 'lava' ? 'lava' : T.feature === 'ice' ? 'ice' : 'water'];
    for (let y = 0; y < H; ++y) {
      for (let x = 0; x < W; ++x) {
        const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
        let kind = kindAt(c, r);
        const n = fbm(x / 15, y / 15, seed);
        const h = hash2(x, y, seed);
        if (kind === 'path') {
          const ed = edgeDist(x, y, 'path') + (valueNoise(x / 2.6, y / 2.6, seed + 3) - 0.5) * 3.2;
          if (ed < 1.3) kind = 'groundEdge';
          else if (ed < 2.6) { put(x, y, T.path[0]); continue; }
          else {
            if (T.cobble) {
              const row = Math.floor(y / 5);
              const off = (row % 2) * 3;
              const sx = Math.floor((x + off) / 6);
              const mortar = (x + off) % 6 === 0 || y % 5 === 0;
              if (mortar) put(x, y, T.seam && hash2(sx, row, seed + 9) > 0.93 ? T.seam : T.path[1]);
              else {
                const sv = hash2(sx, row, seed + 1);
                const top = y % 5 === 1 || (x + off) % 6 === 1;
                put(x, y, top ? T.path[4] : rampPick(T.path, 0.25 + sv * 0.5 + (n - 0.5) * 0.3, x, y, 2, 4));
              }
            } else {
              let col = rampPick(T.path, n * 0.9 + h * 0.1, x, y, 1, 4);
              if (h > 0.972) col = T.path[5];
              else if (hash2(x, y - 1, seed) > 0.972) col = T.path[1];
              put(x, y, col);
            }
            continue;
          }
        }
        const featEd = (kind === 'water' || kind === 'ice' || kind === 'lava' || kind === 'rock')
          ? edgeDist(x, y, kind, 10) + (valueNoise(x / 6, y / 6, seed + 5) - 0.5) * 6 + (valueNoise(x / 2, y / 2, seed + 4) - 0.5) * 1.5 - 1.2 : 99;
        if (featEd < 0.3) kind = 'groundEdge';
        if (kind === 'water' || kind === 'ice' || kind === 'lava') {
          const ed = featEd;
          if (ed < 1.4) { put(x, y, kind === 'lava' ? '#0a0608' : T.shore); continue; }
          if (ed < 2.4) { put(x, y, kind === 'lava' ? fr[1] : fr[4]); continue; }
          const depth = clamp((ed - 2) / 7, 0, 1);
          put(x, y, kind === 'ice'
            ? (hash2(Math.floor(x / 5), Math.floor(y / 4), seed) > 0.93 ? fr[4] : rampPick(fr, 0.75 - depth * 0.3 + (n - 0.5) * 0.25, x, y, 2, 4))
            : rampPick(fr, 0.6 - depth * 0.45 + (n - 0.5) * 0.2, x, y, 0, 3));
          animated.push(x, y, depth);
          continue;
        }
        if (kind === 'rock') {
          // Raised outcrop: top surface, cliff face along its southern edge
          let r1 = r;
          while (kindAt(c, r1 + 1) === 'rock') ++r1;
          const ed = featEd;
          if ((r1 + 1) * TILE - y <= 5 || edgeDist(x, y + 5, 'rock', 10) + (valueNoise(x / 6, (y + 5) / 6, seed + 5) - 0.5) * 6 - 1.2 < 0.3) {
            put(x, y, (x % 3 === 0 || ed < 1) ? T.cliff[0] : rampPick(T.cliff, 0.25 + n * 0.3, x, y, 0, 2));
            continue;
          }
          if (ed < 1.2) { put(x, y, T.cliff[1]); continue; }
          if (ed < 2.2) { put(x, y, T.cliff[5]); continue; }
          // Embossed rocky surface: lit from the top left
          const v1 = fbm(x / 5, y / 5, seed + 70), v0 = fbm((x - 1.5) / 5, (y - 1.5) / 5, seed + 70);
          const lit = (v1 - v0) * 9;
          let col = rampPick(T.cliff, 0.5 + lit * 0.5 + (v1 - 0.5) * 0.3, x, y, 1, 5);
          if (h > 0.985) col = T.cliff[1];
          put(x, y, col);
          continue;
        }
        // Ground
        const v = n * 0.85 + valueNoise(x / 4, y / 4, seed + 2) * 0.15;
        let col = rampPick(T.ground, 0.1 + (v - 0.2) * 1.2, x, y, 1, 4);
        if (h > 0.993) col = T.ground[5];
        else if (h < 0.006) col = T.ground[0];
        put(x, y, col);
      }
    }
    // Shadow under outcrops
    for (const [key, type] of feat) {
      if (type !== 'rock') continue;
      const [c, r] = key.split(',').map(Number);
      if (kindAt(c, r + 1) === 'rock') continue;
      for (let y = (r + 1) * TILE; y < Math.min(H, (r + 1) * TILE + 3); ++y)
        for (let x = c * TILE; x < (c + 1) * TILE; ++x) {
          if (kindAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 'ground') continue;
          const i = (y * W + x) * 4;
          d[i] *= 0.65; d[i + 1] *= 0.65; d[i + 2] *= 0.7;
        }
    }
    g.putImageData(img, 0, 0);

    // Grass blades / sparkles
    for (let i = 0; i < W * H / 70; ++i) {
      const x = Math.floor(hash2(i, 1, seed + 21) * W), y = Math.floor(hash2(i, 2, seed + 21) * H);
      if (kindAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 'ground') continue;
      px(g, x, y, 1, m.biome === 'meadow' ? 2 : 1, T.blade);
    }

    // Decorations and props, back to front
    const items = [];
    const rng = makeRng(seed * 3 + 1);
    for (let i = 0; i < 95; ++i) {
      const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
      if (kindAt(c, r) !== 'ground') continue;
      items.push({ key: T.decor[Math.floor(rng() * T.decor.length)], x: c * TILE + 2 + rng() * 12, y: r * TILE + 4 + rng() * 11 });
    }
    for (const [key, type] of props) {
      if (feat.has(key)) continue;
      const [c, r] = key.split(',').map(Number);
      const j = hash2(c, r, seed);
      items.push({ key: type === 'tree' ? T.tree : T.boulder, x: c * TILE + 8 + (j - 0.5) * 3, y: r * TILE + 15, big: true });
      if (type === 'tree' && j > 0.5) items.push({ key: T.decor[0], x: c * TILE + 2, y: r * TILE + 15 });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      const art = propArt(it.key);
      if (it.big) {
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath(); g.ellipse(Math.round(it.x), Math.round(it.y), 6, 2.5, 0, 0, TWO_PI); g.fill();
      }
      g.drawImage(art, Math.round(it.x - art.width / 2), Math.round(it.y - art.height + 1));
    }

    // Animation frames for water / lava / ice
    const frames = [];
    if (animated.length) {
      let minX = W, minY = H, maxX = 0, maxY = 0;
      for (let i = 0; i < animated.length; i += 3) {
        minX = Math.min(minX, animated[i]); maxX = Math.max(maxX, animated[i]);
        minY = Math.min(minY, animated[i + 1]); maxY = Math.max(maxY, animated[i + 1]);
      }
      const fw = maxX - minX + 1, fh = maxY - minY + 1;
      for (let f = 0; f < 4; ++f) {
        const fc = makeCanvas(fw, fh);
        const fg = fc.getContext('2d');
        const fi = fg.createImageData(fw, fh);
        const fd = fi.data;
        for (let i = 0; i < animated.length; i += 3) {
          const x = animated[i], y = animated[i + 1], depth = animated[i + 2];
          let col = null;
          if (T.feature === 'lava') {
            const v = fbm(x / 7 + f * 0.25, y / 7 - f * 0.12, seed + 31);
            const crust = fbm(x / 9 - f * 0.18, y / 9 + f * 0.1, seed + 33);
            col = crust > 0.62 ? (crust > 0.7 ? '#2a0e08' : fr[1]) : rampPick(fr, 0.2 + v * 0.75 - depth * 0.1, x, y, 2, 5);
          } else if (T.feature === 'water') {
            const w = Math.sin(x * 0.7 + Math.sin(y * 0.35) * 2 + f * Math.PI / 2) * 0.8 + valueNoise(x / 5, y / 3, seed + 41 + f) * 1.4;
            if (w > 1.75 && depth > 0.15) col = fr[5];
            else if (w > 1.5) col = fr[4];
          } else {
            const w = hash2(x, y, seed + f * 3 + 51);
            if (w > 0.994) col = '#ffffff';
            else if ((x + y * 2 + f * 5) % 23 === 0 && valueNoise(x / 6, y / 6, seed) > 0.6) col = fr[5];
          }
          if (!col) continue;
          const rgb = parseHex(col);
          const j = ((y - minY) * fw + (x - minX)) * 4;
          fd[j] = rgb[0]; fd[j + 1] = rgb[1]; fd[j + 2] = rgb[2]; fd[j + 3] = 255;
        }
        fg.putImageData(fi, 0, 0);
        frames.push(fc);
      }
      frames.x = minX; frames.y = minY;
    }

    // Lava glow points for night-light style flicker
    const lights = [];
    if (T.feature === 'lava')
      for (const [key, type] of feat)
        if (type === 'lava' && hash2(key.length, key.charCodeAt(0) + key.charCodeAt(key.length - 1), seed) > 0.2) {
          const [c, r] = key.split(',').map(Number);
          lights.push({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ph: hash2(c, r, seed) * TWO_PI });
        }

    // Gates
    const gates = [];
    for (const wp of m.paths) {
      const s = wp[0], e = wp[wp.length - 1];
      if (!gates.some(q => q.kind === 'spawn' && q.c === s[0] && q.r === s[1]))
        gates.push({ kind: 'spawn', c: s[0], r: s[1] });
      const exitKind = isEdge(e) ? 'exit' : 'keep';
      if (!gates.some(q => q.kind === exitKind && q.c === e[0] && q.r === e[1]))
        gates.push({ kind: exitKind, c: e[0], r: e[1] });
    }
    return { base: canvas2, frames, lights, gates, biome: m.biome };
  }

  /* ── Drawing the battlefield ground ── */
  function drawTerrain() {
    const t = getTerrain(currentMap);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(t.base, 0, 0, WORLD_W, WORLD_H);
    if (t.frames.length) {
      const f = t.frames[Math.floor(animTime * 5) % 4];
      ctx.drawImage(f, t.frames.x * AP, t.frames.y * AP, f.width * AP, f.height * AP);
    }
    for (const l of t.lights)
      drawGlow('#ff6a1a', l.x, l.y, CELL * 1.1, 0.16 + 0.08 * Math.sin(animTime * 2 + l.ph));
  }

  // Gates are drawn with the actors so enemies appear from inside them
  function drawGates(front) {
    const t = getTerrain(currentMap);
    for (const gt of t.gates) {
      const x = (gt.c + 0.5) * CELL, y = (gt.r + 0.5) * CELL;
      const art = gateArt(gt.kind, t.biome);
      if (gt.kind === 'spawn') {
        if (front) continue;
        blitArt(art, x, y + CELL * 0.5 + 6, false, 1, 1);
        drawGlow('#ff3a5a', x, y + 2, CELL * (0.7 + 0.1 * Math.sin(animTime * 4)), 0.35 + (warningActive ? 0.4 * Math.abs(Math.sin(warningPulse)) : 0));
      } else {
        if (!front) continue;
        const scale = gt.kind === 'keep' ? 1 : 1;
        blitArt(art, x, y + CELL * 0.5 + 4, false, 1, scale);
        // Banners
        const wave = Math.sin(animTime * 4) * 1.5;
        const bx = gt.kind === 'keep' ? [x] : [x - 17 + 1, x + 17 - 1];
        const top = y + CELL * 0.5 + 4 - art.height * AP;
        for (const b of bx) {
          ctx.fillStyle = '#c8303a';
          ctx.beginPath();
          ctx.moveTo(b + 1, top + 1);
          ctx.lineTo(b + 11 + wave, top + 3);
          ctx.lineTo(b + 1, top + 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd75a';
          ctx.fillRect(b + 2, top + 3, 2, 2);
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER ART -- a base that grows with every tier (wood, stone, gold
     trim, family stone, crowned) and a head per family and branch.
     Rotating heads are pre-rendered at 16 angles.
     ══════════════════════════════════════════════════════════════════ */

  const HEAD_ANGLES = 16;
  const ROTATING = { arrow: 1, cannon: 1, flame: 1, laser: 1, sniper: 1 };
  // Tower body height (art px above the tile's top face) per tier
  const BASE_HEIGHT = [0, 1, 2, 3, 4, 5];

  function familyRamp(def) {
    return rampOf(def.color);
  }

  function mixRamp(ramp, hex, t) {
    const [r2, g2, b2] = parseHex(hex);
    return ramp.map(c => {
      const [r, g, b] = parseHex(c.slice(0, 7));
      const m = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
      return '#' + m(r, r2 * (0.4 + (r / 255) * 0.8)) + m(g, g2 * (0.4 + (g / 255) * 0.8)) + m(b, b2 * (0.4 + (b / 255) * 0.8));
    });
  }

  // Base: a 3/4 view tower with a top platform; returns the canvas.
  // The tile footprint is the bottom 16 x 16 of the sprite (2px margin each side).
  //   I wooden scaffold, II stone, III stone with gold trim and a family banner,
  //   IV/V family stone: branch A a slender spire, branch B a heavy bastion
  function buildBase(def, tier, branch) {
    const H = BASE_HEIGHT[tier];
    const W = 20, Ht = 16 + H + 4 + (tier >= 4 && branch === 0 ? 3 : 0);
    const fam = familyRamp(def);
    const round = def.id === 'frost' || def.id === 'tesla' || def.id === 'laser';
    return pixelArt(W, Ht, (g) => {
      const top = 4 + (tier >= 4 && branch === 0 ? 3 : 0);
      const bodyY = top + 8;
      const bodyH = Ht - 4 - bodyY + 1;
      const mat = tier === 1 ? RAMPS.wood : tier <= 3 ? RAMPS.stone : mixRamp(branch === 1 ? RAMPS.metal : RAMPS.stone, def.color, 0.32);
      const gold = RAMPS.gold;
      // Foundation shadow / foot
      ellipseFill(g, 10, Ht - 4, 9, 3.5, mat[1]);
      if (tier === 1) {
        // Wooden scaffold: four posts and cross bracing
        px(g, 3, bodyY, 2, bodyH, mat[1]); px(g, 15, bodyY, 2, bodyH, mat[1]);
        px(g, 7, bodyY, 2, bodyH - 1, mat[2]); px(g, 11, bodyY, 2, bodyH - 1, mat[2]);
        line(g, 4, bodyY + 1, 16, bodyY + bodyH - 1, mat[3], 1);
        line(g, 16, bodyY + 1, 4, bodyY + bodyH - 1, mat[2], 1);
        px(g, 3, bodyY + Math.floor(bodyH / 2), 14, 1, mat[4]);
      } else if (round) {
        px(g, 3, bodyY, 14, bodyH, mat[2]);
        px(g, 3, bodyY, 2, bodyH, mat[3]);
        px(g, 15, bodyY, 2, bodyH, mat[1]);
        ellipseFill(g, 10, bodyY + bodyH, 7, 2.5, mat[2]);
        for (let y = bodyY + 2; y < bodyY + bodyH; y += 3) px(g, 4, y, 12, 1, mat[1]);
      } else {
        px(g, 2, bodyY, 16, bodyH, mat[2]);
        px(g, 2, bodyY, 1, bodyH, mat[3]);
        px(g, 17, bodyY, 1, bodyH, mat[1]);
        for (let y = bodyY + 2; y < bodyY + bodyH; y += 3) {
          px(g, 3, y, 14, 1, mat[1]);
          for (let x = 4 + ((y / 3) % 2 ? 0 : 2); x < 17; x += 4) px(g, x, y - 2, 1, 2, mat[1]);
        }
      }
      // Bastion buttresses / spire pillars
      if (tier >= 4 && branch === 1) {
        block(g, 0, bodyY + 2, 3, bodyH - 2, mat, 3);
        block(g, 17, bodyY + 2, 3, bodyH - 2, mat, 2);
        px(g, 0, bodyY + 2, 3, 1, gold[4]); px(g, 17, bodyY + 2, 3, 1, gold[4]);
      }
      if (tier >= 4 && branch === 0) {
        block(g, 1, top - 1, 3, bodyH + 9, mat, 3);
        block(g, 16, top - 1, 3, bodyH + 9, mat, 2);
        poly(g, [1, top - 1, 2.5, top - 6, 4, top - 1], fam[3]);
        poly(g, [16, top - 1, 17.5, top - 6, 19, top - 1], fam[3]);
      }
      // Trim and banner from tier III
      if (tier >= 3) {
        const x0 = round ? 3 : 2, w0 = round ? 14 : 16;
        px(g, x0, bodyY, w0, 1, gold[3]);
        px(g, x0, bodyY + bodyH - 2, w0, 1, gold[2]);
        const bh = Math.max(4, bodyH - 4);
        poly(g, [8, bodyY + 1, 12, bodyY + 1, 12, bodyY + bh, 10, bodyY + bh - 2, 8, bodyY + bh], fam[2]);
        px(g, 8, bodyY + 1, 1, bh - 1, fam[3]);
        px(g, 9, bodyY + 3, 2, 2, tier >= 4 ? gold[4] : fam[4]);
      }
      if (tier >= 4)
        for (const gx of [4, 15]) { px(g, gx, bodyY + 3, 1, 2, fam[5]); px(g, gx, bodyY + 3, 1, 1, '#ffffff'); }
      // Platform (top face)
      const pm = mat;
      if (round) {
        ellipseFill(g, 10, top + 6, 8, 5, pm[1]);
        ellipseFill(g, 10, top + 5, 8, 4.5, pm[3]);
        ellipseFill(g, 10, top + 5, 5.5, 3, pm[2]);
      } else {
        px(g, 1, top + 1, 18, 9, pm[1]);
        px(g, 1, top, 18, 8, pm[3]);
        px(g, 3, top + 2, 14, 5, pm[2]);
        if (tier === 1) for (let x = 3; x < 17; x += 3) px(g, x, top + 1, 1, 7, pm[1]);
      }
      // Battlements
      if (tier >= 2 && !round) {
        const cap = tier >= 3 ? gold : pm;
        for (const bx of [1, 6, 11, 16]) {
          px(g, bx, top - 2, 3, 3, pm[3]);
          px(g, bx, top - 2, 3, 1, cap[4]);
        }
      }
      if (tier >= 2 && round) {
        const cap = tier >= 3 ? gold : pm;
        px(g, 2, top + 4, 16, 1, cap[4]);
        px(g, 4, top + 9, 12, 1, cap[2]);
      }
      if (tier === 1) {
        // Railing posts
        px(g, 1, top - 1, 1, 3, RAMPS.wood[4]); px(g, 18, top - 1, 1, 3, RAMPS.wood[4]);
      }
      // Crown points and flags on mastered towers
      if (tier >= 5) {
        for (const bx of [3, 9, 15]) poly(g, [bx, top - 2, bx + 1, top - 6, bx + 2, top - 2], gold[4]);
        px(g, 9, top - 4, 1, 1, '#ffffff');
      }
    });
  }

  /* ── Heads ── drawn pointing right around (cx, cy) */
  const HEADS = {
    arrow(g, tier, branch, fam) {
      const wood = tier >= 4 && branch === 0 ? ['#2a4a2a', '#3a6a3a', '#5a8a4a', '#8ab86a', '#c4e8a0', '#eaffd8'] : RAMPS.wood;
      const metal = tier >= 3 ? RAMPS.gold : RAMPS.metal;
      if (tier >= 4 && branch === 1) {
        // Volley: three bolts on a wide frame
        px(g, -4, -6, 6, 12, RAMPS.wood[2]); px(g, -4, -6, 6, 1, RAMPS.wood[4]);
        for (const dy of [-4, 0, 4]) {
          px(g, -2, dy - 0.5, 10, 1, RAMPS.wood[4]);
          px(g, 8, dy - 1, 2, 2, metal[4]);
        }
        line(g, 2, -8, 2, 8, metal[3], 1.5);
        if (tier >= 5) { px(g, -5, -1, 2, 2, fam[4]); }
        return;
      }
      const len = tier >= 4 ? 11 : 7 + tier;
      px(g, -5, -1.5, len, 3, wood[2]); px(g, -5, -1.5, len, 1, wood[4]);
      const span = tier >= 4 ? 9 : 5 + tier;
      g.strokeStyle = wood[3];
      g.lineWidth = 2;
      g.beginPath(); g.arc(-2, 0, span, -1.0, 1.0); g.stroke();
      line(g, -2 + span * Math.cos(1.0), -span * Math.sin(1.0), -2 + span * Math.cos(1.0), span * Math.sin(1.0), '#e8e2d4', 0.8);
      px(g, len - 6, -1, 3, 2, metal[4]);
      poly(g, [len - 3, -2.5, len + 1, 0, len - 3, 2.5], metal[3]);
      if (tier >= 4) { px(g, -4, -0.5, 2, 1, fam[5]); }
    },
    cannon(g, tier, branch, fam) {
      const barrel = tier >= 3 ? ['#3a2008', '#6a400e', '#9a6418', '#c8902a', '#ecbc4a', '#fff0a0'] : RAMPS.iron;
      if (tier >= 4 && branch === 0) {
        // Mortar: short fat tube
        disc(g, 0, 0, 6.5, RAMPS.iron, 3);
        px(g, -1, -5, 9, 10, barrel[2]); px(g, -1, -5, 9, 2, barrel[4]);
        ellipseFill(g, 8, 0, 2.5, 5, barrel[1]); ellipseFill(g, 8, 0, 1.5, 3.5, '#0a0a0a');
        if (tier >= 5) px(g, 2, -5, 1, 10, fam[4]);
        return;
      }
      disc(g, -1, 0, 5, RAMPS.wood, 2);
      const twin = tier >= 4 && branch === 1;
      for (const dy of twin ? [-2.6, 2.6] : [0]) {
        const len = 8 + Math.min(tier, 3) * 1.5;
        const w = twin ? 3.2 : 4 + (tier >= 2 ? 1 : 0);
        px(g, -2, dy - w / 2, len, w, barrel[2]);
        px(g, -2, dy - w / 2, len, 1, barrel[4]);
        px(g, len - 3, dy - w / 2 - 0.8, 2, w + 1.6, barrel[3]);
        px(g, len - 1, dy - w / 2 + 0.6, 1, w - 1.2, '#0a0a0a');
      }
      if (twin) { px(g, 0, -1, 2, 2, fam[4]); for (let i = 0; i < 3; ++i) px(g, -4 + i * 3, 4.5, 1, 2, RAMPS.metal[4]); }
      if (tier >= 2) px(g, 1, -0.5, 2, 1, barrel[5]);
    },
    flame(g, tier, branch, fam) {
      const tank = tier >= 4 && branch === 0 ? ['#3a0a04', '#6a1808', '#a0280a', '#e0500e', '#ff8a2a', '#ffd06a'] : RAMPS.brick;
      if (tier >= 4 && branch === 1) {
        // Dragon head nozzle
        poly(g, [-5, -4, 4, -4, 10, -1.5, 10, 1.5, 4, 4, -5, 4], fam[2]);
        poly(g, [-5, -4, 4, -4, 10, -1.5, 4, -1.5], fam[4]);
        px(g, 3, -3, 2, 1, '#ffe14a');
        poly(g, [-3, -4, -6, -7, -1, -4], fam[1]); poly(g, [-3, 4, -6, 7, -1, 4], fam[1]);
        px(g, 9, -0.5, 2, 1, '#2a0a04');
        if (tier >= 5) { px(g, -2, -1, 2, 2, '#ffe14a'); }
        return;
      }
      disc(g, -2, 0, 5, tank, 3);
      const len = 7 + Math.min(tier, 3) * 1.5;
      px(g, 0, -1.5, len, 3, RAMPS.metal[3]); px(g, 0, -1.5, len, 1, RAMPS.metal[5]);
      px(g, len - 1, -2.5, 2, 5, RAMPS.metal[2]);
      if (tier >= 3) for (let i = 2; i < len - 2; i += 2) px(g, i, -2.5, 1, 5, RAMPS.gold[3]);
      if (tier >= 4) disc(g, -2, 0, 3, ['#4a0a00', '#8a1a00', '#ff4a00', '#ffa020', '#ffe080', '#ffffff'], 3);
    },
    laser(g, tier, branch, fam) {
      if (tier >= 4 && branch === 0) {
        // Prism
        poly(g, [-5, -6, 6, 0, -5, 6], fam[2]);
        poly(g, [-5, -6, 6, 0, -1, 0], fam[4]);
        poly(g, [-5, 6, 6, 0, -1, 0], fam[1]);
        px(g, -1, -1, 2, 2, '#ffffff');
        if (tier >= 5) for (const a of [-2.2, 2.2, 0]) px(g, Math.cos(a) * 7 - 1, Math.sin(a) * 7 - 1, 2, 2, fam[5]);
        return;
      }
      if (tier >= 4 && branch === 1) {
        // Solar lance: mirror dish
        g.fillStyle = RAMPS.gold[2];
        g.beginPath(); g.arc(-3, 0, 7, -1.2, 1.2); g.lineTo(-3, 0); g.fill();
        g.fillStyle = RAMPS.gold[4];
        g.beginPath(); g.arc(-3, 0, 5, -1.1, 1.1); g.lineTo(-3, 0); g.fill();
        px(g, -3, -0.5, 10, 1, RAMPS.metal[4]);
        disc(g, 7, 0, 2, ['#5a3a00', '#a06a00', '#ffb000', '#ffe060', '#fff6c0', '#ffffff'], 3);
        return;
      }
      disc(g, -2, 0, 4.5, RAMPS.metal, 3);
      const len = 6 + Math.min(tier, 3) * 1.5;
      px(g, 0, -1.5, len, 3, RAMPS.metal[2]); px(g, 0, -1.5, len, 1, RAMPS.metal[4]);
      px(g, len - 1, -2, 2, 4, tier >= 3 ? RAMPS.gold[3] : RAMPS.metal[3]);
      disc(g, -2, 0, 2.2, fam, 3);
    },
    sniper(g, tier, branch, fam) {
      if (tier >= 4 && branch === 0) {
        // Railgun: twin rails with a glowing core
        px(g, -6, -3.5, 8, 7, RAMPS.metal[2]); px(g, -6, -3.5, 8, 1, RAMPS.metal[4]);
        px(g, 0, -3, 13, 2, RAMPS.metal[3]); px(g, 0, 1, 13, 2, RAMPS.metal[3]);
        px(g, 1, -1, 11, 2, '#7ad8ff');
        if (tier >= 5) px(g, -4, -1, 3, 2, '#ffffff');
        return;
      }
      const dark = tier >= 4 && branch === 1;
      const body = dark ? ['#08080c', '#121218', '#1e1e28', '#2c2c3a', '#404052', '#5a5a70'] : RAMPS.metal;
      px(g, -6, -2, 6, 4, dark ? body[3] : RAMPS.wood[2]);
      const len = 10 + Math.min(tier, 3) * 1.5 + (dark ? 2 : 0);
      px(g, -1, -1, len, 2, body[2]); px(g, -1, -1, len, 1, body[4]);
      px(g, 1, -3, 5, 2, body[3]); px(g, 1, -3, 1, 2, dark ? '#ff3a3a' : '#7ad8ff');
      if (tier >= 3) px(g, len - 3, -1.5, 2, 3, RAMPS.gold[3]);
      if (dark) px(g, len - 2, -1.5, 3, 3, body[1]);
    }
  };

  // Static heads (not rotating) of the other families
  const STATIC_HEADS = {
    frost(g, tier, branch, fam) {
      const ice = RAMPS.ice;
      if (tier >= 4 && branch === 1) {
        disc(g, 0, 0, 6, ice, 3);
        g.strokeStyle = ice[5]; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, 1, 9, 3, 0, 0, TWO_PI); g.stroke();
        px(g, -2, -3, 2, 2, '#ffffff');
        return;
      }
      const big = tier >= 4 ? 1.35 : 0.75 + tier * 0.12;
      poly(g, [0, -9 * big, 4 * big, -2, 0, 6 * big, -4 * big, -2], ice[3]);
      poly(g, [0, -9 * big, 0, 6 * big, -4 * big, -2], ice[4]);
      px(g, -1, -5 * big, 1, 4, '#ffffff');
      if (tier >= 2) { poly(g, [-6, 2, -4, -3, -3, 3], ice[2]); poly(g, [6, 2, 4, -3, 3, 3], ice[2]); }
      if (tier >= 4) { poly(g, [-7, -4, -5, -8, -4, -3], ice[4]); poly(g, [7, -4, 5, -8, 4, -3], ice[4]); }
    },
    tesla(g, tier, branch, fam) {
      const cu = ['#3a1a08', '#6a3010', '#9a4c1c', '#c8702e', '#e8984a', '#ffc884'];
      if (tier >= 4 && branch === 0) {
        for (const dx of [-5, 0, 5]) {
          px(g, dx - 1, -6 + (dx === 0 ? -3 : 0), 2, 12, RAMPS.metal[3]);
          disc(g, dx, -7 + (dx === 0 ? -3 : 0), 2, fam, 3);
        }
        return;
      }
      const h = 6 + Math.min(tier, 4) * 1.5;
      px(g, -1.5, -h + 4, 3, h, RAMPS.metal[3]);
      for (let i = 0; i < Math.min(tier, 3) + 1; ++i) ellipseFill(g, 0, 2 - i * 3, 4 - i * 0.4, 1.2, cu[3 + (i % 2)]);
      const r = tier >= 4 ? 4.5 : 2.5 + tier * 0.4;
      disc(g, 0, -h + 3, r, tier >= 4 ? fam : RAMPS.metal, 3);
      if (tier >= 4) { g.strokeStyle = RAMPS.gold[3]; g.lineWidth = 1; g.strokeRect(-r, -h + 3 - r, r * 2, r * 2); }
    },
    poison(g, tier, branch, fam) {
      const pot = tier >= 4 && branch === 0 ? RAMPS.iron : tier >= 4 ? ['#203028', '#2e4a3a', '#3e6a50', '#5a9070', '#8ac0a0', '#c8f0d8'] : RAMPS.iron;
      const w = 6 + Math.min(tier, 3) * 0.6;
      ellipseFill(g, 0, 1, w, 5, pot[2]);
      ellipseFill(g, -1.5, 0, w - 2, 3.5, pot[3]);
      ellipseFill(g, 0, -3, w - 0.5, 2, '#22501a');
      ellipseFill(g, 0, -3.2, w - 1.5, 1.4, tier >= 4 && branch === 1 ? '#c8ff4a' : '#7ce35a');
      if (tier >= 2) { px(g, -w - 1, -3, 2, 3, pot[1]); px(g, w - 1, -3, 2, 3, pot[1]); }
      if (tier >= 4 && branch === 0) { px(g, -2, 1, 4, 3, '#e8e2d4'); px(g, -1, 2, 1, 1, '#000'); px(g, 1, 2, 1, 1, '#000'); }
      if (tier >= 3) px(g, -w + 1, 3, w * 2 - 2, 1, RAMPS.gold[3]);
    }
  };

  const towerArtCache = {};

  function towerArt(typeIndex, tier, branch) {
    const key = typeIndex + ':' + tier + ':' + branch;
    let a = towerArtCache[key];
    if (a) return a;
    const def = TOWER_TYPES[typeIndex];
    const fam = familyRamp(def);
    a = { base: null, heads: null, head: null, lift: 0, kind: 'tower' };
    if (def.trap) {
      a.kind = 'trap';
      a.base = buildTrap(def, tier, branch);
    } else if (def.kind === 'mine') {
      a.kind = 'mine';
      a.base = buildMine(def, tier, branch);
    } else {
      a.base = buildBase(def, tier, branch);
      a.lift = a.base.height - 10;   // platform centre above the sprite bottom (art px)
      if (ROTATING[def.id]) {
        a.heads = [];
        for (let i = 0; i < HEAD_ANGLES; ++i) {
          const ang = (i / HEAD_ANGLES) * TWO_PI;
          a.heads.push(pixelArt(26, 26, (g) => {
            g.translate(13, 13);
            g.rotate(ang);
            const k = 1 + (tier - 1) * 0.07;
            g.scale(k, k);
            HEADS[def.id](g, tier, branch, fam);
          }));
        }
      } else if (STATIC_HEADS[def.id]) {
        a.head = pixelArt(22, 22, (g) => {
          g.translate(11, 13);
          const k = 1 + (tier - 1) * 0.06;
          g.scale(k, k);
          STATIC_HEADS[def.id](g, tier, branch, fam);
        });
      }
    }
    towerArtCache[key] = a;
    return a;
  }

  function buildTrap(def, tier, branch) {
    return pixelArt(16, 16, (g) => {
      if (tier >= 4 && branch === 0) {
        ellipseFill(g, 8, 8, 7.5, 6.5, '#0a0806');
        ellipseFill(g, 7, 7, 5.5, 4.5, '#1e1810');
        px(g, 4, 5, 3, 1, '#3a3020'); px(g, 9, 9, 2, 1, '#3a3020');
        return;
      }
      const plate = tier === 1 ? RAMPS.wood : RAMPS.metal;
      px(g, 1, 2, 14, 12, plate[1]); px(g, 1, 2, 14, 1, plate[3]);
      if (tier >= 4) {
        // Razor: two saw blades in slots
        px(g, 2, 5, 12, 2, '#0a0a0a'); px(g, 2, 10, 12, 2, '#0a0a0a');
        return;
      }
      const n = tier === 1 ? 2 : 3;
      for (let i = 0; i < n; ++i)
        for (let j = 0; j < n; ++j) {
          const x = 2 + (i + 0.5) * (12 / n), y = 3 + (j + 0.5) * (10 / n);
          poly(g, [x - 1.5, y + 1.5, x, y - 2.5, x + 1.5, y + 1.5], tier >= 3 ? RAMPS.gold[4] : RAMPS.metal[5]);
          px(g, x, y - 1, 0.5, 2, '#ffffff');
        }
    });
  }

  function buildMine(def, tier, branch) {
    return pixelArt(22, 26, (g) => {
      const W = RAMPS.wood, S = RAMPS.stone;
      if (tier >= 4 && branch === 0) {
        // Bank: marble hall with columns
        const M = RAMPS.marble;
        px(g, 1, 12, 20, 12, M[2]);
        poly(g, [0, 12, 11, 4, 22, 12], M[3]);
        poly(g, [3, 11, 11, 6, 19, 11], M[1]);
        for (const x of [3, 8, 13, 17]) { px(g, x, 13, 2, 10, M[4]); px(g, x + 1, 13, 1, 10, M[2]); }
        px(g, 1, 23, 20, 2, M[1]);
        disc(g, 11, 9, 2, RAMPS.gold, 3);
        if (tier >= 5) { px(g, 10, 1, 2, 4, RAMPS.gold[4]); }
        return;
      }
      if (tier >= 4 && branch === 1) {
        // Alchemist: round tower with a bubbling flask
        px(g, 4, 8, 14, 16, S[2]); px(g, 4, 8, 2, 16, S[3]);
        poly(g, [3, 9, 11, 1, 19, 9], '#5a2a6a'); poly(g, [3, 9, 11, 1, 11, 9], '#7a4a8a');
        ellipseFill(g, 11, 17, 4, 4, '#7ce35a'); px(g, 10, 11, 2, 3, RAMPS.ice[4]);
        px(g, 9, 15, 1, 1, '#ffffff');
        px(g, 6, 22, 10, 2, S[1]);
        return;
      }
      // Mine shaft: timber frame in a rock face, cart of gold
      disc(g, 11, 13, 10, S, 2 + (tier >= 3 ? 1 : 0));
      px(g, 6, 9, 10, 13, '#120a06');
      px(g, 5, 8, 12, 2, W[3]); px(g, 5, 8, 2, 14, W[2]); px(g, 15, 8, 2, 14, W[2]);
      px(g, 2, 21, 18, 1, RAMPS.metal[3]);
      px(g, 3, 17, 7, 4, W[2]); px(g, 3, 17, 7, 1, W[4]);
      px(g, 4, 15, 5, 2, RAMPS.gold[4]); px(g, 5, 14, 2, 1, RAMPS.gold[5]);
      if (tier >= 2) { px(g, 13, 19, 6, 3, RAMPS.gold[3]); px(g, 14, 18, 3, 1, RAMPS.gold[5]); }
      if (tier >= 3) { px(g, 10, 4, 2, 4, W[3]); px(g, 8, 3, 6, 2, RAMPS.gold[3]); }
    });
  }

  /* ── Drawing a tower in the world ── */
  function headIndex(angle) {
    const a = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    return Math.round(a / TWO_PI * HEAD_ANGLES) % HEAD_ANGLES;
  }

  function drawTowerSprite(t, x, y, alpha) {
    const def = TOWER_TYPES[t.type];
    const a = towerArt(t.type, t.tier, t.branch);
    const bottom = y + CELL / 2;
    if (a.kind === 'trap') {
      blitArt(a.base, x, bottom, false, alpha);
      if (t.tier >= 4 && t.branch === 1) {
        // Spinning saw blades
        for (const dy of [-5, 5]) {
          ctx.save();
          ctx.translate(x, y + dy - 1);
          ctx.rotate(animTime * 14 * (dy < 0 ? 1 : -1));
          ctx.fillStyle = '#c4ccdc';
          ctx.beginPath();
          for (let i = 0; i < 8; ++i) {
            const ang = i / 8 * TWO_PI;
            ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 3);
            ctx.lineTo(Math.cos(ang + 0.4) * 4, Math.sin(ang + 0.4) * 2);
          }
          ctx.fill();
          ctx.restore();
        }
      } else if (t.tier >= 4) {
        // Tar bubbles
        const ph = (animTime * 1.5 + t.col) % 1;
        ctx.fillStyle = `rgba(80,70,50,${1 - ph})`;
        ctx.beginPath(); ctx.arc(x - 4 + t.row % 3 * 3, y - ph * 3, 1 + ph * 2, 0, TWO_PI); ctx.fill();
      }
      return;
    }
    drawShadow(x, bottom - 3, 14, 5, 0.9);
    if (t.hurtFlash > 0) ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(animTime * 60);
    blitArt(a.base, x, bottom + 2, false, alpha);
    if (t.hurtFlash > 0) ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    if (a.kind === 'mine') {
      // Glinting gold
      if ((animTime * 0.7 + t.col * 0.3) % 2 < 0.15)
        drawGlow('#ffe14a', x - 6, y + 6, 6, 0.8);
      return;
    }
    const hx = x, hy = bottom + 2 - a.lift * AP - 2;
    if (a.heads) {
      const rec = (t.recoil || 0) * 2.5;
      const ox = -Math.cos(t.angle) * rec, oy = -Math.sin(t.angle) * rec;
      blitPivot(a.heads[headIndex(t.angle)], hx + ox, hy + oy, 14, 14, alpha);
    } else if (a.head) {
      const bob = def.id === 'frost' ? Math.sin(animTime * 2.4 + t.col) * 1.6 - 4 : 0;
      if (def.id === 'frost') drawGlow('#9ae4ff', hx, hy + bob - 4, 14 + t.tier * 2, 0.35);
      blitPivot(a.head, hx, hy + bob, 12, 14, alpha);
    }
  }

  function blitPivot(img, x, y, pxA, pyA, alpha) {
    const pa = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = pa * alpha;
    ctx.drawImage(img, x - pxA * AP, y - pyA * AP, img.width * AP, img.height * AP);
    ctx.globalAlpha = pa;
  }

  // Muzzle position of a tower (world units)
  function muzzleOf(t) {
    const a = towerArt(t.type, t.tier, t.branch);
    const hy = t.y + CELL / 2 + 2 - a.lift * AP - 2;
    const def = TOWER_TYPES[t.type];
    if (!a.heads)
      return { x: t.x, y: hy - (def.id === 'tesla' ? 12 + t.tier * 2 : def.id === 'frost' ? 6 : 2) };
    const len = def.id === 'sniper' ? 26 : def.id === 'cannon' ? 20 : def.id === 'arrow' ? 18 : 18;
    return { x: t.x + Math.cos(t.angle) * len, y: hy + Math.sin(t.angle) * len };
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMY ART -- side-view pixel sprites facing right, four animation
     frames each (walk cycles, wing beats, squishing slimes)
     ══════════════════════════════════════════════════════════════════ */

  const FRAMES = 4;
  const LEG = [0, 1, 0, -1];      // leg swing per frame
  const BOB = [0, -1, 0, -1];     // body bob per frame

  // Generic biped: legs, body, arms, head; p = palette, s = size factor
  function biped(g, f, p, o) {
    o = o || {};
    const w = o.w || 8, h = o.h || 6;
    const bx = o.x || 2, by = (o.y || 4) + BOB[f];
    const legH = o.legH || 4;
    const footY = by + h + legH;
    // Legs
    px(g, bx + 1 + LEG[f], by + h, 2, legH, p.leg);
    px(g, bx + w - 3 - LEG[f], by + h, 2, legH, shade(p.leg, -0.25));
    px(g, bx + LEG[f], footY - 1, 3, 1, p.foot || shade(p.leg, -0.4));
    px(g, bx + w - 3 - LEG[f], footY - 1, 3, 1, p.foot || shade(p.leg, -0.4));
    // Body
    block(g, bx, by, w, h, rampOf(p.body), 3);
    if (p.belt) px(g, bx, by + h - 2, w, 1, p.belt);
    // Back arm
    px(g, bx - 1 - LEG[f], by + 1, 2, h - 1, shade(p.skin, -0.3));
    // Head
    const hs = o.head || 5;
    const hx = bx + Math.floor((w - hs) / 2) + 1, hy = by - hs + 1;
    block(g, hx, hy, hs, hs, rampOf(p.skin), 3);
    px(g, hx + hs - 2, hy + 2, 1, 1, p.eye || '#1a0a0a');
    if (p.helm) { px(g, hx - 1, hy - 1, hs + 2, 2, p.helm); px(g, hx - 1, hy - 1, hs + 2, 1, shade(p.helm, 0.35)); }
    // Front arm with weapon
    const ax = bx + w - 1 + LEG[f], ay = by + 1;
    px(g, ax, ay, 2, h - 2, p.skin);
    if (o.weapon) o.weapon(g, ax + 1, ay + h - 3, f);
    return { hx, hy, hs, bx, by, w, h, footY };
  }

  const ENEMY_ART = {
    normal: [14, 18, (g, f) => {
      biped(g, f, { body: '#8a4a2a', leg: '#4a3a2a', skin: '#6ab04a', helm: '#7a7a8a', belt: '#3a2010', eye: '#ff3a1a' }, { x: 3, y: 6, w: 8, h: 6, legH: 5,
        weapon: (g, x, y) => { px(g, x, y - 6, 2, 7, RAMPS.wood[3]); px(g, x - 1, y - 8, 4, 3, RAMPS.wood[4]); } });
    }],
    fast: [18, 12, (g, f) => {
      // Wolf: long body, four running legs
      const c = ['#2a2420', '#463c34', '#625448', '#80705e', '#a08c76', '#c4b09a'];
      const b = BOB[f];
      const leg = [[0, 2], [2, 0], [0, -2], [-2, 0]][f];
      px(g, 3 + leg[0], 7 + b, 2, 4, c[1]); px(g, 6 - leg[0], 7 + b, 2, 4, c[2]);
      px(g, 11 + leg[1], 7 + b, 2, 4, c[1]); px(g, 14 - leg[1], 7 + b, 2, 4, c[2]);
      block(g, 2, 3 + b, 14, 5, c, 3);
      px(g, 4, 3 + b, 10, 1, c[4]);
      poly(g, [14, 2 + b, 18, 4 + b, 18, 6 + b, 14, 7 + b], c[3]);
      poly(g, [14, 1 + b, 15, -1 + b, 16, 2 + b], c[2]);
      px(g, 16, 4 + b, 1, 1, '#ffd84a');
      poly(g, [2, 4 + b, -1, 2 + b + (f % 2), 0, 5 + b], c[3]);
    }],
    swarm: [12, 8, (g, f) => {
      // Beetle
      for (let i = 0; i < 3; ++i) px(g, 2 + i * 3 + (f % 2 ? 1 : -1) * (i % 2 ? 1 : -1) * 0.5, 6, 1, 2, '#3a1a08');
      ellipseFill(g, 6, 4, 5.5, 3.5, '#a85a10');
      ellipseFill(g, 5.5, 3.2, 4.5, 2.4, '#ffb03a');
      px(g, 6, 1, 1, 6, '#6a3008');
      px(g, 10, 3, 2, 2, '#2a1406'); px(g, 11, 3, 1, 1, '#ff3a1a');
      px(g, 3, 2, 2, 1, '#ffe08a');
    }],
    flying: [16, 12, (g, f) => {
      // Bat
      const c = ['#1e1428', '#2e1e40', '#46305e', '#624680', '#8064a4', '#a888cc'];
      const up = [-4, -1, 3, -1][f];
      poly(g, [8, 6, 0, 6 + up, 2, 9 + up * 0.3, 5, 8], c[2]);
      poly(g, [8, 6, 16, 6 + up, 14, 9 + up * 0.3, 11, 8], c[3]);
      ellipseFill(g, 8, 7, 3, 3.5, c[3]);
      poly(g, [6, 4, 7, 1, 8, 4], c[2]); poly(g, [9, 4, 10, 1, 11, 4], c[2]);
      px(g, 7, 6, 1, 1, '#ff3a3a'); px(g, 9, 6, 1, 1, '#ff3a3a');
    }],
    armored: [20, 22, (g, f) => {
      const r = biped(g, f, { body: '#5a6474', leg: '#3a4048', skin: '#9a8a6a', helm: '#8c98b0', belt: '#c99a2a', eye: '#ff5a1a' }, { x: 4, y: 8, w: 12, h: 8, legH: 5, head: 6,
        weapon: (g, x, y) => { px(g, x, y - 9, 2, 10, RAMPS.wood[2]); block(g, x - 2, y - 12, 6, 4, RAMPS.metal, 3); } });
      // Shoulder plates and horns
      block(g, r.bx - 2, r.by - 1, 4, 3, RAMPS.metal, 4);
      block(g, r.bx + r.w - 2, r.by - 1, 4, 3, RAMPS.metal, 4);
      poly(g, [r.hx - 1, r.hy, r.hx - 3, r.hy - 4, r.hx + 1, r.hy - 1], '#e8e2d4');
      poly(g, [r.hx + r.hs + 1, r.hy, r.hx + r.hs + 3, r.hy - 4, r.hx + r.hs - 1, r.hy - 1], '#e8e2d4');
      for (let i = 0; i < 3; ++i) px(g, r.bx + 2 + i * 3, r.by + 2, 2, 2, RAMPS.metal[5]);
    }],
    splitter: [16, 13, (g, f) => {
      const c = ['#0e4a3a', '#167058', '#24967a', '#3ab898', '#5ae0b4', '#aaffe4'];
      const sq = [0, 1, 0, -1][f];
      ellipseFill(g, 8, 8 + sq * 0.5, 7.5 + sq, 5 - sq * 0.6, c[2]);
      ellipseFill(g, 7, 7 + sq * 0.5, 6 + sq, 3.8 - sq * 0.5, c[3]);
      px(g, 4, 5, 3, 1, c[5]);
      px(g, 9, 6, 2, 2, '#ffffff'); px(g, 12, 6, 2, 2, '#ffffff'); px(g, 10, 7, 1, 1, '#0a2a20'); px(g, 13, 7, 1, 1, '#0a2a20');
      px(g, 6, 9, 1, 1, c[5]); px(g, 11, 10, 1, 1, c[1]);
    }],
    slimelet: [10, 8, (g, f) => {
      const c = ['#167058', '#24967a', '#3ab898', '#5ae0b4', '#8ff0d0', '#d4fff0'];
      const sq = [0, 1, 0, -1][f];
      ellipseFill(g, 5, 5 + sq * 0.4, 4.5 + sq * 0.6, 3 - sq * 0.4, c[2]);
      ellipseFill(g, 4.5, 4.5, 3.5, 2, c[4]);
      px(g, 6, 4, 1, 1, '#0a2a20'); px(g, 8, 4, 1, 1, '#0a2a20');
    }],
    healer: [14, 19, (g, f) => {
      const r = biped(g, f, { body: '#2e7a3a', leg: '#1e4a26', skin: '#b8a07a', belt: '#c99a2a', eye: '#3a1a0a' }, { x: 3, y: 8, w: 8, h: 7, legH: 4 });
      poly(g, [r.hx - 1, r.hy + 1, r.hx + r.hs / 2, r.hy - 4, r.hx + r.hs + 1, r.hy + 1], '#1e5a2a');
      px(g, r.bx + r.w + 1, r.by - 5, 1, 13, RAMPS.wood[3]);
      disc(g, r.bx + r.w + 1.5, r.by - 6, 2, ['#0a4a1a', '#1a7a2a', '#3ab84a', '#6aff8a', '#b8ffc8', '#ffffff'], 3);
    }],
    stealth: [14, 18, (g, f) => {
      const c = ['#1a1028', '#2a1a40', '#3e2a5a', '#5a4080', '#7a5aa8', '#a888d0'];
      const sway = [0, 1, 0, -1][f];
      poly(g, [3, 6, 11, 6, 12 + sway, 17, 8, 15, 5, 18 + sway, 2, 15], c[2]);
      poly(g, [3, 6, 7, 6, 6, 16, 2, 15], c[3]);
      ellipseFill(g, 7, 5, 4.5, 4.5, c[2]);
      ellipseFill(g, 7.5, 5.5, 2.8, 2.6, '#06030c');
      px(g, 8, 5, 1, 1, '#c8a0ff'); px(g, 10, 5, 1, 1, '#c8a0ff');
      px(g, 11, 9, 3, 1, c[4]);
    }],
    shield: [18, 20, (g, f) => {
      const r = biped(g, f, { body: '#3a5a9a', leg: '#2a3a5a', skin: '#c8a888', helm: '#a8b4c8', belt: '#c99a2a' }, { x: 3, y: 7, w: 9, h: 7, legH: 5 });
      // Tower shield in front
      block(g, r.bx + r.w, r.by - 3, 5, 13, ['#1a3a6a', '#24508a', '#3a6ab0', '#5a8ad0', '#8ab0ec', '#c4dcff'], 3);
      px(g, r.bx + r.w + 2, r.by, 1, 7, RAMPS.gold[4]); px(g, r.bx + r.w + 1, r.by + 3, 3, 1, RAMPS.gold[4]);
      px(g, r.hx, r.hy + 2, r.hs, 1, '#1a1a2a');
    }],
    drake: [24, 22, (g, f) => {
      g.translate(0, 6);
      const c = ['#4a0e06', '#7a1a0a', '#a82a12', '#d0441e', '#f06a3a', '#ff9a6a'];
      const up = [-5, -1, 4, -1][f];
      poly(g, [9, 7, 3, 7 + up - 2, 5, 3 + up, 13, 6], c[2]);
      ellipseFill(g, 11, 9, 7, 3.5, c[3]);
      px(g, 6, 8, 10, 1, c[5]);
      poly(g, [4, 9, -1, 7 + (f % 2), 0, 11], c[2]);
      poly(g, [16, 7, 22, 6, 23, 9, 17, 11], c[3]);
      px(g, 20, 7, 1, 1, '#ffe14a');
      poly(g, [12, 7, 18, 7 + up - 3, 19, 3 + up, 14, 6], c[4]);
      px(g, 9, 12, 2, 2, c[1]); px(g, 13, 12, 2, 2, c[1]);
    }],
    golem: [24, 26, (g, f) => {
      const c = ['#2a1e14', '#463424', '#644c36', '#82664a', '#a2845e', '#c8a87a'];
      const b = BOB[f];
      px(g, 6 + LEG[f], 18 + b, 5, 8 - b, c[2]); px(g, 14 - LEG[f], 18 + b, 5, 8 - b, c[1]);
      block(g, 3, 6 + b, 18, 13, c, 3);
      block(g, 7, 1 + b, 10, 7, c, 4);
      px(g, 9, 3 + b, 2, 2, '#ffb03a'); px(g, 13, 3 + b, 2, 2, '#ffb03a');
      block(g, 0 - LEG[f], 7 + b, 5, 11, c, 2); block(g, 19 + LEG[f], 7 + b, 5, 11, c, 2);
      disc(g, 12, 12 + b, 3, ['#5a1a00', '#a03a00', '#ff6a00', '#ffa83a', '#ffe08a', '#ffffff'], 3);
      px(g, 5, 9 + b, 3, 1, c[1]); px(g, 15, 15 + b, 4, 1, c[1]);
    }],
    skeleton: [13, 17, (g, f) => {
      const B = RAMPS.bone;
      const by = 6 + BOB[f];
      px(g, 4 + LEG[f], by + 6, 1, 5, B[3]); px(g, 8 - LEG[f], by + 6, 1, 5, B[2]);
      for (let i = 0; i < 3; ++i) px(g, 4, by + 1 + i * 2, 5, 1, B[4]);
      px(g, 6, by, 1, 6, B[3]);
      block(g, 4, by - 5, 5, 5, B, 4);
      px(g, 5, by - 3, 1, 1, '#1a0a0a'); px(g, 7, by - 3, 1, 1, '#1a0a0a');
      px(g, 9 + LEG[f], by + 1, 1, 4, B[3]); px(g, 10 + LEG[f], by - 3, 1, 7, RAMPS.metal[4]);
    }],
    boss: [30, 32, (g, f) => {
      // Warlord: huge orc with a cape and an axe
      const b = BOB[f];
      poly(g, [6, 10 + b, 2, 30, 14, 28], '#8a1a1a');
      const r = biped(g, f, { body: '#5a3a3a', leg: '#3a2a22', skin: '#5a9a3a', helm: '#3a3a44', belt: '#c99a2a', eye: '#ff2a1a' }, { x: 7, y: 12, w: 14, h: 10, legH: 7, head: 8,
        weapon: (g, x, y) => {
          px(g, x, y - 14, 2, 17, RAMPS.wood[2]);
          poly(g, [x + 2, y - 15, x + 9, y - 13, x + 9, y - 6, x + 2, y - 8], RAMPS.metal[4]);
          px(g, x + 8, y - 13, 1, 7, RAMPS.metal[5]);
        } });
      poly(g, [r.hx - 1, r.hy + 1, r.hx - 5, r.hy - 6, r.hx + 2, r.hy - 1], '#f6f2e2');
      poly(g, [r.hx + r.hs + 1, r.hy + 1, r.hx + r.hs + 5, r.hy - 6, r.hx + r.hs - 2, r.hy - 1], '#f6f2e2');
      block(g, r.bx - 3, r.by - 2, 6, 4, RAMPS.gold, 3); block(g, r.bx + r.w - 3, r.by - 2, 6, 4, RAMPS.gold, 3);
      px(g, r.hx + 1, r.hy + r.hs - 2, r.hs - 2, 1, '#e8e2d4');
    }],
    dragon: [40, 34, (g, f) => {
      g.translate(0, 9);
      const c = ['#3a0804', '#6a1208', '#9a1e0e', '#c8301a', '#ee5030', '#ff8a5a'];
      const up = [-8, -2, 6, -2][f];
      poly(g, [14, 10, 4, 10 + up - 4, 8, 3 + up, 22, 9], c[2]);
      for (let i = 0; i < 3; ++i) line(g, 14, 10, 6 + i * 4, 6 + up - 2 + i, c[1], 1);
      ellipseFill(g, 18, 14, 11, 5.5, c[3]);
      px(g, 10, 13, 16, 2, '#ffb07a');
      poly(g, [8, 14, 0, 10 + (f % 2) * 2, 1, 17, 8, 17], c[2]);
      poly(g, [27, 10, 36, 8, 39, 12, 36, 15, 28, 15], c[3]);
      poly(g, [30, 9, 31, 4, 33, 9], '#e8e2d4');
      px(g, 35, 10, 2, 1, '#ffe14a');
      px(g, 37, 13, 2, 1, '#3a0804');
      for (let i = 0; i < 5; ++i) poly(g, [12 + i * 3, 9, 13 + i * 3, 6, 14 + i * 3, 9], c[1]);
      poly(g, [20, 10, 32, 10 + up - 5, 34, 3 + up, 26, 9], c[4]);
      px(g, 14, 18, 3, 3, c[1]); px(g, 21, 18, 3, 3, c[1]);
    }],
    lich: [24, 32, (g, f) => {
      const c = ['#0a0810', '#16121e', '#241e30', '#342c44', '#4a3e5e', '#6a5a80'];
      const fl = [0, 1, 2, 1][f];
      poly(g, [6, 10, 18, 10, 21, 28 - fl, 16, 25, 12, 30 + fl, 8, 25, 3, 28 - fl], c[2]);
      poly(g, [6, 10, 11, 10, 9, 27, 4, 27], c[3]);
      px(g, 6, 16, 12, 1, RAMPS.gold[3]);
      block(g, 8, 3, 8, 8, RAMPS.bone, 3);
      px(g, 9, 6, 2, 2, '#4aff9a'); px(g, 13, 6, 2, 2, '#4aff9a');
      px(g, 10, 9, 4, 1, '#2a2418');
      for (let i = 0; i < 4; ++i) poly(g, [7 + i * 3, 3, 8 + i * 3, -1 - (i % 2), 9 + i * 3, 3], RAMPS.gold[4]);
      px(g, 20, 4, 1, 22, RAMPS.wood[2]);
      disc(g, 20.5, 3, 2.5, ['#003a1a', '#006a2a', '#1aaa4a', '#4aff9a', '#aaffcc', '#ffffff'], 3);
      px(g, 18, 12, 3, 2, RAMPS.bone[4]);
    }]
  };

  const enemyArtCache = {};
  function enemyFrames(type) {
    let fr = enemyArtCache[type];
    if (!fr) {
      const [w, h, fn] = ENEMY_ART[type] || ENEMY_ART.normal;
      fr = enemyArtCache[type] = [];
      for (let f = 0; f < FRAMES; ++f)
        fr.push(pixelArt(w, h, (g) => fn(g, f)));
    }
    return fr;
  }

  // On-screen size: sprites scale with the enemy's collision radius
  function enemyScale(e) {
    const def = ENEMY_TYPES[e.type];
    return e.radius / def.radius;
  }

  function enemyFrame(e) {
    const fr = enemyFrames(e.type);
    const def = ENEMY_TYPES[e.type];
    const speed = def.flying ? 9 : 1;
    return fr[Math.floor((def.flying ? animTime * speed + e.walk * 0.05 : e.walk * 0.5)) % FRAMES];
  }

  /* ══════════════════════════════════════════════════════════════════
     BATTLEFIELD RENDERING -- terrain, actors sorted by depth, shots,
     effects and the ambient weather of each biome
     ══════════════════════════════════════════════════════════════════ */

  let corpses = [];             // dying enemies fading out

  function drawWorld() {
    setWorldTransform();
    // Frame around the battlefield
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-6, -4, WORLD_W + 12, WORLD_H + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    drawTerrain();
    const live = state !== STATE_READY && state !== STATE_MAP_SELECT && state !== STATE_RESEARCH;
    if (live) {
      drawRoadHints();
      drawDecals();
      drawFloorEffects();
      drawTraps();
      drawClouds();
    }
    drawGates(false);
    if (live) {
      drawMapOverlays();
      drawActors();
      drawCorpses();
      drawProjectiles();
      drawFxLines();
    }
    drawGates(true);
    drawAmbient();
    if (live) {
      drawParticles();
      drawTexts();
      drawPreWaveWarning();
    }
    drawWorldVignette();
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = 'rgba(255,215,90,0.4)';
    ctx.lineWidth = 2 / view.s;
    ctx.strokeRect(-1, -1, WORLD_W + 2, WORLD_H + 2);
  }

  let worldVignette = null;
  function drawWorldVignette() {
    if (!worldVignette) {
      worldVignette = makeCanvas(200, 136);
      const g = worldVignette.getContext('2d');
      const grad = g.createRadialGradient(100, 68, 50, 100, 68, 130);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 200, 136);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(worldVignette, 0, 0, WORLD_W, WORLD_H);
    ctx.imageSmoothingEnabled = false;
  }

  /* ── Subtle marching chevrons along the roads while building ── */
  function drawRoadHints() {
    const a = state === STATE_BUILD ? 0.28 : 0.1;
    const tmp = { x: 0, y: 0, angle: 0 };
    const shift = (animTime * 24) % (CELL * 2);
    ctx.fillStyle = `rgba(255,236,170,${a})`;
    for (const p of paths) {
      for (let d = CELL + shift; d < p.total - CELL * 0.8; d += CELL * 2) {
        pathPos(p, d, tmp);
        const ca = Math.cos(tmp.angle), sa = Math.sin(tmp.angle);
        ctx.beginPath();
        ctx.moveTo(tmp.x + ca * 4, tmp.y + sa * 4);
        ctx.lineTo(tmp.x - ca * 3 - sa * 4, tmp.y - sa * 3 + ca * 4);
        ctx.lineTo(tmp.x - ca * 1, tmp.y - sa * 1);
        ctx.lineTo(tmp.x - ca * 3 + sa * 4, tmp.y - sa * 3 - ca * 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawPreWaveWarning() {
    if (!warningActive) return;
    const pulse = Math.abs(Math.sin(warningPulse));
    for (const p of paths) {
      const s = p.pts[0], n = p.pts[1];
      const ang = Math.atan2(n.y - s.y, n.x - s.x);
      const x = clamp(s.x + Math.cos(ang) * 40, 14, WORLD_W - 14), y = clamp(s.y + Math.sin(ang) * 40, 14, WORLD_H - 14);
      drawGlow('#ff3a3a', x, y, 22 + pulse * 8, 0.35 * pulse);
      ctx.fillStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y);
    }
  }

  /* ── Floor effects: burning ground and ice patches ── */
  function drawFloorEffects() {
    for (const fe of floorEffects) {
      const fade = Math.min(1, fe.timer / 1.2);
      if (fe.type === 'lava') {
        drawGlow('#ff6a1a', fe.x, fe.y, CELL * 0.75, 0.5 * fade * (0.8 + 0.2 * Math.sin(animTime * 6 + fe.col)));
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = '#3a0e06';
        ctx.beginPath(); ctx.ellipse(fe.x, fe.y + 2, 12, 8, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#ff6a14';
        for (let i = 0; i < 4; ++i) {
          const a = i * 1.7 + fe.col;
          ctx.fillRect(Math.round(fe.x + Math.cos(a) * 6 - 2), Math.round(fe.y + Math.sin(a) * 4), 4, 2);
        }
        ctx.globalAlpha = 1;
      } else if (fe.type === 'ice') {
        ctx.globalAlpha = fade * 0.75;
        ctx.fillStyle = '#bfeaff';
        ctx.beginPath(); ctx.ellipse(fe.x, fe.y + 2, 13, 8, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(fe.x - 6), Math.round(fe.y - 1), 6, 2);
        ctx.fillRect(Math.round(fe.x + 2), Math.round(fe.y + 4), 4, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawTraps() {
    for (const t of towers)
      if (TOWER_TYPES[t.type].trap)
        drawTowerSprite(t, t.x, t.y);
  }

  /* ── Towers and enemies, painted back to front ── */
  const actorList = [];
  function drawActors() {
    actorList.length = 0;
    for (const t of towers)
      if (!TOWER_TYPES[t.type].trap)
        actorList.push(t);
    for (const e of enemies)
      if (e.hp > 0)
        actorList.push(e);
    actorList.sort((a, b) => depthOf(a) - depthOf(b));
    // Flyers last: they pass over everything
    for (const a of actorList)
      if (typeof a.type === 'number') drawTower(a);
      else if (!ENEMY_TYPES[a.type].flying) drawEnemy(a);
    for (const a of actorList)
      if (typeof a.type !== 'number' && ENEMY_TYPES[a.type].flying) drawEnemy(a);
  }

  function depthOf(a) {
    return typeof a.type === 'number' ? a.y + 6 : a.y + a.radius * 0.5;
  }

  function drawTower(t) {
    // Build pop: grows in with a little overshoot; upgrades flash gold
    const age = t.bornAt !== undefined ? animTime - t.bornAt : 9;
    if (age < 0.4) {
      const k = age / 0.4;
      const s = 0.5 + 0.5 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
      ctx.save();
      ctx.translate(t.x, t.y + CELL / 2);
      ctx.scale(s, s);
      ctx.translate(-t.x, -t.y - CELL / 2);
      drawTowerSprite(t, t.x, t.y);
      ctx.restore();
    } else
      drawTowerSprite(t, t.x, t.y);
    const up = t.upAt !== undefined ? animTime - t.upAt : 9;
    if (up < 0.6) {
      const k = 1 - up / 0.6;
      drawGlow('#ffd75a', t.x, t.y - 6, 26 + (1 - k) * 14, k * 0.8);
      ctx.fillStyle = `rgba(255,236,160,${k * 0.5})`;
      ctx.fillRect(t.x - 6 * k, t.y - 60, 12 * k, 64);
    }
    const s = towerStats(t);
    // Idle life
    if (s.kind === 'chain') {
      const m = muzzleOf(t);
      drawGlow('#7ae8ff', m.x, m.y, 10 + t.tier * 2, 0.35 + 0.15 * Math.sin(animTime * 7 + t.col));
      if ((Math.floor(animTime * 9 + t.col * 3) % 7) === 0) {
        ctx.strokeStyle = 'rgba(200,248,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        const a = (animTime * 13 + t.row) % TWO_PI;
        ctx.lineTo(m.x + Math.cos(a) * 5, m.y + Math.sin(a) * 5 - 2);
        ctx.lineTo(m.x + Math.cos(a + 0.6) * 9, m.y + Math.sin(a + 0.6) * 9);
        ctx.stroke();
      }
    } else if (s.kind === 'glob') {
      const m = muzzleOf(t);
      for (let i = 0; i < 2; ++i) {
        const ph = (animTime * 0.9 + i * 0.5 + t.col * 0.13) % 1;
        ctx.fillStyle = `rgba(150,255,110,${0.8 * (1 - ph)})`;
        ctx.fillRect(Math.round(m.x - 4 + i * 6), Math.round(m.y - 2 - ph * 10), 2, 2);
      }
    } else if (s.kind === 'flame' && !t.flameT) {
      const m = muzzleOf(t);
      drawGlow('#ff8a2a', m.x, m.y, 4 + Math.sin(animTime * 20 + t.col) * 1.5, 0.6);
    } else if (s.kind === 'beam') {
      const m = muzzleOf(t);
      drawGlow(TOWER_TYPES[t.type].color, m.x, m.y, 6 + (t.beamTargets.length ? 6 : 0), 0.5);
    } else if (s.kind === 'bolt' && s.aura) {
      const m = muzzleOf(t);
      ctx.strokeStyle = 'rgba(220,245,255,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; ++i) {
        const a = animTime * 2 + i * 2.1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(m.x + Math.cos(a) * 12), Math.round(m.y + Math.sin(a) * 5 - 2), 2, 2);
      }
    }
    // Muzzle flash
    if (t.flash > 0) {
      const m = muzzleOf(t);
      const col = s.kind === 'bolt' ? '#bfeaff' : s.kind === 'snipe' ? '#ffffff' : s.kind === 'chain' ? '#bff4ff' : '#ffd28a';
      drawGlow(col, m.x, m.y, 10 + t.flash * 60, Math.min(1, t.flash * 9));
    }
    // Structure bar when damaged
    if (t.hp < t.maxHp) {
      const w = 22, x = t.x - w / 2, y = t.y + CELL / 2 - 2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      const r = t.hp / t.maxHp;
      ctx.fillStyle = r > 0.5 ? '#6fe08a' : r > 0.25 ? '#ffb648' : '#ff5a5a';
      ctx.fillRect(x, y, w * r, 2);
    }
  }

  function drawEnemy(e) {
    const def = ENEMY_TYPES[e.type];
    const img = enemyFrame(e);
    const sc = enemyScale(e) * (def.boss ? 1 : 1);
    if (Math.abs(Math.cos(e.angle)) > 0.2) e.face = Math.cos(e.angle) < 0 ? -1 : 1;
    const flip = e.face === -1;
    const lift = def.flying ? 12 + Math.sin(animTime * 3 + e.walk) * 2 : 0;
    const spawnA = Math.min(1, e.spawnT * 3);
    let alpha = spawnA;
    if (def.stealth && !e.revealed) alpha *= 0.28 + 0.1 * Math.sin(animTime * 5 + e.walk);
    const bottom = e.y + e.radius * 0.7 - lift;
    drawShadow(e.x, e.y + e.radius * 0.6, e.radius * 1.1, e.radius * 0.45, def.flying ? 0.45 : 0.8);
    if (e.elite) drawGlow('#ffd75a', e.x, bottom - img.height * AP * sc * 0.45, e.radius * 2.2, 0.28 + 0.1 * Math.sin(animTime * 4));
    if (def.boss) drawGlow(def.color, e.x, bottom - img.height * AP * sc * 0.45, e.radius * 2.6, 0.22);
    // Frozen enemies stop moving and turn icy
    blitArt(img, e.x, bottom, flip, alpha, sc);
    if (e.hitFlash > 0)
      blitArt(flashOf(img), e.x, bottom, flip, alpha * Math.min(1, e.hitFlash * 12), sc);
    const topY = bottom - img.height * AP * sc;
    if (e.freezeTimer > 0) {
      ctx.globalAlpha = 0.55 * alpha;
      ctx.fillStyle = '#bfeaff';
      ctx.fillRect(Math.round(e.x - e.radius - 2), Math.round(topY + 2), Math.round(e.radius * 2 + 4), Math.round(bottom - topY - 2));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(e.x - e.radius), Math.round(topY + 4), 3, Math.round((bottom - topY) * 0.6));
      ctx.globalAlpha = 1;
    } else if (e.slowTimer > 0 && e.slowMul < 1) {
      ctx.globalAlpha = 0.25 * alpha;
      blitArt(img, e.x, bottom, flip, 1, sc);
      ctx.globalAlpha = alpha;
      if (Math.floor(animTime * 8 + e.walk) % 3 === 0) {
        ctx.fillStyle = '#e6f8ff';
        ctx.fillRect(Math.round(e.x + Math.sin(e.walk * 3) * e.radius), Math.round(topY + (animTime * 20 + e.walk * 7) % (bottom - topY)), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (e.burnTimer > 0) {
      for (let i = 0; i < 2; ++i) {
        const ph = (animTime * 3 + i * 0.5 + e.walk) % 1;
        ctx.fillStyle = ph < 0.5 ? '#ffe48a' : '#ff6a14';
        ctx.fillRect(Math.round(e.x - 4 + i * 6 + Math.sin(ph * 6) * 2), Math.round(bottom - (bottom - topY) * (0.3 + ph * 0.8)), 2, 3);
      }
    }
    if (e.poisonTimer > 0 || e.acidTimer > 0) {
      const ph = (animTime * 1.5 + e.walk) % 1;
      ctx.fillStyle = e.acidTimer > 0 ? 'rgba(220,255,80,0.9)' : 'rgba(120,255,90,0.9)';
      ctx.fillRect(Math.round(e.x + 3), Math.round(topY + 2 - ph * 6), 2, 2);
    }
    if (e.stunTimer > 0) {
      for (let i = 0; i < 3; ++i) {
        const a = animTime * 8 + i * 2.1;
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(Math.round(e.x + Math.cos(a) * 7 - 1), Math.round(topY - 2 + Math.sin(a) * 2), 2, 2);
      }
    }
    if (e.shieldHp > 0) {
      const r = e.radius + 5;
      ctx.strokeStyle = `rgba(110,220,255,${0.35 + 0.4 * (e.shieldHp / Math.max(1, e.shieldMax))})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(e.x, bottom - (bottom - topY) / 2, r, (bottom - topY) / 2 + 3, 0, 0, TWO_PI);
      ctx.stroke();
      drawGlow('#5ad8ff', e.x, bottom - (bottom - topY) / 2, r * 1.3, 0.12);
    }
    if (e.elite)
      drawCrown(e.x, topY - 3);
    // Health bar
    if (e.hp < e.maxHp || e.shieldHp > 0 || def.boss || e.elite) {
      const w = Math.max(16, e.radius * 2.4), x = Math.round(e.x - w / 2), y = Math.round(topY - (e.elite ? 10 : 5));
      ctx.fillStyle = 'rgba(10,6,12,0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      const r = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = r > 0.5 ? '#6fe08a' : r > 0.25 ? '#ffb648' : '#ff4a4a';
      ctx.fillRect(x, y, w * r, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y, w * r, 1);
      if (e.shieldHp > 0) {
        ctx.fillStyle = '#7ad8ff';
        ctx.fillRect(x, y + 3, w * clamp(e.shieldHp / Math.max(1, e.shieldMax), 0, 1), 1);
      }
      if (e.armor > e.shred) {
        ctx.fillStyle = '#c4ccdc';
        ctx.fillRect(x - 4, y - 1, 3, 4);
        ctx.fillStyle = '#5a6478';
        ctx.fillRect(x - 3, y + 2, 1, 1);
      }
    }
  }

  function drawCrown(x, y) {
    ctx.fillStyle = '#ffd75a';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x - 2, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y); ctx.lineTo(x + 5, y - 3); ctx.lineTo(x + 5, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8303a';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
  }

  /* ── Dying enemies: flash, squash and fade ── */
  function addCorpse(e) {
    const def = ENEMY_TYPES[e.type];
    corpses.push({ img: enemyFrame(e), x: e.x, y: e.y + e.radius * 0.7 - (def.flying ? 12 : 0), flip: e.face === -1, sc: enemyScale(e), t: 0, life: def.boss ? 1.2 : 0.45, flying: !!def.flying });
    if (corpses.length > 60) corpses.shift();
  }

  function drawCorpses() {
    for (let i = corpses.length - 1; i >= 0; --i) {
      const c = corpses[i];
      c.t += frameDt * (state === STATE_PLAYING ? gameSpeed : 1);
      const k = c.t / c.life;
      if (k >= 1) {
        corpses.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(c.x, c.y + (c.flying ? k * 12 : 0));
      ctx.scale(1 + k * 0.3, 1 - k * 0.8);
      blitArt(k < 0.25 ? flashOf(c.img) : c.img, 0, 0, c.flip, 1 - k, c.sc);
      ctx.restore();
    }
  }

  /* ── Shots ── */
  function drawProjectiles() {
    ctx.lineCap = 'round';
    for (const p of projectiles) {
      if (p.trail && p.trail.length > 3) {
        ctx.strokeStyle = p.kind === 'bolt' ? 'rgba(190,240,255,0.45)' : 'rgba(255,240,200,0.35)';
        ctx.lineWidth = p.kind === 'bolt' ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(p.trail[0], p.trail[1]);
        for (let i = 2; i < p.trail.length; i += 2)
          ctx.lineTo(p.trail[i], p.trail[i + 1]);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const z = p.z || 0;
      if (p.kind === 'shell' || p.kind === 'glob' || p.kind === 'bomblet') {
        drawShadow(p.x, p.y + 2, 4, 2, 0.6);
        if (p.kind === 'glob') {
          drawGlow('#7ce35a', p.x, p.y - z, 9, 0.5);
          ctx.fillStyle = '#7ce35a';
          ctx.beginPath(); ctx.arc(p.x, p.y - z, 3.5, 0, TWO_PI); ctx.fill();
          ctx.fillStyle = '#d4ffb0';
          ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - z - 2), 2, 2);
        } else {
          const r = p.kind === 'bomblet' ? 2.2 : 4;
          ctx.fillStyle = '#1a1a20';
          ctx.beginPath(); ctx.arc(p.x, p.y - z, r, 0, TWO_PI); ctx.fill();
          ctx.fillStyle = '#6a6a78';
          ctx.fillRect(Math.round(p.x - r * 0.6), Math.round(p.y - z - r * 0.6), 2, 2);
          if (p.kind === 'shell') drawGlow('#ffb36a', p.x, p.y - z, 5, 0.4);
        }
        continue;
      }
      if (p.kind === 'arrow') {
        const t = p.target;
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        ctx.strokeStyle = '#d8b07a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = '#e8eef8';
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2);
        continue;
      }
      if (p.kind === 'bolt') {
        drawGlow('#9ae4ff', p.x, p.y, 8, 0.7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x - 1.5), Math.round(p.y - 1.5), 3, 3);
      }
    }
    ctx.lineCap = 'butt';
  }

  function drawClouds() {
    for (const c of clouds) {
      const a = Math.min(1, c.t * 4, (c.life - c.t) * 2);
      const col = c.acid ? '#c8ff4a' : '#7ce35a';
      drawGlow(col, c.x, c.y, c.r * 1.25, 0.32 * a);
      for (let i = 0; i < 5; ++i) {
        const ang = c.seed + i * 1.26 + animTime * 0.6;
        const rr = c.r * (0.35 + 0.3 * ((i * 37) % 10) / 10);
        const bx = c.x + Math.cos(ang) * rr, by = c.y + Math.sin(ang) * rr * 0.6;
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = i % 2 ? col : (c.acid ? '#eaff9a' : '#b4ff8a');
        ctx.beginPath(); ctx.arc(bx, by, c.r * 0.28, 0, TWO_PI); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFxLines() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of fxLines) {
      const k = 1 - f.t / f.life;
      if (f.kind === 'ring') {
        ctx.strokeStyle = hexToRgba(f.color, k * 0.7);
        ctx.lineWidth = 2 + k * 2;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (1 - k * 0.6), f.r * (1 - k * 0.6) * 0.75, 0, 0, TWO_PI);
        ctx.stroke();
        continue;
      }
      const pts = f.pts;
      if (f.kind === 'zap') {
        // Jagged bolt: wide translucent glow pass, then a bright core
        const jag = [];
        for (let i = 1; i < pts.length; ++i) {
          const a = pts[i - 1], b = pts[i];
          const n = 4;
          for (let s = 0; s <= n; ++s) {
            const tt = s / n;
            const off = s === 0 || s === n ? 0 : Math.sin(f.seed + i * 13.7 + s * 5.3 + f.t * 90) * 6;
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            jag.push(a.x + dx * tt - dy / L * off, a.y + dy * tt + dx / L * off);
          }
        }
        for (let pass = 0; pass < 2; ++pass) {
          ctx.strokeStyle = pass ? `rgba(255,255,255,${k})` : `rgba(120,220,255,${k * 0.45})`;
          ctx.lineWidth = pass ? 1.4 : 5;
          ctx.beginPath();
          ctx.moveTo(jag[0], jag[1]);
          for (let i = 2; i < jag.length; i += 2) ctx.lineTo(jag[i], jag[i + 1]);
          ctx.stroke();
        }
        for (let i = 1; i < pts.length; ++i) drawGlow('#7ae8ff', pts[i].x, pts[i].y, 10, k * 0.6);
        continue;
      }
      // Tracers
      for (let pass = 0; pass < 2; ++pass) {
        ctx.strokeStyle = pass ? `rgba(255,255,255,${k})` : hexToRgba(f.color, k * 0.5);
        ctx.lineWidth = pass ? 1 : (f.w || 2) * 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      }
    }
    // Beams and flames come straight from the towers
    for (const t of towers) {
      const s = towerStats(t);
      if (s.kind === 'beam' && t.beamTargets.length && state === STATE_PLAYING) {
        const heat = Math.min(1, t.beamTime / s.rampTime);
        const m = muzzleOf(t);
        const col = t.branch === 1 && t.tier >= 4 ? '#ffc84a' : TOWER_TYPES[t.type].color;
        for (const e of t.beamTargets) {
          if (e.hp <= 0) continue;
          const wob = Math.sin(animTime * 40) * 0.6;
          ctx.strokeStyle = hexToRgba(col, 0.3 + heat * 0.25);
          ctx.lineWidth = 4 + heat * 4 + wob;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(e.x, e.y - e.radius * 0.6); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 + heat * 1.5;
          ctx.stroke();
          drawGlow(col, e.x, e.y - e.radius * 0.6, 8 + heat * 8, 0.8);
        }
      }
      if (s.kind === 'flame' && t.flameT > 0) {
        const m = muzzleOf(t);
        const k = t.flameT / 0.25;
        for (let i = 0; i < 7; ++i) {
          const d = (i / 6) * s.rangePx * (0.9 + 0.1 * Math.sin(animTime * 30 + i));
          const spread = Math.sin(s.cone) * d * 0.8;
          const off = Math.sin(animTime * 37 + i * 2.3) * spread * 0.6;
          const x = m.x + Math.cos(t.angle) * d - Math.sin(t.angle) * off;
          const y = m.y + Math.sin(t.angle) * d + Math.cos(t.angle) * off;
          const col = i < 2 ? '#fff2a8' : i < 4 ? '#ffa63a' : '#ff5a14';
          drawGlow(col, x, y, 6 + i * 2.2, 0.55 * k);
        }
      }
    }
    ctx.lineCap = 'butt';
  }

  /* ══════════════════════════════════════════════════════════════════
     AMBIENT WEATHER -- pollen and butterflies, desert dust, snowfall,
     embers and ash, plus drifting cloud shadows
     ══════════════════════════════════════════════════════════════════ */

  let ambient = null;
  function initAmbient(biome) {
    const rng = makeRng(biome.length * 77);
    const n = biome === 'tundra' ? 90 : biome === 'volcano' ? 60 : 36;
    ambient = { biome, parts: [], clouds: [] };
    for (let i = 0; i < n; ++i)
      ambient.parts.push({ x: rng() * WORLD_W, y: rng() * WORLD_H, z: 0.4 + rng() * 0.6, ph: rng() * TWO_PI, kind: rng() < 0.15 ? 1 : 0 });
    for (let i = 0; i < 3; ++i)
      ambient.clouds.push({ x: rng() * WORLD_W, y: rng() * WORLD_H, s: 0.7 + rng() * 0.6 });
  }

  let cloudShadow = null;
  function drawAmbient() {
    const biome = MAPS[currentMap].biome;
    if (!ambient || ambient.biome !== biome) initAmbient(biome);
    const dt = Math.min(0.05, frameDt);
    // Cloud shadows drift slowly over meadow and desert (parallax above the ground)
    if (biome === 'meadow' || biome === 'desert') {
      if (!cloudShadow) {
        cloudShadow = makeCanvas(96, 48);
        const g = cloudShadow.getContext('2d');
        for (const [x, y, r] of [[30, 26, 18], [50, 20, 20], [68, 28, 16], [44, 32, 14]]) {
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, 'rgba(10,20,30,0.22)');
          grad.addColorStop(1, 'rgba(10,20,30,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, 96, 48);
        }
      }
      ctx.imageSmoothingEnabled = true;
      for (const c of ambient.clouds) {
        c.x += dt * 9 * c.s;
        c.y += dt * 2;
        if (c.x > WORLD_W + 150) { c.x = -260; c.y = Math.random() * WORLD_H; }
        if (c.y > WORLD_H + 80) c.y = -100;
        ctx.drawImage(cloudShadow, c.x, c.y, 260 * c.s, 130 * c.s);
      }
      ctx.imageSmoothingEnabled = false;
    }
    for (const p of ambient.parts) {
      p.ph += dt;
      if (biome === 'tundra') {
        p.y += dt * 22 * p.z;
        p.x += dt * (8 + Math.sin(p.ph) * 10) * p.z;
        ctx.fillStyle = `rgba(255,255,255,${0.5 + p.z * 0.5})`;
        const s = p.z > 0.8 ? 2 : 1;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s * 1.5, s * 1.5);
      } else if (biome === 'volcano') {
        if (p.kind) {
          p.y += dt * 10 * p.z;
          p.x += dt * 4;
          ctx.fillStyle = 'rgba(120,110,110,0.55)';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        } else {
          p.y -= dt * 18 * p.z;
          p.x += Math.sin(p.ph * 2) * dt * 8;
          const fl = 0.5 + 0.5 * Math.sin(p.ph * 6);
          ctx.fillStyle = fl > 0.5 ? '#ffd06a' : '#ff6a1a';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        }
      } else if (biome === 'desert') {
        p.x += dt * 26 * p.z;
        p.y += Math.sin(p.ph * 1.3) * dt * 6;
        ctx.fillStyle = 'rgba(255,240,200,0.35)';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      } else {
        // Meadow: pollen motes and the odd butterfly
        p.x += Math.sin(p.ph * 0.7) * dt * 12;
        p.y += Math.cos(p.ph * 0.5) * dt * 8;
        if (p.kind) {
          const flap = Math.sin(p.ph * 18) > 0;
          ctx.fillStyle = p.z > 0.7 ? '#ffe14a' : '#f4f4f4';
          ctx.fillRect(Math.round(p.x - (flap ? 3 : 2)), Math.round(p.y), flap ? 2 : 1, 2);
          ctx.fillRect(Math.round(p.x + 1), Math.round(p.y), flap ? 2 : 1, 2);
        } else {
          ctx.fillStyle = `rgba(255,250,200,${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.ph * 3))})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1.5, 1.5);
        }
      }
      if (p.x > WORLD_W + 4) p.x = -4;
      if (p.x < -4) p.x = WORLD_W + 4;
      if (p.y > WORLD_H + 4) p.y = -4;
      if (p.y < -4) p.y = WORLD_H + 4;
    }
  }

  /* ── Icons for the UI ── */
  function drawTowerIcon(typeIndex, tier, cx, cy, size, branch) {
    const t = { type: typeIndex, tier, branch: branch === undefined ? -1 : branch, angle: -Math.PI / 5, col: 0, row: 0, recoil: 0, hp: 1, maxHp: 1 };
    const art = towerArt(typeIndex, tier, t.branch);
    const h = (art.base.height + (art.heads || art.head ? 4 : 0)) * AP;
    const k = size / Math.max(44, h);
    ctx.save();
    ctx.translate(cx, cy + size / 2 - (CELL / 2 + 6) * k);
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = false;
    drawTowerSprite(t, 0, 0);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }

  function drawTowerIconWorld(typeIndex, tier, x, y) {
    drawTowerSprite({ type: typeIndex, tier, branch: -1, angle: -Math.PI / 2, col: 0, row: 0, recoil: 0, hp: 1, maxHp: 1 }, x, y);
  }

  function drawEnemyIcon(type, cx, cy, size) {
    const img = enemyFrames(type)[0];
    const k = size / Math.max(img.width, img.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }

  /* ══════════════════════════════════════════════════════════════════
     EFFECTS -- pooled particles (no per-particle gradients), floating
     text, ground decals, coins flying to the gold counter, banners,
     the boss intro card, hitstop and screen transitions
     ══════════════════════════════════════════════════════════════════ */

  const MAX_PARTICLES = 1400;
  const PK_PIXEL = 0, PK_GLOW = 1, PK_SMOKE = 2, PK_DEBRIS = 3, PK_SPARK = 4, PK_FLAKE = 5;

  const P = {
    n: 0,
    x: new Float32Array(MAX_PARTICLES), y: new Float32Array(MAX_PARTICLES),
    vx: new Float32Array(MAX_PARTICLES), vy: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES), max: new Float32Array(MAX_PARTICLES),
    size: new Float32Array(MAX_PARTICLES), grav: new Float32Array(MAX_PARTICLES),
    drag: new Float32Array(MAX_PARTICLES), z: new Float32Array(MAX_PARTICLES),
    vz: new Float32Array(MAX_PARTICLES), kind: new Uint8Array(MAX_PARTICLES),
    col: new Array(MAX_PARTICLES)
  };

  function emit(x, y, vx, vy, life, size, color, kind, grav, drag, vz) {
    let i = P.n;
    if (i >= MAX_PARTICLES) {
      // Pool full: recycle a random old particle rather than dropping the new one
      i = Math.floor(Math.random() * MAX_PARTICLES);
    } else
      ++P.n;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
    P.life[i] = life; P.max[i] = life; P.size[i] = size;
    P.col[i] = color; P.kind[i] = kind; P.grav[i] = grav || 0; P.drag[i] = drag || 0;
    P.z[i] = 0; P.vz[i] = vz || 0;
  }

  function updateParticles(dt) {
    let i = 0;
    while (i < P.n) {
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        const j = --P.n;
        P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j];
        P.life[i] = P.life[j]; P.max[i] = P.max[j]; P.size[i] = P.size[j]; P.col[i] = P.col[j];
        P.kind[i] = P.kind[j]; P.grav[i] = P.grav[j]; P.drag[i] = P.drag[j]; P.z[i] = P.z[j]; P.vz[i] = P.vz[j];
        continue;
      }
      const d = P.drag[i] ? Math.exp(-P.drag[i] * dt) : 1;
      P.vx[i] *= d; P.vy[i] *= d;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      if (P.kind[i] === PK_DEBRIS) {
        // Height above the ground with a bounce
        P.vz[i] -= 420 * dt;
        P.z[i] += P.vz[i] * dt;
        if (P.z[i] < 0) {
          P.z[i] = 0;
          P.vz[i] = -P.vz[i] * 0.35;
          P.vx[i] *= 0.6; P.vy[i] *= 0.6;
        }
      } else
        P.vy[i] += P.grav[i] * dt;
      ++i;
    }
  }

  let smokePuff = null;
  function drawParticles() {
    if (!smokePuff) {
      smokePuff = makeCanvas(16, 16);
      const g = smokePuff.getContext('2d');
      const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 16);
    }
    // Smoke first (under everything else), then solid bits, then additive glows
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < P.n; ++i) {
      if (P.kind[i] !== PK_SMOKE) continue;
      const k = P.life[i] / P.max[i];
      const s = P.size[i] * (1.6 - k * 0.6);
      ctx.globalAlpha = k * 0.5;
      ctx.drawImage(tintedPuff(P.col[i]), P.x[i] - s, P.y[i] - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < P.n; ++i) {
      const kind = P.kind[i];
      if (kind === PK_SMOKE || kind === PK_GLOW) continue;
      const k = P.life[i] / P.max[i];
      ctx.fillStyle = P.col[i];
      if (kind === PK_SPARK) {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeStyle = P.col[i];
        ctx.lineWidth = P.size[i];
        ctx.beginPath();
        ctx.moveTo(P.x[i], P.y[i]);
        ctx.lineTo(P.x[i] - P.vx[i] * 0.035, P.y[i] - P.vy[i] * 0.035);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = kind === PK_DEBRIS ? Math.min(1, k * 3) : Math.min(1, k * 1.6);
      const s = P.size[i];
      if (kind === PK_DEBRIS) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i]), s, 1);
        ctx.fillStyle = P.col[i];
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i] - P.z[i] - s), s, s);
      } else
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i] - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < P.n; ++i) {
      if (P.kind[i] !== PK_GLOW) continue;
      const k = P.life[i] / P.max[i];
      drawGlow(P.col[i], P.x[i], P.y[i], P.size[i] * (0.6 + 0.4 * k), k);
    }
  }

  const puffCache = {};
  function tintedPuff(color) {
    let c = puffCache[color];
    if (!c) {
      c = puffCache[color] = makeCanvas(16, 16);
      const g = c.getContext('2d');
      g.drawImage(smokePuff, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, 16, 16);
    }
    return c;
  }

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  // Compatible helpers used all over the simulation
  const particles = {
    burst(x, y, n, o) {
      o = o || {};
      const sp = (o.speed || 3) * 30;
      for (let i = 0; i < n; ++i) {
        const a = Math.random() * TWO_PI, v = sp * rnd(0.4, 1.1);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, (o.life || 0.5) * rnd(0.6, 1.2), rnd(1.5, 3), o.color || '#ffffff', PK_PIXEL, 0, 4);
      }
    },
    sparkle(x, y, n, o) {
      o = o || {};
      const sp = (o.speed || 2) * 14;
      for (let i = 0; i < n; ++i) {
        const a = Math.random() * TWO_PI, v = sp * rnd(0.3, 1);
        emit(x + rnd(-4, 4), y + rnd(-4, 4), Math.cos(a) * v, Math.sin(a) * v - 18, rnd(0.4, 0.8), rnd(1.5, 2.5), o.color || '#ffffff', PK_PIXEL, -10, 2);
      }
    },
    confetti(x, y, n, o) {
      const cols = ['#ffd75a', '#ff6a6a', '#6fe08a', '#5ab8ff', '#c890ff', '#ffffff'];
      for (let i = 0; i < n; ++i) {
        const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(90, 240);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(1, 1.8), rnd(2, 4), cols[i % cols.length], PK_PIXEL, 260, 1.2);
      }
    },
    glow(x, y, r, color, life) {
      emit(x, y, 0, 0, life || 0.25, r, color, PK_GLOW);
    },
    smoke(x, y, n, color, size) {
      for (let i = 0; i < n; ++i)
        emit(x + rnd(-5, 5), y + rnd(-5, 5), rnd(-12, 12), rnd(-26, -8), rnd(0.6, 1.2), (size || 7) * rnd(0.7, 1.2), color || '#5a5050', PK_SMOKE, 0, 1.5);
    },
    debris(x, y, n, colors, power) {
      for (let i = 0; i < n; ++i) {
        const a = Math.random() * TWO_PI, v = rnd(30, 90) * (power || 1);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.6, rnd(0.6, 1.2), rnd(2, 4), colors[i % colors.length], PK_DEBRIS, 0, 1.5, rnd(80, 190) * (power || 1));
      }
    },
    sparks(x, y, n, color, speed) {
      for (let i = 0; i < n; ++i) {
        const a = Math.random() * TWO_PI, v = (speed || 160) * rnd(0.5, 1.2);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.12, 0.3), 1, color || '#ffe8a0', PK_SPARK, 120, 3);
      }
    },
    flakes(x, y, n, color) {
      for (let i = 0; i < n; ++i)
        emit(x + rnd(-8, 8), y + rnd(-8, 8), rnd(-20, 20), rnd(-30, 5), rnd(0.4, 0.9), 2, color || '#e6f8ff', PK_PIXEL, 40, 2);
    },
    count() { return P.n; },
    clear() { P.n = 0; }
  };

  /* ── Floating text ── */
  const texts = [];
  const floatingText = {
    add(x, y, text, o) {
      o = o || {};
      const m = /(\d+)px/.exec(o.font || '');
      if (texts.length > 48) texts.shift();
      texts.push({ x, y, text: String(text), color: o.color || '#ffffff', px: m ? +m[1] : 11, t: 0, life: o.life || 1.1, big: !!o.big });
    },
    clear() { texts.length = 0; }
  };

  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; --i) {
      const t = texts[i];
      t.t += dt;
      if (t.t >= t.life) texts.splice(i, 1);
    }
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of texts) {
      const k = t.t / t.life;
      const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.55 : k < 0.22 ? 1.15 - (k - 0.12) * 1.5 : 1;
      const y = t.y - (t.big ? 8 : 22) * Math.min(1, k * 1.6);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = uiFont(Math.round(t.px * pop), 'bold');
      ctx.strokeStyle = 'rgba(10,6,14,0.85)';
      ctx.lineWidth = Math.max(2.5, t.px / 4);
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Ground decals: scorch marks, splats, frost rings ── */
  const decals = [];
  function addDecal(x, y, r, kind) {
    if (decals.length > 40) decals.shift();
    decals.push({ x, y, r, kind, t: 0, life: kind === 'scorch' ? 9 : 6, rot: Math.random() * TWO_PI });
  }

  function updateDecals(dt) {
    for (let i = decals.length - 1; i >= 0; --i) {
      decals[i].t += dt;
      if (decals[i].t >= decals[i].life) decals.splice(i, 1);
    }
  }

  function drawDecals() {
    for (const d of decals) {
      const a = Math.min(1, (d.life - d.t) / 2) * 0.55;
      ctx.globalAlpha = a;
      if (d.kind === 'scorch') {
        ctx.fillStyle = '#140c08';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.62, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#2a1a10';
        for (let i = 0; i < 6; ++i) {
          const ang = d.rot + i * 1.05;
          ctx.fillRect(Math.round(d.x + Math.cos(ang) * d.r * 0.9), Math.round(d.y + Math.sin(ang) * d.r * 0.55), 3, 2);
        }
      } else {
        ctx.fillStyle = d.kind === 'slime' ? '#3ab898' : d.kind === 'blood' ? '#6a1a1a' : '#bfeaff';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TWO_PI); ctx.fill();
        for (let i = 0; i < 4; ++i) {
          const ang = d.rot + i * 1.6;
          ctx.fillRect(Math.round(d.x + Math.cos(ang) * d.r * 1.3), Math.round(d.y + Math.sin(ang) * d.r * 0.7), 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── Big moments ── */
  let hitstop = 0;

  function explosionFx(x, y, radius, color) {
    const big = radius > CELL * 1.4;
    particles.glow(x, y, radius * 1.8, '#fff2c0', 0.14);
    // Fireball: hot blobs drifting outwards and shrinking
    const fire = ['#fff2b0', '#ffd28a', color || '#ff8a3a', '#ff5a1a'];
    const nf = big ? 9 : 5;
    for (let i = 0; i < nf; ++i) {
      const a = Math.random() * TWO_PI, v = rnd(20, 70) * (big ? 1.4 : 1);
      emit(x + Math.cos(a) * 4, y + Math.sin(a) * 3, Math.cos(a) * v, Math.sin(a) * v * 0.7 - 20, rnd(0.28, 0.5), radius * rnd(0.45, 0.75), fire[i % fire.length], PK_GLOW, -30, 3);
    }
    fxLines.push({ kind: 'ring', x, y, r: radius * 1.2, color: '#ffe2a0', t: 0, life: 0.32 });
    particles.debris(x, y, big ? 14 : 8, ['#3a2a20', '#5a4030', '#ffb36a', '#2a2020'], big ? 1.4 : 1.1);
    particles.sparks(x, y, big ? 14 : 8, '#ffd28a', 220);
    particles.smoke(x, y - 4, big ? 7 : 4, '#3a3434', big ? 11 : 8);
    addDecal(x, y + 3, radius * 0.55, 'scorch');
    if (big) addShake(3, 120);
  }

  // Enemy death: pixel chunks in the enemy's colours, a puff and a splat
  function deathFx(e) {
    const def = ENEMY_TYPES[e.type];
    const ramp = rampOf(def.color);
    const y = e.y - (def.flying ? 12 : 4);
    particles.debris(e.x, y, def.boss ? 28 : Math.round(6 + e.radius * 0.6), [ramp[2], ramp[3], ramp[4], ramp[1]], def.boss ? 1.6 : 1);
    particles.glow(e.x, y, e.radius * 2.2, def.color, 0.25);
    particles.smoke(e.x, y, def.boss ? 8 : 2, '#6a6060', 6);
    if (def.boss) {
      for (let i = 0; i < 6; ++i)
        explosionFx(e.x + rnd(-26, 26), e.y + rnd(-18, 18), CELL * rnd(0.8, 1.6), i % 2 ? '#ff5a3a' : '#ffd28a');
      hitstop = 0.5;
      addShake(10, 700);
    } else if (!def.flying)
      addDecal(e.x, e.y + e.radius * 0.6, e.radius * 0.7, e.type === 'splitter' || e.type === 'slimelet' ? 'slime' : 'blood');
  }

  /* ── Coins flying to the gold counter (UI space) ── */
  const uiCoins = [];
  function coinFly(wx, wy, n) {
    const p = worldToUi(wx, wy);
    for (let i = 0; i < n && uiCoins.length < 40; ++i)
      uiCoins.push({ x: p.x, y: p.y, sx: p.x + rnd(-18, 18), sy: p.y - rnd(10, 34), t: -i * 0.06, dur: rnd(0.55, 0.75) });
  }

  let coinTick = 0;
  function updateDrawCoins() {
    for (let i = uiCoins.length - 1; i >= 0; --i) {
      const c = uiCoins[i];
      c.t += frameDt;
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / c.dur);
      // Quadratic curve: pop up, then swoop to the counter
      const e = k * k * (3 - 2 * k);
      const mx = (c.x + goldHudPos.x) / 2 + (c.sx - c.x) * 2, my = Math.min(c.sy, goldHudPos.y) - 30;
      const x = (1 - e) * (1 - e) * c.x + 2 * (1 - e) * e * mx + e * e * goldHudPos.x;
      const y = (1 - e) * (1 - e) * c.y + 2 * (1 - e) * e * my + e * e * goldHudPos.y;
      drawIcon('coin', x, y, 12 + Math.sin(k * Math.PI) * 4);
      if (k >= 1) {
        uiCoins.splice(i, 1);
        goldPulse = 1;
        if (performance.now() - coinTick > 70) {
          coinTick = performance.now();
          audio.play('coin', { pitch: 1.4 + Math.random() * 0.3, volume: 0.25 });
        }
      }
    }
  }

  /* ── Banners: wave start, wave cleared ── */
  let banner = null;
  function showBanner(title, sub, color, dur) {
    banner = { title, sub, color: color || UI.gold, t: 0, dur: dur || 2.2 };
  }

  function drawBanner() {
    if (!banner) return;
    banner.t += frameDt;
    const b = banner;
    if (b.t >= b.dur) {
      banner = null;
      return;
    }
    const inT = Math.min(1, b.t / 0.3), outT = Math.max(0, (b.t - b.dur + 0.35) / 0.35);
    const ease = (v) => 1 - Math.pow(1 - v, 3);
    const w = Math.min(520, UW - 40), h = b.sub ? 64 : 48;
    const x = UW / 2 - w / 2 + (1 - ease(inT)) * -UW * 0.6 + ease(outT) * UW * 0.6;
    const y = TOP_H + 46;
    ctx.save();
    ctx.globalAlpha = 1 - outT;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(8,10,20,0)');
    g.addColorStop(0.15, 'rgba(8,10,20,0.88)');
    g.addColorStop(0.85, 'rgba(8,10,20,0.88)');
    g.addColorStop(1, 'rgba(8,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const lg = ctx.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, hexToRgba(b.color, 0));
    lg.addColorStop(0.5, hexToRgba(b.color, 1));
    lg.addColorStop(1, hexToRgba(b.color, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + h - 2, w, 2);
    drawHeadline(b.title, x + w / 2, y + (b.sub ? 24 : h / 2), w - 60, 30, b.color, shade(b.color, -0.3));
    if (b.sub) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(b.sub, x + w / 2, y + 50, w - 80, 13, { color: '#e4eaf6', weight: 'bold' });
    }
    ctx.restore();
  }

  /* ── Boss intro: letterbox bars and a name card ── */
  function drawBossIntro() {
    if (!bossIntro) return;
    bossIntro.t += frameDt;
    const t = bossIntro.t, dur = 2.6;
    if (t >= dur) {
      bossIntro = null;
      return;
    }
    const e = bossIntro.e;
    const def = ENEMY_TYPES[e.type];
    const k = Math.min(1, t / 0.3) * Math.min(1, (dur - t) / 0.4);
    const top = (view.y) / uiS, bottom = (view.y + WORLD_H * view.s) / uiS;
    const barH = 34 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, top, UW, barH);
    ctx.fillRect(0, bottom - barH, UW, barH);
    ctx.save();
    ctx.globalAlpha = k;
    const cy = bottom - 34 - 30;
    const cw = Math.min(460, UW - 40);
    const cx = UW / 2 - cw / 2;
    drawPanel(cx, cy, cw, 58, { accent: '#ff5a5a', radius: 10 });
    // Portrait
    const img = enemyFrames(e.type)[Math.floor(animTime * 6) % 4];
    const s = Math.min(48 / img.height, 70 / img.width);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx + 12, cy + 29 - img.height * s / 2, img.width * s, img.height * s);
    ctx.imageSmoothingEnabled = true;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('BOSS', cx + 92, cy + 16, 80, 10, { weight: 'bold', color: '#ff8a8a' });
    fitText(def.name, cx + 92, cy + 34, cw - 104, 22, { weight: 'bold', color: '#ffffff' });
    ctx.textAlign = 'right';
    fitText(`[[heart]] ${Math.ceil(e.maxHp)}`, cx + cw - 14, cy + 16, 140, 11, { weight: 'bold', color: UI.textDim });
    ctx.restore();
  }

  /* ── Screen transitions ── */
  let fadeT = 0, lastScreen = null;
  function screenGroup() {
    return state === STATE_READY ? 'title' : state === STATE_MAP_SELECT ? 'maps' : state === STATE_RESEARCH ? 'research' : 'game';
  }

  function drawTransition() {
    const g = screenGroup();
    if (g !== lastScreen) {
      if (lastScreen !== null) fadeT = 1;
      lastScreen = g;
    }
    if (fadeT > 0) {
      ctx.fillStyle = `rgba(4,6,12,${fadeT})`;
      ctx.fillRect(-20, -20, UW + 40, UH + 40);
      fadeT = Math.max(0, fadeT - frameDt * 3.2);
    }
  }

  /* ── Low lives: the screen edges pulse red ── */
  let dangerCanvas = null;
  function drawDanger() {
    if (state !== STATE_PLAYING && state !== STATE_BUILD) return;
    const ratio = lives / startLives();
    const hurt = livesPulse;
    if (ratio > 0.3 && hurt <= 0.01) return;
    if (!dangerCanvas) {
      dangerCanvas = makeCanvas(160, 110);
      const g = dangerCanvas.getContext('2d');
      const grad = g.createRadialGradient(80, 55, 40, 80, 55, 100);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, 'rgba(220,20,20,0.7)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 160, 110);
    }
    const a = Math.max(hurt * 0.7, ratio <= 0.3 ? 0.18 + 0.14 * Math.sin(animTime * 5) : 0);
    ctx.globalAlpha = a;
    ctx.drawImage(dangerCanvas, -20, -20, UW + 40, UH + 40);
    ctx.globalAlpha = 1;
  }

  function updateEffects(dt) {
    const k = state === STATE_PLAYING ? gameSpeed * (hitstop > 0 ? 0.25 : 1) : 1;
    updateParticles(dt * k);
    updateTexts(dt * Math.min(k, 2));
    updateDecals(dt * k);
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
     RESEARCH -- a persistent tree bought with research points earned
     by clearing waves and winning maps
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCHES = ['arsenal', 'economy', 'defense'];
  const TREE_BRANCH_INFO = {
    arsenal: { name: 'Arsenal', color: '#ff8a5a', icon: 'sword' },
    economy: { name: 'Economy', color: '#ffd75a', icon: 'coin' },
    defense: { name: 'Defense', color: '#5ab8ff', icon: 'shield' },
    abilities: { name: 'Abilities', color: '#c890ff', icon: 'bolt' }
  };

  // Families shown as lanes of the arsenal, with the unlock price of the locked ones
  const ARSENAL_LANES = [['arrow', 0], ['cannon', 0], ['frost', 0], ['spikes', 0], ['tesla', 4], ['poison', 4], ['flame', 5], ['laser', 7], ['sniper', 7]];

  const TREE = [];
  ARSENAL_LANES.forEach(([fam, unlockCost], row) => {
    const def = TOWER_BY_ID[fam];
    let col = 0;
    if (unlockCost) {
      TREE.push({ id: 'unlock_' + fam, branch: 'arsenal', col: 0, row, max: 1, cost: [unlockCost], req: [], tower: def.index,
        name: def.name, desc: `Unlocks the ${def.name} for building.`, effect: () => 'Can be built' });
      col = 1;
    } else
      col = 1;
    TREE.push({ id: 'power_' + fam, branch: 'arsenal', col, row, max: 2, cost: [3, 6], req: unlockCost ? ['unlock_' + fam] : [], tower: def.index, icon: 'sword',
      name: def.name + ' Drills', desc: `Every ${def.name} hits harder and reaches a little further.`, effect: (l) => `+${l * 12}% damage, +${l * 4}% range` });
    TREE.push({ id: 'master_' + fam, branch: 'arsenal', col: col + 1, row, max: 1, cost: [10], req: ['power_' + fam], tower: def.index, icon: 'crown',
      name: def.name + ' Mastery', desc: `Lets both ${def.name} specializations reach tier V.`, effect: () => 'Tier V unlocked' });
  });

  TREE.push(
    { id: 'chest', branch: 'economy', col: 0, row: 0, max: 3, cost: [4, 7, 10], req: [], icon: 'coin',
      name: 'War Chest', desc: 'Start every map with more gold.', effect: (l) => `+${l * 25} starting gold` },
    { id: 'bounty', branch: 'economy', col: 1, row: 0, max: 2, cost: [5, 9], req: ['chest'], icon: 'skull',
      name: 'Bounty Hunters', desc: 'Defeated enemies drop more gold.', effect: (l) => `+${l * 10}% kill gold` },
    { id: 'interest', branch: 'economy', col: 2, row: 0, max: 2, cost: [6, 10], req: ['bounty'], icon: 'up',
      name: 'Treasury', desc: 'Gold you keep earns interest whenever a wave is cleared.', effect: (l) => `${l * 2}% interest (max ${l * 25})` },
    { id: 'mine', branch: 'economy', col: 1, row: 1, max: 1, cost: [6], req: ['chest'], tower: TOWER_BY_ID.mine.index,
      name: 'Gold Mine', desc: 'Unlocks the Gold Mine for building.', effect: () => 'Can be built' },
    { id: 'master_mine', branch: 'economy', col: 2, row: 1, max: 1, cost: [10], req: ['mine'], tower: TOWER_BY_ID.mine.index, icon: 'crown',
      name: 'Mine Mastery', desc: 'Lets the Bank and the Alchemist reach tier V.', effect: () => 'Tier V unlocked' },
    { id: 'salvage', branch: 'economy', col: 1, row: 2, max: 1, cost: [5], req: ['chest'], icon: 'hammer',
      name: 'Salvage', desc: 'Selling towers returns more of their cost.', effect: () => 'Refund 75% instead of 60%' },
    { id: 'early', branch: 'economy', col: 2, row: 2, max: 1, cost: [4], req: ['salvage'], icon: 'play',
      name: 'Eager Recruits', desc: 'Calling a wave early pays half as much again.', effect: () => '+50% call-early bonus' },

    { id: 'fortify', branch: 'defense', col: 0, row: 0, max: 3, cost: [4, 7, 10], req: [], icon: 'heart',
      name: 'Fortify', desc: 'Thicker walls: start every map with more lives.', effect: (l) => `+${l * 3} lives` },
    { id: 'masonry', branch: 'defense', col: 1, row: 0, max: 2, cost: [4, 8], req: ['fortify'], icon: 'wrench',
      name: 'Masonry', desc: 'Sturdier towers that patch themselves up between waves.', effect: (l) => `+${l * 40}% structure, repair ${l * 20}% after each wave` },
    { id: 'laststand', branch: 'defense', col: 2, row: 0, max: 1, cost: [8], req: ['masonry'], icon: 'sword',
      name: 'Last Stand', desc: 'With the walls about to fall, every tower fights harder.', effect: () => '+25% damage below 30% lives' },
    { id: 'medic', branch: 'defense', col: 1, row: 1, max: 1, cost: [7], req: ['fortify'], icon: 'heart',
      name: 'Field Medics', desc: 'Every defeated boss restores lives.', effect: () => '+2 lives per boss' },
    { id: 'scouts', branch: 'defense', col: 2, row: 1, max: 1, cost: [6], req: ['medic'], icon: 'range',
      name: 'Scouts', desc: 'All towers spot stealthed enemies close to them.', effect: () => 'Phantoms visible within 1.5 tiles' }
  );

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;

  function techLevel(id) {
    const v = meta && meta.tree ? meta.tree[id] : 0;
    return Number.isInteger(v) && v > 0 ? Math.min(v, TREE_BY_ID[id] ? TREE_BY_ID[id].max : v) : 0;
  }

  function towerUnlocked(typeIndex) {
    const id = TOWER_TYPES[typeIndex].id;
    if (id === 'mine') return techLevel('mine') > 0;
    const lane = ARSENAL_LANES.find(l => l[0] === id);
    return !lane || !lane[1] || techLevel('unlock_' + id) > 0;
  }

  function masteryUnlocked(typeIndex) {
    return techLevel('master_' + TOWER_TYPES[typeIndex].id) > 0;
  }

  function treeNodeState(n) {
    const lvl = techLevel(n.id);
    if (lvl >= n.max) return 'owned';
    if (!n.req.every(r => techLevel(r) > 0)) return 'locked';
    return meta.rp >= n.cost[lvl] ? 'ready' : 'poor';
  }

  function buyTreeNode(n) {
    const st = treeNodeState(n);
    if (st !== 'ready') {
      audio.play('error');
      return false;
    }
    const lvl = techLevel(n.id);
    meta.rp -= n.cost[lvl];
    meta.tree[n.id] = lvl + 1;
    saveMeta();
    treeFlash[n.id] = performance.now();
    audio.play('powerup', { pitch: 1 + lvl * 0.1 });
    return true;
  }

  // Research points: one per wave cleared, more for winning and for new stars
  let lastRp = 0;
  function awardResearch(victory, newStars) {
    const waves = victory ? currentWave : Math.max(0, currentWave - 1);
    const rp = waves + (victory ? 5 : 0) + newStars * 5;
    meta.rp += rp;
    meta.rpEarned += rp;
    lastRp = rp;
    saveMeta();
    return rp;
  }

  /* ── Effects of the research on a match ── */
  function techDamageMul(def) {
    return 1 + techLevel('power_' + def.id) * 0.12;
  }

  function techRangeMul(def) {
    return 1 + techLevel('power_' + def.id) * 0.04;
  }

  /* ══════════════════════════════════════════════════════════════════
     RESEARCH SCREEN -- branch regions with cards, connectors routed in
     the gaps, smooth zoom and pan, keyboard focus
     ══════════════════════════════════════════════════════════════════ */

  const CARD_W = 176, CARD_H = 70, GAP_X = 40, GAP_Y = 16, REGION_PAD = 22, REGION_HEAD = 50, REGION_GAP = 60;
  const treeCam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
  const treeFlash = {};
  let treeTab = 'all';
  let treeFocus = null;
  let treeLayout = null;
  let treeDrag = null;
  let treeReturn = STATE_READY;

  function treeBranches() {
    const extra = typeof ABILITY_BRANCH !== 'undefined' && ABILITY_BRANCH ? ['abilities'] : [];
    return TREE_BRANCHES.concat(extra);
  }

  function computeTreeLayout() {
    if (treeLayout) return treeLayout;
    const nodes = [], regions = {};
    // Arsenal on the left, the other branches stacked on its right
    let rx = 0;
    const place = (branch, x, y) => {
      const list = TREE.filter(n => n.branch === branch);
      const cols = Math.max(...list.map(n => n.col)) + 1, rows = Math.max(...list.map(n => n.row)) + 1;
      const w = REGION_PAD * 2 + cols * CARD_W + (cols - 1) * GAP_X;
      const h = REGION_HEAD + REGION_PAD + rows * CARD_H + (rows - 1) * GAP_Y;
      regions[branch] = { x, y, w, h };
      for (const n of list)
        nodes.push({ n, x: x + REGION_PAD + n.col * (CARD_W + GAP_X), y: y + REGION_HEAD + n.row * (CARD_H + GAP_Y), w: CARD_W, h: CARD_H, branch });
      return { w, h };
    };
    const a = place('arsenal', 0, 0);
    rx = a.w + REGION_GAP;
    let ry = 0;
    for (const b of treeBranches().slice(1)) {
      const r = place(b, rx, ry);
      ry += r.h + REGION_GAP;
    }
    let maxX = 0, maxY = 0;
    for (const k in regions) {
      maxX = Math.max(maxX, regions[k].x + regions[k].w);
      maxY = Math.max(maxY, regions[k].y + regions[k].h);
    }
    regions.all = { x: 0, y: 0, w: maxX, h: maxY };
    const byId = {};
    for (const ln of nodes) byId[ln.n.id] = ln;
    treeLayout = { nodes, regions, byId };
    return treeLayout;
  }

  function treeView() {
    return { x: 8, y: 104, w: UW - 16, h: UH - 104 - 50 };
  }

  function fitTree(tab, instant) {
    const L = computeTreeLayout();
    const r = L.regions[tab] || L.regions.all;
    const v = treeView();
    const z = clamp(Math.min((v.w - 30) / r.w, (v.h - 30) / r.h), 0.25, 1.15);
    treeCam.tz = z;
    treeCam.tx = v.x + v.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = v.y + v.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      treeCam.x = treeCam.tx; treeCam.y = treeCam.ty; treeCam.z = treeCam.tz;
    }
  }

  function openResearch() {
    treeReturn = state;
    state = STATE_RESEARCH;
    treeLayout = null;
    treeTab = 'all';
    treeFocus = null;
    fitTree('all', true);
    audio.play('select');
    updateWindowTitle();
  }

  function closeResearch() {
    state = treeReturn === STATE_RESEARCH ? STATE_READY : treeReturn;
    treeDrag = null;
    audio.play('click', { pitch: 0.8 });
    updateWindowTitle();
  }

  function setTreeTab(tab) {
    treeTab = tab;
    fitTree(tab);
    if (treeFocus && tab !== 'all' && computeTreeLayout().byId[treeFocus].branch !== tab)
      treeFocus = null;
    audio.play('click');
  }

  function zoomTreeAt(ux, uy, f) {
    const z = clamp(treeCam.tz * f, 0.25, 1.6);
    const k = z / treeCam.tz;
    treeCam.tx = ux - (ux - treeCam.tx) * k;
    treeCam.ty = uy - (uy - treeCam.ty) * k;
    treeCam.tz = z;
  }

  function treePoint(ux, uy) {
    return { x: (ux - treeCam.x) / treeCam.z, y: (uy - treeCam.y) / treeCam.z };
  }

  function treeNodeAt(ux, uy) {
    const v = treeView();
    if (ux < v.x || uy < v.y || ux > v.x + v.w || uy > v.y + v.h) return null;
    const p = treePoint(ux, uy);
    for (const ln of computeTreeLayout().nodes)
      if ((treeTab === 'all' || ln.branch === treeTab) && p.x >= ln.x && p.x <= ln.x + ln.w && p.y >= ln.y && p.y <= ln.y + ln.h)
        return ln;
    return null;
  }

  function treeNodeTooltip(n) {
    const lvl = techLevel(n.id);
    const st = treeNodeState(n);
    const lines = [n.name + (n.max > 1 ? ` ${toRoman(Math.max(1, lvl))}/${toRoman(n.max)}` : ''), n.desc];
    lines.push('--- Effect ---');
    if (lvl > 0) lines.push(`✔ Now: ${n.effect(lvl)}`);
    if (lvl < n.max) lines.push(`★ Next: ${n.effect(lvl + 1)}`);
    if (st === 'locked') lines.push(`✘ Requires ${n.req.map(r => TREE_BY_ID[r].name).join(', ')}`);
    else if (st === 'poor') lines.push(`✘ Costs ${n.cost[lvl]} research (you have ${meta.rp})`);
    else if (st === 'ready') lines.push(`✔ Costs ${n.cost[lvl]} research · click or Enter`);
    else lines.push('✔ Fully researched');
    return lines;
  }

  function drawResearch() {
    const L = computeTreeLayout();
    const v = treeView();
    // Smooth camera
    const k = 1 - Math.exp(-frameDt * 12);
    if (!treeDrag) {
      const all = L.regions.all, keep = 140;
      treeCam.tx = clamp(treeCam.tx, v.x + keep - (all.x + all.w) * treeCam.tz, v.x + v.w - keep - all.x * treeCam.tz);
      treeCam.ty = clamp(treeCam.ty, v.y + keep - (all.y + all.h) * treeCam.tz, v.y + v.h - keep - all.y * treeCam.tz);
    }
    treeCam.x += (treeCam.tx - treeCam.x) * (treeDrag ? 1 : k);
    treeCam.y += (treeCam.ty - treeCam.y) * (treeDrag ? 1 : k);
    treeCam.z += (treeCam.tz - treeCam.z) * k;

    drawScrim(0.82);
    // Blueprint grid
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
    const step = 48 * treeCam.z;
    if (step > 8) {
      ctx.beginPath();
      for (let x = ((treeCam.x % step) + step) % step + v.x - step; x < v.x + v.w; x += step) { ctx.moveTo(Math.round(x) + 0.5, v.y); ctx.lineTo(Math.round(x) + 0.5, v.y + v.h); }
      for (let y = ((treeCam.y % step) + step) % step + v.y - step; y < v.y + v.h; y += step) { ctx.moveTo(v.x, Math.round(y) + 0.5); ctx.lineTo(v.x + v.w, Math.round(y) + 0.5); }
      ctx.strokeStyle = 'rgba(120,160,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.translate(treeCam.x, treeCam.y);
    ctx.scale(treeCam.z, treeCam.z);
    // Regions
    for (const b of treeBranches()) {
      const r = L.regions[b], info = TREE_BRANCH_INFO[b];
      if (!r) continue;
      const dim = treeTab !== 'all' && treeTab !== b;
      ctx.globalAlpha = dim ? 0.25 : 1;
      roundRectPath(r.x, r.y, r.w, r.h, 18);
      ctx.fillStyle = hexToRgba(info.color, 0.05);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(info.color, 0.3);
      ctx.stroke();
      const list = TREE.filter(n => n.branch === b);
      let owned = 0, total = 0;
      for (const n of list) { total += n.max; owned += techLevel(n.id); }
      drawIcon(info.icon, r.x + REGION_PAD + 10, r.y + REGION_HEAD / 2, 22);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lw = fitText(info.name, r.x + REGION_PAD + 28, r.y + REGION_HEAD / 2 + 1, r.w * 0.45, 24, { weight: 'bold', color: info.color });
      const mx = r.x + REGION_PAD + 40 + lw, mw = Math.min(200, r.x + r.w - REGION_PAD - mx - 70);
      if (mw > 40) {
        drawMeter(mx, r.y + REGION_HEAD / 2 - 5, mw, 10, owned / total, info.color);
        fitText(`${owned}/${total}`, mx + mw + 10, r.y + REGION_HEAD / 2 + 1, 60, 14, { weight: 'bold', color: UI.textDim });
      }
      ctx.globalAlpha = 1;
    }
    // Connectors: locked dashed, owned solid
    ctx.lineCap = 'round';
    for (const ln of L.nodes) {
      for (const rid of ln.n.req) {
        const p = L.byId[rid];
        if (!p) continue;
        const own = techLevel(rid) > 0, done = techLevel(ln.n.id) > 0;
        const color = TREE_BRANCH_INFO[ln.branch].color;
        ctx.globalAlpha = treeTab !== 'all' && treeTab !== ln.branch ? 0.25 : 1;
        ctx.strokeStyle = own ? (done ? color : hexToRgba(color, 0.65)) : 'rgba(140,150,180,0.35)';
        ctx.lineWidth = own ? (done ? 4 : 3) : 2;
        ctx.setLineDash(own ? [] : [6, 6]);
        const x0 = p.x + p.w, y0 = p.y + p.h / 2, x1 = ln.x, y1 = ln.y + ln.h / 2;
        const mx = x0 + GAP_X / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        if (Math.abs(y0 - y1) < 1) ctx.lineTo(x1, y1);
        else if (x1 > x0) {
          ctx.lineTo(mx - 8, y0); ctx.arcTo(mx, y0, mx, y0 + Math.sign(y1 - y0) * 8, 8);
          ctx.lineTo(mx, y1 - Math.sign(y1 - y0) * 8); ctx.arcTo(mx, y1, mx + 8, y1, 8);
          ctx.lineTo(x1, y1);
        } else {
          // Same column, below: drop down from the parent's bottom
          ctx.moveTo(p.x + p.w / 2, p.y + p.h); ctx.lineTo(ln.x + ln.w / 2, ln.y);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Cards
    const hoverLn = pointer.inside ? treeNodeAt(pointer.ux, pointer.uy) : null;
    for (const ln of L.nodes)
      drawTreeCard(ln, hoverLn === ln);
    ctx.restore();
    drawTreeHeader();
    // Tooltip for hover / keyboard focus
    const tipLn = hoverLn || (treeFocus && L.byId[treeFocus]);
    if (tipLn) {
      const z = treeCam.z;
      addRegion({ id: 'tree-node-' + tipLn.n.id, x: treeCam.x + tipLn.x * z, y: treeCam.y + tipLn.y * z, w: tipLn.w * z, h: tipLn.h * z, anchorTip: true,
        tip: () => treeNodeTooltip(tipLn.n), onClick: () => { treeFocus = tipLn.n.id; buyTreeNode(tipLn.n); }, sound: false });
    }
  }

  function drawTreeCard(ln, hover) {
    const n = ln.n, st = treeNodeState(n), lvl = techLevel(n.id);
    const color = TREE_BRANCH_INFO[ln.branch].color;
    const x = ln.x, y = ln.y, w = ln.w, h = ln.h;
    const focus = treeFocus === n.id;
    ctx.save();
    if (treeTab !== 'all' && treeTab !== ln.branch) ctx.globalAlpha = 0.25;
    roundRectPath(x + 3, y + 5, w, h, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (st === 'owned') { g.addColorStop(0, hexToRgba(color, 0.42)); g.addColorStop(1, hexToRgba(color, 0.18)); }
    else if (st === 'ready') { g.addColorStop(0, 'rgba(40,52,84,0.97)'); g.addColorStop(1, 'rgba(18,24,42,0.97)'); }
    else if (st === 'poor') { g.addColorStop(0, 'rgba(46,40,30,0.95)'); g.addColorStop(1, 'rgba(24,20,14,0.95)'); }
    else { g.addColorStop(0, 'rgba(22,24,34,0.95)'); g.addColorStop(1, 'rgba(12,13,20,0.95)'); }
    roundRectPath(x, y, w, h, 10);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = st === 'ready' ? 2.5 : 1.5;
    ctx.strokeStyle = st === 'owned' ? color : st === 'ready' ? hexToRgba(color, 0.95) : st === 'poor' ? 'rgba(255,182,72,0.6)' : 'rgba(120,130,160,0.35)';
    ctx.stroke();
    if (st === 'ready') {
      roundRectPath(x - 3, y - 3, w + 6, h + 6, 12);
      ctx.strokeStyle = hexToRgba(color, 0.25 + 0.2 * Math.sin(animTime * 4));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (hover || focus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 13);
      ctx.strokeStyle = focus ? UI.gold : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = focus ? 3 : 2;
      ctx.stroke();
    }
    // Icon well
    roundRectPath(x + 8, y + 8, 44, 44, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    const dim = st === 'locked' ? 0.4 : 1;
    ctx.globalAlpha *= dim;
    if (n.tower !== undefined && !n.icon)
      drawTowerIcon(n.tower, 3, x + 30, y + 30, 40);
    else if (n.tower !== undefined) {
      drawTowerIcon(n.tower, 1, x + 30, y + 30, 36);
      drawIcon(n.icon, x + 44, y + 44, 16);
    } else
      drawIcon(n.icon, x + 30, y + 30, 28);
    ctx.globalAlpha /= dim;
    // Level pips
    if (n.max > 1) {
      const pw = 10;
      for (let i = 0; i < n.max; ++i) {
        ctx.fillStyle = i < lvl ? color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 30 - (n.max * (pw + 2) - 2) / 2 + i * (pw + 2), y + 56, pw, 5);
      }
    }
    if (st === 'owned') drawIcon('check', x + w - 16, y + 15, 18);
    else if (st === 'locked') drawIcon('lock', x + w - 16, y + 15, 16, 0.7);
    // Name and cost
    ctx.textAlign = 'left';
    const tx = x + 60, tw = w - 60 - (st === 'owned' || st === 'locked' ? 28 : 8);
    drawTextBlock(n.name, tx, y + 6, tw, 38, 15, { weight: 'bold', color: st === 'locked' ? '#6a7288' : '#ffffff', valign: 'middle', lineGap: 1.1, minPx: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (st === 'owned')
      fitText('Researched', tx, y + h - 14, w - 70, 12, { weight: 'bold', color });
    else
      fitText(`[[flask]] ${n.cost[lvl]}`, tx, y + h - 14, w - 70, 14, { weight: 'bold', color: st === 'ready' ? '#d8f5dc' : st === 'poor' ? '#ff8a8a' : '#6a7288' });
    // Purchase flash
    const f = treeFlash[n.id];
    if (f !== undefined) {
      const t = (performance.now() - f) / 600;
      if (t >= 1) delete treeFlash[n.id];
      else {
        roundRectPath(x - t * 16, y - t * 16, w + t * 32, h + t * 32, 10 + t * 10);
        ctx.lineWidth = 4 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
        roundRectPath(x, y, w, h, 10);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTreeHeader() {
    drawPanel(8, 8, UW - 16, 90, { accent: UI.gold, radius: 12 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Research', 26, 32, 200, 24, { weight: 'bold', color: UI.gold });
    const w = drawChip(`[[flask]] ${meta.rp} research`, 150, 20, 26, { px: 14, bg: 'rgba(200,144,255,0.18)', border: 'rgba(200,144,255,0.6)', color: '#ffffff' });
    ctx.textAlign = 'left';
    fitText('Earn research by clearing waves, winning maps and earning stars.', 160 + w, 33, UW - 170 - w - 130, 12, { color: UI.textDim });
    uiButton('tree-close', UW - 116, 18, 96, 30, 'Back', { px: 13, key: 'Esc', onClick: closeResearch });
    const tabs = ['all'].concat(treeBranches());
    const tw = Math.min(170, (UW - 48 - (tabs.length - 1) * 8) / tabs.length);
    tabs.forEach((t, i) => {
      const info = TREE_BRANCH_INFO[t];
      let label = t === 'all' ? 'All' : info.name;
      if (t !== 'all') {
        let o = 0, c = 0;
        for (const n of TREE) if (n.branch === t) { c += n.max; o += techLevel(n.id); }
        label += `  ${o}/${c}`;
      }
      uiButton('tree-tab-' + t, 24 + i * (tw + 8), 58, tw, 30, label, { style: treeTab === t ? 'gold' : 'dark', px: 12, icon: info ? info.icon : 'star', key: String(i + 1), onClick: () => setTreeTab(t) });
    });
    // Footer: legend and controls
    const fy = UH - 44;
    drawPanel(8, fy, UW - 16, 36, { radius: 10, accent: '#6a8ac8' });
    let lx = 22;
    for (const [label, st] of [['Researched', 'owned'], ['Can buy', 'ready'], ['Need research', 'poor'], ['Locked', 'locked']]) {
      roundRectPath(lx, fy + 11, 22, 14, 4);
      ctx.fillStyle = st === 'owned' ? 'rgba(255,215,90,0.35)' : st === 'ready' ? 'rgba(40,52,84,0.97)' : st === 'poor' ? 'rgba(46,40,30,0.95)' : 'rgba(22,24,34,0.95)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.gold;
      ctx.stroke();
      ctx.textAlign = 'left';
      lx += 28 + fitText(label, lx + 28, fy + 19, 110, 12, { color: UI.textDim }) + 16;
    }
    drawKeyHints([{ key: 'Wheel', label: 'Zoom' }, { key: 'Drag', label: 'Pan' }, { key: '←↑→↓', label: 'Select' }, { key: 'Enter', label: 'Buy' }, { key: 'Tab', label: 'Branch' }, { key: '0', label: 'Fit' }],
      (lx + UW - 16) / 2, fy + 18, UW - 24 - lx - 10);
  }

  function handleResearchKey(e) {
    const L = computeTreeLayout();
    const tabs = ['all'].concat(treeBranches());
    const code = e.code;
    if (code === 'Escape') { closeResearch(); return; }
    if (code === 'Tab') { setTreeTab(tabs[(tabs.indexOf(treeTab) + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]); return; }
    if (/^Digit[1-9]$/.test(code)) {
      const i = +code.slice(5) - 1;
      if (i < tabs.length) setTreeTab(tabs[i]);
      return;
    }
    const v = treeView();
    if (code === 'Equal' || code === 'NumpadAdd') { zoomTreeAt(v.x + v.w / 2, v.y + v.h / 2, 1.2); return; }
    if (code === 'Minus' || code === 'NumpadSubtract') { zoomTreeAt(v.x + v.w / 2, v.y + v.h / 2, 1 / 1.2); return; }
    if (code === 'Digit0' || code === 'Numpad0' || code === 'Home') { fitTree(treeTab); return; }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const inTab = (ln) => treeTab === 'all' || ln.branch === treeTab;
    if (dirs[code]) {
      const d = dirs[code];
      const cur = treeFocus && L.byId[treeFocus];
      let next = null;
      if (!cur || !inTab(cur))
        next = L.nodes.find(ln => inTab(ln) && treeNodeState(ln.n) === 'ready') || L.nodes.find(inTab);
      else {
        let best = 1e9;
        for (const ln of L.nodes) {
          if (ln === cur || !inTab(ln)) continue;
          const dx = ln.x + ln.w / 2 - (cur.x + cur.w / 2), dy = ln.y + ln.h / 2 - (cur.y + cur.h / 2);
          const along = dx * d[0] + dy * d[1];
          if (along <= 1) continue;
          const score = along + (Math.abs(dx * d[1]) + Math.abs(dy * d[0])) * 2.5;
          if (score < best) { best = score; next = ln; }
        }
      }
      if (next) {
        treeFocus = next.n.id;
        // Keep the focused card on screen
        const z = treeCam.tz, m = 30;
        const sx = treeCam.tx + next.x * z, sy = treeCam.ty + next.y * z;
        if (sx < v.x + m) treeCam.tx += v.x + m - sx;
        else if (sx + next.w * z > v.x + v.w - m) treeCam.tx -= sx + next.w * z - (v.x + v.w - m);
        if (sy < v.y + m) treeCam.ty += v.y + m - sy;
        else if (sy + next.h * z > v.y + v.h - m) treeCam.ty -= sy + next.h * z - (v.y + v.h - m);
        audio.play('click', { pitch: 1.4, volume: 0.5 });
      }
      return;
    }
    if ((code === 'Enter' || code === 'Space' || code === 'NumpadEnter') && treeFocus)
      buyTreeNode(TREE_BY_ID[treeFocus]);
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
    addRegion({ id: 'hud-lives', x, y, w: lw, h, tip: () => ['Lives', `${lives} of ${startLives()} left`, 'Every enemy that reaches the exit costs a life (bosses cost more).'] });
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
    const locked = !towerUnlocked(i);
    const afford = gold >= def.cost && !locked;
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
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (locked ? 0.25 : afford ? 1 : 0.5);
    drawTowerIcon(i, 1, x + w / 2, y - lift + 4 + iconSize / 2, iconSize);
    ctx.globalAlpha = pa;
    if (locked)
      drawIcon('lock', x + w / 2, y - lift + 4 + iconSize / 2, Math.min(22, iconSize * 0.6));
    // Name and cost
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(def.name, x + w / 2, y - lift + h - 21, w - 6, 11, { weight: 'bold', color: locked ? UI.textMute : afford ? UI.text : UI.textDim, minPx: 7 });
    if (locked)
      fitText('[[flask]] Research', x + w / 2, y - lift + h - 8, w - 6, 10, { weight: 'bold', color: '#b89aff', minPx: 7 });
    else
      fitText(`[[coin]]${def.cost}`, x + w / 2, y - lift + h - 8, w - 6, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad, minPx: 7 });
    const hk = towerHotkey(i);
    if (hk)
      drawKeycap(hk, x + 3, y - lift + 3, 9);
    ctx.restore();
    addRegion({
      id, x, y: y - lift, w, h, anchorTip: true,
      onClick: () => selectBuildType(i),
      tip: () => towerUnlocked(i) ? buildTooltip(i) : [TOWER_TYPES[i].name, TOWER_TYPES[i].desc, '✘ Locked: unlock it in Research (from the title screen or the campaign map).']
    });
  }

  function selectBuildType(i) {
    if (!towerUnlocked(i)) {
      audio.play('error');
      floatingText.add(WORLD_W / 2, WORLD_H - 30, `${TOWER_TYPES[i].name} is locked: unlock it in Research`, { color: '#b89aff', font: 'bold 12px sans-serif', life: 1.8 });
      return;
    }
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
    if (t.tier === 4 && !masteryUnlocked(t.type)) {
      uiButton('insp-up', r.x + 10, y, bw, 38, 'Mastery needs research', { style: 'dark', icon: 'lock', sub: `${TOWER_TYPES[t.type].name} Mastery`, disabled: true,
        onDisabled: () => audio.play('error'),
        tip: () => ['Tier V is locked', `Research "${TOWER_TYPES[t.type].name} Mastery" to let this tower reach its final form.`] });
      y += 44;
    } else if (t.tier < 3 || t.tier === 4) {
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

    const pw = Math.min(380, UW - 40), ph = savedGameInfo ? 262 : 210;
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
    uiButton('title-research', px + 20, y, bw, 38, 'Research', { style: 'dark', icon: 'flask', px: 14, key: 'R', sub: `${meta.rp} research to spend`, onClick: () => openResearch(),
      tip: () => ['Research', 'Permanent upgrades: unlock towers, train them, grow your economy and defenses.', `★ ${meta.rp} research available`] });
    y += 44;
    uiButton('title-help', px + 20, y, bw, 36, 'How to play', { style: 'blue', icon: 'help', px: 13, key: 'H', onClick: () => openHelp() });
    if (saveNotice) {
      ctx.textAlign = 'center';
      fitText(saveNotice, cx, py + ph + 18, UW - 40, 12, { color: UI.warn });
    }
    drawKeyHints(savedGameInfo
      ? [{ key: 'Enter', label: 'Continue' }, { key: 'C', label: 'Campaign' }, { key: 'R', label: 'Research' }, { key: 'H', label: 'Help' }]
      : [{ key: 'Enter', label: 'Campaign' }, { key: 'R', label: 'Research' }, { key: 'H', label: 'Help' }], cx, UH - 22, UW - 40);
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
    fitText(`[[star]] ${totalStars()} / ${MAPS.length * 3}`, UW - pad - 290, 8 + hh / 2 + 1, 120, 16, { weight: 'bold', color: '#ffffff' });
    uiButton('ms-research', UW - pad - 274, 16, 156, hh - 16, `Research · ${meta.rp}`, { px: 12, icon: 'flask', key: 'R', onClick: () => openResearch() });
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
      ['coin', 'Starting gold', String(m.startGold + techLevel('chest') * 25)],
      ['heart', 'Lives', String(m.startLives + techLevel('fortify') * 3)],
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
    const pw = Math.min(440, UW - 40), ph = victory ? 340 : 296;
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
      ['heart', 'Lives left', `${lives} / ${startLives()}`]
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
    drawIcon('flask', px + 30, y + 9, 16);
    ctx.textAlign = 'left';
    fitText('Research earned', px + 46, y + 10, pw * 0.5, 13, { color: '#c8a8ff' });
    ctx.textAlign = 'right';
    fitText(`+${lastRp}  (${meta.rp} to spend)`, px + pw - 24, y + 10, pw * 0.45, 15, { weight: 'bold', color: '#e0ccff' });
    y += 34;
    const bw = (pw - 52) / 2;
    if (victory) {
      const hasNext = currentMap + 1 < MAPS.length;
      uiButton('end-next', px + 20, y, bw, 44, hasNext ? 'Next map' : 'Campaign', { style: 'gold', icon: 'play', key: 'Enter', px: 14,
        onClick: () => { if (hasNext) { currentMap += 1; resetAndStart(); } else openMapSelect(); } });
      uiButton('end-retry', px + 32 + bw, y, bw, 44, 'Play again', { style: 'dark', key: 'R', px: 14, onClick: resetAndStart });
      uiButton('end-maps', px + 20, y + 52, bw, 32, 'Campaign map', { style: 'dark', key: 'M', px: 12, onClick: openMapSelect });
      uiButton('end-research', px + 32 + bw, y + 52, bw, 32, 'Research', { style: 'dark', icon: 'flask', key: 'T', px: 12, onClick: openResearch });
    } else {
      uiButton('end-retry', px + 20, y, bw, 44, 'Try again', { style: 'gold', icon: 'play', key: 'Enter', px: 14, onClick: resetAndStart });
      uiButton('end-maps', px + 32 + bw, y, bw, 44, 'Campaign map', { style: 'dark', key: 'M', px: 13, onClick: openMapSelect });
      uiButton('end-research', px + 20, y + 52, pw - 40, 32, `Research · ${meta.rp} to spend`, { style: 'dark', icon: 'flask', key: 'T', px: 12, onClick: openResearch });
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
     FRAME
     ══════════════════════════════════════════════════════════════════ */

  function drawFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld();

    setUiTransform();
    regions = [];
    drawDanger();
    if (state === STATE_PLAYING || state === STATE_BUILD || state === STATE_PAUSED)
      drawBossIntro();
    if (state === STATE_READY) {
      drawTitleScreen();
    } else if (state === STATE_MAP_SELECT) {
      drawMapSelect();
    } else if (state === STATE_RESEARCH) {
      drawResearch();
    } else {
      drawTopBar();
      if (!bossIntro) drawBossBar();
      drawBuildBar();
      drawInspector();
      drawBanner();
      updateDrawCoins();
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
    drawTransition();
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

    updateEffects(dt);
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
    particles.clear();
    floatingText.clear();
    decals.length = 0;
    corpses.length = 0;
    uiCoins.length = 0;
    banner = null;
    hitstop = 0;
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
    const px0 = pointer.ux, py0 = pointer.uy;
    readPointer(e);
    kbCursor.active = false;
    if (treeDrag && state === STATE_RESEARCH) {
      treeDrag.moved += Math.abs(pointer.ux - px0) + Math.abs(pointer.uy - py0);
      treeCam.tx = treeCam.x = treeDrag.cx + (pointer.ux - treeDrag.ux);
      treeCam.ty = treeCam.y = treeDrag.cy + (pointer.uy - treeDrag.uy);
    }
  });

  window.addEventListener('pointerup', () => {
    treeDrag = null;
  });

  canvas.addEventListener('wheel', (e) => {
    if (state !== STATE_RESEARCH) return;
    e.preventDefault();
    readPointer(e);
    zoomTreeAt(pointer.ux, pointer.uy, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  let touchPending = null;   // first tap of a touch placement: { col, row }

  canvas.addEventListener('pointerdown', (e) => {
    readPointer(e);
    kbCursor.active = false;
    if (e.button === 2) return;
    const r = regionAt(pointer.ux, pointer.uy);
    if (state === STATE_RESEARCH && (!r || /^tree-node-/.test(r.id))) {
      const v = treeView();
      if (!r && pointer.ux >= v.x && pointer.uy >= v.y && pointer.ux <= v.x + v.w && pointer.uy <= v.y + v.h) {
        treeDrag = { ux: pointer.ux, uy: pointer.uy, cx: treeCam.x, cy: treeCam.y, moved: 0 };
        return;
      }
    }
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

    if (state === STATE_RESEARCH) {
      e.preventDefault();
      handleResearchKey(e);
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
      } else if (code === 'KeyR') {
        e.preventDefault();
        openResearch();
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
      } else if (code === 'KeyR') {
        e.preventDefault();
        openResearch();
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
      } else if (code === 'KeyT') {
        openResearch();
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
        : state === STATE_RESEARCH
          ? 'Tower Defense -- Research'
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
