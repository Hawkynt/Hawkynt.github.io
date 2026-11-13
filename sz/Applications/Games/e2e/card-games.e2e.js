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

  /* the table buttons sit in their own band above the board, never over a card */
  for (const v of ['solitaire', 'freecell', 'spider']) {
    await M.run('NS.game.selectGame("' + v + '");');
    await t.wait(900);
    let k = 0;
    while (await M.has('.szs-overlay') && k++ < 20) await M.click('.szs-overlay');
    t.check(v + ': the table buttons are above the board', await M.run('const K = NS.constants; return [K.MENU_BTN, K.HINT_BTN, K.SORT_BTN, K.STYLE_BTN].every(b => b.y + b.h <= 0) && NS.dom.view.oy >= K.TOOLBAR_H * NS.dom.view.scale - 0.5;'));
    t.check(v + ': a click at the top-right corner of the board reaches the game, not a button', await M.run('const K = NS.constants, x = K.CANVAS_W - 40, y = 20; return ![K.MENU_BTN, K.HINT_BTN, K.STYLE_BTN].some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);'));
    await t.wait(3500);
    await t.shot('03-' + v);
  }
};
