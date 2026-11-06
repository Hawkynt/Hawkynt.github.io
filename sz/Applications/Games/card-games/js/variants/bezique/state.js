/* Bezique: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const BRISQUE_POINTS = { 'A': 10, '10': 10 };

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  const GAME_WIN_SCORE = 1000;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_MELD_SELECT = 2;
  const PHASE_ROUND_OVER = 3;

  const MELD_DISPLAY_DELAY = 2.0;

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.bezique = {
    CANVAS_W,
    CANVAS_H,
    BRISQUE_POINTS,
    SUIT_SYMBOLS,
    GAME_WIN_SCORE,
    PHASE_PLAY,
    PHASE_TRICK_DONE,
    PHASE_MELD_SELECT,
    PHASE_ROUND_OVER,
    MELD_DISPLAY_DELAY,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      stock: [],
      trumpCard: null,
      trumpSuit: '',
      trickCards: [],
      trickPlayers: [],
      playerCaptured: [],
      aiCaptured: [],
      playerMeldScore: 0,
      aiMeldScore: 0,
      trickCount: 0,
      currentTurn: 0,
      trickLeader: 0,
      phase: PHASE_PLAY,
      trickWinner: -1,
      trickDoneTimer: 0,
      playerTotalScore: 0,
      aiTotalScore: 0,
      score: 0,
      roundOver: false,
      gameOver: false,
      dealNumber: 0,
      _ctx: null,
      _host: null,
      aiTurnTimer: 0,
      hoverCardIdx: -1,
      /* Meld tracking: each card can be used in each meld TYPE once.
         We track by card identity (suit+rank+copy index).
         playerMeldsUsed[cardId] = Set of meld type keys used.
         A card can participate in different meld types but not the same type twice. */
      playerMeldsUsed: {}, // cardId -> Set<meldType>
      aiMeldsUsed: {},
      /* Cards on the table for melding (face-up, still in hand) */
      playerMeldCards: [], // array of {cards, name, points} declared
      aiMeldCards: [],
      /* Pending melds after winning a trick */
      pendingMeldOptions: [],
      meldDisplayTimer: 0,
      lastMeldMsg: '',
      /* Trump 7 swap */
      trumpSwapped: [false, false], // player, ai
      /* ================================================================
         CARD IDENTITY & MELD TRACKING
         ================================================================ */
      cardIdCounter: 0,
      hoverMeldBtn: -1
    }
  };

})();
