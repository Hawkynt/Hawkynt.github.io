/* Static enemy and boss data: seven raider types with hit points, speed, radius, score, how
   they fight and their colours; five chapter bosses with names, titles, part hit points and
   palettes. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const ENEMIES = {
    saucer: { name: 'Saucer', hp: 2, r: 22, speed: 120, score: 200, dust: 6, fire: 1.6, col: '#9ae06a', from: 2,
      desc: 'The classic. Crosses the field and fires at random.' },
    sniper: { name: 'Sniper Saucer', hp: 1, r: 13, speed: 170, score: 1000, dust: 10, fire: 1.3, col: '#ff6a8a', from: 6,
      desc: 'Small, fast and it aims.' },
    hunter: { name: 'Hunter', hp: 1, r: 12, speed: 210, score: 150, dust: 4, fire: 0, col: '#ff4a3a', from: 4,
      desc: 'Kamikaze drone in packs; it rams you.' },
    gunship: { name: 'Gunship', hp: 5, r: 26, speed: 90, score: 500, dust: 12, fire: 2.4, col: '#ffa040', from: 8,
      desc: 'Armoured, strafes and fires three-shot bursts.' },
    layer: { name: 'Mine-Layer', hp: 3, r: 22, speed: 100, score: 300, dust: 8, fire: 2.8, col: '#ffe040', from: 10,
      desc: 'Weaves through the field sowing proximity mines.' },
    phantom: { name: 'Phantom', hp: 3, r: 18, speed: 150, score: 800, dust: 12, fire: 2.2, col: '#c070ff', from: 13,
      desc: 'Cloaks and reappears; only hittable when visible.' },
    splitter: { name: 'Splitter', hp: 4, r: 24, speed: 80, score: 600, dust: 10, fire: 3, col: '#40e0d0', from: 16,
      desc: 'Bursts into three hunters when destroyed.' },
  };

  /* the bosses by chapter: hp is per vulnerable part; parts see bosses.js */
  const BOSSES = {
    glacier: { name: 'Glacier Titan', title: 'Warden of the Kuiper Drift', hp: 60, r: 96, score: 15000, dust: 220,
      pal: ['#ffffff', '#9ad8f0', '#2a5a7a', '#bff4ff'] },
    wyrm: { name: 'Magma Wyrm', title: 'Coil of the Ember Belt', hp: 90, r: 34, score: 25000, dust: 320,
      pal: ['#ffd060', '#ff6a20', '#3a1008', '#ffe8a0'] },
    prism: { name: 'Prism Warden', title: 'Lens of the Crystal Reach', hp: 110, r: 70, score: 35000, dust: 420,
      pal: ['#f0e0ff', '#a070ff', '#2a1060', '#80ffff'] },
    tempest: { name: 'Tempest Core', title: 'Heart of the Storm Nebula', hp: 130, r: 58, score: 45000, dust: 520,
      pal: ['#ffffe0', '#e0e060', '#3a3a10', '#80e0ff'] },
    maw: { name: 'The Maw', title: 'Hunger at the Edge', hp: 130, r: 110, score: 80000, dust: 900,
      pal: ['#ffb0c0', '#a01838', '#200408', '#ff4a6a'] },
  };

  const BOSS_ORDER = ['glacier', 'wyrm', 'prism', 'tempest', 'maw'];

  Object.assign(NS.enemyData, {
    ENEMIES, BOSSES, BOSS_ORDER
  });
})();
