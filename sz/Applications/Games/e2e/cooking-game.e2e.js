'use strict';

/* Cooking Game's story and goals in a real browser: the first career day opens with the prologue
   and the food truck's opening while the kitchen holds, an apron from Goals dresses the chef, and a
   finished day counts toward goals. */
exports.ns = 'CookingGame';
exports.game = 'cooking-game';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'CookingGame');
  await M.open('cooking-game');
  await M.run('NS.day.startDay("career", 0);');
  await t.wait(1500);
  t.check('the first day opens with the prologue and holds the kitchen', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.goals.state.owned.cherry = true; NS.meta.goals.equip("cherry"); NS.meta.onServe("perfect", 3);');
  await t.wait(1500);
  await t.shot('02-apron');
  await M.run('NS.day.endDay();');
  await t.wait(800);
  t.check('serving and a finished day count toward goals', await M.run('const s = NS.meta.goals.state; return s.stats.served >= 1 && s.stats.days >= 1 && !!s.ach.d1;'));
  await t.shot('03-day-over');
};
