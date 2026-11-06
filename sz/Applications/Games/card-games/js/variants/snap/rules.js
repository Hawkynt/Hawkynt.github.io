/* Snap: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.snap;
  const S = V.S;
  const { CANVAS_W, CANVAS_H } = V;

  function hasSnapMatch() {
    if (S.centralPile.length < 2) return false;
    const top = S.centralPile[S.centralPile.length - 1];
    const second = S.centralPile[S.centralPile.length - 2];
    return top.rank === second.rank;
  }

  function flipNextCard() {
    const sourceDeck = S.isPlayerTurn ? S.playerDeck : S.aiDeck;
    if (sourceDeck.length === 0) {
      checkGameOver();
      return;
    }
    const card = sourceDeck.pop();
    card.faceUp = true;
    S.centralPile.push(card);

    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, S.isPlayerTurn ? CANVAS_H : -CE.CARD_H, CANVAS_W / 2 - CE.CARD_W / 2, CANVAS_H / 2 - CE.CARD_H / 2 - 60, 0);

    S.isPlayerTurn = !S.isPlayerTurn;

    if (hasSnapMatch()) {
      S.snapWindowOpen = true;
      S.snapWindowTimer = 0;
      S.snapPulsePhase = 0;
      S.aiReactionDelay = 0.3 + Math.random() * 0.9;
      S.aiReactionTimer = 0;
      S.aiWillSnap = true;
    }

    V.updateScore();
  }

  function playerSnaps() {
    if (S.isPaused || S.roundOver || S.gameOver) return;

    if (S.snapWindowOpen && hasSnapMatch()) {
      S.lastReactionTime = S.snapWindowTimer;
      S.showReactionTime = true;
      S.reactionDisplayTimer = 0;
      const pileCards = S.centralPile.splice(0, S.centralPile.length);
      for (const c of pileCards) {
        c.faceUp = false;
        S.playerDeck.unshift(c);
      }
      S.snapWindowOpen = false;
      S.aiWillSnap = false;
      S.lastSnapResult = 'SNAP!';
      S.lastSnapResultTimer = 0;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SNAP!', { color: '#4f4', size: 32 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        S._host.screenShake.trigger(4, 200);
      }
      S.isPaused = true;
      S.pauseTimer = 0;
      V.updateScore();
    } else {
      const penalty = Math.min(3, S.playerDeck.length);
      for (let i = 0; i < penalty; ++i) {
        if (S.playerDeck.length > 0) {
          const c = S.playerDeck.pop();
          c.faceUp = false;
          S.aiDeck.unshift(c);
        }
      }
      S.lastSnapResult = 'Wrong! -' + penalty;
      S.lastSnapResultTimer = 0;
      S.showReactionTime = false;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Wrong! -' + penalty + ' cards', { color: '#f44', size: 24 });
        S._host.screenShake.trigger(6, 300);
      }
      S.isPaused = true;
      S.pauseTimer = 0;
      S.snapWindowOpen = false;
      S.aiWillSnap = false;
      V.updateScore();
      checkGameOver();
    }
  }

  function checkGameOver() {
    if (S.playerDeck.length === 0 && S.centralPile.length === 0) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'GAME OVER - AI wins!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
      return;
    }
    if (S.aiDeck.length === 0 && S.centralPile.length === 0) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'YOU WIN! All 52 cards!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.addGlow(CANVAS_W / 2 - 100, CANVAS_H / 2 - 60, 200, 120, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        S._host.onRoundOver(true);
      }
      return;
    }
    if (S.playerDeck.length === 52) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'YOU WIN! All 52 cards!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.addGlow(CANVAS_W / 2 - 100, CANVAS_H / 2 - 60, 200, 120, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        S._host.onRoundOver(true);
      }
      return;
    }
    if (S.aiDeck.length === 52) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'GAME OVER - AI wins!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
    }
  }

  Object.assign(V, { hasSnapMatch, flipNextCard, playerSnaps, checkGameOver });

})();
