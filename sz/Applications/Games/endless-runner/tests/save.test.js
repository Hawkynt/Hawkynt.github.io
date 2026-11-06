'use strict';

/* Saving: the old game's keys (high scores, coin total, tutorial flag) migrate into the v2
   profile on first launch and stay untouched; a run autosaves while playing and on pause; after
   a full reload the title offers Continue and the run comes back exactly where it was; finishing
   a run clears the snapshot; a corrupt snapshot is ignored. */
const path = require('path');
const H = require('./harness');
const { check, done } = H;

function boot(store) {
  for (const k of Object.keys(require.cache)) if (k.indexOf(path.join('endless-runner', 'js')) >= 0) delete require.cache[k];
  if (global.window && window.SZ) delete window.SZ.EndlessRunner;
  const env = H.installEnv();
  global.requestAnimationFrame = () => 0;
  for (const k in store) env.store[k] = store[k];
  const NS = H.load();
  return { env, NS, G: NS.state };
}

function key(env, code, up) {
  for (const f of env.listeners[up ? 'keyup' : 'keydown'] || []) f({ code: code, key: code, preventDefault() {}, repeat: false });
}

/* 1: first launch over the old game's data */
const old = {
  'sz-endless-runner-highscores': JSON.stringify([{ distance: 1520, coins: 40 }, { distance: 300.7, coins: 3 }]),
  'sz-endless-runner-coins': '777',
  'sz-endless-runner-tutorial-seen': '1',
};
let { env, NS, G } = boot(old);
check('old coin total becomes the wallet (plus the first-day streak gift)', G.save.coins === 777 + 40);
check('old high scores become Classic entries', G.save.scores.length === 2 && G.save.scores[0].mode === 'classic' && G.save.scores[0].dist === 1520 && G.save.scores[0].score === 1520 + 400);
check('old best distance seeds the Arcade best', G.save.stats.arcadeBest === 1520 && G.save.stats.bestRun === 1520);
check('the tutorial flag carries over', G.save.seen.help === 1);
check('old keys are left in place', env.store['sz-endless-runner-coins'] === '777');
check('the v2 profile is written at once', JSON.parse(env.store['sz-endless-runner-save-v2']).v === 2);
check('a first visit opens with the intro', G.screen === 'cine' && G.cine.id === 'intro');
key(env, 'Escape');
check('Escape skips to the title', G.screen === 'title');

/* 2: play, autosave */
NS.run.start('story', { stageId: 'meadow-2' });
for (let i = 0; i < 60 * 6; ++i) {
  if (i % 30 === 0) key(env, 'Space');
  NS.sim.update(1 / 60);
  if (G.run.phase !== 'play' && G.run.phase !== 'ready') break;
}
check('the run is going', G.run.phase === 'play' && G.run.p.x > 1500, G.run.phase);
check('it autosaved while playing', !!env.store['sz-endless-runner-run-v2']);
key(env, 'Escape');
check('Escape pauses', G.screen === 'paused');
const snap = { x: G.run.p.x, score: G.run.score, coins: G.run.coins, hz: G.run.course.hz.length, stage: G.run.stageId };

/* 3: reload the page */
const store = Object.assign({}, env.store);
({ env, NS, G } = boot(store));
check('after a reload the title offers Continue', G.screen === 'title' && NS.save.peekRun() && NS.save.peekRun().mode === 'story');
NS.screens.continueRun();
check('Continue restores the run exactly', G.screen === 'playing' && G.run.p.x === snap.x && G.run.score === snap.score &&
  G.run.coins === snap.coins && G.run.course.hz.length === snap.hz && G.run.stageId === snap.stage);
check('it resumes with a ready count', G.run.phase === 'ready');
for (let i = 0; i < 120; ++i) NS.sim.update(1 / 60);
check('and runs on', G.run.p.x > snap.x);

/* 4: the end clears the snapshot */
G.run.p.invT = 0;
NS.player.die(G.run, 'hurdle');
G.run.revives = 0;
for (let i = 0; i < 200 && !G.run.ended; ++i) NS.sim.update(1 / 60);
check('a finished run settles and clears the snapshot', G.run.ended && G.screen === 'results' && !env.store['sz-endless-runner-run-v2']);
check('lifetime stats count the run', G.save.stats.runs >= 1 && G.save.stats.dist > 0);

/* 5: corrupt data */
({ env, NS, G } = boot({ 'sz-endless-runner-save-v2': '{"v":2,"coins":5}', 'sz-endless-runner-run-v2': '{broken' }));
check('a partial profile is filled in', G.save.coins >= 5 && G.save.equip.char === 'nova' && Array.isArray(G.save.scores));
check('a corrupt snapshot offers no Continue', NS.save.peekRun() === null);
done();
