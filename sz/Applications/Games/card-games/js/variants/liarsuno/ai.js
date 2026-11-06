/* Liar's Uno: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['liarsuno'];
  const S = V.S;
  const { UNO_COLORS, NUM_PLAYERS, AI_TURN_DELAY, CHALLENGE_WINDOW } = V;
  const SH = SZ.CardGames.shared.sheddingHand;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function aiShouldBluff(playerIndex) {
    const hand = S.hands[playerIndex];
    let legalCount = 0;
    for (const c of hand)
      if (V.isLegalPlay(c)) ++legalCount;
    // More likely to bluff when stuck
    if (legalCount === 0) return Math.random() < 0.7;
    if (legalCount <= 1) return Math.random() < 0.2;
    return Math.random() < 0.08;
  }

  function aiShouldChallenge(info) {
    if (!info.faceDown) return false;
    // More suspicious if claimed high-value (Wild Draw Four)
    if (info.claimedValue === 'Wild Draw Four') return Math.random() < 0.4;
    if (info.claimedValue === 'Draw Two') return Math.random() < 0.25;
    return Math.random() < 0.15;
  }

  function aiPickBluffClaim(playerIndex) {
    // Pick a plausible claim that matches the current state
    const claimedColor = S.currentColor || UNO_COLORS[(Math.random() * 4) | 0];
    const top = S.discardPile[S.discardPile.length - 1];
    // Claim a matching color card with a random number
    const possibleValues = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw Two'];
    const claimedValue = possibleValues[(Math.random() * possibleValues.length) | 0];
    return { claimedColor, claimedValue };
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver) return;
    if (S.challengePhase) {
      // AI decides whether to challenge
      if (S.lastPlayInfo && S.lastPlayInfo.player !== S.currentPlayer) {
        // Each AI after the player can challenge during challenge phase
        for (let p = 1; p < NUM_PLAYERS; ++p) {
          if (p === S.lastPlayInfo.player || PL.isFinished(S, p)) continue;
          if (aiShouldChallenge(S.lastPlayInfo)) {
            V.doChallenge(p);
            return;
          }
        }
      }
      // No challenge — finish turn
      V.finishTurn();
      return;
    }

    const hand = S.hands[S.currentPlayer];

    // Decide bluff or honest play
    if (aiShouldBluff(S.currentPlayer)) {
      // Pick any card, claim something plausible
      const idx = (Math.random() * hand.length) | 0;
      const claim = aiPickBluffClaim(S.currentPlayer);
      V.doPlay(S.currentPlayer, idx, true, claim.claimedColor, claim.claimedValue);
      return;
    }

    // Honest play — find legal card
    // Prefer non-wild first
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type !== 'wild' && V.isLegalPlay(hand[i])) {
        V.doPlay(S.currentPlayer, i, false, hand[i].color, hand[i].value);
        return;
      }
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type === 'wild') {
        const chosen = aiChooseColor();
        V.doPlay(S.currentPlayer, i, false, chosen, hand[i].value);
        return;
      }

    // No legal play — must bluff or draw
    if (Math.random() < 0.5 && hand.length > 0) {
      const idx = (Math.random() * hand.length) | 0;
      const claim = aiPickBluffClaim(S.currentPlayer);
      V.doPlay(S.currentPlayer, idx, true, claim.claimedColor, claim.claimedValue);
    } else {
      SH.refillDeck(S);
      if (S.deck.length > 0) hand.push(S.deck.pop());
      V.nextPlayer();
    }
  }

  function aiChooseColor() {
    const hand = S.hands[S.currentPlayer];
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of hand)
      if (c.color !== 'wild' && counts[c.color] !== undefined) ++counts[c.color];
    let best = 'red', bestN = -1;
    for (const c of UNO_COLORS)
      if (counts[c] > bestN) { bestN = counts[c]; best = c; }
    return best;
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver) return;

    // Challenge result display timer
    if (S.challengeResult) {
      S.challengeResult.timer -= dt;
      if (S.challengeResult.timer <= 0)
        S.challengeResult = null;
    }

    // Challenge phase timer
    if (S.challengePhase && S.lastPlayInfo) {
      S.challengeTimer += dt;
      if (S.challengeTimer >= PL.aiDelay(S, CHALLENGE_WINDOW)) {
        // Time's up — no challenge
        if (S.currentPlayer !== 0 || S.lastPlayInfo.player === 0) {
          // AI challenge decision already happened or human didn't challenge
          V.finishTurn();
        } else if (S.lastPlayInfo.player !== 0) {
          // Human's chance expired
          V.finishTurn();
        }
      }
      return;
    }

    if (S.currentPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= PL.aiDelay(S, AI_TURN_DELAY)) { S.aiTurnTimer = 0; aiTurn(); }
    }
  }

  Object.assign(V, { tick, aiTurn });

})();
