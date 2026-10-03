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
  const STATE_CINEMATIC = 'CINEMATIC';       // landing / relocation sequence
  const STATE_CONFIRM = 'CONFIRM';           // relocation confirmation
  const STATE_CRAFT = 'CRAFT';               // bomb workshop
  const STATE_MINIGAME = 'MINIGAME';         // opening a secret chest

  /* -- Storage -- */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* -- Underground Grid -- */
  const STRATUM_ROWS = 14;                 // rows per rock layer
  const STRATUM_COUNT = 16;
  const GRID_COLS = 165;                   // every layer spans the full width
  const GRID_ROWS = STRATUM_ROWS * STRATUM_COUNT;
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
  // Deep ores: one signature ore for each of the six deepest strata
  const TILE_TITANIUM = 17;
  const TILE_SAPPHIRE = 18;
  const TILE_URANIUM = 19;
  const TILE_AMETHYST = 20;
  const TILE_OPAL = 21;
  const TILE_VOIDSTONE = 22;
  const TILE_CORE = 23;          // the site's Relocation Core, hidden in the lower strata
  const TILE_CHEST = 24;         // one of the site's three secret chests
  const TILE_MAX = TILE_CHEST;

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
    [TILE_RUBY]: '#e0115f',
    [TILE_TITANIUM]: '#8aa0bc',
    [TILE_SAPPHIRE]: '#2a64e0',
    [TILE_URANIUM]: '#58d030',
    [TILE_AMETHYST]: '#9a4ad8',
    [TILE_OPAL]: '#ff9a40',
    [TILE_VOIDSTONE]: '#5a3aa0'
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
    [TILE_RUBY]: '#ff4488',
    [TILE_TITANIUM]: '#c8dcf4',
    [TILE_SAPPHIRE]: '#6aa0ff',
    [TILE_URANIUM]: '#9aff5a',
    [TILE_AMETHYST]: '#d090ff',
    [TILE_OPAL]: '#ffd080',
    [TILE_VOIDSTONE]: '#b48aff'
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
    [TILE_RUBY]: 70,
    [TILE_TITANIUM]: 90,
    [TILE_SAPPHIRE]: 110,
    [TILE_URANIUM]: 130,
    [TILE_AMETHYST]: 150,
    [TILE_OPAL]: 180,
    [TILE_VOIDSTONE]: 220
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
    [TILE_RUBY]: 'ruby',
    [TILE_TITANIUM]: 'titanium',
    [TILE_SAPPHIRE]: 'sapphire',
    [TILE_URANIUM]: 'uranium',
    [TILE_AMETHYST]: 'amethyst',
    [TILE_OPAL]: 'opal',
    [TILE_VOIDSTONE]: 'voidstone'
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
    [TILE_RUBY]: 'ruby',
    [TILE_TITANIUM]: 'titanium',
    [TILE_SAPPHIRE]: 'sapphire',
    [TILE_URANIUM]: 'uranium',
    [TILE_AMETHYST]: 'amethyst',
    [TILE_OPAL]: 'opal',
    [TILE_VOIDSTONE]: 'voidstone'
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
    fire:   ['#7a1a08', '#d04010', '#ff8a20', '#ffd040', '#fff8c0'],
    titan:  ['#2a3442', '#4a5a70', '#7a90b0', '#b0c4dc', '#eef6ff'],
    sapph:  ['#0a1a5a', '#1438a0', '#2a64e0', '#6aa0ff', '#d0e4ff'],
    uran:   ['#0e3a08', '#1e7a10', '#40c020', '#90ff50', '#e8ffc0'],
    purple: ['#2a0a4a', '#5a1a8a', '#8a3ac8', '#c080f0', '#f0d8ff'],
    opal:   ['#6a2a10', '#c05a20', '#ff9a40', '#ffd080', '#fff4e0'],
    void:   ['#0a0418', '#24104a', '#4a2a8a', '#9a6aff', '#f0e0ff']
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
    titanium: { ramps: ['titan', 'cyan'], px: [
      '............', '...3....4...', '..343..454..', '..3443.444..',
      '.34443.3443.', '.344432344d.', '.3444323443.', '23443323343.',
      '2333322333..', '.222222222..', '............', '............'] },
    sapphire: { ramps: ['sapph'], px: [
      '............', '....3333....', '..33455433..', '.3455544443.',
      '.3455444443.', '334444444433', '.3444444433.', '.2344443332.',
      '..23333322..', '...222222...', '............', '............'] },
    uranium: { ramps: ['uran', 'steel'], px: [
      '............', '.ccc..ccc...', '.c4c..c4c.cc', '.c5c..c5c.c4',
      '.c4c..c4c.c5', '.c4c..c4c.c4', '.c4c..c4c.c4', '.c3c..c3c.c3',
      '.ccc..ccc.cc', '..23444432..', '...222222...', '............'] },
    amethyst: { ramps: ['purple'], px: [
      '.....4......', '....454.....', '..4.444..4..', '.454434.454.',
      '.444434.434.', '.434434.434.', '.434334.334.', '.334334.334.',
      '.334334.234.', '222222222222', '.2222222222.', '............'] },
    opal: { ramps: ['opal', 'cyan', 'green'], px: [
      '............', '...333333...', '..34444443..', '.344cc44h43.',
      '.34cdc4hh43.', '.344c444443.', '.3444hh4c43.', '.344hhh4dc3.',
      '..34444443..', '...222222...', '............', '............'] },
    voidstone: { ramps: ['void'], px: [
      '............', '....3443....', '..34211243..', '.3421111243.',
      '.4211111124.', '.4211551124.', '.4211551124.', '.4211111124.',
      '.3421111243.', '..34211243..', '....3443....', '............'] },
    drone: { ramps: ['steel', 'cyan', 'gold'], px: [
      'ddd......ddd', '.3........3.', '.3.333333.3.', '.3344444433.',
      '..34eeee43..', '..34e44e43..', '..34444443..', '...333333...',
      '....3..3....', '...ffffff...', '...fhhhhf...', '...ffffff...'] },
    gundrone: { ramps: ['steel', 'red', 'fire'], px: [
      'ddd......ddd', '.3........3.', '.3.333333.3.', '.3344444433.',
      '..34dd4443..', '..3444444333', '..34444443hh', '...333333...',
      '....3..3....', '............', '............', '............'] },
    medic: { ramps: ['steel', 'green', 'cyan'], px: [
      'ddd......ddd', '.3........3.', '.3.333333.3.', '.3344444433.',
      '..344cc443..', '..34cccc43..', '..344cc443..', '...333333...',
      '....3..3....', '.....hh.....', '.....h......', '............'] },
    flower: { ramps: ['ruby', 'green', 'gold'], px: [
      '.....22.....', '....2442....', '..22.44.22..', '.2442hh2442.',
      '.2444hh4442.', '..22.44.22..', '....2442....', '.....22.....',
      '.....cc.....', '...cccc.....', '.....cc.cc..', '.....cccc...'] },
    leaf: { ramps: ['fire', 'wood'], px: [
      '.........3..', '.......334..', '.....33443..', '...334443...',
      '..3444433...', '.344443d....', '.34443d.....', '.3443d......',
      '..33d.......', '...d........', '..d.........', '............'] },
    meteor: { ramps: ['fire', 'coal'], px: [
      '.........4..', '........43..', '.......43...', '.....343....',
      '....3452....', '..cccc2.....', '.cddddc.....', 'cdeddddc....',
      'cddddedc....', 'cdddddc.....', '.cdddc......', '..ccc.......'] },
    flight: { ramps: ['blue', 'steel', 'fire'], px: [
      '....3333....', '..33444433..', '.3454444443.', '.3444444443.',
      '344444444443', 'cccccccccccc', '.dddddddddd.', '..dd....dd..',
      '..hh....hh..', '..ih....hi..', '...i....i...', '............'] },
    core: { ramps: ['cyan', 'gold'], px: [
      '.....dd.....', '....d44d....', '...d4554d...', '..d455554d..',
      '.d45555554d.', 'd4555445554d', '.d45555554d.', '..d455554d..',
      '...d4554d...', '....d44d....', '.....dd.....', '............'] },
    moon: { ramps: ['cream'], px: [
      '....3333....', '..334444....', '.3344.......', '.344........',
      '3445........', '3444........', '3444........', '3444........',
      '.344........', '.3344.......', '..334444....', '....3333....'] },
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
    bombCharge: { ramps: ['red', 'wood', 'fire'], px: [
      '.........i..', '........h...', '.......c....', '..34.34c34..',
      '..34.34.34..', '..34.34.34..', '.adddddddda.', '..34.34.34..',
      '..34.34.34..', '..34.34.34..', '..23.23.23..', '............'] },
    bombBig: { ramps: ['coal', 'steel', 'fire'], px: [
      '.......ihi..', '.......dg...', '....2dd2....', '..22333322..',
      '.2344433332.', '.2455433332.', '.cccccccccc.', '.2333333322.',
      '.2333333322.', '..23333222..', '...222222...', '............'] },
    bombMega: { ramps: ['gold', 'coal', 'fire'], px: [
      '.....ih.....', '....ccdc....', '..32222223..', '..3b44b443..',
      '..34b44b43..', '..344b44b3..', '..3b44b443..', '..34b44b43..',
      '..344b44b3..', '..32222223..', '...cccccc...', '............'] },
    bombVoid: { ramps: ['void', 'purple', 'cyan'], px: [
      '......j.....', '.....i......', '....3bb3....', '..34d55d43..',
      '.34d5ee5d43.', '.3d5eeee5d3.', '.3d5eeee5d3.', '.34d5ee5d43.',
      '..34d55d43..', '...333333...', '............', '............'] },
    chest: { ramps: ['wood', 'gold', 'purple'], px: [
      '............', '..23333332..', '.2344444432.', '.2dcc44ccd2.',
      '.2222hh2222.', '.2333ih3332.', '.2343hh3432.', '.2343333432.',
      '.2dc3333cd2.', '.2222222222.', '............', '............'] },
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
    [TILE_RUBY]: 'Ruby',
    [TILE_TITANIUM]: 'Titanium Ore',
    [TILE_SAPPHIRE]: 'Sapphire',
    [TILE_URANIUM]: 'Uranium',
    [TILE_AMETHYST]: 'Amethyst',
    [TILE_OPAL]: 'Fire Opal',
    [TILE_VOIDSTONE]: 'Voidstone',
    [TILE_CORE]: 'Relocation Core',
    [TILE_CHEST]: 'Secret Chest'
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
    [TILE_RUBY]: ['#ff4488', '#e0115f', '#ff2070', '#c00048'],
    [TILE_TITANIUM]: ['#c8dcf4', '#8aa0bc', '#e8f2ff', '#6a80a0'],
    [TILE_SAPPHIRE]: ['#6aa0ff', '#2a64e0', '#a0c4ff', '#1438a0'],
    [TILE_URANIUM]: ['#9aff5a', '#58d030', '#d0ff90', '#30a010'],
    [TILE_AMETHYST]: ['#d090ff', '#9a4ad8', '#f0c8ff', '#6a20a8'],
    [TILE_OPAL]: ['#ffd080', '#ff9a40', '#80e8ff', '#60f0a0'],
    [TILE_VOIDSTONE]: ['#b48aff', '#5a3aa0', '#f0e0ff', '#2a1458']
  };

  // All resource tile types (used for detection in various places)
  const RESOURCE_TILES = [
    TILE_IRON, TILE_WATER, TILE_COBALT,
    TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL,
    TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY,
    TILE_TITANIUM, TILE_SAPPHIRE, TILE_URANIUM, TILE_AMETHYST, TILE_OPAL, TILE_VOIDSTONE
  ];

  function emptyResources() {
    const r = {};
    for (const t of RESOURCE_TILES)
      r[TILE_LABELS[t]] = 0;
    return r;
  }

  /* -- Rock strata, STRATUM_ROWS rows each -- */
  // style picks the texture painter; ore names the signature ore of a deep layer
  const DEPTH_TIERS = [
    { name: 'Sand',         base: '#c2a55a', highlight: '#d4bb78', shadow: '#8a7438', style: 'soil' },
    { name: 'Loose Soil',   base: '#8b6c42', highlight: '#a88558', shadow: '#5e4628', style: 'soil' },
    { name: 'Dirt',         base: '#4a3a2a', highlight: '#6a5540', shadow: '#2a1a0a', style: 'soil' },
    { name: 'Packed Dirt',  base: '#3d2e1e', highlight: '#584630', shadow: '#221508', style: 'soil' },
    { name: 'Clay',         base: '#6b3a2a', highlight: '#885040', shadow: '#3e1e12', style: 'soil' },
    { name: 'Gravel',       base: '#5a5040', highlight: '#706858', shadow: '#3a3228', style: 'gravel' },
    { name: 'Soft Stone',   base: '#7a7a7a', highlight: '#949494', shadow: '#505050', style: 'stone' },
    { name: 'Stone',        base: '#5a5a5a', highlight: '#707070', shadow: '#383838', style: 'stone' },
    { name: 'Hard Stone',   base: '#3e3e3e', highlight: '#525252', shadow: '#222222', style: 'stone' },
    { name: 'Bedrock',      base: '#2a2628', highlight: '#3c3638', shadow: '#121012', style: 'stone' },
    { name: 'Slate',        base: '#3a4654', highlight: '#4e5c6c', shadow: '#1e2630', style: 'slate', ore: TILE_TITANIUM },
    { name: 'Granite',      base: '#6a4a48', highlight: '#866460', shadow: '#3a2826', style: 'granite', ore: TILE_SAPPHIRE },
    { name: 'Basalt',       base: '#262a2e', highlight: '#363c42', shadow: '#101316', style: 'basalt', ore: TILE_URANIUM },
    { name: 'Obsidian',     base: '#1a1424', highlight: '#2c2240', shadow: '#08060e', style: 'obsidian', ore: TILE_AMETHYST },
    { name: 'Magma Rock',   base: '#3a1a12', highlight: '#5a2618', shadow: '#1a0806', style: 'magma', ore: TILE_OPAL },
    { name: 'Abyssal Core', base: '#140e26', highlight: '#22183c', shadow: '#06040e', style: 'abyss', ore: TILE_VOIDSTONE }
  ];
  const DEEP_STRATUM = 10; // first layer of the deep strata (signature ores)

  // Stratum index (0..STRATUM_COUNT-1) for a given row
  function getDepthTier(row) {
    return Math.max(0, Math.min(DEPTH_TIERS.length - 1, Math.floor(row / STRATUM_ROWS)));
  }

  // Get depth-based colors for dirt at a given row
  function getDepthDirtColors(row) {
    return DEPTH_TIERS[getDepthTier(row)];
  }

  // Depth-based mining time multiplier: 0.5 at the surface, rising every row (about 5 at the core)
  function getDepthMineMultiplier(row) {
    return 0.5 + (row / STRATUM_ROWS) * 0.28;
  }

  // Ore found deeper is richer: up to +60% yield at the bottom of the mine
  function getDepthValueMultiplier(row) {
    return 1 + 0.6 * Math.max(0, Math.min(1, row / (GRID_ROWS - 1)));
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
    [TILE_RUBY]: 2.8,
    [TILE_TITANIUM]: 3.0,
    [TILE_SAPPHIRE]: 3.2,
    [TILE_URANIUM]: 3.4,
    [TILE_AMETHYST]: 3.5,
    [TILE_OPAL]: 3.7,
    [TILE_VOIDSTONE]: 4.0,
    [TILE_CORE]: 3.5,
    [TILE_CHEST]: 3
  };

  /* -- Movement -- */
  const BASE_MOVE_INTERVAL = 0.15; // seconds per tile (base, before upgrades)

  /* -- Tools bought in the upgrade tree (HUD rows and number-key shortcuts) -- */
  const TOOL_DEFS = [
    { key: 'drill', name: 'Drill Gadget', icon: 'drill', shortcut: '1' },
    { key: 'blastTool', name: 'Blast Mining', icon: 'explosion', shortcut: '2' },
    { key: 'scanner', name: 'Scanner', icon: 'magnifier', shortcut: '3' },
    { key: 'reinforcedDome', name: 'Reinforced Dome', icon: 'shield', shortcut: '4' },
    { key: 'teleporter', name: 'Teleporter', icon: 'portal', shortcut: '5' }
  ];

  // Saves from before the single upgrade tree kept a separate quick-upgrade
  // level per stat; those levels become the first nodes of the matching chain
  const LEGACY_UPGRADE_CHAINS = {
    weaponDamage: 'damage', fireRate: 'fireRate', domeHP: 'shield', drillSpeed: 'drillSpeed',
    carryCapacity: 'carry', moveSpeed: 'speed', miningTools: 'mining'
  };

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
      costs: [{ sapphire: 8, titanium: 12, diamond: 15 }], maxLevel: 1, prereqs: ['shield6'],
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
      costs: [{ amethyst: 6, diamond: 12, emerald: 15 }], maxLevel: 1, prereqs: ['energyShield', 'shieldRecharge4'],
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
      costs: [{ titanium: 10, cobalt: 35, diamond: 8 }], maxLevel: 1, prereqs: ['shield5', 'reinforcedDome'],
      upgradeKey: 'fortifiedBase', type: 'gadget' },
    { id: 'lastStand', name: 'Last Stand', icon: 'heart', branch: 'dome',
      costs: [{ voidstone: 3, opal: 5, ruby: 15 }], maxLevel: 1, prereqs: ['emergencyShield'],
      upgradeKey: 'lastStand', type: 'gadget' },

    // =============================================================
    // === Mining Branch (29 nodes) ===
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
      costs: [{ uranium: 6, titanium: 10, diamond: 12 }], maxLevel: 1, prereqs: ['mining6'],
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
      costs: [{ titanium: 8, gold: 25, lead: 20 }], maxLevel: 1, prereqs: ['carry4'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    // -- Gadgets --
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
      costs: [{ gold: 25, redstone: 15, diamond: 5, cobalt: 30 }], maxLevel: 1, prereqs: ['mining5', 'drillSpeed3'],
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
      costs: [{ amethyst: 5, diamond: 10, emerald: 12 }], maxLevel: 1, prereqs: ['silkTouch', 'tunnelBore'],
      upgradeKey: 'veinMiner', type: 'gadget' },
    // -- Drill Speed chain (5 levels) --
    { id: 'drillSpeed1', name: 'Drill Speed L1', icon: 'drill', branch: 'mining',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed2', name: 'Drill Speed L2', icon: 'drill', branch: 'mining',
      costs: [{ iron: 35, cobalt: 10, tin: 8 }], maxLevel: 1, prereqs: ['drillSpeed1'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed3', name: 'Drill Speed L3', icon: 'drill', branch: 'mining',
      costs: [{ iron: 50, silver: 10, coal: 15 }], maxLevel: 1, prereqs: ['drillSpeed2'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed4', name: 'Drill Speed L4', icon: 'drill', branch: 'mining',
      costs: [{ gold: 12, redstone: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['drillSpeed3'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed5', name: 'Drill Speed L5', icon: 'drill', branch: 'mining',
      costs: [{ titanium: 6, gold: 20, redstone: 15 }], maxLevel: 1, prereqs: ['drillSpeed4'],
      upgradeKey: 'drillSpeed', type: 'stat' },

    // =============================================================
    // === Movement Branch (16 nodes) ===
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
      costs: [{ titanium: 10, sapphire: 6, emerald: 8 }], maxLevel: 1, prereqs: ['speed6'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    // -- Gadgets --
    { id: 'jetpack', name: 'Jetpack', icon: 'rocket', branch: 'movement',
      costs: [{ iron: 45, copper: 20, coal: 25 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'jetpack', type: 'gadget' },
    { id: 'phaseShift', name: 'Phase Shift', icon: 'ghost', branch: 'movement',
      costs: [{ silver: 20, gold: 10, quartz: 15, cobalt: 20 }], maxLevel: 1, prereqs: ['speed4'],
      upgradeKey: 'phaseShift', type: 'gadget' },
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
    { id: 'jetpackFuel1', name: 'Jetpack Fuel L1', icon: 'rocket', branch: 'movement',
      costs: [{ copper: 25, coal: 30, cobalt: 15 }], maxLevel: 1, prereqs: ['jetpack'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'jetpackFuel2', name: 'Jetpack Fuel L2', icon: 'rocket', branch: 'movement',
      costs: [{ gold: 15, coal: 35, redstone: 10 }], maxLevel: 1, prereqs: ['jetpackFuel1'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'phaseShift2', name: 'Phase Shift L2', icon: 'ghost', branch: 'movement',
      costs: [{ voidstone: 2, quartz: 20, diamond: 5 }], maxLevel: 1, prereqs: ['phaseShift'],
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
      costs: [{ opal: 4, sapphire: 8, ruby: 10 }], maxLevel: 1, prereqs: ['fireRate5'],
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
      costs: [{ sapphire: 6, ruby: 12, gold: 25 }], maxLevel: 1, prereqs: ['damage5'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage7', name: 'Damage L7', icon: 'swords', branch: 'weapon',
      costs: [{ amethyst: 6, uranium: 6, ruby: 15 }], maxLevel: 1, prereqs: ['damage6'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    // -- Gadgets --
    { id: 'chainLightning', name: 'Chain Lightning', icon: 'bolt', branch: 'weapon',
      costs: [{ silver: 20, copper: 25, redstone: 15 }], maxLevel: 1, prereqs: ['damage3', 'fireRate2'],
      upgradeKey: 'chainLightning', type: 'gadget' },
    { id: 'freezeRay', name: 'Freeze Ray', icon: 'snowflake', branch: 'weapon',
      costs: [{ water: 30, quartz: 15, silver: 10 }], maxLevel: 1, prereqs: ['fireRate3'],
      upgradeKey: 'freezeRay', type: 'gadget' },
    { id: 'plasmaCannon', name: 'Plasma Cannon', icon: 'explosion', branch: 'weapon',
      costs: [{ uranium: 5, ruby: 12, redstone: 15 }], maxLevel: 1, prereqs: ['damage4', 'chainLightning'],
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
      costs: [{ uranium: 8, ruby: 10, redstone: 20 }], maxLevel: 1, prereqs: ['plasmaCannon', 'criticalHit'],
      upgradeKey: 'explosiveRounds', type: 'gadget' },
    { id: 'freezeRay2', name: 'Freeze Ray L2', icon: 'snowflake', branch: 'weapon',
      costs: [{ sapphire: 5, water: 40, quartz: 20 }], maxLevel: 1, prereqs: ['freezeRay'],
      upgradeKey: 'freezeRay', type: 'stat' },
    { id: 'chainLightning2', name: 'Chain Light. L2', icon: 'bolt', branch: 'weapon',
      costs: [{ gold: 20, redstone: 18, emerald: 8 }], maxLevel: 1, prereqs: ['chainLightning'],
      upgradeKey: 'chainLightning', type: 'stat' },

    // =============================================================
    // === Drone Branch (18 nodes) ===
    // =============================================================
    { id: 'droneBay', name: 'Drone Bay', icon: 'drone', branch: 'drone',
      costs: [{ iron: 30, copper: 12 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'droneBay', type: 'gadget' },
    // -- Flight speed and pickup radius --
    { id: 'droneSpeed1', name: 'Drone Thrusters L1', icon: 'speed', branch: 'drone',
      costs: [{ iron: 25, tin: 10 }], maxLevel: 1, prereqs: ['droneBay'],
      upgradeKey: 'droneSpeed', type: 'stat' },
    { id: 'droneSpeed2', name: 'Drone Thrusters L2', icon: 'speed', branch: 'drone',
      costs: [{ silver: 12, cobalt: 15, tin: 15 }], maxLevel: 1, prereqs: ['droneSpeed1'],
      upgradeKey: 'droneSpeed', type: 'stat' },
    { id: 'droneSpeed3', name: 'Drone Thrusters L3', icon: 'speed', branch: 'drone',
      costs: [{ gold: 15, titanium: 6, quartz: 10 }], maxLevel: 1, prereqs: ['droneSpeed2'],
      upgradeKey: 'droneSpeed', type: 'stat' },
    // -- Cargo hold --
    { id: 'droneCargo1', name: 'Drone Cargo L1', icon: 'crate', branch: 'drone',
      costs: [{ iron: 30, copper: 15 }], maxLevel: 1, prereqs: ['droneBay'],
      upgradeKey: 'droneCargo', type: 'stat' },
    { id: 'droneCargo2', name: 'Drone Cargo L2', icon: 'crate', branch: 'drone',
      costs: [{ lead: 20, cobalt: 15, iron: 30 }], maxLevel: 1, prereqs: ['droneCargo1'],
      upgradeKey: 'droneCargo', type: 'stat' },
    { id: 'droneCargo3', name: 'Drone Cargo L3', icon: 'crate', branch: 'drone',
      costs: [{ gold: 15, sapphire: 5, lead: 20 }], maxLevel: 1, prereqs: ['droneCargo2'],
      upgradeKey: 'droneCargo', type: 'stat' },
    // -- Mining drones --
    { id: 'droneMiner', name: 'Mining Laser', icon: 'drill', branch: 'drone',
      costs: [{ iron: 40, coal: 20, copper: 15 }], maxLevel: 1, prereqs: ['droneCargo1'],
      upgradeKey: 'droneMiner', type: 'gadget' },
    { id: 'droneMiner2', name: 'Mining Laser L2', icon: 'drill', branch: 'drone',
      costs: [{ silver: 15, redstone: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['droneMiner'],
      upgradeKey: 'droneMining', type: 'stat' },
    { id: 'droneMiner3', name: 'Mining Laser L3', icon: 'drill', branch: 'drone',
      costs: [{ uranium: 5, titanium: 8, gold: 20 }], maxLevel: 1, prereqs: ['droneMiner2'],
      upgradeKey: 'droneMining', type: 'stat' },
    // -- Gun drones --
    { id: 'combatDrone', name: 'Gun Drone', icon: 'gundrone', branch: 'drone',
      costs: [{ iron: 45, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['droneSpeed1'],
      upgradeKey: 'combatDrone', type: 'gadget' },
    { id: 'combatDrone2', name: 'Gun Drone L2', icon: 'gundrone', branch: 'drone',
      costs: [{ silver: 15, redstone: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['combatDrone'],
      upgradeKey: 'combatDroneLevel', type: 'stat' },
    { id: 'combatDrone3', name: 'Gun Drone L3', icon: 'gundrone', branch: 'drone',
      costs: [{ uranium: 6, ruby: 10, gold: 20 }], maxLevel: 1, prereqs: ['combatDrone2'],
      upgradeKey: 'combatDroneLevel', type: 'stat' },
    // -- Repair drone --
    { id: 'repairDrone', name: 'Repair Drone', icon: 'medic', branch: 'drone',
      costs: [{ iron: 40, water: 25, copper: 15 }], maxLevel: 1, prereqs: ['droneSpeed1'],
      upgradeKey: 'repairDrone', type: 'gadget' },
    { id: 'repairDrone2', name: 'Repair Drone L2', icon: 'medic', branch: 'drone',
      costs: [{ silver: 15, water: 35, quartz: 10 }], maxLevel: 1, prereqs: ['repairDrone'],
      upgradeKey: 'repairDroneLevel', type: 'stat' },
    { id: 'repairDrone3', name: 'Repair Drone L3', icon: 'medic', branch: 'drone',
      costs: [{ sapphire: 6, emerald: 10, water: 40 }], maxLevel: 1, prereqs: ['repairDrone2'],
      upgradeKey: 'repairDroneLevel', type: 'stat' },
    // -- More couriers --
    { id: 'droneSwarm1', name: 'Drone Swarm L1', icon: 'drone', branch: 'drone',
      costs: [{ gold: 20, titanium: 8, cobalt: 25 }], maxLevel: 1, prereqs: ['droneCargo2', 'droneSpeed2'],
      upgradeKey: 'droneCount', type: 'stat' },
    { id: 'droneSwarm2', name: 'Drone Swarm L2', icon: 'drone', branch: 'drone',
      costs: [{ amethyst: 6, opal: 4, voidstone: 2 }], maxLevel: 1, prereqs: ['droneSwarm1'],
      upgradeKey: 'droneCount', type: 'stat' },

    // =============================================================
    // === Tools Branch: mining tools, prospecting and bombs ===
    // =============================================================
    // -- Drill, blast tool and teleporter --
    { id: 'drill', name: 'Drill Gadget', icon: 'drill', branch: 'tools',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'drill', type: 'gadget' },
    { id: 'drill2', name: 'Drill Gadget L2', icon: 'drill', branch: 'tools',
      costs: [{ iron: 40, copper: 15, tin: 10 }], maxLevel: 1, prereqs: ['drill'],
      upgradeKey: 'drillCombo', type: 'stat' },
    { id: 'blastTool', name: 'Blast Mining', icon: 'explosion', branch: 'tools',
      costs: [{ iron: 30, coal: 10 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'blastTool', type: 'gadget' },
    { id: 'blastTool2', name: 'Blast Mining L2', icon: 'explosion', branch: 'tools',
      costs: [{ iron: 45, coal: 20, copper: 10 }], maxLevel: 1, prereqs: ['blastTool'],
      upgradeKey: 'blastToolLevel', type: 'stat' },
    { id: 'teleporter', name: 'Teleporter', icon: 'portal', branch: 'tools',
      costs: [{ iron: 30, cobalt: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'teleporter', type: 'gadget' },
    { id: 'teleportCooldown1', name: 'Teleport CDR L1', icon: 'portal', branch: 'tools',
      costs: [{ silver: 12, cobalt: 15, copper: 10 }], maxLevel: 1, prereqs: ['teleporter'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    { id: 'teleportCooldown2', name: 'Teleport CDR L2', icon: 'portal', branch: 'tools',
      costs: [{ gold: 15, quartz: 12, redstone: 8 }], maxLevel: 1, prereqs: ['teleportCooldown1'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    // -- Prospecting --
    { id: 'scanner', name: 'Scanner', icon: 'magnifier', branch: 'tools',
      costs: [{ iron: 35, cobalt: 10 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'scanner', type: 'gadget' },
    { id: 'echoLocation', name: 'Echo Location', icon: 'radar', branch: 'tools',
      costs: [{ copper: 15, tin: 20, cobalt: 15 }], maxLevel: 1, prereqs: ['scanner'],
      upgradeKey: 'echoLocation', type: 'gadget' },
    { id: 'echoLocation2', name: 'Echo Loc. L2', icon: 'radar', branch: 'tools',
      costs: [{ silver: 15, gold: 10, redstone: 8 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'echoLocation', type: 'stat' },
    { id: 'echoLocation3', name: 'Echo Loc. L3', icon: 'radar', branch: 'tools',
      costs: [{ gold: 20, quartz: 15, redstone: 12 }], maxLevel: 1, prereqs: ['echoLocation2'],
      upgradeKey: 'echoLocation', type: 'stat' },
    { id: 'undergroundRadar', name: 'Ground Radar', icon: 'radar', branch: 'tools',
      costs: [{ silver: 20, copper: 25, quartz: 10 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'undergroundRadar', type: 'gadget' },
    { id: 'undergroundRadar2', name: 'Radar L2', icon: 'radar', branch: 'tools',
      costs: [{ gold: 18, quartz: 15, redstone: 10 }], maxLevel: 1, prereqs: ['undergroundRadar'],
      upgradeKey: 'undergroundRadar', type: 'stat' },
    { id: 'oreDetector', name: 'Ore Detector', icon: 'radar', branch: 'tools',
      costs: [{ iron: 30, copper: 15, cobalt: 10 }], maxLevel: 1, prereqs: ['scanner'],
      upgradeKey: 'oreDetector', type: 'gadget' },
    { id: 'oreDetector2', name: 'Ore Detect L2', icon: 'radar', branch: 'tools',
      costs: [{ silver: 15, quartz: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['oreDetector'],
      upgradeKey: 'oreDetector', type: 'stat' },
    // -- Bomb recipes (Charges are always known) --
    { id: 'recipeBomb', group: 'bombs', name: 'Bomb Recipe', icon: 'bomb', branch: 'tools',
      costs: [{ iron: 20, coal: 10 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'recipeBomb', type: 'gadget' },
    { id: 'recipeBig', group: 'bombs', name: 'Big Bomb Recipe', icon: 'bombBig', branch: 'tools',
      costs: [{ cobalt: 15, redstone: 8, coal: 20 }], maxLevel: 1, prereqs: ['recipeBomb'],
      upgradeKey: 'recipeBig', type: 'gadget' },
    { id: 'recipeMega', group: 'bombs', name: 'Mega Bomb Recipe', icon: 'bombMega', branch: 'tools',
      costs: [{ titanium: 6, redstone: 12, gold: 10 }], maxLevel: 1, prereqs: ['recipeBig'],
      upgradeKey: 'recipeMega', type: 'gadget' },
    { id: 'recipeVoid', group: 'bombs', name: 'Void Bomb Recipe', icon: 'bombVoid', branch: 'tools',
      costs: [{ uranium: 6, amethyst: 5, voidstone: 2 }], maxLevel: 1, prereqs: ['recipeMega'],
      upgradeKey: 'recipeVoid', type: 'gadget' },
    // -- Bomb upgrades --
    { id: 'blastRadius1', group: 'bombs', name: 'Blast Radius L1', icon: 'explosion', branch: 'tools',
      costs: [{ iron: 30, coal: 20 }], maxLevel: 1, prereqs: ['recipeBomb'],
      upgradeKey: 'blastRadius', type: 'stat' },
    { id: 'blastRadius2', group: 'bombs', name: 'Blast Radius L2', icon: 'explosion', branch: 'tools',
      costs: [{ cobalt: 15, coal: 25, silver: 8 }], maxLevel: 1, prereqs: ['blastRadius1'],
      upgradeKey: 'blastRadius', type: 'stat' },
    { id: 'blastRadius3', group: 'bombs', name: 'Blast Radius L3', icon: 'explosion', branch: 'tools',
      costs: [{ titanium: 6, redstone: 12, gold: 12 }], maxLevel: 1, prereqs: ['blastRadius2'],
      upgradeKey: 'blastRadius', type: 'stat' },
    { id: 'bombPower1', group: 'bombs', name: 'Shaped Charges L1', icon: 'bolt', branch: 'tools',
      costs: [{ iron: 25, copper: 15, coal: 10 }], maxLevel: 1, prereqs: ['recipeBig'],
      upgradeKey: 'bombPower', type: 'stat' },
    { id: 'bombPower2', group: 'bombs', name: 'Shaped Charges L2', icon: 'bolt', branch: 'tools',
      costs: [{ silver: 12, cobalt: 15, quartz: 8 }], maxLevel: 1, prereqs: ['bombPower1'],
      upgradeKey: 'bombPower', type: 'stat' },
    { id: 'bombPower3', group: 'bombs', name: 'Shaped Charges L3', icon: 'bolt', branch: 'tools',
      costs: [{ sapphire: 5, diamond: 6, redstone: 12 }], maxLevel: 1, prereqs: ['bombPower2'],
      upgradeKey: 'bombPower', type: 'stat' },
    { id: 'chainReaction', group: 'bombs', name: 'Chain Reaction', icon: 'fire', branch: 'tools',
      costs: [{ redstone: 12, coal: 30, uranium: 3 }], maxLevel: 1, prereqs: ['bombPower3'],
      upgradeKey: 'chainReaction', type: 'gadget' },
    { id: 'bombYield1', group: 'bombs', name: 'Careful Blasting L1', icon: 'sparkle', branch: 'tools',
      costs: [{ copper: 20, tin: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'bombYield', type: 'stat' },
    { id: 'bombYield2', group: 'bombs', name: 'Careful Blasting L2', icon: 'sparkle', branch: 'tools',
      costs: [{ silver: 15, gold: 8, lead: 12 }], maxLevel: 1, prereqs: ['bombYield1'],
      upgradeKey: 'bombYield', type: 'stat' },
    { id: 'bombYield3', group: 'bombs', name: 'Careful Blasting L3', icon: 'sparkle', branch: 'tools',
      costs: [{ emerald: 6, ruby: 5, gold: 15 }], maxLevel: 1, prereqs: ['bombYield2'],
      upgradeKey: 'bombYield', type: 'stat' },
    { id: 'bombFuse1', group: 'bombs', name: 'Quick Fuse L1', icon: 'fire', branch: 'tools',
      costs: [{ coal: 20, copper: 10 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'bombFuse', type: 'stat' },
    { id: 'bombFuse2', group: 'bombs', name: 'Quick Fuse L2', icon: 'fire', branch: 'tools',
      costs: [{ redstone: 10, coal: 30 }], maxLevel: 1, prereqs: ['bombFuse1'],
      upgradeKey: 'bombFuse', type: 'stat' },
    { id: 'remoteDetonator', group: 'bombs', name: 'Remote Detonator', icon: 'radar', branch: 'tools',
      costs: [{ copper: 25, silver: 12, redstone: 8 }], maxLevel: 1, prereqs: ['bombFuse2'],
      upgradeKey: 'remoteDetonator', type: 'gadget' },
    { id: 'stickyBombs', group: 'bombs', name: 'Sticky Bombs', icon: 'target', branch: 'tools',
      costs: [{ lead: 20, quartz: 10, coal: 15 }], maxLevel: 1, prereqs: ['remoteDetonator'],
      upgradeKey: 'stickyBombs', type: 'gadget' },
    { id: 'bombSatchel1', group: 'bombs', name: 'Bomb Satchel L1', icon: 'bag', branch: 'tools',
      costs: [{ iron: 25, lead: 10 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'bombSatchel', type: 'stat' },
    { id: 'bombSatchel2', group: 'bombs', name: 'Bomb Satchel L2', icon: 'bag', branch: 'tools',
      costs: [{ lead: 20, cobalt: 12, tin: 15 }], maxLevel: 1, prereqs: ['bombSatchel1'],
      upgradeKey: 'bombSatchel', type: 'stat' },
    { id: 'bombSatchel3', group: 'bombs', name: 'Bomb Satchel L3', icon: 'bag', branch: 'tools',
      costs: [{ titanium: 6, lead: 25, gold: 10 }], maxLevel: 1, prereqs: ['bombSatchel2'],
      upgradeKey: 'bombSatchel', type: 'stat' },
    { id: 'bombsmith1', group: 'bombs', name: 'Bomb Forge L1', icon: 'wrench', branch: 'tools',
      costs: [{ iron: 40, copper: 20, coal: 20 }], maxLevel: 1, prereqs: ['bombSatchel1'],
      upgradeKey: 'bombsmith', type: 'stat' },
    { id: 'bombsmith2', group: 'bombs', name: 'Bomb Forge L2', icon: 'wrench', branch: 'tools',
      costs: [{ gold: 15, silver: 15, redstone: 10 }], maxLevel: 1, prereqs: ['bombsmith1'],
      upgradeKey: 'bombsmith', type: 'stat' },
    { id: 'blastSuit', group: 'bombs', name: 'Blast Suit', icon: 'shield', branch: 'tools',
      costs: [{ iron: 40, lead: 20, tin: 15 }], maxLevel: 1, prereqs: ['bombSatchel1'],
      upgradeKey: 'blastSuit', type: 'gadget' }
  ];

  // Upgrade effect descriptions (keyed by upgradeKey)
  const UPGRADE_EFFECT_DESC = {
    domeHP: '+25 max dome HP per level',
    shieldRecharge: 'Shield Generator recharges 50 s after a hit, even at night (-8 s per level); Repellent cooldown -4 s per level',
    shieldRegen: '+1 HP/5s passive dome regen per level',
    reinforcedDome: 'Dome takes 25% less damage (passive)',
    autoRepair: 'Dome regenerates +2 HP every 5s',
    autoRepairSpeed: 'Auto-repair ticks 60% more often per level',
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
    silkTouch: '+25% yield from every ore you mine',
    oreDetector: 'Reveals hidden gadget chambers and the Relocation Core within 6 tiles (+3 per level)',
    speedMining: '-10% mining time per level (stacks with tools)',
    autoMine: 'Mines an adjacent ore by itself when the keeper stands idle for 2 s',
    tunnelBore: 'Every dig also breaks the next 2 blocks in the same direction',
    veinMiner: 'Mining an ore also mines up to 10 connected tiles of the same ore',
    moveSpeed: '15% faster movement per level',
    teleporter: 'Instantly return to surface (30s cooldown)',
    teleportCooldown: '-5s teleporter cooldown per level',
    jetpack: 'Climb tunnels twice as fast and dig upward 20% faster',
    jetpackFuel: '+25% climbing speed per level',
    phaseShift: 'The next block breaks instantly; recharges in 25 s (-8 s per level)',
    echoLocation: 'Extends scanner range by +2 tiles per level',
    doubleJump: 'Moving up through a tunnel covers 2 tiles per step',
    wallClimb: 'Digging upward is 30% faster',
    dash: 'Shift + direction dashes 3 tunnel tiles (+1 per level), 2 s cooldown',
    undergroundRadar: 'Your lamp lights 25% further per level',
    fireRate: '+0.3 shots/sec per level',
    weaponDamage: '+5 damage per level',
    drillSpeed: 'Every dig is faster (-0.05s drill interval per level)',
    blastTool: 'Clears a 3x3 area (costs 10 iron, 5s cooldown)',
    scanner: 'Reveals resources in 3-tile radius (passive)',
    chainLightning: 'Shots arc to 2 nearby enemies for 40% damage (+1 arc/level)',
    freezeRay: 'Shots stun enemies in 60px radius for 0.8s (+0.3s/level)',
    plasmaCannon: 'Shots deal 60% AoE damage in 70px radius',
    multiShot: 'Each shot also hits 1 more monster (+1 per level) for 60% damage',
    homingShots: 'Shots home in on monsters far wider around your aim',
    turretSpeed: '+30% turret rotation speed per level',
    criticalHit: '15% chance to deal 2.5x damage (+5% per level)',
    explosiveRounds: 'All shots explode on impact for 40% AoE',
    droneBay: 'A courier drone flies to the keeper, takes the cargo home and picks up loose ore',
    droneSpeed: '+30% drone flight speed and +1 tile pickup radius per level',
    droneCargo: '+15 drone cargo per level',
    droneMiner: 'Couriers laser-mine exposed ore near the keeper while they have room',
    droneMining: 'Mining lasers cut 35% faster and reach 2 tiles further per level',
    combatDrone: 'A gun drone guards the dome and shoots monsters',
    combatDroneLevel: 'Level 2: harder, faster shots. Level 3: a second gun drone',
    repairDrone: 'A repair drone welds the dome back together',
    repairDroneLevel: 'Repairs faster per level',
    droneCount: '+1 courier drone per level',
    drillCombo: 'Drill Gadget digs a column 50% faster instead of 30%',
    blastToolLevel: 'Blast Mining recharges in 2.5 s and costs only 5 iron',
    recipeBomb: 'Craft Bombs (radius 2) in the workshop',
    recipeBig: 'Craft Big Bombs (radius 3) in the workshop',
    recipeMega: 'Craft Mega Bombs (radius 4) in the workshop',
    recipeVoid: 'Craft Void Bombs (radius 6) that crack even the Abyssal Core',
    blastRadius: '+0.5 tiles blast radius for every bomb per level',
    bombPower: '+30% bomb damage to rock and monsters per level',
    bombYield: 'Blasted ore kept: 80% / 100% / 125% (from 50%)',
    bombFuse: 'Bomb fuses burn 0.6 s shorter per level',
    bombSatchel: '+4 bomb storage per level',
    bombsmith: 'Bombs cost 15% less to craft per level',
    chainReaction: 'Coal and uranium caught in a blast explode as well',
    remoteDetonator: 'Press X to set off every bomb in the mine at once',
    stickyBombs: 'Thrown bombs stick to rock faces; throw range +2 tiles',
    blastSuit: 'Your own bombs no longer knock the keeper out'
  };

  // Mining difficulty label from depth multiplier
  function getMiningDifficultyLabel(depthMult) {
    if (depthMult < 1.2) return 'Very Easy';
    if (depthMult < 1.8) return 'Easy';
    if (depthMult < 2.4) return 'Medium';
    if (depthMult < 3.0) return 'Hard';
    if (depthMult < 4.0) return 'Very Hard';
    return 'Extreme';
  }

  // Precompute node positions for the tree layout
  // Layout: root at top center, 4 branches below
  const TREE_BRANCH_ORDER = ['dome', 'mining', 'movement', 'weapon', 'drone', 'tools'];
  const TREE_BRANCH_LABELS = { dome: 'DOME', mining: 'MINING', movement: 'MOVEMENT', weapon: 'WEAPON', drone: 'DRONES', tools: 'TOOLS' };
  const TREE_BRANCH_COLORS = { dome: '#4cb4ff', mining: '#ffae3a', movement: '#5ee07a', weapon: '#ff5e5e', drone: '#c890ff', tools: '#3ad8c0' };
  // Captions of the node groups inside a branch region
  const TREE_GROUP_LABELS = { bombs: '[[bomb]] BOMBS' };
  // Branch regions, row by row
  const TREE_REGION_ROWS = [['dome', 'mining'], ['movement', 'weapon', 'drone'], ['tools']];
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
  {
    // Floating messages use the UI font and are kept fully on screen
    const addFloating = floatingText.add.bind(floatingText);
    const recentFloats = [];
    floatingText.add = (x, y, text, opts) => {
      opts = Object.assign({}, opts);
      opts.font = (opts.font || 'bold 14px sans-serif').replace(/sans-serif$/, UI_FONT);
      ctx.save();
      ctx.font = opts.font;
      const half = ctx.measureText(String(text)).width / 2 + 8;
      ctx.restore();
      x = half * 2 >= CANVAS_W ? CANVAS_W / 2 : Math.max(half, Math.min(CANVAS_W - half, x));
      y = Math.max(96, Math.min(CANVAS_H - 24, y));
      // Stack messages that pop up at the same spot instead of overlapping them
      const now = performance.now();
      while (recentFloats.length && now - recentFloats[0].t > 700)
        recentFloats.shift();
      const lineH = (parseFloat((/(\d+(?:\.\d+)?)px/.exec(opts.font) || [0, 14])[1]) || 14) * 1.2;
      for (let tries = 0; tries < 5 && recentFloats.some(r => Math.abs(r.x - x) < r.half + half && Math.abs(r.y - (now - r.t) * 0.09 - y) < lineH); ++tries)
        y -= lineH;
      recentFloats.push({ x, y, half, t: now }); // y drifts up ~0.09 px/ms
      addFloating(x, y, text, opts);
    };
  }
  let surfaceArt = null;                 // cached sky, mountains, ground and plants of the site
  let daylight = 0;                      // 0 = night .. 1 = full day (sky and land colours)
  let duskGlow = 0;                      // warm sunrise / sunset tint
  const enemyHitFlash = new WeakMap();   // enemy -> white flash strength after a hit

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
      intro: 'Mine by day, defend the dome at night. Dig resources underground, bring them home and spend them on upgrades.',
      items: [['Click', 'Fire the laser (surface) / dig (underground)'], ['WASD / Arrows', 'Move the keeper and mine underground'], ['Space / Tab', 'Switch between surface and mine'], ['Esc', 'Pause - the run is saved automatically']] },
    { title: 'Day & Night', icon: 'moon',
      intro: 'Monsters attack after nightfall. A warning sounds before dusk - get back to the dome in time.',
      items: [[null, 'The sun crosses the sky by day, the moon by night'], [null, 'Full-moon nights bring bigger swarms, new-moon nights are calm'], [null, 'More monsters can arrive later in the night'], [null, 'Sunlight burns the monsters still out at dawn'], [null, 'Day, time, moon phase and weather sit in the top-left panel']] },
    { title: 'Seasons & Weather', icon: 'flower',
      intro: 'A new season begins every four days and changes the swarm and the weather.',
      items: [['Spring', 'Blossoms lure more monsters - smaller and weaker'], ['Summer', 'Long days, the heat makes monsters faster'], ['Autumn', 'Falling leaves, rain and thunderstorms'], ['Winter', 'Short days, snow, few but much tougher monsters'], [null, 'Lightning and meteors hit monsters - and sometimes the dome'], ['Click', 'Collect the ore a meteor leaves behind']] },
    { title: 'Monsters', icon: 'swords',
      intro: 'The swarm grows more varied with every night and every new site. Hover a monster to read about it.',
      items: [['Swarmers', 'Tiny, fast and always in packs'], ['Crawlers', 'Armor soaks part of every hit'], ['Divers', 'Circle high, then dive at the dome'], ['Burrowers', 'Tunnel unseen and pop up at the dome'], ['Spitters', 'Shoot acid from a distance'], ['Splitters', 'Burst into swarmers; Menders heal others'], ['Bosses', 'Behemoth and Hive Queen on every fifth night']] },
    { title: 'Upgrades & Tips', icon: 'pickaxe',
      intro: 'Everything is bought in one upgrade tree with five branches: Dome, Mining, Movement, Weapon and Drones.',
      items: [['U', 'Open the upgrade tree (on the surface)'], [null, 'The Next upgrades panel shows the next node of every branch: click to buy it'], [null, 'Deeper strata hold new ores that pay for the top tiers'], ['H', 'Show this help again anytime']] },
    { title: 'Drones', icon: 'drone',
      intro: 'Buy the Drone Bay in the Drones branch and a courier drone starts working for you.',
      items: [[null, 'Couriers fly to the keeper, take the cargo home and pick up loose ore'], [null, 'Mining Lasers let couriers dig ore near the keeper'], [null, 'Gun drones guard the dome, the repair drone welds it'], [null, 'Drone Swarm adds couriers; the Droneyard gadget gives a free one']] },
    { title: 'Relocation', icon: 'core',
      intro: 'Every mine hides a Relocation Core in its lower strata. Scanners point toward it once it is close.',
      items: [[null, 'Mine the core to unlock the Relocate button'], ['L', 'Relocate when no monsters are attacking'], [null, 'Keep all upgrades and drones plus 75% of the resources'], [null, 'Each new site: a new biome and mine, and tougher monsters']] },
    { title: 'Gadgets', icon: 'gear',
      intro: 'Choose a primary gadget at the start of each run. Golden 2x2 gadget chambers underground hide more of them.',
      items: [['R', 'Activate the Repellent Field'], ['B', 'Use Blast Mining charges'], [null, 'Gadgets from chambers activate on pickup!']] },
    { title: 'Tools', icon: 'drill',
      intro: 'Tools are nodes of the upgrade tree (mostly the Mining branch). Once bought, use them with the number keys.',
      items: [['1', 'Drill: fast column mining'], ['2', 'Blast: clears a 3x3 area'], ['3', 'Scanner: reveals nearby ores'], ['4', 'Reinforced Dome: takes less damage'], ['5', 'Teleporter: instant return to the surface']] }
  ];

  let state = STATE_READY;
  let currentView = VIEW_SURFACE;
  let transitionProgress = 0;
  let transitionTarget = null;

  let domeHP = BASE_DOME_HP;
  let maxDomeHP = BASE_DOME_HP;

  let resources = emptyResources();
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

  let enemies = [];
  let waveNumber = 0;          // nights survived in the whole run
  let siteNights = 0;          // nights at the current site (threat restarts per site)
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
  const quickPanelFlash = {};   // branch -> purchase time (ms) for the quick panel row flash
  let quickPanelHover = null;   // hovered quick panel hit target

  const PRIMARY_GADGETS = [
    { key: 'shield', name: 'Shield Generator', icon: 'shield', desc: ['Absorbs the first hit of each night.', 'Recharges at nightfall.'] },
    { key: 'repellent', name: 'Repellent Field', icon: 'portal', desc: ['Press R: slows all enemies to 40%', 'for 5 seconds (30s cooldown).'] },
    { key: 'orchard', name: 'Orchard', icon: 'tree', desc: ['Every 20s grows a fruit that gives', '+30% mining speed for 10 seconds.'] },
    { key: 'droneyard', name: 'Droneyard', icon: 'drone', desc: ['Starts with a courier drone that hauls', 'your cargo home. All drones work 50% faster.'] }
  ];

  const MINE_GADGETS = ['autoCannon', 'stunLaser', 'blastMining', 'probeScanner', 'domeArmor', 'condenser'];
  const MINE_GADGET_NAMES = {
    autoCannon: 'Auto Cannon', stunLaser: 'Stun Laser', blastMining: 'Blast Mining',
    probeScanner: 'Probe Scanner', domeArmor: 'Dome Armor', condenser: 'Condenser'
  };

  const keys = {};

  /* ======================================================================
     CACHED ART
     ====================================================================== */

  let tileArt = null; // cached underground textures (see buildTileArt)

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
    highScores.push({ waves, score: pts, sites: site.index + 1, days: world.day });
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
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].waves}</td><td>${highScores[i].sites || 1}</td><td>${highScores[i].score}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* -- Run save / resume (plain data only; objects are rebuilt on load) -- */
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const STORAGE_SAVE_V1 = STORAGE_PREFIX + '-save-v1'; // older format, migrated on load
  const SAVE_VERSION = 2;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  let autosaveTimer = 0;
  let saveAvailable = false;   // a resumable run is stored
  let saveNotice = '';         // shown on the title screen (e.g. discarded save)
  let newGameConfirmOpen = false;

  function isRunActive() {
    return primaryGadget !== null && (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_UPGRADE_DIALOG || state === STATE_CINEMATIC || state === STATE_CONFIRM || state === STATE_CRAFT || state === STATE_MINIGAME);
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
      resources, upgradeTreeLevels,
      waveNumber, siteNights, waveTimer: secondsToNight(), waveActive, score,
      world: { day: world.day, t: world.t, bursts: world.bursts, warned: world.warned },
      weather: { kind: weather.kind, timeLeft: weather.timeLeft }, snowCover,
      meteorOre: meteorOre.map(o => ({ x: o.x, y: o.y, type: o.type, amount: o.amount })),
      enemies,
      grid: undergroundGrid.map(row => row.map(t => String.fromCharCode(48 + t)).join('')),
      partialHP,
      droppedResources,
      primaryGadget, primaryGadgetState, foundGadgets, gadgetChambers,
      unlockedTools, activeToolKey, toolState,
      site, relocationCore, landing: landingPending,
      chests: chests.map(ch => ({ r: ch.r, c: ch.c, band: ch.band, kind: ch.kind, revealed: ch.revealed, opened: ch.opened, cooldown: Math.round(ch.cooldown) })),
      bombs: { inv: bombInv, sel: bombSel, placed: placedBombs.map(b => ({ r: b.r, c: b.c, tier: b.tier, fuse: Math.round(b.fuse * 100) / 100, maxFuse: b.maxFuse, sticky: !!b.sticky })) }
    };
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      saveAvailable = true;
    } catch (_) {}
  }

  function clearSave() {
    saveAvailable = false;
    try {
      localStorage.removeItem(STORAGE_SAVE);
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  // Read and validate the stored run; a broken or outdated save is discarded with a notice
  // A version 1 run keeps its upgrades, gadgets, resources and score; its
  // smaller mine cannot be carried over, so the site is generated anew
  function migrateV1Save(d) {
    if (!isPlainObject(d) || d.version !== 1)
      throw new Error('not a version 1 save');
    d.version = SAVE_VERSION;
    d.migratedFrom = 1;
    d.mineOutdated = true;
    d.view = VIEW_SURFACE;
    d.enemies = [];
    d.waveActive = false;
    d.partialHP = [];
    d.droppedResources = [];
    d.gadgetChambers = [];
    if (!isNum(d.drillX)) d.drillX = 0;
    if (!isNum(d.drillY)) d.drillY = 0;
    return d;
  }

  function readSavedRun() {
    let raw = null, legacy = false;
    try {
      raw = localStorage.getItem(STORAGE_SAVE);
      if (!raw) {
        raw = localStorage.getItem(STORAGE_SAVE_V1);
        legacy = !!raw;
      }
    } catch (_) { return null; }
    if (!raw)
      return null;
    try {
      let d = JSON.parse(raw);
      if (legacy)
        d = migrateV1Save(d);
      if (!isPlainObject(d) || d.version !== SAVE_VERSION)
        throw new Error('unsupported save version');
      for (const k of ['domeHP', 'maxDomeHP', 'carried', 'carryCapacity', 'weaponDamage', 'fireRate', 'drillSpeed', 'moveStepInterval', 'drillX', 'drillY', 'turretAngle', 'waveNumber', 'waveTimer', 'score'])
        if (!isNum(d[k]))
          throw new Error('bad ' + k);
      if (!Array.isArray(d.grid))
        throw new Error('bad grid');
      // A mine of another size (older version) is rebuilt; the run itself is kept
      d.mineOutdated = d.grid.length !== GRID_ROWS || d.grid.some(row => typeof row !== 'string' || row.length !== GRID_COLS);
      if (!d.mineOutdated) {
        for (const row of d.grid)
          for (let c = 0; c < row.length; ++c) {
            const t = row.charCodeAt(c) - 48;
            if (t < TILE_EMPTY || t > TILE_MAX)
              throw new Error('bad tile');
          }
        if (d.drillX < 0 || d.drillX >= GRID_COLS || d.drillY < 0 || d.drillY >= GRID_ROWS)
          throw new Error('bad position');
      }
      if (!PRIMARY_GADGETS.some(g => g.key === d.primaryGadget))
        throw new Error('bad gadget');
      for (const k of ['resources', 'upgradeTreeLevels', 'primaryGadgetState', 'unlockedTools', 'toolState'])
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
    if (isPlainObject(d.site) && isNum(d.site.seed) && BIOMES[d.site.biome])
      site = { index: Math.max(0, Math.floor(isNum(d.site.index) ? d.site.index : 0)), seed: d.site.seed | 0, biome: d.site.biome };
    if (d.mineOutdated)
      generateUnderground(makeRng(site.seed));
    else {
      // The core lives in the grid; older saves get it placed now
      const rc = d.relocationCore;
      if (isPlainObject(rc) && isNum(rc.r) && isNum(rc.c))
        relocationCore = { r: rc.r | 0, c: rc.c | 0, revealed: !!rc.revealed, found: !!rc.found };
      undergroundGrid = d.grid.map(row => Array.from(row, ch => ch.charCodeAt(0) - 48));
      gadgetChambers = d.gadgetChambers
        .filter(ch => ch.r >= 0 && ch.r < GRID_ROWS - 1 && ch.c >= 0 && ch.c < GRID_COLS - 1)
        .map(ch => ({ r: ch.r, c: ch.c, gadgetType: ch.gadgetType, revealed: !!ch.revealed }));
      if (!relocationCore.found && !d.grid.some(row => row.indexOf(String.fromCharCode(48 + TILE_CORE)) >= 0))
        placeRelocationCore(makeRng(site.seed ^ 0x5eed));
      restoreChests(d);
      initTileHP();
      for (const p of d.partialHP)
        if (Array.isArray(p) && tileHP[p[0]] && isNum(p[2]) && tileMaxHP[p[0]][p[1]] > 0)
          tileHP[p[0]][p[1]] = Math.max(0, Math.min(tileMaxHP[p[0]][p[1]], p[2]));
    }

    domeHP = d.domeHP;
    maxDomeHP = d.maxDomeHP;
    carried = d.carried;
    carryCapacity = d.carryCapacity;
    weaponDamage = d.weaponDamage;
    fireRate = d.fireRate;
    drillSpeed = d.drillSpeed;
    moveStepInterval = d.moveStepInterval;
    if (!d.mineOutdated) {
      drillX = d.drillX;
      drillY = d.drillY;
    }
    turretAngle = d.turretAngle;
    Object.assign(resources, d.resources);
    Object.assign(upgradeTreeLevels, d.upgradeTreeLevels);
    if (isPlainObject(d.upgradeLevels))
      absorbLegacyUpgrades(d.upgradeLevels);
    waveNumber = d.waveNumber;
    waveTimer = d.waveTimer;
    waveActive = !!d.waveActive;
    siteNights = isNum(d.siteNights) ? Math.max(0, Math.floor(d.siteNights)) : waveNumber;
    if (isPlainObject(d.world) && isNum(d.world.day) && isNum(d.world.t))
      world = { day: Math.max(1, Math.floor(d.world.day)), t: Math.max(0, Math.min(0.999, d.world.t)), bursts: Math.max(0, Math.min(3, d.world.bursts | 0)), warned: !!d.world.warned };
    else {
      // Older saves: one day per survived wave, morning of the next
      world = newWorld();
      world.day = Math.max(1, Math.floor(d.waveNumber) + 1);
    }
    computeSkyLight();
    score = d.score;
    // Older saves only knew walkers, armoured walkers, bosses and flyers
    enemies = d.enemies.map(e => {
      const o = Object.assign({}, e);
      if (!ENEMY_TYPES[o.type])
        o.type = o.boss ? 'behemoth' : (o.type === 'flyer' ? 'flyer' : (o.armored ? 'crawler' : 'walker'));
      if (!isNum(o.size)) o.size = 20;
      if (!isNum(o.speed)) o.speed = 20;
      if (!isNum(o.damage)) o.damage = 2;
      o.phase = o.phase || 'approach';
      o.t = isNum(o.t) ? o.t : 0;
      return o;
    });
    droppedResources = d.mineOutdated ? [] : d.droppedResources.map(dr => Object.assign({ age: 0 }, dr));
    primaryGadget = d.primaryGadget;
    primaryGadgetState = Object.assign({}, d.primaryGadgetState);
    foundGadgets = d.foundGadgets.filter(g => typeof g === 'string');
    unlockedTools = Object.assign({}, d.unlockedTools);
    // Tools bought on the old tools panel are the same nodes in the tree
    for (const t of TOOL_DEFS)
      if (unlockedTools[t.key] && TREE_NODE_BY_ID[t.key])
        upgradeTreeLevels[t.key] = TREE_NODE_BY_ID[t.key].maxLevel;
    activeToolKey = typeof d.activeToolKey === 'string' ? d.activeToolKey : null;
    Object.assign(toolState, d.toolState);
    restoreBombs(d);

    currentView = d.view === VIEW_UNDERGROUND && !d.mineOutdated ? VIEW_UNDERGROUND : VIEW_SURFACE;
    if (isPlainObject(d.weather) && WEATHER[d.weather.kind] && isNum(d.weather.timeLeft))
      weather = { kind: d.weather.kind, intensity: 1, timeLeft: Math.max(1, d.weather.timeLeft) };
    if (isNum(d.snowCover))
      snowCover = Math.max(0, Math.min(1, d.snowCover));
    if (Array.isArray(d.meteorOre))
      meteorOre = d.meteorOre.filter(o => isPlainObject(o) && isNum(o.x) && isNum(o.amount) && typeof o.type === 'string' && o.type in resources)
        .slice(0, 14).map(o => ({ x: o.x, y: DOME_Y + 10, type: o.type, amount: o.amount, age: 0 }));
    syncDrones();
    if (currentView === VIEW_UNDERGROUND) {
      cameraX = Math.max(0, Math.min(GRID_COLS * TILE_SIZE - CANVAS_W, drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2));
      cameraY = Math.max(0, Math.min(GRID_ROWS * TILE_SIZE - CANVAS_H, drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2));
    }
    autosaveTimer = 0;
    state = STATE_PLAYING;
    // Saved on the way to a site: finish the landing
    if (d.landing) {
      landingPending = true;
      startCinematic('arrive');
    }
    updateWindowTitle();
  }

  // Secret chests of the site; saves from before chests get theirs hidden now
  function restoreChests(d) {
    if (!Array.isArray(d.chests)) {
      placeSecretChests(makeRng(chestSeed()));
      return;
    }
    chests = d.chests
      .filter(ch => isPlainObject(ch) && isNum(ch.r) && isNum(ch.c) && ch.r >= 0 && ch.r < GRID_ROWS && ch.c >= 0 && ch.c < GRID_COLS)
      .slice(0, CHEST_BANDS.length)
      .map((ch, i) => ({
        r: ch.r | 0, c: ch.c | 0, band: isNum(ch.band) ? Math.max(0, Math.min(2, ch.band | 0)) : i,
        kind: MINIGAME_KINDS.includes(ch.kind) ? ch.kind : MINIGAME_KINDS[i % 3],
        revealed: !!ch.revealed, opened: !!ch.opened, cooldown: isNum(ch.cooldown) ? Math.max(0, Math.min(CHEST_RETRY, ch.cooldown)) : 0
      }));
    // The grid and the list agree: unopened chests sit in the rock
    for (const ch of chests)
      if (!ch.opened)
        undergroundGrid[ch.r][ch.c] = TILE_CHEST;
    for (let r = 0; r < GRID_ROWS; ++r)
      for (let c = 0; c < GRID_COLS; ++c)
        if (undergroundGrid[r][c] === TILE_CHEST && !chestAt(r, c))
          undergroundGrid[r][c] = TILE_DIRT;
  }

  // Bomb stock and the bombs lying in the mine; blast charges of older saves become bombs
  function restoreBombs(d) {
    const b = d.bombs;
    if (isPlainObject(b)) {
      if (Array.isArray(b.inv))
        bombInv = BOMB_TIERS.map((_, i) => Math.max(0, Math.min(99, Math.floor(Number(b.inv[i]) || 0))));
      if (isNum(b.sel))
        bombSel = Math.max(0, Math.min(BOMB_TIERS.length - 1, Math.floor(b.sel)));
      if (Array.isArray(b.placed) && !d.mineOutdated)
        placedBombs = b.placed
          .filter(x => isPlainObject(x) && isNum(x.r) && isNum(x.c) && isNum(x.tier) && isNum(x.fuse) && x.r >= 0 && x.r < GRID_ROWS && x.c >= 0 && x.c < GRID_COLS && BOMB_TIERS[x.tier | 0])
          .slice(0, 40)
          .map(x => ({ r: x.r | 0, c: x.c | 0, tier: x.tier | 0, fuse: Math.max(0.3, Math.min(10, x.fuse)), maxFuse: isNum(x.maxFuse) ? Math.max(1, x.maxFuse) : BOMB_BASE_FUSE, sticky: !!x.sticky, fly: null }));
    }
    const charges = primaryGadgetState.blastCharges;
    if (isNum(charges) && charges > 0)
      bombInv[1] += Math.min(99, Math.floor(charges));
    delete primaryGadgetState.blastCharges;
  }

  function continueRun() {
    const d = readSavedRun();
    if (!d)
      return;
    try {
      restoreRun(d);
      saveNotice = '';
      if (d.migratedFrom) {
        saveRun();
        try { localStorage.removeItem(STORAGE_SAVE_V1); } catch (_) {}
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 110, 'Saved run updated: your dome landed on a fresh, deeper site', { color: '#ffd75a', font: 'bold 24px sans-serif' });
      }
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
    [TILE_RUBY]:     { seedChance: 0.011, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    // Deep signature ores: plentiful in their own stratum
    [TILE_TITANIUM]:  { seedChance: 0.042, minLen: 3, maxLen: 6, depthLenBonus: 1 },
    [TILE_SAPPHIRE]:  { seedChance: 0.038, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_URANIUM]:   { seedChance: 0.036, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_AMETHYST]:  { seedChance: 0.034, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_OPAL]:      { seedChance: 0.032, minLen: 2, maxLen: 4, depthLenBonus: 1 },
    [TILE_VOIDSTONE]: { seedChance: 0.030, minLen: 1, maxLen: 4, depthLenBonus: 1 }
  };

  // Ore availability at a row. The classic ores keep their old depth curves
  // across the upper ten strata and thin out below; each deep stratum adds
  // its own signature ore (with a short tail into the next layer)
  function getOreSpawnChance(row, tileType) {
    const d = row / (DEEP_STRATUM * STRATUM_ROWS);        // 0..1 over the upper strata
    const deep = Math.max(0, d - 1) * DEEP_STRATUM;       // strata below the upper ones
    const ramp = (start, end) => d < start ? 0 : d > end ? 1 : (d - start) / (end - start);
    const bell = (center, width) => Math.max(0, 1 - Math.pow((d - center) / width, 2));
    const common = Math.max(0, 1 - deep * 0.8);           // base metals fade fast below bedrock
    const mid = Math.max(0.1, 1 - deep * 0.45);           // precious metals thin out
    const rare = Math.max(0.15, 1 - deep * 0.22);         // gems linger
    switch (tileType) {
      case TILE_IRON:     return (0.4 + 0.6 * bell(0.2, 0.3) - 0.2 * ramp(0.6, 1.0)) * common;
      case TILE_COPPER:   return (0.1 + 0.9 * bell(0.25, 0.3)) * common;
      case TILE_TIN:      return (0.05 + 0.95 * bell(0.3, 0.3)) * common;
      case TILE_COAL:     return (0.1 + 0.9 * bell(0.35, 0.35)) * common;
      case TILE_LEAD:     return bell(0.45, 0.25);
      case TILE_SILVER:   return ramp(0.2, 0.5) * (1 - 0.4 * ramp(0.8, 1.0)) * common;
      case TILE_WATER:    return (0.3 + 0.7 * bell(0.4, 0.35)) * Math.max(0.2, common);
      case TILE_COBALT:   return (ramp(0.2, 0.5) + 0.5 * ramp(0.5, 0.9)) * mid;
      case TILE_GOLD:     return ramp(0.35, 0.7) * (1 - 0.3 * ramp(0.9, 1.0)) * mid;
      case TILE_QUARTZ:   return ramp(0.3, 0.65) * mid;
      case TILE_REDSTONE: return ramp(0.55, 0.85) * mid;
      case TILE_EMERALD:  return ramp(0.6, 0.9) * rare;
      case TILE_DIAMOND:  return ramp(0.65, 0.95) * rare;
      case TILE_RUBY:     return ramp(0.63, 0.92) * rare;
      default: {
        // Signature ore of a deep stratum
        const home = DEPTH_TIERS.findIndex(t => t.ore === tileType);
        if (home < 0) return 0;
        const st = row / STRATUM_ROWS;
        if (st < home - 0.25) return 0;
        if (st < home + 1) return 1;
        return Math.max(0, 0.35 - (st - home - 1) * 0.15);
      }
    }
  }

  // Grow a vein from a seed point using random walk / BFS flood
  function growVein(grid, seedR, seedC, tileType, targetLen, rand) {
    const placed = [];
    const frontier = [{ r: seedR, c: seedC }];
    const visited = new Set();
    visited.add(seedR * GRID_COLS + seedC);

    while (placed.length < targetLen && frontier.length > 0) {
      // Pick a random frontier cell
      const idx = Math.floor(rand() * frontier.length);
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

  // Build a fresh mine; rand is the site's seeded generator
  function generateUnderground(rand) {
    rand = rand || Math.random;
    undergroundGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r)
      undergroundGrid.push(new Array(GRID_COLS).fill(TILE_DIRT));

    // Ore veins: every cell may seed one vein, the type weighted by depth and biome
    const oreBias = currentBiome().ore;
    for (let r = 0; r < GRID_ROWS; ++r) {
      const d = r / GRID_ROWS;
      const weights = RESOURCE_TILES.map(t => getOreSpawnChance(r, t) * (oreBias[TILE_LABELS[t]] || 1));
      for (let c = 0; c < GRID_COLS; ++c) {
        if (undergroundGrid[r][c] !== TILE_DIRT) continue;
        for (let i = 0; i < RESOURCE_TILES.length; ++i) {
          const depthWeight = weights[i];
          if (depthWeight <= 0) continue;
          const oreType = RESOURCE_TILES[i];
          const cfg = VEIN_CONFIG[oreType];
          // Divide by the average vein length to keep the overall density similar
          const avgLen = (cfg.minLen + cfg.maxLen) / 2;
          if (rand() < (cfg.seedChance * depthWeight) / avgLen) {
            const maxL = cfg.maxLen + Math.floor(d * cfg.depthLenBonus);
            const targetLen = cfg.minLen + Math.floor(rand() * (maxL - cfg.minLen + 1));
            growVein(undergroundGrid, r, c, oreType, targetLen, rand);
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

    // Gadget chambers (2x2 TILE_GADGET blocks), one band of depth each so they
    // are spread over all strata
    gadgetChambers = [];
    const chamberCount = 10 + Math.floor(rand() * 5);
    for (let n = 0; n < chamberCount; ++n) {
      const bandTop = 2 + Math.floor(n * (GRID_ROWS - 4) / chamberCount);
      const bandH = Math.max(2, Math.floor((GRID_ROWS - 4) / chamberCount));
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; ++attempt) {
        const cr = Math.min(GRID_ROWS - 2, bandTop + Math.floor(rand() * bandH));
        const cc = 1 + Math.floor(rand() * (GRID_COLS - 3));
        let ok = true;
        for (let dr = 0; dr < 2 && ok; ++dr)
          for (let dc = 0; dc < 2 && ok; ++dc) {
            if (cr + dr < 2 && cc + dc >= spawnCol - 2 && cc + dc <= spawnCol + 1) ok = false;
            if (undergroundGrid[cr + dr][cc + dc] === TILE_GADGET) ok = false;
          }
        if (!ok) continue;
        const available = MINE_GADGETS.filter(g => !gadgetChambers.some(ch => ch.gadgetType === g));
        const pool = available.length > 0 ? available : MINE_GADGETS;
        const gadgetType = pool[Math.floor(rand() * pool.length)];
        gadgetChambers.push({ r: cr, c: cc, gadgetType, revealed: false });
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            undergroundGrid[cr + dr][cc + dc] = TILE_GADGET;
        placed = true;
      }
    }

    placeRelocationCore(rand);
    placeSecretChests(makeRng(chestSeed()));
    initTileHP();
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
    resources = emptyResources();
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

    enemies = [];
    waveNumber = 0;
    siteNights = 0;
    waveTimer = 0;
    waveActive = false;
    world = newWorld();
    banners = [];
    computeSkyLight();
    weather = { kind: 'clear', intensity: 1, timeLeft: 50 };
    snowCover = 0;
    enemyShots = [];
    shockwaves = [];
    domeInvulnerable = 0;
    emergencyCooldown = 0;
    lastStandUsed = false;
    keeperIdle = 0;
    dashCooldown = 0;
    rainDrops = [];
    snowFlakes = [];
    leaves = [];
    meteors = [];
    bolts = [];
    meteorOre = [];
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

    // Bombs
    bombInv = [0, 0, 0, 0, 0];
    bombSel = 0;
    placedBombs = [];
    surfaceBombs = [];
    pendingBlasts = [];
    blasts = [];
    bombThrowMode = false;
    keeperStun = 0;
    stateBeforeCraft = null;

    // Drones are rebuilt from the upgrades
    drones = [];
    gunDrones = [];
    repairBot = null;

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

    // A new run lands on a fresh site
    cinematic = null;
    landingPending = false;
    site = newSite(0, (Math.random() * 0x7fffffff) | 0);
    generateUnderground(makeRng(site.seed));
    updateWindowTitle();
  }

  function startGameAfterGadgetSelect() {
    SZ.GameAudio.play('select');
    initPrimaryGadgetState();
    syncDrones();
    // Every run begins with the dome landing on its first site
    landingPending = true;
    startCinematic('arrive');
  }

  function initPrimaryGadgetState() {
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
        primaryGadgetState = {};
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
    clearTooltip();
    quickPanelHover = null;

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
            if (undergroundGrid[r][c] !== TILE_EMPTY && undergroundGrid[r][c] !== TILE_DIRT && undergroundGrid[r][c] !== TILE_GADGET && undergroundGrid[r][c] !== TILE_CORE && undergroundGrid[r][c] !== TILE_CHEST)
              candidates.push({ r, c });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const sx = pick.c * TILE_SIZE + Math.random() * TILE_SIZE - cameraX;
          const sy = pick.r * TILE_SIZE + Math.random() * TILE_SIZE - cameraY;
          particles.sparkle(sx, sy, 1, { color: TILE_HIGHLIGHT_COLORS[undergroundGrid[pick.r][pick.c]] || '#fff', speed: 0.5 });
        }
      }
    }

    // Update enemy animation phases
    for (const e of enemies) {
      if (e.wobblePhase === undefined) {
        e.wobblePhase = Math.random() * TWO_PI;
        e.legPhase = Math.random() * TWO_PI;
        e.eyeBlinkTimer = 2 + Math.random() * 3;
        e.eyeBlinking = false;
      }
      const hf = enemyHitFlash.get(e);
      if (hf > 0)
        enemyHitFlash.set(e, Math.max(0, hf - dt * 6));
      e.wobblePhase += dt * 4;
      e.legPhase += dt * 8;
      if (e.type === 'flyer' || e.type === 'diver' || e.type === 'queen')
        e.wingPhase = (e.wingPhase || 0) + dt * (e.type === 'queen' ? 18 : 12);
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
    if (e.hidden) return;
    enemyHitFlash.set(e, 0.8);
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
    // Armour plates soak part of every hit (at least a quarter always gets through)
    if (e.armor > 0 && amount > 0) {
      const soaked = Math.min(e.armor, amount * 0.75);
      amount -= soaked;
      if (soaked > 0 && currentView === VIEW_SURFACE && Math.random() < 0.5) {
        particles.sparkle(e.x, e.y - (e.size || 20) * 0.3, 3, { color: '#fff0c0', speed: 2 });
        SZ.GameAudio.play('hit', { pitch: 1.8, volume: 0.35 });
      }
    }
    e.hp -= amount;
  }

  /* ======================================================================
     PATHFINDING (BFS for underground navigation)
     ====================================================================== */

  // Breadth-first search through tunnels; typed arrays are reused between calls
  let pathPrev = null, pathQueue = null, pathSeen = null, pathStamp = 0;
  function findPath(fromCol, fromRow, toCol, toRow) {
    if (fromCol === toCol && fromRow === toRow) return [];
    if (toCol < 0 || toCol >= GRID_COLS || toRow < 0 || toRow >= GRID_ROWS) return null;
    if (fromCol < 0 || fromCol >= GRID_COLS || fromRow < 0 || fromRow >= GRID_ROWS) return null;
    if (undergroundGrid[toRow][toCol] !== TILE_EMPTY) return null;
    const N = GRID_ROWS * GRID_COLS;
    if (!pathPrev || pathPrev.length !== N) {
      pathPrev = new Int32Array(N);
      pathQueue = new Int32Array(N);
      pathSeen = new Uint32Array(N);
      pathStamp = 0;
    }
    const stamp = ++pathStamp;
    const start = fromRow * GRID_COLS + fromCol, goal = toRow * GRID_COLS + toCol;
    let head = 0, tail = 0;
    pathQueue[tail++] = start;
    pathSeen[start] = stamp;
    pathPrev[start] = -1;
    while (head < tail) {
      const cur = pathQueue[head++];
      if (cur === goal) {
        const path = [];
        for (let i = goal; i !== start; i = pathPrev[i])
          path.push({ col: i % GRID_COLS, row: (i / GRID_COLS) | 0 });
        return path.reverse();
      }
      const r = (cur / GRID_COLS) | 0, c = cur - r * GRID_COLS;
      for (let k = 0; k < 4; ++k) {
        const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
        const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        const ni = nr * GRID_COLS + nc;
        if (pathSeen[ni] === stamp || undergroundGrid[nr][nc] !== TILE_EMPTY) continue;
        pathSeen[ni] = stamp;
        pathPrev[ni] = cur;
        pathQueue[tail++] = ni;
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
     WORLD TIME -- day and night, sun and moon, nightly attacks
     ====================================================================== */

  const DAY_LENGTH = 160;            // seconds for a full day and night
  const DUSK_WARNING = 15;           // seconds of warning before nightfall
  const MOON_PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  // t: 0 = sunrise .. dayFraction() = nightfall .. 1 = next sunrise
  let world = { day: 1, t: 0.03, bursts: 0, warned: false };
  let banners = [];                  // announcements: { title, sub, color, icon, age }

  function newWorld() {
    return { day: 1, t: 0.03, bursts: 0, warned: false };
  }

  // Share of the cycle that is daylight (long summer days, short winter days)
  function dayFraction() {
    return currentSeason().dayFraction;
  }

  function moonPhaseIndex(day) {
    return ((day - 1) % 8 + 8) % 8;
  }

  // Night strength from the moon: 0.8 at new moon .. 1.25 at full moon
  function moonStrength(day) {
    return 0.8 + 0.45 * (1 - Math.abs(moonPhaseIndex(day) - 4) / 4);
  }

  function isNight() {
    return world.t >= dayFraction();
  }

  function secondsToNight() {
    return Math.max(0, (dayFraction() - world.t) * DAY_LENGTH);
  }

  function secondsToDawn() {
    return Math.max(0, (1 - world.t) * DAY_LENGTH);
  }

  function smoothstep(a, b, x) {
    const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  }

  function computeSkyLight() {
    const f = dayFraction(), t = world.t, edge = 0.05;
    daylight = t < f ? smoothstep(0, edge, t) * (1 - smoothstep(f - edge, f, t)) : 0;
    // Glow straddles sunrise (t = 0, wrapping) and sunset (t = f)
    const dist = Math.min(Math.abs(t - (f - 0.01)), Math.abs(t - 0.015), Math.abs(t - 1.015));
    duskGlow = Math.max(0, 1 - dist / 0.07) * 0.85;
  }

  // Centre-top announcement panel (one at a time, queued)
  function announce(title, sub, color, icon) {
    if (banners.length > 4) banners.shift();
    banners.push({ title, sub: sub || '', color: color || UI.gold, icon: icon || null, age: 0 });
  }

  function startNight() {
    world.bursts = 1;
    lastStandUsed = false;
    const phase = MOON_PHASES[moonPhaseIndex(world.day)];
    const strength = moonStrength(world.day);
    spawnWave(false);
    announce(`Night ${world.day}`, phase + (strength > 1.1 ? ' - the swarm is restless' : (strength < 0.9 ? ' - a quiet night' : '')), '#9ab8ff', 'moon');
    SZ.GameAudio.tone(196, 0.5, 'triangle', 0.12);
    SZ.GameAudio.tone(147, 0.8, 'triangle', 0.12, 0.35);
  }

  function startDay() {
    if ((world.day - 1) % SEASON_DAYS === 0)
      seasonBegins();
    else
      announce(`Day ${world.day}`, 'Sunrise - monsters left in the open burn away', '#ffd75a', 'sun');
    SZ.GameAudio.play('levelup', { pitch: 1.15, volume: 0.8 });
    saveRun();
  }

  function updateWorldTime(dt) {
    const f = dayFraction();
    const before = world.t;
    world.t += dt / DAY_LENGTH;
    if (!world.warned && before < f && (f - world.t) * DAY_LENGTH <= DUSK_WARNING) {
      world.warned = true;
      announce('Dusk is coming', `Night falls in ${DUSK_WARNING} s - get back to the dome!`, '#ff9a50', 'sun');
      SZ.GameAudio.tone(330, 0.25, 'square', 0.07);
      SZ.GameAudio.tone(262, 0.4, 'square', 0.07, 0.25);
    }
    if (before < f && world.t >= f)
      startNight();
    if (world.t >= f) {
      const nightPos = (world.t - f) / (1 - f);
      if (world.bursts === 1 && nightPos >= 0.4) {
        world.bursts = 2;
        spawnWave(true);
      } else if (world.bursts === 2 && nightPos >= 0.72) {
        world.bursts = 3;
        spawnWave(true);
      }
    }
    if (world.t >= 1) {
      world.t -= 1;
      ++world.day;
      world.bursts = 0;
      world.warned = false;
      startDay();
    }
    computeSkyLight();
    // Sunlight burns the monsters still out in the open (bosses resist)
    if (daylight > 0.3)
      for (const e of enemies) {
        if (e.boss) continue;
        e.hp -= e.maxHP * 0.07 * daylight * dt;
        if (Math.random() < dt * 6)
          particles.trail(e.x + (Math.random() - 0.5) * (e.size || 16), e.y - (e.size || 16) * 0.5, { vx: (Math.random() - 0.5) * 0.6, vy: -1.2, color: Math.random() < 0.5 ? '#ffb040' : '#706060', life: 0.5, size: 2, gravity: -0.02 });
      }
    // The current banner ages; a queue behind it shortens its stay
    if (banners.length) {
      const b = banners[0];
      b.age += dt;
      b.life = banners.length > 1 ? Math.min(b.life || 3.6, Math.max(1.6, b.age + 0.5)) : (b.life || 3.6);
      if (b.age > b.life)
        banners.shift();
    }
  }

  // Path of the lit part of the moon for a phase index (0 new .. 4 full .. 7)
  function moonLitPath(cx, cy, R, phaseIdx) {
    const p = phaseIdx / 8;
    const k = Math.cos(p * TWO_PI);
    ctx.beginPath();
    if (p < 0.5) {
      ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(cx, cy, R * Math.abs(k), R, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    } else {
      ctx.arc(cx, cy, R, Math.PI / 2, Math.PI * 1.5, false);
      ctx.ellipse(cx, cy, R * Math.abs(k), R, 0, -Math.PI / 2, Math.PI / 2, k > 0);
    }
    ctx.closePath();
  }

  function drawMoonDisc(cx, cy, R, phaseIdx, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    // Earthshine on the dark side
    ctx.fillStyle = 'rgba(70,84,120,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.fill();
    if (phaseIdx !== 0) {
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#fbfcff');
      g.addColorStop(0.7, '#cfd8ee');
      g.addColorStop(1, '#8e9ac0');
      moonLitPath(cx, cy, R, phaseIdx);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(90,100,140,0.32)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.1, -0.35, 0.1], [-0.15, 0.4, 0.12], [0.4, -0.05, 0.09]]) {
        ctx.beginPath();
        ctx.arc(cx + dx * R, cy + dy * R, r * R, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(200,215,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawSunDisc(x, y, R, low, alpha) {
    drawGlow(low > 0.5 ? '#ff9a50' : '#fff0b0', x, y, R * 5, 0.55 * alpha);
    drawGlow('#ffffff', x, y, R * 2.2, 0.5 * alpha);
    ctx.save();
    ctx.globalAlpha *= alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, low > 0.5 ? '#ffd080' : '#fff6c8');
    g.addColorStop(1, low > 0.5 ? '#ff9040' : '#ffe080');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // Position on the sky arc for progress u (0 rising at the left .. 1 setting at the right)
  function skyArc(u) {
    return { x: 70 + u * (CANVAS_W - 140), y: DOME_Y + 40 - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) * (DOME_Y - 170) };
  }

  function drawCelestials() {
    const f = dayFraction(), t = world.t;
    if (t < f + 0.02) {
      const u = t / f;
      const p = skyArc(u);
      drawSunDisc(p.x, p.y, 34, 1 - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI), Math.min(1, daylight + duskGlow));
    }
    if (t > f - 0.03) {
      const u = (t - f) / (1 - f);
      const p = skyArc(u);
      const ph = moonPhaseIndex(world.day);
      const a = 1 - daylight;
      drawGlow('#c8d8ff', p.x, p.y, 120, (0.12 + 0.3 * (1 - Math.abs(ph - 4) / 4)) * a);
      drawMoonDisc(p.x, p.y, 30, ph, a);
    }
  }

  // Small sun or moon icon for HUD rows
  function drawTimeIcon(x, y, size, night) {
    if (night)
      drawMoonDisc(x, y, size / 2, Math.max(1, moonPhaseIndex(world.day)), 1);
    else {
      ctx.save();
      ctx.strokeStyle = '#ffd060';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; ++i) {
        const a = i * Math.PI / 4 + animTime * 0.3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * size * 0.42, y + Math.sin(a) * size * 0.42);
        ctx.lineTo(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, size * 0.34);
      g.addColorStop(0, '#fff8d0');
      g.addColorStop(1, '#ffb020');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.34, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBanner() {
    const b = banners[0];
    if (!b || (state !== STATE_PLAYING && state !== STATE_PAUSED)) return;
    const inA = Math.min(1, b.age / 0.35), outA = Math.min(1, ((b.life || 3.6) - b.age) / 0.5);
    const a = Math.max(0, Math.min(inA, outA));
    if (a <= 0) return;
    const w = 600, h = 76, x = CANVAS_W / 2 - w / 2, y = 108 - (1 - inA) * 20;
    ctx.save();
    ctx.globalAlpha = a;
    drawPanel(x, y, w, h, { accent: b.color, radius: 14, glow: true });
    if (b.icon === 'moon' || b.icon === 'sun')
      drawTimeIcon(x + 42, y + h / 2, 40, b.icon === 'moon');
    else if (b.icon)
      drawSprite(b.icon, x + 42, y + h / 2, 40);
    const tx = x + (b.icon ? 78 : 24), tw = w - (b.icon ? 78 : 24) - 20;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(b.title, tx, y + 26, tw, 26, { weight: 'bold', color: b.color });
    fitText(b.sub, tx, y + 54, tw, 17, { color: UI.text });
    ctx.restore();
  }

  // Day, time and moon (top left on the surface)
  function drawClockPanel() {
    const x = 16, y = 16, w = 330, h = 112;
    const night = isNight();
    const warn = !night && secondsToNight() <= DUSK_WARNING;
    drawPanel(x, y, w, h, { accent: night ? '#7a9aff' : (warn ? '#ff8a50' : '#ffc860') });
    // Dial: sky disc with the sun or moon
    const dx = x + 38, dy = y + 40;
    const sg = ctx.createLinearGradient(0, dy - 24, 0, dy + 24);
    sg.addColorStop(0, night ? '#0a1030' : '#3a7ad0');
    sg.addColorStop(1, night ? '#2a2050' : (duskGlow > 0.3 ? '#ff9a60' : '#a8d0f0'));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(dx, dy, 24, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawTimeIcon(dx, dy, 30, night);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(`Day ${world.day}`, x + 72, y + 28, 110, 24, { weight: 'bold', color: UI.text });
    const season = currentSeason();
    const dayInSeason = (world.day - 1) % SEASON_DAYS + 1;
    drawChip(`${season.name} ${dayInSeason}/${SEASON_DAYS}`, x + w - 12, y + 16, 24, { align: 'right', px: 14, maxW: 140, bg: hexToRgba(season.color, 0.16), border: hexToRgba(season.color, 0.55), color: season.color });
    ctx.textAlign = 'left';
    if (night) {
      const left = enemies.length;
      fitText(left ? `${left} ${left === 1 ? 'monster' : 'monsters'} attacking` : 'The night is quiet...', x + 72, y + 55, w - 86, 16, { weight: 'bold', color: left ? '#ff8a7a' : UI.textDim });
      ctx.textAlign = 'right';
      fitText(`dawn ${Math.ceil(secondsToDawn())}s`, x + w - 14, y + 55, 90, 14, { color: UI.textDim });
      drawMeter(x + 72, y + 72, w - 86, 10, (world.t - dayFraction()) / (1 - dayFraction()), '#7a9aff');
    } else {
      const sec = Math.ceil(secondsToNight());
      const pulse = warn ? 0.6 + Math.sin(animTime * 8) * 0.4 : 1;
      fitText(warn ? 'Get to the dome!' : 'Daytime: mine and build', x + 72, y + 55, w - 86 - 70, 16, { weight: 'bold', color: warn ? `rgba(255,140,80,${pulse})` : UI.textDim });
      ctx.textAlign = 'right';
      fitText(`${sec}s`, x + w - 14, y + 55, 64, 18, { weight: 'bold', color: warn ? '#ff9a50' : '#ffc870' });
      drawMeter(x + 72, y + 72, w - 86, 10, world.t / dayFraction(), warn ? '#ff7a40' : '#ffc040');
    }
    // Moon phase and weather
    const ph = moonPhaseIndex(world.day);
    drawMoonDisc(x + 22, y + 96, 7, Math.max(1, ph), ph === 0 ? 0.5 : 1);
    ctx.textAlign = 'left';
    fitText(MOON_PHASES[ph], x + 36, y + 97, 130, 14, { color: '#b8c8ff' });
    const wk = WEATHER[weather.kind];
    ctx.textAlign = 'right';
    const ww = fitText(wk.name.replace('!', ''), x + w - 14, y + 97, 130, 14, { weight: 'bold', color: wk.color });
    if (wk.icon)
      drawSprite(wk.icon, x + w - 26 - ww, y + 96, 16);
    else
      drawTimeIcon(x + w - 26 - ww, y + 96, 14, false);
  }

  // Time line inside the mine's cargo panel
  function drawMineClock(x, y, w) {
    const night = isNight();
    const warn = night || secondsToNight() <= DUSK_WARNING;
    const text = night
      ? `Night ${world.day}: ${enemies.length} at the dome`
      : `Day ${world.day}: night in ${Math.ceil(secondsToNight())}s`;
    if (warn) {
      roundRectPath(x - 4, y - 13, w + 8, 26, 8);
      ctx.fillStyle = `rgba(120,30,20,${0.45 + Math.sin(animTime * 6) * 0.2})`;
      ctx.fill();
    }
    drawTimeIcon(x + 9, y, 18, night);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(text, x + 24, y + 1, w - 24, 15, { weight: 'bold', color: warn ? '#ffb0a0' : UI.text });
  }

  /* ======================================================================
     SEASONS AND WEATHER
     ====================================================================== */

  const SEASON_DAYS = 4;             // days per season, four seasons per year
  // dayFraction: share of daylight; count / hp / size / damage / speed scale the night's monsters
  const SEASONS = [
    { key: 'spring', name: 'Spring', color: '#8affa0', dayFraction: 0.6, count: 1.3, hp: 0.7, size: 0.85, damage: 0.85, speed: 1,
      desc: 'Blossoms lure more monsters - smaller and weaker ones', weather: { rain: 1.6, snow: 0.05, blizzard: 0, storm: 0.7, meteor: 1 } },
    { key: 'summer', name: 'Summer', color: '#ffd060', dayFraction: 0.7, count: 1, hp: 1, size: 1, damage: 1, speed: 1.15,
      desc: 'Long days - the heat makes monsters quicker', weather: { rain: 0.6, snow: 0, blizzard: 0, storm: 1.4, meteor: 1.3 } },
    { key: 'autumn', name: 'Autumn', color: '#ff9a40', dayFraction: 0.55, count: 1.1, hp: 1.1, size: 1, damage: 1, speed: 1,
      desc: 'Falling leaves and storms', weather: { rain: 1.6, snow: 0.3, blizzard: 0.1, storm: 1.7, meteor: 1 } },
    { key: 'winter', name: 'Winter', color: '#bfe4ff', dayFraction: 0.45, count: 0.6, hp: 1.75, size: 1.15, damage: 1.3, speed: 0.95,
      desc: 'Short days - few monsters, but much tougher', weather: { rain: 0.1, snow: 2.6, blizzard: 1.6, storm: 0.1, meteor: 1 } }
  ];
  const WEATHER = {
    clear: { name: 'Clear skies', sub: 'Calm weather', icon: null, color: '#ffe080' },
    rain: { name: 'Rain', sub: 'Mud slows the monsters a little', icon: 'water', color: '#7ab8ff' },
    snow: { name: 'Snowfall', sub: 'Snow piles up and slows the monsters', icon: 'snowflake', color: '#d8f0ff' },
    blizzard: { name: 'Blizzard!', sub: 'Poor sight, slow monsters - and a stiff turret', icon: 'snowflake', color: '#e8f8ff' },
    storm: { name: 'Thunderstorm!', sub: 'Lightning strikes monsters - and sometimes the dome', icon: 'bolt', color: '#ffe060' },
    meteor: { name: 'Meteor shower!', sub: 'Impacts hurt monsters and leave ore - click it to collect', icon: 'meteor', color: '#ffae60' }
  };
  let weather = { kind: 'clear', intensity: 0, timeLeft: 40 };
  let snowCover = 0;                 // 0..1 snow lying on the ground and dome
  let rainDrops = [], snowFlakes = [], leaves = [], meteors = [], bolts = [], meteorOre = [];
  let lightningFlash = 0, lightningTimer = 4, meteorTimer = 2;

  function seasonOf(day) {
    return SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length];
  }

  function currentSeason() {
    return seasonOf(world.day);
  }

  function windStrength() {
    const w = { clear: 0.15, rain: 0.5, snow: 0.35, blizzard: 2.2, storm: 1.4, meteor: 0.2 }[weather.kind] || 0;
    return w * weather.intensity + (currentSeason().key === 'autumn' ? 0.4 : 0);
  }

  // Movement factor for monsters from the weather and the snow on the ground
  function weatherSlow() {
    let k = 1;
    if (weather.kind === 'rain' || weather.kind === 'storm') k -= 0.1 * weather.intensity;
    if (weather.kind === 'blizzard') k -= 0.3 * weather.intensity;
    k -= 0.15 * snowCover;
    return Math.max(0.5, k);
  }

  function rollWeather() {
    const s = currentSeason(), b = currentBiome();
    const weights = { clear: 3.2 };
    for (const k of ['rain', 'snow', 'blizzard', 'storm', 'meteor'])
      weights[k] = (s.weather[k] || 0) * (b.weather[k] === undefined ? 1 : b.weather[k]) * (k === 'meteor' ? 0.5 : 0.75);
    // No blizzard without a cold season or biome
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    let kind = 'clear';
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    return kind;
  }

  function setWeather(kind, duration) {
    const changed = kind !== weather.kind;
    weather.kind = kind;
    weather.timeLeft = duration || (kind === 'clear' ? 35 + Math.random() * 40 : 28 + Math.random() * 36);
    if (changed) {
      weather.intensity = 0;
      const w = WEATHER[kind];
      announce(w.name, w.sub, w.color, w.icon || 'sun');
      if (kind === 'storm')
        SZ.GameAudio.noise(1.2, 0.15, 'lowpass', 300, 80);
    }
  }

  function seasonBegins() {
    const s = currentSeason();
    announce(`${s.name} begins`, s.desc, s.color, s.key === 'winter' ? 'snowflake' : (s.key === 'spring' ? 'flower' : (s.key === 'autumn' ? 'leaf' : 'sun')));
  }

  function strikeLightning() {
    // Most bolts seek a monster; some hit open ground or the dome
    let x, target = null, domeHit = false;
    const r = Math.random();
    const visible = enemies.filter(e => !e.hidden);
    if (visible.length && r < 0.65) {
      target = visible[Math.floor(Math.random() * visible.length)];
      x = target.x;
    } else if (r < 0.7) {
      x = DOME_X + (Math.random() - 0.5) * 60;
      domeHit = true;
    } else
      x = 80 + Math.random() * (CANVAS_W - 160);
    const y = target ? target.y : (domeHit ? DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (x - DOME_X) * (x - DOME_X))) : DOME_Y);
    const pts = [[x + (Math.random() - 0.5) * 200, -10]];
    for (let i = 1; i <= 9; ++i)
      pts.push([pts[0][0] + (x - pts[0][0]) * i / 9 + (Math.random() - 0.5) * 40 * (i < 9 ? 1 : 0), -10 + (y + 10) * i / 9]);
    bolts.push({ pts, life: 0.55 });
    lightningFlash = 1;
    const dmg = 22 + waveNumber * 2;
    for (const e of enemies)
      if (Math.hypot(e.x - x, e.y - y) < 80 && !e.hidden) {
        applyDamageToEnemy(e, dmg);
        e.stunTimer = Math.max(e.stunTimer || 0, 0.6);
      }
    if (domeHit)
      damageDome(3, x, y, 'Lightning hit the dome!');
    if (currentView === VIEW_SURFACE) {
      particles.burst(x, y, 14, { color: '#fff6b0', speed: 3.5, life: 0.4 });
      screenShake.trigger(5, 200);
    }
    SZ.GameAudio.noise(0.9, 0.22, 'lowpass', 900, 60, 0.05);
    SZ.GameAudio.sweep(90, 40, 0.6, 'sine', 0.2, 0.05);
  }

  function spawnMeteor() {
    let tx = 60 + Math.random() * (CANVAS_W - 120);
    // Most meteors heading for the dome miss it
    if (Math.abs(tx - DOME_X) < DOME_RADIUS + 10 && Math.random() < 0.7)
      tx += (tx < DOME_X ? -1 : 1) * (DOME_RADIUS + 40 + Math.random() * 120);
    const fromLeft = Math.random() < 0.5;
    meteors.push({ x: tx + (fromLeft ? -1 : 1) * (300 + Math.random() * 200), y: -40, tx, ty: DOME_Y + 6, t: 0, dur: 1.1 + Math.random() * 0.5, size: 6 + Math.random() * 6 });
  }

  function meteorImpact(m) {
    const dmg = 26 + waveNumber * 2;
    for (const e of enemies)
      if (!e.hidden && Math.hypot(e.x - m.tx, e.y - m.ty) < 95)
        applyDamageToEnemy(e, dmg);
    if (Math.abs(m.tx - DOME_X) < DOME_RADIUS + 10)
      damageDome(4, m.tx, DOME_Y - DOME_RADIUS * 0.6, 'Meteor hit the dome!');
    else if (meteorOre.length < 14) {
      // A chunk of space rock with ore in it
      const pool = ['iron', 'iron', 'cobalt', 'copper', 'silver', 'gold', 'quartz', 'titanium', 'sapphire'];
      meteorOre.push({ x: m.tx, y: DOME_Y + 10, type: pool[Math.floor(Math.random() * pool.length)], amount: 6 + Math.floor(Math.random() * 10), age: 0 });
    }
    if (currentView === VIEW_SURFACE) {
      particles.burst(m.tx, m.ty, 24, { color: '#ffb060', speed: 4, life: 0.6, gravity: 0.08 });
      particles.burst(m.tx, m.ty, 10, { color: '#6a5a50', speed: 2.5, life: 0.8, gravity: 0.1 });
      screenShake.trigger(6, 220);
      SZ.GameAudio.play('explode', { pitch: 1.3, volume: 0.6 });
    }
  }

  function collectMeteorOre(o, byDrone) {
    resources[o.type] = (resources[o.type] || 0) + o.amount;
    meteorOre.splice(meteorOre.indexOf(o), 1);
    if (currentView === VIEW_SURFACE) {
      floatingText.add(o.x, o.y - 30, `${byDrone ? 'Drone: ' : ''}+${o.amount} ${o.type}`, { color: '#ffd080', font: 'bold 20px sans-serif' });
      particles.sparkle(o.x, o.y, 8, { color: '#ffd080', speed: 2 });
      SZ.GameAudio.play('pickup', { pitch: 1.1 });
    }
  }

  function updateWeather(dt) {
    weather.timeLeft -= dt;
    if (weather.timeLeft <= 0)
      setWeather(rollWeather());
    weather.intensity = Math.min(1, weather.intensity + dt / 4);
    const k = weather.kind, I = weather.intensity;
    const season = currentSeason().key;
    // Snow builds up while it snows and melts otherwise (slowly in winter)
    if (k === 'snow' || k === 'blizzard')
      snowCover = Math.min(1, snowCover + dt * (k === 'blizzard' ? 0.03 : 0.015) * I);
    else
      snowCover = Math.max(season === 'winter' ? 0.35 * (k === 'clear' ? 1 : 0.6) : 0, snowCover - dt * (season === 'summer' ? 0.03 : 0.008));
    if (season === 'winter' && snowCover < 0.35)
      snowCover = Math.min(0.35, snowCover + dt * 0.01);

    if (k === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 2.5 + Math.random() * 5;
        strikeLightning();
      }
    }
    if (k === 'meteor') {
      meteorTimer -= dt;
      if (meteorTimer <= 0) {
        meteorTimer = 0.7 + Math.random() * 1.6;
        spawnMeteor();
      }
    }
    for (let i = meteors.length - 1; i >= 0; --i) {
      const m = meteors[i];
      m.t += dt / m.dur;
      if (m.t >= 1) {
        meteorImpact(m);
        meteors.splice(i, 1);
      }
    }
    for (let i = bolts.length - 1; i >= 0; --i) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    lightningFlash = Math.max(0, lightningFlash - dt * 3);
    // Docked couriers fetch meteor ore lying near the dome
    for (const o of meteorOre) {
      o.age += dt;
      if (o.age > 6 && drones.some(d => d.state === 'dock')) {
        collectMeteorOre(o, true);
        break;
      }
    }

    // Visual particles only while the surface is on screen
    if (currentView !== VIEW_SURFACE) return;
    const wind = windStrength();
    const rainRate = (k === 'rain' ? 260 : (k === 'storm' ? 420 : 0)) * I;
    const snowRate = (k === 'snow' ? 70 : (k === 'blizzard' ? 260 : 0)) * I;
    for (let n = rainRate * dt + Math.random(); n >= 1 && rainDrops.length < 500; --n)
      rainDrops.push({ x: Math.random() * (CANVAS_W + 300) - 150, y: -20 - Math.random() * 60, vy: 900 + Math.random() * 300, len: 14 + Math.random() * 10 });
    for (let n = snowRate * dt + Math.random(); n >= 1 && snowFlakes.length < 600; --n)
      snowFlakes.push({ x: Math.random() * (CANVAS_W + 400) - 200, y: -10, vy: 40 + Math.random() * 50, s: 1.5 + Math.random() * 2.5, p: Math.random() * TWO_PI });
    if (season === 'autumn' && leaves.length < 26 && Math.random() < dt * 3)
      leaves.push({ x: Math.random() * CANVAS_W, y: -10, vy: 30 + Math.random() * 30, p: Math.random() * TWO_PI, r: Math.random() * TWO_PI, c: ['#e07a20', '#c04a18', '#e8b030', '#a83a10'][Math.floor(Math.random() * 4)] });
    for (let i = rainDrops.length - 1; i >= 0; --i) {
      const d = rainDrops[i];
      d.y += d.vy * dt;
      d.x += wind * 160 * dt;
      if (d.y > DOME_Y + 4 + (i % 7) * 4 || (Math.hypot(d.x - DOME_X, d.y - DOME_Y) < DOME_RADIUS + 2 && d.y < DOME_Y)) {
        if (Math.random() < 0.25)
          particles.trail(d.x, d.y, { vx: (Math.random() - 0.5) * 1.2, vy: -0.8 - Math.random(), color: 'rgba(170,200,255,0.8)', life: 0.18, size: 1 });
        rainDrops.splice(i, 1);
      }
    }
    for (let i = snowFlakes.length - 1; i >= 0; --i) {
      const f = snowFlakes[i];
      f.p += dt * 2;
      f.y += f.vy * dt * (k === 'blizzard' ? 1.8 : 1);
      f.x += (Math.sin(f.p) * 20 + wind * 120) * dt;
      if (f.y > DOME_Y + 6 + (i % 5) * 6) snowFlakes.splice(i, 1);
    }
    for (let i = leaves.length - 1; i >= 0; --i) {
      const l = leaves[i];
      l.p += dt * 2.5;
      l.r += dt * 3;
      l.y += l.vy * dt;
      l.x += (Math.sin(l.p) * 40 + wind * 60) * dt;
      if (l.y > DOME_Y + 10) leaves.splice(i, 1);
    }
  }

  // Precipitation, lightning, meteors and fog over the surface scene
  function drawWeather() {
    const k = weather.kind, I = weather.intensity;
    const wind = windStrength();
    // Clouds darken the scene while it rains, snows or storms
    const gloom = ({ rain: 0.22, storm: 0.38, blizzard: 0.2, snow: 0.1 }[k] || 0) * I;
    if (gloom > 0) {
      ctx.fillStyle = k === 'blizzard' || k === 'snow' ? `rgba(200,215,235,${gloom * 0.6})` : `rgba(10,16,30,${gloom})`;
      ctx.fillRect(0, 0, CANVAS_W, DOME_Y);
    }
    if (rainDrops.length) {
      ctx.strokeStyle = 'rgba(180,205,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of rainDrops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - wind * 0.18 * d.len, d.y - d.len);
      }
      ctx.stroke();
    }
    if (snowFlakes.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of snowFlakes)
        ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
    }
    for (const l of leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.scale(1, Math.abs(Math.sin(l.p)) * 0.7 + 0.3);
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3, 0, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
    for (const m of meteors) {
      const x = m.x + (m.tx - m.x) * m.t, y = m.y + (m.ty - m.y) * m.t;
      const dx = (m.tx - m.x), dy = (m.ty - m.y), len = Math.hypot(dx, dy);
      const tx = x - dx / len * 140, ty = y - dy / len * 140;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(255,160,80,0)');
      g.addColorStop(1, 'rgba(255,220,160,0.9)');
      ctx.strokeStyle = g;
      ctx.lineWidth = m.size * 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      drawGlow('#ffa040', x, y, m.size * 5, 0.9);
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(x, y, m.size * 0.6, 0, TWO_PI);
      ctx.fill();
    }
    for (const b of bolts) {
      // Wide glow along the jagged path, then the crackling core
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (const [wdt, col] of [[16, `rgba(140,170,255,${Math.min(0.35, b.life)})`], [6, `rgba(220,230,255,${Math.min(0.8, b.life * 2)})`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        b.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.stroke();
      }
      ctx.restore();
      const end = b.pts[b.pts.length - 1];
      drawGlow('#d8e0ff', end[0], end[1], 60, Math.min(1, b.life * 2));
      SZ.GameEffects.drawElectricArc(ctx, b.pts[0][0], b.pts[0][1], b.pts[b.pts.length - 1][0], b.pts[b.pts.length - 1][1], {
        segments: 10, jitter: 18, color: `rgba(255,255,230,${Math.min(1, b.life * 4)})`, glowColor: `rgba(160,190,255,${Math.min(1, b.life * 3)})`, width: 3, glowWidth: 12
      });
    }
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(230,235,255,${lightningFlash * 0.35})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    // Blizzard fog: the far field disappears in white
    if (k === 'blizzard') {
      const g = ctx.createLinearGradient(0, 0, 0, DOME_Y);
      g.addColorStop(0, `rgba(225,235,248,${0.55 * I})`);
      g.addColorStop(1, `rgba(225,235,248,${0.3 * I})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    // Summer heat haze over the ground
    if (currentSeason().key === 'summer' && daylight > 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.08 * daylight;
      ctx.fillStyle = '#fff0c0';
      for (let i = 0; i < 6; ++i) {
        const y = DOME_Y - 70 + i * 12;
        ctx.fillRect(Math.sin(animTime * 2 + i) * 20 - 20, y, CANVAS_W + 40, 3);
      }
      ctx.restore();
    }
  }

  // Meteor ore lying on the ground (click to collect)
  function drawMeteorOre() {
    for (const o of meteorOre) {
      const pulse = 0.6 + Math.sin(animTime * 4 + o.x) * 0.3;
      drawGlow('#ffae60', o.x, o.y - 6, 40, pulse * 0.75);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y - 4, 19, 13, 0, 0, TWO_PI);
      ctx.fill();
      const rg = ctx.createRadialGradient(o.x - 5, o.y - 10, 2, o.x, o.y - 4, 18);
      rg.addColorStop(0, '#8a6a5a');
      rg.addColorStop(1, '#3a2a24');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y - 5, 17, 11, 0, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,150,60,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(o.x - 12, o.y - 2);
      ctx.lineTo(o.x - 4, o.y - 7);
      ctx.lineTo(o.x + 3, o.y - 3);
      ctx.lineTo(o.x + 12, o.y - 8);
      ctx.stroke();
      drawSprite(o.type, o.x, o.y - 8, 20);
      if (Math.random() < 0.03)
        particles.sparkle(o.x + (Math.random() - 0.5) * 24, o.y - 8, 1, { color: '#ffd080', speed: 0.6 });
    }
  }

  function hitMeteorOre(mx, my) {
    for (const o of meteorOre)
      if (Math.abs(mx - o.x) < 22 && Math.abs(my - o.y) < 22)
        return o;
    return null;
  }

  // Snow lying on the ground line and on top of the dome
  function drawSnowCover() {
    if (snowCover <= 0.02) return;
    const a = Math.min(1, snowCover * 1.2);
    ctx.fillStyle = `rgba(244,250,255,${0.85 * a})`;
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y + 4);
    for (let x = 0; x <= CANVAS_W; x += 20)
      ctx.lineTo(x, DOME_Y - snowCover * 6 - Math.abs(Math.sin(x * 0.05)) * 3 * snowCover);
    ctx.lineTo(CANVAS_W, DOME_Y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(230,240,255,${0.3 * a})`;
    ctx.fillRect(0, DOME_Y + 4, CANVAS_W, 30 * snowCover);
    // Cap on the dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 3, Math.PI * 1.22, Math.PI * 1.78);
    ctx.lineWidth = 3 + snowCover * 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(248,252,255,${0.9 * a})`;
    ctx.stroke();
    ctx.restore();
  }

  /* ======================================================================
     RELOCATION -- the Relocation Core, packing up, flight and landing
     ====================================================================== */

  const RELOCATE_KEEP = 0.75;        // share of every resource that comes along
  const THREAT_PER_SITE = 4;
  // Steps of the shared landing sequence; a relocation flies there first
  const CINEMATIC_STEPS = {
    relocate: [['pack', 2.0], ['liftoff', 2.4], ['flight', 3.6], ['descent', 2.6], ['touchdown', 0.5], ['unpack', 2.2]],
    arrive: [['descent', 2.6], ['touchdown', 0.5], ['unpack', 2.2]]
  };
  let relocationCore = { r: 0, c: 0, revealed: false, found: false };
  let cinematic = null;              // { steps, i, t, oldSite }
  let landingPending = false;        // the dome is still on its way to the current site
  let relocateHover = null;          // 'button' | 'yes' | 'no'

  // Hide the core in the lower strata (deeper on every new site)
  function placeRelocationCore(rand) {
    const stratum = Math.min(STRATUM_COUNT - 3, 6 + site.index);
    for (let attempt = 0; attempt < 200; ++attempt) {
      const r = stratum * STRATUM_ROWS + 2 + Math.floor(rand() * (STRATUM_ROWS * 2 - 4));
      const c = 8 + Math.floor(rand() * (GRID_COLS - 16));
      if (undergroundGrid[r][c] === TILE_GADGET) continue;
      undergroundGrid[r][c] = TILE_CORE;
      relocationCore = { r, c, revealed: false, found: false };
      return;
    }
  }

  function coreDepthHint() {
    return Math.floor(relocationCore.r / STRATUM_ROWS) * STRATUM_ROWS;
  }

  function collectRelocationCore(tx, ty) {
    relocationCore.found = true;
    relocationCore.revealed = true;
    SZ.GameAudio.play('powerup');
    SZ.GameAudio.play('win', { pitch: 1.2, volume: 0.6 });
    particles.burst(tx, ty, 40, { color: '#7ae8ff', speed: 4, life: 0.8 });
    particles.sparkle(tx, ty, 20, { color: '#ffe080', speed: 2.5 });
    screenShake.trigger(8, 300);
    floatingText.add(tx, ty - 50, 'RELOCATION CORE!', { color: '#7ae8ff', font: 'bold 30px sans-serif' });
    announce('Relocation Core recovered!', 'Relocate from the surface whenever you are ready - or stay and keep mining', '#7ae8ff', 'core');
    saveRun();
  }

  // Why the dome cannot leave right now (null when it can)
  function relocateBlocker() {
    if (enemies.length > 0)
      return 'Not while monsters attack the dome';
    if (isNight() && world.bursts < 3)
      return 'More monsters are coming tonight - wait for dawn';
    return null;
  }

  function relocateButtonRect() {
    return { x: 16, y: 140, w: 330, h: 54 };
  }

  function hitRelocateButton(mx, my) {
    if (!relocationCore.found || currentView !== VIEW_SURFACE || state !== STATE_PLAYING) return false;
    const b = relocateButtonRect();
    return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }

  function requestRelocation() {
    if (!relocationCore.found || state !== STATE_PLAYING) return;
    const why = relocateBlocker();
    if (why) {
      SZ.GameAudio.play('error');
      announce('Cannot relocate yet', why, '#ff9a6a', 'flight');
      return;
    }
    if (currentView !== VIEW_SURFACE) {
      SZ.GameAudio.play('error');
      announce('Cannot relocate yet', 'Return to the dome first', '#ff9a6a', 'flight');
      return;
    }
    state = STATE_CONFIRM;
    relocateHover = null;
    clearTooltip();
    SZ.GameAudio.play('select');
  }

  function confirmButtons() {
    const w = 260, h = 58, y = CANVAS_H / 2 + 70;
    return [
      { id: 'yes', label: 'Lift off', x: CANVAS_W / 2 - w - 14, y, w, h },
      { id: 'no', label: 'Stay here', x: CANVAS_W / 2 + 14, y, w, h }
    ];
  }

  function answerRelocation(yes) {
    if (state !== STATE_CONFIRM) return;
    if (yes)
      beginRelocation();
    else {
      state = STATE_PLAYING;
      SZ.GameAudio.play('click');
    }
  }

  // Pack up: the new site is generated now; the flight and landing follow
  function beginRelocation() {
    const oldSite = site;
    for (const k in resources)
      resources[k] = Math.floor(resources[k] * RELOCATE_KEEP);
    score += 500 * (oldSite.index + 1);
    let seed = (Math.random() * 0x7fffffff) | 0;
    for (let i = 0; i < 12 && newSite(0, seed).biome === oldSite.biome; ++i)
      seed = (seed * 48271 + 11) & 0x7fffffff;
    site = newSite(oldSite.index + 1, seed);
    generateUnderground(makeRng(site.seed));

    // Everything that belonged to the old site stays behind
    cancelMining();
    clearMoveTarget();
    drillX = Math.floor(GRID_COLS / 2);
    drillY = 0;
    cameraX = cameraY = 0;
    carried = 0;
    droppedResources = [];
    enemies = [];
    enemyShots = [];
    shockwaves = [];
    projectiles = [];
    meteorOre = [];
    meteors = [];
    bolts = [];
    placedBombs = [];
    surfaceBombs = [];
    pendingBlasts = [];
    blasts = [];
    bombThrowMode = false;
    keeperStun = 0;
    snowCover = 0;
    weather = { kind: 'clear', intensity: 1, timeLeft: 50 };
    waveActive = false;
    domeHP = maxDomeHP;
    siteNights = 0;
    world.day += 1;
    world.t = 0.03;
    world.bursts = 0;
    world.warned = false;
    computeSkyLight();
    for (const d of drones) {
      d.state = 'dock';
      d.job = null;
      d.path = null;
      d.cargo = 0;
      d.timer = 1;
    }
    initPrimaryGadgetState();
    currentView = VIEW_SURFACE;
    landingPending = true;
    startCinematic('relocate', oldSite);
    saveRun();
    updateWindowTitle();
  }

  function startCinematic(kind, oldSite) {
    cinematic = { kind, steps: CINEMATIC_STEPS[kind], i: 0, t: 0, oldSite: oldSite || null, sounds: {} };
    state = STATE_CINEMATIC;
    clearTooltip();
    banners = [];
  }

  function cinematicStep() {
    return cinematic ? cinematic.steps[cinematic.i][0] : null;
  }

  function finishCinematic() {
    if (!cinematic) return;
    const relocated = cinematic.kind === 'relocate';
    cinematic = null;
    landingPending = false;
    state = STATE_PLAYING;
    const B = currentBiome();
    if (relocated)
      announce(`Site ${site.index + 1}: ${B.name}`, `Threat +${THREAT_PER_SITE} - the monsters here are tougher. Find this site's Relocation Core.`, '#ffe080', 'flight');
    else
      announce('Landing site: ' + B.name, 'Mine by day, defend the dome at night', '#ffe080', 'dome');
    SZ.GameAudio.play('select', { pitch: 1.2 });
    saveRun();
  }

  function skipCinematic() {
    if (state !== STATE_CINEMATIC) return;
    SZ.GameAudio.play('click');
    finishCinematic();
  }

  function updateCinematic(dt) {
    if (!cinematic) return;
    const c = cinematic;
    c.t += dt;
    const [name, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    const once = (id, fn) => {
      if (!c.sounds[id]) {
        c.sounds[id] = true;
        fn();
      }
    };
    const base = DOME_Y + 14;
    if (name === 'pack') {
      once('pack', () => SZ.GameAudio.sweep(500, 180, 1.2, 'square', 0.05));
      if (k > 0.55) once('legs', () => SZ.GameAudio.play('thud', { pitch: 1.4 }));
    } else if (name === 'liftoff') {
      once('lift', () => {
        SZ.GameAudio.noise(2.2, 0.18, 'lowpass', 300, 1800);
        SZ.GameAudio.sweep(60, 220, 2, 'sawtooth', 0.06);
      });
      screenShake.trigger(3 * (1 - k), 60);
      if (Math.random() < 0.8)
        particles.trail(DOME_X + (Math.random() - 0.5) * 260, base + 6, { vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 1.5, color: Math.random() < 0.5 ? '#9a8a7a' : '#6a5a4a', life: 0.9, size: 3 + Math.random() * 4, gravity: -0.01 });
    } else if (name === 'flight') {
      once('flight', () => SZ.GameAudio.play('whoosh', { pitch: 0.6 }));
    } else if (name === 'descent') {
      once('descent', () => {
        SZ.GameAudio.noise(2.4, 0.14, 'lowpass', 1600, 300);
        SZ.GameAudio.sweep(220, 70, 2.4, 'sawtooth', 0.05);
      });
      if (k > 0.6 && Math.random() < 0.9)
        particles.trail(DOME_X + (Math.random() - 0.5) * 300, base + 6, { vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 1.2, color: '#8a7a6a', life: 0.8, size: 3 + Math.random() * 4, gravity: -0.01 });
    } else if (name === 'touchdown') {
      once('touch', () => {
        SZ.GameAudio.play('thud', { pitch: 0.6 });
        SZ.GameAudio.play('explode', { pitch: 0.4, volume: 0.5 });
        screenShake.trigger(10, 320);
        for (const side of [-1, 1])
          for (let i = 0; i < 26; ++i)
            particles.trail(DOME_X + side * (60 + Math.random() * 90), base + 4, { vx: side * (2 + Math.random() * 6), vy: -Math.random() * 2.5, color: Math.random() < 0.5 ? '#a8987e' : '#7a6a58', life: 1 + Math.random() * 0.5, size: 3 + Math.random() * 5, gravity: 0.02 });
      });
    } else if (name === 'unpack') {
      if (k > 0.05) once('legs2', () => SZ.GameAudio.play('thud', { pitch: 1.5 }));
      if (k > 0.3) once('glass', () => SZ.GameAudio.sweep(200, 700, 0.8, 'triangle', 0.06));
      if (k > 0.62) once('turret', () => SZ.GameAudio.play('click', { pitch: 0.6 }));
      if (k > 0.8) once('lights', () => SZ.GameAudio.play('powerup', { pitch: 1.3, volume: 0.6 }));
    }
    if (c.t >= dur) {
      c.t = 0;
      ++c.i;
      if (c.i >= c.steps.length)
        finishCinematic();
    }
  }

  // Dome pose for the current cinematic step: lift (px above the ground), unpack (0..1), legs (0..1), thrust (0..1)
  function cinematicRig() {
    const c = cinematic;
    const [name, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    const ease = (x) => x * x * (3 - 2 * x);
    switch (name) {
      case 'pack': return { lift: 0, unpack: 1 - ease(Math.min(1, k * 1.25)), legs: k > 0.55 ? ease((k - 0.55) / 0.45) : 0, thrust: k > 0.8 ? (k - 0.8) * 2 : 0 };
      case 'liftoff': return { lift: Math.pow(k, 2.2) * (DOME_Y + 220), unpack: 0, legs: 1 - ease(Math.min(1, k * 3)), thrust: 0.6 + k * 0.4 };
      case 'descent': return { lift: Math.pow(1 - k, 2) * (DOME_Y + 220), unpack: 0, legs: k > 0.55 ? ease((k - 0.55) / 0.45) : 0, thrust: 0.35 + (1 - k) * 0.5 + (k > 0.75 ? 0.4 : 0) };
      case 'touchdown': return { lift: 0, unpack: 0, legs: 1, thrust: Math.max(0, 0.5 - k), squash: Math.sin(k * Math.PI) * 0.06 };
      case 'unpack': return { lift: 0, unpack: ease(k), legs: 1 - ease(Math.min(1, k * 2.5)) * 0.85, thrust: 0 };
      default: return { lift: 0, unpack: 1, legs: 0, thrust: 0 };
    }
  }

  function drawThrusters(rig) {
    if (rig.thrust <= 0.01) return;
    const y = DOME_Y + 14 - rig.lift;
    for (const ox of [-72, 0, 72]) {
      const x = DOME_X + ox;
      const len = (34 + rig.thrust * 70) * (0.85 + Math.random() * 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, `rgba(255,255,230,${0.95 * rig.thrust})`);
      g.addColorStop(0.3, `rgba(255,190,80,${0.8 * rig.thrust})`);
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 11, y);
      ctx.quadraticCurveTo(x - 6, y + len * 0.6, x, y + len);
      ctx.quadraticCurveTo(x + 6, y + len * 0.6, x + 11, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawGlow('#ffa040', x, y + 12, 34 + rig.thrust * 30, 0.7 * rig.thrust);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.fillRect(x - 13, y - 2, 26, 9);
      ctx.fillStyle = '#5a6a88';
      ctx.fillRect(x - 11, y - 1, 22, 6);
    }
    if (rig.lift < 160 && Math.random() < 0.6)
      particles.trail(DOME_X + (Math.random() - 0.5) * 200, DOME_Y + 10, { vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 1.5, color: '#8a7a6a', life: 0.8, size: 3 + Math.random() * 3, gravity: -0.01 });
  }

  // Planet map shown during the flight between sites
  function drawFlightMap(k) {
    const c = cinematic;
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#04060e');
    g.addColorStop(1, '#0a1022');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const rng = makeRng((c.oldSite ? c.oldSite.seed : 1) ^ site.seed);
    for (let i = 0; i < 160; ++i) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.5})`;
      ctx.fillRect(rng() * CANVAS_W, rng() * CANVAS_H * 0.5, 1.5, 1.5);
    }
    // The planet's curve with patches of land in biome colours
    const cx = CANVAS_W / 2, cy = CANVAS_H + 900, R = 1400;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    const pg = ctx.createRadialGradient(cx, cy - R * 0.6, R * 0.2, cx, cy, R);
    pg.addColorStop(0, '#2a3a5a');
    pg.addColorStop(1, '#141c30');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < 70; ++i) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.1, d = R - 40 - rng() * 520;
      const b = BIOMES[BIOME_KEYS[Math.floor(rng() * BIOME_KEYS.length)]];
      ctx.fillStyle = hexToRgba(b.ground.day[1], 0.16 + rng() * 0.12);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 24 + rng() * 50, 10 + rng() * 22, rng() * 0.6 - 0.3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,180,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    drawGlow('#5aa8ff', cx, cy - R, 600, 0.12);

    // Route from the old site to the new one
    const p0 = { x: 280, y: 700 }, p1 = { x: CANVAS_W - 280, y: 690 };
    const ctrl = { x: CANVAS_W / 2, y: 280 };
    const at = (t) => ({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p1.y });
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -animTime * 40;
    ctx.strokeStyle = 'rgba(255,224,128,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, p1.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const sites = [[p0, c.oldSite || site, false], [p1, site, true]];
    for (const [p, s, isNew] of sites) {
      const b = BIOMES[s.biome];
      drawGlow(b.ground.day[0], p.x, p.y, 50, 0.6);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = isNew ? '#ffe080' : '#8a9ab8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, TWO_PI);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(`Site ${s.index + 1}`, p.x, p.y + 38, 260, 22, { weight: 'bold', color: isNew ? UI.gold : UI.textDim });
      fitText(b.name, p.x, p.y + 64, 260, 18, { color: isNew ? UI.text : UI.textMute });
    }
    const t = k * k * (3 - 2 * k);
    const pos = at(t), ahead = at(Math.min(1, t + 0.02));
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(Math.atan2(ahead.y - pos.y, ahead.x - pos.x) * 0.3);
    drawGlow('#ffa040', -20, 10, 40, 0.7);
    drawSprite('flight', 0, 0, 56);
    ctx.restore();
    if (Math.random() < 0.6)
      particles.trail(pos.x - 14, pos.y + 16, { vx: -1.5, vy: 0.5, color: '#ffb060', life: 0.5, size: 2.5 });
    drawHeadline('Relocating', CANVAS_W / 2, 150, 800, 56, '#ffe080', '#e0a020');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`Upgrades, drones and ${Math.round(RELOCATE_KEEP * 100)}% of the resources are on board  ·  threat +${THREAT_PER_SITE} at the new site`, CANVAS_W / 2, 214, 1100, 20, { color: UI.textDim });
  }

  function drawCinematic() {
    const c = cinematic;
    const name = cinematicStep();
    const [, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    if (name === 'flight') {
      drawFlightMap(k);
    } else {
      // Pack up and lift off at the old site, descend and unpack at the new one
      const useOld = (name === 'pack' || name === 'liftoff') && c.oldSite;
      const saved = site;
      if (useOld) site = c.oldSite;
      drawSky();
      drawGroundLayer();
      const rig = cinematicRig();
      drawThrusters(rig);
      drawDome(rig);
      site = saved;
    }
    // Letterbox bars and caption
    const bar = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, bar);
    ctx.fillRect(0, CANVAS_H - bar, CANVAS_W, bar);
    const captions = {
      pack: 'Packing up the dome...', liftoff: 'Lift off!', flight: '',
      descent: `Approaching ${currentBiome().name}`, touchdown: 'Touchdown', unpack: 'Unpacking the dome...'
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (captions[name])
      fitText(captions[name], CANVAS_W / 2, bar / 2 + 2, 900, 26, { weight: 'bold', color: '#ffe8b0' });
    drawKeyHints([{ key: 'Click', label: 'Skip' }, { key: 'Space', label: 'Skip' }, { key: 'Esc', label: 'Skip' }], CANVAS_W / 2, CANVAS_H - bar / 2, 500);
  }

  // Relocate button under the clock panel (surface)
  function drawRelocateButton() {
    if (!relocationCore.found) return;
    const b = relocateButtonRect();
    const why = relocateBlocker();
    const hover = relocateHover === 'button';
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, 12);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (why) {
      g.addColorStop(0, 'rgba(40,44,60,0.92)');
      g.addColorStop(1, 'rgba(24,26,36,0.92)');
    } else {
      g.addColorStop(0, hover ? '#3a9ae8' : '#2a7ad0');
      g.addColorStop(1, hover ? '#1a5aa8' : '#16468a');
    }
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = why ? 'rgba(120,130,160,0.5)' : (hover ? '#cfe8ff' : `rgba(150,210,255,${0.6 + Math.sin(animTime * 4) * 0.3})`);
    ctx.stroke();
    drawSprite('flight', b.x + 30, b.y + b.h / 2, 36, why ? 0.5 : 1);
    const kw = drawChip('L', b.x + b.w - 10, b.y + 15, 24, { align: 'right', px: 13, bg: 'rgba(0,0,0,0.4)', border: 'rgba(255,255,255,0.25)', color: UI.text });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Relocate', b.x + 56, b.y + 19, b.w - 70 - kw, 21, { weight: 'bold', color: why ? UI.textMute : '#ffffff' });
    fitText(why || 'Fly the dome to a new site', b.x + 56, b.y + 40, b.w - 66, 14, { color: why ? '#e0a080' : '#cfe4ff' });
    ctx.restore();
  }

  function drawRelocateConfirm() {
    drawScrim(0.62);
    const pw = 700, ph = 420, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2 - 20;
    drawPanel(px, py, pw, ph, { accent: '#5ab8ff', radius: 16, title: 'Relocate the dome?', titlePx: 28, headerH: 64, titleRight: `Site ${site.index + 1} → ${site.index + 2}` });
    drawSprite('flight', px + 70, py + 150, 80);
    const rows = [
      ['check', 'Keep every upgrade, drone and gadget'],
      ['bag', `Keep ${Math.round(RELOCATE_KEEP * 100)}% of every resource`],
      ['pickaxe', 'A fresh mine in a new biome - with a new Relocation Core'],
      ['swords', `The monsters there are tougher: threat +${THREAT_PER_SITE}`]
    ];
    rows.forEach(([icon, text], i) => {
      const y = py + 100 + i * 44;
      drawSprite(icon, px + 150, y, 24);
      drawTextBlock(text, px + 172, y - 18, pw - 172 - 30, 36, 19, { valign: 'middle', color: UI.text, minPx: 13 });
    });
    for (const b of confirmButtons())
      drawButton(b, b.id === 'yes', relocateHover === b.id);
    drawKeyHints([{ key: 'Enter', label: 'Lift off' }, { key: 'Esc', label: 'Stay' }], CANVAS_W / 2, py + ph - 26, pw - 80);
  }

  /* ======================================================================
     ENEMY WAVES
     ====================================================================== */

  /* -- Monster roster -- */
  // hp / speed / damage scale the night's base stats, cost is the share of the
  // night's budget, level the threat level the type first appears at
  const ENEMY_TYPES = {
    walker:   { name: 'Walker', move: 'ground', hp: 1, speed: 1, damage: 1, size: [20, 28], cost: 1, level: 0, weight: 10, score: 1, attack: 1, color: '#e0403a',
      desc: 'Plods to the dome and bites it' },
    swarmer:  { name: 'Swarmer', move: 'ground', hp: 0.3, speed: 1.9, damage: 0.4, size: [9, 12], cost: 0.6, level: 3, weight: 5, score: 0.5, attack: 0.9, group: [2, 5], color: '#c8d040',
      desc: 'Tiny and fast, always in packs' },
    flyer:    { name: 'Flyer', move: 'air', hp: 0.6, speed: 1.3, damage: 0.8, size: [14, 20], cost: 0.9, level: 3, weight: 6, score: 1, attack: 1, color: '#a050c8',
      desc: 'Flies straight at the dome' },
    crawler:  { name: 'Armored Crawler', move: 'ground', hp: 2.4, speed: 0.55, damage: 1.6, size: [26, 32], cost: 2.2, level: 4, weight: 5, score: 2.5, attack: 1.4, armor: 3, color: '#a08a5a',
      desc: 'Armor plates shrug off part of every hit' },
    diver:    { name: 'Diver', move: 'dive', hp: 0.7, speed: 1.2, damage: 2.2, size: [16, 20], cost: 1.4, level: 5, weight: 5, score: 1.5, attack: 1, color: '#3ab0c8',
      desc: 'Circles high, then dives at the dome' },
    burrower: { name: 'Burrower', move: 'burrow', hp: 1.3, speed: 1.15, damage: 1.3, size: [20, 24], cost: 1.4, level: 6, weight: 4, score: 1.5, attack: 1, color: '#d0609a',
      desc: 'Tunnels unseen and pops up beside the dome' },
    spitter:  { name: 'Spitter', move: 'ranged', hp: 0.9, speed: 0.8, damage: 1.2, size: [20, 24], cost: 1.5, level: 7, weight: 4, score: 1.6, attack: 2.6, color: '#60d040',
      desc: 'Keeps its distance and spits acid' },
    splitter: { name: 'Splitter', move: 'ground', hp: 1.5, speed: 0.8, damage: 1.1, size: [24, 28], cost: 1.8, level: 8, weight: 3, score: 1.8, attack: 1, color: '#ff9030',
      desc: 'Bursts into swarmers when killed' },
    mender:   { name: 'Mender', move: 'ground', hp: 1.4, speed: 0.75, damage: 0.9, size: [22, 26], cost: 1.8, level: 9, weight: 3, score: 2, attack: 1.2, color: '#40e0a0',
      desc: 'Regenerates and heals the monsters around it' },
    behemoth: { name: 'Behemoth', move: 'ground', hp: 9, speed: 0.45, damage: 3, size: [46, 54], cost: 0, level: 10, weight: 0, score: 8, attack: 1.6, armor: 2, boss: true, color: '#b81848',
      desc: 'Boss: stomps shockwaves into the dome' },
    queen:    { name: 'Hive Queen', move: 'queen', hp: 7, speed: 0.5, damage: 2.5, size: [36, 42], cost: 0, level: 15, weight: 0, score: 9, attack: 1.2, boss: true, color: '#e040c0',
      desc: 'Boss: hovers over the field dropping swarmers' }
  };
  // Seasons shift the mix
  const SEASON_ENEMY_BIAS = {
    spring: { swarmer: 2.5, splitter: 1.5, crawler: 0.5 },
    summer: { flyer: 1.6, diver: 1.6, spitter: 1.4 },
    autumn: { burrower: 1.8, mender: 1.3, walker: 1.2 },
    winter: { crawler: 2.2, mender: 1.5, swarmer: 0.3, flyer: 0.6 }
  };
  let enemyShots = [];               // acid globs: { x0, y0, tx, ty, t, dur, dmg }
  let shockwaves = [];               // behemoth stomps: { x, r, hit }

  // Threat climbs with every night at a site; every site starts higher than the last
  // Body centre of a ground monster standing on the ground line (its shadow sits at y + 0.75 size)
  function groundY(size) {
    return DOME_Y - size * 0.7;
  }

  function threatLevel() {
    return siteNights + site.index * THREAT_PER_SITE;
  }

  function enemyType(e) {
    return ENEMY_TYPES[e.type] || ENEMY_TYPES.walker;
  }

  function spawnEnemy(key, base, at) {
    const T = ENEMY_TYPES[key];
    const season = currentSeason();
    const size = (T.size[0] + Math.random() * (T.size[1] - T.size[0])) * (T.boss ? 1 : season.size);
    const hp = base.hp * T.hp * (0.88 + Math.random() * 0.24);
    const e = {
      type: key, x: 0, y: 0, hp, maxHP: hp,
      speed: base.speed * T.speed * (0.9 + Math.random() * 0.2),
      damage: Math.max(1, Math.round(base.damage * T.damage)),
      attackTimer: 0.4 + Math.random() * 0.5, stunTimer: 0, size,
      armor: T.armor ? Math.round(T.armor * (1 + base.threat * 0.06)) : 0,
      shield: 0, maxShield: 0, boss: !!T.boss, phase: 'approach', t: 0,
      wobblePhase: Math.random() * TWO_PI, legPhase: Math.random() * TWO_PI, wingPhase: Math.random() * TWO_PI,
      eyeBlinkTimer: 2 + Math.random() * 3, eyeBlinking: false
    };
    if (at) {
      e.x = at.x;
      e.y = at.y;
    } else if (T.move === 'air' || T.move === 'dive' || T.move === 'queen') {
      const angle = Math.PI + 0.15 + Math.random() * (Math.PI - 0.3);
      const dist = 640 + Math.random() * 200;
      e.x = DOME_X + Math.cos(angle) * dist;
      e.y = Math.max(-80, DOME_Y + Math.sin(angle) * dist * 0.75);
      e.hoverX = DOME_X + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200);
      e.hoverY = 230 + Math.random() * 160;
    } else {
      const fromLeft = Math.random() < 0.5;
      e.x = fromLeft ? -60 - Math.random() * 180 : CANVAS_W + 60 + Math.random() * 180;
      e.y = groundY(size) + Math.random() * 10;
      if (T.move === 'burrow') {
        e.hidden = true;
        e.y = DOME_Y + 14;
      }
    }
    // Shields show up as the threat grows
    if (base.threat >= 11 && !T.boss && Math.random() < Math.min(0.3, (base.threat - 10) * 0.05)) {
      e.shield = e.maxShield = Math.floor(hp * 0.5 + base.threat);
    } else if (T.boss) {
      e.shield = e.maxShield = Math.floor(hp * 0.35);
    }
    enemies.push(e);
    return e;
  }

  // The main attack comes at nightfall; reinforcements (smaller, no boss) later in the night
  function spawnWave(reinforcement) {
    if (!reinforcement) {
      ++waveNumber;
      ++siteNights;
    }
    waveActive = true;

    // Recharge shield gadget at wave start
    if (!reinforcement && primaryGadget === 'shield') {
      primaryGadgetState.active = true;
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
    }

    const threat = Math.max(1, threatLevel());
    const season = currentSeason();
    const base = {
      threat,
      hp: (8 + (threat - 1) * 3) * season.hp * (1 + 0.3 * site.index),
      damage: (2 + (threat - 1) * 0.8) * season.damage * (1 + 0.2 * site.index),
      speed: (15 + Math.min(25, threat * 2)) * season.speed
    };
    // The night's budget: grows with the threat, the moon and the season
    let budget = Math.min(24, 2 + threat * 0.8) * moonStrength(world.day) * season.count * (reinforcement ? 0.45 : 1);
    const bias = SEASON_ENEMY_BIAS[season.key] || {};
    const wb = { blizzard: { burrower: 1.6, flyer: 0.5, diver: 0.5 }, storm: { flyer: 0.6, diver: 0.6 } }[weather.kind] || {};
    const pool = Object.keys(ENEMY_TYPES).filter(k => !ENEMY_TYPES[k].boss && ENEMY_TYPES[k].level <= threat);
    const weightOf = (k) => ENEMY_TYPES[k].weight * (bias[k] || 1) * (wb[k] || 1);
    let total = 0;
    for (const k of pool) total += weightOf(k);
    for (let guard = 0; budget > 0.25 && guard < 60; ++guard) {
      let r = Math.random() * total, key = pool[0];
      for (const k of pool) {
        r -= weightOf(k);
        if (r <= 0) {
          key = k;
          break;
        }
      }
      if (ENEMY_TYPES[key].cost > budget + 0.4)
        key = budget >= 1 || !pool.includes('swarmer') ? 'walker' : 'swarmer';
      const T = ENEMY_TYPES[key];
      if (T.group) {
        // Packs grow with the threat and never overspend the budget
        const n = Math.max(1, Math.min(T.group[0] + Math.floor(Math.random() * (T.group[1] - T.group[0] + 1)), 2 + Math.floor(threat / 3), Math.ceil(budget / T.cost)));
        const lead = spawnEnemy(key, base);
        for (let i = 1; i < n; ++i)
          spawnEnemy(key, base, { x: lead.x + (lead.x < DOME_X ? -1 : 1) * i * 22, y: lead.y + (Math.random() - 0.5) * 16 });
        budget -= T.cost * n;
      } else {
        spawnEnemy(key, base);
        budget -= T.cost;
      }
    }

    // A boss every fifth night once the threat is high enough
    if (!reinforcement && siteNights % 5 === 0 && threat >= 10) {
      const bossKey = threat >= 15 && Math.floor(waveNumber / 5) % 2 === 0 ? 'queen' : 'behemoth';
      spawnEnemy(bossKey, base);
      const T = ENEMY_TYPES[bossKey];
      announce(`${T.name} approaches!`, T.desc, '#ff5a5a', 'swords');
      SZ.GameAudio.play('hurt', { pitch: 0.5 });
      if (bossKey === 'queen')
        SZ.GameAudio.sweep(300, 1400, 0.7, 'sawtooth', 0.06, 0.2);
    }
    if (reinforcement) {
      announce('More monsters!', 'A second swarm crawls out of the dark', '#ff8a6a', 'swords');
      SZ.GameAudio.play('hurt', { pitch: 0.6, volume: 0.6 });
    }
    updateWindowTitle();
  }

  // Kill effects, score and special deaths (splitters burst into swarmers)
  function killEnemy(e, i) {
    const T = enemyType(e);
    const pts = Math.round((10 + waveNumber * 5) * T.score);
    score += pts;
    enemies.splice(i, 1);
    const pitch = { swarmer: 1.6, flyer: 1.2, diver: 1.3, crawler: 0.7, burrower: 0.8, spitter: 1, splitter: 0.9, mender: 1.1, behemoth: 0.5, queen: 0.6 }[e.type] || 1;
    SZ.GameAudio.play(e.boss || e.type === 'crawler' ? 'explode' : 'smallExplode', { pitch: pitch * (0.9 + Math.random() * 0.2), volume: e.type === 'swarmer' ? 0.5 : 1 });
    if (e.type === 'mender')
      SZ.GameAudio.play('zap', { pitch: 0.6, volume: 0.5 });
    const n = e.boss ? 3 : 1;
    particles.burst(e.x, e.y, 20 * n, { color: T.color, speed: 3.5 * Math.sqrt(n), life: 0.6, gravity: 0.05 });
    particles.burst(e.x, e.y, 10 * n, { color: '#ffa040', speed: 2, life: 0.4 });
    particles.sparkle(e.x, e.y, 6, { color: '#ff0', speed: 1.5 });
    for (let g = 0; g < 5 * n; ++g)
      particles.trail(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, {
        vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, color: T.color,
        life: 0.5 + Math.random() * 0.3, size: 3 + Math.random() * 3, gravity: 0.12, shape: 'square'
      });
    if (e.boss)
      screenShake.trigger(12, 400);
    floatingText.add(e.x, e.y - 30, `+${pts}`, { color: '#ff0', font: 'bold 24px sans-serif' });
    if (e.type === 'splitter') {
      const base = { threat: threatLevel(), hp: e.maxHP / ENEMY_TYPES.splitter.hp * 0.9, damage: e.damage / ENEMY_TYPES.splitter.damage, speed: e.speed / ENEMY_TYPES.splitter.speed };
      for (let k = 0; k < 3; ++k) {
        const s = spawnEnemy('swarmer', base, { x: e.x + (k - 1) * 18, y: e.y + (Math.random() - 0.5) * 10 });
        s.attackTimer = 0.8;
      }
      SZ.GameAudio.play('bounce', { pitch: 0.6 });
      waveActive = true;
    }
  }

  function enemyMelee(e, T, dt) {
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return false;
    e.attackTimer = T.attack;
    const lunge = Math.atan2(e.y - DOME_Y, e.x - DOME_X);
    e.lunge = 1;
    if (damageDome(e.damage, DOME_X + Math.cos(lunge) * DOME_RADIUS, DOME_Y + Math.sin(lunge) * DOME_RADIUS, '', e))
      return true;
    particles.burst(e.x, e.y, 8, { color: T.color, speed: 2.5, life: 0.4 });
    if (e.type === 'crawler' || e.boss)
      SZ.GameAudio.play('thud', { pitch: 0.6, volume: 0.7 });
    else if (e.type === 'swarmer')
      SZ.GameAudio.play('click', { pitch: 0.7, volume: 0.6 });
    return false;
  }

  function updateEnemies(dt) {
    const repel = (primaryGadget === 'repellent' && primaryGadgetState.active) ? 0.4 : 1.0;
    const slowGround = weatherSlow();
    const slowAir = weather.kind === 'blizzard' ? 1 - 0.3 * weather.intensity : 1;
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];
      const T = enemyType(e);
      e.t += dt;
      e.lunge = Math.max(0, (e.lunge || 0) - dt * 4);
      if (e.pop !== undefined && e.pop < 1)
        e.pop = Math.min(1, e.pop + dt * 2.4);
      const isStunned = e.stunTimer > 0;
      if (isStunned)
        e.stunTimer = Math.max(0, e.stunTimer - dt);
      const air = T.move === 'air' || T.move === 'dive' || T.move === 'queen';
      const spd = e.speed * repel * (air ? slowAir : slowGround);
      const dx = DOME_X - e.x, dy = DOME_Y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = DOME_RADIUS + (air ? 10 : e.size * 0.45);

      // Menders regenerate and patch up the monsters near them
      if (e.type === 'mender') {
        e.hp = Math.min(e.maxHP, e.hp + e.maxHP * 0.05 * dt);
        for (const o of enemies)
          if (o !== e && !o.hidden && Math.abs(o.x - e.x) < 130 && Math.abs(o.y - e.y) < 130)
            o.hp = Math.min(o.maxHP, o.hp + o.maxHP * 0.03 * dt);
      }
      // Monsters dropped by the queen fall to the ground first
      if (e.fall !== undefined) {
        e.fall = Math.min(1, e.fall + dt * 1.8);
        e.y = e.fallFrom + (groundY(e.size) - e.fallFrom) * e.fall * e.fall;
        if (e.fall >= 1) {
          delete e.fall;
          particles.burst(e.x, e.y + e.size * 0.4, 5, { color: '#8a7a6a', speed: 1.5, life: 0.3 });
        }
      } else if (!isStunned) {
        switch (T.move) {
          case 'burrow':
            if (e.hidden) {
              e.x += Math.sign(dx) * spd * 1.15 * dt;
              if (currentView === VIEW_SURFACE && Math.random() < dt * 14)
                particles.trail(e.x + (Math.random() - 0.5) * 20, DOME_Y + 6, { vx: (Math.random() - 0.5) * 2, vy: -1.5 - Math.random() * 1.5, color: '#7a6248', life: 0.4, size: 2.5, gravity: 0.12, shape: 'square' });
              if (Math.abs(dx) < DOME_RADIUS + 70) {
                e.hidden = false;
                e.pop = 0;
                e.y = groundY(e.size);
                if (currentView === VIEW_SURFACE) {
                  particles.burst(e.x, DOME_Y, 22, { color: '#8a6a48', speed: 4, life: 0.6, gravity: 0.15 });
                  screenShake.trigger(4, 150);
                }
                SZ.GameAudio.play('thud', { pitch: 0.5 });
                SZ.GameAudio.noise(0.3, 0.12, 'lowpass', 600, 120);
              }
              break;
            }
            // surfaced: fall through to ground behaviour
          case 'ground':
            if (dist > reach)
              e.x += Math.sign(dx) * spd * dt;
            else if (enemyMelee(e, T, dt))
              return;
            break;
          case 'ranged': {
            if (Math.abs(dx) > 330) {
              e.x += Math.sign(dx) * spd * dt;
            } else {
              e.attackTimer -= dt;
              e.charge = Math.max(0, 1 - e.attackTimer / 0.8);
              if (e.attackTimer <= 0) {
                e.attackTimer = T.attack;
                const tx = DOME_X + (Math.random() - 0.5) * 90;
                enemyShots.push({ x0: e.x + Math.sign(dx) * e.size * 0.5, y0: e.y - e.size * 0.5, tx, ty: DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (tx - DOME_X) * (tx - DOME_X))), t: 0, dur: 1.1, dmg: e.damage });
                if (currentView === VIEW_SURFACE)
                  SZ.GameAudio.play('drop', { pitch: 0.7, volume: 0.6 });
              }
            }
            break;
          }
          case 'air':
            if (dist > reach) {
              e.x += dx / dist * spd * dt;
              e.y += dy / dist * spd * dt;
            } else if (enemyMelee(e, T, dt))
              return;
            break;
          case 'dive': {
            if (e.phase === 'approach' || e.phase === 'climb') {
              const hx = e.hoverX - e.x, hy = e.hoverY - e.y, hd = Math.hypot(hx, hy) || 1;
              e.x += hx / hd * spd * (e.phase === 'climb' ? 1.6 : 1) * dt;
              e.y += hy / hd * spd * (e.phase === 'climb' ? 1.6 : 1) * dt;
              if (hd < 12) {
                e.phase = 'circle';
                e.t = 0;
                e.circleFor = 1.6 + Math.random() * 2;
              }
            } else if (e.phase === 'circle') {
              e.x = e.hoverX + Math.sin(e.t * 2.2) * 70;
              e.y = e.hoverY + Math.sin(e.t * 4.4) * 18;
              if (e.t > e.circleFor) {
                e.phase = 'dive';
                const tx = DOME_X + (Math.random() - 0.5) * 70;
                e.diveX = tx;
                e.diveY = DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (tx - DOME_X) * (tx - DOME_X)));
                if (currentView === VIEW_SURFACE)
                  SZ.GameAudio.sweep(1900, 500, 0.55, 'sawtooth', 0.04);
              }
            } else if (e.phase === 'dive') {
              const vx = e.diveX - e.x, vy = e.diveY - e.y, vd = Math.hypot(vx, vy) || 1;
              const step = spd * 5.2 * dt;
              e.angle = Math.atan2(vy, vx);
              if (vd <= step + 6) {
                e.x = e.diveX;
                e.y = e.diveY;
                if (damageDome(e.damage, e.x, e.y, '', e))
                  return;
                SZ.GameAudio.play('hit', { pitch: 1.2 });
                particles.burst(e.x, e.y, 12, { color: T.color, speed: 3, life: 0.4 });
                e.phase = 'climb';
                e.hoverX = DOME_X + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200);
                e.hoverY = 230 + Math.random() * 160;
              } else {
                e.x += vx / vd * step;
                e.y += vy / vd * step;
              }
            }
            break;
          }
          case 'queen': {
            // Hovers above the field, drops swarmers; comes down to fight when wounded
            const angry = e.hp < e.maxHP * 0.5;
            const tx = angry ? DOME_X : DOME_X + Math.sin(e.t * 0.35) * 380;
            const ty = angry ? DOME_Y - DOME_RADIUS - 30 : 250 + Math.sin(e.t * 0.9) * 40;
            const qx = tx - e.x, qy = ty - e.y, qd = Math.hypot(qx, qy) || 1;
            const qstep = Math.min(qd, spd * 1.6 * dt);
            e.x += qx / qd * qstep;
            e.y += qy / qd * qstep;
            if (angry && dist <= reach + 30 && enemyMelee(e, T, dt))
              return;
            e.spawnTimer = (e.spawnTimer === undefined ? 3 : e.spawnTimer) - dt;
            if (e.spawnTimer <= 0 && enemies.length < 60) {
              e.spawnTimer = 5.5;
              const base = { threat: threatLevel(), hp: e.maxHP / T.hp * 0.8, damage: e.damage / T.damage, speed: e.speed / T.speed };
              for (let k = 0; k < 3; ++k) {
                const s = spawnEnemy('swarmer', base, { x: e.x + (k - 1) * 26, y: e.y + 20 });
                s.fall = 0;
                s.fallFrom = e.y + 20;
              }
              if (currentView === VIEW_SURFACE)
                SZ.GameAudio.sweep(500, 1100, 0.25, 'square', 0.04);
            }
            break;
          }
        }
        // Behemoth stomp: a shockwave that rolls into the dome
        if (e.type === 'behemoth' && dist < 360) {
          e.stomp = (e.stomp === undefined ? 2 : e.stomp) - dt;
          if (e.stomp <= 0) {
            e.stomp = 5.5;
            e.stompAnim = 0.5;
            shockwaves.push({ x: e.x, r: 10, from: e.x, hit: false, dmg: Math.ceil(e.damage * 0.6) });
            if (currentView === VIEW_SURFACE) {
              screenShake.trigger(7, 260);
              SZ.GameAudio.play('explode', { pitch: 0.55, volume: 0.6 });
            }
          }
        }
      }
      if (e.stompAnim > 0)
        e.stompAnim = Math.max(0, e.stompAnim - dt);

      if (e.hp <= 0)
        killEnemy(e, i);
    }

    // Acid globs arc through the air
    for (let i = enemyShots.length - 1; i >= 0; --i) {
      const s = enemyShots[i];
      s.t += dt / s.dur;
      if (s.t >= 1) {
        enemyShots.splice(i, 1);
        if (currentView === VIEW_SURFACE) {
          particles.burst(s.tx, s.ty, 14, { color: '#8aff50', speed: 2.5, life: 0.5, gravity: 0.1 });
          SZ.GameAudio.play('bounce', { pitch: 0.5, volume: 0.6 });
        }
        if (damageDome(s.dmg, s.tx, s.ty, 'Acid'))
          return;
      }
    }
    // Stomp shockwaves
    for (let i = shockwaves.length - 1; i >= 0; --i) {
      const w = shockwaves[i];
      w.r += 420 * dt;
      if (!w.hit && w.r >= Math.abs(w.from - DOME_X) - DOME_RADIUS) {
        w.hit = true;
        if (damageDome(w.dmg, DOME_X + Math.sign(w.from - DOME_X) * DOME_RADIUS, DOME_Y - 10, 'Shockwave'))
          return;
      }
      if (w.r > 700)
        shockwaves.splice(i, 1);
    }

    if (waveActive && enemies.length === 0) {
      waveActive = false;
      SZ.GameAudio.play('levelup');
      announce('Swarm beaten!', isNight() && world.bursts < 3 ? 'More may come before dawn' : 'The dome holds', '#6fe08a', 'shield');
      saveRun();
    }
  }

  let domeDamageShown = { t: 0, amount: 0, label: '' }; // hits within a moment are shown as one number
  let domeInvulnerable = 0;    // Emergency Shield time left
  let emergencyCooldown = 0;
  let lastStandUsed = false;   // Last Stand saves the dome once per night
  let keeperIdle = 0;          // seconds without keeper action (Auto-Mine)
  let dashCooldown = 0;

  // Any hit on the dome: shield gadget, armour, effects and game over. Returns true when the dome is lost.
  function damageDome(amount, ex, ey, label, attacker) {
    if (state !== STATE_PLAYING) return false;
    if (domeInvulnerable > 0) {
      spawnShieldImpact(ex, ey);
      return false;
    }
    // Shield gadget absorbs the first hit of each night
    if (primaryGadget === 'shield' && primaryGadgetState.active) {
      primaryGadgetState.active = false;
      SZ.GameAudio.play('zap', { pitch: 0.7 });
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Absorbed!', { color: '#4af', font: 'bold 28px sans-serif' });
      particles.burst(ex, ey, 15, { color: '#4af', speed: 3, life: 0.5 });
      spawnShieldImpact(ex, ey);
      return false;
    }
    let effectiveDmg = amount;
    if (unlockedTools.reinforcedDome) effectiveDmg = Math.ceil(effectiveDmg * 0.75);
    if (unlockedTools.energyShield) effectiveDmg = Math.ceil(effectiveDmg * 0.85);
    if (unlockedTools.fortifiedBase) effectiveDmg = Math.ceil(effectiveDmg * 0.9);
    // Damage Reflect sends part of a melee hit back
    if (attacker && unlockedTools.damageReflect && enemies.includes(attacker))
      applyDamageToEnemy(attacker, Math.ceil(effectiveDmg * 0.15 * getEffectiveLevel('damageReflect')));
    domeHP -= effectiveDmg;
    if (domeHP <= 0 && unlockedTools.lastStand && !lastStandUsed) {
      domeHP = 1;
      lastStandUsed = true;
      announce('Last Stand!', 'The dome refuses to break - once per night', '#ff6a6a', 'heart');
    }
    if (unlockedTools.emergencyShield && domeHP > 0 && domeHP < maxDomeHP * 0.15 && emergencyCooldown <= 0) {
      domeInvulnerable = 3;
      emergencyCooldown = 60;
      announce('Emergency Shield!', 'The dome is invulnerable for 3 seconds', '#6cc8ff', 'shield');
      SZ.GameAudio.play('powerup', { pitch: 0.8 });
    }
    domeHitFlash = 1.0;
    screenShake.trigger(8, 250);
    // several attackers hit at once: one groan per moment, not a chorus
    const hurtNow = performance.now();
    if (hurtNow - lastDomeHurtSound > 400) {
      lastDomeHurtSound = hurtNow;
      SZ.GameAudio.play('hurt', { volume: 0.7 });
    }
    domeDamageShown.amount += effectiveDmg;
    if (label) domeDamageShown.label = label;
    const nowMs = performance.now();
    if (nowMs - domeDamageShown.t > 450) {
      floatingText.add(DOME_X + (Math.random() - 0.5) * 80, DOME_Y - 60, domeDamageShown.label ? `${domeDamageShown.label} -${domeDamageShown.amount}` : `-${domeDamageShown.amount} HP`, { color: '#f44', font: 'bold 28px sans-serif' });
      domeDamageShown = { t: nowMs, amount: 0, label: '' };
    }
    spawnShieldImpact(ex, ey);
    // Sparks along the shield surface
    const impactAngle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    for (let s = 0; s < 12; ++s) {
      const sa = impactAngle + (Math.random() - 0.5) * 0.6;
      particles.trail(DOME_X + Math.cos(sa) * DOME_RADIUS, DOME_Y + Math.sin(sa) * DOME_RADIUS, {
        vx: Math.cos(sa) * (1 + Math.random() * 2),
        vy: Math.sin(sa) * (1 + Math.random() * 2) - 1,
        color: Math.random() > 0.5 ? '#4af' : '#8cf',
        life: 0.3 + Math.random() * 0.3,
        size: 1 + Math.random() * 2
      });
    }
    if (domeHP <= 0) {
      domeHP = 0;
      state = STATE_GAME_OVER;
      particles.burst(DOME_X, DOME_Y, 40, { color: '#4af', speed: 5, life: 0.8 });
      particles.burst(DOME_X, DOME_Y, 25, { color: '#f80', speed: 4, life: 0.6 });
      screenShake.trigger(15, 500);
      SZ.GameAudio.play('explode');
      SZ.GameAudio.play('lose');
      addHighScore(waveNumber, score);
      clearSave();
      updateWindowTitle();
      return true;
    }
    return false;
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
        else if (ady < 45)
          // Just below the ground line (monster feet): aim flat along the ground
          turretAngle = adx < 0 ? -Math.PI : 0;
        // Further below ground the angle stays put, so the HUD does not swing the turret
      }
    }

    // Keyboard aiming: Left/Right or A/D rotate barrel
    const turnSpeed = TURRET_KEYBOARD_SPEED * (1 + 0.3 * getEffectiveLevel('turretSpeed')) * (weather.kind === 'blizzard' ? 1 - 0.4 * weather.intensity : 1);
    if (keys['ArrowLeft'] || keys['KeyA'])
      turretAngle -= turnSpeed * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      turretAngle += turnSpeed * dt;

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
      fireCooldown = 1.0 / (fireRate * (weather.kind === 'blizzard' ? 1 - 0.25 * weather.intensity : 1));

      // Project a far-off aim point along the turret angle
      const aimDist = 400;
      const farX = turretBaseX + Math.cos(turretAngle) * aimDist;
      const farY = turretBaseY + Math.sin(turretAngle) * aimDist;

      // Find enemy closest to the projected aim line
      let target = null;
      const homing = !!unlockedTools.homingShots;
      let bestDist = homing ? 220 * 220 : 80 * 80; // hit radius of 80px (220 with homing shots)
      for (const e of enemies) {
        if (e.hidden) continue;
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
        let bestLineDist = homing ? 140 : 60;
        for (const e of enemies) {
          if (e.hidden) continue;
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
        // Critical hits
        let shot = weaponDamage;
        if (unlockedTools.criticalHit && Math.random() < 0.15 + 0.05 * (getEffectiveLevel('criticalHit') - 1)) {
          shot = Math.round(shot * 2.5);
          floatingText.add(target.x, target.y - (target.size || 20) - 30, 'CRIT!', { color: '#ffd040', font: 'bold 24px sans-serif' });
        }
        applyDamageToEnemy(target, shot);

        // Multi-Shot: more beams at the monsters nearest to the target
        if (unlockedTools.multiShot) {
          const extra = enemies.filter(o => o !== target && !o.hidden)
            .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
            .slice(0, getEffectiveLevel('multiShot'));
          for (const o of extra) {
            applyDamageToEnemy(o, Math.ceil(weaponDamage * 0.6));
            projectiles.push({ x: muzzleX, y: muzzleY, tx: o.x, ty: o.y, target: o, life: 0.25, maxLife: 0.25 });
          }
        }

        // Explosive Rounds: every hit bursts
        if (unlockedTools.explosiveRounds) {
          for (const ce of enemies)
            if (ce !== target && !ce.hidden && Math.hypot(ce.x - target.x, ce.y - target.y) < 110)
              applyDamageToEnemy(ce, Math.ceil(weaponDamage * 0.4));
          particles.burst(target.x, target.y, 12, { color: '#ffb040', speed: 3, life: 0.35 });
        }

        // Chain Lightning: arc damage to 2 nearby enemies (+1 per extra level)
        if (unlockedTools.chainLightning) {
          let chainCount = 0;
          const arcs = 1 + getEffectiveLevel('chainLightning');
          const chainDamage = Math.ceil(weaponDamage * 0.4);
          for (const ce of enemies) {
            if (ce.hidden || ce === target) continue;
            if (chainCount >= arcs) break;
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
            if (ce.hidden) continue;
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 120 * 120)
              ce.stunTimer = Math.max(ce.stunTimer || 0, 0.8 + 0.3 * (getEffectiveLevel('freezeRay') - 1));
          }
        }

        // Plasma Cannon: AoE damage around target
        if (unlockedTools.plasmaCannon) {
          const aoeDamage = Math.ceil(weaponDamage * 0.6);
          for (const ce of enemies) {
            if (ce.hidden) continue;
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
    // Speed Mining: -10% per level
    time *= Math.pow(0.9, getEffectiveLevel('speedMining'));

    // Drill Gadget: 30% faster when mining consecutive tiles in the same column
    if (unlockedTools.drill && activeToolKey === 'drill' && toolState.drillConsecutive > 0)
      time *= getEffectiveLevel('drillCombo') > 0 ? 0.5 : 0.7;

    return time;
  }

  function tryMine(dx, dy) {
    if (state !== STATE_PLAYING) return;
    if (currentView !== VIEW_UNDERGROUND) return;
    if (keeperStun > 0) return;

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

    // A secret chest is opened, not dug out
    if (tile === TILE_CHEST) {
      lastMineDir = { dx, dy };
      tryOpenChest(chestAt(ny, nx));
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
    // Digging upward: jetpack and wall climb help
    if (dy < 0) {
      if (unlockedTools.jetpack) miningDuration *= 0.8;
      if (unlockedTools.wallClimb) miningDuration *= 0.7;
    }
    // Phase Shift: the next block gives way at once
    if (unlockedTools.phaseShift && toolState.phaseShiftCooldown <= 0 && tile !== TILE_CORE) {
      miningDuration = 0.05;
      toolState.phaseShiftCooldown = 25 - 8 * (getEffectiveLevel('phaseShift') - 1);
      floatingText.add(nx * TILE_SIZE + TILE_SIZE / 2 - cameraX, ny * TILE_SIZE - cameraY, 'Phase!', { color: '#c8b0ff', font: 'bold 20px sans-serif' });
    }
    keeperIdle = 0;

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
      let value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(ny));

      if (unlockedTools.silkTouch)
        value = Math.round(value * 1.25);
      // Fortune: 30% chance to double ore yield (+10% per extra level)
      if (unlockedTools.fortune && Math.random() < 0.3 + 0.1 * (getEffectiveLevel('fortune') - 1)) {
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

    if (tile === TILE_CORE)
      collectRelocationCore(tx, ty);

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

    // Vein Miner and Tunnel Bore break more rock in one go
    if (unlockedTools.veinMiner && RESOURCE_TILES.includes(tile)) {
      const seen = new Set([ny * GRID_COLS + nx]);
      const queue = [[ny, nx]];
      let n = 0;
      while (queue.length && n < 10) {
        const [r, c] = queue.shift();
        for (const [ddr, ddc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + ddr, cc = c + ddc, key = rr * GRID_COLS + cc;
          if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS || seen.has(key)) continue;
          seen.add(key);
          if (undergroundGrid[rr][cc] !== tile || n >= 10) continue;
          breakTileInstant(rr, cc);
          queue.push([rr, cc]);
          ++n;
        }
      }
    }
    if (unlockedTools.tunnelBore)
      for (let k = 1; k <= 2; ++k) {
        const rr = ny + dy * k, cc = nx + dx * k;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) break;
        const t = undergroundGrid[rr][cc];
        if (t === TILE_EMPTY || t === TILE_GADGET || t === TILE_CORE || t === TILE_CHEST) break;
        breakTileInstant(rr, cc);
      }

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

    // Reveal an adjacent Relocation Core, secret chests and gadget chambers
    if (!relocationCore.revealed && Math.abs(relocationCore.r - ny) + Math.abs(relocationCore.c - nx) <= 1)
      relocationCore.revealed = true;
    revealChestsNear(ny, nx, 1, true);
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

  // Break a tile at once (Vein Miner, Tunnel Bore): ore goes into the cargo, overflow drops
  function breakTileInstant(r, c) {
    const tile = undergroundGrid[r][c];
    if (tile === TILE_CHEST || tile === TILE_CORE || tile === TILE_GADGET || tile === TILE_EMPTY) return;
    const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    if (RESOURCE_TILES.includes(tile)) {
      let value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r));
      if (unlockedTools.silkTouch)
        value = Math.round(value * 1.25);
      const fits = Math.max(0, Math.min(value, carryCapacity - carried));
      resources[TILE_LABELS[tile]] += fits;
      carried += fits;
      if (value > fits)
        droppedResources.push({ col: c, row: r, type: tile, value: value - fits, age: 0 });
      particles.sparkle(tx, ty, 6, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2 });
    }
    spawnCrumble(tx, ty, getTileBaseColor(tile, r));
    undergroundGrid[r][c] = TILE_EMPTY;
    tileHP[r][c] = 0;
    tileMaxHP[r][c] = 0;
    if (!relocationCore.revealed && Math.abs(relocationCore.r - r) + Math.abs(relocationCore.c - c) <= 1)
      relocationCore.revealed = true;
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
        maxDomeHP = computeMaxDomeHP();
        domeHP = Math.min(domeHP + 50, maxDomeHP);
        floatingText.add(tx, ty - 90, '+50 Max HP!', { color: '#0f0', font: 'bold 24px sans-serif' });
        break;
      case 'blastMining':
        bombInv[1] += 2;
        floatingText.add(tx, ty - 90, '+2 Bombs!', { color: '#f80', font: 'bold 24px sans-serif' });
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

  /* ======================================================================
     TOOL ACTIONS
     ====================================================================== */

  function useBlastTool() {
    if (!unlockedTools.blastTool) return;
    if (toolState.blastToolCooldown > 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;
    const upgraded = getEffectiveLevel('blastToolLevel') > 0;
    const ironCost = upgraded ? 5 : 10;
    if (resources.iron < ironCost) {
      SZ.GameAudio.play('error');
      floatingText.add(
        drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
        drillY * TILE_SIZE - 10 - cameraY,
        `Need ${ironCost} iron!`, { color: '#f44', font: 'bold 24px sans-serif' }
      );
      return;
    }

    resources.iron -= ironCost;
    toolState.blastToolCooldown = upgraded ? GADGET_TOOL_COOLDOWNS.blastTool / 2 : GADGET_TOOL_COOLDOWNS.blastTool;
    SZ.GameAudio.play('explode');

    floatingText.add(
      drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
      drillY * TILE_SIZE - 10 - cameraY,
      `BLAST! (-${ironCost} iron)`, { color: '#f80', font: 'bold 28px sans-serif' }
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

        if (tile === TILE_CHEST) {
          revealChest(chestAt(r, c), true);
          continue;
        }
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
        } else if (tile === TILE_CORE) {
          collectRelocationCore(tx, ty);
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r));
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

    toolState.teleporterCooldown = GADGET_TOOL_COOLDOWNS.teleporter - 5 * getEffectiveLevel('teleportCooldown');

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

  /* ======================================================================
     BOMBS -- crafted in the dome, combined into bigger ones, dropped or
     thrown in the mine and lobbed at monsters on the surface
     ====================================================================== */

  // radius in tiles, power in seconds of mining a blast does at its centre,
  // monster damage when lobbed on the surface
  const BOMB_TIERS = [
    { key: 'charge', name: 'Charge', icon: 'bombCharge', radius: 1.3, power: 2.2, monster: 45, color: '#ff8a50',
      recipe: { iron: 6, coal: 4 } },
    { key: 'bomb', name: 'Bomb', icon: 'bomb', radius: 2.1, power: 4, monster: 90, color: '#ffb040',
      recipe: { iron: 12, coal: 8, tin: 4 }, recipeNode: 'recipeBomb' },
    { key: 'big', name: 'Big Bomb', icon: 'bombBig', radius: 3.1, power: 7, monster: 160, color: '#ffd060',
      recipe: { cobalt: 8, coal: 14, redstone: 6 }, recipeNode: 'recipeBig' },
    { key: 'mega', name: 'Mega Bomb', icon: 'bombMega', radius: 4.3, power: 11, monster: 260, color: '#ffe680',
      recipe: { titanium: 5, redstone: 10, uranium: 2 }, recipeNode: 'recipeMega' },
    { key: 'void', name: 'Void Bomb', icon: 'bombVoid', radius: 6.2, power: 18, monster: 450, color: '#c08aff',
      recipe: { uranium: 6, amethyst: 4, voidstone: 2 }, recipeNode: 'recipeVoid' }
  ];
  const BOMB_COMBINE = 3;            // bombs of one size that merge into one of the next
  const BOMB_BASE_FUSE = 2.5;        // seconds
  const BOMB_BASE_CAPACITY = 8;
  const BOMB_THROW_RANGE = 4;        // tiles
  const KEEPER_STUN_TIME = 2.5;      // seconds a keeper caught in a blast is dazed

  let bombInv = [0, 0, 0, 0, 0];     // bombs in stock per tier
  let bombSel = 0;                   // tier dropped / thrown next
  let placedBombs = [];              // in the mine: { r, c, tier, fuse, maxFuse, fly }
  let surfaceBombs = [];             // lobbed at monsters: { x0, y0, tx, ty, t, dur, tier }
  let pendingBlasts = [];            // chain reactions waiting to go off: { r, c, R, power, delay }
  let blasts = [];                   // explosion visuals: { x, y, R, t, life, tier, under }
  let bombThrowMode = false;         // next click throws the selected bomb
  let keeperStun = 0;                // seconds the keeper stays dazed
  let craftFocus = 0;                // workshop row selected by keyboard
  let craftHover = null;             // { row, kind } under the mouse
  let stateBeforeCraft = null;
  const craftFlash = {};             // `${row}` -> time of the last craft (ms)

  function bombCount() {
    return bombInv.reduce((s, n) => s + n, 0);
  }

  function bombCapacity() {
    return BOMB_BASE_CAPACITY + 4 * getEffectiveLevel('bombSatchel');
  }

  function bombRadius(tier) {
    return BOMB_TIERS[tier].radius + 0.5 * getEffectiveLevel('blastRadius');
  }

  function bombPower(tier) {
    return BOMB_TIERS[tier].power * (1 + 0.3 * getEffectiveLevel('bombPower'));
  }

  function bombFuse() {
    return Math.max(1, BOMB_BASE_FUSE - 0.6 * getEffectiveLevel('bombFuse'));
  }

  // Share of the ore in blasted tiles that survives (the rest is pulverised)
  function bombYield() {
    return [0.5, 0.8, 1, 1.25][Math.min(3, getEffectiveLevel('bombYield'))];
  }

  function bombThrowRange() {
    return BOMB_THROW_RANGE + (unlockedTools.stickyBombs ? 2 : 0);
  }

  function recipeKnown(tier) {
    const node = BOMB_TIERS[tier].recipeNode;
    return !node || isTreeNodeMaxed(node);
  }

  // Recipe with the Bombsmith discount
  function craftCost(tier) {
    const k = 1 - 0.15 * getEffectiveLevel('bombsmith');
    const out = {};
    const r = BOMB_TIERS[tier].recipe;
    for (const key in r)
      out[key] = Math.max(1, Math.ceil(r[key] * k));
    return out;
  }

  function canPay(cost) {
    for (const key in cost)
      if ((resources[key] || 0) < cost[key])
        return false;
    return true;
  }

  // Why a bomb of this tier cannot be crafted right now (null when it can)
  function craftBlocker(tier) {
    if (!recipeKnown(tier)) return 'Recipe locked: buy it in the Tools branch';
    if (bombCount() >= bombCapacity()) return `Bomb storage full (${bombCapacity()})`;
    if (!canPay(craftCost(tier))) return 'Not enough resources';
    return null;
  }

  function craftBomb(tier) {
    const why = craftBlocker(tier);
    if (why) {
      SZ.GameAudio.play('error');
      floatingText.add(CANVAS_W / 2, 140, why, { color: '#ff8a7a', font: 'bold 22px sans-serif' });
      return false;
    }
    const cost = craftCost(tier);
    for (const key in cost)
      resources[key] -= cost[key];
    ++bombInv[tier];
    bombSel = tier;
    craftFlash[tier] = performance.now();
    SZ.GameAudio.play('pickup', { pitch: 0.8 + tier * 0.12 });
    SZ.GameAudio.play('click', { pitch: 0.6 });
    return true;
  }

  function combineBombs(tier) {
    if (tier >= BOMB_TIERS.length - 1 || bombInv[tier] < BOMB_COMBINE) {
      SZ.GameAudio.play('error');
      return false;
    }
    bombInv[tier] -= BOMB_COMBINE;
    ++bombInv[tier + 1];
    bombSel = tier + 1;
    craftFlash[tier + 1] = performance.now();
    SZ.GameAudio.play('powerup', { pitch: 0.9 + tier * 0.1, volume: 0.8 });
    return true;
  }

  // Next tier that is in stock, searching forward (dir 1) or back (-1)
  function cycleBomb(dir) {
    for (let i = 1; i <= BOMB_TIERS.length; ++i) {
      const t = (bombSel + dir * i + BOMB_TIERS.length * 2) % BOMB_TIERS.length;
      if (bombInv[t] > 0) {
        bombSel = t;
        SZ.GameAudio.play('blip', { pitch: 1 + t * 0.1, volume: 0.6 });
        return;
      }
    }
    SZ.GameAudio.play('error');
  }

  // A tier that can be used now: the selected one, otherwise the smallest in stock
  function readyBombTier() {
    if (bombInv[bombSel] > 0) return bombSel;
    const t = bombInv.findIndex(n => n > 0);
    if (t >= 0) bombSel = t;
    return t;
  }

  function noBombsHint() {
    SZ.GameAudio.play('error');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 80, 'No bombs - press C to craft some', { color: '#ffb070', font: 'bold 24px sans-serif' });
  }

  function bombAt(r, c) {
    return placedBombs.find(b => b.r === r && b.c === c);
  }

  // Drop the selected bomb at the keeper's feet
  function placeBomb() {
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    if (bombAt(drillY, drillX)) {
      SZ.GameAudio.play('error');
      return;
    }
    --bombInv[tier];
    placedBombs.push({ r: drillY, c: drillX, tier, fuse: bombFuse(), maxFuse: bombFuse(), fly: null });
    bombThrowMode = false;
    SZ.GameAudio.play('drop', { pitch: 0.8 });
    floatingText.add(drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, drillY * TILE_SIZE - 20 - cameraY, `${BOMB_TIERS[tier].name} placed - run!`, { color: '#ffb070', font: 'bold 20px sans-serif' });
  }

  // Tiles the flight passes through (keeper excluded, target included)
  function throwLine(c0, r0, c1, r1) {
    const pts = [];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let i = 1; i <= n; ++i)
      pts.push([Math.round(r0 + (r1 - r0) * i / n), Math.round(c0 + (c1 - c0) * i / n)]);
    return pts;
  }

  // Can the keeper throw a bomb onto this tile? Open tunnel in reach with a free
  // line of flight; Sticky Bombs also cling to a rock face next to a tunnel
  function throwTarget(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return { ok: false, why: 'Out of the mine' };
    if (Math.hypot(col - drillX, row - drillY) > bombThrowRange() + 0.5) return { ok: false, why: 'Too far to throw' };
    if (col === drillX && row === drillY) return { ok: false, why: 'Use B to drop it here' };
    const solid = undergroundGrid[row][col] !== TILE_EMPTY;
    if (solid && !unlockedTools.stickyBombs) return { ok: false, why: 'Throw into an open tunnel' };
    const line = throwLine(drillX, drillY, col, row);
    for (let i = 0; i < line.length - 1; ++i)
      if (undergroundGrid[line[i][0]][line[i][1]] !== TILE_EMPTY)
        return { ok: false, why: 'Rock is in the way' };
    if (bombAt(row, col)) return { ok: false, why: 'A bomb already lies there' };
    return { ok: true, sticky: solid };
  }

  function throwBombAt(col, row) {
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    const t = throwTarget(col, row);
    if (!t.ok) {
      SZ.GameAudio.play('error');
      floatingText.add(col * TILE_SIZE + TILE_SIZE / 2 - cameraX, row * TILE_SIZE - 10 - cameraY, t.why, { color: '#ff8a7a', font: 'bold 18px sans-serif' });
      return;
    }
    --bombInv[tier];
    placedBombs.push({
      r: row, c: col, tier, fuse: bombFuse(), maxFuse: bombFuse(), sticky: t.sticky,
      fly: { x: drillX * TILE_SIZE + TILE_SIZE / 2, y: drillY * TILE_SIZE + TILE_SIZE / 2, t: 0, dur: 0.25 + Math.hypot(col - drillX, row - drillY) * 0.05 }
    });
    bombThrowMode = false;
    SZ.GameAudio.play('whoosh', { pitch: 1.4, volume: 0.6 });
  }

  // Lob a bomb from the turret at a point on the battlefield
  function lobSurfaceBomb(tx, ty) {
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    ty = Math.min(DOME_Y - 8, ty);
    const dd = Math.hypot(tx - DOME_X, ty - DOME_Y);
    if (dd < DOME_RADIUS + 40) {
      const a = Math.atan2(ty - DOME_Y, tx - DOME_X) || -Math.PI / 2;
      tx = DOME_X + Math.cos(a) * (DOME_RADIUS + 40);
      ty = Math.min(DOME_Y - 8, DOME_Y + Math.sin(a) * (DOME_RADIUS + 40));
    }
    --bombInv[tier];
    const x0 = DOME_X + Math.cos(turretAngle) * (DOME_RADIUS + 30), y0 = DOME_Y + Math.sin(turretAngle) * (DOME_RADIUS + 30);
    surfaceBombs.push({ x0, y0, tx, ty, t: 0, dur: 0.45 + Math.hypot(tx - x0, ty - y0) / 1400, tier });
    bombThrowMode = false;
    SZ.GameAudio.play('whoosh', { pitch: 0.9 });
  }

  // Add ore to a loose pile on the floor (piles of one kind on one tile merge)
  function dropOre(r, c, tile, value) {
    if (value <= 0) return;
    const pile = droppedResources.find(d => d.col === c && d.row === r && d.type === tile);
    if (pile) {
      pile.value += value;
      pile.age = 0;
    } else
      droppedResources.push({ col: c, row: r, type: tile, value, age: 0 });
  }

  // Break open the gadget chamber that owns (r, c)
  function openChamberAt(r, c, tx, ty) {
    const chamber = gadgetChambers.find(ch => r >= ch.r && r <= ch.r + 1 && c >= ch.c && c <= ch.c + 1);
    if (!chamber) {
      undergroundGrid[r][c] = TILE_EMPTY;
      tileHP[r][c] = tileMaxHP[r][c] = 0;
      return;
    }
    grantMineGadget(chamber.gadgetType, tx, ty);
    for (let dr = 0; dr < 2; ++dr)
      for (let dc = 0; dc < 2; ++dc)
        if (undergroundGrid[chamber.r + dr][chamber.c + dc] === TILE_GADGET) {
          undergroundGrid[chamber.r + dr][chamber.c + dc] = TILE_EMPTY;
          tileHP[chamber.r + dr][chamber.c + dc] = tileMaxHP[chamber.r + dr][chamber.c + dc] = 0;
        }
  }

  // Tiles a blast never breaks; it only lays them open
  function isBlastProof(tile) {
    return tile === TILE_CORE || tile === TILE_CHEST;
  }

  function revealBlastProof(r, c, tile) {
    if (tile === TILE_CORE)
      relocationCore.revealed = true;
    else if (tile === TILE_CHEST && chestAt(r, c))
      revealChest(chestAt(r, c), true);
  }

  // Explosion in the mine centred on tile (cr, cc): rock takes damage that
  // falls off towards the rim, broken ore drops as loose piles
  function blastUnderground(cr, cc, R, power, tier, chained) {
    const onScreen = currentView === VIEW_UNDERGROUND;
    let broken = 0, ore = 0;
    const ext = Math.ceil(R);
    const yieldK = bombYield();
    for (let r = cr - ext; r <= cr + ext; ++r) {
      if (r < 0 || r >= GRID_ROWS) continue;
      for (let c = cc - ext; c <= cc + ext; ++c) {
        if (c < 0 || c >= GRID_COLS) continue;
        const d = Math.hypot(r - cr, c - cc);
        if (d > R) continue;
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;
        const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;
        if (isBlastProof(tile)) {
          revealBlastProof(r, c, tile);
          continue;
        }
        if (tile === TILE_GADGET) {
          openChamberAt(r, c, tx, ty);
          continue;
        }
        const dmg = power * (1 - 0.45 * d / Math.max(1, R));
        if (tileHP[r][c] > dmg) {
          tileHP[r][c] -= dmg;          // cracked, not broken
          continue;
        }
        if (RESOURCE_TILES.includes(tile)) {
          const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r) * yieldK);
          dropOre(r, c, tile, value);
          ore += value;
          // Chain Reaction: coal and uranium seams go off as well
          if (unlockedTools.chainReaction && (tile === TILE_COAL || tile === TILE_URANIUM) && pendingBlasts.length < 12)
            pendingBlasts.push({ r, c, R: tile === TILE_URANIUM ? 2.1 : 1.4, power: tile === TILE_URANIUM ? 5 : 2.6, delay: 0.12 + Math.random() * 0.25, tier: tile === TILE_URANIUM ? 2 : 0 });
        }
        if (onScreen) {
          spawnCrumble(tx, ty, getTileBaseColor(tile, r));
          if (Math.random() < 0.5)
            particles.burst(tx, ty, 4, { color: getTileBaseColor(tile, r), speed: 2.5, life: 0.4, gravity: 0.1 });
        }
        undergroundGrid[r][c] = TILE_EMPTY;
        tileHP[r][c] = tileMaxHP[r][c] = 0;
        ++broken;
      }
    }
    // Neighbouring bombs go off almost at once
    for (const b of placedBombs)
      if (!b.fly && Math.hypot(b.r - cr, b.c - cc) <= R + 0.5)
        b.fuse = Math.min(b.fuse, 0.15);
    // The keeper is knocked out unless wearing a Blast Suit
    if (!unlockedTools.blastSuit && Math.hypot(drillY - cr, drillX - cc) <= R + 0.4) {
      keeperStun = KEEPER_STUN_TIME;
      cancelMining();
      clearMoveTarget();
      if (onScreen)
        floatingText.add(drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, drillY * TILE_SIZE - 30 - cameraY, 'Knocked out!', { color: '#ff7a6a', font: 'bold 24px sans-serif' });
      SZ.GameAudio.play('hurt', { pitch: 1.3, volume: 0.7 });
    }
    // Light the tunnel walls the blast opened up
    if (!relocationCore.revealed && Math.abs(relocationCore.r - cr) <= ext + 1 && Math.abs(relocationCore.c - cc) <= ext + 1)
      relocationCore.revealed = true;
    for (const ch of gadgetChambers)
      if (!ch.revealed && Math.hypot(ch.r - cr, ch.c - cc) <= R + 1.5)
        ch.revealed = true;

    const wx = cc * TILE_SIZE + TILE_SIZE / 2, wy = cr * TILE_SIZE + TILE_SIZE / 2;
    blasts.push({ x: wx, y: wy, R: (R + 0.4) * TILE_SIZE, t: 0, life: 0.55 + tier * 0.1, tier, under: true });
    const vol = onScreen ? 1 : 0.35;
    SZ.GameAudio.play('explode', { pitch: 1.25 - tier * 0.16, volume: (0.6 + tier * 0.1) * vol });
    if (tier >= 2)
      SZ.GameAudio.noise(0.5 + tier * 0.25, 0.14 * vol, 'lowpass', 500, 60);
    if (tier === 4)
      SZ.GameAudio.sweep(900, 60, 0.9, 'sawtooth', 0.06 * vol);
    if (onScreen) {
      const sx = wx - cameraX, sy = wy - cameraY;
      particles.burst(sx, sy, 24 + tier * 12, { color: BOMB_TIERS[tier].color, speed: 3 + tier, life: 0.5 + tier * 0.08 });
      particles.burst(sx, sy, 12 + tier * 6, { color: '#fff4c0', speed: 2 + tier * 0.6, life: 0.3 });
      if (tier === 4)
        particles.sparkle(sx, sy, 30, { color: '#d0a0ff', speed: 4 });
      screenShake.trigger(Math.min(22, 7 + tier * 4), 260 + tier * 70);
      if (!chained && (broken || ore))
        floatingText.add(sx, sy - R * TILE_SIZE * 0.5 - 20, `BOOM! ${broken} ${broken === 1 ? 'block' : 'blocks'}` + (ore > 0 ? ` · ${ore} ore loose` : ''), { color: BOMB_TIERS[tier].color, font: 'bold 24px sans-serif' });
    }
  }

  function detonateBomb(b) {
    placedBombs.splice(placedBombs.indexOf(b), 1);
    blastUnderground(b.r, b.c, bombRadius(b.tier), bombPower(b.tier), b.tier, false);
  }

  // A lobbed bomb lands among the monsters
  function blastSurface(x, y, tier) {
    const R = 70 + 26 * bombRadius(tier);
    const dmg = BOMB_TIERS[tier].monster * (1 + 0.3 * getEffectiveLevel('bombPower'));
    let hits = 0;
    for (const e of enemies) {
      if (e.hidden) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R + (e.size || 16)) continue;
      applyDamageToEnemy(e, Math.ceil(dmg * (1 - 0.5 * Math.min(1, d / R))));
      e.stunTimer = Math.max(e.stunTimer || 0, 0.6);
      ++hits;
    }
    blasts.push({ x, y, R, t: 0, life: 0.55 + tier * 0.1, tier, under: false });
    if (currentView === VIEW_SURFACE) {
      particles.burst(x, y, 26 + tier * 12, { color: BOMB_TIERS[tier].color, speed: 3.5 + tier, life: 0.6, gravity: 0.05 });
      particles.burst(x, Math.min(y, DOME_Y), 14, { color: '#7a6a58', speed: 2.5, life: 0.8, gravity: 0.12 });
      screenShake.trigger(Math.min(20, 6 + tier * 3.5), 260 + tier * 60);
      if (hits > 1)
        floatingText.add(x, y - 60, `${hits} hit!`, { color: BOMB_TIERS[tier].color, font: 'bold 24px sans-serif' });
    }
    SZ.GameAudio.play('explode', { pitch: 1.2 - tier * 0.15, volume: 0.7 + tier * 0.08 });
  }

  function updateBombs(dt) {
    if (keeperStun > 0)
      keeperStun = Math.max(0, keeperStun - dt);
    for (let i = placedBombs.length - 1; i >= 0; --i) {
      const b = placedBombs[i];
      if (b.fly) {
        b.fly.t += dt / b.fly.dur;
        if (b.fly.t >= 1) {
          b.fly = null;
          if (currentView === VIEW_UNDERGROUND)
            SZ.GameAudio.play('drop', { pitch: b.sticky ? 1.4 : 0.8, volume: 0.7 });
        }
        continue;
      }
      const before = b.fuse;
      b.fuse -= dt;
      if (currentView === VIEW_UNDERGROUND && Math.ceil(before * 2) !== Math.ceil(b.fuse * 2) && b.fuse > 0)
        SZ.GameAudio.play('blip', { pitch: b.fuse < 1 ? 1.6 : 1.1, volume: 0.35 });
    }
    // Several bombs may go off in one frame; detonate one by one
    for (let guard = 0; guard < 40; ++guard) {
      const b = placedBombs.find(x => !x.fly && x.fuse <= 0);
      if (!b) break;
      detonateBomb(b);
    }
    for (let i = pendingBlasts.length - 1; i >= 0; --i) {
      const p = pendingBlasts[i];
      p.delay -= dt;
      if (p.delay > 0) continue;
      pendingBlasts.splice(i, 1);
      blastUnderground(p.r, p.c, p.R, p.power, p.tier, true);
    }
    for (let i = surfaceBombs.length - 1; i >= 0; --i) {
      const s = surfaceBombs[i];
      s.t += dt / s.dur;
      if (s.t >= 1) {
        surfaceBombs.splice(i, 1);
        blastSurface(s.tx, s.ty, s.tier);
      }
    }
  }

  // Explosion visuals age with real time so they also fade while paused
  function updateBlastVisuals(dt) {
    for (let i = blasts.length - 1; i >= 0; --i) {
      blasts[i].t += dt;
      if (blasts[i].t >= blasts[i].life) blasts.splice(i, 1);
    }
  }

  // Detonate every bomb lying in the mine (Remote Detonator)
  function remoteDetonate() {
    if (!unlockedTools.remoteDetonator) return;
    const armed = placedBombs.filter(b => !b.fly);
    if (!armed.length) {
      SZ.GameAudio.play('error');
      return;
    }
    armed.forEach((b, i) => { b.fuse = Math.min(b.fuse, 0.05 + i * 0.08); });
    SZ.GameAudio.play('zap', { pitch: 1.6, volume: 0.6 });
  }

  /* ======================================================================
     SECRET CHESTS -- three per site, opened by beating a short minigame
     ====================================================================== */

  const CHEST_BANDS = [[2, 4], [6, 8], [10, 13]];   // strata: shallow-mid, mid, deep
  const CHEST_RETRY = 20;                            // seconds a failed lock stays jammed
  const MINIGAME_KINDS = ['lock', 'circuit', 'runes'];
  const MINIGAME_NAMES = { lock: 'Lock Picking', circuit: 'Power Circuit', runes: 'Rune Memory' };
  let chests = [];                   // { r, c, band, kind, revealed, opened, cooldown }
  let minigame = null;               // the chest being opened (see startMinigame)

  // Hide three chests in plain rock, one per depth band, far apart
  function placeSecretChests(rand) {
    chests = [];
    const kinds = MINIGAME_KINDS.map((k, i) => MINIGAME_KINDS[(i + site.index) % MINIGAME_KINDS.length]);
    CHEST_BANDS.forEach(([s0, s1], band) => {
      for (let attempt = 0; attempt < 400; ++attempt) {
        const r = Math.min(GRID_ROWS - 2, s0 * STRATUM_ROWS + Math.floor(rand() * (s1 - s0 + 1) * STRATUM_ROWS));
        const c = 6 + Math.floor(rand() * (GRID_COLS - 12));
        if (undergroundGrid[r][c] !== TILE_DIRT) continue;
        if (Math.abs(r - relocationCore.r) + Math.abs(c - relocationCore.c) < 6) continue;
        if (chests.some(ch => Math.abs(ch.c - c) < 24 && Math.abs(ch.r - r) < 12)) continue;
        undergroundGrid[r][c] = TILE_CHEST;
        chests.push({ r, c, band, kind: kinds[band], revealed: false, opened: false, cooldown: 0 });
        break;
      }
    });
  }

  function chestSeed() {
    return site.seed ^ 0x0c4e57;
  }

  function chestAt(r, c) {
    return chests.find(ch => ch.r === r && ch.c === c && !ch.opened);
  }

  function chestsOpened() {
    return chests.filter(ch => ch.opened).length;
  }

  function revealChest(ch, announceIt) {
    if (ch.revealed || ch.opened) return;
    ch.revealed = true;
    if (announceIt && currentView === VIEW_UNDERGROUND) {
      const tx = ch.c * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = ch.r * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      floatingText.add(tx, ty - 40, 'Secret chest!', { color: '#e0b0ff', font: 'bold 24px sans-serif' });
      particles.sparkle(tx, ty, 16, { color: '#ffd8ff', speed: 2 });
      SZ.GameAudio.play('coin', { pitch: 0.8 });
    }
  }

  // Reveal chests within a tile distance of (r, c)
  function revealChestsNear(r, c, dist, announceIt) {
    for (const ch of chests)
      if (!ch.revealed && !ch.opened && Math.abs(ch.r - r) + Math.abs(ch.c - c) <= dist)
        revealChest(ch, announceIt);
  }

  // Difficulty 0..1 grows with the depth band and the site
  function chestDifficulty(ch) {
    return Math.max(0, Math.min(1, 0.15 + ch.band * 0.3 + site.index * 0.08));
  }

  function tryOpenChest(ch) {
    if (!ch || ch.opened) return;
    revealChest(ch, false);
    if (ch.cooldown > 0) {
      SZ.GameAudio.play('error');
      floatingText.add(ch.c * TILE_SIZE + TILE_SIZE / 2 - cameraX, ch.r * TILE_SIZE - 10 - cameraY, `The lock is jammed: ${Math.ceil(ch.cooldown)} s`, { color: '#ffb0a8', font: 'bold 20px sans-serif' });
      return;
    }
    cancelMining();
    clearMoveTarget();
    startMinigame(ch);
  }

  function updateChests(dt) {
    for (const ch of chests)
      if (ch.cooldown > 0) ch.cooldown = Math.max(0, ch.cooldown - dt);
  }

  // What a chest holds: rare ore of its depth plus points
  function grantChestTreasure(ch) {
    const pools = [['silver', 'gold', 'quartz', 'cobalt'], ['redstone', 'emerald', 'diamond', 'ruby'], ['titanium', 'sapphire', 'uranium', 'amethyst', 'opal']];
    const pool = pools[ch.band];
    const rng = makeRng(chestSeed() ^ (ch.r * 977 + ch.c));
    const got = [];
    for (let i = 0; i < 3; ++i) {
      const key = pool[Math.floor(rng() * pool.length)];
      const n = Math.round((14 + rng() * 14) * (1 + ch.band * 0.4));
      resources[key] = (resources[key] || 0) + n;
      got.push(`${n} [[${key}]]`);
    }
    const pts = 250 * (ch.band + 1) * (site.index + 1);
    score += pts;
    return { icon: 'chest', title: 'Treasure!', text: `${got.join('  ')}  and ${pts} points`, color: UI.gold };
  }

  /* -- Minigames: lock picking, power circuit, rune memory -- */
  function startMinigame(ch) {
    const diff = chestDifficulty(ch);
    const m = { kind: ch.kind, chest: ch, diff, t: 0, limit: 40, phase: 'play', endT: 0, shake: 0, flash: 0, flashOk: true, reward: null, hover: null };
    if (m.kind === 'lock') {
      m.total = 3 + Math.round(diff * 3);
      m.set = 0;
      m.lives = 3;
      m.angle = -Math.PI / 2;
      m.dir = 1;
      m.speed = 2.0 + diff * 1.6;
      m.hw = 0.42 - diff * 0.18;
      m.target = Math.PI * (0.25 + Math.random() * 0.5);
      m.limit = 40;
    } else if (m.kind === 'circuit') {
      buildCircuit(m, 4 + Math.round(diff * 2));
      m.limit = 35 + 4 * m.n;
    } else {
      m.len = 4 + Math.round(diff * 3);
      m.seq = [];
      for (let i = 0; i < m.len; ++i) m.seq.push(Math.floor(Math.random() * 6));
      m.round = 3;
      m.lives = 3;
      m.limit = 45 + m.len * 3;
      m.lit = -1;
      m.litT = 0;
      startRuneShow(m, 0.8);
    }
    minigame = m;
    state = STATE_MINIGAME;
    bombThrowMode = false;
    clearTooltip();
    SZ.GameAudio.play('powerup', { pitch: 0.7, volume: 0.6 });
  }

  function finishMinigame(win, why) {
    const m = minigame;
    if (!m || m.phase !== 'play') return;
    m.phase = win ? 'won' : 'lost';
    m.endT = 0;
    if (win) {
      const ch = m.chest;
      ch.opened = true;
      undergroundGrid[ch.r][ch.c] = TILE_EMPTY;
      tileHP[ch.r][ch.c] = tileMaxHP[ch.r][ch.c] = 0;
      m.reward = grantChestTreasure(ch);
      SZ.GameAudio.play('win', { volume: 0.8 });
      screenShake.trigger(6, 250);
    } else {
      m.chest.cooldown = CHEST_RETRY;
      m.why = why || 'The chest stays locked';
      SZ.GameAudio.play('lose', { volume: 0.7 });
    }
  }

  function closeMinigame() {
    const m = minigame;
    minigame = null;
    state = STATE_PLAYING;
    if (m && m.phase === 'won') {
      const tx = m.chest.c * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = m.chest.r * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      particles.burst(tx, ty, 40, { color: '#ffd870', speed: 4, life: 0.8 });
      particles.sparkle(tx, ty, 24, { color: '#ffe8ff', speed: 3 });
      announce(m.reward.title, m.reward.text, m.reward.color, m.reward.icon);
    }
    saveRun();
  }

  function giveUpMinigame() {
    if (minigame && minigame.phase === 'play')
      finishMinigame(false, 'You stepped away from the chest');
  }

  function updateMinigame(dt) {
    const m = minigame;
    if (!m) return;
    m.shake = Math.max(0, m.shake - dt * 3);
    m.flash = Math.max(0, m.flash - dt * 2.5);
    if (m.msg && (m.msg.t -= dt) <= 0) m.msg = null;
    if (m.phase !== 'play') {
      m.endT += dt;
      return;
    }
    const showing = m.kind === 'runes' && m.show;
    if (!showing) m.t += dt;
    if (m.t >= m.limit) {
      finishMinigame(false, 'Time ran out');
      return;
    }
    if (m.kind === 'lock')
      m.angle += m.dir * m.speed * dt;
    else if (m.kind === 'runes')
      updateRunes(m, dt);
  }

  function minigameMessage(m, text, color) {
    m.msg = { text, color, t: 1.2 };
  }

  function angleGap(a, b) {
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return Math.abs(d);
  }

  function lockPress(m) {
    const gap = angleGap(m.angle, m.target);
    if (gap <= m.hw) {
      ++m.set;
      m.flash = 1;
      m.flashOk = true;
      SZ.GameAudio.play('select', { pitch: 1 + m.set * 0.12 });
      SZ.GameAudio.play('click', { pitch: 0.7 });
      minigameMessage(m, gap <= m.hw * 0.35 ? 'PERFECT!' : 'Pin set!', gap <= m.hw * 0.35 ? UI.gold : UI.good);
      if (m.set >= m.total) {
        finishMinigame(true);
        return;
      }
      m.dir = -m.dir;
      m.speed *= 1.12;
      m.hw = Math.max(0.13, m.hw * 0.9);
      m.target = m.angle + m.dir * (Math.PI * 0.55 + Math.random() * Math.PI * 0.9);
    } else {
      --m.lives;
      m.flash = 1;
      m.flashOk = false;
      m.shake = 1;
      SZ.GameAudio.play('error');
      minigameMessage(m, 'The pick slipped!', UI.bad);
      if (m.lives <= 0)
        finishMinigame(false, 'Your last lock pick snapped');
    }
  }

  /* Power circuit: rotate the tiles until power flows from the battery to the lock.
     Connections are bits N=1, E=2, S=4, W=8 */
  function rotMask(mask, k) {
    for (let i = 0; i < ((k % 4) + 4) % 4; ++i)
      mask = ((mask << 1) | (mask >> 3)) & 15;
    return mask;
  }

  function buildCircuit(m, n) {
    m.n = n;
    const base = [];
    for (let r = 0; r < n; ++r) base.push(new Array(n).fill(0));
    // Random spanning tree (depth-first maze)
    const seen = new Set([0]);
    const stack = [[0, 0]];
    const dirs = [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const opts = dirs.filter(([dr, dc]) => r + dr >= 0 && r + dr < n && c + dc >= 0 && c + dc < n && !seen.has((r + dr) * n + c + dc));
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const [dr, dc, bit, back] = opts[Math.floor(Math.random() * opts.length)];
      base[r][c] |= bit;
      base[r + dr][c + dc] |= back;
      seen.add((r + dr) * n + c + dc);
      stack.push([r + dr, c + dc]);
    }
    m.src = Math.floor(Math.random() * n);
    m.snk = Math.floor(Math.random() * n);
    base[m.src][0] |= 8;
    base[m.snk][n - 1] |= 2;
    m.base = base;
    m.cur = { r: m.src, c: 0 };
    for (let tries = 0; tries < 20; ++tries) {
      m.rot = base.map(row => row.map(() => Math.floor(Math.random() * 4)));
      if (!circuitPowered(m).done) break;
    }
    m.spin = base.map(row => row.map(() => 0));
  }

  function circuitMask(m, r, c) {
    return rotMask(m.base[r][c], m.rot[r][c]);
  }

  // Tiles reached by power from the battery; done when the lock tile is live
  function circuitPowered(m) {
    const n = m.n, on = new Set();
    if (circuitMask(m, m.src, 0) & 8) {
      const q = [[m.src, 0]];
      on.add(m.src * n);
      while (q.length) {
        const [r, c] = q.shift();
        const mk = circuitMask(m, r, c);
        for (const [dr, dc, bit, back] of [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]]) {
          const rr = r + dr, cc = c + dc;
          if (!(mk & bit) || rr < 0 || rr >= n || cc < 0 || cc >= n || on.has(rr * n + cc)) continue;
          if (circuitMask(m, rr, cc) & back) {
            on.add(rr * n + cc);
            q.push([rr, cc]);
          }
        }
      }
    }
    return { on, done: on.has(m.snk * n + n - 1) && !!(circuitMask(m, m.snk, n - 1) & 2) };
  }

  function rotateCircuitTile(m, r, c, dir) {
    m.rot[r][c] = (m.rot[r][c] + dir + 4) % 4;
    m.spin[r][c] = dir;
    m.cur = { r, c };
    SZ.GameAudio.play('click', { pitch: 1.2 + Math.random() * 0.2, volume: 0.7 });
    if (circuitPowered(m).done) {
      SZ.GameAudio.play('zap', { pitch: 1.4 });
      finishMinigame(true);
    }
  }

  /* Rune memory: watch the runes light up, then repeat the sequence */
  const RUNE_COLORS = ['#ff6a6a', '#ffb648', '#ffe66a', '#6fe08a', '#5ab8ff', '#c890ff'];
  const RUNE_TONES = [262, 330, 392, 440, 523, 659];

  function startRuneShow(m, delay) {
    m.show = true;
    m.showI = -1;
    m.showT = -(delay || 0.6);
    m.input = 0;
    m.lit = -1;
  }

  function runeStep(m) {
    return Math.max(0.32, 0.6 - m.diff * 0.22);
  }

  function updateRunes(m, dt) {
    if (m.litT > 0) {
      m.litT -= dt;
      if (m.litT <= 0) m.lit = -1;
    }
    if (!m.show) return;
    m.showT += dt;
    const step = runeStep(m);
    const i = Math.floor(m.showT / (step + 0.16));
    if (m.showT < 0) return;
    if (i >= m.round) {
      m.show = false;
      m.lit = -1;
      return;
    }
    if (i !== m.showI) {
      m.showI = i;
      lightRune(m, m.seq[i], step);
    }
  }

  function lightRune(m, k, dur) {
    m.lit = k;
    m.litT = dur;
    SZ.GameAudio.tone(RUNE_TONES[k], dur * 0.9, 'triangle', 0.12);
  }

  function runePress(m, k) {
    if (m.show || m.phase !== 'play') return;
    lightRune(m, k, 0.25);
    if (k === m.seq[m.input]) {
      ++m.input;
      if (m.input >= m.round) {
        if (m.round >= m.len) {
          finishMinigame(true);
          return;
        }
        ++m.round;
        m.flash = 1;
        m.flashOk = true;
        minigameMessage(m, 'Correct!', UI.good);
        startRuneShow(m, 0.9);
      }
    } else {
      --m.lives;
      m.flash = 1;
      m.flashOk = false;
      m.shake = 1;
      SZ.GameAudio.play('error');
      minigameMessage(m, 'Wrong rune - watch again', UI.bad);
      if (m.lives <= 0)
        finishMinigame(false, 'The runes went dark');
      else
        startRuneShow(m, 1.0);
    }
  }

  /* -- Minigame layout, input and drawing -- */
  function minigameLayout() {
    const w = 900, h = 680, x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
    return { x, y, w, h, cx: x + w / 2, bodyY: y + 112, bodyH: h - 112 - 64 };
  }

  function runeSpots() {
    const L = minigameLayout();
    const cx = L.cx, cy = L.bodyY + L.bodyH / 2 + 6;
    return RUNE_COLORS.map((col, i) => {
      const a = -Math.PI / 2 + i * TWO_PI / 6;
      return { x: cx + Math.cos(a) * 170, y: cy + Math.sin(a) * 170, r: 52, i };
    });
  }

  function circuitGeom(m) {
    const L = minigameLayout();
    const cell = Math.min(86, Math.floor(430 / m.n));
    const gw = cell * m.n;
    return { cell, gx: L.cx - gw / 2, gy: L.bodyY + (L.bodyH - gw) / 2 + 8 };
  }

  function minigameKey(e) {
    const m = minigame;
    if (!m) return false;
    if (m.phase !== 'play') {
      if (m.endT > 0.35 && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape' || e.code === 'NumpadEnter'))
        closeMinigame();
      return true;
    }
    if (e.code === 'Escape') {
      giveUpMinigame();
      return true;
    }
    if (m.kind === 'lock') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') {
        if (!e.repeat) lockPress(m);
        return true;
      }
    } else if (m.kind === 'circuit') {
      const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] }[e.code];
      if (mv) {
        m.cur = { r: Math.max(0, Math.min(m.n - 1, m.cur.r + mv[0])), c: Math.max(0, Math.min(m.n - 1, m.cur.c + mv[1])) };
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        rotateCircuitTile(m, m.cur.r, m.cur.c, e.shiftKey ? -1 : 1);
        return true;
      }
    } else if (/^(Digit|Numpad)[1-6]$/.test(e.code)) {
      runePress(m, parseInt(e.code.slice(-1), 10) - 1);
      return true;
    }
    return true;
  }

  function minigameClick(mx, my, button) {
    const m = minigame;
    if (!m) return;
    if (m.phase !== 'play') {
      if (m.endT > 0.35) closeMinigame();
      return;
    }
    const L = minigameLayout();
    if (inRect(mx, my, { x: L.x + L.w - 54, y: L.y + 12, w: 40, h: 40 })) {
      giveUpMinigame();
      return;
    }
    if (m.kind === 'lock')
      lockPress(m);
    else if (m.kind === 'circuit') {
      const g = circuitGeom(m);
      const c = Math.floor((mx - g.gx) / g.cell), r = Math.floor((my - g.gy) / g.cell);
      if (r >= 0 && r < m.n && c >= 0 && c < m.n)
        rotateCircuitTile(m, r, c, button === 2 ? -1 : 1);
    } else {
      for (const sp of runeSpots())
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r + 6) {
          runePress(m, sp.i);
          break;
        }
    }
  }

  function minigameHover(mx, my) {
    const m = minigame;
    if (!m) return;
    m.hover = null;
    if (m.kind === 'circuit' && m.phase === 'play') {
      const g = circuitGeom(m);
      const c = Math.floor((mx - g.gx) / g.cell), r = Math.floor((my - g.gy) / g.cell);
      if (r >= 0 && r < m.n && c >= 0 && c < m.n) m.hover = { r, c };
    } else if (m.kind === 'runes') {
      for (const sp of runeSpots())
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r + 6) m.hover = sp.i;
    }
  }

  // Rune glyph: a few strokes inside a unit circle
  const RUNE_GLYPHS = [
    [[0, -0.7, 0, 0.7], [0, -0.1, 0.5, -0.6], [0, 0.2, -0.5, -0.3]],
    [[-0.5, -0.6, 0.5, -0.6], [0.5, -0.6, -0.4, 0.7], [-0.3, 0, 0.4, 0]],
    [[-0.55, 0.6, 0, -0.65], [0, -0.65, 0.55, 0.6], [-0.3, 0.1, 0.3, 0.1]],
    [[-0.5, -0.6, -0.5, 0.6], [0.5, -0.6, 0.5, 0.6], [-0.5, -0.6, 0.5, 0.6]],
    [[0, -0.7, 0, 0.7], [-0.55, -0.3, 0.55, -0.3], [-0.55, 0.3, 0.55, 0.3]],
    [[-0.5, -0.5, 0.5, 0.5], [0.5, -0.5, -0.5, 0.5], [0, -0.7, 0, -0.35], [0, 0.35, 0, 0.7]]
  ];

  function drawRune(k, x, y, r, lit, hover) {
    const col = RUNE_COLORS[k];
    ctx.save();
    if (lit) drawGlow(col, x, y, r * 2.2, 0.9);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, lit ? '#ffffff' : hexToRgba(col, hover ? 0.5 : 0.32));
    g.addColorStop(1, lit ? col : 'rgba(20,24,40,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = lit ? 4 : 2.5;
    ctx.strokeStyle = lit ? '#ffffff' : hexToRgba(col, hover ? 1 : 0.7);
    ctx.stroke();
    ctx.strokeStyle = lit ? '#2a1030' : col;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of RUNE_GLYPHS[k]) {
      ctx.moveTo(x + x0 * r * 0.6, y + y0 * r * 0.6);
      ctx.lineTo(x + x1 * r * 0.6, y + y1 * r * 0.6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPipeTile(m, r, c, x, y, cell, powered, hover, focus) {
    ctx.save();
    roundRectPath(x + 3, y + 3, cell - 6, cell - 6, 9);
    ctx.fillStyle = hover ? 'rgba(60,70,100,0.95)' : 'rgba(26,30,48,0.95)';
    ctx.fill();
    ctx.lineWidth = focus ? 3 : 1;
    ctx.strokeStyle = focus ? UI.gold : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    const mask = circuitMask(m, r, c);
    const cx = x + cell / 2, cy = y + cell / 2, L = cell / 2 - 3;
    const segs = [];
    if (mask & 1) segs.push([0, -L]);
    if (mask & 2) segs.push([L, 0]);
    if (mask & 4) segs.push([0, L]);
    if (mask & 8) segs.push([-L, 0]);
    ctx.lineCap = 'round';
    for (const [wdt, col] of powered ? [[cell * 0.26, 'rgba(90,220,255,0.35)'], [cell * 0.13, '#8af0ff']] : [[cell * 0.18, '#0a0c16'], [cell * 0.11, '#5a6688']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      for (const [dx, dy] of segs) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
      }
      ctx.stroke();
    }
    if (powered) {
      // Current flowing along the pipes
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -animTime * 40;
      ctx.beginPath();
      for (const [dx, dy] of segs) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = powered ? '#c8f8ff' : '#3a4460';
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.1, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  function drawMinigame() {
    const m = minigame;
    if (!m) return;
    drawScrim(0.7);
    const L = minigameLayout();
    const shake = m.shake > 0 ? Math.sin(animTime * 70) * 8 * m.shake : 0;
    ctx.save();
    ctx.translate(shake, 0);
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#c890ff', radius: 16, title: `[[chest]] Secret Chest: ${MINIGAME_NAMES[m.kind]}`, titlePx: 26, headerH: 64, top: 'rgba(28,24,48,0.98)', bottom: 'rgba(12,10,24,0.98)', glow: true });
    if (m.phase === 'play')
      drawSmallButton({ x: L.x + L.w - 54, y: L.y + 12, w: 40, h: 40 }, '×', true, false, '#8aa8d8', 22);
    // Difficulty pips and depth
    const pips = 1 + Math.round(m.diff * 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    fitText(`Depth ${m.chest.r} m`, L.x + L.w - 70, L.y + 33, 140, 15, { color: UI.textDim });
    for (let i = 0; i < 5; ++i) {
      ctx.fillStyle = i < pips ? '#e0a0ff' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(L.x + L.w - 300 + i * 18, L.y + 33, 6, 0, TWO_PI);
      ctx.fill();
    }
    // Timer
    const left = Math.max(0, m.limit - m.t);
    drawMeter(L.x + 30, L.y + 80, L.w - 60, 12, left / m.limit, left < 8 ? '#ff6a5a' : '#c890ff', { track: 'rgba(0,0,0,0.6)' });
    ctx.textAlign = 'right';
    fitText(`${Math.ceil(left)} s`, L.x + L.w - 30, L.y + 101, 80, 14, { weight: 'bold', color: left < 8 ? '#ff8a7a' : UI.textDim });
    ctx.textAlign = 'left';
    const hintY = L.y + 101;
    ctx.save();
    if (m.phase !== 'play')
      ctx.globalAlpha *= 0.3;
    if (m.kind === 'lock') drawLockGame(m, L);
    else if (m.kind === 'circuit') drawCircuitGame(m, L);
    else drawRuneGame(m, L);
    ctx.restore();
    if (m.msg && m.phase === 'play') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.msg.t * 3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(m.msg.text, L.cx, L.y + 140 - (1.2 - m.msg.t) * 12, 420, 24, { weight: 'bold', color: m.msg.color, outline: 'rgba(0,0,0,0.8)' });
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const hint = { lock: 'Press when the needle crosses the gold zone', circuit: 'Rotate tiles until power reaches the lock', runes: 'Watch the runes, then repeat them in order' }[m.kind];
    fitText(hint, L.x + 30, hintY, L.w - 160, 15, { color: UI.text });
    // Result
    if (m.phase !== 'play') {
      const k = Math.min(1, m.endT / 0.3);
      ctx.save();
      ctx.globalAlpha = k;
      roundRectPath(L.x + 60, L.y + 190, L.w - 120, 300, 16);
      ctx.fillStyle = 'rgba(8,8,18,0.97)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.phase === 'won' ? UI.gold : '#ff7a6a';
      ctx.stroke();
      if (m.phase === 'won') {
        drawHeadline('UNLOCKED!', L.cx, L.y + 240, L.w - 200, 46, '#ffe080', '#e0a020');
        const r = m.reward;
        drawSprite(r.icon, L.cx, L.y + 325, 72);
        ctx.textAlign = 'center';
        fitText(r.title, L.cx, L.y + 395, L.w - 180, 24, { weight: 'bold', color: r.color });
        drawTextBlock(r.text, L.x + 100, L.y + 412, L.w - 200, 52, 17, { align: 'center', valign: 'middle', color: UI.text, minPx: 12 });
      } else {
        drawHeadline('LOCKED', L.cx, L.y + 250, L.w - 200, 46, '#ff8a7a', '#c01818');
        drawSprite('lock', L.cx, L.y + 330, 64);
        ctx.textAlign = 'center';
        fitText(m.why, L.cx, L.y + 400, L.w - 180, 22, { weight: 'bold', color: UI.text });
        fitText(`Try again in ${CHEST_RETRY} s`, L.cx, L.y + 438, L.w - 180, 17, { color: UI.textDim });
      }
      ctx.restore();
    }
    const keys = m.phase !== 'play' ? [{ key: 'Click', label: 'Continue' }, { key: 'Enter', label: 'Continue' }]
      : m.kind === 'lock' ? [{ key: 'Space', label: 'Set pin' }, { key: 'Click', label: 'Set pin' }, { key: 'Esc', label: 'Give up' }]
      : m.kind === 'circuit' ? [{ key: 'Click', label: 'Rotate' }, { key: 'Right click', label: 'Back' }, { key: '←↑→↓', label: 'Select' }, { key: 'Space', label: 'Rotate' }, { key: 'Esc', label: 'Give up' }]
      : [{ key: '1-6', label: 'Rune' }, { key: 'Click', label: 'Rune' }, { key: 'Esc', label: 'Give up' }];
    drawKeyHints(keys, L.cx, L.y + L.h - 30, L.w - 80);
    ctx.restore();
  }

  function drawLives(m, L, icon) {
    for (let i = 0; i < 3; ++i)
      drawSprite(icon, L.x + L.w - 50 - i * 34, L.y + 140, 28, i < m.lives ? 1 : 0.2);
  }

  function drawLockGame(m, L) {
    const cx = L.cx, cy = L.bodyY + 230, R = 165;
    drawLives(m, L, 'wrench');
    // Ring track with tick marks
    ctx.save();
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200,170,255,0.25)';
    for (let i = 0; i < 48; ++i) {
      const a = i * TWO_PI / 48, l = i % 4 ? 6 : 12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 13), cy + Math.sin(a) * (R - 13));
      ctx.lineTo(cx + Math.cos(a) * (R - 13 - l), cy + Math.sin(a) * (R - 13 - l));
      ctx.stroke();
    }
    // Gold zone (perfect core is brighter)
    ctx.shadowColor = UI.gold;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 22;
    ctx.strokeStyle = 'rgba(255,200,80,0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, m.target - m.hw, m.target + m.hw);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(cx, cy, R, m.target - m.hw * 0.35, m.target + m.hw * 0.35);
    ctx.stroke();
    // Lock body with keyhole
    const flashCol = m.flash > 0 ? (m.flashOk ? `rgba(120,255,150,${m.flash * 0.6})` : `rgba(255,90,80,${m.flash * 0.6})`) : null;
    const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110);
    g.addColorStop(0, '#5a4a7a');
    g.addColorStop(1, '#1a1428');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c8a0ff';
    ctx.stroke();
    if (flashCol) {
      ctx.fillStyle = flashCol;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = '#0a0612';
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 18, 0, TWO_PI);
    ctx.fill();
    ctx.fillRect(cx - 8, cy - 8, 16, 40);
    // Needle
    const nx = cx + Math.cos(m.angle) * (R + 6), ny = cy + Math.sin(m.angle) * (R + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(m.angle) * 100, cy + Math.sin(m.angle) * 100);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    drawGlow('#ffffff', nx, ny, 22, 0.9);
    ctx.fillStyle = '#ffe8ff';
    ctx.beginPath();
    ctx.arc(nx, ny, 9, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    // Pins
    const pw = 34, gap = 14, total = m.total * pw + (m.total - 1) * gap;
    for (let i = 0; i < m.total; ++i) {
      const px = cx - total / 2 + i * (pw + gap), py = cy + R + 44;
      roundRectPath(px, py, pw, 46, 7);
      ctx.fillStyle = i < m.set ? 'rgba(255,215,90,0.85)' : 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = i < m.set ? '#fff2b0' : 'rgba(200,170,255,0.35)';
      ctx.stroke();
      ctx.fillStyle = i < m.set ? '#5a3a08' : 'rgba(200,170,255,0.4)';
      ctx.fillRect(px + pw / 2 - 3, py + (i < m.set ? 8 : 20), 6, 18);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`Pins ${m.set} / ${m.total}`, cx, cy + R + 108, 300, 18, { weight: 'bold', color: UI.text });
  }

  function drawCircuitGame(m, L) {
    const g = circuitGeom(m);
    const pw = circuitPowered(m);
    for (let r = 0; r < m.n; ++r)
      for (let c = 0; c < m.n; ++c) {
        const hover = m.hover && m.hover.r === r && m.hover.c === c;
        drawPipeTile(m, r, c, g.gx + c * g.cell, g.gy + r * g.cell, g.cell, pw.on.has(r * m.n + c), hover, m.cur.r === r && m.cur.c === c);
      }
    // Battery on the left, lock on the right
    const by = g.gy + m.src * g.cell + g.cell / 2, sy = g.gy + m.snk * g.cell + g.cell / 2;
    ctx.save();
    ctx.strokeStyle = '#8af0ff';
    ctx.lineWidth = g.cell * 0.13;
    ctx.beginPath();
    ctx.moveTo(g.gx - 40, by);
    ctx.lineTo(g.gx + 3, by);
    ctx.stroke();
    ctx.strokeStyle = pw.done ? '#8af0ff' : '#5a6688';
    ctx.beginPath();
    ctx.moveTo(g.gx + g.cell * m.n - 3, sy);
    ctx.lineTo(g.gx + g.cell * m.n + 40, sy);
    ctx.stroke();
    ctx.restore();
    drawGlow('#8af0ff', g.gx - 60, by, 50, 0.6 + Math.sin(animTime * 5) * 0.2);
    drawSprite('bolt', g.gx - 62, by, 44);
    drawGlow(pw.done ? '#ffe080' : '#c890ff', g.gx + g.cell * m.n + 64, sy, 50, 0.5);
    drawSprite('chest', g.gx + g.cell * m.n + 64, sy, 48);
    drawSprite('lock', g.gx + g.cell * m.n + 64, sy - 34, 22, pw.done ? 0.3 : 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`${pw.on.size} of ${m.n * m.n} tiles powered`, L.cx, g.gy + g.cell * m.n + 26, 400, 16, { color: UI.textDim });
  }

  function drawRuneGame(m, L) {
    drawLives(m, L, 'heart');
    const cx = L.cx, cy = L.bodyY + L.bodyH / 2 + 6;
    // Centre emblem: round and progress
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
    g.addColorStop(0, m.flash > 0 ? (m.flashOk ? 'rgba(120,255,160,0.6)' : 'rgba(255,90,80,0.6)') : 'rgba(80,60,120,0.6)');
    g.addColorStop(1, 'rgba(20,16,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(m.show ? 'Watch…' : 'Your turn', cx, cy - 22, 150, 22, { weight: 'bold', color: m.show ? '#e0c8ff' : UI.gold });
    fitText(`Round ${m.round - 2} of ${m.len - 2}`, cx, cy + 6, 150, 15, { color: UI.textDim });
    // Dots for the sequence entered so far
    for (let i = 0; i < m.round; ++i) {
      ctx.fillStyle = i < m.input ? UI.gold : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx - (m.round - 1) * 9 + i * 18, cy + 34, 5, 0, TWO_PI);
      ctx.fill();
    }
    for (const sp of runeSpots()) {
      drawRune(sp.i, sp.x, sp.y, sp.r, m.lit === sp.i, m.hover === sp.i && !m.show);
      ctx.textAlign = 'center';
      fitText(String(sp.i + 1), sp.x + sp.r * 0.78, sp.y + sp.r * 0.78, 24, 14, { weight: 'bold', color: UI.textDim, outline: 'rgba(0,0,0,0.8)' });
    }
  }

  // Secret chests in the rock: hidden ones barely glint, found ones glow
  function drawChests() {
    for (const ch of chests) {
      if (ch.opened) continue;
      const x = ch.c * TILE_SIZE - cameraX, y = ch.r * TILE_SIZE - cameraY;
      if (x < -TILE_SIZE || x > CANVAS_W || y < -TILE_SIZE || y > CANVAS_H) continue;
      if (!ch.revealed) {
        if (Math.sin(animTime * 0.9 + ch.c) > 0.985)
          particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#f0d8ff', speed: 0.4 });
        continue;
      }
      const pulse = Math.sin(animTime * 3 + ch.c) * 0.5 + 0.5;
      const cx = x + TILE_SIZE / 2, cy = y + TILE_SIZE / 2;
      drawGlow(ch.cooldown > 0 ? '#ff7060' : '#d890ff', cx, cy, TILE_SIZE * (1.1 + pulse * 0.3), 0.55);
      drawGlow('#ffe080', cx, cy, TILE_SIZE * 0.7, 0.3 + pulse * 0.2);
      drawSprite('chest', cx, cy + Math.sin(animTime * 2 + ch.r) * 1.5, 34);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ch.cooldown > 0) {
        drawSprite('lock', cx, cy - 30, 18);
        fitText(`${Math.ceil(ch.cooldown)} s`, cx, cy + 28, 60, 14, { weight: 'bold', color: '#ffb0a8', outline: 'rgba(0,0,0,0.85)' });
      } else
        fitText('!', cx, cy - 30 + Math.sin(animTime * 5) * 3, 30, 22, { weight: 'bold', color: '#ffe8a0', outline: 'rgba(60,20,80,0.9)' });
      if (Math.random() < 0.04)
        particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#ffe0ff', speed: 0.6 });
    }
  }

  // Scanners sense the nearest hidden chest: an arrow points the way
  function drawChestHints(scanRange) {
    if (!scanRange) return;
    let best = null, bestD = Infinity;
    for (const ch of chests) {
      if (ch.opened || ch.revealed) continue;
      const d = Math.abs(ch.r - drillY) + Math.abs(ch.c - drillX);
      if (d <= scanRange) {
        revealChest(ch, true);
        continue;
      }
      if (d < bestD) {
        bestD = d;
        best = ch;
      }
    }
    if (!best || bestD > scanRange * 8) return;
    drawPointer(best.r, best.c, scanRange, '#e0a0ff', 'chest');
  }

  // Arrow at the edge of the scanner ring that points to a tile
  function drawPointer(r, c, scanRange, color, icon) {
    const px = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, py = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    const a = Math.atan2(r - drillY, c - drillX);
    const rr = (scanRange + 0.8) * TILE_SIZE;
    const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr;
    const pulse = 0.5 + Math.sin(animTime * 5) * 0.4;
    drawGlow(color, ax, ay, 34, pulse * 0.8);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hexToRgba(color, 0.55 + pulse * 0.45);
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-9, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawSprite(icon, ax - Math.cos(a) * 34, ay - Math.sin(a) * 34, 24, 0.6 + pulse * 0.4);
  }

  /* ======================================================================
     UPGRADE SYSTEM
     ====================================================================== */

  function totalResources() {
    let total = 0;
    for (const key in resources)
      total += resources[key];
    return total;
  }

  /* ======================================================================
     UPGRADE TREE (full-screen dialog)
     ====================================================================== */

  function getTreeNodeLevel(id) {
    return upgradeTreeLevels[id] || 0;
  }

  const TREE_NODE_BY_ID = {};
  for (const n of UPGRADE_TREE)
    TREE_NODE_BY_ID[n.id] = n;

  function isTreeNodeMaxed(id) {
    const node = TREE_NODE_BY_ID[id];
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
    if (node.branch === 'drone')
      syncDrones(true);

    SZ.GameAudio.play('levelup');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${node.name} purchased!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 12, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(4, 120);
  }

  // Passive gadgets that don't need selection
  const PASSIVE_GADGETS = ['scanner', 'reinforcedDome', 'autoRepair', 'domeExpansion', 'energyShield', 'magnet', 'fortune', 'silkTouch', 'echoLocation', 'chainLightning', 'freezeRay', 'plasmaCannon', 'damageReflect', 'emergencyShield', 'fortifiedBase', 'lastStand', 'oreDetector', 'autoMine', 'tunnelBore', 'veinMiner', 'doubleJump', 'wallClimb', 'dash', 'undergroundRadar', 'multiShot', 'homingShots', 'criticalHit', 'explosiveRounds', 'droneBay', 'droneMiner', 'combatDrone', 'repairDrone', 'recipeBomb', 'recipeBig', 'recipeMega', 'recipeVoid', 'chainReaction', 'remoteDetonator', 'stickyBombs', 'blastSuit'];

  function applyGadgetUnlock(key) {
    unlockedTools[key] = true;
    // Apply immediate effects for certain gadgets
    if (key === 'domeExpansion' || key === 'fortifiedBase') {
      maxDomeHP = computeMaxDomeHP();
      domeHP = Math.min(domeHP + (key === 'domeExpansion' ? 75 : 50), maxDomeHP);
    }
    // Auto-select non-passive tools
    if (!PASSIVE_GADGETS.includes(key))
      activeToolKey = key;
  }

  function getEffectiveLevel(key) {
    let levels = 0;
    for (const n of UPGRADE_TREE)
      if (n.upgradeKey === key)
        levels += getTreeNodeLevel(n.id);
    return levels;
  }

  // Map quick-upgrade levels of an old save onto the matching tree chain:
  // the chain is owned up to (tree levels + legacy levels) nodes
  function absorbLegacyUpgrades(levels) {
    for (const key in LEGACY_UPGRADE_CHAINS) {
      const extra = Math.max(0, Math.floor(Number(levels[key]) || 0));
      if (!extra) continue;
      const prefix = LEGACY_UPGRADE_CHAINS[key];
      const chain = UPGRADE_TREE
        .filter(n => n.type === 'stat' && n.upgradeKey === key && new RegExp('^' + prefix + '\\d+$').test(n.id))
        .sort((a, b) => parseInt(a.id.slice(prefix.length), 10) - parseInt(b.id.slice(prefix.length), 10));
      let owned = 0;
      for (const n of chain)
        if (getTreeNodeLevel(n.id) >= n.maxLevel) ++owned;
      const target = Math.min(chain.length, owned + extra);
      for (let i = 0; i < target; ++i)
        upgradeTreeLevels[chain[i].id] = chain[i].maxLevel;
    }
  }

  // Dome capacity from every source: shield chain, dome gadgets and armour found in the mine
  function computeMaxDomeHP() {
    let hp = BASE_DOME_HP + getEffectiveLevel('domeHP') * 25;
    if (unlockedTools.domeExpansion) hp += 75;
    if (unlockedTools.fortifiedBase) hp += 50;
    hp += 50 * foundGadgets.filter(g => g === 'domeArmor').length;
    return hp;
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
        maxDomeHP = computeMaxDomeHP();
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
      // Groups of a branch (the Tools branch has tools and bombs) sit side by side
      const groupNames = [];
      for (const n of UPGRADE_TREE)
        if (n.branch === branch && groupNames.indexOf(n.group || '') < 0)
          groupNames.push(n.group || '');
      let colOffset = 0, rows = 0;
      const depthOf = {}, laneOf = {}, groupX = [];
      for (const group of groupNames) {
        const branchNodes = UPGRADE_TREE.filter(n => n.branch === branch && (n.group || '') === group);
        const nodeMap = {};
        branchNodes.forEach((n, i) => { nodeMap[n.id] = { n, i }; });
        const gDepth = {};
        const assignDepth = (n) => {
          if (gDepth[n.id] !== undefined) return gDepth[n.id];
          let maxParent = -1;
          for (const pid of n.prereqs)
            if (nodeMap[pid])
              maxParent = Math.max(maxParent, assignDepth(nodeMap[pid].n));
          gDepth[n.id] = maxParent + 1;
          return gDepth[n.id];
        };
        branchNodes.forEach(assignDepth);

        const order = branchNodes.slice().sort((a, b) => gDepth[a.id] - gDepth[b.id] || nodeMap[a.id].i - nodeMap[b.id].i);
        const lanes = [];
        const continued = {};
        for (const n of order) {
          const parents = n.prereqs.filter(p => nodeMap[p]).sort((a, b) => gDepth[b] - gDepth[a]);
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
          const ds = l.ids.map(id => gDepth[id]);
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
          maxDepth = Math.max(maxDepth, gDepth[n.id]);
        groupX.push({ group, col: colOffset });
        for (const n of branchNodes)
          depthOf[n.id] = gDepth[n.id] + colOffset;
        colOffset += maxDepth + 1 + 0.5;
        rows = Math.max(rows, rowSpans.length);
      }
      branchGrids.push({ branch, branchNodes: UPGRADE_TREE.filter(n => n.branch === branch), depthOf, laneOf, rows, cols: colOffset - 0.5, groupX });
    }

    // Regions row by row (TREE_REGION_ROWS), each row centred
    const regionW = (g) => g.cols * pitchX - TREE_GAP_X + TREE_REGION_PAD * 2;
    const regionH = (g) => TREE_REGION_HEADER + g.rows * pitchY - TREE_GAP_Y + TREE_REGION_PAD;
    const gridOf = {};
    for (const g of branchGrids)
      gridOf[g.branch] = g;
    const rowWidth = TREE_REGION_ROWS.map(row => row.reduce((w, b) => w + regionW(gridOf[b]), 0) + (row.length - 1) * TREE_REGION_GAP);
    const totalW = Math.max(...rowWidth);
    const placeOf = {};
    let rowY = 0;
    TREE_REGION_ROWS.forEach((row, ri) => {
      let x = (totalW - rowWidth[ri]) / 2;
      let h = 0;
      for (const b of row) {
        placeOf[b] = { x, y: rowY };
        x += regionW(gridOf[b]) + TREE_REGION_GAP;
        h = Math.max(h, regionH(gridOf[b]));
      }
      rowY += h + TREE_REGION_GAP;
    });
    const totalH = rowY - TREE_REGION_GAP;
    for (let i = 0; i < branchGrids.length; ++i) {
      const g = branchGrids[i];
      const cx = placeOf[g.branch].x;
      const gy = placeOf[g.branch].y;
      regions[g.branch] = { x: cx, y: gy, w: regionW(g), h: regionH(g), branch: g.branch, groups: g.groupX.map(q => ({ group: q.group, x: cx + TREE_REGION_PAD + q.col * pitchX })) };
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
    regions.all = { x: 0, y: 0, w: totalW, h: totalH };
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
    const gap = 10;
    const tabW = Math.min(180, Math.floor((CANVAS_W - 48 - (ids.length - 1) * gap) / ids.length));
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

    drawNodeFrame(x, y, w, h, color, st, isHover || isFocus);

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
      drawTextBlock(info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : ''), textX, y + 8, textW, h - 16, 24, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 14, lineGap: 1.1 });
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
    if (/^Digit[1-9]$/.test(e.code) && parseInt(e.code.slice(5), 10) <= tabs.length) {
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

  // Optionally opens on a branch tab or with a node focused (from the quick panel)
  function openUpgradeDialog(focusId, tab) {
    if (state !== STATE_PLAYING && state !== STATE_PAUSED) return;
    stateBeforeUpgradeDialog = state;
    state = STATE_UPGRADE_DIALOG;
    upgradeDialogHover = null;
    upgradePanning = false;
    clearTooltip();
    computeTreeLayout();
    const focus = focusId && treeLayout.byId[focusId];
    if (focus || tab) {
      treeTab = focus ? focus.branch : tab;
      fitTreeView(treeTab, true);
      upgradeViewCustomized = true;
      if (focus) {
        treeCam.tz = upgradeZoom = Math.max(upgradeZoom, 0.75);
        treeCam.tx = upgradePanX = TREE_VIEW.x + TREE_VIEW.w / 2 - (focus.x + focus.w / 2) * upgradeZoom;
        treeCam.ty = upgradePanY = TREE_VIEW.y + TREE_VIEW.h / 2 - (focus.y + focus.h / 2) * upgradeZoom;
        focusTreeNode(focus);
      }
    } else if (!upgradeViewCustomized) {
      // First open of a run fits the selected branch; afterwards the view is kept
      fitTreeView(treeTab, true);
      upgradeViewCustomized = true;
    }
    treeCam.last = 0;
  }

  function closeUpgradeDialog() {
    clearTooltip();
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
      // Header only when its strip is on screen (the clip would hide it anyway)
      if (r.y + TREE_REGION_HEADER < viewT || r.y > viewB || r.x + TREE_REGION_PAD < viewL - 40 || r.x > viewR) continue;
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
      for (const g of r.groups || [])
        if (g.group && TREE_GROUP_LABELS[g.group])
          fitText(TREE_GROUP_LABELS[g.group], g.x, r.y + TREE_REGION_HEADER / 2, TREE_CARD_W * 2, headPx * 0.85, { weight: 'bold', color });
    }

    // Connectors: locked first, owned last so the brightest lines sit on top
    const edges = [[], [], []];
    for (const ln of treeLayout.nodes)
      for (const pid of ln.node.prereqs) {
        const parent = treeLayout.byId[pid];
        if (!parent || parent.branch !== ln.branch) continue;
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
          primaryGadgetState.cooldown = 30 - 4 * getEffectiveLevel('shieldRecharge');
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
            if (e.hidden) continue;
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
            if (e.hidden) continue;
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
        toolState.autoRepairTimer = 5 / (1 + 0.6 * getEffectiveLevel('autoRepairSpeed')); // heal every 5 seconds (faster with upgrades)
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
        if (dist > 2 + getEffectiveLevel('magnetRange')) continue;
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

    // Shield Regen: slow passive repair
    const regen = getEffectiveLevel('shieldRegen');
    if (regen > 0 && domeHP > 0 && domeHP < maxDomeHP)
      domeHP = Math.min(maxDomeHP, domeHP + 0.2 * regen * dt);
    // Shield Recharge: the Shield Generator comes back on its own after a while
    const recharge = getEffectiveLevel('shieldRecharge');
    if (primaryGadget === 'shield' && !primaryGadgetState.active && recharge > 0) {
      primaryGadgetState.rechargeTimer = (primaryGadgetState.rechargeTimer || 0) + dt;
      if (primaryGadgetState.rechargeTimer >= 50 - 8 * recharge) {
        primaryGadgetState.active = true;
        primaryGadgetState.rechargeTimer = 0;
        if (currentView === VIEW_SURFACE)
          floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
      }
    }
    if (domeInvulnerable > 0) domeInvulnerable = Math.max(0, domeInvulnerable - dt);
    if (emergencyCooldown > 0) emergencyCooldown = Math.max(0, emergencyCooldown - dt);
    if (dashCooldown > 0) dashCooldown = Math.max(0, dashCooldown - dt);
    // Ore Detector: hidden chambers and the Relocation Core show up nearby
    if (unlockedTools.oreDetector) {
      const R = 6 + 3 * (getEffectiveLevel('oreDetector') - 1);
      for (const ch of gadgetChambers)
        if (!ch.revealed && Math.abs(ch.r - drillY) + Math.abs(ch.c - drillX) <= R)
          ch.revealed = true;
      if (!relocationCore.revealed && Math.abs(relocationCore.r - drillY) + Math.abs(relocationCore.c - drillX) <= R)
        relocationCore.revealed = true;
      if (currentView === VIEW_UNDERGROUND)
        revealChestsNear(drillY, drillX, R, true);
    }

    // Scanner passive: always active when unlocked (echo location extends range)
    toolState.scannerActive = !!unlockedTools.scanner;
    toolState.echoLocationActive = !!unlockedTools.echoLocation;
  }

  /* ======================================================================
     DRONES -- couriers in the mine, gun and repair drones at the dome
     ====================================================================== */

  const DRONE_DOCK_TIME = 1.2;   // seconds a courier rests in the dome between trips
  let drones = [];               // couriers: { x, y, state, path, pi, cargo, job, timer, ... }
  let gunDrones = [];            // { angle, x, y, cooldown, flash, tx, ty }
  let repairBot = null;          // { x, y, angle, beam, spark }

  function droneShaftTile() {
    return { col: Math.floor(GRID_COLS / 2), row: 0 };
  }

  function courierCount() {
    let n = (unlockedTools.droneBay ? 1 : 0) + (primaryGadget === 'droneyard' ? 1 : 0);
    if (n > 0)
      n += getEffectiveLevel('droneCount');
    return n;
  }

  function droneBoost() {
    return primaryGadget === 'droneyard' ? 1.5 : 1;
  }

  // Flight speed in px/s, cargo size, pickup radius (tiles), laser reach (tiles) and laser speed
  function droneSpeed() { return TILE_SIZE * 3.2 * Math.pow(1.3, getEffectiveLevel('droneSpeed')) * droneBoost(); }
  function droneCargoCap() { return 15 + 15 * getEffectiveLevel('droneCargo'); }
  function dronePickupRadius() { return 1 + getEffectiveLevel('droneSpeed'); }
  function droneLaserReach() { return 4 + 2 * getEffectiveLevel('droneMining'); }
  function droneLaserSpeed() { return Math.pow(1.35, getEffectiveLevel('droneMining')) * droneBoost(); }

  // Bring the drone fleet in line with the upgrades (new drones start in the dome)
  function syncDrones(announce) {
    const shaft = droneShaftTile();
    const want = courierCount();
    while (drones.length < want) {
      drones.push({ x: shaft.col * TILE_SIZE + TILE_SIZE / 2, y: -TILE_SIZE, state: 'dock', path: null, pi: 0, cargo: 0, job: null, timer: 0.5 + drones.length * 0.4, phase: Math.random() * TWO_PI, repath: 0, laser: 0 });
      if (announce)
        floatingText.add(DOME_X - 150, DOME_Y - 170, 'Courier drone ready!', { color: '#d8b8ff', font: 'bold 24px sans-serif' });
    }
    drones.length = Math.min(drones.length, want);
    const guns = unlockedTools.combatDrone ? (getEffectiveLevel('combatDroneLevel') >= 2 ? 2 : 1) : 0;
    while (gunDrones.length < guns)
      gunDrones.push({ angle: gunDrones.length * Math.PI, x: DOME_X, y: DOME_Y - 160, cooldown: 0.5, flash: 0, tx: 0, ty: 0 });
    gunDrones.length = guns;
    if (unlockedTools.repairDrone && !repairBot)
      repairBot = { x: DOME_X + 60, y: DOME_Y - 150, angle: 0, beam: 0, bx: DOME_X, by: DOME_Y - DOME_RADIUS };
    if (!unlockedTools.repairDrone)
      repairBot = null;
  }

  function droneTile(d) {
    return { col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(d.x / TILE_SIZE))), row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(d.y / TILE_SIZE))) };
  }

  // Exposed ore near the keeper that no one else is working on, nearest first
  function findDroneOre(d) {
    const R = droneLaserReach();
    let best = null, bestD = Infinity;
    for (let r = Math.max(0, drillY - R); r <= Math.min(GRID_ROWS - 1, drillY + R); ++r)
      for (let c = Math.max(0, drillX - R); c <= Math.min(GRID_COLS - 1, drillX + R); ++c) {
        const t = undergroundGrid[r][c];
        if (!RESOURCE_TILES.includes(t)) continue;
        const dist = Math.abs(r - drillY) + Math.abs(c - drillX);
        if (dist > R || dist >= bestD) continue;
        if (miningTarget && miningTarget.col === c && miningTarget.row === r) continue;
        if (drones.some(o => o !== d && o.job && o.job.kind === 'mine' && o.job.col === c && o.job.row === r)) continue;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const ar = r + dr, ac = c + dc;
          if (ar < 0 || ar >= GRID_ROWS || ac < 0 || ac >= GRID_COLS || undergroundGrid[ar][ac] !== TILE_EMPTY) continue;
          best = { kind: 'mine', col: c, row: r, standCol: ac, standRow: ar };
          bestD = dist;
          break;
        }
      }
    return best;
  }

  function nearestDrop(fromCol, fromRow) {
    let best = null, bestD = Infinity;
    for (const drop of droppedResources) {
      if (drones.some(o => o.job && o.job.kind === 'drop' && o.job.drop === drop)) continue;
      const dist = Math.abs(drop.col - fromCol) + Math.abs(drop.row - fromRow);
      if (dist < bestD) {
        bestD = dist;
        best = drop;
      }
    }
    return best;
  }

  // Next errand for a courier with room in its hold
  function pickDroneJob(d) {
    const room = droneCargoCap() - d.cargo;
    if (room <= 0) return null;
    const keeperBelow = currentView === VIEW_UNDERGROUND || transitionTarget === VIEW_UNDERGROUND;
    if (keeperBelow && carried >= Math.min(10, carryCapacity * 0.25) && !drones.some(o => o !== d && o.job && o.job.kind === 'keeper'))
      return { kind: 'keeper' };
    const here = droneTile(d);
    const drop = nearestDrop(here.col, here.row);
    if (drop)
      return { kind: 'drop', drop, col: drop.col, row: drop.row };
    if (keeperBelow && unlockedTools.droneMiner)
      return findDroneOre(d);
    return null;
  }

  function jobTarget(d) {
    if (d.job.kind === 'keeper') return { col: drillX, row: drillY };
    if (d.job.kind === 'mine') return { col: d.job.standCol, row: d.job.standRow };
    if (d.job.kind === 'home') return droneShaftTile();
    return { col: d.job.col, row: d.job.row };
  }

  function routeDrone(d) {
    const from = droneTile(d);
    const to = jobTarget(d);
    if (undergroundGrid[from.row][from.col] !== TILE_EMPTY) {
      // Lost inside rock (should not happen): hop back to the shaft
      const sh = droneShaftTile();
      d.x = sh.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = TILE_SIZE / 2;
    }
    const path = findPath(droneTile(d).col, droneTile(d).row, to.col, to.row);
    d.path = path;
    d.pi = 0;
    d.target = to;
    return !!path;
  }

  function sendDroneHome(d) {
    d.job = { kind: 'home' };
    d.state = 'fly';
    if (!routeDrone(d)) {
      d.state = 'dock';
      d.timer = DRONE_DOCK_TIME;
    }
  }

  function dronePickupAt(d, col, row) {
    const R = dronePickupRadius();
    let got = 0;
    for (let i = droppedResources.length - 1; i >= 0; --i) {
      const drop = droppedResources[i];
      if (Math.abs(drop.col - col) + Math.abs(drop.row - row) > R) continue;
      const take = Math.min(drop.value, droneCargoCap() - d.cargo);
      if (take <= 0) break;
      resources[TILE_LABELS[drop.type]] += take;
      d.cargo += take;
      got += take;
      drop.value -= take;
      if (drop.value <= 0)
        droppedResources.splice(i, 1);
    }
    return got;
  }

  // The drone's laser finished an ore tile: the ore goes straight into the hold
  function droneMinedTile(d) {
    const { col, row } = d.job;
    const tile = undergroundGrid[row][col];
    if (!RESOURCE_TILES.includes(tile)) return;
    const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(row));
    resources[TILE_LABELS[tile]] += value;
    d.cargo = Math.min(droneCargoCap(), d.cargo + value);
    undergroundGrid[row][col] = TILE_EMPTY;
    tileHP[row][col] = 0;
    tileMaxHP[row][col] = 0;
    if (currentView === VIEW_UNDERGROUND) {
      const tx = col * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      spawnCrumble(tx, ty, getTileBaseColor(tile, row));
      particles.sparkle(tx, ty, 10, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2 });
      floatingText.add(tx, ty - 26, `Drone +${value} ${TILE_LABELS[tile]}`, { color: '#d8b8ff', font: 'bold 18px sans-serif' });
      SZ.GameAudio.play('pickup', { pitch: 1.4, volume: 0.4 });
    }
  }

  function arriveDrone(d) {
    const job = d.job;
    if (job.kind === 'home') {
      if (d.cargo > 0) {
        if (currentView === VIEW_SURFACE) {
          floatingText.add(DOME_X - 140, DOME_Y - 150, `Drone delivered ${d.cargo}`, { color: '#d8b8ff', font: 'bold 20px sans-serif' });
          SZ.GameAudio.play('coin', { pitch: 1.3, volume: 0.5 });
        }
      }
      d.cargo = 0;
      d.job = null;
      d.state = 'dock';
      d.timer = DRONE_DOCK_TIME / droneBoost();
      return;
    }
    if (job.kind === 'keeper') {
      const take = Math.min(carried, droneCargoCap() - d.cargo);
      if (take > 0) {
        carried -= take;
        d.cargo += take;
        if (currentView === VIEW_UNDERGROUND)
          floatingText.add(d.x - cameraX, d.y - cameraY - 30, `Drone took ${take} cargo`, { color: '#d8b8ff', font: 'bold 18px sans-serif' });
        SZ.GameAudio.play('blip', { pitch: 1.5, volume: 0.4 });
      }
      dronePickupAt(d, drillX, drillY);
    } else if (job.kind === 'drop') {
      dronePickupAt(d, job.col, job.row);
    } else if (job.kind === 'mine') {
      if (undergroundGrid[job.row][job.col] !== TILE_EMPTY) {
        d.state = 'mine';
        const hard = getTileHardness(job.row, undergroundGrid[job.row][job.col]);
        d.timer = d.laserTime = Math.max(0.4, hard * 1.6 / droneLaserSpeed());
        return;
      }
    }
    // Look for more work while there is room, otherwise head home
    d.job = d.cargo < droneCargoCap() * 0.85 ? pickDroneJob(d) : null;
    if (d.job && d.job.kind !== 'keeper') {
      d.state = 'fly';
      if (routeDrone(d)) return;
    }
    sendDroneHome(d);
  }

  function updateCourier(d, dt) {
    d.phase += dt * 6;
    if (d.state === 'dock') {
      d.timer -= dt;
      if (d.timer > 0) return;
      d.job = pickDroneJob(d);
      if (!d.job) {
        d.timer = 0.6;
        return;
      }
      const sh = droneShaftTile();
      d.x = sh.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = TILE_SIZE / 2;
      d.state = 'fly';
      if (!routeDrone(d)) {
        d.state = 'dock';
        d.job = null;
        d.timer = 1;
      }
      return;
    }
    if (d.state === 'mine') {
      const job = d.job;
      if (undergroundGrid[job.row][job.col] === TILE_EMPTY) {
        arriveDrone(Object.assign(d, { state: 'fly' }));
        return;
      }
      d.timer -= dt;
      const ratio = 1 - Math.max(0, d.timer) / d.laserTime;
      if (tileMaxHP[job.row][job.col] > 0)
        tileHP[job.row][job.col] = Math.min(tileHP[job.row][job.col], tileMaxHP[job.row][job.col] * (1 - ratio));
      if (currentView === VIEW_UNDERGROUND && Math.random() < dt * 14)
        particles.sparkle(job.col * TILE_SIZE + TILE_SIZE / 2 - cameraX + (Math.random() - 0.5) * 16, job.row * TILE_SIZE + TILE_SIZE / 2 - cameraY + (Math.random() - 0.5) * 16, 1, { color: '#ff9adf', speed: 1.5 });
      if (d.timer <= 0) {
        droneMinedTile(d);
        d.state = 'fly';
        arriveDrone(Object.assign(d, { job: { kind: 'idle' } }));
      }
      return;
    }
    // Flying: chase the keeper if they moved, then follow the path
    if (d.job && d.job.kind === 'keeper') {
      d.repath -= dt;
      if (d.repath <= 0 && (d.target.col !== drillX || d.target.row !== drillY)) {
        d.repath = 0.4;
        if (currentView !== VIEW_UNDERGROUND && transitionTarget !== VIEW_UNDERGROUND) {
          sendDroneHome(d);
          return;
        }
        routeDrone(d);
      }
    }
    if (d.job && d.job.kind === 'drop' && !droppedResources.includes(d.job.drop)) {
      arriveDrone(Object.assign(d, { job: { kind: 'idle' } }));
      return;
    }
    if (!d.path) {
      sendDroneHome(d);
      return;
    }
    let move = droneSpeed() * dt;
    while (move > 0 && d.pi < d.path.length) {
      const step = d.path[d.pi];
      const tx = step.col * TILE_SIZE + TILE_SIZE / 2, ty = step.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = tx - d.x, dy = ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= move) {
        d.x = tx;
        d.y = ty;
        move -= dist;
        ++d.pi;
      } else {
        d.x += dx / dist * move;
        d.y += dy / dist * move;
        d.face = dx < -0.5 ? -1 : dx > 0.5 ? 1 : d.face;
        move = 0;
      }
    }
    if (d.pi >= d.path.length) {
      // Close the last gap to an off-centre start (the shaft mouth)
      const t = d.target;
      d.x = t.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = t.row * TILE_SIZE + TILE_SIZE / 2;
      d.path = null;
      arriveDrone(d);
    }
  }

  function updateDrones(dt) {
    for (const d of drones)
      updateCourier(d, dt);

    // Gun drones circle above the dome and shoot whatever comes closest
    const gunLevel = getEffectiveLevel('combatDroneLevel');
    gunDrones.forEach((g, i) => {
      g.angle += dt * 0.7;
      const side = i % 2 ? -1 : 1;
      g.x = DOME_X + side * (190 + Math.sin(g.angle * 1.3) * 40) + Math.cos(g.angle) * 30;
      g.y = DOME_Y - 175 + Math.sin(g.angle * 2) * 26;
      g.cooldown -= dt;
      g.flash = Math.max(0, g.flash - dt * 5);
      if (g.cooldown > 0 || !enemies.length) return;
      let target = null, best = 560 * 560;
      for (const e of enemies) {
        if (e.hidden) continue;
        const dd = (e.x - g.x) * (e.x - g.x) + (e.y - g.y) * (e.y - g.y);
        if (dd < best) {
          best = dd;
          target = e;
        }
      }
      if (!target) return;
      g.cooldown = 1 / ((1.1 + 0.5 * Math.min(1, gunLevel)) * droneBoost());
      applyDamageToEnemy(target, 5 + 3 * Math.min(1, gunLevel) + (gunLevel >= 2 ? 2 : 0));
      g.flash = 1;
      g.tx = target.x;
      g.ty = target.y;
      if (currentView === VIEW_SURFACE) {
        SZ.GameAudio.play('shoot', { pitch: 1.7 + i * 0.1, volume: 0.35 });
        particles.burst(target.x, target.y, 4, { color: '#7af0ff', speed: 1.8, life: 0.25 });
      }
    });

    // Repair drone welds the dome while it is damaged
    if (repairBot) {
      const r = repairBot;
      r.angle += dt;
      const healing = domeHP < maxDomeHP && domeHP > 0;
      if (healing) {
        const a = Math.PI + 0.35 + (Math.sin(r.angle * 0.4) * 0.5 + 0.5) * (Math.PI - 0.7);
        r.bx = DOME_X + Math.cos(a) * DOME_RADIUS;
        r.by = DOME_Y + Math.sin(a) * DOME_RADIUS;
        r.x += (r.bx + Math.cos(a) * 46 - r.x) * Math.min(1, dt * 3);
        r.y += (r.by + Math.sin(a) * 46 - 10 - r.y) * Math.min(1, dt * 3);
        const rate = (0.5 + 0.45 * getEffectiveLevel('repairDroneLevel')) * droneBoost();
        domeHP = Math.min(maxDomeHP, domeHP + rate * dt);
        r.beam = 1;
        if (currentView === VIEW_SURFACE && Math.random() < dt * 18)
          particles.trail(r.bx, r.by, { vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5, color: Math.random() < 0.5 ? '#fff6a0' : '#7affb0', life: 0.3, size: 1.5, gravity: 0.1 });
      } else {
        r.beam = Math.max(0, r.beam - dt * 4);
        r.x += (DOME_X + 70 + Math.cos(r.angle * 0.8) * 30 - r.x) * Math.min(1, dt * 2);
        r.y += (DOME_Y - 160 + Math.sin(r.angle * 1.6) * 14 - r.y) * Math.min(1, dt * 2);
      }
    }
  }

  // Rotor blur and body of a drone sprite at screen position
  function drawDroneSprite(sprite, x, y, size, face, phase, alpha) {
    ctx.save();
    if (alpha !== undefined)
      ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (face < 0)
      ctx.scale(-1, 1);
    drawSprite(sprite, 0, 0, size);
    ctx.strokeStyle = 'rgba(210,235,255,0.6)';
    ctx.lineWidth = 2;
    const blur = size * (0.22 + Math.abs(Math.sin(phase * 4)) * 0.12);
    ctx.beginPath();
    for (const sx of [-0.36, 0.36]) {
      ctx.moveTo(size * sx - blur, -size * 0.47);
      ctx.lineTo(size * sx + blur, -size * 0.47);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawUndergroundDrones() {
    const ox = Math.round(cameraX), oy = Math.round(cameraY);
    for (const d of drones) {
      if (d.state === 'dock') continue;
      const x = d.x - ox, y = d.y - oy + Math.sin(d.phase) * 3;
      if (x < -60 || x > CANVAS_W + 60 || y < -60 || y > CANVAS_H + 60) continue;
      drawGlow('#9ad8ff', x, y, 70, 0.22);
      if (d.state === 'mine') {
        const tx = d.job.col * TILE_SIZE + TILE_SIZE / 2 - ox, ty = d.job.row * TILE_SIZE + TILE_SIZE / 2 - oy;
        const flick = 0.6 + Math.random() * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,90,200,${0.35 * flick})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,220,250,${flick})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        drawGlow('#ff7ad8', tx, ty, 26, 0.7 * flick);
      }
      drawDroneSprite('drone', x, y, 28, d.face || 1, d.phase);
      const cap = droneCargoCap();
      if (d.cargo > 0)
        drawMeter(x - 16, y + 18, 32, 5, d.cargo / cap, '#d8b8ff', { track: 'rgba(0,0,0,0.7)' });
      if (Math.random() < 0.15)
        particles.trail(x - (d.face || 1) * 10, y + 4, { vx: -(d.face || 1) * 0.8, vy: 0.4, color: '#8ad0ff', life: 0.25, size: 1.2 });
    }
  }

  function drawSurfaceDrones() {
    // Couriers resting in the dome hover beside it
    let slot = 0;
    for (const d of drones) {
      if (d.state !== 'dock') continue;
      const x = DOME_X - 150 - slot * 38, y = DOME_Y - 120 + Math.sin(animTime * 2 + slot) * 6;
      drawGlow('#9ad8ff', x, y + 12, 18, 0.45);
      drawDroneSprite('drone', x, y, 26, 1, animTime * 3 + slot);
      ++slot;
    }
    for (const g of gunDrones) {
      if (g.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(120,240,255,${g.flash})`;
        ctx.lineWidth = 2 + g.flash * 2;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y + 4);
        ctx.lineTo(g.tx, g.ty);
        ctx.stroke();
        ctx.restore();
        drawGlow('#7af0ff', g.x, g.y + 4, 16, g.flash);
      }
      drawGlow('#ff8a6a', g.x, g.y + 10, 16, 0.35);
      drawDroneSprite('gundrone', g.x, g.y, 32, g.tx < g.x && g.flash > 0 ? -1 : 1, animTime * 3);
    }
    if (repairBot) {
      const r = repairBot;
      if (r.beam > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flick = 0.6 + Math.random() * 0.4;
        ctx.strokeStyle = `rgba(120,255,170,${0.8 * r.beam * flick})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + 10);
        ctx.lineTo(r.bx, r.by);
        ctx.stroke();
        ctx.restore();
        drawGlow('#fff6a0', r.bx, r.by, 22 * flick, r.beam);
      }
      drawDroneSprite('medic', r.x, r.y, 30, 1, animTime * 3);
    }
  }

  function drawDroneHUD(x, y, w) {
    if (!drones.length) return y;
    const rowH = 28;
    drawPanel(x, y, w, 12 + drones.length * rowH, { accent: '#c890ff', shadow: 10 });
    const cap = droneCargoCap();
    drones.forEach((d, i) => {
      const ry = y + 6 + i * rowH + rowH / 2;
      drawSprite('drone', x + 22, ry, 20);
      let status, color = UI.textDim;
      if (d.state === 'dock') status = 'In dome';
      else if (d.state === 'mine') { status = 'Lasering ore'; color = '#ff9adf'; }
      else if (d.job && d.job.kind === 'home') { status = 'Flying home'; color = '#d8b8ff'; }
      else if (d.job && d.job.kind === 'keeper') { status = 'Coming to you'; color = UI.good; }
      else if (d.job && d.job.kind === 'mine') { status = 'Flying to ore'; color = '#ff9adf'; }
      else { status = 'Collecting'; color = '#ffd070'; }
      const chip = drawChip(`${d.cargo}/${cap}`, x + w - 10, ry - 11, 22, { align: 'right', px: 12, bg: 'rgba(200,144,255,0.16)', color: '#e8d8ff' });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(status, x + 40, ry + 1, w - 40 - chip - 18, 16, { weight: 'bold', color });
    });
    return y + 12 + drones.length * rowH;
  }

  /* ======================================================================
     MOVEMENT (mouse-based underground navigation)
     ====================================================================== */

  function updateMovement(dt) {
    if (currentView !== VIEW_UNDERGROUND) return;
    if (keeperStun > 0) return;
    // Block movement while mining
    if (miningTarget) {
      keeperIdle = 0;
      return;
    }
    // Auto-Mine: an idle keeper digs adjacent ore
    keeperIdle += dt;
    if (unlockedTools.autoMine && keeperIdle >= 2 && (!movePath || movePathIndex >= movePath.length) && state === STATE_PLAYING) {
      for (const [ddx, ddy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const rr = drillY + ddy, cc = drillX + ddx;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
        if (RESOURCE_TILES.includes(undergroundGrid[rr][cc])) {
          tryMine(ddx, ddy);
          break;
        }
      }
      keeperIdle = 0;
    }

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
    keeperIdle = 0;
    if (moveStepTimer <= 0) {
      const step = movePath[movePathIndex];
      // Climbing up a tunnel is faster with the jetpack
      const climbing = step.row < drillY && unlockedTools.jetpack;
      moveStepTimer = climbing ? moveStepInterval / (2 * (1 + 0.25 * getEffectiveLevel('jetpackFuel'))) : moveStepInterval;
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
    updateBombs(dt);
    updateBlastVisuals(dt);
    updateChests(dt);
    updateMovement(dt);

    // Standing next to the Relocation Core reveals it
    if (!relocationCore.revealed && !relocationCore.found && Math.abs(relocationCore.r - drillY) + Math.abs(relocationCore.c - drillX) <= 1)
      relocationCore.revealed = true;

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

    updateWorldTime(dt);
    updateWeather(dt);

    updateEnemies(dt);
    updateWeapon(dt);
    updateDrones(dt);

    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL && state === STATE_PLAYING) {
      autosaveTimer = 0;
      saveRun();
    }
  }

  /* ======================================================================
     DRAWING HELPERS
     ====================================================================== */

  // Seeded pseudo-random generator so cached art looks the same every run
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ======================================================================
     BIOMES -- every landing site gets one, picked by the site's seed
     ====================================================================== */

  // sky*: gradient top -> horizon by day, night and dusk; ranges: far, mid and
  // near mountain colours [top, foot]; ore: spawn multipliers per resource;
  // weather: how often each kind of weather happens here
  const BIOMES = {
    rocky: {
      name: 'Rocky Badlands', shape: 'ridge', plant: 'grass', decor: 'ringed',
      plantColors: ['#3f8a70', '#5ab08e', '#2c6a54'],
      skyDay: ['#2c5ca8', '#5c94d4', '#a8c8e8', '#e8c8b0'], skyNight: ['#02030c', '#0a0f2e', '#1a1846', '#4a2a5e'], skyDusk: ['#1c2460', '#5a3a80', '#c0607a', '#ffa868'],
      nebula: ['70,60,180', '40,140,170', '150,50,150'],
      ranges: [
        { day: ['#9a92c4', '#7a72a8'], night: ['#3c2c62', '#2a2456'] },
        { day: ['#6e6496', '#544a7e'], night: ['#251d48', '#17163a'] },
        { day: ['#4a3e66', '#382e52'], night: ['#14122c', '#0c0b20'] }],
      rim: ['rgba(255,240,230,0.45)', 'rgba(170,140,255,0.4)'],
      ground: { day: ['#9a7488', '#7a5a6c', '#56404e', '#2e2030'], night: ['#4a3048', '#38243a', '#24172a', '#140c18'], pebble: [150, 110, 140], gems: ['#5ad0ff', '#c070ff', '#60f0b0'], edge: '#ffbedc' },
      weather: { rain: 1, snow: 1, blizzard: 0.8, storm: 1, meteor: 1.3 },
      ore: { iron: 1.3, tin: 1.2, titanium: 1.3 }
    },
    desert: {
      name: 'Dune Sea', shape: 'mesa', plant: 'cactus', decor: 'none',
      plantColors: ['#4a8a3a', '#6ab050', '#2e5e26'],
      skyDay: ['#2a6cc0', '#6aaee6', '#c8e2f2', '#f8e2b0'], skyNight: ['#04040c', '#141028', '#2a1c38', '#5a3a40'], skyDusk: ['#2a1e50', '#7a3a5a', '#e0703a', '#ffd070'],
      nebula: ['150,90,60', '120,60,120', '60,60,140'],
      ranges: [
        { day: ['#e8b484', '#d49a68'], night: ['#4a2e38', '#3a2430'] },
        { day: ['#c8804c', '#b06a3c'], night: ['#331e26', '#28161e'] },
        { day: ['#9a5630', '#824628'], night: ['#1e1014', '#160a0e'] }],
      rim: ['rgba(255,240,200,0.55)', 'rgba(255,170,120,0.3)'],
      ground: { day: ['#f0cc8a', '#d8aa68', '#b07e44', '#6a4a26'], night: ['#5a4234', '#463226', '#2e2018', '#18100a'], pebble: [180, 140, 90], gems: ['#ffd060', '#ff9a40', '#ffe8a0'], edge: '#fff0c0' },
      weather: { rain: 0.25, snow: 0.05, blizzard: 0, storm: 0.6, meteor: 1.6 },
      ore: { gold: 1.7, copper: 1.3, quartz: 1.3, water: 0.5 }
    },
    ice: {
      name: 'Frozen Shelf', shape: 'peaks', plant: 'icicle', decor: 'aurora',
      plantColors: ['#bfe8ff', '#e8f8ff', '#7ac0e8'],
      skyDay: ['#3a74c4', '#7ab4e8', '#c8e6f8', '#eef8ff'], skyNight: ['#01040c', '#061428', '#0e2840', '#1e4058'], skyDusk: ['#1a2a6a', '#5a4a9a', '#c080c0', '#ffc8d0'],
      nebula: ['40,140,170', '60,100,200', '80,180,160'],
      ranges: [
        { day: ['#dceaf8', '#b4c8e0'], night: ['#30405e', '#22304c'] },
        { day: ['#a8bcd8', '#8aa0c0'], night: ['#1e2a44', '#141e36'] },
        { day: ['#7a90b0', '#62789a'], night: ['#121a2e', '#0a1020'] }],
      rim: ['rgba(255,255,255,0.7)', 'rgba(160,220,255,0.45)'],
      ground: { day: ['#f0f8ff', '#d0e2f2', '#98b0cc', '#5a6a88'], night: ['#3a4a6a', '#2a3854', '#1a243a', '#0c1222'], pebble: [170, 190, 220], gems: ['#9ae0ff', '#e0f8ff', '#7ab8ff'], edge: '#ffffff' },
      weather: { rain: 0.2, snow: 2.6, blizzard: 2.6, storm: 0.25, meteor: 1 },
      ore: { water: 2, silver: 1.4, sapphire: 1.5 }
    },
    jungle: {
      name: 'Alien Jungle', shape: 'hills', plant: 'fern', decor: 'giant',
      plantColors: ['#2aa060', '#5ad080', '#1a7048'],
      skyDay: ['#1a7a8a', '#4ab0a8', '#a8e0c0', '#e8f4c8'], skyNight: ['#010806', '#04160f', '#0c2a1e', '#1e4030'], skyDusk: ['#123048', '#3a5a6a', '#d0806a', '#f0d080'],
      nebula: ['40,160,120', '30,120,160', '120,180,80'],
      ranges: [
        { day: ['#5aa88a', '#46907a'], night: ['#16382e', '#102c24'] },
        { day: ['#3a845e', '#2c6c4c'], night: ['#0e2a1e', '#0a2018'] },
        { day: ['#22603c', '#184c2e'], night: ['#08180e', '#041008'] }],
      rim: ['rgba(230,255,200,0.45)', 'rgba(120,255,180,0.3)'],
      ground: { day: ['#5a8a3a', '#46702e', '#2e4c20', '#162a12'], night: ['#1e3422', '#16281a', '#0e1a12', '#060e08'], pebble: [90, 130, 80], gems: ['#7aff9a', '#ffd040', '#ff7ad0'], edge: '#d0ffb0' },
      weather: { rain: 2.4, snow: 0.15, blizzard: 0.05, storm: 1.8, meteor: 0.8 },
      ore: { emerald: 1.8, copper: 1.4, coal: 1.3, uranium: 1.4 }
    },
    volcanic: {
      name: 'Ashen Caldera', shape: 'volcano', plant: 'ember', decor: 'none',
      plantColors: ['#ff7a20', '#ffd060', '#7a2a10'],
      skyDay: ['#5a4a52', '#8a6a66', '#c09078', '#f0b080'], skyNight: ['#060102', '#1a0606', '#360c0a', '#6a1c10'], skyDusk: ['#2a1420', '#6a2a2a', '#d0502a', '#ffa040'],
      nebula: ['180,60,40', '140,40,60', '200,100,40'],
      ranges: [
        { day: ['#7a6a6a', '#665656'], night: ['#2a1414', '#201010'] },
        { day: ['#5a4646', '#4a3838'], night: ['#1c0c0c', '#160808'] },
        { day: ['#3c2c2c', '#2e2020'], night: ['#100606', '#0a0404'] }],
      rim: ['rgba(255,200,160,0.4)', 'rgba(255,90,40,0.55)'],
      ground: { day: ['#5a4644', '#463634', '#2e2220', '#181010'], night: ['#2e1616', '#241010', '#180a0a', '#0c0404'], pebble: [90, 70, 70], gems: ['#ff6a20', '#ffb040', '#ff3a20'], edge: '#ff9a6a' },
      weather: { rain: 0.5, snow: 0.2, blizzard: 0.1, storm: 1.3, meteor: 2.2 },
      ore: { redstone: 1.8, ruby: 1.5, coal: 1.5, opal: 1.6 }
    },
    crystal: {
      name: 'Crystal Fields', shape: 'spires', plant: 'shard', decor: 'shattered',
      plantColors: ['#a0a0ff', '#e0c0ff', '#60e0ff'],
      skyDay: ['#4a3ab0', '#8a7ae0', '#d0c0f0', '#f8e0f4'], skyNight: ['#03020c', '#100828', '#24104a', '#4a2068'], skyDusk: ['#22186a', '#5a3aa0', '#c060c0', '#ffb0e0'],
      nebula: ['120,80,220', '200,80,200', '60,160,220'],
      ranges: [
        { day: ['#aab0f0', '#8a90d8'], night: ['#2a2a62', '#202052'] },
        { day: ['#7a7ccc', '#6062b0'], night: ['#1a1a48', '#12123a'] },
        { day: ['#4e4a96', '#3c387c'], night: ['#0e0c2a', '#08061c'] }],
      rim: ['rgba(240,230,255,0.6)', 'rgba(180,140,255,0.5)'],
      ground: { day: ['#8a80c0', '#6a60a0', '#463e76', '#221c44'], night: ['#2c2452', '#221c44', '#161032', '#0a081a'], pebble: [130, 120, 190], gems: ['#c0a0ff', '#80e8ff', '#ffa0e0'], edge: '#e8d8ff' },
      weather: { rain: 0.8, snow: 0.8, blizzard: 0.5, storm: 0.9, meteor: 1.6 },
      ore: { quartz: 2, diamond: 1.6, amethyst: 1.6, cobalt: 1.3 }
    }
  };
  const BIOME_KEYS = Object.keys(BIOMES);

  // The landing site: index counts relocations, the seed drives biome, terrain and mine
  let site = newSite(0, (Math.random() * 0x7fffffff) | 0);

  function newSite(index, seed) {
    const rng = makeRng(seed ^ 0x2545f491);
    return { index, seed, biome: BIOME_KEYS[Math.floor(rng() * BIOME_KEYS.length)] };
  }

  function currentBiome() {
    return BIOMES[site.biome] || BIOMES.rocky;
  }

  // Effects that do not depend on the site: dome glass, cracks, glow sprite
  let fxArt = null;
  function buildFxArt() {
    if (fxArt) return fxArt;
    // Dome glass (interior tint, hex lattice, highlights) at 2x for crisp scaling
    const R = DOME_RADIUS, S = 2;
    const glass = makeCanvas((R * 2 + 8) * S, (R + 8) * S);
    const dg = glass.getContext('2d');
    dg.scale(S, S);
    dg.translate(R + 4, R + 4);
    dg.save();
    dg.beginPath();
    dg.arc(0, 0, R - 1, Math.PI, 0);
    dg.closePath();
    dg.clip();
    const ig = dg.createRadialGradient(-R * 0.3, -R * 0.5, 4, 0, 0, R);
    ig.addColorStop(0, 'rgba(120,200,255,0.22)');
    ig.addColorStop(0.6, 'rgba(50,110,200,0.12)');
    ig.addColorStop(1, 'rgba(20,60,140,0.28)');
    dg.fillStyle = ig;
    dg.fillRect(-R, -R, R * 2, R);
    dg.strokeStyle = 'rgba(140,210,255,0.35)';
    dg.lineWidth = 1.2;
    const hs = 16, hh = hs * Math.sqrt(3);
    for (let row = 0, hy = -R - hh; hy < 10; hy += hh / 2, ++row)
      for (let hx = -R - hs * 3 + (row % 2) * hs * 1.5; hx < R + hs * 3; hx += hs * 3) {
        dg.beginPath();
        for (let i = 0; i < 6; ++i) {
          const a = (TWO_PI / 6) * i;
          const x = hx + Math.cos(a) * hs, y = hy + Math.sin(a) * hs;
          if (i === 0) dg.moveTo(x, y);
          else dg.lineTo(x, y);
        }
        dg.closePath();
        dg.stroke();
      }
    const bg2 = dg.createLinearGradient(0, -R * 0.35, 0, 0);
    bg2.addColorStop(0, 'rgba(10,20,50,0)');
    bg2.addColorStop(1, 'rgba(10,20,50,0.45)');
    dg.fillStyle = bg2;
    dg.fillRect(-R, -R * 0.35, R * 2, R * 0.35);
    dg.restore();
    dg.save();
    dg.beginPath();
    dg.arc(0, 0, R - 8, Math.PI * 1.08, Math.PI * 1.5);
    dg.lineWidth = 7;
    dg.lineCap = 'round';
    dg.strokeStyle = 'rgba(255,255,255,0.35)';
    dg.stroke();
    dg.beginPath();
    dg.arc(0, 0, R - 18, Math.PI * 1.15, Math.PI * 1.32);
    dg.lineWidth = 3;
    dg.strokeStyle = 'rgba(255,255,255,0.25)';
    dg.stroke();
    dg.beginPath();
    dg.ellipse(R * 0.42, -R * 0.62, 7, 4, -0.6, 0, TWO_PI);
    dg.fillStyle = 'rgba(255,255,255,0.3)';
    dg.fill();
    dg.restore();

    // Crack paths from impact points on the shell
    const cracks = [];
    const r4 = makeRng(4242);
    for (let i = 0; i < 14; ++i) {
      const a = Math.PI + 0.25 + r4() * (Math.PI - 0.5);
      let x = Math.cos(a) * (R - 2), y = Math.sin(a) * (R - 2);
      const pts = [[x, y]];
      let dir = a + Math.PI + (r4() - 0.5) * 0.9;
      const len = 3 + (r4() * 4 | 0);
      for (let k = 0; k < len; ++k) {
        const step = 8 + r4() * 10;
        dir += (r4() - 0.5) * 1.1;
        x += Math.cos(dir) * step;
        y += Math.sin(dir) * step;
        if (y > -4 || x * x + y * y > (R - 2) * (R - 2)) break;
        pts.push([x, y]);
      }
      cracks.push(pts);
    }

    // Soft additive glow sprite for beams, impacts and lights
    const glow = makeCanvas(64, 64);
    const gl = glow.getContext('2d');
    const glg = gl.createRadialGradient(32, 32, 0, 32, 32, 32);
    glg.addColorStop(0, 'rgba(255,255,255,1)');
    glg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    glg.addColorStop(1, 'rgba(255,255,255,0)');
    gl.fillStyle = glg;
    gl.fillRect(0, 0, 64, 64);

    fxArt = { glass, glassScale: S, cracks, glow, tinted: {} };
    return fxArt;
  }

  function skyGradientCanvas(stops) {
    const c = makeCanvas(CANVAS_W, DOME_Y);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, DOME_Y);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.42, stops[1]);
    grad.addColorStop(0.78, stops[2]);
    grad.addColorStop(1, stops[3]);
    g.fillStyle = grad;
    g.fillRect(0, 0, CANVAS_W, DOME_Y);
    return c;
  }

  // Ridge heights (0..1, 257 samples) for a mountain range in the biome's style
  function ridgeProfile(shape, rng, layer) {
    const n = 256;
    const hs = new Array(n + 1);
    hs[0] = rng();
    hs[n] = rng();
    const rough = { ridge: 0.56, mesa: 0.5, peaks: 0.66, hills: 0.42, volcano: 0.52, spires: 0.5 }[shape] || 0.56;
    for (let span = n, disp = 1; span > 1; span >>= 1, disp *= rough)
      for (let i = span >> 1; i < n; i += span)
        hs[i] = (hs[i - (span >> 1)] + hs[i + (span >> 1)]) / 2 + (rng() - 0.5) * disp;
    let lo = Infinity, hi = -Infinity;
    for (const v of hs) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    let out = hs.map(v => (v - lo) / (hi - lo || 1));
    const craters = [];
    if (shape === 'hills') {
      // Rounded rolling hills
      for (let pass = 0; pass < 3; ++pass)
        out = out.map((v, i) => (out[Math.max(0, i - 2)] + out[Math.max(0, i - 1)] + v + out[Math.min(n, i + 1)] + out[Math.min(n, i + 2)]) / 5);
    } else if (shape === 'mesa') {
      // Flat-topped buttes with steep sides
      out = out.map(v => {
        const q = Math.round(v * 3) / 3;
        return q + (v - q) * 0.15;
      });
    } else if (shape === 'peaks') {
      out = out.map(v => Math.pow(v, 1.5));
    } else if (shape === 'volcano' && layer === 1) {
      // One or two cones with a crater on the middle range
      const count = 1 + (rng() < 0.5 ? 1 : 0);
      for (let k = 0; k < count; ++k) {
        const cx = Math.floor(n * (0.15 + rng() * 0.7)), w = 26 + rng() * 14;
        for (let i = 0; i <= n; ++i) {
          const d = Math.abs(i - cx) / w;
          if (d < 1) {
            let h = 1.25 - d * 0.75;
            if (d < 0.12) h -= (0.12 - d) * 1.6; // crater
            out[i] = Math.max(out[i], h);
          }
        }
        craters.push(cx / n);
      }
    } else if (shape === 'spires') {
      // Crystal spikes
      for (let k = 0; k < 14; ++k) {
        const cx = Math.floor(rng() * n), w = 2 + rng() * 4, h = 0.6 + rng() * 0.6;
        for (let i = Math.max(0, cx - w); i <= Math.min(n, cx + w); ++i)
          out[i] = Math.max(out[i], h * (1 - Math.abs(i - cx) / (w + 1)));
      }
    }
    let top = 0;
    for (const v of out)
      top = Math.max(top, v);
    return { heights: out.map(v => v / (top || 1)), craters };
  }

  // Sky layers, mountains, ground and plants of the current site -- rebuilt when the site changes
  let previousSurfaceArt = null;
  function buildSurfaceArt() {
    if (surfaceArt && surfaceArt.seed === site.seed) return surfaceArt;
    if (previousSurfaceArt && previousSurfaceArt.seed === site.seed) {
      [surfaceArt, previousSurfaceArt] = [previousSurfaceArt, surfaceArt];
      return surfaceArt;
    }
    previousSurfaceArt = surfaceArt;
    const B = currentBiome();
    const rng = makeRng(site.seed ^ 0x1337);

    const skyDay = skyGradientCanvas(B.skyDay);
    const skyDusk = skyGradientCanvas(B.skyDusk);
    const skyNight = skyGradientCanvas(B.skyNight);
    const g = skyNight.getContext('2d');
    // Nebula clouds and faint star dust on the night sky
    const neb = [[300, 260, 340, B.nebula[0], 0.18], [980, 180, 300, B.nebula[1], 0.14], [700, 420, 420, B.nebula[2], 0.12]];
    for (const [x, y, r, col, a] of neb) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},${a})`);
      rg.addColorStop(0.6, `rgba(${col},${a * 0.4})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 420; ++i) {
      const x = rng() * CANVAS_W, y = rng() * DOME_Y * 0.92;
      g.fillStyle = `rgba(${200 + rng() * 55 | 0},${200 + rng() * 55 | 0},255,${0.08 + rng() * 0.35 * (1 - y / DOME_Y)})`;
      g.fillRect(x, y, rng() < 0.15 ? 1.6 : 1, rng() < 0.15 ? 1.6 : 1);
    }
    // Thin high clouds by day
    const dc = skyDay.getContext('2d');
    for (let i = 0; i < 9; ++i) {
      const x = rng() * CANVAS_W, y = 60 + rng() * DOME_Y * 0.45, w = 160 + rng() * 260;
      const cg = dc.createRadialGradient(x, y, 0, x, y, w / 2);
      cg.addColorStop(0, 'rgba(255,255,255,0.22)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      dc.save();
      dc.translate(x, y);
      dc.scale(1, 0.18);
      dc.translate(-x, -y);
      dc.fillStyle = cg;
      dc.fillRect(x - w / 2, y - w / 2, w, w);
      dc.restore();
    }

    // Decoration hanging in the sky (planet, shattered moon); fades by day
    const decor = makeCanvas(CANVAS_W, DOME_Y);
    const d = decor.getContext('2d');
    if (B.decor === 'ringed' || B.decor === 'giant' || B.decor === 'shattered') {
      const px = 280 + rng() * 300, py = 180 + rng() * 120, pr = B.decor === 'giant' ? 120 : 70;
      const cols = B.decor === 'giant' ? ['#d8fff0', '#60c0a0', '#1a5a50', '#0a2a28'] : (B.decor === 'shattered' ? ['#ffe8ff', '#b080e0', '#4a2a80', '#1a1038'] : ['#f0c8ff', '#a070d0', '#3a2470', '#1a1038']);
      if (B.decor === 'ringed') {
        d.save();
        d.translate(px, py);
        d.rotate(-0.35);
        d.strokeStyle = 'rgba(220,190,255,0.25)';
        d.lineWidth = 6;
        d.beginPath();
        d.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, TWO_PI);
        d.stroke();
        d.restore();
      }
      const pg = d.createRadialGradient(px - pr * 0.45, py - pr * 0.45, pr * 0.1, px, py, pr);
      pg.addColorStop(0, cols[0]);
      pg.addColorStop(0.35, cols[1]);
      pg.addColorStop(0.8, cols[2]);
      pg.addColorStop(1, cols[3]);
      d.fillStyle = pg;
      d.beginPath();
      d.arc(px, py, pr, 0, TWO_PI);
      d.fill();
      d.save();
      d.beginPath();
      d.arc(px, py, pr, 0, TWO_PI);
      d.clip();
      d.globalAlpha = 0.18;
      for (let i = -3; i <= 3; ++i) {
        d.fillStyle = i % 2 ? '#ffffff' : '#10202a';
        d.fillRect(px - pr, py + i * pr * 0.26 - 4, pr * 2, 8);
      }
      d.restore();
      if (B.decor === 'ringed') {
        d.save();
        d.translate(px, py);
        d.rotate(-0.35);
        d.strokeStyle = 'rgba(230,200,255,0.45)';
        d.lineWidth = 5;
        d.beginPath();
        d.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI);
        d.stroke();
        d.restore();
      } else if (B.decor === 'shattered') {
        // Fragments drifting away from the broken moon
        for (let i = 0; i < 18; ++i) {
          const a = rng() * TWO_PI, dist = pr * (1.15 + rng() * 0.9), s = 3 + rng() * 9;
          const fx = px + Math.cos(a) * dist, fy = py + Math.sin(a) * dist * 0.55;
          d.fillStyle = i % 3 ? '#b890f0' : '#f0d8ff';
          d.beginPath();
          d.moveTo(fx, fy - s);
          d.lineTo(fx + s * 0.6, fy);
          d.lineTo(fx, fy + s * 0.8);
          d.lineTo(fx - s * 0.5, fy);
          d.closePath();
          d.fill();
        }
      }
    }

    // Twinkling stars drawn live
    const stars = [];
    for (let i = 0; i < 90; ++i)
      stars.push({ x: rng() * CANVAS_W, y: rng() * DOME_Y * 0.8, s: 0.8 + rng() * 1.6, p: rng() * TWO_PI, f: 0.6 + rng() * 2.2, big: rng() < 0.12 });

    // Mountain ranges: far, mid, near (wider than the screen for parallax), by day and by night
    const ranges = [];
    const specs = [
      { base: 210, amp: 150, depth: 6 },
      { base: 130, amp: 100, depth: 14 },
      { base: 60, amp: 50, depth: 26 }
    ];
    if (B.shape === 'peaks') {
      specs[0].amp = 200;
      specs[1].amp = 130;
    }
    let craters = [];
    specs.forEach((sp, layer) => {
      const w = CANVAS_W + 120, h = sp.base + sp.amp + 70;
      const prof = ridgeProfile(B.shape, makeRng(site.seed + 11 + layer * 12), layer);
      const ridge = prof.heights.map((v, i) => [i * w / 256, h - Math.max(10, sp.base - sp.amp * 0.5 + v * sp.amp)]);
      if (layer === 1)
        craters = prof.craters.map(f => ({ x: f * w - 60, y: DOME_Y - h + 4 + ridge[Math.round(f * 256)][1] }));
      const paint = (cols, rim, haze) => {
        const c = makeCanvas(w, h);
        const m = c.getContext('2d');
        const mg = m.createLinearGradient(0, 0, 0, h);
        mg.addColorStop(0, cols[0]);
        mg.addColorStop(1, cols[1]);
        m.fillStyle = mg;
        m.beginPath();
        m.moveTo(0, h);
        for (const [x, y] of ridge)
          m.lineTo(x, y);
        m.lineTo(w, h);
        m.closePath();
        m.fill();
        if (B.shape === 'peaks') {
          // Snow caps on the higher slopes
          m.save();
          m.clip();
          m.fillStyle = cols === B.ranges[layer].day ? 'rgba(255,255,255,0.85)' : 'rgba(150,170,215,0.26)';
          m.beginPath();
          m.moveTo(0, 0);
          for (const [x, y] of ridge)
            m.lineTo(x, Math.min(h, y + 10 + Math.max(0, (h - y) - sp.base) * 0.6));
          m.lineTo(w, 0);
          m.closePath();
          m.fill();
          m.restore();
        }
        m.strokeStyle = rim;
        m.lineWidth = 2;
        m.beginPath();
        ridge.forEach(([x, y], i) => i ? m.lineTo(x, y + 1) : m.moveTo(x, y + 1));
        m.stroke();
        const hz = m.createLinearGradient(0, h * 0.4, 0, h);
        hz.addColorStop(0, haze + '0)');
        hz.addColorStop(1, haze + '0.28)');
        m.globalCompositeOperation = 'source-atop';
        m.fillStyle = hz;
        m.fillRect(0, 0, w, h);
        return c;
      };
      const hazeOf = (hex) => {
        const [r, gg, b] = parseHex(hex);
        return `rgba(${r},${gg},${b},`;
      };
      ranges.push({
        day: paint(B.ranges[layer].day, B.rim[0], hazeOf(B.skyDay[3])),
        night: paint(B.ranges[layer].night, B.rim[1], hazeOf(B.skyNight[3])),
        depth: sp.depth, h
      });
    });

    // Ground strip with strata, pebbles and gems, by day and by night
    const gh = CANVAS_H - DOME_Y;
    const paintGroundStrip = (stops, night) => {
      const ground = makeCanvas(CANVAS_W, gh);
      const gg = ground.getContext('2d');
      const r3 = makeRng(site.seed ^ 99);
      const sg = gg.createLinearGradient(0, 0, 0, gh);
      sg.addColorStop(0, stops[0]);
      sg.addColorStop(0.08, stops[1]);
      sg.addColorStop(0.5, stops[2]);
      sg.addColorStop(1, stops[3]);
      gg.fillStyle = sg;
      gg.fillRect(0, 0, CANVAS_W, gh);
      for (let band = 0; band < 4; ++band) {
        const by = 18 + band * 22;
        gg.strokeStyle = `rgba(0,0,0,${0.16 + band * 0.04})`;
        gg.lineWidth = 2;
        gg.beginPath();
        for (let x = 0; x <= CANVAS_W; x += 10)
          gg.lineTo(x, by + Math.sin(x * 0.01 + band) * 4 + Math.sin(x * 0.043 + band * 2) * 2);
        gg.stroke();
      }
      const [pr, pg, pb] = B.ground.pebble;
      const k = night ? 0.45 : 1;
      for (let i = 0; i < 140; ++i) {
        const x = r3() * CANVAS_W, y = 8 + r3() * (gh - 12), rr = 1.5 + r3() * 5;
        gg.fillStyle = `rgba(${(pr + r3() * 40) * k | 0},${(pg + r3() * 30) * k | 0},${(pb + r3() * 40) * k | 0},0.6)`;
        gg.beginPath();
        gg.ellipse(x, y, rr * 1.4, rr, 0, 0, TWO_PI);
        gg.fill();
        gg.fillStyle = `rgba(255,255,255,${night ? 0.08 : 0.18})`;
        gg.beginPath();
        gg.ellipse(x - rr * 0.3, y - rr * 0.4, rr * 0.6, rr * 0.35, 0, 0, TWO_PI);
        gg.fill();
      }
      for (let i = 0; i < 18; ++i) {
        const x = r3() * CANVAS_W, y = 30 + r3() * (gh - 40);
        gg.fillStyle = B.ground.gems[i % B.ground.gems.length];
        gg.globalAlpha = 0.55;
        gg.beginPath();
        gg.moveTo(x, y - 6);
        gg.lineTo(x + 3, y);
        gg.lineTo(x, y + 5);
        gg.lineTo(x - 3, y);
        gg.closePath();
        gg.fill();
        gg.globalAlpha = 1;
      }
      gg.fillStyle = hexToRgba(B.ground.edge, night ? 0.3 : 0.5);
      gg.fillRect(0, 0, CANVAS_W, 2);
      gg.fillStyle = 'rgba(0,0,0,0.3)';
      gg.fillRect(0, 2, CANVAS_W, 2);
      return ground;
    };
    const groundDay = paintGroundStrip(B.ground.day, false);
    const groundNight = paintGroundStrip(B.ground.night, true);

    // Plants along the ground line (drawn live so they sway)
    const plants = [];
    const rp = makeRng(site.seed ^ 0xbeef);
    for (let x = 8 + rp() * 10; x < CANVAS_W; x += (B.plant === 'grass' || B.plant === 'fern' ? 18 : 46) + rp() * (B.plant === 'grass' ? 12 : 60)) {
      if (Math.abs(x - DOME_X) < DOME_RADIUS + 30) continue;
      plants.push({ x, s: 0.6 + rp() * 0.8, v: rp(), p: rp() * TWO_PI });
    }

    surfaceArt = { seed: site.seed, skyDay, skyDusk, skyNight, decor, stars, ranges, groundDay, groundNight, plants, craters };
    return surfaceArt;
  }

  // Coloured copy of the glow sprite (cached per colour)
  function getGlow(color) {
    const art = buildFxArt();
    let c = art.tinted[color];
    if (!c) {
      c = makeCanvas(64, 64);
      const g = c.getContext('2d');
      g.drawImage(art.glow, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, 64, 64);
      art.tinted[color] = c;
    }
    return c;
  }

  function drawGlow(color, x, y, r, alpha) {
    const prev = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * alpha;
    ctx.drawImage(getGlow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prev;
  }

  // Mix two '#rrggbb' colours
  function mixHex(a, b, t) {
    const A = parseHex(a), Bc = parseHex(b);
    return `rgb(${A[0] + (Bc[0] - A[0]) * t | 0},${A[1] + (Bc[1] - A[1]) * t | 0},${A[2] + (Bc[2] - A[2]) * t | 0})`;
  }

  function drawSky() {
    const art = buildSurfaceArt();
    const B = currentBiome();
    const night = 1 - daylight;
    if (daylight < 0.995)
      ctx.drawImage(art.skyNight, 0, 0);
    if (daylight > 0.01) {
      ctx.globalAlpha = daylight;
      ctx.drawImage(art.skyDay, 0, 0);
    }
    if (duskGlow > 0.01) {
      ctx.globalAlpha = duskGlow;
      ctx.drawImage(art.skyDusk, 0, 0);
    }
    ctx.globalAlpha = 1;
    drawCelestials();
    ctx.globalAlpha = Math.max(0.12, 1 - daylight * 0.85);
    ctx.drawImage(art.decor, 0, 0);
    ctx.globalAlpha = 1;
    // Twinkling stars
    if (night > 0.05) {
      for (const s of art.stars) {
        const tw = 0.45 + 0.55 * Math.sin(animTime * s.f + s.p);
        if (tw <= 0.05) continue;
        ctx.globalAlpha = tw * 0.9 * night;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
        if (s.big) {
          ctx.globalAlpha = tw * 0.35 * night;
          ctx.fillRect(s.x - s.s * 2.5, s.y - 0.5, s.s * 5, 1);
          ctx.fillRect(s.x - 0.5, s.y - s.s * 2.5, 1, s.s * 5);
        }
      }
      ctx.globalAlpha = 1;
      // Occasional shooting star
      const cycle = 11;
      const t = (animTime % cycle) / 0.9;
      if (t < 1) {
        const k = Math.floor(animTime / cycle);
        const sx = 200 + ((k * 7919) % 900), sy = 60 + ((k * 3571) % 220);
        const hx = sx + t * 260, hy = sy + t * 90;
        const g = ctx.createLinearGradient(hx - 120, hy - 42, hx, hy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${0.8 * (1 - t) * night})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx - 120, hy - 42);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    }
    // Aurora over the ice
    if (B.decor === 'aurora' && night > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; ++band) {
        const y0 = 120 + band * 50;
        const g = ctx.createLinearGradient(0, y0 - 140, 0, y0 + 40);
        const col = band === 1 ? '120,255,200' : (band === 2 ? '160,120,255' : '90,220,255');
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(0.7, `rgba(${col},${0.16 * night})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, y0 + 40);
        for (let x = 0; x <= CANVAS_W; x += 40)
          ctx.lineTo(x, y0 + Math.sin(x * 0.006 + animTime * 0.4 + band * 2) * 30 + Math.sin(x * 0.017 - animTime * 0.7) * 12);
        for (let x = CANVAS_W; x >= 0; x -= 40)
          ctx.lineTo(x, y0 - 140 + Math.sin(x * 0.006 + animTime * 0.4 + band * 2) * 30);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // Mountain ranges with mouse parallax, night and day versions blended
    const sway = mouseAimX >= 0 ? (mouseAimX / CANVAS_W - 0.5) : 0;
    for (const r of art.ranges) {
      const x = -60 - sway * r.depth * 2, y = DOME_Y - r.h + 4;
      if (daylight < 0.995)
        ctx.drawImage(r.night, x, y);
      if (daylight > 0.01) {
        ctx.globalAlpha = daylight;
        ctx.drawImage(r.day, x, y);
        ctx.globalAlpha = 1;
      }
    }
    // Volcano smoke and crater glow
    for (const c of art.craters) {
      const x = c.x - sway * 28;
      drawGlow('#ff5a1a', x, c.y + 6, 46, 0.35 + night * 0.4 + Math.sin(animTime * 3) * 0.08);
      for (let k = 0; k < 7; ++k) {
        const t = (animTime * 0.12 + k / 7) % 1;
        ctx.globalAlpha = (1 - t) * 0.32;
        ctx.fillStyle = mixHex('#5a4a48', '#1a1414', night);
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 3 + k) * 18 + t * 70, c.y - t * 190, 10 + t * 42, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Low drifting mist in the horizon colour
    const mist = mixHex(B.skyNight[3], B.skyDay[3], daylight);
    const mx = (animTime * 12) % CANVAS_W;
    ctx.globalAlpha = 0.5;
    for (const off of [-CANVAS_W, 0]) {
      const x = mx + off;
      const mg = ctx.createRadialGradient(x + 500, DOME_Y - 10, 10, x + 500, DOME_Y - 10, 420);
      mg.addColorStop(0, mist.replace('rgb', 'rgba').replace(')', ',0.22)'));
      mg.addColorStop(1, mist.replace('rgb', 'rgba').replace(')', ',0)'));
      ctx.fillStyle = mg;
      ctx.fillRect(x + 80, DOME_Y - 120, 840, 140);
    }
    ctx.globalAlpha = 1;
  }

  function drawGroundLayer() {
    const art = buildSurfaceArt();
    const B = currentBiome();
    if (daylight < 0.995)
      ctx.drawImage(art.groundNight, 0, DOME_Y);
    if (daylight > 0.01) {
      ctx.globalAlpha = daylight;
      ctx.drawImage(art.groundDay, 0, DOME_Y);
      ctx.globalAlpha = 1;
    }
    const shade = 0.55 + daylight * 0.45;
    const sk = currentSeason().key;
    const tint = sk === 'autumn' ? ['#d0701c', 0.55] : (sk === 'winter' ? ['#dfeeff', 0.45] : (sk === 'summer' ? ['#c8c040', 0.15] : null));
    const plantCols = B.plantColors.map(c => tint && B.plant !== 'ember' && B.plant !== 'shard' ? mixHex(c, tint[0], tint[1]) : c)
      .map(c => c.charAt(0) === '#' ? c : '#' + c.match(/\d+/g).map(n => (+n).toString(16).padStart(2, '0')).join(''));
    const col = (i) => mixHex('#000000', plantCols[i], shade);
    const Y = DOME_Y + 2;
    ctx.lineCap = 'round';
    for (const p of art.plants) {
      const tilt = Math.sin(p.x * 0.7 + animTime * 0.9 + p.p) * (1 + windStrength());
      if (B.plant === 'grass') {
        const h = (8 + Math.abs(Math.sin(p.x * 0.5)) * 14) * p.s;
        ctx.lineWidth = 3;
        ctx.strokeStyle = col(p.v < 0.66 ? 0 : 1);
        ctx.beginPath();
        ctx.moveTo(p.x, Y);
        ctx.quadraticCurveTo(p.x + tilt * 6, Y - h * 0.6, p.x + tilt * 4, Y - h);
        ctx.stroke();
      } else if (B.plant === 'fern') {
        const h = 16 + 18 * p.s;
        ctx.lineWidth = 2.5;
        for (const side of [-1, 1, 0]) {
          ctx.strokeStyle = col(side === 0 ? 1 : 0);
          ctx.beginPath();
          ctx.moveTo(p.x, Y);
          const ex = p.x + side * h * 0.6 + tilt * 5, ey = Y - h * (side === 0 ? 1 : 0.75);
          ctx.quadraticCurveTo(p.x + side * h * 0.1 + tilt * 3, Y - h * 0.7, ex, ey);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          for (let k = 1; k < 4; ++k) {
            const t = k / 4, lx = p.x + (ex - p.x) * t, ly = Y + (ey - Y) * t;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + (side || 1) * 5 + tilt, ly - 4);
            ctx.stroke();
          }
          ctx.lineWidth = 2.5;
        }
      } else if (B.plant === 'cactus') {
        const h = 22 + 22 * p.s, w = 7 + 3 * p.s;
        ctx.fillStyle = SPRITE_OUTLINE;
        roundRectPath(p.x - w / 2 - 1.5, Y - h - 1.5, w + 3, h + 3, w / 2);
        ctx.fill();
        ctx.fillStyle = col(0);
        roundRectPath(p.x - w / 2, Y - h, w, h, w / 2);
        ctx.fill();
        for (const side of p.v < 0.5 ? [-1] : [-1, 1]) {
          const ay = Y - h * (0.45 + 0.15 * side * p.v);
          ctx.strokeStyle = SPRITE_OUTLINE;
          ctx.lineWidth = w * 0.75 + 3;
          ctx.beginPath();
          ctx.moveTo(p.x, ay);
          ctx.lineTo(p.x + side * w * 1.3, ay);
          ctx.lineTo(p.x + side * w * 1.3, ay - h * 0.3);
          ctx.stroke();
          ctx.strokeStyle = col(0);
          ctx.lineWidth = w * 0.75;
          ctx.stroke();
        }
        ctx.fillStyle = col(1);
        ctx.fillRect(p.x - 1, Y - h + 3, 2, h - 6);
      } else if (B.plant === 'icicle') {
        for (let k = 0; k < 3; ++k) {
          const ox = (k - 1) * 6 * p.s, h = (10 + (k === 1 ? 14 : 6) + p.v * 8) * p.s * 1.4;
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.beginPath();
          ctx.moveTo(p.x + ox - 5, Y);
          ctx.lineTo(p.x + ox + tilt * 0.5, Y - h - 2);
          ctx.lineTo(p.x + ox + 5, Y);
          ctx.fill();
          ctx.fillStyle = col(k === 1 ? 1 : 0);
          ctx.beginPath();
          ctx.moveTo(p.x + ox - 3.5, Y);
          ctx.lineTo(p.x + ox + tilt * 0.5, Y - h);
          ctx.lineTo(p.x + ox + 3.5, Y);
          ctx.fill();
        }
        if (daylight > 0.3 && Math.sin(animTime * 2 + p.p * 5) > 0.97)
          drawGlow('#ffffff', p.x, Y - 14, 10, 0.8);
      } else if (B.plant === 'ember') {
        const w = 10 + 10 * p.s;
        ctx.fillStyle = mixHex('#000000', '#4a3634', shade);
        ctx.beginPath();
        ctx.ellipse(p.x, Y, w, 6 + 4 * p.s, 0, Math.PI, 0);
        ctx.fill();
        const glow = 0.55 + Math.sin(animTime * 3 + p.p) * 0.25;
        ctx.strokeStyle = `rgba(255,${120 + glow * 80 | 0},40,${glow})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.6, Y - 1);
        ctx.lineTo(p.x - w * 0.1, Y - 5 * p.s);
        ctx.lineTo(p.x + w * 0.5, Y - 2);
        ctx.stroke();
        drawGlow('#ff6a20', p.x, Y - 3, 16 + 8 * p.s, glow * (0.35 + (1 - daylight) * 0.4));
        if (Math.random() < 0.02)
          particles.trail(p.x, Y - 6, { vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random(), color: '#ffa040', life: 0.8, size: 1.5, gravity: -0.01 });
      } else if (B.plant === 'shard') {
        for (let k = 0; k < 3; ++k) {
          const ang = (k - 1) * 0.35 + tilt * 0.02, h = (12 + (k === 1 ? 16 : 6) + p.v * 6) * p.s * 1.3, w = 4 + p.s * 2;
          ctx.save();
          ctx.translate(p.x + (k - 1) * 5, Y);
          ctx.rotate(ang);
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.beginPath();
          ctx.moveTo(-w - 1, 0); ctx.lineTo(-w - 1, -h * 0.75); ctx.lineTo(0, -h - 2); ctx.lineTo(w + 1, -h * 0.75); ctx.lineTo(w + 1, 0);
          ctx.fill();
          ctx.fillStyle = col(k % 3);
          ctx.beginPath();
          ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.75); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.75); ctx.lineTo(w, 0);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(-w + 1, -h * 0.7, 1.5, h * 0.6);
          ctx.restore();
        }
        drawGlow(B.plantColors[(p.v * 3) | 0], p.x, Y - 12, 20, 0.25 + (1 - daylight) * 0.35);
      }
      // Spring blossoms
      if (sk === 'spring' && p.v < 0.6 && B.plant !== 'ember') {
        const fx = p.x + 6 + tilt * 3, fy = Y - 6 - p.s * 8;
        const petal = ['#ff7ab0', '#ffe060', '#ffffff', '#c890ff'][(p.v * 6 | 0) % 4];
        ctx.fillStyle = mixHex('#000000', petal, shade);
        for (let k = 0; k < 5; ++k) {
          const a = k * TWO_PI / 5 + p.p;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2, 0, TWO_PI);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd040';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.6, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
  }

  // Pre-rendered enemy body (outline, shading, rim light) per variant
  function getEnemyBody(kind) {
    const art = buildFxArt();
    const key = 'body:' + kind;
    if (art.tinted[key]) return art.tinted[key];
    const S = 96, c = makeCanvas(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const r = 36;
    const pal = {
      walker: ['#ff9a8a', '#e0403a', '#8a1420', '#3a0610'],
      armored: ['#e8d8a8', '#a08a5a', '#5a4828', '#241a0c'],
      boss: ['#ff7aa0', '#b81848', '#5a0420', '#20020a'],
      flyer: ['#f0a8ff', '#a050c8', '#4a1868', '#1a0628'],
      swarmer: ['#f4ffb0', '#c8d040', '#6a7a10', '#283008'],
      diver: ['#b8f4ff', '#3ab0c8', '#145a70', '#06242e'],
      burrower: ['#ffc0e0', '#d0609a', '#7a2050', '#300a20'],
      spitter: ['#dcffb8', '#60b040', '#2a6a18', '#0e300a'],
      splitter: ['#ffe0b0', '#ff9030', '#a04a10', '#401a04'],
      mender: ['#c8fff0', '#40c890', '#127a54', '#063020'],
      queen: ['#ffc0f0', '#e040c0', '#7a1468', '#30062a']
    }[kind];
    const drop = kind === 'flyer' || kind === 'diver';
    g.fillStyle = SPRITE_OUTLINE;
    g.beginPath();
    if (drop) {
      g.moveTo(0, -r - 4);
      g.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.7 + 4, r * 0.6 + 4);
      g.quadraticCurveTo(0, r * 0.35 + 4, -r * 0.7 - 4, r * 0.6 + 4);
      g.quadraticCurveTo(-r * 0.9, -r * 0.1, 0, -r - 4);
    } else
      g.arc(0, 0, r + 3, 0, TWO_PI);
    g.fill();
    const bodyPath = () => {
      g.beginPath();
      if (drop) {
        g.moveTo(0, -r);
        g.quadraticCurveTo(r * 0.85, -r * 0.1, r * 0.7, r * 0.6);
        g.quadraticCurveTo(0, r * 0.35, -r * 0.7, r * 0.6);
        g.quadraticCurveTo(-r * 0.85, -r * 0.1, 0, -r);
      } else
        g.arc(0, 0, r, 0, TWO_PI);
    };
    const bgd = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    bgd.addColorStop(0, pal[0]);
    bgd.addColorStop(0.45, pal[1]);
    bgd.addColorStop(0.85, pal[2]);
    bgd.addColorStop(1, pal[3]);
    bodyPath();
    g.fillStyle = bgd;
    g.fill();
    g.save();
    bodyPath();
    g.clip();
    // Spots / plates
    if (kind === 'splitter' || kind === 'spitter') {
      // Translucent membrane
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.arc(0, 0, r * 0.8, 0, TWO_PI);
      g.fill();
    } else if (kind === 'armored') {
      g.strokeStyle = 'rgba(30,20,8,0.7)';
      g.lineWidth = 3;
      for (const y of [-12, 6, 22]) {
        g.beginPath();
        g.arc(0, y - 30, 40, 0.25 * Math.PI, 0.75 * Math.PI);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,240,200,0.6)';
      for (const [x, y] of [[-20, -4], [20, -4], [-12, 14], [12, 14]]) {
        g.beginPath();
        g.arc(x, y, 2.5, 0, TWO_PI);
        g.fill();
      }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (const [x, y, s] of [[-18, 14, 7], [16, 18, 5], [22, -6, 4], [-6, 24, 4]]) {
        g.beginPath();
        g.arc(x, y, s, 0, TWO_PI);
        g.fill();
      }
    }
    // Rim light from below (ground bounce) and top specular
    g.strokeStyle = 'rgba(255,200,180,0.35)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 4, r - 2, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(-r * 0.32, -r * 0.48, r * 0.26, r * 0.13, -0.5, 0, TWO_PI);
    g.fill();
    g.restore();
    art.tinted[key] = c;
    return c;
  }

  function drawEnemyEyes(sz, blinking, color, pupil) {
    const eyeH = blinking ? 1 : sz * 0.2;
    for (const sx of [-1, 1]) {
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.3, -sz * 0.12, sz * 0.2 + 2, eyeH + 2, 0, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.3, -sz * 0.12, sz * 0.2, eyeH, 0, 0, TWO_PI);
      ctx.fill();
      if (!blinking) {
        ctx.fillStyle = pupil;
        ctx.beginPath();
        ctx.arc(sx * sz * 0.27, -sz * 0.08, sz * 0.08, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(sx * sz * 0.3 - sz * 0.08, -sz * 0.2, 2, 2);
      }
    }
  }

  // rig (landing / relocation): lift above the ground, unpack 0 (packed) .. 1, legs 0..1
  function drawDome(rig) {
    const art = buildFxArt();
    const sky = buildSurfaceArt();
    const pulse = Math.sin(domePulsePhase) * 0.5 + 0.5;
    const flashAlpha = rig ? 0 : domeHitFlash * 0.6;
    const hpRatio = Math.max(0, domeHP / maxDomeHP);
    const R = DOME_RADIUS;
    const shieldLevel = getEffectiveLevel('domeHP');
    const unpack = rig ? rig.unpack : 1;
    const glassK = smoothstep(0.2, 0.62, unpack);
    const lift = rig ? rig.lift : 0;

    // Light pool on the ground
    if (lift < 40)
      drawGlow('#4aa8ff', DOME_X, DOME_Y + 6, R * 1.7, (0.18 + pulse * 0.05) * (1 - lift / 40) * (0.3 + 0.7 * unpack));

    ctx.save();
    ctx.translate(0, -lift);
    if (rig && rig.squash) {
      ctx.translate(DOME_X, DOME_Y + 14);
      ctx.scale(1 + rig.squash, 1 - rig.squash);
      ctx.translate(-DOME_X, -DOME_Y - 14);
    }

    // Landing legs fold out of the base
    const legs = rig ? rig.legs : 0;
    if (legs > 0.01)
      for (const side of [-1, 1])
        for (const inner of [0, 1]) {
          const x0 = DOME_X + side * (inner ? R * 0.55 : R + 10), y0 = DOME_Y + 10;
          const x1 = x0 + side * (inner ? 8 : 22) * legs, y1 = y0 + 26 * legs;
          ctx.strokeStyle = SPRITE_OUTLINE;
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = '#7a8aa8';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.fillRect(x1 - 10, y1 - 2, 20, 6);
          ctx.fillStyle = '#5a6a88';
          ctx.fillRect(x1 - 9, y1 - 1, 18, 4);
          ctx.lineCap = 'butt';
        }

    // The glass shell rises out of the base while unpacking
    if (glassK < 0.999) {
      ctx.save();
      ctx.translate(DOME_X, DOME_Y);
      ctx.scale(1, Math.max(0.001, glassK));
      ctx.translate(-DOME_X, -DOME_Y);
    }
    if (glassK > 0.01) {

    // Refraction: the sky behind the glass, slightly magnified and tinted
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, R - 1, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    const mag = 1.12;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(daylight > 0.5 ? sky.skyDay : sky.skyNight, DOME_X - R, DOME_Y - R, R * 2, R, DOME_X - R * mag, DOME_Y - R * mag - 6, R * 2 * mag, R * mag);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(20,60,120,0.25)';
    ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);

    // Console and keeper silhouette inside
    ctx.fillStyle = '#1c2a44';
    ctx.fillRect(DOME_X - 26, DOME_Y - 22, 52, 22);
    ctx.fillStyle = '#4af';
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.fillRect(DOME_X - 20, DOME_Y - 18, 14, 4);
    ctx.fillStyle = '#6f6';
    ctx.fillRect(DOME_X + 4, DOME_Y - 18, 6, 4);
    ctx.globalAlpha = 1;

    // Glass lattice and highlights
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.drawImage(art.glass, DOME_X - R - 4, DOME_Y - R - 4, R * 2 + 8, R + 8);
    ctx.globalAlpha = 1;

    // Shield shimmer: a bright band sweeping across the lattice
    const sweep = ((animTime * 0.35) % 1.6) - 0.3;
    const bx = DOME_X - R + sweep * R * 2;
    const sg = ctx.createLinearGradient(bx - 40, DOME_Y - R, bx + 40, DOME_Y);
    sg.addColorStop(0, 'rgba(160,230,255,0)');
    sg.addColorStop(0.5, `rgba(160,230,255,${0.12 + shieldLevel * 0.02})`);
    sg.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg;
    ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);
    ctx.globalCompositeOperation = 'source-over';

    // Damage cracks grow as HP drops
    const crackCount = Math.round((1 - hpRatio) * art.cracks.length);
    if (crackCount > 0) {
      ctx.lineJoin = 'round';
      for (let i = 0; i < crackCount; ++i) {
        const pts = art.cracks[i];
        ctx.beginPath();
        pts.forEach(([x, y], k) => k ? ctx.lineTo(DOME_X + x, DOME_Y + y + 1) : ctx.moveTo(DOME_X + x, DOME_Y + y + 1));
        ctx.strokeStyle = 'rgba(0,10,30,0.6)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        pts.forEach(([x, y], k) => k ? ctx.lineTo(DOME_X + x, DOME_Y + y) : ctx.moveTo(DOME_X + x, DOME_Y + y));
        ctx.strokeStyle = 'rgba(220,240,255,0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Hit flash overlay
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,80,80,${flashAlpha})`;
      ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);
    }
    ctx.restore();

    // Frame: meridian ribs and the outer rim (thicker with shield upgrades)
    ctx.save();
    ctx.strokeStyle = 'rgba(150,200,255,0.35)';
    ctx.lineWidth = 2;
    for (const k of [0.38, 0.72]) {
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y, R * k, R, 0, Math.PI, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(DOME_X, DOME_Y, R, R * 0.36, 0, Math.PI, 0);
    ctx.stroke();
    const rimW = 4 + shieldLevel * 1.5;
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, R, Math.PI, 0);
    ctx.lineWidth = rimW + 3;
    ctx.strokeStyle = '#0a1830';
    ctx.stroke();
    const rg = ctx.createLinearGradient(DOME_X - R, DOME_Y - R, DOME_X + R, DOME_Y);
    rg.addColorStop(0, '#9adcff');
    rg.addColorStop(0.5, '#3a8ae8');
    rg.addColorStop(1, '#1a4aa0');
    ctx.strokeStyle = rg;
    ctx.lineWidth = rimW;
    ctx.shadowColor = '#4af';
    ctx.shadowBlur = 14 + pulse * 8 + shieldLevel * 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    }
    if (glassK < 0.999) {
      ctx.restore();
      // Packed: an armoured lid closes over the base
      const lid = 1 - glassK;
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y - 4, R + 4, 26 * lid + 4, 0, Math.PI, 0);
      ctx.fill();
      const lg = ctx.createLinearGradient(0, DOME_Y - 30, 0, DOME_Y);
      lg.addColorStop(0, '#b8c8e0');
      lg.addColorStop(1, '#4a5878');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y - 4, R + 1, 26 * lid + 1, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,50,0.6)';
      ctx.lineWidth = 2;
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(DOME_X + k * R, DOME_Y - 4);
        ctx.lineTo(DOME_X + k * R * 0.8, DOME_Y - 4 - 24 * lid * Math.sqrt(1 - k * k));
        ctx.stroke();
      }
    }

    // Shield impact flashes
    for (const impact of (rig ? [] : shieldImpacts)) {
      const ia = impact.angle;
      const il = impact.life;
      ctx.save();
      ctx.beginPath();
      const arcSpan = 0.3 * il;
      ctx.arc(DOME_X, DOME_Y, R + 4, ia - arcSpan, ia + arcSpan);
      ctx.strokeStyle = `rgba(140,220,255,${il * 0.9})`;
      ctx.lineWidth = 8 * il;
      ctx.shadowBlur = 15 * il;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.restore();
      drawGlow('#6cf', DOME_X + Math.cos(ia) * (R + 4), DOME_Y + Math.sin(ia) * (R + 4), 40 * il, il * 0.8);
    }

    // Base ring the dome sits on
    const baseG = ctx.createLinearGradient(0, DOME_Y - 8, 0, DOME_Y + 14);
    baseG.addColorStop(0, '#8a9ab8');
    baseG.addColorStop(0.4, '#4a5878');
    baseG.addColorStop(1, '#1a2238');
    ctx.fillStyle = baseG;
    ctx.beginPath();
    ctx.moveTo(DOME_X - R - 14, DOME_Y - 6);
    ctx.lineTo(DOME_X + R + 14, DOME_Y - 6);
    ctx.lineTo(DOME_X + R + 24, DOME_Y + 14);
    ctx.lineTo(DOME_X - R - 24, DOME_Y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0a1020';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(DOME_X - R - 12, DOME_Y - 5, (R + 12) * 2, 1.5);
    for (let i = 0; i < 9; ++i) {
      const lx = DOME_X - R + 4 + i * (R * 2 - 8) / 8;
      const on = unpack > 0.78 + i * 0.022 && Math.sin(animTime * 3 - i * 0.7) > 0.3;
      ctx.fillStyle = on ? '#7fe0ff' : '#24405a';
      ctx.fillRect(lx - 3, DOME_Y + 3, 6, 4);
      if (on)
        drawGlow('#4cf', lx, DOME_Y + 5, 9, 0.6);
    }

    // Turret on the dome arc (slides out of the shell when unpacking)
    const turretK = smoothstep(0.6, 0.85, unpack);
    if (turretK <= 0.01) {
      ctx.restore();
      return;
    }
    const nozzleDrawR = R + 16 * turretK;
    const tbx = DOME_X + Math.cos(turretAngle) * nozzleDrawR;
    const tby = DOME_Y + Math.sin(turretAngle) * nozzleDrawR;
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(turretAngle);
    ctx.scale(turretK, turretK);
    // Mount
    ctx.fillStyle = '#1a2236';
    roundRectPath(-14, -11, 22, 22, 5);
    ctx.fill();
    const mg = ctx.createLinearGradient(0, -10, 0, 10);
    mg.addColorStop(0, '#b8cce8');
    mg.addColorStop(0.5, '#6a82a8');
    mg.addColorStop(1, '#2a3858');
    ctx.fillStyle = mg;
    roundRectPath(-12, -9, 18, 18, 4);
    ctx.fill();
    // Barrel
    const bg = ctx.createLinearGradient(0, -5, 0, 5);
    bg.addColorStop(0, '#d0dcf0');
    bg.addColorStop(0.45, '#7a8aa8');
    bg.addColorStop(1, '#2a3248');
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(2, -6, TURRET_BARREL_LENGTH, 12);
    ctx.fillStyle = bg;
    ctx.fillRect(3, -5, TURRET_BARREL_LENGTH - 2, 10);
    ctx.fillStyle = '#2a3450';
    for (let i = 0; i < 3; ++i)
      ctx.fillRect(12 + i * 7, -5, 2, 10);
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(TURRET_BARREL_LENGTH - 5, -6, 5, 12);
    ctx.restore();
    // Charge light: bright when ready to fire
    const ready = fireCooldown <= 0;
    const mx = tbx + Math.cos(turretAngle) * TURRET_BARREL_LENGTH;
    const my = tby + Math.sin(turretAngle) * TURRET_BARREL_LENGTH;
    if (turretK > 0.9)
      drawGlow('#ff6040', mx, my, ready ? 16 + pulse * 4 : 8, ready ? 0.8 : 0.35);
    ctx.fillStyle = '#d8e4ff';
    ctx.beginPath();
    ctx.arc(tbx, tby, 4, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // How each ground creature is put together (body palette, legs, face and extras)
  const CREATURE_LOOK = {
    walker:   { body: 'walker', legs: 2, legCol: '#8a2028', eyes: '#fff27a', mouth: 'fangs' },
    swarmer:  { body: 'swarmer', legs: 3, legCol: '#5a6a10', eyes: '#ff5040', mouth: 'mandibles', sx: 1.3, sy: 0.8, antennae: true, legSpeed: 2.2 },
    crawler:  { body: 'armored', legs: 4, legCol: '#5a4a2a', eyes: '#ffb030', mouth: 'mandibles', sx: 1.35, sy: 0.85, plates: true, legSpeed: 0.6 },
    splitter: { body: 'splitter', legs: 2, legCol: '#a04a10', eyes: '#ffffff', mouth: 'fangs', cores: true },
    mender:   { body: 'mender', legs: 0, eyes: '#e0fff0', mouth: 'none', sx: 1.35, sy: 0.72, crystals: true },
    spitter:  { body: 'spitter', legs: 2, legCol: '#2a6a18', eyes: '#ffff80', mouth: 'tube', sac: true },
    burrower: { body: 'burrower', legs: 0, eyes: '#ffe0f0', mouth: 'drill', worm: true },
    behemoth: { body: 'boss', legs: 3, legCol: '#6a1028', eyes: '#ff4040', mouth: 'fangs', crown: true, horns: true, legSpeed: 0.5 }
  };

  function drawEnemy(e) {
    if (e.hidden)
      return drawBurrowMound(e);
    if (e.type === 'flyer')
      return drawFlyer(e);
    if (e.type === 'diver')
      return drawDiver(e);
    if (e.type === 'queen')
      return drawQueen(e);
    return drawCreature(e, CREATURE_LOOK[e.type] || CREATURE_LOOK.walker);
  }

  function drawCreature(e, look) {
    const sz = e.size || 10;
    const legSpeed = look.legSpeed || 1;
    const wobble = Math.sin(e.wobblePhase * legSpeed) * (look.worm ? 1 : 3);
    const legOffset = Math.sin(e.legPhase * legSpeed) * 6 * Math.min(1, sz / 20);
    const flash = enemyHitFlash.get(e) || 0;
    const face = e.x > DOME_X ? -1 : 1;
    const lunge = (e.lunge || 0) * 8 * face;
    const pop = e.pop !== undefined ? Math.min(1, e.pop) : 1;

    ctx.save();
    ctx.translate(e.x + lunge, e.y + wobble + (1 - pop) * sz * 1.4);
    if (look.worm && pop < 1) {
      ctx.beginPath();
      ctx.rect(-sz * 3, -sz * 4, sz * 6, DOME_Y - e.y + sz * 4 - wobble - (1 - pop) * sz * 1.4);
      ctx.clip();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75 + 4 - wobble, sz * 0.95 * (look.sx || 1), 6, 0, 0, TWO_PI);
    ctx.fill();

    // Behemoth stomp: the front feet rise and slam
    const stomp = e.stompAnim > 0 ? Math.sin((1 - e.stompAnim / 0.5) * Math.PI) * sz * 0.35 : 0;

    // Legs with outlines and feet
    if (look.legs) {
      const legs = [];
      for (let k = 0; k < look.legs; ++k) {
        const t = look.legs === 1 ? 0.5 : k / (look.legs - 1);
        const ox = (0.2 + t * 0.25) * (look.sx || 1), spread = (0.7 + t * 0.2) * (look.sx || 1);
        const o = (k % 2 ? -1 : 1) * legOffset;
        legs.push([-ox, 0.25, -spread, 0.6 + t * 0.15, o - (k === 0 ? stomp : 0)], [ox, 0.25, spread, 0.6 + t * 0.15, -o - (k === 0 ? stomp : 0)]);
      }
      const lw = Math.max(2.5, sz * 0.2);
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? look.legCol : SPRITE_OUTLINE;
        ctx.lineWidth = lw + (pass ? 0 : 3);
        ctx.lineCap = 'round';
        for (const [x0, y0, x1, y1, o] of legs) {
          ctx.beginPath();
          ctx.moveTo(sz * x0, sz * y0);
          ctx.quadraticCurveTo(sz * x1, sz * (y0 - 0.15), sz * x1, sz * y1 + o);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    }

    // Worm segments trailing into the ground
    if (look.worm) {
      const body = getEnemyBody(look.body);
      for (let k = 3; k >= 1; --k) {
        const s = sz * (1 - k * 0.12) * 2 * (96 / 72);
        ctx.drawImage(body, -face * k * sz * 0.45 - s / 2, k * sz * 0.38 - s / 2 + Math.sin(e.t * 6 + k) * 2, s, s);
      }
    }

    // Body with squash and stretch
    const squash = 1 + Math.sin(e.wobblePhase * 2 * legSpeed) * 0.05;
    const body = getEnemyBody(look.body);
    const bw = sz * 2 * (96 / 72) * (look.sx || 1) / squash, bh = sz * 2 * (96 / 72) * (look.sy || 1) * squash;
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Spitter's acid sac swells before each shot
    if (look.sac) {
      const swell = 1 + (e.charge || 0) * 0.35 + Math.sin(animTime * 5) * 0.04;
      const sr = sz * 0.5 * swell;
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(-face * sz * 0.3, -sz * 0.78, sr + 2.5, 0, TWO_PI);
      ctx.fill();
      const sg = ctx.createRadialGradient(-face * sz * 0.4, -sz * 0.95, 2, -face * sz * 0.3, -sz * 0.78, sr);
      sg.addColorStop(0, '#f0ffc0');
      sg.addColorStop(0.5, '#9aff50');
      sg.addColorStop(1, '#3a8a18');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(-face * sz * 0.3, -sz * 0.78, sr, 0, TWO_PI);
      ctx.fill();
      drawGlow('#8aff50', -face * sz * 0.3, -sz * 0.78, sr * 1.8, 0.25 + (e.charge || 0) * 0.5);
    }

    // Armour plates
    if (look.plates) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * (look.sx || 1), sz * (look.sy || 1), 0, 0, TWO_PI);
      ctx.clip();
      // Overlapping shell segments from head to tail
      const W = sz * (look.sx || 1);
      for (let k = -1; k <= 2; ++k) {
        const x = k * W * 0.42 - W * 0.2;
        ctx.strokeStyle = SPRITE_OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - sz * 0.12, -sz);
        ctx.quadraticCurveTo(x + sz * 0.22, 0, x - sz * 0.12, sz);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - sz * 0.05, -sz * 0.8);
        ctx.quadraticCurveTo(x + sz * 0.28, 0, x - sz * 0.05, sz * 0.4);
        ctx.stroke();
      }
      for (const [rx, ry] of [[-0.55, -0.35], [0.1, -0.5], [0.6, -0.3]]) {
        ctx.fillStyle = 'rgba(255,240,210,0.55)';
        ctx.beginPath();
        ctx.arc(rx * W, ry * sz, sz * 0.07, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    // Splitter cores swirling inside the membrane
    if (look.cores) {
      for (let k = 0; k < 3; ++k) {
        const a = animTime * 2.4 + k * TWO_PI / 3;
        const cx = Math.cos(a) * sz * 0.5, cy = Math.sin(a) * sz * 0.14 + sz * 0.5;
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.2 + 1.5, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#fff0a0';
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.2, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Mender: glowing crystals and a healing pulse
    if (look.crystals) {
      const pulse = (animTime * 0.8 + e.wobblePhase) % 1;
      ctx.strokeStyle = `rgba(90,255,170,${0.5 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, sz * 0.4, sz * (1 + pulse * 3), sz * (0.4 + pulse * 1.2), 0, 0, TWO_PI);
      ctx.stroke();
      for (let k = -1; k <= 1; ++k) {
        const h = sz * (0.7 + (k === 0 ? 0.35 : 0));
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.moveTo(k * sz * 0.45 - 5, -sz * 0.45);
        ctx.lineTo(k * sz * 0.45, -sz * 0.45 - h - 2);
        ctx.lineTo(k * sz * 0.45 + 5, -sz * 0.45);
        ctx.fill();
        ctx.fillStyle = '#7affc8';
        ctx.beginPath();
        ctx.moveTo(k * sz * 0.45 - 3.5, -sz * 0.45);
        ctx.lineTo(k * sz * 0.45, -sz * 0.45 - h);
        ctx.lineTo(k * sz * 0.45 + 3.5, -sz * 0.45);
        ctx.fill();
        drawGlow('#5affb0', k * sz * 0.45, -sz * 0.45 - h * 0.5, sz * 0.5, 0.5);
      }
    }

    // Boss horns and crown
    if (look.horns) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.55, -sz * 0.55);
        ctx.quadraticCurveTo(side * sz * 1.25, -sz * 0.9, side * sz * 1.05, -sz * 1.45);
        ctx.quadraticCurveTo(side * sz * 0.95, -sz * 0.95, side * sz * 0.35, -sz * 0.75);
        ctx.fill();
        ctx.fillStyle = '#e8dcc0';
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.55, -sz * 0.6);
        ctx.quadraticCurveTo(side * sz * 1.15, -sz * 0.92, side * sz * 1.02, -sz * 1.35);
        ctx.quadraticCurveTo(side * sz * 0.92, -sz * 0.95, side * sz * 0.4, -sz * 0.75);
        ctx.fill();
      }
    }
    if (look.crown) {
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.6, -sz * 0.8);
      ctx.lineTo(-sz * 0.45, -sz * 1.42);
      ctx.lineTo(-sz * 0.2, -sz * 1.05);
      ctx.lineTo(0, -sz * 1.6);
      ctx.lineTo(sz * 0.2, -sz * 1.05);
      ctx.lineTo(sz * 0.45, -sz * 1.42);
      ctx.lineTo(sz * 0.6, -sz * 0.8);
      ctx.closePath();
      ctx.fill();
      const cg = ctx.createLinearGradient(0, -sz * 1.5, 0, -sz * 0.8);
      cg.addColorStop(0, '#fff6b0');
      cg.addColorStop(1, '#d08a10');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.52, -sz * 0.84);
      ctx.lineTo(-sz * 0.43, -sz * 1.3);
      ctx.lineTo(-sz * 0.2, -sz * 0.98);
      ctx.lineTo(0, -sz * 1.48);
      ctx.lineTo(sz * 0.2, -sz * 0.98);
      ctx.lineTo(sz * 0.43, -sz * 1.3);
      ctx.lineTo(sz * 0.52, -sz * 0.84);
      ctx.closePath();
      ctx.fill();
    }
    if (look.antennae) {
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.3, -sz * 0.55);
        ctx.quadraticCurveTo(side * sz * 0.5 + face * sz * 0.4, -sz * 1.3, side * sz * 0.2 + face * sz * 0.9, -sz * 1.1 + Math.sin(animTime * 9 + side) * 2);
        ctx.stroke();
      }
    }

    // Face: eyes looking toward the dome and a mouth
    ctx.save();
    ctx.translate(face * sz * 0.12 * (look.sx || 1), 0);
    drawEnemyEyes(sz * (look.sy || 1), e.eyeBlinking, look.eyes, '#200');
    const ms = sz * (look.sy || 1);
    if (look.mouth === 'fangs') {
      ctx.fillStyle = '#2a0008';
      ctx.beginPath();
      ctx.moveTo(-ms * 0.28, ms * 0.22);
      ctx.quadraticCurveTo(0, ms * 0.5, ms * 0.28, ms * 0.22);
      ctx.quadraticCurveTo(0, ms * 0.32, -ms * 0.28, ms * 0.22);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-ms * 0.14, ms * 0.27);
      ctx.lineTo(-ms * 0.09, ms * 0.38);
      ctx.lineTo(-ms * 0.04, ms * 0.29);
      ctx.moveTo(ms * 0.04, ms * 0.29);
      ctx.lineTo(ms * 0.09, ms * 0.38);
      ctx.lineTo(ms * 0.14, ms * 0.27);
      ctx.fill();
    } else if (look.mouth === 'mandibles') {
      const open = 0.25 + Math.abs(Math.sin(animTime * 6 + e.wobblePhase)) * 0.25;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.lineWidth = Math.max(2, ms * 0.14);
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * ms * 0.2, ms * 0.3);
        ctx.quadraticCurveTo(side * ms * (0.35 + open), ms * 0.6, side * ms * 0.05, ms * 0.72);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (look.mouth === 'tube') {
      ctx.fillStyle = SPRITE_OUTLINE;
      roundRectPath(face > 0 ? ms * 0.1 : -ms * 0.75, ms * 0.12, ms * 0.65, ms * 0.32, ms * 0.12);
      ctx.fill();
      ctx.fillStyle = '#4a9a28';
      roundRectPath(face > 0 ? ms * 0.14 : -ms * 0.71, ms * 0.16, ms * 0.57, ms * 0.22, ms * 0.1);
      ctx.fill();
      ctx.fillStyle = '#c8ff80';
      ctx.beginPath();
      ctx.arc(face * ms * 0.72, ms * 0.27, ms * 0.07, 0, TWO_PI);
      ctx.fill();
    } else if (look.mouth === 'drill') {
      // Ring of teeth turning like a drill
      ctx.fillStyle = '#3a0820';
      ctx.beginPath();
      ctx.arc(0, ms * 0.3, ms * 0.3, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffe8f0';
      for (let k = 0; k < 6; ++k) {
        const a = k * TWO_PI / 6 + animTime * 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * ms * 0.3, ms * 0.3 + Math.sin(a) * ms * 0.3);
        ctx.lineTo(Math.cos(a + 0.25) * ms * 0.12, ms * 0.3 + Math.sin(a + 0.25) * ms * 0.12);
        ctx.lineTo(Math.cos(a + 0.5) * ms * 0.3, ms * 0.3 + Math.sin(a + 0.5) * ms * 0.3);
        ctx.fill();
      }
    }
    ctx.restore();

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
      for (let i = 0; i < 3; ++i) {
        const a = animTime * 4 + i * TWO_PI / 3;
        drawSprite('snowflake', Math.cos(a) * sz * 0.9, -sz * 1.1 + Math.sin(a) * 4, 14);
      }
    }
    ctx.restore();

    if (e.shield > 0)
      drawEnemyShield(e, wobble);
    drawEnemyHPBar(e, sz, wobble);
  }

  // A burrower travelling under the surface: a moving hump of dirt
  function drawBurrowMound(e) {
    const x = e.x, y = DOME_Y + 2;
    const w = e.size * 1.1, h = 8 + Math.sin(e.t * 9) * 2;
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.ellipse(x, y, w + 2, h + 2, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6a5038';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8a6c4c';
    for (let k = -2; k <= 2; ++k) {
      ctx.fillRect(x + k * w * 0.35 - 2, y - h * (0.5 + 0.3 * Math.sin(e.t * 7 + k)), 4, 3);
    }
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - h * 0.4);
    ctx.lineTo(x - w * 0.1, y - h * 0.8);
    ctx.lineTo(x + w * 0.3, y - h * 0.5);
    ctx.stroke();
  }

  function drawDiver(e) {
    const sz = e.size || 16;
    const flash = enemyHitFlash.get(e) || 0;
    const diving = e.phase === 'dive';
    const flap = diving ? 0.2 : Math.sin(e.wingPhase || 0);
    const ang = diving ? e.angle + Math.PI / 2 : Math.sin(e.t * 2.2) * 0.25;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 0.7, 3.5, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y);
    ctx.rotate(ang);
    if (diving)
      for (let k = 1; k <= 4; ++k) {
        ctx.fillStyle = `rgba(160,230,255,${0.18 - k * 0.035})`;
        ctx.beginPath();
        ctx.ellipse(0, -k * sz * 0.55, sz * 0.4, sz * 0.7, 0, 0, TWO_PI);
        ctx.fill();
      }
    // Swept wings
    for (const side of [-1, 1]) {
      const span = diving ? 0.8 : 1.9;
      const tipY = -sz * 0.2 + flap * sz * 0.7;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.25, -sz * 0.25);
      ctx.lineTo(side * sz * span, tipY - sz * 0.35);
      ctx.lineTo(side * sz * span * 0.7, tipY + sz * 0.15);
      ctx.lineTo(side * sz * 0.3, sz * 0.35);
      ctx.closePath();
      ctx.fillStyle = '#1e7890';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,240,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * span * 0.85, tipY - sz * 0.25);
      ctx.stroke();
    }
    const body = getEnemyBody('diver');
    const bs = sz * 2 * (96 / 72);
    ctx.save();
    ctx.scale(0.8, 1.15);
    ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    }
    ctx.restore();
    // Beak and eyes
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.22, sz * 0.55);
    ctx.lineTo(0, sz * 1.15);
    ctx.lineTo(sz * 0.22, sz * 0.55);
    ctx.fill();
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.15, sz * 0.58);
    ctx.lineTo(0, sz * 1.02);
    ctx.lineTo(sz * 0.15, sz * 0.58);
    ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#ffee60';
      ctx.beginPath();
      ctx.arc(sx * sz * 0.24, sz * 0.2, sz * 0.13, 0, TWO_PI);
      ctx.fill();
      drawGlow('#ffe040', sx * sz * 0.24, sz * 0.2, sz * 0.4, 0.5);
    }
    ctx.restore();
    if (e.shield > 0)
      drawEnemyShield(e, 0);
    drawEnemyHPBar(e, sz, 0);
  }

  function drawQueen(e) {
    const sz = e.size || 40;
    const flash = enemyHitFlash.get(e) || 0;
    const bob = Math.sin(e.wobblePhase) * 6;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 1.2, 7, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y + bob);
    // Two pairs of shimmering wings
    for (const [side, k] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      const flap = Math.sin((e.wingPhase || 0) * 1.4 + k * 0.6);
      ctx.save();
      ctx.rotate(side * (0.45 + k * 0.5 + flap * 0.25));
      ctx.fillStyle = `rgba(255,180,240,${0.35 - k * 0.08})`;
      ctx.strokeStyle = 'rgba(255,220,250,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(side * sz * 0.2, -sz * (1.05 - k * 0.15), sz * 0.35, sz * (1.05 - k * 0.25), 0, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Striped abdomen
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75, sz * 0.55, sz * 0.8, 0, 0, TWO_PI);
    ctx.fill();
    const ag = ctx.createLinearGradient(-sz * 0.5, 0, sz * 0.5, 0);
    ag.addColorStop(0, '#7a1468');
    ag.addColorStop(0.5, '#ff70d8');
    ag.addColorStop(1, '#7a1468');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75, sz * 0.5, sz * 0.75, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,0,30,0.55)';
    for (let k = 0; k < 4; ++k)
      ctx.fillRect(-sz * 0.48, sz * (0.35 + k * 0.28), sz * 0.96, sz * 0.09);
    // Thorax / head
    const body = getEnemyBody('queen');
    const bs = sz * 2 * (96 / 72) * 0.8;
    ctx.drawImage(body, -bs / 2, -bs / 2 - sz * 0.1, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2 - sz * 0.1, bs, bs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    drawEnemyEyes(sz * 0.8, e.eyeBlinking, '#ff60e0', '#300');
    // Crown
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.45, -sz * 0.55);
    ctx.lineTo(-sz * 0.35, -sz * 1.0);
    ctx.lineTo(-sz * 0.12, -sz * 0.75);
    ctx.lineTo(0, -sz * 1.15);
    ctx.lineTo(sz * 0.12, -sz * 0.75);
    ctx.lineTo(sz * 0.35, -sz * 1.0);
    ctx.lineTo(sz * 0.45, -sz * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd860';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.39, -sz * 0.6);
    ctx.lineTo(-sz * 0.32, -sz * 0.9);
    ctx.lineTo(-sz * 0.12, -sz * 0.7);
    ctx.lineTo(0, -sz * 1.04);
    ctx.lineTo(sz * 0.12, -sz * 0.7);
    ctx.lineTo(sz * 0.32, -sz * 0.9);
    ctx.lineTo(sz * 0.39, -sz * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (e.shield > 0)
      drawEnemyShield(e, bob);
    drawEnemyHPBar(e, sz, bob - sz * 0.2);
  }

  // Acid globs in flight and behemoth shockwaves
  function drawEnemyShots() {
    for (const s of enemyShots) {
      const x = s.x0 + (s.tx - s.x0) * s.t;
      const y = s.y0 + (s.ty - s.y0) * s.t - Math.sin(s.t * Math.PI) * 150;
      drawGlow('#8aff50', x, y, 22, 0.6);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#b8ff70';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#f0ffd0';
      ctx.fillRect(x - 3, y - 3, 2, 2);
      if (Math.random() < 0.4)
        particles.trail(x, y, { vx: (Math.random() - 0.5), vy: 0.5, color: '#8aff50', life: 0.3, size: 1.5, gravity: 0.05 });
    }
    for (const w of shockwaves) {
      const a = Math.max(0, 1 - w.r / 700);
      ctx.strokeStyle = `rgba(255,170,120,${0.7 * a})`;
      ctx.lineWidth = 5 * a + 1;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(w.from + dir * w.r * 0.0, DOME_Y + 4, w.r, 12 + w.r * 0.02, 0, dir > 0 ? -0.6 : Math.PI - 0.6, dir > 0 ? 0.6 : Math.PI + 0.6);
        ctx.stroke();
      }
    }
  }

  function drawFlyer(e) {
    const sz = e.size || 7;
    const bob = Math.sin(e.wobblePhase) * 8;
    const flap = Math.sin(e.wingPhase || 0);
    const flash = enemyHitFlash.get(e) || 0;

    ctx.save();
    // Shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 0.8, 4, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y + bob);

    // Membrane wings
    for (const side of [-1, 1]) {
      const tipY = -sz * 0.6 + flap * sz * 0.8;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.quadraticCurveTo(side * sz * 1.2, tipY - sz * 0.5, side * sz * 1.9, tipY);
      ctx.quadraticCurveTo(side * sz * 1.5, tipY + sz * 0.4, side * sz * 1.3, tipY + sz * 0.7);
      ctx.quadraticCurveTo(side * sz * 1.0, tipY + sz * 0.5, side * sz * 0.85, tipY + sz * 0.95);
      ctx.quadraticCurveTo(side * sz * 0.6, sz * 0.2, side * sz * 0.3, sz * 0.3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(110,40,150,0.9)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,170,255,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * 1.3, tipY + sz * 0.7);
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * 0.85, tipY + sz * 0.95);
      ctx.stroke();
    }

    const body = getEnemyBody('flyer');
    const bs = sz * 2 * (96 / 72);
    ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Glowing eyes
    ctx.fillStyle = '#ff4cf0';
    const eyeH = e.eyeBlinking ? 0.8 : sz * 0.16;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.2, -sz * 0.2, sz * 0.13, eyeH, sx * 0.3, 0, TWO_PI);
      ctx.fill();
      drawGlow('#ff40f0', sx * sz * 0.2, -sz * 0.2, sz * 0.5, 0.6);
    }

    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();

    if (e.shield > 0)
      drawEnemyShield(e, bob);
    drawEnemyHPBar(e, sz, bob);
  }

  function drawEnemyShield(e, vertOffset) {
    const sz = e.size || 10;
    const shieldR = e.shield / (e.maxShield || 1);
    ctx.save();
    ctx.translate(e.x, e.y + vertOffset);
    const r = sz + 12;
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    g.addColorStop(0, 'rgba(80,170,255,0)');
    g.addColorStop(1, `rgba(120,200,255,${0.15 + shieldR * 0.2})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = `rgba(140,210,255,${0.45 + shieldR * 0.45})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = -animTime * 20;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEnemyHPBar(e, sz, vertOffset) {
    const hpR = Math.max(0, e.hp / e.maxHP);
    const barW = Math.max(36, sz * 2 + 8);
    const barX = e.x - barW / 2;
    const barY = e.y - sz * (e.boss ? 1.75 : 1.2) - 16 + vertOffset;
    drawMeter(barX, barY, barW, 7, hpR, hpR > 0.5 ? '#ff6a5a' : '#ff3a3a', { track: 'rgba(20,0,0,0.75)' });
    if (e.shield > 0 && e.maxShield > 0)
      drawMeter(barX, barY - 8, barW, 5, e.shield / e.maxShield, '#5ab8ff', { track: 'rgba(0,10,30,0.75)' });
  }

  function drawProjectiles() {
    const prevOp = ctx.globalCompositeOperation;
    for (const p of projectiles) {
      const alpha = Math.max(0, p.life / p.maxLife);

      // Beam: wide soft glow, colored body, white-hot core
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,70,50,${alpha * 0.25})`;
      ctx.lineWidth = 16 * alpha + 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      SZ.GameEffects.drawElectricArc(ctx, p.x, p.y, p.tx, p.ty, {
        segments: 8,
        jitter: 10 * alpha,
        color: `rgba(255,150,120,${alpha})`,
        glowColor: `rgba(255,60,40,${alpha * 0.6})`,
        width: 3 * alpha + 0.5,
        glowWidth: 8 * alpha
      });
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,255,240,${alpha * 0.9})`;
      ctx.lineWidth = 1.5 * alpha + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Muzzle and impact flares with spark rays
      drawGlow('#ff7040', p.x, p.y, 22 * alpha + 6, alpha);
      drawGlow('#ffb070', p.tx, p.ty, 40 * alpha + 8, alpha);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,170,${alpha})`;
      ctx.lineWidth = 2;
      const rays = 6;
      for (let i = 0; i < rays; ++i) {
        const a = i * TWO_PI / rays + p.tx * 0.1;
        const r0 = 6, r1 = 6 + 22 * (1 - alpha) + 8;
        ctx.beginPath();
        ctx.moveTo(p.tx + Math.cos(a) * r0, p.ty + Math.sin(a) * r0);
        ctx.lineTo(p.tx + Math.cos(a) * r1, p.ty + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = prevOp;

      // Emit trail particles along beam
      if (Math.random() < 0.3) {
        const t = Math.random();
        const px = p.x + (p.tx - p.x) * t;
        const py = p.y + (p.ty - p.y) * t;
        particles.trail(px, py, { color: '#f88', life: 0.15, size: 1 });
      }
    }
    ctx.globalCompositeOperation = prevOp;
  }

  /* ======================================================================
     DRAWING -- SURFACE
     ====================================================================== */

  function drawSurface() {
    drawSky();

    // Ground layer with details
    drawGroundLayer();
    drawMeteorOre();

    // Dome
    drawDome();
    drawSnowCover();

    // Gadget visuals on surface
    drawSurfaceGadgets();

    // Enemies
    for (const e of enemies)
      drawEnemy(e);

    drawEnemyShots();

    // Projectiles, bombs and explosions
    drawProjectiles();
    drawSurfaceBombs();
    drawBlasts(false);
    drawWeather();
    drawThrowPreview();

    drawSurfaceHUD();

    // Upgrade panel and bomb stock
    drawUpgradePanel();
    drawBombBar();
  }

  /* ======================================================================
     DRAWING -- UNDERGROUND
     ====================================================================== */

  function drawUnderground() {
    const art = buildTileArt();
    ctx.fillStyle = '#070403';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid tiles (viewport culled)
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endCol = Math.min(GRID_COLS, Math.ceil((cameraX + CANVAS_W) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endRow = Math.min(GRID_ROWS, Math.ceil((cameraY + CANVAS_H) / TILE_SIZE));
    const ox = Math.round(cameraX), oy = Math.round(cameraY);
    const oreTiles = [];

    for (let r = startRow; r < endRow; ++r) {
      const row = undergroundGrid[r];
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - ox;
        const y = r * TILE_SIZE - oy;
        const tile = row[c];

        if (tile === TILE_EMPTY) {
          ctx.drawImage(art.cave[getDepthTier(r)][tileVariant(r, c) % art.VARIANTS], x, y);
          continue;
        }
        drawTile(x, y, tile === TILE_GADGET || tile === TILE_CORE || tile === TILE_CHEST ? TILE_DIRT : tile, r, c);
        if (tile !== TILE_DIRT && tile !== TILE_GADGET && tile !== TILE_CORE && tile !== TILE_CHEST)
          oreTiles.push(r, c);

        // Cracks on partially-mined tiles
        if (tileHP[r] && tileMaxHP[r] && tileMaxHP[r][c] > 0) {
          const hpRatio = tileHP[r][c] / tileMaxHP[r][c];
          if (hpRatio < 0.99) {
            const damage = 1 - hpRatio;
            ctx.fillStyle = `rgba(0,0,0,${damage * 0.3})`;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.drawImage(art.cracks[Math.min(3, Math.floor(damage * 4))], x, y);
          }
        }
      }
    }

    // Gadget chamber overlays and probe highlights
    drawUndergroundGadgets();

    // Edges between rock and tunnel: rim light on rock, occlusion in the tunnel
    const solidAt = (r, c) => r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS || undergroundGrid[r][c] !== TILE_EMPTY;
    for (let r = startRow; r < endRow; ++r)
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - ox;
        const y = r * TILE_SIZE - oy;
        const solid = undergroundGrid[r][c] !== TILE_EMPTY;
        const up = solidAt(r - 1, c), down = solidAt(r + 1, c), left = solidAt(r, c - 1), right = solidAt(r, c + 1);
        if (solid) {
          if (!up) ctx.drawImage(art.rimTop, x, y);
          if (!down) ctx.drawImage(art.rimBottom, x, y);
          if (!left) ctx.drawImage(art.rimLeft, x, y);
          if (!right) ctx.drawImage(art.rimRight, x, y);
        } else {
          if (up) ctx.drawImage(art.aoTop, x, y);
          if (down) ctx.drawImage(art.aoBottom, x, y);
          if (left) ctx.drawImage(art.aoLeft, x, y);
          if (right) ctx.drawImage(art.aoRight, x, y);
        }
      }

    // Resource reveal glows (drawn over tiles)
    for (const g of resourceGlows)
      drawGlow(g.color, g.x, g.y, g.radius, Math.max(0, g.life) * 0.6);

    // Rock crumble debris
    for (const crumble of crumbleEffects) {
      const alpha = Math.max(0, crumble.life / 0.6);
      ctx.globalAlpha = alpha;
      for (const p of crumble.pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.fillRect(-p.size / 2 - 1, -p.size / 2 - 1, p.size + 2, p.size + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Dust clouds
    for (const d of dustClouds) {
      ctx.save();
      ctx.globalAlpha = d.alpha * 0.8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fillStyle = '#9a8a6a';
      ctx.fill();
      ctx.restore();
    }

    // Dropped resources: bobbing ore icons with their value
    for (const drop of droppedResources) {
      const dx = drop.col * TILE_SIZE + TILE_SIZE / 2 - ox;
      const dy = drop.row * TILE_SIZE + TILE_SIZE / 2 - oy;
      if (dx < -TILE_SIZE || dx > CANVAS_W + TILE_SIZE || dy < -TILE_SIZE || dy > CANVAS_H + TILE_SIZE) continue;
      const bob = Math.sin(animTime * 4 + drop.col + drop.row) * 3;
      drawGlow(TILE_HIGHLIGHT_COLORS[drop.type] || '#fff', dx, dy + bob, 22, 0.35);
      drawSprite(TILE_ICONS[drop.type] || 'crate', dx, dy + bob, 22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      fitText(String(drop.value), dx, dy - 10 + bob, TILE_SIZE + 8, 15, { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.8)' });
    }

    // Planned path
    if (movePath && movePathIndex < movePath.length) {
      ctx.strokeStyle = 'rgba(120,210,255,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -animTime * 20;
      ctx.beginPath();
      ctx.moveTo(drillX * TILE_SIZE + TILE_SIZE / 2 - ox, drillY * TILE_SIZE + TILE_SIZE / 2 - oy);
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        ctx.lineTo(step.col * TILE_SIZE + TILE_SIZE / 2 - ox, step.row * TILE_SIZE + TILE_SIZE / 2 - oy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.fillStyle = 'rgba(140,220,255,0.6)';
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        ctx.beginPath();
        ctx.arc(step.col * TILE_SIZE + TILE_SIZE / 2 - ox, step.row * TILE_SIZE + TILE_SIZE / 2 - oy, pi === movePath.length - 1 ? 5 : 2.5, 0, TWO_PI);
        ctx.fill();
      }
      if (mineTarget) {
        ctx.strokeStyle = `rgba(255,140,60,${0.5 + Math.sin(animTime * 6) * 0.2})`;
        ctx.lineWidth = 3;
        roundRectPath(mineTarget.col * TILE_SIZE + 3 - ox, mineTarget.row * TILE_SIZE + 3 - oy, TILE_SIZE - 6, TILE_SIZE - 6, 5);
        ctx.stroke();
      }
    }

    // Draw drill/player character
    drawPlayer();

    // Lamp light: darkness deepens with depth, warm glow around the keeper
    const pcx = drillX * TILE_SIZE + TILE_SIZE / 2 - ox;
    const pcy = drillY * TILE_SIZE + TILE_SIZE / 2 - oy;
    const depth = drillY / GRID_ROWS;
    const radar = 1 + 0.25 * getEffectiveLevel('undergroundRadar');
    const lw = CANVAS_W * 1.9 * radar, lh = CANVAS_H * 1.9 * 0.75 * radar;
    ctx.globalAlpha = 0.6 + depth * 0.35;
    ctx.drawImage(art.light, pcx - lw / 2, pcy - lh / 2, lw, lh);
    ctx.fillStyle = '#000';
    if (pcx - lw / 2 > 0) ctx.fillRect(0, 0, pcx - lw / 2, CANVAS_H);
    if (pcx + lw / 2 < CANVAS_W) ctx.fillRect(pcx + lw / 2, 0, CANVAS_W - pcx - lw / 2, CANVAS_H);
    if (pcy - lh / 2 > 0) ctx.fillRect(0, 0, CANVAS_W, pcy - lh / 2);
    if (pcy + lh / 2 < CANVAS_H) ctx.fillRect(0, pcy + lh / 2, CANVAS_W, CANVAS_H - pcy - lh / 2);
    ctx.globalAlpha = 1;
    drawGlow('#ffcf80', pcx, pcy, 150, 0.16);

    // Courier drones carry their own lights; the core glows through the dark
    drawUndergroundDrones();
    drawRelocationCoreMarker();
    drawChests();
    drawChestHints(toolState.scannerActive ? scannerRange() : 0);

    // Ore glints twinkle through the dark
    for (let i = 0; i < oreTiles.length; i += 2) {
      const r = oreTiles[i], c = oreTiles[i + 1];
      const h = tileVariant(r, c);
      const tw = Math.sin(animTime * 1.7 + (h % 628) / 100);
      if (tw < 0.9) continue;
      const k = (tw - 0.9) * 10;
      const gx = c * TILE_SIZE - ox + 8 + (h % 24), gy = r * TILE_SIZE - oy + 8 + ((h >>> 5) % 24);
      drawGlow(TILE_HIGHLIGHT_COLORS[undergroundGrid[r][c]] || '#fff', gx, gy, 10 + k * 6, k);
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.fillRect(gx - 4 * k, gy - 0.5, 8 * k, 1);
      ctx.fillRect(gx - 0.5, gy - 4 * k, 1, 8 * k);
    }

    // Bombs lying in the mine, explosions and the throw preview
    drawPlacedBombs();
    drawBlasts(true);
    drawThrowPreview();

    // Mining progress bar above the block being mined
    if (miningTarget && miningDuration > 0) {
      const progress = Math.min(miningProgress / miningDuration, 1);
      drawMeter(miningTarget.col * TILE_SIZE - ox + 2, miningTarget.row * TILE_SIZE - oy - 10, TILE_SIZE - 4, 7, progress, progress > 0.8 ? '#5ae070' : '#ffb030');
    }

    // Resource display (improved styling)
    drawResourceHUD();

    drawBombBar();

    // Tool and drone HUD (underground, right side)
    drawDroneHUD(CANVAS_W - 296, drawToolHUDUnderground() + 12, 280);

    drawKeyHints([
      { key: 'Space', label: 'Surface' },
      { key: 'WASD', label: 'Move & mine' },
      { key: 'Click', label: 'Walk / dig' },
      { key: 'B', label: 'Bomb' },
      { key: 'C', label: 'Craft' },
      { key: 'H', label: 'Help' }
    ], CANVAS_W / 2 - 150, CANVAS_H - 24, 680);
  }


  // Tile textures, edge overlays, cracks and light maps -- built once
  function buildTileArt() {
    if (tileArt) return tileArt;
    const T = TILE_SIZE;
    const VARIANTS = 4;
    const rgb = (hex) => parseHex(hex);
    const shade = ([r, g, b], k) => `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;

    const paintGround = (g, base, rng, stony, density) => {
      const c = rgb(base);
      g.fillStyle = shade(c, 1);
      g.fillRect(0, 0, T, T);
      // 2px pixel noise for a hand-made texture
      for (let y = 0; y < T; y += 2)
        for (let x = 0; x < T; x += 2) {
          const v = rng();
          if (v < density) {
            g.fillStyle = shade(c, 0.78 + rng() * 0.1);
            g.fillRect(x, y, 2, 2);
          } else if (v > 1 - density * 0.6) {
            g.fillStyle = shade(c, 1.12 + rng() * 0.1);
            g.fillRect(x, y, 2, 2);
          }
        }
      // Pebbles / stones with a lit top
      const n = stony ? 3 : 2;
      for (let i = 0; i < n; ++i) {
        const px = 4 + rng() * (T - 8), py = 4 + rng() * (T - 8);
        const w = (stony ? 5 : 3) + rng() * 4, h = 2 + rng() * 3;
        g.fillStyle = shade(c, 0.62);
        g.fillRect(px - w / 2, py - h / 2 + 1, w, h);
        g.fillStyle = shade(c, stony ? 1.3 : 1.22);
        g.fillRect(px - w / 2, py - h / 2, w, h - 1);
        g.fillStyle = shade(c, 1.5);
        g.fillRect(px - w / 2, py - h / 2, w * 0.6, 1);
      }
      if (stony) {
        g.strokeStyle = shade(c, 0.6);
        g.lineWidth = 1;
        g.beginPath();
        let x = rng() * T, y = 0;
        g.moveTo(x, y);
        for (let k = 0; k < 4; ++k) {
          x += (rng() - 0.5) * 14;
          y += T / 4;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    };

    // Extra surface detail that gives each deep stratum its own look
    const paintStyle = (g, style, base, rng, variant) => {
      const c = rgb(base);
      const line = (pts, col, w) => {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      };
      if (style === 'slate') {
        // Thin cleavage layers
        for (let y = 3 + rng() * 4; y < T; y += 5 + rng() * 4) {
          line([[0, y], [T * 0.4, y + (rng() - 0.5) * 2], [T, y + (rng() - 0.5) * 3]], shade(c, 0.7), 1);
          line([[0, y + 1], [T, y + 1 + (rng() - 0.5) * 2]], shade(c, 1.25), 1);
        }
      } else if (style === 'granite') {
        // Feldspar and mica flecks
        for (let i = 0; i < 26; ++i) {
          const x = rng() * T, y = rng() * T, k = rng();
          g.fillStyle = k < 0.35 ? 'rgba(255,220,210,0.55)' : (k < 0.7 ? 'rgba(20,10,10,0.55)' : 'rgba(255,255,255,0.7)');
          g.fillRect(x | 0, y | 0, k > 0.85 ? 2 : 1 + (rng() * 2 | 0), 1 + (rng() * 2 | 0));
        }
      } else if (style === 'basalt') {
        // Column joints
        const x1 = T * 0.33 + (rng() - 0.5) * 4, x2 = T * 0.68 + (rng() - 0.5) * 4, ym = T * (0.3 + rng() * 0.4);
        for (const [pts, a] of [[[[x1, 0], [x1 + 2, ym], [x1, T]], 0.75], [[[x2, 0], [x2 - 2, T - ym], [x2 + 1, T]], 0.75], [[[x1 + 2, ym], [x2 - 1, ym + 3]], 0.6]]) {
          line(pts, shade(c, 0.45), 2);
          line(pts.map(([x, y]) => [x + 1, y + 1]), `rgba(255,255,255,${0.08 * a})`, 1);
        }
      } else if (style === 'obsidian') {
        // Glassy glints and a conchoidal fracture now and then
        for (let i = 0; i < 3; ++i) {
          const x = rng() * T, y = rng() * T, l = 3 + rng() * 6;
          line([[x, y], [x + l, y - l * 0.6]], `rgba(210,190,255,${0.12 + rng() * 0.18})`, 1);
        }
        if (rng() < 0.5) {
          g.strokeStyle = 'rgba(220,200,255,0.16)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(rng() * T, rng() * T, 5 + rng() * 6, rng() * 3, rng() * 3 + 1.6);
          g.stroke();
        }
      } else if (style === 'magma') {
        // A glowing fissure in some tiles, embers in the rest
        if (variant === 1) {
          const horiz = rng() < 0.5;
          let a = rng() * T, b = 0;
          const pts = [];
          while (b <= T + 6) {
            pts.push(horiz ? [b, a] : [a, b]);
            a = Math.max(4, Math.min(T - 4, a + (rng() - 0.5) * 10));
            b += 5 + rng() * 6;
          }
          line(pts, 'rgba(255,90,20,0.3)', 4);
          line(pts, '#e8601a', 1.6);
          line(pts, '#ffd070', 0.6);
        }
        for (let i = 0; i < 3; ++i) {
          g.fillStyle = `rgba(255,${120 + rng() * 100 | 0},40,${0.4 + rng() * 0.4})`;
          g.fillRect(rng() * T | 0, rng() * T | 0, 1 + (rng() < 0.3 ? 1 : 0), 1);
        }
      } else if (style === 'abyss') {
        // Faint violet veins and pinpoint lights
        line([[0, rng() * T], [T * 0.5, rng() * T], [T, rng() * T]], 'rgba(140,90,255,0.35)', 1);
        for (let i = 0; i < 5; ++i) {
          g.fillStyle = `rgba(${200 + rng() * 55 | 0},180,255,${0.35 + rng() * 0.5})`;
          g.fillRect(rng() * T | 0, rng() * T | 0, 1, 1);
        }
      }
    };
    const STONY = { gravel: true, stone: true, slate: false, granite: true, basalt: true, obsidian: false, magma: true, abyss: false };

    const rng = makeRng(777);
    const dirt = [], cave = [];
    for (let t = 0; t < DEPTH_TIERS.length; ++t) {
      dirt.push([]);
      cave.push([]);
      const tier = DEPTH_TIERS[t];
      for (let v = 0; v < VARIANTS; ++v) {
        const d = makeCanvas(T, T);
        const dg = d.getContext('2d');
        paintGround(dg, tier.base, rng, !!STONY[tier.style], tier.style === 'obsidian' ? 0.12 : 0.22);
        paintStyle(dg, tier.style, tier.base, rng, v);
        dirt[t].push(d);
        const cv = makeCanvas(T, T);
        const cg = cv.getContext('2d');
        const base = rgb(DEPTH_TIERS[t].base);
        paintGround(cg, shade(base, 0.32).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g2, b) => '#' + [r, g2, b].map(n => (+n).toString(16).padStart(2, '0')).join('')), rng, false, 0.3);
        cave[t].push(cv);
      }
    }

    // First row of each tier: the tier above reaches down with a jagged edge
    const seam = [null];
    for (let t = 1; t < DEPTH_TIERS.length; ++t) {
      seam.push([]);
      for (let v = 0; v < VARIANTS; ++v) {
        const sc = makeCanvas(T, T);
        const g = sc.getContext('2d');
        const pts = [];
        for (let x = 0; x <= T; x += 5)
          pts.push([x, 3 + rng() * 11]);
        g.beginPath();
        g.moveTo(0, 0);
        for (const [x, y] of pts)
          g.lineTo(x, y);
        g.lineTo(T, 0);
        g.closePath();
        g.save();
        g.clip();
        g.drawImage(dirt[t - 1][v], 0, 0);
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.beginPath();
        pts.forEach(([x, y], i) => i ? g.lineTo(x, y + 1) : g.moveTo(x, y + 1));
        g.stroke();
        seam[t].push(sc);
      }
    }

    // Embedded ore chunks per resource type
    const ore = {};
    for (const tile of RESOURCE_TILES) {
      ore[tile] = [];
      const cols = ORE_SPECKLE_COLORS[tile] || ['#fff'];
      for (let v = 0; v < VARIANTS; ++v) {
        const oc = makeCanvas(T, T);
        const g = oc.getContext('2d');
        for (let i = 0; i < 9; ++i) {
          const x = 4 + rng() * (T - 8), y = 4 + rng() * (T - 8);
          // keep the centre free for the sprite
          if (Math.abs(x - T / 2) < 12 && Math.abs(y - T / 2) < 12) continue;
          const s = 2 + rng() * 2.5;
          g.fillStyle = SPRITE_OUTLINE;
          g.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
          g.fillStyle = cols[i % cols.length];
          g.fillRect(x - s / 2, y - s / 2, s, s);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(x - s / 2, y - s / 2, Math.max(1, s / 2), 1);
        }
        ore[tile].push(oc);
      }
    }

    // Edge overlays on solid tiles that border a tunnel (rim light / lip)
    const edge = (draw) => {
      const c = makeCanvas(T, T);
      draw(c.getContext('2d'));
      return c;
    };
    const rimTop = edge(g => {
      g.fillStyle = 'rgba(255,240,210,0.28)';
      g.fillRect(0, 0, T, 3);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, T, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 3, T, 1);
    });
    const rimBottom = edge(g => {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, T - 4, T, 4);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, T - 5, T, 1);
    });
    const rimLeft = edge(g => {
      g.fillStyle = 'rgba(255,240,210,0.14)';
      g.fillRect(0, 0, 2, T);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(2, 0, 1, T);
    });
    const rimRight = edge(g => {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(T - 3, 0, 3, T);
    });
    // Ambient occlusion inside tunnels next to solid rock
    const ao = (x0, y0, x1, y1) => edge(g => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, T, T);
    });
    const aoTop = ao(0, 0, 0, T * 0.45), aoBottom = ao(0, T, 0, T * 0.6), aoLeft = ao(0, 0, T * 0.4, 0), aoRight = ao(T, 0, T * 0.6, 0);

    // Crack stages for partly mined tiles
    const cracks = [];
    for (let stage = 1; stage <= 4; ++stage) {
      const c = makeCanvas(T, T);
      const g = c.getContext('2d');
      const r2 = makeRng(stage * 31);
      g.lineCap = 'round';
      for (let k = 0; k < stage + 1; ++k) {
        let x = T / 2 + (r2() - 0.5) * 8, y = T / 2 + (r2() - 0.5) * 8;
        let a = r2() * TWO_PI;
        const pts = [[x, y]];
        for (let i = 0; i < 2 + stage; ++i) {
          a += (r2() - 0.5) * 1.2;
          x += Math.cos(a) * (4 + stage * 1.5);
          y += Math.sin(a) * (4 + stage * 1.5);
          pts.push([x, y]);
        }
        for (const [col, w, oy] of [['rgba(255,255,255,0.25)', 1.5, 1], ['rgba(0,0,0,0.75)', 1.5 + stage * 0.4, 0]]) {
          g.strokeStyle = col;
          g.lineWidth = w;
          g.beginPath();
          pts.forEach(([px, py], i) => i ? g.lineTo(px, py + oy) : g.moveTo(px, py + oy));
          g.stroke();
        }
      }
      cracks.push(c);
    }

    // Darkness map around the miner's lamp (scaled up when drawn)
    const LW = 400, LH = 300;
    const light = makeCanvas(LW, LH);
    const lg = light.getContext('2d');
    const lgr = lg.createRadialGradient(LW / 2, LH / 2, 18, LW / 2, LH / 2, LW * 0.42);
    lgr.addColorStop(0, 'rgba(0,0,0,0)');
    lgr.addColorStop(0.35, 'rgba(0,0,0,0.25)');
    lgr.addColorStop(1, 'rgba(0,0,0,1)');
    lg.fillStyle = lgr;
    lg.fillRect(0, 0, LW, LH);

    tileArt = { dirt, cave, seam, ore, VARIANTS, rimTop, rimBottom, rimLeft, rimRight, aoTop, aoBottom, aoLeft, aoRight, cracks, light };
    return tileArt;
  }

  function tileVariant(r, c) {
    return ((r * 73856093) ^ (c * 19349663)) >>> 0;
  }

  function drawTile(x, y, tile, r, c) {
    const art = buildTileArt();
    const h = tileVariant(r, c);
    const tier = getDepthTier(r);
    ctx.drawImage(art.dirt[tier][h % art.VARIANTS], x, y);
    if (tier > 0 && getDepthTier(r - 1) !== tier)
      ctx.drawImage(art.seam[tier][(h >>> 5) % art.VARIANTS], x, y);
    if (tile === TILE_DIRT || tile === TILE_GADGET)
      return;
    const ores = art.ore[tile];
    if (ores)
      ctx.drawImage(ores[(h >>> 3) % art.VARIANTS], x, y);
    // Soft colour bloom so ore tiles read at a glance
    const hl = TILE_HIGHLIGHT_COLORS[tile];
    if (hl)
      drawGlow(hl, x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.62, 0.3);
    const tIcon = TILE_ICONS[tile];
    if (tIcon)
      drawSprite(tIcon, x + TILE_SIZE / 2, y + TILE_SIZE / 2, 26);
  }

  function drawPlayer() {
    const px = drillX * TILE_SIZE - Math.round(cameraX);
    const py = drillY * TILE_SIZE - Math.round(cameraY);
    const bob = playerBob;
    const face = lastMineDir.dx < 0 ? -1 : 1;

    // Selection brackets
    const sel = 0.55 + Math.sin(animTime * 5) * 0.25;
    ctx.strokeStyle = `rgba(255,220,90,${sel})`;
    ctx.lineWidth = 3;
    const L = 10, t = TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(px, py + L); ctx.lineTo(px, py); ctx.lineTo(px + L, py);
    ctx.moveTo(px + t - L, py); ctx.lineTo(px + t, py); ctx.lineTo(px + t, py + L);
    ctx.moveTo(px + t, py + t - L); ctx.lineTo(px + t, py + t); ctx.lineTo(px + t - L, py + t);
    ctx.moveTo(px + L, py + t); ctx.lineTo(px, py + t); ctx.lineTo(px, py + t - L);
    ctx.stroke();

    // Headlamp beam in the facing / mining direction
    const lampX = px + TILE_SIZE / 2 + face * 2, lampY = py + 10 + bob;
    const dirX = lastMineDir.dx || (lastMineDir.dy ? 0 : face), dirY = lastMineDir.dy || 0;
    const ang = Math.atan2(dirY, dirX);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createRadialGradient(lampX, lampY, 4, lampX, lampY, 150);
    cone.addColorStop(0, 'rgba(255,230,160,0.28)');
    cone.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(lampX, lampY);
    ctx.arc(lampX, lampY, 150, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(px + TILE_SIZE / 2, py + TILE_SIZE / 2 + bob);
    ctx.scale(face, 1);
    const O = SPRITE_OUTLINE;
    const legAnim = pickaxeSwinging ? Math.sin(animTime * 15) * 1.5 : 0;

    // Backpack
    ctx.fillStyle = O;
    roundRectPath(-13, -4, 9, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#c87a2a';
    roundRectPath(-12, -3, 7, 12, 2);
    ctx.fill();

    // Legs and boots
    ctx.fillStyle = O;
    ctx.fillRect(-7 + legAnim, 9, 6, 9);
    ctx.fillRect(1 - legAnim, 9, 6, 9);
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(-6 + legAnim, 9, 4, 7);
    ctx.fillRect(2 - legAnim, 9, 4, 7);
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(-7 + legAnim, 15, 6, 3);
    ctx.fillRect(1 - legAnim, 15, 6, 3);

    // Suit
    ctx.fillStyle = O;
    roundRectPath(-9, -3, 18, 15, 4);
    ctx.fill();
    const sg = ctx.createLinearGradient(-8, 0, 8, 0);
    sg.addColorStop(0, '#5a8ae8');
    sg.addColorStop(1, '#2a4aa0');
    ctx.fillStyle = sg;
    roundRectPath(-8, -2, 16, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(-8, 6, 16, 2);

    // Head and helmet
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(0, -8, 8.5, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#f0c090';
    ctx.beginPath();
    ctx.arc(0, -7, 7, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(2, -8, 2, 2);
    ctx.fillRect(-3, -8, 2, 2);
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(0, -10, 9, Math.PI, 0);
    ctx.lineTo(10, -9);
    ctx.lineTo(-10, -9);
    ctx.closePath();
    ctx.fill();
    const hg = ctx.createLinearGradient(0, -18, 0, -9);
    hg.addColorStop(0, '#ffe070');
    hg.addColorStop(1, '#d09010');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -10, 7.5, Math.PI, 0);
    ctx.lineTo(9, -10);
    ctx.lineTo(-9, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(5, -13, 2.5, 0, TWO_PI);
    ctx.fill();

    // Arm and pickaxe
    ctx.save();
    ctx.translate(6, 1);
    const swing = pickaxeSwinging ? -1.2 + pickaxeAngle * 1.8 : -0.5;
    ctx.rotate(swing);
    ctx.fillStyle = O;
    ctx.fillRect(-1, -2, 15, 4);
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(0, -1, 14, 2);
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.moveTo(10, -9);
    ctx.quadraticCurveTo(17, -2, 12, 9);
    ctx.lineTo(14, 9);
    ctx.quadraticCurveTo(20, -2, 12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, -8);
    ctx.quadraticCurveTo(17, -2, 13, 8);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(6, 2, 3.2, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#f0c090';
    ctx.beginPath();
    ctx.arc(6, 2, 2, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    drawGlow('#fff0b0', lampX + face * 3, py + 6 + bob, 14, 0.7);

    // Dazed by a blast: stars circle the helmet
    if (keeperStun > 0) {
      const cx = px + TILE_SIZE / 2, cy = py + 2 + bob;
      for (let i = 0; i < 3; ++i) {
        const a = animTime * 5 + i * TWO_PI / 3;
        drawSprite('sparkle', cx + Math.cos(a) * 16, cy + Math.sin(a) * 5, 14, Math.min(1, keeperStun));
      }
    }
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
    { key: 'ruby', label: 'Rb', color: '#ff4488' },
    { key: 'titanium', label: 'Ti', color: '#c8dcf4' },
    { key: 'sapphire', label: 'Sa', color: '#6aa0ff' },
    { key: 'uranium', label: 'U', color: '#9aff5a' },
    { key: 'amethyst', label: 'Am', color: '#d090ff' },
    { key: 'opal', label: 'Op', color: '#ffd080' },
    { key: 'voidstone', label: 'Vd', color: '#b48aff' }
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
    drawPanel(carryX, panelY, carryW, 112, { accent: '#e0c060', shadow: 10 });
    const carryRatio = Math.min(carried / carryCapacity, 1);
    drawSprite('bag', carryX + 24, panelY + 24, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Cargo', carryX + 44, panelY + 25, 90, 18, { weight: 'bold', color: UI.text });
    ctx.textAlign = 'right';
    fitText(`${carried} / ${carryCapacity}`, carryX + carryW - 16, panelY + 25, 130, 18, { weight: 'bold', color: carryRatio >= 1 ? UI.bad : '#f0d070' });
    drawMeter(carryX + 14, panelY + 42, carryW - 28, 10, carryRatio, carryRatio >= 1 ? '#e84040' : '#e0b030');
    ctx.textAlign = 'left';
    ctx.textAlign = 'right';
    const chw = fitText(`[[chest]] ${chestsOpened()} / ${chests.length}`, carryX + carryW - 16, panelY + 68, 80, 15, { weight: 'bold', color: '#e0b0ff' });
    ctx.textAlign = 'left';
    fitText(`Depth ${drillY} m  ·  ${DEPTH_TIERS[getDepthTier(drillY)].name}`, carryX + 16, panelY + 68, carryW - 40 - chw, 15, { color: UI.textDim });
    drawMineClock(carryX + 14, panelY + 94, carryW - 28);
  }

  // Returns the bottom edge of the panel
  function drawToolHUDUnderground() {
    const tools = TOOL_DEFS.filter(d => unlockedTools[d.key]);
    if (!tools.length) return 128;

    const hudX = CANVAS_W - 296, hudW = 280;
    const hudY = 140;
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
    return hudY + 12 + tools.length * rowH;
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
      drawSprite('tree', treeX, treeY - 26, 52);
      // Fruit (glowing when ready)
      if (primaryGadgetState.fruitReady) {
        const fruitGlow = Math.sin(animTime * 5) * 0.3 + 0.7;
        drawGlow('#ffd040', treeX + 10, treeY - 30, 18, fruitGlow);
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 7, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = `rgba(255,200,50,${fruitGlow})`;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 5.5, 0, TWO_PI);
        ctx.fill();
      }
    }

    drawSurfaceDrones();

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

    // Emergency Shield: golden bubble while invulnerable
    if (domeInvulnerable > 0) {
      const a = Math.min(1, domeInvulnerable) * (0.6 + Math.sin(animTime * 12) * 0.2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 22, Math.PI, 0);
      ctx.strokeStyle = `rgba(255,220,110,${a})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = '#ffd060';
      ctx.shadowBlur = 16;
      ctx.stroke();
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
    // Day, time and moon (top-left)
    drawClockPanel();
    drawRelocateButton();

    drawGadgetHUD();

    // Score and stock (top-right)
    const sx = CANVAS_W - 340;
    drawPanel(sx, 16, 320, 118, { accent: UI.gold });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('SCORE', sx + 16, 38, 90, 14, { weight: 'bold', color: UI.textDim });
    fitText(`[[crate]] ${totalResources()} resources`, sx + 16, 64, 170, 16, { color: UI.textDim });
    ctx.textAlign = 'right';
    fitText(String(score), sx + 304, 42, 200, 30, { weight: 'bold', color: UI.gold });
    // Site, threat and the Relocation Core
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(sx + 14, 79, 292, 1);
    ctx.textAlign = 'left';
    fitText(`Site ${site.index + 1} · ${currentBiome().name}`, sx + 16, 96, 200, 16, { weight: 'bold', color: UI.text });
    const threat = isNight() ? Math.max(1, threatLevel()) : threatLevel() + 1; // tonight's threat
    drawChip(`Threat ${threat}`, sx + 306, 84, 24, { align: 'right', px: 13, maxW: 96, bg: 'rgba(255,90,90,0.14)', border: 'rgba(255,120,110,0.55)', color: '#ffa090' });
    ctx.textAlign = 'left';
    ctx.textAlign = 'right';
    const chw = fitText(`[[chest]] ${chestsOpened()} / ${chests.length}`, sx + 306, 120, 70, 14, { weight: 'bold', color: '#e0b0ff' });
    ctx.textAlign = 'left';
    fitText(relocationCore.found ? '[[core]] Core found: relocate when ready' : `[[core]] Core hidden below ${coreDepthHint()} m`, sx + 16, 120, 282 - chw, 14, { color: relocationCore.found ? '#7ae8ff' : UI.textMute });

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
      { key: 'C', label: 'Bombs' },
      { key: 'H', label: 'Help' },
      { key: 'Esc', label: 'Pause' }
    ], CANVAS_W / 2 - 60, CANVAS_H - 24, 600);
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
    }
    if (drones.length || gunDrones.length || repairBot) {
      const out = drones.filter(d => d.state !== 'dock').length;
      const parts = [];
      if (drones.length)
        parts.push(`${drones.length} courier${drones.length > 1 ? 's' : ''}${out ? ' (' + out + ' out)' : ''}`);
      if (gunDrones.length)
        parts.push(`${gunDrones.length} gun`);
      if (repairBot)
        parts.push('repair');
      rows.push({ icon: 'drone', text: 'Drones: ' + parts.join(', '), color: '#d8b8ff' });
    }

    for (const g of foundGadgets) {
      if (g === 'blastMining') continue;
      rows.push({ icon: 'gear', text: MINE_GADGET_NAMES[g] || g, color: '#d0c890' });
    }

    for (const def of TOOL_DEFS) {
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

  // Tiles the scanner sees around the keeper
  function scannerRange() {
    return 3 + (toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
  }

  // The Relocation Core in the rock, and the scanner's hint towards it
  function drawRelocationCoreMarker() {
    const rc = relocationCore;
    if (rc.found) return;
    const x = rc.c * TILE_SIZE - cameraX, y = rc.r * TILE_SIZE - cameraY;
    if (rc.revealed && x > -TILE_SIZE && x < CANVAS_W && y > -TILE_SIZE && y < CANVAS_H) {
      const pulse = Math.sin(animTime * 3) * 0.5 + 0.5;
      drawGlow('#7ae8ff', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * (1.2 + pulse * 0.4), 0.55);
      drawSprite('core', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + Math.sin(animTime * 2) * 2, 30);
      if (Math.random() < 0.05)
        particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#bff4ff', speed: 0.6 });
    }
    // Scanners sense the core: in range it shows up, further away an arrow points to it
    const scanRange = toolState.scannerActive ? scannerRange() : 0;
    if (!scanRange) return;
    const dist = Math.abs(rc.r - drillY) + Math.abs(rc.c - drillX);
    if (dist <= scanRange) {
      rc.revealed = true;
      return;
    }
    if (dist > scanRange * 8) return;
    const px = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, py = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    const a = Math.atan2(rc.r - drillY, rc.c - drillX);
    const rr = (scanRange + 0.8) * TILE_SIZE;
    const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr;
    const pulse = 0.5 + Math.sin(animTime * 5) * 0.4;
    drawGlow('#7ae8ff', ax, ay, 34, pulse * 0.8);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(150,240,255,${0.55 + pulse * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-9, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawSprite('core', ax - Math.cos(a) * 34, ay - Math.sin(a) * 34, 24, 0.6 + pulse * 0.4);
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
          if (x < -TILE_SIZE || x > CANVAS_W || y < -TILE_SIZE || y > CANVAS_H) continue;

          if (!ch.revealed) {
            // Hidden: looks like dirt but with faint shimmer
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const shimmer = Math.sin(animTime * 3 + dr + dc) * 0.5 + 0.5;
            drawGlow('#ffd040', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.55, 0.12 + shimmer * 0.18);
          } else {
            // Revealed: golden plate with a pulsing "?"
            const pulse = Math.sin(animTime * 4) * 0.15 + 0.85;
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const pg = ctx.createLinearGradient(0, y + 3, 0, y + TILE_SIZE - 3);
            pg.addColorStop(0, '#ffe680');
            pg.addColorStop(0.5, '#d8a020');
            pg.addColorStop(1, '#8a5a08');
            roundRectPath(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 6);
            ctx.fillStyle = pg;
            ctx.globalAlpha = 0.75 + pulse * 0.25;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 2;
            ctx.strokeStyle = SPRITE_OUTLINE;
            ctx.stroke();
            drawGlow('#ffd040', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.8, 0.25 * pulse);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            fitText('?', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1, TILE_SIZE - 10, 26, { weight: 'bold', color: '#fffbe0', outline: 'rgba(80,40,0,0.9)' });

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
          if (tile === TILE_CORE && Math.abs(r - pr) + Math.abs(c - pc) <= 4)
            relocationCore.revealed = true;
          if (tile === TILE_CHEST && Math.abs(r - pr) + Math.abs(c - pc) <= 4 && chestAt(r, c))
            revealChest(chestAt(r, c), false);
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
     DRAWING -- BOMBS
     ====================================================================== */

  // Bombs lying in the mine (or still flying there) with their burning fuses
  function drawPlacedBombs() {
    const ox = Math.round(cameraX), oy = Math.round(cameraY);
    for (const b of placedBombs) {
      const T = BOMB_TIERS[b.tier];
      const size = 26 + b.tier * 3;
      let x = b.c * TILE_SIZE + TILE_SIZE / 2 - ox;
      let y = b.r * TILE_SIZE + TILE_SIZE / 2 - oy + (b.sticky ? 0 : TILE_SIZE / 2 - size * 0.45);
      let spin = 0;
      if (b.fly) {
        const k = b.fly.t;
        x = b.fly.x - ox + (x - (b.fly.x - ox)) * k;
        y = b.fly.y - oy + (y - (b.fly.y - oy)) * k - Math.sin(k * Math.PI) * 34;
        spin = k * TWO_PI * 1.5;
      }
      if (x < -60 || x > CANVAS_W + 60 || y < -60 || y > CANVAS_H + 60) continue;
      if (!b.fly) {
        const k = Math.max(0, b.fuse / b.maxFuse);
        const blink = Math.sin(animTime * (8 + (1 - k) * 34)) > 0;
        drawGlow(blink ? '#ff4030' : T.color, x, y, 34 + b.tier * 8, blink ? 0.75 : 0.45);
        // Fuse ring empties as the bomb counts down
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.72, 0, TWO_PI);
        ctx.stroke();
        ctx.strokeStyle = k < 0.35 ? '#ff5040' : '#ffd060';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.72, -Math.PI / 2, -Math.PI / 2 + TWO_PI * k);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      drawSprite(T.icon, 0, 0, size);
      ctx.restore();
      if (!b.fly) {
        if (Math.random() < 0.5)
          particles.trail(x + size * 0.25, y - size * 0.45, { vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), color: Math.random() < 0.5 ? '#ffe080' : '#ff7030', life: 0.25, size: 1.5, gravity: 0.03 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(String(Math.max(1, Math.ceil(b.fuse))), x, y - size * 0.72 - 14, 40, 20, { weight: 'bold', color: b.fuse < 1 ? '#ff7060' : '#fff0c0', outline: 'rgba(0,0,0,0.85)' });
      }
    }
  }

  // Bombs arcing from the turret to the battlefield
  function drawSurfaceBombs() {
    for (const s of surfaceBombs) {
      const k = s.t;
      const x = s.x0 + (s.tx - s.x0) * k;
      const y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * (90 + Math.abs(s.tx - s.x0) * 0.25);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * TWO_PI * 2);
      drawSprite(BOMB_TIERS[s.tier].icon, 0, 0, 28 + s.tier * 3);
      ctx.restore();
      if (Math.random() < 0.6)
        particles.trail(x, y, { vx: (Math.random() - 0.5), vy: -0.5, color: '#ffb060', life: 0.3, size: 2 });
      // Where it will land
      ctx.strokeStyle = `rgba(255,140,80,${0.35 + Math.sin(animTime * 12) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.tx, Math.min(DOME_Y + 4, s.ty + 8), 26, 8, 0, 0, TWO_PI);
      ctx.stroke();
    }
  }

  // Fireballs, shock rings and smoke of explosions (in the mine or on the surface)
  function drawBlasts(under) {
    for (const b of blasts) {
      if (b.under !== under) continue;
      const x = under ? b.x - cameraX : b.x, y = under ? b.y - cameraY : b.y;
      if (x < -b.R * 2 || x > CANVAS_W + b.R * 2 || y < -b.R * 2 || y > CANVAS_H + b.R * 2) continue;
      const k = b.t / b.life;
      const ease = 1 - Math.pow(1 - k, 3);
      const color = BOMB_TIERS[b.tier] ? BOMB_TIERS[b.tier].color : '#ffb040';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Fireball
      const fr = b.R * (0.35 + ease * 0.75);
      const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
      g.addColorStop(0, `rgba(255,250,220,${0.95 * (1 - k)})`);
      g.addColorStop(0.35, hexToRgba(color, 0.85 * (1 - k)));
      g.addColorStop(0.75, `rgba(200,70,20,${0.4 * (1 - k)})`);
      g.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, fr, 0, TWO_PI);
      ctx.fill();
      // Shock ring
      ctx.strokeStyle = b.tier === 4 ? `rgba(200,150,255,${0.8 * (1 - k)})` : `rgba(255,230,180,${0.75 * (1 - k)})`;
      ctx.lineWidth = Math.max(1, 9 * (1 - k));
      ctx.beginPath();
      ctx.arc(x, y, b.R * (0.25 + ease), 0, TWO_PI);
      ctx.stroke();
      // Void bombs pull light inwards before they burst
      if (b.tier === 4) {
        ctx.strokeStyle = `rgba(150,90,255,${0.7 * (1 - k)})`;
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; ++i) {
          ctx.beginPath();
          ctx.arc(x, y, b.R * (1.2 - ease) * (0.5 + i * 0.25), 0, TWO_PI);
          ctx.stroke();
        }
      }
      ctx.restore();
      // Smoke left behind
      if (k > 0.3) {
        ctx.fillStyle = `rgba(40,34,30,${0.35 * (1 - k)})`;
        for (let i = 0; i < 6; ++i) {
          const a = i * 1.05 + b.x * 0.01;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * b.R * 0.45 * ease, y + Math.sin(a) * b.R * 0.35 * ease - k * 20, b.R * 0.22 * (0.6 + ease * 0.5), 0, TWO_PI);
          ctx.fill();
        }
      }
      // White flash of the first instant
      if (k < 0.18) {
        ctx.fillStyle = `rgba(255,255,240,${0.6 * (1 - k / 0.18)})`;
        ctx.beginPath();
        ctx.arc(x, y, b.R * 0.5, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  // Aim preview while throw mode is armed
  function drawThrowPreview() {
    if (!bombThrowMode || mouseAimX < 0) return;
    const tier = readyBombTier();
    if (tier < 0) return;
    if (currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mouseAimX + cameraX) / TILE_SIZE);
      const row = Math.floor((mouseAimY + cameraY) / TILE_SIZE);
      const t = throwTarget(col, row);
      const px = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, py = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,190,110,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, (bombThrowRange() + 0.5) * TILE_SIZE, 0, TWO_PI);
      ctx.stroke();
      const tx = col * TILE_SIZE + TILE_SIZE / 2 - cameraX, ty = row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.strokeStyle = t.ok ? 'rgba(140,255,160,0.85)' : 'rgba(255,110,100,0.85)';
      ctx.lineDashOffset = -animTime * 30;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo((px + tx) / 2, Math.min(py, ty) - 40, tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      roundRectPath(col * TILE_SIZE + 3 - cameraX, row * TILE_SIZE + 3 - cameraY, TILE_SIZE - 6, TILE_SIZE - 6, 6);
      ctx.stroke();
      if (t.ok) {
        // Blast radius around the target
        ctx.strokeStyle = 'rgba(255,170,90,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, (bombRadius(tier) + 0.4) * TILE_SIZE, 0, TWO_PI);
        ctx.stroke();
        drawSprite(BOMB_TIERS[tier].icon, tx, ty, 26, 0.7);
      }
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(t.ok ? 'Click to throw' : t.why, tx, ty - TILE_SIZE, 260, 16, { weight: 'bold', color: t.ok ? '#c8ffd0' : '#ffb0a8', outline: 'rgba(0,0,0,0.85)' });
    } else {
      const tx = mouseAimX, ty = Math.min(DOME_Y - 8, mouseAimY);
      const R = 70 + 26 * bombRadius(tier);
      ctx.save();
      ctx.strokeStyle = `rgba(255,150,80,${0.55 + Math.sin(animTime * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -animTime * 30;
      ctx.beginPath();
      ctx.arc(tx, ty, R, 0, TWO_PI);
      ctx.stroke();
      const x0 = DOME_X + Math.cos(turretAngle) * (DOME_RADIUS + 30), y0 = DOME_Y + Math.sin(turretAngle) * (DOME_RADIUS + 30);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + tx) / 2, Math.min(y0, ty) - 90 - Math.abs(tx - x0) * 0.25, tx, ty);
      ctx.stroke();
      ctx.restore();
      drawSprite(BOMB_TIERS[tier].icon, tx, ty, 26, 0.75);
    }
  }

  // Bomb stock (bottom right): one slot per size, craft button and actions
  function bombBarLayout() {
    const w = 336, h = 128, x = CANVAS_W - 16 - w, y = CANVAS_H - 50 - h;
    const slots = BOMB_TIERS.map((T, i) => ({ x: x + 12 + i * 63, y: y + 40, w: 58, h: 50, tier: i }));
    const bw = Math.floor((w - 24 - 12) / 3);
    const under = currentView === VIEW_UNDERGROUND;
    const buttons = [
      { id: 'drop', label: 'Drop', key: 'B', x: x + 12, y: y + 98, w: bw, h: 24, enabled: under },
      { id: 'throw', label: 'Throw', key: under ? 'T' : 'T/B', x: x + 18 + bw, y: y + 98, w: bw, h: 24, enabled: true },
      unlockedTools.remoteDetonator && placedBombs.some(b => !b.fly)
        ? { id: 'detonate', label: 'Detonate', key: 'X', x: x + 24 + bw * 2, y: y + 98, w: bw, h: 24, enabled: true }
        : { id: 'next', label: 'Next', key: 'Q', x: x + 24 + bw * 2, y: y + 98, w: bw, h: 24, enabled: true }
    ];
    return { x, y, w, h, slots, buttons, craft: { x: x + w - 12 - 104, y: y + 9, w: 104, h: 24 } };
  }

  function inRect(mx, my, r) {
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  function hitBombBar(mx, my) {
    if (state !== STATE_PLAYING) return null;
    const L = bombBarLayout();
    if (!inRect(mx, my, L)) return null;
    if (inRect(mx, my, L.craft)) return { kind: 'craft' };
    for (const s of L.slots)
      if (inRect(mx, my, s)) return { kind: 'slot', tier: s.tier };
    for (const b of L.buttons)
      if (inRect(mx, my, b)) return { kind: b.id, enabled: b.enabled };
    return { kind: 'panel' };
  }

  function useBombBar(hit) {
    if (hit.kind === 'craft') openCraftDialog();
    else if (hit.kind === 'slot') {
      bombSel = hit.tier;
      SZ.GameAudio.play('blip', { pitch: 1 + hit.tier * 0.1, volume: 0.6 });
    } else if (hit.kind === 'drop' && hit.enabled) placeBomb();
    else if (hit.kind === 'throw') {
      if (readyBombTier() < 0) return noBombsHint();
      bombThrowMode = !bombThrowMode;
      SZ.GameAudio.play('select', { pitch: bombThrowMode ? 1.2 : 0.8 });
    } else if (hit.kind === 'next') cycleBomb(1);
    else if (hit.kind === 'detonate') remoteDetonate();
  }

  // Small framed button used by the bomb bar and the workshop
  function drawSmallButton(b, label, enabled, hover, color, px) {
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, Math.min(9, b.h / 2));
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (enabled) {
      g.addColorStop(0, hexToRgba(color, hover ? 0.42 : 0.26));
      g.addColorStop(1, hexToRgba(color, hover ? 0.24 : 0.1));
    } else {
      g.addColorStop(0, 'rgba(40,44,60,0.7)');
      g.addColorStop(1, 'rgba(24,26,36,0.7)');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hover && enabled ? 2 : 1;
    ctx.strokeStyle = enabled ? hexToRgba(color, hover ? 1 : 0.7) : 'rgba(120,130,160,0.35)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 12, px || 15, { weight: 'bold', color: enabled ? '#ffffff' : UI.textMute });
    ctx.restore();
  }

  let bombBarHover = null;

  function drawBombBar() {
    const L = bombBarLayout();
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#ff9a40', shadow: 10 });
    drawSprite('bomb', L.x + 24, L.y + 21, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = fitText('Bombs', L.x + 42, L.y + 22, 80, 18, { weight: 'bold', color: UI.text });
    const full = bombCount() >= bombCapacity();
    fitText(`${bombCount()} / ${bombCapacity()}`, L.x + 50 + tw, L.y + 22, L.craft.x - L.x - 58 - tw, 15, { weight: 'bold', color: full ? UI.warn : UI.textDim });
    const hk = bombBarHover && bombBarHover.kind;
    drawSmallButton(L.craft, 'Craft  [C]', true, hk === 'craft', '#ff9a40', 14);
    for (const s of L.slots) {
      const n = bombInv[s.tier];
      const sel = bombSel === s.tier;
      const hover = hk === 'slot' && bombBarHover.tier === s.tier;
      roundRectPath(s.x, s.y, s.w, s.h, 8);
      ctx.fillStyle = sel ? 'rgba(255,190,90,0.2)' : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)');
      ctx.fill();
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeStyle = sel ? UI.gold : 'rgba(255,255,255,0.12)';
      ctx.stroke();
      if (sel && bombThrowMode) {
        ctx.save();
        ctx.shadowColor = '#ff9a40';
        ctx.shadowBlur = 10 + Math.sin(animTime * 8) * 5;
        ctx.stroke();
        ctx.restore();
      }
      drawSprite(BOMB_TIERS[s.tier].icon, s.x + s.w / 2, s.y + 21, 30, n > 0 ? 1 : 0.3);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      fitText(String(n), s.x + s.w - 6, s.y + s.h - 9, s.w - 10, 14, { weight: 'bold', color: n > 0 ? '#ffffff' : UI.textMute, outline: 'rgba(0,0,0,0.8)' });
    }
    for (const b of L.buttons) {
      const active = b.id === 'throw' && bombThrowMode;
      drawSmallButton(b, `${active ? 'Aiming…' : b.label}  [${b.key}]`, b.enabled, hk === b.id || active, b.id === 'throw' || b.id === 'detonate' ? '#ff7a50' : '#8aa8d8', 13);
    }
  }

  /* -- Bomb workshop (crafting and combining) -- */
  function craftLayout() {
    const w = 1080, h = 724, x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
    const rows = BOMB_TIERS.map((T, i) => {
      const ry = y + 112 + i * 104;
      return {
        i, x: x + 24, y: ry, w: w - 48, h: 94,
        craft: { x: x + w - 40 - 250 - 12 - 170, y: ry + 25, w: 170, h: 44 },
        combine: i < BOMB_TIERS.length - 1 ? { x: x + w - 40 - 250, y: ry + 25, w: 250, h: 44 } : null
      };
    });
    return { x, y, w, h, rows, close: { x: x + w - 54, y: y + 12, w: 40, h: 40 } };
  }

  function openCraftDialog() {
    if (state !== STATE_PLAYING) return;
    stateBeforeCraft = state;
    state = STATE_CRAFT;
    craftFocus = Math.max(0, bombSel);
    craftHover = null;
    bombThrowMode = false;
    clearTooltip();
    SZ.GameAudio.play('select');
  }

  function closeCraftDialog() {
    state = stateBeforeCraft || STATE_PLAYING;
    stateBeforeCraft = null;
    craftHover = null;
    SZ.GameAudio.play('click');
    saveRun();
  }

  function hitCraftDialog(mx, my) {
    const L = craftLayout();
    if (inRect(mx, my, L.close)) return { kind: 'close' };
    for (const r of L.rows) {
      if (inRect(mx, my, r.craft)) return { kind: 'craft', row: r.i };
      if (r.combine && inRect(mx, my, r.combine)) return { kind: 'combine', row: r.i };
      if (inRect(mx, my, r)) return { kind: 'row', row: r.i };
    }
    return inRect(mx, my, L) ? { kind: 'panel' } : { kind: 'outside' };
  }

  function handleCraftClick(mx, my) {
    const hit = hitCraftDialog(mx, my);
    if (hit.kind === 'close' || hit.kind === 'outside') {
      closeCraftDialog();
      return;
    }
    if (hit.row !== undefined) {
      craftFocus = hit.row;
      if (hit.kind === 'craft') craftBomb(hit.row);
      else if (hit.kind === 'combine') combineBombs(hit.row);
      else {
        bombSel = hit.row;
        SZ.GameAudio.play('blip', { pitch: 1 + hit.row * 0.1, volume: 0.6 });
      }
    }
  }

  function handleCraftKey(e) {
    const n = BOMB_TIERS.length;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') craftFocus = (craftFocus + n - 1) % n;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') craftFocus = (craftFocus + 1) % n;
    else if (/^Digit[1-5]$/.test(e.code)) craftFocus = parseInt(e.code.slice(5), 10) - 1;
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') craftBomb(craftFocus);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyM') combineBombs(craftFocus);
    else if (e.code === 'Escape' || e.code === 'KeyC') closeCraftDialog();
    else return false;
    bombSel = craftFocus;
    return true;
  }

  function drawCraftDialog() {
    drawScrim(0.66);
    const L = craftLayout();
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#ff9a40', radius: 16, title: '[[bomb]] Bomb Workshop', titlePx: 28, headerH: 64, top: 'rgba(26,30,48,0.98)', bottom: 'rgba(12,14,24,0.98)' });
    const ch = craftHover;
    // Stock and close button
    const full = bombCount() >= bombCapacity();
    drawChip(`Stock ${bombCount()} / ${bombCapacity()}`, L.close.x - 14, L.y + 19, 28, { align: 'right', px: 16, maxW: 220, bg: full ? 'rgba(255,182,72,0.18)' : 'rgba(255,215,90,0.12)', border: full ? UI.warn : 'rgba(255,215,90,0.5)', color: full ? UI.warn : UI.gold });
    drawSmallButton(L.close, '×', true, ch && ch.kind === 'close', '#8aa8d8', 22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Craft bombs from stored ore and combine three of one size into one of the next. Drop or throw them in the mine, lob them at monsters.', L.x + 28, L.y + 88, L.w - 56, 16, { color: UI.textDim });
    for (const r of L.rows) {
      const T = BOMB_TIERS[r.i];
      const focus = craftFocus === r.i;
      const known = recipeKnown(r.i);
      const why = craftBlocker(r.i);
      ctx.save();
      drawNodeFrame(r.x, r.y, r.w, r.h, T.color, known ? (why ? 'poor' : 'ready') : 'locked', ch && ch.row === r.i);
      if (focus || bombSel === r.i) {
        roundRectPath(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 14);
        ctx.lineWidth = focus ? 3 : 1.5;
        ctx.strokeStyle = focus ? UI.gold : 'rgba(255,215,90,0.45)';
        ctx.stroke();
      }
      // Icon well
      const ix = r.x + 12, iy = r.y + 11;
      roundRectPath(ix, iy, 72, 72, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      drawGlow(T.color, ix + 36, iy + 36, 40, 0.35 + Math.sin(animTime * 3 + r.i) * 0.1);
      drawSprite(T.icon, ix + 36, iy + 36, 52, known || bombInv[r.i] > 0 ? 1 : 0.45);
      // Name, numbers and recipe
      const tx = r.x + 100, tw = r.craft.x - 110 - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(T.name, tx, r.y + 22, tw, 22, { weight: 'bold', color: known ? '#ffffff' : '#9aa2b8' });
      fitText(`Radius ${bombRadius(r.i).toFixed(1)} tiles · rock power ${bombPower(r.i).toFixed(1)} · ${Math.round(T.monster * (1 + 0.3 * getEffectiveLevel('bombPower')))} damage to monsters`, tx, r.y + 47, tw, 14, { color: UI.textDim });
      if (known)
        drawCostRow(craftCost(r.i), tx, r.y + 73, Math.min(tw, 300), 15);
      else {
        drawSprite('lock', tx + 9, r.y + 73, 18, 0.8);
        fitText('Recipe locked - buy it in the Tools branch (combining still works)', tx + 24, r.y + 74, tw - 24, 14, { color: UI.warn });
      }
      // Stock
      const sx = r.craft.x - 100;
      roundRectPath(sx, r.y + 18, 86, 58, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.textAlign = 'center';
      fitText('in stock', sx + 43, r.y + 32, 76, 12, { color: UI.textMute });
      fitText(String(bombInv[r.i]), sx + 43, r.y + 57, 76, 26, { weight: 'bold', color: bombInv[r.i] > 0 ? UI.gold : UI.textMute });
      // Buttons
      drawSmallButton(r.craft, known ? 'Craft' : 'Locked', !why, ch && ch.kind === 'craft' && ch.row === r.i, '#5ac87a', 18);
      if (r.combine) {
        const can = bombInv[r.i] >= BOMB_COMBINE;
        drawSmallButton(r.combine, `Combine ${BOMB_COMBINE} [[${T.icon}]] → 1 [[${BOMB_TIERS[r.i + 1].icon}]]`, can, ch && ch.kind === 'combine' && ch.row === r.i, '#ff9a40', 17);
      } else {
        ctx.textAlign = 'center';
        fitText('The biggest bomb there is', r.x + r.w - 40 - 125, r.y + 48, 240, 15, { color: UI.textMute });
      }
      // Craft / combine flash
      const fl = craftFlash[r.i];
      if (fl !== undefined) {
        const t = (performance.now() - fl) / 600;
        if (t >= 1) delete craftFlash[r.i];
        else {
          roundRectPath(r.x, r.y, r.w, r.h, 12);
          ctx.fillStyle = `rgba(255,240,200,${0.3 * (1 - t)})`;
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('In the mine: [B] drops the selected bomb, [T] throws it, [Q] picks the next size  ·  on the surface [B] lobs it at the cursor', CANVAS_W / 2, L.y + L.h - 62, L.w - 60, 15, { color: UI.textDim });
    drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Craft' },
      { key: '→', label: 'Combine' },
      { key: 'Esc', label: 'Close' }
    ], CANVAS_W / 2, L.y + L.h - 26, L.w - 80);
  }

  /* ======================================================================
     DRAWING -- UPGRADE PANEL
     ====================================================================== */

  /* -- Quick upgrade panel: the next node of every tree branch -- */
  const QUICK_PANEL_X = CANVAS_W - 340, QUICK_PANEL_Y = 146, QUICK_PANEL_W = 320;
  const QUICK_HEADER_H = 44, QUICK_ROW_H = 58, QUICK_ROW_GAP = 6;
  let resourceWeights = null;

  // Rarer resources weigh more when ranking which node comes next
  function resourceWeight(key) {
    if (!resourceWeights) {
      resourceWeights = {};
      for (const t in TILE_LABELS)
        resourceWeights[TILE_LABELS[t]] = TILE_VALUES[t] || 10;
    }
    return resourceWeights[key] || 10;
  }

  function currentNodeCost(node) {
    return node.costs[Math.min(getTreeNodeLevel(node.id), node.costs.length - 1)];
  }

  // Per branch: the cheapest node that can be bought now, otherwise the
  // unlocked node that is closest to affordable
  function getQuickPicks() {
    const picks = [];
    for (const branch of TREE_BRANCH_ORDER) {
      let best = null, bestScore = Infinity, buyable = 0, owned = 0, total = 0;
      for (const n of UPGRADE_TREE) {
        if (n.branch !== branch) continue;
        ++total;
        if (isTreeNodeMaxed(n.id)) {
          ++owned;
          continue;
        }
        if (!arePrereqsMet(n)) continue;
        const cost = currentNodeCost(n);
        const afford = canAffordTreeNode(n);
        if (afford) ++buyable;
        let price = 0, missing = 0;
        for (const k in cost) {
          const w = resourceWeight(k);
          price += cost[k] * w;
          missing += Math.max(0, cost[k] - (resources[k] || 0)) * w;
        }
        const score = afford ? price : 1e7 + missing * 10 + price;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      picks.push({ branch, node: best, buyable, owned, total });
    }
    return picks;
  }

  function getQuickPanelLayout() {
    const x = QUICK_PANEL_X, w = QUICK_PANEL_W;
    let y = QUICK_PANEL_Y + QUICK_HEADER_H + 8;
    const rows = getQuickPicks().map(p => {
      const r = Object.assign({ x: x + 10, y, w: w - 20, h: QUICK_ROW_H }, p);
      y += QUICK_ROW_H + QUICK_ROW_GAP;
      return r;
    });
    const button = { x: x + 10, y: y + 2, w: w - 20, h: 36 };
    return { x, y: QUICK_PANEL_Y, w, h: button.y + button.h + 10 - QUICK_PANEL_Y, rows, button };
  }

  function hitQuickPanel(mx, my) {
    if (currentView !== VIEW_SURFACE || state !== STATE_PLAYING) return null;
    const L = getQuickPanelLayout();
    if (mx < L.x || mx > L.x + L.w || my < L.y || my > L.y + L.h) return null;
    for (const r of L.rows)
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h)
        return { kind: 'row', row: r };
    const b = L.button;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
      return { kind: 'tree' };
    return { kind: 'panel' };
  }

  // A row buys its node when affordable; otherwise it opens the tree on that node
  function activateQuickRow(r) {
    if (!r.node) {
      openUpgradeDialog(null, r.branch);
      return;
    }
    if (treeNodeState(r.node) === 'ready') {
      const before = getTreeNodeLevel(r.node.id);
      tryPurchaseTreeNode(r.node);
      if (getTreeNodeLevel(r.node.id) > before)
        quickPanelFlash[r.branch] = performance.now();
    } else
      openUpgradeDialog(r.node.id);
  }

  // Background and border of an upgrade card, shared by the tree and the quick panel
  function drawNodeFrame(x, y, w, h, color, st, highlight) {
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned')
      ctx.fillStyle = hexToRgba(color, 0.26);
    else if (st === 'ready')
      ctx.fillStyle = highlight ? hexToRgba(color, 0.3) : hexToRgba(color, 0.16);
    else if (st === 'poor')
      ctx.fillStyle = highlight ? 'rgba(54,48,38,0.95)' : 'rgba(40,36,30,0.95)';
    else
      ctx.fillStyle = 'rgba(16,18,26,0.95)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = st === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.restore();
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
  }

  function drawQuickRow(r, hover) {
    const color = TREE_BRANCH_COLORS[r.branch];
    const node = r.node;
    const complete = !node && r.owned >= r.total;
    const st = node ? treeNodeState(node) : (complete ? 'owned' : 'locked');
    ctx.save();
    drawNodeFrame(r.x, r.y, r.w, r.h, color, st, hover);
    if (hover) {
      roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.stroke();
    }
    // Icon well
    const ix = r.x + 8, iy = r.y + (r.h - 42) / 2;
    roundRectPath(ix, iy, 42, 42, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(node ? node.icon : 'check', ix + 21, iy + 21, 30, st === 'locked' ? 0.5 : 1);

    const tx = r.x + 60, tw = r.w - 60 - 10;
    // Branch name and progress (top right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tagW = fitText(TREE_BRANCH_LABELS[r.branch], r.x + r.w - 10, r.y + 15, 78, 11, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 9 });
    ctx.textAlign = 'left';
    if (node) {
      const info = getTreeNodeInfo(node);
      const title = info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : '');
      fitText(title, tx, r.y + 16, tw - tagW - 8, 16, { weight: 'bold', color: st === 'locked' ? '#7a8298' : UI.text, minPx: 11 });
      let extraW = 0;
      if (r.buyable > 1) {
        ctx.font = uiFont(12, 'bold');
        extraW = drawChip('+' + (r.buyable - 1), r.x + r.w - 8, r.y + r.h - 28, 20, { align: 'right', px: 12, bg: hexToRgba(color, 0.2), border: hexToRgba(color, 0.6), color: '#fff' }) + 6;
      }
      drawCostRow(currentNodeCost(node), tx, r.y + r.h - 18, tw - extraW, 14);
    } else {
      fitText(complete ? 'Branch complete' : 'Nothing unlocked yet', tx, r.y + 16, tw - tagW - 8, 16, { weight: 'bold', color: complete ? UI.good : UI.textMute });
      fitText(`${r.owned} / ${r.total} upgrades`, tx, r.y + r.h - 18, tw, 14, { color: UI.textDim });
    }
    // Purchase flash
    const flash = quickPanelFlash[r.branch];
    if (flash !== undefined) {
      const t = (performance.now() - flash) / 600;
      if (t >= 1)
        delete quickPanelFlash[r.branch];
      else {
        roundRectPath(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
        roundRectPath(r.x - t * 10, r.y - t * 10, r.w + t * 20, r.h + t * 20, 12 + t * 6);
        ctx.lineWidth = 3 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawUpgradePanel() {
    const L = getQuickPanelLayout();
    let owned = 0;
    for (const r of L.rows)
      owned += r.owned;
    drawPanel(L.x, L.y, L.w, L.h, { title: 'Next upgrades', titleRight: `${owned} / ${UPGRADE_TREE.length}`, titleRightColor: UI.gold, headerH: QUICK_HEADER_H });
    const hover = quickPanelHover;
    for (const r of L.rows)
      drawQuickRow(r, !!(hover && hover.kind === 'row' && hover.row.branch === r.branch));

    // Button that opens the full tree
    const b = L.button;
    const hb = !!(hover && hover.kind === 'tree');
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, 9);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, hb ? 'rgba(255,215,90,0.32)' : 'rgba(255,215,90,0.16)');
    g.addColorStop(1, hb ? 'rgba(160,110,20,0.32)' : 'rgba(120,80,10,0.18)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hb ? 2 : 1;
    ctx.strokeStyle = hb ? UI.gold : 'rgba(255,215,90,0.5)';
    ctx.stroke();
    const kw = drawChip('U', b.x + b.w - 8, b.y + 7, 22, { align: 'right', px: 13, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.25)', color: UI.text });
    drawSprite('gear', b.x + 22, b.y + b.h / 2, 22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Open upgrade tree', b.x + 40, b.y + b.h / 2 + 1, b.w - 40 - kw - 16, 17, { weight: 'bold', color: UI.gold });
    ctx.restore();
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
        fitText(`Best run: ${best.score} points  ·  wave ${best.waves}  ·  ${best.sites || 1} site${(best.sites || 1) > 1 ? 's' : ''}`, CANVAS_W / 2, 420, 660, 18, { color: UI.gold });
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

    if (state === STATE_CONFIRM)
      drawRelocateConfirm();

    if (state === STATE_CRAFT)
      drawCraftDialog();

    if (state === STATE_MINIGAME)
      drawMinigame();

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
      const pw = 640, ph = 460, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
      drawPanel(px, py, pw, ph, { accent: '#ff5050', radius: 16 });
      drawHeadline('DOME DESTROYED', CANVAS_W / 2, py + 78, pw - 60, 60, '#ff7a6a', '#c01818');

      const best = highScores[0];
      const stats = [
        ['Nights survived', String(Math.max(0, waveNumber - 1))],
        ['Sites visited', String(site.index + 1)],
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
        drawChip('New high score!', CANVAS_W / 2 - 90, py + 344, 30, { px: 17, maxW: 180, bg: 'rgba(255,215,90,0.18)', border: UI.gold, color: UI.gold });

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

    // View switches slide the scene the way the keeper travels (down into the mine, up to the dome)
    let slide = 0;
    if (alpha < 1) {
      const goingDown = (transitionTarget || currentView) === VIEW_UNDERGROUND;
      const k = 1 - alpha;
      const eased = k * k * (3 - 2 * k);
      slide = (transitionPhase === 'fade-out' ? -eased : eased) * 90 * (goingDown ? 1 : -1);
      ctx.save();
      ctx.translate(0, slide);
    }

    const treeOpen = state === STATE_UPGRADE_DIALOG;
    if (state === STATE_CINEMATIC && cinematic)
      drawCinematic();
    else if (treeOpen)
      ; // the tree is opaque and drawn below
    else if (currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;

    // Transition overlay: fade through black with a soft wipe band
    if (alpha < 1) {
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const k = 1 - alpha;
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, `rgba(90,180,255,${0.12 * k})`);
      g.addColorStop(0.5, 'rgba(90,180,255,0)');
      g.addColorStop(1, `rgba(255,170,60,${0.12 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (!treeOpen) {
      drawBanner();
      drawHUD();
    }

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
    tooltip.enemy = null;
    tooltip.lines = [];
    tooltip.visible = false;
    tooltip.delayTimer = 0;
    tooltip.anchor = null;
    tooltip.lastHoverKey = '';
  }

  function setTooltip(x, y, lines, hoverKey, anchor) {
    tooltip.enemy = null;
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
    if (tooltip.enemy) {
      if (!enemies.includes(tooltip.enemy) || tooltip.enemy.hidden || currentView !== VIEW_SURFACE) {
        clearTooltip();
        return;
      }
      tooltip.lines = buildEnemyTooltip(tooltip.enemy);
    }

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

    const chest = tile === TILE_CHEST ? chestAt(row, col) : null;
    if (chest && chest.revealed) {
      lines.push('[[chest]] Secret Chest');
      lines.push(`Dig into it to open its ${MINIGAME_NAMES[chest.kind].toLowerCase()} lock`);
      lines.push('Difficulty: ' + ['Easy', 'Fair', 'Tricky', 'Hard', 'Fiendish'][Math.min(4, Math.round(chestDifficulty(chest) * 4))]);
      if (chest.cooldown > 0)
        lines.push(`\u26A0 Jammed for ${Math.ceil(chest.cooldown)} s`);
      return lines;
    }
    if (tile === TILE_CORE && relocationCore.revealed) {
      lines.push('[[core]] Relocation Core');
      lines.push('Mine it to unlock relocating the dome');
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else if (tile === TILE_DIRT || tile === TILE_CORE || tile === TILE_CHEST) {
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
        lines.push('Value: ' + Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(row)) + ' ' + TILE_LABELS[tile]);
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
    const T = enemyType(e);
    const lines = [T.name, T.desc];
    lines.push('HP: ' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxHP));
    if (e.shield > 0)
      lines.push('Shield: ' + Math.ceil(e.shield) + ' / ' + Math.ceil(e.maxShield));
    else if (e.maxShield > 0)
      lines.push('\u2718 Shield broken');
    if (e.armor > 0)
      lines.push('\u26A0 Armor: blocks ' + e.armor + ' damage per hit');
    lines.push('Damage: ' + e.damage + ' per hit');
    if (e.stunTimer > 0)
      lines.push('\u26A0 Stunned: ' + e.stunTimer.toFixed(1) + 's');
    return lines;
  }

  // Build tooltip content for an upgrade tree node (quick: shown on the quick panel)
  function buildUpgradeNodeTooltip(node, quick) {
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
        emerald: 'Emerald', diamond: 'Diamond', ruby: 'Ruby',
        titanium: 'Titanium', sapphire: 'Sapphire', uranium: 'Uranium',
        amethyst: 'Amethyst', opal: 'Fire Opal', voidstone: 'Voidstone'
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

    if (!maxed && arePrereqsMet(node)) {
      if (canAffordTreeNode(node))
        lines.push(quick ? '\u2714 Click to buy' : '\u2714 Click or press Enter to buy');
      else
        lines.push(quick ? '\u26A0 Not enough resources - click to see it in the tree' : '\u26A0 Not enough resources');
    }

    return lines;
  }

  /* ======================================================================
     STATUS BAR
     ====================================================================== */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${currentView}`;
    if (statusWave) statusWave.textContent = isNight() ? `Night ${world.day}: ${enemies.length} monsters` : `Day ${world.day}: night in ${Math.ceil(secondsToNight())}s`;
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
    if (state === STATE_CINEMATIC)
      updateCinematic(dt);
    if (state === STATE_MINIGAME)
      updateMinigame(dt);
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

    if (state === STATE_CINEMATIC && !showTutorial) {
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        skipCinematic();
      }
      return;
    }
    if (state === STATE_CONFIRM) {
      e.preventDefault();
      if (e.code === 'Enter' || e.code === 'KeyY')
        answerRelocation(true);
      else if (e.code === 'Escape' || e.code === 'KeyN')
        answerRelocation(false);
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

    if (state === STATE_CRAFT) {
      if (handleCraftKey(e))
        e.preventDefault();
      return;
    }
    if (state === STATE_MINIGAME) {
      if (minigameKey(e))
        e.preventDefault();
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
      if (state === STATE_PLAYING && bombThrowMode) {
        bombThrowMode = false;
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

      keeperIdle = 0;
      // Dash: Shift + direction rushes through the tunnel
      if ((newDx !== 0 || newDy !== 0) && e.shiftKey && unlockedTools.dash && dashCooldown <= 0) {
        let n = 0;
        const range = 3 + (getEffectiveLevel('dash') - 1);
        while (n < range) {
          const rr = drillY + newDy, cc = drillX + newDx;
          if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS || undergroundGrid[rr][cc] !== TILE_EMPTY) break;
          spawnDust(drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX, drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY);
          drillX = cc;
          drillY = rr;
          ++n;
        }
        if (n > 0) {
          dashCooldown = 2;
          clearMoveTarget();
          pickUpDroppedResources();
          SZ.GameAudio.play('whoosh', { pitch: 1.8, volume: 0.6 });
          newDx = newDy = 0;
        }
      }
      // Double Jump: two tunnel tiles per step upward
      if (newDy === -1 && unlockedTools.doubleJump && !miningTarget && drillY >= 2 && undergroundGrid[drillY - 1][drillX] === TILE_EMPTY && undergroundGrid[drillY - 2][drillX] === TILE_EMPTY) {
        clearMoveTarget();
        drillY -= 1;
      }
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

    // Bombs: drop (mine) or lob at the cursor (surface), throw mode, next size, workshop, remote detonation
    if (e.code === 'KeyB') {
      if (currentView === VIEW_UNDERGROUND)
        placeBomb();
      else if (mouseAimX >= 0 && mouseAimY >= 0 && mouseAimY < DOME_Y)
        lobSurfaceBomb(mouseAimX, mouseAimY);
      else
        lobSurfaceBomb(DOME_X + Math.cos(turretAngle) * 420, DOME_Y + Math.sin(turretAngle) * 420);
    }
    if (e.code === 'KeyT') {
      if (readyBombTier() < 0)
        noBombsHint();
      else
        bombThrowMode = !bombThrowMode;
    }
    if (e.code === 'KeyQ')
      cycleBomb(e.shiftKey ? -1 : 1);
    if (e.code === 'KeyC') {
      openCraftDialog();
      return;
    }
    if (e.code === 'KeyX')
      remoteDetonate();

    if (e.code === 'KeyL' && relocationCore.found)
      requestRelocation();

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
    if (state === STATE_CINEMATIC && !showTutorial) {
      skipCinematic();
      return;
    }
    if (state === STATE_CONFIRM) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * CANVAS_W / rect.width, my = (e.clientY - rect.top) * CANVAS_H / rect.height;
      for (const b of confirmButtons())
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
          answerRelocation(b.id === 'yes');
      return;
    }
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (newGameConfirmOpen)
      return;
    if (state === STATE_CRAFT) {
      const rect = canvas.getBoundingClientRect();
      handleCraftClick((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
      return;
    }
    if (state === STATE_MINIGAME) {
      const rect = canvas.getBoundingClientRect();
      minigameClick((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height, e.button);
      return;
    }
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

    // Bomb stock panel (both views); right click cancels an armed throw
    const bombHit = hitBombBar(mx, my);
    if (bombHit) {
      useBombBar(bombHit);
      return;
    }
    if (bombThrowMode && e.button === 2) {
      bombThrowMode = false;
      return;
    }

    if (currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mx + cameraX) / TILE_SIZE);
      const row = Math.floor((my + cameraY) / TILE_SIZE);
      if (bombThrowMode) {
        throwBombAt(col, row);
        return;
      }
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

      // Surface view: relocate button, meteor ore, the quick upgrade panel, then fire the weapon
      if (hitRelocateButton(mx, my)) {
        requestRelocation();
        return;
      }
      const ore = hitMeteorOre(mx, my);
      if (ore) {
        collectMeteorOre(ore);
        return;
      }
      const qp = hitQuickPanel(mx, my);
      if (qp) {
        if (qp.kind === 'row')
          activateQuickRow(qp.row);
        else if (qp.kind === 'tree')
          openUpgradeDialog();
        return;
      }
      if (bombThrowMode) {
        lobSurfaceBomb(mx, my);
        return;
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
    if (state === STATE_UPGRADE_DIALOG || state === STATE_PLAYING || state === STATE_CRAFT || state === STATE_MINIGAME)
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
    quickPanelHover = null;
    relocateHover = null;
    bombBarHover = null;
    if (state === STATE_CRAFT) {
      craftHover = hitCraftDialog(mouseAimX, mouseAimY);
      return;
    }
    if (state === STATE_MINIGAME) {
      minigameHover(mouseAimX, mouseAimY);
      return;
    }
    if (state === STATE_PLAYING) {
      bombBarHover = hitBombBar(mouseAimX, mouseAimY);
      if (bombBarHover) {
        if (bombBarHover.kind === 'slot') {
          const t = bombBarHover.tier, T = BOMB_TIERS[t];
          setTooltip(mouseAimX, mouseAimY, [`[[${T.icon}]] ${T.name}`, `In stock: ${bombInv[t]}`, `Blast radius ${bombRadius(t).toFixed(1)} tiles, rock power ${bombPower(t).toFixed(1)}`, `Lobbed on the surface: up to ${Math.round(T.monster * (1 + 0.3 * getEffectiveLevel('bombPower')))} damage`, '\u2714 Click to select'], 'bombslot:' + t);
        } else
          clearTooltip();
        return;
      }
    }
    if (state === STATE_CONFIRM) {
      for (const b of confirmButtons())
        if (mouseAimX >= b.x && mouseAimX <= b.x + b.w && mouseAimY >= b.y && mouseAimY <= b.y + b.h)
          relocateHover = b.id;
      return;
    }
    if (hitRelocateButton(mouseAimX, mouseAimY)) {
      relocateHover = 'button';
      setTooltip(mouseAimX, mouseAimY, ['[[flight]] Relocate', 'Pack up the dome and fly to a new site', relocateBlocker() ? '\u26A0 ' + relocateBlocker() : '\u2714 Click or press L'], 'relocate');
      return;
    }

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
        quickPanelHover = hitQuickPanel(mouseAimX, mouseAimY);
        if (quickPanelHover) {
          const r = quickPanelHover.row;
          if (quickPanelHover.kind === 'row' && r.node)
            setTooltip(mouseAimX, mouseAimY, buildUpgradeNodeTooltip(r.node, true), 'quick:' + r.node.id, { x: r.x, y: r.y, w: r.w, h: r.h });
          else
            clearTooltip();
          return;
        }
        // Surface: detect enemy under mouse
        let foundEnemy = false;
        for (const e of enemies) {
          if (e.hidden) continue;
          const sz = e.size || 10;
          const dx = mouseAimX - e.x;
          const dy = mouseAimY - e.y;
          if (dx * dx + dy * dy < (sz + 8) * (sz + 8)) {
            const ttLines = buildEnemyTooltip(e);
            if (tooltip.enemy !== e)
              setTooltip(mouseAimX, mouseAimY, ttLines, 'enemy:' + enemies.indexOf(e) + ':' + e.type);
            else {
              tooltip.x = mouseAimX;
              tooltip.y = mouseAimY;
            }
            tooltip.enemy = e;
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
      : `Dome Keeper -- Day ${world.day} -- Score ${score}`;
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
