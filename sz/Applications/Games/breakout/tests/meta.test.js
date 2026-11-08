'use strict';

/* Progress and persistence: the old high-score table moves into Arcade once, the profile saves
   and loads with defaults for missing fields, a game in progress autosaves and Continue resumes
   the same field, the tech tree buys and changes the next game, paddles unlock and buy, quests
   and the streak pay, every festival is found by date and its track pays a paddle and a trail,
   the Daily Challenge is the same all day, XP levels up, achievements unlock. */
const H = require('./harness');
const store = { 'sz-breakout-high-scores': JSON.stringify([{ score: 5000, level: 3 }, { score: 9000, level: 5 }]) };
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
const partial = NS.save.fill({ shards: 5, stats: { bricks: 3 } }, P.newProfile());
check('missing fields are filled with defaults', partial.shards === 5 && partial.stats.bricks === 3 && partial.stats.bombs === 0 && partial.cosmetics.paddle === 'aurora');

NS.play.start('arcade', { seed: 77 });
NS.cine.end();
for (let i = 0; i < 300; ++i) { NS.run.tick(G.run, 1 / 30, NS.bot.input(G.run.game), G.profile); NS.run.takeEvents(G.run); }
for (let k = 0; k < 120; ++k) NS.app.update(1 / 30);
check('a game in progress is autosaved', !!env.store['sz-breakout-run']);
const snap = JSON.stringify(JSON.parse(env.store['sz-breakout-run']).run.game.bricks);
NS.screens.setScreen('title');
G.run = null;
check('Continue resumes the same field paused', NS.play.resume() && G.screen === 'paused' && JSON.stringify(G.run.game.bricks) === snap);
NS.play.quit();
check('ending a game clears the snapshot and shows results', !env.store['sz-breakout-run'] && G.screen === 'results');

const p = G.profile;
p.shards = 10000;
check('a root node can be bought', P.buyNode(p, 'width') && P.nodeLevel(p, 'width') === 1);
check('children need their parent', P.nodeState(p, 'u-mega') === 'locked');
P.buyNode(p, 'life');
const run = NS.run.build('arcade', { seed: 1 }, p);
check('the tree changes the next game (paddle, lives)', run.game.paddle.baseW > C.PADDLE_W && run.game.lives === 4);
check('locked power-ups do not drop', !P.dropList(p).includes('mega') && P.dropList(p).includes('wide'));
P.buyNode(p, 'drops'); P.buyNode(p, 'u-magnet'); P.buyNode(p, 'u-mega');
check('unlocked ones do', P.dropList(p).includes('mega'));

const chrome = NS.metaData.PADDLES.find(s => s.id === 'chrome');
p.gems = 100;
check('a gem paddle can be bought once', !P.isUnlocked(p, chrome) && P.buyCosmetic(p, chrome) && P.isUnlocked(p, chrome) && p.gems === 60 && !P.buyCosmetic(p, chrome));

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
check('the festival track pays all five tiers with a paddle and a trail', got.length === 5 && P.isUnlocked(fp, NS.metaData.PADDLES.find(x => x.id === 'hollow')) && P.isUnlocked(fp, NS.metaData.TRAILS.find(x => x.id === 'bats')));
const d1 = SE.dailyRecipe(new Date(2026, 10, 8, 9)), d2 = SE.dailyRecipe(new Date(2026, 10, 8, 22));
check('the Daily Challenge is the same all day', d1.seed === d2.seed && d1.mutators.join() === d2.mutators.join());
const xp = P.newProfile();
check('XP levels the player up', P.addXp(xp, P.xpFor(1) + 1) === 1 && xp.level === 2);
const ap = P.newProfile();
ap.stats.bricks = 150; ap.stats.best = 12;
const ach = P.checkAchievements(ap);
check('achievements unlock from statistics', ach.some(a => a.id === 'b100') && ach.some(a => a.id === 'c10'));
check('at least 35 achievements', NS.metaData.ACHIEVEMENTS.length >= 35);
check('a game pays shards and XP', P.payout(P.newProfile(), { mode: 'arcade', score: 20000, bricks: 200, best: 20 }).shards > 100);
/* music: every stage plays a song of its own made from its world's theme */
{
  const saved = { run: G.run, screen: G.screen, cine: G.cine };
  G.cine = null;
  G.screen = 'game';
  G.run = { mode: 'story', stage: 'a-1', world: 0, game: { level: 1 } };
  const s1 = NS.music.themeFor();
  G.run = { mode: 'story', stage: 'a-2', world: 0, game: { level: 1 } };
  const s2 = NS.music.themeFor();
  G.run = { mode: 'story', stage: 'a-1', world: 0, game: { level: 1 } };
  check('every stage has a song of its own in its world\'s style', s1 !== s2 && s1.style && s1.style === s2.style && NS.music.themeFor() === s1);
  G.run = saved.run; G.screen = saved.screen; G.cine = saved.cine;
}
done();
