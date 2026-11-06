/* Phase 10 opponents: phase-aware draw choice, laying the phase, hitting and discarding. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;
  const { NUM_PLAYERS, PHASES } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiCardUsefulForPhase(card, phaseIdx) {
    if (card.type === 'wild') return true;
    const ph = PHASES[phaseIdx];
    for (const g of ph.groups) {
      if (g.type === 'set') return true; // any number can form sets
      if (g.type === 'run') return true;
      if (g.type === 'color') return true;
    }
    return false;
  }

  function aiTryLayPhase(p) {
    const phaseIdx = S.playerPhases[p];
    if (phaseIdx >= 10 || S.laidPhases[p].length > 0) return false;
    const ph = PHASES[phaseIdx];
    const result = V.tryMatchPhase(S.hands[p], ph);
    if (!result) return false;
    V.layPhase(p, result);
    return true;
  }

  function aiTryHit(p) {
    if (S.laidPhases[p].length === 0) return false;
    for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
      if (S.laidPhases[tp].length === 0) continue;
      const phIdx = S.playerPhases[tp];
      const ph = PHASES[phIdx];
      for (let gi = 0; gi < S.laidPhases[tp].length; ++gi) {
        const gDef = ph.groups[gi] || ph.groups[0];
        for (let hi = 0; hi < S.hands[p].length; ++hi) {
          if (V.canHitOnGroup(S.hands[p][hi], S.laidPhases[tp][gi], gDef)) {
            V.hitOnGroup(p, hi, tp, gi);
            return true;
          }
        }
      }
    }
    return false;
  }

  function aiBestDiscard(p) {
    const phIdx = S.playerPhases[p];
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < S.hands[p].length; ++i) {
      const c = S.hands[p][i];
      const pts = V.cardPoints(c);
      let useful = 0;
      // Prefer discarding skip cards toward the player closest to winning
      if (c.type === 'skip') useful = -5;
      if (c.type === 'wild') useful = 100; // never discard wilds if possible
      if (pts - useful > bestScore) {
        bestScore = pts - useful;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldDrawDiscard(p) {
    if (S.discardPile.length === 0) return false;
    const top = S.discardPile[S.discardPile.length - 1];
    if (top.type === 'wild') return true;
    // Check if it helps complete current phase
    const phIdx = S.playerPhases[p];
    const ph = PHASES[phIdx];
    // Simple heuristic: if the card matches numbers already in hand
    let matchCount = 0;
    for (const c of S.hands[p])
      if (c.type !== 'wild' && c.type !== 'skip' && c.number === top.number) ++matchCount;
    if (matchCount >= 2) return true;
    // Check for run adjacency
    for (const c of S.hands[p])
      if (c.type === 'number' && c.number !== top.number && Math.abs(c.number - top.number) === 1) ++matchCount;
    return matchCount >= 3;
  }

  function aiPlayTurn(p) {
    switch (S.aiSubStep) {
      case 0: // Draw
        if (aiShouldDrawDiscard(p))
          V.drawFromDiscard(p);
        else
          V.drawFromStock(p);
        ++S.aiSubStep;
        break;
      case 1: // Try lay phase
        aiTryLayPhase(p);
        ++S.aiSubStep;
        break;
      case 2: // Try hits
        if (S.laidPhases[p].length > 0) {
          let hitSomething = true;
          while (hitSomething && S.hands[p].length > 1)
            hitSomething = aiTryHit(p);
        }
        ++S.aiSubStep;
        break;
      case 3: { // Discard
        const idx = aiBestDiscard(p);
        V.discardCard(p, idx);
        S.aiSubStep = 0;
        break;
      }
    }
  }

  Object.assign(V, { aiPlayTurn });

})();
