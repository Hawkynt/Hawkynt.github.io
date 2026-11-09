'use strict';

/* Helpers for scenarios of games that use the shared goals and story layer: find the game's
   window by namespace, run code in it, read the DOM overlays, click elements of the overlay. */
module.exports = function(t, ns) {
  const W = '(function(){ const ws = [window].concat(Array.from(document.querySelectorAll("iframe")).map(f => f.contentWindow)); ' +
    'for (const w of ws) { try { if (w && w.SZ && w.SZ.' + ns + ' && w.SZ.GameGoals) return w; } catch (_) {} } return null; })()';
  const run = (body) => t.page.eval('(function(){ const w = ' + W + '; const NS = w.SZ.' + ns + ', G = NS.state || NS.G; ' + body + ' })()');
  return {
    W, run,
    async open(game) {
      const url = t.base + '/sz/Applications/Games/' + game + '/index.html';
      await t.page.goto(url, '!!' + W);
      await t.page.eval('localStorage.clear()');
      await t.page.goto(url, '!!' + W);
      await t.wait(1200);
    },
    async click(selector) {
      const r = await run('const el = w.document.querySelector(' + JSON.stringify(selector) + '); if (!el) return null; const b = el.getBoundingClientRect(); ' +
        'const f = w === window ? null : Array.from(document.querySelectorAll("iframe")).find(e => e.contentWindow === w); const o = f ? f.getBoundingClientRect() : { left: 0, top: 0 }; return { x: o.left + b.left + b.width / 2, y: o.top + b.top + b.height / 2 };');
      if (!r) throw new Error('no element ' + selector);
      await t.page.click(r.x, r.y);
      await t.wait(250);
    },
    has: (selector) => run('return !!w.document.querySelector(' + JSON.stringify(selector) + ');'),
    text: (selector) => run('const el = w.document.querySelector(' + JSON.stringify(selector) + '); return el ? el.textContent : "";'),
  };
};
