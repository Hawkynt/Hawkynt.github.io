'use strict';

/* Saving: the old game's high scores and options carry over into the v2 profile (and the old
   keys are left in place), a stored v2 profile loads with new fields filled in, and an autosaved
   run restores exactly - after a JSON round trip through localStorage, the restored run plays on
   identically to the original, step for step. */
const H = require('./harness');
const env = H.installEnv();
global.requestAnimationFrame = () => 0;
let clock = 1700000000000;
Date.now = () => (clock += 1000);
env.store['sz-snake-high-scores'] = JSON.stringify([{ score: 340, length: 21 }, { score: 120, length: 9 }]);
env.store['sz-snake-config'] = JSON.stringify({ walls: 'wrap', obstacles: 'none', enemies: 2, powerups: false, fieldSize: 'medium', speed: 'fast', visualTheme: 'tron' });
const NS = H.load('systems/sim.js');
const { check, done } = H;
const G = NS.state;
NS.screens.setScreen = (s) => { G.screen = s; };
NS.screens.toTitle = () => { G.screen = 'title'; };

/* ── migration from the old keys ── */
const s = G.save;
check('old high scores become Classic entries', s.highScores.length === 2 && s.highScores[0].score === 340 && s.highScores[0].mode === 'Classic' && s.highScores[0].detail === 'length 21');
check('the old Tron preset becomes the Light Cycle skin, equipped', s.owned.skin.tron && s.equip.skin === 'tron');
check('veterans get the Pocket LCD board', s.legacy && s.owned.board.nokia);
check('the old keys are kept', env.store['sz-snake-high-scores'] && env.store['sz-snake-config']);
check('the v2 profile is written', !!env.store['sz-snake-save-v2'] && JSON.parse(env.store['sz-snake-save-v2']).v === 2);

/* a stored v2 profile wins over the old keys and gains missing fields */
env.store['sz-snake-save-v2'] = JSON.stringify({ v: 2, scales: 77, tree: { hide: 1 }, stats: { fruit: 5 }, owned: { skin: { garden: 1 }, trail: { none: 1 }, hat: { none: 1 }, board: { season: 1 } }, equip: { skin: 'garden', trail: 'none', hat: 'none', board: 'season' } });
const loaded = NS.save.loadSave();
check('a v2 profile loads as stored', loaded.scales === 77 && loaded.tree.hide === 1 && loaded.highScores.length === 0);
check('missing fields are filled from the defaults', loaded.stats.fruit === 5 && loaded.stats.bestCombo === 0 && Array.isArray(loaded.story.freed) && loaded.quests && loaded.events);
check('a broken profile falls back to a fresh one', (() => { env.store['sz-snake-save-v2'] = '{oops'; const l = NS.save.loadSave(); return l.v === 2 && l.scales === 0; })());
env.store['sz-snake-save-v2'] = JSON.stringify(s);

/* ── run snapshots ── */
function digest() {
  const r = G.run;
  return JSON.stringify([r.snake.body, r.snake.dir, r.foods.map(f => [f.i, f.kind]), r.enemies.map(e => [e.type, e.i, e.alive]), r.score, r.eaten, r.power, r.marks.length, r.boss && [r.boss.i, r.boss.hp, r.boss.state], G.rng.s]);
}

function steps(n) {
  for (let k = 0; k < n; ++k) NS.sim.update(1 / 60);
}

for (const [label, start] of [['story level 2-4', () => NS.run.startStory(1, 3)], ['guardian fight 1-6', () => NS.run.startStory(0, 5)], ['arcade', () => NS.run.startArcade()]]) {
  G.save = NS.rules.defaultSave();
  G.save.seen.intro = true;
  NS.save.refreshStats();
  start();
  G.run.auto = true;
  steps(60 * 12);
  check(label + ': the run is live', G.screen === 'playing' && G.run.time > 10, G.screen + ' ' + G.run.time);
  NS.save.writeRun();
  const raw = env.store['sz-snake-run-v2'];
  check(label + ': the autosave is written', !!raw);
  steps(60 * 8);
  const expect = digest();
  /* restore the snapshot as a page reload would */
  env.store['sz-snake-run-v2'] = raw;
  const snap = NS.save.readRun();
  NS.run.restore(snap);
  check(label + ': it comes back paused', G.screen === 'paused');
  G.screen = 'playing';
  G.run.auto = true;
  steps(60 * 8);
  check(label + ': the restored run plays on identically', digest() === expect);
}

/* the title offers Continue, and ending the run clears it */
check('a saved run is offered', !!NS.save.readRun());
NS.run.abandon();
check('ending a run clears the autosave and pays out', !NS.save.readRun() && G.screen === 'results' && G.ui.results.outcome === 'quit');

/* Save & Quit keeps it */
NS.run.startZen();
steps(120);
NS.run.saveAndQuit();
const z = NS.save.readRun();
check('Save & Quit leaves a Zen run to continue', z && z.mode === 'zen' && G.screen === 'title');

done();
