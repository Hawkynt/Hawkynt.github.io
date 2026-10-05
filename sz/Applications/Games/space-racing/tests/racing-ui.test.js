'use strict';

global.window = {};
require('../racing-ui.js');

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

function makeFakeCtx() {
  const ctx = {
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineJoin: 'miter',
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    calls: [],
    measureText(t) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const px = m ? parseFloat(m[1]) : 16;
      return { width: String(t).length * px * 0.55 };
    }
  };
  const methods = ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arcTo', 'arc',
    'rect', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'translate',
    'scale', 'rotate', 'setLineDash', 'clip', 'drawImage'];
  for (const name of methods)
    ctx[name] = function() { this.calls.push(name); };
  ctx.createLinearGradient = function() { this.calls.push('createLinearGradient'); return { addColorStop() {} }; };
  ctx.createRadialGradient = function() { this.calls.push('createRadialGradient'); return { addColorStop() {} }; };
  return ctx;
}

const fakeCtx = makeFakeCtx();
const ui = window.SZ.RacingUI.create(fakeCtx);

/* Test 1: every export is present, functions except UI */
const names = ['UI', 'clamp', 'parseHex', 'hexToRgba', 'shade', 'uiFont', 'ellipsize', 'layoutLine',
  'fitText', 'wrapText', 'layoutBlock', 'drawTextBlock', 'roundRectPath', 'drawPanel', 'drawMeter',
  'drawChip', 'drawKeyHints', 'drawKeycap', 'drawHeadline'];
let ok1 = names.length === 19 && typeof ui.UI === 'object' && ui.UI !== null;
const missing = names.filter(n => ui[n] === undefined);
const notFn = names.filter(n => n !== 'UI' && typeof ui[n] !== 'function');
ok1 = ok1 && missing.length === 0 && notFn.length === 0;
check('exports', ok1, 'missing ' + JSON.stringify(missing) + ' not-functions ' + JSON.stringify(notFn));

/* Test 2: fitText never exceeds the box and returns the drawn width */
const fitted = ui.fitText('A rather long label that must shrink', 0, 0, 120, 20);
check('fitText', typeof fitted === 'number' && fitted <= 120, 'returned ' + fitted);

/* Test 3: ellipsize truncates to the width and ends with an ellipsis */
fakeCtx.font = '16px sans-serif';
const ell = ui.ellipsize('x'.repeat(200), 50);
const ok3 = ell.endsWith('…') && fakeCtx.measureText(ell).width <= 50;
check('ellipsize', ok3, 'got "' + ell + '" width ' + fakeCtx.measureText(ell).width);

/* Test 4: wrapText breaks a long sentence into several lines */
fakeCtx.font = '16px sans-serif';
const lines = ui.wrapText('one two three four five six seven eight', 60);
check('wrapText', lines.length > 1, 'lines ' + JSON.stringify(lines));

/* Test 5: the drawing entry points run against the fake context */
const drawCalls = [
  ['drawPanel', () => ui.drawPanel(10, 10, 300, 200, { title: 'Garage' })],
  ['drawChip', () => ui.drawChip('LAP 2/3', 10, 10, 24, {})],
  ['drawKeycap', () => ui.drawKeycap('Esc', 10, 10, 14)],
  ['drawMeter', () => ui.drawMeter(10, 10, 100, 12, 0.5, '#5ab8ff', {})],
  ['drawHeadline', () => ui.drawHeadline('VICTORY', 100, 100, 400, 48, '#ffd75a')],
  ['drawKeyHints', () => ui.drawKeyHints([{ key: 'Esc', label: 'Back' }, { key: 'Enter', label: 'Race' }], 300, 300, 500, 1)],
  ['drawTextBlock', () => ui.drawTextBlock('Some text to wrap in a box', 0, 0, 100, 60, 14, {})]
];
for (const [name, run] of drawCalls) {
  let ok = true, why = '';
  try {
    run();
  } catch (e) {
    ok = false;
    why = String(e && e.stack ? e.stack.split('\n')[0] : e);
  }
  check(name, ok, why);
}
check('fake ctx recorded draw calls', fakeCtx.calls.length > 0, 'recorded ' + fakeCtx.calls.length + ' calls');

process.exit(failures ? 1 : 0);
