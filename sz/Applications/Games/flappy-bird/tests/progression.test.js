'use strict';

/* Progression math: tech-tree purchases and their immediate effect on the rules, the
   wardrobe (buy, wear, unlocks), achievements and their rewards, daily quests, the day
   streak across real dates, the seasonal track paying its items, power-ups, and the
   settlement of a run (coins, interest, stars, arcade table). */
const H = require('./harness');
H.installEnv();
// a controllable clock: every new Date() reads FAKE_NOW
const RealDate = Date;
let FAKE_NOW = new RealDate(2026, 10, 5, 12).getTime();
global.Date = class extends RealDate {
  constructor(...a) {
    if (a.length)
      super(...a);
    else
      super(FAKE_NOW);
  }
  static now() {
    return FAKE_NOW;
  }
};
const NS = H.load('app.js');
const { check, done } = H;
const G = NS.state;
const P = NS.progress, R = NS.rules, C = NS.C;

G.save.coins = 100000;
const coins0 = G.save.coins;
const light = C.TREE.find(n => n.id === 'w_light');
check('a root node is buyable', P.nodeState(light) === 'available');
check('a child node starts locked', P.nodeState(C.TREE.find(n => n.id === 'w_glide')) === 'locked');
const g0 = R.gravityNow();
P.buyNode(light);
check('buying charges the first level cost', G.save.coins <= coins0 - 150 && P.treeLevel('w_light') === 1);
check('the upgrade takes effect at once', R.gravityNow() < g0);
P.buyNode(light);
P.buyNode(light);
check('a node maxes out', P.nodeState(light) === 'maxed' && P.buyNode(light) === false);
check('costs rise per level', C.TREE.every(n => n.costs.every((c, i) => i === 0 || c > n.costs[i - 1])));
check('six branches, 27 nodes, every requirement exists', C.TREE_BRANCHES.length === 6 && C.TREE.length === 27 &&
  C.TREE.every(n => n.req.every(r => C.TREE.some(m => m.id === r[0]))));

// immediate effect from the pause menu: more hearts fill up
G.mode = 'classic';
NS.run.startRun();
NS.input.handleInput();
NS.nav.togglePause();
const h0 = G.hearts;
NS.nav.goNest();
P.buyNode(C.TREE.find(n => n.id === 'a_heart'));
NS.nav.backToPrev();
check('a heart bought from the pause menu is there on return', G.state === 'PAUSED' && G.hearts === h0 + 1 && R.maxHearts() === 2, G.state + ' ' + G.hearts);

// wardrobe
check('a bird is bought and worn', P.useItem('birds', 'ruby') && G.save.bird === 'ruby' && P.owns('birds', 'ruby'));
check('a locked bird cannot be taken', P.useItem('birds', 'phoenix') === false && P.currentBird() === 'ruby');
check('hats and trails are bought and worn', P.useItem('hats', 'cap') && P.useItem('trails', 'hearts') && P.currentHat() === 'cap' && P.currentTrail() === 'hearts');
check('every hat has art', C.HATS.every(h => h.id === 'none' || SZ_has(h.id)));
function SZ_has(id) {
  return window.SZ.FlappyCosmeticArt.HAT_IDS.indexOf(id) >= 0;
}
check('every bird has art', C.BIRD_DEFS.every(b => window.SZ.FlappyBirdArt.BIRDS.some(a => a.id === b.id)));
check('every seasonal reward exists in the catalogue', Object.keys(window.SZ.FlappySeasons.EVENTS).every(id => {
  const r = window.SZ.FlappySeasons.EVENTS[id].rewards;
  return C.BIRD_DEFS.some(b => b.id === r.bird) && C.HATS.some(h => h.id === r.hat) && C.TRAILS.some(t => t.id === r.trail);
}));
check('every achievement unlock points to a real achievement', [].concat(C.BIRD_DEFS, C.HATS, C.TRAILS).filter(d => d.unlock && d.unlock.ach)
  .every(d => C.ACHIEVEMENTS.some(a => a.id === d.unlock.ach)));

// achievements grant their items
G.save.stats.comboMax = 30;
const c1 = G.save.coins;
NS.goals.check();
check('combo achievements are earned and pay', G.save.achievements.combo_10 && G.save.achievements.combo_25 && G.save.coins >= c1 + 650);
check('an achievement unlocks its wardrobe item', P.owns('trails', 'rainbow'));
G.save.stars['2-4'] = 1;
NS.goals.check();
check('a story stage unlocks its bird', P.owns('birds', 'pip'));

