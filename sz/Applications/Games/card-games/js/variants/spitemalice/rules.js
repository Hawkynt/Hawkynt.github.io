/* Spite & Malice: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, RANK_ORDER, CW, CH, CENTER_Y, CENTER_X0, CENTER_GAP } = V;

  function rankIndex(card) {
    if (card.isJoker) return -1;
    return RANK_ORDER.indexOf(card.rank);
  }

  function neededRank(pile) {
    if (pile.length === 0) return 0; // need Ace (index 0)
    return pile.length; // pile has N cards, need index N
  }

  function canPlayOn(card, centerPile) {
    const needed = neededRank(centerPile);
    if (needed > 12) return false; // pile is full (shouldn't happen, cleared at 13)
    if (card.isJoker) return true;
    return rankIndex(card) === needed;
  }

  /* ── Deck creation (2 standard decks + 4 jokers = 108) ── */
  function createSpiteDeck() {
    const d = [];
    for (let i = 0; i < 2; ++i)
      for (const suit of CE.SUITS)
        for (const rank of CE.RANKS)
          d.push(CE.makeCard(suit, rank));
    for (let i = 0; i < 4; ++i)
      d.push({ suit: 'joker', rank: 'JOKER', value: -1, faceUp: false, color: 'purple', isJoker: true });
    return d;
  }

  function topCard(pile) {
    return pile.length > 0 ? pile[pile.length - 1] : null;
  }

  function playToCenter(card, centerIdx) {
    S.centerPiles[centerIdx].push(card);
    if (S.centerPiles[centerIdx].length >= 13) {
      // Completed pile -- shuffle back into stock
      const cleared = S.centerPiles[centerIdx].splice(0);
      S.stock.push(...CE.shuffle(cleared));
      if (S._host) S._host.floatingText.add(CENTER_X0 + centerIdx * CENTER_GAP + CW / 2, CENTER_Y + CH / 2, 'Cleared!', { color: '#ff0', size: 14 });
    }
  }

  function checkWin(playerIdx) {
    if (S.payoff[playerIdx].length === 0) {
      S.roundOver = true;
      if (playerIdx === 0) {
        S.score += 100;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.onScoreChanged(S.score);
        }
      } else {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI WINS!', { color: '#f44', size: 28 });
      }
      return true;
    }
    return false;
  }

  function getSelectedCard() {
    if (!S.selectedSource) return null;
    if (S.selectedSource.type === 'hand')
      return S.hands[0][S.selectedSource.index] || null;
    if (S.selectedSource.type === 'payoff')
      return topCard(S.payoff[0]);
    if (S.selectedSource.type === 'side')
      return topCard(S.sideStacks[0][S.selectedSource.index]);
    return null;
  }

  function removeSelectedCard() {
    if (!S.selectedSource) return;
    if (S.selectedSource.type === 'hand')
      S.hands[0].splice(S.selectedSource.index, 1);
    else if (S.selectedSource.type === 'payoff')
      S.payoff[0].pop();
    else if (S.selectedSource.type === 'side')
      S.sideStacks[0][S.selectedSource.index].pop();
    S.selectedSource = null;
  }

  Object.assign(V, { rankIndex, canPlayOn, createSpiteDeck, topCard, playToCenter, checkWin,
    getSelectedCard, removeSelectedCard });

})();
