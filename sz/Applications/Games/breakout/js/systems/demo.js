/* The title screen's demo: an endless wall the bot plays behind the logo, rebuilt whenever it
   is cleared or gets old. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const E = NS.engine;

  function reset() {
    const seed = (Date.now() & 0xffff) + 1;
    G.demo = { game: E.create({ seed: seed, layout: NS.run.generateWall(seed, 3), level: 4, infinite: true }), t: 0 };
  }

  function update(dt) {
    if (!G.demo || G.demo.game.cleared || G.demo.t > 120) reset();
    const d = G.demo;
    d.t += dt;
    const inp = NS.bot.input(d.game, Math.sin(d.t * 0.7) * 10);
    const n = Math.round(Math.min(dt, 0.05) * 240);
    for (let i = 0; i < n; ++i) E.step(d.game, 1 / 240, i ? Object.assign({}, inp, { launch: false }) : inp);
    E.takeEvents(d.game);
  }

  Object.assign(NS.demo, { reset, update });
})();
