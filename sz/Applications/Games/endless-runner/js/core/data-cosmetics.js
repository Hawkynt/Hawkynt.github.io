/* The collection: six runners (each with a look and a perk), fourteen outfits (colour schemes
   any runner can wear) and fourteen trails, with how each is unlocked - free, coins, gems, a
   runner level, an achievement, a guardian beaten or a festival reward tier. Pure data; owns
   nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  /* head: hair | ears | visor | cap | helmet | hood */
  const CHARACTERS = [
    { id: 'nova', name: 'Nova', role: 'Courier of the Beacon', head: 'hair', skin: '#f2c6a0', hair: '#ff7a3a', suit: '#2f4a8a', accent: '#ff3a5a', perk: 'Balanced: no weak spots', unlock: { kind: 'free' } },
    { id: 'kip', name: 'Kip', role: 'Fox scout of the Meadows', head: 'ears', skin: '#ffb070', hair: '#e8702a', suit: '#3a6a3a', accent: '#ffe06a', perk: 'Magnet range +35%', unlock: { kind: 'gems', n: 40 } },
    { id: 'rook', name: 'Rook', role: 'Tinkered courier bot', head: 'visor', skin: '#b8c4d8', hair: '#5ee0ff', suit: '#4a5468', accent: '#ffd24a', perk: 'Dash recharges 25% faster', unlock: { kind: 'level', n: 6 } },
    { id: 'mira', name: 'Mira', role: 'Rooftop skater', head: 'cap', skin: '#c88a64', hair: '#2a1a3a', suit: '#c03a8a', accent: '#38e0ff', perk: 'Coins are worth +10%', unlock: { kind: 'gems', n: 70 } },
    { id: 'blaze', name: 'Blaze', role: 'Canyon fire warden', head: 'helmet', skin: '#e0a080', hair: '#ffb030', suit: '#a8341e', accent: '#ffe07a', perk: 'Starts every run with a Shield', unlock: { kind: 'boss', id: 'wyrm' } },
    { id: 'echo', name: 'Echo', role: 'A spark of the Beacon itself', head: 'hood', skin: '#e8e0ff', hair: '#c08cff', suit: '#3a2a6a', accent: '#ff6ad5', perk: 'Power-ups last 15% longer', unlock: { kind: 'boss', id: 'king' } },
  ];

  /* null colours keep the runner's own */
  const OUTFITS = [
    { id: 'classic', name: 'Classic', suit: null, accent: null, unlock: { kind: 'free' } },
    { id: 'midnight', name: 'Midnight', suit: '#1a1a3a', accent: '#5ee0ff', unlock: { kind: 'coins', n: 1200 } },
    { id: 'forest', name: 'Forest', suit: '#2e5a2a', accent: '#c8f06a', unlock: { kind: 'coins', n: 1500 } },
    { id: 'crimson', name: 'Crimson', suit: '#7a1424', accent: '#ffd24a', unlock: { kind: 'coins', n: 2000 } },
    { id: 'ivory', name: 'Ivory', suit: '#e8e4dc', accent: '#c08a3a', unlock: { kind: 'gems', n: 30 } },
    { id: 'neon', name: 'Neon', suit: '#140a2a', accent: '#ff4ab8', glow: true, unlock: { kind: 'gems', n: 50 } },
    { id: 'gold', name: 'Gold Rush', suit: '#c8962a', accent: '#fff2a0', glow: true, unlock: { kind: 'ach', id: 'coins10k' } },
    { id: 'glitch', name: 'Glitch', suit: '#0a0a12', accent: '#7cff9a', glow: true, unlock: { kind: 'ach', id: 'arcade5k' } },
    { id: 'frostbite', name: 'Frostbite', suit: '#bfe8ff', accent: '#3a8aff', unlock: { kind: 'season', id: 'frost' } },
    { id: 'blossom', name: 'Blossom', suit: '#ffb0d0', accent: '#7ee07a', unlock: { kind: 'season', id: 'bloom' } },
    { id: 'surf', name: 'Surf', suit: '#2ad0c0', accent: '#ffe07a', unlock: { kind: 'season', id: 'sunfest' } },
    { id: 'harvest', name: 'Harvest', suit: '#a0582a', accent: '#ffb03a', unlock: { kind: 'season', id: 'harvest' } },
    { id: 'pumpkin', name: 'Pumpkin', suit: '#ff7a1a', accent: '#3a1a4a', unlock: { kind: 'season', id: 'hollow' } },
    { id: 'starfall', name: 'Starfall', suit: '#2a1a6a', accent: '#ffd23a', glow: true, unlock: { kind: 'season', id: 'starfall' } },
  ];

  const TRAILS = [
    { id: 'dust', name: 'Dust', colors: ['#d8c8a8', '#b8a888'], shape: 'dot', unlock: { kind: 'free' } },
    { id: 'sparks', name: 'Sparks', colors: ['#ffe07a', '#ff9a3a'], shape: 'glow', unlock: { kind: 'coins', n: 800 } },
    { id: 'rainbow', name: 'Rainbow', colors: ['#ff5a6a', '#ffb347', '#ffe07a', '#7cff9a', '#5ee0ff', '#b48cff'], shape: 'ribbon', unlock: { kind: 'gems', n: 60 } },
    { id: 'leaves', name: 'Leaves', colors: ['#7ee07a', '#3f9a3a'], shape: 'leaf', unlock: { kind: 'boss', id: 'boar' } },
    { id: 'flames', name: 'Flames', colors: ['#ffe07a', '#ff5a1a'], shape: 'glow', unlock: { kind: 'level', n: 10 } },
    { id: 'pixels', name: 'Pixels', colors: ['#5ee0ff', '#ff4ab8', '#7cff9a'], shape: 'square', unlock: { kind: 'coins', n: 2500 } },
    { id: 'stars', name: 'Stardust', colors: ['#ffffff', '#ffd24a'], shape: 'star', unlock: { kind: 'ach', id: 'stars30' } },
    { id: 'bubbles', name: 'Bubbles', colors: ['#bff4ff', '#8ad0ff'], shape: 'bubble', unlock: { kind: 'gems', n: 40 } },
    { id: 'glitch', name: 'Glitch', colors: ['#7cff9a', '#ff4ab8'], shape: 'square', unlock: { kind: 'boss', id: 'warden' } },
    { id: 'snow', name: 'Snowfall', colors: ['#ffffff', '#bff4ff'], shape: 'snow', unlock: { kind: 'season', id: 'frost', tier: 1 } },
    { id: 'petals', name: 'Petals', colors: ['#ffb0d0', '#ffffff'], shape: 'petal', unlock: { kind: 'season', id: 'bloom', tier: 1 } },
    { id: 'shells', name: 'Sea Spray', colors: ['#2ad0c0', '#ffffff'], shape: 'bubble', unlock: { kind: 'season', id: 'sunfest', tier: 1 } },
    { id: 'bats', name: 'Bats', colors: ['#3a1a4a', '#ff8a1a'], shape: 'bat', unlock: { kind: 'season', id: 'hollow', tier: 1 } },
    { id: 'confetti', name: 'Confetti', colors: ['#ffd23a', '#ff5a8a', '#5ee0ff', '#7cff9a'], shape: 'square', unlock: { kind: 'season', id: 'starfall', tier: 1 } },
  ];

  function index(list) {
    const m = {};
    for (let i = 0; i < list.length; ++i) m[list[i].id] = list[i];
    return m;
  }

  Object.assign(NS.cosmetics, {
    CHARACTERS, OUTFITS, TRAILS, CHAR_BY_ID: index(CHARACTERS), OUTFIT_BY_ID: index(OUTFITS), TRAIL_BY_ID: index(TRAILS)
  });
})();
