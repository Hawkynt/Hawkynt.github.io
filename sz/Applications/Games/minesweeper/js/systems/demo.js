/* The title screen's demo: a proven field the bot sweeps behind the logo, one move at a time, then
   a fresh one a moment after it is cleared. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const E = NS.engine;

  function reset() {
    const seed = (Date.now() & 0xffff) + 1;
    G.demo = { game: E.create({ w: 18, h: 13, mines: 34, seed: 'demo' + seed, noGuess: true }), t: 0, wait: 0.6, after: 0 };
  }

  function update(dt) {
    if (!G.demo || G.demo.t > 120 || G.demo.after > 2.5) reset();
    const d = G.demo;
    d.t += dt;
    if (!E.playing(d.game)) { d.after += dt; return; }
    d.wait -= dt;
    if (d.wait > 0) return;
    d.wait = 0.16;
    const a = NS.bot.next(d.game);
    NS.bot.act(d.game, a);
    for (const e of E.takeEvents(d.game)) if (e.type === 'open') NS.boardRender.ripple(d.game, e.from, e.cells);
  }

  Object.assign(NS.demo, { reset, update });
})();
