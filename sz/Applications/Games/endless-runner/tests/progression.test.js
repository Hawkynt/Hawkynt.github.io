'use strict';

/* Progression arithmetic: tech tree costs, prerequisites and purchases, what the tree and the
   runner add up to, combo tiers, runner levels, run rewards, stars, daily quests, streaks,
   festival tiers, cosmetic purchases and earned unlocks, and the high-score table. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules, T = NS.treeData, C = NS.constants;

const s = R.newSave();
check('25 tech nodes in 5 branches of 5', T.NODES.length === 25 && T.BRANCHES.length === 5 &&
  T.BRANCHES.every((b, i) => T.NODES.filter(n => n.branch === i).length === 5));
check('every prerequisite exists and sits above its node', T.NODES.every(n => !n.req || n.req.every(r => T.NODE_BY_ID[r] && T.NODE_BY_ID[r].row < n.row)));
check('costs rise with every level', T.NODES.every(n => { for (let l = 1; l < n.max; ++l) if (T.cost(n, l) <= T.cost(n, l - 1)) return false; return true; }));
check('a root node is open, its child locked', R.canBuy(s, 'magnetCoil') === 'coins' && R.canBuy(s, 'shieldCore') === 'locked');
s.coins = 10000;
check('buying spends the price and raises the level', R.buy(s, 'magnetCoil') && s.tree.magnetCoil === 1 && s.coins === 10000 - T.cost(T.NODE_BY_ID.magnetCoil, 0));
check('the child opens once the parent has a level', R.canBuy(s, 'shieldCore') === 'ok');
s.tree.tripleJump = 1; s.tree.phoenix = 2; s.tree.shieldCore = 4; s.tree.dashJets = 4; s.tree.comboCap = 1;
let st = R.computeStats(s);
check('stats follow the tree', st.maxJumps === 3 && st.revives === 2 && st.shieldHits === 2 && Math.abs(st.dashCd - (1.6 - 0.72)) < 1e-9 && st.comboCap === 5 && st.dur.magnet === 9.5);
s.equip.char = 'echo';
check('Echo makes power-ups last 15% longer', Math.abs(R.computeStats(s).dur.giant - 6.9) < 1e-9);
s.equip.char = 'rook';
check('Rook dashes 25% sooner', Math.abs(R.computeStats(s).dashCd - (1.6 - 0.72) * 0.75) < 1e-9);
check('max level refuses to buy', R.canBuy(s, 'tripleJump') === 'max' && !R.buy(s, 'tripleJump'));
check('spent sums every level bought', R.treeSpent(s) > 0);

check('combo tiers', R.comboTier(0) === 0 && R.comboTier(25) === 1 && R.comboTier(119) === 2 && R.comboTier(5000) === 4 && R.comboTier(5000, 5) === 5);
check('combo multipliers', R.comboMul(60) === 2 && R.comboMul(320, 5) === 5);

const p = R.newSave();
const gained = R.addXp(p, R.xpNeeded(1) + R.xpNeeded(2) + 5);
check('XP carries over across levels', gained.join() === '2,3' && p.level === 3 && p.xp === 5);
check('every fifth level pays gems', R.levelReward(5).gems > 0 && R.levelReward(4).gems === 0);

const base = R.computeStats(R.newSave());
const rw = R.runRewards({ mode: 'story', dist: 800, coins: 100, gems: 3, score: 8000, finished: true, boss: false, w: 1 }, base);
check('story rewards pay coins, a clear bonus and XP', rw.coins === 100 && rw.bonus === 90 && rw.gems === 3 && rw.xp === 900);
check('zen pays half the coins by default', R.runRewards({ mode: 'zen', dist: 100, coins: 100, gems: 0, score: 0 }, base).coins === 50);
check('mutators scale coins', R.runRewards({ mode: 'weekly', dist: 0, coins: 100, gems: 0, score: 0, mutCoins: 1.5 }, base).coins === 150);
check('stars: finish, 60% coins, all shards', R.starsFor({ finished: true, coins: 60, coinsTotal: 100, shards: 3 }) === 3 &&
  R.starsFor({ finished: true, coins: 59, coinsTotal: 100, shards: 3 }) === 2 && R.starsFor({ finished: false, coins: 100, coinsTotal: 100, shards: 3 }) === 0);
check('guardian stars: at most one hit', R.starsFor({ finished: true, boss: true, hits: 1, shards: 0 }) === 2 && R.starsFor({ finished: true, boss: true, hits: 2, shards: 3 }) === 2);

const q1 = R.questsFor('2026-11-06'), q2 = R.questsFor('2026-11-06'), q3 = R.questsFor('2026-11-07');
check('three distinct daily quests, the same all day', q1.length === 3 && new Set(q1.map(q => q.id)).size === 3 && JSON.stringify(q1) === JSON.stringify(q2));
check('quests change with the day', JSON.stringify(q1) !== JSON.stringify(q3));
const d = R.newSave();
check('first day starts a streak', R.startDay(d, '2026-11-06').streak === 1);
check('same day changes nothing', R.startDay(d, '2026-11-06') === null);
check('next day extends the streak', R.startDay(d, '2026-11-07').streak === 2 && d.streak.best === 2);
check('a missed day resets it', R.startDay(d, '2026-11-09').streak === 1 && d.streak.best === 2);
d.day.c.coins = 1e6;
check('quest progress is capped at its goal', R.questProgress(d, d.day.quests[0]) === d.day.quests[0].n || d.day.quests[0].id !== 'coins');

const f = R.newSave();
check('festival tiers reached in order', R.addTokens(f, 'frost-2026', 12).join() === '0' && R.addTokens(f, 'frost-2026', 40).join() === '1,2');
check('a new festival starts from zero', R.addTokens(f, 'bloom-2027', 1).length === 0 && f.season.tokens === 1);

const c = R.newSave();
const kip = NS.cosmetics.CHAR_BY_ID.kip;
check('runners cost gems', !R.buyCosmetic(c, 'char', kip) && (c.gems = 50) && R.buyCosmetic(c, 'char', kip) && c.gems === 10 && R.owns(c, 'char', kip));
c.level = 10; c.bosses.wyrm = 1; c.ach.coins10k = 1;
const got = R.grantEarned(c, 'char', NS.cosmetics.CHARACTERS).concat(R.grantEarned(c, 'outfit', NS.cosmetics.OUTFITS), R.grantEarned(c, 'trail', NS.cosmetics.TRAILS));
check('levels, guardians and achievements unlock cosmetics', got.indexOf('char:rook') >= 0 && got.indexOf('char:blaze') >= 0 && got.indexOf('outfit:gold') >= 0 && got.indexOf('trail:flames') >= 0);
check('6 runners, 14 outfits, 14 trails, 34 achievements, 13 quest kinds', NS.cosmetics.CHARACTERS.length === 6 && NS.cosmetics.OUTFITS.length === 14 &&
  NS.cosmetics.TRAILS.length === 14 && NS.goals.ACHIEVEMENTS.length === 34 && NS.goals.QUESTS.length === 13);
check('13 power-ups', NS.items.POWERS.length === 13);

const h = R.newSave();
for (let i = 0; i < 14; ++i) R.addScore(h, { score: i * 10, dist: i, coins: 0, mode: 'arcade' });
check('high scores keep the best ten, best first', h.scores.length === C.MAX_HIGH_SCORES && h.scores[0].score === 130 && h.scores[9].score === 40);
done();
