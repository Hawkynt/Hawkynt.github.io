'use strict';

/* Platformer's story and goals in a real browser: the first adventure level opens with the
   prologue and the world's arrival while play holds, the boss level's boss speaks when it wakes, a
   hero aura glows behind the hero, and stomps and cleared levels count toward goals. */
exports.ns = 'Platformer';
exports.game = 'platformer';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'Platformer');
  await M.open('platformer');
  await M.run('NS.session.startCampaign(0, 0, "adventure");');
  await t.wait(1500);
  t.check('the first level opens with the prologue and holds play', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through and play resumes', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.onBoss(G.run);');
  await t.wait(1000);
  t.check('a boss speaks with its name', (await M.text('.szs-text b')) === 'King Gloop');
  await t.shot('02-boss');
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('NS.meta.goals.state.owned.sunny = true; NS.meta.goals.equip("sunny"); NS.meta.deed("stomps", 1);');
  await t.wait(1500);
  await t.shot('03-aura');
  await M.run('NS.finish.finishLevel();');
  await t.wait(800);
  t.check('stomps and a cleared level count toward goals', await M.run('const s = NS.meta.goals.state; return s.stats.levels >= 1 && s.stats.stomps >= 1 && !!s.ach.l1;'));
  await t.shot('04-results');
};
