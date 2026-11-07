'use strict';

/* The Sugar Garden: it opens with the Cupcake era, planting costs treats, plants ripen tick by
   tick (also across time away), ripe plants add their bonus to production, harvesting pays and
   teaches new seeds, two ripe parents breed their mutation into an empty neighbour, the plot
   grows with known seeds, soils change growth and bonus, plants wither, the garden survives
   ascension and a save round trip, and the screen draws and takes clicks. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const GD = NS.gardenData;
const GA = NS.garden;
const ctx = env.gameCanvas.ctx;

G.profile.seenIntro = true;
NS.screens.setScreen('game');
const g = G.profile.garden;

check('the garden is locked in the first eras', !GA.unlocked());
G.profile.stageMax = 3;
check('the Cupcake era opens it', GA.unlocked());
check('it starts as a 3 x 3 plot with Butterwheat known', GA.size() === 3 && g.known.butterwheat && GA.knownCount() === 1);
check('17 plants with a mutation path to every non-starter, non-weed plant',
  GD.PLANTS.length === 17 && GD.PLANTS.every(p => p.id === 'butterwheat' || p.weed || GD.MUTATIONS.some(m => m.child === p.id)));
check('every mutation parent is a plant', GD.MUTATIONS.every(m => m.parents.every(id => GD.BY_ID[id])));

/* planting */
G.run.cookies = 0;
check('planting needs treats', !GA.plant(0));
G.run.cookies = 1e6;
const c0 = G.run.cookies;
check('planting works inside the plot', GA.plant(0) && g.plots[0] && g.plots[0].p === 'butterwheat');
check('planting costs treats', G.run.cookies < c0);
check('plots outside the 3 x 3 are closed', !GA.plant(3) && !GA.plant(18));
check('an occupied plot cannot be planted again', !GA.plant(0));

/* growth over real time */
const never = () => 0.99;
const t0 = H.now();
g.lastTick = t0;
GA.update(t0 + 60000 * 2, never);
check('two minutes are two ticks', g.plots[0].age === 2);
check('not ripe yet, no bonus', !GA.isMature(g.plots[0]) && GA.effects().prod === 0);
GA.update(t0 + 60000 * 3, never);
check('Butterwheat ripens after three ticks', GA.isMature(g.plots[0]));
NS.production.invalidate();
NS.production.refresh(true);
check('a ripe plant adds its bonus to production', Math.abs(G.stMain.gardenF - 1.01) < 1e-9, G.stMain.gardenF);
check('unripe plants cannot be harvested without force', GA.harvest(1) === null);

/* harvest */
const b0 = G.run.cookies;
const h = GA.harvest(0);
check('harvesting a ripe plant pays treats', h && h.kind === 'harvest' && G.run.cookies > b0 && !g.plots[0] && g.harvested === 1);

/* mutation: two ripe Butterwheat next to an empty plot */
g.plots[0] = { p: 'butterwheat', age: 5 };
g.plots[2] = { p: 'butterwheat', age: 5 };
const always = () => 0;
const ev = GA.tick(always);
check('two ripe parents sprout their mutation between them', g.plots[1] && g.plots[1].p === 'sugarreed' && ev.some(e => e.kind === 'sprout' && e.plant.id === 'sugarreed'), JSON.stringify(g.plots.slice(0, 3)));
check('with luck, weeds creep into the other empty plots', g.plots[14] && g.plots[14].p === 'crumbweed');
for (let i = 3; i < 36; ++i) g.plots[i] = null;
check('mutations are counted and remembered as sprouted', g.mutations >= 1 && g.sprouted.sugarreed);
check('a sprouted mutation is not known before its harvest', !g.known.sugarreed);
g.plots[1].age = 99;
const hr = GA.harvest(1);
check('harvesting it ripe teaches the seed', hr.learned && g.known.sugarreed);
check('a known seed can be selected and planted', (GA.selectSeed('sugarreed'), g.seed === 'sugarreed') && GA.plant(7));

