'use strict';

/* Progress and persistence: the old game's best times and statistics move into Classic once, the
   profile saves and loads with defaults for missing fields, a game in progress autosaves and
   Continue resumes the same field, the tech tree buys and changes the next field (shields,
   chests, a head-start Scanner, unlocked powers), tile sets unlock and buy, quests and the streak
   pay, every festival is found by date and its track pays a tile set, an effect and a flag, the
   Daily Field is the same all day, XP levels up, achievements unlock, a game pays shards and XP. */
const H = require('./harness');
const store = {
  'sz-minesweeper-best-times': JSON.stringify({ beginner: { time: 12, name: 'Ada' }, intermediate: { time: 999, name: 'Anonymous' }, expert: { time: 140, name: 'Bo' } }),
  'sz-minesweeper-stats': JSON.stringify({ beginner: { played: 20, won: 11, streak: 2, bestStreak: 6 }, intermediate: { played: 3, won: 0, streak: 0, bestStreak: 0 }, expert: { played: 0, won: 0, streak: 0, bestStreak: 0 } }),
};
const env = H.installEnv({ store: store });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const P = NS.progress;
const SE = NS.seasons;

const s = G.profile.stats;
check('old best times move into Classic (the unset 999 stays out)', s.bestTimes.beginner === 12 && s.bestTimes.expert === 140 && s.bestTimes.intermediate === 0 && G.profile.scores.classic.beginner[0].name === 'Ada' && G.profile.migrated);
check('old statistics move too', s.classicPlayed.beginner === 20 && s.classicWins.beginner === 11 && s.classicStreak.beginner === 2 && s.classicStreakBest === 6);
NS.save.saveProfile(G.profile);
check('a saved profile loads without migrating twice', NS.save.loadProfile().migrated === 0);
const partial = NS.save.fill({ shards: 5, stats: { opened: 3 } }, P.newProfile());
check('missing fields are filled with defaults', partial.shards === 5 && partial.stats.opened === 3 && partial.stats.gems === 0 && partial.cosmetics.tile === 'meadow' && partial.stats.bestTimes.expert === 0);

NS.play.start('story', { stage: 'meadow-3' });
NS.cine.end();
NS.play.act('reveal', 60);
for (let i = 0; i < 12; ++i) { const a = NS.bot.next(G.run.game); if (a) NS.play.act(a.type === 'flag' ? 'flag' : 'reveal', a.i); }
for (let k = 0; k < 120; ++k) NS.app.update(1 / 30);
check('a game in progress is autosaved', !!env.store['sz-minesweeper-run']);
const snap = JSON.parse(env.store['sz-minesweeper-run']).run.game.open.join('');
NS.screens.setScreen('title');
G.run = null;
check('Continue resumes the same field paused', NS.play.resume() && G.screen === 'paused' && G.run.game.open.join('') === snap);
NS.play.quit();
check('ending a game clears the snapshot and shows results', !env.store['sz-minesweeper-run'] && G.screen === 'results');

const p = G.profile;
p.shards = 20000;
check('a root node can be bought', P.buyNode(p, 'shield') && P.nodeLevel(p, 'shield') === 1);
check('children need their parent', P.nodeState(p, 'revive') === 'locked');
P.buyNode(p, 'scanstart'); P.buyNode(p, 'chests');
const run = NS.run.build('story', { stage: 'meadow-1' }, p);
check('the tree changes the next field (a shield, a chest, a head-start Scanner)', run.game.lives === 1 && run.game.chests === 1 && run.powers[0] === 'scan');
check('locked powers stay out of chests', !P.dropList(p).includes('lantern') && P.dropList(p).includes('scan') && P.dropList(p).includes('shield'));
P.buyNode(p, 'u-sonar'); P.buyNode(p, 'u-lantern');
check('unlocked ones come in', P.dropList(p).includes('lantern') && P.dropList(p).includes('sonar'));
const cl = NS.run.build('classic', { diff: 'beginner' }, p);
check('Classic stays pure: no shields, chests or powers', cl.game.lives === 0 && cl.game.chests === 0 && cl.slots === 0 && cl.powers.length === 0);

const wood = NS.metaData.TILES.find(t => t.id === 'wood');
p.gems = 100;
check('a gem tile set can be bought once', !P.isUnlocked(p, wood) && P.buyCosmetic(p, wood) && P.isUnlocked(p, wood) && p.gems === 60 && !P.buyCosmetic(p, wood));

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
const M = NS.metaData;
check('the festival track pays all six tiers with a tile set, an effect and a flag', got.length === 6 && P.isUnlocked(fp, M.TILES.find(x => x.id === 'hollow')) && P.isUnlocked(fp, M.EFFECTS.find(x => x.id === 'bats')) && P.isUnlocked(fp, M.FLAGS.find(x => x.id === 'pumpkin')));
let refsOk = true;
for (const id of SE.ORDER) {
  const se = SE.SEASONS[id];
  if (!M.TILES.find(x => x.id === se.tile && x.unlock.id === id) || !M.FLAGS.find(x => x.id === se.flag && x.unlock.id === id) || !M.EFFECTS.find(x => x.id === se.effect && x.unlock.id === id)) refsOk = false;
}
check('every festival rewards exist in the collection', refsOk);
const d1 = SE.dailyRecipe(new Date(2026, 10, 8, 9)), d2 = SE.dailyRecipe(new Date(2026, 10, 8, 22));
check('the Daily Field is the same all day', d1.seed === d2.seed && d1.mutators.join() === d2.mutators.join());
const xp = P.newProfile();
check('XP levels the player up', P.addXp(xp, P.xpFor(1) + 1) === 1 && xp.level === 2);
const ap = P.newProfile();
ap.stats.opened = 1200; ap.stats.biggest = 90; ap.stats.classicWins.beginner = 1; ap.stats.bestTimes.beginner = 8;
const ach = P.checkAchievements(ap);
check('achievements unlock from statistics', ach.some(a => a.id === 'open1k') && ach.some(a => a.id === 'big80') && ach.some(a => a.id === 'beg') && ach.some(a => a.id === 'beg10'));
check('at least 40 achievements', M.ACHIEVEMENTS.length >= 40, M.ACHIEVEMENTS.length);
check('a game pays shards and XP', P.payout(P.newProfile(), { mode: 'story', score: 8000, opened: 200, fields: 1, gems: 3, won: true }).shards > 60);
done();
