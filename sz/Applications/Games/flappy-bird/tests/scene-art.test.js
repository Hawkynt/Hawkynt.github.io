'use strict';

const fs = require('fs');
const path = require('path');

global.window = {};

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

require('../scene-art.js');

const Art = window.SZ.FlappySceneArt;
const BIOMES = ['meadow', 'desert', 'frost', 'forest', 'city', 'volcano'];
const MAX_BACKDROP = 7 + 3 * 3;
const MAX_GROUND = 7;
const MAX_GATE = 16;
/* a canvas that is wider and taller than the 1280 x 720 game area */
const WIDE_VIEW = { x0: -200, y0: -50, x1: 1480, y1: 760 };
const MAX_SKY_WIDE = 4;
const MAX_BACKDROP_WIDE = 7 + 3 * 4;
const MAX_GROUND_WIDE = 9;
const GATE_KINDS = {
  meadow: 'pipe', desert: 'pillar', frost: 'ice',
  forest: 'log', city: 'neon', volcano: 'basalt'
};
const HAZARDS = [
  { type: 'gust', sx: 300, w: 220, dir: 1, strength: 0.8 },
  { type: 'gust', sx: 300, w: 220, dir: -1, strength: 0.4 },
  { type: 'icicle', sx: 400, sy: 300, len: 90 },
  { type: 'bat', sx: 500, sy: 200, frame: 0 },
  { type: 'bat', sx: 500, sy: 200, frame: 1 },
  { type: 'laser', sx: 500, y1: 200, y2: 400, on: true, warn: false },
  { type: 'laser', sx: 500, y1: 200, y2: 400, on: false, warn: true },
  { type: 'laser', sx: 500, y1: 200, y2: 400, on: false, warn: false },
  { type: 'fireball', sx: 600, sy: 300, vy: -120 },
  { type: 'fireball', sx: 600, sy: 300, vy: 120 }
];
const BUBBLE_KINDS = ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny'];
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module exports THEMES and create', !!(Art && Art.THEMES && typeof Art.create === 'function'),
  JSON.stringify(Art && Object.keys(Art)));

const keys = Art ? Object.keys(Art.THEMES).sort() : [];
check('THEMES has the six biomes', keys.join(',') === BIOMES.slice().sort().join(','), 'got ' + keys.join(','));

for (let i = 0; i < BIOMES.length; ++i) {
  const id = BIOMES[i];
  const t = Art.THEMES[id];
  let ok = !!t && Array.isArray(t.sky) && t.sky.length === 2 &&
    t.sun && typeof t.sun.x === 'number' && typeof t.sun.y === 'number' && typeof t.sun.r === 'number' &&
    typeof t.sun.color === 'string' && typeof t.sun.glow === 'string' &&
    typeof t.far === 'string' && typeof t.mid === 'string' && typeof t.near === 'string' &&
    typeof t.groundTop === 'string' && typeof t.ground === 'string' && typeof t.groundDark === 'string' &&
    typeof t.cloud === 'string' && t.weather && typeof t.weather.kind === 'string';
  check('theme fields of ' + id, ok, JSON.stringify(t));
}

