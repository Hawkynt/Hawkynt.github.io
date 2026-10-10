'use strict';

const fs = require('fs');

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered.
   fillStyle assignments and gradient creations are counted separately. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, styles: 0, imageArgs: [] };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.fillRect = function() { ++c.calls; };
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

const Art = window.SZ.PuzzleScene;
const EXPORTS = ['REALM_SCENES', 'create', 'drawElementIcon', 'drawSpell'];
const REALMS = [0, 1, 2, 3, 4];
const ELEMENTS = ['fire', 'water', 'earth', 'air'];
const SPELLS = ['fireBurst', 'iceMelt', 'waterSplash', 'earthRise',
  'chasmFill', 'windGust', 'runeCollect', 'portalOpen'];
const MAX_IMAGES = 1 + 40;
const MAX_STYLES = 30;
/* a window that is not 16:9: the backdrop has to reach past the play field */
const WIDE_VIEW = { x0: -150, y0: -40, x1: 1430, y1: 760 };
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

let exportsOk = !!Art;
for (let i = 0; exportsOk && i < EXPORTS.length; ++i)
  exportsOk = Art[EXPORTS[i]] !== undefined;
check('module registered', exportsOk, 'SZ.PuzzleScene exposes ' + EXPORTS.join(', '));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.PuzzleScene is not frozen');

const keys = Art ? Object.keys(Art.REALM_SCENES).sort() : [];
check('REALM_SCENES has the five realm keys', keys.join(',') === '0,1,2,3,4', 'got ' + keys.join(','));

const source = fs.readFileSync(require.resolve('../scene-art.js'), 'utf8');
check('no shadowBlur in the source', source.indexOf('shadowBlur') < 0, 'shadowBlur found');

for (let r = 0; r < REALMS.length; ++r) {
  const realm = REALMS[r];
  let scene = null;
  try {
    scene = Art.create(realm);
  } catch (e) {
    check('create realm ' + realm, false, 'threw ' + e.message);
    continue;
  }
  check('create realm ' + realm, !!scene && scene.realm === realm && typeof scene.draw === 'function',
    JSON.stringify(scene && Object.keys(scene)));

  const ctx = fakeCtx();
  let err = null;
  try {
    scene.draw(ctx, 1.3, WIDE_VIEW);
  } catch (e) {
    err = e;
  }
  check('draw realm ' + realm, !err, err ? 'threw ' + err.message : '');
  if (err) continue;
  check('draw realm ' + realm + ' blits', ctx.images >= 1 && ctx.images <= MAX_IMAGES,
    ctx.images + ' drawImage calls, allowed ' + MAX_IMAGES);
  check('draw realm ' + realm + ' no per-frame gradients', ctx.gradients === 0,
    ctx.gradients + ' gradients created');
  check('draw realm ' + realm + ' few fillStyle changes', ctx.styles <= MAX_STYLES,
    ctx.styles + ' fillStyle assignments, allowed ' + MAX_STYLES);
  check('draw realm ' + realm + ' backdrop covers the whole view', coversView(ctx.imageArgs, WIDE_VIEW),
    JSON.stringify(ctx.imageArgs[0]));

  /* the plain logical screen: one unscaled blit of the cached backdrop */
  const plain = fakeCtx();
  scene.draw(plain, 4.25);
  check('draw realm ' + realm + ' without a view', plain.images >= 1 && plain.gradients === 0
    && plain.imageArgs[0].length === 3, JSON.stringify(plain.imageArgs[0]));
}

const fallback = Art.create(9);
check('unknown realm falls back to 0', !!fallback && fallback.realm === 0, 'realm ' + fallback.realm);
check('a realm given as a string still picks that realm', Art.create('2').realm === 2,
  'realm ' + Art.create('2').realm);

/* hostile arguments must not throw and must not blow the frame budget */
const rough = fakeCtx();
let roughErr = null;
try {
  Art.create(1).draw(rough, undefined, { x0: 'x', y0: 0, x1: 10, y1: 10 });
  Art.create(1).draw(rough, 7);
  Art.drawElementIcon(rough, 'bogus', 5, 5);
  Art.drawSpell(rough, 'bogus', 5, 5, NaN);
  Art.drawSpell(rough, 'chasmFill', 5, 5, -3, 0);
} catch (e) {
  roughErr = e;
}
check('malformed arguments are tolerated', !roughErr, roughErr ? 'threw ' + roughErr.message : '');
check('malformed draws stay inside the budget', rough.images <= MAX_IMAGES && rough.gradients === 0,
  rough.images + ' images, ' + rough.gradients + ' gradients');

for (let e = 0; e < ELEMENTS.length; ++e) {
  for (let a = 0; a < 2; ++a) {
    const active = a === 1;
    const ctx = fakeCtx();
    let err = null;
    try {
      Art.drawElementIcon(ctx, ELEMENTS[e], 200, 140, 48, active);
    } catch (ex) {
      err = ex;
    }
    check('drawElementIcon ' + ELEMENTS[e] + (active ? ' active' : ''), !err, err ? 'threw ' + err.message : '');
    if (err) continue;
    check('drawElementIcon ' + ELEMENTS[e] + (active ? ' active' : '') + ' is one blit', ctx.images === 1,
      ctx.images + ' drawImage calls, expected exactly 1');
    check('drawElementIcon ' + ELEMENTS[e] + (active ? ' active' : '') + ' no gradients', ctx.gradients === 0,
      ctx.gradients + ' gradients created');
  }
}

for (let s = 0; s < SPELLS.length; ++s) {
  const kind = SPELLS[s];
  const marks = [0, 0.5, 0.99];
  for (let m = 0; m < marks.length; ++m) {
    const ctx = fakeCtx();
    let err = null;
    try {
      Art.drawSpell(ctx, kind, 320, 240, marks[m], 64);
    } catch (ex) {
      err = ex;
    }
    check('drawSpell ' + kind + ' at ' + marks[m], !err, err ? 'threw ' + err.message : '');
    if (err) continue;
    check('drawSpell ' + kind + ' at ' + marks[m] + ' is one blit', ctx.images === 1,
      ctx.images + ' drawImage calls, expected exactly 1');
    check('drawSpell ' + kind + ' at ' + marks[m] + ' no gradients', ctx.gradients === 0,
      ctx.gradients + ' gradients created');
    /* the frame is picked from the strip: 8 frames of 128 px, centred on (cx, cy) */
    const a = ctx.imageArgs[0];
    const wantFrame = Math.min(7, Math.floor(marks[m] * 8));
    check('drawSpell ' + kind + ' at ' + marks[m] + ' picks frame ' + wantFrame,
      a.length === 9 && a[1] === wantFrame * 128 && a[2] === 0 && a[3] === 128 && a[4] === 128
      && a[5] === 288 && a[6] === 208 && a[7] === 64 && a[8] === 64, JSON.stringify(a));
  }
}

/* the sprites are built once: a second round of draws adds no canvases */
let warm = 0;
try {
  Art.drawElementIcon(fakeCtx(), 'air', 10, 10, 32, true);
  Art.drawSpell(fakeCtx(), 'windGust', 10, 10, 0.4);
  warm = canvasCount;
  Art.drawElementIcon(fakeCtx(), 'air', 10, 10, 32, true);
  Art.drawSpell(fakeCtx(), 'windGust', 10, 10, 0.9);
} catch (e) {
  check('icon and spell caches', false, 'threw ' + e.message);
}
check('icon and spell sprites cached', canvasCount === warm,
  'second round built ' + (canvasCount - warm) + ' new canvases');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' canvases built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
