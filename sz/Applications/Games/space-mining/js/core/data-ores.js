/* Static world data: the ten ores (value, rarity, colours, research yield, the bar they refine
   into) and the five belts with their ore mix, hazards, pirate pressure, licence and the colour
   theme every backdrop, rock and HUD tint is painted from. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* value: credits per unit at a neutral market; rarity 0..5; rd: research data per unit */
  const ORES = [
    { id: 'iron', name: 'Iron', sym: 'Fe', bar: 'Iron Ingot', value: 8, rarity: 0, rd: 0, color: '#b9b2aa', glow: '#efe6dc', dark: '#5a5048' },
    { id: 'ice', name: 'Water Ice', sym: 'H2O', bar: 'Fuel Cell', value: 7, rarity: 0, rd: 0, color: '#9fdcff', glow: '#e4f8ff', dark: '#3a6a8a' },
    { id: 'copper', name: 'Copper', sym: 'Cu', bar: 'Copper Wire', value: 14, rarity: 1, rd: 0, color: '#e07a3a', glow: '#ffb070', dark: '#6a3214' },
    { id: 'silver', name: 'Silver', sym: 'Ag', bar: 'Silver Bar', value: 26, rarity: 1, rd: 0, color: '#d4dee8', glow: '#ffffff', dark: '#5a6672' },
    { id: 'gold', name: 'Gold', sym: 'Au', bar: 'Gold Bar', value: 44, rarity: 2, rd: 0.05, color: '#ffc83a', glow: '#fff09a', dark: '#7a5a08' },
    { id: 'cobalt', name: 'Cobalt', sym: 'Co', bar: 'Cobalt Alloy', value: 60, rarity: 2, rd: 0.06, color: '#3a7aff', glow: '#9ac4ff', dark: '#142a6a' },
    { id: 'uranium', name: 'Uranium', sym: 'U', bar: 'Fuel Rod', value: 85, rarity: 3, rd: 0.1, color: '#7cff4a', glow: '#d4ffb4', dark: '#1e5a10', hot: true },
    { id: 'platinum', name: 'Platinum', sym: 'Pt', bar: 'Platinum Bar', value: 120, rarity: 3, rd: 0.12, color: '#e6eeff', glow: '#cfe4ff', dark: '#6a7488' },
    { id: 'iridium', name: 'Iridium', sym: 'Ir', bar: 'Iridium Plate', value: 170, rarity: 4, rd: 0.2, color: '#ff5a8c', glow: '#ffb8d0', dark: '#6a1432' },
    { id: 'voidCrystal', name: 'Void Crystal', sym: 'Vc', bar: 'Void Lens', value: 300, rarity: 5, rd: 0.5, color: '#b46aff', glow: '#ecd0ff', dark: '#3a1464', crystal: true },
  ];

  const ORE_BY_ID = {};
  for (let i = 0; i < ORES.length; ++i) {
    ORES[i].index = i;
    ORE_BY_ID[ORES[i].id] = ORES[i];
  }

  /* hazards: volatile rocks, radiation fields, solar storms, pirates, gravity wells
     unlock: lifetime credits earned before the licence can be bought, and its fee */
  const ZONES = [
    {
      id: 'kessler', name: 'Kessler Drift', sub: 'The home belt', danger: 1, hardness: 1,
      ores: { iron: 6, ice: 4, copper: 3, silver: 0.8 },
      hazards: { volatile: 0.03 }, pirates: 0, density: 1,
      unlock: { earned: 0, fee: 0 },
      blurb: 'Grey rubble around the station. Iron, ice and copper - a place to learn the trade.',
      theme: {
        base: '#03060d', neb: ['#0a1428', '#1a3050', '#3a6a8a', '#9ad0e8'], neb2: ['#140a24', '#3a2a5a'],
        star: '#dfe8ff', accent: '#8ac8ff', dust: '#a0b4d0', tint: '#4fa8ff',
        rock: ['#8a8680', '#56524e', '#26242a'],
        planet: { x: 0.8, y: 0.3, r: 300, a: '#3a6a9a', b: '#0a1830', c: '#a8d8f0', atmo: '#7ac8ff', bands: 0.4 },
        moon: { x: 0.62, y: 0.16, r: 34, a: '#9a9aa0', b: '#2a2a30' },
      },
    },
    {
      id: 'amber', name: 'Amber Reach', sub: 'Dust of a dead sun', danger: 2, hardness: 1.25,
      ores: { copper: 4, silver: 3.5, gold: 2.5, iron: 2, ice: 1 },
      hazards: { volatile: 0.06, storm: 1 }, pirates: 0.25, density: 1.05,
      unlock: { earned: 2500, fee: 1500 },
      blurb: 'Copper-rich dust lanes under a ringed giant. Solar storms sweep through the reach.',
      theme: {
        base: '#0a0603', neb: ['#2a1206', '#6a3410', '#c8701e', '#ffd08a'], neb2: ['#2a0a06', '#7a2a10'],
        star: '#fff0d8', accent: '#ffb060', dust: '#e0b080', tint: '#ffa040',
        rock: ['#9a7656', '#5e4430', '#2a1c14'],
        planet: { x: 0.22, y: 0.32, r: 360, a: '#c8843a', b: '#3a1a08', c: '#ffd08a', atmo: '#ffb060', bands: 1, ring: true },
        sun: { x: 0.9, y: 0.12, r: 160, a: '#ffffff', b: '#ffd890', c: '#ff8a30' },
      },
    },
    {
      id: 'verdant', name: 'Verdant Shoals', sub: 'A glowing graveyard', danger: 3, hardness: 1.6,
      ores: { cobalt: 3.5, gold: 2.5, uranium: 2.2, silver: 2, iron: 1 },
      hazards: { volatile: 0.07, radiation: 4 }, pirates: 0.55, density: 1.1,
      unlock: { earned: 14000, fee: 8000 },
      blurb: 'Radioactive shoals in a green nebula. Uranium burns bright here - and pirates know it.',
      theme: {
        base: '#020a06', neb: ['#06200f', '#0e4a24', '#2a9a4a', '#b4ffb0'], neb2: ['#06182a', '#0a4a5a'],
        star: '#e0ffe8', accent: '#7cff9a', dust: '#a0e0b0', tint: '#5cff8a',
        rock: ['#6a7a68', '#3a4a3c', '#16201a'],
        planet: { x: 0.78, y: 0.7, r: 250, a: '#2a7a5a', b: '#04140c', c: '#a0ffd0', atmo: '#5cffaa', bands: 0.6 },
        moon: { x: 0.2, y: 0.22, r: 46, a: '#7a8a70', b: '#1a2418' },
      },
    },
    {
      id: 'crimson', name: 'Crimson Maw', sub: 'Around the hungry dark', danger: 4, hardness: 2.1,
      ores: { platinum: 3, cobalt: 2, uranium: 1.6, iridium: 1.5, gold: 1.4 },
      hazards: { volatile: 0.09, gravity: 3, storm: 0.7 }, pirates: 0.8, density: 1.15,
      unlock: { earned: 50000, fee: 26000 },
      blurb: 'Platinum and iridium circling a black hole. Gravity wells drag ships and ore alike.',
      theme: {
        base: '#0a0204', neb: ['#280610', '#601022', '#c02a3a', '#ffb0a0'], neb2: ['#200414', '#5a0a3a'],
        star: '#ffe0e0', accent: '#ff6a6a', dust: '#e08a8a', tint: '#ff4a5a',
        rock: ['#7a5a5a', '#4a3034', '#1e1014'],
        hole: { x: 0.74, y: 0.38, r: 200 },
        planet: { x: 0.14, y: 0.78, r: 200, a: '#8a2a2a', b: '#1a0406', c: '#ff9a7a', atmo: '#ff6a5a', bands: 0.8 },
      },
    },
    {
      id: 'void', name: 'Void Crown', sub: 'Where the crystal sings', danger: 5, hardness: 2.8,
      ores: { iridium: 2.6, platinum: 2.2, voidCrystal: 1.2, uranium: 1, cobalt: 1 },
      hazards: { volatile: 0.1, radiation: 2, gravity: 2, storm: 1 }, pirates: 1, density: 1.2,
      unlock: { earned: 140000, fee: 70000 },
      blurb: 'The edge of the charted dark. Void crystals - and at its heart, the Crown itself.',
      theme: {
        base: '#06030c', neb: ['#14082a', '#3a1462', '#8a3ad0', '#f0c8ff'], neb2: ['#060a2a', '#1a2a7a'],
        star: '#f0e4ff', accent: '#c88aff', dust: '#c0a0f0', tint: '#b46aff',
        rock: ['#6a607a', '#3c344c', '#18141f'],
        planet: { x: 0.5, y: 0.2, r: 180, a: '#4a2a8a', b: '#0a0420', c: '#e0b0ff', atmo: '#b46aff', bands: 0.9, ring: true },
        sun: { x: 0.08, y: 0.1, r: 120, a: '#ffffff', b: '#e0c8ff', c: '#7a3aff' },
      },
    },
  ];

  const ZONE_BY_ID = {};
  for (let i = 0; i < ZONES.length; ++i) {
    ZONES[i].index = i;
    ZONE_BY_ID[ZONES[i].id] = ZONES[i];
  }

  Object.assign(NS.ores, {
    ORES, ORE_BY_ID, ZONES, ZONE_BY_ID
  });
})();
