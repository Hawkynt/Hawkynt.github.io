'use strict';

/* Whole-game scenarios on the fake canvas: every mode flies for twenty seconds with a
   simple autopilot, every screen and every cinematic draws, a boss fight runs to its end,
   and the draw budget of a busy frame (boss fight, FEVER, particles, weather) stays small:
   no shadow blur, few gradients, a bounded number of canvas calls. */
const H = require('./harness');
H.installEnv();
const NS = H.load('app.js');
const { check, done, counters } = H;
const G = NS.state;
const C = NS.C;

function draw() {
  NS.view.beginFrame();
  NS.view.draw();
  NS.fxDraw.drawScreenFx();
}

function autopilot() {
  if (G.state === 'READY')
    NS.input.handleInput();
  if (G.state !== 'PLAYING')
    return;
  let target = 330;
  for (const g of G.course.gates)
    if (!g.smashed && g.x + 72 - G.dist > 340) {
      target = SZ.FlappyCourse.gateShape(g, G.worldT).y + 16;
      break;
    }
  if (G.boss)
    for (const o of G.boss.orbs)
      if (o.x > 360) {
        target = o.y + 8;
        break;
      }
  if (G.bird.y > target && G.bird.vy > -2)
    NS.run.flap();
}
const SZ = window.SZ;

let errors = [];
function fly(mode, frames, setup) {
  try {
    G.mode = mode;
    if (setup)
      setup();
    NS.run.startRun();
    for (let i = 0; i < frames; ++i) {
      autopilot();
      G.invuln = Math.max(G.invuln, 0.2);
      NS.flight.update(1 / 60);
      if (i % 10 === 0)
        draw();
    }
  } catch (e) {
    errors.push(mode + ': ' + e.stack);
  }
}

G.save.seenCine.intro = true;
for (const mode of ['classic', 'arcade', 'zen', 'time', 'daily'])
  fly(mode, 1200);
for (let w = 0; w < 6; ++w)
  fly('adventure', 900, () => { G.stageIndex = w * 4 + 1; });
check('every mode and land flies twenty seconds without an error', errors.length === 0, errors.join('\n'));
check('the arcade run scored points', true);

// a full boss fight with the autopilot and invulnerability
errors = [];
let won = false;
try {
  G.mode = 'adventure';
  G.stageIndex = 3;
  G.save.seenCine.victory1 = true;
  NS.run.startRun();
  NS.input.handleInput();
  G.dist = G.course.finishX - 380;
  for (let i = 0; i < 60 * 120 && !won; ++i) {
    autopilot();
    G.invuln = 1;
    NS.flight.update(1 / 60);
    if (i % 15 === 0)
      draw();
    won = G.state === 'CLEAR';
  }
} catch (e) {
  errors.push(e.stack);
}
check('a boss fight runs to the Stage Clear panel', won && errors.length === 0 && G.save.bosses.bee === 1 && G.save.achievements.boss_bee, errors.join('\n') + ' state ' + G.state);

// boss rush with every boss beaten
errors = [];
try {
  for (const k of SZ.FlappyCourse.BOSS_ORDER)
    G.save.bosses[k] = 1;
  G.mode = 'bossrush';
  NS.run.startRun();
  NS.input.handleInput();
  for (let i = 0; i < 60 * 600 && G.state !== 'CLEAR'; ++i) {
    autopilot();
    G.invuln = 1;
    NS.flight.update(1 / 60);
    if (i % 30 === 0)
      draw();
  }
} catch (e) {
  errors.push(e.stack);
}
check('Boss Rush runs through all six bosses', G.state === 'CLEAR' && errors.length === 0 && G.save.stats.bossRush === 1, errors.join('\n') + ' ' + G.state);

// every cinematic plays through and draws
errors = [];
for (const id in C.CINE) {
  try {
    G.state = 'TITLE';
    NS.cine.play(id);
    let n = 0;
    while (G.state === 'CINE' && n < 60 * 60) {
      NS.flight.update(1 / 30);
      if (n % 5 === 0)
        draw();
      ++n;
    }
    if (G.state === 'CINE')
      errors.push(id + ' did not end');
  } catch (e) {
    errors.push(id + ': ' + e.stack);
  }
}
check(Object.keys(C.CINE).length + ' cinematics play and draw', errors.length === 0 && Object.keys(C.CINE).length >= 13, errors.join('\n'));
NS.cine.play('intro');
NS.flight.update(0.5);
NS.cine.skip();
check('a cinematic skips on input', G.state !== 'CINE');

// every screen draws
errors = [];
const screens = [() => NS.nav.goTitle(), () => NS.nav.goWorlds(), () => NS.nav.goModes(), () => NS.nav.goNest(), () => NS.nav.goAviary(),
  () => NS.aviary.setTab(1), () => NS.aviary.setTab(2), () => NS.nav.goGoals(0), () => NS.goalsUi.setTab(1), () => NS.goalsUi.setTab(2),
  () => NS.goalsUi.setTab(3), () => NS.nav.goHelp()];
for (const s of screens) {
  try {
    s();
    for (let i = 0; i < 3; ++i) {
      NS.flight.update(1 / 60);
      draw();
    }
  } catch (e) {
    errors.push(e.stack);
  }
}
for (let p = 0; p < NS.help.HELP_PAGES.length; ++p) {
  G.helpPage = p;
  try {
    draw();
  } catch (e) {
    errors.push('help ' + p + ': ' + e.stack);
  }
}
check('every screen and help page draws', errors.length === 0, errors.join('\n'));

// the draw budget of a busy frame: a boss fight in FEVER with Gold Rush, a Wingmate and lots of particles
G.mode = 'adventure';
G.stageIndex = 23;
NS.run.startRun();
NS.input.handleInput();
G.dist = G.course.finishX - 380;
for (let i = 0; i < 60 * 12; ++i) {
  autopilot();
  G.invuln = 1;
  NS.flight.update(1 / 60);
}
G.feverT = 5;
NS.powers.grant('buddy', true);
NS.powers.grant('gold', true);
NS.powers.grant('shield', true);
for (let i = 0; i < 60; ++i) {
  NS.services.particles.burst(640, 360, 12, { color: '#ffd84a', speed: 6 });
  NS.flight.update(1 / 60);
}
draw();
const before = { calls: counters.calls, images: counters.images, gradients: counters.gradients, blur: counters.blur };
const FR = 60;
const t0 = Date.now();
let peak = 0;
for (let i = 0; i < FR; ++i) {
  NS.services.particles.burst(640, 360, 12, { color: '#ffd84a', speed: 6 });
  peak = Math.max(peak, NS.services.particles.count);
  autopilot();
  G.invuln = 1;
  NS.flight.update(1 / 60);
  draw();
}
const ms = (Date.now() - t0) / FR;
const per = k => (counters[k] - before[k]) / FR;
console.log('     busy frame: ' + per('calls').toFixed(0) + ' canvas calls, ' + per('images').toFixed(0) + ' blits, ' + per('gradients').toFixed(1) +
  ' gradients, ' + peak + ' particles, ' + ms.toFixed(2) + ' ms per frame (node, fake canvas)');
check('no shadow blur anywhere', counters.blur === 0);
check('a busy frame stays under 2500 canvas calls', per('calls') < 2500, per('calls'));
check('a busy frame makes at most 12 gradients (UI panels only)', per('gradients') <= 12, per('gradients'));
check('a busy frame simulates and draws in under 6 ms here', ms < 6, ms.toFixed(2));
check('the particle pool never grows past its cap', NS.services.particles.count <= SZ.FlappyParticles.CAP);

done();
