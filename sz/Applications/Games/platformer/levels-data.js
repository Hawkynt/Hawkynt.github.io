;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Worlds, hand-made level chunks and the level builder.
   *
   * Every level is a chain of chunks: a start chunk, a run of hand-made
   * segments picked for the world and the level's difficulty, and a goal
   * chunk (or a boss arena). Chunks are compact tile strings, 18 rows tall
   * once padded at the top, whose first and last two columns always stand on
   * the standard floor (ground top at row 14), so any two chunks connect.
   * The builder is deterministic: a seed per level, so the campaign never
   * changes, while Endless and the Daily run feed it other seeds.
   *
   * Tile legend:  .  empty      #  ground       =  one-way ledge   ^  spikes
   *               T  spring     ~  liquid       I  ice             F  fake wall (secret)
   *               ?  coin block !  power block  B  crate           K  crumbling block
   * Entities:     S  start      G  goal         C  checkpoint      o  coin
   *               *  gem spot   e  ground foe   a  air foe         k  turret
   *               x  spiky foe  M..m  sliding platform (left end, last left end)
   *               V..v  lift (bottom, top in the same column)      X  boss    W  arena gate
   */

  const ROWS = 18;
  const GROUND_ROW = 14;
  const TS = 48;

  const WORLDS = [
    {
      id: 'meadow', name: 'Sunleaf Meadows', short: 'Meadows', color: '#7ad04a', accent: '#ffd75a',
      ground: ['walker', 'walker', 'hopper', 'charger'], air: ['flyer'],
      boss: 'slime', bossName: 'King Gloop', liquid: 'water', transform: null
    },
    {
      id: 'caverns', name: 'Glimmer Caverns', short: 'Caverns', color: '#6ab8ff', accent: '#b88aff',
      ground: ['walker', 'spiky', 'charger', 'walker'], air: ['flyer', 'diver'],
      boss: 'golem', bossName: 'Crystal Golem', liquid: 'water', transform: 'ceiling'
    },
    {
      id: 'peaks', name: 'Frostfang Peaks', short: 'Peaks', color: '#bfe6ff', accent: '#7ad8ff',
      ground: ['walker', 'hopper', 'spiky', 'charger'], air: ['diver', 'flyer'],
      boss: 'yeti', bossName: 'Old Rimeback', liquid: 'icewater', transform: 'ice'
    },
    {
      id: 'forge', name: 'Cinder Forge', short: 'Forge', color: '#ff7a3a', accent: '#ffcf4a',
      ground: ['charger', 'spiky', 'hopper', 'walker'], air: ['flyer', 'diver'],
      boss: 'drake', bossName: 'Magma Drake', liquid: 'lava', transform: 'lava'
    },
    {
      id: 'citadel', name: 'Skyspire Citadel', short: 'Citadel', color: '#c8a8ff', accent: '#ffe08a',
      ground: ['walker', 'charger', 'spiky', 'hopper'], air: ['diver', 'flyer'],
      boss: 'sorcerer', bossName: 'The Storm Regent', liquid: 'void', transform: 'islands'
    }
  ];

  const LEVEL_NAMES = [
    ['First Steps', 'Buttercup Hills', 'Orchard Run', 'Windmill Way', 'Brookside Dash', 'Gloop\'s Garden'],
    ['Lantern Mouth', 'Crystal Choir', 'The Deep Mine', 'Echo Falls', 'Glowworm Gallery', 'Golem\'s Heart'],
    ['Snowcap Trail', 'Frozen Falls', 'Icicle Ridge', 'Avalanche Pass', 'Glacier Steps', 'Rimeback\'s Lair'],
    ['Ash Gate', 'Bellows Bridge', 'Slag Rivers', 'The Crucible', 'Ember Spires', 'Drake\'s Throne'],
    ['Cloud Docks', 'Gale Gardens', 'Thunder Steps', 'Starlit Ramparts', 'The High Vault', 'Regent\'s Spire']
  ];

  /* chunks: id, d = difficulty 1-5, world = null (shared) or world index */
  const CHUNKS = [
    { id: 'start', d: 0, special: 'start', rows: [
      '..............',
      '..............',
      '..............',
      '..S...........',
      '##############',
      '##############',
      '##############',
      '##############'
    ] },
    { id: 'goal', d: 0, special: 'goal', rows: [
      '..................',
      '..........ooo.....',
      '.........o...o....',
      '..................',
      '.......#..........',
      '......##.....G....',
      '##################',
      '##################',
      '##################',
      '##################'
    ] },
    { id: 'arena', d: 0, special: 'arena', rows: [
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '.............*........*.........',
      '...........=====....=====.......',
      '........*.......................',
      '.......====............====.....',
      '................................',
      '..====....................====..',
      '.W.................X.........G..',
      '################################',
      '################################',
      '################################',
      '################################'
    ] },

    /* ── shared chunks ── */
    { id: 'meadow', d: 1, rows: [
      '................',
      '................',
      '................',
      '.......ooo......',
      '......o...o.....',
      '................',
      '.....e......e...',
      '################',
      '################',
      '################',
      '################'
    ] },
    { id: 'blocks', d: 1, rows: [
      '..................',
      '..................',
      '..................',
      '.....?!?...?......',
      '..................',
      '...o.o.o...o......',
      '...........e......',
      '##################',
      '##################',
      '##################',
      '##################'
    ] },
    { id: 'hillock', d: 1, rows: [
      '....................',
      '.........*..........',
      '....................',
      '........ooo.........',
      '.......#####........',
      '......#######.......',
      '..e..#########...e..',
      '####################',
      '####################',
      '####################',
      '####################'
    ] },
    { id: 'twin-gaps', d: 1, rows: [
      '..................',
      '....ooo....ooo....',
      '..................',
      '..................',
      '..................',
      '.........e........',
      '##...#####...#####',
      '##...#####...#####',
      '##...#####...#####',
      '##...#####...#####'
    ] },
    { id: 'crates', d: 1, rows: [
      '....................',
      '....................',
      '..........ooo.......',
      '.........#####......',
      '.........#oo*#......',
      '.........BBBBB......',
      '...e..............e.',
      '####################',
      '####################',
      '####################',
      '####################'
    ] },
    { id: 'canopy', d: 2, rows: [
      '......................',
      '...........ooo........',
      '..........=====.......',
      '....ooo...............',
      '...=====.......===....',
      '......................',
      '...........a..........',
      '...................*..',
      '...............=====..',
      '..........e...........',
      '######################',
      '######################',
      '######################',
      '######################'
    ] },
    { id: 'steps', d: 1, rows: [
      '...........*..........',
      '..........oooo........',
      '..........####........',
      '......o...####...o....',
      '.....###..####..###...',
      '..o..###..####..###...',
      '..##.###..####..###.e.',
      '######################',
      '######################',
      '######################',
      '######################'
    ] },
    { id: 'ladder', d: 2, rows: [
      '................',
      '.......*........',
      '......===.......',
      '..........o.....',
      '.........===....',
      '....o...........',
      '...===..........',
      '.......o........',
      '......===.......',
      '..........e.....',
      '################',
      '################',
      '################',
      '################'
    ] },
    { id: 'spike-run', d: 2, rows: [
      '......................',
      '......................',
      '.......o.....o........',
      '......................',
      '......===...===....o..',
      '...^^^...^^^^^...^^^..',
      '######################',
      '######################',
      '######################',
      '######################'
    ] },
    { id: 'spring-tower', d: 2, rows: [
      '..................',
      '..........*.......',
      '.........###......',
      '.........###......',
      '.........###......',
      '.........###......',
      '.........###......',
      '.........###......',
      '.....o...###......',
      '.....T...###...o..',
      '##################',
      '##################',
      '##################',
      '##################'
    ] },
    { id: 'pillars', d: 3, rows: [
      '......................',
      '.....o...*o....o......',
      '......................',
      '......................',
      '....#....#....#.......',
      '....#....#....#.......',
      '##..#....#....#....###',
      '##..#....#....#....###',
      '##..#....#....#....###',
      '##..#....#....#....###'
    ] },
    { id: 'slider', d: 2, rows: [
      '......................',
      '.........ooo..........',
      '......................',
      '......................',
      '......................',
      '...M.........m........',
      '......................',
      '######...........#####',
      '######...........#####',
      '######...........#####',
      '######...........#####'
    ] },
    { id: 'lift', d: 3, rows: [
      '........................',
      '.........ooo..*.........',
      '........#######.........',
      '........#######.........',
      '....v...#######.........',
      '........#######.........',
      '........#######.........',
      '........#######.........',
      '........#######.........',
      '........#######.........',
      '....V...#######......e..',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'crumble-bridge', d: 3, rows: [
      '......................',
      '.......o..o..o........',
      '......................',
      '......................',
      '......................',
      '......................',
      '###..KKKKKKKKKKK...###',
      '###................###',
      '###................###',
      '###................###'
    ] },
    { id: 'turret-alley', d: 3, rows: [
      '..........*.............',
      '........................',
      '.........ooo............',
      '........=====...........',
      '................k.......',
      '...............###......',
      '..e............###...e..',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'secret-hill', d: 2, rows: [
      '......................',
      '......................',
      '.........ooo..........',
      '........######........',
      '.......########.......',
      '......##########......',
      '.....FF.oo*o#####.....',
      '..e..############..e..',
      '######################',
      '######################',
      '######################',
      '######################'
    ] },
    { id: 'zigzag', d: 3, rows: [
      '........................',
      '..............*.........',
      '........................',
      '..............o.........',
      '.............===........',
      '.........o..............',
      '........===........o....',
      '....o.............===...',
      '...===..................',
      '........................',
      '##^^^^^^^^^^^^^^^^^^^^##',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'trench', d: 2, rows: [
      '......................',
      '......................',
      '......................',
      '......................',
      '...o..............o...',
      '......................',
      '##......oooo.......###',
      '##..................##',
      '##*......e..........##',
      '######################'
    ] },
    { id: 'overhang', d: 2, rows: [
      '........................',
      '........................',
      '.......##########.......',
      '.......#^^^^^^^^#.......',
      '........................',
      '.....o..o..o..o..o......',
      '........................',
      '........................',
      '...........e............',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'long-jumps', d: 4, rows: [
      '..........................',
      '.....o.....o.....o........',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '##....###....###....######',
      '##....###....###....######',
      '##....###....###....######',
      '##....###....###....######'
    ] },
    { id: 'spring-pit', d: 3, rows: [
      '........................',
      '........................',
      '........ooo.............',
      '........................',
      '......=====..o.o........',
      '................*.......',
      '...............===......',
      '........................',
      '........................',
      '..T........T............',
      '####^^^^^^###^^^^^^#####',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'brawl', d: 3, rows: [
      '........................',
      '........................',
      '......a.........a.......',
      '........................',
      '..........?!?...........',
      '........................',
      '........................',
      '...e........e.......e...',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'high-road', d: 4, rows: [
      '..........................',
      '..........................',
      '...................*......',
      '..........................',
      '.......o...o...o...o......',
      '......===.===.===.===.....',
      '...o......................',
      '..===.....................',
      '.......^^...^^...^^...e...',
      '##########################',
      '##########################',
      '##########################',
      '##########################'
    ] },
    { id: 'twin-lifts', d: 4, rows: [
      '............................',
      '............................',
      '..........v.................',
      '...................*........',
      '....v.......ooo.............',
      '...............====.........',
      '............................',
      '............................',
      '............................',
      '............................',
      '....V.....V.................',
      '##....................######',
      '##....................######',
      '##....................######',
      '##....................######'
    ] },
    { id: 'gauntlet', d: 5, rows: [
      '..........................',
      '..........................',
      '..........ooo.............',
      '........*.................',
      '..........................',
      '..................###.....',
      '....M.......m.....###.....',
      '..................###.....',
      '..................###..k..',
      '#####.............###.####',
      '#####^^^^^^^^^^^^^###^####',
      '##########################',
      '##########################'
    ] },
    { id: 'islets', d: 4, rows: [
      '..........................',
      '......o.....o.....o.......',
      '..........................',
      '..........................',
      '..........................',
      '.....##....##....##.......',
      '.....##....##....##.......',
      '##...##....##....##...####',
      '##...##....##....##...####',
      '##...##....##....##...####',
      '##...##....##....##...####'
    ] },
    { id: 'tunnel', d: 3, rows: [
      '........................',
      '........................',
      '....####################',
      '....####################',
      '....###............#####',
      '..........oooooo........',
      '............x...........',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'vault', d: 4, rows: [
      '..........................',
      '..............*...........',
      '.............###..........',
      '..........................',
      '..........................',
      '..........................',
      '.................o.o......',
      '.........T.......===......',
      '.........#####............',
      '..e......#####......x.....',
      '##########################',
      '##########################',
      '##########################',
      '##########################'
    ] },

    /* ── meadow ── */
    { id: 'brook', d: 1, world: 0, rows: [
      '............*...........',
      '.........ooo.ooo........',
      '........................',
      '........................',
      '......===...===..==.....',
      '........................',
      '####~~~~~~~~~~~~~~~~####',
      '####~~~~~~~~~~~~~~~~####',
      '########################',
      '########################'
    ] },
    { id: 'orchard', d: 2, world: 0, rows: [
      '..........................',
      '..........................',
      '..........................',
      '....?.?.?.......!.........',
      '..........................',
      '..........................',
      '......e......e......e.....',
      '##########################',
      '##########################',
      '##########################',
      '##########################'
    ] },
    { id: 'windmill', d: 3, world: 0, rows: [
      '......................',
      '..........*...........',
      '.........===..........',
      '......................',
      '.....=====....=====...',
      '......................',
      '.............o.o......',
      '..o.o.................',
      '........T.......e.....',
      '######################',
      '######################',
      '######################',
      '######################'
    ] },

    /* ── caverns ── */
    { id: 'stalactites', d: 2, world: 1, rows: [
      '........................',
      '.....###########........',
      '.....#^^^^^^^^^#........',
      '........................',
      '.......o..o..o..........',
      '........................',
      '........................',
      '...e..........a.....e...',
      '########################',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'crystal-shaft', d: 3, world: 1, rows: [
      '......................',
      '.........ooo..........',
      '........=====.........',
      '.....................*',
      '...=====.........=====',
      '......................',
      '.........====.........',
      '......................',
      '...====.......====....',
      '......................',
      '##..................##',
      '##..................##',
      '##..................##',
      '##..................##'
    ] },
    { id: 'mine-pool', d: 2, world: 1, rows: [
      '........................',
      '............*...........',
      '...........ooo..........',
      '........................',
      '......##....##....##....',
      '......##....##....##....',
      '###...##....##....##.###',
      '###~~~##~~~~##~~~~##~###',
      '########################',
      '########################'
    ] },

    /* ── peaks ── */
    { id: 'ice-slide', d: 2, world: 2, rows: [
      '..........................',
      '..........................',
      '.....ooooooo..............',
      '..........................',
      '.................*........',
      '................===.......',
      '..........................',
      '..e.......................',
      'IIIIIIIIIIIIII....IIIIIIII',
      '##############....########',
      '##############....########',
      '##############....########'
    ] },
    { id: 'icicles', d: 3, world: 2, rows: [
      '........................',
      '..######################',
      '..........^^^^..........',
      '........................',
      '.....o...o...o...o......',
      '........................',
      '........................',
      '...a............x.......',
      'IIIIIIIIIIIIIIIIIIIIIIII',
      '########################',
      '########################',
      '########################'
    ] },
    { id: 'glacier', d: 4, world: 2, rows: [
      '..........................',
      '..........................',
      '......o.....o.....o.......',
      '..........................',
      '..........................',
      '.....II...II...II...II....',
      '.....##...##...##...##....',
      '##...##...##...##...##..##',
      '##...##...##...##...##..##',
      '##...##...##...##...##..##',
      '##...##...##...##...##..##'
    ] },

    /* ── forge ── */
    { id: 'lava-lake', d: 3, world: 3, rows: [
      '..........................',
      '..........ooo.............',
      '.............*............',
      '..........................',
      '..........................',
      '...M..............m.......',
      '###....................###',
      '###....................###',
      '###~~~~~~~~~~~~~~~~~~~~###',
      '##########################'
    ] },
    { id: 'magma-steps', d: 3, world: 3, rows: [
      '........................',
      '.........o....o.........',
      '........KK...KK.........',
      '....o...............o...',
      '...KK.............KK....',
      '........................',
      '###..................###',
      '###..................###',
      '###~~~~~~~~~~~~~~~~~~###',
      '########################'
    ] },
    { id: 'foundry', d: 4, world: 3, rows: [
      '..........................',
      '..........................',
      '...o.........*o.......o...',
      '..........................',
      '..........................',
      '.........k.......k........',
      '........###.....###.......',
      '....e...###..e..###...e...',
      '##########################',
      '##########################',
      '##########################',
      '##########################'
    ] },

    /* ── citadel ── */
    { id: 'cloud-hop', d: 3, world: 4, rows: [
      '..........................',
      '..................*.......',
      '.........o.........o......',
      '..........................',
      '........===......===......',
      '....o.........o.......o...',
      '...===.......===.....===..',
      '..........................',
      '##......................##',
      '##......................##',
      '##......................##',
      '##......................##'
    ] },
    { id: 'updraft', d: 4, world: 4, rows: [
      '..........................',
      '............*.............',
      '...........oo.............',
      '..........====............',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '.....T..............T.....',
      '....###............###....',
      '##......................##',
      '##......................##',
      '##......................##',
      '##......................##'
    ] },
    { id: 'ramparts', d: 5, world: 4, rows: [
      '............................',
      '..............*.............',
      '.............===............',
      '....................k.......',
      '........====......====......',
      '............................',
      '............................',
      '....###..............###....',
      '..e.###...........x..###..e.',
      '##########^^^^##############',
      '############################',
      '############################',
      '############################'
    ] }
  ];

  const CHUNK_BY_ID = {};
  for (let i = 0; i < CHUNKS.length; ++i)
    CHUNK_BY_ID[CHUNKS[i].id] = CHUNKS[i];

  /* ── deterministic randomness ── */

  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── recipes: which chunks make a level ── */

  function poolFor(world, dLo, dHi) {
    const out = [];
    for (const ch of CHUNKS) {
      if (ch.special)
        continue;
      if (ch.world !== undefined && ch.world !== world)
        continue;
      if (ch.d < dLo || ch.d > dHi)
        continue;
      out.push(ch);
    }
    return out;
  }

  function pickChunks(rand, world, count, dLo, dHi, exclude) {
    const picked = [];
    const used = new Set(exclude || []);
    let pool = poolFor(world, dLo, dHi);
    /* one world chunk first so every level shows its world */
    const own = pool.filter(c => c.world === world && !used.has(c.id));
    if (own.length) {
      const c = own[Math.floor(rand() * own.length)];
      picked.push(c.id);
      used.add(c.id);
    }
    let guard = 0;
    while (picked.length < count && guard++ < 400) {
      let avail = pool.filter(c => !used.has(c.id));
      if (!avail.length) {
        used.clear();
        avail = pool.slice();
      }
      /* world chunks weigh triple, harder chunks show up later in the level */
      let total = 0;
      const weights = avail.map(c => {
        const w = (c.world === world ? 3 : 1) * (1 + (c.d - dLo) * picked.length / Math.max(1, count));
        total += w;
        return w;
      });
      let r = rand() * total, k = 0;
      while (k < avail.length - 1 && (r -= weights[k]) > 0)
        ++k;
      picked.push(avail[k].id);
      used.add(avail[k].id);
    }
    /* the world chunk goes somewhere in the middle rather than first */
    if (picked.length > 2) {
      const first = picked.shift();
      picked.splice(1 + Math.floor(rand() * (picked.length - 1)), 0, first);
    }
    return picked;
  }

  function campaignSpec(world, index) {
    const seed = hashString('platformer-' + world + '-' + index);
    const rand = rng(seed);
    const boss = index === 5;
    let chunks;
    if (boss) {
      chunks = ['start'].concat(pickChunks(rand, world, 2, Math.max(1, world), Math.min(5, 2 + world), null), ['arena']);
    } else {
      const count = 4 + Math.min(4, index + (world >= 2 ? 1 : 0));
      const dLo = Math.max(1, Math.floor(world * 0.6 + index * 0.25));
      const dHi = Math.min(5, 1 + Math.ceil(world * 0.8 + index * 0.5));
      chunks = ['start'].concat(pickChunks(rand, world, count, dLo, dHi, null), ['goal']);
    }
    return {
      id: 'w' + world + 'l' + index, world: world, index: index, seed: seed,
      name: LEVEL_NAMES[world][index], chunks: chunks, boss: boss,
      enemyRate: Math.min(1, 0.55 + world * 0.1 + index * 0.06)
    };
  }

  /* a procedural run (Endless stages, Daily): any world, a difficulty 1-5 */
  function proceduralSpec(seed, world, difficulty, count, name) {
    const rand = rng(seed);
    const dLo = Math.max(1, Math.floor(difficulty) - 2);
    const dHi = Math.min(5, Math.ceil(difficulty));
    const chunks = ['start'].concat(pickChunks(rand, world, count, dLo, dHi, null), ['goal']);
    return {
      id: 'p' + seed, world: world, index: -1, seed: seed, name: name || 'Run',
      chunks: chunks, boss: false, enemyRate: Math.min(1, 0.5 + difficulty * 0.1), procedural: true
    };
  }

  /* ── building ── */

  function padRows(rows) {
    const w = rows[0].length;
    const out = [];
    for (let i = rows.length; i < ROWS; ++i)
      out.push('.'.repeat(w));
    return out.concat(rows);
  }

  const TILE_OF = {
    '#': 1, '=': 2, '^': 3, 'T': 4, '~': 5, 'I': 6, 'F': 7, '?': 8, '!': 8, 'B': 10, 'K': 11
  };

  function build(spec) {
    const rand = rng(spec.seed ^ 0x9e3779b9);
    const W = WORLDS[spec.world];
    const parts = spec.chunks.map(id => {
      const ch = CHUNK_BY_ID[id];
      if (!ch)
        throw new Error('unknown chunk ' + id);
      return { ch: ch, rows: padRows(ch.rows) };
    });
    let cols = 0;
    const chunkStarts = [];
    for (const p of parts) {
      chunkStarts.push(cols);
      cols += p.rows[0].length;
    }
    const tiles = new Uint8Array(cols * ROWS);
    const level = {
      id: spec.id, name: spec.name, world: spec.world, index: spec.index, boss: spec.boss ? W.boss : null,
      cols: cols, rows: ROWS, tiles: tiles, start: null, goal: null,
      coins: [], gems: [], enemies: [], platforms: [], checkpoints: [], powerBlocks: {},
      arena: null, bossSpawn: null, chunkStarts: chunkStarts, chunks: spec.chunks.slice(), seed: spec.seed
    };
    const gemSpots = [];
    const lifts = {};

    for (let k = 0; k < parts.length; ++k) {
      const p = parts[k];
      const x0 = chunkStarts[k];
      const w = p.rows[0].length;
      for (let r = 0; r < ROWS; ++r) {
        const line = p.rows[r];
        for (let c = 0; c < w; ++c) {
          const ch = line.charAt(c);
          const gc = x0 + c;
          const idx = r * cols + gc;
          if (TILE_OF[ch] !== undefined) {
            tiles[idx] = TILE_OF[ch];
            if (ch === '!')
              level.powerBlocks[idx] = true;
            continue;
          }
          switch (ch) {
            case 'S': level.start = { c: gc, r: r }; break;
            case 'G': level.goal = { c: gc, r: r }; break;
            case 'C': level.checkpoints.push({ c: gc, r: r }); break;
            case 'o': level.coins.push({ c: gc, r: r }); break;
            case '*': gemSpots.push({ c: gc, r: r }); break;
            case 'e':
              if (rand() < spec.enemyRate)
                level.enemies.push({ type: W.ground[Math.floor(rand() * W.ground.length)], c: gc, r: r });
              break;
            case 'a':
              if (rand() < spec.enemyRate)
                level.enemies.push({ type: W.air[Math.floor(rand() * W.air.length)], c: gc, r: r });
              break;
            case 'k': level.enemies.push({ type: 'turret', c: gc, r: r }); break;
            case 'x': level.enemies.push({ type: 'spiky', c: gc, r: r }); break;
            case 'M': {
              const end = line.indexOf('m', c + 1);
              addPlatform(level, gc, r, x0 + (end > c ? end : c + 4), r);
              break;
            }
            case 'V': lifts[gc] = lifts[gc] || {}; lifts[gc].bottom = r; break;
            case 'v': lifts[gc] = lifts[gc] || {}; lifts[gc].top = r; break;
            case 'X': level.bossSpawn = { c: gc, r: r }; break;
            case 'W': level.arena = { gate: gc, c0: x0, c1: x0 + w - 1, r: r }; break;
            default: break;
          }
        }
      }
    }
    for (const key of Object.keys(lifts)) {
      const l = lifts[key];
      const c = Number(key);
      if (l.bottom !== undefined && l.top !== undefined)
        addPlatform(level, c - 1, l.bottom, c - 1, l.top);
    }
    /* neighbours move in opposite phase so a pair of lifts is never level */
    for (let i = 0; i < level.platforms.length; ++i) {
      const pl = level.platforms[i];
      const dx = pl.x1 - pl.x0, dy = pl.y1 - pl.y0;
      const period = 2 * Math.sqrt(dx * dx + dy * dy) / pl.speed;
      pl.phase = (i % 2) * period / 2;
    }

    applyTransform(level, W.transform, rand);
    chooseGems(level, gemSpots);
    placeCheckpoints(level, spec);
    level.timeTarget = timeTarget(level);
    return level;
  }

  /* a 3-tile platform whose top rides half a tile below the marker row */
  function addPlatform(level, c0, r0, c1, r1) {
    level.platforms.push({
      x0: c0 * TS, y0: r0 * TS + 32, x1: c1 * TS, y1: r1 * TS + 32,
      w: 3 * TS, h: 18, speed: r0 === r1 ? 120 : 105, phase: 0
    });
  }

  /* world flavour on top of the shared chunks */
  function applyTransform(level, kind, rand) {
    const cols = level.cols, tiles = level.tiles;
    const at = (c, r) => tiles[r * cols + c];
    if (kind === 'ceiling') {
      /* a rocky roof: 1-3 rows, never lower than row 3 */
      let depth = 2;
      for (let c = 0; c < cols; ++c) {
        if (rand() < 0.3)
          depth = Math.max(1, Math.min(3, depth + (rand() < 0.5 ? -1 : 1)));
        for (let r = 0; r < depth; ++r)
          if (at(c, r) === 0)
            tiles[r * cols + c] = 1;
      }
    } else if (kind === 'lava') {
      /* the pits glow: every bottomless column gets two rows of lava */
      for (let c = 0; c < cols; ++c) {
        let open = true;
        for (let r = GROUND_ROW; r < ROWS; ++r)
          if (at(c, r) !== 0) open = false;
        if (open) {
          tiles[16 * cols + c] = 5;
          tiles[17 * cols + c] = 5;
        }
      }
    } else if (kind === 'ice') {
      /* frost on alternate ground runs */
      let icy = rand() < 0.5;
      for (let c = 0; c < cols; ++c) {
        if (c % 12 === 0)
          icy = rand() < 0.45;
        if (!icy)
          continue;
        for (let r = 1; r < ROWS; ++r)
          if (at(c, r) === 1 && at(c, r - 1) === 0 && r >= 12) {
            tiles[r * cols + c] = 6;
            break;
          }
      }
    } else if (kind === 'islands') {
      /* the ground floats: carve the underside of solid runs */
      for (let c = 0; c < cols; ++c) {
        const keep = 15 + Math.floor(rand() * 2);
        const carve = (c + 1) % 9 > 1;
        if (!carve)
          continue;
        for (let r = keep + 1; r < ROWS; ++r)
          if (at(c, r) === 1 && at(c, GROUND_ROW) === 1)
            tiles[r * cols + c] = 0;
      }
    }
  }

  /* three gems spread over the level: early, middle and late spots */
  function chooseGems(level, spots) {
    spots.sort((a, b) => a.c - b.c);
    const chosen = [];
    if (spots.length <= 3) {
      chosen.push.apply(chosen, spots);
    } else {
      const thirds = [[], [], []];
      for (const s of spots)
        thirds[Math.min(2, Math.floor(s.c * 3 / level.cols))].push(s);
      for (let k = 0; k < 3; ++k)
        if (thirds[k].length)
          chosen.push(thirds[k][Math.floor(thirds[k].length / 2)]);
      for (const s of spots) {
        if (chosen.length >= 3)
          break;
        if (chosen.indexOf(s) < 0)
          chosen.push(s);
      }
    }
    /* not enough hidden spots: the highest coins become gems */
    if (chosen.length < 3) {
      const coins = level.coins.slice().sort((a, b) => a.r - b.r || a.c - b.c);
      while (chosen.length < 3 && coins.length) {
        const c = coins.shift();
        level.coins.splice(level.coins.indexOf(c), 1);
        chosen.push(c);
      }
    }
    for (const s of spots)
      if (chosen.indexOf(s) < 0)
        level.coins.push(s);
    chosen.sort((a, b) => a.c - b.c);
    level.gems = chosen.slice(0, 3);
  }

  /* checkpoints at chunk seams about 40 % and 70 % of the way, and before an arena */
  function placeCheckpoints(level, spec) {
    if (level.checkpoints.length)
      return;
    const seams = level.chunkStarts.slice(1);
    const want = [];
    if (spec.boss) {
      want.push(seams[seams.length - 1] - 1);
    } else if (spec.chunks.length >= 6) {
      want.push(level.cols * 0.4, level.cols * 0.7);
    } else if (spec.chunks.length >= 4) {
      want.push(level.cols * 0.5);
    }
    for (const target of want) {
      let best = seams[0], bd = 1e9;
      for (const s of seams) {
        const d = Math.abs(s - target);
        if (d < bd) { bd = d; best = s; }
      }
      const c = spec.boss ? Math.round(target) : best;
      if (!level.checkpoints.some(cp => cp.c === c))
        level.checkpoints.push({ c: c, r: GROUND_ROW - 1 });
    }
    level.checkpoints.sort((a, b) => a.c - b.c);
  }

  /* a par time that asks for a brisk, clean run */
  function timeTarget(level) {
    const secs = level.cols * TS / 220 + 8 + level.platforms.length * 6 + (level.boss ? 45 : 0);
    return Math.ceil(secs / 5) * 5;
  }

  const CAMPAIGN = [];
  for (let w = 0; w < WORLDS.length; ++w) {
    const list = [];
    for (let i = 0; i < 6; ++i)
      list.push(campaignSpec(w, i));
    CAMPAIGN.push(list);
  }

  function buildCampaign(world, index) {
    return build(CAMPAIGN[world][index]);
  }

  /* Endless: stage n of a run seeded by runSeed; the world cycles, difficulty climbs */
  function endlessSpec(runSeed, stage) {
    const world = (Math.floor(runSeed / 7) + stage) % WORLDS.length;
    const difficulty = Math.min(5, 1.5 + stage * 0.5);
    return proceduralSpec(hashString('endless-' + runSeed + '-' + stage), world, difficulty, 4 + Math.min(3, stage), 'Stage ' + (stage + 1));
  }

  /* Daily: one long level per calendar day, the same for everyone */
  function dailySpec(dateStr) {
    const seed = hashString('daily-' + dateStr);
    const world = seed % WORLDS.length;
    const difficulty = 2.5 + (seed >>> 8) % 3 * 0.75;
    return proceduralSpec(seed, world, difficulty, 8, 'Daily ' + dateStr);
  }

  SZ.PlatformerLevels = Object.freeze({
    ROWS, GROUND_ROW, WORLDS, CHUNKS, CHUNK_BY_ID, CAMPAIGN, LEVEL_NAMES,
    hashString, rng, build, buildCampaign, campaignSpec, proceduralSpec, endlessSpec, dailySpec, padRows
  });
})();
