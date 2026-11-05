'use strict';

/* Every story stage, the boss arenas, the first 120 pipes of the endless profiles and a
   month of Daily Challenge courses are flown by the rollout bot (tests/flight-bot.js) with
   the base bird. A clean finish proves the course can be completed without upgrades. */
global.window = {};
require('../js/core/course.js');
require('../js/core/hazards.js');
require('../js/core/boss.js');
require('../js/core/seasons.js');
const SZ = window.SZ;
const C = SZ.FlappyCourse;
const { makeBot } = require('./flight-bot');
const H = require('./harness');
const { check, done } = H;

const quick = process.argv.indexOf('--quick') >= 0;

for (let i = 0; i < C.STAGES.length; ++i) {
  const st = C.STAGES[i];
  if (quick && i % 4 !== 0 && i % 4 !== 3)
    continue;
  const course = C.createCourse({ seed: C.hashSeed(st.id), stage: st, bubbleEvery: 6, tokenEvery: 5 });
  const bot = makeBot(SZ, course, st.speed, st.boss ? { boss: st.boss, seed: C.hashSeed(st.id) ^ 0x5bd1e995, maxHits: 2, bossOpts: { orbRate: 1, hpScale: 1 } } : {});
  const t0 = Date.now();
  const r = bot.fly(60 * 60 * 4);
  check('stage ' + st.id + (st.boss ? ' (boss ' + st.boss + ')' : '') + ' completable', r.result === 'win' && r.hits <= (st.boss ? 2 : 0),
    JSON.stringify(r));
  if (r.result === 'win')
    console.log('     ' + st.id + ': ' + (r.frames / 60).toFixed(1) + ' s flown, ' + r.hits + ' hits' + (st.boss ? ', ' + r.orbs + ' sun orbs' : '') + ' (' + (Date.now() - t0) + ' ms)');
}

for (const profile of ['endless', 'zen', 'arcade']) {
  const course = C.createCourse({ seed: 1234, profile: profile, bubbleEvery: 7, tokenEvery: 5 });
  // the endless speed rises with the score, as in the game
  // the arcade ramp is steep: past 90 pipes the bot needs its deep search
  const deep = profile === 'arcade' && !quick ? { searchBudget: 1500000, searchDepth: 150 } : {};
  const bot = makeBot(SZ, course, n => C.endlessParams(n, profile).speed, Object.assign({ gates: quick ? 60 : 120 }, deep));
  const r = bot.fly(60 * 60 * 10);
  check(profile + ' course: first ' + (quick ? 60 : 120) + ' pipes flyable', r.result === 'win' && r.hits === 0, JSON.stringify(r));
}

const days = quick ? 5 : 30;
let dailyOk = 0;
for (let d = 0; d < days; ++d) {
  const date = new Date(2026, 0, 1 + d * 11);
  const tw = SZ.FlappySeasons.dailyTwist(date);
  const mods = tw.mods || (tw.gusts ? { hazardBoost: 0.2 } : null);
  const course = C.createCourse({ seed: C.dailySeed(date), profile: 'endless', mods: mods, tokenEvery: 5 });
  const speed = n => C.endlessParams(n).speed * (mods && mods.speedScale ? mods.speedScale : 1);
  const r = makeBot(SZ, course, speed, { gates: 40 }).fly(60 * 60 * 5);
  if (r.result === 'win' && r.hits === 0)
    ++dailyOk;
  else
    console.log('     daily ' + C.dateKey(date) + ' (' + tw.id + '): ' + JSON.stringify(r));
}
check('Daily Challenge courses (' + days + ' dates, first 40 pipes) flyable', dailyOk === days, dailyOk + ' / ' + days);

done();
