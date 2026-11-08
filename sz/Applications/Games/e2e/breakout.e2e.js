'use strict';

/* Breakout in a real browser: the title, the modes screen with the Duo and Arena cards, a Duo
   and an Arena run started from their cards with the partner paddles on their edges and the team
   panel, a story stage, the results, and no WALL banner while balls bounce off the side walls. */
exports.ns = 'Breakout';

/* the paddle bot stands in for the player's hands */
function autoplay(t, on) {
  return t.run((NS, G, on) => {
    if (!NS.input.__state) NS.input.__state = NS.input.state;
    NS.input.state = on ? () => (G.run && G.run.game ? NS.bot.input(G.run.game) : NS.input.__state()) : NS.input.__state;
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
  t.check('the title draws', (await t.pixels(400, 200, 500, 160)).spread > 20);
  await t.hit('t-modes');
  await t.wait(300);
  await t.shot('02-modes');
  t.check('the modes screen shows the Duo and Arena cards', await t.state("G.hitAreas.some(a => a.id === 'mode-duo') && G.hitAreas.some(a => a.id === 'mode-arena')"));

  for (const mode of ['duo', 'arena']) {
    if (!await t.state("G.screen === 'modes'")) { await t.run((NS) => NS.screens.setScreen('modes', 'title')); await t.wait(200); }
    await t.hit('mode-' + mode);
    await skipCine(t);
    t.check(mode + ' starts from its card with partners', await t.state("G.screen === 'game' && G.run.game.mates.length === " + (mode === 'duo' ? 1 : 3)));
    await autoplay(t, true);
    await t.run((NS, G) => { window.__banners = 0; const f = NS.fx.text; NS.fx.text = function (x, y, s) { if (/^WALL /.test(s) && !/\d/.test(s)) ++window.__banners; return f.apply(this, arguments); }; });
    await t.wait(9000);
    await t.shot('03-' + mode);
    await t.closeup('03-' + mode + '-field', 280, 50, 720, 660, 1);
    const top = await t.pixels(290, 66, 700, 30);
    t.check(mode + ': the top partner paddle is drawn', top.colors > 6, top);
    if (mode === 'arena') {
      const left = await t.pixels(292, 100, 30, 500), right = await t.pixels(958, 100, 30, 500);
      t.check('arena: the side partner paddles are drawn', left.colors > 5 && right.colors > 5, { left, right });
    }
    let saved = true;
    await t.waitFor('G.run.game.mates.some(m => m.hits > 0)', 30000).catch(() => { saved = false; });
    t.check(mode + ': partners return balls', saved);
    t.check(mode + ': no "WALL undefined" banner while balls bounce', await t.state('window.__banners === 0 && !NS.fx.texts.some(x => x.on && /undefined/.test(x.text))'));
    await autoplay(t, false);
    await t.run((NS) => NS.play.quit());
    await t.wait(500);
    t.check(mode + ': quitting opens the results with partner saves', await t.state("G.screen === 'results' && G.result.mateHits != null"));
    if (mode === 'duo') await t.shot('04-results-duo');
    await t.hit('r-map');
  }

  await t.run((NS) => NS.play.start('story', { stage: NS.worldData.STAGES[0].id }));
  await skipCine(t);
  await autoplay(t, true);
  await t.wait(5000);
  await t.shot('05-story');
  t.check('a story stage plays', await t.state("G.screen === 'game' && G.run.game.stats.bricks > 0"));
  await autoplay(t, false);
};
