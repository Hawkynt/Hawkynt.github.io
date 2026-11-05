'use strict';

global.window = {};
require('../js/core/course.js');

const C = window.SZ.FlappyCourse;
const GROUND_Y = 640, GATE_W = 72, MARGIN = 72, MIN_GAP = 110;
const EPS = 0.001;

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

/* Stages: 24 of them, unique ids, four per world, the fourth flagged final with a boss */
const ids = new Set(C.STAGES.map(s => s.id));
const perWorld = [];
for (let w = 0; w < 6; ++w)
  perWorld.push(C.STAGES.filter(s => s.world === w).length);
const finals = C.STAGES.filter(s => s.stage === 3);
const okStages = C.STAGES.length === 24 && ids.size === 24 &&
  perWorld.every(n => n === 4) && finals.length === 6 && finals.every(s => s.final === true) &&
  finals.map(s => s.boss).join() === C.BOSS_ORDER.join();
check('24 stages, unique ids, 4 per world, finals flagged', okStages,
  'len ' + C.STAGES.length + ' ids ' + ids.size + ' perWorld ' + JSON.stringify(perWorld) +
  ' finals ' + finals.length + '/' + finals.filter(s => s.final === true).length);

/* rng: same seed replays, values in [0, 1) */
const g1 = C.rng(42), g2 = C.rng(42);
const seq1 = [], seq2 = [];
for (let i = 0; i < 5; ++i) { seq1.push(g1()); seq2.push(g2()); }
const okRng = JSON.stringify(seq1) === JSON.stringify(seq2) && seq1.every(v => v >= 0 && v < 1);
check('rng(42) reproducible and in [0,1)', okRng, JSON.stringify(seq1));

/* Every stage with seeds 1..5: structure and bounds */
const bad = [];
const moveGates = [], closeGates = [];
for (const stage of C.STAGES) {
  for (let seed = 1; seed <= 5; ++seed) {
    const c = C.createCourse({ seed: seed, stage: stage });
    const tag = stage.id + '/' + seed;
    if (c.gates.length !== stage.gates)
      bad.push(tag + ' gate count ' + c.gates.length + ' want ' + stage.gates);
    for (let i = 1; i < c.gates.length; ++i)
      if (!(c.gates[i].x > c.gates[i - 1].x))
        bad.push(tag + ' gates not sorted at ' + i);
    for (const g of c.gates) {
      if (g.gapY - g.gap / 2 < MARGIN - EPS || g.gapY + g.gap / 2 > GROUND_Y - MARGIN + EPS)
        bad.push(tag + ' gate ' + g.index + ' gap ' + g.gapY + '/' + g.gap + ' out of bounds');
      if (g.move) {
        moveGates.push(g);
        if (g.gapY - g.move.amp < MARGIN + g.gap / 2 - EPS || g.gapY + g.move.amp > GROUND_Y - MARGIN - g.gap / 2 + EPS)
          bad.push(tag + ' gate ' + g.index + ' move amp ' + g.move.amp + ' out of bounds');
      }
      if (g.close) {
        closeGates.push(g);
        if (g.gap - g.close.amount < MIN_GAP)
          bad.push(tag + ' gate ' + g.index + ' close leaves gap ' + (g.gap - g.close.amount));
      }
    }
    const wantHazard = C.BIOMES[stage.biome].hazard;
    for (const h of c.hazards)
      if (h.type !== wantHazard && !(h.type === 'crow' && stage.crowChance > 0))
        bad.push(tag + ' hazard ' + h.type + ' want ' + wantHazard);
    if (!(c.totalCoins === c.coins.length && c.coins.length > 0))
      bad.push(tag + ' coins ' + c.coins.length + ' total ' + c.totalCoins);
    if (!(c.finishX > c.gates[c.gates.length - 1].x))
      bad.push(tag + ' finishX ' + c.finishX + ' last gate x ' + c.gates[c.gates.length - 1].x);
  }
}
check('stage courses: counts, order, gap/move/close bounds, hazards, coins, finish',
  bad.length === 0, bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' (+' + (bad.length - 5) + ' more)' : ''));

/* Determinism: same seed + stage replays, different seeds diverge */
const detStage = C.STAGES[7];
const ca = C.createCourse({ seed: 1234, stage: detStage });
const cb = C.createCourse({ seed: 1234, stage: detStage });
const sameJson = JSON.stringify([ca.gates, ca.coins, ca.hazards]) === JSON.stringify([cb.gates, cb.coins, cb.hazards]);
check('same seed + stage reproduces gates/coins/hazards', sameJson, 'JSON differs');
const cd = C.createCourse({ seed: 1235, stage: detStage });
check('different seed changes the gates', JSON.stringify(ca.gates) !== JSON.stringify(cd.gates), 'gates identical');

