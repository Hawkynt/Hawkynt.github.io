'use strict';

/* End-to-end runner for the canvas games: node e2e/run.js [game ...] [--out dir]
   Opens each game's real page in a headless browser (see driver.js), runs its scenario file
   e2e/<game>.e2e.js and writes screenshots to the output folder (default: <tmp>/sz-e2e) for a
   human look. Scenarios drive the game like a player - real clicks on the game's own hit areas,
   real key presses - and check what is on screen by measuring regions of the game canvas (is
   something drawn there, how many colours), plus no uncaught exceptions or console errors.
   Exit code 1 when a check fails. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const D = require('./driver');

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 ? path.resolve(args[outAt + 1]) : path.join(os.tmpdir(), 'sz-e2e');
const games = args.filter((a, i) => !a.startsWith('--') && i !== outAt + 1);
const all = fs.readdirSync(__dirname).filter(f => f.endsWith('.e2e.js')).map(f => f.replace('.e2e.js', ''));
const list = games.length ? games : all;

let passed = 0, failed = 0;

/* helpers a scenario gets; ns: the game's namespace name under window.SZ. A game page opened on
   its own moves into the desktop and runs there in a window's iframe, so every helper finds the
   game's window first. */
function tools(page, base, game, ns) {
  const GW = '(function(){ const ws = [window].concat(Array.from(document.querySelectorAll("iframe")).map(f => f.contentWindow)); ' +
    'for (const w of ws) { try { if (w && w.SZ && w.SZ.' + ns + ' && w.SZ.' + ns + '.state) return w; } catch (_) {} } return null; })()';
  const ready = '(function(){ const W = ' + GW + '; return !!(W && W.SZ.' + ns + '.state.screen && W.SZ.' + ns + '.view.canvas); })()';
  const wrap = body => '(function(){ const W = ' + GW + '; const NS = W.SZ.' + ns + ', G = NS.state; ' + body + ' })()';
  const t = {
    page,
    /* the desktop itself, fresh, for shell scenarios */
    async openDesktop() {
      await page.goto(base + '/sz/index.html', '!!document.querySelector("#sz-start-button, .sz-start-button")');
      await page.eval('localStorage.clear()');
      await page.goto(base + '/sz/index.html', '!!document.querySelector("#sz-start-button, .sz-start-button")');
      await D.sleep(1200);
    },
    async open() {
      const url = base + '/sz/Applications/Games/' + game + '/index.html';
      await page.goto(url, ready);
      await page.eval('localStorage.clear()');
      await page.goto(url, ready);
      await D.sleep(600);
    },
    /* runs a function in the game's window with NS (the game namespace) and G (its state) bound */
    run(fn, ...a) {
      return page.eval(wrap('return (' + fn.toString() + ')(NS, G, ...' + JSON.stringify(a) + ');'));
    },
    state(expr) {
      return page.eval(wrap('return ' + expr + ';'));
    },
    /* a view-plane point to page coordinates (through the desktop window's iframe) */
    async toPage(x, y) {
      return page.eval(wrap('const f = W === window ? null : Array.from(document.querySelectorAll("iframe")).find(e => e.contentWindow === W); ' +
        'const o = f ? f.getBoundingClientRect() : { left: 0, top: 0 }; const r = NS.view.canvas.getBoundingClientRect(), v = NS.view.info; ' +
        'return { x: o.left + r.left + v.ox + ' + x + ' * v.scale, y: o.top + r.top + v.oy + ' + y + ' * v.scale };'));
    },
    async clickAt(x, y) {
      const p = await t.toPage(x, y);
      await page.click(p.x, p.y);
      await D.sleep(120);
    },
    /* clicks the centre of the game's hit area with this id, like a player would */
    async hit(id) {
      await D.sleep(80);
      const a = await t.run((NS, G, id) => { const h = G.hitAreas.find(h => h.id === id); return h ? { x: h.x + h.w / 2, y: h.y + h.h / 2 } : null; }, id);
      if (!a) throw new Error('no hit area ' + id + ' on screen ' + await t.state('G.screen'));
      await t.clickAt(a.x, a.y);
    },
    async key(k, code, keyCode) {
      await page.key(k, code, keyCode);
      await D.sleep(60);
    },
    wait: D.sleep,
    waitFor: (expr, ms) => page.waitFor(wrap('return ' + expr + ';'), ms),
    /* what is drawn in a view-plane rectangle: distinct colours (quantised), brightness spread */
    pixels(x, y, w, h) {
      return t.run((NS, G, x, y, w, h) => {
        const v = NS.view.info, c = NS.view.canvas;
        const sx = Math.round((v.ox + x * v.scale) * v.dpr), sy = Math.round((v.oy + y * v.scale) * v.dpr);
        const sw = Math.max(1, Math.round(w * v.scale * v.dpr)), sh = Math.max(1, Math.round(h * v.scale * v.dpr));
        const d = c.getContext('2d').getImageData(sx, sy, sw, sh).data;
        const seen = new Set();
        let sum = 0, sq = 0, n = 0;
        for (let i = 0; i < d.length; i += 16) {
          seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4);
          const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          sum += l; sq += l * l; ++n;
        }
        const mean = sum / n;
        return { colors: seen.size, mean: Math.round(mean), spread: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean))) };
      }, x, y, w, h);
    },
    async shot(name) {
      const file = path.join(OUT, game, name + '.png');
      await page.screenshot(file);
      return file;
    },
    /* the browser window at another size (none: back to the normal one), reloading so the desktop
       lays out again; the real window is resized, as emulated screens bigger than it repeat */
    async windowSize(w, h) {
      await page.windowBounds(w || 1280, h ? h + 40 : 800);
      await page.goto(base + '/sz/Applications/Games/' + game + '/index.html', ready);
      await D.sleep(900);
    },
        /* a close-up of a view-plane rectangle, zoomed */
    async closeup(name, x, y, w, h, zoom) {
      const a = await t.toPage(x, y), b = await t.toPage(x + w, y + h);
      const file = path.join(OUT, game, name + '.png');
      await page.screenshot(file, { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, zoom || 2);
      return file;
    },
    check(name, ok, info) {
      if (ok) ++passed; else ++failed;
      console.log((ok ? 'PASS ' : 'FAIL ') + game + ': ' + name + (ok || info == null ? '' : ': ' + JSON.stringify(info)));
    },
    errors() {
      const e = page.errors.slice();
      page.errors.length = 0;
      return e;
    },
  };
  return t;
}

(async () => {
  const { server, url } = await D.serve();
  const browser = await D.launch();
  try {
    for (const game of list) {
      const scenario = require(path.join(__dirname, game + '.e2e.js'));
      const t = tools(browser.page, url, scenario.game || game, scenario.ns);
      try {
        await scenario.run(t);
      } catch (e) {
        ++failed;
        console.log('FAIL ' + game + ': scenario stopped: ' + e.message);
        await t.shot('zz-failure').catch(() => {});
      }
      const errs = t.errors();
      t.check('no uncaught exceptions or console errors', errs.length === 0, errs.slice(0, 5));
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(passed + ' passed, ' + failed + ' failed  -  screenshots in ' + OUT);
  process.exit(failed ? 1 : 0);
})();
