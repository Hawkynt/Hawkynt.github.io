'use strict';

/* Save v2: migration from the first version's high-score list, repair of damaged saves, the
   storage round trip and the one-time migration. */
const H = require('./harness');
const env = H.installEnv();
localStorage.setItem('sz-space-combat-highscores', JSON.stringify([{ score: 41000, wave: 12 }, { score: 900, wave: 2 }, { bogus: 1 }]));
const NS = H.load('core/save.js');
const { check, done } = H;
const R = NS.rules;
const G = NS.state;

check('the old high scores became endless entries', G.save.highScores.length === 2 && G.save.highScores[0].score === 41000 && G.save.highScores[0].mode === 'endless' && G.save.highScores[0].wave === 12);
check('veterans get a scrap bonus from their best score', G.save.credits === Math.floor(41000 / 40));
check('the best endless score carries over', G.save.best.endless.score === 41000);
check('the save is marked migrated', G.save.migrated === true);
NS.save.writeSave();
const again = NS.save.loadSave();
check('loading again does not pay the bonus twice', again.credits === G.save.credits && again.highScores.length === 2);
check('stored as save v2 under its own key', JSON.parse(env.store['sz-space-combat-save-v2']).v === 2);

check('a huge old score is capped at 1500 scrap', R.migrateSave(null, [{ score: 9e9, wave: 1 }]).credits === 1500);
check('no old data, no bonus', R.migrateSave(null, null).credits === 0 && R.migrateSave(null, null).migrated === false);

const broken = R.migrateSave({ credits: -5, stars: { s1m1: 3, s1m2: 'x' }, ships: 'nope', ship: 'ghost', tree: { w_dmg: 2, bad: -1 },
  loadout: { primary: 'laser', secondary: 'emp' }, style: { skin: 'plaid' }, best: { daily: 'x' }, stats: { kills: 5 }, highScores: [{ score: 'a' }, { score: 10 }] }, null);
check('negative scrap is dropped', broken.credits === 0);
check('bad star entries are dropped', broken.stars.s1m1 === 3 && !('s1m2' in broken.stars));
check('bad tree entries are dropped', broken.tree.w_dmg === 2 && !('bad' in broken.tree));
check('the free ship and weapons are always owned', broken.ships[0] === 'falcon' && broken.primaries.indexOf('blaster') >= 0 && broken.secondaries.indexOf('missiles') >= 0);
check('an unowned ship or weapon is not flown', broken.ship === 'falcon' && broken.loadout.primary === 'blaster' && broken.loadout.secondary === 'missiles');
check('unknown styles fall back', broken.style.skin === 'stock');
check('stats and scores keep only valid fields', broken.stats.kills === 5 && broken.stats.runs === 0 && broken.highScores.length === 1);
check('a garbage save becomes a fresh one', JSON.stringify(R.migrateSave('garbage', null)) === JSON.stringify(R.migrateSave(null, null)));
const round = R.migrateSave(JSON.parse(JSON.stringify(broken)), null);
check('a valid save survives a round trip unchanged', JSON.stringify(round) === JSON.stringify(broken));

/* storage failures never throw */
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
let threw = false;
try { NS.save.writeSave(); NS.save.loadSave(); } catch (_) { threw = true; }
check('storage errors are swallowed', !threw);

done();
