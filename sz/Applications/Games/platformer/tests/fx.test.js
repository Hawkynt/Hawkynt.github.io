'use strict';

const fs = require('fs');
const F = require('./fakecanvas.js');
F.install();
require('../js/art/fx.js');

const Fx = window.SZ.PlatformerFx;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Fx && Object.isFrozen(Fx), 'SZ.PlatformerFx missing or not frozen');
check('no shadowBlur in source', fs.readFileSync(require.resolve('../js/art/fx.js'), 'utf8').indexOf('shadowBlur') < 0, 'shadowBlur found');

const sys = Fx.create(500);
const img = { c: {}, w: 40, h: 60, ax: 20, ay: 60 };
let err = null;
try {
  for (let k = 0; k < 8; ++k) {
    Fx.dust(sys, 100, 100, '#d8c8a0', 3, 1);
    Fx.land(sys, 100, 100, '#d8c8a0', k / 8);
    Fx.jump(sys, 100, 100, '#d8c8a0');
    Fx.doubleJump(sys, 100, 100);
    Fx.wallSlide(sys, 100, 100, '#ffffff');
    Fx.wallJump(sys, 100, 100, -1, '#ffffff');
    Fx.dash(sys, 100, 100, 1, '#bfe8ff');
    Fx.coin(sys, 100, 100);
    Fx.gem(sys, 100, 100, '#4aff8a');
    Fx.stomp(sys, 100, 100, '#d8c8a0');
    Fx.pop(sys, 100, 100, '#6ad04a');
    Fx.hurt(sys, 100, 100);
    Fx.death(sys, 100, 100, '#ffd75a');
    Fx.splash(sys, 100, 100, '#7ad0ff', k % 2 === 0);
    Fx.checkpoint(sys, 100, 100, '#7ad04a');
    Fx.emberTrail(sys, 100, 100);
    Fx.explosion(sys, 100, 100, '#ff8a3a', 1);
    Fx.debris(sys, 100, 100, '#b07a3a', 10);
    Fx.shockwave(sys, 100, 100, 120);
    Fx.springPuff(sys, 100, 100);
    Fx.firework(sys, 100, 700);
    Fx.confetti(sys, 100, 700, 30);
    Fx.starBurst(sys, 100, 100);
    sys.spawn({ kind: 'image', img: img, x: 50, y: 50, flipX: k % 2 === 0, life: 0.3, alpha: 0.5 });
  }
  for (let f = 0; f < 600; ++f) {
    for (let w = 0; w < 5; ++w)
      Fx.ambient(sys, w, { x0: 0, y0: 0, x1: 1280, y1: 720 }, 1 / 60);
    Fx.trail(sys, 'spark', 100, 100, 1 / 60, f / 60);
    Fx.trail(sys, 'rainbow', 100, 100, 1 / 60, f / 60);
    sys.update(1 / 60);
    if (sys.count > 500) break;
  }
} catch (e) {
  err = e;
}
check('presets run', !err, err && (err.stack || err.message));
check('particle cap holds', sys.count <= 500, sys.count + ' live');

/* a busy frame: at most one blit per particle, no gradients */
const ctx = F.fakeCtx();
sys.draw(ctx);
check('one blit per particle at most', ctx.images <= sys.count, ctx.images + ' blits for ' + sys.count);
check('no gradients while drawing', ctx.gradients === 0, ctx.gradients + ' gradients');
check('blend restored', ctx.globalCompositeOperation === 'source-over', ctx.globalCompositeOperation);

/* culling: nothing drawn for a rect far away */
const far = F.fakeCtx();
sys.draw(far, { x0: 90000, y0: 90000, x1: 91000, y1: 91000 });
check('off-screen particles culled', far.images === 0, far.images + ' blits');

/* sprites are cached */
const before = F.canvasCount;
Fx.coin(sys, 10, 10);
Fx.gem(sys, 10, 10, '#4aff8a');
sys.update(0.1);
sys.draw(F.fakeCtx());
check('sprites cached', F.canvasCount === before, (F.canvasCount - before) + ' new canvases');

/* everything expires */
for (let f = 0; f < 60 * 20; ++f) sys.update(1 / 60);
check('particles expire', sys.count === 0, sys.count + ' left');

/* juice helpers */
const shake = Fx.createShake();
shake.add(0.8);
const o = shake.update(1 / 60);
check('shake moves the camera', Math.abs(o.x) + Math.abs(o.y) > 0, JSON.stringify(o));
for (let f = 0; f < 120; ++f) shake.update(1 / 60);
check('shake settles', Math.abs(shake.offset.x) < 0.01 && shake.trauma === 0, JSON.stringify(shake.offset));
const hs = Fx.createHitStop();
hs.hit(0.05);
check('hit-stop freezes then releases', hs.filter(1 / 60) === 0 && hs.filter(1 / 60) === 0 && hs.filter(1 / 60) === 0 && hs.filter(1 / 60) > 0, 'did not release');
const fl = Fx.createFlash();
fl.fire('#ffffff', 0.5, 4);
const fc = F.fakeCtx();
fl.draw(fc, { x0: 0, y0: 0, x1: 100, y1: 100 });
check('flash draws one rect', fc.calls >= 1, fc.calls);
const tx = Fx.createTexts(4);
for (let k = 0; k < 10; ++k) tx.add(0, 0, '+' + k);
check('texts capped', tx.count === 4, tx.count);

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
