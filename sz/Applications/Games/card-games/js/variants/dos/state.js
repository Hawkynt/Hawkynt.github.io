/* Dos: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 3;
  const AI_TURN_DELAY = 0.9;

  const dosColors = ['red', 'blue', 'green', 'yellow'];
  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#555' };

  const S = {
    hands: [],
    deck: [],
    centerPiles: [null, null],
    currentPlayer: 0,
    roundOver: false,
    gameOver: false,
    score: 0,
    selectedCards: [],
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v['dos'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, AI_TURN_DELAY, dosColors, colorMap };

})();
