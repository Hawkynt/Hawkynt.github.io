/* Phase 10: constants and the one mutable game state object (S). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];

  const PHASES = [
    { desc: '2 sets of 3', groups: [{ type: 'set', count: 3 }, { type: 'set', count: 3 }] },
    { desc: '1 set of 3 + 1 run of 4', groups: [{ type: 'set', count: 3 }, { type: 'run', count: 4 }] },
    { desc: '1 set of 4 + 1 run of 4', groups: [{ type: 'set', count: 4 }, { type: 'run', count: 4 }] },
    { desc: '1 run of 7', groups: [{ type: 'run', count: 7 }] },
    { desc: '1 run of 8', groups: [{ type: 'run', count: 8 }] },
    { desc: '1 run of 9', groups: [{ type: 'run', count: 9 }] },
    { desc: '2 sets of 4', groups: [{ type: 'set', count: 4 }, { type: 'set', count: 4 }] },
    { desc: '7 of one color', groups: [{ type: 'color', count: 7 }] },
    { desc: '1 set of 5 + 1 set of 2', groups: [{ type: 'set', count: 5 }, { type: 'set', count: 2 }] },
    { desc: '1 set of 5 + 1 set of 3', groups: [{ type: 'set', count: 5 }, { type: 'set', count: 3 }] },
  ];

  const TURN_DRAW = 0;
  const TURN_PLAY = 1;

  /* -- UI buttons -- */
  const BTN_PHASE = { x: 570, y: 320, w: 90, h: 30 };
  const BTN_HIT = { x: 670, y: 320, w: 70, h: 30 };

  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  SZ.CardGames.v.phase10 = {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, PHASES, TURN_DRAW, TURN_PLAY, BTN_PHASE, BTN_HIT,

    S: {
    /* ================================================================
       GAME STATE
       ================================================================ */
      hands: [],
      deck: [],
      discardPile: [],
      playerPhases: [],
      laidPhases: [], // laidPhases[p] = array of groups laid down
      score: 0,
      roundOver: false,
      gameOver: false,
      currentPlayer: 0,
      turnPhase: TURN_DRAW,
      selectedCards: [], // indices in hand for human player
      aiTurnTimer: 0,
      aiSubStep: 0,
      _ctx: null,
      _host: null,
      hitTarget: null // { player, groupIdx } when picking a hit target
    }
  };

})();
