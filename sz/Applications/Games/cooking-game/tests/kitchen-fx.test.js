'use strict';

global.window = {};

const fs = require('fs');

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.measureText = function() { return { width: 0 }; };
  return c;
}

let canvasCount = 0;
global.document = { createElement: () => { ++canvasCount; return { width: 0, height: 0, getContext: () => fakeCtx() }; } };

require('../kitchen-fx.js');

const FX = window.SZ.KitchenFX;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!(FX && typeof FX.create === 'function'), 'SZ.KitchenFX.create missing');
check('export frozen', !!(FX && Object.isFrozen(FX)), 'SZ.KitchenFX is not frozen');

const fx = FX.create();
const KINDS = ['spark', 'ember', 'glow', 'star', 'smoke', 'steam', 'heart', 'confetti', 'chip', 'crumb', 'drop', 'flame', 'coin'];
for (let i = 0; i < KINDS.length; ++i) {
  let err = null;
  try {
    fx.emit(KINDS[i], 100, 100, 3, { color: '#ffd23f', speed: 80 });
  } catch (e) {
    err = e;
  }
  check('emit ' + KINDS[i], !err, err ? 'threw ' + err.message : '');
}
check('particles alive', fx.count === KINDS.length * 3, 'count ' + fx.count);

/* the pool is capped */
fx.emit('confetti', 0, 0, 2000);
check('particle cap', fx.count <= FX.MAX_PARTICLES, 'count ' + fx.count + ' > ' + FX.MAX_PARTICLES);

/* a frame only blits cached sprites: no gradients, one image per particle at most */
const warm = fakeCtx();
fx.draw(warm);
const before = canvasCount;
const ctx = fakeCtx();
fx.update(1 / 60);
fx.draw(ctx);
check('draw blits only', ctx.gradients === 0, ctx.gradients + ' gradients created during the draw');
check('draw budget', ctx.images <= fx.count, ctx.images + ' images for ' + fx.count + ' particles');
check('sprites cached', canvasCount === before, 'createElement grew from ' + before + ' to ' + canvasCount);

fx.text(10, 10, '+$12', { color: '#ffd23f', size: 24 });
const tctx = fakeCtx();
fx.update(0.1);
fx.drawTexts(tctx);
check('texts draw', fx.textCount === 1 && tctx.gradients === 0, 'texts ' + fx.textCount + ', gradients ' + tctx.gradients);

/* everything dies off */
for (let i = 0; i < 300; ++i) fx.update(1 / 30);
check('particles expire', fx.count === 0 && fx.textCount === 0, 'left ' + fx.count + ' particles, ' + fx.textCount + ' texts');

fx.emit('spark', 0, 0, 5);
fx.clear();
check('clear', fx.count === 0, 'count ' + fx.count);

const src = fs.readFileSync(require.resolve('../kitchen-fx.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') === -1, 'shadowBlur found in kitchen-fx.js');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
