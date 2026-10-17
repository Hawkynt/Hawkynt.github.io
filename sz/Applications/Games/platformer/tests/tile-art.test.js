'use strict';

const fs = require('fs');
const F = require('./fakecanvas.js');
F.install();
require('../physics.js');
require('../levels-data.js');
require('../tile-art.js');

const Tiles = window.SZ.PlatformerTiles;
const L = window.SZ.PlatformerLevels;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Tiles && Object.isFrozen(Tiles), 'SZ.PlatformerTiles missing or not frozen');
check('no shadowBlur in source', fs.readFileSync(require.resolve('../tile-art.js'), 'utf8').indexOf('shadowBlur') < 0, 'shadowBlur found');
check('five themes', Tiles.THEMES.length === 5, Tiles.THEMES.length);

const VIEW = { x0: 1000, y0: 100, x1: 2280, y1: 820 };
for (let w = 0; w < 5; ++w) {
  for (let i = 0; i < 6; ++i) {
    const level = L.buildCampaign(w, i);
    let tiles = null, err = null;
    try {
      tiles = Tiles.create(level, { scale: 1.2 });
      tiles.draw(F.fakeCtx(), VIEW);
    } catch (e) {
      err = e;
    }
    check('w' + w + 'l' + i + ' bakes', !err, err && (err.stack || err.message));
    if (!tiles)
      continue;
    /* drawing a baked view: one blit per visible chunk, nothing else */
    const ctx = F.fakeCtx();
    tiles.draw(ctx, VIEW);
    const chunks = Math.floor((VIEW.x1 - 1) / (16 * 48)) - Math.floor(VIEW.x0 / (16 * 48)) + 1;
    check('w' + w + 'l' + i + ' draw is ' + chunks + ' blits', ctx.images === chunks && ctx.gradients === 0 && ctx.calls === chunks, ctx.images + ' images, ' + ctx.calls + ' calls');
    const live = F.fakeCtx();
    tiles.drawLive(live, VIEW, 1.5, 0.5);
    check('w' + w + 'l' + i + ' live layer is cheap', live.gradients === 0 && live.calls < 120, live.calls + ' calls, ' + live.gradients + ' gradients');
  }
}

/* the chunk cache stays bounded while scrolling across a long level */
{
  const level = L.buildCampaign(4, 3);
  const tiles = Tiles.create(level, { scale: 1 });
  for (let x = 0; x < level.cols * 48; x += 300) {
    const r = { x0: x, y0: 0, x1: x + 1280, y1: 720 };
    tiles.prepare(r);
    tiles.draw(F.fakeCtx(), r);
  }
  check('chunk cache bounded', tiles.cachedChunks <= 7, tiles.cachedChunks + ' chunks cached');
  const before = F.canvasCount;
  tiles.refresh(20, 10);
  tiles.draw(F.fakeCtx(), { x0: 0, y0: 0, x1: 1280, y1: 720 });
  check('refresh rebakes the chunk', F.canvasCount > before, 'no new canvas');
}

/* previews */
let ok = true;
for (let w = 0; w < 5; ++w)
  for (const code of [1, 2, 3, 5, 6])
    if (!Tiles.preview(w, code)) ok = false;
check('tile previews', ok, 'missing preview');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
