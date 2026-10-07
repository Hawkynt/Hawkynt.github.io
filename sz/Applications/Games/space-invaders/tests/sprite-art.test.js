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

require('../sprite-art.js');

const Art = window.SZ.InvaderArt;
const EXPORTS = ['ALIENS', 'SHIPS', 'BOSSES', 'getAlien', 'drawAlien', 'getShip', 'drawShip', 'drawDrone', 'drawUfo',
  'getBoss', 'drawBoss', 'drawBullet', 'drawCapsule', 'drawFlare'];
const IDS = ['interceptor', 'striker', 'guardian', 'phantom', 'titan'];
const CAPSULE_IDS = ['tripleShot', 'rapidFire', 'shield', 'laser', 'slowMo', 'extraLife', 'bomb', 'drone', 'credits'];
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
check('module registered', exportsOk, 'SZ.InvaderArt exposes ' + EXPORTS.join(', '));
check('export frozen', !!(Art && Object.isFrozen(Art)), 'SZ.InvaderArt is not frozen');

for (let s = 1; s <= 6; ++s) {
  const a = Art ? Art.ALIENS[s] : null;
  const ok = !!a && typeof a.name === 'string' && a.name.length > 0 &&
    /^#[0-9a-f]{6}$/i.test(a.color) && /^#[0-9a-f]{6}$/i.test(a.dark) && /^#[0-9a-f]{6}$/i.test(a.glow);
  check('ALIENS[' + s + ']', ok, JSON.stringify(a));
}

const ids = Art && Array.isArray(Art.SHIPS) ? Art.SHIPS.map(s => s.id).join(',') : '';
check('SHIPS has the five ids in order', ids === IDS.join(','), 'got ' + ids);
for (let i = 0; i < IDS.length; ++i) {
  const s = Art.SHIPS[i];
  const ok = !!s && typeof s.name === 'string' && /^#[0-9a-f]{6}$/i.test(s.color) && /^#[0-9a-f]{6}$/i.test(s.accent);
  check('ship ' + IDS[i], ok, JSON.stringify(s));
}

for (let s = 1; s <= 6; ++s) {
  for (let f = 0; f <= 1; ++f) {
    for (let fl = 0; fl <= 1; ++fl) {
      const name = 'alien ' + s + ':' + f + ':' + fl;
      let img = null;
      try {
        img = Art.getAlien(s, f, fl === 1);
      } catch (err) {
        check(name, false, 'threw ' + err.message);
        continue;
      }
      check(name, !!(img && img.width === 104 && img.height === 86),
        'no 104x86 canvas, got ' + (img ? img.width + 'x' + img.height : 'nothing'));
      check(name + ' cached', Art.getAlien(s, f, fl === 1) === img, 'second call returned another canvas');
    }
  }
}

check('unknown species falls back to 3', Art.getAlien(9, 0, false) === Art.getAlien(3, 0, false),
  'species 9 returned a different canvas than species 3');

for (let i = 0; i < IDS.length; ++i) {
  for (let t = 0; t <= 3; ++t) {
    const name = 'ship ' + IDS[i] + ' thrust ' + t;
    let img = null;
    try {
      img = Art.getShip(IDS[i], t);
    } catch (err) {
      check(name, false, 'threw ' + err.message);
      continue;
    }
    check(name, !!(img && img.width === 130 && img.height === 108),
      'no 130x108 canvas, got ' + (img ? img.width + 'x' + img.height : 'nothing'));
    check(name + ' cached', Art.getShip(IDS[i], t) === img, 'second call returned another canvas');
  }
}

function drawCheck(name, fn) {
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
}

drawCheck('drawAlien', c => Art.drawAlien(c, 2, 100, 50, 1, false));
drawCheck('drawAlien flash scaled', c => Art.drawAlien(c, 5, 10, 20, 0, true, 2));
drawCheck('drawShip', c => Art.drawShip(c, 'titan', 120, 200, 2, 0.5, 0.8));
drawCheck('drawShip defaults', c => Art.drawShip(c, 'phantom', 60, 90));
drawCheck('drawDrone', c => Art.drawDrone(c, 60, 70, 1.25));
drawCheck('drawUfo', c => Art.drawUfo(c, 30, 40, 0.75));

for (let d = 0; d <= 5; ++d) {
  for (let dm = 0; dm <= 1; ++dm) {
    const name = 'boss ' + d + ':' + dm;
    let img = null;
    try {
      img = Art.getBoss(d, dm === 1);
    } catch (err) {
      check(name, false, 'threw ' + err.message);
      continue;
    }
    check(name, !!(img && img.width === 320 && img.height === 200),
      'no 320x200 canvas, got ' + (img ? img.width + 'x' + img.height : 'nothing'));
    check(name + ' cached', Art.getBoss(d, dm === 1) === img, 'second call returned another canvas');
  }
}

drawCheck('drawBoss', c => Art.drawBoss(c, 3, 100, 40, false, false));
drawCheck('drawBoss damaged flash', c => Art.drawBoss(c, 5, 10, 20, true, true));

const BULLET_KINDS = ['player', 'alien', 'orb', 'laser'];
for (let i = 0; i < BULLET_KINDS.length; ++i) {
  const k = BULLET_KINDS[i];
  drawCheck('drawBullet ' + k, c => Art.drawBullet(c, k, 100, 120, k === 'laser' ? 140 : 0));
}

for (let i = 0; i < CAPSULE_IDS.length; ++i)
  drawCheck('drawCapsule ' + CAPSULE_IDS[i], c => Art.drawCapsule(c, CAPSULE_IDS[i], 50, 60, 1.3));

const FLARE_COLORS = ['white', 'orange', 'cyan', 'purple'];
for (let i = 0; i < FLARE_COLORS.length; ++i)
  drawCheck('drawFlare ' + FLARE_COLORS[i], c => Art.drawFlare(c, FLARE_COLORS[i], 80, 90, 40, 0.8));

const src = fs.readFileSync(require.resolve('../sprite-art.js'), 'utf8');
check('no shadowBlur in source', src.indexOf('shadowBlur') === -1, 'shadowBlur found in sprite-art.js');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
