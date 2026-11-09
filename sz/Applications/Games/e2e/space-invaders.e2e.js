'use strict';

/* Space Invaders' story and goals in a real browser: the first campaign stage opens with the
   prologue and the sector's arrival while play holds, a boss stage opens with the boss's word, an
   aura equipped in Goals glows behind the ship, and destroyed aliens count toward an achievement. */
exports.ns = 'SpaceInvaders';
exports.game = 'space-invaders';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'SpaceInvaders');
  await M.open('space-invaders');
  await M.run('NS.stages.startStage(0);');
  await t.wait(1500);
  t.check('the first stage opens with the prologue and holds play', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through and play resumes', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.stages.startStage(4);');
  await t.wait(1200);
  t.check('a boss stage opens with the boss\'s word', await M.has('.szs-overlay') && (await M.text('.szs-text b')) === 'Crater Warden');
  await t.shot('02-boss');
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('NS.meta.goals.state.owned.plasma = true; NS.meta.open("cos");');
  await t.wait(300);
  await M.click('[data-a="equip"][data-v="plasma"]');
  await M.click('[data-a="close"]');
  await M.run('NS.stages.startStage(1);');
  await t.wait(600);
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('const a = G.aliens.find(a => a.alive); if (a) NS.combat.destroyAlien(a);');
  await t.wait(800);
  t.check('an aura is equipped and a destroyed alien unlocks an achievement', await M.run('return NS.meta.goals.equipped() === "plasma" && !!NS.meta.goals.state.ach.k1;'));
  await t.shot('03-aura');
};
