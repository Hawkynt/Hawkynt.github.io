/* Skat - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const { RANK_VALUES } = V;

  function aiEvalHand(hand) {
    let val = 0;
    for (const c of hand) {
      val += RANK_VALUES[c.rank];
      if (c.rank === 'J') val += 5;
    }
    return val;
  }

  function skatAiPlay(playerIdx) {
    const hand = S.skatHands[playerIdx];
    if (hand.length === 0) return;
    const leadSuit = S.trickCards.length > 0 ? V.effectiveSuit(S.trickCards[0]) : null;
    const valid = [];
    for (let i = 0; i < hand.length; ++i) {
      if (V.skatIsValid(hand[i], leadSuit, hand))
        valid.push(i);
    }
    if (valid.length === 0) return;
    // Simple AI: play lowest valid card
    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    const idx = valid[0];
    const card = hand.splice(idx, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);
  }

  Object.assign(V, {
    aiEvalHand, skatAiPlay
  });

})();
