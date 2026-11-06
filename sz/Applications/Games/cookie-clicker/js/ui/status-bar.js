/* The window's status bar: treats in the bank, production per second, recipe notes and the
   current screen or mode, refreshed a few times per second. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const fmt = NS.format;

  const el = id => document.getElementById(id);
  const NAMES = { title: 'Title', game: 'Baking', paused: 'Paused', tree: 'Tech Tree', collection: 'Collection', journal: 'Journal',
    ascend: 'Ascension', help: 'How to Play', bakeResult: 'Bake-Off Results', zen: 'Zen Kitchen' };
  let t = 0;

  function update() {
    const run = G.active();
    if (!run) return;
    const a = el('statusCookies'), b = el('statusCps'), c = el('statusNotes'), d = el('statusState');
    if (a) a.textContent = 'Treats: ' + fmt.short(run.cookies);
    if (b) b.textContent = 'Per second: ' + (G.st ? fmt.rate(NS.production.cpsOf(run, G.st)) : '0');
    if (c) c.textContent = 'Notes: ' + fmt.short(G.profile.notes) + '  Crystals: ' + fmt.short(G.profile.crystals);
    if (d) d.textContent = G.cine ? 'Cinematic' : G.bake && G.screen === 'game' ? 'Bake-Off ' + fmt.clock(G.bake.timeLeft) : NAMES[G.screen] || G.screen;
  }

  function tick(dt) {
    t += dt;
    if (t >= 0.25) {
      t = 0;
      update();
    }
  }

  Object.assign(NS.statusBar, { update, tick });
})();
