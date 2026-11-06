/* Three Card Poker: layout constants and the one state object of the variant (SZ.CardGames.v.threecard). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.threecard = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BETTING = 'BETTING';
  const PHASE_DEALING = 'DEALING';
  const PHASE_DECISION = 'DECISION';
  const PHASE_REVEAL = 'REVEAL';
  const PHASE_RESULT = 'RESULT';

  /* ── Hand ranks ── */
  const HAND_HIGH_CARD = 0;
  const HAND_PAIR = 1;
  const HAND_FLUSH = 2;
  const HAND_STRAIGHT = 3;
  const HAND_THREE_KIND = 4;
  const HAND_STRAIGHT_FLUSH = 5;

  const HAND_NAMES = ['High Card', 'Pair', 'Flush', 'Straight', 'Three of a Kind', 'Straight Flush'];

  /* ── Chip denominations ── */

  /* ── Pair Plus payouts (multiplier, not including original bet) ── */
  const PP_PAYOUTS = {
    [HAND_PAIR]: 1,
    [HAND_FLUSH]: 3,
    [HAND_STRAIGHT]: 6,
    [HAND_THREE_KIND]: 30,
    [HAND_STRAIGHT_FLUSH]: 40
  };

  /* ── Ante Bonus payouts ── */
  const ANTE_BONUS = {
    [HAND_STRAIGHT]: 1,
    [HAND_THREE_KIND]: 4,
    [HAND_STRAIGHT_FLUSH]: 5
  };

  /* ── Layout constants ── */
  const DEALER_HAND_Y = 130;
  const PLAYER_HAND_Y = 300;
  const HAND_CENTER_X = CANVAS_W / 2;
  const CARD_GAP = 14;
  const HAND_OFFSET_X = -(CE.CARD_W + CARD_GAP); // center 3 cards around HAND_CENTER_X

  const BET_ZONE_Y = 232;
  const BET_ZONE_W = 120;
  const BET_ZONE_H = 50;
  const BET_ZONE_GAP = 40;

  const CHIP_BTN_Y = 510;

  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 555, w: 100, h: 32 };
  const PLAY_BTN = { x: CANVAS_W / 2 - 130, y: 460, w: 110, h: 36 };
  const FOLD_BTN = { x: CANVAS_W / 2 + 20, y: 460, w: 110, h: 36 };

  const S = V.S = {
    /* ── Game state ── */
    deck: [],
    playerHand: [],
    dealerHand: [],
    phase: PHASE_BETTING,
    anteBet: 0,
    pairPlusBet: 0,
    selectedChip: 10,
    betTarget: null, // 'ante' or 'pairplus' during betting
    score: 1000,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    resultDetail: '',
    dealTimer: 0,
    dealStep: 0,
    revealTimer: 0,
    revealStep: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DEALING, PHASE_DECISION, PHASE_REVEAL,
    PHASE_RESULT, HAND_HIGH_CARD, HAND_PAIR, HAND_FLUSH, HAND_STRAIGHT, HAND_THREE_KIND,
    HAND_STRAIGHT_FLUSH, HAND_NAMES, PP_PAYOUTS, ANTE_BONUS, DEALER_HAND_Y, PLAYER_HAND_Y,
    HAND_CENTER_X, CARD_GAP, HAND_OFFSET_X, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, BET_ZONE_GAP,
    CHIP_BTN_Y, DEAL_BTN, PLAY_BTN, FOLD_BTN });

})();
