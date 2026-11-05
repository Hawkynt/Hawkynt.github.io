/* Things on the board: the tile legend, the fruit kinds, the twelve power-ups with their
   colours, icons and base durations, the critters with their speeds and behaviour flags, and the
   game modes. Pure data; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  /* Tile characters in a level's tile array */
  const T = {
    FLOOR: '.', WALL: '#', CRATE: 'x', ICE: '~', SAND: ':', SPIKE: '^', VENT: '*', GATE: '=',
    P1: '1', P2: '2', P3: '3', P4: '4', ROCK: 'r',
  };
  const PORTAL_PAIR = { 1: '2', 2: '1', 3: '4', 4: '3' };

  /* timed hazards: period in seconds and the active window inside it (with a warning before) */
  const HAZARD_TIMING = {
    '^': { period: 3.2, on: 1.1, warn: 0.7 },
    '*': { period: 4.0, on: 1.0, warn: 0.9 },
    '=': { period: 3.6, on: 1.6, warn: 0.6 },
  };

  const FRUITS = {
    apple: { name: 'Apple', value: 1, grow: 1, color: '#ff4a3a' },
    cherry: { name: 'Cherries', value: 2, grow: 1, color: '#d0103a' },
    pear: { name: 'Pear', value: 1, grow: 1, color: '#b8e04a' },
    plum: { name: 'Plum', value: 2, grow: 1, color: '#8a3ad0' },
    golden: { name: 'Golden Apple', value: 5, grow: 2, color: '#ffd23a' },
    gem: { name: 'Scale Gem', value: 0, grow: 0, color: '#4ae0d0' },
    token: { name: 'Festival Token', value: 1, grow: 0, color: '#ffffff' },
    egg: { name: 'Golden Egg', value: 3, grow: 0, color: '#ffe07a' },
    shard: { name: 'Sun Shard', value: 1, grow: 0, color: '#fff27a' },
    petal: { name: 'Petal', value: 1, grow: 0, color: '#ffb0d0' },
  };
  const COMMON_FRUIT = ['apple', 'apple', 'pear', 'cherry', 'plum'];

  /* Power-ups: base duration in seconds (0 = instant), weight for random drops */
  const POWERUPS = [
    { id: 'dash', name: 'Dash', desc: 'Faster, and every fruit scores x1.5', color: '#ffe23a', icon: 'bolt', dur: 6, weight: 10, zen: false },
    { id: 'warp', name: 'Time Warp', desc: 'The world slows down around you', color: '#6fd3ff', icon: 'clock', dur: 7, weight: 9, zen: true },
    { id: 'shield', name: 'Scale Armor', desc: 'Survive one crash', color: '#5a8aff', icon: 'shield', dur: 0, weight: 9, zen: false },
    { id: 'magnet', name: 'Magnet', desc: 'Fruit slides toward your head', color: '#ff9a3a', icon: 'magnet', dur: 9, weight: 9, zen: true },
    { id: 'ghost', name: 'Phase', desc: 'Pass through your own body and critters', color: '#e8f0ff', icon: 'ghost', dur: 6, weight: 7, zen: true },
    { id: 'molt', name: 'Molt', desc: 'Shed a third of your tail for points', color: '#e05aff', icon: 'molt', dur: 0, weight: 6, zen: true },
    { id: 'golden', name: 'Golden Fangs', desc: 'Double score', color: '#ffc81a', icon: 'fang', dur: 10, weight: 8, zen: true },
    { id: 'frenzy', name: 'Fruit Rain', desc: 'Eight extra fruits for a few seconds', color: '#ff5a8a', icon: 'rain', dur: 0, weight: 7, zen: true },
    { id: 'quake', name: 'Quake', desc: 'Smash crates and critters nearby', color: '#c88a4a', icon: 'quake', dur: 0, weight: 6, zen: false },
    { id: 'frost', name: 'Frost Nova', desc: 'Freeze critters, hazards and guardians', color: '#bff4ff', icon: 'snow', dur: 6, weight: 6, zen: false },
    { id: 'radiant', name: 'Sun Shard', desc: 'Shine: ram guardians, eat critters, break crates', color: '#fff27a', icon: 'sun', dur: 7, weight: 4, zen: false },
    { id: 'venom', name: 'Venom Sac', desc: '+3 venom spits (Space)', color: '#9aff4a', icon: 'drop', dur: 0, weight: 6, zen: false },
  ];
  const POWER_BY_ID = {};
  for (let i = 0; i < POWERUPS.length; ++i) POWER_BY_ID[POWERUPS[i].id] = POWERUPS[i];

  /* Critters: seconds per step; edible = eaten by the head for points; deadly = head contact kills */
  const ENEMIES = {
    ant: { name: 'Ant', desc: 'Wanders about. Snack-sized: eat it.', interval: 0.42, edible: true, deadly: false, score: 25, color: '#c0402a' },
    beetle: { name: 'Beetle', desc: 'Armoured. Marches straight and turns at walls.', interval: 0.36, edible: false, deadly: true, score: 40, color: '#2a6a8a' },
    hornet: { name: 'Hornet', desc: 'Flies diagonally over walls. Stings heads.', interval: 0.28, edible: false, deadly: true, score: 50, color: '#ffc81a', flies: true },
    hedgehog: { name: 'Hedgehog', desc: 'Rolls to the fruit and steals it. Spiky.', interval: 0.4, edible: false, deadly: true, score: 45, color: '#8a6a4a' },
    rival: { name: 'Rival Snake', desc: 'Races you to the fruit. Make it crash into you.', interval: 0.2, edible: false, deadly: true, score: 60, color: '#e88a2a', snake: true },
    wisp: { name: 'Frost Wisp', desc: 'Drifts through walls toward your head.', interval: 0.55, edible: false, deadly: true, score: 50, color: '#bff4ff', flies: true },
    imp: { name: 'Fire Imp', desc: 'Leaves burning footprints behind.', interval: 0.38, edible: false, deadly: true, score: 50, color: '#ff6a2a' },
  };

  const MODES = {
    story: { name: 'Story', desc: 'Five worlds, thirty levels, five guardians', icon: 'book', color: '#7ee07a' },
    arcade: { name: 'Arcade', desc: 'Endless score attack - stages, combos, high scores', icon: 'bolt', color: '#ffd25a' },
    zen: { name: 'Zen', desc: 'No crashes, no clock. Just grow and breathe', icon: 'leaf', color: '#8fe8d0' },
    daily: { name: 'Daily Garden', desc: 'One seeded board a day - two minutes', icon: 'sun', color: '#ffb36a' },
    time: { name: 'Time Attack', desc: 'Ninety seconds. Golden fruit buys time', icon: 'clock', color: '#6fd3ff' },
    rush: { name: 'Guardian Rush', desc: 'Every guardian you freed, back to back', icon: 'crown', color: '#ff7a8a' },
  };

  Object.assign(NS.items, {
    T, PORTAL_PAIR, HAZARD_TIMING, FRUITS, COMMON_FRUIT, POWERUPS, POWER_BY_ID, ENEMIES, MODES
  });
})();
