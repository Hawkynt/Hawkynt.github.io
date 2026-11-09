'use strict';

/* Physics Puzzle's story and goals in a real browser: the first campaign level opens with the
   prologue and the workshop's arrival while play holds, a fired shot and a solved level count
   toward goals, and a ball trail equipped in Goals colours the trail. */
exports.ns = 'PhysicsPuzzle';
exports.game = 'physics-puzzle';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'PhysicsPuzzle');
  await M.open('physics-puzzle');
  await M.run('NS.run.startCampaign(w.SZ.PhysicsPuzzleLevels.LEVELS[0].id); G.state = "play";');
  await t.wait(1500);
  t.check('the first level opens with the prologue and holds play', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.goals.state.owned.spark = true; NS.meta.goals.equip("spark"); G.run.phase = "aim"; NS.shot.fire();');
  await t.wait(1200);
  await t.shot('02-shot-trail');
  await M.run('NS.run.finishLevel();');
  await t.wait(800);
  t.check('a shot and a solved level count toward goals', await M.run('const s = NS.meta.goals.state; return s.stats.shots >= 1 && s.stats.levels >= 1 && !!s.ach.l1 && NS.meta.trailRgb() === "90,200,255";'));
  await t.shot('03-results');
};