/* Endless: ensure grows, prune trims, biome rotates */
const ec = C.createCourse({ seed: 7 });
ec.ensure(20000);
check('endless ensure(20000) builds at least 50 gates', ec.gates.length >= 50, 'gates ' + ec.gates.length);
ec.prune(10000);
const oldest = ec.gates.length ? ec.gates[0].x : Infinity;
check('endless prune(10000) drops gates left of 9600', ec.gates.every(g => g.x >= 9600), 'oldest x ' + oldest);
check('endless biome rotates meadow -> desert',
  C.endlessParams(0).biome === 'meadow' && C.endlessParams(25).biome === 'desert',
  JSON.stringify([C.endlessParams(0).biome, C.endlessParams(25).biome]));

/* gateShape: moving and closing gates stay inside the bounds over 10 s */
const shapeBad = [];
for (const g of moveGates) {
  for (let t = 0; t <= 10.0001; t += 0.1) {
    const sh = C.gateShape(g, t);
    if (sh.y - sh.gap / 2 < MARGIN - EPS || sh.y + sh.gap / 2 > GROUND_Y - MARGIN + EPS)
      shapeBad.push('move gate ' + g.index + ' at t=' + t.toFixed(1) + ' y=' + sh.y);
  }
}
for (const g of closeGates) {
  for (let t = 0; t <= 10.0001; t += 0.1) {
    const sh = C.gateShape(g, t);
    if (sh.gap < MIN_GAP - EPS || sh.gap > g.gap + EPS)
      shapeBad.push('close gate ' + g.index + ' at t=' + t.toFixed(1) + ' gap=' + sh.gap);
    if (sh.y - sh.gap / 2 < MARGIN - EPS || sh.y + sh.gap / 2 > GROUND_Y - MARGIN + EPS)
      shapeBad.push('close gate ' + g.index + ' at t=' + t.toFixed(1) + ' y=' + sh.y);
  }
}
check('gateShape stays within bounds for move/close gates',
  shapeBad.length === 0 && moveGates.length > 0 && closeGates.length > 0,
  (shapeBad.length ? shapeBad.slice(0, 5).join('; ') : 'no violation') +
  ' (move gates ' + moveGates.length + ', close gates ' + closeGates.length + ')');

/* dailySeed: stable within a day, different the next day */
const d1 = C.dailySeed(new Date(2026, 9, 5));
const d2 = C.dailySeed(new Date(2026, 9, 5, 23));
const d3 = C.dailySeed(new Date(2026, 9, 6));
check('dailySeed stable within a day and differs next day', d1 === d2 && d1 !== d3,
  JSON.stringify([d1, d2, d3]));

/* Snapshot / restore: a restored endless course continues with exactly the same gates */
const sa = C.createCourse({ seed: 99, profile: 'arcade', tokenEvery: 5 });
sa.ensure(8000);
sa.coins[3].taken = true;
const snap = JSON.parse(JSON.stringify(sa.snapshot()));
sa.ensure(30000);
const sb = C.createCourse({ seed: 99, profile: 'arcade', tokenEvery: 5 });
sb.restore(snap);
sb.ensure(30000);
check('snapshot + restore continues the same endless course',
  JSON.stringify(sa.gates.map(g => [g.id, g.x, g.gapY])) === JSON.stringify(sb.gates.map(g => [g.id, g.x, g.gapY])) &&
  JSON.stringify(sa.hazards) === JSON.stringify(sb.hazards) && sb.coins[3].taken === true, 'courses diverge');

/* Tokens: every few gates, never on a hazard; ids unique over every object */
const tc = C.createCourse({ seed: 5, stage: C.STAGES[13], tokenEvery: 5 });
const near = (t) => tc.hazards.some(h => h.type !== 'gust' && Math.abs(h.x - t.x) < 40);
const objIds = [].concat(tc.gates, tc.coins, tc.bubbles, tc.hazards, tc.tokens).map(o => o.id);
check('tokens are placed behind every fifth gap, clear of hazards', tc.tokens.length === Math.floor((C.STAGES[13].gates + 2) / 5) && !tc.tokens.some(near), tc.tokens.length + ' tokens');
check('every course object has a unique id', new Set(objIds).size === objIds.length, objIds.length + " ids");

/* Bubbles cover all twelve power-ups */
const kinds = new Set();
for (let seed = 1; seed < 40; ++seed)
  for (const b of C.createCourse({ seed: seed, stage: C.STAGES[5] }).bubbles)
    kinds.add(b.kind);
check('bubbles roll all twelve power-up kinds', kinds.size === 12 && C.BUBBLE_KINDS.length === 12, [...kinds].join());

/* Laser gates: roomier, never closing */
let laserOk = true, lasers = 0;
for (let seed = 1; seed < 20; ++seed) {
  const lc = C.createCourse({ seed: seed, stage: C.STAGES[18] });
  for (const h of lc.hazards.filter(x => x.type === 'laser')) {
    ++lasers;
    const g = lc.gates.find(x => x.index === h.gate);
    if (!g || g.close || g.gap !== C.STAGES[18].gap + 30)
      laserOk = false;
  }
}
check('laser gates are 30 px roomier and never close', laserOk && lasers > 0, lasers + ' lasers');

process.exit(failures ? 1 : 0);
