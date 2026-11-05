'use strict';

/* Save and continue: the first version's high-score and field-size keys are migrated once (old
   scores kept with their mode, a veteran bonus, the old key dropped), damaged saves are repaired,
   storage errors never throw, and an autosaved run restores exactly - world, score, generator. */
const H = require('./harness');
const env = H.installEnv({
  date: new Date('2026-11-05T10:00:00'),
  store: {
    'sz-asteroids-high-scores': JSON.stringify([{ score: 18450, level: 7, mode: 'classic' }, { score: 9100, level: 4, mode: 'hardcore' }, { bogus: true }, { score: 0, level: 1, mode: 'zen' }]),
    'sz-asteroids-field-size': 'large',
  },
});
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const R = NS.rules;

check('old scores became arcade entries with their old mode', G.save.highScores.length === 2 && G.save.highScores[0].score === 18450 &&
  G.save.highScores[0].legacy === 'Classic' && G.save.highScores[1].legacy === 'Hardcore' && G.save.highScores[0].wave === 7);
check('the best old score is the arcade best', G.save.best.arcade === 18450 && G.save.stats.arcadeBest === 18450);
check('veterans get a stardust head start', G.save.dust >= Math.floor(18450 / 20));
check('the save is marked migrated', G.save.migrated === true);
check('the old field-size key is removed', !('sz-asteroids-field-size' in env.store));
NS.save.writeSave();
const again = NS.save.loadSave();
check('loading again does not pay the bonus twice', again.dust === G.save.dust && again.highScores.length === 2);
check('stored under its own key with a version', JSON.parse(env.store['sz-asteroids-save']).v === R.SAVE_VERSION);
check('a huge old score is capped at 1500 stardust', R.migrateSave(null, [{ score: 9e9, level: 1 }]).dust === 1500);

const broken = R.migrateSave({ dust: -5, stars: { '1-1': 3, '1-2': 'x', 'zz': 2 }, tree: { c_dmg: 99, bad: 2 }, owned: ['skin:crimson', 'skin:nope', 'hat:x'],
  look: { skin: 'gilded', trail: 'comet' }, stats: { rocks: 5, nonsense: 9 }, highScores: [{ score: 'a' }, { score: 10, mode: 'arcade' }], seasons: { 'winter-2026': { tokens: 7, claimed: 2 } } }, null);
check('negative stardust is dropped', broken.dust === 0);
check('bad stars are dropped', broken.stars['1-1'] === 3 && !('1-2' in broken.stars) && !('zz' in broken.stars));
check('tree levels are clamped and unknown nodes dropped', broken.tree.c_dmg === 5 && !('bad' in broken.tree));
check('only real cosmetics are owned; unowned looks fall back', broken.owned.indexOf('skin:crimson') >= 0 && broken.owned.indexOf('skin:nope') < 0 && broken.look.skin === 'kestrel');
check('stats keep known fields only', broken.stats.rocks === 5 && !('nonsense' in broken.stats) && broken.stats.runs === 0);
check('season tracks survive', broken.seasons['winter-2026'].tokens === 7);
check('a garbage save becomes a fresh one', JSON.stringify(R.migrateSave('garbage', null)) === JSON.stringify(R.migrateSave(null, null)));
const round = R.migrateSave(JSON.parse(JSON.stringify(broken)), null);
check('a valid save survives a round trip unchanged', JSON.stringify(round) === JSON.stringify(broken));

/* the autosaved run */
NS.input.sample = () => NS.bot.think();
NS.waves.startRun('story', { chapter: 1, level: 2 });
NS.screens.setScreen('playing');
for (let i = 0; i < 60 * 12; ++i) NS.sim.update(1 / 60);
NS.screens.pause();
check('pausing writes the run', !!env.store['sz-asteroids-run']);
const snap = JSON.stringify(NS.snapshot.take());
const score = G.score, rocks = G.rocks.length, rngNext = NS.sim.rngState();
NS.screens.quitToTitle();
for (let i = 0; i < 30; ++i) NS.sim.update(1 / 60);
check('the title shows Continue for it', NS.snapshot.describe() && /Story 2-3/.test(NS.snapshot.describe().where));
check('continue restores the run paused', NS.screens.continueRun() && G.screen === 'paused');
check('score, rocks and generator come back exactly', G.score === score && G.rocks.length === rocks && NS.sim.rngState() === rngNext);
const snap2 = JSON.stringify(NS.snapshot.take());
if (snap2 !== snap) { const a = JSON.parse(snap), b = JSON.parse(snap2); for (const k in a) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log('diff', k, JSON.stringify(a[k]).slice(0, 300), '\n   vs', JSON.stringify(b[k]).slice(0, 300)); }
check('the restored snapshot is identical', snap2 === snap);
NS.screens.resume();
for (let i = 0; i < 120; ++i) NS.sim.update(1 / 60);
check('and the run plays on', G.screen === 'playing' || G.screen === 'results');
NS.progress.runOver(false);
check('a finished run clears the autosave', !env.store['sz-asteroids-run']);

/* storage failures never throw */
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('no'); } };
let threw = false;
try { NS.save.writeSave(); NS.save.loadSave(); NS.snapshot.autosave(true); NS.snapshot.clear(); NS.snapshot.has(); } catch (_) { threw = true; }
check('storage errors are swallowed', !threw);
done();
