'use strict';

/* Test harness: a recording fake 2D canvas, a minimal DOM, storage and clock, and a loader that
   runs the game's script files in index.html order inside this fake window. Also steps and
   draws frames for scenario tests. */
const fs = require('fs');
const path = require('path');

function fakeCtx() {
  const gradient = { addColorStop() {} };
  const c = {
    calls: 0, images: 0, gradients: 0, texts: 0, globalAlpha: 1, globalCompositeOperation: 'source-over', font: '16px sans-serif',
    lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt',
    lineJoin: 'miter', lineDashOffset: 0, imageSmoothingEnabled: true, shadowBlurUsed: 0,
  };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke',
    'clip', 'fillRect', 'strokeRect', 'clearRect', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale',
    'transform', 'setTransform', 'resetTransform', 'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'putImageData'];
  for (const name of plain) c[name] = function() { ++c.calls; };
  c.fillText = function() { ++c.calls; ++c.texts; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.measureText = function(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
    return { width: String(t).length * (m ? parseFloat(m[1]) : 16) * 0.55 };
  };
  Object.defineProperty(c, 'shadowBlur', { set(v) { if (v) ++c.shadowBlurUsed; }, get() { return 0; } });
  return c;
}

function fakeCanvas() {
  const ctx = fakeCtx();
  return {
    width: 0, height: 0, style: {}, getContext: () => ctx, ctx: ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener() {}, focus() {},
    parentElement: { clientWidth: 1280, clientHeight: 720 },
  };
}

let clock = Date.UTC(2026, 10, 8, 12, 0, 0);
const RealDate = Date;
function FakeDate(...a) {
  return a.length ? new RealDate(...a) : new RealDate(clock);
}
FakeDate.now = () => clock;
FakeDate.UTC = RealDate.UTC;
FakeDate.prototype = RealDate.prototype;

function installEnv(opts) {
  opts = opts || {};
  const store = opts.store || {};
  const listeners = {};
  const gameCanvas = fakeCanvas();
  global.window = global.window || {};
  window.devicePixelRatio = 1;
  window.addEventListener = (t, f) => { (listeners['w:' + t] = listeners['w:' + t] || []).push(f); };
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const el = () => ({ textContent: '', innerHTML: '', style: {}, appendChild() {} });
  const els = {};
  global.document = {
    createElement: () => fakeCanvas(),
    getElementById: id => (id === 'gameCanvas' ? gameCanvas : (els[id] = els[id] || el())),
    querySelector: () => el(),
    addEventListener: (t, f) => { (listeners['d:' + t] = listeners['d:' + t] || []).push(f); },
    body: { appendChild() {} },
    hidden: false,
  };
  global.getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' });
  global.Date = FakeDate;
  window.SZ = { GameAudio: { play() {}, attachMuteButton() { return { style: {} }; } }, Dialog: { show: () => Promise.resolve('ok') } };
  if (opts.music !== false) {
    const mp = require('path').join(__dirname, '..', '..', '..', 'shared', 'game-music.js');
    delete require.cache[require.resolve(mp)];
    require(mp);
  }
  global.performance = global.performance || { now: () => RealDate.now() };
  global.requestAnimationFrame = window.requestAnimationFrame = () => 0;
  return { gameCanvas, store, listeners, els };
}

function setNow(ms) {
  clock = ms;
}

function now() {
  return clock;
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

/* fresh module instances every call; list: explicit script paths instead of index.html's */
function load(upTo, list) {
  for (const f of list || scriptList(upTo)) {
    const p = path.join(__dirname, '..', f);
    delete require.cache[require.resolve(p)];
    require(p);
  }
  return window.SZ.BubbleBobble;
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

/* n updates of dt seconds, drawing every few */
function run(NS, n, dt, drawEvery) {
  for (let i = 0; i < n; ++i) {
    NS.app.update(dt || 1 / 60);
    if (drawEvery && i % drawEvery === 0) NS.frame.draw();
  }
}

/* a key press and release through the game's own listeners */
function key(env, code, opts) {
  const ev = Object.assign({ key: code, code: code, repeat: false, preventDefault() {}, stopPropagation() {} }, opts || {});
  for (const f of env.listeners['d:keydown'] || []) f(ev);
  for (const f of env.listeners['d:keyup'] || []) f(ev);
}

module.exports = { fakeCtx, fakeCanvas, installEnv, setNow, now, scriptList, load, check, done, run, key };
