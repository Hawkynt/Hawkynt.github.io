/* ONO 99: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const AI_TURN_DELAY = 0.8;

  const cardColors = { number: '#2a6', Hold: '#47c', Reverse: '#c47', 'Double Play': '#c74', 'Minus 10': '#74c' };

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 70, y: CANVAS_H / 2, label: 'AI 1' },
    { x: CANVAS_W / 2, y: 40, label: 'AI 2' },
    { x: CANVAS_W - 70, y: CANVAS_H / 2, label: 'AI 3' },
  ];

  const S = {
    hands: [],
    deck: [],
    discardPile: [],
    runningTotal: 0,
    currentPlayer: 0,
    direction: 1,
    eliminated: [],
    roundOver: false,
    gameOver: false,
    score: 0,
    doublePlayCount: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v['ono99'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, AI_TURN_DELAY, cardColors, playerPos };

})();
