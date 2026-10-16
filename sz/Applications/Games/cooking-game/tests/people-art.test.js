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

require('../people-art.js');

const Art = window.SZ.PeopleArt;
const EXPORTS = ['randomLook', 'drawCustomer', 'drawChef', 'drawMood'];
const TYPES = ['kid', 'business', 'tourist', 'critic', 'vip', 'regular'];
const POSES = ['walk', 'sit', 'eat', 'happy', 'angry'];
const CHEF_POSES = ['idle', 'chop', 'flip', 'cheer'];
const MOODS = ['happy', 'ok', 'impatient', 'angry', 'love'];
const SHAPES = ['slim', 'round', 'tall'];
const HEX = /^#[0-9a-f]{6}$/i;
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
  exportsOk = typeof Art[EXPORTS[i]] === 'function';
check('module registered', exportsOk, 'SZ.PeopleArt exposes ' + EXPORTS.join(', '));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.PeopleArt is not frozen');

/* deterministic seeded rng */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6FEB76E0) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (let i = 0; i < TYPES.length; ++i) {
  const type = TYPES[i];
  const look = Art ? Art.randomLook(mulberry32(1234), type) : null;
  const ok = !!look && look.type === type &&
    HEX.test(look.skin) && HEX.test(look.hair) && HEX.test(look.shirt) &&
    typeof look.hairStyle === 'string' && look.hairStyle.length > 0 &&
    typeof look.accessory === 'string' &&
    SHAPES.indexOf(look.shape) >= 0;
  check('randomLook ' + type, ok, JSON.stringify(look));
}

let deterministic = true;
for (let i = 0; deterministic && i < TYPES.length; ++i) {
  const a = Art.randomLook(mulberry32(99), TYPES[i]);
  const b = Art.randomLook(mulberry32(99), TYPES[i]);
  deterministic = JSON.stringify(a) === JSON.stringify(b);
}
check('randomLook deterministic per seed', deterministic, 'same seed produced different looks');

const look = Art.randomLook(mulberry32(7), 'regular');

function blitCheck(name, fn) {
  fn(fakeCtx());                          /* warm-up: paints the sprite once */
  const before = canvasCount;
  const ctx = fakeCtx();
  let err = null;
  try {
    fn(ctx);
  } catch (e) {
    err = e;
  }
  check(name, !err, err ? 'threw ' + err.message : '');
  if (err) return;
  check(name + ' single blit', ctx.images === 1, 'drawImage called ' + ctx.images + ' times');
  check(name + ' no gradients', ctx.gradients === 0, ctx.gradients + ' gradients created during the draw');
  check(name + ' cache hit', canvasCount === before, 'createElement grew from ' + before + ' to ' + canvasCount);
}

for (let p = 0; p < POSES.length; ++p) {
  const pose = POSES[p];
  for (let f = 0; f < 4; ++f)
    blitCheck('drawCustomer ' + pose + ' t=' + f * 0.3,
      c => Art.drawCustomer(c, look, 100, 200, pose, f * 0.3));
}
blitCheck('drawCustomer walk mirrored', c => Art.drawCustomer(c, look, 100, 200, 'walk', 0.5, -1));
blitCheck('drawCustomer unknown pose falls back', c => Art.drawCustomer(c, look, 100, 200, 'dance', 0.2));

for (let t = 0; t < 4; ++t) {
  const other = Art.randomLook(mulberry32(21), TYPES[t]);
  blitCheck('drawCustomer ' + TYPES[t] + ' sit', c => Art.drawCustomer(c, other, 50, 90, 'sit', 0.4));
}

for (let p = 0; p < CHEF_POSES.length; ++p) {
  const pose = CHEF_POSES[p];
  for (let f = 0; f < 4; ++f)
    blitCheck('drawChef ' + pose + ' t=' + f * 0.25,
      c => Art.drawChef(c, 120, 220, pose, f * 0.25));
}

for (let m = 0; m < MOODS.length; ++m)
  blitCheck('drawMood ' + MOODS[m], c => Art.drawMood(c, 30, 40, MOODS[m]));
blitCheck('drawMood default size', c => Art.drawMood(c, 30, 40, 'love'));
blitCheck('drawMood unknown falls back', c => Art.drawMood(c, 30, 40, 'hungry', 32));

const src = fs.readFileSync(require.resolve('../people-art.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') === -1, 'shadowBlur found in people-art.js');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
