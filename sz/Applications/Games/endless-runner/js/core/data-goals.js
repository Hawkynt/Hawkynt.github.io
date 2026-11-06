/* Goals: thirty-four achievements (a test over the saved profile and a reward each) and the
   pool the three daily quests are drawn from (which day counter they watch, their range and
   reward). Pure data; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  function st(s, k) {
    return (s.stats && s.stats[k]) || 0;
  }

  function boss(id) {
    return s => !!(s.bosses && s.bosses[id]);
  }

  function starCount(s) {
    let n = 0;
    for (const k in s.stars || {}) n += s.stars[k] || 0;
    return n;
  }

  function treeLevels(s) {
    let n = 0;
    for (const k in s.tree || {}) n += s.tree[k] || 0;
    return n;
  }

  function owned(s) {
    return Object.keys(s.owned || {}).length;
  }

  const ACHIEVEMENTS = [
    { id: 'firstRun', name: 'First Steps', desc: 'Finish your first run', test: s => st(s, 'runs') >= 1, gems: 5 },
    { id: 'dist1k', name: 'Kilometre', desc: 'Run 1,000 m in one run', test: s => st(s, 'bestRun') >= 1000, gems: 10 },
    { id: 'dist3k', name: 'Marathoner', desc: 'Run 3,000 m in one run', test: s => st(s, 'bestRun') >= 3000, gems: 20 },
    { id: 'arcade5k', name: 'Unstoppable', desc: 'Run 5,000 m in Arcade', test: s => st(s, 'arcadeBest') >= 5000, gems: 40 },
    { id: 'coins1k', name: 'Pocket Money', desc: 'Collect 1,000 coins in total', test: s => st(s, 'coins') >= 1000, gems: 5 },
    { id: 'coins10k', name: 'Gold Rush', desc: 'Collect 10,000 coins in total', test: s => st(s, 'coins') >= 10000, gems: 20 },
    { id: 'coins50k', name: 'Tycoon', desc: 'Collect 50,000 coins in total', test: s => st(s, 'coins') >= 50000, gems: 50 },
    { id: 'gems100', name: 'Gem Collector', desc: 'Collect 100 gems on the course', test: s => st(s, 'gemsRun') >= 100, gems: 15 },
    { id: 'jumps1k', name: 'Hopper', desc: 'Jump 1,000 times', test: s => st(s, 'jumps') >= 1000, gems: 10 },
    { id: 'slides500', name: 'Low Rider', desc: 'Slide 500 times', test: s => st(s, 'slides') >= 500, gems: 10 },
    { id: 'dashes300', name: 'Zoom', desc: 'Dash 300 times', test: s => st(s, 'dashes') >= 300, gems: 10 },
    { id: 'near100', name: 'Close Shave', desc: 'Pull off 100 near misses', test: s => st(s, 'nears') >= 100, gems: 10 },
    { id: 'near1k', name: 'Untouchable', desc: 'Pull off 1,000 near misses', test: s => st(s, 'nears') >= 1000, gems: 30 },
    { id: 'smash200', name: 'Wrecking Ball', desc: 'Smash 200 obstacles', test: s => st(s, 'smashes') >= 200, gems: 15 },
    { id: 'powers50', name: 'Power Hungry', desc: 'Grab 50 power-ups', test: s => st(s, 'powers') >= 50, gems: 10 },
    { id: 'combo100', name: 'Combo Artist', desc: 'Reach a combo of 100', test: s => st(s, 'comboBest') >= 100, gems: 10 },
    { id: 'combo300', name: 'Frenzy', desc: 'Reach a combo of 300', test: s => st(s, 'comboBest') >= 300, gems: 30 },
    { id: 'boar', name: 'Boar Tamer', desc: 'Outrun Thornback', test: boss('boar'), gems: 15 },
    { id: 'wyrm', name: 'Wyrm Slayer', desc: 'Defeat the Dune Wyrm', test: boss('wyrm'), gems: 15 },
    { id: 'avalanche', name: 'Snow Dancer', desc: 'Outrun Rime\'s avalanche', test: boss('avalanche'), gems: 15 },
    { id: 'warden', name: 'System Override', desc: 'Defeat Warden Mk-II', test: boss('warden'), gems: 15 },
    { id: 'king', name: 'Beacon Relit', desc: 'Defeat the Hollow King', test: boss('king'), gems: 40 },
    { id: 'stars30', name: 'Star Collector', desc: 'Earn 30 stars', test: s => starCount(s) >= 30, gems: 20 },
    { id: 'stars75', name: 'Star Master', desc: 'Earn all 75 stars', test: s => starCount(s) >= 75, gems: 100 },
    { id: 'shards30', name: 'Shard Seeker', desc: 'Find 30 Spark Shards', test: s => st(s, 'shards') >= 30, gems: 20 },
    { id: 'daily7', name: 'Daily Devotion', desc: 'Play 7 Daily Runs', test: s => st(s, 'dailyRuns') >= 7, gems: 20 },
    { id: 'streak7', name: 'Week Streak', desc: 'Play 7 days in a row', test: s => (s.streak && s.streak.best || 0) >= 7, gems: 30 },
    { id: 'zen5k', name: 'Inner Peace', desc: 'Run 5,000 m in Zen', test: s => st(s, 'zenDist') >= 5000, gems: 10 },
    { id: 'level10', name: 'Veteran', desc: 'Reach runner level 10', test: s => (s.level || 1) >= 10, gems: 20 },
    { id: 'level25', name: 'Legend', desc: 'Reach runner level 25', test: s => (s.level || 1) >= 25, gems: 60 },
    { id: 'tree10', name: 'Engineer', desc: 'Buy 10 tech tree levels', test: s => treeLevels(s) >= 10, gems: 15 },
    { id: 'rush', name: 'Gauntlet', desc: 'Finish Boss Rush', test: s => st(s, 'rushWins') >= 1, gems: 40 },
    { id: 'festival', name: 'Festival Spirit', desc: 'Complete a festival reward track', test: s => st(s, 'festivals') >= 1, gems: 25 },
    { id: 'fashion', name: 'Fashionista', desc: 'Own 10 cosmetics', test: s => owned(s) >= 10, gems: 15 },
  ];

  /* daily quests: key is the day counter watched; max quests compare a best-of-day value */
  const QUESTS = [
    { id: 'coins', key: 'coins', text: n => 'Collect ' + n + ' coins', lo: 150, hi: 400, step: 50, reward: 120 },
    { id: 'dist', key: 'dist', text: n => 'Run ' + n + ' m in total', lo: 1500, hi: 4000, step: 500, reward: 140 },
    { id: 'runDist', key: 'runBest', max: true, text: n => 'Run ' + n + ' m in one run', lo: 600, hi: 1500, step: 100, reward: 160 },
    { id: 'jumps', key: 'jumps', text: n => 'Jump ' + n + ' times', lo: 60, hi: 150, step: 10, reward: 90 },
    { id: 'slides', key: 'slides', text: n => 'Slide ' + n + ' times', lo: 25, hi: 60, step: 5, reward: 90 },
    { id: 'dashes', key: 'dashes', text: n => 'Dash ' + n + ' times', lo: 15, hi: 40, step: 5, reward: 90 },
    { id: 'nears', key: 'nears', text: n => 'Pull off ' + n + ' near misses', lo: 10, hi: 30, step: 5, reward: 130 },
    { id: 'powers', key: 'powers', text: n => 'Grab ' + n + ' power-ups', lo: 4, hi: 10, step: 1, reward: 110 },
    { id: 'smash', key: 'smashes', text: n => 'Smash ' + n + ' obstacles', lo: 8, hi: 25, step: 1, reward: 110 },
    { id: 'gems', key: 'gems', text: n => 'Collect ' + n + ' gems', lo: 5, hi: 15, step: 1, reward: 130 },
    { id: 'stage', key: 'stages', text: n => 'Finish ' + n + ' story stage' + (n > 1 ? 's' : ''), lo: 1, hi: 3, step: 1, reward: 150 },
    { id: 'daily', key: 'daily', text: () => 'Play the Daily Run', lo: 1, hi: 1, step: 1, reward: 100 },
    { id: 'combo', key: 'combo', max: true, text: n => 'Reach a combo of ' + n, lo: 40, hi: 100, step: 10, reward: 140 },
  ];
  const QUEST_BY_ID = {};
  for (let i = 0; i < QUESTS.length; ++i) QUEST_BY_ID[QUESTS[i].id] = QUESTS[i];

  Object.assign(NS.goals, {
    ACHIEVEMENTS, QUESTS, QUEST_BY_ID, starCount, treeLevels
  });
})();
