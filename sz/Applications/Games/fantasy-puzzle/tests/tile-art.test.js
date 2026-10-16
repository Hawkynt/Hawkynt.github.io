'use strict';

global.window = {};

const fs = require('fs');

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0 };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function() { return { width: 0 }; };
  return c;
}

let canvasCount = 0;
function fakeCanvas() {
  ++canvasCount;
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}

global.document = { createElement: () => fakeCanvas() };

require('../tile-art.js');

const Art = window.SZ.PuzzleArt;
const EXPORTS = ['TILE', 'THEMES', 'getTile', 'drawTile', 'drawHero', 'drawRuneGlow', 'drawPortal'];
const FIELDS = ['floor', 'floorAlt', 'wall', 'wallTop', 'accent', 'water', 'glow'];
const CODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DIRS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'walk', 'cast'];
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

let exportsOk = !!Art;
for (let i = 0; exportsOk && i < EXPORTS.length; ++i)
  exportsOk = Art[EXPORTS[i]] !== undefined;
check('module registered', exportsOk, 'SZ.PuzzleArt exposes ' + EXPORTS.join(', '));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.PuzzleArt is not frozen');
check('TILE is 64', !!(Art && Art.TILE === 64), 'TILE = ' + (Art && Art.TILE));

for (let th = 0; th <= 4; ++th) {
  const t = Art ? Art.THEMES[th] : null;
  let ok = !!t;
  for (let i = 0; ok && i < FIELDS.length; ++i)
    ok = /^#[0-9a-f]{6}$/i.test(t[FIELDS[i]]);
  check('THEMES[' + th + ']', ok, JSON.stringify(t));
}
check('THEMES has no realm 5', !(Art && Art.THEMES && Art.THEMES[5]), 'a sixth realm exists');

for (let th = 0; th <= 4; ++th) {
  for (let c = 0; c < CODES.length; ++c) {
    for (let v = 0; v <= 3; ++v) {
      const name = 'tile ' + th + ':' + CODES[c] + ':' + v;
      let img = null;
      try {
        img = Art.getTile(th, CODES[c], v);
      } catch (err) {
        check(name, false, 'threw ' + err.message);
        continue;
      }
      check(name, !!(img && img.width === 128 && img.height === 128),
        'no 128x128 canvas, got ' + (img ? img.width + 'x' + img.height : 'nothing'));
      check(name + ' cached', Art.getTile(th, CODES[c], v) === img, 'second call returned another canvas');
    }
  }
}

check('unknown theme falls back to 0', Art.getTile(9, 0, 1) === Art.getTile(0, 0, 1),
  'theme 9 returned a different canvas than theme 0');
check('unknown code falls back to floor', Art.getTile(2, 42, 1) === Art.getTile(2, 0, 1),
  'code 42 returned a different canvas than code 0');

function drawCheck(name, fn, maxImages) {
  const ctx = fakeCtx();
  let err = null;
  try {
    fn(ctx);
  } catch (e) {
    err = e;
  }
  check(name, !err, err ? 'threw ' + err.message : '');
  if (err) return;
  const max = maxImages || 1;
  check(name + ' blits', ctx.images >= 1 && ctx.images <= max, 'drawImage called ' + ctx.images + ' times');
  check(name + ' no gradients', ctx.gradients === 0, ctx.gradients + ' gradients created during the draw');
}

for (let c = 0; c < CODES.length; ++c) {
  drawCheck('drawTile code ' + CODES[c], ctx => Art.drawTile(ctx, 1, CODES[c], 100, 60, 2, 3));
}
drawCheck('drawTile defaults', ctx => Art.drawTile(ctx, 3, 0, 10, 20));

for (let d = 0; d < DIRS.length; ++d) {
  for (let p = 0; p < POSES.length; ++p) {
    drawCheck('drawHero ' + DIRS[d] + ' ' + POSES[p],
      ctx => Art.drawHero(ctx, 200, 150, DIRS[d], POSES[p], 0.75));
  }
}
drawCheck('drawHero robe colour', ctx => Art.drawHero(ctx, 30, 40, 'left', 'cast', 0.2, '#c04cff'));

let warm = 0;
try {
  Art.drawHero(fakeCtx(), 10, 10, 'down', 'walk', 0.1);
  Art.drawRuneGlow(fakeCtx(), 2, 10, 10, 0.4, true);
  Art.drawPortal(fakeCtx(), 2, 10, 10, 0.4, true);
  warm = canvasCount;
  Art.drawHero(fakeCtx(), 10, 10, 'down', 'walk', 0.1);
  Art.drawRuneGlow(fakeCtx(), 2, 10, 10, 0.4, true);
  Art.drawPortal(fakeCtx(), 2, 10, 10, 0.4, true);
} catch (e) {
  check('animation caches', false, 'threw ' + e.message);
}
check('hero, glow and portal frames cached', canvasCount === warm,
  'repeat draws built ' + (canvasCount - warm) + ' new canvases');

drawCheck('drawRuneGlow', ctx => Art.drawRuneGlow(ctx, 0, 130, 90, 1.25, false), 2);
drawCheck('drawRuneGlow collected', ctx => Art.drawRuneGlow(ctx, 4, 130, 90, 2.5, true), 2);
drawCheck('drawPortal', ctx => Art.drawPortal(ctx, 1, 130, 90, 1.25, false), 2);
drawCheck('drawPortal open', ctx => Art.drawPortal(ctx, 3, 130, 90, 2.5, true), 2);

const src = fs.readFileSync(require.resolve('../tile-art.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') === -1, 'shadowBlur found in tile-art.js');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
