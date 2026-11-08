'use strict';

/* Tetris in a real browser: the title, the modes screen with the wide Versus card, a Versus match
   for every rule set started from that card (with real key presses for moving and dropping), the
   rival board drawn on the right, the solo Blast, Pairs and Jewels modes, the results, the help
   pages and the window at other sizes. */
exports.ns = 'Tetris';

/* plays the human side with the engine's own bot until stopped, so screens show real games */
function autoplay(t, on) {
  return t.run((NS, G, on) => {
    clearInterval(window.__auto);
    if (!on) return;
    window.__auto = setInterval(() => {
      const r = G.run;
      if (!r || G.screen !== 'game' || G.cine || r.done) return;
      const g = r.game;
      if (!NS.run.engineOf(g).active(g)) return;
      if (g.match) NS.match.playPiece(g); else NS.bot.playPiece(g);
    }, 260);
  }, on);
}

async function skipCine(t) {
  for (let i = 0; i < 12 && await t.state('!!G.cine'); ++i) { await t.key('Escape', 'Escape', 27); await t.wait(150); }
  await t.waitFor('!G.cine', 4000);
}

/* the rival board sits at the right: its well spans about x 1012..1215, y 118..507 */
async function boardsDrawn(t) {
  const you = await t.pixels(500, 80, 280, 560), rival = await t.pixels(1020, 130, 190, 370);
  return { you, rival, ok: you.colors > 12 && rival.colors > 12 };
}

exports.run = async (t) => {
  await t.open();
  await t.wait(800);
  await t.shot('01-title');
  t.check('the title draws', (await t.pixels(400, 200, 500, 160)).spread > 20);

  await t.hit('t-modes');
  await t.wait(300);
  t.check('Modes opens the modes screen', await t.state("G.screen === 'modes'"));
  await t.shot('02-modes');
  const card = await t.pixels(656, 448, 576, 166);
  t.check('the wide Versus card draws its rule and rival buttons', card.colors > 20, card);

  for (const rule of ['pairs', 'jewels', 'blast', 'blocks']) {
    if (!await t.state("G.screen === 'modes'")) { await t.run((NS) => NS.screens.setScreen('modes', 'title')); await t.wait(200); }
    await t.hit('vsr-' + rule);
    await t.hit('vs-rookie');
    await t.wait(300);
    t.check('Versus ' + rule + ' starts from the card', await t.state("G.screen === 'game' && G.run.vs && G.run.rule === '" + rule + "'"));
    await skipCine(t);
    if (rule === 'pairs') {
      t.check('a new pair is in sight at once', await t.state('NS.match.cellsOf("pairs", G.run.game.piece).every(c => c[1] >= NS.match.HIDDEN)'));
      const x0 = await t.state('G.run.game.piece.x');
      await t.key('ArrowLeft', 'ArrowLeft', 37);
      t.check('the Left key moves the pair', await t.state('G.run.game.piece.x') === x0 - 1);
      for (let k = 0; k < 4; ++k) await t.key('ArrowLeft', 'ArrowLeft', 37);
      t.check('tapping Left walks it to the wall', await t.state('G.run.game.piece.x') === 0);
      await t.key('ArrowUp', 'ArrowUp', 38);
      t.check('Up turns it', await t.state('G.run.game.piece.r') === 1);
      await t.waitFor('NS.match.grounded(G.run.game) || G.run.game.pieces > 0', 15000);
      const landed = await t.state('G.run.game.pieces');
      await t.key('ArrowRight', 'ArrowRight', 39);
      await t.wait(250);
      await t.key('ArrowRight', 'ArrowRight', 39);
      t.check('a landed pair can still slide', await t.state('G.run.game.pieces') === landed);
      const p0 = await t.state('G.run.game.pieces');
      await t.key(' ', 'Space', 32);
      await t.wait(100);
      t.check('Space drops it', await t.state('G.run.game.pieces') >= p0 + 1 || await t.state('G.run.game.pieces') === p0 && !(await t.state('!!G.run.game.piece')));
    }
    await autoplay(t, true);
    await t.wait(6000);
    await t.shot('03-versus-' + rule);
    if (rule !== 'blocks') {
      await t.waitFor('!!G.run.game.popping || G.run.done', 10000).catch(() => {});
      await t.closeup('03-versus-' + rule + '-burst', 480, 90, 320, 600, 1.5);
    }
    const b = await boardsDrawn(t);
    t.check('Versus ' + rule + ': both boards are drawn', b.ok, b);
    t.check('Versus ' + rule + ': the rival plays', await t.state('G.run.rival.pieces >= 3'));
    await autoplay(t, false);
    await t.run((NS) => NS.play.quit());
    await t.wait(500);
    t.check('Versus ' + rule + ': quitting opens the results', await t.state("G.screen === 'results' && G.result.rule === '" + rule + "'"));
    if (rule === 'pairs') await t.shot('04-results-versus');
    await t.hit('r-map');
  }

  for (const mode of ['blast', 'pairs', 'jewels']) {
    if (!await t.state("G.screen === 'modes'")) { await t.run((NS) => NS.screens.setScreen('modes', 'title')); await t.wait(200); }
    await t.hit('mode-' + mode);
    await skipCine(t);
    t.check(mode + ' starts from its card', await t.state("G.screen === 'game' && G.run.mode === '" + mode + "'"));
    await autoplay(t, true);
    await t.wait(7000);
    await t.shot('05-solo-' + mode);
    const px = await t.pixels(500, 80, 280, 560);
    t.check(mode + ': the well fills with pieces', px.colors > 12, px);
    await autoplay(t, false);
    await t.run((NS) => NS.play.quit());
    await t.wait(400);
    await t.hit('r-map');
  }

  await t.run((NS) => NS.screens.setScreen('help', 'title'));
  await t.wait(300);
  await t.shot('06-help');

  await t.run((NS) => NS.play.start('versus', { cpu: 'pro', rule: 'jewels' }));
  await skipCine(t);
  await autoplay(t, true);
  await t.wait(2500);
  await autoplay(t, false);
  for (const [w, h] of [[960, 600], [1600, 900]]) {
    await t.windowSize(w, h);
    await t.run((NS) => NS.play.start('versus', { cpu: 'pro', rule: 'jewels' }));
    await skipCine(t);
    await autoplay(t, true);
    await t.wait(2500);
    await t.shot('07-window-' + w + 'x' + h);
    const b = await boardsDrawn(t);
    t.check('at ' + w + 'x' + h + ' both boards still draw', b.ok, b);
    await autoplay(t, false);
  }
  await t.windowSize(null);
};
