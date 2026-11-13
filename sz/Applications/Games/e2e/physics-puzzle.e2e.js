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

  /* level packs: locked until the world is cleared, then a mirrored remix plays and is recorded */
  await M.run('G.state = "packs";');
  await t.wait(400);
  t.check('the packs screen lists five Looking-Glass packs', await M.run('return G.PACKS.packs.length === 5 && G.hitAreas.some(h => h.id === "pack-m1-1");'));
  await M.run('for (const l of w.SZ.PhysicsPuzzleLevels.worldLevels(0)) G.save.levels[l.id] = { stars: [true, false, false], best: 1, plays: 1 };');
  await t.wait(300);
  await t.shot('04-packs');
  t.check('clearing the world opens its pack', await M.run('return G.Prog.packUnlocked(G.save, G.PACKS.packs[0], G.Lv.LEVELS) && !G.Prog.packUnlocked(G.save, G.PACKS.packs[1], G.Lv.LEVELS);'));
  await M.run('G.actions.startPack("m1-1"); G.state = "play";');
  await t.wait(800);
  let n2 = 0;
  while (await M.has('.szs-overlay') && n2++ < 10) await M.click('.szs-overlay');
  t.check('a remix plays mirrored', await M.run('const o = G.Lv.BY_ID["w1-1"]; return G.run.mode === "pack" && G.run.level.launcher[0] === 1280 - o.launcher[0];'));
  await t.shot('05-remix');
  await M.run('const sol = G.SOLUTIONS["m1-1"]; G.run.phase = "aim"; G.run.aimAngle = sol.shots[0][0]; NS.run.finishLevel();');
  await t.wait(600);
  t.check('a solved remix is recorded in the collection', await M.run('return G.save.packs["m1-1"] >= 1 && G.results.mode === "pack";'));
};
