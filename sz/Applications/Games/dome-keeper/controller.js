;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ======================================================================
     CONSTANTS
     ====================================================================== */

  const CANVAS_W = 1400;
  const CANVAS_H = 1000;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* -- Views -- */
  const VIEW_SURFACE = 'SURFACE';
  const VIEW_UNDERGROUND = 'UNDERGROUND';

  /* -- States -- */
  const STATE_READY = 'READY';
  const STATE_GADGET_SELECT = 'GADGET_SELECT';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_UPGRADE_DIALOG = 'UPGRADE_DIALOG';

  /* -- Storage -- */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* -- Underground Grid -- */
  const GRID_COLS = 110;
  const GRID_ROWS = 80;
  const TILE_SIZE = 40;
  const GRID_OFFSET_X = 140;
  const GRID_OFFSET_Y = 120;

  /* -- Tile Types -- */
  const TILE_EMPTY = 0;
  const TILE_DIRT = 1;
  const TILE_IRON = 2;
  const TILE_WATER = 3;
  const TILE_COBALT = 4;
  const TILE_GADGET = 5;
  const TILE_COPPER = 6;
  const TILE_GOLD = 7;
  const TILE_TIN = 8;
  const TILE_SILVER = 9;
  const TILE_LEAD = 10;
  const TILE_COAL = 11;
  const TILE_QUARTZ = 12;
  const TILE_REDSTONE = 13;
  const TILE_DIAMOND = 14;
  const TILE_EMERALD = 15;
  const TILE_RUBY = 16;

  const TILE_COLORS = {
    [TILE_DIRT]: '#4a3a2a',
    [TILE_IRON]: '#888888',
    [TILE_WATER]: '#4488ff',
    [TILE_COBALT]: '#4444aa',
    [TILE_COPPER]: '#b87333',
    [TILE_GOLD]: '#ffd700',
    [TILE_TIN]: '#d4d4d4',
    [TILE_SILVER]: '#c0c0c0',
    [TILE_LEAD]: '#666666',
    [TILE_COAL]: '#333333',
    [TILE_QUARTZ]: '#f0e6d3',
    [TILE_REDSTONE]: '#cc0000',
    [TILE_DIAMOND]: '#b9f2ff',
    [TILE_EMERALD]: '#50c878',
    [TILE_RUBY]: '#e0115f'
  };

  const TILE_HIGHLIGHT_COLORS = {
    [TILE_IRON]: '#bbbbbb',
    [TILE_WATER]: '#66aaff',
    [TILE_COBALT]: '#6666cc',
    [TILE_COPPER]: '#d4944d',
    [TILE_GOLD]: '#ffea50',
    [TILE_TIN]: '#eeeeee',
    [TILE_SILVER]: '#e0e0e0',
    [TILE_LEAD]: '#999999',
    [TILE_COAL]: '#555555',
    [TILE_QUARTZ]: '#fff8ee',
    [TILE_REDSTONE]: '#ff3333',
    [TILE_DIAMOND]: '#dff8ff',
    [TILE_EMERALD]: '#80e8a0',
    [TILE_RUBY]: '#ff4488'
  };

  const TILE_SHADOW_COLORS = {
    [TILE_DIRT]: '#2a1a0a',
    [TILE_IRON]: '#555555',
    [TILE_WATER]: '#2266aa',
    [TILE_COBALT]: '#222288',
    [TILE_COPPER]: '#7a4a1a',
    [TILE_GOLD]: '#aa8800',
    [TILE_TIN]: '#999999',
    [TILE_SILVER]: '#888888',
    [TILE_LEAD]: '#333333',
    [TILE_COAL]: '#111111',
    [TILE_QUARTZ]: '#b0a890',
    [TILE_REDSTONE]: '#880000',
    [TILE_DIAMOND]: '#6ab0c0',
    [TILE_EMERALD]: '#2a7844',
    [TILE_RUBY]: '#900030'
  };

  const TILE_VALUES = {
    [TILE_IRON]: 10,
    [TILE_WATER]: 20,
    [TILE_COBALT]: 40,
    [TILE_COPPER]: 12,
    [TILE_TIN]: 15,
    [TILE_COAL]: 8,
    [TILE_LEAD]: 18,
    [TILE_SILVER]: 25,
    [TILE_GOLD]: 35,
    [TILE_QUARTZ]: 30,
    [TILE_REDSTONE]: 45,
    [TILE_EMERALD]: 60,
    [TILE_DIAMOND]: 80,
    [TILE_RUBY]: 70
  };

  const TILE_LABELS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt',
    [TILE_COPPER]: 'copper',
    [TILE_GOLD]: 'gold',
    [TILE_TIN]: 'tin',
    [TILE_SILVER]: 'silver',
    [TILE_LEAD]: 'lead',
    [TILE_COAL]: 'coal',
    [TILE_QUARTZ]: 'quartz',
    [TILE_REDSTONE]: 'redstone',
    [TILE_DIAMOND]: 'diamond',
    [TILE_EMERALD]: 'emerald',
    [TILE_RUBY]: 'ruby'
  };

  // Pixel-art sprite drawn on each resource tile (see SPRITES)
  const TILE_ICONS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt',
    [TILE_COPPER]: 'copper',
    [TILE_GOLD]: 'gold',
    [TILE_TIN]: 'tin',
    [TILE_SILVER]: 'silver',
    [TILE_LEAD]: 'lead',
    [TILE_COAL]: 'coal',
    [TILE_QUARTZ]: 'quartz',
    [TILE_REDSTONE]: 'redstone',
    [TILE_DIAMOND]: 'diamond',
    [TILE_EMERALD]: 'emerald',
    [TILE_RUBY]: 'ruby'
  };

  /* ======================================================================
     PIXEL-ART SPRITES (drawn once into offscreen canvases)
     ====================================================================== */

  // Colour ramps, darkest to lightest. Sprite pixels '1'-'5' use the sprite's
  // first ramp, 'a'-'e' its second and 'f'-'j' its third; '.' is transparent.
  const RAMP = {
    steel:  ['#3c4048', '#5c626c', '#8a919c', '#b8bec8', '#eef2f6'],
    tin:    ['#5a5e66', '#8a8f98', '#b8bcc4', '#dde0e6', '#f8fafc'],
    silver: ['#4a5260', '#7a8496', '#b4bccc', '#e0e6f0', '#ffffff'],
    lead:   ['#22263a', '#3a4058', '#5a6280', '#8890b0', '#c0c8e0'],
    gold:   ['#7a4a10', '#b8741a', '#f0b020', '#ffe066', '#fff6c0'],
    wood:   ['#4a2a12', '#6e4220', '#9a6232', '#c08850', '#e0b080'],
    blue:   ['#16306e', '#2456b0', '#3a8ee8', '#7ac0ff', '#d8f2ff'],
    cobalt: ['#1a1a5a', '#2e3aa0', '#4a62d8', '#86a4ff', '#dce6ff'],
    red:    ['#5a0a14', '#9a1424', '#d8303a', '#ff6a5a', '#ffc8b8'],
    ruby:   ['#4a0418', '#8a0c30', '#d81c50', '#ff5a80', '#ffd0dc'],
    green:  ['#0e4020', '#17703a', '#2ea858', '#6ade80', '#d0ffd8'],
    violet: ['#2a1a6a', '#4a34a8', '#6a5ad8', '#a090ff', '#e4dcff'],
    copper: ['#4a2008', '#7a3a14', '#c0642a', '#e8925a', '#ffd4ac'],
    patina: ['#0e5a50', '#1a8a78', '#3ac0a8', '#80e8d0', '#d0fff4'],
    cream:  ['#6a5a48', '#a89878', '#d8ccb4', '#f2ead8', '#ffffff'],
    coal:   ['#141218', '#25222c', '#3a3644', '#5e5a6c', '#9a96a8'],
    cyan:   ['#0e4a6a', '#1e88b0', '#58c8e8', '#a8ecff', '#f0ffff'],
    fire:   ['#7a1a08', '#d04010', '#ff8a20', '#ffd040', '#fff8c0']
  };
  const SPRITE_OUTLINE = '#120c18';

  const SPRITES = {
    /* -- ores & resources -- */
    iron: { ramps: ['steel', 'copper'], px: [
      '............', '....2333....', '..23344432..', '.2344443332.',
      '.234c33c332.', '23333333c332', '2333c3333332', '233333333c32',
      '.2333c333322', '.2233333322.', '...222222...', '............'] },
    water: { ramps: ['blue'], px: [
      '.....33.....', '.....33.....', '....3443....', '....3443....',
      '...344443...', '..34544443..', '..35444443..', '.3544444443.',
      '.3444444433.', '..33444433..', '...333333...', '............'] },
    cobalt: { ramps: ['cobalt'], px: [
      '......5.....', '.....454....', '..4..444....', '.454.434....',
      '.444.434..4.', '.434.434.454', '.434.434.444', '.434.334.434',
      '.334.334.334', '222222222222', '.2222222222.', '............'] },
    copper: { ramps: ['copper', 'patina'], px: [
      '............', '............', '..2332......', '.234432.....',
      '.2345432....', '.2344c32.22.', '.2333332234.', '..23332.2343',
      '...222.2c332', '.......22222', '............', '............'] },
    gold: { ramps: ['gold'], px: [
      '............', '.....233....', '...2344432..', '..234554432.',
      '.23455443332', '234554433332', '234444333432', '233333334432',
      '.2333333332.', '..22333222..', '....2222....', '............'] },
    tin: { ramps: ['tin'], px: [
      '............', '............', '............', '...444444...',
      '..45555554..', '.4555555544.', '.4444444443.', '.3333333332.',
      '.3333333322.', '.2222222222.', '............', '............'] },
    silver: { ramps: ['silver'], px: [
      '.........5..', '........555.', '.........5..', '...3333.....',
      '..344443....', '.344554433..', '3445444433..', '34444433332.',
      '2344333332..', '.22333322...', '...2222.....', '............'] },
    lead: { ramps: ['lead'], px: [
      '............', '....4444....', '...455554...', '...333333...',
      '...222222...', '.4444..4444.', '.45544.45544', '.33333.33333',
      '.22222.22222', '............', '............', '............'] },
    coal: { ramps: ['coal'], px: [
      '............', '....222.....', '...23432....', '..2344332...',
      '.234333322..', '.2333332332.', '223333234432', '233332344332',
      '233322333332', '.2222.23332.', '......22222.', '............'] },
    quartz: { ramps: ['cream'], px: [
      '....4.......', '...454......', '...444...4..', '...434..454.',
      '.4.434..434.', '454434..434.', '444434..334.', '434334..334.',
      '334334..334.', '222222222222', '.2222222222.', '............'] },
    redstone: { ramps: ['red'], px: [
      '............', '..5......5..', '............', '.....33.....',
      '....3443....', '...345443...', '..34454443..', '.3445444543.',
      '334444544433', '233333333332', '.2222222222.', '............'] },
    diamond: { ramps: ['cyan'], px: [
      '............', '...333333...', '..34555443..', '.3455544443.',
      '333333333333', '.2344444432.', '..23444432..', '...234432...',
      '....2442....', '.....22.....', '............', '............'] },
    emerald: { ramps: ['green'], px: [
      '............', '...333333...', '..34444443..', '.3445554443.',
      '.3454444443.', '.3454444443.', '.3444444423.', '.3444444223.',
      '..32222223..', '...222222...', '............', '............'] },
    ruby: { ramps: ['ruby'], px: [
      '............', '....3333....', '..33444433..', '.3445544443.',
      '.3455444433.', '334544443332', '334444433322', '.3444433322.',
      '.3333332222.', '..22322222..', '....2222....', '............'] },
    bag: { ramps: ['wood', 'gold'], px: [
      '............', '....3333....', '...3....3...', '.2222222222.',
      '.2444444442.', '.2433cc3342.', '.2433cc3342.', '.2433333342.',
      '.2433333342.', '.2333333332.', '.2222222222.', '............'] },

    /* -- upgrade, tool and gadget icons -- */
    pickaxe: { ramps: ['steel', 'wood'], px: [
      '...233332...', '.2344444432.', '23...cc...32', '2....cc....2',
      '.....cc.....', '.....dc.....', '.....cc.....', '.....cc.....',
      '.....dc.....', '.....cc.....', '.....bb.....', '............'] },
    shield: { ramps: ['blue', 'steel'], px: [
      '............', '.dddddddddd.', '.d44444333d.', '.d45544333d.',
      '.d44443332d.', '.d44433332d.', '.d34333322d.', '..d333322d..',
      '..d233222d..', '...d2222d...', '....dddd....', '............'] },
    bolt: { ramps: ['gold'], px: [
      '......2332..', '.....2342...', '....2342....', '...23442....',
      '..23444432..', '.....2342...', '....2342....', '...2342.....',
      '..232.......', '.22.........', '............', '............'] },
    wrench: { ramps: ['steel'], px: [
      '........3..3', '........34.4', '.......34443', '......34443.',
      '.....3443...', '....343.....', '...343......', '..343.......',
      '.343........', '3443........', '343.........', '.3..........'] },
    dome: { ramps: ['blue', 'steel'], px: [
      '............', '............', '....3333....', '..33444433..',
      '.3345444443.', '.3454444443.', '344444444443', '344444444443',
      'cccccccccccc', 'bbbbbbbbbbbb', '............', '............'] },
    reflect: { ramps: ['red', 'steel'], px: [
      'dd......4...', 'dd.....4....', 'dd....4.....', 'dd...4......',
      'dd..4.......', 'dd.4........', 'dd.4........', 'dd..4.......',
      'dd...4...4..', 'dd....4..4..', 'dd.....4.4..', 'dd...44444..'] },
    heart: { ramps: ['red'], px: [
      '............', '.2332..2332.', '234443344432', '245444444432',
      '244444444432', '.2444444432.', '..24444432..', '...244432...',
      '....2432....', '.....22.....', '............', '............'] },
    regen: { ramps: ['green'], px: [
      '............', '.2332..2332.', '234443344432', '245444444432',
      '244444444432', '.2444444432.', '..24444432..', '...244432...',
      '....2432....', '.....22.....', '............', '............'] },
    castle: { ramps: ['steel'], px: [
      '............', '.3.3.33.3.3.', '.3333333333.', '.3444443333.',
      '.3433333333.', '.3333113333.', '.3343113433.', '.3331111333.',
      '.2221111222.', '.2222222222.', '............', '............'] },
    crate: { ramps: ['wood'], px: [
      '............', '.2222222222.', '.2444444442.', '.2433333342.',
      '.2343333432.', '.2334334332.', '.2333443332.', '.2334334332.',
      '.2343333432.', '.2433333342.', '.2222222222.', '............'] },
    magnet: { ramps: ['red', 'steel'], px: [
      '............', '.dddd..dddd.', '.cccc..cccc.', '.3443..3443.',
      '.3443..3443.', '.3443..3443.', '.3443333443.', '.2444444442.',
      '..24444442..', '...222222...', '............', '............'] },
    sparkle: { ramps: ['gold'], px: [
      '.....3......', '.....4......', '....454.....', '.3445554433.',
      '....454.....', '.....4......', '.....3...3..', '........343.',
      '.........3..', '..3.........', '.343........', '..3.........'] },
    radar: { ramps: ['steel', 'gold'], px: [
      '.........dd.', '..33....d...', '.3443..d....', '.34443d.....',
      '.344443.....', '..344443....', '...344443...', '....33333...',
      '.....22.....', '....2222....', '...222222...', '............'] },
    speed: { ramps: ['cyan'], px: [
      '............', '......4444..', '..........4.', '.55555555.4.',
      '.........4..', '............', '...444444444', '............',
      '.33333333...', '.........3..', '.......33...', '............'] },
    robot: { ramps: ['steel', 'cyan'], px: [
      '.....e......', '.....3......', '.2333333332.', '.2444444442.',
      '.24cc44cc42.', '.24dc44dc42.', '.2444444442.', '.2442222442.',
      '.2444444442.', '.2222222222.', '...3....3...', '..33....33..'] },
    drill: { ramps: ['steel', 'gold'], px: [
      '..cccccccc..', '..dddddddd..', '.2333333332.', '.2344444432.',
      '..23434432..', '..24343432..', '...234432...', '...243432...',
      '....2342....', '....2432....', '.....22.....', '............'] },
    boot: { ramps: ['wood', 'cyan'], px: [
      '............', '....22222...', '....24432...', '....24332...',
      'dd..24332...', '....243332..', '.dd.2433332.', '....24333332',
      'dd..24444442', '....22222222', '............', '............'] },
    portal: { ramps: ['violet'], px: [
      '............', '....3333....', '..33444433..', '.344....443.',
      '.34..22..43.', '34..2552..43', '34..2552..43', '.34..22..43.',
      '.344....443.', '..33444433..', '....3333....', '............'] },
    rocket: { ramps: ['steel', 'blue', 'fire'], px: [
      '.....44.....', '....4554....', '....4444....', '....4cc4....',
      '....4dc4....', '....4444....', '...g4444g...', '..gg3333gg..',
      '..g.3333.g..', '....ihhi....', '.....ii.....', '.....j......'] },
    ghost: { ramps: ['cream'], px: [
      '............', '...344443...', '..34444443..', '.3441441443.',
      '.3441441443.', '.3444444443.', '.3444444443.', '.3444444443.',
      '.3443443443.', '.3.33.33.3..', '............', '............'] },
    spring: { ramps: ['green'], px: [
      '............', '.....33.....', '....3443....', '...34..43...',
      '..34....43..', '............', '.....33.....', '....3443....',
      '...34..43...', '..34....43..', '............', '............'] },
    ladder: { ramps: ['wood'], px: [
      '..3.....3...', '..34444443..', '..3.....3...', '..3.....3...',
      '..34444443..', '..3.....3...', '..3.....3...', '..34444443..',
      '..3.....3...', '..3.....3...', '..34444443..', '..3.....3...'] },
    fire: { ramps: ['fire'], px: [
      '......2.....', '.....232....', '.....2332...', '..2..23432..',
      '..22234432..', '.2334444432.', '.2344554432.', '.2345555432.',
      '.2345555432.', '..23455432..', '...233332...', '............'] },
    swords: { ramps: ['steel', 'gold'], px: [
      '4..........4', '.4........4.', '..4......4..', '...4....4...',
      '....4..4....', '.....44.....', '...c.44.c...', '....4..4....',
      '...b.cc.b...', '..b......b..', '.b........b.', 'd..........d'] },
    explosion: { ramps: ['fire'], px: [
      '.....3......', '.3...4...3..', '..3.343.3...', '...34543....',
      '.3345554433.', '334555554433', '.3345554433.', '...34543....',
      '..3.343.3...', '.3...4...3..', '.....3......', '............'] },
    magnifier: { ramps: ['steel', 'blue', 'wood'], px: [
      '...3333.....', '..3dddd3....', '.3deddcc3...', '.3ddcccc3...',
      '.3dccccc3...', '.3ccccbc3...', '..3cccc3....', '...3333h....',
      '.......hh...', '........hh..', '.........hh.', '..........h.'] },
    snowflake: { ramps: ['cyan'], px: [
      '.....4......', '...4.4.4....', '....444.....', '.4...4...4..',
      '..4..4..4...', '4444454444..', '..4..4..4...', '.4...4...4..',
      '....444.....', '...4.4.4....', '.....4......', '............'] },
    multishot: { ramps: ['gold', 'fire'], px: [
      '.....3......', '.3..353..3..', '353..3..353.', '.3.......3..',
      '..c..c..c...', '...c.c.c....', '....ccc.....', '.....c......',
      '....ddd.....', '....ddd.....', '............', '............'] },
    target: { ramps: ['red', 'cream'], px: [
      '...33333....', '.33eeeee33..', '.3eeeeeee3..', '3eee333eee3.',
      '3ee34443ee3.', '3ee34543ee3.', '3ee34443ee3.', '3eee333eee3.',
      '.3eeeeeee3..', '.33eeeee33..', '...33333....', '............'] },
    gear: { ramps: ['steel'], px: [
      '.....44.....', '..4..44..4..', '.4443333444.', '..43322334..',
      '..432..234..', '4443....3444', '4443....3444', '..432..234..',
      '..43322334..', '.4443333444.', '..4..44..4..', '.....44.....'] },
    bomb: { ramps: ['coal', 'fire'], px: [
      '.......d.d..', '........c...', '.......b....', '....2222....',
      '..22333322..', '.2234433332.', '.2345433332.', '.2343333332.',
      '.2333333322.', '.2233333222.', '..22222222..', '....2222....'] },
    tree: { ramps: ['green', 'wood', 'red'], px: [
      '...333333...', '.3344444433.', '3344544h4433', '344444444443',
      '34h44444h443', '334444444433', '.3334444333.', '...33cc33...',
      '.....cc.....', '.....dc.....', '....cccc....', '............'] },
    lock: { ramps: ['steel', 'gold'], px: [
      '............', '....3333....', '...3....3...', '...3....3...',
      '..cccccccc..', '..cddddddc..', '..cddaaddc..', '..cdddaddc..',
      '..cddddddc..', '..cccccccc..', '............', '............'] },
    check: { ramps: ['green'], px: [
      '............', '............', '..........4.', '.........44.',
      '........44..', '.4.....44...', '.44...44....', '..44.44.....',
      '...444......', '....4.......', '............', '............'] }
  };

  const spriteCache = {};

  function buildSprite(key) {
    const def = SPRITES[key];
    if (!def) return null;
    const rows = def.px;
    const h = rows.length;
    const w = rows[0].length;
    const ramps = def.ramps.map(name => RAMP[name]);
    const colorOf = (ch) => {
      if (ch >= '1' && ch <= '5') return ramps[0][ch.charCodeAt(0) - 49];
      if (ch >= 'a' && ch <= 'e') return ramps[1] && ramps[1][ch.charCodeAt(0) - 97];
      if (ch >= 'f' && ch <= 'j') return ramps[2] && ramps[2][ch.charCodeAt(0) - 102];
      return null;
    };
    const c = document.createElement('canvas');
    c.width = w + 2;
    c.height = h + 2;
    const g = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && !!colorOf(rows[y][x]);
    // 1px dark outline around every opaque pixel (8-neighbourhood)
    g.fillStyle = SPRITE_OUTLINE;
    for (let y = -1; y <= h; ++y)
      for (let x = -1; x <= w; ++x) {
        if (solid(x, y)) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; ++dy)
          for (let dx = -1; dx <= 1 && !near; ++dx)
            if (solid(x + dx, y + dy)) near = true;
        if (near) g.fillRect(x + 1, y + 1, 1, 1);
      }
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const col = colorOf(rows[y][x]);
        if (!col || rows[y][x] === '.') continue;
        g.fillStyle = col;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
    return c;
  }

  function getSprite(key) {
    if (!(key in spriteCache))
      spriteCache[key] = buildSprite(key);
    return spriteCache[key];
  }

  // Draw a sprite centred at (cx, cy) with the given on-screen size
  function drawSprite(key, cx, cy, size, alpha) {
    const img = getSprite(key);
    if (!img) return;
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevAlpha = ctx.globalAlpha;
    // Crisp pixels when enlarged; smooth when the view shrinks a sprite below 1.5x
    ctx.imageSmoothingEnabled = size * ctx.getTransform().a / img.width < 1.5;
    if (alpha !== undefined)
      ctx.globalAlpha = prevAlpha * alpha;
    const s = Math.round(size);
    ctx.drawImage(img, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.globalAlpha = prevAlpha;
  }

  // Text with inline [[sprite]] tokens -- honours the current textAlign/textBaseline
  function splitIconText(text) {
    return String(text).split(/\[\[(\w+)\]\]/); // odd entries are sprite keys
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

  /* ======================================================================
     TEXT LAYOUT -- every label is measured against the box it lives in
     ====================================================================== */

  const UI_FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

  function uiFont(px, weight) {
    return (weight ? weight + ' ' : '') + px + 'px ' + UI_FONT;
  }

  // Layout results are cached per (text, box, font) because the same labels
  // are laid out every frame
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

  // Split icon text into indivisible units (characters and [[sprite]] tokens)
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

  // Shorten text with an ellipsis until it fits maxW in the current font
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
          --size;
          ctx.font = uiFont(size, weight);
          w = measureIconText(text);
        }
      }
      const out = w > maxW ? ellipsize(text, maxW) : text;
      return { size, text: out, width: Math.min(w, maxW) };
    });
  }

  // Draw one line of (icon) text that never exceeds maxW; returns the drawn width.
  // Honours the current textAlign / textBaseline; sets ctx.font.
  function fitText(text, x, y, maxW, px, opts) {
    opts = opts || {};
    const l = layoutLine(text, maxW, px, opts.minPx || Math.max(9, Math.round(px * 0.6)), opts.weight);
    ctx.font = uiFont(l.size, opts.weight);
    if (opts.color)
      ctx.fillStyle = opts.color;
    if (opts.outline) {
      ctx.save();
      ctx.strokeStyle = opts.outline;
      ctx.lineWidth = Math.max(2, l.size / 6);
      ctx.lineJoin = 'round';
      if (l.text.indexOf('[[') < 0)
        ctx.strokeText(l.text, x, y);
      ctx.restore();
    }
    fillIconText(l.text, x, y);
    return l.width;
  }

  // Greedy word wrap in the current font; overlong words are ellipsized
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

  // Wrap text into a w x h box, shrinking the font until all lines fit
  function layoutBlock(text, w, h, px, minPx, weight, lineGap) {
    return cachedLayout('B' + text + '|' + Math.round(w) + '|' + Math.round(h) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + lineGap, () => {
      let size = px, lines;
      for (;;) {
        ctx.font = uiFont(size, weight);
        lines = wrapText(text, w);
        if (lines.length * size * lineGap <= h || size <= minPx)
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

  // Draw wrapped text inside a box. align: 'left' | 'center'; valign: 'top' | 'middle'
  function drawTextBlock(text, x, y, w, h, px, opts) {
    opts = opts || {};
    const b = layoutBlock(text, w, h, px, opts.minPx || Math.max(9, Math.round(px * 0.6)), opts.weight, opts.lineGap || 1.3);
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

  /* ======================================================================
     UI PANELS -- one frame style for every box on screen
     ====================================================================== */

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

  // Framed panel: drop shadow, vertical gradient, dark edge, light inner rim,
  // accent strip and an optional title header. Returns the content top y.
  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    if (!opts.flat) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = opts.shadow !== undefined ? opts.shadow : 18;
      ctx.shadowOffsetY = 4;
    }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opts.top || UI.panelTop);
    g.addColorStop(1, opts.bottom || UI.panelBottom);
    roundRectPath(x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI.edge;
    ctx.stroke();
    roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.glow ? hexToRgba(accent, 0.75) : UI.rim;
    ctx.stroke();
    if (opts.glow) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      roundRectPath(x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(accent, 0.6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Accent strip along the top edge
    const sg = ctx.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, hexToRgba(accent, 0));
    sg.addColorStop(0.5, hexToRgba(accent, 0.9));
    sg.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x + r, y + 1, w - r * 2, 2);
    let contentY = y + (opts.pad !== undefined ? opts.pad : 10);
    if (opts.title) {
      const hh = opts.headerH || 40;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x + 2, y + 3, w - 4, hh - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 10, y + hh, w - 20, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 10, y + hh + 1, w - 20, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleX = x + 14;
      const rightW = opts.titleRight ? Math.min(w * 0.45, 180) : 0;
      fitText(opts.title, titleX, y + hh / 2 + 1, w - 28 - rightW, opts.titlePx || 20, { weight: 'bold', color: accent });
      if (opts.titleRight) {
        ctx.textAlign = 'right';
        fitText(opts.titleRight, x + w - 14, y + hh / 2 + 1, rightW - 8, 15, { color: opts.titleRightColor || UI.textDim });
      }
      contentY = y + hh + 8;
    }
    ctx.restore();
    return contentY;
  }

  // Horizontal meter with a rounded track and a glossy fill
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
      ctx.restore();
    }
    if (opts.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.72), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
    }
    ctx.restore();
  }

  // Rounded pill / chip with centred text; returns its width
  function drawChip(text, x, y, h, opts) {
    opts = opts || {};
    const px = opts.px || Math.round(h * 0.62);
    ctx.font = uiFont(px, opts.weight || 'bold');
    const w = Math.min(opts.maxW || 1e9, Math.ceil(measureIconText(text)) + h * 0.8);
    const x0 = opts.align === 'right' ? x - w : x;
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

  // Button with gradient face, used by the title and dialogs
  function drawButton(b, primary, hover) {
    ctx.save();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (primary) {
      g.addColorStop(0, hover ? '#4aa0ff' : '#3a86e0');
      g.addColorStop(1, hover ? '#2a64c0' : '#1f4c98');
    } else {
      g.addColorStop(0, hover ? '#3a4560' : '#2a3248');
      g.addColorStop(1, hover ? '#232a3e' : '#181d2c');
    }
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    roundRectPath(b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = primary ? (hover ? '#bfe0ff' : '#7ab8ff') : (hover ? '#8a9ac0' : '#4a5676');
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectPath(b.x + 3, b.y + 3, b.w - 6, b.h * 0.42, 9);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 24, 26, { weight: 'bold', color: primary ? '#fff' : '#d0d8ea' });
    ctx.restore();
  }

  // Large glowing headline (title screens and overlays)
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
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, glow || color);
    ctx.fillStyle = g;
    ctx.fillText(l.text, x, y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Dim the whole screen and darken the corners
  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!vignetteCanvas) {
      vignetteCanvas = document.createElement('canvas');
      vignetteCanvas.width = CANVAS_W / 4;
      vignetteCanvas.height = CANVAS_H / 4;
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(CANVAS_W / 8, CANVAS_H / 8, CANVAS_H / 16, CANVAS_W / 8, CANVAS_H / 8, CANVAS_W / 6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.7)');
      v.fillStyle = g;
      v.fillRect(0, 0, CANVAS_W / 4, CANVAS_H / 4);
    }
    ctx.drawImage(vignetteCanvas, 0, 0, CANVAS_W, CANVAS_H);
  }


  const TILE_DISPLAY_NAMES = {
    [TILE_EMPTY]: 'Empty',
    [TILE_DIRT]: 'Dirt',
    [TILE_IRON]: 'Iron Ore',
    [TILE_WATER]: 'Water Crystal',
    [TILE_COBALT]: 'Cobalt',
    [TILE_GADGET]: 'Gadget Chamber',
    [TILE_COPPER]: 'Copper Ore',
    [TILE_GOLD]: 'Gold Vein',
    [TILE_TIN]: 'Tin Ore',
    [TILE_SILVER]: 'Silver Deposit',
    [TILE_LEAD]: 'Lead Ore',
    [TILE_COAL]: 'Coal',
    [TILE_QUARTZ]: 'Quartz',
    [TILE_REDSTONE]: 'Redstone',
    [TILE_DIAMOND]: 'Diamond',
    [TILE_EMERALD]: 'Emerald',
    [TILE_RUBY]: 'Ruby'
  };

  const ORE_SPECKLE_COLORS = {
    [TILE_IRON]: ['#cccccc', '#aaaaaa', '#eeeeee', '#999999'],
    [TILE_WATER]: ['#66bbff', '#88ddff', '#4499dd', '#aaeeff'],
    [TILE_COBALT]: ['#7777cc', '#9999ee', '#5555aa', '#aaaaff'],
    [TILE_COPPER]: ['#d4944d', '#c08040', '#e0a060', '#a06020'],
    [TILE_GOLD]: ['#ffea50', '#ffd700', '#ffe030', '#ffcc00'],
    [TILE_TIN]: ['#eeeeee', '#d0d0d0', '#f4f4f4', '#c8c8c8'],
    [TILE_SILVER]: ['#e0e0e0', '#c8c8c8', '#f0f0f0', '#b0b0b0'],
    [TILE_LEAD]: ['#888888', '#666666', '#999999', '#555555'],
    [TILE_COAL]: ['#444444', '#333333', '#555555', '#222222'],
    [TILE_QUARTZ]: ['#fff8ee', '#f0e6d3', '#ffe8d0', '#e8dac0'],
    [TILE_REDSTONE]: ['#ff3333', '#cc0000', '#ff5555', '#aa0000'],
    [TILE_DIAMOND]: ['#dff8ff', '#b9f2ff', '#c8f0ff', '#a0e8ff'],
    [TILE_EMERALD]: ['#80e8a0', '#50c878', '#60d888', '#40b868'],
    [TILE_RUBY]: ['#ff4488', '#e0115f', '#ff2070', '#c00048']
  };

  // All resource tile types (used for detection in various places)
  const RESOURCE_TILES = [
    TILE_IRON, TILE_WATER, TILE_COBALT,
    TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL,
    TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY
  ];

  /* -- Depth-based dirt tiers (10 levels) -- */
  // Each tier: { name, base, highlight, shadow } colors
  const DEPTH_TIERS = [
    { name: 'Sand',        base: '#c2a55a', highlight: '#d4bb78', shadow: '#8a7438' },  // 0-10%
    { name: 'Loose Soil',  base: '#8b6c42', highlight: '#a88558', shadow: '#5e4628' },  // 10-20%
    { name: 'Dirt',        base: '#4a3a2a', highlight: '#6a5540', shadow: '#2a1a0a' },  // 20-30% (original)
    { name: 'Packed Dirt', base: '#3d2e1e', highlight: '#584630', shadow: '#221508' },  // 30-40%
    { name: 'Clay',        base: '#6b3a2a', highlight: '#885040', shadow: '#3e1e12' },  // 40-50%
    { name: 'Gravel',      base: '#5a5040', highlight: '#706858', shadow: '#3a3228' },  // 50-60%
    { name: 'Soft Stone',  base: '#7a7a7a', highlight: '#949494', shadow: '#505050' },  // 60-70%
    { name: 'Stone',       base: '#5a5a5a', highlight: '#707070', shadow: '#383838' },  // 70-80%
    { name: 'Hard Stone',  base: '#3e3e3e', highlight: '#525252', shadow: '#222222' },  // 80-90%
    { name: 'Bedrock',     base: '#1e1e1e', highlight: '#303030', shadow: '#0a0a0a' }   // 90-100%
  ];

  // Get depth tier index (0-9) for a given row
  function getDepthTier(row) {
    const t = Math.floor((row / GRID_ROWS) * DEPTH_TIERS.length);
    return Math.min(t, DEPTH_TIERS.length - 1);
  }

  // Get depth-based colors for dirt at a given row
  function getDepthDirtColors(row) {
    return DEPTH_TIERS[getDepthTier(row)];
  }

  // Depth-based mining time multiplier: 0.5 at surface, ~4.0 at bottom
  function getDepthMineMultiplier(row) {
    return 0.5 + (row / GRID_ROWS) * 3.5;
  }

  // Get the display color for any tile, accounting for depth-based dirt
  function getTileBaseColor(tile, row) {
    if (tile === TILE_DIRT)
      return getDepthDirtColors(row).base;
    return TILE_COLORS[tile] || '#654';
  }

  /* -- Dome -- */
  const DOME_RADIUS = 100;
  const DOME_X = CANVAS_W / 2;
  const DOME_Y = CANVAS_H - 100; // dome center at ground line; arc draws upward
  const BASE_DOME_HP = 100;

  /* -- Weapon defaults -- */
  const BASE_WEAPON_DAMAGE = 10;
  const BASE_FIRE_RATE = 1.0;
  const BASE_DRILL_SPEED = 0.3;
  const BASE_CARRY_CAPACITY = 50;

  /* -- Waves -- */
  const WAVE_INTERVAL = 40;
  const BASE_ENEMIES_PER_WAVE = 3;

  /* -- Mining time -- */
  const BASE_MINE_TIME = 0.5; // seconds for surface blocks (row 0)
  const TILE_MINE_MULTIPLIER = {
    [TILE_DIRT]: 1.0,
    [TILE_IRON]: 1.5,
    [TILE_WATER]: 0.8,
    [TILE_COBALT]: 2.0,
    [TILE_GADGET]: 2.5,
    [TILE_COPPER]: 1.4,
    [TILE_TIN]: 1.3,
    [TILE_COAL]: 1.0,
    [TILE_LEAD]: 1.6,
    [TILE_SILVER]: 1.8,
    [TILE_GOLD]: 2.2,
    [TILE_QUARTZ]: 1.7,
    [TILE_REDSTONE]: 2.3,
    [TILE_EMERALD]: 2.5,
    [TILE_DIAMOND]: 3.0,
    [TILE_RUBY]: 2.8
  };

  /* -- Movement -- */
  const BASE_MOVE_INTERVAL = 0.15; // seconds per tile (base, before upgrades)

  /* -- Upgrade costs (resource units) -- */
  const UPGRADE_DEFS = [
    { name: 'Weapon Damage', key: 'weaponDamage', baseCost: 30, perLevel: 20 },
    { name: 'Fire Rate', key: 'fireRate', baseCost: 25, perLevel: 15 },
    { name: 'Dome HP', key: 'domeHP', baseCost: 40, perLevel: 25 },
    { name: 'Drill Speed', key: 'drillSpeed', baseCost: 20, perLevel: 10 },
    { name: 'Carry Capacity', key: 'carryCapacity', baseCost: 20, perLevel: 10 },
    { name: 'Move Speed', key: 'moveSpeed', baseCost: 25, perLevel: 15 },
    { name: 'Mining Tools', key: 'miningTools', baseCost: 35, perLevel: 20 }
  ];

  // Sprite shown next to each quick upgrade
  const UPGRADE_ICONS = {
    weaponDamage: 'swords', fireRate: 'fire', domeHP: 'shield', drillSpeed: 'drill',
    carryCapacity: 'bag', moveSpeed: 'boot', miningTools: 'pickaxe'
  };

  /* -- Unlockable Gadgets/Tools -- */
  const GADGET_DEFS = [
    {
      key: 'drill', name: 'Drill Gadget', icon: 'drill',
      desc: 'Mines a column downward. 30% faster on consecutive same-column tiles.',
      costIron: 25, costCobalt: 0, shortcut: '1'
    },
    {
      key: 'blastTool', name: 'Blast Mining', icon: 'explosion',
      desc: 'Clears a 3x3 area. Costs 10 iron per blast. 5s cooldown.',
      costIron: 30, costCobalt: 0, shortcut: '2'
    },
    {
      key: 'scanner', name: 'Scanner', icon: 'magnifier',
      desc: 'Reveals resource types in a 3-tile radius around the miner.',
      costIron: 35, costCobalt: 10, shortcut: '3'
    },
    {
      key: 'reinforcedDome', name: 'Reinforced Dome', icon: 'shield',
      desc: 'Dome takes 25% less damage from enemies. Passive.',
      costIron: 50, costCobalt: 25, shortcut: '4'
    },
    {
      key: 'teleporter', name: 'Teleporter', icon: 'portal',
      desc: 'Instantly return to dome surface. 30s cooldown.',
      costIron: 30, costCobalt: 15, shortcut: '5'
    }
  ];

  const GADGET_TOOL_COOLDOWNS = {
    blastTool: 5,   // seconds
    teleporter: 30   // seconds
  };

  /* -- Upgrade Tree -- */
  // Each node: id, name, icon, branch, costs per level [{iron, cobalt, water}],
  //   maxLevel, prereqs (ids that must be maxed or at least level 1), upgradeKey (links to game stat)
  // type: 'stat' = upgradeable stat, 'gadget' = unlockable tool/gadget (1 level)
  const UPGRADE_TREE = [
    // =============================================================
    // === Dome Branch (25 nodes) ===
    // =============================================================
    // -- Shield Capacity chain (7 levels) --
    { id: 'shield1', name: 'Shield Cap. L1', icon: 'shield', branch: 'dome',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield2', name: 'Shield Cap. L2', icon: 'shield', branch: 'dome',
      costs: [{ iron: 35, cobalt: 10 }], maxLevel: 1, prereqs: ['shield1'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield3', name: 'Shield Cap. L3', icon: 'shield', branch: 'dome',
      costs: [{ iron: 50, cobalt: 20, copper: 10 }], maxLevel: 1, prereqs: ['shield2'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield4', name: 'Shield Cap. L4', icon: 'shield', branch: 'dome',
      costs: [{ iron: 60, silver: 15, cobalt: 25 }], maxLevel: 1, prereqs: ['shield3'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield5', name: 'Shield Cap. L5', icon: 'shield', branch: 'dome',
      costs: [{ gold: 20, cobalt: 30, diamond: 5 }], maxLevel: 1, prereqs: ['shield4'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield6', name: 'Shield Cap. L6', icon: 'shield', branch: 'dome',
      costs: [{ gold: 30, diamond: 10, ruby: 5 }], maxLevel: 1, prereqs: ['shield5'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield7', name: 'Shield Cap. L7', icon: 'shield', branch: 'dome',
      costs: [{ diamond: 15, ruby: 12, emerald: 10 }], maxLevel: 1, prereqs: ['shield6'],
      upgradeKey: 'domeHP', type: 'stat' },
    // -- Shield Recharge chain (4 levels) --
    { id: 'shieldRecharge1', name: 'Shield Rech. L1', icon: 'bolt', branch: 'dome',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge2', name: 'Shield Rech. L2', icon: 'bolt', branch: 'dome',
      costs: [{ iron: 40, cobalt: 15, water: 10 }], maxLevel: 1, prereqs: ['shieldRecharge1'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge3', name: 'Shield Rech. L3', icon: 'bolt', branch: 'dome',
      costs: [{ iron: 55, silver: 12, water: 20 }], maxLevel: 1, prereqs: ['shieldRecharge2'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge4', name: 'Shield Rech. L4', icon: 'bolt', branch: 'dome',
      costs: [{ gold: 15, quartz: 20, cobalt: 25 }], maxLevel: 1, prereqs: ['shieldRecharge3'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    // -- Gadgets --
    { id: 'reinforcedDome', name: 'Reinforced Dome', icon: 'shield', branch: 'dome',
      costs: [{ iron: 50, cobalt: 25, copper: 15 }], maxLevel: 1, prereqs: ['shield2'],
      upgradeKey: 'reinforcedDome', type: 'gadget' },
    { id: 'autoRepair', name: 'Auto-Repair L1', icon: 'wrench', branch: 'dome',
      costs: [{ iron: 40, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['shieldRecharge2'],
      upgradeKey: 'autoRepair', type: 'gadget' },
    { id: 'autoRepair2', name: 'Auto-Repair L2', icon: 'wrench', branch: 'dome',
      costs: [{ silver: 20, gold: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['autoRepair'],
      upgradeKey: 'autoRepairSpeed', type: 'stat' },
    { id: 'autoRepair3', name: 'Auto-Repair L3', icon: 'wrench', branch: 'dome',
      costs: [{ gold: 25, quartz: 15, diamond: 5 }], maxLevel: 1, prereqs: ['autoRepair2'],
      upgradeKey: 'autoRepairSpeed', type: 'stat' },
    { id: 'domeExpansion', name: 'Dome Expansion', icon: 'dome', branch: 'dome',
      costs: [{ silver: 25, gold: 15, cobalt: 30 }], maxLevel: 1, prereqs: ['shield3'],
      upgradeKey: 'domeExpansion', type: 'gadget' },
    { id: 'energyShield', name: 'Energy Shield', icon: 'bolt', branch: 'dome',
      costs: [{ diamond: 10, ruby: 8, emerald: 10, gold: 20 }], maxLevel: 1, prereqs: ['shield4', 'domeExpansion'],
      upgradeKey: 'energyShield', type: 'gadget' },
    // -- New dome abilities --
    { id: 'damageReflect', name: 'Damage Reflect', icon: 'reflect', branch: 'dome',
      costs: [{ silver: 18, copper: 25, redstone: 10 }], maxLevel: 1, prereqs: ['reinforcedDome'],
      upgradeKey: 'damageReflect', type: 'gadget' },
    { id: 'damageReflect2', name: 'Reflect L2', icon: 'reflect', branch: 'dome',
      costs: [{ gold: 20, redstone: 15, ruby: 5 }], maxLevel: 1, prereqs: ['damageReflect'],
      upgradeKey: 'damageReflect', type: 'stat' },
    { id: 'emergencyShield', name: 'Emergency Shield', icon: 'shield', branch: 'dome',
      costs: [{ diamond: 12, emerald: 15, ruby: 10, gold: 25 }], maxLevel: 1, prereqs: ['energyShield', 'shieldRecharge4'],
      upgradeKey: 'emergencyShield', type: 'gadget' },
    { id: 'shieldRegen1', name: 'Shield Regen L1', icon: 'regen', branch: 'dome',
      costs: [{ iron: 30, water: 15 }], maxLevel: 1, prereqs: ['shieldRecharge1'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'shieldRegen2', name: 'Shield Regen L2', icon: 'regen', branch: 'dome',
      costs: [{ iron: 50, water: 25, cobalt: 15 }], maxLevel: 1, prereqs: ['shieldRegen1'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'shieldRegen3', name: 'Shield Regen L3', icon: 'regen', branch: 'dome',
      costs: [{ silver: 15, water: 35, quartz: 10 }], maxLevel: 1, prereqs: ['shieldRegen2'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'fortifiedBase', name: 'Fortified Base', icon: 'castle', branch: 'dome',
      costs: [{ gold: 30, cobalt: 35, diamond: 8 }], maxLevel: 1, prereqs: ['shield5', 'reinforcedDome'],
      upgradeKey: 'fortifiedBase', type: 'gadget' },
    { id: 'lastStand', name: 'Last Stand', icon: 'heart', branch: 'dome',
      costs: [{ ruby: 15, diamond: 10, emerald: 12 }], maxLevel: 1, prereqs: ['emergencyShield'],
      upgradeKey: 'lastStand', type: 'gadget' },

    // =============================================================
    // === Mining Branch (27 nodes) ===
    // =============================================================
    // -- Mining Tools chain (7 levels) --
    { id: 'mining1', name: 'Mining Tools L1', icon: 'pickaxe', branch: 'mining',
      costs: [{ iron: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining2', name: 'Mining Tools L2', icon: 'pickaxe', branch: 'mining',
      costs: [{ iron: 30, cobalt: 10 }], maxLevel: 1, prereqs: ['mining1'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining3', name: 'Mining Tools L3', icon: 'pickaxe', branch: 'mining',
      costs: [{ iron: 50, cobalt: 25, copper: 10 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining4', name: 'Mining Tools L4', icon: 'pickaxe', branch: 'mining',
      costs: [{ iron: 60, silver: 15, coal: 20 }], maxLevel: 1, prereqs: ['mining3'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining5', name: 'Mining Tools L5', icon: 'pickaxe', branch: 'mining',
      costs: [{ gold: 20, cobalt: 30, redstone: 10 }], maxLevel: 1, prereqs: ['mining4'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining6', name: 'Mining Tools L6', icon: 'pickaxe', branch: 'mining',
      costs: [{ gold: 30, redstone: 15, emerald: 8 }], maxLevel: 1, prereqs: ['mining5'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining7', name: 'Mining Tools L7', icon: 'pickaxe', branch: 'mining',
      costs: [{ diamond: 12, ruby: 10, redstone: 20 }], maxLevel: 1, prereqs: ['mining6'],
      upgradeKey: 'miningTools', type: 'stat' },
    // -- Carry Capacity chain (5 levels) --
    { id: 'carry1', name: 'Carry Cap. L1', icon: 'crate', branch: 'mining',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry2', name: 'Carry Cap. L2', icon: 'crate', branch: 'mining',
      costs: [{ iron: 35, cobalt: 15, tin: 10 }], maxLevel: 1, prereqs: ['carry1'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry3', name: 'Carry Cap. L3', icon: 'crate', branch: 'mining',
      costs: [{ iron: 50, silver: 10, lead: 15 }], maxLevel: 1, prereqs: ['carry2'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry4', name: 'Carry Cap. L4', icon: 'crate', branch: 'mining',
      costs: [{ gold: 15, cobalt: 20, tin: 20 }], maxLevel: 1, prereqs: ['carry3'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry5', name: 'Carry Cap. L5', icon: 'crate', branch: 'mining',
      costs: [{ gold: 25, diamond: 5, lead: 20 }], maxLevel: 1, prereqs: ['carry4'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    // -- Gadgets --
    { id: 'drill', name: 'Drill Gadget', icon: 'drill', branch: 'mining',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: ['mining1'],
      upgradeKey: 'drill', type: 'gadget' },
    { id: 'magnet', name: 'Magnet', icon: 'magnet', branch: 'mining',
      costs: [{ iron: 40, copper: 25, lead: 15 }], maxLevel: 1, prereqs: ['carry2'],
      upgradeKey: 'magnet', type: 'gadget' },
    { id: 'fortune', name: 'Fortune', icon: 'sparkle', branch: 'mining',
      costs: [{ gold: 15, silver: 20, quartz: 10 }], maxLevel: 1, prereqs: ['mining3'],
      upgradeKey: 'fortune', type: 'gadget' },
    { id: 'silkTouch', name: 'Silk Touch', icon: 'diamond', branch: 'mining',
      costs: [{ diamond: 8, emerald: 10, ruby: 5, gold: 15 }], maxLevel: 1, prereqs: ['fortune', 'mining4'],
      upgradeKey: 'silkTouch', type: 'gadget' },
    // -- New mining abilities --
    { id: 'oreDetector', name: 'Ore Detector', icon: 'radar', branch: 'mining',
      costs: [{ iron: 30, copper: 15, cobalt: 10 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'oreDetector', type: 'gadget' },
    { id: 'oreDetector2', name: 'Ore Detect L2', icon: 'radar', branch: 'mining',
      costs: [{ silver: 15, quartz: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['oreDetector'],
      upgradeKey: 'oreDetector', type: 'stat' },
    { id: 'speedMining1', name: 'Speed Mining L1', icon: 'speed', branch: 'mining',
      costs: [{ iron: 35, coal: 20 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'speedMining2', name: 'Speed Mining L2', icon: 'speed', branch: 'mining',
      costs: [{ iron: 55, silver: 10, coal: 25 }], maxLevel: 1, prereqs: ['speedMining1'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'speedMining3', name: 'Speed Mining L3', icon: 'speed', branch: 'mining',
      costs: [{ gold: 15, redstone: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['speedMining2'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'autoMine', name: 'Auto-Mine', icon: 'robot', branch: 'mining',
      costs: [{ gold: 20, cobalt: 25, copper: 30 }], maxLevel: 1, prereqs: ['mining4', 'speedMining2'],
      upgradeKey: 'autoMine', type: 'gadget' },
    { id: 'tunnelBore', name: 'Tunnel Bore', icon: 'drill', branch: 'mining',
      costs: [{ gold: 25, redstone: 15, diamond: 5, cobalt: 30 }], maxLevel: 1, prereqs: ['mining5', 'drill'],
      upgradeKey: 'tunnelBore', type: 'gadget' },
    { id: 'magnetRange1', name: 'Magnet Range L1', icon: 'magnet', branch: 'mining',
      costs: [{ silver: 15, copper: 20, lead: 10 }], maxLevel: 1, prereqs: ['magnet'],
      upgradeKey: 'magnetRange', type: 'stat' },
    { id: 'magnetRange2', name: 'Magnet Range L2', icon: 'magnet', branch: 'mining',
      costs: [{ gold: 15, quartz: 10, lead: 20 }], maxLevel: 1, prereqs: ['magnetRange1'],
      upgradeKey: 'magnetRange', type: 'stat' },
    { id: 'fortuneL2', name: 'Fortune L2', icon: 'sparkle', branch: 'mining',
      costs: [{ gold: 25, emerald: 10, ruby: 8 }], maxLevel: 1, prereqs: ['fortune'],
      upgradeKey: 'fortune', type: 'stat' },
    { id: 'veinMiner', name: 'Vein Miner', icon: 'diamond', branch: 'mining',
      costs: [{ diamond: 10, ruby: 8, emerald: 12, gold: 20 }], maxLevel: 1, prereqs: ['silkTouch', 'tunnelBore'],
      upgradeKey: 'veinMiner', type: 'gadget' },

    // =============================================================
    // === Movement Branch (25 nodes) ===
    // =============================================================
    // -- Move Speed chain (7 levels) --
    { id: 'speed1', name: 'Move Speed L1', icon: 'boot', branch: 'movement',
      costs: [{ iron: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed2', name: 'Move Speed L2', icon: 'boot', branch: 'movement',
      costs: [{ iron: 25, cobalt: 8 }], maxLevel: 1, prereqs: ['speed1'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed3', name: 'Move Speed L3', icon: 'boot', branch: 'movement',
      costs: [{ iron: 40, cobalt: 15, copper: 10 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed4', name: 'Move Speed L4', icon: 'boot', branch: 'movement',
      costs: [{ iron: 55, silver: 12, coal: 15 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed5', name: 'Move Speed L5', icon: 'boot', branch: 'movement',
      costs: [{ gold: 15, cobalt: 25, redstone: 8 }], maxLevel: 1, prereqs: ['speed4'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed6', name: 'Move Speed L6', icon: 'boot', branch: 'movement',
      costs: [{ gold: 25, redstone: 12, emerald: 5 }], maxLevel: 1, prereqs: ['speed5'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed7', name: 'Move Speed L7', icon: 'boot', branch: 'movement',
      costs: [{ diamond: 8, ruby: 8, emerald: 8 }], maxLevel: 1, prereqs: ['speed6'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    // -- Gadgets --
    { id: 'teleporter', name: 'Teleporter', icon: 'portal', branch: 'movement',
      costs: [{ iron: 30, cobalt: 15 }], maxLevel: 1, prereqs: ['speed1'],
      upgradeKey: 'teleporter', type: 'gadget' },
    { id: 'jetpack', name: 'Jetpack', icon: 'rocket', branch: 'movement',
      costs: [{ iron: 45, copper: 20, coal: 25 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'jetpack', type: 'gadget' },
    { id: 'phaseShift', name: 'Phase Shift', icon: 'ghost', branch: 'movement',
      costs: [{ silver: 20, gold: 10, quartz: 15, cobalt: 20 }], maxLevel: 1, prereqs: ['speed4'],
      upgradeKey: 'phaseShift', type: 'gadget' },
    { id: 'echoLocation', name: 'Echo Location', icon: 'radar', branch: 'movement',
      costs: [{ copper: 15, tin: 20, cobalt: 15 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'echoLocation', type: 'gadget' },
    { id: 'echoLocation2', name: 'Echo Loc. L2', icon: 'radar', branch: 'movement',
      costs: [{ silver: 15, gold: 10, redstone: 8 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'echoLocation', type: 'stat' },
    { id: 'echoLocation3', name: 'Echo Loc. L3', icon: 'radar', branch: 'movement',
      costs: [{ gold: 20, quartz: 15, redstone: 12 }], maxLevel: 1, prereqs: ['echoLocation2'],
      upgradeKey: 'echoLocation', type: 'stat' },
    // -- New movement abilities --
    { id: 'doubleJump', name: 'Double Jump', icon: 'spring', branch: 'movement',
      costs: [{ iron: 35, copper: 20, cobalt: 12 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'doubleJump', type: 'gadget' },
    { id: 'wallClimb', name: 'Wall Climb', icon: 'ladder', branch: 'movement',
      costs: [{ iron: 45, cobalt: 20, tin: 15 }], maxLevel: 1, prereqs: ['speed3', 'doubleJump'],
      upgradeKey: 'wallClimb', type: 'gadget' },
    { id: 'dash', name: 'Dash', icon: 'speed', branch: 'movement',
      costs: [{ silver: 15, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'dash', type: 'gadget' },
    { id: 'dash2', name: 'Dash L2', icon: 'speed', branch: 'movement',
      costs: [{ gold: 12, redstone: 10, cobalt: 18 }], maxLevel: 1, prereqs: ['dash'],
      upgradeKey: 'dash', type: 'stat' },
    { id: 'undergroundRadar', name: 'Ground Radar', icon: 'radar', branch: 'movement',
      costs: [{ silver: 20, copper: 25, quartz: 10 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'undergroundRadar', type: 'gadget' },
    { id: 'undergroundRadar2', name: 'Radar L2', icon: 'radar', branch: 'movement',
      costs: [{ gold: 18, quartz: 15, redstone: 10 }], maxLevel: 1, prereqs: ['undergroundRadar'],
      upgradeKey: 'undergroundRadar', type: 'stat' },
    { id: 'teleportCooldown1', name: 'Teleport CDR L1', icon: 'portal', branch: 'movement',
      costs: [{ silver: 12, cobalt: 15, copper: 10 }], maxLevel: 1, prereqs: ['teleporter'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    { id: 'teleportCooldown2', name: 'Teleport CDR L2', icon: 'portal', branch: 'movement',
      costs: [{ gold: 15, quartz: 12, redstone: 8 }], maxLevel: 1, prereqs: ['teleportCooldown1'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    { id: 'jetpackFuel1', name: 'Jetpack Fuel L1', icon: 'rocket', branch: 'movement',
      costs: [{ copper: 25, coal: 30, cobalt: 15 }], maxLevel: 1, prereqs: ['jetpack'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'jetpackFuel2', name: 'Jetpack Fuel L2', icon: 'rocket', branch: 'movement',
      costs: [{ gold: 15, coal: 35, redstone: 10 }], maxLevel: 1, prereqs: ['jetpackFuel1'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'phaseShift2', name: 'Phase Shift L2', icon: 'ghost', branch: 'movement',
      costs: [{ gold: 20, quartz: 20, diamond: 5 }], maxLevel: 1, prereqs: ['phaseShift'],
      upgradeKey: 'phaseShift', type: 'stat' },

    // =============================================================
    // === Weapon Branch (27 nodes) ===
    // =============================================================
    // -- Fire Rate chain (6 levels) --
    { id: 'fireRate1', name: 'Fire Rate L1', icon: 'fire', branch: 'weapon',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate2', name: 'Fire Rate L2', icon: 'fire', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 12 }], maxLevel: 1, prereqs: ['fireRate1'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate3', name: 'Fire Rate L3', icon: 'fire', branch: 'weapon',
      costs: [{ iron: 50, copper: 15, coal: 10 }], maxLevel: 1, prereqs: ['fireRate2'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate4', name: 'Fire Rate L4', icon: 'fire', branch: 'weapon',
      costs: [{ silver: 15, gold: 10, redstone: 12 }], maxLevel: 1, prereqs: ['fireRate3'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate5', name: 'Fire Rate L5', icon: 'fire', branch: 'weapon',
      costs: [{ gold: 20, redstone: 15, ruby: 5 }], maxLevel: 1, prereqs: ['fireRate4'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate6', name: 'Fire Rate L6', icon: 'fire', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, redstone: 18 }], maxLevel: 1, prereqs: ['fireRate5'],
      upgradeKey: 'fireRate', type: 'stat' },
    // -- Damage chain (7 levels) --
    { id: 'damage1', name: 'Damage L1', icon: 'swords', branch: 'weapon',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage2', name: 'Damage L2', icon: 'swords', branch: 'weapon',
      costs: [{ iron: 40, cobalt: 15 }], maxLevel: 1, prereqs: ['damage1'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage3', name: 'Damage L3', icon: 'swords', branch: 'weapon',
      costs: [{ iron: 60, cobalt: 30, copper: 15 }], maxLevel: 1, prereqs: ['damage2'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage4', name: 'Damage L4', icon: 'swords', branch: 'weapon',
      costs: [{ silver: 20, gold: 15, redstone: 10 }], maxLevel: 1, prereqs: ['damage3'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage5', name: 'Damage L5', icon: 'swords', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, emerald: 8, gold: 20 }], maxLevel: 1, prereqs: ['damage4'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage6', name: 'Damage L6', icon: 'swords', branch: 'weapon',
      costs: [{ diamond: 12, ruby: 12, gold: 25 }], maxLevel: 1, prereqs: ['damage5'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage7', name: 'Damage L7', icon: 'swords', branch: 'weapon',
      costs: [{ diamond: 15, ruby: 15, emerald: 12 }], maxLevel: 1, prereqs: ['damage6'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    // -- Drill Speed chain (5 levels) --
    { id: 'drillSpeed1', name: 'Drill Speed L1', icon: 'drill', branch: 'weapon',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed2', name: 'Drill Speed L2', icon: 'drill', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 10, tin: 8 }], maxLevel: 1, prereqs: ['drillSpeed1'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed3', name: 'Drill Speed L3', icon: 'drill', branch: 'weapon',
      costs: [{ iron: 50, silver: 10, coal: 15 }], maxLevel: 1, prereqs: ['drillSpeed2'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed4', name: 'Drill Speed L4', icon: 'drill', branch: 'weapon',
      costs: [{ gold: 12, redstone: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['drillSpeed3'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed5', name: 'Drill Speed L5', icon: 'drill', branch: 'weapon',
      costs: [{ gold: 20, diamond: 5, redstone: 15 }], maxLevel: 1, prereqs: ['drillSpeed4'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    // -- Gadgets --
    { id: 'blastTool', name: 'Blast Mining', icon: 'explosion', branch: 'weapon',
      costs: [{ iron: 30, coal: 10 }], maxLevel: 1, prereqs: ['damage1'],
      upgradeKey: 'blastTool', type: 'gadget' },
    { id: 'scanner', name: 'Scanner', icon: 'magnifier', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 10 }], maxLevel: 1, prereqs: ['drillSpeed1'],
      upgradeKey: 'scanner', type: 'gadget' },
    { id: 'chainLightning', name: 'Chain Lightning', icon: 'bolt', branch: 'weapon',
      costs: [{ silver: 20, copper: 25, redstone: 15 }], maxLevel: 1, prereqs: ['damage3', 'fireRate2'],
      upgradeKey: 'chainLightning', type: 'gadget' },
    { id: 'freezeRay', name: 'Freeze Ray', icon: 'snowflake', branch: 'weapon',
      costs: [{ water: 30, quartz: 15, silver: 10 }], maxLevel: 1, prereqs: ['fireRate3'],
      upgradeKey: 'freezeRay', type: 'gadget' },
    { id: 'plasmaCannon', name: 'Plasma Cannon', icon: 'explosion', branch: 'weapon',
      costs: [{ diamond: 10, ruby: 12, redstone: 15, gold: 20 }], maxLevel: 1, prereqs: ['damage4', 'chainLightning'],
      upgradeKey: 'plasmaCannon', type: 'gadget' },
    // -- New weapon abilities --
    { id: 'multiShot', name: 'Multi-Shot', icon: 'multishot', branch: 'weapon',
      costs: [{ silver: 18, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['fireRate2', 'damage2'],
      upgradeKey: 'multiShot', type: 'gadget' },
    { id: 'multiShot2', name: 'Multi-Shot L2', icon: 'multishot', branch: 'weapon',
      costs: [{ gold: 15, redstone: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['multiShot'],
      upgradeKey: 'multiShot', type: 'stat' },
    { id: 'homingShots', name: 'Homing Shots', icon: 'target', branch: 'weapon',
      costs: [{ gold: 20, quartz: 15, redstone: 12 }], maxLevel: 1, prereqs: ['damage3', 'fireRate3'],
      upgradeKey: 'homingShots', type: 'gadget' },
    { id: 'turretSpeed1', name: 'Turret Speed L1', icon: 'gear', branch: 'weapon',
      costs: [{ iron: 25, copper: 15 }], maxLevel: 1, prereqs: ['fireRate1'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'turretSpeed2', name: 'Turret Speed L2', icon: 'gear', branch: 'weapon',
      costs: [{ iron: 40, cobalt: 15, tin: 10 }], maxLevel: 1, prereqs: ['turretSpeed1'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'turretSpeed3', name: 'Turret Speed L3', icon: 'gear', branch: 'weapon',
      costs: [{ silver: 15, gold: 10, redstone: 8 }], maxLevel: 1, prereqs: ['turretSpeed2'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'criticalHit', name: 'Critical Hit', icon: 'explosion', branch: 'weapon',
      costs: [{ gold: 18, redstone: 15, cobalt: 20 }], maxLevel: 1, prereqs: ['damage3'],
      upgradeKey: 'criticalHit', type: 'gadget' },
    { id: 'criticalHit2', name: 'Critical L2', icon: 'explosion', branch: 'weapon',
      costs: [{ gold: 25, ruby: 8, redstone: 18 }], maxLevel: 1, prereqs: ['criticalHit'],
      upgradeKey: 'criticalHit', type: 'stat' },
    { id: 'explosiveRounds', name: 'Explosive Rounds', icon: 'bomb', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, redstone: 20, gold: 15 }], maxLevel: 1, prereqs: ['plasmaCannon', 'criticalHit'],
      upgradeKey: 'explosiveRounds', type: 'gadget' },
    { id: 'freezeRay2', name: 'Freeze Ray L2', icon: 'snowflake', branch: 'weapon',
      costs: [{ water: 40, quartz: 20, diamond: 5 }], maxLevel: 1, prereqs: ['freezeRay'],
      upgradeKey: 'freezeRay', type: 'stat' },
    { id: 'chainLightning2', name: 'Chain Light. L2', icon: 'bolt', branch: 'weapon',
      costs: [{ gold: 20, redstone: 18, emerald: 8 }], maxLevel: 1, prereqs: ['chainLightning'],
      upgradeKey: 'chainLightning', type: 'stat' }
  ];

  // Upgrade effect descriptions (keyed by upgradeKey)
  const UPGRADE_EFFECT_DESC = {
    domeHP: '+25 max dome HP per level',
    shieldRecharge: 'Shield gadget recharges faster',
    shieldRegen: '+1 HP/5s passive dome regen per level',
    reinforcedDome: 'Dome takes 25% less damage (passive)',
    autoRepair: 'Dome regenerates +2 HP every 5s',
    autoRepairSpeed: 'Auto-repair heals faster per level',
    domeExpansion: '+75 max dome HP, instant heal',
    energyShield: 'Dome takes 15% less damage (stacks with Reinforced)',
    damageReflect: 'Reflects 15% damage back to attackers per level',
    emergencyShield: '3s invincibility when dome drops below 15% HP (60s CD)',
    fortifiedBase: 'Dome takes 10% less damage, +50 max HP',
    lastStand: 'Survive one lethal hit with 1 HP (once per wave)',
    miningTools: '-20% mining time per level',
    carryCapacity: '+20 carry capacity per level',
    drill: 'Mines a column downward, 30% faster on consecutive tiles',
    magnet: 'Auto-collect dropped resources within 2 tiles',
    magnetRange: '+1 magnet range per level',
    fortune: '30% chance to double ore yield (+10% per extra level)',
    silkTouch: 'Preserves full resource value when mining',
    oreDetector: 'Highlights nearby ores through walls (+range per level)',
    speedMining: '-10% mining time per level (stacks with tools)',
    autoMine: 'Auto-mines adjacent blocks when idle for 2s',
    tunnelBore: 'Mine 3 blocks in a line in the direction you face',
    veinMiner: 'Mining an ore mines the entire connected vein',
    moveSpeed: '15% faster movement per level',
    teleporter: 'Instantly return to surface (30s cooldown)',
    teleportCooldown: '-5s teleporter cooldown per level',
    jetpack: 'Fly upward through empty tiles',
    jetpackFuel: '+50% jetpack duration per level',
    phaseShift: 'Pass through a single block once (+uses per level)',
    echoLocation: 'Extends scanner range by +2 tiles per level',
    doubleJump: 'Jump up 2 empty tiles vertically at once',
    wallClimb: 'Move up adjacent to solid walls without empty space',
    dash: 'Quick-move 3 empty tiles in one direction (+range per level)',
    undergroundRadar: 'Reveals wider area around player (+range per level)',
    fireRate: '+0.3 shots/sec per level',
    weaponDamage: '+5 damage per level',
    drillSpeed: '-0.05s drill interval per level',
    blastTool: 'Clears a 3x3 area (costs 10 iron, 5s cooldown)',
    scanner: 'Reveals resources in 3-tile radius (passive)',
    chainLightning: 'Shots arc to 2 nearby enemies for 40% damage (+1 arc/level)',
    freezeRay: 'Shots stun enemies in 60px radius for 0.8s (+0.3s/level)',
    plasmaCannon: 'Shots deal 60% AoE damage in 70px radius',
    multiShot: 'Fire 2 projectiles per shot (+1 per level)',
    homingShots: 'Projectiles track nearest enemy automatically',
    turretSpeed: '+30% turret rotation speed per level',
    criticalHit: '15% chance to deal 2.5x damage (+5% per level)',
    explosiveRounds: 'All shots explode on impact for 40% AoE'
  };

  // Mining difficulty label from depth multiplier
  function getMiningDifficultyLabel(depthMult) {
    if (depthMult < 1.2) return 'Very Easy';
    if (depthMult < 1.8) return 'Easy';
    if (depthMult < 2.4) return 'Medium';
    if (depthMult < 3.0) return 'Hard';
    return 'Very Hard';
  }

  // Precompute node positions for the tree layout
  // Layout: root at top center, 4 branches below
  const TREE_BRANCH_ORDER = ['dome', 'mining', 'movement', 'weapon'];
  const TREE_BRANCH_LABELS = { dome: 'DOME', mining: 'MINING', movement: 'MOVEMENT', weapon: 'WEAPON' };
  const TREE_BRANCH_COLORS = { dome: '#4cb4ff', mining: '#ffae3a', movement: '#5ee07a', weapon: '#ff5e5e' };
  const TREE_CARD_W = 200;
  const TREE_CARD_H = 88;
  const TREE_GAP_X = 40;       // vertical channel between depth columns (connectors run here)
  const TREE_GAP_Y = 24;       // horizontal channel between lanes
  const TREE_REGION_PAD = 30;
  const TREE_REGION_HEADER = 74;
  const TREE_REGION_GAP = 90;
  const TREE_MIN_ZOOM = 0.2;
  const TREE_MAX_ZOOM = 1.6;
  // Full names for the abbreviated chain names used in the tree data
  const TREE_NAME_EXPANSIONS = {
    'Shield Cap.': 'Shield Capacity', 'Shield Rech.': 'Shield Recharge', 'Carry Cap.': 'Carry Capacity',
    'Echo Loc.': 'Echo Location', 'Ore Detect': 'Ore Detector', 'Chain Light.': 'Chain Lightning',
    'Teleport CDR': 'Teleport Cooldown', 'Critical': 'Critical Hit', 'Reflect': 'Damage Reflect',
    'Radar': 'Ground Radar'
  };

  /* ======================================================================
     DOM
     ====================================================================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusView = document.getElementById('statusView');
  const statusWave = document.getElementById('statusWave');
  const statusDome = document.getElementById('statusDome');
  const statusResources = document.getElementById('statusResources');
  const highScoresBody = document.getElementById('highScoresBody');

  /* -- API: Windows integration -- */
  const { User32 } = SZ?.Dlls ?? {};

  /* -- Effects -- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  const starfield = new SZ.GameEffects.Starfield(CANVAS_W, CANVAS_H * 0.85, 160);

  /* ======================================================================
     ANIMATION STATE
     ====================================================================== */

  let animTime = 0; // global animation clock (seconds)

  // Mining / pickaxe swing
  let pickaxeAngle = 0;         // current swing angle (radians)
  let pickaxeSwinging = false;
  let pickaxeSwingTimer = 0;
  const PICKAXE_SWING_DURATION = 0.25;
  let lastMineDir = { dx: 1, dy: 0 }; // direction of last mine action

  // Dome pulse
  let domePulsePhase = 0;
  let domeHitFlash = 0; // flash timer when dome is hit
  let lastDomeHurtSound = 0;

  // Player idle bob (underground)
  let playerBob = 0;

  // Rock crumble animations
  let crumbleEffects = []; // { x, y, pieces: [{x,y,vx,vy,rot,rotV,size,color}], life }

  // Dust clouds
  let dustClouds = []; // { x, y, alpha, radius, expandRate }

  // Resource reveal glows
  let resourceGlows = []; // { x, y, color, life, radius }

  // Dome shield impact flashes
  let shieldImpacts = []; // { angle, life, intensity }

  // Ambient underground sparkles for resource tiles
  let tileSparkleTimer = 0;

  /* ======================================================================
     GAME STATE
     ====================================================================== */

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  // Each page: intro paragraph plus rows of [key, text] (key null = plain bullet)
  const TUTORIAL_PAGES = [
    { title: 'How to Play', icon: 'dome',
      intro: 'Defend your dome from alien waves on the surface while mining resources underground!',
      items: [['Click', 'Fire the laser (surface) / dig (underground)'], ['WASD / Arrows', 'Move the keeper and mine underground'], ['Space / Tab', 'Switch between surface and mine']] },
    { title: 'Upgrades & Tips', icon: 'pickaxe',
      intro: 'Mine iron, copper, gold, gems and more, then spend them on upgrades.',
      items: [['U', 'Open the upgrade tree (on the surface)'], [null, 'Upgrade weapon, dome armor, drill and fire rate'], [null, 'Return to the surface before a wave arrives!'], ['H', 'Show this help again anytime']] },
    { title: 'Gadgets', icon: 'gear',
      intro: 'Choose a primary gadget at the start of each run. Golden 2x2 gadget chambers underground hide more of them.',
      items: [['R', 'Activate the Repellent Field'], ['B', 'Use Blast Mining charges'], [null, 'Gadgets from chambers activate on pickup!']] },
    { title: 'Tools', icon: 'drill',
      intro: 'Unlock tools in the Tools section of the upgrade panel, then use them with the number keys.',
      items: [['1', 'Drill: fast column mining'], ['2', 'Blast: clears a 3x3 area'], ['3', 'Scanner: reveals nearby ores'], ['4', 'Reinforced Dome: takes less damage'], ['5', 'Teleporter: instant return to the surface']] }
  ];

  let state = STATE_READY;
  let currentView = VIEW_SURFACE;
  let transitionProgress = 0;
  let transitionTarget = null;

  let domeHP = BASE_DOME_HP;
  let maxDomeHP = BASE_DOME_HP;

  let resources = { iron: 0, water: 0, cobalt: 0, copper: 0, gold: 0, tin: 0, silver: 0, lead: 0, coal: 0, quartz: 0, redstone: 0, diamond: 0, emerald: 0, ruby: 0 };
  let carried = 0;
  let carryCapacity = BASE_CARRY_CAPACITY;

  let weaponDamage = BASE_WEAPON_DAMAGE;
  let fireRate = BASE_FIRE_RATE;
  let fireCooldown = 0;
  let projectiles = [];
  let aimX = 0, aimY = 0; // mouse aim position on surface
  let fireRequested = false; // player clicked to fire
  let turretAngle = -Math.PI / 2; // turret barrel angle (radians); default = straight up
  let mouseAimX = -1, mouseAimY = -1; // continuous mouse position for turret aiming
  const TURRET_BARREL_LENGTH = 40;
  const TURRET_KEYBOARD_SPEED = 2.5; // radians per second

  let drillSpeed = BASE_DRILL_SPEED;
  let drillX = Math.floor(GRID_COLS / 2);
  let drillY = 0;
  let drillTimer = 0;

  let cameraX = 0;
  let cameraY = 0;

  let upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0, moveSpeed: 0, miningTools: 0 };

  let enemies = [];
  let waveNumber = 0;
  let waveTimer = 0;
  let waveActive = false;
  let score = 0;

  let undergroundGrid = [];
  let highScores = [];

  /* ── Persistent tile mining HP ── */
  let tileHP = [];                   // 2D array [row][col] of remaining mining HP (null = full)
  let tileMaxHP = [];                // 2D array [row][col] of max mining HP

  /* ── Mining state ── */
  let miningProgress = 0;          // accumulated time toward current mine
  let miningDuration = 0;          // total time required for current mine
  let miningTarget = null;         // {col, row, dx, dy} -- block being mined
  let miningDir = null;            // {dx, dy} -- direction player is mining toward

  /* ── Dropped resources ── */
  let droppedResources = [];       // [{col, row, type, value, age}]

  /* ── Mouse-based underground navigation ── */
  let moveTarget = null;   // {col, row} -- destination tile
  let movePath = null;     // [{col, row}, ...] -- BFS path steps
  let movePathIndex = 0;   // current step index in path
  let moveStepTimer = 0;   // timer for smooth stepping
  let mineTarget = null;   // {col, row, dx, dy} -- queued mine after arrival
  let moveStepInterval = BASE_MOVE_INTERVAL; // effective move interval (affected by upgrades)

  /* ── Gadget System ── */
  let primaryGadget = null; // 'shield'|'repellent'|'orchard'|'droneyard'
  let primaryGadgetState = {};
  let foundGadgets = [];    // gadgets picked up from mine chambers
  let gadgetChambers = [];  // [{r, c, gadgetType, revealed: bool}]
  let gadgetSelectHover = -1; // which card is hovered on selection screen

  /* ── Unlockable Tool/Gadget System ── */
  let unlockedTools = {};       // { drill: true, blastTool: true, ... }
  let activeToolKey = null;     // currently selected tool key
  let toolState = {};           // per-tool runtime state
  let showToolPanel = false;    // whether tool unlock panel is visible in upgrade menu

  /* ── Upgrade Dialog (full-screen tree) ── */
  let upgradeTreeLevels = {};   // { nodeId: currentLevel }
  let upgradeDialogHover = null; // hovered node id
  let stateBeforeUpgradeDialog = null; // state to restore when closing dialog

  /* ── Tooltip ── */
  const tooltip = {
    lines: [],
    x: 0,
    y: 0,
    visible: false,
    delayTimer: 0,
    anchor: null,     // optional {x, y, w, h} box to place the tooltip beside
    lastHoverKey: ''  // identity of what we are hovering; resets delay when it changes
  };
  const TOOLTIP_DELAY = 0.2; // seconds before tooltip appears

  /* ── Upgrade Dialog zoom & pan ── */
  let upgradeZoom = 1.0;        // zoom scale factor
  let upgradePanX = 0;          // pan offset X
  let upgradePanY = 0;          // pan offset Y
  let upgradeViewCustomized = false; // true once user manually zooms/pans
  let upgradePanning = false;   // right-click drag active
  let upgradePanStartX = 0;     // drag start mouse X
  let upgradePanStartY = 0;     // drag start mouse Y
  let upgradePanBaseX = 0;      // pan offset at drag start
  let upgradePanBaseY = 0;      // pan offset at drag start
  const treeCam = { tz: 1, tx: 0, ty: 0, last: 0 }; // camera target the view eases towards
  let treeTab = 'dome';         // 'all' or a branch id
  let treeFocusId = null;       // keyboard-selected node
  let treeLayout = null;        // cached node positions and branch regions
  let treeNodeInfo = null;      // cached display names / chain positions
  const treePurchaseFlash = {}; // nodeId -> purchase time (ms) for the flash effect

  const PRIMARY_GADGETS = [
    { key: 'shield', name: 'Shield Generator', icon: 'shield', desc: ['Absorbs the first hit of each wave.', 'Recharges when a new wave starts.'] },
    { key: 'repellent', name: 'Repellent Field', icon: 'portal', desc: ['Press R: slows all enemies to 40%', 'for 5 seconds (30s cooldown).'] },
    { key: 'orchard', name: 'Orchard', icon: 'tree', desc: ['Every 20s grows a fruit that gives', '+30% mining speed for 10 seconds.'] },
    { key: 'droneyard', name: 'Droneyard', icon: 'robot', desc: ['A drone auto-carries 10 resources', 'to surface every 15 seconds.'] }
  ];

  const MINE_GADGETS = ['autoCannon', 'stunLaser', 'blastMining', 'probeScanner', 'domeArmor', 'condenser'];
  const MINE_GADGET_NAMES = {
    autoCannon: 'Auto Cannon', stunLaser: 'Stun Laser', blastMining: 'Blast Mining',
    probeScanner: 'Probe Scanner', domeArmor: 'Dome Armor', condenser: 'Condenser'
  };

  const keys = {};

  /* ======================================================================
     DETERMINISTIC SEED FOR TERRAIN TEXTURE
     ====================================================================== */

  // Pre-generate dirt texture noise offsets for each tile
  let dirtNoise = [];
  function generateDirtNoise() {
    dirtNoise = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 6; ++d)
          dots.push({
            ox: Math.random() * (TILE_SIZE - 6) + 3,
            oy: Math.random() * (TILE_SIZE - 6) + 3,
            size: 1 + Math.random() * 2.5,
            shade: Math.random() * 0.3
          });
        row.push(dots);
      }
      dirtNoise.push(row);
    }
  }

  /* ======================================================================
     CANVAS SETUP
     ====================================================================== */

  // Backing-store pixels per logical (CANVAS_W x CANVAS_H) unit
  let renderScale = 1;

  function setupCanvas() {
    // Fixed logical resolution, letterboxed into the client area so the
    // aspect ratio never distorts. The backing store matches the on-screen
    // size (times devicePixelRatio) so text and sprites stay sharp; every
    // frame starts with a scale transform. Mouse handlers translate
    // coordinates via CANVAS_W / rect.width, which still holds.
    const frame = canvas.parentElement;
    const fw = (frame && frame.clientWidth) || CANVAS_W;
    const fh = (frame && frame.clientHeight) || CANVAS_H;
    const fit = Math.min(fw / CANVAS_W, fh / CANVAS_H);
    const cssW = Math.max(1, Math.floor(CANVAS_W * fit));
    const cssH = Math.max(1, Math.floor(CANVAS_H * fit));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    renderScale = Math.max(0.25, Math.min(2, (cssW / CANVAS_W) * (window.devicePixelRatio || 1)));
    const bw = Math.round(CANVAS_W * renderScale);
    const bh = Math.round(CANVAS_H * renderScale);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  }

  /* ======================================================================
     PERSISTENCE
     ====================================================================== */

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

  function addHighScore(waves, pts) {
    highScores.push({ waves, score: pts });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].waves}</td><td>${highScores[i].score}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* -- Run save / resume (plain data only; objects are rebuilt on load) -- */
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v1';
  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  let autosaveTimer = 0;
  let saveAvailable = false;   // a resumable run is stored
  let saveNotice = '';         // shown on the title screen (e.g. discarded save)
  let newGameConfirmOpen = false;

  function isRunActive() {
    return primaryGadget !== null && (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_UPGRADE_DIALOG);
  }

  function saveRun() {
    if (!isRunActive()) return;
    const partialHP = [];
    for (let r = 0; r < GRID_ROWS; ++r)
      for (let c = 0; c < GRID_COLS; ++c)
        if (tileMaxHP[r] && tileMaxHP[r][c] > 0 && tileHP[r][c] < tileMaxHP[r][c])
          partialHP.push([r, c, Math.round(tileHP[r][c] * 1000) / 1000]);
    const data = {
      version: SAVE_VERSION,
      view: transitionTarget || currentView,
      domeHP, maxDomeHP, carried, carryCapacity,
      weaponDamage, fireRate, drillSpeed, moveStepInterval,
      drillX, drillY, turretAngle,
      resources, upgradeLevels, upgradeTreeLevels,
      waveNumber, waveTimer, waveActive, score,
      enemies,
      grid: undergroundGrid.map(row => row.map(t => String.fromCharCode(48 + t)).join('')),
      partialHP,
      droppedResources,
      primaryGadget, primaryGadgetState, foundGadgets, gadgetChambers,
      unlockedTools, activeToolKey, toolState
    };
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      saveAvailable = true;
    } catch (_) {}
  }

  function clearSave() {
    saveAvailable = false;
    try { localStorage.removeItem(STORAGE_SAVE); } catch (_) {}
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  // Read and validate the stored run; a broken or outdated save is discarded with a notice
  function readSavedRun() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_SAVE); } catch (_) { return null; }
    if (!raw)
      return null;
    try {
      const d = JSON.parse(raw);
      if (!isPlainObject(d) || d.version !== SAVE_VERSION)
        throw new Error('unsupported save version');
      for (const k of ['domeHP', 'maxDomeHP', 'carried', 'carryCapacity', 'weaponDamage', 'fireRate', 'drillSpeed', 'moveStepInterval', 'drillX', 'drillY', 'turretAngle', 'waveNumber', 'waveTimer', 'score'])
        if (!isNum(d[k]))
          throw new Error('bad ' + k);
      if (!Array.isArray(d.grid) || d.grid.length !== GRID_ROWS)
        throw new Error('bad grid');
      for (const row of d.grid) {
        if (typeof row !== 'string' || row.length !== GRID_COLS)
          throw new Error('bad grid row');
        for (let c = 0; c < row.length; ++c) {
          const t = row.charCodeAt(c) - 48;
          if (t < TILE_EMPTY || t > TILE_RUBY)
            throw new Error('bad tile');
        }
      }
      if (d.drillX < 0 || d.drillX >= GRID_COLS || d.drillY < 0 || d.drillY >= GRID_ROWS)
        throw new Error('bad position');
      if (!PRIMARY_GADGETS.some(g => g.key === d.primaryGadget))
        throw new Error('bad gadget');
      for (const k of ['resources', 'upgradeLevels', 'upgradeTreeLevels', 'primaryGadgetState', 'unlockedTools', 'toolState'])
        if (!isPlainObject(d[k]))
          throw new Error('bad ' + k);
      for (const k of ['enemies', 'partialHP', 'droppedResources', 'foundGadgets', 'gadgetChambers'])
        if (!Array.isArray(d[k]))
          throw new Error('bad ' + k);
      for (const k in d.resources)
        if (!isNum(d.resources[k]))
          throw new Error('bad resource');
      for (const e of d.enemies)
        if (!isPlainObject(e) || !isNum(e.x) || !isNum(e.y) || !isNum(e.hp) || !isNum(e.maxHP))
          throw new Error('bad enemy');
      for (const ch of d.gadgetChambers)
        if (!isPlainObject(ch) || !isNum(ch.r) || !isNum(ch.c))
          throw new Error('bad chamber');
      for (const dr of d.droppedResources)
        if (!isPlainObject(dr) || !isNum(dr.col) || !isNum(dr.row) || !isNum(dr.value))
          throw new Error('bad drop');
      return d;
    } catch (_) {
      clearSave();
      saveNotice = 'The saved run could not be read and was discarded.';
      return null;
    }
  }

  function restoreRun(d) {
    resetGame(); // fresh defaults for everything not stored
    undergroundGrid = d.grid.map(row => Array.from(row, ch => ch.charCodeAt(0) - 48));
    gadgetChambers = d.gadgetChambers
      .filter(ch => ch.r >= 0 && ch.r < GRID_ROWS - 1 && ch.c >= 0 && ch.c < GRID_COLS - 1)
      .map(ch => ({ r: ch.r, c: ch.c, gadgetType: ch.gadgetType, revealed: !!ch.revealed }));
    initTileHP();
    for (const p of d.partialHP)
      if (Array.isArray(p) && tileHP[p[0]] && isNum(p[2]) && tileMaxHP[p[0]][p[1]] > 0)
        tileHP[p[0]][p[1]] = Math.max(0, Math.min(tileMaxHP[p[0]][p[1]], p[2]));

    domeHP = d.domeHP;
    maxDomeHP = d.maxDomeHP;
    carried = d.carried;
    carryCapacity = d.carryCapacity;
    weaponDamage = d.weaponDamage;
    fireRate = d.fireRate;
    drillSpeed = d.drillSpeed;
    moveStepInterval = d.moveStepInterval;
    drillX = d.drillX;
    drillY = d.drillY;
    turretAngle = d.turretAngle;
    Object.assign(resources, d.resources);
    Object.assign(upgradeLevels, d.upgradeLevels);
    Object.assign(upgradeTreeLevels, d.upgradeTreeLevels);
    waveNumber = d.waveNumber;
    waveTimer = d.waveTimer;
    waveActive = !!d.waveActive;
    score = d.score;
    enemies = d.enemies.map(e => Object.assign({}, e));
    droppedResources = d.droppedResources.map(dr => Object.assign({ age: 0 }, dr));
    primaryGadget = d.primaryGadget;
    primaryGadgetState = Object.assign({}, d.primaryGadgetState);
    foundGadgets = d.foundGadgets.filter(g => typeof g === 'string');
    unlockedTools = Object.assign({}, d.unlockedTools);
    activeToolKey = typeof d.activeToolKey === 'string' ? d.activeToolKey : null;
    Object.assign(toolState, d.toolState);

    currentView = d.view === VIEW_UNDERGROUND ? VIEW_UNDERGROUND : VIEW_SURFACE;
    if (currentView === VIEW_UNDERGROUND) {
      cameraX = Math.max(0, Math.min(GRID_COLS * TILE_SIZE - CANVAS_W, drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2));
      cameraY = Math.max(0, Math.min(GRID_ROWS * TILE_SIZE - CANVAS_H, drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2));
    }
    autosaveTimer = 0;
    state = STATE_PLAYING;
    updateWindowTitle();
  }

  function continueRun() {
    const d = readSavedRun();
    if (!d)
      return;
    try {
      restoreRun(d);
      saveNotice = '';
      SZ.GameAudio.play('select');
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Run resumed -- Wave ${waveNumber}`, { color: '#4af', font: 'bold 32px sans-serif' });
    } catch (_) {
      clearSave();
      primaryGadget = null;
      state = STATE_READY;
      saveNotice = 'The saved run could not be restored and was discarded.';
    }
  }

  function startNewRun() {
    clearSave();
    saveNotice = '';
    resetGame();
  }

  // New Game: ask before throwing away a stored run
  function requestNewGame() {
    if (newGameConfirmOpen)
      return;
    if (!saveAvailable) {
      startNewRun();
      return;
    }
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    saveRun();
    newGameConfirmOpen = true;
    // The shared click wiring hides the inner box too; make sure it shows again
    const box = document.querySelector('#dlg-new-game .dialog');
    if (box)
      box.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      newGameConfirmOpen = false;
      if (result === 'yes')
        startNewRun();
    });
  }

  // Title-screen buttons shown when a saved run exists
  function getTitleButtons() {
    const w = 360, h = 60, x = CANVAS_W / 2 - w / 2;
    return [
      { id: 'continue', label: 'Continue', x, y: CANVAS_H / 2 + 10, w, h },
      { id: 'new', label: 'New Game', x, y: CANVAS_H / 2 + 90, w, h }
    ];
  }

  function hitTitleButton(mx, my) {
    for (const b of getTitleButtons())
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
        return b.id;
    return null;
  }

  /* ======================================================================
     UNDERGROUND GRID GENERATION
     ====================================================================== */

  // Vein spawn configuration per ore type
  // seedChance: probability that a scan point spawns a vein of this type
  // minLen/maxLen: base vein length range
  // depthLenBonus: multiplier added to maxLen per unit of depth (0..1)
  const VEIN_CONFIG = {
    // Common ores: veins of 3-8, longer at depth
    [TILE_IRON]:     { seedChance: 0.055, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    [TILE_COPPER]:   { seedChance: 0.028, minLen: 3, maxLen: 7, depthLenBonus: 2 },
    [TILE_TIN]:      { seedChance: 0.020, minLen: 3, maxLen: 6, depthLenBonus: 2 },
    [TILE_COAL]:     { seedChance: 0.028, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    // Medium ores: veins of 2-5, longer at depth
    [TILE_LEAD]:     { seedChance: 0.018, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_SILVER]:   { seedChance: 0.015, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_GOLD]:     { seedChance: 0.014, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_WATER]:    { seedChance: 0.032, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_COBALT]:   { seedChance: 0.022, minLen: 2, maxLen: 5, depthLenBonus: 3 },
    // Rare ores: veins of 1-4
    [TILE_QUARTZ]:   { seedChance: 0.014, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    [TILE_REDSTONE]: { seedChance: 0.016, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    // Gems: veins of 1-3, short but valuable
    [TILE_DIAMOND]:  { seedChance: 0.010, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_EMERALD]:  { seedChance: 0.012, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_RUBY]:     { seedChance: 0.011, minLen: 1, maxLen: 3, depthLenBonus: 1 }
  };

  // Depth-based ore availability: which ores can spawn at a given depth factor (0..1)
  function getOreSpawnChance(d, tileType) {
    const ramp = (start, end) => d < start ? 0 : d > end ? 1 : (d - start) / (end - start);
    const bell = (center, width) => Math.max(0, 1 - Math.pow((d - center) / width, 2));
    switch (tileType) {
      case TILE_IRON:     return 0.4 + 0.6 * bell(0.2, 0.3) - 0.2 * ramp(0.6, 1.0);
      case TILE_COPPER:   return 0.1 + 0.9 * bell(0.25, 0.3);
      case TILE_TIN:      return 0.05 + 0.95 * bell(0.3, 0.3);
      case TILE_COAL:     return 0.1 + 0.9 * bell(0.35, 0.35);
      case TILE_LEAD:     return bell(0.45, 0.25);
      case TILE_SILVER:   return ramp(0.2, 0.5) * (1 - 0.4 * ramp(0.8, 1.0));
      case TILE_WATER:    return 0.3 + 0.7 * bell(0.4, 0.35);
      case TILE_COBALT:   return ramp(0.2, 0.5) + 0.5 * ramp(0.5, 0.9);
      case TILE_GOLD:     return ramp(0.35, 0.7) * (1 - 0.3 * ramp(0.9, 1.0));
      case TILE_QUARTZ:   return ramp(0.3, 0.65);
      case TILE_REDSTONE: return ramp(0.55, 0.85);
      case TILE_EMERALD:  return ramp(0.6, 0.9);
      case TILE_DIAMOND:  return ramp(0.65, 0.95);
      case TILE_RUBY:     return ramp(0.63, 0.92);
      default: return 0;
    }
  }

  // Grow a vein from a seed point using random walk / BFS flood
  function growVein(grid, seedR, seedC, tileType, targetLen) {
    const placed = [];
    const frontier = [{ r: seedR, c: seedC }];
    const visited = new Set();
    visited.add(seedR * GRID_COLS + seedC);

    while (placed.length < targetLen && frontier.length > 0) {
      // Pick a random frontier cell
      const idx = Math.floor(Math.random() * frontier.length);
      const { r, c } = frontier[idx];
      frontier.splice(idx, 1);

      // Only place on dirt tiles (don't overwrite other ores or gadgets)
      if (grid[r][c] !== TILE_DIRT) continue;

      grid[r][c] = tileType;
      placed.push({ r, c });

      // Add neighbors to frontier (4-directional)
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        const key = nr * GRID_COLS + nc;
        if (visited.has(key)) continue;
        visited.add(key);
        frontier.push({ r: nr, c: nc });
      }
    }
    return placed.length;
  }

  function generateUnderground() {
    // Step 1: Fill entire grid with dirt
    undergroundGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c)
        row.push(TILE_DIRT);
      undergroundGrid.push(row);
    }

    // Step 2: Spawn ore veins from seed points
    // Scan the grid at every cell; each cell has a chance to seed a vein
    // The ore type picked depends on depth probabilities
    const oreTypes = [
      TILE_IRON, TILE_COPPER, TILE_TIN, TILE_COAL,
      TILE_LEAD, TILE_SILVER, TILE_WATER, TILE_COBALT,
      TILE_GOLD, TILE_QUARTZ,
      TILE_REDSTONE, TILE_EMERALD, TILE_DIAMOND, TILE_RUBY
    ];

    for (let r = 0; r < GRID_ROWS; ++r) {
      const d = r / GRID_ROWS; // depth factor 0..1
      for (let c = 0; c < GRID_COLS; ++c) {
        // Only seed on dirt tiles (skip already placed veins)
        if (undergroundGrid[r][c] !== TILE_DIRT) continue;

        // For each ore type, check if this cell seeds a vein
        for (const oreType of oreTypes) {
          const cfg = VEIN_CONFIG[oreType];
          const depthWeight = getOreSpawnChance(d, oreType);
          if (depthWeight <= 0) continue;

          // Effective seed chance scaled by depth availability
          // Divide by average vein length to keep overall density similar
          const avgLen = (cfg.minLen + cfg.maxLen) / 2;
          const effectiveChance = (cfg.seedChance * depthWeight) / avgLen;

          if (Math.random() < effectiveChance) {
            // Determine vein length: base range + depth bonus
            const depthBonus = Math.floor(d * cfg.depthLenBonus);
            const minL = cfg.minLen;
            const maxL = cfg.maxLen + depthBonus;
            const targetLen = minL + Math.floor(Math.random() * (maxL - minL + 1));
            growVein(undergroundGrid, r, c, oreType, targetLen);
            break; // only one vein type per seed point
          }
        }
      }
    }

    // Clear starting area around player spawn
    const spawnCol = Math.floor(GRID_COLS / 2);
    undergroundGrid[0][spawnCol] = TILE_EMPTY;
    undergroundGrid[0][spawnCol - 1] = TILE_EMPTY;
    undergroundGrid[0][spawnCol + 1] = TILE_EMPTY;

    // Place 4-8 gadget chambers (2x2 TILE_GADGET blocks) spread throughout the larger grid
    gadgetChambers = [];
    const chamberCount = 4 + Math.floor(Math.random() * 5); // 4, 5, 6, 7, or 8
    for (let n = 0; n < chamberCount; ++n) {
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; ++attempt) {
        const cr = 2 + Math.floor(Math.random() * (GRID_ROWS - 3)); // rows 2..GRID_ROWS-2
        const cc = 1 + Math.floor(Math.random() * (GRID_COLS - 3)); // cols 1..GRID_COLS-3
        // Check no overlap with start area (rows 0-1, near spawn) or other chambers
        let ok = true;
        for (let dr = 0; dr < 2 && ok; ++dr)
          for (let dc = 0; dc < 2 && ok; ++dc) {
            if (cr + dr < 2 && cc + dc >= spawnCol - 2 && cc + dc <= spawnCol + 1) ok = false;
            if (undergroundGrid[cr + dr][cc + dc] === TILE_GADGET) ok = false;
          }
        if (!ok) continue;
        // Pick a random mine gadget for this chamber
        const available = MINE_GADGETS.filter(g => !gadgetChambers.some(ch => ch.gadgetType === g));
        const gadgetType = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]
          : MINE_GADGETS[Math.floor(Math.random() * MINE_GADGETS.length)];
        gadgetChambers.push({ r: cr, c: cc, gadgetType, revealed: false });
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            undergroundGrid[cr + dr][cc + dc] = TILE_GADGET;
        placed = true;
      }
    }

    // Initialize persistent tile mining HP arrays
    initTileHP();

    generateDirtNoise();
    generateOreSpeckles();
  }

  // Get intrinsic tile hardness (independent of player upgrades)
  function getTileHardness(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    return BASE_MINE_TIME * depthMultiplier * tileMultiplier;
  }

  // Initialize (or reinitialize) the per-tile mining HP arrays
  function initTileHP() {
    tileHP = [];
    tileMaxHP = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const hpRow = [];
      const maxRow = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) {
          hpRow.push(0);
          maxRow.push(0);
        } else {
          const hp = getTileHardness(r, tile);
          hpRow.push(hp);
          maxRow.push(hp);
        }
      }
      tileHP.push(hpRow);
      tileMaxHP.push(maxRow);
    }
  }

  /* ======================================================================
     GAME INIT / RESET
     ====================================================================== */

  function resetGame() {
    state = STATE_GADGET_SELECT;
    currentView = VIEW_SURFACE;
    transitionProgress = 0;
    transitionTarget = null;
    transitionPhase = 'none';

    domeHP = BASE_DOME_HP;
    maxDomeHP = BASE_DOME_HP;
    resources = { iron: 0, water: 0, cobalt: 0, copper: 0, gold: 0, tin: 0, silver: 0, lead: 0, coal: 0, quartz: 0, redstone: 0, diamond: 0, emerald: 0, ruby: 0 };
    carried = 0;
    carryCapacity = BASE_CARRY_CAPACITY;

    weaponDamage = BASE_WEAPON_DAMAGE;
    fireRate = BASE_FIRE_RATE;
    fireCooldown = 0;
    projectiles = [];
    turretAngle = -Math.PI / 2;
    mouseAimX = -1;
    mouseAimY = -1;

    drillSpeed = BASE_DRILL_SPEED;
    drillX = Math.floor(GRID_COLS / 2);
    drillY = 0;
    drillTimer = 0;
    cameraX = 0;
    cameraY = 0;

    upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0, moveSpeed: 0, miningTools: 0 };

    enemies = [];
    waveNumber = 0;
    waveTimer = 12;
    waveActive = false;
    score = 0;

    // Reset navigation state
    moveTarget = null;
    movePath = null;
    movePathIndex = 0;
    moveStepTimer = 0;
    mineTarget = null;
    moveStepInterval = BASE_MOVE_INTERVAL;

    // Reset mining state
    miningProgress = 0;
    miningDuration = 0;
    miningTarget = null;
    miningDir = null;

    // Reset persistent tile HP (will be re-initialized in generateUnderground)
    tileHP = [];
    tileMaxHP = [];

    // Reset dropped resources
    droppedResources = [];

    // Reset animation state
    animTime = 0;
    pickaxeAngle = 0;
    pickaxeSwinging = false;
    pickaxeSwingTimer = 0;
    domePulsePhase = 0;
    domeHitFlash = 0;
    playerBob = 0;
    crumbleEffects = [];
    dustClouds = [];
    resourceGlows = [];
    shieldImpacts = [];
    tileSparkleTimer = 0;

    // Reset gadget state (clear auto-laser visuals so they never persist into a new game)
    primaryGadget = null;
    primaryGadgetState = {};
    foundGadgets = [];

    // Reset tool/gadget state
    unlockedTools = {};
    activeToolKey = null;
    toolState = {
      drillLastCol: -1,          // last column mined for drill combo
      drillConsecutive: 0,       // consecutive same-column mines
      blastToolCooldown: 0,      // cooldown timer for blast tool
      scannerActive: false,      // whether scanner is passively active
      teleporterCooldown: 0,     // cooldown timer for teleporter
      autoRepairTimer: 0,        // auto-repair interval timer
      jetpackCooldown: 0,        // jetpack cooldown timer
      phaseShiftCooldown: 0,     // phase shift cooldown timer
      echoLocationActive: false  // echo location passive
    };
    showToolPanel = false;
    gadgetSelectHover = -1;

    // Reset upgrade tree
    upgradeTreeLevels = {};
    for (const node of UPGRADE_TREE)
      upgradeTreeLevels[node.id] = 0;
    upgradeDialogHover = null;
    stateBeforeUpgradeDialog = null;
    upgradeZoom = 1.0;
    upgradePanX = 0;
    upgradePanY = 0;
    upgradePanning = false;
    upgradeViewCustomized = false;
    treeFocusId = null;

    // Reset tooltip
    clearTooltip();

    generateUnderground();
    updateWindowTitle();
  }

  function startGameAfterGadgetSelect() {
    state = STATE_PLAYING;
    SZ.GameAudio.play('select');
    // Initialize primary gadget state
    switch (primaryGadget) {
      case 'shield':
        primaryGadgetState = { active: true };
        break;
      case 'repellent':
        primaryGadgetState = { active: false, duration: 0, cooldown: 0 };
        break;
      case 'orchard':
        primaryGadgetState = { fruitTimer: 20, fruitReady: false, speedBoostTimer: 0 };
        break;
      case 'droneyard':
        primaryGadgetState = { droneTimer: 15, droneY: 0, droneActive: false, dronePhase: 0 };
        break;
    }
  }

  /* ======================================================================
     VIEW TRANSITION
     ====================================================================== */

  const TRANSITION_DURATION = 0.6; // seconds for a full view switch
  let transitionPhase = 'none';    // 'none' | 'fade-out' | 'fade-in'

  function toggleView() {
    if (state !== STATE_PLAYING) return;
    if (transitionPhase !== 'none') return;

    transitionTarget = currentView === VIEW_SURFACE ? VIEW_UNDERGROUND : VIEW_SURFACE;
    transitionProgress = 0;
    transitionPhase = 'fade-out';

    // Cancel any active mining when switching views
    cancelMining();
    SZ.GameAudio.play('whoosh', { pitch: transitionTarget === VIEW_SURFACE ? 1.3 : 0.8 });

    if (transitionTarget === VIEW_SURFACE && carried > 0) {
      SZ.GameAudio.play('coin');
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      carried = 0;
    }
  }

  function updateTransition(dt) {
    if (transitionPhase === 'none') return;

    const speed = 1 / (TRANSITION_DURATION / 2); // each half takes TRANSITION_DURATION/2
    transitionProgress += dt * speed;

    if (transitionPhase === 'fade-out' && transitionProgress >= 1) {
      // Midpoint: switch the actual view
      transitionProgress = 1;
      currentView = transitionTarget;
      transitionPhase = 'fade-in';

      // Snap camera to player when entering underground
      if (currentView !== VIEW_SURFACE) {
        const targetCamX = drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
        const targetCamY = drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
        const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
        const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
        cameraX = Math.max(0, Math.min(maxCamX, targetCamX));
        cameraY = Math.max(0, Math.min(maxCamY, targetCamY));

        // Auto-collect loose resources at or near the player position
        for (let i = droppedResources.length - 1; i >= 0; --i) {
          const drop = droppedResources[i];
          const dist = Math.abs(drop.col - drillX) + Math.abs(drop.row - drillY);
          if (dist > 1) continue;
          const canCarry = carryCapacity - carried;
          if (canCarry <= 0) break;
          const pickUp = Math.min(drop.value, canCarry);
          const label = TILE_LABELS[drop.type];
          resources[label] += pickUp;
          carried += pickUp;
          drop.value -= pickUp;
          const tx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
          const ty = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
          floatingText.add(tx, ty - 30, `+${pickUp} ${label}`, { color: '#0f0', font: 'bold 22px sans-serif' });
          if (drop.value <= 0)
            droppedResources.splice(i, 1);
        }
      }
    } else if (transitionPhase === 'fade-in' && transitionProgress >= 2) {
      // Done
      transitionProgress = 0;
      transitionPhase = 'none';
      transitionTarget = null;
    }
  }

  function getTransitionAlpha() {
    if (transitionPhase === 'none') return 1;
    if (transitionPhase === 'fade-out')
      return 1 - transitionProgress; // 1 -> 0
    // fade-in: transitionProgress goes from 1 -> 2
    return transitionProgress - 1; // 0 -> 1
  }

  /* ======================================================================
     ANIMATION UPDATES
     ====================================================================== */

  function updateAnimations(dt) {
    animTime += dt;

    // Dome pulse
    domePulsePhase += dt * 2.0;

    // Dome hit flash decay
    if (domeHitFlash > 0)
      domeHitFlash = Math.max(0, domeHitFlash - dt * 4);

    // Player idle bob
    playerBob = Math.sin(animTime * 3) * 2;

    // Pickaxe swing
    if (pickaxeSwinging) {
      pickaxeSwingTimer -= dt;
      const progress = 1 - (pickaxeSwingTimer / PICKAXE_SWING_DURATION);
      // Swing out to 70 deg then back
      if (progress < 0.5)
        pickaxeAngle = progress * 2 * 1.2;
      else
        pickaxeAngle = (1 - progress) * 2 * 1.2;

      if (pickaxeSwingTimer <= 0) {
        pickaxeSwinging = false;
        pickaxeAngle = 0;
      }
    }

    // Crumble effects
    for (let i = crumbleEffects.length - 1; i >= 0; --i) {
      const c = crumbleEffects[i];
      c.life -= dt;
      for (const p of c.pieces) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 0.15;
        p.rot += p.rotV;
      }
      if (c.life <= 0)
        crumbleEffects.splice(i, 1);
    }

    // Dust clouds
    for (let i = dustClouds.length - 1; i >= 0; --i) {
      const d = dustClouds[i];
      d.alpha -= dt * 2;
      d.radius += d.expandRate * dt * 60;
      d.y -= dt * 15;
      if (d.alpha <= 0)
        dustClouds.splice(i, 1);
    }

    // Resource glows
    for (let i = resourceGlows.length - 1; i >= 0; --i) {
      const g = resourceGlows[i];
      g.life -= dt * 1.5;
      g.radius += dt * 40;
      if (g.life <= 0)
        resourceGlows.splice(i, 1);
    }

    // Shield impacts
    for (let i = shieldImpacts.length - 1; i >= 0; --i) {
      const s = shieldImpacts[i];
      s.life -= dt * 3;
      if (s.life <= 0)
        shieldImpacts.splice(i, 1);
    }

    // Ambient sparkles on resource tiles underground
    if (currentView === VIEW_UNDERGROUND) {
      tileSparkleTimer -= dt;
      if (tileSparkleTimer <= 0) {
        tileSparkleTimer = 0.3 + Math.random() * 0.4;
        // Pick a random visible resource tile
        const candidates = [];
        const spkR0 = Math.max(0, Math.floor(cameraY / TILE_SIZE));
        const spkR1 = Math.min(GRID_ROWS, Math.ceil((cameraY + CANVAS_H) / TILE_SIZE));
        const spkC0 = Math.max(0, Math.floor(cameraX / TILE_SIZE));
        const spkC1 = Math.min(GRID_COLS, Math.ceil((cameraX + CANVAS_W) / TILE_SIZE));
        for (let r = spkR0; r < spkR1; ++r)
          for (let c = spkC0; c < spkC1; ++c)
            if (undergroundGrid[r][c] !== TILE_EMPTY && undergroundGrid[r][c] !== TILE_DIRT && undergroundGrid[r][c] !== TILE_GADGET)
              candidates.push({ r, c });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const sx = pick.c * TILE_SIZE + Math.random() * TILE_SIZE - cameraX;
          const sy = pick.r * TILE_SIZE + Math.random() * TILE_SIZE - cameraY;
          particles.sparkle(sx, sy, 1, { color: TILE_HIGHLIGHT_COLORS[undergroundGrid[pick.r][pick.c]] || '#fff', speed: 0.5 });
        }
      }
    }

    // Update starfield
    starfield.update(dt);

    // Update enemy animation phases
    for (const e of enemies) {
      if (e.wobblePhase === undefined) {
        e.wobblePhase = Math.random() * TWO_PI;
        e.legPhase = Math.random() * TWO_PI;
        e.eyeBlinkTimer = 2 + Math.random() * 3;
        e.eyeBlinking = false;
      }
      e.wobblePhase += dt * 4;
      e.legPhase += dt * 8;
      if (e.type === 'flyer')
        e.wingPhase = (e.wingPhase || 0) + dt * 12;
      e.eyeBlinkTimer -= dt;
      if (e.eyeBlinkTimer <= 0) {
        e.eyeBlinking = !e.eyeBlinking;
        e.eyeBlinkTimer = e.eyeBlinking ? 0.15 : (2 + Math.random() * 3);
      }
    }
  }

  /* ======================================================================
     CRUMBLE / DUST SPAWNERS
     ====================================================================== */

  function spawnCrumble(tx, ty, color) {
    const pieces = [];
    for (let i = 0; i < 8; ++i)
      pieces.push({
        x: tx + (Math.random() - 0.5) * 20,
        y: ty + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        rot: Math.random() * TWO_PI,
        rotV: (Math.random() - 0.5) * 0.3,
        size: 4 + Math.random() * 8,
        color: color
      });
    crumbleEffects.push({ x: tx, y: ty, pieces, life: 0.6 });
  }

  function spawnDust(tx, ty) {
    for (let i = 0; i < 3; ++i)
      dustClouds.push({
        x: tx + (Math.random() - 0.5) * 30,
        y: ty + (Math.random() - 0.5) * 10,
        alpha: 0.4 + Math.random() * 0.2,
        radius: 6 + Math.random() * 8,
        expandRate: 0.5 + Math.random() * 0.3
      });
  }

  function spawnResourceGlow(tx, ty, color) {
    resourceGlows.push({ x: tx, y: ty, color, life: 1.0, radius: 10 });
  }

  function spawnShieldImpact(ex, ey) {
    const angle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    shieldImpacts.push({ angle, life: 1.0, intensity: 1.0 });
  }

  /* ======================================================================
     DAMAGE HELPER (shields)
     ====================================================================== */

  function applyDamageToEnemy(e, amount) {
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
      particles.burst(e.x, e.y, 6, { color: '#4af', speed: 2, life: 0.3 });
      if (e.shield <= 0) {
        e.shield = 0;
        SZ.GameAudio.play('zap');
        floatingText.add(e.x, e.y - (e.size || 20) - 36, 'SHIELD BROKEN', { color: '#4af', font: 'bold 22px sans-serif' });
        particles.burst(e.x, e.y, 15, { color: '#4af', speed: 3.5, life: 0.5 });
        particles.sparkle(e.x, e.y, 8, { color: '#8cf', speed: 2 });
      }
    }
    e.hp -= amount;
  }

  /* ======================================================================
     PATHFINDING (BFS for underground navigation)
     ====================================================================== */

  function findPath(fromCol, fromRow, toCol, toRow) {
    if (fromCol === toCol && fromRow === toRow) return [];
    if (toCol < 0 || toCol >= GRID_COLS || toRow < 0 || toRow >= GRID_ROWS) return null;
    if (undergroundGrid[toRow][toCol] !== TILE_EMPTY) return null;

    const visited = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      visited.push([]);
      for (let c = 0; c < GRID_COLS; ++c)
        visited[r].push(false);
    }

    const prev = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      prev.push([]);
      for (let c = 0; c < GRID_COLS; ++c)
        prev[r].push(null);
    }

    const queue = [{ col: fromCol, row: fromRow }];
    visited[fromRow][fromCol] = true;
    const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.col === toCol && cur.row === toRow) {
        // Reconstruct path
        const path = [];
        let step = { col: toCol, row: toRow };
        while (step.col !== fromCol || step.row !== fromRow) {
          path.unshift(step);
          step = prev[step.row][step.col];
        }
        return path;
      }
      for (const d of dirs) {
        const nc = cur.col + d.dc;
        const nr = cur.row + d.dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        if (visited[nr][nc]) continue;
        if (undergroundGrid[nr][nc] !== TILE_EMPTY) continue;
        visited[nr][nc] = true;
        prev[nr][nc] = { col: cur.col, row: cur.row };
        queue.push({ col: nc, row: nr });
      }
    }
    return null; // no path found
  }

  function findAdjacentEmptyNear(targetCol, targetRow) {
    // Find the closest empty tile adjacent to (targetCol, targetRow) that has a path from player
    const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];
    let bestPath = null;
    let bestAdj = null;
    for (const d of dirs) {
      const ac = targetCol + d.dc;
      const ar = targetRow + d.dr;
      if (ac < 0 || ac >= GRID_COLS || ar < 0 || ar >= GRID_ROWS) continue;
      if (undergroundGrid[ar][ac] !== TILE_EMPTY) continue;
      const path = findPath(drillX, drillY, ac, ar);
      if (path !== null && (bestPath === null || path.length < bestPath.length)) {
        bestPath = path;
        bestAdj = { col: ac, row: ar, dx: targetCol - ac, dy: targetRow - ar };
      }
    }
    return bestAdj ? { path: bestPath, adj: bestAdj } : null;
  }

  /* ======================================================================
     ENEMY WAVES
     ====================================================================== */

  function spawnWave() {
    ++waveNumber;
    waveActive = true;

    // Recharge shield gadget at wave start
    if (primaryGadget === 'shield') {
      primaryGadgetState.active = true;
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
    }

    const isBossWave = waveNumber >= 15 && waveNumber % 5 === 0;

    // Gradual count ramp: 2 at wave 1, slowly increases, capped at 20
    const baseCount = Math.min(20, 2 + Math.floor(waveNumber * 0.8));
    // Flyer ratio: 0% for waves 1-4, ramps to ~40% by wave 10+
    const flyerRatio = waveNumber <= 4 ? 0 : Math.min(0.4, (waveNumber - 4) * 0.07);
    const flyerCount = Math.floor(baseCount * flyerRatio);
    const walkerCount = baseCount - flyerCount;

    // HP scaling: starts very low (8-10 for wave 1), gradually increases
    const baseHP = 8 + (waveNumber - 1) * 3;
    // Damage scaling: starts at 2-3, gradually increases
    const baseDamage = 2 + Math.floor((waveNumber - 1) * 0.8);
    // Speed scaling
    const baseSpeed = 15 + Math.min(25, waveNumber * 2);

    // Spawn ground walkers
    for (let i = 0; i < walkerCount; ++i) {
      // Ground walkers approach from left or right at ground level
      const fromLeft = Math.random() < 0.5;
      const spawnX = fromLeft ? -60 - Math.random() * 160 : CANVAS_W + 60 + Math.random() * 160;
      const spawnY = DOME_Y + (Math.random() - 0.5) * 40;

      const isArmored = waveNumber >= 9 && Math.random() < Math.min(0.35, (waveNumber - 8) * 0.07);
      const hpMult = isArmored ? 2.0 : 1.0;
      const spdMult = isArmored ? 0.75 : 1.0;
      const sizeMult = isArmored ? 1.3 : 1.0;
      const hp = (baseHP + Math.random() * 5) * hpMult;
      const hasShield = waveNumber >= 11 && Math.random() < Math.min(0.3, (waveNumber - 10) * 0.05);
      const shieldVal = hasShield ? Math.floor(hp * 0.5 + waveNumber) : 0;

      enemies.push({
        type: 'ground',
        x: spawnX,
        y: spawnY,
        hp: hp,
        maxHP: hp,
        speed: (baseSpeed + Math.random() * 10) * spdMult,
        damage: baseDamage + Math.floor(Math.random() * 2),
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: (20 + Math.random() * 8) * sizeMult,
        armored: isArmored,
        shield: shieldVal,
        maxShield: shieldVal,
        boss: false
      });
    }

    // Spawn airborne flyers
    for (let i = 0; i < flyerCount; ++i) {
      // Flyers approach from upper hemisphere at any angle
      const angle = Math.PI + Math.random() * Math.PI;
      const dist = 600 + Math.random() * 200;
      const flyerHP = (baseHP * 0.6 + Math.random() * 3);
      const hasShield = waveNumber >= 11 && Math.random() < Math.min(0.2, (waveNumber - 10) * 0.04);
      const shieldVal = hasShield ? Math.floor(flyerHP * 0.4 + waveNumber * 0.5) : 0;

      enemies.push({
        type: 'flyer',
        x: DOME_X + Math.cos(angle) * dist,
        y: DOME_Y + Math.sin(angle) * dist * 0.6,
        hp: flyerHP,
        maxHP: flyerHP,
        speed: baseSpeed * 1.3 + Math.random() * 12,
        damage: Math.max(1, baseDamage - 1),
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        wingPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: 14 + Math.random() * 6,
        armored: false,
        shield: shieldVal,
        maxShield: shieldVal,
        boss: false
      });
    }

    // Boss enemy every 5 waves starting at wave 15
    if (isBossWave) {
      const bossHP = baseHP * 8 + waveNumber * 5;
      const bossShield = Math.floor(bossHP * 0.4);
      const fromLeft = Math.random() < 0.5;
      enemies.push({
        type: 'ground',
        x: fromLeft ? -120 : CANVAS_W + 120,
        y: DOME_Y - 20,
        hp: bossHP,
        maxHP: bossHP,
        speed: baseSpeed * 0.5,
        damage: baseDamage * 3,
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: 44 + Math.random() * 8,
        armored: true,
        shield: bossShield,
        maxShield: bossShield,
        boss: true
      });
      floatingText.add(CANVAS_W / 2, 140, 'BOSS INCOMING!', { color: '#f00', font: 'bold 48px sans-serif' });
      SZ.GameAudio.play('hurt', { pitch: 0.5 });
    } else
      SZ.GameAudio.play('select', { pitch: 0.75 });

    floatingText.add(CANVAS_W / 2, 80, `WAVE ${waveNumber}`, { color: '#f80', font: 'bold 40px sans-serif' });
    updateWindowTitle();
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      const dx = DOME_X - e.x;
      const dy = DOME_Y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Repellent field slows enemies
      const speedMult = (primaryGadget === 'repellent' && primaryGadgetState.active) ? 0.4 : 1.0;
      // Stun laser freezes targeted enemy
      const isStunned = e.stunTimer > 0;
      if (isStunned) {
        e.stunTimer -= dt;
        if (e.stunTimer < 0) e.stunTimer = 0;
      }

      if (dist > DOME_RADIUS + 10) {
        if (!isStunned) {
          e.x += (dx / dist) * e.speed * speedMult * dt;
          e.y += (dy / dist) * e.speed * speedMult * dt;
        }
      } else if (!isStunned) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = 1.0;

          // Shield gadget absorbs first hit
          if (primaryGadget === 'shield' && primaryGadgetState.active) {
            primaryGadgetState.active = false;
            SZ.GameAudio.play('zap', { pitch: 0.7 });
            floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Absorbed!', { color: '#4af', font: 'bold 28px sans-serif' });
            particles.burst(e.x, e.y, 15, { color: '#4af', speed: 3, life: 0.5 });
            spawnShieldImpact(e.x, e.y);
            continue; // skip damage
          }

          let effectiveDmg = e.damage;
          if (unlockedTools.reinforcedDome) effectiveDmg = Math.ceil(effectiveDmg * 0.75);
          if (unlockedTools.energyShield) effectiveDmg = Math.ceil(effectiveDmg * 0.85);
          domeHP -= effectiveDmg;
          domeHitFlash = 1.0;
          screenShake.trigger(8, 250);
          // several attackers hit at once: one groan per moment, not a chorus
          const hurtNow = performance.now();
          if (hurtNow - lastDomeHurtSound > 400) {
            lastDomeHurtSound = hurtNow;
            SZ.GameAudio.play('hurt', { volume: 0.7 });
          }
          floatingText.add(DOME_X + (Math.random() - 0.5) * 80, DOME_Y - 60, `-${effectiveDmg} HP`, { color: '#f44', font: 'bold 28px sans-serif' });

          // Shield impact flash
          spawnShieldImpact(e.x, e.y);

          // Dome-hit sparks along the shield surface
          const impactAngle = Math.atan2(e.y - DOME_Y, e.x - DOME_X);
          for (let s = 0; s < 12; ++s) {
            const spread = (Math.random() - 0.5) * 0.6;
            const sa = impactAngle + spread;
            const ix = DOME_X + Math.cos(sa) * DOME_RADIUS;
            const iy = DOME_Y + Math.sin(sa) * DOME_RADIUS;
            particles.trail(ix, iy, {
              vx: Math.cos(sa) * (1 + Math.random() * 2),
              vy: Math.sin(sa) * (1 + Math.random() * 2) - 1,
              color: Math.random() > 0.5 ? '#4af' : '#8cf',
              life: 0.3 + Math.random() * 0.3,
              size: 1 + Math.random() * 2
            });
          }
          particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2.5, life: 0.5 });

          if (domeHP <= 0) {
            domeHP = 0;
            state = STATE_GAME_OVER;
            // Dome destruction explosion
            particles.burst(DOME_X, DOME_Y, 40, { color: '#4af', speed: 5, life: 0.8 });
            particles.burst(DOME_X, DOME_Y, 25, { color: '#f80', speed: 4, life: 0.6 });
            screenShake.trigger(15, 500);
            SZ.GameAudio.play('explode');
            SZ.GameAudio.play('lose');
            addHighScore(waveNumber, score);
            clearSave();
            updateWindowTitle();
            return;
          }
        }
      }

      // Remove dead enemies with death animation
      if (e.hp <= 0) {
        score += 10 + waveNumber * 5;
        SZ.GameAudio.play(e.boss ? 'explode' : 'smallExplode', { pitch: 0.85 + Math.random() * 0.3 });
        // Chunky death explosion
        particles.burst(e.x, e.y, 20, { color: '#fa0', speed: 3.5, life: 0.6, gravity: 0.05 });
        particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2, life: 0.4 });
        particles.sparkle(e.x, e.y, 6, { color: '#ff0', speed: 1.5 });
        // Gore chunks (squares)
        for (let g = 0; g < 5; ++g)
          particles.trail(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, {
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            color: '#c33',
            life: 0.5 + Math.random() * 0.3,
            size: 3 + Math.random() * 3,
            gravity: 0.12,
            shape: 'square'
          });
        floatingText.add(e.x, e.y - 30, `+${10 + waveNumber * 5}`, { color: '#ff0', font: 'bold 24px sans-serif' });
        enemies.splice(i, 1);
      }
    }

    if (waveActive && enemies.length === 0) {
      waveActive = false;
      waveTimer = WAVE_INTERVAL;
      SZ.GameAudio.play('levelup');
      floatingText.add(CANVAS_W / 2, 80, 'WAVE CLEAR!', { color: '#0f0', font: 'bold 36px sans-serif' });
      saveRun();
    }
  }

  /* ======================================================================
     WEAPON SYSTEM
     ====================================================================== */

  function updateWeapon(dt) {
    if (currentView !== VIEW_SURFACE) return;

    // Turret aiming: track mouse position continuously
    // Nozzle moves along dome arc — compute aim angle from dome center
    // Upper semicircle only, clamped above ground so nozzle never dips into terrain
    const TURRET_MIN_ANGLE = -Math.PI;
    const TURRET_MAX_ANGLE = 0;
    if (mouseAimX >= 0 && mouseAimY >= 0) {
      const adx = mouseAimX - DOME_X;
      const ady = mouseAimY - DOME_Y;
      if (adx * adx + ady * ady > 4) {
        if (ady < 0)
          // Mouse is above ground — atan2 with negative ady always yields [-PI, 0]
          turretAngle = Math.atan2(ady, adx);
        // When mouse is below ground, don't change turret angle — avoids snapping
      }
    }

    // Keyboard aiming: Left/Right or A/D rotate barrel
    if (keys['ArrowLeft'] || keys['KeyA'])
      turretAngle -= TURRET_KEYBOARD_SPEED * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      turretAngle += TURRET_KEYBOARD_SPEED * dt;

    // Clamp turret to upper dome arc, above ground on both sides
    if (turretAngle > TURRET_MAX_ANGLE) turretAngle = TURRET_MAX_ANGLE;
    if (turretAngle < TURRET_MIN_ANGLE) turretAngle = TURRET_MIN_ANGLE;

    // Nozzle position on dome arc
    const nozzleR = DOME_RADIUS + 16;
    const turretBaseX = DOME_X + Math.cos(turretAngle) * nozzleR;
    const turretBaseY = DOME_Y + Math.sin(turretAngle) * nozzleR;

    fireCooldown -= dt;

    // Fire toward current turret aim direction on click
    if (fireRequested && fireCooldown <= 0) {
      fireRequested = false;
      fireCooldown = 1.0 / fireRate;

      // Project a far-off aim point along the turret angle
      const aimDist = 400;
      const farX = turretBaseX + Math.cos(turretAngle) * aimDist;
      const farY = turretBaseY + Math.sin(turretAngle) * aimDist;

      // Find enemy closest to the projected aim line
      let target = null;
      let bestDist = 80 * 80; // hit radius of 80px
      for (const e of enemies) {
        const dx = e.x - farX;
        const dy = e.y - farY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          target = e;
        }
      }

      // Also check enemies near the aim line (not just the far point)
      if (!target) {
        let bestLineDist = 60;
        for (const e of enemies) {
          // Distance from enemy to the aim ray
          const ex = e.x - turretBaseX;
          const ey = e.y - turretBaseY;
          const projLen = ex * Math.cos(turretAngle) + ey * Math.sin(turretAngle);
          if (projLen < -nozzleR) continue; // skip only enemies truly behind dome center
          const perpDist = Math.abs(-ex * Math.sin(turretAngle) + ey * Math.cos(turretAngle));
          if (perpDist < bestLineDist) {
            bestLineDist = perpDist;
            target = e;
          }
        }
      }

      const tx = target ? target.x : farX;
      const ty = target ? target.y : farY;

      const muzzleX = turretBaseX + Math.cos(turretAngle) * TURRET_BARREL_LENGTH;
      const muzzleY = turretBaseY + Math.sin(turretAngle) * TURRET_BARREL_LENGTH;

      projectiles.push({
        x: muzzleX,
        y: muzzleY,
        tx, ty,
        target,
        life: 0.3,
        maxLife: 0.3
      });

      if (target) {
        applyDamageToEnemy(target, weaponDamage);

        // Chain Lightning: arc damage to 2 nearby enemies
        if (unlockedTools.chainLightning) {
          let chainCount = 0;
          const chainDamage = Math.ceil(weaponDamage * 0.4);
          for (const ce of enemies) {
            if (ce === target || chainCount >= 2) break;
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 160 * 160) {
              applyDamageToEnemy(ce, chainDamage);
              particles.burst(ce.x, ce.y, 4, { color: '#4af', speed: 2, life: 0.2 });
              // Arc visual
              projectiles.push({ x: target.x, y: target.y, tx: ce.x, ty: ce.y, life: 0.15, maxLife: 0.15 });
              ++chainCount;
            }
          }
        }

        // Freeze Ray: slow enemies near target
        if (unlockedTools.freezeRay) {
          for (const ce of enemies) {
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 120 * 120)
              ce.stunTimer = Math.max(ce.stunTimer || 0, 0.8);
          }
        }

        // Plasma Cannon: AoE damage around target
        if (unlockedTools.plasmaCannon) {
          const aoeDamage = Math.ceil(weaponDamage * 0.6);
          for (const ce of enemies) {
            if (ce === target) continue;
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 140 * 140) {
              applyDamageToEnemy(ce, aoeDamage);
              particles.burst(ce.x, ce.y, 6, { color: '#f80', speed: 2, life: 0.3 });
            }
          }
          particles.burst(target.x, target.y, 15, { color: '#f80', speed: 3, life: 0.4 });
        }
      }

      particles.burst(muzzleX, muzzleY, 4, { color: '#faa', speed: 1.5, life: 0.15, size: 2 });
      SZ.GameAudio.play('laser', { pitch: 0.95 + Math.random() * 0.1, volume: 0.7 });
    }

    fireRequested = false;

    for (let i = projectiles.length - 1; i >= 0; --i) {
      projectiles[i].life -= dt;
      if (projectiles[i].life <= 0)
        projectiles.splice(i, 1);
    }
  }

  /* ======================================================================
     MINING
     ====================================================================== */

  function cancelMining() {
    // Save partial progress to the tile's HP array so it persists
    if (miningTarget && miningDuration > 0 && miningProgress > 0) {
      const r = miningTarget.row;
      const c = miningTarget.col;
      if (tileMaxHP[r] && tileMaxHP[r][c] > 0)
        tileHP[r][c] = tileMaxHP[r][c] * (1 - Math.min(miningProgress / miningDuration, 0.99));
    }
    miningTarget = null;
    miningDir = null;
    miningProgress = 0;
    miningDuration = 0;
  }

  function getMiningTime(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    let time = BASE_MINE_TIME * depthMultiplier * tileMultiplier;

    // Drill speed upgrade reduces mining time
    const effectiveDrillSpeed = (primaryGadget === 'orchard' && primaryGadgetState.speedBoostTimer > 0)
      ? drillSpeed * 0.7
      : drillSpeed;
    // drillSpeed starts at 0.3 and decreases with upgrades; normalize to a multiplier
    time *= effectiveDrillSpeed / BASE_DRILL_SPEED;

    // Mining tools upgrade: each level reduces time by 20%
    time *= Math.pow(0.8, getEffectiveLevel('miningTools'));

    // Drill Gadget: 30% faster when mining consecutive tiles in the same column
    if (unlockedTools.drill && activeToolKey === 'drill' && toolState.drillConsecutive > 0)
      time *= 0.7;

    return time;
  }

  function tryMine(dx, dy) {
    if (state !== STATE_PLAYING) return;
    if (currentView !== VIEW_UNDERGROUND) return;

    const nx = drillX + dx;
    const ny = drillY + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile = undergroundGrid[ny][nx];
    if (tile === TILE_EMPTY) {
      // Movement dust
      cancelMining();
      const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      spawnDust(cx, cy);
      drillX = nx;
      drillY = ny;
      // Pick up dropped resources at destination
      pickUpDroppedResources();
      return;
    }

    // If already mining the same block, ignore repeated starts
    if (miningTarget && miningTarget.col === nx && miningTarget.row === ny)
      return;

    // Start mining a new block (save progress of previous target first)
    cancelMining();
    miningTarget = { col: nx, row: ny };
    miningDir = { dx, dy };
    miningDuration = getMiningTime(ny, tile);

    // Restore partial progress from persistent tile HP
    if (tileMaxHP[ny] && tileMaxHP[ny][nx] > 0 && tileHP[ny][nx] < tileMaxHP[ny][nx])
      miningProgress = miningDuration * (1 - tileHP[ny][nx] / tileMaxHP[ny][nx]);
    else
      miningProgress = 0;

    lastMineDir = { dx, dy };
    SZ.GameAudio.play('click', { pitch: 0.5 });

    // Trigger pickaxe swing animation
    pickaxeSwinging = true;
    pickaxeSwingTimer = PICKAXE_SWING_DURATION;
  }

  function completeMining() {
    if (!miningTarget) return;

    const nx = miningTarget.col;
    const ny = miningTarget.row;
    const dx = miningDir.dx;
    const dy = miningDir.dy;
    const tile = undergroundGrid[ny][nx];

    // Trigger pickaxe swing animation on completion
    pickaxeSwinging = true;
    pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    lastMineDir = { dx, dy };

    const tx = nx * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const ty = ny * TILE_SIZE + TILE_SIZE / 2 - cameraY;

    // Rich mining particles
    const tileColor = getTileBaseColor(tile, ny);

    // Directional rock debris (chunks fly opposite to mining direction)
    for (let p = 0; p < 6; ++p)
      particles.trail(tx + (Math.random() - 0.5) * 12, ty + (Math.random() - 0.5) * 12, {
        vx: -dx * (1.5 + Math.random() * 2) + (Math.random() - 0.5),
        vy: -dy * (1.5 + Math.random() * 2) - Math.random() * 1.5,
        color: tileColor,
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        gravity: 0.08,
        shape: 'square'
      });

    // Small circular dust particles
    particles.burst(tx, ty, 6, { color: '#8a7a6a', speed: 1.5, life: 0.3, size: 1.5 });

    // Rock crumble animation
    spawnCrumble(tx, ty, tileColor);

    // Dust cloud at impact
    spawnDust(tx, ty);

    // Stronger shake for mining
    screenShake.trigger(4, 120);
    SZ.GameAudio.play('thud', { pitch: 0.9 + Math.random() * 0.2, volume: 0.7 });

    if (RESOURCE_TILES.includes(tile)) {
      const label = TILE_LABELS[tile];
      let value = TILE_VALUES[tile];

      // Fortune: 30% chance to double ore yield
      if (unlockedTools.fortune && Math.random() < 0.3) {
        value *= 2;
        const tx2 = nx * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty2 = ny * TILE_SIZE + TILE_SIZE / 2 - cameraY;
        floatingText.add(tx2, ty2 - 60, 'FORTUNE!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        particles.sparkle(tx2, ty2, 8, { color: '#ffd700', speed: 2 });
      }

      const fitsInInventory = Math.min(value, carryCapacity - carried);
      const excess = value - fitsInInventory;

      if (fitsInInventory > 0) {
        resources[label] += fitsInInventory;
        carried += fitsInInventory;
        floatingText.add(tx, ty - 30, `+${fitsInInventory} ${label}`, { color: '#0f0', font: 'bold 24px sans-serif' });
      }

      // Drop excess resources on the ground
      if (excess > 0) {
        droppedResources.push({ col: nx, row: ny, type: tile, value: excess, age: 0 });
        floatingText.add(tx, ty - 60, `${excess} ${label} dropped!`, { color: '#f80', font: 'bold 22px sans-serif' });
      }

      SZ.GameAudio.play('pickup', { pitch: 0.9 + RESOURCE_TILES.indexOf(tile) * 0.04 });
      // Resource reveal glow burst
      spawnResourceGlow(tx, ty, TILE_HIGHLIGHT_COLORS[tile] || '#fff');
      particles.sparkle(tx, ty, 12, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2.5 });

      // Extra screen shake for precious resources
      screenShake.trigger(5, 150);
    }

    // Gadget chamber tile -- grant the chamber's gadget
    if (tile === TILE_GADGET) {
      const chamber = gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === ny && ch.c + dc === nx) return true;
        return false;
      });
      if (chamber) {
        grantMineGadget(chamber.gadgetType, tx, ty);
        // Clear remaining tiles of this chamber
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (undergroundGrid[chamber.r + dr][chamber.c + dc] === TILE_GADGET) {
              undergroundGrid[chamber.r + dr][chamber.c + dc] = TILE_EMPTY;
              if (tileHP[chamber.r + dr]) tileHP[chamber.r + dr][chamber.c + dc] = 0;
              if (tileMaxHP[chamber.r + dr]) tileMaxHP[chamber.r + dr][chamber.c + dc] = 0;
            }
      }
    }

    undergroundGrid[ny][nx] = TILE_EMPTY;
    // Reset tile HP on clear
    if (tileHP[ny]) tileHP[ny][nx] = 0;
    if (tileMaxHP[ny]) tileMaxHP[ny][nx] = 0;
    drillX = nx;
    drillY = ny;

    // Track drill gadget consecutive column mining
    if (unlockedTools.drill && activeToolKey === 'drill') {
      if (dy === 1 && dx === 0 && nx === toolState.drillLastCol)
        ++toolState.drillConsecutive;
      else
        toolState.drillConsecutive = 0;
      toolState.drillLastCol = nx;
    }

    // Pick up dropped resources at destination
    pickUpDroppedResources();

    // Reveal adjacent gadget chambers
    for (const ch of gadgetChambers) {
      if (ch.revealed) continue;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          const cr = ch.r + dr, cc = ch.c + dc;
          if (Math.abs(cr - ny) + Math.abs(cc - nx) === 1)
            ch.revealed = true;
        }
    }

    cancelMining();
  }

  function updateMining(dt) {
    if (!miningTarget) return;
    if (currentView !== VIEW_UNDERGROUND) {
      cancelMining();
      return;
    }

    // Check the block is still there (blast mining could clear it)
    const tile = undergroundGrid[miningTarget.row][miningTarget.col];
    if (tile === TILE_EMPTY) {
      cancelMining();
      return;
    }

    miningProgress += dt;

    // Update persistent tile HP in real-time for visual crack overlay
    const mr = miningTarget.row;
    const mc = miningTarget.col;
    if (tileMaxHP[mr] && tileMaxHP[mr][mc] > 0) {
      const ratio = Math.min(miningProgress / miningDuration, 1);
      tileHP[mr][mc] = tileMaxHP[mr][mc] * (1 - ratio);
    }

    // Periodically retrigger pickaxe swing animation while mining
    if (!pickaxeSwinging) {
      pickaxeSwinging = true;
      pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    }

    // Emit small mining particles while in progress
    if (Math.random() < dt * 8) {
      const tx = miningTarget.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const ty = miningTarget.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      const tileColor = getTileBaseColor(tile, miningTarget.row);
      particles.trail(tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 10, {
        vx: -(miningDir.dx) * (0.5 + Math.random()),
        vy: -(miningDir.dy) * (0.5 + Math.random()) - Math.random() * 0.5,
        color: tileColor,
        life: 0.2 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        gravity: 0.05,
        shape: 'square'
      });
    }

    if (miningProgress >= miningDuration)
      completeMining();
  }

  function pickUpDroppedResources() {
    for (let i = droppedResources.length - 1; i >= 0; --i) {
      const drop = droppedResources[i];
      if (drop.col !== drillX || drop.row !== drillY) continue;

      const canCarry = carryCapacity - carried;
      if (canCarry <= 0) break;

      const pickUp = Math.min(drop.value, canCarry);
      const label = TILE_LABELS[drop.type];
      resources[label] += pickUp;
      carried += pickUp;
      drop.value -= pickUp;

      const tx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const ty = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      floatingText.add(tx, ty - 30, `+${pickUp} ${label}`, { color: '#0f0', font: 'bold 22px sans-serif' });
      SZ.GameAudio.play('pickup', { volume: 0.6 });

      if (drop.value <= 0)
        droppedResources.splice(i, 1);
    }
  }

  function grantMineGadget(type, tx, ty) {
    foundGadgets.push(type);
    const name = MINE_GADGET_NAMES[type] || type;
    SZ.GameAudio.play('powerup');
    floatingText.add(tx, ty - 50, `GADGET: ${name}!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.burst(tx, ty, 25, { color: '#ffd700', speed: 3, life: 0.7 });
    particles.sparkle(tx, ty, 15, { color: '#ffaa00', speed: 2 });
    screenShake.trigger(8, 200);

    switch (type) {
      case 'domeArmor':
        maxDomeHP += 50;
        domeHP = Math.min(domeHP + 50, maxDomeHP);
        floatingText.add(tx, ty - 90, '+50 Max HP!', { color: '#0f0', font: 'bold 24px sans-serif' });
        break;
      case 'blastMining':
        primaryGadgetState.blastCharges = (primaryGadgetState.blastCharges || 0) + 2;
        floatingText.add(tx, ty - 90, '+2 Blast Charges!', { color: '#f80', font: 'bold 24px sans-serif' });
        break;
      case 'probeScanner':
        primaryGadgetState.probeTimer = 15;
        primaryGadgetState.probePlayerR = drillY;
        primaryGadgetState.probePlayerC = drillX;
        floatingText.add(tx, ty - 90, 'Resources Revealed!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        break;
      case 'autoCannon':
        primaryGadgetState.autoCannonTimer = 0;
        break;
      case 'stunLaser':
        primaryGadgetState.stunLaserTimer = 0;
        primaryGadgetState.stunLaserTarget = null;
        primaryGadgetState.stunLaserFlash = 0;
        break;
      case 'condenser':
        primaryGadgetState.condenserTimer = 0;
        break;
    }
  }

  function useBlastMining() {
    if (!foundGadgets.includes('blastMining')) return;
    if ((primaryGadgetState.blastCharges || 0) <= 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;

    --primaryGadgetState.blastCharges;
    SZ.GameAudio.play('explode');
    floatingText.add(
      drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
      drillY * TILE_SIZE - 10 - cameraY,
      `BLAST! (${primaryGadgetState.blastCharges} left)`,
      { color: '#f80', font: 'bold 28px sans-serif' }
    );

    // Clear 3x3 area around player
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        const r = drillY + dr, c = drillX + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;

        const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;

        if (tile === TILE_GADGET) {
          const chamber = gadgetChambers.find(ch => {
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                if (ch.r + dr2 === r && ch.c + dc2 === c) return true;
            return false;
          });
          if (chamber) {
            grantMineGadget(chamber.gadgetType, tx, ty);
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                undergroundGrid[chamber.r + dr2][chamber.c + dc2] = TILE_EMPTY;
          }
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = TILE_VALUES[tile];
          const fitsInInventory = Math.min(value, carryCapacity - carried);
          const excess = value - fitsInInventory;
          if (fitsInInventory > 0) {
            resources[label] += fitsInInventory;
            carried += fitsInInventory;
          }
          if (excess > 0)
            droppedResources.push({ col: c, row: r, type: tile, value: excess, age: 0 });
        }
        undergroundGrid[r][c] = TILE_EMPTY;
        if (tileHP[r]) tileHP[r][c] = 0;
        if (tileMaxHP[r]) tileMaxHP[r][c] = 0;

        // Red explosive flash particles
        particles.burst(tx, ty, 8, { color: '#f44', speed: 2.5, life: 0.4 });
        spawnCrumble(tx, ty, getTileBaseColor(tile, r));
      }

    // Big explosion effect
    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 30, { color: '#f80', speed: 4, life: 0.6 });
    particles.burst(cx, cy, 15, { color: '#ff0', speed: 3, life: 0.4 });
    screenShake.trigger(10, 300);
  }

  /* ======================================================================
     TOOL ACTIONS
     ====================================================================== */

  function useBlastTool() {
    if (!unlockedTools.blastTool) return;
    if (toolState.blastToolCooldown > 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;
    if (resources.iron < 10) {
      SZ.GameAudio.play('error');
      floatingText.add(
        drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
        drillY * TILE_SIZE - 10 - cameraY,
        'Need 10 iron!', { color: '#f44', font: 'bold 24px sans-serif' }
      );
      return;
    }

    resources.iron -= 10;
    toolState.blastToolCooldown = GADGET_TOOL_COOLDOWNS.blastTool;
    SZ.GameAudio.play('explode');

    floatingText.add(
      drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
      drillY * TILE_SIZE - 10 - cameraY,
      'BLAST! (-10 iron)', { color: '#f80', font: 'bold 28px sans-serif' }
    );

    // Clear 3x3 area around player
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        const r = drillY + dr, c = drillX + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;

        const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;

        if (tile === TILE_GADGET) {
          const chamber = gadgetChambers.find(ch => {
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                if (ch.r + dr2 === r && ch.c + dc2 === c) return true;
            return false;
          });
          if (chamber) {
            grantMineGadget(chamber.gadgetType, tx, ty);
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                undergroundGrid[chamber.r + dr2][chamber.c + dc2] = TILE_EMPTY;
          }
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = TILE_VALUES[tile];
          const fitsInInventory = Math.min(value, carryCapacity - carried);
          const excess = value - fitsInInventory;
          if (fitsInInventory > 0) {
            resources[label] += fitsInInventory;
            carried += fitsInInventory;
          }
          if (excess > 0)
            droppedResources.push({ col: c, row: r, type: tile, value: excess, age: 0 });
        }
        undergroundGrid[r][c] = TILE_EMPTY;
        if (tileHP[r]) tileHP[r][c] = 0;
        if (tileMaxHP[r]) tileMaxHP[r][c] = 0;
        particles.burst(tx, ty, 8, { color: '#f44', speed: 2.5, life: 0.4 });
        spawnCrumble(tx, ty, getTileBaseColor(tile, r));
      }

    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 30, { color: '#f80', speed: 4, life: 0.6 });
    particles.burst(cx, cy, 15, { color: '#ff0', speed: 3, life: 0.4 });
    screenShake.trigger(10, 300);
  }

  function useTeleporter() {
    if (!unlockedTools.teleporter) return;
    if (toolState.teleporterCooldown > 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;

    toolState.teleporterCooldown = GADGET_TOOL_COOLDOWNS.teleporter;

    // Teleport particles at origin
    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 20, { color: '#a0f', speed: 3, life: 0.5 });
    particles.sparkle(cx, cy, 10, { color: '#c4f', speed: 2 });
    screenShake.trigger(6, 200);
    SZ.GameAudio.play('whoosh', { pitch: 1.6 });

    // Cancel mining and movement
    cancelMining();
    clearMoveTarget();

    // Deposit carried resources
    if (carried > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      carried = 0;
    }

    // Switch to surface
    transitionTarget = VIEW_SURFACE;
    transitionProgress = 0;
    transitionPhase = 'fade-out';

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'Teleported!', { color: '#a0f', font: 'bold 32px sans-serif' });
  }

  function selectTool(key) {
    if (!unlockedTools[key]) return;
    // Scanner and reinforcedDome are passive -- no selection needed
    if (key === 'scanner' || key === 'reinforcedDome') return;
    activeToolKey = activeToolKey === key ? null : key;
  }

  function unlockTool(idx) {
    if (state !== STATE_PLAYING) return;
    const def = GADGET_DEFS[idx];
    if (unlockedTools[def.key]) return;
    if (resources.iron < def.costIron || resources.cobalt < def.costCobalt) return;

    resources.iron -= def.costIron;
    resources.cobalt -= def.costCobalt;
    unlockedTools[def.key] = true;

    SZ.GameAudio.play('powerup');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${def.name} Unlocked!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 15, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(5, 150);

    // Auto-select non-passive tools
    if (def.key !== 'scanner' && def.key !== 'reinforcedDome')
      activeToolKey = def.key;
  }

  /* ======================================================================
     UPGRADE SYSTEM
     ====================================================================== */

  function getUpgradeCost(idx) {
    const def = UPGRADE_DEFS[idx];
    return def.baseCost + upgradeLevels[def.key] * def.perLevel;
  }

  function totalResources() {
    let total = 0;
    for (const key in resources)
      total += resources[key];
    return total;
  }

  function spendResources(amount) {
    let remaining = amount;
    // Spend from most valuable first
    for (const key of ['ruby', 'diamond', 'emerald', 'redstone', 'quartz', 'cobalt', 'gold', 'silver', 'lead', 'tin', 'copper', 'coal', 'water', 'iron']) {
      const spend = Math.min(resources[key] || 0, remaining);
      resources[key] -= spend;
      remaining -= spend;
      if (remaining <= 0) break;
    }
  }

  function applyUpgrade(idx) {
    if (state !== STATE_PLAYING) return;

    const cost = getUpgradeCost(idx);
    if (totalResources() < cost) return;

    spendResources(cost);
    const def = UPGRADE_DEFS[idx];
    ++upgradeLevels[def.key];

    // Recalculate using effective level (legacy + tree combined)
    applyStatUpgrade(def.key);

    SZ.GameAudio.play('levelup');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${def.name} Lv${getEffectiveLevel(def.key)}`, { color: '#4af', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 10, { color: '#4af', speed: 2 });
  }

  /* ======================================================================
     UPGRADE TREE (full-screen dialog)
     ====================================================================== */

  function getTreeNodeLevel(id) {
    return upgradeTreeLevels[id] || 0;
  }

  function isTreeNodeMaxed(id) {
    const node = UPGRADE_TREE.find(n => n.id === id);
    if (!node) return false;
    return getTreeNodeLevel(id) >= node.maxLevel;
  }

  function arePrereqsMet(node) {
    for (const pid of node.prereqs)
      if (!isTreeNodeMaxed(pid))
        return false;
    return true;
  }

  function canAffordTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return false;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (resources[key] || 0) < cost[key])
        return false;
    return true;
  }

  function isTreeNodeAvailable(node) {
    return !isTreeNodeMaxed(node.id) && arePrereqsMet(node);
  }

  function purchaseTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return;
    if (!arePrereqsMet(node)) return;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    // Check affordability for all resource types in the cost
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (resources[key] || 0) < cost[key]) {
        SZ.GameAudio.play('error');
        return;
      }

    // Deduct all costs
    for (const key in cost)
      if ((cost[key] || 0) > 0)
        resources[key] -= cost[key];
    upgradeTreeLevels[node.id] = lvl + 1;

    // Apply the upgrade effect
    if (node.type === 'gadget')
      applyGadgetUnlock(node.upgradeKey);
    else
      applyStatUpgrade(node.upgradeKey);

    SZ.GameAudio.play('levelup');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${node.name} purchased!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 12, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(4, 120);
  }

  // Passive gadgets that don't need selection
  const PASSIVE_GADGETS = ['scanner', 'reinforcedDome', 'autoRepair', 'domeExpansion', 'energyShield', 'magnet', 'fortune', 'silkTouch', 'echoLocation', 'chainLightning', 'freezeRay', 'plasmaCannon', 'damageReflect', 'emergencyShield', 'fortifiedBase', 'lastStand', 'oreDetector', 'autoMine', 'tunnelBore', 'veinMiner', 'doubleJump', 'wallClimb', 'dash', 'undergroundRadar', 'multiShot', 'homingShots', 'criticalHit', 'explosiveRounds'];

  function applyGadgetUnlock(key) {
    unlockedTools[key] = true;
    // Apply immediate effects for certain gadgets
    if (key === 'domeExpansion') {
      maxDomeHP += 75;
      domeHP = Math.min(domeHP + 75, maxDomeHP);
    }
    // Auto-select non-passive tools
    if (!PASSIVE_GADGETS.includes(key))
      activeToolKey = key;
  }

  function getEffectiveLevel(key) {
    // Sum of tree-based levels AND legacy upgrade levels for this key
    let treeLevels = 0;
    for (const n of UPGRADE_TREE)
      if (n.upgradeKey === key)
        treeLevels += getTreeNodeLevel(n.id);
    return treeLevels + (upgradeLevels[key] || 0);
  }

  function applyStatUpgrade(key) {
    const totalLevels = getEffectiveLevel(key);

    switch (key) {
      case 'weaponDamage':
        weaponDamage = BASE_WEAPON_DAMAGE + totalLevels * 5;
        break;
      case 'fireRate':
        fireRate = BASE_FIRE_RATE + totalLevels * 0.3;
        break;
      case 'domeHP':
        maxDomeHP = BASE_DOME_HP + totalLevels * 25;
        domeHP = Math.min(domeHP + 25, maxDomeHP);
        break;
      case 'drillSpeed':
        drillSpeed = Math.max(0.1, BASE_DRILL_SPEED - totalLevels * 0.05);
        break;
      case 'carryCapacity':
        carryCapacity = BASE_CARRY_CAPACITY + totalLevels * 20;
        break;
      case 'moveSpeed':
        moveStepInterval = BASE_MOVE_INTERVAL * Math.pow(0.85, totalLevels);
        break;
      case 'miningTools':
        // Applied dynamically in getMiningTime()
        break;
      case 'shieldRecharge':
        // Passive: reduces shield gadget recharge conceptually (already tracked by level count)
        break;
      case 'echoLocation':
        // Passive: extended scanner range (tracked by level count, applied in scanner code)
        break;
    }
  }

  // Compute positions for tree nodes using a strict grid layout.
  // Each branch gets a vertical column section; within a branch nodes are
  // placed on a grid where row = topological depth (max prerequisite row + 1)
  // and columns are assigned left-to-right per row. A fixed cell size
  // guarantees no two nodes can ever overlap.
  function computeTreeLayout() {
    if (treeLayout)
      return treeLayout.nodes;
    const nodes = [];
    const regions = {};
    const pitchX = TREE_CARD_W + TREE_GAP_X;
    const pitchY = TREE_CARD_H + TREE_GAP_Y;

    // Per branch: depth = longest prerequisite chain (left to right);
    // lanes = chains of nodes continuing a parent, packed into rows.
    const branchGrids = [];
    for (const branch of TREE_BRANCH_ORDER) {
      const branchNodes = UPGRADE_TREE.filter(n => n.branch === branch);
      const nodeMap = {};
      branchNodes.forEach((n, i) => { nodeMap[n.id] = { n, i }; });
      const depthOf = {};
      const assignDepth = (n) => {
        if (depthOf[n.id] !== undefined) return depthOf[n.id];
        let maxParent = -1;
        for (const pid of n.prereqs)
          if (nodeMap[pid])
            maxParent = Math.max(maxParent, assignDepth(nodeMap[pid].n));
        depthOf[n.id] = maxParent + 1;
        return depthOf[n.id];
      };
      branchNodes.forEach(assignDepth);

      const order = branchNodes.slice().sort((a, b) => depthOf[a.id] - depthOf[b.id] || nodeMap[a.id].i - nodeMap[b.id].i);
      const lanes = [];
      const laneOf = {};
      const continued = {};
      for (const n of order) {
        const parents = n.prereqs.filter(p => nodeMap[p]).sort((a, b) => depthOf[b] - depthOf[a]);
        const cont = parents.find(p => !continued[p]);
        let lane;
        if (cont) {
          lane = laneOf[cont];
          continued[cont] = true;
          lane.ids.push(n.id);
        } else {
          lane = { ids: [n.id], parent: parents.length ? laneOf[parents[0]] : null, kids: [] };
          lanes.push(lane);
          if (lane.parent)
            lane.parent.kids.push(lane);
        }
        laneOf[n.id] = lane;
      }
      // Depth-first lane order keeps every sub-chain right below its parent;
      // lanes share a row when their depth ranges leave a free cell between them
      const ordered = [];
      const visit = (l) => {
        ordered.push(l);
        l.kids.forEach(visit);
      };
      lanes.filter(l => !l.parent).forEach(visit);
      const rowSpans = [];
      for (const l of ordered) {
        const ds = l.ids.map(id => depthOf[id]);
        const lo = Math.min(...ds), hi = Math.max(...ds);
        let r = l.parent ? l.parent.row + 1 : rowSpans.length;
        for (;; ++r) {
          rowSpans[r] = rowSpans[r] || [];
          if (rowSpans[r].every(([a, b]) => hi < a - 1 || lo > b + 1))
            break;
        }
        rowSpans[r].push([lo, hi]);
        l.row = r;
      }
      let maxDepth = 0;
      for (const n of branchNodes)
        maxDepth = Math.max(maxDepth, depthOf[n.id]);
      branchGrids.push({ branch, branchNodes, depthOf, laneOf, rows: rowSpans.length, cols: maxDepth + 1 });
    }

    // Regions in a 2x2 arrangement: dome | mining over movement | weapon
    const regionW = (g) => g.cols * pitchX - TREE_GAP_X + TREE_REGION_PAD * 2;
    const regionH = (g) => TREE_REGION_HEADER + g.rows * pitchY - TREE_GAP_Y + TREE_REGION_PAD;
    const colW = [Math.max(regionW(branchGrids[0]), regionW(branchGrids[2])), Math.max(regionW(branchGrids[1]), regionW(branchGrids[3]))];
    const rowH = [Math.max(regionH(branchGrids[0]), regionH(branchGrids[1])), Math.max(regionH(branchGrids[2]), regionH(branchGrids[3]))];
    for (let i = 0; i < branchGrids.length; ++i) {
      const g = branchGrids[i];
      const gx = i % 2 ? colW[0] + TREE_REGION_GAP : 0;
      const gy = i >= 2 ? rowH[0] + TREE_REGION_GAP : 0;
      const cx = gx + (colW[i % 2] - regionW(g)) / 2;
      regions[g.branch] = { x: cx, y: gy, w: regionW(g), h: regionH(g), branch: g.branch };
      for (const n of g.branchNodes)
        nodes.push({
          node: n,
          x: cx + TREE_REGION_PAD + g.depthOf[n.id] * pitchX,
          y: gy + TREE_REGION_HEADER + g.laneOf[n.id].row * pitchY,
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          branch: g.branch
        });
    }
    const byId = {};
    for (const ln of nodes)
      byId[ln.node.id] = ln;
    regions.all = { x: 0, y: 0, w: colW[0] + colW[1] + TREE_REGION_GAP, h: rowH[0] + rowH[1] + TREE_REGION_GAP };
    treeLayout = { nodes, byId, regions };
    return nodes;
  }

  // Screen area the tree is drawn into (below the header, above the footer)
  const TREE_VIEW = { x: 0, y: 156, w: CANVAS_W, h: CANVAS_H - 156 - 58 };

  // Display name and chain info for a tree node: "Shield Cap. L3" becomes
  // "Shield Capacity" shown with level pip 3 of the 7-node chain.
  function getTreeNodeInfo(node) {
    if (treeNodeInfo)
      return treeNodeInfo[node.id];
    treeNodeInfo = {};
    const chains = {};
    for (const n of UPGRADE_TREE) {
      const m = /^(.*?)\s+L(\d+)$/.exec(n.name);
      let base = m ? m[1] : n.name;
      base = TREE_NAME_EXPANSIONS[base] || base;
      const step = m ? parseInt(m[2], 10) : 1;
      const key = n.branch + '|' + base;
      (chains[key] = chains[key] || []).push({ id: n.id, step });
      treeNodeInfo[n.id] = { title: base, chain: chains[key] };
    }
    for (const key in chains)
      chains[key].sort((a, b) => a.step - b.step);
    for (const id in treeNodeInfo) {
      const info = treeNodeInfo[id];
      info.index = info.chain.findIndex(c => c.id === id);
    }
    return treeNodeInfo[node.id];
  }

  function fitTreeView(tab, instant) {
    computeTreeLayout();
    const r = treeLayout.regions[tab] || treeLayout.regions.all;
    const pad = 24;
    const z = Math.max(TREE_MIN_ZOOM, Math.min(1, (TREE_VIEW.w - pad * 2) / r.w, (TREE_VIEW.h - pad * 2) / r.h));
    treeCam.tz = z;
    treeCam.tx = TREE_VIEW.x + TREE_VIEW.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = TREE_VIEW.y + TREE_VIEW.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      upgradeZoom = treeCam.tz;
      upgradePanX = treeCam.tx;
      upgradePanY = treeCam.ty;
    }
  }

  function setTreeTab(tab) {
    if (treeTab === tab) {
      fitTreeView(tab);
      return;
    }
    treeTab = tab;
    fitTreeView(tab);
    SZ.GameAudio.play('select');
    if (tab !== 'all' && treeFocusId && computeTreeLayout() && treeLayout.byId[treeFocusId].branch !== tab)
      treeFocusId = null;
  }

  // Header tabs: all branches plus one per branch
  function getTreeTabs() {
    const ids = ['all'].concat(TREE_BRANCH_ORDER);
    const tabW = 196, gap = 10;
    const x0 = CANVAS_W / 2 - (ids.length * tabW + (ids.length - 1) * gap) / 2;
    return ids.map((id, i) => ({ id, x: x0 + i * (tabW + gap), y: 66, w: tabW, h: 36 }));
  }

  function treeNodeState(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return 'owned';
    if (!arePrereqsMet(node)) return 'locked';
    return canAffordTreeNode(node) ? 'ready' : 'poor';
  }

  // Cost as "20 [iron] 10 [cobalt]" with per-resource colouring, shrunk to maxW
  function drawCostRow(cost, x, y, maxW, px) {
    const parts = [];
    for (const key in cost)
      if ((cost[key] || 0) > 0)
        parts.push({ key, n: cost[key], ok: (resources[key] || 0) >= cost[key] });
    if (!parts.length) return;
    let size = px;
    let total;
    for (;;) {
      ctx.font = uiFont(size, 'bold');
      total = 0;
      for (const p of parts)
        total += ctx.measureText(String(p.n)).width + size * 1.15 + size * 0.5;
      total -= size * 0.5;
      if (total <= maxW || size <= 9) break;
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
      drawSprite(p.key, cx + size * 0.55, y, size * 1.1, p.ok ? 1 : 0.7);
      cx += size * 1.15 + size * 0.5;
    }
  }

  // Orthogonal connector with rounded corners routed through the empty
  // channels between cards (never across a card)
  function strokeTreeConnector(parent, child) {
    const px = parent.x + parent.w, py = parent.y + parent.h / 2;
    const cx = child.x, cy = child.y + child.h / 2;
    const x1 = px + TREE_GAP_X / 2;
    const x2 = cx - TREE_GAP_X / 2;
    const pts = [[px, py]];
    if (Math.abs(py - cy) < 0.5)
      pts.push([cx, cy]);
    else if (Math.abs(x1 - x2) < 0.5) {
      pts.push([x1, py], [x1, cy], [cx, cy]);
    } else {
      // Run along the gap row next to the child's lane
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

  let treeNebulaCanvas = null;

  function drawTreeBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#0b0f1e');
    g.addColorStop(1, '#05060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!treeNebulaCanvas) {
      treeNebulaCanvas = document.createElement('canvas');
      treeNebulaCanvas.width = 700;
      treeNebulaCanvas.height = 500;
      const n = treeNebulaCanvas.getContext('2d');
      const blobs = [[160, 140, 220, '60,90,200'], [520, 120, 180, '150,60,190'], [420, 380, 240, '30,130,170'], [120, 420, 160, '190,90,60']];
      for (const [bx, by, br, col] of blobs) {
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
    // Nebula drifts slightly with the pan for depth
    const ox = ((upgradePanX * 0.05) % 140) - 70;
    const oy = ((upgradePanY * 0.05) % 100) - 50;
    ctx.drawImage(treeNebulaCanvas, ox - 70, oy - 50, CANVAS_W + 140, CANVAS_H + 100);

    // Blueprint grid in tree space
    const step = 64 * upgradeZoom;
    if (step >= 10) {
      ctx.save();
      ctx.beginPath();
      const sx = ((upgradePanX % step) + step) % step;
      const sy = ((upgradePanY % step) + step) % step;
      for (let x = sx; x < CANVAS_W; x += step) {
        ctx.moveTo(Math.round(x) + 0.5, TREE_VIEW.y);
        ctx.lineTo(Math.round(x) + 0.5, TREE_VIEW.y + TREE_VIEW.h);
      }
      for (let y = sy; y < CANVAS_H; y += step) {
        if (y < TREE_VIEW.y || y > TREE_VIEW.y + TREE_VIEW.h) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(CANVAS_W, Math.round(y) + 0.5);
      }
      ctx.strokeStyle = 'rgba(110,150,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTreeCard(ln, st, compact) {
    const node = ln.node;
    const x = ln.x, y = ln.y, w = ln.w, h = ln.h;
    const color = TREE_BRANCH_COLORS[ln.branch];
    const isHover = upgradeDialogHover === node.id;
    const isFocus = treeFocusId === node.id;
    const info = getTreeNodeInfo(node);
    const dim = st === 'locked';

    ctx.save();
    // Drop shadow (cheap offset rect instead of blur)
    roundRectPath(x + 3, y + 5, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    roundRectPath(x, y, w, h, 12);
    if (st === 'owned')
      ctx.fillStyle = hexToRgba(color, 0.26);
    else if (st === 'ready')
      ctx.fillStyle = isHover || isFocus ? hexToRgba(color, 0.3) : hexToRgba(color, 0.16);
    else if (st === 'poor')
      ctx.fillStyle = 'rgba(40,36,30,0.95)';
    else
      ctx.fillStyle = 'rgba(16,18,26,0.95)';
    ctx.fill();
    // Inner sheen
    ctx.save();
    ctx.clip();
    ctx.fillStyle = st === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.restore();

    // Border by state
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
    } else if (st === 'ready') {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + Math.sin(animTime * 4) * 4;
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
    ctx.shadowBlur = 0;

    if (isHover || isFocus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 15);
      ctx.lineWidth = isFocus ? 3 : 2;
      ctx.strokeStyle = isFocus ? UI.gold : 'rgba(255,255,255,0.85)';
      if (isFocus) {
        ctx.shadowColor = UI.gold;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Icon well
    roundRectPath(x + 10, y + 10, 44, 44, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = st === 'locked' ? 'rgba(255,255,255,0.06)' : hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(node.icon, x + 32, y + 32, 32, dim ? 0.4 : 1);

    // Chain pips under the icon
    if (info.chain.length > 1) {
      const n = info.chain.length;
      const pw = Math.min(8, (40 - (n - 1) * 2) / n);
      const total = n * pw + (n - 1) * 2;
      let px = x + 32 - total / 2;
      for (let i = 0; i < n; ++i) {
        const owned = isTreeNodeMaxed(info.chain[i].id);
        ctx.fillStyle = owned ? color : (i === info.index ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.14)');
        ctx.fillRect(px, y + 62, pw, 6);
        if (i === info.index) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, y + 70, pw, 2);
        }
        px += pw + 2;
      }
    } else if (node.type === 'gadget') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('GADGET', x + 32, y + 68, 48, 10, { weight: 'bold', color: dim ? UI.textMute : hexToRgba(color, 0.95), minPx: 8 });
    }

    // State badge (top-right)
    if (st === 'owned')
      drawSprite('check', x + w - 18, y + 18, 22);
    else if (st === 'locked')
      drawSprite('lock', x + w - 18, y + 18, 20, 0.7);

    // Name, then cost
    const textX = x + 64;
    const textW = w - 64 - (st === 'owned' || st === 'locked' ? 32 : 10);
    const nameColor = st === 'locked' ? '#6a7288' : (st === 'owned' ? '#ffffff' : UI.text);
    if (compact) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawTextBlock(info.title + (info.chain.length > 1 ? ' ' + (info.index + 1) : ''), textX, y + 8, textW, h - 16, 24, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 14, lineGap: 1.1 });
    } else {
      const titleText = info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : '');
      drawTextBlock(titleText, textX, y + 7, textW, 44, 17, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 11, lineGap: 1.15 });
      if (st === 'owned') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText('Owned', textX, y + h - 18, w - 64 - 12, 14, { weight: 'bold', color: color });
      } else {
        const cost = node.costs[Math.min(getTreeNodeLevel(node.id), node.costs.length - 1)];
        ctx.save();
        if (dim)
          ctx.globalAlpha *= 0.55;
        drawCostRow(cost, textX, y + h - 18, w - 64 - 12, 15);
        ctx.restore();
      }
    }

    // Purchase flash
    const flash = treePurchaseFlash[node.id];
    if (flash !== undefined) {
      const t = (performance.now() - flash) / 600;
      if (t >= 1)
        delete treePurchaseFlash[node.id];
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

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  }

  function hitTreeNode(mx, my) {
    if (my < TREE_VIEW.y || my > TREE_VIEW.y + TREE_VIEW.h) return null;
    const { x: tx, y: ty } = screenToTreeCoords(mx, my);
    for (const ln of computeTreeLayout())
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h)
        return ln;
    return null;
  }

  function tryPurchaseTreeNode(node) {
    const before = getTreeNodeLevel(node.id);
    if (isTreeNodeAvailable(node) && canAffordTreeNode(node))
      purchaseTreeNode(node);
    else
      SZ.GameAudio.play('error');
    if (getTreeNodeLevel(node.id) > before)
      treePurchaseFlash[node.id] = performance.now();
  }

  // Zoom the tree around a screen point (smoothly animated)
  function zoomTreeAt(mx, my, factor) {
    const z = Math.max(TREE_MIN_ZOOM, Math.min(TREE_MAX_ZOOM, treeCam.tz * factor));
    const ratio = z / treeCam.tz;
    treeCam.tx = mx - (mx - treeCam.tx) * ratio;
    treeCam.ty = my - (my - treeCam.ty) * ratio;
    treeCam.tz = z;
  }

  // Pan the camera target so a card is fully visible
  function revealTreeNode(ln) {
    const z = treeCam.tz;
    const m = 40;
    const sx = treeCam.tx + ln.x * z, sy = treeCam.ty + ln.y * z;
    const sw = ln.w * z, sh = ln.h * z;
    if (sx < TREE_VIEW.x + m) treeCam.tx += TREE_VIEW.x + m - sx;
    else if (sx + sw > TREE_VIEW.x + TREE_VIEW.w - m) treeCam.tx -= sx + sw - (TREE_VIEW.x + TREE_VIEW.w - m);
    if (sy < TREE_VIEW.y + m) treeCam.ty += TREE_VIEW.y + m - sy;
    else if (sy + sh > TREE_VIEW.y + TREE_VIEW.h - m) treeCam.ty -= sy + sh - (TREE_VIEW.y + TREE_VIEW.h - m);
  }

  function focusTreeNode(ln) {
    treeFocusId = ln.node.id;
    upgradeDialogHover = null;
    revealTreeNode(ln);
    const z = treeCam.tz;
    setTooltip(0, 0, buildUpgradeNodeTooltip(ln.node), 'focus:' + ln.node.id, { x: treeCam.tx + ln.x * z, y: treeCam.ty + ln.y * z, w: ln.w * z, h: ln.h * z });
    tooltip.delayTimer = TOOLTIP_DELAY;
  }

  // Keyboard control of the upgrade tree; returns true when the key was used
  function handleUpgradeDialogKey(e) {
    const nodes = computeTreeLayout();
    const tabs = ['all'].concat(TREE_BRANCH_ORDER);
    if (e.code === 'Tab') {
      const i = tabs.indexOf(treeTab);
      setTreeTab(tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
      return true;
    }
    if (/^Digit[1-5]$/.test(e.code)) {
      setTreeTab(tabs[parseInt(e.code.slice(5), 10) - 1]);
      return true;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+') {
      zoomTreeAt(CANVAS_W / 2, TREE_VIEW.y + TREE_VIEW.h / 2, 1.2);
      return true;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-') {
      zoomTreeAt(CANVAS_W / 2, TREE_VIEW.y + TREE_VIEW.h / 2, 1 / 1.2);
      return true;
    }
    if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Home') {
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
        if (first)
          focusTreeNode(first);
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
      if (best)
        focusTreeNode(best);
      return true;
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && treeFocusId) {
      const ln = treeLayout.byId[treeFocusId];
      tryPurchaseTreeNode(ln.node);
      focusTreeNode(ln);
      return true;
    }
    return false;
  }

  function openUpgradeDialog() {
    if (state !== STATE_PLAYING && state !== STATE_PAUSED) return;
    stateBeforeUpgradeDialog = state;
    state = STATE_UPGRADE_DIALOG;
    upgradeDialogHover = null;
    upgradePanning = false;
    clearTooltip();
    // First open of a run fits the selected branch; afterwards the view is kept
    if (!upgradeViewCustomized) {
      fitTreeView(treeTab, true);
      upgradeViewCustomized = true;
    }
    treeCam.last = 0;
  }

  function closeUpgradeDialog() {
    state = stateBeforeUpgradeDialog || STATE_PLAYING;
    stateBeforeUpgradeDialog = null;
    upgradeDialogHover = null;
    saveRun();
  }

  function drawUpgradeDialog() {
    computeTreeLayout();

    // Smooth camera towards its target (frame-rate independent)
    const now = performance.now();
    const dt = treeCam.last ? Math.min(0.1, (now - treeCam.last) / 1000) : 1;
    treeCam.last = now;
    if (!upgradePanning) {
      // Keep at least part of the tree on screen
      const all = treeLayout.regions.all;
      const keep = 160;
      treeCam.tx = Math.min(TREE_VIEW.x + TREE_VIEW.w - keep - all.x * treeCam.tz, Math.max(TREE_VIEW.x + keep - (all.x + all.w) * treeCam.tz, treeCam.tx));
      treeCam.ty = Math.min(TREE_VIEW.y + TREE_VIEW.h - keep - all.y * treeCam.tz, Math.max(TREE_VIEW.y + keep - (all.y + all.h) * treeCam.tz, treeCam.ty));
      const k = 1 - Math.exp(-dt * 14);
      upgradeZoom += (treeCam.tz - upgradeZoom) * k;
      upgradePanX += (treeCam.tx - upgradePanX) * k;
      upgradePanY += (treeCam.ty - upgradePanY) * k;
    }

    drawTreeBackground();

    // ---- Tree content (zoom & pan) ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(TREE_VIEW.x, TREE_VIEW.y, TREE_VIEW.w, TREE_VIEW.h);
    ctx.clip();
    ctx.translate(upgradePanX, upgradePanY);
    ctx.scale(upgradeZoom, upgradeZoom);

    const viewL = (TREE_VIEW.x - upgradePanX) / upgradeZoom;
    const viewT = (TREE_VIEW.y - upgradePanY) / upgradeZoom;
    const viewR = viewL + TREE_VIEW.w / upgradeZoom;
    const viewB = viewT + TREE_VIEW.h / upgradeZoom;
    const compact = upgradeZoom < 0.6;

    // Branch regions with headers and progress
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
      for (const n of UPGRADE_TREE)
        if (n.branch === branch) {
          ++total;
          if (isTreeNodeMaxed(n.id)) ++owned;
        }
      const headPx = compact ? Math.min(48, 20 / upgradeZoom) : 30;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelW = fitText(TREE_BRANCH_LABELS[branch], r.x + TREE_REGION_PAD, r.y + TREE_REGION_HEADER / 2, r.w * 0.5, headPx, { weight: 'bold', color });
      const mx = r.x + TREE_REGION_PAD + labelW + 24;
      const mw = Math.min(260, r.x + r.w - TREE_REGION_PAD - mx - 90);
      if (mw > 40) {
        drawMeter(mx, r.y + TREE_REGION_HEADER / 2 - 6, mw, 12, owned / total, color);
        fitText(`${owned} / ${total}`, mx + mw + 12, r.y + TREE_REGION_HEADER / 2, 80, compact ? headPx * 0.6 : 18, { weight: 'bold', color: UI.textDim });
      }
    }

    // Connectors: locked first, owned last so the brightest lines sit on top
    const edges = [[], [], []];
    for (const ln of treeLayout.nodes)
      for (const pid of ln.node.prereqs) {
        const parent = treeLayout.byId[pid];
        if (!parent) continue;
        const minX = Math.min(parent.x, ln.x) - TREE_GAP_X, maxX = Math.max(parent.x + parent.w, ln.x + ln.w) + TREE_GAP_X;
        const minY = Math.min(parent.y, ln.y) - TREE_GAP_Y, maxY = Math.max(parent.y + parent.h, ln.y + ln.h) + TREE_GAP_Y;
        if (minX > viewR || maxX < viewL || minY > viewB || maxY < viewT) continue;
        const pOwned = isTreeNodeMaxed(pid);
        edges[pOwned ? (isTreeNodeMaxed(ln.node.id) ? 2 : 1) : 0].push([parent, ln]);
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

    // Cards
    for (const ln of treeLayout.nodes) {
      if (ln.x > viewR || ln.x + ln.w < viewL || ln.y > viewB || ln.y + ln.h < viewT) continue;
      drawTreeCard(ln, treeNodeState(ln.node), compact);
    }
    ctx.restore();

    // Keep the keyboard tooltip glued to the focused card while the camera moves
    if (treeFocusId && tooltip.lastHoverKey === 'focus:' + treeFocusId) {
      const ln = treeLayout.byId[treeFocusId];
      tooltip.anchor = { x: upgradePanX + ln.x * upgradeZoom, y: upgradePanY + ln.y * upgradeZoom, w: ln.w * upgradeZoom, h: ln.h * upgradeZoom };
    }

    // ---- Header ----
    drawPanel(12, 8, CANVAS_W - 24, 142, { accent: UI.gold, radius: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Upgrade Tree', 34, 38, 360, 30, { weight: 'bold', color: UI.gold });
    let totalPurchased = 0;
    for (const n of UPGRADE_TREE)
      totalPurchased += getTreeNodeLevel(n.id);
    ctx.textAlign = 'right';
    fitText(`${totalPurchased} / ${UPGRADE_TREE.length} upgrades`, CANVAS_W - 300, 38, 220, 18, { weight: 'bold', color: UI.textDim });
    drawMeter(CANVAS_W - 286, 32, 250, 12, totalPurchased / UPGRADE_TREE.length, UI.gold);

    // Tabs
    for (const t of getTreeTabs()) {
      const active = treeTab === t.id;
      const hover = mouseAimX >= t.x && mouseAimX <= t.x + t.w && mouseAimY >= t.y && mouseAimY <= t.y + t.h;
      const color = t.id === 'all' ? UI.gold : TREE_BRANCH_COLORS[t.id];
      roundRectPath(t.x, t.y, t.w, t.h, 9);
      ctx.fillStyle = active ? hexToRgba(color, 0.24) : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeStyle = active ? color : 'rgba(255,255,255,0.1)';
      ctx.stroke();
      let label = t.id === 'all' ? 'All' : TREE_BRANCH_LABELS[t.id].charAt(0) + TREE_BRANCH_LABELS[t.id].slice(1).toLowerCase();
      if (t.id !== 'all') {
        let o = 0, c = 0;
        for (const n of UPGRADE_TREE)
          if (n.branch === t.id) {
            ++c;
            if (isTreeNodeMaxed(n.id)) ++o;
          }
        label += `  ${o}/${c}`;
      }
      ctx.beginPath();
      ctx.arc(t.x + 18, t.y + t.h / 2, 5, 0, TWO_PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, t.x + 32, t.y + t.h / 2 + 1, t.w - 42, 17, { weight: 'bold', color: active ? '#fff' : UI.textDim });
    }

    // Resource strip
    const entries = RESOURCE_HUD_ENTRIES;
    const slotW = (CANVAS_W - 72) / entries.length;
    for (let i = 0; i < entries.length; ++i) {
      const e = entries[i];
      const sx = 36 + i * slotW;
      const have = resources[e.key] || 0;
      drawSprite(e.key, sx + 11, 126, 20, have > 0 ? 1 : 0.35);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(String(have), sx + 25, 127, slotW - 30, 16, { weight: 'bold', color: have > 0 ? e.color : UI.textMute });
    }

    // ---- Footer: legend and controls ----
    const fy = CANVAS_H - 50;
    drawPanel(12, fy, CANVAS_W - 24, 42, { radius: 12, shadow: 8, accent: '#6a8ac8' });
    const legend = [
      ['Owned', 'owned'], ['Can buy', 'ready'], ['Need resources', 'poor'], ['Locked', 'locked']
    ];
    let lx = 30;
    for (const [label, st] of legend) {
      roundRectPath(lx, fy + 13, 26, 16, 5);
      if (st === 'owned') ctx.fillStyle = hexToRgba(UI.accent, 0.35);
      else if (st === 'ready') ctx.fillStyle = hexToRgba(UI.accent, 0.18);
      else if (st === 'poor') ctx.fillStyle = 'rgba(40,36,30,0.95)';
      else ctx.fillStyle = 'rgba(16,18,26,0.95)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : (st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.accent);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lx += 34 + fitText(label, lx + 34, fy + 22, 130, 15, { color: UI.textDim }) + 22;
    }
    drawKeyHints([
      { key: 'Wheel', label: 'Zoom' },
      { key: 'Drag', label: 'Pan' },
      { key: '←↑→↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Tab', label: 'Branch' },
      { key: 'Esc', label: 'Close' }
    ], (lx + CANVAS_W - 24) / 2, fy + 21, CANVAS_W - 24 - lx - 16);
  }

  // Convert screen coords to tree-local coords (inverse zoom/pan)
  function screenToTreeCoords(mx, my) {
    return {
      x: (mx - upgradePanX) / upgradeZoom,
      y: (my - upgradePanY) / upgradeZoom
    };
  }

  function handleUpgradeDialogClick(mx, my) {
    for (const t of getTreeTabs())
      if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) {
        setTreeTab(t.id);
        return true;
      }
    const ln = hitTreeNode(mx, my);
    if (ln) {
      treeFocusId = ln.node.id;
      tryPurchaseTreeNode(ln.node);
      return true;
    }
    return my < TREE_VIEW.y || my > TREE_VIEW.y + TREE_VIEW.h;
  }

  function handleUpgradeDialogHover(mx, my) {
    const ln = hitTreeNode(mx, my);
    upgradeDialogHover = ln ? ln.node.id : null;
  }

  /* ======================================================================
     GADGET UPDATES
     ====================================================================== */

  function updateGadgets(dt) {
    // -- Primary gadget updates --
    if (primaryGadget === 'repellent') {
      if (primaryGadgetState.active) {
        primaryGadgetState.duration -= dt;
        if (primaryGadgetState.duration <= 0) {
          primaryGadgetState.active = false;
          primaryGadgetState.cooldown = 30;
        }
      } else if (primaryGadgetState.cooldown > 0)
        primaryGadgetState.cooldown -= dt;
    }

    if (primaryGadget === 'orchard') {
      if (primaryGadgetState.speedBoostTimer > 0)
        primaryGadgetState.speedBoostTimer -= dt;

      if (!primaryGadgetState.fruitReady) {
        primaryGadgetState.fruitTimer -= dt;
        if (primaryGadgetState.fruitTimer <= 0)
          primaryGadgetState.fruitReady = true;
      }
    }

    if (primaryGadget === 'droneyard') {
      primaryGadgetState.droneTimer -= dt;
      if (primaryGadgetState.droneTimer <= 0) {
        primaryGadgetState.droneTimer = 15;
        // Auto-carry up to 10 resources from carried to deposited
        if (carried > 0) {
          const transfer = Math.min(carried, 10);
          carried -= transfer;
          SZ.GameAudio.play('coin', { pitch: 0.8 });
          floatingText.add(DOME_X - 80, DOME_Y - 80, `Drone: +${transfer} delivered`, { color: '#4af', font: 'bold 22px sans-serif' });
        }
      }
      // Animate drone phase for visual bob
      primaryGadgetState.dronePhase = (primaryGadgetState.dronePhase || 0) + dt * 3;
    }

    // -- Mine gadgets updates --
    // Auto Cannon
    if (foundGadgets.includes('autoCannon')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (primaryGadgetState.autoCannonFlash > 0) {
        primaryGadgetState.autoCannonFlash -= dt;
        if (primaryGadgetState.autoCannonFlash <= 0) {
          primaryGadgetState.autoCannonFlash = 0;
          primaryGadgetState.autoCannonTarget = null;
        }
      }
      if (enemies.length > 0) {
        primaryGadgetState.autoCannonTimer = (primaryGadgetState.autoCannonTimer || 0) - dt;
        if (primaryGadgetState.autoCannonTimer <= 0) {
          primaryGadgetState.autoCannonTimer = 2;
          // Find nearest enemy
          let nearest = null, bestD = Infinity;
          for (const e of enemies) {
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            applyDamageToEnemy(nearest, 5);
            // Store last target for drawing
            primaryGadgetState.autoCannonTarget = { x: nearest.x, y: nearest.y };
            primaryGadgetState.autoCannonFlash = 0.3;
            SZ.GameAudio.play('shoot', { volume: 0.5 });
            particles.burst(nearest.x, nearest.y, 6, { color: '#ff0', speed: 2, life: 0.3 });
          }
        }
      }
    }

    // Stun Laser
    if (foundGadgets.includes('stunLaser')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (primaryGadgetState.stunLaserFlash > 0) {
        primaryGadgetState.stunLaserFlash -= dt;
        if (primaryGadgetState.stunLaserFlash <= 0) {
          primaryGadgetState.stunLaserFlash = 0;
          primaryGadgetState.stunLaserTarget = null;
        }
      }
      if (enemies.length > 0) {
        primaryGadgetState.stunLaserTimer = (primaryGadgetState.stunLaserTimer || 0) - dt;
        if (primaryGadgetState.stunLaserTimer <= 0) {
          primaryGadgetState.stunLaserTimer = 8;
          let nearest = null, bestD = Infinity;
          for (const e of enemies) {
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            nearest.stunTimer = 2;
            primaryGadgetState.stunLaserTarget = { x: nearest.x, y: nearest.y };
            primaryGadgetState.stunLaserFlash = 0.4;
            SZ.GameAudio.play('zap', { pitch: 1.3 });
            floatingText.add(nearest.x, nearest.y - 40, 'STUNNED!', { color: '#4af', font: 'bold 22px sans-serif' });
          }
        }
      }
    }

    // Probe Scanner timer
    if (foundGadgets.includes('probeScanner') && primaryGadgetState.probeTimer > 0)
      primaryGadgetState.probeTimer -= dt;

    // Condenser
    if (foundGadgets.includes('condenser')) {
      primaryGadgetState.condenserTimer = (primaryGadgetState.condenserTimer || 0) - dt;
      if (primaryGadgetState.condenserTimer <= 0) {
        primaryGadgetState.condenserTimer = 30;
        resources.water += 5;
        floatingText.add(DOME_X + 80, DOME_Y - 40, '+5 water (condenser)', { color: '#6af', font: 'bold 22px sans-serif' });
      }
    }

    // -- New gadget effects --

    // Auto-Repair: slowly regenerate dome HP
    if (unlockedTools.autoRepair && domeHP < maxDomeHP) {
      toolState.autoRepairTimer = (toolState.autoRepairTimer || 0) - dt;
      if (toolState.autoRepairTimer <= 0) {
        toolState.autoRepairTimer = 5; // heal every 5 seconds
        const heal = 2;
        domeHP = Math.min(domeHP + heal, maxDomeHP);
        floatingText.add(DOME_X + 60, DOME_Y - 40, `+${heal} HP`, { color: '#0f0', font: 'bold 18px sans-serif' });
      }
    }

    // Energy Shield: absorb a percentage of damage (tracked passively via unlockedTools)

    // Magnet: auto-collect dropped resources within 2 tiles
    if (unlockedTools.magnet && currentView === VIEW_UNDERGROUND) {
      for (let i = droppedResources.length - 1; i >= 0; --i) {
        const drop = droppedResources[i];
        const dist = Math.abs(drop.col - drillX) + Math.abs(drop.row - drillY);
        if (dist > 2) continue;
        const canCarry = carryCapacity - carried;
        if (canCarry <= 0) break;
        const pickUp = Math.min(drop.value, canCarry);
        const label = TILE_LABELS[drop.type];
        resources[label] += pickUp;
        carried += pickUp;
        drop.value -= pickUp;
        if (drop.value <= 0)
          droppedResources.splice(i, 1);
      }
    }

    // Chain Lightning: when turret fires, extra damage arcs to nearby enemies (handled in weapon)
    // Freeze Ray: slows enemies near projectile impacts (handled in weapon)
    // Plasma Cannon: AoE damage on hit (handled in weapon)

    // Jetpack cooldown
    if (toolState.jetpackCooldown > 0)
      toolState.jetpackCooldown = Math.max(0, toolState.jetpackCooldown - dt);

    // Phase Shift cooldown
    if (toolState.phaseShiftCooldown > 0)
      toolState.phaseShiftCooldown = Math.max(0, toolState.phaseShiftCooldown - dt);

    // -- Unlockable tool cooldowns --
    if (toolState.blastToolCooldown > 0)
      toolState.blastToolCooldown = Math.max(0, toolState.blastToolCooldown - dt);
    if (toolState.teleporterCooldown > 0)
      toolState.teleporterCooldown = Math.max(0, toolState.teleporterCooldown - dt);

    // Scanner passive: always active when unlocked (echo location extends range)
    toolState.scannerActive = !!unlockedTools.scanner;
    toolState.echoLocationActive = !!unlockedTools.echoLocation;
  }

  /* ======================================================================
     MOVEMENT (mouse-based underground navigation)
     ====================================================================== */

  function updateMovement(dt) {
    if (currentView !== VIEW_UNDERGROUND) return;
    // Block movement while mining
    if (miningTarget) return;

    if (!movePath || movePathIndex >= movePath.length) {
      // Arrived at destination -- check queued mine action
      if (mineTarget && movePath) {
        tryMine(mineTarget.dx, mineTarget.dy);
        mineTarget = null;
      }
      movePath = null;
      moveTarget = null;
      return;
    }

    moveStepTimer -= dt;
    if (moveStepTimer <= 0) {
      moveStepTimer = moveStepInterval;
      const step = movePath[movePathIndex];
      // Spawn dust at old position
      const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      spawnDust(cx, cy);
      drillX = step.col;
      drillY = step.row;
      ++movePathIndex;
      // Pick up dropped resources at new position
      pickUpDroppedResources();
    }
  }

  function clearMoveTarget() {
    moveTarget = null;
    movePath = null;
    movePathIndex = 0;
    moveStepTimer = 0;
    mineTarget = null;
    cancelMining();
  }

  /* ======================================================================
     UPDATE
     ====================================================================== */

  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;

    updateTransition(dt);
    updateAnimations(dt);
    updateGadgets(dt);
    updateMining(dt);
    updateMovement(dt);

    // Age dropped resources; despawn after 120s
    for (let i = droppedResources.length - 1; i >= 0; --i) {
      droppedResources[i].age += dt;
      if (droppedResources[i].age > 120)
        droppedResources.splice(i, 1);
    }

    // Center camera on player underground
    if (currentView !== VIEW_SURFACE) {
      const targetCamX = drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
      const targetCamY = drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
      const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
      const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
      cameraX += (Math.max(0, Math.min(maxCamX, targetCamX)) - cameraX) * 0.15;
      cameraY += (Math.max(0, Math.min(maxCamY, targetCamY)) - cameraY) * 0.15;
    }

    if (!waveActive) {
      waveTimer -= dt;
      if (waveTimer <= 0)
        spawnWave();
    }

    updateEnemies(dt);
    updateWeapon(dt);

    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL && state === STATE_PLAYING) {
      autosaveTimer = 0;
      saveRun();
    }
  }

  /* ======================================================================
     DRAWING HELPERS
     ====================================================================== */

  function drawGroundLayer() {
    const groundY = DOME_Y;

    // Multi-layer ground gradient
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#3a2510');
    groundGrad.addColorStop(0.3, '#2a1a0a');
    groundGrad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

    // Ground highlight edge
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_W, groundY);
    ctx.stroke();

    // Grass tufts along the ground line
    ctx.strokeStyle = '#2a5a1a';
    ctx.lineWidth = 3;
    for (let gx = 10; gx < CANVAS_W; gx += 24 + Math.sin(gx * 0.3) * 10) {
      const tiltSeed = Math.sin(gx * 0.7 + animTime * 0.8);
      const h = 8 + Math.abs(Math.sin(gx * 0.5)) * 12;
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.quadraticCurveTo(gx + tiltSeed * 6, groundY - h * 0.6, gx + tiltSeed * 4, groundY - h);
      ctx.stroke();
    }

    // Pebble/rock details on the ground surface
    ctx.fillStyle = '#4a3a20';
    const pebbleSeed = 42;
    for (let px = 40; px < CANVAS_W; px += 70 + ((px * pebbleSeed) % 40)) {
      const py = groundY + 10 + ((px * 7) % 30);
      const pr = 2 + ((px * 3) % 6);
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.5, pr * 1, 0, 0, TWO_PI);
      ctx.fill();
    }
  }

  function drawDome() {
    const pulse = Math.sin(domePulsePhase) * 0.15;
    const flashAlpha = domeHitFlash * 0.6;
    const hpRatio = domeHP / maxDomeHP;

    // Dome interior gradient fill (semi-transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 2, Math.PI, 0);
    ctx.closePath();
    const interiorGrad = ctx.createRadialGradient(DOME_X, DOME_Y - 20, 10, DOME_X, DOME_Y, DOME_RADIUS);
    interiorGrad.addColorStop(0, 'rgba(80,140,220,0.08)');
    interiorGrad.addColorStop(0.6, 'rgba(60,120,200,0.04)');
    interiorGrad.addColorStop(1, 'rgba(40,100,180,0.02)');
    ctx.fillStyle = interiorGrad;
    ctx.fill();
    ctx.restore();

    // Hex pattern on dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 1, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = `rgba(100,180,255,${0.25 + pulse * 0.12})`;
    ctx.lineWidth = 2;
    const hexSize = 24;
    const hexH = hexSize * Math.sqrt(3);
    for (let hy = DOME_Y - DOME_RADIUS; hy < DOME_Y + 10; hy += hexH) {
      for (let hx = DOME_X - DOME_RADIUS; hx < DOME_X + DOME_RADIUS; hx += hexSize * 3) {
        const ox = ((Math.floor((hy - DOME_Y + DOME_RADIUS) / hexH)) % 2) * hexSize * 1.5;
        drawHexagon(hx + ox, hy, hexSize);
      }
    }
    ctx.restore();

    // Dome shield arc (main) -- thicker with more shield upgrades
    const shieldLevel = getEffectiveLevel('domeHP');
    const domeLineWidth = 3 + shieldLevel * 2;
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
    ctx.closePath();
    const domeGrad = ctx.createLinearGradient(DOME_X - DOME_RADIUS, DOME_Y, DOME_X + DOME_RADIUS, DOME_Y);
    domeGrad.addColorStop(0, `rgba(40,120,255,${0.5 + pulse})`);
    domeGrad.addColorStop(0.5, `rgba(80,170,255,${0.8 + pulse})`);
    domeGrad.addColorStop(1, `rgba(40,120,255,${0.5 + pulse})`);
    ctx.strokeStyle = domeGrad;
    ctx.lineWidth = domeLineWidth;
    ctx.shadowBlur = 20 + pulse * 10 + shieldLevel * 3;
    ctx.shadowColor = '#4af';
    ctx.stroke();

    // Second pass -- brighter inner line
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - domeLineWidth / 2, Math.PI, 0);
    ctx.strokeStyle = `rgba(140,200,255,${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 1 + shieldLevel * 0.5;
    ctx.shadowBlur = 8 + shieldLevel * 2;
    ctx.shadowColor = '#8cf';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dome base (ground contact)
    ctx.beginPath();
    ctx.moveTo(DOME_X - DOME_RADIUS, DOME_Y);
    ctx.lineTo(DOME_X + DOME_RADIUS, DOME_Y);
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dome hit flash overlay
    if (flashAlpha > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,80,80,${flashAlpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Shield impact flashes
    for (const impact of shieldImpacts) {
      const ia = impact.angle;
      const il = impact.life;
      ctx.save();
      ctx.beginPath();
      const arcSpan = 0.3 * il;
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 4, ia - arcSpan, ia + arcSpan);
      ctx.strokeStyle = `rgba(100,200,255,${il * 0.8})`;
      ctx.lineWidth = 8 * il;
      ctx.shadowBlur = 15 * il;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Turret nozzle position on dome arc
    const nozzleDrawR = DOME_RADIUS + 16;
    const tbx = DOME_X + Math.cos(turretAngle) * nozzleDrawR;
    const tby = DOME_Y + Math.sin(turretAngle) * nozzleDrawR;

    // Dome turret base (small weapon mount at nozzle position)
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(turretAngle + Math.PI / 2);
    ctx.fillStyle = '#6a8ab0';
    ctx.fillRect(-8, -12, 16, 24);
    const turretGrad = ctx.createLinearGradient(-8, 0, 8, 0);
    turretGrad.addColorStop(0, '#8ab0d0');
    turretGrad.addColorStop(1, '#4a6a8a');
    ctx.fillStyle = turretGrad;
    ctx.fillRect(-6, -8, 12, 16);
    ctx.restore();

    // Turret barrel (rotates with turretAngle)
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(turretAngle);
    // Barrel body
    ctx.fillStyle = '#556';
    ctx.fillRect(0, -3, TURRET_BARREL_LENGTH, 6);
    // Barrel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, -3, TURRET_BARREL_LENGTH, 2);
    // Muzzle tip
    ctx.fillStyle = '#778';
    ctx.fillRect(TURRET_BARREL_LENGTH - 6, -5, 6, 10);
    ctx.restore();

    // Turret pivot dot
    ctx.fillStyle = '#aac';
    ctx.beginPath();
    ctx.arc(tbx, tby, 6, 0, TWO_PI);
    ctx.fill();
  }

  function drawHexagon(cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = (TWO_PI / 6) * i - Math.PI / 6;
      const hx = cx + Math.cos(a) * size;
      const hy = cy + Math.sin(a) * size;
      if (i === 0)
        ctx.moveTo(hx, hy);
      else
        ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawEnemy(e) {
    if (e.type === 'flyer')
      return drawFlyer(e);
    return drawGroundEnemy(e);
  }

  function drawGroundEnemy(e) {
    const hpR = e.hp / e.maxHP;
    const sz = e.size || 10;
    const wobble = Math.sin(e.wobblePhase) * 3;
    const legOffset = Math.sin(e.legPhase) * 6;

    ctx.save();
    ctx.translate(e.x, e.y + wobble);

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, sz + 4, sz * 0.8, 6, 0, 0, TWO_PI);
    ctx.fill();

    // Legs (4 little appendages)
    ctx.strokeStyle = e.armored ? '#664' : '#a33';
    ctx.lineWidth = e.boss ? 6 : 4;
    // Left legs
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, sz * 0.3);
    ctx.lineTo(-sz * 0.8, sz * 0.6 + legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, sz * 0.1);
    ctx.lineTo(-sz * 0.7, sz * 0.3 - legOffset);
    ctx.stroke();
    // Right legs
    ctx.beginPath();
    ctx.moveTo(sz * 0.4, sz * 0.3);
    ctx.lineTo(sz * 0.8, sz * 0.6 - legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, sz * 0.1);
    ctx.lineTo(sz * 0.7, sz * 0.3 + legOffset);
    ctx.stroke();

    // Body -- gradient sphere (armored = darker metallic, boss = thicker border)
    const bodyGrad = ctx.createRadialGradient(-sz * 0.15, -sz * 0.2, 1, 0, 0, sz);
    if (e.armored) {
      bodyGrad.addColorStop(0, `rgba(160,140,100,${0.6 + hpR * 0.4})`);
      bodyGrad.addColorStop(0.6, `rgba(100,90,60,${0.5 + hpR * 0.5})`);
      bodyGrad.addColorStop(1, `rgba(60,50,30,${0.4 + hpR * 0.4})`);
    } else {
      bodyGrad.addColorStop(0, `rgba(240,80,80,${0.6 + hpR * 0.4})`);
      bodyGrad.addColorStop(0.6, `rgba(180,40,40,${0.5 + hpR * 0.5})`);
      bodyGrad.addColorStop(1, `rgba(100,20,20,${0.4 + hpR * 0.4})`);
    }
    ctx.beginPath();
    ctx.arc(0, 0, sz, 0, TWO_PI);
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 8;
    ctx.shadowColor = e.armored
      ? `rgba(180,160,80,${0.3 + hpR * 0.4})`
      : `rgba(255,50,50,${0.3 + hpR * 0.4})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Boss: thicker border ring
    if (e.boss) {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 4, 0, TWO_PI);
      ctx.stroke();
    }

    // Body highlight (specular)
    ctx.fillStyle = e.armored ? 'rgba(220,210,170,0.3)' : 'rgba(255,180,180,0.3)';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.25, -sz * 0.3, sz * 0.35, sz * 0.2, -0.3, 0, TWO_PI);
    ctx.fill();

    // Boss: crown/horns
    if (e.boss) {
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.5, -sz * 0.85);
      ctx.lineTo(-sz * 0.3, -sz * 1.3);
      ctx.lineTo(-sz * 0.1, -sz * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sz * 0.1, -sz * 0.85);
      ctx.lineTo(sz * 0.3, -sz * 1.3);
      ctx.lineTo(sz * 0.5, -sz * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-sz * 0.2, -sz * 0.9);
      ctx.lineTo(0, -sz * 1.45);
      ctx.lineTo(sz * 0.2, -sz * 0.9);
      ctx.fill();
    }

    // Eyes
    const eyeH = e.eyeBlinking ? 1 : 6;
    ctx.fillStyle = e.boss ? '#f00' : '#ff0';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.3, -sz * 0.15, 6, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(-sz * 0.3, -sz * 0.15, 2.4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = e.boss ? '#f00' : '#ff0';
    ctx.beginPath();
    ctx.ellipse(sz * 0.3, -sz * 0.15, 6, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(sz * 0.3, -sz * 0.15, 2.4, 0, TWO_PI);
      ctx.fill();
    }

    // Mouth (angry slit)
    ctx.strokeStyle = '#300';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.25, sz * 0.25);
    ctx.quadraticCurveTo(0, sz * 0.4, sz * 0.25, sz * 0.25);
    ctx.stroke();

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();

    // Shield arc
    if (e.shield > 0)
      drawEnemyShield(e, wobble);

    // Enemy HP bar (improved)
    drawEnemyHPBar(e, sz, wobble);
  }

  function drawFlyer(e) {
    const hpR = e.hp / e.maxHP;
    const sz = e.size || 7;
    const bob = Math.sin(e.wobblePhase) * 8; // sinusoidal vertical bobbing

    ctx.save();
    ctx.translate(e.x, e.y + bob);

    // Faint shadow far below (on ground)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 80 - bob, sz * 0.5, 4, 0, 0, TWO_PI);
    ctx.fill();

    // Wings (flapping lines)
    ctx.strokeStyle = '#806';
    ctx.lineWidth = 4;
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, 0);
    ctx.lineTo(-sz * 1.4, -sz * 0.3 + Math.sin(e.wingPhase || 0) * sz * 0.5);
    ctx.lineTo(-sz * 0.9, sz * 0.2 + Math.sin(e.wingPhase || 0) * sz * 0.3);
    ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, 0);
    ctx.lineTo(sz * 1.4, -sz * 0.3 + Math.sin((e.wingPhase || 0) + Math.PI) * sz * 0.5);
    ctx.lineTo(sz * 0.9, sz * 0.2 + Math.sin((e.wingPhase || 0) + Math.PI) * sz * 0.3);
    ctx.stroke();

    // Body -- triangular/bat-like, purple/dark
    const bodyGrad = ctx.createRadialGradient(0, -sz * 0.1, 1, 0, 0, sz);
    bodyGrad.addColorStop(0, `rgba(160,60,180,${0.6 + hpR * 0.4})`);
    bodyGrad.addColorStop(0.6, `rgba(100,30,120,${0.5 + hpR * 0.5})`);
    bodyGrad.addColorStop(1, `rgba(50,15,60,${0.4 + hpR * 0.4})`);
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.9);
    ctx.lineTo(-sz * 0.7, sz * 0.5);
    ctx.lineTo(0, sz * 0.3);
    ctx.lineTo(sz * 0.7, sz * 0.5);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(180,60,220,${0.3 + hpR * 0.4})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Body highlight
    ctx.fillStyle = 'rgba(220,180,240,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -sz * 0.3, sz * 0.25, sz * 0.15, 0, 0, TWO_PI);
    ctx.fill();

    // Glowing eyes (larger, more menacing)
    const eyeH = e.eyeBlinking ? 0.6 : 5;
    ctx.fillStyle = '#f0f';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#f0f';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.2, -sz * 0.2, 4, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sz * 0.2, -sz * 0.2, 4, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();

    // Shield arc
    if (e.shield > 0)
      drawEnemyShield(e, bob);

    // HP bar
    drawEnemyHPBar(e, sz, bob);
  }

  function drawEnemyShield(e, vertOffset) {
    const sz = e.size || 10;
    const shieldR = e.shield / (e.maxShield || 1);
    ctx.save();
    ctx.translate(e.x, e.y + vertOffset);
    ctx.strokeStyle = `rgba(80,160,255,${0.4 + shieldR * 0.4})`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#4af';
    ctx.beginPath();
    ctx.arc(0, 0, sz + 10, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawEnemyHPBar(e, sz, vertOffset) {
    const hpR = e.hp / e.maxHP;
    const barW = sz * 2 + 8;
    const barX = e.x - barW / 2;
    const barY = e.y - sz - 20 + vertOffset;
    ctx.fillStyle = '#200';
    ctx.fillRect(barX, barY, barW, 8);
    const ehpGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpR, barY);
    ehpGrad.addColorStop(0, '#f66');
    ehpGrad.addColorStop(1, '#f44');
    ctx.fillStyle = ehpGrad;
    ctx.fillRect(barX, barY, barW * hpR, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpR, 4);

    // Shield bar (drawn above HP bar if shield exists)
    if (e.shield > 0 && e.maxShield > 0) {
      const shieldR = e.shield / e.maxShield;
      ctx.fillStyle = '#024';
      ctx.fillRect(barX, barY - 10, barW, 6);
      ctx.fillStyle = '#4af';
      ctx.fillRect(barX, barY - 10, barW * shieldR, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY - 10, barW * shieldR, 2);
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      const alpha = p.life / p.maxLife;

      // Electric arc effect using shared helper
      SZ.GameEffects.drawElectricArc(ctx, p.x, p.y, p.tx, p.ty, {
        segments: 8,
        jitter: 12 * alpha,
        color: `rgba(255,120,120,${alpha})`,
        glowColor: `rgba(255,60,60,${alpha * 0.5})`,
        width: 3 * alpha,
        glowWidth: 8 * alpha
      });

      // Impact flash
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, 12 * alpha, 0, TWO_PI);
      const impactGrad = ctx.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, 12 * alpha);
      impactGrad.addColorStop(0, `rgba(255,220,150,${alpha})`);
      impactGrad.addColorStop(0.5, `rgba(255,100,50,${alpha * 0.6})`);
      impactGrad.addColorStop(1, `rgba(255,50,50,0)`);
      ctx.fillStyle = impactGrad;
      ctx.fill();

      // Emit trail particles along beam
      if (Math.random() < 0.3) {
        const t = Math.random();
        const px = p.x + (p.tx - p.x) * t;
        const py = p.y + (p.ty - p.y) * t;
        particles.trail(px, py, { color: '#f88', life: 0.15, size: 1 });
      }
    }
  }

  /* ======================================================================
     DRAWING -- SURFACE
     ====================================================================== */

  function drawSurface() {
    // Sky gradient (deeper, richer)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, DOME_Y);
    skyGrad.addColorStop(0, '#050520');
    skyGrad.addColorStop(0.4, '#0a0a30');
    skyGrad.addColorStop(0.7, '#101040');
    skyGrad.addColorStop(1, '#1a1a50');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, DOME_Y);

    // Starfield
    starfield.draw(ctx);

    // Distant mountains silhouette
    ctx.fillStyle = '#0f0f2a';
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 40 + Math.sin(mx * 0.008) * 50 + Math.sin(mx * 0.02 + 1) * 24 + Math.sin(mx * 0.05 + 2) * 10;
      ctx.lineTo(mx, DOME_Y - h);
    }
    ctx.lineTo(CANVAS_W, DOME_Y);
    ctx.closePath();
    ctx.fill();

    // Near hills
    ctx.fillStyle = '#151530';
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 16 + Math.sin(mx * 0.015 + 3) * 24 + Math.sin(mx * 0.04) * 12;
      ctx.lineTo(mx, DOME_Y - h);
    }
    ctx.lineTo(CANVAS_W, DOME_Y);
    ctx.closePath();
    ctx.fill();

    // Ground layer with details
    drawGroundLayer();

    // Dome
    drawDome();

    // Gadget visuals on surface
    drawSurfaceGadgets();

    // Enemies
    for (const e of enemies)
      drawEnemy(e);

    // Projectiles
    drawProjectiles();

    drawSurfaceHUD();

    // Upgrade panel
    drawUpgradePanel();
  }

  /* ======================================================================
     DRAWING -- UNDERGROUND
     ====================================================================== */

  function drawUnderground() {
    // Dark cavern background (flat fill for performance)
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid tiles (viewport culled)
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endCol = Math.min(GRID_COLS, Math.ceil((cameraX + CANVAS_W) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endRow = Math.min(GRID_ROWS, Math.ceil((cameraY + CANVAS_H) / TILE_SIZE));

    for (let r = startRow; r < endRow; ++r) {
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - cameraX;
        const y = r * TILE_SIZE - cameraY;
        const tile = undergroundGrid[r][c];

        if (tile === TILE_EMPTY) {
          // Empty cave space (flat fill for performance)
          ctx.fillStyle = '#140f0a';
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === TILE_GADGET) {
          // Gadget tiles rendered by drawUndergroundGadgets() -- draw dirt base here
          drawTile(x, y, TILE_DIRT, r, c);
        } else {
          drawTile(x, y, tile, r, c);
        }

        // Draw crack overlay for partially-mined tiles
        if (tile !== TILE_EMPTY && tileHP[r] && tileMaxHP[r] && tileMaxHP[r][c] > 0) {
          const hpRatio = tileHP[r][c] / tileMaxHP[r][c];
          if (hpRatio < 0.99) {
            const damage = 1 - hpRatio; // 0 = pristine, 1 = about to break
            // Darken overlay proportional to damage
            ctx.fillStyle = `rgba(0,0,0,${damage * 0.4})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            // Draw crack lines that grow with damage
            ctx.strokeStyle = `rgba(0,0,0,${0.2 + damage * 0.5})`;
            ctx.lineWidth = 0.8 + damage * 1.2;
            const seed = r * GRID_COLS + c;
            const cx = x + TILE_SIZE / 2;
            const cy = y + TILE_SIZE / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (seed % 13 - 6) * damage, cy + (seed % 11 - 5) * damage);
            ctx.lineTo(cx + (seed % 17 - 8) * damage, cy + (seed % 9 - 4) * damage * 1.5);
            ctx.stroke();
            if (damage > 0.4) {
              ctx.beginPath();
              ctx.moveTo(cx - 3, cy + 2);
              ctx.lineTo(cx + (seed % 7 - 3) * damage * 1.3, cy - (seed % 5 + 2) * damage);
              ctx.stroke();
            }
          }
        }

        // Grid lines
        ctx.strokeStyle = '#2a2010';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Gadget chamber overlays and probe highlights
    drawUndergroundGadgets();

    // Resource reveal glows (drawn over tiles)
    for (const g of resourceGlows) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, TWO_PI);
      const glowGrad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
      glowGrad.addColorStop(0, `rgba(255,255,255,${g.life * 0.4})`);
      glowGrad.addColorStop(0.5, hexToRgba(g.color, g.life * 0.2));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // Rock crumble debris
    for (const crumble of crumbleEffects) {
      const alpha = Math.max(0, crumble.life / 0.6);
      ctx.globalAlpha = alpha;
      for (const p of crumble.pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Dust clouds
    for (const d of dustClouds) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fillStyle = '#8a7a5a';
      ctx.fill();
      ctx.restore();
    }

    // Draw dropped resources as small colored dots (viewport-culled)
    for (const drop of droppedResources) {
      const dx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const dy = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      if (dx < -TILE_SIZE || dx > CANVAS_W + TILE_SIZE || dy < -TILE_SIZE || dy > CANVAS_H + TILE_SIZE) continue;
      const dropColor = TILE_HIGHLIGHT_COLORS[drop.type] || '#fff';
      const pulse = Math.sin(animTime * 4 + drop.col + drop.row) * 0.3 + 0.7;
      ctx.fillStyle = dropColor;
      ctx.globalAlpha = pulse;
      ctx.fillRect(dx - 10, dy - 8, 8, 8);
      ctx.fillRect(dx + 2, dy - 2, 7, 7);
      ctx.fillRect(dx - 4, dy + 4, 6, 6);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      fitText(String(drop.value), dx, dy - 10, TILE_SIZE + 8, 15, { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.8)' });
    }

    // Draw mining progress bar above the block being mined
    if (miningTarget && miningDuration > 0) {
      const mx = miningTarget.col * TILE_SIZE - cameraX;
      const my = miningTarget.row * TILE_SIZE - cameraY;
      const barW = TILE_SIZE - 8;
      const barH = 5;
      const barX = mx + 4;
      const barY = my - barH - 3;
      const progress = Math.min(miningProgress / miningDuration, 1);

      // Bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);

      // Bar fill (gradient from yellow to green as it completes)
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
      barGrad.addColorStop(0, '#da2');
      barGrad.addColorStop(1, progress > 0.8 ? '#0c0' : '#fa0');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * progress, barH);

      // Bar highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW * progress, barH / 2);

      // Bar border
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // Draw planned path dots
    if (movePath && movePathIndex < movePath.length) {
      ctx.fillStyle = 'rgba(100,200,255,0.3)';
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        const px = step.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const py = step.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, TWO_PI);
        ctx.fill();
      }
      // Draw dots connecting them
      ctx.strokeStyle = 'rgba(100,200,255,0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      const pathStartX = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const pathStartY = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.moveTo(pathStartX, pathStartY);
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        ctx.lineTo(step.col * TILE_SIZE + TILE_SIZE / 2 - cameraX,
                   step.row * TILE_SIZE + TILE_SIZE / 2 - cameraY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Show mine target marker
      if (mineTarget) {
        ctx.strokeStyle = 'rgba(255,100,50,0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(mineTarget.col * TILE_SIZE + 2 - cameraX,
                       mineTarget.row * TILE_SIZE + 2 - cameraY,
                       TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }

    // Draw drill/player character
    drawPlayer();

    // Resource display (improved styling)
    drawResourceHUD();

    // Blast charges
    if (foundGadgets.includes('blastMining') && (primaryGadgetState.blastCharges || 0) > 0) {
      drawSprite('bomb', CANVAS_W - 40, CANVAS_H - 66, 24);
      drawChip(`Blast [B]: ${primaryGadgetState.blastCharges}`, CANVAS_W - 58, CANVAS_H - 79, 26, { align: 'right', px: 15, bg: 'rgba(20,26,42,0.85)', border: 'rgba(255,160,64,0.6)', color: '#ffa040' });
    }

    // Tool HUD (underground)
    drawToolHUDUnderground();

    drawKeyHints([
      { key: 'Space', label: 'Surface' },
      { key: 'WASD', label: 'Move & mine' },
      { key: 'Click', label: 'Walk / dig' },
      { key: 'H', label: 'Help' }
    ], CANVAS_W / 2, CANVAS_H - 24, 600);
  }

  // Pre-generate deterministic ore speckle positions per tile
  let oreSpeckles = [];
  function generateOreSpeckles() {
    oreSpeckles = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 10; ++d)
          dots.push({
            ox: 4 + Math.random() * (TILE_SIZE - 8),
            oy: 4 + Math.random() * (TILE_SIZE - 8),
            size: 1.5 + Math.random() * 2.5,
            brightness: 0.4 + Math.random() * 0.6
          });
        row.push(dots);
      }
      oreSpeckles.push(row);
    }
  }

  function drawTile(x, y, tile, r, c) {
    // Depth-based colors for dirt tiles
    let baseColor, shadowColor, highlightColor;
    if (tile === TILE_DIRT) {
      const tier = getDepthDirtColors(r);
      baseColor = tier.base;
      shadowColor = tier.shadow;
      highlightColor = tier.highlight;
    } else {
      baseColor = TILE_COLORS[tile] || '#3a2a1a';
      shadowColor = TILE_SHADOW_COLORS[tile] || '#1a0f05';
      highlightColor = TILE_HIGHLIGHT_COLORS[tile];
    }
    const bevel = 3; // bevel thickness in pixels

    // Main tile fill (flat base)
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // === Minecraft-style 3D bevel ===
    // Top bevel (bright highlight)
    ctx.fillStyle = highlightColor || lightenColor(baseColor, 40);
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, bevel);

    // Left bevel (slightly less bright)
    ctx.fillStyle = lightenColor(baseColor, 25);
    ctx.fillRect(x + 1, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Bottom bevel (dark shadow)
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 1, y + TILE_SIZE - 1 - bevel, TILE_SIZE - 2, bevel);

    // Right bevel (medium shadow)
    ctx.fillStyle = lightenColor(shadowColor.startsWith('#') ? shadowColor : '#1a0f05', 15);
    ctx.fillRect(x + TILE_SIZE - 1 - bevel, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Inner face (flat fill for performance -- avoids per-tile gradient creation)
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 1 + bevel, y + 1 + bevel, TILE_SIZE - 2 - bevel * 2, TILE_SIZE - 2 - bevel * 2);

    // Dirt texture noise dots
    if (tile === TILE_DIRT && dirtNoise[r] && dirtNoise[r][c]) {
      for (const dot of dirtNoise[r][c]) {
        ctx.fillStyle = `rgba(0,0,0,${dot.shade})`;
        ctx.beginPath();
        ctx.arc(x + dot.ox, y + dot.oy, dot.size * 0.6, 0, TWO_PI);
        ctx.fill();
      }
      // Small cracks on dirt
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      const seed = r * GRID_COLS + c;
      ctx.beginPath();
      ctx.moveTo(x + 8 + (seed % 10), y + 5 + (seed % 7));
      ctx.lineTo(x + 15 + (seed % 12), y + 18 + (seed % 5));
      ctx.lineTo(x + 20 + (seed % 8), y + 28 + (seed % 9));
      ctx.stroke();
    }

    // === Ore-specific decorations ===
    if (tile !== TILE_DIRT) {
      const colors = ORE_SPECKLE_COLORS[tile] || ['#fff'];
      if (oreSpeckles[r] && oreSpeckles[r][c]) {
        for (const dot of oreSpeckles[r][c]) {
          const ci = Math.floor(dot.brightness * colors.length) % colors.length;
          ctx.fillStyle = colors[ci];
          const sz = dot.size;
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy - sz / 2, sz, sz);
        }
      }

      // Glowing edge around resource tiles (no shadowBlur for performance)
      const glowPulse = Math.sin(animTime * 3 + r * 0.5 + c * 0.7) * 0.3 + 0.3;
      ctx.strokeStyle = highlightColor || baseColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + glowPulse;
      ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.globalAlpha = 1;

      // Resource-specific animated details (only near player to save draw calls)
      const nearPlayer = Math.abs(r - drillY) + Math.abs(c - drillX) <= 6;
      if (nearPlayer) {
        if (tile === TILE_IRON) {
          ctx.fillStyle = 'rgba(200,200,200,0.15)';
          ctx.fillRect(x + 8, y + 10, 3, 20);
          ctx.fillRect(x + 18, y + 6, 3, 15);
          ctx.fillRect(x + 28, y + 12, 3, 18);
        } else if (tile === TILE_WATER) {
          ctx.strokeStyle = 'rgba(100,180,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let wx = x + 5; wx < x + TILE_SIZE - 5; wx += 4) {
            const wy = y + TILE_SIZE / 2 + Math.sin((wx - x) * 0.3 + animTime * 4) * 3;
            if (wx === x + 5)
              ctx.moveTo(wx, wy);
            else
              ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        } else if (tile === TILE_COBALT) {
          ctx.fillStyle = 'rgba(100,100,200,0.2)';
          ctx.beginPath();
          ctx.moveTo(x + 12, y + 8);
          ctx.lineTo(x + 20, y + 5);
          ctx.lineTo(x + 28, y + 14);
          ctx.lineTo(x + 22, y + 20);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Resource sprite
      const tIcon = TILE_ICONS[tile];
      if (tIcon)
        drawSprite(tIcon, x + TILE_SIZE / 2, y + TILE_SIZE / 2, 28);
    }
  }

  function drawPlayer() {
    const px = drillX * TILE_SIZE - cameraX;
    const py = drillY * TILE_SIZE - cameraY;
    const cx = px + TILE_SIZE / 2;
    const cy = px + TILE_SIZE / 2; // intentionally kept but we use py below
    const bob = playerBob;

    // Selection highlight (animated border)
    const selPulse = Math.sin(animTime * 5) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,255,0,${selPulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.setLineDash([]);

    // Player body
    const bodyX = px + TILE_SIZE / 2;
    const bodyY = py + TILE_SIZE / 2 + bob;

    ctx.save();
    ctx.translate(bodyX, bodyY);
    ctx.scale(0.5, 0.5);

    // Mining helmet (top arc)
    ctx.fillStyle = '#da2';
    ctx.beginPath();
    ctx.arc(0, -8, 16, Math.PI, 0);
    ctx.fill();
    // Helmet highlight
    ctx.fillStyle = '#fc4';
    ctx.beginPath();
    ctx.arc(-4, -12, 6, Math.PI, 0);
    ctx.fill();
    // Headlamp
    ctx.fillStyle = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, TWO_PI);
    ctx.fill();
    // Headlamp glow
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -16, 4, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,128,0.3)';
    ctx.fill();
    ctx.restore();

    // Face
    ctx.fillStyle = '#d8a060';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TWO_PI);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5, -2, 2.4, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -2, 2.4, 0, TWO_PI);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#733';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Body/suit
    ctx.fillStyle = '#36a';
    ctx.fillRect(-10, 12, 20, 16);

    // Arms (one holds pickaxe)
    ctx.strokeStyle = '#d8a060';
    ctx.lineWidth = 5;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(-18, 28);
    ctx.stroke();
    // Right arm (holding pickaxe, animated)
    ctx.beginPath();
    ctx.moveTo(10, 16);
    if (pickaxeSwinging) {
      const swingDir = lastMineDir.dx !== 0 ? lastMineDir.dx : lastMineDir.dy;
      ctx.lineTo(10 + Math.cos(-pickaxeAngle * swingDir) * 16, 16 + Math.sin(pickaxeAngle) * 8);
    } else
      ctx.lineTo(18, 28);
    ctx.stroke();

    // Pickaxe in right hand
    ctx.save();
    if (pickaxeSwinging) {
      const swingAngle = pickaxeAngle * (lastMineDir.dx >= 0 ? 1 : -1);
      ctx.translate(14, 20);
      ctx.rotate(-0.5 + swingAngle * 1.5);
    } else {
      ctx.translate(18, 26);
      ctx.rotate(-0.3);
    }
    // Handle
    ctx.strokeStyle = '#854';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, -12);
    ctx.stroke();
    // Pick head
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(26, -16);
    ctx.lineTo(20, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(10, -20);
    ctx.lineTo(12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.strokeStyle = '#248';
    ctx.lineWidth = 5;
    const legAnim = pickaxeSwinging ? Math.sin(animTime * 15) * 1 : 0;
    ctx.beginPath();
    ctx.moveTo(-6, 28);
    ctx.lineTo(-8 + legAnim * 2, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.lineTo(8 - legAnim * 2, 40);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#543';
    ctx.fillRect(-12 + legAnim * 2, 36, 10, 6);
    ctx.fillRect(4 - legAnim * 2, 36, 10, 6);

    ctx.restore();
  }

  // Resource HUD display configuration
  const RESOURCE_HUD_ENTRIES = [
    { key: 'iron', label: 'Fe', color: '#bbb' },
    { key: 'water', label: 'H2O', color: '#6af' },
    { key: 'cobalt', label: 'Co', color: '#88c' },
    { key: 'copper', label: 'Cu', color: '#d4944d' },
    { key: 'tin', label: 'Sn', color: '#d4d4d4' },
    { key: 'coal', label: 'C', color: '#888' },
    { key: 'lead', label: 'Pb', color: '#999' },
    { key: 'silver', label: 'Ag', color: '#e0e0e0' },
    { key: 'gold', label: 'Au', color: '#ffd700' },
    { key: 'quartz', label: 'Qz', color: '#f0e6d3' },
    { key: 'redstone', label: 'Rs', color: '#ff3333' },
    { key: 'emerald', label: 'Em', color: '#50c878' },
    { key: 'diamond', label: 'Di', color: '#b9f2ff' },
    { key: 'ruby', label: 'Rb', color: '#ff4488' }
  ];

  function drawResourceHUD() {
    // Only show resources the player has collected (non-zero) plus the base 3
    const visibleEntries = RESOURCE_HUD_ENTRIES.filter(
      (e, i) => i < 3 || resources[e.key] > 0
    );
    const lineH = 26;
    const useColumns = visibleEntries.length > 7;
    const colEntries = useColumns ? Math.ceil(visibleEntries.length / 2) : visibleEntries.length;
    const colW = 168;
    const panelX = 16, panelY = 16;
    const panelW = 16 + (useColumns ? 2 : 1) * colW;
    const panelH = 14 + colEntries * lineH;

    drawPanel(panelX, panelY, panelW, panelH, { accent: '#c8a060', shadow: 10 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < visibleEntries.length; ++i) {
      const e = visibleEntries[i];
      const col = useColumns ? Math.floor(i / colEntries) : 0;
      const row = useColumns ? i % colEntries : i;
      const x = panelX + 10 + col * colW;
      const y = panelY + 7 + row * lineH + lineH / 2;
      drawSprite(e.key, x + 10, y, 20);
      ctx.textAlign = 'left';
      fitText(e.label, x + 26, y + 1, 44, 15, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(String(resources[e.key]), x + colW - 12, y + 1, colW - 84, 18, { weight: 'bold', color: e.color });
    }

    // Cargo and depth (top-right)
    const carryX = CANVAS_W - 296, carryW = 280;
    drawPanel(carryX, panelY, carryW, 84, { accent: '#e0c060', shadow: 10 });
    const carryRatio = Math.min(carried / carryCapacity, 1);
    drawSprite('bag', carryX + 24, panelY + 24, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Cargo', carryX + 44, panelY + 25, 90, 18, { weight: 'bold', color: UI.text });
    ctx.textAlign = 'right';
    fitText(`${carried} / ${carryCapacity}`, carryX + carryW - 16, panelY + 25, 130, 18, { weight: 'bold', color: carryRatio >= 1 ? UI.bad : '#f0d070' });
    drawMeter(carryX + 14, panelY + 42, carryW - 28, 10, carryRatio, carryRatio >= 1 ? '#e84040' : '#e0b030');
    ctx.textAlign = 'left';
    fitText(`Depth ${drillY} m  ·  ${DEPTH_TIERS[getDepthTier(drillY)].name}`, carryX + 16, panelY + 68, carryW - 32, 15, { color: UI.textDim });
  }

  function drawToolHUDUnderground() {
    const tools = GADGET_DEFS.filter(d => unlockedTools[d.key]);
    if (!tools.length) return;

    const hudX = CANVAS_W - 296, hudW = 280;
    const hudY = 112;
    const rowH = 30;
    drawPanel(hudX, hudY, hudW, 12 + tools.length * rowH, { accent: '#9a7aff', shadow: 10 });

    for (let i = 0; i < tools.length; ++i) {
      const def = tools[i];
      const y = hudY + 6 + i * rowH + rowH / 2;
      const isActive = activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';
      let label = def.name, status = '', color = UI.textDim;
      if (def.key === 'blastTool') {
        label = 'Blast';
        const cd = toolState.blastToolCooldown > 0;
        status = cd ? Math.ceil(toolState.blastToolCooldown) + 's' : 'RDY';
        color = cd ? UI.textMute : (isActive ? UI.gold : '#ffa040');
      } else if (def.key === 'teleporter') {
        label = 'Teleport';
        const cd = toolState.teleporterCooldown > 0;
        status = cd ? Math.ceil(toolState.teleporterCooldown) + 's' : 'RDY';
        color = cd ? UI.textMute : '#c890ff';
      } else if (def.key === 'drill') {
        label = 'Drill';
        status = isActive ? 'SEL' : '';
        color = isActive ? UI.gold : UI.textDim;
      } else if (isPassive) {
        status = 'ON';
        color = UI.good;
      }
      drawChip(def.shortcut, hudX + 10, y - 11, 22, { px: 13, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.18)', color: UI.textDim });
      drawSprite(def.icon, hudX + 50, y, 20);
      let sw = 0;
      if (status)
        sw = drawChip(status, hudX + hudW - 12, y - 11, 22, { align: 'right', px: 12, bg: 'rgba(255,255,255,0.08)', color });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, hudX + 66, y + 1, hudW - 66 - 20 - sw, 16, { weight: 'bold', color });
    }
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  const _lightenCache = {};
  function lightenColor(hex, amount) {
    const key = hex + '|' + amount;
    if (_lightenCache[key]) return _lightenCache[key];
    const [r, g, b] = parseHex(hex);
    const result = `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
    _lightenCache[key] = result;
    return result;
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ======================================================================
     DRAWING -- GADGETS
     ====================================================================== */

  function drawSurfaceGadgets() {
    // Shield Generator: blue arc around dome when active
    if (primaryGadget === 'shield' && primaryGadgetState.active) {
      ctx.save();
      const shieldPulse = Math.sin(animTime * 4) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 12, Math.PI, 0);
      ctx.strokeStyle = `rgba(80,180,255,${0.5 * shieldPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 16, Math.PI + 0.2, -0.2);
      ctx.strokeStyle = `rgba(120,200,255,${0.3 * shieldPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Repellent Field: expanding purple ring
    if (primaryGadget === 'repellent' && primaryGadgetState.active) {
      ctx.save();
      const ringPulse = Math.sin(animTime * 6) * 0.2 + 0.8;
      const ringRadius = DOME_RADIUS + 40 + Math.sin(animTime * 3) * 10;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius, 0, TWO_PI);
      ctx.strokeStyle = `rgba(160,80,220,${0.6 * ringPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#a0f';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius + 10, 0, TWO_PI);
      ctx.strokeStyle = `rgba(180,100,240,${0.25 * ringPulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Orchard: small tree inside dome
    if (primaryGadget === 'orchard') {
      const treeX = DOME_X - 60;
      const treeY = DOME_Y - 16;
      // Trunk
      ctx.fillStyle = '#654';
      ctx.fillRect(treeX - 4, treeY - 30, 8, 30);
      // Canopy
      ctx.fillStyle = '#2a6';
      ctx.beginPath();
      ctx.arc(treeX, treeY - 36, 16, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#3a8';
      ctx.beginPath();
      ctx.arc(treeX - 6, treeY - 32, 10, 0, TWO_PI);
      ctx.fill();
      // Fruit (glowing when ready)
      if (primaryGadgetState.fruitReady) {
        ctx.save();
        const fruitGlow = Math.sin(animTime * 5) * 0.3 + 0.7;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff0';
        ctx.fillStyle = `rgba(255,200,50,${fruitGlow})`;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 6, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // Droneyard: small diamond drone flying
    if (primaryGadget === 'droneyard') {
      const dronePhase = primaryGadgetState.dronePhase || 0;
      const droneY = DOME_Y - 100 + Math.sin(dronePhase) * 40;
      const droneX = DOME_X + 70;
      ctx.save();
      ctx.translate(droneX, droneY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#8ac';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#adf';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      // Propeller lines
      ctx.strokeStyle = 'rgba(150,200,255,0.4)';
      ctx.lineWidth = 2;
      const propLen = 10 + Math.sin(animTime * 20) * 4;
      ctx.beginPath();
      ctx.moveTo(droneX - propLen, droneY - 4);
      ctx.lineTo(droneX + propLen, droneY - 4);
      ctx.stroke();
    }

    // Auto Cannon: turret on top of dome (apex) so it can reach both sides
    if (foundGadgets.includes('autoCannon')) {
      const acX = DOME_X;
      const acY = DOME_Y - DOME_RADIUS;
      // Base
      ctx.fillStyle = '#667';
      ctx.fillRect(acX - 10, acY - 4, 20, 16);
      // Barrel (points upward)
      ctx.fillStyle = '#556';
      ctx.fillRect(acX - 3, acY - 20, 6, 20);
      // Muzzle flash
      if (primaryGadgetState.autoCannonFlash > 0 && primaryGadgetState.autoCannonTarget) {
        const t = primaryGadgetState.autoCannonTarget;
        const alpha = primaryGadgetState.autoCannonFlash / 0.3;
        ctx.strokeStyle = `rgba(255,255,0,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,200,0,${alpha * 0.4})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
    }

    // Stun Laser: blue beam from dome to target
    if (foundGadgets.includes('stunLaser') && primaryGadgetState.stunLaserFlash > 0 && primaryGadgetState.stunLaserTarget) {
      const t = primaryGadgetState.stunLaserTarget;
      const alpha = primaryGadgetState.stunLaserFlash / 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(80,160,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4af';
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(150,210,255,${alpha * 0.6})`;
      ctx.lineWidth = 10;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Reinforced Dome: extra thick dome arc
    if (unlockedTools.reinforcedDome) {
      ctx.save();
      const armorPulse = Math.sin(animTime * 2) * 0.1 + 0.9;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 8, Math.PI, 0);
      ctx.strokeStyle = `rgba(180,160,100,${0.35 * armorPulse})`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 6, Math.PI + 0.1, -0.1);
      ctx.strokeStyle = `rgba(220,200,140,${0.2 * armorPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Row of keycap hints ("[Space] Mine") centred on cx and kept within maxW
  function drawKeyHints(hints, cx, cy, maxW) {
    const keyPx = 14, labelPx = 15, keyH = 22, gap = 18;
    ctx.font = uiFont(keyPx, 'bold');
    const parts = hints.map(h => {
      ctx.font = uiFont(keyPx, 'bold');
      const kw = Math.max(keyH, ctx.measureText(h.key).width + 12);
      ctx.font = uiFont(labelPx);
      return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
    });
    let total = -gap;
    for (const p of parts)
      total += p.kw + 6 + p.lw + gap;
    const s = Math.min(1, maxW / total);
    ctx.save();
    ctx.translate(cx - total * s / 2, cy);
    ctx.scale(s, s);
    let x = 0;
    for (const p of parts) {
      roundRectPath(x, -keyH / 2, p.kw, keyH, 5);
      ctx.fillStyle = 'rgba(20,26,42,0.85)';
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
      ctx.fillStyle = 'rgba(200,210,230,0.75)';
      ctx.fillText(p.label, x + p.kw + 6, 1);
      x += p.kw + 6 + p.lw + gap;
    }
    ctx.restore();
  }

  function drawSurfaceHUD() {
    // Wave status (top-left)
    drawPanel(16, 16, 300, 74, { accent: waveActive ? '#ff6a6a' : '#ffb648' });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (waveActive) {
      fitText(`Wave ${waveNumber}`, 32, 40, 268, 24, { weight: 'bold', color: '#ff8a7a' });
      const left = enemies.length;
      fitText(`${left} ${left === 1 ? 'enemy' : 'enemies'} remaining`, 32, 68, 268, 17, { color: UI.textDim });
    } else {
      fitText(`Wave ${waveNumber + 1} incoming`, 32, 38, 180, 17, { weight: 'bold', color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(`${Math.ceil(waveTimer)}s`, 300, 38, 80, 24, { weight: 'bold', color: '#ffc870' });
      drawMeter(32, 60, 268, 12, 1 - waveTimer / WAVE_INTERVAL, '#ff9a30');
    }

    drawGadgetHUD();

    // Score and stock (top-right)
    const sx = CANVAS_W - 340;
    drawPanel(sx, 16, 320, 74, { accent: UI.gold });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('SCORE', sx + 16, 38, 90, 14, { weight: 'bold', color: UI.textDim });
    fitText(`[[crate]] ${totalResources()} resources`, sx + 16, 66, 180, 16, { color: UI.textDim });
    ctx.textAlign = 'right';
    fitText(String(score), sx + 304, 42, 200, 30, { weight: 'bold', color: UI.gold });

    // Dome integrity under the dome
    const hpRatio = Math.max(0, domeHP / maxDomeHP);
    const barW = 280, barH = 24;
    const barX = DOME_X - barW / 2, barY = DOME_Y + 22;
    drawMeter(barX, barY, barW, barH, hpRatio, hpRatio > 0.5 ? '#46c862' : (hpRatio > 0.25 ? '#e8b030' : '#e84040'), {
      label: `Dome ${Math.ceil(domeHP)} / ${maxDomeHP}`, labelPx: 16
    });

    drawKeyHints([
      { key: 'Space', label: 'Underground' },
      { key: 'U', label: 'Upgrade tree' },
      { key: 'H', label: 'Help' },
      { key: 'Esc', label: 'Pause' }
    ], CANVAS_W / 2, CANVAS_H - 24, 560);
  }

  function drawGadgetHUD() {
    // Collect the status lines first so the panel can be sized to them
    const rows = [];
    if (primaryGadget === 'shield')
      rows.push({ icon: 'shield', text: 'Shield: ' + (primaryGadgetState.active ? 'ACTIVE' : 'depleted'), color: primaryGadgetState.active ? '#6cc8ff' : UI.textMute });
    else if (primaryGadget === 'repellent') {
      if (primaryGadgetState.active)
        rows.push({ icon: 'portal', text: `Repellent: ${Math.ceil(primaryGadgetState.duration)}s`, color: '#c890ff' });
      else if (primaryGadgetState.cooldown > 0)
        rows.push({ icon: 'portal', text: `Repellent [R]: ${Math.ceil(primaryGadgetState.cooldown)}s`, color: UI.textMute });
      else
        rows.push({ icon: 'portal', text: 'Repellent [R]: READY', color: '#c890ff' });
    } else if (primaryGadget === 'orchard') {
      if (primaryGadgetState.speedBoostTimer > 0)
        rows.push({ icon: 'tree', text: `Mining boost: ${Math.ceil(primaryGadgetState.speedBoostTimer)}s`, color: UI.good });
      else if (primaryGadgetState.fruitReady)
        rows.push({ icon: 'tree', text: 'Fruit ready! Click the tree', color: '#ffe060' });
      else
        rows.push({ icon: 'tree', text: `Orchard: ${Math.ceil(primaryGadgetState.fruitTimer)}s`, color: '#4ac080' });
    } else if (primaryGadget === 'droneyard')
      rows.push({ icon: 'robot', text: `Drone: ${Math.ceil(primaryGadgetState.droneTimer)}s`, color: '#9cc4e8' });

    if (foundGadgets.includes('blastMining') && (primaryGadgetState.blastCharges || 0) > 0)
      rows.push({ icon: 'bomb', text: `Blast [B]: ${primaryGadgetState.blastCharges} charges`, color: '#ffa040' });

    for (const g of foundGadgets) {
      if (g === 'blastMining') continue;
      rows.push({ icon: 'gear', text: MINE_GADGET_NAMES[g] || g, color: '#d0c890' });
    }

    for (const def of GADGET_DEFS) {
      if (!unlockedTools[def.key]) continue;
      const isActive = activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';
      if (def.key === 'blastTool') {
        const cd = toolState.blastToolCooldown > 0;
        rows.push({ icon: def.icon, text: `Blast [2]: ${cd ? Math.ceil(toolState.blastToolCooldown) + 's' : 'READY'}`, color: cd ? UI.textMute : (isActive ? UI.gold : '#ffa040') });
      } else if (def.key === 'teleporter') {
        const cd = toolState.teleporterCooldown > 0;
        rows.push({ icon: def.icon, text: `Teleport [5]: ${cd ? Math.ceil(toolState.teleporterCooldown) + 's' : 'READY'}`, color: cd ? UI.textMute : (isActive ? UI.gold : '#c890ff') });
      } else if (def.key === 'drill') {
        const combo = isActive && toolState.drillConsecutive > 0 ? ` (x${toolState.drillConsecutive} combo)` : '';
        rows.push({ icon: def.icon, text: `Drill [1]${combo}`, color: isActive ? UI.gold : UI.textDim });
      } else if (isPassive)
        rows.push({ icon: def.icon, text: `${def.name} [${def.shortcut}]: ON`, color: UI.good });
    }
    if (!rows.length) return;

    const rowH = 28, pw = 300;
    const maxRows = 10;
    const shown = rows.slice(0, maxRows);
    const ph = 14 + shown.length * rowH;
    const px = 16, py = CANVAS_H - 58 - ph;
    drawPanel(px, py, pw, ph, { accent: '#9a7aff', shadow: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < shown.length; ++i) {
      const r = shown[i];
      const y = py + 7 + i * rowH + rowH / 2;
      drawSprite(r.icon, px + 22, y, 20);
      fitText(r.text, px + 40, y + 1, pw - 52, 17, { weight: 'bold', color: r.color });
    }
  }

  function drawUndergroundGadgets() {
    // Draw gadget chamber tiles
    for (const ch of gadgetChambers) {
      // Check if any tile of this chamber still exists
      let anyLeft = false;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc)
          if (undergroundGrid[ch.r + dr] && undergroundGrid[ch.r + dr][ch.c + dc] === TILE_GADGET)
            anyLeft = true;
      if (!anyLeft) continue;

      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          if (undergroundGrid[ch.r + dr][ch.c + dc] !== TILE_GADGET) continue;
          const x = (ch.c + dc) * TILE_SIZE - cameraX;
          const y = (ch.r + dr) * TILE_SIZE - cameraY;

          if (!ch.revealed) {
            // Hidden: looks like dirt but with faint shimmer
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const shimmer = Math.sin(animTime * 3 + dr + dc) * 0.1 + 0.1;
            ctx.fillStyle = `rgba(255,215,0,${shimmer})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else {
            // Revealed: golden glowing tile with "?" symbol
            const pulse = Math.sin(animTime * 4) * 0.15 + 0.85;
            ctx.fillStyle = `rgba(200,160,0,${0.7 * pulse})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

            // Bevel
            ctx.fillStyle = `rgba(255,240,150,${0.4 * pulse})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 3);
            ctx.fillStyle = `rgba(100,80,0,${0.5 * pulse})`;
            ctx.fillRect(x + 1, y + TILE_SIZE - 4, TILE_SIZE - 2, 3);

            // "?" symbol
            ctx.fillStyle = `rgba(255,255,200,${pulse})`;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + TILE_SIZE / 2, y + TILE_SIZE / 2);

            // Sparkle particles on border
            if (Math.random() < 0.03)
              particles.sparkle(
                x + Math.random() * TILE_SIZE,
                y + Math.random() * TILE_SIZE,
                1,
                { color: '#ffd700', speed: 0.5 }
              );
          }
        }
    }

    // Probe Scanner: highlight resource tiles within 4 tiles of pickup location
    if (foundGadgets.includes('probeScanner') && primaryGadgetState.probeTimer > 0) {
      const fadeAlpha = Math.min(1, primaryGadgetState.probeTimer / 3); // fade out in last 3s
      const probePulse = Math.sin(animTime * 5) * 0.3 + 0.7;
      const pr = primaryGadgetState.probePlayerR || drillY;
      const pc = primaryGadgetState.probePlayerC || drillX;
      const probeR0 = Math.max(0, pr - 4), probeR1 = Math.min(GRID_ROWS, pr + 5);
      const probeC0 = Math.max(0, pc - 4), probeC1 = Math.min(GRID_COLS, pc + 5);
      for (let r = probeR0; r < probeR1; ++r)
        for (let c = probeC0; c < probeC1; ++c) {
          const tile = undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - pr) + Math.abs(c - pc) > 4) continue;
          const x = c * TILE_SIZE - cameraX;
          const y = r * TILE_SIZE - cameraY;
          ctx.strokeStyle = `rgba(255,215,0,${0.6 * probePulse * fadeAlpha})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
    }

    // Scanner gadget (unlockable tool): continuous passive reveal in 3-tile Manhattan radius
    if (toolState.scannerActive) {
      const scanPulse = Math.sin(animTime * 3) * 0.2 + 0.8;
      const scanRange = 3 + (toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      const scanR0 = Math.max(0, drillY - scanRange), scanR1 = Math.min(GRID_ROWS, drillY + scanRange + 1);
      const scanC0 = Math.max(0, drillX - scanRange), scanC1 = Math.min(GRID_COLS, drillX + scanRange + 1);
      for (let r = scanR0; r < scanR1; ++r)
        for (let c = scanC0; c < scanC1; ++c) {
          const tile = undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - drillY) + Math.abs(c - drillX) > scanRange) continue;
          const x = c * TILE_SIZE - cameraX;
          const y = r * TILE_SIZE - cameraY;

          // Semi-transparent resource type indicator
          const tileColor = TILE_HIGHLIGHT_COLORS[tile] || '#fff';
          ctx.strokeStyle = hexToRgba(tileColor, 0.5 * scanPulse);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);

          // Small resource type sprite
          drawSprite(TILE_ICONS[tile], x + TILE_SIZE / 2, y + TILE_SIZE / 2, 20, 0.7 * scanPulse);
        }

      // Scanner radius ring around player
      const playerScreenX = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const playerScreenY = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.save();
      ctx.strokeStyle = `rgba(0,255,200,${0.15 * scanPulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      const scanRingRange = 3 + (toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      ctx.arc(playerScreenX, playerScreenY, (scanRingRange + 0.5) * TILE_SIZE, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /* ======================================================================
     DRAWING -- UPGRADE PANEL
     ====================================================================== */

  function drawUpgradePanel() {
    const px = CANVAS_W - 340;
    const py = 100;
    const pw = 320;
    const toolSectionH = showToolPanel ? 44 + GADGET_DEFS.length * 44 : 36;
    const panelH = 60 + UPGRADE_DEFS.length * 48 + toolSectionH;

    drawPanel(px, py, pw, panelH, { title: 'Upgrades', titleRight: '[U] Full Tree', titleRightColor: UI.gold, headerH: 44 });

    const total = totalResources();
    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const def = UPGRADE_DEFS[i];
      const cost = getUpgradeCost(i);
      const ly = py + 56 + i * 48;
      const canAfford = total >= cost;
      const hover = mouseAimX >= px && mouseAimX <= px + pw && mouseAimY >= ly && mouseAimY < ly + 48;

      roundRectPath(px + 8, ly - 2, pw - 16, 44, 8);
      ctx.fillStyle = canAfford ? (hover ? 'rgba(90,184,255,0.22)' : 'rgba(90,184,255,0.10)') : 'rgba(255,255,255,0.03)';
      ctx.fill();
      if (hover && canAfford) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(140,200,255,0.6)';
        ctx.stroke();
      }

      drawSprite(UPGRADE_ICONS[def.key] || 'gear', px + 32, ly + 20, 26, canAfford ? 1 : 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(def.name, px + 54, ly + 11, 160, 18, { weight: 'bold', color: canAfford ? UI.text : UI.textMute });
      fitText('Level ' + getEffectiveLevel(def.key), px + 54, ly + 30, 160, 14, { color: canAfford ? UI.textDim : UI.textMute });
      drawChip(String(cost), px + pw - 18, ly + 8, 26, {
        align: 'right', maxW: 90, px: 16,
        bg: canAfford ? 'rgba(80,200,110,0.22)' : 'rgba(255,90,90,0.10)',
        border: canAfford ? 'rgba(111,224,138,0.7)' : 'rgba(255,106,106,0.35)',
        color: canAfford ? UI.good : '#b06060'
      });
    }

    // -- Tool/Gadget section --
    const toolY = py + 56 + UPGRADE_DEFS.length * 48 + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 10, toolY - 4, pw - 20, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(px + 10, toolY - 3, pw - 20, 1);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText((showToolPanel ? '▾ ' : '▸ ') + 'Tools', px + 16, toolY + 13, 120, 19, { weight: 'bold', color: UI.gold });
    ctx.textAlign = 'right';
    fitText(showToolPanel ? 'click to collapse' : 'click to expand', px + pw - 16, toolY + 13, 160, 14, { color: UI.textMute });

    if (showToolPanel) {
      for (let i = 0; i < GADGET_DEFS.length; ++i) {
        const def = GADGET_DEFS[i];
        const ly = toolY + 32 + i * 44;
        const isUnlocked = !!unlockedTools[def.key];
        const canAfford = !isUnlocked && resources.iron >= def.costIron && resources.cobalt >= def.costCobalt;
        const isActive = activeToolKey === def.key;
        const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';

        roundRectPath(px + 8, ly - 4, pw - 16, 40, 8);
        if (isUnlocked)
          ctx.fillStyle = isActive ? 'rgba(255,215,90,0.16)' : 'rgba(111,224,138,0.10)';
        else
          ctx.fillStyle = canAfford ? 'rgba(90,184,255,0.10)' : 'rgba(255,255,255,0.03)';
        ctx.fill();
        if (isActive) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = UI.gold;
          ctx.stroke();
        }

        drawChip(def.shortcut, px + 16, ly + 4, 24, { px: 14, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.18)', color: UI.textDim });
        drawSprite(def.icon, px + 58, ly + 16, 24, isUnlocked || canAfford ? 1 : 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let nameColor = canAfford ? UI.text : UI.textMute;
        if (isUnlocked)
          nameColor = isActive ? UI.gold : (isPassive ? UI.good : UI.text);
        if (isUnlocked) {
          const status = isPassive ? 'ON' : (isActive ? 'SEL' : 'OWNED');
          const sw = drawChip(status, px + pw - 18, ly + 4, 24, { align: 'right', px: 13, bg: 'rgba(111,224,138,0.16)', color: isActive ? UI.gold : UI.good });
          fitText(def.name, px + 76, ly + 17, pw - 76 - 26 - sw, 17, { weight: 'bold', color: nameColor });
        } else {
          let costText = `${def.costIron}[[iron]]`;
          if (def.costCobalt > 0)
            costText += ` ${def.costCobalt}[[cobalt]]`;
          const cw = drawChip(costText, px + pw - 18, ly + 4, 24, {
            align: 'right', px: 13, maxW: 120,
            bg: canAfford ? 'rgba(80,200,110,0.22)' : 'rgba(255,90,90,0.10)',
            color: canAfford ? UI.good : '#b06060'
          });
          fitText(def.name, px + 76, ly + 17, pw - 76 - 26 - cw, 17, { weight: 'bold', color: nameColor });
        }
      }
    }
  }


  /* ======================================================================
     DRAWING -- HUD
     ====================================================================== */

  function drawHUD() {
    const pulse = Math.sin(animTime * 3) * 0.5 + 0.5;
    const hoverIn = (b) => mouseAimX >= b.x && mouseAimX <= b.x + b.w && mouseAimY >= b.y && mouseAimY <= b.y + b.h;

    if (state === STATE_READY) {
      drawScrim(0.5);
      drawPanel(CANVAS_W / 2 - 380, 190, 760, 600, { accent: UI.accent, radius: 16 });
      drawHeadline('DOME KEEPER', CANVAS_W / 2, 290, 680, 88, '#7cc8ff', '#2a7ae0');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Defend your dome. Mine resources. Upgrade.', CANVAS_W / 2, 370, 660, 26, { color: UI.textDim });
      const best = highScores[0];
      if (best)
        fitText(`Best run: ${best.score} points  ·  wave ${best.waves}`, CANVAS_W / 2, 420, 660, 18, { color: UI.gold });
      ctx.fillStyle = 'rgba(120,180,255,0.25)';
      ctx.fillRect(CANVAS_W / 2 - 220, 450, 440, 1);

      if (saveAvailable) {
        for (const b of getTitleButtons())
          drawButton(b, b.id === 'continue', hoverIn(b));
        drawKeyHints([{ key: 'Enter', label: 'Continue' }, { key: 'F2', label: 'New game' }, { key: 'H', label: 'How to play' }], CANVAS_W / 2, 700, 640);
      } else {
        const b = getTitleButtons()[0];
        ctx.save();
        ctx.globalAlpha = 0.75 + pulse * 0.25;
        drawButton({ x: b.x, y: b.y, w: b.w, h: b.h, label: 'Start' }, true, hoverIn(b));
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText('Click anywhere or press F2 to start', CANVAS_W / 2, 620, 600, 20, { color: UI.textDim });
        drawKeyHints([{ key: 'F2', label: 'Start' }, { key: 'H', label: 'How to play' }], CANVAS_W / 2, 700, 640);
      }
      if (saveNotice)
        drawTextBlock(saveNotice, CANVAS_W / 2 - 340, 730, 680, 48, 18, { align: 'center', color: UI.warn });
    }

    if (state === STATE_GADGET_SELECT) {
      drawScrim(0.72);
      drawHeadline('Choose Your Gadget', CANVAS_W / 2, 200, 1000, 56, '#ffe080', '#e0a020');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Your dome keeps this ability for the whole run', CANVAS_W / 2, 262, 900, 22, { color: UI.textDim });

      const cardW = 280;
      const cardH = 320;
      const gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const g = PRIMARY_GADGETS[i];
        const cx = startX + i * (cardW + gap);
        const isHover = gadgetSelectHover === i;
        const lift = isHover ? -6 : 0;

        drawPanel(cx, cardY + lift, cardW, cardH, {
          accent: isHover ? UI.gold : '#6a8ac8', glow: isHover, radius: 14,
          top: isHover ? 'rgba(40,56,92,0.96)' : UI.panelTop
        });

        // Icon well
        const wx = cx + cardW / 2, wy = cardY + lift + 82;
        ctx.save();
        const wg = ctx.createRadialGradient(wx, wy - 10, 4, wx, wy, 58);
        wg.addColorStop(0, isHover ? 'rgba(255,220,120,0.35)' : 'rgba(120,170,255,0.22)');
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(wx, wy, 58, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
        drawSprite(g.icon, wx, wy, 76);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(g.name, cx + cardW / 2, cardY + lift + 160, cardW - 30, 24, { weight: 'bold', color: isHover ? UI.gold : UI.text });
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx + 30, cardY + lift + 184, cardW - 60, 1);
        drawTextBlock(g.desc.join(' '), cx + 20, cardY + lift + 196, cardW - 40, 84, 18, { align: 'center', valign: 'middle', color: UI.textDim });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(isHover ? 'Click to select' : 'Gadget ' + (i + 1), cx + cardW / 2, cardY + lift + cardH - 24, cardW - 40, 17, { weight: 'bold', color: isHover ? UI.gold : UI.textMute });
      }
    }

    if (state === STATE_PAUSED) {
      drawScrim(0.45);
      const pw = 520, ph = 250, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
      drawPanel(px, py, pw, ph, { accent: UI.gold, radius: 16 });
      drawHeadline('PAUSED', CANVAS_W / 2, py + 78, pw - 60, 64, '#ffe070', '#e0a010');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Your run is saved', CANVAS_W / 2, py + 140, pw - 60, 20, { color: UI.textDim });
      drawKeyHints([{ key: 'Esc', label: 'Resume' }, { key: 'H', label: 'Help' }, { key: 'F2', label: 'New game' }], CANVAS_W / 2, py + 200, pw - 60);
    }

    if (state === STATE_GAME_OVER) {
      drawScrim(0.6);
      ctx.fillStyle = 'rgba(120,0,0,0.12)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const pw = 640, ph = 400, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
      drawPanel(px, py, pw, ph, { accent: '#ff5050', radius: 16 });
      drawHeadline('DOME DESTROYED', CANVAS_W / 2, py + 78, pw - 60, 60, '#ff7a6a', '#c01818');

      const best = highScores[0];
      const stats = [
        ['Waves survived', String(waveNumber)],
        ['Score', String(score)],
        ['Best score', best ? String(best.score) : String(score)]
      ];
      for (let i = 0; i < stats.length; ++i) {
        const ry = py + 146 + i * 46;
        roundRectPath(px + 60, ry, pw - 120, 38, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        fitText(stats[i][0], px + 80, ry + 20, 260, 20, { color: UI.textDim });
        ctx.textAlign = 'right';
        fitText(stats[i][1], px + pw - 80, ry + 20, 220, 24, { weight: 'bold', color: i === 1 ? UI.gold : UI.text });
      }
      if (best && score > 0 && best.score === score && best.waves === waveNumber)
        drawChip('New high score!', CANVAS_W / 2 - 90, py + 290, 30, { px: 17, maxW: 180, bg: 'rgba(255,215,90,0.18)', border: UI.gold, color: UI.gold });

      ctx.save();
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Click or press F2 to play again', CANVAS_W / 2, py + ph - 40, pw - 60, 22, { weight: 'bold', color: UI.text });
      ctx.restore();
    }
  }

  /* ======================================================================
     DRAWING -- MAIN
     ====================================================================== */

  function drawGame() {
    const alpha = getTransitionAlpha();
    ctx.globalAlpha = alpha;

    if (currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;

    // Transition overlay (black fade)
    if (alpha < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    drawHUD();

    if (state === STATE_UPGRADE_DIALOG)
      drawUpgradeDialog();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    drawScrim(0.68);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const pw = 880, ph = 540, px = CANVAS_W / 2 - pw / 2, py = (CANVAS_H - ph) / 2;
    drawPanel(px, py, pw, ph, {
      accent: '#ffb030', radius: 16, title: page.title, titlePx: 28, headerH: 64,
      titleRight: 'Page ' + (tutorialPage + 1) + ' of ' + TUTORIAL_PAGES.length,
      top: 'rgba(24,30,50,0.99)', bottom: 'rgba(10,13,24,0.99)'
    });

    // Page icon and intro paragraph
    const bodyX = px + 44, bodyW = pw - 88;
    ctx.save();
    const ig = ctx.createRadialGradient(bodyX + 40, py + 132, 4, bodyX + 40, py + 132, 52);
    ig.addColorStop(0, 'rgba(255,176,48,0.3)');
    ig.addColorStop(1, 'rgba(255,176,48,0)');
    ctx.fillStyle = ig;
    ctx.fillRect(bodyX - 12, py + 80, 104, 104);
    ctx.restore();
    drawSprite(page.icon, bodyX + 40, py + 132, 64);
    drawTextBlock(page.intro, bodyX + 104, py + 88, bodyW - 104, 88, 23, { valign: 'middle', color: UI.text, minPx: 15 });
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(bodyX, py + 190, bodyW, 1);

    // Key / action rows
    const rowsTop = py + 202, rowsBottom = py + ph - 100;
    const rowH = Math.min(48, (rowsBottom - rowsTop) / Math.max(1, page.items.length));
    ctx.font = uiFont(15, 'bold');
    let keyColW = 0;
    for (const it of page.items)
      if (it[0])
        keyColW = Math.max(keyColW, ctx.measureText(it[0]).width + 22);
    keyColW = Math.min(180, keyColW + 32);
    for (let i = 0; i < page.items.length; ++i) {
      const [key, text] = page.items[i];
      const ry = rowsTop + i * rowH;
      if (i % 2 === 0) {
        roundRectPath(bodyX, ry + 2, bodyW, rowH - 4, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
      }
      if (key)
        drawChip(key, bodyX + 12, ry + (rowH - 28) / 2, 28, { px: 15, maxW: keyColW - 24, bg: 'rgba(20,26,42,0.95)', border: 'rgba(170,190,230,0.4)', color: '#e8eefa' });
      else {
        ctx.fillStyle = '#ffb030';
        ctx.beginPath();
        ctx.arc(bodyX + 24, ry + rowH / 2, 5, 0, TWO_PI);
        ctx.fill();
      }
      const tx = key ? bodyX + keyColW : bodyX + 44;
      drawTextBlock(text, tx, ry + 2, bodyX + bodyW - 12 - tx, rowH - 4, 21, { valign: 'middle', color: '#cdd6e8', minPx: 13 });
    }

    // Page dots
    const dotsY = py + ph - 78;
    for (let i = 0; i < TUTORIAL_PAGES.length; ++i) {
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2 + (i - (TUTORIAL_PAGES.length - 1) / 2) * 22, dotsY, i === tutorialPage ? 6 : 4, 0, TWO_PI);
      ctx.fillStyle = i === tutorialPage ? '#ffb030' : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
    const last = tutorialPage >= TUTORIAL_PAGES.length - 1;
    drawKeyHints(last
      ? [{ key: 'Click', label: 'Start playing' }, { key: 'H', label: 'Help anytime' }]
      : [{ key: 'Click', label: 'Next' }, { key: '→', label: 'Next' }, { key: '←', label: 'Back' }, { key: 'Esc', label: 'Close' }],
    CANVAS_W / 2, py + ph - 36, pw - 80);
  }

  /* ======================================================================
     TOOLTIP SYSTEM
     ====================================================================== */

  function updateTooltipHover(dt) {
    if (!tooltip.visible && tooltip.lines.length > 0) {
      tooltip.delayTimer += dt;
      if (tooltip.delayTimer >= TOOLTIP_DELAY)
        tooltip.visible = true;
    }
  }

  function clearTooltip() {
    tooltip.lines = [];
    tooltip.visible = false;
    tooltip.delayTimer = 0;
    tooltip.anchor = null;
    tooltip.lastHoverKey = '';
  }

  function setTooltip(x, y, lines, hoverKey, anchor) {
    if (hoverKey !== tooltip.lastHoverKey) {
      tooltip.delayTimer = 0;
      tooltip.visible = false;
      tooltip.lastHoverKey = hoverKey;
    }
    tooltip.lines = lines;
    tooltip.x = x;
    tooltip.y = y;
    tooltip.anchor = anchor || null;
  }

  function drawTooltip() {
    if (!tooltip.visible || tooltip.lines.length === 0) return;
    if (state !== STATE_PLAYING && state !== STATE_UPGRADE_DIALOG) return;

    const padding = 14;
    const maxTextW = 440;
    let fontSize = 18;
    let rows, boxW, boxH;
    // Lay out (wrapping long lines); shrink if the box would not fit the screen
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < tooltip.lines.length; ++i) {
        const line = tooltip.lines[i];
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 8 });
          continue;
        }
        ctx.font = uiFont(i === 0 ? fontSize + 2 : fontSize, i === 0 ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: i === 0 ? 'title' : 'text', text: w, h: (i === 0 ? fontSize + 2 : fontSize) * 1.4, src: line });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + padding * 2;
      boxH = padding * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= CANVAS_H - 16 || fontSize <= 12)
        break;
      --fontSize;
    }
    boxW = Math.max(boxW, 160);

    // Place next to the anchor (keyboard focus) or the cursor, always inside the canvas
    let bx, by;
    const a = tooltip.anchor;
    if (a) {
      bx = a.x + a.w + 12;
      if (bx + boxW > CANVAS_W - 8) bx = a.x - boxW - 12;
      by = a.y;
    } else {
      bx = tooltip.x + 24;
      by = tooltip.y + 24;
      if (bx + boxW > CANVAS_W - 8) bx = tooltip.x - boxW - 12;
      if (by + boxH > CANVAS_H - 8) by = tooltip.y - boxH - 12;
    }
    bx = Math.max(8, Math.min(CANVAS_W - 8 - boxW, bx));
    by = Math.max(8, Math.min(CANVAS_H - 8 - boxH, by));

    ctx.save();
    drawPanel(bx, by, boxW, boxH, { accent: UI.gold, radius: 10, shadow: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + padding;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(11, fontSize - 5), 'bold');
        ctx.fillStyle = UI.textMute;
        ctx.fillText(r.text, bx + padding, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx + padding + tw + 8, cy, boxW - padding * 2 - tw - 8, 1);
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = UI.text;
        if (!title) {
          if (r.src.startsWith('✔')) color = UI.good;
          else if (r.src.startsWith('✘')) color = UI.bad;
          else if (r.src.startsWith('⚠')) color = UI.warn;
          else color = '#c4cde0';
        } else
          color = '#ffffff';
        ctx.fillStyle = color;
        fillIconText(r.text, bx + padding, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  // Build tooltip content for an underground tile
  function buildTileTooltip(col, row) {
    const tile = undergroundGrid[row][col];
    if (tile === TILE_EMPTY) return null;

    const lines = [];
    const displayName = TILE_DISPLAY_NAMES[tile] || 'Unknown';
    const depthTier = DEPTH_TIERS[getDepthTier(row)];
    const depthMult = getDepthMineMultiplier(row);

    if (tile === TILE_DIRT) {
      lines.push(depthTier.name);
      lines.push('Depth tier: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else if (tile === TILE_GADGET) {
      lines.push('Gadget Chamber');
      const chamber = gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === row && ch.c + dc === col) return true;
        return false;
      });
      if (chamber && chamber.revealed)
        lines.push('Mine to discover a gadget');
      else
        lines.push('Hidden - mine nearby to reveal');
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else {
      const icon = TILE_ICONS[tile] || '';
      lines.push((icon ? '[[' + icon + ']] ' : '') + displayName);
      if (TILE_VALUES[tile])
        lines.push('Value: ' + TILE_VALUES[tile] + ' resources');
      lines.push('Depth: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    }

    // Partial mining status
    if (tileHP[row] && tileMaxHP[row] && tileMaxHP[row][col] > 0) {
      const hpRatio = tileHP[row][col] / tileMaxHP[row][col];
      if (hpRatio < 0.99) {
        const pct = Math.round(hpRatio * 100);
        lines.push('Remaining: ' + pct + '%');
      }
    }

    return lines;
  }

  // Build tooltip content for an enemy
  function buildEnemyTooltip(e) {
    const lines = [];
    let typeName;
    if (e.boss)
      typeName = 'Boss';
    else if (e.type === 'flyer')
      typeName = 'Flyer';
    else
      typeName = 'Walker';

    lines.push(typeName + (e.armored ? ' (Armored)' : ''));
    lines.push('HP: ' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxHP));
    if (e.shield > 0)
      lines.push('Shield: ' + Math.ceil(e.shield) + ' / ' + Math.ceil(e.maxShield));
    else if (e.maxShield > 0)
      lines.push('\u2718 Shield broken');
    if (e.armored)
      lines.push('\u26A0 Armored: 2x HP, 0.75x speed');
    lines.push('Damage: ' + e.damage + ' per hit');
    if (e.stunTimer > 0)
      lines.push('\u26A0 Stunned: ' + e.stunTimer.toFixed(1) + 's');

    return lines;
  }

  // Build tooltip content for an upgrade tree node
  function buildUpgradeNodeTooltip(node) {
    const lines = [];
    const lvl = getTreeNodeLevel(node.id);
    const maxed = lvl >= node.maxLevel;

    const info = getTreeNodeInfo(node);
    lines.push('[[' + node.icon + ']] ' + info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : ''));

    // Effect description
    const effectDesc = UPGRADE_EFFECT_DESC[node.upgradeKey];
    if (effectDesc)
      lines.push(effectDesc);

    // Type
    lines.push('Type: ' + (node.type === 'gadget' ? 'Gadget (unlock)' : 'Stat upgrade'));

    // Level
    if (info.chain.length > 1)
      lines.push('Tier ' + (info.index + 1) + ' of ' + info.chain.length);
    if (maxed)
      lines.push('\u2714 Purchased');

    // Cost
    if (!maxed) {
      const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
      const COST_NAMES = {
        iron: 'Iron', water: 'Water', cobalt: 'Cobalt', copper: 'Copper',
        tin: 'Tin', coal: 'Coal', lead: 'Lead', silver: 'Silver',
        gold: 'Gold', quartz: 'Quartz', redstone: 'Redstone',
        emerald: 'Emerald', diamond: 'Diamond', ruby: 'Ruby'
      };
      let costParts = [];
      for (const key in cost)
        if ((cost[key] || 0) > 0) {
          const have = resources[key] || 0;
          const need = cost[key];
          const mark = have >= need ? '\u2714' : '\u2718';
          const ico = SPRITES[key] ? '[[' + key + ']] ' : '';
          costParts.push(mark + ' ' + ico + (COST_NAMES[key] || key) + ': ' + have + '/' + need);
        }
      if (costParts.length > 0) {
        lines.push('--- Cost ---');
        for (const cp of costParts)
          lines.push(cp);
      }
    }

    // Prerequisites
    if (node.prereqs.length > 0) {
      const unmet = [];
      for (const pid of node.prereqs) {
        if (!isTreeNodeMaxed(pid)) {
          const prereqNode = UPGRADE_TREE.find(n => n.id === pid);
          if (prereqNode)
            unmet.push('\u2718 ' + prereqNode.name);
        }
      }
      if (unmet.length > 0) {
        lines.push('--- Prerequisites ---');
        for (const u of unmet)
          lines.push(u);
      }
    }

    if (!maxed && arePrereqsMet(node))
      lines.push(canAffordTreeNode(node) ? '\u2714 Click or press Enter to buy' : '\u26A0 Not enough resources');

    return lines;
  }

  /* ======================================================================
     STATUS BAR
     ====================================================================== */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${currentView}`;
    if (statusWave) statusWave.textContent = `Wave: ${waveNumber}`;
    if (statusDome) statusDome.textContent = `Dome: ${Math.ceil(domeHP)}/${maxDomeHP}`;
    if (statusResources) {
      let resParts = [];
      for (const entry of RESOURCE_HUD_ENTRIES)
        if (resources[entry.key] > 0)
          resParts.push(`${entry.label}:${resources[entry.key]}`);
      statusResources.textContent = resParts.join(' ') || 'Fe:0 H2O:0 Co:0';
    }
  }

  /* ======================================================================
     GAME LOOP
     ====================================================================== */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    // Always update animations (even on title/pause/game-over for visual polish)
    animTime += state !== STATE_PLAYING ? dt : 0;
    updateGame(dt);
    updateTooltipHover(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    // Draw tooltip outside screen shake so it stays stable
    drawTooltip();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ======================================================================
     INPUT
     ====================================================================== */

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: () => {
      state = STATE_PAUSED;
      saveRun();
    }
  });

  /* Keep the run when the page goes away or is hidden */
  window.addEventListener('pagehide', () => saveRun());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveRun();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (newGameConfirmOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        SZ.Dialog.close('dlg-new-game');
      }
      return;
    }

    if (e.code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    /* Tutorial navigation */
    if (showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++tutorialPage;
        if (tutorialPage >= TUTORIAL_PAGES.length)
          showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && tutorialPage > 0) {
        e.preventDefault();
        --tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY || state === STATE_GADGET_SELECT) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (state === STATE_PLAYING) {
        state = STATE_PAUSED;
        saveRun();
      } else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    // Title screen with a saved run: Enter/C continues, N starts over
    if (state === STATE_READY && saveAvailable) {
      if (e.code === 'Enter' || e.code === 'KeyC') {
        e.preventDefault();
        continueRun();
        return;
      }
      if (e.code === 'KeyN') {
        requestNewGame();
        return;
      }
    }

    // U key: open/close upgrade dialog
    if (e.code === 'KeyU') {
      if (state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (state === STATE_PLAYING && currentView === VIEW_SURFACE) {
        openUpgradeDialog();
        return;
      }
    }

    if (state === STATE_UPGRADE_DIALOG) {
      // Tree navigation; other keys are blocked while the dialog is open
      if (handleUpgradeDialogKey(e))
        e.preventDefault();
      return;
    }
    if (state !== STATE_PLAYING) return;

    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
      toggleView();
    }

    if (currentView === VIEW_UNDERGROUND) {
      let newDx = 0, newDy = 0;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { newDx = 0; newDy = -1; }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { newDx = 0; newDy = 1; }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { newDx = -1; newDy = 0; }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { newDx = 1; newDy = 0; }

      if (newDx !== 0 || newDy !== 0) {
        // Cancel mining if direction changed
        if (miningTarget && miningDir && (miningDir.dx !== newDx || miningDir.dy !== newDy))
          cancelMining();
        clearMoveTarget();
        tryMine(newDx, newDy);
      }
    }

    // Repellent field activation
    if (e.code === 'KeyR' && primaryGadget === 'repellent') {
      if (!primaryGadgetState.active && primaryGadgetState.cooldown <= 0) {
        primaryGadgetState.active = true;
        primaryGadgetState.duration = 5;
        SZ.GameAudio.play('zap', { pitch: 0.5 });
        floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Repellent Field!', { color: '#a0f', font: 'bold 28px sans-serif' });
        particles.burst(DOME_X, DOME_Y, 20, { color: '#a0f', speed: 3, life: 0.5 });
      }
    }

    // Blast mining activation
    if (e.code === 'KeyB')
      useBlastMining();

    // Tool/Gadget shortcuts (1-5)
    if (e.code === 'Digit1' || e.key === '1') {
      if (unlockedTools.drill)
        selectTool('drill');
    }
    if (e.code === 'Digit2' || e.key === '2') {
      if (unlockedTools.blastTool)
        useBlastTool();
    }
    if (e.code === 'Digit3' || e.key === '3') {
      if (unlockedTools.scanner)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Scanner active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit4' || e.key === '4') {
      if (unlockedTools.reinforcedDome)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Reinforced Dome active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit5' || e.key === '5') {
      if (unlockedTools.teleporter)
        useTeleporter();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* -- Click/Tap handling -- */
  canvas.addEventListener('pointerdown', (e) => {
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (newGameConfirmOpen)
      return;
    if (state === STATE_READY && saveAvailable) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTitleButton((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
      if (hit === 'continue')
        continueRun();
      else if (hit === 'new')
        requestNewGame();
      return;
    }
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      startNewRun();
      return;
    }

    // Upgrade dialog click (left-click only; right-click is pan)
    if (state === STATE_UPGRADE_DIALOG) {
      if (e.button === 2) return; // right-click handled by pan listener
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (!handleUpgradeDialogClick(mx, my))
        startTreePan(e, mx, my); // drag on empty space pans the tree
      return;
    }

    // Gadget selection screen click
    if (state === STATE_GADGET_SELECT) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (mx >= cx && mx <= cx + cardW && my >= cardY && my <= cardY + cardH) {
          primaryGadget = PRIMARY_GADGETS[i].key;
          startGameAfterGadgetSelect();
          return;
        }
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mx + cameraX) / TILE_SIZE);
      const row = Math.floor((my + cameraY) / TILE_SIZE);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const ddx = col - drillX;
        const ddy = row - drillY;
        if (ddx === 0 && ddy === 0) {
          toggleView();
        } else if (undergroundGrid[row][col] === TILE_EMPTY) {
          // Click on empty tile: move there via pathfinding
          const path = findPath(drillX, drillY, col, row);
          if (path && path.length > 0) {
            clearMoveTarget();
            moveTarget = { col, row };
            movePath = path;
            movePathIndex = 0;
            moveStepTimer = 0;
            mineTarget = null;
          }
        } else if (Math.abs(ddx) + Math.abs(ddy) === 1) {
          // Adjacent non-empty tile: mine directly
          clearMoveTarget();
          tryMine(ddx, ddy);
        } else {
          // Non-adjacent non-empty tile: pathfind to adjacent empty, then queue mine
          const result = findAdjacentEmptyNear(col, row);
          if (result) {
            clearMoveTarget();
            moveTarget = { col: result.adj.col, row: result.adj.row };
            movePath = result.path;
            movePathIndex = 0;
            moveStepTimer = 0;
            mineTarget = { col: col, row: row, dx: result.adj.dx, dy: result.adj.dy };
          }
        }
      }
    } else {
      // Orchard: clicking near the dome tree when fruit is ready
      if (primaryGadget === 'orchard' && primaryGadgetState.fruitReady) {
        const treeX = DOME_X - 60, treeY = DOME_Y - 30;
        if (Math.abs(mx - treeX) < 40 && Math.abs(my - treeY) < 50) {
          primaryGadgetState.fruitReady = false;
          primaryGadgetState.fruitTimer = 20;
          primaryGadgetState.speedBoostTimer = 10;
          SZ.GameAudio.play('pickup', { pitch: 1.2 });
          floatingText.add(treeX, treeY - 40, '+30% Mining Speed!', { color: '#0f0', font: 'bold 24px sans-serif' });
          particles.sparkle(treeX, treeY - 15, 8, { color: '#ff0', speed: 2 });
          return;
        }
      }

      // Surface view: check upgrade panel first, then fire weapon
      const px = CANVAS_W - 340;
      const py = 100;
      if (mx >= px && mx <= px + 320) {
        // Check upgrade rows
        for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
          const ly = py + 56 + i * 48;
          if (my >= ly && my <= ly + 48) {
            applyUpgrade(i);
            return;
          }
        }

        // Check tool section header (toggle expand/collapse)
        const toolHeaderY = py + 56 + UPGRADE_DEFS.length * 48 + 8;
        if (my >= toolHeaderY - 8 && my <= toolHeaderY + 28) {
          showToolPanel = !showToolPanel;
          return;
        }

        // Check tool rows (when panel is expanded)
        if (showToolPanel) {
          for (let i = 0; i < GADGET_DEFS.length; ++i) {
            const ly = toolHeaderY + 32 + i * 44;
            if (my >= ly - 4 && my <= ly + 40) {
              const def = GADGET_DEFS[i];
              if (unlockedTools[def.key]) {
                // Already unlocked -- select/activate it
                if (def.key === 'blastTool')
                  useBlastTool();
                else if (def.key === 'teleporter')
                  useTeleporter();
                else
                  selectTool(def.key);
              } else
                unlockTool(i);
              return;
            }
          }
        }
      }
      // Fire weapon toward current turret aim direction
      fireRequested = true;
    }
  });

  /* -- Scroll/zoom for upgrade dialog -- */
  canvas.addEventListener('wheel', (e) => {
    if (state === STATE_UPGRADE_DIALOG) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * CANVAS_W / rect.width;
      const my = (e.clientY - rect.top) * CANVAS_H / rect.height;
      zoomTreeAt(mx, my, e.deltaY > 0 ? 1 / 1.15 : 1.15);
      upgradeViewCustomized = true;
    }
  }, { passive: false });

  /* -- Right-click pan for upgrade dialog -- */
  canvas.addEventListener('contextmenu', (e) => {
    if (state === STATE_UPGRADE_DIALOG)
      e.preventDefault();
  });

  function startTreePan(e, mx, my) {
    upgradePanning = true;
    upgradePanStartX = mx;
    upgradePanStartY = my;
    upgradePanBaseX = upgradePanX;
    upgradePanBaseY = upgradePanY;
    treeCam.tz = upgradeZoom;
    upgradeViewCustomized = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state === STATE_UPGRADE_DIALOG && e.button === 2) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      startTreePan(e, (e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (upgradePanning && (e.button === 0 || e.button === 2)) {
      upgradePanning = false;
      treeCam.tx = upgradePanX;
      treeCam.ty = upgradePanY;
      treeCam.tz = upgradeZoom;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  });

  /* -- Continuous mouse tracking for turret aim + gadget selection hover + tooltips -- */
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    mouseAimX = (e.clientX - rect.left) * scaleX;
    mouseAimY = (e.clientY - rect.top) * scaleY;

    // Right-click drag panning in upgrade dialog
    if (upgradePanning && state === STATE_UPGRADE_DIALOG) {
      upgradePanX = treeCam.tx = upgradePanBaseX + (mouseAimX - upgradePanStartX);
      upgradePanY = treeCam.ty = upgradePanBaseY + (mouseAimY - upgradePanStartY);
      upgradeZoom = treeCam.tz;
      clearTooltip();
      return;
    }

    // Track hover on upgrade dialog + tooltip
    if (state === STATE_UPGRADE_DIALOG) {
      handleUpgradeDialogHover(mouseAimX, mouseAimY);
      // Build tooltip for hovered upgrade node
      if (upgradeDialogHover) {
        const node = UPGRADE_TREE.find(n => n.id === upgradeDialogHover);
        if (node) {
          const ttLines = buildUpgradeNodeTooltip(node);
          setTooltip(mouseAimX, mouseAimY, ttLines, 'node:' + node.id);
        } else
          clearTooltip();
      } else
        clearTooltip();
      return;
    }

    // Track hover on gadget selection screen
    if (state === STATE_GADGET_SELECT) {
      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;
      gadgetSelectHover = -1;
      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (mouseAimX >= cx && mouseAimX <= cx + cardW && mouseAimY >= cardY && mouseAimY <= cardY + cardH) {
          gadgetSelectHover = i;
          break;
        }
      }
      clearTooltip();
      return;
    }

    // Tooltip detection for playing state
    if (state === STATE_PLAYING) {
      if (currentView === VIEW_UNDERGROUND) {
        // Underground: detect tile under mouse
        const col = Math.floor((mouseAimX + cameraX) / TILE_SIZE);
        const row = Math.floor((mouseAimY + cameraY) / TILE_SIZE);
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && undergroundGrid[row][col] !== TILE_EMPTY) {
          const ttLines = buildTileTooltip(col, row);
          if (ttLines)
            setTooltip(mouseAimX, mouseAimY, ttLines, 'tile:' + col + ',' + row);
          else
            clearTooltip();
        } else
          clearTooltip();
      } else if (currentView === VIEW_SURFACE) {
        // Surface: detect enemy under mouse
        let foundEnemy = false;
        for (const e of enemies) {
          const sz = e.size || 10;
          const dx = mouseAimX - e.x;
          const dy = mouseAimY - e.y;
          if (dx * dx + dy * dy < (sz + 8) * (sz + 8)) {
            const ttLines = buildEnemyTooltip(e);
            // Use enemy position as identity since enemies don't have IDs
            setTooltip(mouseAimX, mouseAimY, ttLines, 'enemy:' + Math.round(e.x) + ',' + Math.round(e.y));
            foundEnemy = true;
            break;
          }
        }
        if (!foundEnemy)
          clearTooltip();
      } else
        clearTooltip();
    } else
      clearTooltip();
  });

  /* ======================================================================
     MENU ACTIONS
     ====================================================================== */

  function handleAction(action) {
    switch (action) {
      case 'new':
        requestNewGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING) {
          state = STATE_PAUSED;
          saveRun();
        } else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
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
        showTutorial = true;
        tutorialPage = 0;
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

  /* ======================================================================
     OS INTEGRATION
     ====================================================================== */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Dome Keeper -- Game Over -- Wave ${waveNumber}`
      : `Dome Keeper -- Wave ${waveNumber} -- Score ${score}`;
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
  if (typeof ResizeObserver === 'function' && canvas.parentElement)
    new ResizeObserver(handleResize).observe(canvas.parentElement);

  /* ======================================================================
     INIT
     ====================================================================== */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  {
    const muteBtn = SZ.GameAudio.attachMuteButton(document.querySelector('.status-bar'));
    muteBtn.style.position = 'static';
    muteBtn.style.margin = '0 0 0 auto';
    muteBtn.style.width = muteBtn.style.height = '18px';
    muteBtn.style.font = '11px/16px sans-serif';
  }

  setupCanvas();
  loadHighScores();
  saveAvailable = !!readSavedRun();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  updateWindowTitle();

  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
