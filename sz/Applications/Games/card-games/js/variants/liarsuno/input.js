/* Liar's Uno: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['liarsuno'];
  const S = V.S;
  const { CANVAS_W } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) { if (S._host) S._host.onRoundOver(S.gameOver); return; }

    // Bluff claim overlay
    if (S.bluffClaimStep === 1) {
      const vals = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','Draw Two','Wild','Wild Draw Four'];
      const labels = ['0','1','2','3','4','5','6','7','8','9','Skip','Rev','+2','W','W+4'];
      for (let i = 0; i < labels.length; ++i) {
        const col = (i % 8);
        const row = (i / 8) | 0;
        const bx = CANVAS_W / 2 - 200 + col * 52;
        const by = 215 + row * 38;
        if (CE.isInRect(mx, my, bx, by, 48, 32)) {
          S.bluffClaimStep = 0;
          V.doPlay(0, S.bluffCardIndex, true, S.bluffCard._claimedColor, vals[i]);
          S.bluffCard = null;
          S.bluffCardIndex = -1;
          S.bluffMode = false;
          return;
        }
      }
      return;
    }

    if (S.bluffClaimStep === 2) return; // shouldn't happen

    // Bluff claim step 0: choose color
    if (S.bluffCard && S.bluffClaimStep === 0 && S.bluffCardIndex >= 0) {
      // This shouldn't happen since we set step to 1 after color
      // But handle the overlay
    }

    // Challenge button
    if (S.challengePhase && S.lastPlayInfo && S.lastPlayInfo.player !== 0 && S.lastPlayInfo.faceDown) {
      if (CE.isInRect(mx, my, CANVAS_W / 2 - 40, 345, 80, 30)) {
        V.doChallenge(0);
        return;
      }
    }
    if (S.challengePhase) return; // wait for challenge phase to end

    if (S.currentPlayer !== 0) return;

    // Bluff toggle button
    if (CE.isInRect(mx, my, CANVAS_W - 140, 450, 80, 30)) {
      S.bluffMode = !S.bluffMode;
      return;
    }

    // Draw pile
    if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H)) {
      SH.refillDeck(S);
      if (S.deck.length > 0) S.hands[0].push(S.deck.pop());
      V.nextPlayer();
      return;
    }

    // Player cards
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 140 + i * 60;
      if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
        if (S.bluffMode) {
          // Play face-down — need to choose claim
          S.bluffCard = S.hands[0][i];
          S.bluffCardIndex = i;
          S.bluffClaimStep = 0;
          // Show color choice first
          // We'll handle it through the overlay
          S._showColorChoiceForBluff = true;
          return;
        }
        // Honest play
        if (!V.isLegalPlay(S.hands[0][i])) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
          return;
        }
        if (S.hands[0][i].type === 'wild') {
          S.bluffCard = S.hands[0][i];
          S.bluffCardIndex = i;
          S._showColorChoiceForHonest = true;
          return;
        }
        V.doPlay(0, i, false, S.hands[0][i].color, S.hands[0][i].value);
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
