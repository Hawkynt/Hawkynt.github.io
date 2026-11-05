'use strict';

/* Test harness: a recording fake 2D canvas, a minimal DOM, storage and desktop shell, and a
   loader that runs the game's script files in index.html order inside this fake window.
   Also steps the simulation and draws frames for the scenario tests. */
const fs = require('fs');
const path = require('path');

let canvases = 0;
const counters = { calls: 0, images: 0, gradients: 0, blur: 0 };

function fakeCtx() {
  const gradient = { addColorStop() {} };
  const c = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', font: '16px sans-serif', lineWidth: 1, fillStyle: '#000',
    strokeStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter',
    imageSmoothingEnabled: true
  };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke',
    'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale',
    'transform', 'setTransform', 'resetTransform', 'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'putImageData'];
  for (const name of plain)
    c[name] = function() { ++counters.calls; };
  c.drawImage = function() { ++counters.calls; ++counters.images; };
  c.createLinearGradient = function() { ++counters.calls; ++counters.gradients; return gradient; };
  c.createRadialGradient = function() { ++counters.calls; ++counters.gradients; return gradient; };
  c.createPattern = function() { ++counters.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
    return { width: String(t).length * (m ? parseFloat(m[1]) : 16) * 0.55 };
  };
  Object.defineProperty(c, 'shadowBlur', { set(v) { if (v) ++counters.blur; }, get() { return 0; } });
  return c;
}

function fakeCanvas() {
  ++canvases;
  const ctx = fakeCtx();
  return {
    width: 0, height: 0, style: {}, clientWidth: 1280, clientHeight: 720, getContext: () => ctx, ctx: ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener() {}
  };
}

function memoryStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store
  };
}

function installEnv(opts) {
  opts = opts || {};
  const listeners = {};
  const gameCanvas = fakeCanvas();
  global.window = global.window || {};
  window.devicePixelRatio = 1;
  window.addEventListener = (t, f) => { (listeners['w:' + t] = listeners['w:' + t] || []).push(f); };
  window.focus = () => {};
  global.localStorage = opts.storage || memoryStorage();
  const el = () => ({ textContent: '', innerHTML: '', appendChild() {}, addEventListener() {} });
  global.document = {
    createElement: () => fakeCanvas(),
    getElementById: (id) => (id === 'gameCanvas' ? gameCanvas : el()),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    body: { appendChild() {}, focus() {} },
    activeElement: null,
    hasFocus: () => true,
    hidden: false
  };
  window.SZ = window.SZ || {};
  const SZ = window.SZ;
  SZ.GameAutoPause = { attach() { return { detach() {} }; } };
  SZ.GameAudio = { play() {}, attachMuteButton() {} };
  SZ.Dialog = { show: () => Promise.resolve('ok'), wireAll() {} };
  SZ.MenuBar = function() {};
  SZ.Dlls = { User32: { SetWindowText() {}, RegisterWindowProc() {}, DestroyWindow() {} } };
  SZ.GameEffects = {
    ScreenShake: function() { this.trigger = () => {}; this.update = () => {}; this.apply = () => {}; this.restore = () => {}; },
    FloatingText: function() { this.add = () => {}; this.update = () => {}; this.draw = () => {}; this.clear = () => {}; }
  };
  if (typeof performance === 'undefined')
    global.performance = { now: () => Date.now() };
  global.requestAnimationFrame = window.requestAnimationFrame = () => 0;
  return { gameCanvas, listeners, storage: global.localStorage };
}

/* The game's scripts in index.html order (optionally only up to a given file) */
function scriptList(upTo) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const out = [];
  const re = /<script src="(js\/[^"?]+)/g;
  let m;
  while ((m = re.exec(html))) {
    out.push(m[1]);
    if (upTo && m[1].endsWith(upTo))
      break;
  }
  return out;
}

function load(upTo) {
  for (const f of scriptList(upTo))
    require(path.join(__dirname, '..', f));
  return window.SZ.FlappyBird;
}

let failures = 0, passes = 0;
function check(name, ok, details) {
  if (ok) {
    ++passes;
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + (details !== undefined ? ': ' + details : ''));
  }
}

function done() {
  console.log(passes + ' passed, ' + failures + ' failed');
  if (failures)
    process.exitCode = 1;
}

/* n fixed 60 fps steps, drawing every few */
function run(NS, n, drawEvery) {
  for (let i = 0; i < n; ++i) {
    NS.flight.update(1 / 60);
    if (drawEvery && i % drawEvery === 0) {
      NS.view.beginFrame();
      NS.view.draw();
      NS.fxDraw.drawScreenFx();
    }
  }
}

module.exports = { counters, fakeCtx, fakeCanvas, memoryStorage, installEnv, scriptList, load, check, done, run, get canvases() { return canvases; } };
