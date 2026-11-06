/* Rat Screw: layout constants and the one state object of the variant (SZ.CardGames.v.ratscrew). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ratscrew = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const NUM_PLAYERS = 4;
  const HUMAN = 0;
  const FACE_CHANCES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

  /* ── AI reaction range (seconds) ── */
  const AI_SLAP_MIN = 0.3;
  const AI_SLAP_MAX = 1.5;
  const AI_FLIP_DELAY = 0.6;

  /* ── Layout positions ── */
  const CENTER_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 30;

  const PLAYER_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: CANVAS_H - CE.CARD_H - 60, labelY: CANVAS_H - 12, labelAlign: 'center', name: 'You' },
    { x: 40, y: CANVAS_H / 2 - CE.CARD_H / 2, labelY: CANVAS_H / 2 + CE.CARD_H / 2 + 16, labelAlign: 'center', name: 'West' },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 40, labelY: 28, labelAlign: 'center', name: 'North' },
    { x: CANVAS_W - CE.CARD_W - 40, y: CANVAS_H / 2 - CE.CARD_H / 2, labelY: CANVAS_H / 2 + CE.CARD_H / 2 + 16, labelAlign: 'center', name: 'East' }
  ];

  const SLAP_BTN = { x: CANVAS_W / 2 - 70, y: CENTER_Y + CE.CARD_H + 18, w: 140, h: 44 };
  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: SLAP_BTN.y + SLAP_BTN.h + 10, w: 100, h: 32 };

  /* ── Phase & timing ── */
  const PHASE_IDLE = 0;
  const PHASE_FLIPPING = 1;
  const PHASE_FACE_CHALLENGE = 2;
  const PHASE_SLAP_WINDOW = 3;
  const PHASE_COLLECTING = 4;
  const PHASE_PAUSE = 5;
  const COLLECT_DURATION = 0.5;
  const FEEDBACK_DURATION = 1.5;

  const S = V.S = {
    /* ── Game state ── */
    playerPiles: [],
    centerPile: [],
    eliminated: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    /* ── Turn state ── */
    currentTurn: 0,
    faceChallenge: false,
    challengeChances: 0,
    challengePlayer: -1,
    challengeBeneficiary: -1,
    phase: PHASE_IDLE,
    phaseTimer: 0,
    /* ── Slap state ── */
    slapPattern: '',
    slapWinner: -1,
    aiSlapTimers: [],
    aiSlapTargets: [],
    slapFlashTimer: 0,
    slapFlashColor: '',
    slapPulsePhase: 0,
    /* ── AI flip timer ── */
    aiFlipTimer: 0,
    /* ── Collect animation ── */
    collectTarget: -1,
    collectTimer: 0,
    /* ── Feedback ── */
    feedbackText: '',
    feedbackTimer: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, NUM_PLAYERS, HUMAN, FACE_CHANCES, AI_SLAP_MIN, AI_SLAP_MAX,
    AI_FLIP_DELAY, CENTER_X, CENTER_Y, PLAYER_POSITIONS, SLAP_BTN, FLIP_BTN, PHASE_IDLE,
    PHASE_FLIPPING, PHASE_FACE_CHALLENGE, PHASE_SLAP_WINDOW, PHASE_COLLECTING, PHASE_PAUSE,
    COLLECT_DURATION, FEEDBACK_DURATION });

})();
