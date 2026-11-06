/* Old Maid: layout constants and the one state object of the variant (SZ.CardGames.v.oldmaid). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.oldmaid = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const SUIT_GLYPHS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  /* Game phases */
  const PHASE_DEALING = 0;
  const PHASE_REMOVING_PAIRS = 1;
  const PHASE_PLAYER_DRAW = 2;
  const PHASE_AI_DRAW = 3;
  const PHASE_DISCARD_ANIM = 4;
  const PHASE_GAME_OVER = 5;

  const AI_DRAW_DELAY = 1.0;
  const PAIR_REMOVE_DELAY = 0.4;
  const DISCARD_ANIM_DELAY = 0.6;

  const S = V.S = {
    playerHand: [],
    aiHand: [],
    playerPairs: [],
    aiPairs: [],
    aiDrawableOrder: [],
    phase: PHASE_DEALING,
    score: 100,
    roundOver: false,
    gameOver: false,
    aiTimer: 0,
    pairRemoveTimer: 0,
    discardAnimTimer: 0,
    pairRemoveQueue: [],
    hoverCardIdx: -1,
    lastDiscardedPair: null,
    lastDiscardedBy: '',
    queenGlowTimer: 0,
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, SUIT_GLYPHS, PHASE_REMOVING_PAIRS, PHASE_PLAYER_DRAW,
    PHASE_AI_DRAW, PHASE_DISCARD_ANIM, PHASE_GAME_OVER, AI_DRAW_DELAY, PAIR_REMOVE_DELAY,
    DISCARD_ANIM_DELAY });

})();
