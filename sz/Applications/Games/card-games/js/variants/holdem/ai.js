/* Texas Hold'em: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.holdem;
  const S = V.S;
  const { BLUFF_CHANCE } = V;

  function aiDecide(playerIdx) {
    const hole = S.holeCards[playerIdx];
    const myChips = S.chips[playerIdx];
    const toCall = S.currentBet - S.bets[playerIdx];

    let strength = V.holeCardStrength(hole);

    if (S.community.length > 0) {
      const ev = V.evaluateBest(hole, S.community);
      strength = Math.max(strength, ev.rank * 1.5 + 2);
    }

    const potOdds = toCall > 0 ? toCall / (S.pot + toCall) : 0;
    const bluffing = Math.random() < BLUFF_CHANCE;

    if (toCall === 0) {
      if (strength >= 7 || bluffing) {
        const raise = Math.max(S.minRaise, Math.floor(S.pot * (0.3 + strength * 0.08)));
        return { action: 'raise', amount: Math.min(raise, myChips) };
      }
      return { action: 'check' };
    }

    if (toCall >= myChips) {
      if (strength >= 6 || (strength >= 4 && bluffing))
        return { action: 'allin' };
      if (strength >= 3 && potOdds < 0.35)
        return { action: 'allin' };
      return { action: 'fold' };
    }

    if (strength >= 8) {
      const raise = Math.max(S.minRaise, Math.floor(S.pot * 0.6));
      return { action: 'raise', amount: Math.min(toCall + raise, myChips) };
    }

    if (strength >= 5 || bluffing) {
      if (Math.random() < 0.4 && strength >= 6) {
        const raise = Math.max(S.minRaise, Math.floor(S.pot * 0.4));
        return { action: 'raise', amount: Math.min(toCall + raise, myChips) };
      }
      return { action: 'call' };
    }

    if (strength >= 3 && potOdds < 0.3)
      return { action: 'call' };

    return { action: 'fold' };
  }

  Object.assign(V, { aiDecide });

})();
