/* The five worlds of the campaign and the board themes: palettes the tile and backdrop art
   paint from, the hazards and critters each world brings, the six level recipes per world
   (layout motif, fruit goal, step speed, critters, hazards, crates, portals) and the guardian
   boss that closes it. Pure data; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  /* Board themes: the five worlds, then two arcade extras */
  const THEMES = [
    { id: 'meadow', name: 'Clover Meadow', floorA: '#4f8f3a', floorB: '#57993f', line: 'rgba(20,50,10,0.18)',
      wall: '#3d6b2a', wallTop: '#6fae4c', wallDark: '#1f3d16', crate: '#9a6a3a', accent: '#b8f070',
      skyTop: '#7cc8f0', skyBot: '#cdeec0', haze: '#e8ffd8', ground: '#2d5a22', deco: 'flowers', note: 262 },
    { id: 'desert', name: 'Sunscale Dunes', floorA: '#d8b06a', floorB: '#ddb874', line: 'rgba(90,60,20,0.16)',
      wall: '#a8743c', wallTop: '#e0a860', wallDark: '#5a3a18', crate: '#8a5a2a', accent: '#ffd27a',
      skyTop: '#f0a050', skyBot: '#ffe0a0', haze: '#fff0c8', ground: '#b88848', deco: 'dunes', note: 294 },
    { id: 'glacier', name: 'Hoarfrost Lake', floorA: '#bcd8ec', floorB: '#c6e0f2', line: 'rgba(40,80,120,0.15)',
      wall: '#6c98c0', wallTop: '#d8f0ff', wallDark: '#2c4a6c', crate: '#7aa8cc', accent: '#a8e8ff',
      skyTop: '#2a4a7a', skyBot: '#9cc4e8', haze: '#e8f6ff', ground: '#7aa0c8', deco: 'ice', note: 330 },
    { id: 'volcano', name: 'Cinder Depths', floorA: '#3a2a26', floorB: '#42302a', line: 'rgba(255,120,40,0.08)',
      wall: '#5a3a30', wallTop: '#8a5a44', wallDark: '#1a0e0a', crate: '#6a3a24', accent: '#ff8a3a',
      skyTop: '#1a0606', skyBot: '#6a1a0a', haze: '#ff9a50', ground: '#2a1410', deco: 'lava', note: 220 },
    { id: 'neon', name: 'Eclipse Grid', floorA: '#141030', floorB: '#181438', line: 'rgba(120,90,255,0.2)',
      wall: '#3a2a7a', wallTop: '#8a6aff', wallDark: '#0a0820', crate: '#5a3aa0', accent: '#c08cff',
      skyTop: '#05030f', skyBot: '#2a1050', haze: '#c08cff', ground: '#0c0a20', deco: 'neon', note: 196 },
    { id: 'nokia', name: 'Pocket LCD', floorA: '#9bbc0f', floorB: '#9bbc0f', line: 'rgba(15,56,15,0.1)',
      wall: '#306230', wallTop: '#4a7a30', wallDark: '#0f380f', crate: '#306230', accent: '#0f380f',
      skyTop: '#8bac0f', skyBot: '#9bbc0f', haze: '#cadc9f', ground: '#306230', deco: 'lcd', note: 247 },
    { id: 'tron', name: 'Light Cycle', floorA: '#050510', floorB: '#070716', line: 'rgba(0,140,255,0.22)',
      wall: '#0a2a4a', wallTop: '#00e5ff', wallDark: '#020208', crate: '#004a6a', accent: '#00e5ff',
      skyTop: '#000004', skyBot: '#04102a', haze: '#00e5ff', ground: '#020210', deco: 'tron', note: 175 },
  ];

  /* Level recipes: motif, fruit goal, seconds per step, critters, hazards, crates, portal pairs */
  const WORLDS = [
    {
      id: 'meadow', theme: 0, name: 'Clover Meadow', guardian: 'Grubbin the Mole King', boss: 'mole', color: '#8ee05a',
      tagline: 'Where the clover grows and something digs below.',
      levels: [
        { name: 'First Shoots', motif: 'open', goal: 10, speed: 0.17, enemies: ['ant'], hazards: {}, crates: 2, portals: 0 },
        { name: 'Hedge Rows', motif: 'rows', goal: 12, speed: 0.165, enemies: ['ant', 'ant'], hazards: {}, crates: 4, portals: 0 },
        { name: 'Beetle Patch', motif: 'pillars', goal: 14, speed: 0.16, enemies: ['beetle', 'ant'], hazards: {}, crates: 4, portals: 0 },
        { name: 'The Old Well', motif: 'rings', goal: 15, speed: 0.155, enemies: ['beetle', 'hedgehog'], hazards: {}, crates: 5, portals: 1 },
        { name: 'Bramble Maze', motif: 'maze', goal: 16, speed: 0.155, enemies: ['hedgehog', 'ant', 'beetle'], hazards: {}, crates: 3, portals: 0 },
        { name: 'Molehill Throne', motif: 'arena', goal: 0, speed: 0.155, enemies: [], hazards: {}, crates: 0, portals: 0, boss: 'mole' },
      ],
    },
    {
      id: 'desert', theme: 1, name: 'Sunscale Dunes', guardian: 'Sekhet the Scorpion Queen', boss: 'scorpion', color: '#ffc860',
      tagline: 'Quicksand, buried spikes and a queen with a sting.',
      levels: [
        { name: 'Hot Sand', motif: 'open', goal: 12, speed: 0.155, enemies: ['beetle'], hazards: { sand: 10 }, crates: 3, portals: 0 },
        { name: 'Spike Gallery', motif: 'rows', goal: 14, speed: 0.15, enemies: ['ant', 'hornet'], hazards: { spike: 8, sand: 6 }, crates: 3, portals: 0 },
        { name: 'Sunken Temple', motif: 'cross', goal: 15, speed: 0.15, enemies: ['beetle', 'hornet'], hazards: { spike: 10 }, crates: 4, portals: 1 },
        { name: 'Rival Tracks', motif: 'pillars', goal: 16, speed: 0.145, enemies: ['rival', 'ant'], hazards: { sand: 10 }, crates: 3, portals: 0 },
        { name: 'Pharaoh Halls', motif: 'rooms', goal: 18, speed: 0.145, enemies: ['hornet', 'rival', 'beetle'], hazards: { spike: 10, sand: 6 }, crates: 4, portals: 1 },
        { name: 'Queen of Stings', motif: 'arena', goal: 0, speed: 0.15, enemies: [], hazards: {}, crates: 0, portals: 0, boss: 'scorpion' },
      ],
    },
    {
      id: 'glacier', theme: 2, name: 'Hoarfrost Lake', guardian: 'Hoarfrost the Owl', boss: 'owl', color: '#a8e8ff',
      tagline: 'Slide across the ice - you cannot turn on it.',
      levels: [
        { name: 'Thin Ice', motif: 'open', goal: 12, speed: 0.15, enemies: ['wisp'], hazards: { ice: 30 }, crates: 3, portals: 0 },
        { name: 'Frozen Pillars', motif: 'pillars', goal: 14, speed: 0.145, enemies: ['hedgehog', 'wisp'], hazards: { ice: 34 }, crates: 3, portals: 0 },
        { name: 'Snowdrift', motif: 'zigzag', goal: 16, speed: 0.145, enemies: ['rival', 'wisp'], hazards: { ice: 30 }, crates: 4, portals: 1 },
        { name: 'Crystal Cave', motif: 'rings', goal: 16, speed: 0.14, enemies: ['wisp', 'hedgehog', 'ant'], hazards: { ice: 36, spike: 6 }, crates: 4, portals: 1 },
        { name: 'Blizzard Run', motif: 'maze', goal: 18, speed: 0.14, enemies: ['wisp', 'wisp', 'rival'], hazards: { ice: 26 }, crates: 3, portals: 0 },
        { name: 'The Owl Aerie', motif: 'arena', goal: 0, speed: 0.15, enemies: [], hazards: { ice: 16 }, crates: 0, portals: 0, boss: 'owl' },
      ],
    },
    {
      id: 'volcano', theme: 3, name: 'Cinder Depths', guardian: 'Cindrax the Magma Wyrm', boss: 'wyrm', color: '#ff8a3a',
      tagline: 'Lava vents erupt in rhythm. Imps leave fire behind.',
      levels: [
        { name: 'Warm Welcome', motif: 'open', goal: 14, speed: 0.14, enemies: ['imp'], hazards: { vent: 8 }, crates: 4, portals: 0 },
        { name: 'Ember Rows', motif: 'rows', goal: 15, speed: 0.14, enemies: ['imp', 'beetle'], hazards: { vent: 10, spike: 4 }, crates: 4, portals: 1 },
        { name: 'Obsidian Cross', motif: 'cross', goal: 16, speed: 0.135, enemies: ['hornet', 'imp'], hazards: { vent: 12 }, crates: 4, portals: 1 },
        { name: 'Magma Rooms', motif: 'rooms', goal: 18, speed: 0.135, enemies: ['imp', 'rival', 'hornet'], hazards: { vent: 12, sand: 6 }, crates: 4, portals: 1 },
        { name: 'Firefall', motif: 'zigzag', goal: 18, speed: 0.13, enemies: ['imp', 'imp', 'beetle'], hazards: { vent: 14 }, crates: 3, portals: 1 },
        { name: 'Heart of Cinder', motif: 'arena', goal: 0, speed: 0.14, enemies: [], hazards: { vent: 6 }, crates: 0, portals: 0, boss: 'wyrm' },
      ],
    },
    {
      id: 'neon', theme: 4, name: 'Eclipse Grid', guardian: 'The Hollow Eclipse', boss: 'eclipse', color: '#c08cff',
      tagline: 'Laser gates, portals and the shadow at the end of the light.',
      levels: [
        { name: 'Boot Sequence', motif: 'open', goal: 15, speed: 0.135, enemies: ['wisp', 'ant'], hazards: { gate: 6 }, crates: 3, portals: 2 },
        { name: 'Packet Storm', motif: 'pillars', goal: 16, speed: 0.13, enemies: ['hornet', 'hornet', 'rival'], hazards: { gate: 8 }, crates: 3, portals: 2 },
        { name: 'Firewall', motif: 'rows', goal: 18, speed: 0.13, enemies: ['rival', 'wisp', 'imp'], hazards: { gate: 8, spike: 6 }, crates: 4, portals: 2 },
        { name: 'Recursion', motif: 'maze', goal: 18, speed: 0.125, enemies: ['rival', 'rival', 'wisp'], hazards: { gate: 6 }, crates: 3, portals: 2 },
        { name: 'Event Horizon', motif: 'rings', goal: 20, speed: 0.125, enemies: ['hornet', 'imp', 'rival', 'hedgehog'], hazards: { gate: 8, vent: 6 }, crates: 4, portals: 2 },
        { name: 'The Hollow Core', motif: 'arena', goal: 0, speed: 0.13, enemies: [], hazards: {}, crates: 0, portals: 0, boss: 'eclipse' },
      ],
    },
  ];

  /* Guardian bosses: hit points, footprint, step speed, colours */
  const BOSSES = {
    mole: { name: 'Grubbin the Mole King', title: 'Guardian of the Meadow', hp: 4, size: 2, color: '#8a5a3a', accent: '#ffd25a', world: 0 },
    scorpion: { name: 'Sekhet the Scorpion Queen', title: 'Guardian of the Dunes', hp: 5, size: 2, color: '#c0502a', accent: '#ffcf6a', world: 1 },
    owl: { name: 'Hoarfrost the Owl', title: 'Guardian of the Lake', hp: 5, size: 2, color: '#d8ecff', accent: '#6fd3ff', world: 2 },
    wyrm: { name: 'Cindrax the Magma Wyrm', title: 'Guardian of the Depths', hp: 6, size: 1, color: '#ff6a2a', accent: '#ffe07a', world: 3 },
    eclipse: { name: 'The Hollow Eclipse', title: 'Devourer of Seeds', hp: 8, size: 2, color: '#2a1a4a', accent: '#c08cff', world: 4 },
  };
  const BOSS_ORDER = ['mole', 'scorpion', 'owl', 'wyrm', 'eclipse'];

  const LEVELS_PER_WORLD = 6;

  Object.assign(NS.worlds, {
    THEMES, WORLDS, BOSSES, BOSS_ORDER, LEVELS_PER_WORLD
  });
})();
