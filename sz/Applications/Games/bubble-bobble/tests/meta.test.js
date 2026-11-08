'use strict';

/* Progress and persistence: the old high-score table moves into Arcade once, the profile saves
   and loads with defaults for missing fields, a game in progress autosaves and Continue resumes
   the same field, the tech tree buys and changes the next game, paddles unlock and buy, quests
   and the streak pay, every festival is found by date and its track pays a paddle and a trail,
   the Daily Challenge is the same all day, XP levels up, achievements unlock. (Bubble Bobble) */
const H = require('./harness');
const store = { 'sz-bubble-bobble-highscores': JSON.stringify([{ score: 5000, level: 3 }, { score: 9000, level: 5 }]) };
const env = H.installEnv({ store: store });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const P = NS.progress;
const SE = NS.seasons;
const C = NS.constants;

check('old high scores move into Arcade', G.profile.scores.arcade.length === 2 && G.profile.scores.arcade[0].score === 9000 && G.profile.migrated);
NS.save.saveProfile(G.profile);
check('a saved profile loads without migrating twice', NS.save.loadProfile().migrated === 0);
const partial = NS.save.fill({ shards: 5, stats: { trapped: 3 } }, P.newProfile());
check('missing fields are filled with defaults', partial.shards === 5 && partial.stats.trapped === 3 && partial.stats.fruit === 0 && partial.cosmetics.paddle === 'mint');

NS.play.start('arcade', { seed: 77 });
NS.cine.end();
const bm = {};
for (let i = 0; i < 300; ++i) { NS.run.tick(G.run, 1 / 30, NS.bot.input(G.run.game, bm), G.profile); NS.run.takeEvents(G.run); }
for (let k = 0; k < 120; ++k) NS.app.update(1 / 30);
check('a game in progress is autosaved', !!env.store['sz-bubble-bobble-run']);
const snap = JSON.stringify(JSON.parse(env.store['sz-bubble-bobble-run']).run.game.map);
NS.screens.setScreen('title');
G.run = null;
check('Continue resumes the same field paused', NS.play.resume() && G.screen === 'paused' && JSON.stringify(G.run.game.map) === snap);
NS.play.quit();
check('ending a game clears the snapshot and shows results', !env.store['sz-bubble-bobble-run'] && G.screen === 'results');

const p = G.profile;
p.shards = 10000;
check('a root node can be bought', P.buyNode(p, 'range') && P.nodeLevel(p, 'range') === 1);
check('children need their parent', P.nodeState(p, 'u-freeze') === 'locked');
P.buyNode(p, 'life');
const run = NS.run.build('arcade', { seed: 1 }, p);
check('the tree changes the next game (bubble range, lives)', run.game.rangeMul > 1 && run.game.lives === 4);
check('locked candy does not drop', !P.dropList(p).includes('big') && P.dropList(p).includes('shoes'));
P.buyNode(p, 'drops'); P.buyNode(p, 'u-big');
check('unlocked candy does', P.dropList(p).includes('big'));

const chrome = NS.metaData.NEWTS.find(s => s.id === 'snow');
p.gems = 100;
check('a gem newt colour can be bought once', !P.isUnlocked(p, chrome) && P.buyCosmetic(p, chrome) && P.isUnlocked(p, chrome) && p.gems === 60 && !P.buyCosmetic(p, chrome));

p.quests = P.rollQuests('2026-11-08');
const q = p.quests.list[0];
const s0 = p.shards;
P.questProgress(p, q.id, 1e9);
check('a quest completes and pays shards', q.done && p.shards > s0);
const pr = P.newProfile();
P.touchStreak(pr, '2026-11-06'); P.touchStreak(pr, '2026-11-07');
check('consecutive days grow the streak', pr.streak.count === 2);

const at = (m, d) => SE.seasonIdFor(new Date(2026, m - 1, d));
check('every festival is found by date', at(1, 15) === 'frost' && at(4, 10) === 'bloom' && at(7, 1) === 'sunfest' && at(9, 15) === 'harvest' && at(10, 31) === 'hollow' && at(12, 31) === 'starfall');
const fp = P.newProfile();
const got = P.addTokens(fp, 400, new Date(2026, 9, 25));
check('the festival track pays all five tiers with a newt colour and a trail', got.length === 5 && P.isUnlocked(fp, NS.metaData.PADDLES.find(x => x.id === 'hollow')) && P.isUnlocked(fp, NS.metaData.TRAILS.find(x => x.id === 'bats')));
const d1 = SE.dailyRecipe(new Date(2026, 10, 8, 9)), d2 = SE.dailyRecipe(new Date(2026, 10, 8, 22));
check('the Daily Challenge is the same all day', d1.seed === d2.seed && d1.mutators.join() === d2.mutators.join());
const xp = P.newProfile();
check('XP levels the player up', P.addXp(xp, P.xpFor(1) + 1) === 1 && xp.level === 2);
const ap = P.newProfile();
ap.stats.trapped = 60; ap.stats.bestChain = 3;
const ach = P.checkAchievements(ap);
check('achievements unlock from statistics', ach.some(a => a.id === 't50') && ach.some(a => a.id === 'c3'));
check('at least 35 achievements', NS.metaData.ACHIEVEMENTS.length >= 35);
check('a game pays shards and XP', P.payout(P.newProfile(), { mode: 'arcade', score: 20000, trapped: 40, best: 4 }).shards > 100);
done();