// daily quests
NS.goals.rollover();
const quests = NS.goals.questList();
const c2 = G.save.coins;
for (const q of quests)
  NS.goals.bump(q.stat, q.need);
check('finished quests pay with the all-three bonus', G.save.daily.claimed.every(Boolean) && G.save.daily.bonus && G.save.coins > c2 + 200);

// streak over real dates
G.save.streak = { last: '', count: 0, best: 0 };
NS.goals.touchStreak();
check('the first day starts a streak', G.save.streak.count === 1);
NS.goals.touchStreak();
check('a second run the same day does not count twice', G.save.streak.count === 1);
FAKE_NOW += 86400000;
NS.goals.touchStreak();
FAKE_NOW += 86400000;
const c3 = G.save.coins;
NS.goals.touchStreak();
check('consecutive days grow the streak and pay more (3 x 40, plus the streak achievement)', G.save.streak.count === 3 &&
  G.save.coins - c3 === 120 + 150 && G.save.achievements.streak_3, G.save.streak.count + ' / ' + (G.save.coins - c3));
FAKE_NOW += 3 * 86400000;
NS.goals.touchStreak();
check('a missed day restarts the streak, the best stays', G.save.streak.count === 1 && G.save.streak.best === 3);

// seasonal track
FAKE_NOW = new RealDate(2026, 9, 20, 12).getTime();   // Spooky Flight
NS.goals.rollover();
check('the season follows the date', G.season.event.id === 'spooky' && G.save.season.key === 'spooky-2026');
NS.goals.addTokens(300);
check('the full track pays its trail, hat and bird', P.owns('trails', 'ghosts') && P.owns('hats', 'witch') && P.owns('birds', 'jack') && G.save.season.claimed === 7);
check('the last tier awards the badge', G.save.badges.indexOf('spooky-2026') >= 0 && G.save.achievements.season_max === true);
FAKE_NOW = new RealDate(2026, 11, 3, 12).getTime();   // winter: a fresh track
NS.goals.rollover();
check('a new season starts a fresh track, items stay', G.save.season.tokens === 0 && G.save.season.claimed === 0 && P.owns('birds', 'jack'));
check('the scenery follows the calendar by default', P.visualEvent().id === 'frost');
check('an event theme reached on its track can be kept all year', P.owns('themes', 'spooky') && P.useItem('themes', 'spooky') && P.visualEvent().id === 'spooky' && G.season.event.id === 'frost');
P.useItem('themes', 'auto');

// power-ups
G.mode = 'arcade';
NS.run.startRun();
for (const p of C.POWERS)
  NS.powers.grant(p.id);
check('all twelve power-ups are recorded as seen', G.save.powersSeen.length === 12);
check('timed power-ups run for their duration', G.power.rush > 0 && G.power.freeze > 0 && G.power.buddy > 0 && G.blastCharges === R.blastCharges());
check('an extra heart may exceed the limit by one', G.hearts === R.maxHearts() + 1 || G.hearts === R.maxHearts());

// settlement
G.mode = 'adventure';
G.stageIndex = 0;
NS.run.startRun();
G.coinsRun = 50;
G.coinsPicked = G.course.totalCoins;
G.hitsTaken = 0;
const c4 = G.save.coins;
NS.run.finishRun('clear');
check('a clean stage clear earns three stars', G.save.stars['1-1'] === 3 && G.state === 'CLEAR' && G.save.coins >= c4 + 50);
G.mode = 'arcade';
NS.run.startRun();
G.points = 12345;
NS.run.finishRun('dead');
check('an arcade run enters the top-10 table', G.rankArcade === 0 && G.save.arcadeScores[0].score === 12345 && G.save.best.arcade === 12345);
G.save.tree.f_egg = 1;
G.save.coins = 10000;
G.mode = 'classic';
NS.run.startRun();
G.coinsRun = 10;
NS.run.finishRun('dead');
check('Nest Egg pays 2% interest up to its cap', G.runReward.interest === 60 && G.save.coins === 10070, JSON.stringify(G.runReward));

done();
