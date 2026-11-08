'use strict';

/* A dependency-free browser driver for the games' end-to-end tests: serves the repository over
   local HTTP (so canvases stay same-origin and readable), starts a Chromium-family browser headless
   with a reusable test profile and a debugging port, and talks the Chrome DevTools Protocol over
   Node's built-in WebSocket. A page offers navigation, script evaluation, real mouse clicks and key
   presses, screenshots, and collects uncaught exceptions and console errors.

   Browser: $SZ_BROWSER, else the first of vivaldi-bin, chromium, google-chrome found. */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port }));
  });
}

function findBrowser() {
  if (process.env.SZ_BROWSER) return process.env.SZ_BROWSER;
  for (const p of ['/opt/vivaldi/vivaldi-bin', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'])
    if (fs.existsSync(p)) return p;
  throw new Error('no Chromium-family browser found - set SZ_BROWSER');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
/* SZ_E2E_TRACE=1 logs every launch step and protocol call to stderr */
const trace = (...a) => { if (process.env.SZ_E2E_TRACE) console.error('[e2e]', ...a); };

function start(profile, port, opts) {
  return spawn(findBrowser(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, '--remote-debugging-port=' + port,
    '--window-size=' + (opts.width || 1280) + ',' + (opts.height || 800), 'about:blank'], { stdio: 'ignore' });
}

async function targets(port, tries) {
  for (let i = 0; i < (tries || 100); ++i) {
    await sleep(150);
    try { return await (await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(1500) })).json(); } catch (_) {}
  }
  return null;
}

/* A browser with the reusable test profile in the temp folder. A brand-new Vivaldi profile does
   not answer on its first start (its welcome flow holds the tab), so a new profile is started
   once and closed before use; saved sessions are removed so no old tabs come back. */
async function launch(opts) {
  opts = opts || {};
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = path.join(os.tmpdir(), 'sz-e2e-profile');
  if (!fs.existsSync(path.join(profile, 'Default'))) {
    fs.mkdirSync(profile, { recursive: true });
    const warm = start(profile, port, opts);
    await targets(port);
    await sleep(3000);
    warm.kill('SIGKILL');
    await sleep(1500);
  }
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) try { fs.rmSync(path.join(profile, f), { force: true }); } catch (_) {}
  for (const f of ['Sessions', 'Current Session', 'Current Tabs', 'Last Session', 'Last Tabs'])
    try { fs.rmSync(path.join(profile, 'Default', f), { recursive: true, force: true }); } catch (_) {}
  const proc = start(profile, port, opts);
  trace('browser started on port', port);
  const http = async (p, method) => (await fetch('http://127.0.0.1:' + port + p, { method: method || 'GET', signal: AbortSignal.timeout(4000) })).text();
  let list = await targets(port);
  if (!list) { proc.kill('SIGKILL'); throw new Error('browser did not open its debugging port'); }
  /* let the browser settle, close a welcome tab, then work in a fresh tab of our own */
  await sleep(2500);
  list = JSON.parse(await http('/json/list'));
  trace('targets', list.map(t => t.type + ' ' + t.url).join(' ; '));
  for (const t of list) if (t.type === 'page' && /welcome/.test(t.url)) await http('/json/close/' + t.id);
  const target = JSON.parse(await http('/json/new?about:blank', 'PUT'));
  await sleep(800);
  const page = await Page.connect(target.webSocketDebuggerUrl);
  trace('connected');
  /* Vivaldi ignores --window-size headless: size the window over the protocol, so emulated screens
     up to this size render whole instead of repeating the window's area */
  try {
    const w = await page.send('Browser.getWindowForTarget');
    await page.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { width: opts.width || 1280, height: opts.height || 800, windowState: 'normal' } });
    await sleep(300);
  } catch (e) { trace('window bounds', e.message); }
  return {
    page,
    async close() {
      try { page.ws.close(); } catch (_) {}
      proc.kill('SIGKILL');
      await sleep(200);
    },
  };
}

