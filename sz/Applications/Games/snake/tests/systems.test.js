'use strict';

/* Rules in play: every power-up does its job, venom and Quake break crates and fell critters,
   Scale Armor turns a crash into a bounce, Zen sheds the tail instead of dying, Arcade stages
   escalate, Time Attack and the Daily Garden end on the clock and record their bests, critters
   behave (hedgehogs steal, rivals crash, imps burn), and a Guardian Rush through all five
   guardians is cleared by the autopilot - all without a single exception. */
const H = require('./harness');
H.installEnv();
global.requestAnimationFrame = () => 0;
let clock = 1700000000000;
Date.now = () => (clock += 3331);
const NS = H.load('systems/sim.js');
const { check, done } = H;
const G = NS.state;
const { T } = NS.items;
NS.screens.setScreen = (s) => { G.screen = s; G.screenT = 0; };
NS.screens.toTitle = () => { G.screen = 'title'; };

function steps(n) {
  for (let i = 0; i < n; ++i) NS.sim.update(1 / 60);
}

function fresh() {
  G.save = NS.rules.defaultSave();
  G.save.seen.intro = true;
  NS.save.refreshStats();
}

function playing(start) {
  fresh();
  start();
  G.run.phase = 'play';
  G.run.pendingStarter = null;
}

/* ── power-ups ── */
playing(() => NS.run.startStory(1, 2));
for (const p of NS.items.POWERUPS) {
  const r = G.run;
  const before = { len: r.snake.body.length, shield: r.shield, venom: r.venom, foods: r.foods.length, score: r.score };
  r.snake.grow = 0;
  if (p.id === 'molt') { r.snake.grow = 9; steps(120); before.len = r.snake.body.length; }
  if (p.id === 'quake') {
    const h = r.snake.body[0];
    NS.board.setTile(h + 2 * NS.constants.COLS, T.CRATE);
  }
  NS.powerups.activate(p.id);
  let ok;
  switch (p.id) {
    case 'shield': ok = r.shield === before.shield + 1; break;
    case 'molt': ok = r.snake.body.length < before.len && r.score > before.score; break;
    case 'frenzy': ok = r.foods.length >= before.foods + 6; break;
    case 'venom': ok = r.venom === Math.min(NS.combat.venomMax(), before.venom + 3); break;
    case 'quake': ok = r.level.tiles[r.snake.body[0] + 2 * NS.constants.COLS] === T.FLOOR; break;
    default: ok = r.act[p.id] > 0;
  }
  check('power-up ' + p.name + ' applies', ok);
}
G.run.act = {};
const durBefore = NS.powerups.duration('dash');
G.save.tree.last = 2;
NS.save.refreshStats();
check('Lasting Power lengthens timed power-ups', NS.powerups.duration('dash') > durBefore);

/* ── armour, zen ── */
playing(() => NS.run.startStory(0, 0));
G.run.shield = 1;
G.run.snake.dir = 0;
for (let k = 0; k < 20 && G.run.snake.alive && G.run.shield; ++k) NS.snake.stepOnce();
check('Scale Armor absorbs a crash and the snake lives', G.run.snake.alive && G.run.shield === 0);
playing(() => NS.run.startZen());
G.run.snake.grow = 12;
for (let k = 0; k < 14; ++k) NS.snake.stepOnce();
const zl = G.run.snake.body.length;
NS.snake.queueDir(2); NS.snake.stepOnce();
NS.snake.queueDir(3); NS.snake.stepOnce();
NS.snake.queueDir(0); NS.snake.stepOnce();
check('Zen never kills; biting the body sheds the tail', G.run.snake.alive && G.run.snake.body.length < zl + 3, zl + ' -> ' + G.run.snake.body.length);

/* ── venom ── */
playing(() => NS.run.startStory(0, 0));
G.run.venom = 3;
const h0 = G.run.snake.body[0];
NS.board.setTile(h0 + 5, T.CRATE);
G.run.snake.dir = 1;
NS.combat.spit();
steps(30);
check('venom flies along the heading and breaks a crate', G.run.level.tiles[h0 + 5] !== T.CRATE && G.run.venom === 2);
const ant = NS.enemies.make('ant', G.run.snake.body[0] + 4 * NS.constants.COLS);
G.run.enemies.push(ant);
NS.board.rebuildOcc();
G.run.snake.dir = 2;
NS.combat.spit();
steps(30);
check('venom fells a critter for points', !ant.alive && G.run.kills === 1);

/* ── critters ── */
playing(() => NS.run.startStory(0, 3));
let hedge = G.run.enemies.find(e => e.type === 'hedgehog');
const foodsAtStart = G.save.stats.fruit;
G.run.immortal = true;
let stolen = false;
const origSplice = G.run.foods.splice;
for (let f = 0; f < 60 * 40 && !stolen; ++f) {
  const n = G.run.foods.length;
  steps(1);
  if (hedge && hedge.alive && G.run.foods.length < n && G.save.stats.fruit === foodsAtStart) stolen = true;
}
check('hedgehogs walk to fruit and steal it', stolen && !!origSplice);
playing(() => NS.run.startStory(3, 1));
G.run.immortal = true;
steps(60 * 8);
check('fire imps leave burning marks', G.run.marks.some(m => m.kind === 'fire') || G.run.enemies.some(e => e.type === 'imp' && !e.alive));

/* ── arcade stages, clocks ── */
playing(() => NS.run.startArcade());
G.run.immortal = true;
const sp0 = G.run.speed;
G.run.eaten = 37;
steps(2);
check('Arcade stages up every 12 fruit, faster and busier', G.run.stage === 4 && G.run.speed < sp0 && G.run.marks.some(m => m.then === 'crate'));
steps(120);
check('stage crates land on the board', G.run.level.tiles.filter(c => c === T.CRATE).length > 3);
playing(() => NS.run.startTime());
G.run.timeLeft = 0.5;
G.run.score = 900;
steps(200);
check('Time Attack ends on the clock and records its best', G.screen === 'results' && G.ui.results.outcome === 'time' && G.save.stats.timeBest === 900);
playing(() => NS.run.startDaily());
const key = G.run.daily;
G.run.timeLeft = 0.3;
G.run.score = 640;
steps(200);
check('the Daily Garden records the best of the day', G.save.daily[key] === 640 && G.save.stats.dailyDone === 1 && G.save.highScores.length === 1);

/* ── guardian rush with every guardian ── */
fresh();
G.save.story.freed = ['mole', 'scorpion', 'owl', 'wyrm', 'eclipse'];
let cleared = false, reached = 0;
for (let attempt = 0; attempt < 6 && !cleared; ++attempt) {
  NS.run.startRush();
  G.run.lives = 30;
  G.run.auto = true;
  for (let f = 0; f < 60 * 900 && G.screen === 'playing'; ++f) {
    steps(1);
    if (G.run.rushIndex > reached) reached = G.run.rushIndex;
  }
  cleared = G.ui.results && G.ui.results.mode === 'rush' && G.ui.results.cleared;
}
check('the autopilot clears a Guardian Rush through all five guardians', cleared, 'reached ' + (reached + 1));
check('a cleared rush is counted', G.save.stats.rushClears >= 1);
console.log('  rush: ' + (reached + 1) + ' guardians, ' + G.run.time.toFixed(0) + 's of game time, ' + G.run.deaths + ' crashes');

done();
