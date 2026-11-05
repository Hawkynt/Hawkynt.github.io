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

const { PF_W, PF_H } = NS.constants;
const inField = (q, m) => q.x >= m && q.x <= PF_W - m && q.y >= m && q.y <= PF_H - m;
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
  if (!inField(L.start, 40) || L.start.y < PF_H * 0.6) bad.push(id + ' start not low in the field');
  if (L.rocks.some(r => !inField(r, 20) || Math.abs(r.x - L.start.x) < 100)) bad.push(id + ' rock in the start lane');
  if (st.type === 'collect' && (L.cores.length !== st.n || L.cores.some(c => c.x < 60 || c.x > PF_W - 60 || !(c.at > 0)))) bad.push(id + ' cores');
  if (st.type === 'destroy' && (L.outposts.length !== st.n || L.outposts.some(o => o.x < 100 || o.x > PF_W - 100))) bad.push(id + ' outposts');
  if (st.type === 'escort' && !(L.convoy && inField(L.convoy, 60))) bad.push(id + ' convoy');
  if (st.type === 'defend' && !(L.station && L.station.y > PF_H * 0.8)) bad.push(id + ' station');
  if (L.turrets !== (st.roster.indexOf('turret') >= 0)) bad.push(id + ' terrain sentries');
}
check('all 30 campaign stages are valid and laid out inside the play field', bad.length === 0, bad.join('; '));
const schedule = W.layoutStage(W.campaignStage(1, 3)).cores.map(c => c.at);
check('data cores arrive one after another', schedule.every((t, k) => k === 0 || t > schedule[k - 1]));

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
