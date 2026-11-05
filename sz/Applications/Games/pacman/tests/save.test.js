'use strict';

/* Saving: the first version's high scores carry over once with a veteran shard bonus, damaged
   profiles are repaired, a valid profile round-trips unchanged, the run autosaves and Continue
   after a reload restores exactly the same maze, score, positions and timers, and storage
   failures never break the game. */
const H = require('./harness');
const env = H.installEnv({ 'sz-pacman-high-scores': JSON.stringify([{ score: 12340, level: 5 }, { score: 800, level: 1 }, { bogus: 1 }]) });
let NS = H.load();
const { check, done } = H;
let G = NS.state;
const R = NS.rules;

check('old high scores become classic entries', G.profile.highScores.length === 2 && G.profile.highScores[0].score === 12340 && G.profile.highScores[0].mode === 'classic' && G.profile.highScores[0].detail === 'Level 5');
check('veterans get a shard bonus from their best score', G.profile.veteran === 123 && G.profile.shards >= 123);
check('the old best counts as the arcade best', G.profile.best.arcade === 12340);
check('the profile is marked migrated and stored', G.profile.migrated && JSON.parse(env.store['sz-pacman-profile-v2']).migrated === true);
const again = NS.save.loadProfile();
check('loading again does not pay the bonus twice', again.shards === G.profile.shards && again.highScores.length === 2);
check('the old key is left untouched', !!env.store['sz-pacman-high-scores']);

/* repair */
const broken = R.migrateProfile({
  shards: -4, tree: { a_speed: 9, nope: 2, s_life: 'x' }, skins: ['bow', 'fake'], skin: 'fake', trail: 'rainbow', story: { reached: 99, cleared: { '1-2': 7, bad: 1 } },
  stats: { dots: 'many', ghosts: 12 }, achievements: { first: true, fake: true }, highScores: [{ score: 'x' }, { score: 50, mode: 'zen' }],
  quests: { key: '2026-11-05', list: [{ id: 'dots', tier: 9 }, { id: 'zzz' }], counts: { dots: 5 } }, season: { key: 'autumn-2026', tokens: -3, claimed: [0, 9] },
}, null);
check('negative shards are dropped', broken.shards === 0);
check('tree levels are clamped and unknown nodes dropped', broken.tree.a_speed === 3 && !('nope' in broken.tree) && !('s_life' in broken.tree));
check('unknown cosmetics are dropped and equips fall back', broken.skins.join() === 'classic,bow' && broken.skin === 'classic' && broken.trail === 'sparkle');
check('story progress is clamped', broken.story.reached === 5 && broken.story.cleared['1-2'] === 3 && !('bad' in broken.story.cleared));
check('stats keep numbers only', broken.stats.dots === 0 && broken.stats.ghosts === 12);
check('only known achievements stay', broken.achievements.first && !broken.achievements.fake);
check('scores keep valid entries', broken.highScores.length === 1 && broken.highScores[0].mode === 'zen');
check('quests are repaired', broken.quests.list.length === 1 && broken.quests.list[0].tier === 2 && broken.quests.counts.dots === 5);
check('the season track is repaired', broken.season.tokens === 0 && broken.season.claimed.join() === '0');
check('garbage becomes a fresh profile', JSON.stringify(R.migrateProfile('garbage', null)) === JSON.stringify(R.migrateProfile(null, null)));
check('a valid profile round-trips unchanged', JSON.stringify(R.migrateProfile(JSON.parse(JSON.stringify(broken)), null)) === JSON.stringify(broken));

/* autosave and continue across a reload */
NS.screens.launch('arcade');
NS.input.sample = (lvl) => NS.autopilot.drive(lvl, 1 / 60);
H.run(NS, 60 * 12, 0);
const run = G.run;
check('the run has progressed', run.score > 0 && run.lvl.dotsEaten > 10, run.score);
check('the run autosaves while playing', !!env.store['sz-pacman-run-v1'] && JSON.parse(env.store['sz-pacman-run-v1']).score > 0);
NS.screens.pause();
const snap = JSON.parse(JSON.stringify({ score: run.score, lives: run.lives, n: run.n, dots: run.lvl.maze.dots, pac: [run.lvl.pac.x, run.lvl.pac.y, run.lvl.pac.dir], ghosts: run.lvl.ghosts.map(g => [g.kind, g.x, g.y, g.mode]), effects: run.lvl.effects, mult: run.multPts }));
/* reload the page with the same storage */
const store = Object.assign({}, env.store);
H.installEnv(store);
NS = H.load();
G = NS.state;
check('after a reload the title offers Continue', G.screen === 'title' && G.savedRun && G.savedRun.mode === 'arcade' && G.savedRun.score === snap.score);
NS.screens.continueRun();
const r2 = G.run;
const now = { score: r2.score, lives: r2.lives, n: r2.n, dots: r2.lvl.maze.dots, pac: [r2.lvl.pac.x, r2.lvl.pac.y, r2.lvl.pac.dir], ghosts: r2.lvl.ghosts.map(g => [g.kind, g.x, g.y, g.mode]), effects: r2.lvl.effects, mult: r2.multPts };
check('Continue restores the exact run', JSON.stringify(now) === JSON.stringify(snap));
check('Continue resumes with a READY pause', G.screen === 'playing' && r2.lvl.phase === 'ready');
NS.input.sample = (lvl) => NS.autopilot.drive(lvl, 1 / 60);
H.run(NS, 300, 0);
check('the restored run plays on', G.run === r2 && r2.lvl.dotsEaten > 0);

/* finishing clears the save */
NS.screens.pause();
NS.screens.abandon();
check('ending a run clears the autosave and shows results', !G.savedRun && !G.run && G.screen === 'results' && !NS.save.loadRun());

global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('no'); } };
let threw = false;
try { NS.save.writeProfile(); NS.save.loadProfile(); NS.screens.launch('zen'); NS.save.saveRun(); NS.save.clearRun(); } catch (e) { threw = e.message; }
check('storage errors are swallowed', !threw, threw);

done();
