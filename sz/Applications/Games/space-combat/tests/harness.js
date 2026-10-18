'use strict';

/* Test harness: a recording fake 2D canvas, a minimal DOM and storage, and a loader that runs
   the game's script files in index.html order inside this fake window. */
const fs = require('fs');
const path = require('path');

let canvases = 0;

function fakeCtx() {
  const gradient = { addColorStop() {} };
  const c = {
    calls: 0, images: 0, gradients: 0, globalAlpha: 1, globalCompositeOperation: 'source-over', font: '16px sans-serif',
    lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt',
    lineJoin: 'miter', lineDashOffset: 0, imageSmoothingEnabled: true, shadowBlurUsed: 0,
  };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke',
    'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale',
    'transform', 'setTransform', 'resetTransform', 'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'putImageData'];
  for (const name of plain) c[name] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.createImageData = function(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
  c.getImageData = function(x, y, w, h) { return c.createImageData(w, h); };
  c.measureText = function(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
    return { width: String(t).length * (m ? parseFloat(m[1]) : 16) * 0.55 };
  };
  Object.defineProperty(c, 'shadowBlur', { set(v) { if (v) ++c.shadowBlurUsed; }, get() { return 0; } });
  return c;
}

function fakeCanvas() {
  ++canvases;
  const ctx = fakeCtx();
  return {
    width: 0, height: 0, style: {}, getContext: () => ctx, ctx: ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener() {},
    parentElement: { clientWidth: 1280, clientHeight: 720 },
  };
}

function installEnv() {
  const store = {};
  const listeners = {};
  const gameCanvas = fakeCanvas();
  global.window = global.window || {};
  window.devicePixelRatio = 1;
  window.addEventListener = () => {};
  window.focus = () => {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store,
  };
  global.document = {
    createElement: () => fakeCanvas(),
    getElementById: (id) => (id === 'gameCanvas' ? gameCanvas : { textContent: '', innerHTML: '', appendChild() {} }),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    body: { appendChild() {} },
    hidden: false,
  };
  global.getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' });
  window.SZ = window.SZ || {};
  window.SZ.GameAutoPause = { attach() { return { detach() {} }; } };
  window.SZ.GameAudio = { play() {}, attachMuteButton() {} };
  window.SZ.Dialog = { show: () => Promise.resolve('ok') };
  return { gameCanvas, store, listeners };
}

/* The game's scripts in index.html order (optionally only up to a given file) */
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

function load(upTo, skip) {
  for (const f of scriptList(upTo)) {
    if (skip && skip.some(s => f.endsWith(s))) continue;
    require(path.join(__dirname, '..', f));
  }
  return window.SZ.SpaceCombat;
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

module.exports = { fakeCtx, fakeCanvas, installEnv, load, scriptList, check, done, get canvases() { return canvases; } };
