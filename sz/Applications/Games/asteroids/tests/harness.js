/* Deterministic sandbox that boots the game exactly as index.html does and records
   every observable effect (DOM writes, shared-library calls, audio, window calls),
   so a refactor can be proven behavior-identical by comparing the digest.
   Canvas calls are far too many to keep in an array for a multi-thousand-frame
   session, so every recorded line is streamed into the digest hash while the
   array keeps only the non-canvas lines for inspection. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function createGame(gameDir, opts) {
  opts = opts || {};
  const log = [];
  const hash = crypto.createHash('sha256');
  const rec = (s) => {
    hash.update(s); hash.update('\n');
    if ((!s.startsWith('ctx.') || s.startsWith('ctx.fillText') || s.startsWith('ctx.strokeText')) && !s.startsWith('style '))
      log.push(s);
  };

  /* seeded rng replaces Math.random */
  let seed = (opts.seed >>> 0) || 1;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* virtual clock drives performance.now, Date and rAF timestamps */
  let clock = opts.startClock || 1000;
  const FIXED_EPOCH = 1700000000000;

  /* event listeners of every fake target */
  const listeners = [];
  function addListener(target, type, fn) { listeners.push({ target, type, fn }); }
  function dispatch(type, ev) {
    for (const l of listeners.slice())
      if (l.type === type)
        l.fn(ev);
  }

  /* ---- fake DOM ---- */
  let elCount = 0;
  function label(el) { return el.id || el.tagName.toLowerCase() + '#' + el._uid; }

  function makeStyle(el) {
    const target = {};
    return new Proxy(target, {
      set(t, k, v) { rec('style ' + label(el) + ' ' + String(k) + '=' + v); t[k] = v; return true; },
      get(t, k) { return t[k] === undefined ? '' : t[k]; }
    });
  }

  function makeCtx(el) {
    const gradient = { addColorStop: () => {} };
    const ctx = { canvas: el };
    const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
      'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'save', 'restore', 'translate',
      'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'setLineDash', 'drawImage',
      'quadraticCurveTo', 'bezierCurveTo', 'putImageData', 'drawFocusIfNeeded', 'clip'];
    for (const m of plain)
      ctx[m] = (...args) => { rec('ctx.' + m + ' ' + args.map(fmt).join(',')); };
    ctx.fillText = (t, ...a) => { rec('ctx.fillText ' + t + ' ' + a.map(fmt).join(',')); };
    ctx.strokeText = ctx.fillText;
    ctx.clearRect = ctx.clearRect || (() => {});
    ctx.createLinearGradient = (...a) => { rec('ctx.createLinearGradient ' + a.map(fmt).join(',')); return gradient; };
    ctx.createRadialGradient = (...a) => { rec('ctx.createRadialGradient ' + a.map(fmt).join(',')); return gradient; };
    ctx.createPattern = () => { rec('ctx.createPattern'); return {}; };
    ctx.measureText = (t) => ({ width: String(t).length * 6 });
    ctx.getImageData = (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
    return new Proxy(ctx, {
      set(t, k, v) {
        if (['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline',
          'globalCompositeOperation', 'lineCap', 'lineJoin', 'shadowColor', 'shadowBlur', 'shadowOffsetX',
          'shadowOffsetY', 'filter', 'imageSmoothingEnabled', 'miterLimit', 'lineDashOffset'].includes(k))
          rec('ctx.' + String(k) + '=' + fmt(v));
        t[k] = v; return true;
      }
    });
  }

  function fmt(v) {
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    if (v === null || v === undefined) return String(v);
    if (typeof v === 'object') return v && v._uid !== undefined ? 'el#' + v._uid : typeof v;
    return String(v);
  }

  function makeEl(tag, id) {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      id: id || '',
      children: [],
      parent: null,
      _className: '', _textContent: '', _innerHTML: '',
      dataset: {},
      offsetWidth: 100, offsetHeight: 40, offsetTop: 0, offsetLeft: 0,
      clientWidth: 100, clientHeight: 40,
      scrollWidth: 800, scrollHeight: 600,
      width: 300, height: 150,
      colSpan: 0, rowSpan: 0, disabled: false, checked: false, value: '',
      _uid: ++elCount
    };
    el.style = makeStyle(el);
    el.classList = {
      add: (...cs) => { for (const c of cs) rec('cls.add ' + label(el) + ' ' + c); },
      remove: (...cs) => { for (const c of cs) rec('cls.remove ' + label(el) + ' ' + c); },
      toggle: (c, f) => { rec('cls.toggle ' + label(el) + ' ' + c + ' ' + f); },
      contains: (c) => el._className.split(' ').includes(c)
    };
    Object.defineProperty(el, 'className', {
      get: () => el._className,
      set: (v) => { el._className = String(v); rec('class ' + label(el) + ' ' + el._className); }
    });
    Object.defineProperty(el, 'textContent', {
      get: () => el._textContent,
      set: (v) => { el._textContent = String(v); rec('text ' + label(el) + ' ' + el._textContent); }
    });
    Object.defineProperty(el, 'innerHTML', {
      get: () => el._innerHTML,
      set: (v) => { el._innerHTML = String(v); rec('html ' + label(el) + ' ' + el._innerHTML); }
    });
    el.appendChild = (c) => { el.children.push(c); c.parent = el; rec('append ' + label(el) + ' el#' + c._uid); return c; };
    el.removeChild = (c) => { el.children = el.children.filter(x => x !== c); return c; };
    el.remove = () => { rec('remove el#' + el._uid); if (el.parent) el.parent.children = el.parent.children.filter(x => x !== el); };
    el.addEventListener = (t, fn) => addListener(el, t, fn);
    el.removeEventListener = () => {};
    el.getContext = () => makeCtx(el);
    el.toDataURL = () => 'data:image/png;base64,';
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: el.clientWidth, height: el.clientHeight, right: el.clientWidth, bottom: el.clientHeight, x: 0, y: 0 });
    el.setAttribute = (k, v) => { rec('attr ' + label(el) + ' ' + k + '=' + v); };
    el.setAttributeNS = el.setAttribute;
    el.getAttribute = () => null;
    el.removeAttribute = () => {};
    el.focus = () => {}; el.blur = () => {};
    el.click = () => dispatch('click', { type: 'click', target: el, preventDefault() {} });
    el.querySelector = () => null;
    el.querySelectorAll = () => [];
    el.closest = () => null;
    el.insertAdjacentHTML = () => {};
    el.animate = () => ({ cancel() {}, finished: Promise.resolve() });
    el.scrollIntoView = () => {};
    return el;
  }

  const byId = {};
  const bySelector = {};
  const document = {
    getElementById: (id) => byId[id] || (byId[id] = makeEl('div', id)),
    createElement: (tag) => makeEl(tag),
    createElementNS: (ns, tag) => makeEl(tag),
    querySelector: (sel) => bySelector[sel] || (bySelector[sel] = makeEl('div', sel)),
    querySelectorAll: () => [],
    addEventListener: (t, fn) => addListener(document, t, fn),
    removeEventListener: () => {},
    body: makeEl('body', 'body'),
    head: makeEl('head', 'head'),
    documentElement: makeEl('html', 'html'),
    hidden: false,
    visibilityState: 'visible',
    activeElement: null,
    fonts: { ready: Promise.resolve(), addEventListener() {} },
    title: ''
  };
  document.documentElement.scrollWidth = 800;
  document.documentElement.scrollHeight = 600;

  /* ---- window ---- */
  let rafId = 1;
  let rafQueue = [];
  const timers = [];
  let timerId = 1;
  const storageMap = new Map();

  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener: (t, fn) => addListener(window, t, fn),
    removeEventListener: () => {},
    requestAnimationFrame: (fn) => { const id = rafId++; rafQueue.push({ id, fn }); return id; },
    cancelAnimationFrame: (id) => { rafQueue = rafQueue.filter(r => r.id !== id); },
    setTimeout: (fn, ms) => { const id = timerId++; timers.push({ id, at: clock + (ms || 0), fn }); return id; },
    setInterval: (fn, ms) => { const id = timerId++; timers.push({ id, at: clock + (ms || 0), fn, every: ms }); return id; },
    clearTimeout: (id) => { for (let i = timers.length - 1; i >= 0; --i) if (timers[i].id === id) timers.splice(i, 1); },
    clearInterval: window_clearTimeoutStub(),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    navigator: { userAgent: 'node-harness', maxTouchPoints: 0, language: 'en-US', platform: 'linux' },
    location: { href: 'file:///sz/Applications/Games/game/index.html', search: '', hash: '', pathname: '/index.html' },
    close: () => { rec('window.close'); },
    scrollTo: () => {},
    alert: () => {},
    confirm: () => true,
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); rec('store ' + k + '=' + v); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => storageMap.clear()
    },
    performance: { now: () => clock },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    Image: class { constructor() { this.width = 0; this.height = 0; } set src(v) { rec('img.src ' + v); if (this.onload) this.onload(); } },
    Audio: class { constructor() { this.paused = true; } play() { return Promise.resolve(); } pause() {} load() {} },
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; ++i) a[i] = Math.floor(rand() * 256); return a; } }
  };
  function window_clearTimeoutStub() { return (id) => { for (let i = timers.length - 1; i >= 0; --i) if (timers[i].id === id) timers.splice(i, 1); }; }

  /* fixed Date so daily-seed logic is deterministic */
  const RealDate = Date;
  function FakeDate(...args) {
    if (args.length === 0) return new RealDate(FIXED_EPOCH);
    return new RealDate(...args);
  }
  FakeDate.now = () => clock;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.prototype = RealDate.prototype;

  /* ---- shared desktop libraries, recorded stubs ---- */
  const SZ = {
    Dlls: {
      Kernel32: { IsInsideOS: () => false },
      User32: {
        DestroyWindow: () => rec('User32.DestroyWindow'),
        MoveWindow: (w, h) => rec('User32.MoveWindow ' + w + ' ' + h),
        EnableVisualStyles: () => rec('User32.EnableVisualStyles'),
        SetWindowText: (t) => rec('User32.SetWindowText ' + t),
        RegisterWindowProc: (fn) => { rec('User32.RegisterWindowProc'); },
        GetAsyncKeyState: () => 0
      }
    },
    GameAudio: {
      play: (name, o) => rec('sfx ' + name + ' ' + JSON.stringify(o || {})),
      attachMuteButton: () => rec('GameAudio.attachMuteButton'),
      muted: false
    },
    GameAutoPause: {
      handlers: [],
      attach: (h) => { SZ.GameAutoPause.handlers.push(h); rec('GameAutoPause.attach'); }
    },
    GameEffects: {
      ParticleSystem: class {
        burst(x, y, n, o) { rec('fx.burst ' + fmt(x) + ' ' + fmt(y) + ' ' + n + ' ' + JSON.stringify(o || {})); }
        sparkle(x, y, n, o) { rec('fx.sparkle ' + fmt(x) + ' ' + fmt(y) + ' ' + n + ' ' + JSON.stringify(o || {})); }
        trail(x, y, o) { rec('fx.trail ' + fmt(x) + ' ' + fmt(y) + ' ' + JSON.stringify(o || {})); }
        update(dt) { rec('fx.update ' + fmt(dt)); }
        clear() { rec('fx.clear'); }
        draw() { rec('fx.draw'); }
      },
      ScreenShake: class {
        trigger(i, d) { rec('shake ' + fmt(i) + ' ' + fmt(d)); }
        update(dt) { rec('shake.update ' + fmt(dt)); }
        apply() { rec('shake.apply'); }
        restore() { rec('shake.restore'); }
      },
      drawElectricArc: (c, x1, y1, x2, y2, o) => rec('fx.arc ' + fmt(x1) + ' ' + fmt(y1) + ' ' + fmt(x2) + ' ' + fmt(y2) + ' ' + JSON.stringify(o || {})),
      FloatingText: class {
        add(x, y, t, o) { rec('ftext ' + fmt(x) + ' ' + fmt(y) + ' ' + t + ' ' + JSON.stringify(o || {})); }
        update(dt) { rec('ftext.update ' + fmt(dt)); }
        clear() { rec('ftext.clear'); }
        draw() { rec('ftext.draw'); }
      }
    },
    Dialog: {
      show: (id) => { rec('Dialog.show ' + id); return Promise.resolve(opts.dialogResult || null); },
      close: (id) => { rec('Dialog.close ' + id); },
      wireAll: () => rec('Dialog.wireAll')
    },
    MenuBar: class {
      constructor(o) { SZ.MenuBar.onAction = o && o.onAction; rec('MenuBar'); }
    }
  };

  /* ---- vm context ---- */
  /* the shared desktop libraries live on window.SZ in the browser; mirror that so
     both bare-SZ and window.SZ modules see the same namespace */
  window.SZ = SZ;
  const seededMath = Object.create(Math);
  seededMath.random = rand;
  const context = vm.createContext({
    window, document, SZ,
    localStorage: window.localStorage,
    performance: window.performance,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    setTimeout: window.setTimeout, setInterval: window.setInterval,
    clearTimeout: window.clearTimeout, clearInterval: window.clearTimeout,
    matchMedia: window.matchMedia,
    getComputedStyle: window.getComputedStyle,
    navigator: window.navigator,
    location: window.location,
    devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 800,
    Math: seededMath,
    Date: FakeDate,
    Image: window.Image,
    Audio: window.Audio,
    ResizeObserver: window.ResizeObserver,
    MutationObserver: window.MutationObserver,
    IntersectionObserver: window.IntersectionObserver,
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return makeCtx(this); } },
    console: { log: () => {}, warn: () => {}, error: (...a) => rec('console.error ' + a.join(' ')) },
    alert: () => {},
    crypto: window.crypto
  });
  function FakeAudioContext() {
    this.currentTime = 0;
    this.state = 'running';
    this.sampleRate = 44100;
    const node = () => ({
      connect: () => node(), disconnect() {}, start() {}, stop() {},
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      detune: { value: 0, setValueAtTime() {} },
      type: 'sine', buffer: null, playbackRate: { value: 1 }
    });
    this.createOscillator = node; this.createGain = node; this.createBiquadFilter = node;
    this.createBufferSource = node; this.createDynamicsCompressor = node; this.createStereoPanner = node;
    this.createWaveShaper = node; this.createDelay = node; this.createConvolver = node;
    this.createBuffer = (ch, len) => ({ length: len, numberOfChannels: ch, getChannelData: () => new Float32Array(len) });
    this.decodeAudioData = () => Promise.resolve({ length: 0, getChannelData: () => new Float32Array(0) });
    this.destination = node();
    this.resume = () => Promise.resolve();
    this.close = () => Promise.resolve();
  }

  /* ---- load the game's own scripts in index.html order ---- */
  function load() {
    const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
    const re = /<script[^>]*\bsrc="([^"]+)"/g;
    let m;
    const errors = [];
    while ((m = re.exec(html))) {
      const src = m[1].split('?')[0];
      if (/^(https?:|data:|\/\/)/.test(src) || src.startsWith('../../'))
        continue;
      const file = path.join(gameDir, src);
      if (!fs.existsSync(file)) { errors.push('missing script ' + src); continue; }
      try {
        vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: src });
      } catch (e) {
        errors.push(src + ': ' + e.message);
      }
    }
    return errors;
  }

  /* ---- driving ---- */
  function key(k, extra) {
    const ev = Object.assign({ type: 'keydown', key: k, code: k, preventDefault() {}, stopPropagation() {}, target: document.body }, extra);
    dispatch('keydown', ev);
  }
  function keyUp(k) {
    dispatch('keyup', { type: 'keyup', key: k, code: k, preventDefault() {}, target: document.body });
  }
  function pointer(type, x, y, id) {
    dispatch(type, { type, clientX: x, clientY: y, pointerId: id === undefined ? 1 : id, button: 0, preventDefault() {}, stopPropagation() {}, target: document.body });
  }
  function frames(n, dt) {
    dt = dt === undefined ? 16.6667 : dt;
    for (let i = 0; i < n; ++i) {
      clock += dt;
      /* due timers first */
      for (let t = 0; t < timers.length; ++t) {
        const timer = timers[t];
        if (timer.at <= clock) {
          if (timer.every) { timer.at = clock + timer.every; } else { timers.splice(t--, 1); }
          timer.fn();
        }
      }
      const batch = rafQueue;
      rafQueue = [];
      for (const r of batch)
        r.fn(clock);
    }
  }
  async function settle() {
    for (let i = 0; i < 10; ++i) await Promise.resolve();
  }

  function digest() {
    return hash.digest('hex');
  }

  return { context, SZ, window, document, load, key, keyUp, pointer, frames, settle, digest, log, listeners, dispatch };
}

module.exports = { createGame };
