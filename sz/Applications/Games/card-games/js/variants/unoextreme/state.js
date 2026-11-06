/* Uno Extreme: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const AI_TURN_DELAY = 0.8;
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];

  const unoColors = ['red', 'blue', 'green', 'yellow'];
  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#000' };

  const colorChoiceRects = [];
  const targetChoiceRects = [];

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 60, y: CANVAS_H / 2, label: 'AI 1' },
    { x: CANVAS_W / 2, y: 20, label: 'AI 2' },
    { x: CANVAS_W - 60, y: CANVAS_H / 2, label: 'AI 3' },
  ];

  const S = {
    hands: [],
    deck: [],
    discard: [],
    topCard: null,
    currentPlayer: 0,
    direction: 1,
    roundOver: false,
    gameOver: false,
    score: 0,
    waitingForColorChoice: false,
    waitingForTargetChoice: false,
    pendingWildCard: null,
    pendingWildPlayer: -1,
    launcherAnim: 0,
    finished: [],
    finishOrder: null,
    podiumPending: false,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v['unoextreme'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, AI_TURN_DELAY, unoColors, colorMap, colorChoiceRects, targetChoiceRects, playerPos };

})();
