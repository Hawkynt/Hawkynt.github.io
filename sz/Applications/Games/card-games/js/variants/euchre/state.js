/* Euchre - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const SUIT_NAMES = T.SUIT_NAMES;
  const SUIT_SYMBOLS = T.SUIT_SYMBOLS;
  const SAME_COLOR = { spades: 'clubs', clubs: 'spades', hearts: 'diamonds', diamonds: 'hearts' };

  const NUM_PLAYERS = 4;
  const WIN_SCORE = 10;

  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_A = 0; // players 0, 2
  const TEAM_B = 1; // players 1, 3

  /* ── Phases ── */
  const PHASE_DEALING = 0;
  const PHASE_TRUMP_ROUND1 = 1;
  const PHASE_TRUMP_ROUND2 = 2;
  const PHASE_DISCARD = 3;
  const PHASE_PLAYING = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_SCORE = 6;
  const PHASE_GAME_OVER = 7;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  const S = {
    hands: [[], [], [], []],
    kitty: [],
    kittyCard: null,
    trumpSuit: null,
    callingTeam: -1,
    callingPlayer: -1,
    goingAlone: false,
    sittingOutPlayer: -1,
    dealer: 0,
    currentTurn: 0,
    trickLeader: 0,
    trickCards: [],
    trickPlayers: [],
    trickCount: 0,
    tricksWon: [0, 0], // per team this round
    teamScores: [0, 0],
    roundOver: false,
    gameOver: false,
    score: 0,
    phase: PHASE_DEALING,
    biddingPlayer: 0,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoveredCard: -1,
    hoveredBtn: '',
    roundMessage: ''
  };

  SZ.CardGames.v.euchre = {
    S,
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, SAME_COLOR, NUM_PLAYERS,
    WIN_SCORE, PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_DEALING,
    PHASE_TRUMP_ROUND1, PHASE_TRUMP_ROUND2, PHASE_DISCARD, PHASE_PLAYING,
    PHASE_TRICK_DONE, PHASE_ROUND_SCORE, PHASE_GAME_OVER, PLAYER_HAND_Y
  };

})();
