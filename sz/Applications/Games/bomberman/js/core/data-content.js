/* What fills an arena: the fifteen power-ups with drop weights, the enemy roster with speeds,
   hit points and AI kinds, the five bosses with their attack cycles, and the modifiers the
   daily challenge draws from. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  /* kind: stat (stacking), ability (once), timed (seconds), instant, curse */
  const POWERUPS = [
    { id: 'bomb', name: 'Bomb Up', kind: 'stat', weight: 22, color: '#ff5d5d', desc: 'One more bomb at a time' },
    { id: 'fire', name: 'Fire Up', kind: 'stat', weight: 22, color: '#ff9b30', desc: 'Blasts reach one tile further' },
    { id: 'speed', name: 'Roller Skates', kind: 'stat', weight: 14, color: '#3ee07a', desc: 'Run faster' },
    { id: 'kick', name: 'Kick Boots', kind: 'ability', weight: 9, color: '#3aa0ff', desc: 'Walk into a bomb to send it sliding' },
    { id: 'glove', name: 'Power Glove', kind: 'ability', weight: 6, color: '#ff70c0', desc: 'Bomb key on your own bomb throws it over walls' },
    { id: 'remote', name: 'Remote Fuse', kind: 'ability', weight: 5, color: '#c070ff', desc: 'Bombs wait for X (or Detonate) to blow' },
    { id: 'pierce', name: 'Pierce Bomb', kind: 'ability', weight: 5, color: '#4ff0ff', desc: 'Blasts punch through every brick in line', rare: true },
    { id: 'shield', name: 'Bubble Shield', kind: 'instant', weight: 6, color: '#8fe8ff', desc: 'Absorbs one hit' },
    { id: 'wallpass', name: 'Wall Walker', kind: 'ability', weight: 3, color: '#d8b070', desc: 'Walk through bricks', rare: true },
    { id: 'bombpass', name: 'Bomb Hopper', kind: 'ability', weight: 5, color: '#9aa8ff', desc: 'Walk over bombs' },
    { id: 'maxfire', name: 'Full Fire', kind: 'instant', weight: 2, color: '#ffe23a', desc: 'Blast range to the maximum', rare: true },
    { id: 'freeze', name: 'Time Freeze', kind: 'timed', weight: 5, color: '#a8f0ff', desc: 'Enemies freeze for a few seconds' },
    { id: 'magnet', name: 'Gem Magnet', kind: 'timed', weight: 5, color: '#ffd84a', desc: 'Gems and pickups fly to you' },
    { id: 'heart', name: 'Extra Life', kind: 'instant', weight: 2, color: '#ff4f7a', desc: 'One more life', rare: true },
    { id: 'skull', name: 'Cursed Skull', kind: 'curse', weight: 6, color: '#b4b4c8', desc: 'A random curse for ten seconds - blast an enemy to lift it' }
  ];
  const POWERUP_BY_ID = {};
  for (let i = 0; i < POWERUPS.length; ++i) POWERUP_BY_ID[POWERUPS[i].id] = POWERUPS[i];

  const CURSES = [
    { id: 'slow', name: 'Snail Feet' },
    { id: 'reverse', name: 'Backwards' },
    { id: 'drop', name: 'Bomb Hiccups' },
    { id: 'short', name: 'Fizzle Fuse' },
    { id: 'nobomb', name: 'Butterfingers' }
  ];

  /* ai: wander, smart (turns toward the player), hop (changes course every tile), hunt (paths
     to the player), ghost (passes bricks), tank, imp (drops bombs), split, charge */
  const ENEMIES = [
    { id: 'puff', name: 'Puffball', speed: 1.6, hp: 1, points: 100, ai: 'wander', color: '#ffa04a', desc: 'Drifts along the halls' },
    { id: 'zapper', name: 'Zapper', speed: 2.3, hp: 1, points: 150, ai: 'smart', color: '#4fb8ff', desc: 'Turns toward you at crossings' },
    { id: 'hopper', name: 'Hopper', speed: 3.1, hp: 1, points: 200, ai: 'hop', color: '#6fe05a', desc: 'Fast and fickle' },
    { id: 'hunter', name: 'Hunter', speed: 2.4, hp: 1, points: 300, ai: 'hunt', color: '#ff4a5a', desc: 'Tracks you through the maze' },
    { id: 'wisp', name: 'Wisp', speed: 1.9, hp: 1, points: 300, ai: 'ghost', color: '#d6c8ff', desc: 'Floats through bricks' },
    { id: 'brute', name: 'Brute', speed: 1.4, hp: 3, points: 400, ai: 'tank', color: '#9a8f86', desc: 'Takes three blasts; angrier each time' },
    { id: 'imp', name: 'Imp', speed: 2.0, hp: 1, points: 350, ai: 'imp', color: '#b25cff', desc: 'Drops bombs of its own' },
    { id: 'blob', name: 'Blob', speed: 1.7, hp: 1, points: 250, ai: 'split', color: '#4ad8a8', desc: 'Splits into two bloblings' },
    { id: 'blobling', name: 'Blobling', speed: 2.9, hp: 1, points: 100, ai: 'hop', color: '#7cf0c8', desc: 'Small, quick, harmless alone', minion: true },
    { id: 'charger', name: 'Charger', speed: 1.8, hp: 1, points: 350, ai: 'charge', color: '#ffcc33', desc: 'Charges when it sees you' }
  ];
  const ENEMY_BY_ID = {};
  for (let i = 0; i < ENEMIES.length; ++i) ENEMY_BY_ID[ENEMIES[i].id] = ENEMIES[i];

  /* Boss attack cycles. Attacks are played in order and loop; phase two (half health) swaps in
     the second list and speeds the cycle up. */
  const BOSSES = {
    mole: { id: 'mole', name: 'King Gnarl', title: 'Mole Monarch', hp: 10, speed: 1.6, size: 1.6, color: '#b07a4a',
      cycle: ['chase', 'burrow', 'rocks', 'chase', 'burrow'], cycle2: ['burrow', 'summon', 'rocks', 'burrow', 'ring'], minion: 'puff', points: 5000 },
    yeti: { id: 'yeti', name: 'Rimefang', title: 'Yeti Golem', hp: 12, speed: 1.3, size: 1.8, color: '#dff4ff',
      cycle: ['chase', 'shards', 'chase', 'summon'], cycle2: ['shards', 'chase', 'cross', 'summon', 'shards'], minion: 'hopper', points: 6000 },
    crab: { id: 'crab', name: 'Clinker', title: 'Furnace Crab', hp: 13, speed: 2.0, size: 1.8, color: '#ff7a3c',
      cycle: ['strafe', 'columns', 'strafe', 'summon'], cycle2: ['strafe', 'columns', 'rows', 'summon', 'columns'], minion: 'imp', points: 7000 },
    mecha: { id: 'mecha', name: 'MB-9', title: 'Mecha Bomber', hp: 14, speed: 2.4, size: 1.7, color: '#7ef9ff',
      cycle: ['chase', 'bombrain', 'laser', 'dash'], cycle2: ['bombrain', 'laser', 'dash', 'laser', 'summon'], minion: 'zapper', points: 8000 },
    baron: { id: 'baron', name: 'Baron Blackfuse', title: 'Lord of Shadow', hp: 16, speed: 2.2, size: 1.6, color: '#8a4cff',
      cycle: ['teleport', 'cross', 'summon', 'teleport', 'ring'], cycle2: ['teleport', 'cross', 'bombrain', 'teleport', 'laser', 'summon', 'ring'], minion: 'wisp', points: 12000 }
  };
  const BOSS_ORDER = ['mole', 'yeti', 'crab', 'mecha', 'baron'];

  /* Daily challenge modifiers; three are drawn each day */
  const MODIFIERS = [
    { id: 'bigfire', name: 'Big Bang', desc: 'Start with +2 fire' },
    { id: 'haunted', name: 'Haunted', desc: 'Wisps everywhere' },
    { id: 'speedy', name: 'Rush Hour', desc: 'Enemies move 30% faster' },
    { id: 'skulls', name: 'Skull Party', desc: 'Curses drop far more often' },
    { id: 'ice', name: 'Ice Age', desc: 'Slippery floors in every arena' },
    { id: 'dark', name: 'Blackout', desc: 'Darkness in every arena' },
    { id: 'rich', name: 'Gold Rush', desc: 'Double gems' },
    { id: 'crowded', name: 'Crowded', desc: 'Half again as many enemies' },
    { id: 'bombs', name: 'Arsenal', desc: 'Start with +2 bombs and kick' },
    { id: 'brittle', name: 'Paper Walls', desc: 'Few bricks, many enemies' }
  ];
  const MODIFIER_BY_ID = {};
  for (let i = 0; i < MODIFIERS.length; ++i) MODIFIER_BY_ID[MODIFIERS[i].id] = MODIFIERS[i];

  Object.assign(NS.content, {
    POWERUPS, POWERUP_BY_ID, CURSES, ENEMIES, ENEMY_BY_ID, BOSSES, BOSS_ORDER, MODIFIERS, MODIFIER_BY_ID
  });
})();
