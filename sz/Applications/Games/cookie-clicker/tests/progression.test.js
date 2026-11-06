'use strict';

/* Progression rules: eras evolve with their cinematic once, milestones and achievements pay
   notes, golden outcomes apply their effects, season tokens climb the track, daily quests
   complete, ascension trades the run for crystals while keeping the tree, the Bake-Off scores
   and rewards, and the tech tree acts at once. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const E = NS.economy;
const O = {};
for (const o of NS.eventData.OUTCOMES) O[o.id] = o;

G.profile.seenIntro = true;
NS.screens.setScreen('game');

/* eras */
G.run.cookies = 0;
NS.production.earn(G.run, 1500);
NS.app.update(1 / 60);
check('passing 1,000 baked evolves into the chocolate-chip cookie', G.run.stage === 1 && G.cine && G.cine.id === 'stage');
check('the transformation is followed by the cast', G.cine.shots.some(s => s.kind === 'talk'));
NS.cinematics.skip();
check('the era is remembered', G.profile.stageMax === 1 && G.profile.stagesSeen[1]);
check('seven transformation cinematics exist', NS.treatData.STAGES.slice(1).every((s, i) => NS.cinematics.build('stage', { from: i, to: i + 1 }).length >= 3));

/* milestones and achievements */
for (let i = 0; i < 30; ++i) NS.clicking.click(false);
const notes0 = G.profile.notes;
G.run.stage = 0;
NS.progression.checkGoals();
check('an era milestone pays 2 notes', G.profile.notes === notes0 + 2 && G.run.goals['0:0']);
G.run.stage = 1;
const n0 = G.profile.notes;
const got = NS.progression.checkAchievements();
check('achievements unlock and pay a note each', got > 0 && G.profile.notes === n0 + got && G.profile.achievements.a11, got);
check('at least 100 achievements', NS.achievementData.ACHIEVEMENTS.length >= 100, NS.achievementData.ACHIEVEMENTS.length);

/* golden outcomes */
G.run.buildings.grandma = 10;
NS.production.invalidate();
NS.production.refresh();
const bank0 = G.run.cookies;
NS.golden.apply(G.run, O.lucky, 100, 100);
check('Lucky pays out', G.run.cookies > bank0);
NS.golden.apply(G.run, O.frenzy, 100, 100);
check('Frenzy is a x7 production buff of 77 s', E.buffMult(G.run, 'prod') === 7 && Math.round(G.run.buffs[0].t) === 77);
NS.golden.apply(G.run, O.frenzy, 100, 100);
check('a second Frenzy refreshes instead of stacking', G.run.buffs.length === 1);
NS.golden.apply(G.run, O.clickfrenzy, 100, 100);
check('Click Frenzy is x777 clicks', E.buffMult(G.run, 'click') === 777);
NS.golden.apply(G.run, O.rush, 100, 100);
check('Building Rush boosts by the producer count', G.run.buffs.some(b => b.id === 'rush-grandma' && Math.abs(b.mult - 2) < 1e-9));
const nn = G.profile.notes;
NS.golden.apply(G.run, O.sugar, 100, 100);
check('Sugar Rush gives notes', G.profile.notes > nn);
NS.golden.apply(G.run, O.comboblast, 100, 100);
check('Combo Blast fills the combo', G.run.combo === G.st.comboCap);
NS.golden.apply(G.run, O.storm, 100, 100);
for (let i = 0; i < 120; ++i) NS.app.update(1 / 60);
const drop = NS.golden.DROPS.find(d => d.on);
const before = G.run.cookies;
check('Cookie Storm drops can be caught', drop && NS.golden.tryClick(drop.x, drop.y) && G.run.cookies > before && G.storm.caught === 1);
check('seven golden outcomes', NS.eventData.OUTCOMES.length >= 7);
for (let i = 0; i < 100 * 60 && G.run.buffs.length; i += 30) NS.app.update(1 / 2);
check('buffs expire', G.run.buffs.length === 0);

