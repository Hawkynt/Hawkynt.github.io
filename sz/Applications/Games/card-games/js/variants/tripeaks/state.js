;(function() {
  'use strict';

  /* TriPeaks: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.tripeaks = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const MAX_UNDO = 100;

  /* ================================================================
   *  PEAK LAYOUT DEFINITION
   *
   *  Three peaks, each a triangle. Standard TriPeaks layout:
   *
   *  Row 0 (3 cards):   peaks 0,1,2 each have 1 card at top
   *  Row 1 (6 cards):   peaks 0,1,2 each have 2 cards
   *  Row 2 (9 cards):   peaks 0,1,2 each have 3 cards
   *  Row 3 (10 cards):  shared bottom row, all face-up
   *
   *  Total: 28 cards in peaks, 24 in stock (1 goes to waste)
   *
   *  Covering rule: A card in row r at position c covers
   *  cards at row r+1 positions c and c+1 (within its peak).
   *  Row 3 is the bottom row shared across peaks.
   * ================================================================ */

  // Layout positions per peak (relative col indices within each peak)
  // Each peak occupies cols 0..3 at row 3
  //
  // Peak layout (cols are 0-indexed within peak area):
  //   Row 0:       col 1.5 (centered)
  //   Row 1:       col 1, col 2
  //   Row 2:       col 0.5, col 1.5, col 2.5
  //   Row 3:       col 0, col 1, col 2, col 3 (partially shared with adjacent peaks)

  // We define 28 card positions with absolute indices.
  // Card layout uses a fixed coordinate system.

  const PEAK_OFFSET_X = 30; // left margin
  const PEAK_OVERLAP_X = CE.CARD_W * 0.55; // horizontal spacing between cards in same row
  const ROW_OVERLAP_Y = CE.CARD_H * 0.40; // vertical spacing between rows

  const ROW0_Y = 20;
  const ROW1_Y = ROW0_Y + ROW_OVERLAP_Y;
  const ROW2_Y = ROW1_Y + ROW_OVERLAP_Y;
  const ROW3_Y = ROW2_Y + ROW_OVERLAP_Y;

  // Each peak's leftmost x origin at row 3 (the widest row)
  const PEAK_WIDTH = 4 * PEAK_OVERLAP_X; // 4 cards at row 3
  const TOTAL_WIDTH = 3 * PEAK_WIDTH - 2 * PEAK_OVERLAP_X; // peaks overlap by 1 card at row 3
  const START_X = (CANVAS_W - TOTAL_WIDTH - CE.CARD_W) / 2;

  /* ================================================================
   *  STOCK / WASTE POSITIONS
   * ================================================================ */

  const STOCK_X = 60;
  const STOCK_Y = CANVAS_H - CE.CARD_H - 40;
  const WASTE_X = STOCK_X + CE.CARD_W + 20;
  const WASTE_Y = STOCK_Y;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    peaks: [], // array of { card, row, col, peak, faceUp, x, y, removed }
    stock: [], // face-down draw pile
    waste: [], // waste pile (top card is the match target)
    streak: 0, // current consecutive plays from peaks
    score: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    peaksCleared: false,
    undoHistory: [],

    /* -- Host references -- */
    _ctx: null,
    _host: null,

    /* -- Animation state -- */
    animatingCards: [],
    particles: []
  };

  Object.assign(V, {
    CE, CANVAS_W, CANVAS_H, MAX_UNDO, PEAK_OVERLAP_X, ROW0_Y, ROW1_Y, ROW2_Y, ROW3_Y, PEAK_WIDTH,
    START_X, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y
  });

})();
