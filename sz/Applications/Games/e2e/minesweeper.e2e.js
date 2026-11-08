'use strict';

/* Minesweeper in a real browser: the title with the demo, Classic Beginner from its screen played
   with real mouse clicks (left opens, right flags) and keys, the results with the best time, the
   modes screen, the map, a guardian fight with its strikes, a Versus race with the rival's field,
   smoke and Lantern Night, the collection and the window at other sizes. */
exports.ns = 'Minesweeper';

async function skipCine(t) {
  for (let i = 0; i < 12 && await t.state('!!G.cine'); ++i) { await t.key('Escape', 'Escape', 27); await t.wait(150); }
  await t.waitFor('!G.cine', 4000);
}

/* the view-plane centre of cell i of the field in play */
function cell(t, i) {
  return t.run((NS, G, i) => { const g = G.run.game, L = NS.boardRender.layout(g); return { x: L.x0 + (i % g.w + 0.5) * L.s, y: L.y0 + (Math.floor(i / g.w) + 0.5) * L.s }; }, i);
}

/* plays the bot's moves through real mouse clicks */
async function clickPlay(t, max) {
  for (let k = 0; k < max && await t.state("G.screen === 'game' && G.run && !G.run.done"); ++k) {
    const a = await t.run((NS, G) => NS.bot.next(G.run.game));
    if (!a) break;
    const c = await cell(t, a.i);
    const p = await t.toPage(c.x, c.y);
    if (a.type === 'flag') {
      await t.page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await t.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', clickCount: 1 });
      await t.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 });
    } else await t.page.click(p.x, p.y);
    await t.wait(40);
  }
}

function autoplay(t, on, gap) {
  return t.run((NS, G, on, gap) => {
    clearInterval(window.__auto);
    if (!on) return;
    window.__auto = setInterval(() => {
      const r = G.run;
      if (!r || G.screen !== 'game' || G.cine || r.done) return;
      const a = NS.bot.next(r.game);
      if (a) NS.play.act(a.type === 'flag' ? 'flag' : 'reveal', a.i);
    }, gap);
  }, on, gap || 300);
}

exports.run = async (t) => {
  await t.open();
  await t.wait(2500);
  await t.shot('01-title');
  t.check('the title and its demo field draw', (await t.pixels(80, 140, 600, 460)).colors > 15);

  await t.hit('t-classic');
  await t.wait(300);
  await t.shot('02-classic-screen');
  await t.hit('cl-beginner');
  await t.wait(400);
  t.check('Beginner starts at once on a 9 x 9 field', await t.state("G.screen === 'game' && G.run.mode === 'classic' && G.run.game.w === 9"));
  const mid = 40;
  const c = await cell(t, mid);
  await t.clickAt(c.x, c.y);
  t.check('a real click opens the field', await t.state('G.run.game.opened > 0'));
  await t.shot('03-classic-first-click');
  const flagCell = await t.state('G.run.game.open.findIndex((o, i) => !o)');
  const fc = await cell(t, flagCell);
  const fp = await t.toPage(fc.x, fc.y);
  await t.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.wait(100);
  t.check('a real right click plants a flag', await t.state('G.run.game.flag[' + flagCell + '] === 1'));
  await t.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fp.x, y: fp.y, button: 'right', clickCount: 1 });
  await t.key('ArrowUp', 'ArrowUp', 38);
  t.check('the arrow keys bring up the cell cursor', await t.state('G.input.cursor >= 0'));
  await t.run((NS, G) => { G.run.game.noGuess = true; });
  await clickPlay(t, 120);
  await t.wait(800);
  await t.shot('04-classic-results');
  t.check('the Classic game ends in the results', await t.state("G.screen === 'results' && G.result.mode === 'classic'"));

  await t.run((NS) => NS.screens.setScreen('modes', 'title'));
  await t.wait(300);
  await t.shot('05-modes');
  await t.run((NS) => NS.screens.setScreen('map', 'title'));
  await t.wait(400);
  await t.shot('06-map');

  await t.run((NS) => NS.play.start('story', { stage: 'frost-6' }));
  await skipCine(t);
  await t.run((NS, G) => NS.play.act('reveal', Math.floor(G.run.game.h / 2) * G.run.game.w + Math.floor(G.run.game.w / 2)));
  await autoplay(t, true, 700);
  await t.waitFor("G.run.bossState && G.run.bossState.windup > 0 || G.run.done", 20000).catch(() => {});
  await t.shot('07-guardian-windup');
  await t.wait(1600);
  await t.run((NS, G) => { if (G.run.game.state === 'play') { NS.boss.strike(G.run, 'smoke'); NS.engine.rebury(G.run.game, 3); } });
  await t.wait(400);
  await t.shot('08-guardian-smoke');
  t.check('a guardian fight draws its field and the guardian', (await t.pixels(1010, 214, 240, 450)).colors > 15);
  await autoplay(t, false);

  await t.run((NS) => NS.play.start('versus', { cpu: 'pro' }));
  await skipCine(t);
  await autoplay(t, true, 450);
  await t.wait(6000);
  await t.shot('09-versus');
  t.check('the rival field draws on the right', (await t.pixels(1024, 276, 212, 208)).colors > 6);
  await autoplay(t, false);

  await t.run((NS) => { NS.play.start('daily', {}); });
  await skipCine(t);
  await t.run((NS, G) => { NS.play.act('reveal', 0); G.run.dark = true; });
  await autoplay(t, true, 250);
  await t.wait(3000);
  await t.shot('10-daily');
  await autoplay(t, false);
  await t.run((NS, G) => { G.run.dark = true; G.input.hoverCell = Math.floor(G.run.game.w * G.run.game.h / 2); });
  await t.wait(200);
  await t.shot('11-lantern-night');

  await t.run((NS, G) => { NS.save.saveRun(G.run); G.run = null; NS.screens.setScreen('wardrobe', 'title'); });
  await t.wait(400);
  await t.shot('12-collection');
  await t.run((NS, G) => { G.ui.wardTab = 1; });
  await t.wait(200);
  await t.shot('13-collection-flags');
  await t.run((NS) => NS.screens.setScreen('help', 'title'));
  await t.wait(300);
  await t.shot('14-help');

  for (const [w, h] of [[900, 600], [1600, 900]]) {
    await t.windowSize(w, h);
    await t.run((NS) => NS.play.start('classic', { diff: 'expert' }));
    await t.wait(300);
    await t.run((NS, G) => NS.play.act('reveal', 240));
    await t.wait(500);
    await t.shot('15-expert-' + w + 'x' + h);
  }
  await t.windowSize(null);
};
