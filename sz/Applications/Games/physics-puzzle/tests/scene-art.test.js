'use strict';

/* Backdrop budgets: each world paints once per visible rect and scale, the
   picture covers any window shape, and the per-frame lights are a few cached
   blits. */

const fs = require('fs');
const F = require('./fakecanvas.js');
F.install();
require('../js/render/scene-art.js');

const Scene = window.SZ.PhysicsPuzzleScene;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Scene && Object.isFrozen(Scene) && Scene.WORLD_COUNT === 5, 'missing');
check('no shadowBlur in source', fs.readFileSync(require.resolve('../js/render/scene-art.js'), 'utf8').indexOf('shadowBlur') < 0, 'shadowBlur');

const VIEWS = {
  normal: { x0: 0, y0: 0, x1: 1280, y1: 720 },
  wide: { x0: -360, y0: 0, x1: 1640, y1: 720 },
  tall: { x0: 0, y0: -240, x1: 1280, y1: 960 }
};

let err = null;
for (let w = 0; w < 5; ++w) {
  for (const name of Object.keys(VIEWS)) {
    const v = VIEWS[name];
    try {
      const img = Scene.backdrop(w, v, 1.5);
      check('world ' + w + ' ' + name + ' backdrop covers the visible rect', img.x0 <= v.x0 && img.y0 <= v.y0 && img.x0 + img.w >= v.x1 && img.y0 + img.h >= v.y1 &&
        img.c.width >= Math.floor((v.x1 - v.x0) * 1.5), JSON.stringify([img.x0, img.y0, img.w, img.h]));
      const before = F.canvasCount;
      const c = F.fakeCtx();
      Scene.drawBackdrop(c, w, v, 1.5);
      check('world ' + w + ' ' + name + ' cached backdrop is one blit', c.calls === 1 && c.images === 1 && F.canvasCount === before, c.calls + ' calls');
      const l = F.fakeCtx();
      Scene.drawLights(l, w, v, 3.3);
      check('world ' + w + ' ' + name + ' lights are cheap', l.gradients === 0 && l.images <= 16 && l.calls < 40, l.calls + ' calls, ' + l.images + ' images');
    } catch (x) {
      err = x;
    }
  }
}
check('every world paints', !err, err && err.stack);
/* painting is bounded too (it happens once per window shape) */
const p = F.fakeCtx();
const before = F.canvasCount;
Scene.backdrop(2, { x0: -10, y0: -10, x1: 1290, y1: 730 }, 1);
check('a fresh paint makes one canvas', F.canvasCount - before === 1, F.canvasCount - before);
check('the backdrop cache stays small', Scene.cacheSize <= 7, Scene.cacheSize);

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
