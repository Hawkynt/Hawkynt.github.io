/* Doppelkopf - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 12;
  const ROUNDS_PER_MATCH = 8;

  const DK_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];

  const PHASE_PLAYING = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_ROUND_OVER = 2;

  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  const S = {
    hands: [[], [], [], []],
    trickCards: [],
    trickPlayers: [],
    tricks: [],
    tricksWon: [0, 0, 0, 0],
    re: [false, false, false, false],
    soloist: -1,
    playedQueenOfClubs: [false, false, false, false],
    queensOfClubsPlayed: 0,
    dealer: 0,
    currentTurn: 1,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    aiTurnTimer: 0,
    hoverCardIdx: -1,
    phase: PHASE_PLAYING,
    roundNumber: 0,
    cumulativeScores: [0, 0, 0, 0],
    result: null,
    score: 0,
    roundOver: false,
    gameOver: false,
    matchInProgress: false,
    continueMatch: false,
    reportedToHost: false,
    _ctx: null,
    _host: null
  };

  SZ.CardGames.v.doppelkopf = {
    S,
    CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, ROUNDS_PER_MATCH, DK_RANKS,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER, PLAYER_NAMES
  };

})();
