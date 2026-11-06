/* Piquet: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const hasSuit = SZ.CardGames.shared.euroCards.hasSuit;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { RANK_ORDER } = V;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const PIQUET_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const RANK_PIP = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  /* Sequence bonus scoring */
  const SEQUENCE_SCORE = {
    3: 3,   // tierce
    4: 4,   // quart
    5: 15,  // quint
    6: 16,  // sixième
    7: 17,  // septième
    8: 18   // huitième
  };

  /* ================================================================
     DECK CREATION (32-card Piquet deck)
     ================================================================ */

  function createPiquetDeck() {
    return CE.createDeckFromRanks(CE.SUITS, PIQUET_RANKS);
  }

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank];
  }

  function cardPip(card) {
    return RANK_PIP[card.rank];
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
  }

  function getCardsOfSuit(hand, suit) {
    return hand.filter(c => c.suit === suit);
  }

  function elder() {
    return S.dealer === 1 ? 0 : 1;
  }

  function younger() {
    return S.dealer;
  }

  /* ================================================================
     DECLARATION SCORING - POINT
     ================================================================ */

  function computePoint(hand) {
    let bestCount = 0;
    let bestPipTotal = 0;
    for (const suit of CE.SUITS) {
      const cards = getCardsOfSuit(hand, suit);
      const count = cards.length;
      if (count > bestCount || (count === bestCount && sumPips(cards) > bestPipTotal)) {
        bestCount = count;
        bestPipTotal = sumPips(cards);
      }
    }
    return { count: bestCount, pipTotal: bestPipTotal };
  }

  function sumPips(cards) {
    let total = 0;
    for (const c of cards)
      total += cardPip(c);
    return total;
  }

  /* ================================================================
     DECLARATION SCORING - SEQUENCE
     ================================================================ */

  function computeBestSequence(hand) {
    let bestLen = 0;
    let bestTopRank = -1;
    let allSequences = [];

    for (const suit of CE.SUITS) {
      const cards = getCardsOfSuit(hand, suit);
      if (cards.length < 3) continue;
      const sorted = cards.slice().sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);

      let runStart = 0;
      for (let i = 1; i <= sorted.length; ++i) {
        if (i < sorted.length && RANK_ORDER[sorted[i].rank] === RANK_ORDER[sorted[i - 1].rank] + 1)
          continue;
        const runLen = i - runStart;
        if (runLen >= 3) {
          const topRank = RANK_ORDER[sorted[i - 1].rank];
          allSequences.push({ length: runLen, topRank, suit });
          if (runLen > bestLen || (runLen === bestLen && topRank > bestTopRank)) {
            bestLen = runLen;
            bestTopRank = topRank;
          }
        }
        runStart = i;
      }
    }

    return { bestLen, bestTopRank, allSequences };
  }

  function sequenceScore(len) {
    return SEQUENCE_SCORE[len] || len;
  }

  /* ================================================================
     DECLARATION SCORING - SET
     ================================================================ */

  function computeBestSet(hand) {
    // Only 10s, Js, Qs, Ks, As qualify
    const qualifyingRanks = ['10', 'J', 'Q', 'K', 'A'];
    let bestKind = 0;
    let bestRankOrd = -1;
    let allSets = [];

    for (const rank of qualifyingRanks) {
      const count = hand.filter(c => c.rank === rank).length;
      if (count >= 3) {
        allSets.push({ rank, count });
        if (count > bestKind || (count === bestKind && RANK_ORDER[rank] > bestRankOrd)) {
          bestKind = count;
          bestRankOrd = RANK_ORDER[rank];
        }
      }
    }

    return { bestKind, bestRankOrd, allSets };
  }

  function setScore(kind) {
    return kind === 4 ? 14 : 3;
  }

  /* ================================================================
     FULL DECLARATION COMPARISON
     ================================================================ */

  function resolveDeclarations() {
    S.declResults = [];
    S.playerDeclScore = 0;
    S.aiDeclScore = 0;

    // --- POINT ---
    const pPoint = computePoint(S.playerHand);
    const aPoint = computePoint(S.aiHand);
    let pointWinner = 'none';
    let pointMsg = '';

    if (pPoint.count > aPoint.count) {
      pointWinner = 'player';
      S.playerDeclScore += pPoint.count;
      pointMsg = 'You win Point (' + pPoint.count + ' cards) = +' + pPoint.count;
    } else if (aPoint.count > pPoint.count) {
      pointWinner = 'ai';
      S.aiDeclScore += aPoint.count;
      pointMsg = 'AI wins Point (' + aPoint.count + ' cards) = +' + aPoint.count;
    } else {
      // Tie in count: compare pip totals
      if (pPoint.pipTotal > aPoint.pipTotal) {
        pointWinner = 'player';
        S.playerDeclScore += pPoint.count;
        pointMsg = 'You win Point on pips (' + pPoint.count + ') = +' + pPoint.count;
      } else if (aPoint.pipTotal > pPoint.pipTotal) {
        pointWinner = 'ai';
        S.aiDeclScore += aPoint.count;
        pointMsg = 'AI wins Point on pips (' + aPoint.count + ') = +' + aPoint.count;
      } else {
        pointMsg = 'Point is tied - no score';
      }
    }
    S.declResults.push({ phase: 'Point', msg: pointMsg, winner: pointWinner });

    // --- SEQUENCE ---
    const pSeq = computeBestSequence(S.playerHand);
    const aSeq = computeBestSequence(S.aiHand);
    let seqWinner = 'none';
    let seqMsg = '';

    if (pSeq.bestLen >= 3 || aSeq.bestLen >= 3) {
      if (pSeq.bestLen > aSeq.bestLen) {
        seqWinner = 'player';
      } else if (aSeq.bestLen > pSeq.bestLen) {
        seqWinner = 'ai';
      } else {
        // Tie in length: compare top card rank
        if (pSeq.bestTopRank > aSeq.bestTopRank)
          seqWinner = 'player';
        else if (aSeq.bestTopRank > pSeq.bestTopRank)
          seqWinner = 'ai';
        // else: tied, no score
      }

      if (seqWinner === 'player') {
        let pts = 0;
        for (const s of pSeq.allSequences)
          pts += sequenceScore(s.length);
        S.playerDeclScore += pts;
        seqMsg = 'You win Sequence (run of ' + pSeq.bestLen + ') = +' + pts;
      } else if (seqWinner === 'ai') {
        let pts = 0;
        for (const s of aSeq.allSequences)
          pts += sequenceScore(s.length);
        S.aiDeclScore += pts;
        seqMsg = 'AI wins Sequence (run of ' + aSeq.bestLen + ') = +' + pts;
      } else {
        seqMsg = 'Sequence is tied - no score';
      }
    } else {
      seqMsg = 'No sequences declared';
    }
    S.declResults.push({ phase: 'Sequence', msg: seqMsg, winner: seqWinner });

    // --- SET ---
    const pSet = computeBestSet(S.playerHand);
    const aSet = computeBestSet(S.aiHand);
    let setWinner = 'none';
    let setMsg = '';

    if (pSet.bestKind >= 3 || aSet.bestKind >= 3) {
      if (pSet.bestKind > aSet.bestKind) {
        setWinner = 'player';
      } else if (aSet.bestKind > pSet.bestKind) {
        setWinner = 'ai';
      } else {
        // Same kind count: compare rank
        if (pSet.bestRankOrd > aSet.bestRankOrd)
          setWinner = 'player';
        else if (aSet.bestRankOrd > pSet.bestRankOrd)
          setWinner = 'ai';
      }

      if (setWinner === 'player') {
        let pts = 0;
        for (const s of pSet.allSets)
          pts += setScore(s.count);
        S.playerDeclScore += pts;
        setMsg = 'You win Set (' + pSet.bestKind + '-of-a-kind) = +' + pts;
      } else if (setWinner === 'ai') {
        let pts = 0;
        for (const s of aSet.allSets)
          pts += setScore(s.count);
        S.aiDeclScore += pts;
        setMsg = 'AI wins Set (' + aSet.bestKind + '-of-a-kind) = +' + pts;
      } else {
        setMsg = 'Set is tied - no score';
      }
    } else {
      setMsg = 'No sets declared';
    }
    S.declResults.push({ phase: 'Set', msg: setMsg, winner: setWinner });

    // --- REPIQUE / PIQUE ---
    // Repique: 30+ from declarations alone before opponent scores any declaration pts
    if (S.playerDeclScore >= 30 && S.aiDeclScore === 0) {
      S.playerDeclScore += 60;
      S.declResults.push({ phase: 'Bonus', msg: 'REPIQUE! You score +60 bonus', winner: 'player' });
    } else if (S.aiDeclScore >= 30 && S.playerDeclScore === 0) {
      S.aiDeclScore += 60;
      S.declResults.push({ phase: 'Bonus', msg: 'REPIQUE! AI scores +60 bonus', winner: 'ai' });
    }

    S.playerPointsBeforeTricks = S.playerDeclScore;
    S.aiPointsBeforeTricks = S.aiDeclScore;
  }

  /* ================================================================
     TRICK PLAY RULES
     ================================================================ */

  function isValidPlay(card, hand) {
    if (S.trickCards.length === 0) return true;
    const leadSuit = S.trickCards[0].card.suit;
    if (hasSuit(hand, leadSuit))
      return card.suit === leadSuit;
    return true; // No trumps in Piquet, can play anything if void
  }

  function getValidIndices(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i)
        valid.push(i);
    return valid;
  }

  function determineTrickWinner() {
    const leadSuit = S.trickCards[0].card.suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0].card);
    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i].card;
      if (c.suit === leadSuit && cardStrength(c) > bestStr) {
        bestIdx = i;
        bestStr = cardStrength(c);
      }
    }
    return S.trickCards[bestIdx].player;
  }

  function isDiscardCandidate(idx) {
    // Hint: suggest discarding low-value cards not part of long suits or sequences
    const card = S.playerHand[idx];
    const suitLen = getCardsOfSuit(S.playerHand, card.suit).length;
    if (suitLen >= 5) return false; // Keep long suit cards
    if (RANK_ORDER[card.rank] >= RANK_ORDER['Q']) return false; // Keep high cards
    return RANK_ORDER[card.rank] <= RANK_ORDER['9'];
  }

  V.createPiquetDeck = createPiquetDeck;
  V.cardStrength = cardStrength;
  V.sortHand = sortHand;
  V.getCardsOfSuit = getCardsOfSuit;
  V.elder = elder;
  V.resolveDeclarations = resolveDeclarations;
  V.isValidPlay = isValidPlay;
  V.getValidIndices = getValidIndices;
  V.determineTrickWinner = determineTrickWinner;
  V.isDiscardCandidate = isDiscardCandidate;

})();
