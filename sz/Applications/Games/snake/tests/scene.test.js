'use strict';

/* The whole game in a fake browser: it boots to the title (first visit plays the intro), every
   screen and every cinematic draws with hit areas, every mode starts from the keyboard, a busy
   board (a long snake, a crowd of critters, a guardian, a full particle pool) stays within the
   per-frame draw-call budget, nothing ever uses shadowBlur, and after warm-up frames only blit
   cached sprites. */
const H = require('./harness');
const env = H.installEnv();
global.requestAnimationFrame = () => 0;
let clock = 1700000000000;
Date.now = () => (clock += 4513);
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;
const K = NS.artKit;

function steps(n) {
  for (let i = 0; i < n; ++i) NS.sim.update(1 / 60);
}

function frame() {
  const c0 = ctx.calls;
  NS.frame.draw(1 / 60);
  return ctx.calls - c0;
}

function key(code) {
  for (const f of env.listeners.keydown || []) f({ code: code, key: code, preventDefault() {}, repeat: false });
  for (const f of env.listeners.keyup || []) f({ code: code, key: code, preventDefault() {} });
}

check('a first visit opens with the intro cinematic', G.screen === 'cine' && G.cine && G.cine.id === 'intro');
frame();
key('Space');
check('a key finishes the typed line first', G.cine.typed >= G.cine.shots[0].text.length && G.cine.i === 0);
key('Space');
check('the next key moves to the next shot', G.cine.i === 1);
key('Escape');
check('Escape skips to the title', G.screen === 'title' && !G.cine);
steps(30);
check('the title runs a demo board behind the menu', G.run && G.run.mode === 'demo' && G.run.snake.body.length > 4);

/* every screen draws and registers its buttons */
for (const s of ['title', 'map', 'tree', 'wardrobe', 'journal', 'help']) {
  NS.screens.open(s, 'title');
  steps(2);
  const calls = frame();
  check('screen ' + s + ' draws with hit areas', calls > 60 && G.hitAreas.length > 0, calls + ' calls, ' + G.hitAreas.length + ' areas');
}
for (const tab of ['skin', 'trail', 'hat', 'board']) { G.ui.wardrobeTab = tab; frame(); }
for (const tab of ['goals', 'achievements', 'stats']) { G.ui.journalTab = tab; frame(); }
for (let p = 0; p < 5; ++p) { G.ui.helpPage = p; frame(); }
check('all collection, journal and help pages draw', true);

/* every cinematic shot draws */
let cineCalls = 0, shots = 0;
for (const id of Object.keys(NS.story.CINEMATICS)) {
  NS.cine.play(id, () => NS.screens.setScreen('title'));
  for (let i = 0; i < G.cine.shots.length; ++i) {
    G.cine.i = i;
    G.cine.t = 1.5;
    G.cine.typed = 30;
    cineCalls = Math.max(cineCalls, frame());
    ++shots;
  }
  NS.cine.end();
}
check('all ' + shots + ' cinematic shots draw', shots >= 30 && G.screen === 'title', shots);

/* modes start from the title through the keyboard */
NS.screens.setScreen('title');
G.save.seen.intro = true;
frame();
key('ArrowDown');
frame();
key('Enter');
check('Enter on the second title button starts Arcade', G.screen === 'playing' && G.run.mode === 'arcade', G.screen + ' ' + (G.run && G.run.mode));
steps(150);
key('ArrowUp');
steps(20);
check('arrow keys turn the snake', G.run.snake.dir === 0 || G.run.snake.dir === 2 || !G.run.snake.alive);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frame();
key('Escape');
check('Escape resumes with a short countdown', G.screen === 'playing' && G.run.phase === 'ready');

for (const m of ['startZen', 'startTime', 'startDaily']) {
  NS.run[m]();
  G.run.auto = true;
  steps(400);
  frame();
  check(m + ' runs and draws', G.screen === 'playing' && G.run.time > 4);
}
G.save.story.freed = ['mole', 'scorpion'];
NS.run.startRush();
G.run.auto = true;
steps(300);
check('Guardian Rush starts with the first freed guardian', G.run.mode === 'rush' && G.run.boss && G.run.boss.id === 'mole');

/* a busy board stays within budget */
NS.run.startStory(4, 5);
G.run.phase = 'play';
G.run.immortal = true;
G.run.snake.grow = 146;
G.run.auto = true;
for (let k = 0; k < 8; ++k) NS.enemies.spawnOne(['hornet', 'wisp', 'imp', 'beetle', 'rival', 'ant', 'hedgehog', 'rival'][k]);
for (const id of ['radiant', 'magnet', 'dash', 'golden']) G.run.act[id] = 30;
G.run.shield = 2;
steps(60 * 30);
while (NS.fx.P.n < NS.constants.MAX_PARTICLES - 10) NS.fx.burst(640, 360, 50, ['#ffffff', '#ff8a3a'], 300, 2, 8, NS.fx.P.n % 9);
for (let k = 0; k < 20; ++k) NS.fx.text(640, 360, '+100', '#ffffff', 20);
let worst = 0;
for (let f = 0; f < 120; ++f) { steps(1); frame(); }
while (NS.fx.P.n < NS.constants.MAX_PARTICLES - 10) NS.fx.burst(640, 360, 50, ['#ffffff', '#ff8a3a'], 300, 2, 8, NS.fx.P.n % 9);
const created0 = K.stats().created;
const fresh = [];
const origSprite = K.sprite;
K.sprite = function(key, w, h, paint) { if (!K.has(key)) fresh.push(key); return origSprite(key, w, h, paint); };
for (let f = 0; f < 120; ++f) {
  steps(1);
  worst = Math.max(worst, frame());
}
check('the busy board had a long snake and a crowd', G.run.snake.body.length > 30 && G.run.enemies.length >= 8, G.run.snake.body.length + ' segments');
check('a busy frame stays under 9000 draw calls', worst < 9000, worst);
check('busy frames only blit: at most a few first-time effect colours are painted', K.stats().created - created0 <= 4, (K.stats().created - created0) + ' new: ' + fresh.join(', '));
check('the sprite cache stays bounded', K.stats().keys < 900, K.stats().keys);
check('shadowBlur is never used', ctx.shadowBlurUsed === 0, ctx.shadowBlurUsed);

/* a rough JS cost per frame with the recording canvas */
const t0 = performance.now();
for (let f = 0; f < 120; ++f) { steps(1); frame(); }
const ms = (performance.now() - t0) / 120;
console.log('  busy frame: ' + worst + ' draw calls, ' + ms.toFixed(2) + ' ms JS per frame (fake canvas)');
check('busy frame JS time under 6 ms', ms < 6, ms.toFixed(2));

done();
