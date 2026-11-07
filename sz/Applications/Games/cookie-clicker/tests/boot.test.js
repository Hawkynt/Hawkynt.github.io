'use strict';

/* Boot and play smoke test: every screen draws without errors, the bakery runs for a while
   with clicks, purchases and golden treats, and no frame uses shadowBlur. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;

check('boots onto the title screen', G.screen === 'title');
NS.frame.draw();
check('title draws', ctx.calls > 100, ctx.calls);
NS.title.startGame();
check('first start plays the intro', G.cine && G.cine.id === 'intro');
NS.cinematics.skip();
check('skipping the intro lands in the bakery', !G.cine && G.screen === 'game' && G.profile.seenIntro);
for (let i = 0; i < 40; ++i) NS.clicking.click(false);
check('clicks bake', G.run.baked >= 40, G.run.baked);
check('clicks build a combo', G.run.combo >= 30, G.run.combo);
G.run.cookies = 1e6;
check('buys a cursor', NS.purchasing.buyBuilding('cursor'));
check('buys a grandma', NS.purchasing.buyBuilding('grandma'));
H.run(NS, 120, 1 / 60, 10);
check('producers bake over time', G.run.baked > 40 + 0.1);
NS.golden.spawn();
const g = G.goldens[0];
check('a golden treat spawns', !!g);
NS.golden.tryClick(g.x, g.y);
check('catching it counts', G.profile.stats.golden === 1);
G.profile.stageMax = Math.max(G.profile.stageMax, 3);
const screens = ['game', 'paused', 'tree', 'collection', 'journal', 'ascend', 'help', 'zen', 'garden', 'trials', 'title'];
let errors = 0;
for (const s of screens) {
  try {
    NS.screens.setScreen(s);
    for (let k = 0; k < 5; ++k) { NS.app.update(1 / 60); NS.frame.draw(); }
    if (s === 'collection' || s === 'journal') for (let t = 0; t < 5; ++t) { G.ui.collTab = t % 4; G.ui.journalTab = t; NS.frame.draw(); }
  } catch (e) {
    ++errors;
    console.log(s, e.stack);
  }
}
check('every screen draws', errors === 0);
NS.modes.startBake(true);
check('Daily Bake-Off starts with a modifier', G.bake && G.bake.mods && G.cine);
NS.cinematics.skip();
H.run(NS, 60, 1 / 60, 6);
G.bake.timeLeft = 0.01;
NS.app.update(1 / 30);
check('Bake-Off ends in the results', !G.bake && G.screen === 'bakeResult' && G.ui.bakeResult);
NS.frame.draw();
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
done();
