/* Goals: the achievements (each a threshold on a lifetime statistic, with a scale reward), the
   daily quest pool the date picks three from, the streak gift table and the lifetime statistics
   shown in the journal. Pure data; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  /* stat: a key of save.stats (or a derived key computed in rules.statValue) */
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First Bite', desc: 'Eat your first fruit', stat: 'fruit', n: 1, reward: 10, icon: 'apple' },
    { id: 'fruit100', name: 'Snacker', desc: 'Eat 100 fruit', stat: 'fruit', n: 100, reward: 30, icon: 'apple' },
    { id: 'fruit1000', name: 'Gourmand', desc: 'Eat 1,000 fruit', stat: 'fruit', n: 1000, reward: 120, icon: 'apple' },
    { id: 'fruit5000', name: 'Bottomless', desc: 'Eat 5,000 fruit', stat: 'fruit', n: 5000, reward: 300, icon: 'apple' },
    { id: 'len20', name: 'Growing Up', desc: 'Reach length 20', stat: 'bestLength', n: 20, reward: 25, icon: 'leaf' },
    { id: 'len50', name: 'Long Story', desc: 'Reach length 50', stat: 'bestLength', n: 50, reward: 60, icon: 'leaf' },
    { id: 'len100', name: 'Endless Coil', desc: 'Reach length 100', stat: 'bestLength', n: 100, reward: 150, icon: 'leaf' },
    { id: 'combo10', name: 'In the Groove', desc: 'Reach a 10 combo', stat: 'bestCombo', n: 10, reward: 40, icon: 'star' },
    { id: 'combo25', name: 'Unstoppable', desc: 'Reach a 25 combo (Rainbow skin)', stat: 'bestCombo', n: 25, reward: 120, icon: 'star' },
    { id: 'arcade1k', name: 'Arcade Rookie', desc: 'Score 1,000 in Arcade', stat: 'arcadeBest', n: 1000, reward: 30, icon: 'bolt' },
    { id: 'arcade10k', name: 'Arcade Ace', desc: 'Score 10,000 in Arcade', stat: 'arcadeBest', n: 10000, reward: 150, icon: 'bolt' },
    { id: 'arcade30k', name: 'Arcade Legend', desc: 'Score 30,000 in Arcade', stat: 'arcadeBest', n: 30000, reward: 300, icon: 'bolt' },
    { id: 'level10', name: 'Explorer', desc: 'Clear 10 story levels (Party Hat)', stat: 'levelsCleared', n: 10, reward: 50, icon: 'book' },
    { id: 'boss1', name: 'Guardian Breaker', desc: 'Free your first guardian', stat: 'guardians', n: 1, reward: 50, icon: 'crown' },
    { id: 'boss5', name: 'Light Bringer', desc: 'Free all five guardians (Stardust trail)', stat: 'guardians', n: 5, reward: 300, icon: 'sun' },
    { id: 'stars30', name: 'Star Gazer', desc: 'Earn 30 story stars', stat: 'stars', n: 30, reward: 80, icon: 'star' },
    { id: 'stars90', name: 'Perfectionist', desc: 'Earn all 90 story stars', stat: 'stars', n: 90, reward: 500, icon: 'star' },
    { id: 'eggs30', name: 'Egg Hunter', desc: 'Collect 30 golden eggs', stat: 'eggs', n: 30, reward: 60, icon: 'egg' },
    { id: 'kills50', name: 'Pest Control', desc: 'Defeat 50 critters (Horns)', stat: 'kills', n: 50, reward: 60, icon: 'fang' },
    { id: 'venom25', name: 'Spitter', desc: 'Hit 25 targets with venom', stat: 'venomHits', n: 25, reward: 40, icon: 'drop' },
    { id: 'power50', name: 'Power Hungry', desc: 'Pick up 50 power-ups', stat: 'powerups', n: 50, reward: 40, icon: 'bolt' },
    { id: 'zen10', name: 'Inner Peace', desc: 'Spend 10 minutes in Zen (Halo)', stat: 'zenTime', n: 600, reward: 60, icon: 'leaf' },
    { id: 'daily7', name: 'Gardener', desc: 'Play 7 Daily Gardens', stat: 'dailyDone', n: 7, reward: 100, icon: 'sun' },
    { id: 'streak7', name: 'Devoted', desc: 'Play 7 days in a row (Hearts trail)', stat: 'bestStreak', n: 7, reward: 100, icon: 'heart' },
    { id: 'tokens50', name: 'Festive', desc: 'Collect 50 festival tokens', stat: 'tokens', n: 50, reward: 60, icon: 'gift' },
    { id: 'oldschool', name: 'Old School', desc: 'Play 10 runs (Pocket LCD skin)', stat: 'runs', n: 10, reward: 30, icon: 'clock' },
    { id: 'time2500', name: 'Beat the Clock', desc: 'Score 2,500 in Time Attack', stat: 'timeBest', n: 2500, reward: 50, icon: 'clock' },
    { id: 'rush', name: 'Rush Hour', desc: 'Clear a Guardian Rush', stat: 'rushClears', n: 1, reward: 150, icon: 'crown' },
    { id: 'skins5', name: 'Collector', desc: 'Own 5 skins', stat: 'skinsOwned', n: 5, reward: 60, icon: 'gift' },
    { id: 'tree10', name: 'Evolved', desc: 'Buy 10 tech tree levels', stat: 'treeLevels', n: 10, reward: 80, icon: 'eye' },
  ];

  /* daily quests: sum = adds up over the day, max = best single value reached */
  const QUESTS = [
    { id: 'eat', text: 'Eat {n} fruit', stat: 'fruit', kind: 'sum', ns: [40, 70, 110], reward: 30 },
    { id: 'combo', text: 'Reach a {n} combo', stat: 'bestCombo', kind: 'max', ns: [6, 9, 12], reward: 35 },
    { id: 'power', text: 'Pick up {n} power-ups', stat: 'powerups', kind: 'sum', ns: [5, 8, 12], reward: 30 },
    { id: 'arcade', text: 'Score {n} in one Arcade run', stat: 'arcadeBest', kind: 'max', ns: [1200, 2500, 4000], reward: 40 },
    { id: 'levels', text: 'Clear {n} story levels', stat: 'levelsCleared', kind: 'sum', ns: [2, 3, 4], reward: 40 },
    { id: 'tokens', text: 'Collect {n} festival tokens', stat: 'tokens', kind: 'sum', ns: [5, 8, 12], reward: 35 },
    { id: 'kills', text: 'Defeat {n} critters', stat: 'kills', kind: 'sum', ns: [4, 8, 12], reward: 35 },
    { id: 'zen', text: 'Relax {n} minutes in Zen', stat: 'zenTime', kind: 'sum', ns: [2, 4, 6], scale: 60, reward: 30 },
    { id: 'length', text: 'Reach length {n}', stat: 'bestLength', kind: 'max', ns: [20, 30, 40], reward: 35 },
    { id: 'eggs', text: 'Collect {n} golden eggs', stat: 'eggs', kind: 'sum', ns: [3, 5, 8], reward: 35 },
    { id: 'daily', text: 'Play the Daily Garden', stat: 'dailyDone', kind: 'sum', ns: [1], reward: 40 },
    { id: 'time', text: 'Score {n} in Time Attack', stat: 'timeBest', kind: 'max', ns: [800, 1500, 2200], reward: 40 },
  ];
  const QUEST_BONUS = 60;

  /* scales for the n-th consecutive day (index = streak - 1, the last entry repeats) */
  const STREAK_GIFTS = [15, 20, 25, 30, 40, 50, 80];

  const STAT_ROWS = [
    ['fruit', 'Fruit eaten'], ['runs', 'Runs started'], ['playTime', 'Time played', 'time'], ['bestLength', 'Longest snake'],
    ['bestCombo', 'Best combo'], ['arcadeBest', 'Arcade best'], ['timeBest', 'Time Attack best'], ['levelsCleared', 'Story levels cleared'],
    ['guardians', 'Guardians freed'], ['stars', 'Story stars'], ['eggs', 'Golden eggs'], ['kills', 'Critters defeated'],
    ['powerups', 'Power-ups picked up'], ['venomHits', 'Venom hits'], ['tokens', 'Festival tokens'], ['zenTime', 'Time in Zen', 'time'],
    ['dailyDone', 'Daily Gardens'], ['deaths', 'Crashes'], ['scalesEarned', 'Scales earned'], ['bestStreak', 'Longest streak'],
  ];

  Object.assign(NS.goals, {
    ACHIEVEMENTS, QUESTS, QUEST_BONUS, STREAK_GIFTS, STAT_ROWS
  });
})();
