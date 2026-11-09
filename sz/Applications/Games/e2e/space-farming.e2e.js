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
};
