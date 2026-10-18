'use strict';

const fs = require('fs');

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, imageArgs: [], globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect',
    'fill', 'stroke', 'clip', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'fillRect',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform',
    'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; c.imageArgs.push(Array.prototype.slice.call(arguments)); };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.getTransform = function() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  return c;
}

let canvasCount = 0;
global.document = { createElement: () => { ++canvasCount; const cv = { width: 0, height: 0 }; cv.getContext = () => { const g = fakeCtx(); g.canvas = cv; return g; }; return cv; } };

const PARTS = ['kit', 'strips', 'worlds', 'scene'].map(n => '../js/art/scene/' + n + '.js');
for (const part of PARTS)
  require(part);

const Art = window.SZ.PlatformerScene;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const MAX_BACK_IMAGES = 24;
const MAX_BACK_CALLS = 40;
const MAX_FRONT_IMAGES = 3;
const VIEWS = {
  normal: { x0: 0, y0: 0, x1: 1280, y1: 720 },
  wide: { x0: -300, y0: 0, x1: 1580, y1: 720 },
  tall: { x0: 0, y0: -200, x1: 1280, y1: 920 }
};

/* some 5-argument drawImage reaches past every edge of v */
function coversView(args, v) {
  for (const a of args) {
    if (a.length !== 5) continue;
    if (a[1] <= v.x0 + 1e-6 && a[2] <= v.y0 + 1e-6 && a[1] + a[3] >= v.x1 - 1e-6 && a[2] + a[4] >= v.y1 - 1e-6)
      return true;
  }
  return false;
}

check('module registered', !!Art && typeof Art.create === 'function' && Art.WORLD_COUNT === 5, 'SZ.PlatformerScene missing');
check('export frozen', Object.isFrozen(Art), 'not frozen');
const src = PARTS.map(part => fs.readFileSync(require.resolve(part), 'utf8')).join('\n');
check('no shadowBlur in source', src.indexOf('shadowBlur') < 0, 'shadowBlur found');
check('no getImageData per frame', !/function draw(Back|Front|Menu|Layer|Sky|Glows)[\s\S]*?getImageData/.test(src.slice(src.indexOf('function drawSky'))), 'getImageData in a draw function');

for (let w = 0; w < 5; ++w) {
  let scene = null, err = null;
  try {
    scene = Art.create(w);
  } catch (e) {
    err = e;
  }
  check('world ' + w + ' creates', !!scene && !err, err ? err.stack : 'no scene');
  if (!scene)
    continue;
  const pal = scene.palette;
  check('world ' + w + ' palette', pal && /^#[0-9a-f]{6}$/i.test(pal.ambient) && typeof pal.fog === 'string' && typeof pal.light === 'string', JSON.stringify(pal));

  for (const name of Object.keys(VIEWS)) {
    const v = VIEWS[name];
    for (const camX of [0, 777, 5432]) {
      const ctx = fakeCtx();
      let e2 = null;
      try {
        scene.drawBack(ctx, v, camX, 120, 3.7);
      } catch (e) {
        e2 = e;
      }
      const label = 'world ' + w + ' ' + name + ' cam ' + camX;
      check(label + ' drawBack runs', !e2, e2 && e2.stack);
      check(label + ' sky covers view', coversView(ctx.imageArgs, v), 'no covering blit');
      check(label + ' no gradients per frame', ctx.gradients === 0, ctx.gradients + ' gradients');
      if (name === 'normal') {
        check(label + ' image budget', ctx.images <= MAX_BACK_IMAGES, ctx.images + ' images');
        check(label + ' call budget', ctx.calls <= MAX_BACK_CALLS, ctx.calls + ' calls');
      } else {
        check(label + ' image budget (odd view)', ctx.images <= MAX_BACK_IMAGES + 10, ctx.images + ' images');
      }
      check(label + ' state restored', ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over', ctx.globalAlpha + ' ' + ctx.globalCompositeOperation);
      const f = fakeCtx();
      scene.drawFront(f, v, camX, 120, 3.7);
      check(label + ' drawFront budget', f.images <= MAX_FRONT_IMAGES && f.gradients === 0, f.images + ' images, ' + f.gradients + ' gradients');
    }
    const m = fakeCtx();
    scene.drawMenu(m, v, 12.5);
    check('world ' + w + ' ' + name + ' drawMenu', m.images > 0 && m.gradients === 0 && coversView(m.imageArgs, v), m.images + ' images');
  }
}

const before = canvasCount;
for (let w = 0; w < 5; ++w)
  Art.create(w).drawBack(fakeCtx(), VIEWS.normal, 100, 100, 1);
check('scenes cached', canvasCount === before, (canvasCount - before) + ' new canvases');
check('same object returned', Art.create(2) === Art.create(2), 'create built a new scene');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
