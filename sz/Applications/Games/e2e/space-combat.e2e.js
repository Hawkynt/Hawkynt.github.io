'use strict';

/* Space Combat's story and goals in a real browser: the first campaign mission opens with the
   prologue and the sector's arrival while the battle holds, a boss speaks when it arrives, the
   Goals panel equips a livery that repaints the ship, and a won mission counts toward goals. */
exports.ns = 'SpaceCombat';
exports.game = 'space-combat';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'SpaceCombat');
  await M.open('space-combat');
  await M.run('NS.missions.startRun("campaign", { sector: 0, index: 0 }); NS.screens.setScreen("playing");');
  await t.wait(1500);
  t.check('the first mission opens with the prologue and holds the battle', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through and the battle goes on', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.bosses.spawn(Object.keys(NS.enemyData.BOSSES || {})[0] || "warden", 640);');
  await t.wait(1200);
  t.check('a boss speaks when it arrives', await M.has('.szs-overlay'));
  await t.shot('02-boss-line');
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('NS.meta.goals.state.owned.ace = true; NS.meta.open("cos");');
  await t.wait(300);
  await M.click('[data-a="equip"][data-v="ace"]');
  t.check('a livery repaints the ship', await M.run('return NS.meta.livery() && NS.meta.livery().key === "ace";'));
  await t.shot('03-livery');
  await M.click('[data-a="close"]');
  await M.run('G.boss = null; NS.missions.win();');
  for (let i = 0; i < 60 && await M.run('return G.screen !== "results";'); ++i) await t.wait(250);
  t.check('a won mission counts toward goals', await M.run('return (NS.meta.goals.state.stats.missions || 0) >= 1;'));
  await t.shot('04-results');

  /* the mission autosave: a destroy mission halfway through comes back with its progress */
  const idx = await M.run('const m = NS.waves.campaignStage(0, 0); for (let s = 0; s < 5; ++s) for (let i = 0; i < 6; ++i) if (NS.waves.campaignStage(s, i).type === "destroy") return [s, i]; return [0, 1];');
  await M.run('NS.missions.startRun("campaign", { sector: ' + idx[0] + ', index: ' + idx[1] + ' }); NS.screens.setScreen("playing");');
  await t.wait(800);
  let n2 = 0;
  while (await M.has('.szs-overlay') && n2++ < 30) await M.click('.szs-overlay');
  await M.run('const rt = G.stage.rt; rt.t = 40; rt.outpostsLeft = Math.max(1, rt.outposts - 1); rt.outQueue = rt.outQueue.slice(1); G.score = 7777; G.kills = 42; G.player.hull = G.player.maxHull * 0.6; NS.checkpoint.save();');
  t.check('a mission in progress is autosaved', await M.run('const s = NS.checkpoint.load(); return !!s && s.score === 7777 && Math.abs(s.rt.t - 40) < 0.5;'));
  await M.run('NS.screens.setScreen("title");');
  await t.wait(500);
  t.check('the title offers to continue the mission', await M.run('return G.hitAreas.some(h => h.id === "continue");'));
  await t.shot('05-title-continue');
  await M.run('NS.checkpoint.resume();');
  await t.wait(300);
  t.check('Continue rebuilds the mission with its progress, score and hull', await M.run('const rt = G.stage.rt; return G.screen === "playing" && rt.t >= 40 && rt.outpostsLeft === Math.max(1, rt.outposts - 1) && G.score === 7777 && G.kills === 42 && Math.abs(G.player.hull - G.player.maxHull * 0.6) < 1;'));
  await t.shot('06-resumed');
};
