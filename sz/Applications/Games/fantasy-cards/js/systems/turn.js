/* The turn system: ending the player's turn, opening the AI's turn with its
   mana growth and draw, and handing control back with poison ticks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const S = NS.state;

  function endTurn() {
    if (S.state !== C.STATE_PLAYING)
      return;
    if (S.isPlayerTurn) {
      // Apply poison
      if (S.playerPoison > 0) {
        S.playerHP -= S.playerPoison;
        --S.playerPoison;
      }
      S.isPlayerTurn = false;
      SZ.GameAudio.play('click');
      S.aiPlayTimer = 0.8;
      S.turnTransition = 1.0;
      S.turnTransitionText = 'Opponent Turn';
      startAiTurn();
    }
  }

  function startAiTurn() {
    ++S.turnNumber;
    // Mana regen — AI maxMana grows like player's
    if (S.aiMaxMana < C.MAX_MANA)
      ++S.aiMaxMana;
    S.aiMana = S.aiMaxMana;

    // AI draws a card
    NS.deck.drawFromDeck(S.aiDeck, S.aiHand, S.aiDiscard);
    NS.status.updateStatusBar();
  }

  function startPlayerTurn() {
    S.isPlayerTurn = true;
    ++S.turnNumber;

    if (S.playerMaxMana < C.MAX_MANA)
      ++S.playerMaxMana;
    S.playerMana = S.playerMaxMana;

    // Apply poison
    if (S.aiPoison > 0) {
      S.aiHP -= S.aiPoison;
      --S.aiPoison;
    }

    // Draw a card
    NS.deck.drawFromDeck(S.playerDeck, S.playerHand, S.playerDiscard);

    S.turnTransition = 1.0;
    S.turnTransitionText = 'Your Turn';
    SZ.GameAudio.play('blip', { pitch: 1.2, volume: 0.7 });
    NS.status.updateStatusBar();
    NS.game.checkGameEnd();
  }

  Object.assign(NS.turn, { endTurn, startAiTurn, startPlayerTurn });
})();
