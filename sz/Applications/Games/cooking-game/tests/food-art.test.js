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

require('../food-art.js');

const Art = window.SZ.FoodArt;
const EXPORTS = ['DISHES', 'getDish', 'drawDish', 'drawStation', 'drawStepIcon'];
const DISH_IDS = ['burger', 'salad', 'tacos', 'pancakes', 'pasta', 'pizza',
  'steak', 'curry', 'sushi', 'ramen', 'cake', 'lobster'];
const STATIONS = ['grill', 'stove', 'oven', 'board', 'plate'];
const STATES = ['idle', 'working', 'ready', 'burning'];
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
check('module registered', exportsOk, 'SZ.FoodArt exposes ' + EXPORTS.join(', '));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.FoodArt is not frozen');

const ids = Art && Array.isArray(Art.DISHES) ? Art.DISHES.join(',') : '';
check('DISHES has the twelve ids', ids === DISH_IDS.join(','), 'got ' + ids);

for (let i = 0; i < DISH_IDS.length; ++i) {
  const id = DISH_IDS[i];
  for (const size of ['large', 'small']) {
    const want = size === 'large' ? 192 : 96;
    const name = 'getDish ' + id + ' ' + size;
    let img = null;
    try {
      img = Art.getDish(id, size);
    } catch (err) {
      check(name, false, 'threw ' + err.message);
      continue;
    }
    check(name, !!(img && img.width === want && img.height === want),
      'no ' + want + 'x' + want + ' canvas, got ' + (img ? img.width + 'x' + img.height : 'nothing'));
    check(name + ' cached', Art.getDish(id, size) === img, 'second call returned another canvas');
  }
}

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
  check(name + ' blits', ctx.images <= maxImages, 'drawImage called ' + ctx.images + ' times, max ' + maxImages);
  check(name + ' no gradients', ctx.gradients === 0, ctx.gradients + ' gradients created during the draw');
}

for (let i = 0; i < DISH_IDS.length; ++i) {
  const id = DISH_IDS[i];
  drawCheck('drawDish ' + id + ' good', c => Art.drawDish(c, id, 100, 60, 48), 2);
  drawCheck('drawDish ' + id + ' perfect', c => Art.drawDish(c, id, 100, 60, 96, 0.9, 'perfect'), 2);
  drawCheck('drawDish ' + id + ' ruined', c => Art.drawDish(c, id, 40, 40, 48, 1, 'ruined'), 2);
}
drawCheck('drawDish defaults', c => Art.drawDish(c, 'pizza', 50, 50), 2);
drawCheck('drawDish unknown id falls back', c => Art.drawDish(c, 'mystery', 50, 50, 64), 2);

for (let s = 0; s < STATIONS.length; ++s) {
  for (let t = 0; t < STATES.length; ++t) {
    for (let f = 0; f < 2; ++f) {
      const time = f === 0 ? 0 : 0.37;
      drawCheck('drawStation ' + STATIONS[s] + ' ' + STATES[t] + ' t=' + time,
        c => Art.drawStation(c, STATIONS[s], 10, 20, STATES[t], time, DISH_IDS[s]), 4);
    }
  }
}
drawCheck('drawStation unknown station falls back', c => Art.drawStation(c, 'wok', 0, 0, 'working', 0.37, 'burger'), 4);
drawCheck('drawStation unknown contents fall back', c => Art.drawStation(c, 'grill', 0, 0, 'idle', 0, 'mystery'), 4);
drawCheck('drawStation without contents', c => Art.drawStation(c, 'plate', 0, 0, 'working', 0.37), 4);

for (let s = 0; s < STATIONS.length; ++s)
  drawCheck('drawStepIcon ' + STATIONS[s], c => Art.drawStepIcon(c, STATIONS[s], 30, 30, 24), 1);

const src = fs.readFileSync(require.resolve('../food-art.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') === -1, 'shadowBlur found in food-art.js');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
