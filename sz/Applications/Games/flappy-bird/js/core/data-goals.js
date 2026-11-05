;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Achievements: each reads one number from the save (v) and is earned once it reaches n.
     The reward pays coins and may unlock a wardrobe item (that item names the achievement
     as its unlock in data-cosmetics.js). Pure table, evaluated by systems/goals.js. */

  const st = (k) => (s) => s.stats[k] || 0;
  const boss = (k) => (s) => (s.bosses[k] || 0) > 0 ? 1 : 0;

  const ACHIEVEMENTS = [
    { id: 'first_flight', name: 'First Flight', desc: 'Pass your first pipe', v: st('gates'), n: 1, coins: 50 },
    { id: 'gates_100', name: 'Pipe Dreamer', desc: 'Pass 100 pipes in total', v: st('gates'), n: 100, coins: 100 },
    { id: 'gates_1000', name: 'Frequent Flyer', desc: 'Pass 1,000 pipes in total', v: st('gates'), n: 1000, coins: 300 },
    { id: 'gates_5000', name: 'Sky Commuter', desc: 'Pass 5,000 pipes in total', v: st('gates'), n: 5000, coins: 800 },
    { id: 'classic_25', name: 'Silver Wings', desc: 'Score 25 in one Classic run', v: (s) => s.best.classic, n: 25, coins: 150 },
    { id: 'classic_100', name: 'Platinum Flapper', desc: 'Score 100 in one Classic run', v: (s) => s.best.classic, n: 100, coins: 1000 },
    { id: 'combo_10', name: 'In the Zone', desc: 'Reach a combo of 10', v: st('comboMax'), n: 10, coins: 150 },
    { id: 'combo_25', name: 'Threading the Needle', desc: 'Reach a combo of 25', v: st('comboMax'), n: 25, coins: 500 },
    { id: 'perfect_100', name: 'Dead Centre', desc: 'Fly 100 PERFECT passes in total', v: st('perfects'), n: 100, coins: 200 },
    { id: 'coins_1k', name: 'Pocket Money', desc: 'Collect 1,000 coins in total', v: st('coins'), n: 1000, coins: 100 },
    { id: 'coins_10k', name: 'Golden Nest', desc: 'Collect 10,000 coins in total', v: st('coins'), n: 10000, coins: 500 },
    { id: 'boss_bee', name: 'Honey Heist', desc: 'Defeat Queen Buzzella', v: boss('bee'), n: 1, coins: 200 },
    { id: 'boss_wyrm', name: 'Dune Breaker', desc: 'Defeat Dunejaw', v: boss('wyrm'), n: 1, coins: 250 },
    { id: 'boss_owl', name: 'Thaw', desc: 'Defeat Glacius', v: boss('owl'), n: 1, coins: 300 },
    { id: 'boss_moth', name: 'Lights Out', desc: 'Defeat Duskmoth', v: boss('moth'), n: 1, coins: 350 },
    { id: 'boss_crowbot', name: 'Scrap Metal', desc: 'Defeat MK-7 Crowbot', v: boss('crowbot'), n: 1, coins: 400 },
    { id: 'boss_corvus', name: 'Calm After the Storm', desc: 'Defeat Corvus and finish the story', v: boss('corvus'), n: 1, coins: 1000 },
    { id: 'boss_nohit', name: 'Untouchable', desc: 'Defeat a boss without taking a hit', v: st('bossNoHit'), n: 1, coins: 400 },
    { id: 'stars_36', name: 'Star Collector', desc: 'Earn 36 story stars', v: (s) => sumStars(s), n: 36, coins: 300 },
    { id: 'stars_72', name: 'Constellation', desc: 'Earn all 72 story stars', v: (s) => sumStars(s), n: 72, coins: 1500 },
    { id: 'arcade_5k', name: 'Arcade Ace', desc: 'Score 5,000 in Arcade', v: (s) => s.best.arcade, n: 5000, coins: 200 },
    { id: 'arcade_20k', name: 'High Roller', desc: 'Score 20,000 in Arcade', v: (s) => s.best.arcade, n: 20000, coins: 600 },
    { id: 'fever_10', name: 'Fever Dream', desc: 'Start FEVER 10 times', v: st('fevers'), n: 10, coins: 200 },
    { id: 'zen_10', name: 'Inner Calm', desc: 'Fly 10 minutes in Zen', v: st('zenMin'), n: 10, coins: 200 },
    { id: 'zen_30', name: 'Enlightened', desc: 'Fly 30 minutes in Zen', v: st('zenMin'), n: 30, coins: 500 },
    { id: 'daily_7', name: 'Creature of Habit', desc: 'Play the Daily Challenge on 7 days', v: st('dailyDays'), n: 7, coins: 400 },
    { id: 'streak_3', name: 'Coming Back', desc: 'Play 3 days in a row', v: (s) => s.streak.best, n: 3, coins: 150 },
    { id: 'streak_7', name: 'Homing Pigeon', desc: 'Play 7 days in a row', v: (s) => s.streak.best, n: 7, coins: 500 },
    { id: 'time_40', name: 'Against the Clock', desc: 'Score 40 in Time Attack', v: (s) => s.best.time, n: 40, coins: 300 },
    { id: 'powers_all', name: 'Bubble Connoisseur', desc: 'Pop every kind of power-up bubble', v: (s) => s.powersSeen.length, n: 12, coins: 300 },
    { id: 'tree_10', name: 'Nest Builder', desc: 'Learn 10 Nest upgrades', v: (s) => Object.keys(s.tree).filter(k => s.tree[k] > 0).length, n: 10, coins: 300 },
    { id: 'tree_all', name: 'Master of the Nest', desc: 'Learn every Nest upgrade', v: (s) => Object.keys(s.tree).filter(k => s.tree[k] > 0).length, n: 27, coins: 2000 },
    { id: 'wardrobe_10', name: 'Fashionista', desc: 'Own 10 wardrobe items', v: (s) => s.birds.length + s.hats.length + s.trails.length + s.themes.length - 4, n: 10, coins: 300 },
    { id: 'season_max', name: 'Season Champion', desc: 'Finish a seasonal event track', v: st('seasonMax'), n: 1, coins: 500 },
    { id: 'bossrush', name: 'Gauntlet', desc: 'Clear Boss Rush', v: st('bossRush'), n: 1, coins: 800 },
    { id: 'crows_50', name: 'Scarecrow', desc: 'Dodge 50 storm crows', v: st('crows'), n: 50, coins: 250 },
    { id: 'close_50', name: 'Close Shave', desc: 'Make 50 CLOSE shaves', v: st('close'), n: 50, coins: 250 }
  ];

  function sumStars(s) {
    let n = 0;
    for (const id in s.stars)
      n += s.stars[id];
    return n;
  }

  /* lifetime statistics shown on the Stats page: label and how to read it */
  const STATS = [
    { label: 'Runs flown', v: st('runs') },
    { label: 'Pipes passed', v: st('gates') },
    { label: 'Coins collected', v: st('coins') },
    { label: 'PERFECT passes', v: st('perfects') },
    { label: 'Best combo', v: st('comboMax') },
    { label: 'Flaps', v: st('flaps') },
    { label: 'CLOSE shaves', v: st('close') },
    { label: 'Power-ups popped', v: st('powers') },
    { label: 'Storm crows dodged', v: st('crows') },
    { label: 'FEVERs started', v: st('fevers') },
    { label: 'Bosses defeated', v: (s) => Object.keys(s.bosses).reduce((a, k) => a + s.bosses[k], 0) },
    { label: 'Story stars', v: sumStars },
    { label: 'Seasonal tokens', v: st('tokens') },
    { label: 'Zen minutes', v: (s) => Math.floor(s.stats.zenMin || 0) },
    { label: 'Time in the air', v: (s) => Math.floor((s.stats.seconds || 0) / 60) + ' min' },
    { label: 'Best day streak', v: (s) => s.streak.best }
  ];

  Object.assign(NS.C, { ACHIEVEMENTS, STATS });
})();
