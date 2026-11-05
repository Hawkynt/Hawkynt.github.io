'use strict';

/* Save v2: migration from the first version (high-score list and tutorial flag), repair of
   damaged saves, the storage round trip, the one-time veteran bonus, storage failures. */
const H = require('./harness');
const env = H.installEnv();
localStorage.setItem('sz-space-mining-highscores', JSON.stringify([{ credits: 3200, ore: 140 }, { credits: 800, ore: 30 }, { bogus: 1 }]));
localStorage.setItem('sz-space-mining-tutorial-seen', '1');
const NS = H.load('core/save.js');
const { check, done } = H;
const R = NS.rules;
const G = NS.state;

check('veterans start with half their best haul', G.save.credits === R.START_CREDITS + 1600);
check('the old scores carry over as classic entries', G.save.highScores.length === 2 && G.save.highScores[0].score === 3200 && G.save.highScores[0].mode === 'classic' && G.save.highScores[0].detail === '140 ore');
check('the tutorial flag carries over', G.save.seenHelp === true);
check('the save is marked migrated', G.save.migrated === true);
check('the market and contracts are set up', !!G.save.market.iron && G.save.contracts.length > 0);
NS.save.writeSave();
const again = NS.save.loadSave();
check('loading again does not pay the bonus twice', again.credits === G.save.credits && again.highScores.length === 2);
check('stored as save v2 under its own key', JSON.parse(env.store['sz-space-mining-save-v2']).v === 2);

check('a huge old score is capped at 5000 credits', R.migrateSave(null, [{ credits: 9e9, ore: 1 }]).credits === R.START_CREDITS + 5000);
check('no old data, no bonus', R.migrateSave(null, null).credits === R.START_CREDITS && R.migrateSave(null, null).migrated === false);

const broken = R.migrateSave({
  credits: -5, rd: 'x', hulls: ['ghost', 'wasp'], hull: 'leviathan', upgrades: { laser: 99, cargo: -1, bogus: 3 },
  tree: { d_focus: 2, bad: 4, e_warp: 9 }, modules: { refinery: 2, droneBay: 'x' }, licenses: ['amber', 'nowhere'], zone: 'void',
  store: { ore: { iron: 12, gold: -3, unobtainium: 5 }, bar: { copper: 2.7 } }, contracts: [{ ore: 'gold', kind: 'ore', qty: 3, reward: 90 }, { ore: 'x', kind: 'ore', qty: 1, reward: 1 }],
  achievements: { firstOre: true, fake: true }, stats: { fractures: 12, trips: 'many' }, highScores: [{ score: 'a' }, { score: 10, mode: 'rush' }],
}, null);
check('negative credits are dropped', broken.credits === 0 && broken.rd === R.START_RD);
check('the free hull is always owned, unknown hulls dropped', broken.hulls.join() === 'prospector,wasp');
check('an unowned hull is not flown', broken.hull === 'prospector');
check('upgrades are clamped to their range', broken.upgrades.laser === 10 && broken.upgrades.cargo === 0 && !('bogus' in broken.upgrades));
check('tree levels are clamped, unknown nodes dropped', broken.tree.d_focus === 2 && broken.tree.e_warp === 1 && !('bad' in broken.tree));
check('modules keep valid levels', broken.modules.refinery === 2 && broken.modules.droneBay === 0);
check('licences keep the home belt and known belts', broken.licenses.join() === 'kessler,amber' && broken.zone === 'kessler');
check('the warehouse keeps whole positive known stock', broken.store.ore.iron === 12 && !('gold' in broken.store.ore) && !('unobtainium' in broken.store.ore) && broken.store.bar.copper === 2);
check('bad contracts are dropped', broken.contracts.length === 1);
check('only known achievements stay', broken.achievements.firstOre && !broken.achievements.fake);
check('stats keep numbers only', broken.stats.fractures === 12 && broken.stats.trips === 0);
check('scores keep valid entries', broken.highScores.length === 1 && broken.highScores[0].mode === 'rush');
check('a garbage save becomes a fresh one', JSON.stringify(R.migrateSave('garbage', null)) === JSON.stringify(R.migrateSave(null, null)));
const round = R.migrateSave(JSON.parse(JSON.stringify(broken)), null);
check('a valid save survives a round trip unchanged', JSON.stringify(round) === JSON.stringify(broken));

global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
let threw = false;
try { NS.save.writeSave(); NS.save.loadSave(); } catch (_) { threw = true; }
check('storage errors are swallowed', !threw);

done();
