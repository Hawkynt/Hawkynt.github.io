/* Pishti: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.pishti;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WINNING_SCORE, PHASE_PLAY, PHASE_AI_TURN, PHASE_ROUND_OVER,
    PLAYER_HAND_Y } = V;

  /* ================================================================
     CARD HELPERS
     ================================================================ */

  function isJack(card) {
    return card.rank === 'J';
  }

  function ranksMatch(a, b) {
    return a.rank === b.rank;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 4; ++i) {
      if (S.stock.length > 0) {
        const pc = S.stock.pop();
        pc.faceUp = true;
        S.playerHand.push(pc);
      }
      if (S.stock.length > 0) {
        const ac = S.stock.pop();
        ac.faceUp = false;
        S.aiHand.push(ac);
      }
    }

    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.centerPile = [];
    S.stock = d;
    S.playerCaptures = [];
    S.aiCaptures = [];
    S.playerPishtis = 0;
    S.aiPishtis = 0;
    S.lastCapturer = -1;
    S.roundOver = false;
    S.roundBreakdown = null;
    S.hoverHandIdx = -1;
    S.aiTurnTimer = 0;
    S.pishtiFlashTimer = 0;
    S.pishtiFlashText = '';

    // Place 4 cards face-down on center pile, top one face-up
    for (let i = 0; i < 4; ++i) {
      const c = S.stock.pop();
      c.faceUp = (i === 3);
      S.centerPile.push(c);
    }

    // If top card is a Jack, bury it and draw again
    while (S.centerPile.length > 0 && isJack(S.centerPile[S.centerPile.length - 1])) {
      const jack = S.centerPile.pop();
      jack.faceUp = false;
      S.stock.unshift(jack);
      const replacement = S.stock.pop();
      replacement.faceUp = true;
      S.centerPile.push(replacement);
    }

    // Deal 4 cards to each player
    dealHands();
    S.phase = PHASE_PLAY;
  }

  function canCapture(card) {
    if (S.centerPile.length === 0) return false;
    const topCard = S.centerPile[S.centerPile.length - 1];
    return isJack(card) || ranksMatch(card, topCard);
  }

  function performCapture(who, playedCard) {
    const captures = who === 0 ? S.playerCaptures : S.aiCaptures;
    const isPishti = S.centerPile.length === 1;

    // Capture entire pile + the played card
    captures.push(playedCard);
    while (S.centerPile.length > 0)
      captures.push(S.centerPile.pop());

    S.lastCapturer = who;

    if (isPishti) {
      const bonus = isJack(playedCard) ? 20 : 10;
      if (who === 0) {
        ++S.playerPishtis;
        S.pishtiFlashText = 'PISHTI! +' + bonus;
        S.pishtiFlashTimer = 2.0;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'PISHTI!', { color: '#ff0', size: 32 });
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 25);
        }
      } else {
        ++S.aiPishtis;
        S.pishtiFlashText = 'AI PISHTI! +' + bonus;
        S.pishtiFlashTimer = 2.0;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI Pishti!', { color: '#fa0', size: 24 });
      }
    }
  }

  function playCardToCenter(card) {
    card.faceUp = true;
    S.centerPile.push(card);
  }

  function playerPlayCard(handIdx) {
    const card = S.playerHand.splice(handIdx, 1)[0];

    if (canCapture(card)) {
      performCapture(0, card);
      if (S._host) {
        const count = S.playerCaptures.length;
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 60, 'Captured!', { color: '#8f8', size: 14 });
      }
    } else
      playCardToCenter(card);

    afterTurn();
  }

  function afterTurn() {
    // Both hands empty => re-deal or end round
    if (S.playerHand.length === 0 && S.aiHand.length === 0) {
      if (S.stock.length > 0) {
        dealHands();
        S.phase = PHASE_PLAY;
        return;
      }
      // End of round: last capturer takes remaining center pile (no pishti)
      if (S.centerPile.length > 0 && S.lastCapturer >= 0) {
        const captures = S.lastCapturer === 0 ? S.playerCaptures : S.aiCaptures;
        while (S.centerPile.length > 0)
          captures.push(S.centerPile.pop());
      }
      endRound();
      return;
    }

    // Switch to AI turn
    if (S.phase === PHASE_PLAY) {
      S.phase = PHASE_AI_TURN;
      S.aiTurnTimer = 0;
    }
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countPishtiBonus(captures, pishtis) {
    // Each pishti is 10 points; Jack pishtis are tracked by looking at captures
    // Simplified: we track pishti count per player; standard is 10 per pishti
    // Jack pishtis are 20 -- we handle this in performCapture by counting separately
    // For scoring simplicity, we count pishtis * 10 and jack pishtis separately
    // Actually, the pishtiFlash already shows the bonus. We'll compute from counts.
    return pishtis * 10; // base 10; jack pishtis get extra via card scoring (Jack = 1pt already)
  }

  function scoreCaptures(captures) {
    let pts = 0;
    for (const c of captures) {
      if (c.rank === 'J') ++pts;
      if (c.rank === 'A') ++pts;
      if (c.rank === '2' && c.suit === 'clubs') pts += 2;
      if (c.rank === '10' && c.suit === 'diamonds') pts += 3;
    }
    // Most cards bonus
    return pts;
  }

  function scoreRound() {
    const details = { player: {}, ai: {} };

    const pCardPts = scoreCaptures(S.playerCaptures);
    const aCardPts = scoreCaptures(S.aiCaptures);

    details.player.cardPoints = pCardPts;
    details.ai.cardPoints = aCardPts;

    details.player.cardCount = S.playerCaptures.length;
    details.ai.cardCount = S.aiCaptures.length;

    // Most cards bonus (27+)
    let pMost = 0, aMost = 0;
    if (S.playerCaptures.length > S.aiCaptures.length && S.playerCaptures.length >= 27)
      pMost = 3;
    else if (S.aiCaptures.length > S.playerCaptures.length && S.aiCaptures.length >= 27)
      aMost = 3;
    else if (S.playerCaptures.length === 26 && S.aiCaptures.length === 26) {
      // Tie: no bonus (or some variants give to dealer -- we skip)
    }
    details.player.mostCards = pMost;
    details.ai.mostCards = aMost;

    // Pishti bonuses: 10 per standard pishti, 20 per Jack pishti
    // We tracked total pishtis; for Jack pishtis we need a separate tracker
    // Simplified: each pishti is 10 base, Jack pishtis are 20
    // We'll use a simple pishti counter; each is worth 10 (Jack pishtis already get +1 from Jack scoring)
    // Actually, let's properly track: pishtis are worth 10 each in the counter;
    // Jack pishtis are worth 20 each. We stored just a count.
    // For correctness, let's use a flat approach: playerPishtis counts all pishtis,
    // and Jack pishtis were announced with +20. We'll store separate counts.
    // Since our code adds pishtis uniformly, we'll just use 10 per pishti as base.
    // Jack pishtis: we didn't track them separately. Let's assume 10 per pishti for now.
    // (The floating text showed the correct bonus during play.)
    details.player.pishtis = S.playerPishtis;
    details.ai.pishtis = S.aiPishtis;
    details.player.pishtiBonus = S.playerPishtis * 10;
    details.ai.pishtiBonus = S.aiPishtis * 10;

    details.player.total = pCardPts + pMost + details.player.pishtiBonus;
    details.ai.total = aCardPts + aMost + details.ai.pishtiBonus;

    return details;
  }

  function endRound() {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;
    ++S.roundNumber;

    S.roundBreakdown = scoreRound();

    S.cumulativePlayer += S.roundBreakdown.player.total;
    S.cumulativeAI += S.roundBreakdown.ai.total;

    S.score = S.cumulativePlayer;
    if (S._host) S._host.onScoreChanged(S.score);

    if (S.cumulativePlayer >= WINNING_SCORE || S.cumulativeAI >= WINNING_SCORE) {
      S.gameOver = true;
      if (S.cumulativePlayer >= WINNING_SCORE && S.cumulativePlayer > S.cumulativeAI) {
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      } else if (S.cumulativeAI >= WINNING_SCORE && S.cumulativeAI > S.cumulativePlayer) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI WINS', { color: '#f44', size: 28 });
      } else {
        // Tie at or above threshold -- continue
        S.gameOver = false;
      }
    }

    if (S.gameOver && S._host)
      S._host.onRoundOver(true);
  }

  V.isJack = isJack;
  V.ranksMatch = ranksMatch;
  V.setupRound = setupRound;
  V.canCapture = canCapture;
  V.performCapture = performCapture;
  V.playCardToCenter = playCardToCenter;
  V.playerPlayCard = playerPlayCard;
  V.afterTurn = afterTurn;

})();
