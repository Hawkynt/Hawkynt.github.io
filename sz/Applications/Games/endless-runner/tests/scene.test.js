'use strict';

/* The whole game in a fake browser: every screen and every cinematic shot draws and registers
   its buttons; all five worlds, all thirteen power-ups and a guardian run through the real loop;
   a busy scene (full particle pool, flight, giant, coin rain, a guardian with volleys) stays
   inside the per-frame draw-call budget; nothing ever uses shadowBlur; and once warm, frames
   only blit cached sprites instead of painting new ones. */
const H = require('./harness');
const env = H.installEnv();
global.requestAnimationFrame = () => 0;
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;
const K = NS.artKit;

function steps(n) { for (let i = 0; i < n; ++i) NS.sim.update(1 / 60); }
function frame() { const c0 = ctx.calls; NS.frame.draw(); return ctx.calls - c0; }
function key(code) {
  for (const f of env.listeners.keydown || []) f({ code: code, key: code, preventDefault() {}, repeat: false });
  for (const f of env.listeners.keyup || []) f({ code: code, key: code, preventDefault() {} });
}

check('first visit plays the intro', G.screen === 'cine' && G.cine.id === 'intro');
frame();
key('Space');
check('a key completes the typed line first', G.cine.i === 0 && G.cine.typed >= G.cine.shots[0].text.length);
key('Space');
check('the next key moves to the next shot', G.cine.i === 1);
key('Escape');
check('Escape skips to the title', G.screen === 'title' && !G.cine);
steps(120);
check('the title has a demo runner going', G.demo && G.demo.p.x > 500);

for (const s of ['title', 'map', 'tree', 'wardrobe', 'journal', 'help']) {
  NS.screens.open(s, 'title');
  steps(2);
  const calls = frame();
  check('screen ' + s + ' draws with hit areas', calls > 40 && G.hitAreas.length > 0, calls + ' calls');
}
for (const t of ['char', 'outfit', 'trail']) { G.ui.wardrobeTab = t; frame(); }
for (const t of ['goals', 'achievements', 'stats', 'scores']) { G.ui.journalTab = t; frame(); }
for (let p = 0; p < NS.help.PAGES.length; ++p) { G.ui.helpPage = p; frame(); }
check('every collection tab, journal tab and help page draws', true);

let shots = 0, worst = 0;
for (const id of Object.keys(NS.story.CINEMATICS)) {
  NS.cine.play(id, () => NS.screens.setScreen('title'));
  for (let i = 0; i < G.cine.shots.length; ++i) {
    G.cine.i = i; G.cine.typed = 999;
    worst = Math.max(worst, frame());
    ++shots;
  }
  NS.cine.end();
}
check(shots + ' cinematic shots in ' + Object.keys(NS.story.CINEMATICS).length + ' cinematics draw (worst ' + worst + ' calls)', shots >= 30 && worst < 2500);

/* every world and power-up in a real run */
NS.player.input = run => NS.autopilot.bits(run, NS.stream.get(run));
for (const st of ['meadow-1', 'canyon-2', 'frost-3', 'neon-4', 'rift-4']) {
  NS.run.start('story', { stageId: st });
  steps(60 * 8);
  frame();
  check('world ' + st + ' runs and draws', G.run.p.x > 2000, Math.round(G.run.p.x));
}
NS.run.start('arcade', {});
steps(100);
for (const pw of NS.items.POWERS) {
  NS.powers.activate(G.run, pw.id);
  steps(30);
  frame();
}
check('all 13 power-ups switch on and draw', G.run.powersUsed === 13 && NS.powers.active(G.run).length >= 6);

/* the busy scene budget */
NS.run.start('story', { stageId: 'rift-5' });
steps(60 * 6);
for (const id of ['jetpack', 'giant', 'rain', 'magnet', 'shield', 'multi']) NS.powers.activate(G.run, id);
for (let i = 0; i < 1600; ++i) NS.fx.spawn(i % 3 ? NS.fx.GLOW : NS.fx.STAR, G.run.p.x + (i % 40) * 20, 300 + (i % 23) * 10, 0, 0, 5, 12, '#ffffff', 0, i % 2);
for (let i = 0; i < 3; ++i) frame();
let maxCalls = 0;
const sb0 = ctx.shadowBlurUsed;
const made0 = K.stats().created;
for (let i = 0; i < 60; ++i) { NS.sim.update(1 / 60); maxCalls = Math.max(maxCalls, frame()); }
check('busy scene stays under 4500 draw calls per frame (' + maxCalls + ')', maxCalls < 4500);
check('a normal arcade frame stays under 900 draw calls', (() => { NS.fx.clear(); NS.run.start('arcade', {}); steps(60 * 10); let m = 0; for (let i = 0; i < 30; ++i) { steps(1); m = Math.max(m, frame()); } console.log('  arcade frame calls', m); return m < 900; })());
check('no frame ever used shadowBlur', ctx.shadowBlurUsed === 0 && sb0 === 0);
check('warm frames paint no new sprites', K.stats().created - made0 <= 4, (K.stats().created - made0) + ' new');

/* pause, tree from pause applies at once, resume */
key('Escape');
check('Escape pauses', G.screen === 'paused');
G.save.coins = 1e5;
NS.screens.open('tree', 'paused');
G.ui.treeSel = 'dashJets';
key('KeyB');
check('buying from the pause menu changes the run at once', G.stats.dashCd < 1.6);
key('Escape');
check('back to the pause menu', G.screen === 'paused');
key('Escape');
check('and back into the run', G.screen === 'playing');
done();
