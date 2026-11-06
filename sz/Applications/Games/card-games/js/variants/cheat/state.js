/* Cheat: layout constants and the one state object of the variant (SZ.CardGames.v.cheat). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.cheat = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const RANKS = CE.RANKS; // ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];

  /* Phases */
  const PHASE_PLAYER_TURN = 0;
  const PHASE_CHALLENGE_WINDOW = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_RESOLVING = 3;
  const PHASE_GAME_OVER = 4;

  const CHALLENGE_WINDOW_DURATION = 2.5;
  const AI_TURN_DELAY = 1.2;
  const RESOLVE_DELAY = 2.0;

  /* Layout */
  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 28;
  const AI1_HAND_Y = 12;
  const AI2_HAND_X = 12;
  const AI3_HAND_X = CANVAS_W - CE.CARD_W * 0.5 - 12;

  const PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PILE_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

  const PLAY_BTN = { x: CANVAS_W / 2 + 80, y: CANVAS_H - 42, w: 90, h: 32 };
  const CHEAT_BTN = { x: CANVAS_W / 2 - 55, y: CANVAS_H / 2 + 60, w: 110, h: 36 };
  const MESSAGE_FADE = 3.5;

  const S = V.S = {
    hands: [[], [], [], []],
    discardPile: [],
    currentPlayer: 0,
    requiredRankIdx: 0,
    phase: PHASE_PLAYER_TURN,
    selectedIndices: [],
    lastPlayInfo: null, // { player, count, claimedRank, actualCards }
    challengeTimer: 0,
    aiTurnTimer: 0,
    resolveTimer: 0,
    resolveMessage: '',
    resolveColor: '#fff',
    score: 0,
    roundOver: false,
    gameOver: false,
    message: '',
    messageColor: '#fff',
    messageTimer: 0,
    hoverCardIdx: -1,
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, RANKS, NUM_PLAYERS, PLAYER_NAMES, PHASE_PLAYER_TURN,
    PHASE_CHALLENGE_WINDOW, PHASE_AI_TURN, PHASE_RESOLVING, PHASE_GAME_OVER,
    CHALLENGE_WINDOW_DURATION, AI_TURN_DELAY, RESOLVE_DELAY, PLAYER_HAND_Y, AI1_HAND_Y, AI2_HAND_X,
    AI3_HAND_X, PILE_X, PILE_Y, PLAY_BTN, CHEAT_BTN, MESSAGE_FADE });

})();
