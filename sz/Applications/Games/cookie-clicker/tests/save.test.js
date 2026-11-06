'use strict';

/* Persistence: the original game's save (key sz-cookie-clicker) converts into the new profile
   and run with its cookies, totals, buildings, upgrades, achievements and heavenly chips; a
   save round-trips; missing fields get defaults; offline baking is capped and applied on boot;
   a hard reset does not resurrect the old save. */
const H = require('./harness');
const { check, done } = H;

const now = Date.UTC(2026, 10, 6, 12, 0, 0);
H.setNow(now);
const old = {
  cookies: 123456789, cookiesBaked: 987654321, cookiesBakedAllTime: 5e15, totalClicks: 4321, clickMultiplier: 8, globalMultiplier: 1.21,
  heavenlyChips: 17, prestigeCount: 2, buildings: { cursor: 40, grandma: 30, farm: 20, prism: 1, bogus: 9 },
  buildingMultipliers: { cursor: 8 }, upgradePurchased: { u01: true, u02: true, u51: true, u20: true, u78: true, u23: true, u82: true, u99: true, u04: false },
  achievementUnlocked: { a01: true, a02: true, a11: true, a29: true, a99: true }, lastMilestone: 1e6, lastSaveTime: now - 20 * 3600 * 1000,
};

/* migration through a full boot */
let env = H.installEnv({ store: { 'sz-cookie-clicker': JSON.stringify(old) } });
let NS = H.load();
let G = NS.state;
check('old cookies carry over (plus offline baking)', G.run.cookies >= old.cookies, G.run.cookies);
check('old run total carries over', G.run.baked >= old.cookiesBaked);
check('lifetime total carries over', G.profile.allTime >= 5e15);
check('heavenly chips become sugar crystals', G.profile.crystals === 17);
check('prestige count becomes ascensions', G.profile.ascensions === 2);
check('total clicks carry over', G.profile.stats.clicks === 4321);
check('buildings carry over, unknown ones dropped', G.run.buildings.cursor === 40 && G.run.buildings.prism === 1 && !('bogus' in G.run.buildings));
const ups = G.run.upgrades;
check('old upgrades map to new ones', ups['t-cursor-0'] && ups['t-cursor-1'] && ups['t-cursor-4'] && ups.m1 && ups.m6 && ups['g-lucky'] && ups['g-destiny']);
check('unknown and unbought old upgrades are ignored', !ups['t-grandma-0'] && Object.keys(ups).length === 7, Object.keys(ups).join());
check('old achievements carry over', G.profile.achievements.a01 && G.profile.achievements.a29 && !G.profile.achievements.a99);
const cps = G.stMain.cps;
check('offline baking pays cap x rate x 50%', Math.abs(G.ui.offline.cookies - cps * 8 * 3600 * 0.5) / G.ui.offline.cookies < 0.01, G.ui.offline.cookies + ' vs ' + cps * 14400);
NS.app.update(1 / 60);
check('the era matches the run total after the first tick', G.run.stage === NS.economy.stageFor(G.run.baked) && G.run.stage >= 4, G.run.stage);
check('an era reached while away waits for the bakery to play its cinematic', G.screen === 'title' && !G.cine && !!G.pendingCine);
check('veterans skip the intro and get welcome notes', G.profile.seenIntro && G.profile.notes > 5);
check('the new save was written, the old key kept', !!env.store['sz-cookie-clicker-save'] && !!env.store['sz-cookie-clicker']);
check('20 hours away is capped at 8 hours of offline baking', G.ui.offline && G.ui.offline.capped && G.ui.offline.cap === 8 * 3600);

/* round trip and continue */
G.run.cookies = 4242;
G.run.buildings.grandma = 77;
G.profile.tree.o_heat = 2;
G.bake = NS.economy.newRun('bake', null);
G.bake.baked = 999;
NS.save.write(G);
const store = env.store;
const saved = JSON.parse(store['sz-cookie-clicker-save']);
check('save is versioned', saved.v === 2 && saved.savedAt === now);
env = H.installEnv({ store: store });
NS = H.load();
G = NS.state;
check('continue restores the run', G.run.buildings.grandma === 77 && Math.floor(G.run.cookies) === 4242);
check('continue restores the tree', G.profile.tree.o_heat === 2);
check('continue restores a Bake-Off in progress', G.bake && G.bake.baked === 999);
check('no offline report for an instant reload', !G.ui.offline);

/* defaults for missing fields */
const partial = JSON.parse(store['sz-cookie-clicker-save']);
delete partial.profile.stats.zenSeconds;
delete partial.profile.season;
delete partial.run.buffs;
partial.run.upgrades.nonsense = true;
store['sz-cookie-clicker-save'] = JSON.stringify(partial);
env = H.installEnv({ store: store });
NS = H.load();
G = NS.state;
check('missing fields are filled with defaults', G.profile.stats.zenSeconds === 0 && G.profile.season.tokens.winter === 0 && Array.isArray(G.run.buffs));
check('unknown upgrades are dropped', !G.run.upgrades.nonsense);

/* corrupt save falls back to the legacy one, then a fresh game */
env = H.installEnv({ store: { 'sz-cookie-clicker-save': '{broken', 'sz-cookie-clicker': '{"cookies": 50}' } });
NS = H.load();
check('a corrupt save falls back to the old one', Math.floor(NS.state.run.cookies) === 50);
env = H.installEnv({ store: {} });
NS = H.load();
check('no save at all starts fresh', NS.state.run.cookies === 0 && !NS.state.profile.seenIntro);

/* hard reset with an old save still present */
env = H.installEnv({ store: { 'sz-cookie-clicker': JSON.stringify(old) } });
NS = H.load();
NS.app.hardReset();
env = H.installEnv({ store: env.store });
NS = H.load();
check('a hard reset does not bring the old save back', NS.state.run.cookies === 0 && NS.state.profile.crystals === 0);

/* offline cap math */
const E = NS.economy;
const p = E.newProfile();
const r = E.offlineGain(10, 3600, p);
check('one hour offline at 10/s pays 18,000', r.cookies === 18000 && !r.capped);
p.tree.l_offeff = 4;
p.tree.c_offline = 3;
check('offline efficiency never exceeds 100%', E.offlineGain(10, 100, p).efficiency === 1);
done();
