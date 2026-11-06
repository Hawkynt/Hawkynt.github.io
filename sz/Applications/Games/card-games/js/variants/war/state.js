/* War: layout constants and the one state object of the variant (SZ.CardGames.v.war). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.war = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  /* ── Layout positions ── */
  const AI_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PILE_Y = 40;
  const PLAYER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PILE_Y = CANVAS_H - 40 - CE.CARD_H;

  const AI_PLAY_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PLAY_Y = 190;
  const PLAYER_PLAY_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PLAY_Y = 310;

  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: CANVAS_H / 2 - 18, w: 100, h: 36 };

  /* ── Animation state ── */
  const PHASE_IDLE = 0;         // waiting for click
  const PHASE_FLIP = 1;         // flip animation
  const PHASE_SHOW = 2;         // showing result
  const PHASE_COLLECT = 3;      // winner collecting cards
  const PHASE_WAR_DEAL = 4;     // dealing war face-down cards
  const PHASE_WAR_FLIP = 5;     // flipping war face-up cards
  const PHASE_WAR_SHOW = 6;     // showing war result
  const FLIP_DURATION = 0.35;
  const COLLECT_DURATION = 0.4;
  const WAR_DEAL_INTERVAL = 0.15;

  const S = V.S = {
    /* ── Game state ── */
    playerPile: [],
    aiPile: [],
    playerPlayed: [],
    aiPlayed: [],
    warFaceDown: [],         // { player: [], ai: [] } cards placed face-down during war
    score: 0,
    roundOver: false,
    gameOver: false,
    phase: PHASE_IDLE,
    phaseTimer: 0,
    /* ── Flip animation ── */
    flipAnimProgress: 0,
    /* ── Collect animation ── */
    collectTarget: '',        // 'player' or 'ai'
    collectProgress: 0,
    /* ── War state ── */
    warRound: 0,
    warDealIndex: 0,
    warDealTimer: 0,
    /* ── Result display ── */
    resultText: '',
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, RANK_VALUES, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X,
    PLAYER_PILE_Y, AI_PLAY_X, AI_PLAY_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, FLIP_BTN, PHASE_IDLE,
    PHASE_FLIP, PHASE_SHOW, PHASE_COLLECT, PHASE_WAR_DEAL, PHASE_WAR_FLIP, PHASE_WAR_SHOW,
    FLIP_DURATION, COLLECT_DURATION });

})();
