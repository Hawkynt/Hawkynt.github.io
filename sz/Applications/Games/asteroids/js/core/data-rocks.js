/* Static rock data: the rock types with hit points, score and stardust multipliers, palettes,
   speed, the special effect when they shatter, and the arcade wave they first appear in; the
   seasonal rock variants that carry event tokens. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  /* pal: [highlight, body, shadow, accent]; fx: what happens on death; from: first arcade wave */
  const ROCK_TYPES = {
    normal: { name: 'Stone', hp: 1, score: 1, dust: 1, speed: 1, pal: ['#c8b8a0', '#8a7560', '#3a2e24', '#e0c890'], fx: null, from: 1,
      desc: 'Plain rock. One hit, splits in two.' },
    iron: { name: 'Iron', hp: 2, score: 1.5, dust: 1.5, speed: 0.85, pal: ['#d8dde8', '#7c8494', '#2a2e38', '#b8c8e8'], fx: null, from: 3,
      desc: 'Dense ore. Takes two hits.' },
    crystal: { name: 'Crystal', hp: 3, score: 2, dust: 2, speed: 0.9, pal: ['#d8c8ff', '#7a5ad8', '#24145a', '#b0f0ff'], fx: 'shards', from: 5,
      desc: 'Three hits; bursts into three shards.' },
    explosive: { name: 'Volatile', hp: 2, score: 1.5, dust: 1.5, speed: 1.05, pal: ['#ffc890', '#c0502a', '#401208', '#ffd040'], fx: 'blast', from: 7,
      desc: 'Detonates, wrecking everything nearby - you included.' },
    ice: { name: 'Ice', hp: 2, score: 1.5, dust: 1.5, speed: 1, pal: ['#ffffff', '#9ad8f0', '#2a5a7a', '#e0faff'], fx: 'freeze', from: 9,
      desc: 'Leaves a field of frost that slows whatever drifts through.' },
    lava: { name: 'Magma', hp: 3, score: 2, dust: 2, speed: 0.95, pal: ['#ff9a40', '#4a2a22', '#1a0c08', '#ffd060'], fx: 'fire', from: 12,
      desc: 'Drips burning patches; shatters into fire.' },
    electric: { name: 'Storm', hp: 2, score: 2, dust: 2, speed: 1.1, pal: ['#fffcc0', '#c8c070', '#4a4420', '#a0f0ff'], fx: 'arc', from: 15,
      desc: 'Its death arcs lightning into nearby rocks.' },
    void: { name: 'Void', hp: 3, score: 2.5, dust: 2.5, speed: 0.8, pal: ['#a080c0', '#2a1a3a', '#08040e', '#ff4ad0'], fx: 'pull', from: 18,
      desc: 'Bends space: pulls shots and ships toward it.' },
    gold: { name: 'Gold', hp: 4, score: 5, dust: 8, speed: 1.35, pal: ['#fff4c0', '#e0a830', '#5a3a08', '#fff8e0'], fx: 'jackpot', from: 4,
      desc: 'Rare and quick. Showers stardust.' },
    /* seasonal: carry the event token of their season */
    snow: { name: 'Snowglobe', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#ffffff', '#c8e0ff', '#5a7aa8', '#9ae0ff'], fx: 'token', season: 1, from: 2 },
    bloom: { name: 'Bloomstone', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#ffe0f0', '#e890b8', '#6a2a50', '#a0ff90'], fx: 'token', season: 1, from: 2 },
    sun: { name: 'Sunstone', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#fff8c0', '#ffb030', '#7a3a08', '#ffffff'], fx: 'token', season: 1, from: 2 },
    leaf: { name: 'Amberleaf', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#ffd090', '#c06a28', '#4a200a', '#ffe060'], fx: 'token', season: 1, from: 2 },
    pumpkin: { name: 'Gourdrock', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#ffc060', '#e86a10', '#5a2008', '#a0ff40'], fx: 'token', season: 1, from: 2 },
    gift: { name: 'Giftrock', hp: 2, score: 2, dust: 2, speed: 1, pal: ['#ffe0e0', '#d02a3a', '#4a0810', '#ffd040'], fx: 'token', season: 1, from: 2 },
  };

  /* hit points by size class are type hp times these */
  const SIZE_HP = [0, 1, 1, 1.5, 4];

  /* the order rock types unlock in endless arcade waves */
  const ARCADE_TYPES = ['normal', 'iron', 'gold', 'crystal', 'explosive', 'ice', 'lava', 'electric', 'void'];

  Object.assign(NS.rockData, {
    ROCK_TYPES, SIZE_HP, ARCADE_TYPES
  });
})();
