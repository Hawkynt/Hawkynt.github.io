'use strict';

/* Progress rules: the old high scores migrating once with a gift, saving and broken storage, the tech
   tree with prerequisites and engine options, XP and level rewards, Fame, stars and stage unlocking,
   bests and mastery, owned songs, boosters, cosmetics, today's offers, Record Crates with their odds,
   duplicate refunds and the pity guarantee, quests and the weekly challenge, the streak and its
   crate, the welcome-back gift, festivals by date and their track, completion, achievements, payouts
   and the Daily and Weekly recipes. */
const H = require('./harness');
const env = H.installEnv({ store: { 'sz-rhythm-game-highscores': JSON.stringify([{ song: 'Cosmic Flow', score: 4200, grade: 'A' }, { song: 'Neon Pulse', score: 9000, grade: 'S' }]) } });
const NS = H.load();
const { check, done } = H;
const P = NS.progress, M = NS.metaData, SE = NS.seasons, W = NS.worldData, SD = NS.songData;
const G = NS.state;

/* migration and saving */
check('the old high scores move into the journal records once', G.profile.scores.legacy.length === 2 && G.profile.scores.legacy[0].score === 9000 && G.profile.migrated);
check('with a welcome gift of discs', G.profile.discs >= 150);
NS.save.saveProfile(G.profile);
check('the profile is saved under its own key', JSON.parse(env.store['sz-rhythm-game-profile']).scores.legacy.length === 2);
check('a reload does not migrate again', NS.save.loadProfile().migrated === 0);
env.store['sz-rhythm-game-profile'] = '{broken';
check('a broken profile falls back to a fresh one', NS.save.loadProfile().profile.level === 1);
const old = global.localStorage;
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
check('a store that throws never crashes', NS.save.loadProfile().profile.level === 1 && NS.save.saveProfile(G.profile) === false);
global.localStorage = old;

/* tree */
const p = P.newProfile();
check('a fresh profile starts with Lyra, orb notes and two boosters', p.equip.performer === 'lyra' && p.equip.note === 'orb' && p.boosters.net === 1);
check('nodes need their prerequisites', P.nodeState(p, 'focus') === 'locked' && P.nodeState(p, 'win') === 'expensive');
p.discs = 100000;
check('buying a node takes its price', P.buyNode(p, 'win') && p.tree.win === 1 && p.discs === 100000 - 150 && P.nodeState(p, 'focus') === 'available');
P.buyNode(p, 'gstart'); P.buyNode(p, 'fill');
const o = P.engineOpts(p, ['net', 'focus'], ['fragile', 'nosurge']);
check('the tree, boosters and mutators shape the engine options', Math.abs(o.winBonus - 1.04) < 1e-9 && o.net === 3 && Math.abs(o.focus - 0.01) < 1e-9 && o.drain === 2 && o.noSurge && Math.abs(o.grooveStart - 0.58) < 1e-9 && Math.abs(o.surgeFill - 1.2) < 1e-9);
p.equip.performer = 'sable';
check('the equipped performer adds its perk', Math.abs(P.engineOpts(p).winBonus - 1.08) < 1e-9);
p.equip.performer = 'lyra';
check('the tree has 28 nodes in five branches', M.TREE.length === 28 && M.BRANCHES.length === 5 && M.TREE.every(n => n.req.every(r => M.TREE_BY_ID[r[0]])));

/* XP, levels, Fame */
const q = P.newProfile();
const ups = P.addXp(q, 5000);
check('XP raises the level with a reward each', ups.length >= 3 && q.discs > 0 && ups.every(u => u.discs > 0));
const lv5 = P.newProfile();
lv5.level = 4; lv5.xp = 0;
check('every fifth level brings a crate', P.addXp(lv5, P.xpFor(4)).some(u => u.level === 5 && u.crate === 1) && lv5.crates.owned === 1);
q.level = 30;
check('from level 30 you can go on tour', P.canTour(q) && P.tour(q) && q.fame === 1 && q.level === 1 && P.fameMult(q) > 1.09);

/* stars and stages */
const s = P.newProfile();
check('only the first stage is open at first', P.stageOpen(s, 0) && !P.stageOpen(s, 1));
const rs = P.recordStage(s, 'docks-1', [true, true, false]);
check('recording stars opens the next stage and pays crystals', rs.first && rs.newStars === 2 && s.crystals === 6 && P.stageOpen(s, 1));
check('stars are never lost', P.recordStage(s, 'docks-1', [true, false, true]).newStars === 1 && P.starsOf(s, 'docks-1') === 3);
check('remix stars count apart', P.recordStage(s, 'docks-1', [true, true, true], true).newStars === 3 && P.starsTotal(s, true) === 3 && P.starsTotal(s) === 3);

