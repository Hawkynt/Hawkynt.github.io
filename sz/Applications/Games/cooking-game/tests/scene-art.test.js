'use strict';

const fs = require('fs');

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered.
   fillStyle assignments and gradient creations are counted separately. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, styles: 0, imageArgs: [] };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; c.imageArgs.push(Array.prototype.slice.call(arguments)); };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function() { return { width: 0 }; };
  let style = '#000000';
  Object.defineProperty(c, 'fillStyle', {
    get: function() { return style; },
    set: function(v) { style = v; ++c.styles; }
  });
  return c;
}

let canvasCount = 0;
function fakeCanvas() {
  ++canvasCount;
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}

global.document = { createElement: () => fakeCanvas() };

require('../scene-art.js');

const Art = window.SZ.KitchenScene;
const NAMES = ['truck', 'diner', 'bistro', 'sushi', 'hotel'];
/* one full-screen backdrop plus the small ambient sprites and steam wisps */
const MAX_IMAGES = 1 + 30;
const MAX_STYLES = 30;
/* a window that is not 16:9: the backdrop has to cover the whole view */
const WIDE_VIEW = { x0: -160, y0: -40, x1: 1440, y1: 760 };
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

/* a 5-argument drawImage (img, dx, dy, dw, dh) that keeps the 16:9 ratio and
   reaches past every edge of the view */
function coversView(args, v) {
  for (let i = 0; i < args.length; ++i) {
    const a = args[i];
    if (a.length !== 5) continue;
    if (Math.abs(a[3] * 720 - a[4] * 1280) > 1e-6) continue;
    if (a[1] <= v.x0 + 1e-6 && a[2] <= v.y0 + 1e-6
      && a[1] + a[3] >= v.x1 - 1e-6 && a[2] + a[4] >= v.y1 - 1e-6) return true;
  }
  return false;
}

check('module exports THEMES and create', !!(Art && Art.THEMES && typeof Art.create === 'function'),
  JSON.stringify(Art && Object.keys(Art)));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.KitchenScene is not frozen');

const keys = Art ? Object.keys(Art.THEMES).sort() : [];
check('THEMES has the five location keys', keys.join(',') === NAMES.slice().sort().join(','), 'got ' + keys.join(','));

const source = fs.readFileSync(__dirname + '/../scene-art.js', 'utf8');
check('no shadowBlur in the source', source.indexOf('shadowBlur') < 0, 'shadowBlur found');

for (let i = 0; i < NAMES.length; ++i) {
  const name = NAMES[i];
  let scene = null;
  try {
    scene = Art.create(name);
  } catch (e) {
    check('create ' + name, false, 'threw ' + e.message);
    continue;
  }
  check('create ' + name, !!scene && scene.theme === Art.THEMES[name] && typeof scene.draw === 'function',
    JSON.stringify(scene && Object.keys(scene)));

  const ctx = fakeCtx();
  let err = null;
  try {
    scene.draw(ctx, 2.7, WIDE_VIEW);
  } catch (e) {
    err = e;
  }
  check('draw ' + name, !err, err ? 'threw ' + err.message : '');
  if (err) continue;
  check('draw ' + name + ' blits', ctx.images >= 1 && ctx.images <= MAX_IMAGES,
    ctx.images + ' drawImage calls, allowed ' + MAX_IMAGES);
  check('draw ' + name + ' no per-frame gradients', ctx.gradients === 0, ctx.gradients + ' gradients created');
  check('draw ' + name + ' few fillStyle changes', ctx.styles <= MAX_STYLES,
    ctx.styles + ' fillStyle assignments, allowed ' + MAX_STYLES);
  check('draw ' + name + ' backdrop covers the whole view', coversView(ctx.imageArgs, WIDE_VIEW),
    JSON.stringify(ctx.imageArgs));
}

const fallback = Art.create('x');
check('unknown theme falls back to truck', fallback && fallback.theme === Art.THEMES.truck,
  'theme ' + JSON.stringify(fallback && fallback.theme));

const fctx = fakeCtx();
fallback.draw(fctx, 40.7);
check('fallback draws', fctx.images >= 1 && fctx.gradients === 0,
  fctx.images + ' images, ' + fctx.gradients + ' gradients');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' canvases built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
