/* Cassino: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.cassino;
  const S = V.S;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const CAPTURE_VALUES = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13
  };

  /* ================================================================
     BUILD OBJECT
     A build is a stack of cards on the table with a declared sum.
     { isBuild: true, cards: [...], value: N, owner: 0|1 }
     ================================================================ */

  function makeBuild(cards, value, owner) {
    return { isBuild: true, cards, value, owner, faceUp: true };
  }

  function isBuild(item) {
    return item && item.isBuild === true;
  }

  /* ================================================================
     CARD VALUE HELPERS
     ================================================================ */

  function captureValue(card) {
    if (isBuild(card)) return card.value;
    return CAPTURE_VALUES[card.rank] || 0;
  }

  function isAce(card) {
    return !isBuild(card) && card.rank === 'A';
  }

  function isBigCassino(card) {
    return !isBuild(card) && card.rank === '10' && card.suit === 'diamonds';
  }

  function isLittleCassino(card) {
    return !isBuild(card) && card.rank === '2' && card.suit === 'spades';
  }

  function isSpade(card) {
    return !isBuild(card) && card.suit === 'spades';
  }

  /* ================================================================
     CAPTURE LOGIC
     Find all valid capture combinations from table items matching
     a given target value. Each combo is an array of table indices.
     A build can only be captured as a whole (single index).
     ================================================================ */

  function findCaptureCombinations(targetVal, tableItems) {
    const results = [];
    const n = tableItems.length;

    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = 0;
      const idxs = [];
      for (let b = 0; b < n; ++b) {
        if (mask & (1 << b)) {
          sum += captureValue(tableItems[b]);
          idxs.push(b);
        }
      }
      if (sum === targetVal)
        results.push(idxs);
    }

    return results;
  }

  function canCapture(card) {
    return findCaptureCombinations(captureValue(card), S.table).length > 0;
  }

  function selectedTableSum() {
    let sum = 0;
    for (const idx of S.selectedTableIdxs)
      sum += captureValue(S.table[idx]);
    return sum;
  }

  /* ================================================================
     BUILD LOGIC
     Can the player combine their card with selected table items
     to form a build, if they hold a card matching the build value?
     ================================================================ */

  function canBuildWith(handCard, tableIdxs, hand) {
    if (tableIdxs.length === 0) return false;
    let sum = captureValue(handCard);
    for (const idx of tableIdxs)
      sum += captureValue(S.table[idx]);
    if (sum > 13) return false;

    // Player must hold another card with this value (not the card being played)
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (c === handCard) continue;
      if (captureValue(c) === sum) return true;
    }
    return false;
  }

  function findPossibleBuilds(handCard, hand) {
    const results = [];
    const n = S.table.length;
    const cardVal = captureValue(handCard);

    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = cardVal;
      const idxs = [];
      for (let b = 0; b < n; ++b) {
        if (mask & (1 << b)) {
          sum += captureValue(S.table[b]);
          idxs.push(b);
        }
      }
      if (sum > 13 || sum <= cardVal) continue;

      // Must hold another card matching the build value
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        if (c === handCard) continue;
        if (captureValue(c) === sum) {
          results.push({ tableIdxs: idxs, buildValue: sum });
          break;
        }
      }
    }
    return results;
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countSpades(captures) {
    let n = 0;
    for (const c of captures)
      if (c.suit === 'spades') ++n;
    return n;
  }

  function countAces(captures) {
    let n = 0;
    for (const c of captures)
      if (c.rank === 'A') ++n;
    return n;
  }

  function hasBigCassino(captures) {
    for (const c of captures)
      if (c.rank === '10' && c.suit === 'diamonds') return true;
    return false;
  }

  function hasLittleCassino(captures) {
    for (const c of captures)
      if (c.rank === '2' && c.suit === 'spades') return true;
    return false;
  }

  function scoreRound() {
    let pPts = 0;
    let aPts = 0;
    const details = { player: {}, ai: {} };

    // Most cards (27+)
    details.player.cards = S.playerCaptures.length;
    details.ai.cards = S.aiCaptures.length;
    if (S.playerCaptures.length > 26) ++pPts;
    if (S.aiCaptures.length > 26) ++aPts;
    details.player.cardsWin = S.playerCaptures.length > 26;
    details.ai.cardsWin = S.aiCaptures.length > 26;

    // Most spades (7+)
    const pSpades = countSpades(S.playerCaptures);
    const aSpades = countSpades(S.aiCaptures);
    details.player.spades = pSpades;
    details.ai.spades = aSpades;
    if (pSpades > aSpades) ++pPts;
    else if (aSpades > pSpades) ++aPts;
    details.player.spadesWin = pSpades > aSpades;
    details.ai.spadesWin = aSpades > pSpades;

    // Big Cassino (10 of diamonds) = 2pts
    const pBig = hasBigCassino(S.playerCaptures);
    const aBig = hasBigCassino(S.aiCaptures);
    if (pBig) pPts += 2;
    if (aBig) aPts += 2;
    details.player.bigCassino = pBig;
    details.ai.bigCassino = aBig;

    // Little Cassino (2 of spades) = 1pt
    const pLittle = hasLittleCassino(S.playerCaptures);
    const aLittle = hasLittleCassino(S.aiCaptures);
    if (pLittle) ++pPts;
    if (aLittle) ++aPts;
    details.player.littleCassino = pLittle;
    details.ai.littleCassino = aLittle;

    // Aces = 1pt each
    const pAces = countAces(S.playerCaptures);
    const aAces = countAces(S.aiCaptures);
    pPts += pAces;
    aPts += aAces;
    details.player.aces = pAces;
    details.ai.aces = aAces;

    // Sweeps
    pPts += S.playerSweeps;
    aPts += S.aiSweeps;
    details.player.sweeps = S.playerSweeps;
    details.ai.sweeps = S.aiSweeps;

    details.player.total = pPts;
    details.ai.total = aPts;
    return details;
  }

  /* ================================================================
     BUTTON STATE HELPERS
     ================================================================ */

  function canPlayerCapture() {
    if (S.selectedHandIdx < 0) return false;
    const card = S.playerHand[S.selectedHandIdx];
    const cardVal = captureValue(card);
    const sum = selectedTableSum();
    return sum === cardVal && S.selectedTableIdxs.length > 0;
  }

  function canPlayerBuild() {
    if (S.selectedHandIdx < 0 || S.selectedTableIdxs.length === 0) return false;
    return canBuildWith(S.playerHand[S.selectedHandIdx], S.selectedTableIdxs, S.playerHand);
  }

  function canPlayerTrail() {
    if (S.selectedHandIdx < 0) return false;
    // Cannot trail if you own a build on the table
    for (const item of S.table)
      if (isBuild(item) && item.owner === 0) return false;
    return true;
  }

  function buildValueForSelection() {
    if (S.selectedHandIdx < 0) return 0;
    let sum = captureValue(S.playerHand[S.selectedHandIdx]);
    for (const idx of S.selectedTableIdxs)
      sum += captureValue(S.table[idx]);
    return sum;
  }

  V.makeBuild = makeBuild;
  V.isBuild = isBuild;
  V.captureValue = captureValue;
  V.isAce = isAce;
  V.isBigCassino = isBigCassino;
  V.isLittleCassino = isLittleCassino;
  V.isSpade = isSpade;
  V.findCaptureCombinations = findCaptureCombinations;
  V.canCapture = canCapture;
  V.selectedTableSum = selectedTableSum;
  V.findPossibleBuilds = findPossibleBuilds;
  V.scoreRound = scoreRound;
  V.canPlayerCapture = canPlayerCapture;
  V.canPlayerBuild = canPlayerBuild;
  V.canPlayerTrail = canPlayerTrail;
  V.buildValueForSelection = buildValueForSelection;

})();