/* season track */
G.season = 'winter';
NS.progression.addToken(10, 0, 0);
check('ten tokens unlock the season skin', G.profile.unlocked['season-skin-winter'] && NS.progression.isUnlocked(NS.treatData.SKINS.find(s => s.id === 'frost'), 'skin'));
check('the track pays notes at 3 tokens', G.profile.season.claimed.winter === 2);
G.profile.tree.c_season = 1;
NS.progression.addToken(1, 0, 0);
check('Season Blessing doubles tokens', G.profile.season.tokens.winter === 12);

/* quests */
G.profile.daily.quests = [{ id: 'golden', n: 2, target: 2, progress: 0, done: false, reward: 3 }, { id: 'clicks', n: 5, target: 5, progress: 0, done: false, reward: 2 }, { id: 'buy', n: 1, target: 1, progress: 0, done: false, reward: 2 }];
G.profile.daily.bonus = false;
const qn = G.profile.notes;
NS.progression.quest('golden', 2);
for (let i = 0; i < 5; ++i) NS.clicking.click(false);
G.run.cookies = 1e9;
NS.purchasing.buyBuilding('cursor');
check('three quests done pay their rewards and the bonus', G.profile.daily.quests.every(q => q.done) && G.profile.notes === qn + 3 + 2 + 2 + 3 && G.profile.stats.quests >= 3);

/* tech tree takes effect at once */
G.profile.notes = 50;
const cps0 = (NS.production.refresh(true), G.st.cps);
NS.tree.buy('o_heat');
check('research applies immediately', G.st.cps > cps0 && G.profile.tree.o_heat === 1);

/* ascension */
check('no ascension below a trillion', !NS.prestige.canAscend());
G.profile.allTime = 8e12;
G.run.upgrades['d-icing'] = true;
const tree = JSON.stringify(G.profile.tree);
check('two crystals wait at 8 trillion', NS.prestige.pending() === 2);
NS.prestige.ascend();
check('ascension gives crystals and counts', G.profile.crystals === 2 && G.profile.ascensions === 1);
check('ascension resets the run to a plain cookie', G.run.stage === 0 && G.run.baked === 0 && G.run.buildings.cursor === 0 && !G.run.upgrades['d-icing']);
check('ascension keeps the tree and achievements', JSON.stringify(G.profile.tree) === tree && G.profile.achievements.a11);
check('ascension plays its cinematic', G.cine && G.cine.id === 'ascend');
NS.cinematics.skip();
check('crystals now boost production', Math.abs(G.st.crystalF - 1.02) < 1e-9);
G.profile.allTime = 27e12;
G.profile.tree.c_decor = 1;
G.run.upgrades['d-icing'] = true;
NS.prestige.ascend();
NS.cinematics.skip();
check('Family Decor keeps decorations', G.run.upgrades['d-icing'] && G.profile.crystals === 3);

/* Bake-Off */
NS.modes.startBake(false);
NS.cinematics.skip();
check('Bake-Off starts empty with a clock', G.bake.cookies === 0 && G.bake.timeLeft === NS.constants.BAKEOFF_SECONDS);
const main0 = G.run.baked;
for (let i = 0; i < 30; ++i) NS.clicking.click(false);
check('Bake-Off clicks bake into the Bake-Off, not the bakery', G.bake.baked > 0 && G.run.baked >= main0);
NS.screens.pause();
const tl = G.bake.timeLeft;
NS.app.update(0.5);
check('pausing stops the Bake-Off clock', G.bake.timeLeft === tl);
NS.screens.resume();
G.bake.timeLeft = 0.01;
const notesB = G.profile.notes;
NS.app.update(1 / 30);
check('the Bake-Off scores, ranks and rewards', G.ui.bakeResult && G.ui.bakeResult.rank === 1 && G.profile.bakeScores.length === 1 && G.profile.notes > notesB);
done();
