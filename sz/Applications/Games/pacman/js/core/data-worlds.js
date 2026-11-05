/* The story campaign as data: the cast, the five worlds of Pac-Land with their palettes,
   backdrops, tile twists, ghost rosters, four mazes and a boss each, and every cinematic script
   (intro, chapter openings, boss entrances, relightings and the ending). Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  const CAST = {
    pac: { name: 'Pac-Man', color: '#ffd23a' },
    pip: { name: 'Pip', color: '#9af4ff' },
    blinky: { name: 'Blinky', color: '#ff3b3b' },
    pinky: { name: 'Pinky', color: '#ffa6e8' },
    inky: { name: 'Inky', color: '#3ae8ff' },
    clyde: { name: 'Clyde', color: '#ffab3a' },
    king: { name: 'The Hollow King', color: '#b98cff' },
  };

  /* Each theme: wall fill, rim, glow, floor, dot colour, sky, accent, wall texture, backdrop, ambience */
  const WORLDS = [
    {
      id: 'neon', name: 'Neon Downtown', short: 'Downtown', lumen: 'the Lumen of Light',
      theme: { wall: '#101a6a', rim: '#3a6bff', glow: '#4a8cff', floor: '#04040e', grid: '#121238', dot: '#ffd8b0',
        skyTop: '#05031a', skyBottom: '#1a0638', accent: '#ff4ad8', tex: 'circuit', backdrop: 'city', ambient: 'rain' },
      features: [], roster: ['blinky', 'pinky', 'inky', 'clyde'],
      levels: [{ seed: 'classic' }, { seed: 11 }, { seed: 23 }, { seed: 37 }],
      boss: 'colossus', mapPos: { x: 200, y: 520 },
    },
    {
      id: 'candy', name: 'Sugarcane Gardens', short: 'Gardens', lumen: 'the Lumen of Sweetness',
      theme: { wall: '#7a1a5a', rim: '#ff7ad0', glow: '#ff9ae0', floor: '#1a0612', grid: '#3a1430', dot: '#fff0a8',
        skyTop: '#ff9ac8', skyBottom: '#ffd8a0', accent: '#7affd8', tex: 'stripes', backdrop: 'candy', ambient: 'sprinkles' },
      features: ['pads', 'taffy'], roster: ['blinky', 'pinky', 'gobbler', 'clyde'],
      levels: [{ seed: 101 }, { seed: 117 }, { seed: 131 }, { seed: 149 }],
      boss: 'gumdrop', mapPos: { x: 420, y: 330 },
    },
    {
      id: 'ice', name: 'Glacier Grid', short: 'Glacier', lumen: 'the Lumen of Stillness',
      theme: { wall: '#0e3a5a', rim: '#9aeaff', glow: '#bff4ff', floor: '#020c16', grid: '#0e2a40', dot: '#e0fbff',
        skyTop: '#02101e', skyBottom: '#0e4060', accent: '#7affc0', tex: 'crystal', backdrop: 'glacier', ambient: 'snow' },
      features: ['ice', 'portals'], roster: ['blinky', 'dasher', 'inky', 'clyde'],
      levels: [{ seed: 211 }, { seed: 223 }, { seed: 239 }, { seed: 251 }],
      boss: 'frostmaw', mapPos: { x: 650, y: 520 },
    },
    {
      id: 'haunt', name: 'Hollow Woods', short: 'Woods', lumen: 'the Lumen of Courage',
      theme: { wall: '#1e1030', rim: '#8a5aff', glow: '#a07aff', floor: '#06040a', grid: '#1a1028', dot: '#d8ffb0',
        skyTop: '#04020a', skyBottom: '#1e1036', accent: '#9aff5a', tex: 'bark', backdrop: 'woods', ambient: 'fireflies' },
      features: ['dark', 'portals'], roster: ['blinky', 'phantom', 'inky', 'pinky'],
      levels: [{ seed: 307 }, { seed: 311 }, { seed: 331 }, { seed: 347 }],
      boss: 'banshee', mapPos: { x: 880, y: 300 },
    },
    {
      id: 'ember', name: 'Ember Core', short: 'Core', lumen: 'the Heart Lumen',
      theme: { wall: '#3a0a04', rim: '#ff6a2a', glow: '#ffa040', floor: '#0e0302', grid: '#2a0a04', dot: '#ffe0a0',
        skyTop: '#120202', skyBottom: '#4a0e04', accent: '#ffd23a', tex: 'magma', backdrop: 'volcano', ambient: 'embers' },
      features: ['vents', 'pads'], roster: ['blinky', 'dasher', 'phantom', 'gobbler'],
      levels: [{ seed: 401 }, { seed: 419 }, { seed: 433 }, { seed: 457 }],
      boss: 'king', mapPos: { x: 1090, y: 500 },
    },
  ];

  /* Bosses: hit points, speed (tiles/s), colour, and the attack patterns they cycle */
  const BOSSES = {
    colossus: { name: 'Crimson Colossus', title: 'Blinky, grown huge on stolen light', hp: 6, speed: 4.2, color: '#ff3b3b', size: 2.6,
      attacks: ['charge', 'minions'], crown: false },
    gumdrop: { name: 'The Gumdrop Queen', title: 'Sovereign of the sticky floors', hp: 8, speed: 4.4, color: '#ff6ad0', size: 2.6,
      attacks: ['puddles', 'charge', 'minions'], crown: true },
    frostmaw: { name: 'Frostmaw', title: 'The jaw that freezes the grid', hp: 9, speed: 4.6, color: '#8af0ff', size: 2.7,
      attacks: ['shards', 'charge', 'minions'], crown: false },
    banshee: { name: 'The Banshee', title: 'Her wail puts out every light', hp: 10, speed: 5, color: '#c09aff', size: 2.6,
      attacks: ['blink', 'shards', 'minions'], crown: false },
    king: { name: 'The Hollow King', title: 'Thief of the five Lumens', hp: 12, speed: 5.2, color: '#b98cff', size: 3,
      attacks: ['charge', 'shards', 'blink', 'puddles', 'minions'], crown: true },
  };

  /* Cinematic scripts: shots of a scene with lines of dialogue; d = seconds */
  const STORY = {
    intro: [
      { scene: 'land', d: 4.5, cap: 'Pac-Land glowed for a thousand years, lit by five Great Lumens.' },
      { scene: 'theft', d: 5, cap: 'Then, one night, the Hollow King swallowed every one of them.' },
      { scene: 'talk', who: 'king', d: 4.5, line: 'Darkness suits my ghosts. Let the maze go cold!' },
      { scene: 'talk', who: 'pip', d: 4.5, line: 'Pac-Man! I am Pip, the last spark of the Lumens. Only a mouth like yours can win them back.' },
      { scene: 'talk', who: 'pac', d: 3.5, line: 'Waka waka. Point me at the pellets.' },
      { scene: 'title', d: 3, cap: 'Five worlds. Twenty mazes. One very hungry hero.' },
    ],
    chapter: [
      [
        { scene: 'card', d: 3.2 },
        { scene: 'talk', who: 'pip', d: 4, line: 'Downtown first. The neon signs are flickering out.' },
        { scene: 'talk', who: 'blinky', d: 3.6, line: 'The King gave me a crown of light. Come and take it, yellow!' },
      ],
      [
        { scene: 'card', d: 3.2 },
        { scene: 'talk', who: 'pip', d: 4, line: 'The Gardens! Mind the arrow pads - they fling you. And the taffy is sticky.' },
        { scene: 'talk', who: 'pinky', d: 3.6, line: 'And watch the Gobblers. They eat YOUR dots.' },
      ],
      [
        { scene: 'card', d: 3.2 },
        { scene: 'talk', who: 'pip', d: 4, line: 'Ice tiles keep you sliding. Portals bend the maze.' },
        { scene: 'talk', who: 'inky', d: 3.6, line: 'Our Dashers love long straight halls. Stay off their line.' },
      ],
      [
        { scene: 'card', d: 3.2 },
        { scene: 'talk', who: 'pip', d: 4, line: 'It is dark in the Woods. Keep close to me - I am your light.' },
        { scene: 'talk', who: 'clyde', d: 3.6, line: 'Phantoms float through the walls here. Boo.' },
      ],
      [
        { scene: 'card', d: 3.2 },
        { scene: 'talk', who: 'pip', d: 4, line: 'The Ember Core. The King waits at the heart of it.' },
        { scene: 'talk', who: 'king', d: 3.6, line: 'Four Lumens back? Cute. The last one is mine forever.' },
      ],
    ],
    boss: [
      { scene: 'bossrise', d: 3.6 },
    ],
    relight: [
      { scene: 'relight', d: 4 },
      { scene: 'talk', who: 'pip', d: 3.6, line: 'You did it! The Lumen is lit again - I can feel it.' },
    ],
    ending: [
      { scene: 'relight', d: 4, cap: 'The Heart Lumen burst from the Hollow King like a sunrise.' },
      { scene: 'talk', who: 'king', d: 4, line: 'So... bright... I only wanted to be warm.' },
      { scene: 'talk', who: 'pip', d: 4.2, line: 'Then stay. Light is better shared than swallowed.' },
      { scene: 'land', d: 4.5, cap: 'Pac-Land glows again - ghosts and all.' },
      { scene: 'credits', d: 8 },
    ],
  };

  Object.assign(NS.worlds, {
    CAST, WORLDS, BOSSES, STORY, LEVELS_PER_WORLD: 4
  });
})();
