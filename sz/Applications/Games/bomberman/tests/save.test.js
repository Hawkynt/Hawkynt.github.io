'use strict';

/* Persistence: the first version's high scores and tutorial flag migrate once (with a veteran
   gem bonus), damaged saves are repaired, storage errors never throw, and an autosaved run
   survives a page reload exactly - Continue restores the very same stage, positions, bombs,
   enemies and score, and play goes on. */
const path = require('path');
const H = require('./harness');
const { check, done } = H;

const store = {
  'sz-bomberman-highscores': JSON.stringify([{ score: 12000, level: 6 }, { score: 800, level: 2 }, { junk: true }]),
  'sz-bomberman-tutorial-seen': '1'
};

function boot() {
  for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'js' + path.sep)) delete require.cache[k];
  const env = H.installEnv({ store: store, date: '2026-11-05T12:00:00' });
  const NS = H.load();
  env.frames(3);
  return { env, NS, G: NS.state };
}

let { env, NS, G } = boot();
const R = NS.rules;
check('old high scores become arcade entries', G.save.scores.arcade.length === 2 && G.save.scores.arcade[0].score === 12000 && G.save.scores.arcade[0].stage === 6 && G.save.scores.arcade[0].date === 'classic');
check('the old best becomes the arcade record', G.save.stats.arcadeBest === 12000);
check('veterans get a gem bonus (plus the first streak day and the Arcade Rookie achievement)', G.save.gems === 240 + 10 + 60 && G.save.ach.arcade10k, G.save.gems);
check('the tutorial flag carries over', G.save.seen.help === true);
check('the save is marked migrated and stored as v2', G.save.migrated === true && JSON.parse(store['sz-bomberman-save-v2']).v === 2);
const again = NS.save.loadSave();
check('loading again does not pay the bonus twice', again.gems === G.save.gems && again.scores.arcade.length === 2);

check('a huge old score is capped at 400 gems', R.migrateSave(null, [{ score: 9e9, level: 1 }], false).gems === 400);
check('no old data, no bonus', R.migrateSave(null, null, false).gems === 0);
const broken = R.migrateSave({ gems: -5, stars: { '0-0': 3, '0-1': 'x', bad: 2 }, tree: { a_bombs: 9, nope: 1 }, owned: { skin: ['ninja', 'plaid'] },
  equip: { skin: 'gold', bomb: 'classic' }, stats: { kills: 5, bogus: 3 }, scores: { arcade: [{ score: 'a' }, { score: 10 }] }, quests: 'x' }, null, false);
check('negative gems are dropped', broken.gems === 0);
check('bad star keys are dropped', broken.stars['0-0'] === 3 && !('0-1' in broken.stars) && !('bad' in broken.stars));
check('tree levels are capped and unknown nodes dropped', broken.tree.a_bombs === 3 && !('nope' in broken.tree));
check('unknown cosmetics are dropped, classic always owned', broken.owned.skin.join() === 'classic,ninja');
check('an unowned look is not equipped', broken.equip.skin === 'classic');
check('stats keep only known keys', broken.stats.kills === 5 && !('bogus' in broken.stats) && broken.stats.runs === 0);
check('score lists keep only valid entries', broken.scores.arcade.length === 1);
check('a garbage save becomes a fresh one', JSON.stringify(R.migrateSave('garbage', null, false)) === JSON.stringify(R.migrateSave(null, null, false)));
const round = R.migrateSave(JSON.parse(JSON.stringify(broken)), null, false);
check('a valid save survives a round trip unchanged', JSON.stringify(round) === JSON.stringify(broken));

/* ── autosave and continue across a reload ── */
G.save.seen.intro = true;
for (let w = 0; w < 5; ++w) { G.save.seen.chapters[w] = true; G.save.seen.bosses[w] = true; }
NS.run.newRun('arcade', { seed: 777 });
env.key('ArrowDown', 'keydown');
env.frames(150);
env.key('ArrowDown', 'keyup');
env.tap('Space');
env.frames(40);
check('the run autosaves while playing', !!store['sz-bomberman-run-v2']);
env.tap('Escape');
env.frames(2);
check('pausing saves the run', G.screen === 'paused' && JSON.parse(store['sz-bomberman-run-v2']).score === G.run.score);
const snapshot = JSON.parse(JSON.stringify(G.run));
check('a bomb is ticking in the snapshot', snapshot.bombs.length >= 1, snapshot.bombs.length);
env.fire('pagehide');
const stored = JSON.parse(store['sz-bomberman-run-v2']);

/* reload: a fresh game over the same storage */
({ env, NS, G } = boot());
check('the title offers Continue after a reload', G.hasContinue && G.continueInfo.mode === 'arcade');
check('Continue restores the run', NS.run.resume() && G.screen === 'paused');
const strip = (r) => { const c = JSON.parse(JSON.stringify(r)); delete c.savedAt; delete c.v; return JSON.stringify(c); };
check('the restored run is exactly the saved one', strip(G.run) === strip(stored));
check('player, bombs and enemies are where they were', G.run.player.x === snapshot.player.x && G.run.player.y === snapshot.player.y &&
  G.run.bombs.length === snapshot.bombs.length && G.run.enemies.length === snapshot.enemies.length && G.run.score === snapshot.score);
env.tap('Escape');
env.frames(240);
check('play goes on after Continue', G.screen === 'playing' || G.screen === 'results');

/* Save & Quit keeps the run, Abandon clears it */
NS.run.suspend();
NS.screens.setScreen('title');
check('Save & Quit keeps Continue', G.hasContinue);
NS.run.resume();
NS.run.abandon();
NS.screens.setScreen('title');
check('Abandon clears Continue', !G.hasContinue && !store['sz-bomberman-run-v2']);

/* a corrupt stored run is ignored */
store['sz-bomberman-run-v2'] = '{"v":1,"level":{"grid":[1,2]}}';
check('a corrupt run is not offered', !NS.save.probeContinue());

/* storage failures never throw */
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('x'); } };
let threw = false;
try { NS.save.writeSave(); NS.save.loadSave(); NS.save.saveRun(); NS.save.clearRun(); } catch (_) { threw = true; }
check('storage errors are swallowed', !threw);

done();
