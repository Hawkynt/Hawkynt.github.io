'use strict';

/* Save v3: migration of the v2 save and the original top-5 table, repair of damaged saves,
   the storage round trip, storage failures, and the autosave of a run in flight - a
   snapshot written mid-run resumes with the same course, position and power-ups. */
const H = require('./harness');
const env = H.installEnv();
localStorage.setItem('sz-flappy-bird-highscores', JSON.stringify([42, 17, 'x', 3]));
localStorage.setItem('sz-flappy-bird-save-v2', JSON.stringify({
  coins: 1234, stars: { '1-1': 3, '1-2': 2, '9-9': 3 }, best: { classic: 30, time: 21, daily: { date: '2026-11-04', score: 9 } },
  stats: { runs: 50, gates: 900, coins: 4000 }, tree: { w_light: 2, a_heart: 1, bogus: 3 }, birds: ['sunny', 'ruby', 'eagle'], bird: 'ruby'
}));
const NS = H.load('app.js');
const { check, done } = H;
const G = NS.state;
const S = NS.save;

check('v2 coins carry over', G.save.coins >= 1234, G.save.coins);
check('v2 stars carry over, unknown stages dropped', G.save.stars['1-1'] === 3 && G.save.stars['1-2'] === 2 && !('9-9' in G.save.stars));
check('the old top-5 table raises the Classic best', G.save.best.classic === 42 && G.highScores[0] === 42 && G.highScores.length === 3);
check('v2 tree carries over, unknown nodes dropped', G.save.tree.w_light === 2 && G.save.tree.a_heart === 1 && !('bogus' in G.save.tree));
check('v2 birds carry over, unknown birds dropped', G.save.birds.join() === 'sunny,ruby' && G.save.bird === 'ruby');
check('v2 stats carry over', G.save.stats.runs === 50 && G.save.stats.gates === 900);
check('the save is marked as migrated from v2', G.save.migratedFrom === 2 && G.save.v === 3);
check('the v3 save is written under its own key', JSON.parse(env.storage.getItem('sz-flappy-bird-save-v3')).v === 3);
check('the v2 save is left untouched as a backup', JSON.parse(env.storage.getItem('sz-flappy-bird-save-v2')).coins === 1234);
const again = S.migrate(JSON.parse(env.storage.getItem('sz-flappy-bird-save-v3')), null, null);
check('a v3 save survives a round trip unchanged', JSON.stringify(again) === JSON.stringify(G.save));

const broken = S.migrate({ v: 3, coins: -5, stars: { '1-1': 9 }, tree: { w_light: 99 }, birds: 'x', hats: ['crown', 'nope'], hat: 'crown',
  trails: ['rainbow'], trail: 'stars', achievements: { first_flight: true, fake: true }, season: { key: 3, tokens: -1, claimed: 99 },
  streak: { last: '2026-01-01', count: 4, best: 2 }, arcadeScores: [{ score: 'a' }, { score: 900, bird: 'pip' }, { score: 1200 }] }, null, null);
check('negative coins are dropped', broken.coins === 0);
check('stars and tree levels are clamped', broken.stars['1-1'] === 3 && broken.tree.w_light === 3);
check('the free items are always owned', broken.birds.join() === 'sunny' && broken.hats.join() === 'none,crown' && broken.trails.join() === 'none,sparkle,rainbow');
check('an item not owned is not worn', broken.trail === 'sparkle' && broken.hat === 'crown');
check('only known achievements stay', broken.achievements.first_flight === true && !('fake' in broken.achievements));
check('the season track is clamped', broken.season.key === '' && broken.season.tokens === 0 && broken.season.claimed === 7);
check('the best streak is at least the current one', broken.streak.best === 4);
check('arcade scores keep valid entries, sorted', broken.arcadeScores.length === 2 && broken.arcadeScores[0].score === 1200 && broken.arcadeScores[1].bird === 'pip');
check('a garbage save becomes a fresh one', JSON.stringify(S.migrate('garbage', 42, {})) === JSON.stringify(S.defaultSave()));

/* ── autosave & continue ── */
G.mode = 'arcade';
NS.run.startRun();
NS.input.handleInput();
for (let i = 0; i < 600; ++i) {
  if (G.state === 'PLAYING' && G.bird.y > 330 && G.bird.vy > -2)
    NS.run.flap();
  G.invuln = 1;
  NS.flight.update(1 / 60);
}
check('the run is flying after ten seconds', G.state === 'PLAYING' && G.dist > 1000, G.state + ' ' + G.dist);
NS.powers.grant('magnet', true);
G.points = 4321;
check('an autosave snapshot is written', NS.autosave.saveNow() && !!env.storage.getItem('sz-flappy-bird-run-v1'));
G.runSaveT = 1e9;   // no timed autosave while the test flies on
const before = { dist: G.dist, y: G.bird.y, points: G.points, magnet: G.power.magnet, gates: G.course.gates.map(g => [g.id, g.x, g.gapY]).slice(0, 6), seed: G.seed };
// fly on, then "reload": a fresh run, then Continue
for (let i = 0; i < 120; ++i)
  NS.flight.update(1 / 60);
G.mode = 'classic';
NS.run.startRun();
NS.nav.continueRun();
check('Continue restores the mode and the run in a paused state', G.mode === 'arcade' && G.state === 'PAUSED');
check('Continue restores position, score and power-ups', Math.abs(G.dist - before.dist) < 1e-6 && Math.abs(G.bird.y - before.y) < 1e-6 && G.points === 4321 && Math.abs(G.power.magnet - before.magnet) < 1e-6);
check('Continue regenerates the very same course', JSON.stringify(G.course.gates.map(g => [g.id, g.x, g.gapY]).slice(0, 6)) === JSON.stringify(before.gates) && G.seed === before.seed);
G.course.ensure(G.dist + 20000);
check('the resumed course keeps generating', G.course.gates[G.course.gates.length - 1].x > before.dist + 15000);
// dying deletes the snapshot
NS.nav.togglePause();
NS.run.die();
check('a finished run deletes its snapshot', env.storage.getItem('sz-flappy-bird-run-v1') === null);
G.mode = 'adventure';
G.stageIndex = 0;
NS.run.startRun();
G.coinsPicked = G.course.totalCoins;
NS.run.finishRun('clear');
const next = S.readRun();
check('a cleared stage leaves the next stage behind Continue', next && next.fresh && next.stageIndex === 1);
G.save.seenCine.chapter1 = true;
NS.nav.continueRun();
check('Continue then starts that next stage', G.mode === 'adventure' && G.stageIndex === 1 && G.state === 'READY');
check('describe() labels a snapshot', NS.autosave.describe({ mode: 'adventure', stageIndex: 5, score: 3 }) === 'Story 2-2 - 3 pipes');

/* storage that throws never breaks the game */
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('no'); } };
let threw = false;
try {
  S.writeSave();
  S.loadSave();
  S.writeRun({ v: 1 });
  S.readRun();
  S.clearRun();
} catch (_) {
  threw = true;
}
check('storage errors are swallowed', !threw && G.save.v === 3);

done();
