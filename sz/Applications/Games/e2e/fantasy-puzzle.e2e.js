'use strict';

/* Fantasy Puzzle's story and goals in a real browser: the first campaign puzzle opens with the
   prologue and the Ember Grove's arrival while the puzzle holds, a robe from Goals dresses the mage,
   and casts count toward goals. */
exports.ns = 'FantasyPuzzle';
exports.game = 'fantasy-puzzle';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'FantasyPuzzle');
  await M.open('fantasy-puzzle');
  await M.run('NS.session.loadPuzzle("campaign", 0); G.state = "PLAYING";');
  await t.wait(1500);
  t.check('the first puzzle opens with the prologue and holds the puzzle', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.goals.state.owned.tide = true; NS.meta.open("cos");');
  await t.wait(300);
  await M.click('[data-a="equip"][data-v="tide"]');
  await M.click('[data-a="close"]');
  await M.run('for (let i = 0; i < 3; ++i) NS.meta.onCast();');
  await t.wait(1200);
  t.check('a robe dresses the mage and casts count', await M.run('return NS.meta.robe() === "#2a8ad8" && NS.meta.goals.state.stats.casts >= 3;'));
  await t.shot('02-robe');
};
