'use strict';

/* Mission and wave generation: every campaign stage is valid and laid out safely, waves stay in
   budget and roster, endless escalates with bosses, the daily gauntlet is seeded, boss rush. */
const H = require('./harness');
H.installEnv();
const NS = H.load('systems/waves.js');
const { check, done } = H;
const W = NS.waves;
const { SECTORS, MISSIONS, MISSION_TYPES } = NS.campaign;
const { ENEMIES, BOSSES } = NS.enemyData;
const { makeRng } = NS.rng;

check('five sectors of six missions', SECTORS.length === 5 && MISSIONS.every(m => m.length === 6));
check('every sector ends with its own boss', MISSIONS.every((m, s) => m[5].type === 'boss' && m[5].boss === SECTORS[s].boss && BOSSES[m[5].boss].sector === s));
const types = new Set();
MISSIONS.forEach(m => m.forEach(x => types.add(x.type)));
check('six mission types are used', types.size === 6, [...types].join());
check('every sector mixes at least five mission types', MISSIONS.every(m => new Set(m.map(x => x.type)).size >= 5));
check('mission types are known', [...types].every(t => MISSION_TYPES[t]));

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
let bad = [];
for (let s = 0; s < 5; ++s) for (let i = 0; i < 6; ++i) {
  const st = W.campaignStage(s, i);
  const id = st.id;
  if (!(st.par > 0)) bad.push(id + ' par');
  if ((st.type === 'survive' || st.type === 'defend') && !(st.time > 0)) bad.push(id + ' time');
  if ((st.type === 'destroy' || st.type === 'collect') && !(st.n > 0)) bad.push(id + ' n');
  if (st.type === 'escort' && !(st.len > 0)) bad.push(id + ' len');
  if (!st.roster.every(t => ENEMIES[t])) bad.push(id + ' roster');
  if (!(st.budget > 0 && st.period > 0 && st.maxAlive > 0)) bad.push(id + ' spawner');
  const L = W.layoutStage(st);
  if (L.start.x < 200 || L.start.y < 200 || L.start.x > st.size - 200 || L.start.y > st.size - 200) bad.push(id + ' start edge');
  if (L.rocks.some(r => dist(r, L.start) < 300)) bad.push(id + ' rock on start');
  if (L.mines.some(m => dist(m, L.start) < 380)) bad.push(id + ' mine near start');
  if (L.hole && L.hole.pull && dist(L.hole, L.start) < 600) bad.push(id + ' hole near start');
  if (st.type === 'collect' && L.cores.length !== st.n) bad.push(id + ' cores ' + L.cores.length);
  if (st.type === 'collect' && L.cores.some(c => c.x < 100 || c.y < 100 || c.x > st.size - 100 || c.y > st.size - 100)) bad.push(id + ' core outside');
  if (st.type === 'collect' && L.hole && L.hole.pull && L.cores.some(c => dist(c, L.hole) < 250)) bad.push(id + ' core in the hole');
  if (st.type === 'destroy' && L.outposts.length !== st.n) bad.push(id + ' outposts');
  if (st.type === 'destroy' && L.outposts.some((o, k) => L.outposts.some((q, j) => j > k && dist(o, q) < 400))) bad.push(id + ' outposts overlap');
  if (st.type === 'escort' && (L.route.length < 3 || L.route.some(p => p.x < 100 || p.y < 100 || p.x > st.size - 100 || p.y > st.size - 100))) bad.push(id + ' route');
  if (st.type === 'defend' && !L.station) bad.push(id + ' station');
  if (L.mines.length !== st.hazards.mines || L.rocks.length < st.hazards.rocks * 0.8) bad.push(id + ' hazards placed ' + L.mines.length + '/' + L.rocks.length);
}
check('all 30 campaign stages are valid and safely laid out', bad.length === 0, bad.join('; '));

const a = W.layoutStage(W.campaignStage(3, 0)), b = W.layoutStage(W.campaignStage(3, 0));
check('layouts are deterministic', JSON.stringify(a) === JSON.stringify(b));
check('hard sectors are tougher', W.campaignStage(4, 2).hpMul > W.campaignStage(0, 2).hpMul && W.campaignStage(4, 2).budget > W.campaignStage(0, 0).budget);

/* wave composition */
const rng = makeRng(7);
let over = 0, offRoster = 0, empty = 0;
for (let k = 0; k < 300; ++k) {
  const roster = SECTORS[k % 5].roster;
  const budget = 3 + (k % 30);
  const g = W.composeWave(rng, roster, budget, k % 6);
  let cost = 0;
  for (const x of g) {
    cost += x.type === 'drone' ? x.count : ENEMIES[x.type].cost * x.count;
    if (roster.indexOf(x.type) < 0 || x.type === 'station' || x.type === 'turret') ++offRoster;
  }
  if (cost > budget) ++over;
  if (!g.length) ++empty;
}
check('waves never exceed their budget', over === 0, over);
check('waves only use roster ships (no outposts or sentries)', offRoster === 0, offRoster);
check('waves are never empty', empty === 0, empty);
const early = W.composeWave(makeRng(1), SECTORS[4].roster, 30, 0);
check('no carriers or frigates in the first wave', !early.some(x => x.type === 'carrier' || x.type === 'frigate'));

/* endless */
let rising = true, bossEvery5 = true;
for (let n = 1; n < 60; ++n) {
  const s0 = W.endlessStage(n), s1 = W.endlessStage(n + 1);
  if (s1.budget < s0.budget || s1.hpMul < s0.hpMul) rising = false;
  if ((n % 5 === 0) !== !!s0.boss) bossEvery5 = false;
}
check('endless difficulty only rises', rising);
check('endless has a boss on every fifth wave', bossEvery5);
check('endless scenery changes every five waves', W.endlessStage(5).sector === 0 && W.endlessStage(6).sector === 1 && W.endlessStage(26).sector === 0);
check('endless roster grows', W.endlessStage(12).roster.length > W.endlessStage(1).roster.length);

/* daily */
const d1 = W.dailyPlan('2026-10-18'), d2 = W.dailyPlan('2026-10-18'), d3 = W.dailyPlan('2026-10-19');
check('the daily plan is the same all day', JSON.stringify(d1) === JSON.stringify(d2));
let differs = false;
for (let i = 19; i < 30 && !differs; ++i) if (JSON.stringify(W.dailyPlan('2026-10-' + i)) !== JSON.stringify(d1)) differs = true;
check('the daily plan changes between days', differs && d3.day !== d1.day);
check('the daily gauntlet is four missions and a boss', d1.stages.length === 5 && d1.stages[4].type === 'boss' && d1.stages.slice(0, 4).every(s => s.type !== 'boss'));
check('the daily gauntlet uses one mutator', d1.stages.every(s => s.mutator === d1.mutator) && W.MUTATORS[d1.mutator]);
check('daily missions have distinct types', new Set(d1.stages.slice(0, 4).map(s => s.type)).size === 4);

/* boss rush */
const br = W.bossRushPlan();
check('boss rush fights all five bosses in their sectors', br.stages.length === 5 && br.stages.every(s => s.type === 'boss' && BOSSES[s.boss].sector === s.sector));

done();
