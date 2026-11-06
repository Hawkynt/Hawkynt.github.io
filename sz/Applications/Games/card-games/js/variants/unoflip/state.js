/* Uno Flip: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 3;
  const AI_TURN_DELAY = 0.8;
  const INITIAL_HAND = 7;

  const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'];
  const DARK_COLORS = ['pink', 'teal', 'orange', 'purple'];
  const LIGHT_HEX = { red: '#e33', yellow: '#ea0', green: '#3a3', blue: '#33e' };
  const DARK_HEX = { pink: '#d48', teal: '#2aa', orange: '#e82', purple: '#82e' };
  const WILD_HEX = '#555';

  const S = {
    hands: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    direction: 1,
    activeSide: 'light',
    currentColor: '',
    drawPending: 0,
    skipPending: false,
    roundOver: false,
    gameOver: false,
    score: 0,
    colorChoiceActive: false,
    wildDrawColorActive: false,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    pendingWildIndex: -1
  };

  SZ.CardGames.v['unoflip'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, AI_TURN_DELAY, INITIAL_HAND, LIGHT_COLORS, DARK_COLORS, LIGHT_HEX, DARK_HEX, WILD_HEX };

})();
