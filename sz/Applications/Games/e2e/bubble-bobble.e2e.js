'use strict';

/* Bubble Bobble in a real browser: the title, the co-op switch on the modes screen and on the
   map, a co-op story room and Arcade run with Pop drawn in his colours and his partner card, Pop
   knocked out and floating back, and the results counting his traps. */
exports.ns = 'BubbleBobble';

function autoplay(t, on) {
  return t.run((NS, G, on) => {
    if (!NS.input.__state) NS.input.__state = NS.input.state;
    const mem = {};
    NS.input.state = on ? () => (G.run && G.run.game ? NS.bot.input(G.run.game, mem) : NS.input.__state()) : NS.input.__state;
  }, on);
}

async function skipCine(t) {
  for (let i = 0; i < 12 && await t.state('!!G.cine'); ++i) { await t.key('Escape', 'Escape', 27); await t.wait(150); }
  await t.waitFor('!G.cine', 4000);
}

exports.run = async (t) => {
  await t.open();
  await t.wait(800);
  await t.shot('01-title');
  await t.hit('t-modes');
  await t.wait(300);
  t.check('co-op starts off', await t.state('!G.profile.settings.coop'));
  await t.hit('coop');
  await t.wait(200);
  t.check('the co-op switch on the modes screen turns Pop on', await t.state('G.profile.settings.coop === true'));
  await t.shot('02-modes-coop');

  await t.hit('mode-arcade');
  await skipCine(t);
  t.check('Arcade starts with Pop', await t.state("G.screen === 'game' && !!G.run.game.buddy"));
  await autoplay(t, true);
  await t.wait(8000);
  await t.shot('03-arcade-coop');
  await t.closeup('03-arcade-field', 290, 66, 700, 590, 1);
  t.check('Pop has trapped or popped something', await t.state('G.run.game.buddy.trapped + G.run.game.buddy.popped > 0'));
  await t.run((NS, G) => { G.run.game.buddy.inv = 0; NS.engine.hurt(G.run.game, 'enemy', G.run.game.buddy); });
  await t.wait(1200);
  await t.shot('04-pop-floating-back');
  t.check('Pop floats back after a hit without costing a life', await t.state('G.run.game.buddy.dead > 0'));
  await t.wait(3000);
  t.check('and is back in play', await t.state('!G.run.game.buddy.dead'));
  await autoplay(t, false);
  await t.run((NS) => NS.play.quit());
  await t.wait(500);
  await t.shot('05-results-coop');
  t.check('the results count Pop\'s traps', await t.state("G.screen === 'results' && G.result.popTrapped != null"));

  await t.run((NS) => NS.screens.setScreen('map', 'title'));
  await t.wait(400);
  await t.shot('06-map-coop');
  t.check('the map has the co-op switch', await t.state("G.hitAreas.some(a => a.id === 'coop')"));
  await t.hit('play');
  await skipCine(t);
  t.check('a story room starts with Pop', await t.state("G.screen === 'game' && G.run.mode === 'story' && !!G.run.game.buddy"));
  await autoplay(t, true);
  await t.wait(6000);
  await t.shot('07-story-coop');
  await autoplay(t, false);
};