/* bests and mastery */
const id = 'rg-shop-funk';
P.recordBest(s, id + ':easy', { score: 1000, grade: 'B', acc: 0.85, fc: false });
check('a clear starts Bronze mastery', P.masteryOf(s, id) === 0);
P.recordBest(s, id + ':hard', { score: 5000, grade: 'A', acc: 0.92 });
check('an A on Hard is Gold', P.masteryOf(s, id) === 2);
P.recordBest(s, id + ':expert', { score: 9000, grade: 'S', acc: 0.96 });
check('an S on Expert is Diamond', P.masteryOf(s, id) === 4);
check('a lower score keeps the best and counts the play', !P.recordBest(s, id + ':expert', { score: 10, grade: 'D', acc: 0.5 }).newBest && s.best[id + ':expert'].score === 9000 && s.best[id + ':expert'].plays === 2);

/* songs, boosters, cosmetics */
s.discs = 5000;
const lib = P.library(s, new Date());
check('the library lists story, shop and festival songs', lib.filter(e => e.stage).length === 30 && lib.filter(e => e.price).length === 12 && lib.some(e => e.festival && e.owned));
check('a cleared stage\'s song is owned in Free Play', lib.find(e => e.stage && e.stage.id === 'docks-1').owned && !lib.find(e => e.stage && e.stage.id === 'docks-2').owned);
check('a shop song is bought once', P.buySong(s, SD.SHOP[0]) && !P.buySong(s, SD.SHOP[0]) && s.owned.songs[SD.SHOP[0].id]);
check('boosters are bought and used up to the slots', P.buyBooster(s, 'double', 2) && s.boosters.double === 2 && P.useBoosters(s, ['double', 'net']).length === 1 && s.boosters.double === 1);
const vinyl = M.NOTES.find(n => n.id === 'vinyl');
check('a crystal cosmetic is bought and equipped', !P.isUnlocked(s, vinyl) && (s.crystals = 200) && P.buyCosmetic(s, vinyl) && P.equip(s, 'note', 'vinyl') && s.equip.note === 'vinyl');
check('a locked cosmetic cannot be equipped', !P.equip(s, 'highway', 'ocean'));
const offers = P.dailyOffers(s, '2026-11-28');
check('today\'s offers: three items not owned, 30% off, the same all day', offers.length === 3 && offers.every(x => !P.isUnlocked(s, x.item) && x.price < x.was) && JSON.stringify(P.dailyOffers(s, '2026-11-28').map(x => x.item.id)) === JSON.stringify(offers.map(x => x.item.id)));

/* crates */
const c = P.newProfile();
c.discs = 1e6;
check('a crate is bought with discs or crystals', P.buyCrate(c, 'discs') && !P.buyCrate(c, 'crystals') && c.crates.owned === 1);
let epic = 0, legend = 0, maxDry = 0, dry = 0, dupDiscs = 0;
c.crates.owned = 400;
for (let k = 0; k < 400; ++k) {
  const rolls = P.openCrate(c, 1000 + k);
  if (rolls.length !== 3) { epic = -1e9; break; }
  const good = rolls.some(r => r.rarity === 'epic' || r.rarity === 'legendary');
  if (good) epic++; else dry++;
  if (good) dry = 0;
  maxDry = Math.max(maxDry, dry);
  legend += rolls.filter(r => r.rarity === 'legendary').length;
  dupDiscs += rolls.filter(r => r.dup).length;
}
check('every crate holds three items', epic >= 0);
check('the pity counter guarantees an epic within ten crates', maxDry < M.CRATE.pity, maxDry);
check('legendaries are rare but turn up', legend > 0 && legend < 60, legend);
check('duplicates turn into discs', dupDiscs > 0);

/* quests, weekly, streak, welcome back */
const d = P.newProfile();
d.quests = P.rollQuests('2026-11-28');
d.weekly = P.rollWeekly('2026-W48');
check('three distinct quests a day, the same for the same day', d.quests.list.length === 3 && new Set(d.quests.list.map(x => x.id)).size === 3 && JSON.stringify(P.rollQuests('2026-11-28').list) === JSON.stringify(d.quests.list));
const qd = d.quests.list[0];
const res = P.questProgress(d, qd.id, qd.n);
check('a quest done pays its reward', res.some(x => x.quest === qd) && d.discs > 0 && d.stats.quests === 1);
for (const x of d.quests.list) P.questProgress(d, x.id, x.n * 3);
check('all three pay a crystal bonus', d.quests.bonus && d.crystals >= 15);
const wkBefore = d.crates.owned;
P.questProgress(d, d.weekly.id, d.weekly.n);
check('the weekly challenge pays crystals and a crate', d.weekly.done && d.crates.owned === wkBefore + 1);
const st = P.newProfile();
for (let day = 1; day <= 7; ++day) P.touchStreak(st, '2026-11-' + String(day).padStart(2, '0'));
check('a seven-day streak, and its gift holds a crate', st.streak.count === 7 && P.streakGift(7).crate === 1 && P.streakGift(8).discs > P.streakGift(2).discs);
P.touchStreak(st, '2026-11-10');
check('a missed day starts the streak over', st.streak.count === 1 && st.streak.best === 7);
const wb = P.newProfile();
check('no gift on the first visit or the next day', !P.welcomeBack(wb, '2026-11-01') && !P.welcomeBack(wb, '2026-11-02'));
const gift = P.welcomeBack(wb, '2026-11-12');
check('ten days away bring a capped gift with a crate', gift && gift.days === 10 && gift.discs === 800 && gift.crate === 1);
check('the gift is capped at two weeks', P.welcomeBack(wb, '2027-06-01').discs === 14 * 80);

