'use strict';

/* Test harness: a counting fake 2D canvas, a minimal DOM, storage and timers, and a loader that
   runs the game's scripts in index.html order inside this fake window. Each test file is its
   own process, so every test starts from a fresh game. */
const fs = require('fs');
const path = require('path');

let canvases = 0;

function fakeCtx() {
  const gradient = { addColorStop() {} };
  const c = {
    calls: 0, images: 0, gradients: 0, shadowBlurUsed: 0, globalAlpha: 1, globalCompositeOperation: 'source-over', font: '16px sans-serif',
    lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter',
    lineDashOffset: 0, imageSmoothingEnabled: true
  };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke', 'clip',
    'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale', 'transform',
    'setTransform', 'resetTransform', 'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'putImageData'];
  for (const name of plain) c[name] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getImageData = function(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
  c.measureText = function(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
    return { width: String(t).length * (m ? parseFloat(m[1]) : 16) * 0.55 };
  };
  Object.defineProperty(c, 'shadowBlur', { set(v) { if (v) ++c.shadowBlurUsed; }, get() { return 0; } });
  return c;
}

function fakeCanvas(w, h) {
  ++canvases;
  const ctx = fakeCtx();
  const listeners = {};
  return {
    width: w || 300, height: h || 150, style: {}, ctx: ctx, listeners: listeners,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    parentElement: { clientWidth: 1280, clientHeight: 720 }
  };
}

function installEnv(opts) {
  opts = opts || {};
  const store = opts.store || {};
  const docListeners = {};
  const winListeners = {};
  const gameCanvas = fakeCanvas(1280, 720);
  const sounds = [];
  let rafCb = null;
  global.window = global;
  global.devicePixelRatio = 1;
  global.addEventListener = (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); };
  global.focus = () => {};
  if (!global.navigator) Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store
  };
  global.document = {
    createElement: () => fakeCanvas(),
    getElementById: (id) => (id === 'gameCanvas' ? gameCanvas : { textContent: '', innerHTML: '', children: [], appendChild() {} }),
    addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); },
    querySelector: () => null,
    body: { appendChild() {}, tabIndex: 0 },
    hidden: false
  };
  global.getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' });
  global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  global.SZ = {
    GameAutoPause: { attach() { return { detach() {} }; } },
    GameAudio: { play(name) { sounds.push(name); }, attachMuteButton() {} },
    Dialog: { show: () => Promise.resolve('ok'), wireAll() {} },
    MenuBar: function(o) { global.SZ.menuAction = o.onAction; }
  };
  if (opts.date) {
    const RealDate = Date;
    const fixed = new RealDate(opts.date).getTime();
    global.Date = class extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(fixed); }
      static now() { return fixed; }
    };
  }
  let clock = 0;
  return {
    gameCanvas, store, sounds, docListeners, winListeners,
    /* runs n animation frames of 1/60 s */
    frames(n) {
      for (let i = 0; i < n; ++i) {
        clock += 1000 / 60;
        const cb = rafCb;
        rafCb = null;
        if (cb) cb(clock);
      }
    },
    key(code, type) {
      const ev = { code: code, key: code, repeat: false, preventDefault() {} };
      for (const f of docListeners[type || 'keydown'] || []) f(ev);
    },
    tap(code) {
      this.key(code, 'keydown');
      this.key(code, 'keyup');
    },
    click(x, y, extra) {
      const ev = Object.assign({ clientX: x, clientY: y, button: 0, pointerType: 'mouse', pointerId: 1, preventDefault() {} }, extra);
      for (const f of gameCanvas.listeners.pointermove || []) f(ev);
      for (const f of gameCanvas.listeners.pointerdown || []) f(ev);
      for (const f of gameCanvas.listeners.pointerup || []) f(ev);
    },
    fire(type) {
      for (const f of winListeners[type] || []) f({});
    }
  };
}

function scriptList(upTo) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const out = [];
  const re = /<script src="(js\/[^"?]+)/g;
  let m;
  while ((m = re.exec(html))) {
    out.push(m[1]);
    if (upTo && m[1].endsWith(upTo)) break;
  }
  return out;
}

function load(upTo) {
  for (const f of scriptList(upTo)) require(path.join(__dirname, '..', f));
  return global.SZ.Bomberman;
}

let failures = 0, passes = 0;
function check(name, ok, details) {
  if (ok) { ++passes; console.log('PASS ' + name); }
  else { ++failures; console.log('FAIL ' + name + (details !== undefined ? ': ' + details : '')); }
}
function done() {
  console.log(passes + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
}

module.exports = { fakeCtx, fakeCanvas, installEnv, scriptList, load, check, done, get canvases() { return canvases; } };
