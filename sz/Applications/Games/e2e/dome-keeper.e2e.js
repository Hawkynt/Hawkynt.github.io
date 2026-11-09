'use strict';

/* Dome Keeper's goals and story in a real browser: the landing scene with the cast, the Goals
   panel's tabs, a dome skin equipped with a real click and drawn on the dome, the Daily Run started
   on today's site with its twist, and deeds unlocking an achievement with a toast. */
exports.ns = 'DomeKeeper';
exports.game = 'dome-keeper';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'DomeKeeper');
  await M.open('dome-keeper');
  await M.run('NS.persistence.requestNewGame(); G.helpOpen = false; NS.run.startGameAfterGadgetSelect();');
  await t.wait(1500);
  t.check('the dig opens with the landing scene once the gadget is chosen', await M.has('.szs-overlay'));
  await t.wait(1200);
  await t.shot('01-story-landing');
  for (let i = 0; i < 12 && await M.has('.szs-overlay'); ++i) await M.click('.szs-overlay');
  t.check('clicks play the scene through', !(await M.has('.szs-overlay')));
  await M.run('NS.meta.open("today");');
  await t.wait(300);
  t.check('Goals opens with today\'s quests', await M.has('.szg-overlay .szg-row'));
  await t.shot('02-goals-today');
  await M.run('NS.meta.goals.state.owned.emerald = true;');
  await M.click('[data-tab="cos"]');
  await t.shot('03-goals-skins');
  await M.click('[data-a="equip"][data-v="emerald"]');
  t.check('a real click equips a dome skin', await M.run('return NS.meta.goals.equipped() === "emerald" && !!NS.domeSkin;'));
  await M.click('[data-tab="daily"]');
  await t.shot('04-goals-daily');
  await M.click('[data-a="daily"]');
  await t.wait(800);
  await M.run('NS.run.startGameAfterGadgetSelect();');
  await t.wait(800);
  for (let i = 0; i < 12 && await M.has('.szs-overlay'); ++i) await M.click('.szs-overlay');
  t.check('the Daily Run starts on today\'s site with its twist', await M.run('const r = NS.meta.goals.dailyRecipe(); return !!G.dailyRun && G.site.seed === (r.seed & 0x7fffffff) && G.dailyRun.twist.id === r.twist.id;'));
  await M.run('for (let i = 0; i < 3; ++i) NS.meta.deed("kills", 1);');
  await t.wait(300);
  t.check('deeds unlock achievements with a toast', await M.run('return !!NS.meta.goals.state.ach.k1;') && await M.has('.szg-toast'));
  await t.wait(2500);
  await t.shot('05-dome-emerald-toast');
};
