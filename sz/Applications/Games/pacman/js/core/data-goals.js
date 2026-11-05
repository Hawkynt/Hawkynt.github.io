/* Goals as data: 28 achievements (lifetime stat thresholds or one-off feats) with shard rewards,
   the daily quest templates, the lifetime statistics shown on the records page, and the daily
   streak bonus. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  /* stat + n: unlocked when the lifetime stat reaches n; feat: unlocked by rules.feat(id) */
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First Bite', desc: 'Clear your first maze', stat: 'mazes', n: 1, reward: 20 },
    { id: 'mazes25', name: 'Maze Runner', desc: 'Clear 25 mazes', stat: 'mazes', n: 25, reward: 80 },
    { id: 'mazes100', name: 'Labyrinth Lord', desc: 'Clear 100 mazes', stat: 'mazes', n: 100, reward: 250 },
    { id: 'dots5k', name: 'Snack Attack', desc: 'Eat 5,000 dots', stat: 'dots', n: 5000, reward: 60 },
    { id: 'dots50k', name: 'Bottomless', desc: 'Eat 50,000 dots', stat: 'dots', n: 50000, reward: 300 },
    { id: 'ghost1', name: 'Turn the Tables', desc: 'Eat a ghost', stat: 'ghosts', n: 1, reward: 15 },
    { id: 'ghost100', name: 'Ghostbuffet', desc: 'Eat 100 ghosts', stat: 'ghosts', n: 100, reward: 100 },
    { id: 'ghost1000', name: 'Spectral Gourmand', desc: 'Eat 1,000 ghosts', stat: 'ghosts', n: 1000, reward: 400 },
    { id: 'quad', name: 'Full House', desc: 'Eat four ghosts on one power pellet', feat: true, reward: 60 },
    { id: 'power50', name: 'Gadgeteer', desc: 'Collect 50 power-ups', stat: 'powerups', n: 50, reward: 80 },
    { id: 'allpower', name: 'Collector', desc: 'Use every kind of power-up', feat: true, reward: 150 },
    { id: 'fruit25', name: 'Fruit Salad', desc: 'Eat 25 bonus fruits', stat: 'fruits', n: 25, reward: 60 },
    { id: 'combo4', name: 'On a Roll', desc: 'Reach a x4 multiplier', stat: 'bestMult', n: 4, reward: 40 },
    { id: 'combo6', name: 'Unstoppable', desc: 'Reach a x6 multiplier', stat: 'bestMult', n: 6, reward: 120 },
    { id: 'chain200', name: 'Conga Line', desc: 'Eat 200 dots in one unbroken chain', stat: 'bestChain', n: 200, reward: 100 },
    { id: 'arcade10k', name: 'High Scorer', desc: 'Score 10,000 in Arcade', stat: 'bestArcade', n: 10000, reward: 50 },
    { id: 'arcade25k', name: 'Arcade Legend', desc: 'Score 25,000 in Arcade', stat: 'bestArcade', n: 25000, reward: 150 },
    { id: 'arcade60k', name: 'Kill Screen', desc: 'Score 60,000 in Arcade', stat: 'bestArcade', n: 60000, reward: 400 },
    { id: 'boss1', name: 'Giant Slayer', desc: 'Defeat a boss', stat: 'bosses', n: 1, reward: 60 },
    { id: 'bosses5', name: 'Lumen Bearer', desc: 'Defeat all five bosses', feat: true, reward: 300 },
    { id: 'story', name: 'Pac-Land Restored', desc: 'Finish the story', feat: true, reward: 500 },
    { id: 'perfect', name: 'Untouchable', desc: 'Clear a maze without losing a life', feat: true, reward: 50 },
    { id: 'zen30', name: 'Inner Peace', desc: 'Spend 30 minutes in Zen mode', stat: 'zenTime', n: 1800, reward: 120 },
    { id: 'daily', name: 'Daily Diner', desc: 'Finish a Daily Maze run', stat: 'dailies', n: 1, reward: 40 },
    { id: 'streak3', name: 'Regular', desc: 'Play three days in a row', stat: 'bestStreak', n: 3, reward: 60 },
    { id: 'streak7', name: 'Devoted', desc: 'Play seven days in a row', stat: 'bestStreak', n: 7, reward: 200 },
    { id: 'season1', name: 'Festive Spirit', desc: 'Finish a tier of a seasonal event', stat: 'seasonTiers', n: 1, reward: 50 },
    { id: 'shards1000', name: 'Shard Hoarder', desc: 'Earn 1,000 shards in total', stat: 'shardsEarned', n: 1000, reward: 100 },
  ];
  const ACH_BY_ID = {};
  for (let i = 0; i < ACHIEVEMENTS.length; ++i) ACH_BY_ID[ACHIEVEMENTS[i].id] = ACHIEVEMENTS[i];

  /* Daily quests: stat counted during the day, n scaled by a picked tier */
  const QUESTS = [
    { id: 'dots', text: 'Eat {n} dots', stat: 'dots', ns: [400, 800, 1500], reward: [25, 45, 80] },
    { id: 'ghosts', text: 'Eat {n} ghosts', stat: 'ghosts', ns: [8, 16, 30], reward: [25, 45, 80] },
    { id: 'powerups', text: 'Collect {n} power-ups', stat: 'powerups', ns: [5, 10, 18], reward: [25, 45, 80] },
    { id: 'mazes', text: 'Clear {n} mazes', stat: 'mazes', ns: [2, 4, 7], reward: [30, 55, 90] },
    { id: 'fruits', text: 'Eat {n} bonus fruits', stat: 'fruits', ns: [2, 4, 6], reward: [25, 45, 70] },
    { id: 'mult', text: 'Reach a x{n} multiplier', stat: 'bestMult', max: true, ns: [3, 4, 5], reward: [30, 50, 80] },
    { id: 'zen', text: 'Relax {n} minutes in Zen', stat: 'zenTime', ns: [3, 6, 10], scale: 60, reward: [25, 45, 70] },
    { id: 'tokens', text: 'Find {n} seasonal tokens', stat: 'tokens', ns: [3, 6, 10], reward: [30, 50, 80] },
    { id: 'score', text: 'Score {n} in one Arcade run', stat: 'bestArcade', max: true, ns: [5000, 12000, 25000], reward: [30, 55, 90] },
  ];

  const STATS = [
    { id: 'playTime', name: 'Time played', time: true },
    { id: 'runs', name: 'Runs started' },
    { id: 'mazes', name: 'Mazes cleared' },
    { id: 'dots', name: 'Dots eaten' },
    { id: 'ghosts', name: 'Ghosts eaten' },
    { id: 'powerups', name: 'Power-ups collected' },
    { id: 'fruits', name: 'Fruit eaten' },
    { id: 'bosses', name: 'Bosses defeated' },
    { id: 'deaths', name: 'Times caught' },
    { id: 'bestMult', name: 'Best multiplier', prefix: 'x' },
    { id: 'bestChain', name: 'Longest dot chain' },
    { id: 'bestArcade', name: 'Best Arcade score' },
    { id: 'zenTime', name: 'Time in Zen', time: true },
    { id: 'dailies', name: 'Daily Mazes finished' },
    { id: 'tokens', name: 'Seasonal tokens found' },
    { id: 'shardsEarned', name: 'Shards earned' },
    { id: 'daysPlayed', name: 'Days played' },
    { id: 'bestStreak', name: 'Longest daily streak' },
  ];

  /* shards for the first run of a day: base + per streak day, capped */
  const STREAK_BASE = 20, STREAK_STEP = 10, STREAK_CAP = 7;

  Object.assign(NS.goals, {
    ACHIEVEMENTS, ACH_BY_ID, QUESTS, STATS, STREAK_BASE, STREAK_STEP, STREAK_CAP
  });
})();
