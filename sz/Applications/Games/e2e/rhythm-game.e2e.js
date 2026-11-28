'use strict';

/* The Rhythm Game in a real browser: the title with the bot's demo, the story intro skipped with a
   real Escape, the map, the first stage played with real key presses (the arrow keys and D F J K
   sent through the DevTools protocol at the notes' times by an in-page timer reading the chart, so
   timing goes through the game's own key handler) into the results, pause and resume, a duel with its
   attack banner, Surge, Free Play on Expert with mutators, the shop with a crate opened, the
   collection, the tree, the journal, settings and the window at other sizes. */
exports.ns = 'RhythmGame';

async function skipCine(t) {
  for (let i = 0; i < 12 && await t.state('!!G.cine'); ++i) { await t.key('Escape', 'Escape', 27); await t.wait(150); }
  await t.waitFor('!G.cine', 4000);
}

/* an in-page player: dispatches real keydown/keyup events at the chart's note times */
function autoplay(t, on, miss) {
  return t.run((NS, G, on, miss) => {
    clearInterval(window.__auto);
    if (!on) return;
    const KEYS = ['d', 'f', 'j', 'k'];
    /* the game's own window and document (this code runs in the desktop page) */
    const doc = NS.view.canvas.ownerDocument, KE = doc.defaultView.KeyboardEvent;
    let plan = null, run = null;
    window.__auto = setInterval(() => {
      const r = G.run;
      if (!r || G.screen !== 'game' || G.cine || r.done || r.mode === 'demo') return;
      if (r !== run) { run = r; plan = NS.bot.plan(r.chart, miss ? 'casual' : 'pro', 7); while (plan.i < plan.acts.length && plan.acts[plan.i].t < r.cond.t) ++plan.i; }
      const now = r.cond.t + 0.004;
      while (plan.i < plan.acts.length && plan.acts[plan.i].t <= now) {
        const a = plan.acts[plan.i++];
        doc.dispatchEvent(new KE(a.type === 'press' ? 'keydown' : 'keyup', { key: KEYS[a.lane], code: 'Key' + KEYS[a.lane].toUpperCase(), bubbles: true }));
      }
      if (r.eng.surge >= 0.5) doc.dispatchEvent(new KE('keydown', { key: ' ', code: 'Space', bubbles: true }));
    }, 4);
  }, on, !!miss);
}

exports.run = async (t) => {
  await t.open();
  await t.wait(2500);
  await t.shot('01-title');
  t.check('the title with its demo highway draws', (await t.pixels(100, 200, 500, 450)).colors > 20);
  t.check('the demo is played by the bot', await t.state("G.run && G.run.mode === 'demo' && G.run.eng.counts.perfect + G.run.eng.counts.great > 0"));

  await t.hit('t-story');
  await t.wait(1200);
  await t.shot('02-intro');
  t.check('the first Story opens the intro cinematic', await t.state("G.cine && G.cine.id === 'intro'"));
  await t.key('Escape', 'Escape', 27);
  await t.wait(400);
  await t.shot('03-map');
  t.check('Escape skips onto the map', await t.state("G.screen === 'map' && !G.cine"));

  await t.hit('play');
  await skipCine(t);
  t.check('the first stage starts', await t.state("G.screen === 'game' && G.run.stage.id === 'docks-1'"));
  /* a few real key presses through the DevTools protocol */
  await t.waitFor('G.run.cond.t > 0.5', 8000);
  await t.key('ArrowLeft', 'ArrowLeft', 37);
  await t.key('d', 'KeyD', 68);
  t.check('real key presses light the lanes', await t.state('G.input.laneFlash[0] > 0'));
  await autoplay(t, true);
  await t.wait(9000);
  await t.shot('04-playing');
  t.check('the song is played with key events', await t.state('G.run.eng.counts.perfect + G.run.eng.counts.great > 4 && G.run.eng.counts.miss < 3'));
  t.check('the highway and notes draw', (await t.pixels(380, 100, 520, 520)).colors > 30);
  await t.key('Escape', 'Escape', 27);
  await t.wait(300);
  await t.shot('05-paused');
  t.check('Escape pauses', await t.state("G.screen === 'paused'"));
  await t.key('Escape', 'Escape', 27);
  await t.wait(200);
  t.check('and resumes with a count-in', await t.state("G.screen === 'game'"));
  await t.waitFor("G.screen === 'results'", 120000);
  await t.wait(1800);
  await t.shot('06-results');
  t.check('the song ends in the results with a grade', await t.state("G.result && G.result.cleared && G.result.grade !== 'F'"));

  await t.run((NS) => NS.play.start('story', { stage: 'foundry-6' }));
  await skipCine(t);
  await t.waitFor("G.ui.banner || G.run.done", 60000);
  await t.wait(600);
  await t.shot('07-duel-telegraph');
  await t.waitFor('G.run.eng.attack || G.run.done', 20000);
  await t.wait(1200);
  await t.shot('08-duel-hammerfall');
  t.check('a duel draws its boss beside the highway', (await t.pixels(960, 360, 300, 330)).colors > 20);
  await t.run((NS, G) => { G.run.eng.surge = 1; NS.play.surge(); });
  await t.wait(500);
  await t.shot('09-surge');
  await autoplay(t, false);

  await t.run((NS, G) => { G.profile.owned.songs['rg-shop-wave'] = true; NS.play.start('free', { song: 'rg-shop-wave', diff: 'expert', mutators: ['hidden'] }); });
  await autoplay(t, true, true);
  await t.wait(7000);
  await t.shot('10-free-expert-hidden');
  await autoplay(t, false);
  await t.run((NS, G) => { NS.play.quit(); G.run = null; NS.screens.setScreen('library', 'title'); });
  await t.wait(400);
  await t.shot('11-library');

  await t.run((NS, G) => { G.profile.crates.owned = 1; G.ui.shopTab = 3; NS.screens.setScreen('shop', 'title'); });
  await t.wait(300);
  await t.hit('crate-open');
  await t.wait(3200);
  await t.shot('12-crate');
  t.check('a crate reveals three items', await t.state('G.ui.crate && G.ui.crate.shown === 3'));
  await t.run((NS, G) => { G.ui.crate = null; G.ui.shopTab = 0; });
  await t.wait(300);
  await t.shot('13-offers');
  for (const [s, tab, n] of [['wardrobe', 'wardTab', 0], ['wardrobe', 'wardTab', 1], ['tree', null, 0], ['journal', 'journalTab', 2], ['settings', null, 0], ['modes', null, 0], ['help', null, 0]]) {
    await t.run((NS, G, s, tab, n) => { if (tab) G.ui[tab] = n; NS.screens.setScreen(s, 'title'); }, s, tab, n);
    await t.wait(400);
    await t.shot('14-' + s + (tab ? '-' + n : ''));
  }

  for (const [w, h] of [[900, 600], [1600, 900]]) {
    await t.windowSize(w, h);
    await t.run((NS) => NS.play.start('story', { stage: 'spire-3' }));
    await skipCine(t);
    await autoplay(t, true);
    await t.wait(4000);
    await t.shot('15-spire-' + w + 'x' + h);
    await autoplay(t, false);
  }
  await t.windowSize(null);
};
