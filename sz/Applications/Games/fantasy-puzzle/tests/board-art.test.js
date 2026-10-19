'use strict';

global.window = {};

const fs = require('fs');

/* A recording 2D context: drawing calls are counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'putImageData'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.createImageData = function(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
  c.getTransform = function() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  return c;
}

let canvasCount = 0;
global.document = { createElement: () => { ++canvasCount; return { width: 0, height: 0, getContext: () => fakeCtx() }; } };

require('../js/core/puzzle-core.js');
require('../js/data/levels-data.js');
require('../js/art/board-art.js');

const Board = window.SZ.PuzzleBoard;
const Core = window.SZ.PuzzleCore;
const Levels = window.SZ.PuzzleLevels;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Board && typeof Board.create === 'function' && typeof Board.drawProp === 'function', 'SZ.PuzzleBoard missing');
check('export frozen', Object.isFrozen(Board), 'SZ.PuzzleBoard is not frozen');
check('five realm styles', Board.STYLES.length === 5, Board.STYLES.length + ' styles');

const src = fs.readFileSync(require.resolve('../js/art/board-art.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') < 0, 'shadowBlur found');

for (let realm = 0; realm < 5; ++realm) {
  const lv = Levels.CAMPAIGN[realm * 8 + 2];
  const st = Core.parseLevel(lv);
  const tiles = Array.from(st.tiles);
  let r = null, err = null;
  try {
    r = Board.create(realm);
    r.update({ cols: st.cols, rows: st.rows, tiles: tiles, scale: 1 });
  } catch (e) {
    err = e;
  }
  check('bake realm ' + realm, !err, err ? 'threw ' + err.message : '');
  if (err)
    continue;
  check('same tiles do not rebake ' + realm, r.update({ cols: st.cols, rows: st.rows, tiles: tiles, scale: 1 }) === false, 'rebaked an unchanged board');
  /* a changed tile rebakes the board without touching the static layers' canvases */
  const before = canvasCount;
  const fi = tiles.indexOf(0);
  tiles[fi] = 2;
  check('changed tile rebakes ' + realm, r.update({ cols: st.cols, rows: st.rows, tiles: tiles, scale: 1, decals: { 3: 'scorch' } }) === true, 'no rebake');
  check('rebake builds no canvases ' + realm, canvasCount === before, (canvasCount - before) + ' new canvases');

  /* per frame: a few board blits, one or two per water cell, no gradients */
  const ctx = fakeCtx();
  r.drawGround(ctx);
  r.drawWater(ctx, 1.7);
  r.drawUpper(ctx);
  r.drawGlow(ctx, 1.7);
  const budget = 12 + 2 * r.waterCount + 2 * tiles.length;
  check('frame budget ' + realm, ctx.images >= 2 && ctx.images <= budget, ctx.images + ' blits, allowed ' + budget);
  check('frame has no gradients ' + realm, ctx.gradients === 0, ctx.gradients + ' gradients');
}

const water = Board.create(1);
const wt = [0, 4, 4, 3, 0, 4];
water.update({ cols: 3, rows: 2, tiles: wt, scale: 1 });
check('water cells counted', water.waterCount === 3, water.waterCount + ' water cells');

const p = fakeCtx();
Board.drawProp(p, 2, 5, 40, 40, 0.5);
Board.drawProp(p, 9, 2, 40, 40);
check('drawProp is one blit each', p.images === 2 && p.gradients === 0, p.images + ' blits, ' + p.gradients + ' gradients');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' canvases built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
