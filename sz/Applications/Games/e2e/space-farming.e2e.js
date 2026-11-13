'use strict';

/* Space Farming's story and goals in a real browser: a new farm opens with the arrival scene while
   the farm holds, a harvest plays its scene and counts toward goals, and a fence paint from Goals
   repaints the field's fence. */
exports.ns = 'SpaceFarming';
exports.game = 'space-farming';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'SpaceFarming');
  await M.open('space-farming');
  await M.run('NS.resetGame();');
  await t.wait(1500);
  t.check('a new farm opens with the arrival scene and holds the farm', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-arrival');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scene plays through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.onHarvest();');
  await t.wait(800);
  t.check('the first harvest plays its scene and counts', await M.has('.szs-overlay') && await M.run('return NS.meta.goals.state.stats.harvests === 1;'));
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('NS.meta.goals.state.owned.barn = true; NS.meta.goals.equip("barn");');
  await t.wait(800);
  t.check('a fence paint repaints the fence', await M.run('return NS.fencePaint && NS.fencePaint[0] === "#7a1e1a";'));
  await t.shot('02-fence');

  /* the farm modes */
  await M.run('NS.clearSavedGame && NS.clearSavedGame(); G.savedGameAvailable = false; G.state = "READY";');
  await t.wait(400);
  t.check('the title offers Relaxed, Harvest Rush and the Daily Farm', await M.run('return ["relaxed", "rush", "daily"].every(id => (G.frameRegions || []).some(r => r.id === "title-mode-" + id));'));
  await t.shot('03-title-modes');
  await M.run('NS.modes.start("relaxed");');
  await t.wait(400);
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  t.check('Relaxed starts with triple credits', await M.run('return G.farmMode === "relaxed" && G.credits === 300;'));
  await M.run('G.credits = 0; G.inventory = {};');
  await t.wait(2600);
  t.check('a Relaxed farm never ends', await M.run('return G.state === "PLAYING";'));
  await M.run('G.state = "READY"; NS.modes.start("daily");');
  await t.wait(300);
  const a = await M.run('return JSON.stringify(G.tileTypes);');
  await M.run('G.state = "READY"; NS.modes.start("daily");');
  await t.wait(300);
  t.check('the Daily Farm is the same field every time today', a === await M.run('return JSON.stringify(G.tileTypes);') && await M.run('return G.farmMode === "daily";'));
  await M.run('G.state = "READY"; NS.modes.start("rush");');
  await t.wait(300);
  await M.run('G.stats.earned = 5000;');
  await t.wait(2600);
  t.check('Harvest Rush is won at 5,000 credits earned', await M.run('return G.state === "GAME_OVER" && G.farmResult.mode === "rush" && G.farmResult.won;'));
  await t.shot('04-rush-won');
};
