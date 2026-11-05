/* Static goal data: 35 achievements, each a lifetime statistic reaching a goal with a stardust
   reward; the daily quest pool (three are drawn each day); the lifetime statistics shown on the
   records page. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  function A(id, name, desc, icon, stat, goal, dust) {
    return { id: id, name: name, desc: desc, icon: icon, stat: stat, goal: goal, dust: dust };
  }

  const ACHIEVEMENTS = [
    A('first', 'First Contact', 'Shatter your first rock.', 'rock', 'rocks', 1, 20),
    A('rocks100', 'Gravel Maker', 'Shatter 100 rocks.', 'rock', 'rocks', 100, 60),
    A('rocks1000', 'Belt Breaker', 'Shatter 1,000 rocks.', 'rock', 'rocks', 1000, 200),
    A('rocks10000', 'Planet Eater', 'Shatter 10,000 rocks.', 'rock', 'rocks', 10000, 800),
    A('raiders50', 'Raider Bane', 'Destroy 50 raiders.', 'saucer', 'raiders', 50, 120),
    A('raiders500', 'Ace of the Belt', 'Destroy 500 raiders.', 'saucer', 'raiders', 500, 500),
    A('boss1', 'Titan Slayer', 'Defeat a titan.', 'skull', 'bosses', 1, 150),
    A('bossAll', 'Pantheon', 'Defeat all five titans.', 'skull', 'bossKinds', 5, 600),
    A('ch1', 'Out of the Drift', 'Finish Chapter I.', 'book', 'chapters', 1, 100),
    A('ch3', 'Through the Glass', 'Finish Chapter III.', 'book', 'chapters', 3, 250),
    A('story', 'Starfall', 'Finish the story.', 'book', 'chapters', 5, 1000),
    A('stars30', 'Rising Star', 'Earn 30 story stars.', 'star', 'stars', 30, 200),
    A('stars90', 'Constellation', 'Earn all 90 story stars.', 'star', 'stars', 90, 1500),
    A('combo25', 'Chain Reaction', 'Reach a 25 combo.', 'double', 'bestCombo', 25, 80),
    A('combo50', 'Avalanche', 'Reach a 50 combo.', 'double', 'bestCombo', 50, 200),
    A('combo100', 'Unbroken', 'Reach a 100 combo.', 'double', 'bestCombo', 100, 500),
    A('arcade25k', 'High Scorer', 'Score 25,000 in Arcade.', 'star', 'arcadeBest', 25000, 100),
    A('arcade100k', 'Leaderboard', 'Score 100,000 in Arcade.', 'star', 'arcadeBest', 100000, 300),
    A('arcade250k', 'Legend', 'Score 250,000 in Arcade.', 'star', 'arcadeBest', 250000, 800),
    A('wave10', 'Holding the Line', 'Reach Arcade wave 10.', 'wave', 'arcadeWave', 10, 120),
    A('wave25', 'Endless Night', 'Reach Arcade wave 25.', 'wave', 'arcadeWave', 25, 500),
    A('zen10', 'Still Waters', 'Spend 10 minutes in Zen.', 'lotus', 'zenTime', 600, 150),
    A('daily1', 'Daily Pilot', 'Fly a Daily challenge.', 'calendar', 'dailies', 1, 50),
    A('daily7', 'Regular', 'Fly 7 Daily challenges.', 'calendar', 'dailies', 7, 250),
    A('streak3', 'Habit', 'Play 3 days in a row.', 'flame', 'bestStreak', 3, 100),
    A('streak7', 'Devotion', 'Play 7 days in a row.', 'flame', 'bestStreak', 7, 400),
    A('power50', 'Gadgeteer', 'Collect 50 power-ups.', 'shield', 'powerups', 50, 120),
    A('nova10', 'Supernova', 'Detonate 10 Nova Bombs.', 'nova', 'novas', 10, 150),
    A('rich', 'Stardust Baron', 'Earn 10,000 stardust in total.', 'dust', 'dustEarned', 10000, 300),
    A('tree10', 'Engineer', 'Buy 10 tech tree levels.', 'gun', 'treeLevels', 10, 150),
    A('tree40', 'Master Engineer', 'Buy 40 tech tree levels.', 'gun', 'treeLevels', 40, 600),
    A('collector', 'Collector', 'Own 12 cosmetics.', 'brush', 'cosmetics', 12, 300),
    A('tokens50', 'Festive', 'Collect 50 seasonal tokens.', 'gift', 'tokens', 50, 200),
    A('rescue25', 'Lifeline', 'Rescue 25 escape pods.', 'pod', 'pods', 25, 200),
    A('flawless10', 'Untouchable', 'Finish 10 levels without losing a ship.', 'heart', 'flawless', 10, 300),
  ];

  /* daily quests: one of the goals is picked by the day's seed */
  const QUESTS = [
    { id: 'q_rocks', text: 'Shatter {n} rocks', stat: 'rocks', goals: [80, 150, 250], dust: 90 },
    { id: 'q_raiders', text: 'Destroy {n} raiders', stat: 'raiders', goals: [8, 15, 25], dust: 110 },
    { id: 'q_power', text: 'Collect {n} power-ups', stat: 'powerups', goals: [6, 10, 15], dust: 90 },
    { id: 'q_dust', text: 'Gather {n} stardust', stat: 'dustEarned', goals: [300, 600, 1000], dust: 100 },
    { id: 'q_combo', text: 'Reach a {n} combo', stat: 'comboPeak', goals: [15, 25, 40], dust: 120, peak: true },
    { id: 'q_levels', text: 'Clear {n} story levels', stat: 'levels', goals: [2, 3, 5], dust: 130 },
    { id: 'q_arcade', text: 'Score {n} in one Arcade run', stat: 'arcadePeak', goals: [10000, 25000, 50000], dust: 130, peak: true },
    { id: 'q_zen', text: 'Drift {n} minutes in Zen', stat: 'zenMinutes', goals: [3, 5, 8], dust: 80 },
    { id: 'q_gold', text: 'Crack {n} gold rocks', stat: 'gold', goals: [4, 8, 12], dust: 110 },
    { id: 'q_over', text: 'Unleash overdrive {n} times', stat: 'overdrives', goals: [3, 6, 10], dust: 100 },
    { id: 'q_tokens', text: 'Collect {n} seasonal tokens', stat: 'tokens', goals: [5, 10, 15], dust: 120 },
    { id: 'q_boss', text: 'Defeat {n} titan', stat: 'bosses', goals: [1, 1, 2], dust: 160 },
  ];

  /* the records page: [stat, label, format] */
  const STAT_LINES = [
    ['playTime', 'Time in flight', 'time'], ['runs', 'Runs flown', 'n'], ['rocks', 'Rocks shattered', 'n'],
    ['raiders', 'Raiders destroyed', 'n'], ['bosses', 'Titans defeated', 'n'], ['shots', 'Shots fired', 'n'],
    ['powerups', 'Power-ups collected', 'n'], ['novas', 'Nova Bombs', 'n'], ['overdrives', 'Overdrives', 'n'],
    ['hypers', 'Hyperspace jumps', 'n'], ['deaths', 'Ships lost', 'n'], ['pods', 'Pods rescued', 'n'],
    ['dustEarned', 'Stardust earned', 'n'], ['bestCombo', 'Best combo', 'n'], ['arcadeBest', 'Best Arcade score', 'n'],
    ['arcadeWave', 'Best Arcade wave', 'n'], ['zenTime', 'Time in Zen', 'time'], ['dailies', 'Dailies flown', 'n'],
    ['bestStreak', 'Longest daily streak', 'n'], ['tokens', 'Seasonal tokens', 'n'], ['distance', 'Distance flown (km)', 'km'],
  ];

  Object.assign(NS.goalData, {
    ACHIEVEMENTS, QUESTS, STAT_LINES
  });
})();
