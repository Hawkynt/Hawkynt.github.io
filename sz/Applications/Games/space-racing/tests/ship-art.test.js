'use strict';

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0 };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; return gradient; };
  c.createRadialGradient = function() { ++c.calls; return gradient; };
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

require('../ship-art.js');

const Art = window.SZ.RacingShipArt;
const SHAPES = ['arrow', 'dart', 'wing', 'heavy', 'stealth'];
const BANKS = [-2, -1, 0, 1, 2];
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!(Art && Art.DESIGNS && Art.getSprite && Art.drawShip),
  'SZ.RacingShipArt exposes DESIGNS, getSprite and drawShip');

const keys = Art ? Object.keys(Art.DESIGNS).sort() : [];
check('DESIGNS has the five shapes', keys.join(',') === SHAPES.slice().sort().join(','), 'got ' + keys.join(','));

for (let i = 0; i < SHAPES.length; ++i) {
  const shape = SHAPES[i];
  const d = Art.DESIGNS[shape];
  let enginesOk = !!d && Array.isArray(d.engines) && d.engines.length > 0;
  for (let e = 0; enginesOk && e < d.engines.length; ++e) {
    const en = d.engines[e];
    enginesOk = Array.isArray(en) && en.length === 3 &&
      typeof en[0] === 'number' && typeof en[1] === 'number' && typeof en[2] === 'number';
  }
  check('engines of ' + shape, enginesOk, JSON.stringify(d && d.engines));

  let layersOk = !!d && Array.isArray(d.layers) && d.layers.length > 0;
  for (let l = 0; layersOk && l < d.layers.length; ++l) {
    const layer = d.layers[l];
    layersOk = typeof layer.fill === 'string' && Array.isArray(layer.poly) && layer.poly.length > 2;
  }
  check('layers of ' + shape, layersOk, JSON.stringify(d && d.layers));
}

for (let i = 0; i < SHAPES.length; ++i) {
  const shape = SHAPES[i];
  for (let b = 0; b < BANKS.length; ++b) {
    const bank = BANKS[b];
    const name = 'sprite ' + shape + ' bank ' + bank;
    let s = null;
    try {
      s = Art.getSprite(shape, '#4af', '#27d', bank);
    } catch (err) {
      check(name, false, 'threw ' + err.message);
      continue;
    }
    const isCanvas = !!(s && s.canvas && typeof s.canvas.getContext === 'function');
    check(name, isCanvas, 'no canvas returned');
    if (!isCanvas) continue;
    check(name + ' sized', s.canvas.width === 160 && s.canvas.height === 120,
      'got ' + s.canvas.width + 'x' + s.canvas.height);
    check(name + ' cached', Art.getSprite(shape, '#4af', '#27d', bank) === s, 'second call returned another object');
  }
}

const unknown = Art.getSprite('nonexistent', '#4af', '#27d', 0);
check('unknown shape falls back', !!(unknown && unknown.canvas), 'no sprite for an unknown shape name');

for (let i = 0; i < SHAPES.length; ++i) {
  const shape = SHAPES[i];
  const ctx = fakeCtx();
  let err = null;
  try {
    Art.drawShip(ctx, {
      x: 100, y: 50, angle: 0.7, shape: shape, color: '#4af', accent: '#27d', exhaust: '#48f',
      bank: -0.6, thrust: 1, boost: true, scale: 1, time: 1.25, shield: true
    });
    Art.drawShip(fakeCtx(), {
      x: 0, y: 0, angle: -2, shape: shape, color: '#f44', bank: 0.2, thrust: 0,
      boost: false, time: 0, shield: false
    });
  } catch (e) {
    err = e;
  }
  check('drawShip ' + shape, !err, err ? 'threw ' + err.message : '');
  if (!err) check('drawShip ' + shape + ' blits', ctx.images >= 2, 'drawImage called ' + ctx.images + ' times');
}

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
