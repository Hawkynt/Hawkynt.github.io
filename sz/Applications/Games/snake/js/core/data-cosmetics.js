/* The collection: snake skins (colours and a body pattern), trails, hats and board themes for
   the free modes, each with how it is unlocked - bought with scales, earned through stars,
   guardians or achievements, a seasonal festival track, or carried over from the old game.
   Pure data; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  /* a: main, b: second (pattern), c: belly/highlight, eye: iris */
  const SKINS = [
    { id: 'garden', name: 'Garden', a: '#4fc04a', b: '#2e8b3e', c: '#c8f08a', eye: '#ffe23a', pattern: 'bands', unlock: { free: true } },
    { id: 'coral', name: 'Coral', a: '#ff7a5a', b: '#ffd0a0', c: '#ffe8d0', eye: '#2a1a1a', pattern: 'bands', unlock: { cost: 150 } },
    { id: 'python', name: 'Python', a: '#a08a4a', b: '#4a3a1a', c: '#e8d8a0', eye: '#ffb02a', pattern: 'spots', unlock: { cost: 200 } },
    { id: 'viper', name: 'Viper', a: '#3aff7a', b: '#0a6a2a', c: '#d0ffd0', eye: '#ff2a2a', pattern: 'diamond', unlock: { cost: 250 } },
    { id: 'zebra', name: 'Zebra', a: '#f4f4f4', b: '#1a1a1a', c: '#ffffff', eye: '#3a8aff', pattern: 'stripes', unlock: { cost: 300 } },
    { id: 'royal', name: 'Royal', a: '#ffd23a', b: '#b8860b', c: '#fff6c0', eye: '#8a1a1a', pattern: 'diamond', unlock: { stars: 45 } },
    { id: 'candy', name: 'Candy', a: '#ff8ad0', b: '#ffffff', c: '#ffe0f4', eye: '#5a1a4a', pattern: 'stripes', unlock: { cost: 350 } },
    { id: 'galaxy', name: 'Galaxy', a: '#2a1a6a', b: '#c08cff', c: '#ffffff', eye: '#6fd3ff', pattern: 'galaxy', unlock: { cost: 600 } },
    { id: 'ember', name: 'Ember', a: '#ff6d00', b: '#4e342e', c: '#ffd600', eye: '#fff2a0', pattern: 'ember', unlock: { boss: 'wyrm' } },
    { id: 'frostbite', name: 'Frostbite', a: '#bff4ff', b: '#4a8ac0', c: '#ffffff', eye: '#1a3a6a', pattern: 'diamond', unlock: { boss: 'owl' } },
    { id: 'tron', name: 'Light Cycle', a: '#00e5ff', b: '#003a4a', c: '#e0ffff', eye: '#ffffff', pattern: 'neon', unlock: { cost: 450 } },
    { id: 'nokia', name: 'Pocket LCD', a: '#0f380f', b: '#306230', c: '#8bac0f', eye: '#9bbc0f', pattern: 'pixel', unlock: { ach: 'oldschool' } },
    { id: 'rainbow', name: 'Rainbow', a: '#ff4a4a', b: '#4a8aff', c: '#ffffff', eye: '#1a1a1a', pattern: 'rainbow', unlock: { ach: 'combo25' } },
    { id: 'shadow', name: 'Hollow Shadow', a: '#1a1030', b: '#c08cff', c: '#4a2a8a', eye: '#ffffff', pattern: 'galaxy', unlock: { boss: 'eclipse' } },
    { id: 'snowdrop', name: 'Snowdrop', a: '#ffffff', b: '#a8d8ff', c: '#e8f6ff', eye: '#2a6aaa', pattern: 'spots', unlock: { event: 'frost', tier: 2 } },
    { id: 'blossom', name: 'Blossom', a: '#ffb0d0', b: '#7ac05a', c: '#fff0f6', eye: '#4a1a3a', pattern: 'spots', unlock: { event: 'bloom', tier: 2 } },
    { id: 'reef', name: 'Reef', a: '#2ad0c0', b: '#ff8a3a', c: '#e0fff8', eye: '#1a1a3a', pattern: 'bands', unlock: { event: 'sunfest', tier: 2 } },
    { id: 'maple', name: 'Maple', a: '#d8602a', b: '#8a2a1a', c: '#ffd08a', eye: '#2a1a0a', pattern: 'diamond', unlock: { event: 'harvest', tier: 2 } },
    { id: 'pumpkin', name: 'Jack', a: '#ff8a1a', b: '#2a1a0a', c: '#ffd04a', eye: '#ffe23a', pattern: 'stripes', unlock: { event: 'hollow', tier: 2 } },
    { id: 'firework', name: 'Firework', a: '#2a2a6a', b: '#ffd23a', c: '#ff5a8a', eye: '#ffffff', pattern: 'galaxy', unlock: { event: 'starfall', tier: 2 } },
  ];

  const TRAILS = [
    { id: 'none', name: 'No Trail', color: '#ffffff', kind: 'none', unlock: { free: true } },
    { id: 'sparkle', name: 'Sparkles', color: '#fff6b0', kind: 'sparkle', unlock: { cost: 120 } },
    { id: 'leaves', name: 'Clover', color: '#7ee07a', kind: 'leaf', unlock: { stars: 15 } },
    { id: 'embers', name: 'Embers', color: '#ff8a3a', kind: 'ember', unlock: { cost: 220 } },
    { id: 'bubbles', name: 'Bubbles', color: '#8fe8ff', kind: 'bubble', unlock: { cost: 180 } },
    { id: 'hearts', name: 'Hearts', color: '#ff6a9a', kind: 'heart', unlock: { ach: 'streak7' } },
    { id: 'stars', name: 'Stardust', color: '#c08cff', kind: 'star', unlock: { ach: 'boss5' } },
    { id: 'neon', name: 'Neon Line', color: '#00e5ff', kind: 'neon', unlock: { cost: 300 } },
    { id: 'snow', name: 'Snowfall', color: '#ffffff', kind: 'snow', unlock: { event: 'frost', tier: 1 } },
    { id: 'petals', name: 'Petals', color: '#ffb0d0', kind: 'petal', unlock: { event: 'bloom', tier: 1 } },
    { id: 'sunbeam', name: 'Sunbeams', color: '#ffe07a', kind: 'sparkle', unlock: { event: 'sunfest', tier: 1 } },
    { id: 'autumn', name: 'Falling Leaves', color: '#e0782a', kind: 'leaf', unlock: { event: 'harvest', tier: 1 } },
    { id: 'bats', name: 'Bats', color: '#8a4aff', kind: 'bat', unlock: { event: 'hollow', tier: 1 } },
    { id: 'confetti', name: 'Confetti', color: '#ffd23a', kind: 'confetti', unlock: { event: 'starfall', tier: 1 } },
  ];

  const HATS = [
    { id: 'none', name: 'Bare Head', unlock: { free: true } },
    { id: 'flower', name: 'Daisy', unlock: { cost: 90 } },
    { id: 'party', name: 'Party Hat', unlock: { ach: 'level10' } },
    { id: 'crown', name: 'Crown', unlock: { boss: 'mole' } },
    { id: 'shades', name: 'Sunglasses', unlock: { boss: 'scorpion' } },
    { id: 'tophat', name: 'Top Hat', unlock: { cost: 260 } },
    { id: 'halo', name: 'Halo', unlock: { ach: 'zen10' } },
    { id: 'horns', name: 'Horns', unlock: { ach: 'kills50' } },
    { id: 'beanie', name: 'Beanie', unlock: { event: 'frost', tier: 3 } },
    { id: 'wreath', name: 'Flower Wreath', unlock: { event: 'bloom', tier: 3 } },
    { id: 'straw', name: 'Straw Hat', unlock: { event: 'sunfest', tier: 3 } },
    { id: 'acorn', name: 'Acorn Cap', unlock: { event: 'harvest', tier: 3 } },
    { id: 'witch', name: 'Witch Hat', unlock: { event: 'hollow', tier: 3 } },
    { id: 'santa', name: 'Festive Cap', unlock: { event: 'starfall', tier: 3 } },
  ];

  /* board themes for Arcade, Zen, Time Attack (index into worlds.THEMES; -1 = the season) */
  const BOARDS = [
    { id: 'season', name: 'Season', theme: -1, unlock: { free: true } },
    { id: 'meadow', name: 'Clover Meadow', theme: 0, unlock: { free: true } },
    { id: 'desert', name: 'Sunscale Dunes', theme: 1, unlock: { world: 1 } },
    { id: 'glacier', name: 'Hoarfrost Lake', theme: 2, unlock: { world: 2 } },
    { id: 'volcano', name: 'Cinder Depths', theme: 3, unlock: { world: 3 } },
    { id: 'neon', name: 'Eclipse Grid', theme: 4, unlock: { world: 4 } },
    { id: 'nokia', name: 'Pocket LCD', theme: 5, unlock: { legacy: true } },
    { id: 'tron', name: 'Light Cycle', theme: 6, unlock: { cost: 400 } },
  ];

  const KINDS = { skin: SKINS, trail: TRAILS, hat: HATS, board: BOARDS };

  function find(kind, id) {
    const list = KINDS[kind];
    for (let i = 0; i < list.length; ++i) if (list[i].id === id) return list[i];
    return list[0];
  }

  Object.assign(NS.cosmetics, {
    SKINS, TRAILS, HATS, BOARDS, KINDS, find
  });
})();
