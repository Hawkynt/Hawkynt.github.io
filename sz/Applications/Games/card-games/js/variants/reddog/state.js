/* Red Dog: layout constants and the one state object of the variant (SZ.CardGames.v.reddog). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.reddog = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BET = 'BET';
  const PHASE_SHOW_POSTS = 'SHOW_POSTS';
  const PHASE_RESULT = 'RESULT';

  /* ── Chip denominations ── */

  /* ── Layout constants ── */
  const POST_Y = 180;
  const LEFT_POST_X = 250;
  const RIGHT_POST_X = 550;
  const MIDDLE_CARD_X = 400;
  const MIDDLE_CARD_Y = 180;
  const CARD_GAP = 12;
  const CHIP_BTN_Y = 500;
  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 555, w: 100, h: 32 };
  const RAISE_BTN = { x: CANVAS_W / 2 - 130, y: 460, w: 110, h: 36 };
  const CALL_BTN = { x: CANVAS_W / 2 + 20, y: 460, w: 110, h: 36 };

  const S = V.S = {
    /* ── Game state ── */
    deck: [],
    postCards: [],     // the two "post" cards dealt face-up
    middleCard: null,  // the third card drawn
    phase: PHASE_BET,
    betAmount: 0,
    selectedChip: 10,
    raisedBet: 0,      // additional raise amount (0 if just called)
    spread: 0,
    payoutMultiplier: 0,
    score: 500,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    showTimer: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, PHASE_BET, PHASE_SHOW_POSTS, PHASE_RESULT, POST_Y,
    LEFT_POST_X, RIGHT_POST_X, MIDDLE_CARD_X, MIDDLE_CARD_Y, CHIP_BTN_Y, DEAL_BTN, RAISE_BTN,
    CALL_BTN });

})();
