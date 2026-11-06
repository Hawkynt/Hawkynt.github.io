/* Doppelkopf - computer opponents' card choice. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;

  /* trumps from the Q of diamonds upwards are strong enough to hold most tricks */
  const STRONG_TRUMP = 100 + 9;

  function pickBy(hand, indices, score) {
    let best = indices[0];
    let bestScore = score(hand[best]);
    for (let i = 1; i < indices.length; ++i) {
      const s = score(hand[indices[i]]);
      if (s < bestScore) {
        best = indices[i];
        bestScore = s;
      }
    }
    return best;
  }

  /* cheapest card to throw away: fewest points, then weakest */
  function lowestIdx(hand, indices) {
    return pickBy(hand, indices, c => V.cardPoints(c) * 1000 + V.cardStrength(c));
  }

  /* card to smear onto a partner's trick: most points without wasting high trumps */
  function smearIdx(hand, indices) {
    const pool = indices.filter(i => !V.isTrump(hand[i]) || V.cardStrength(hand[i]) < 100 + 5);
    const list = pool.length ? pool : indices;
    return pickBy(hand, list, c => -V.cardPoints(c) * 1000 + V.cardStrength(c));
  }

  function chooseLead(p, hand, legal) {
    const trumps = legal.filter(i => V.isTrump(hand[i]));
    const isRe = S.re[p];

    if (isRe && trumps.length) {
      /* Re pulls trumps: lead a top trump that holds, else a cheap one (never the fox) */
      let top = trumps[0];
      for (let i = 1; i < trumps.length; ++i)
        if (V.cardStrength(hand[trumps[i]]) > V.cardStrength(hand[top]))
          top = trumps[i];
      if (V.cardStrength(hand[top]) >= 100 + 12)
        return top;
      const cheap = trumps.filter(i => !V.isFox(hand[i]));
      return lowestIdx(hand, cheap.length ? cheap : trumps);
    }

    /* plain aces are good leads while the suit has not been played */
    const plain = legal.filter(i => !V.isTrump(hand[i]));
    for (let k = 0; k < plain.length; ++k) {
      const c = hand[plain[k]];
      if (c.rank === 'A' && !suitPlayedBefore(c.suit))
        return plain[k];
    }
    if (plain.length)
      return lowestIdx(hand, plain);
    return lowestIdx(hand, legal);
  }

  function suitPlayedBefore(suit) {
    for (let t = 0; t < S.tricks.length; ++t) {
      const led = S.tricks[t].cards[0];
      if (!V.isTrump(led) && led.suit === suit)
        return true;
    }
    return false;
  }

  function chooseFollow(p, hand, legal) {
    const trick = S.trickCards;
    const wi = V.winningIndex(trick);
    const winCard = trick[wi];
    const winPlayer = S.trickPlayers[wi];
    const isLast = trick.length === 3;
    const rel = V.teamRelation(p, winPlayer);
    const trickPts = V.sumPoints(trick);

    if (rel === 'same') {
      const holds = isLast || V.cardStrength(winCard) >= STRONG_TRUMP || (!V.isTrump(winCard) && winCard.rank === 'A' && !suitPlayedBefore(winCard.suit) && trick.length >= 2);
      if (holds)
        return smearIdx(hand, legal);
      return lowestIdx(hand, legal);
    }

    const winners = legal.filter(i => V.beats(hand[i], winCard));
    if (winners.length) {
      /* cheapest winning card; on the last seat a winner with points is welcome */
      const cheapest = isLast
        ? pickBy(hand, winners, c => V.cardStrength(c) - V.cardPoints(c) * 2)
        : pickBy(hand, winners, c => V.cardStrength(c));
      const c = hand[cheapest];
      const tooValuable = !isLast && trickPts < 10 && V.cardStrength(c) >= 100 + 12;
      if (!tooValuable && !(V.isFox(c) && !isLast))
        return cheapest;
    }
    return lowestIdx(hand, legal);
  }

  /* index into the player's hand of the card to play */
  function aiChooseCard(p) {
    const hand = S.hands[p];
    if (!hand.length)
      return -1;
    const legal = V.validIndices(hand, S.trickCards);
    if (!legal.length)
      return -1;
    if (S.trickCards.length === 0)
      return chooseLead(p, hand, legal);
    return chooseFollow(p, hand, legal);
  }

  Object.assign(V, { aiChooseCard });

})();
