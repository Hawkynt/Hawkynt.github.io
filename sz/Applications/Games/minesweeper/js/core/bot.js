/* A player bot over the real engine: opens the middle first, then plays the solver's certain
   moves on what is visible - flags the deduced mines, opens the deduced safe cells - and only
   guesses the least risky cell when logic runs out (classic boards; never on proven ones). It
   plays the title demo, is the CPU rival in Versus and proves in the tests that stages, guardians
   and modes can be cleared. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const B = NS.board;
  const E = NS.engine;

  /* -> the next action { type: 'reveal' | 'flag', i, guess } or null when there is nothing to do */
  function next(g) {
    if (!E.playing(g)) return null;
    if (g.state === 'ready') return { type: 'reveal', i: Math.floor(g.h / 2) * g.w + Math.floor(g.w / 2), guess: false };
    const v = E.view(g);
    const d = B.deduce(v);
    if (!g.noFlags && g.flagLockT <= 0) for (const i of d.mine) if (g.flag[i] !== 1) return { type: 'flag', i: i, guess: false };
    for (const i of d.safe) if (!g.open[i]) return { type: 'reveal', i: i, guess: false };
    if (d.mine.length && (g.noFlags || g.flagLockT > 0)) {
      /* cannot flag: open the safe cells the deduced mines prove, treating them as known */
      for (const i of d.mine) v.state[i] = 2;
      const d2 = B.deduce(v);
      for (const i of d2.safe) if (!g.open[i]) return { type: 'reveal', i: i, guess: false };
    }
    /* a wrong flag (from a guardian's mischief or a player) blocks logic: lift flags logic cannot back */
    const i = B.guessCell(v);
    return i >= 0 ? { type: 'reveal', i: i, guess: true } : null;
  }

  function act(g, a) {
    if (!a) return '';
    if (a.type === 'flag') return E.setFlag(g, a.i, true) ? 'flag' : '';
    return E.reveal(g, a.i);
  }

  /* plays one action (tests) */
  function playOne(g) {
    return act(g, next(g));
  }

  /* plays until the board is won or lost or `max` actions ran out; -> actions */
  function playOut(g, max) {
    let n = 0;
    while (E.playing(g) && n < (max || 100000)) { if (!playOne(g) && !E.playing(g)) break; ++n; }
    return n;
  }

  Object.assign(NS.bot, { next, act, playOne, playOut });
})();
