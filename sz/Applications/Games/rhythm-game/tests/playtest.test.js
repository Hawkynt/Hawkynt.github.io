'use strict';

/* The difficulty curve, played: four bot players with human-like hands (pro, regular, casual,
   rookie: timing spread, reading speed, lapses, Hush presses, early hold releases) play every story
   stage four times. The story must grow harder step by step and stay interesting: the calibrated
   difficulty hits each stage's target, the pro clears everything, the regular player clears almost
   everything, the casual player clears the first two districts and finds the Crown Spire too hard,
   the rookie clears the Neon Docks and is out of depth in the Undertow Club, every duel is a peak of
   its district, every new district opens easier than the duel before it, no stage is a cliff (a
   sudden drop for the casual player) and notes per second rise across the districts. PRINT=1 prints
   the table. */
const H = require('./harness');
H.installEnv();
const NS = H.load('data-worlds.js');
const { check, done } = H;
const W = NS.worldData, E = NS.engine;
const PROFILES = ['pro', 'regular', 'casual', 'rookie'];

const rows = [];
for (const st of W.STAGES) {
  const c = W.stageChart(st);
  const row = { st: st, c: c, ref: W.referenceAccuracy(c, st.boss), wins: {}, acc: {} };
  for (const p of PROFILES) {
    let wins = 0, acc = 0;
    for (let k = 1; k <= 4; ++k) {
      const s = NS.bot.run(c, { boss: st.boss }, p, k * 31 + st.index);
      if (!s.failed) ++wins;
      acc += E.accuracy(NS.bot.run(c, { noFail: true, boss: st.boss }, p, k * 31 + st.index));
    }
    row.wins[p] = wins;
    row.acc[p] = acc / 4;
  }
  rows.push(row);
  if (process.env.PRINT) console.log(st.id.padEnd(10), 'L' + W.stageLevel(st).toFixed(2), 'T' + st.target, 'ref ' + (row.ref * 100).toFixed(0), 'nps ' + c.nps.toFixed(1),
    PROFILES.map(p => p + ' ' + row.wins[p] + '/4 ' + (row.acc[p] * 100).toFixed(0) + '%').join(' | '));
}
const byWorld = w => rows.filter(r => r.st.world === w);
const cleared = (p, r) => r.wins[p] >= 3;

check('every stage\'s difficulty hits its target within 4 points', rows.every(r => Math.abs(r.ref - r.st.target) < 0.04), rows.filter(r => Math.abs(r.ref - r.st.target) >= 0.04).map(r => r.st.id + ' ' + r.ref.toFixed(3)).join(', '));
check('the pro clears every stage', rows.every(r => r.wins.pro === 4), rows.filter(r => r.wins.pro < 4).map(r => r.st.id).join(', '));
check('the regular player clears at least 28 of 30', rows.filter(r => cleared('regular', r)).length >= 28);
check('the casual player clears the Neon Docks and the Glass Gardens', byWorld(0).concat(byWorld(1)).every(r => cleared('casual', r)));
check('the Crown Spire is too hard for the casual player', byWorld(4).filter(r => !cleared('casual', r)).length >= 4);
check('the rookie clears the Neon Docks', byWorld(0).every(r => cleared('rookie', r)));
check('and is out of depth in the Undertow Club and the Crown Spire', byWorld(3).concat(byWorld(4)).every(r => r.wins.rookie <= 1));
let peaks = true, relief = true, cliff = [], rise = true;
for (let w = 0; w < 5; ++w) {
  const list = byWorld(w);
  const boss = list[5];
  for (let s = 0; s < 5; ++s) if (boss.ref > list[s].ref + 0.005) peaks = false;
  if (w < 4 && byWorld(w + 1)[0].ref <= boss.ref) relief = false;
  if (w > 0) {
    const nps = l => l.reduce((a, r) => a + r.c.nps, 0) / l.length;
    if (nps(list) <= nps(byWorld(w - 1))) rise = false;
  }
}
for (let i = 1; i < rows.length; ++i) if (rows[i - 1].acc.casual - rows[i].acc.casual > 0.12) cliff.push(rows[i].st.id);
check('every duel is the hardest stage of its district', peaks);
check('every district opens easier than the duel before it', relief);
check('no stage is a cliff for the casual player (at most 12 points harder than the one before)', cliff.length === 0, cliff.join(', '));
check('notes per second rise from district to district', rise);
check('the casual player\'s accuracy falls across the story', byWorld(4).reduce((a, r) => a + r.acc.casual, 0) < byWorld(0).reduce((a, r) => a + r.acc.casual, 0) - 1.5);
done();
