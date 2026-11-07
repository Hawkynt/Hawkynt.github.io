/* A placement bot over the real engine: tries every rotation and column of the current piece
   (and of the held or next piece when holding is allowed), scores the board each would leave by
   height, holes, wells, bumpiness and cleared lines (weights after the published El-Tetris
   features), and returns the best. It plays the title screen's demo and proves in the tests that
   stages, bosses and modes can be finished. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const { COLS, ROWS, SHAPES } = NS.constants;
  const E = NS.engine;

  const W = { height: -0.51, lines: 0.76, holes: -0.36, bump: -0.18, wells: -0.05, top: -1.6 };

  /* board after dropping type t at (r, x); null if it does not fit */
  function simulate(board, t, r, x) {
    const s = SHAPES[t][r];
    const n = s.length;
    const fitsAt = (y) => {
      for (let yy = 0; yy < n; ++yy)
        for (let xx = 0; xx < n; ++xx) {
          if (!s[yy][xx]) continue;
          const bx = x + xx, by = y + yy;
          if (bx < 0 || bx >= COLS || by >= ROWS) return false;
          if (by >= 0 && board[by * COLS + bx]) return false;
        }
      return true;
    };
    let y = -2;
    if (!fitsAt(y)) return null;
    while (fitsAt(y + 1)) ++y;
    const b = board.slice();
    for (let yy = 0; yy < n; ++yy)
      for (let xx = 0; xx < n; ++xx)
        if (s[yy][xx] && y + yy >= 0) b[(y + yy) * COLS + x + xx] = 1;
    let lines = 0;
    for (let row = ROWS - 1; row >= 0; --row) {
      let full = true;
      for (let c = 0; c < COLS; ++c) if (!b[row * COLS + c]) { full = false; break; }
      if (full) {
        b.splice(row * COLS, COLS);
        for (let c = 0; c < COLS; ++c) b.unshift(0);
        ++lines;
        ++row;
      }
    }
    return { board: b, lines: lines, y: y };
  }

  function evaluate(b, lines) {
    const heights = [];
    let holes = 0, agg = 0, bump = 0, wells = 0;
    for (let x = 0; x < COLS; ++x) {
      let h = 0, seen = false;
      for (let y = 0; y < ROWS; ++y) {
        if (b[y * COLS + x]) { if (!seen) { h = ROWS - y; seen = true; } }
        else if (seen) ++holes;
      }
      heights.push(h);
      agg += h;
    }
    let maxH = 0;
    for (let x = 0; x < COLS; ++x) {
      maxH = Math.max(maxH, heights[x]);
      if (x) bump += Math.abs(heights[x] - heights[x - 1]);
      const l = x ? heights[x - 1] : 99, r = x < COLS - 1 ? heights[x + 1] : 99;
      const d = Math.min(l, r) - heights[x];
      if (d > 2) wells += d;
    }
    return W.height * agg + W.lines * lines + W.holes * holes + W.bump * bump + W.wells * wells + (maxH > 14 ? W.top * (maxH - 14) * 4 : 0);
  }

  function bestFor(board, t) {
    let best = null;
    const rots = t === 'O' ? 1 : t === 'I' || t === 'S' || t === 'Z' ? 2 : 4;
    for (let r = 0; r < rots; ++r)
      for (let x = -2; x < COLS; ++x) {
        const s = simulate(board, t, r, x);
        if (!s) continue;
        const v = evaluate(s.board, s.lines);
        if (!best || v > best.value) best = { r: r, x: x, y: s.y, value: v, lines: s.lines };
      }
    return best;
  }

  /* two-piece look-ahead: the current piece placed so the next one fits best too; combo > 0
     rewards placements that clear lines piece after piece */
  function deepFor(board, t, next, combo) {
    let best = null;
    const rots = t === 'O' ? 1 : t === 'I' || t === 'S' || t === 'Z' ? 2 : 4;
    for (let r = 0; r < rots; ++r)
      for (let x = -2; x < COLS; ++x) {
        const s = simulate(board, t, r, x);
        if (!s) continue;
        const nb = next ? bestFor(s.board, next) : null;
        let v = nb ? nb.value : evaluate(s.board, s.lines);
        v += W.lines * s.lines;
        if (combo) v += (s.lines ? combo : -combo * 0.6) + (s.lines && nb && nb.lines ? combo : 0);
        if (!best || v > best.value) best = { r: r, x: x, y: s.y, value: v, lines: s.lines };
      }
    return best;
  }

  /* -> { r, x, hold } for the game's current piece */
  function choose(g) {
    if (!g.piece) return null;
    const cur = bestFor(g.board, g.piece.t);
    if (g.canHold && !g.holdUsed) {
      const other = g.hold || g.queue[0];
      const alt = other ? bestFor(g.board, other) : null;
      if (alt && (!cur || alt.value > cur.value + 0.5)) return Object.assign(alt, { hold: true });
    }
    return cur ? Object.assign(cur, { hold: false }) : null;
  }

  /* plays one piece at once (tests): hold if it is better, then place; opts.deep looks one
     piece ahead, opts.combo chases combos */
  function playPiece(g, opts) {
    if (opts && (opts.deep || opts.combo)) {
      const d = deepFor(g.board, g.piece.t, g.queue[0], opts.combo || 0);
      return d ? E.placeAt(g, d.r, d.x) : false;
    }
    const c = choose(g);
    if (!c) return false;
    if (c.hold) {
      E.holdPiece(g);
      const again = bestFor(g.board, g.piece.t);
      if (!again) return false;
      return E.placeAt(g, again.r, again.x);
    }
    return E.placeAt(g, c.r, c.x);
  }

  Object.assign(NS.bot, { simulate, evaluate, bestFor, deepFor, choose, playPiece, W });
})();
