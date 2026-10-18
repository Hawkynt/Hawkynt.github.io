'use strict';

const fs = require('fs');
const F = require('./fakecanvas.js');
F.install();
require('../fx.js');

const Fx = window.SZ.PhysicsPuzzleFx;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Fx && Object.isFrozen(Fx), 'SZ.PhysicsPuzzleFx missing or not frozen');
check('no shadowBlur in source', fs.readFileSync(require.resolve('../fx.js'), 'utf8').indexOf('shadowBlur') < 0, 'shadowBlur found');

const sys = Fx.create(420);
let err = null;
try {
  for (let k = 0; k < 10; ++k) {
    for (const m of ['metal', 'wood', 'stone', 'ice', 'glass', 'rubber'])
      Fx.impact(sys, 100, 100, 0, 1, m, k / 10);
    Fx.shatter(sys, 100, 100, 120, 0.3);
    Fx.explosion(sys, 100, 100, 170);
    Fx.splinters(sys, 100, 100, '#b07a40', 10);
    Fx.dust(sys, 100, 100, '#d8c8a8', 0.5);
    Fx.springPop(sys, 100, 100, 0, -1);
    Fx.bumperPop(sys, 100, 100, 24, '#ff7ad0');
    Fx.portal(sys, 100, 100, '#5ac8ff');
    Fx.splash(sys, 100, 100, k % 2 === 0);
    Fx.sizzle(sys, 100, 100);
    Fx.targetHit(sys, 100, 100, '#ffb35a');
    Fx.starPickup(sys, 100, 100);
    Fx.muzzle(sys, 100, 100, 1, 0, 0.8);
    Fx.poof(sys, 100, 100);
    Fx.placeBurst(sys, 100, 100);
    Fx.firework(sys, 100, 700);
    Fx.confetti(sys, 100, 700, 30);
    Fx.starBurst(sys, 100, 100);
  }
  for (let f = 0; f < 600; ++f) {
    for (let w = 0; w < 5; ++w)
      Fx.ambient(sys, w, { x0: 0, y0: 0, x1: 1280, y1: 640 }, 1 / 60);
    for (const t of ['spark', 'comet', 'rainbow'])
      Fx.trail(sys, t, 100, 100, 800, -200, 1 / 60, f / 60);
    sys.update(1 / 60);
  }
} catch (x) {
  err = x;
}
check('every preset runs', !err, err && err.stack);
check('the system stays capped', sys.count <= 420, sys.count);

/* drawing a full system: one drawImage per particle, a handful of state changes */
const ctx = F.fakeCtx();
sys.draw(ctx, { x0: 0, y0: 0, x1: 1280, y1: 720 });
check('draw is drawImage-only (no gradients, no paths)', ctx.gradients === 0 && ctx.images <= sys.count, ctx.gradients + ' gradients, ' + ctx.images + ' images for ' + sys.count);
check('draw stays under 2.5 calls per particle', ctx.calls <= sys.count * 2.5 + 20, ctx.calls + ' calls for ' + sys.count);

/* sprites are cached */
const before = F.canvasCount;
Fx.shatter(sys, 0, 0, 100, 0);
Fx.explosion(sys, 0, 0, 170);
check('sprites are cached after first use', F.canvasCount === before, (F.canvasCount - before) + ' new canvases');

/* juice helpers */
const shake = Fx.createShake();
shake.add(0.8);
const o = shake.update(1 / 60);
check('shake offsets', Math.abs(o.x) + Math.abs(o.y) > 0, JSON.stringify(o));
for (let i = 0; i < 200; ++i) shake.update(1 / 60);
check('shake decays', shake.trauma === 0, shake.trauma);
const ts = Fx.createTimeScale();
ts.slow(0.3, 0.4);
let min = 1;
for (let i = 0; i < 10; ++i) min = Math.min(min, ts.update(1 / 60));
check('slow motion eases down', min < 0.6, min);
for (let i = 0; i < 200; ++i) ts.update(1 / 60);
check('and back to full speed', ts.scale > 0.97 && !ts.active, ts.scale);
const texts = Fx.createTexts(5);
for (let i = 0; i < 9; ++i) texts.add(0, 0, '+' + i);
check('floating texts are capped', texts.count === 5, texts.count);
const flash = Fx.createFlash();
flash.fire('#ffffff', 0.5);
const c2 = F.fakeCtx();
flash.draw(c2, { x0: 0, y0: 0, x1: 10, y1: 10 });
check('flash draws one rect', c2.calls > 0 && c2.calls < 6, c2.calls);

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