for (let i = 0; i < BIOMES.length; ++i) {
  const id = BIOMES[i];
  let art = null;
  try {
    art = Art.create(id);
  } catch (err) {
    check('create ' + id, false, 'threw ' + err.message);
    continue;
  }
  const apiOk = !!art && typeof art.drawSky === 'function' &&
    typeof art.drawBackdrop === 'function' && typeof art.drawGround === 'function' &&
    typeof art.drawGate === 'function' && typeof art.drawHazard === 'function' &&
    typeof art.drawCoin === 'function' && typeof art.drawBubble === 'function' &&
    !!art.gateStyle && art.gateStyle.kind === GATE_KINDS[id] &&
    art.theme === Art.THEMES[id];
  check('create ' + id + ' api', apiOk, JSON.stringify(art && Object.keys(art)));
  if (!apiOk) continue;

  const sky = fakeCtx();
  art.drawSky(sky);
  check('drawSky ' + id + ' blits once', sky.images === 1, 'drawImage called ' + sky.images + ' times');
  check('drawSky ' + id + ' no gradients', sky.gradients === 0, sky.gradients + ' gradients created');

  const back = fakeCtx();
  art.drawBackdrop(back, 12345, 1);
  check('drawBackdrop ' + id, back.images > 0 && back.images <= MAX_BACKDROP,
    'drawImage called ' + back.images + ' times, at most ' + MAX_BACKDROP);
  check('drawBackdrop ' + id + ' no gradients', back.gradients === 0, back.gradients + ' gradients created');

  const gnd = fakeCtx();
  art.drawGround(gnd, 777);
  check('drawGround ' + id, gnd.images > 0 && gnd.images <= MAX_GROUND,
    'drawImage called ' + gnd.images + ' times, at most ' + MAX_GROUND);
  check('drawGround ' + id + ' no gradients', gnd.gradients === 0, gnd.gradients + ' gradients created');

  const skyWide = fakeCtx();
  try {
    art.drawSky(skyWide, WIDE_VIEW);
    check('drawSky ' + id + ' wide view', skyWide.images > 0 && skyWide.images <= MAX_SKY_WIDE,
      'drawImage called ' + skyWide.images + ' times, at most ' + MAX_SKY_WIDE);
  } catch (err) {
    check('drawSky ' + id + ' wide view', false, 'threw ' + err.message);
  }
  check('drawSky ' + id + ' wide view no gradients', skyWide.gradients === 0,
    skyWide.gradients + ' gradients created');

  const backWide = fakeCtx();
  try {
    art.drawBackdrop(backWide, 777, 1, WIDE_VIEW);
    check('drawBackdrop ' + id + ' wide view', backWide.images > 0 && backWide.images <= MAX_BACKDROP_WIDE,
      'drawImage called ' + backWide.images + ' times, at most ' + MAX_BACKDROP_WIDE);
  } catch (err) {
    check('drawBackdrop ' + id + ' wide view', false, 'threw ' + err.message);
  }
  check('drawBackdrop ' + id + ' wide view no gradients', backWide.gradients === 0,
    backWide.gradients + ' gradients created');

  const gndWide = fakeCtx();
  try {
    art.drawGround(gndWide, 777, WIDE_VIEW);
    check('drawGround ' + id + ' wide view', gndWide.images > 0 && gndWide.images <= MAX_GROUND_WIDE,
      'drawImage called ' + gndWide.images + ' times, at most ' + MAX_GROUND_WIDE);
  } catch (err) {
    check('drawGround ' + id + ' wide view', false, 'threw ' + err.message);
  }
  check('drawGround ' + id + ' wide view no gradients', gndWide.gradients === 0,
    gndWide.gradients + ' gradients created');

  const gate = fakeCtx();
  art.drawGate(gate, 500, 200, 400);
  check('drawGate ' + id, gate.images > 0 && gate.images <= MAX_GATE,
    'drawImage called ' + gate.images + ' times, at most ' + MAX_GATE);
  check('drawGate ' + id + ' no gradients', gate.gradients === 0, gate.gradients + ' gradients created');
}

const fallback = Art.create('nope');
check('unknown biome falls back to meadow', fallback.theme === Art.THEMES.meadow,
  'theme is not THEMES.meadow');

for (let i = 0; i < HAZARDS.length; ++i) {
  const hz = HAZARDS[i];
  const hzc = fakeCtx();
  const label = 'drawHazard ' + hz.type + (hz.on === undefined ? '' : hz.on ? ' on' : hz.warn ? ' warn' : ' off') +
    (hz.vy === undefined ? '' : hz.vy > 0 ? ' falling' : ' rising') +
    (hz.dir === undefined ? '' : hz.dir > 0 ? ' down' : ' up');
  try {
    fallback.drawHazard(hzc, hz, 1.5);
    check(label, true);
  } catch (err) {
    check(label, false, 'threw ' + err.message);
  }
  check(label + ' no gradients', hzc.gradients === 0, hzc.gradients + ' gradients created');
}

const coin = fakeCtx();
fallback.drawCoin(coin, 640, 300, 1.25);
check('drawCoin blits once', coin.images === 1, 'drawImage called ' + coin.images + ' times');
check('drawCoin no gradients', coin.gradients === 0, coin.gradients + ' gradients created');

for (let i = 0; i < BUBBLE_KINDS.length; ++i) {
  const kind = BUBBLE_KINDS[i];
  const bub = fakeCtx();
  fallback.drawBubble(bub, kind, 640, 300, 2.5);
  check('drawBubble ' + kind, bub.images === 1, 'drawImage called ' + bub.images + ' times');
  check('drawBubble ' + kind + ' no gradients', bub.gradients === 0, bub.gradients + ' gradients created');
}

const src = fs.readFileSync(path.join(__dirname, '..', 'scene-art.js'), 'utf8');
check('no shadowBlur in the source', src.indexOf('shadowBlur') === -1, 'shadowBlur found');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' caches built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
