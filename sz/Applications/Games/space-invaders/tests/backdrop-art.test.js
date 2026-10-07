'use strict';

const fs = require('fs');

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered.
   fillStyle assignments and gradient creations are counted separately. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, styles: 0, imageArgs: [], rects: [] };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.fillRect = function(x, y, w, h) { ++c.calls; c.rects.push([x, y, w, h]); };
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

require('../backdrop-art.js');

const Art = window.SZ.InvaderBackdrop;
const NAMES = ['moon', 'mars', 'asteroids', 'jupiter', 'saturn', 'mothership'];
const MAX_IMAGES = 1 + 9 + 3;
const MAX_STYLES = 30;
/* a window that is not 16:9: one scaled-up sky, rocks, meteors */
const WIDE_VIEW = { x0: -200, y0: -60, x1: 1480, y1: 780 };
const MAX_IMAGES_WIDE = 1 + 9 + 3;
const MAX_STYLES_WIDE = 40;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

/* a 9-argument drawImage (img, sx, sy, sw, sh, dx, dy, dw, dh) whose argument
   at index k equals want[k] for every k */
function hasStrip(args, want) {
  const keys = Object.keys(want);
  for (let i = 0; i < args.length; ++i) {
    const a = args[i];
    if (a.length !== 9) continue;
    let ok = true;
    for (let k = 0; k < keys.length; ++k) {
      if (a[keys[k]] !== want[keys[k]]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
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

function anyRect(rects, test) {
  for (let i = 0; i < rects.length; ++i)
    if (test(rects[i])) return true;
  return false;
}

check('module exports THEMES and create', !!(Art && Art.THEMES && typeof Art.create === 'function'),
  JSON.stringify(Art && Object.keys(Art)));

const keys = Art ? Object.keys(Art.THEMES).sort() : [];
check('THEMES has the six sector keys', keys.join(',') === NAMES.slice().sort().join(','), 'got ' + keys.join(','));

const source = fs.readFileSync(__dirname + '/../backdrop-art.js', 'utf8');
check('no shadowBlur in the source', source.indexOf('shadowBlur') < 0, 'shadowBlur found');

for (let i = 0; i < NAMES.length; ++i) {
  const name = NAMES[i];
  let b = null;
  try {
    b = Art.create(name);
  } catch (e) {
    check('create ' + name, false, 'threw ' + e.message);
    continue;
  }
  check('create ' + name, !!b && b.theme === Art.THEMES[name] && typeof b.draw === 'function' && typeof b.drawSky === 'function',
    JSON.stringify(b && Object.keys(b)));

  const ctx = fakeCtx();
  let err = null;
  try {
    b.drawSky(ctx);
    b.draw(ctx, 12.3);
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

  /* the same backdrop out to the edges of a non-16:9 canvas */
  const wctx = fakeCtx();
  let werr = null;
  try {
    b.draw(wctx, 3.2, WIDE_VIEW);
  } catch (e) {
    werr = e;
  }
  check('wide draw ' + name, !werr, werr ? 'threw ' + werr.message : '');
  if (werr) continue;
  check('wide draw ' + name + ' blits', wctx.images >= 1 && wctx.images <= MAX_IMAGES_WIDE,
    wctx.images + ' drawImage calls, allowed ' + MAX_IMAGES_WIDE);
  check('wide draw ' + name + ' no per-frame gradients', wctx.gradients === 0, wctx.gradients + ' gradients created');
  check('wide draw ' + name + ' few fillStyle changes', wctx.styles <= MAX_STYLES_WIDE,
    wctx.styles + ' fillStyle assignments, allowed ' + MAX_STYLES_WIDE);
  check('wide draw ' + name + ' sky covers the whole view', coversView(wctx.imageArgs, WIDE_VIEW),
    JSON.stringify(wctx.imageArgs));
  const strips = hasStrip(wctx.imageArgs, { 3: 1 }) || hasStrip(wctx.imageArgs, { 4: 1 });
  check('wide draw ' + name + ' stretches no edge pixel', !strips, JSON.stringify(wctx.imageArgs));
  const wrapped = anyRect(wctx.rects, function(r) { return r[0] < 0; })
    && anyRect(wctx.rects, function(r) { return r[1] < 0; });
  check('wide draw ' + name + ' star dots wrap into the bars', wrapped, wctx.rects.length + ' dots, none outside');
}

const fallback = Art.create('x');
check('unknown theme falls back to moon', fallback && fallback.theme === Art.THEMES.moon,
  'theme ' + JSON.stringify(fallback && fallback.theme));

const fctx = fakeCtx();
fallback.draw(fctx, 40.7);
check('fallback draws', fctx.images >= 1 && fctx.gradients === 0,
  fctx.images + ' images, ' + fctx.gradients + ' gradients');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' canvases built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