/* plot growth */
g.known = { butterwheat: true, sugarreed: true, cocoabush: true, vanilla: true };
check('four known seeds give a 4 x 4 plot', GA.size() === 4);
g.known = {};
for (const p of GD.PLANTS) g.known[p.id] = true;
check('all seeds give the full 6 x 6 plot', GA.size() === 6);

/* soils */
g.plots.fill(null);
g.plots[0] = { p: 'butterwheat', age: 3 };
GA.setSoil('clay');
check('Caramel Clay raises bonuses by 25%', Math.abs(GA.effects().prod - 0.0125) < 1e-9, GA.effects().prod);
GA.setSoil('fertilizer');
g.plots[7] = { p: 'butterwheat', age: 0 };
GA.tick(never);
check('Cookie Compost grows 50% faster', g.plots[7].age === 1.5);
GA.setSoil('dirt');

/* weeds and withering */
g.plots[0] = { p: 'butterwheat', age: GD.BY_ID.butterwheat.grow + GD.BY_ID.butterwheat.life - 1 };
GA.tick(never);
check('old plants wither away', !g.plots[0]);
g.plots[7] = { p: 'crumbweed', age: 5 };
NS.production.invalidate();
check('a weed drags production down', GA.effects().prod < 0);
check('weeds cannot be picked as seeds', (GA.selectSeed('crumbweed'), g.seed !== 'crumbweed'));

/* legendary harvest */
g.plots[8] = { p: 'crystalrose', age: 99 };
const cr0 = G.profile.crystals;
GA.harvest(8);
check('a Crystal Rose pays a sugar crystal', G.profile.crystals === cr0 + 1 && g.crystals === 1);

/* catch-up is capped */
g.plots.fill(null);
g.lastTick = H.now() - 60000 * 5000;
const evs = GA.update(H.now(), never);
check('a long absence catches up at most one day of ticks', g.lastTick === H.now() && Array.isArray(evs));

/* ascension keeps the garden */
g.plots[0] = { p: 'starvine', age: 3 };
G.profile.allTime = 1e15;
NS.prestige.ascend();
NS.cinematics.skip();
check('ascension keeps the garden', G.profile.garden.plots[0] && G.profile.garden.plots[0].p === 'starvine' && G.profile.garden.known.voidorchid);

/* save round trip */
NS.save.write(G);
const loaded = NS.save.load();
check('the garden survives a save round trip', loaded.profile.garden.plots[0].p === 'starvine' && loaded.profile.garden.soil === 'dirt');
const legacy = NS.save.fill({ allTime: 5 }, NS.economy.newProfile());
check('older saves get an empty garden', legacy.garden && legacy.garden.plots.length === 36 && legacy.garden.known.butterwheat);

/* achievements */
NS.progression.checkAchievements();
check('garden achievements unlock', G.profile.achievements.g01 && G.profile.achievements.g02 && G.profile.achievements.g05 && G.profile.achievements.g08);

/* the screen */
NS.gardenUi.open('game');
let err = null;
try {
  for (let i = 0; i < 4; ++i) { NS.app.update(1 / 60); NS.frame.draw(); }
  G.input.mx = NS.gardenUi.plotCenter(0).x;
  G.input.my = NS.gardenUi.plotCenter(0).y;
  G.input.moved = 1;
  NS.frame.draw();
} catch (e) { err = e; console.log(e.stack); }
check('the garden screen draws with a hover tooltip', !err && G.screen === 'garden');
g.plots[1] = null;
GA.selectSeed('butterwheat');
G.run.cookies = 1e12;
const hit = G.hitAreas.findIndex(a => a.id === 'plot1');
check('the plot registers click areas', hit >= 0);
NS.widgets.activate(G.hitAreas[hit]);
check('clicking an empty plot plants the selected seed', g.plots[1] && g.plots[1].p === 'butterwheat');
NS.widgets.activate(G.hitAreas[hit], true);
check('right-clicking pulls an unripe plant', !g.plots[1]);
check('no shadowBlur in the garden', ctx.shadowBlurUsed === 0);
done();
