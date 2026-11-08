'use strict';

/* Progress and persistence: the old high-score table moves into Marathon once, the profile
   saves and loads with defaults for missing fields, a game in progress autosaves and Continue
   resumes the same board, the tech tree buys and applies, cosmetics unlock and buy, quests
   complete and pay, the streak grows with gifts, every festival is found by date and its track
   pays out a skin and an effect, the Daily Challenge is the same all day, XP levels up, and
   achievements unlock. */
const H = require('./harness');
const store = { 'sz-tetris-high-scores': JSON.stringify([{ score: 12000, lines: 40, level: 4 }, { score: 30000, lines: 80, level: 8 }]) };
const env = H.installEnv({ store: store });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const P = NS.progress;
const SE = NS.seasons;

check('old high scores move into Marathon', G.profile.scores.marathon.length === 2 && G.profile.scores.marathon[0].score === 30000 && G.profile.migrated);
check('with a welcome of shards', G.profile.shards >= 100);
NS.save.saveProfile(G.profile);
const again = NS.save.loadProfile();
check('a saved profile loads again without migrating twice', again.migrated === 0 && again.profile.scores.marathon.length === 2);
const partial = NS.save.fill({ shards: 5, stats: { lines: 3 } }, P.newProfile());
check('missing fields are filled with defaults', partial.shards === 5 && partial.stats.lines === 3 && partial.stats.quads === 0 && partial.cosmetics.skin === 'gloss');

/* autosave and Continue */
NS.play.start('marathon', { seed: 77 });
NS.cine.end();
for (let i = 0; i < 6; ++i) { NS.bot.playPiece(G.run.game); for (let k = 0; k < 20; ++k) NS.app.update(1 / 30); }
const board = JSON.stringify(G.run.game.board), score = G.run.game.score;
for (let k = 0; k < 120; ++k) NS.app.update(1 / 30);
check('a game in progress is autosaved', !!env.store['sz-tetris-run']);
NS.screens.setScreen('title');
G.run = null;
check('Continue resumes the same game paused', NS.play.resume() && G.screen === 'paused' && JSON.stringify(G.run.game.board) === board && G.run.game.score === score);
NS.screens.resume();
check('and plays on after the count', G.cine && G.cine.id === 'resume');
NS.cine.end();
NS.play.quit();
check('ending a game clears the snapshot and shows results', !env.store['sz-tetris-run'] && G.screen === 'results');

/* tech tree */
const p = G.profile;
p.shards = 10000;
check('a root node can be bought', P.nodeState(p, 'lock1') === 'available' && P.buyNode(p, 'lock1') && P.nodeLevel(p, 'lock1') === 1);
check('children need their parent', P.nodeState(p, 'u-laser') === 'locked');
P.buyNode(p, 'preview'); P.buyNode(p, 'preview');
const run = NS.run.build('marathon', { seed: 1 }, p);
check('the tree changes the next game (preview, lock delay)', run.game.preview === 5 && Math.abs(run.game.lockDelay - 0.6) < 1e-9);
check('every node has costs and a branch', NS.metaData.TREE.every(n => n.costs.length && NS.metaData.BRANCHES.some(b => b.id === n.branch)));

/* cosmetics */
const pixel = NS.metaData.SKINS.find(s => s.id === 'pixel');
p.gems = 100;
check('a gem skin can be bought once', !P.isUnlocked(p, pixel) && P.buyCosmetic(p, pixel) && P.isUnlocked(p, pixel) && p.gems === 60 && !P.buyCosmetic(p, pixel));
const neon = NS.metaData.SKINS.find(s => s.id === 'neon');
check('star skins unlock with stars', !P.isUnlocked(p, neon));

/* quests */
p.quests = P.rollQuests('2026-11-08');
check('three quests a day, the same for the same day', p.quests.list.length === 3 && JSON.stringify(P.rollQuests('2026-11-08').list) === JSON.stringify(p.quests.list));
const q = p.quests.list[0];
const s0 = p.shards;
const doneQ = P.questProgress(p, q.id, 1e9);
check('a quest completes and pays shards', q.done && p.shards > s0 && doneQ.length >= 1);

/* streak */
const pr = P.newProfile();
P.touchStreak(pr, '2026-11-06');
P.touchStreak(pr, '2026-11-07');
check('consecutive days grow the streak', pr.streak.count === 2 && !P.touchStreak(pr, '2026-11-07'));
P.touchStreak(pr, '2026-11-10');
check('a gap starts again', pr.streak.count === 1 && pr.streak.best === 2);
check('the seventh day pays gems', P.streakGift(7).gems > 0 && P.streakGift(3).gems === 0);

/* festivals */
const at = (m, d) => SE.seasonIdFor(new Date(2026, m - 1, d));
check('every festival is found by date', at(1, 15) === 'frost' && at(4, 10) === 'bloom' && at(7, 1) === 'sunfest' && at(9, 15) === 'harvest' && at(10, 31) === 'hollow' && at(12, 31) === 'starfall');
const fp = P.newProfile();
const date = new Date(2026, 9, 25);
const got = P.addTokens(fp, 200, date);
check('the festival track pays all five tiers', got.length === 5 && fp.stats.festivalDone === 1);
const hollowSkin = NS.metaData.SKINS.find(s => s.id === 'hollow');
check('and unlocks its skin and effect', P.isUnlocked(fp, hollowSkin) && P.isUnlocked(fp, NS.metaData.EFFECTS.find(e => e.id === 'bats')));
P.addTokens(fp, 5, new Date(2026, 11, 28));
check('a new festival starts its own track', fp.festival.event.indexOf('starfall') === 0 && fp.festival.tokens === 5);

/* daily */
const d1 = SE.dailyRecipe(new Date(2026, 10, 8, 9)), d2 = SE.dailyRecipe(new Date(2026, 10, 8, 22)), d3 = SE.dailyRecipe(new Date(2026, 10, 9));
check('the Daily Challenge is the same all day and changes the next', d1.seed === d2.seed && d1.mutators.join() === d2.mutators.join() && d1.seed !== d3.seed && d1.mutators[0] !== d1.mutators[1]);

/* XP */
const xp = P.newProfile();
const up = P.addXp(xp, P.xpFor(1) + P.xpFor(2) + 5);
check('XP levels the player up with gems', up === 2 && xp.level === 3 && xp.gems === 10);

/* achievements */
const ap = P.newProfile();
ap.stats.lines = 120; ap.stats.quads = 1;
const ach = P.checkAchievements(ap);
check('achievements unlock from statistics and pay gems', ach.some(a => a.id === 'lines100') && ach.some(a => a.id === 'quad1') && ap.gems === ach.length * 10);
check('at least 40 achievements', NS.metaData.ACHIEVEMENTS.length >= 40, NS.metaData.ACHIEVEMENTS.length);

/* payout */
const pay = P.payout(P.newProfile(), { mode: 'marathon', score: 50000, lines: 60, won: false });
check('a game pays shards and XP', pay.shards > 100 && pay.xp > 200);
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
