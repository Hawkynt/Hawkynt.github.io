'use strict';

/* Saving: the old game's keys (high scores, coin total, tutorial flag) migrate into the v2
   profile on first launch and stay untouched; a run autosaves while playing and on pause; after
   a full reload the title offers Continue and the run comes back exactly where it was; finishing
   a run clears the snapshot; a corrupt snapshot is ignored; a run saved half way through a
   turn of the view comes back turned exactly as far; and the Daily Run's ghost follows the
   runner through the turns. */
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
/* 6: saved in the middle of a turn */
({ env, NS, G } = boot({}));
NS.cine.end();
const bot = run => NS.autopilot.bits(run, NS.stream.get(run));
NS.player.input = bot;
NS.run.start('story', { stageId: 'meadow-2' });
let mid = null;
for (let i = 0; i < 60 * 80; ++i) {
  NS.sim.update(1 / 60);
  const r = G.run;
  if (r.phase === 'revive') NS.player.revive(r);
  if (r.phase !== 'play' && r.phase !== 'ready') continue;
  const o = NS.orient.at(r.course.dirs, r.p.x);
  if (o.turning && o.t > 0.35 && o.t < 0.65) { mid = Object.assign({}, o); break; }
}
check('the bot reaches the middle of the bell-tower turn', !!mid && mid.e.dir === 'up', mid ? mid.t : 'never');
NS.frame.draw();
const camO = { a: G.cam.o.a, m: G.cam.o.m, ax: G.cam.o.ax, ay: G.cam.o.ay };
const before = { x: G.run.p.x, dirs: JSON.stringify(G.run.course.dirs) };
NS.save.writeRun();
({ env, NS, G } = boot(Object.assign({}, env.store)));
NS.cine.end();
NS.screens.continueRun();
const o2 = NS.orient.at(G.run.course.dirs, G.run.p.x);
NS.frame.draw();
check('Continue restores the turn exactly (same x, same turns, same angle, mirror and progress)', G.run.p.x === before.x &&
  JSON.stringify(G.run.course.dirs) === before.dirs && o2.a === mid.a && o2.m === mid.m && o2.t === mid.t && o2.dir === mid.dir);
check('and the camera is turned exactly as before', G.cam.o.a === camO.a && G.cam.o.m === camO.m && G.cam.o.ax === camO.ax && G.cam.o.ay === camO.ay);

/* 7: the Daily Run's ghost through its turns */
NS.player.input = bot;
NS.screens.toTitle && NS.screens.toTitle();
NS.run.start('daily', {});
let run = G.run;
for (let i = 0; i < 60 * 300 && !run.ended; ++i) {
  NS.sim.update(1 / 60);
  if (run.phase === 'revive') NS.player.revive(run);
}
const turnsA = JSON.stringify(run.course.dirs.length ? run.course.dirs.map(e => [e.x, e.dir]) : []);
check('a bot finishes today\'s Daily Run and leaves a ghost', run.finished && G.save.ghosts.daily && G.save.ghosts.daily.data.length > 100, run.why);
NS.run.start('daily', {});
run = G.run;
let worst = 0, turned = 0, n = 0;
for (let i = 0; i < 60 * 300 && !run.ended && run.phase !== 'done'; ++i) {
  NS.sim.update(1 / 60);
  if (run.phase === 'revive') NS.player.revive(run);
  const gp = NS.run.ghostAt(run);
  if (!gp || run.phase !== 'play') continue;
  const a = NS.orient.at(run.course.dirs, run.p.x), b = NS.orient.at(run.course.dirs, gp.x);
  worst = Math.max(worst, Math.abs(gp.x - run.p.x));
  if (a.turning) ++turned;
  if (Math.abs(a.a - b.a) > 0.2 || Math.abs(a.m - b.m) > 0.2) ++n;
}
check('the replay turns at the same places as the ghost\'s run', turnsA === JSON.stringify(run.course.dirs.map(e => [e.x, e.dir])) || run.course.dirs.length < 3);
check('the ghost stays with the replaying runner through ' + turned + ' turning frames (worst ' + Math.round(worst) + ' px)', turned > 30 && worst < 400 && n < 10, n + ' frames apart');
done();
