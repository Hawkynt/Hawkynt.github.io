/* The title screen's demo: a generated room the bot plays behind the logo, rebuilt whenever it
   is cleared or gets old. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const E = NS.engine;

  function reset() {
    const seed = (Date.now() & 0xffff) + 1;
    const lv = NS.levels.generate(seed, ['ledges', 'steps', 'islands', 'clouds', 'castle'][seed % 5], { kinds: ['walker', 'hopper', 'flyer'], count: 5 });
    G.demo = { game: E.create({ seed: seed, level: lv, infinite: true, noHurry: true }), t: 0, mem: {} };
  }

  function update(dt) {
    if (!G.demo || G.demo.game.cleared || G.demo.t > 90) reset();
    const d = G.demo;
    d.t += dt;
    const n = Math.round(Math.min(dt, 0.05) * 120);
    for (let i = 0; i < n; ++i) E.step(d.game, 1 / 120, NS.bot.input(d.game, d.mem));
    E.takeEvents(d.game);
  }

  Object.assign(NS.demo, { reset, update });
})();
