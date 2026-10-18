/* Constants: view and board geometry, timings, elements, screen states, tile codes, realm tints and
   the Grimoire / robe tables. Owns nothing mutable. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const MAX_DT = 0.05;

  /* the board is centred inside this area of the view; the strip above it
     between the top bar and the board carries the level hint banner, and the
     area stops short of the element bar at the bottom */
  const BOARD_X0 = 170, BOARD_Y0 = 160, BOARD_X1 = 1110, BOARD_Y1 = 636;
  const BOARD_W = BOARD_X1 - BOARD_X0;   // 940
  const BOARD_H = BOARD_Y1 - BOARD_Y0;   // 476
  const BOARD_FRAME = 23;                // the ornate frame around the tiles, in tile units of 64

  const WALK_STEP_TIME = 0.12;   // one tile step of the mage
  const CAST_TIME = 0.35;        // casting pose before the spell lands
  const BURN_STEP_DELAY = 0.06;  // fire/water spread per distance step
  const SLIDE_STEP_TIME = 0.07;  // boulder slide per tile
  const SPELL_TIME = 0.5;        // one spell effect strip
  const HINT_TIME = 2.5;         // solver hint highlight
  const HINT_BANNER_TIME = 4.0;  // level hint banner, then it fades out
  const HINT_BANNER_Y = 140;     // centred in the strip between top bar and board
  const HINT_BANNER_H = 30;
  const PORTAL_ENTER_TIME = 0.7; // the mage shrinking into the portal
  const DAILY_SHARDS = 5;        // arcane shards for the first solve of the daily puzzle
  const PROJECTILE_TIME = 0.22;  // the spell orb's flight from the staff to the target
  const ORB_SIZE = 14;           // the orb's bright core, board pixels across
  const ORB_GLOW_SIZE = 44;      // its cached halo
  const RING_TIME = 0.45;        // one expanding impact ring
  const MAX_RINGS = 24;
  const MOTE_COUNT = 24;         // ambient motes drifting over the board
  const MAX_MOTES = 60;
  const FADE_RATE = 3.5;         // screen-change fade, alpha units per second
  const REALM_BANNER_TIME = 2.6; // the realm-restored banner

  /* ── Elements ── */
  const ELEMENTS = [
    { id: 'fire',  name: 'Fire',  color: '#ff7a3a', key: '1' },
    { id: 'water', name: 'Water', color: '#3ab4ff', key: '2' },
    { id: 'earth', name: 'Earth', color: '#c9a36a', key: '3' },
    { id: 'air',   name: 'Air',   color: '#8fc8ee', key: '4' }
  ];
  const ELEMENT_BY_ID = {};
  for (const el of ELEMENTS)
    ELEMENT_BY_ID[el.id] = el;

  /* the selection chime sits lower for the heavy elements, higher for air */
  const ELEMENT_PITCH = { fire: 1.2, water: 1.0, earth: 0.8, air: 1.4 };

  /* ── States ── */
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';
  const STATE_OUT_OF_MANA = 'OUT_OF_MANA';
  const MENU_SCREENS = ['title', 'realms', 'trials', 'grimoire', 'wardrobe', 'help'];

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  const T = SZ.PuzzleCore.T;
  const DIRS = SZ.PuzzleCore.DIRS;
  /* dust and rock tints per realm for footsteps and debris */
  const REALM_DUST = ['#8a7258', '#7a909a', '#e8eef6', '#d8d0c0', '#6a5a80'];
  const REALM_ROCK = ['#7a5a3a', '#4a6470', '#8a857a', '#cfc8ba', '#4a3a60'];

  const TREE_BRANCHES = {
    arcana: { name: 'Arcana', color: '#c04cff' },
    insight: { name: 'Insight', color: '#3ab4ff' },
    chronos: { name: 'Chronos', color: '#6fe08a' },
    style: { name: 'Style', color: '#ffd23f' }
  };

  const TREE = [
    { id: 'a_well', branch: 'arcana', name: 'Mana Well', desc: '+1 mana in every puzzle', costs: [6], req: [] },
    { id: 'a_deep', branch: 'arcana', name: 'Deep Well', desc: '+1 more mana in every puzzle', costs: [18], req: [['a_well', 1]] },
    { id: 'a_focus', branch: 'arcana', name: 'Focus', desc: 'The first cast of each puzzle is free', costs: [30], req: [['a_deep', 1]] },
    { id: 'i_hint', branch: 'insight', name: 'Seer', desc: '+1 hint per puzzle per level', costs: [5, 12], req: [] },
    { id: 'i_runes', branch: 'insight', name: 'Rune Sight', desc: 'Hidden runes shimmer through walls', costs: [8], req: [['i_hint', 1]] },
    { id: 'i_oracle', branch: 'insight', name: 'Oracle', desc: 'See the par number of casts and the next optimal element', costs: [20], req: [['i_runes', 1]] },
    { id: 'c_undo', branch: 'chronos', name: 'Rewind', desc: '+5 undos per puzzle per level', costs: [4, 10], req: [] },
    { id: 'c_free', branch: 'chronos', name: 'Timeless', desc: 'Unlimited undos', costs: [24], req: [['c_undo', 2]] },
    { id: 's_trail', branch: 'style', name: 'Starlight Steps', desc: 'The mage leaves a sparkle trail', costs: [5], req: [] },
    { id: 's_robes', branch: 'style', name: 'Wardrobe', desc: 'Unlocks the robes Crimson, Emerald and Midnight', costs: [8], req: [] },
    { id: 's_gold', branch: 'style', name: 'Golden Robes', desc: 'Unlocks the Solar and Arcane robes', costs: [20], req: [['s_robes', 1]] },
    { id: 's_finale', branch: 'style', name: 'Grand Entrance', desc: 'Fireworks when you step into the portal', costs: [12], req: [['s_trail', 1]] }
  ];
  const TREE_BY_ID = {};
  for (const node of TREE)
    TREE_BY_ID[node.id] = node;

  const TREE_ROBES = {
    s_robes: ['crimson', 'emerald', 'midnight'],
    s_gold: ['solar', 'arcane']
  };

  /* ── robes ── */
  const ROBES = {
    violet: '#5a4ae0',
    crimson: '#c03a4a',
    emerald: '#2f9a5a',
    midnight: '#26305a',
    solar: '#e0a82a',
    arcane: '#a03ad0'
  };

  /* ── tree layout: branch tabs plus cards by requirement depth ── */

  const TREE_BRANCH_LIST = [];
  for (const branchId in TREE_BRANCHES)
    TREE_BRANCH_LIST.push(Object.assign({ id: branchId }, TREE_BRANCHES[branchId]));

  NS.consts = { T, VIEW_W, VIEW_H, MAX_DT, BOARD_X0, BOARD_Y0, BOARD_W, BOARD_H, BOARD_FRAME, WALK_STEP_TIME,
    CAST_TIME, BURN_STEP_DELAY, SLIDE_STEP_TIME, SPELL_TIME, HINT_TIME, HINT_BANNER_TIME, HINT_BANNER_Y,
    HINT_BANNER_H, PORTAL_ENTER_TIME, DAILY_SHARDS, PROJECTILE_TIME, ORB_SIZE, ORB_GLOW_SIZE, RING_TIME, MAX_RINGS,
    MOTE_COUNT, MAX_MOTES, FADE_RATE, REALM_BANNER_TIME, ELEMENTS, ELEMENT_BY_ID, ELEMENT_PITCH, STATE_PLAYING,
    STATE_PAUSED, STATE_LEVEL_COMPLETE, STATE_OUT_OF_MANA, isMenuState, DIRS, REALM_DUST, REALM_ROCK, ROBES, TREE,
    TREE_BRANCHES, TREE_BY_ID, TREE_ROBES, TREE_BRANCH_LIST };
})();
