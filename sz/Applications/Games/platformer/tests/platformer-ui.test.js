'use strict';

const F = require('./fakecanvas.js');
F.install();
require('../platformer-ui.js');

let failures = 0;
function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!window.SZ.PlatformerUI && Object.isFrozen(window.SZ.PlatformerUI), 'SZ.PlatformerUI missing');
const ctx = F.fakeCtx();
const ui = window.SZ.PlatformerUI.create(ctx);
const names = ['UI', 'clamp', 'parseHex', 'hexToRgba', 'shade', 'uiFont', 'titleFont', 'ellipsize', 'layoutLine', 'fitText',
  'wrapText', 'layoutBlock', 'drawTextBlock', 'roundRectPath', 'drawPanel', 'drawMeter', 'drawChip', 'drawKeyHints',
  'drawKeycap', 'drawHeadline', 'drawButtonFrame'];
check('exports', names.every(n => ui[n] !== undefined), names.filter(n => ui[n] === undefined).join(','));
check('fitText stays inside', ui.fitText('A rather long label that must shrink to fit', 0, 0, 120, 20) <= 120, 'too wide');
ctx.font = '16px sans-serif';
const e = ui.ellipsize('x'.repeat(100), 50);
check('ellipsize', e.endsWith('…') && ctx.measureText(e).width <= 50, e);
check('wrapText', ui.wrapText('one two three four five six seven eight', 60).length > 1, 'no wrap');
check('colour helpers', ui.hexToRgba('#ff0000', 0.5) === 'rgba(255,0,0,0.5)' && ui.shade('#808080', 1) === '#ffffff', 'colour math');

let err = null;
try {
  ui.drawPanel(10, 10, 300, 200, { title: 'Movement', titleRight: '3 / 6' });
  ui.drawChip('LEVEL 3', 10, 10, 24, {});
  ui.drawKeycap('Esc', 10, 10, 12);
  ui.drawMeter(10, 10, 100, 12, 0.5, '#5ab8ff', { label: '50%' });
  ui.drawHeadline('LEVEL CLEAR', 100, 100, 400, 48, '#ffd75a', '#ff8a2a');
  ui.drawKeyHints([{ key: 'Enter', label: 'Play' }, { key: 'Esc', label: 'Back' }], 640, 700, 400, 1);
  ui.drawTextBlock('A long description that wraps over two or three lines inside its box.', 0, 0, 200, 60, 14, {});
  ui.drawButtonFrame(0, 0, 200, 50, true, '#5ab8ff', 1.2);
} catch (x) {
  err = x;
}
check('drawing entry points run', !err, err && err.message);

/* panels are cached: drawing the same panel again builds nothing new */
const before = F.canvasCount;
ui.drawPanel(10, 10, 300, 200, { title: 'Movement', titleRight: '3 / 6' });
ui.drawHeadline('LEVEL CLEAR', 100, 100, 400, 48, '#ffd75a', '#ff8a2a');
check('panel and headline cached', F.canvasCount === before, (F.canvasCount - before) + ' new canvases');
const c2 = F.fakeCtx();
const ui2 = window.SZ.PlatformerUI.create(c2);
ui2.drawPanel(10, 10, 300, 200, { title: 'Movement' });
check('a cached panel is a few calls', c2.gradients === 0, c2.gradients + ' gradients');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