class Page {
  static async connect(url) {
    const p = new Page();
    p.ws = new WebSocket(url);
    p.id = 0;
    p.pending = new Map();
    p.errors = [];
    p.ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && p.pending.has(d.id)) {
        const { resolve, reject } = p.pending.get(d.id);
        p.pending.delete(d.id);
        if (d.error) reject(new Error(d.error.message)); else resolve(d.result);
      } else if (d.method === 'Runtime.exceptionThrown') {
        const e = d.params.exceptionDetails;
        p.errors.push((e.exception && e.exception.description || e.text).split('\n').slice(0, 3).join(' | '));
      } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        p.errors.push('console.error: ' + d.params.args.map(a => a.value || a.description).join(' '));
      }
    };
    await new Promise((r, j) => { p.ws.onopen = r; p.ws.onerror = j; });
    await p.send('Runtime.enable');
    await p.send('Page.enable');
    return p;
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      trace('->', method, params && (params.url || (params.expression || '').slice(0, 80)) || '');
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async viewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }

  async goto(url, waitFor) {
    await this.send('Page.navigate', { url });
    await sleep(300);
    if (waitFor) await this.waitFor(waitFor);
  }

  /* evaluates an expression (or a function source with JSON arguments) in the page */
  async eval(expr, ...args) {
    const src = typeof expr === 'function' ? '(' + expr.toString() + ')(...' + JSON.stringify(args) + ')' : expr;
    const r = await this.send('Runtime.evaluate', { expression: src, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }

  async waitFor(expr, ms) {
    const end = Date.now() + (ms || 10000);
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch (_) {}
      await sleep(100);
    }
    throw new Error('timed out waiting for ' + expr);
  }

  async click(x, y) {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }

  /* sizes the real browser window (no emulation, so coordinates stay exact) */
  async windowBounds(width, height) {
    const w = await this.send('Browser.getWindowForTarget');
    await this.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { width, height, windowState: 'normal' } });
    await sleep(400);
  }

  /* a small touch screen: the window shrunk to it and touch input on (no arguments: back to the
     normal window and mouse input) */
  async touchScreen(width, height) {
    await this.send('Emulation.setTouchEmulationEnabled', width ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await this.windowBounds(width || 1280, height || 800);
  }

  /* fingers go through Input.emulateTouchFromMouseEvent: Vivaldi maps Input.dispatchTouchEvent
     coordinates through its own window panels, while mouse-style coordinates land exactly */
  async touch(type, x, y) {
    const t = { touchStart: 'mousePressed', touchMove: 'mouseMoved', touchEnd: 'mouseReleased' }[type];
    this._finger = type === 'touchEnd' ? this._finger : { x, y };
    const p = type === 'touchEnd' ? this._finger : { x, y };
    await this.send('Input.emulateTouchFromMouseEvent', { type: t, x: Math.round(p.x), y: Math.round(p.y), button: type === 'touchMove' ? 'left' : 'left',
      clickCount: type === 'touchMove' ? 0 : 1, timestamp: Date.now() / 1000 });
  }

  /* a finger tap: down and up in place */
  async tap(x, y) {
    await this.touch('touchStart', x, y);
    await sleep(60);
    await this.touch('touchEnd');
  }

  /* a finger drag from one point to another in small steps */
  async swipe(x0, y0, x1, y1, steps) {
    steps = steps || 10;
    await this.touch('touchStart', x0, y0);
    for (let i = 1; i <= steps; ++i) {
      await sleep(20);
      await this.touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    }
    await this.touch('touchEnd');
  }

  async mouseMove(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  }

  async key(key, code, keyCode) {
    const k = { key, code: code || key, windowsVirtualKeyCode: keyCode || 0 };
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, k));
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, k));
  }

  /* clip: { x, y, width, height } in page pixels, scale: zoom of the clip */
  async screenshot(file, clip, scale) {
    const r = await this.send('Page.captureScreenshot', clip ? { format: 'png', clip: Object.assign({ scale: scale || 1 }, clip) } : { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

module.exports = { ROOT, serve, launch, findBrowser, sleep, Page };
