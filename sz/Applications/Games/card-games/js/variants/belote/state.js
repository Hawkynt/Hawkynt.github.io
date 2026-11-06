/* Belote: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  const NUM_PLAYERS = 4;
  const TRICKS_PER_ROUND = 8;
  const WIN_SCORE = 501;

  const PLAYER_NAMES = ['You', 'AI-1', 'Partner', 'AI-3'];
  const TEAM_A = 0; // players 0, 2
  const TEAM_B = 1; // players 1, 3

  /* ── Card strength ordering (higher = stronger) ── */
  const TRUMP_STRENGTH = { 'J': 7, '9': 6, 'A': 5, '10': 4, 'K': 3, 'Q': 2, '8': 1, '7': 0 };
  const PLAIN_STRENGTH = { 'A': 7, '10': 6, 'K': 5, 'Q': 4, 'J': 3, '9': 2, '8': 1, '7': 0 };

  /* ── Phases ── */
  const PHASE_DEALING = 0;
  const PHASE_BID_ROUND1 = 1;
  const PHASE_BID_ROUND2 = 2;
  const PHASE_DEAL_REMAINING = 3;
  const PHASE_PLAYING = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_OVER = 6;
  const PHASE_GAME_OVER = 7;

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.belote = {
    CANVAS_W,
    CANVAS_H,
    SUIT_NAMES,
    SUIT_SYMBOLS,
    NUM_PLAYERS,
    TRICKS_PER_ROUND,
    WIN_SCORE,
    PLAYER_NAMES,
    TEAM_A,
    TEAM_B,
    TRUMP_STRENGTH,
    PLAIN_STRENGTH,
    PHASE_DEALING,
    PHASE_BID_ROUND1,
    PHASE_BID_ROUND2,
    PHASE_DEAL_REMAINING,
    PHASE_PLAYING,
    PHASE_TRICK_DONE,
    PHASE_ROUND_OVER,
    PHASE_GAME_OVER,
    PLAYER_HAND_Y,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      hands: [[], [], [], []],
      deck: [],
      trumpSuit: null,
      proposedCard: null,
      takerPlayer: -1,
      takerTeam: -1,
      dealer: 0,
      currentTurn: 0,
      trickLeader: 0,
      trickCards: [],
      trickPlayers: [],
      trickCount: 0,
      teamTrickPoints: [0, 0],
      teamScores: [0, 0],
      roundOver: false,
      gameOver: false,
      score: 0,
      phase: PHASE_DEALING,
      biddingPlayer: 0,
      trickWinnerIdx: -1,
      trickDoneTimer: 0,
      dealRemainingTimer: 0,
      /* ── Belote/Rebelote tracking ── */
      beloteDeclared: [false, false, false, false], // per player: declared belote
      rebeloteDeclared: [false, false, false, false],
      teamBeloteBonus: [0, 0], // 20 per declaration pair
      _ctx: null,
      _host: null,
      aiTurnTimer: 0,
      hoveredCard: -1,
      hoveredBtn: '',
      roundMessage: '',
      statusText: ''
    }
  };

})();