/* festivals */
const dates = [[2026, 0, 15, 'frost'], [2026, 3, 1, 'bloom'], [2026, 6, 1, 'sunfest'], [2026, 8, 20, 'harvest'], [2026, 9, 31, 'hollow'], [2026, 11, 31, 'starfall'], [2026, 11, 10, 'frost']];
check('every festival by its date', dates.every(([y, m, dd, id]) => SE.seasonFor(new Date(y, m, dd)).id === id));
check('Starfall Eve belongs to the year it began', SE.eventId(new Date(2027, 0, 3)) === 'starfall-2026');
const f = P.newProfile();
const when = new Date(2026, 9, 25);
const tiers = P.addTokens(f, 1000, when);
check('festival tokens fill the six-tier track', tiers.length === 6 && f.owned.cos.pumpkin && f.owned.cos.bats && f.owned.cos.hollow && f.stats.festivalDone === 1);
check('the finished track keeps the festival song', f.owned.songs[SD.FESTIVAL.hollow.id]);
check('every festival\'s rewards exist in the collection', Object.values(SE.SEASONS).every(se => M.NOTES.some(n => n.id === se.note) && M.EFFECTS.some(e => e.id === se.effect) && M.HIGHWAYS.some(h => h.id === se.highway)));
const f2 = P.addTokens(f, 10, new Date(2026, 11, 28));
check('a new festival starts a new track', f.festival.event === 'starfall-2026' && f.festival.tokens === 10 && f2.length === 0);

/* completion and achievements */
const full = P.newProfile();
check('a fresh profile is barely complete', P.completion(full) < 0.1);
for (const stg of W.STAGES) full.stars[stg.id] = [true, true, true];
for (const n of M.TREE) full.tree[n.id] = n.costs.length;
for (const k in M.SLOTS) for (const i of M.SLOTS[k]) if (i.unlock.k !== 'complete') full.owned.cos[i.id] = true;
for (const a of M.ACHIEVEMENTS) full.achievements[a.id] = true;
for (const sg of SD.SHOP) full.owned.songs[sg.id] = true;
check('everything earned is 100% and unlocks the Prism skin', P.completion(full) >= 0.999 && P.isUnlocked(full, M.NOTES.find(n => n.id === 'prism')));
check('there are at least 45 achievements, some hidden', M.ACHIEVEMENTS.length >= 45 && M.ACHIEVEMENTS.some(a => a.hidden));
const ach = P.newProfile();
ach.stats.hits = 1500; ach.stats.bestCombo = 120;
const got = P.checkAchievements(ach);
check('achievements fire from statistics and pay crystals', got.some(a => a.id === 'hit1k') && got.some(a => a.id === 'combo100') && ach.crystals === got.length * 15);
check('and only once', P.checkAchievements(ach).length === 0);

/* payouts and recipes */
const pay = P.payout(P.newProfile(), { mode: 'story', score: 50000, acc: 0.95, hits: 300, cleared: true, stars: 3 });
const lose = P.payout(P.newProfile(), { mode: 'story', score: 5000, acc: 0.6, hits: 80, cleared: false });
check('a clear pays more than a fail, and both pay', pay.discs > lose.discs * 2 && lose.discs > 0 && pay.xp > lose.xp);
check('mutators and the Disc Doubler multiply discs', P.payout(P.newProfile(), { mode: 'free', score: 50000, acc: 0.95, hits: 300, cleared: true, mutDiscs: 1.4, double: true }).discs > pay.discs * 1.5);
check('practice speed pays less until Rehearsal', P.payout(P.newProfile(), { mode: 'free', score: 1, acc: 0.9, hits: 300, cleared: true, speed: 0.75 }).discs < P.payout(P.newProfile(), { mode: 'free', score: 1, acc: 0.9, hits: 300, cleared: true }).discs);
const d1 = SE.dailyRecipe(new Date(2026, 10, 28)), d2 = SE.dailyRecipe(new Date(2026, 10, 29));
check('the Daily Mix is the same all day and new the next', JSON.stringify(SE.dailyRecipe(new Date(2026, 10, 28, 23))) === JSON.stringify(d1) && d1.song.seed !== d2.song.seed && d1.mutators.length === 2 && d1.mutators[0] !== d1.mutators[1]);
const daily = NS.chart.build(d1.song, { level: d1.level, bars: d1.bars, kinds: { hold: 1 } });
check('the Daily Mix charts', daily.count > 50);
const w1 = SE.weeklyRecipe(new Date(2026, 10, 23)), w2 = SE.weeklyRecipe(new Date(2026, 10, 29));
check('the Weekly Remix holds for the week', JSON.stringify(w1) === JSON.stringify(w2) && SE.MUT_BY_ID[w1.mutator]);
done();
