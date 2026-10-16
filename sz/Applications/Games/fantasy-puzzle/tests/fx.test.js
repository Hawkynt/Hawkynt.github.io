'use strict';

global.window = {};

const fs = require('fs');

function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'save', 'restore', 'translate',
    'rotate', 'scale', 'setTransform', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.gradients; return gradient; };
  c.getTransform = function() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  return c;
}

let canvasCount = 0;
global.document = { createElement: () => { ++canvasCount; return { width: 0, height: 0, getContext: () => fakeCtx() }; } };

require('../fx.js');

const Fx = window.SZ.PuzzleFx;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Fx && typeof Fx.create === 'function', 'SZ.PuzzleFx missing');
check('export frozen', Object.isFrozen(Fx), 'SZ.PuzzleFx is not frozen');
const src = fs.readFileSync(require.resolve('../fx.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') < 0, 'shadowBlur found');

/* every preset runs and stays under the cap however hard it is driven */
const sys = Fx.create(400);
let err = null;
try {
  for (let k = 0; k < 6; ++k) {
    Fx.fire(sys, 100, 100);
    Fx.melt(sys, 100, 100);
    Fx.splash(sys, 100, 100);
    Fx.quake(sys, 100, 100, '#7a5a3a', '#a89878');
    Fx.gust(sys, 100, 100, 1, 0, '#8ac050');
    Fx.rune(sys, 100, 100, '#d080ff');
    Fx.portal(sys, 100, 100, '#c04cff');
    Fx.step(sys, 100, 100, '#a89878', k % 2 === 0);
    Fx.firework(sys, 100, 700);
    Fx.confetti(sys, 100, 700, 30);
    Fx.starBurst(sys, 100, 100);
  }
  for (let f = 0; f < 240; ++f) {
    for (let r = 0; r < 5; ++r)
      Fx.ambient(sys, r, 800, 500, 1 / 60);
    Fx.charge(sys, 50, 50, '#ff7a3a', 1 / 60);
    Fx.portalIdle(sys, 50, 50, '#ffffff', 1 / 60);
    sys.update(1 / 60);
    if (sys.count > 400)
      break;
  }
} catch (e) {
  err = e;
}
check('presets run', !err, err ? 'threw ' + (err.stack || err.message) : '');
check('particle cap holds', sys.count <= 400, sys.count + ' live particles');

/* drawing: one blit per particle, no gradients per frame */
const ctx = fakeCtx();
sys.draw(ctx);
/* fully faded particles are skipped, so at most one blit each */
check('at most one blit per particle', ctx.images <= sys.count && ctx.images >= sys.count * 0.8, ctx.images + ' blits for ' + sys.count + ' particles');
check('no gradients while drawing', ctx.gradients === 0, ctx.gradients + ' gradients');
check('blend mode restored', ctx.globalCompositeOperation === 'source-over', ctx.globalCompositeOperation);

/* sprites are cached: another round of the same effects builds no canvases */
const warm = canvasCount;
Fx.fire(sys, 10, 10);
Fx.splash(sys, 10, 10);
sys.update(0.1);
sys.draw(fakeCtx());
check('sprites cached', canvasCount === warm, (canvasCount - warm) + ' new canvases');

/* everything dies out */
for (let f = 0; f < 60 * 20; ++f)
  sys.update(1 / 60);
check('particles expire', sys.count === 0 && !sys.busy, sys.count + ' left');
sys.spawn({ kind: 'glow', x: 1, y: 1 });
sys.clear();
check('clear empties', sys.count === 0, sys.count + ' left');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
