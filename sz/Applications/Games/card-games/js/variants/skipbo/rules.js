/* Skip-Bo: deck, build-pile rules, discards, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['skipbo'];
  const S = V.S;
  const { CANVAS_H, CANVAS_W } = V;

  /* ══════════════════════════════════════════════════════════════════
     DECK
     ══════════════════════════════════════════════════════════════════ */

  function createSkipBoDeck() {
    const d = [];
    for (let n = 1; n <= 12; ++n)
      for (let i = 0; i < 12; ++i)
        d.push({ value: n, type: 'number' });
    for (let i = 0; i < 18; ++i)
      d.push({ value: 0, type: 'skipbo' });
    return d;
  }

  /* ══════════════════════════════════════════════════════════════════
     SKIPBO RULES
     ══════════════════════════════════════════════════════════════════ */

  function canPlaySkipBo(card, buildPile) {
    const topVal = buildPile.length === 0 ? 0 : buildPile[buildPile.length - 1].value;
    const needed = topVal + 1;
    if (needed > 12) return false;
    return card.type === 'skipbo' || card.value === needed;
  }

  function skipBoPlayToBuild(card, source, sourceIndex, buildIndex) {
    if (!canPlaySkipBo(card, S.skipBoBuildPiles[buildIndex])) return false;
    if (source === 'hand')
      S.playerHand.splice(sourceIndex, 1);
    else if (source === 'stock')
      S.skipBoStockPiles[0].pop();
    else if (source === 'discard')
      S.skipBoDiscardPiles[sourceIndex].pop();
    S.skipBoBuildPiles[buildIndex].push(card);
    if (S.skipBoBuildPiles[buildIndex].length >= 12) {
      if (S._host) S._host.floatingText.add(310 + buildIndex * 80 + 35, 180, 'Cleared!', { color: '#ff0', size: 14 });
      S.skipBoBuildPiles[buildIndex] = [];
    }
    if (source === 'stock' && S.skipBoStockPiles[0].length === 0) {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
        S._host.addGlow(180, 320, 400, CE.CARD_H, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
      S.score += 100;
      S.roundOver = true;
      if (S._host) S._host.onScoreChanged(S.score);
    }
    if (S.playerHand.length === 0 && !S.roundOver)
      while (S.playerHand.length < 5 && S.deck.length > 0)
        S.playerHand.push(S.deck.pop());
    S.skipBoSelectedCard = -1;
    S.skipBoSelectedSource = null;
    return true;
  }

  function skipBoDiscardTo(card, source, sourceIndex, discardIndex) {
    if (source === 'hand')
      S.playerHand.splice(sourceIndex, 1);
    else if (source === 'stock')
      S.skipBoStockPiles[0].pop();
    else
      return false;
    S.skipBoDiscardPiles[discardIndex].push(card);
    S.skipBoSelectedCard = -1;
    S.skipBoSelectedSource = null;
    S.skipBoPlayerTurn = false;
    return true;
  }

  function autoEndTurn() {
    if (!S.skipBoPlayerTurn || S.roundOver || S.gameOver) return;
    let cardIdx = S.skipBoSelectedSource === 'hand' ? S.skipBoSelectedCard : -1;
    if (cardIdx < 0 || cardIdx >= S.playerHand.length)
      cardIdx = S.playerHand.length - 1;
    if (cardIdx < 0) return;
    let bestD = 0, bestLen = S.skipBoDiscardPiles[0].length;
    for (let d = 1; d < 4; ++d)
      if (S.skipBoDiscardPiles[d].length < bestLen) { bestD = d; bestLen = S.skipBoDiscardPiles[d].length; }
    skipBoDiscardTo(S.playerHand[cardIdx], 'hand', cardIdx, bestD);
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupSkipBo() {
    const d = CE.shuffle(createSkipBoDeck());
    S.skipBoStockPiles = [[], []];
    S.skipBoBuildPiles = [[], [], [], []];
    S.skipBoDiscardPiles = [[], [], [], []];
    S.skipBoSelectedCard = -1;
    S.skipBoSelectedSource = null;
    S.skipBoPlayerTurn = true;
    S.playerHand = [];
    S.aiHands = [[]];
    S.roundOver = false;
    S.gameOver = false;
    S.aiTurnTimer = 0;
    for (let i = 0; i < 20; ++i) {
      S.skipBoStockPiles[0].push(d.pop());
      S.skipBoStockPiles[1].push(d.pop());
    }
    S.deck = d;
    for (let i = 0; i < 5 && S.deck.length > 0; ++i) {
      S.playerHand.push(S.deck.pop());
      if (S._host) S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, 200 + i * 60, 340, i * 0.1);
    }
    for (let i = 0; i < 5 && S.deck.length > 0; ++i)
      S.aiHands[0].push(S.deck.pop());
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'number' ? -1 : 1;
      return a.value - b.value;
    });
  }

  Object.assign(V, { canPlaySkipBo, skipBoDiscardTo, skipBoPlayToBuild, autoEndTurn, sortHand, setupSkipBo });

})();
