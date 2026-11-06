/* Faro: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.faro;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DEALING, RANKS, DRAWN_X, DRAWN_Y, DRAWN_GAP } = V;

  function initCaseKeeper() {
    S.caseKeeper = {};
    for (const r of RANKS)
      S.caseKeeper[r] = 4;
  }

  function updateCaseKeeper(card) {
    if (card && S.caseKeeper[card.rank] > 0)
      --S.caseKeeper[card.rank];
  }

  function startDeal() {
    if (S.phase !== PHASE_BETTING) return;
    if (V.totalBets() <= 0) return;
    if (S.deck.length < 2) {
      endGame();
      return;
    }
    S.phase = PHASE_DEALING;
    S.loserCard = null;
    S.winnerCard = null;
    S.resultMsg = '';
    S.dealStep = 0;
    S.dealTimer = 0;
  }

  function dealNextCard() {
    const card = S.deck.pop();
    card.faceUp = true;

    if (S.dealStep === 0) {
      S.loserCard = card;
      if (S._host)
        S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, DRAWN_X, DRAWN_Y, 0);
      updateCaseKeeper(card);
    } else {
      S.winnerCard = card;
      if (S._host)
        S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, DRAWN_X + DRAWN_GAP, DRAWN_Y, 0);
      updateCaseKeeper(card);
    }
    ++S.dealStep;
  }

  function endGame() {
    S.roundOver = true;
    S.gameOver = true;
    if (S.score > 500)
      S.resultMsg = 'Deck exhausted! Final chips: ' + S.score + ' - You profit!';
    else if (S.score === 500)
      S.resultMsg = 'Deck exhausted! Broke even.';
    else
      S.resultMsg = 'Deck exhausted! Final chips: ' + S.score;
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#ff8', size: 30 });
  }

  function setupFaro() {
    // Burn the first card (soda) as per historic Faro rules
    S.deck = CE.shuffle(CE.createDeck());
    const sodaCard = S.deck.pop();
    initCaseKeeper();
    updateCaseKeeper(sodaCard);

    S.bets = {};
    S.highCardBet = 0;
    S.selectedChip = 10;
    S.phase = PHASE_BETTING;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.turnNumber = 0;
    S.maxTurns = Math.floor((S.deck.length) / 2);
    S.loserCard = null;
    S.winnerCard = null;
    S.dealStep = 0;
    S.dealTimer = 0;
    S.hoverCell = -1;
  }

  function tick(dt) {
    if (S.phase === PHASE_DEALING) {
      S.dealTimer += dt;
      if (S.dealTimer >= 0.4) {
        S.dealTimer = 0;
        dealNextCard();
        if (S.dealStep >= 2)
          V.resolveTurn();
      }
    }
  }

  Object.assign(V, { startDeal, endGame, setupFaro, tick });

})();
