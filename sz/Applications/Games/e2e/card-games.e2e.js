'use strict';

/* Card Games' goals, mastery and story in a real browser: the first game opens with the Gilded
   Ace's welcome and the family's word while the table holds, a win counts toward mastery, and a felt
   from Goals is laid on the table and shows in Table & Cards. */
exports.ns = 'CardGames';
exports.game = 'card-games';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'CardGames');
  await M.open('card-games');
  await M.run('NS.game.selectGame("freecell");');
  await t.wait(1500);
  t.check('the first game opens with the welcome and holds the table', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-welcome');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.onOutcome("freecell", "win");');
  await t.wait(500);
  t.check('a win counts toward the family\'s mastery', await M.run('const s = NS.meta.goals.state.stats; return s.wins === 1 && s.fam_solitaire === 1 && NS.meta.mastery("freecell") === 1;'));
  await M.run('NS.meta.goals.state.owned.teal = true; NS.meta.open("cos");');
  await t.wait(300);
  await M.click('[data-a="equip"][data-v="teal"]');
  await M.click('[data-a="close"]');
  await t.wait(800);
  t.check('a felt is laid on the table', await M.run('return w.SZ.CardThemes.activeTheme.table === "goal-teal";'));
  await t.shot('02-felt');
};
