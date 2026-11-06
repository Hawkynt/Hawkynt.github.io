/* Hearts - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const RANK_ORDER = T.RANK_ORDER;

  const HEART = 'hearts';
  const SPADE = 'spades';

  const NUM_PLAYERS = 4;

  const PHASE_PASSING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  const PASS_LEFT = 0;

  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  const hasSuit = T.hasSuit;

  const getCardsOfSuit = T.getCardsOfSuit;

  const PASS_BTN = { x: CANVAS_W / 2 - 60, y: CANVAS_H - CE.CARD_H - 55, w: 120, h: 30 };

  const S = {
    hands: [[], [], [], []],
    trickCards: [],
    trickPlayers: [],
    cumulativeScores: [0, 0, 0, 0],
    roundScores: [0, 0, 0, 0],
    score: 100,
    roundOver: false,
    gameOver: false,
    phase: PHASE_PASSING,
    passDirection: PASS_LEFT,
    selectedForPass: [],
    currentTurn: 0,
    trickLeader: 0,
    trickCount: 0,
    heartsBroken: false,
    roundNumber: 0,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoverCardIdx: -1
  };

  SZ.CardGames.v.hearts = {
    S,
    CANVAS_W, CANVAS_H, RANK_ORDER, HEART, SPADE, NUM_PLAYERS,
    PHASE_PASSING, PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER,
    PASS_LEFT, PLAYER_NAMES, hasSuit, PASS_BTN
  };

})();
