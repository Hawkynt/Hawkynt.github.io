/* The title screen's demo: a game the bot plays in the background, moving and turning each
   piece step by step like a person would, so the title is always alive. Restarts when it tops
   out or gets too long. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const E = NS.engine;

  function reset() {
    G.demo = { game: E.create({ seed: (Date.now() & 0xffff) + 1, level: 3, levelMode: 'fixed', orbChance: 0 }), plan: null, t: 0 };
  }

  function update(dt) {
    if (!G.demo || G.demo.game.over || G.demo.game.pieces > 160) reset();
    const d = G.demo, g = d.game;
    d.t += dt;
    if (g.piece && !d.plan) d.plan = NS.bot.choose(g);
    if (g.piece && d.plan && d.t > 0.09) {
      d.t = 0;
      const p = g.piece;
      if (d.plan.hold && !g.holdUsed) {
        E.holdPiece(g);
        d.plan = NS.bot.bestFor(g.board, g.piece.t);
        if (d.plan) d.plan.hold = false;
      } else if (p.r !== d.plan.r) E.rotate(g, 1);
      else if (p.x < d.plan.x) E.move(g, 1);
      else if (p.x > d.plan.x) E.move(g, -1);
      else {
        E.hardDrop(g);
        d.plan = null;
      }
    }
    E.step(g, Math.min(dt, 0.05), {});
    if (!g.piece) d.plan = null;
    E.takeEvents(g);
  }

  Object.assign(NS.demo, { reset, update });
})();
