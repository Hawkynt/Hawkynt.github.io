/* The one shared mutable state object every module reads and writes: the game
   state machine, both fighters' combat numbers, decks and hands, the deck
   builder selection, animation and hover bookkeeping and the high scores. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;

  NS.state = NS.state || {
    state: C.STATE_MENU,
    difficulty: C.DIFF_NORMAL,
    turnNumber: 0,
    isPlayerTurn: true,
    lastTimestamp: 0,

    /* Player state */
    playerHP: undefined, playerMaxHP: undefined, playerShield: undefined,
    playerMana: undefined, playerMaxMana: undefined,
    playerDeck: undefined, playerHand: undefined, playerDiscard: undefined,
    playerDamageBuff: undefined, playerShieldBuff: undefined, playerPoison: undefined,

    /* AI state */
    aiHP: undefined, aiMaxHP: undefined, aiShield: undefined,
    aiMana: undefined, aiMaxMana: undefined,
    aiDeck: undefined, aiHand: undefined, aiDiscard: undefined,
    aiDamageBuff: undefined, aiShieldBuff: undefined, aiPoison: undefined,

    /* Deck builder */
    selectedDeck: [],

    /* Animations */
    cardAnimations: [],
    manaShimmerTimer: 0,
    hoveredCard: -1,
    hoveredDeckCard: -1,
    mouseX: 0, mouseY: 0,
    aiPlayTimer: 0,
    turnTransition: 0,
    turnTransitionText: '',
    showHelpOnMenu: false,

    /* High scores */
    highScores: []
  };
})();
