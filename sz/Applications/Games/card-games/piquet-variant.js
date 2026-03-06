;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const PIQUET_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };
  const RANK_PIP = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const SUIT_SHORT = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  const HAND_SIZE = 12;
  const TALON_SIZE = 8;
  const GAME_WIN_SCORE = 100;
  const ELDER_MAX_EXCHANGE = 5;

  /* Phases */
  const PHASE_EXCHANGE = 0;
  const PHASE_DECLARE_POINT = 1;
  const PHASE_DECLARE_SEQUENCE = 2;
  const PHASE_DECLARE_SET = 3;
  const PHASE_TRICK_PLAY = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_OVER = 6;

  const PHASE_NAMES = [
    'Exchange', 'Declare: Point', 'Declare: Sequence',
    'Declare: Set', 'Trick Play', 'Trick Done', 'Round Over'
  ];

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
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let talon = [];
  let deck = [];
  let trickCards = [];   // [{ card, player }]
  let playerScore = 0;
  let aiScore = 0;
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  let phase = PHASE_EXCHANGE;
  let dealer = 1;  // 0=player, 1=AI; non-dealer (elder) acts first
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCount = 0;
  let playerTricksWon = 0;
  let aiTricksWon = 0;
  let roundNumber = 0;

  /* Declaration tracking */
  let playerDeclScore = 0;
  let aiDeclScore = 0;
  let declResults = [];
  let declPhaseTimer = 0;
  const DECL_DISPLAY_DELAY = 1.8;

  /* Exchange state */
  let selectedIndices = [];
  let exchangeDone = false;
  let aiExchangeDone = false;

  /* Trick done timer */
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.0;
  let trickWinnerLabel = '';

  /* AI timing */
  let aiTimer = 0;
  const AI_DELAY = 0.7;
  let pendingAiAction = false;

  /* Host & canvas refs */
  let _ctx = null;
  let _host = null;

  let hoverCardIdx = -1;
  let resultMsg = '';

  /* Points scored during declarations for pique/repique checks */
  let playerPointsBeforeTricks = 0;
  let aiPointsBeforeTricks = 0;

  /* Points scored during trick play (for lead/capture) */
  let playerTrickPlayPts = 0;
  let aiTrickPlayPts = 0;

  /* Button areas */
  const EXCHANGE_BTN = { x: 370, y: 415, w: 120, h: 30 };
  const CONTINUE_BTN = { x: 370, y: 340, w: 120, h: 30 };

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

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function getCardsOfSuit(hand, suit) {
    return hand.filter(c => c.suit === suit);
  }

  function elder() {
    return dealer === 1 ? 0 : 1;
  }

  function younger() {
    return dealer;
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
    declResults = [];
    playerDeclScore = 0;
    aiDeclScore = 0;

    // --- POINT ---
    const pPoint = computePoint(playerHand);
    const aPoint = computePoint(aiHand);
    let pointWinner = 'none';
    let pointMsg = '';

    if (pPoint.count > aPoint.count) {
      pointWinner = 'player';
      playerDeclScore += pPoint.count;
      pointMsg = 'You win Point (' + pPoint.count + ' cards) = +' + pPoint.count;
    } else if (aPoint.count > pPoint.count) {
      pointWinner = 'ai';
      aiDeclScore += aPoint.count;
      pointMsg = 'AI wins Point (' + aPoint.count + ' cards) = +' + aPoint.count;
    } else {
      // Tie in count: compare pip totals
      if (pPoint.pipTotal > aPoint.pipTotal) {
        pointWinner = 'player';
        playerDeclScore += pPoint.count;
        pointMsg = 'You win Point on pips (' + pPoint.count + ') = +' + pPoint.count;
      } else if (aPoint.pipTotal > pPoint.pipTotal) {
        pointWinner = 'ai';
        aiDeclScore += aPoint.count;
        pointMsg = 'AI wins Point on pips (' + aPoint.count + ') = +' + aPoint.count;
      } else {
        pointMsg = 'Point is tied - no score';
      }
    }
    declResults.push({ phase: 'Point', msg: pointMsg, winner: pointWinner });

    // --- SEQUENCE ---
    const pSeq = computeBestSequence(playerHand);
    const aSeq = computeBestSequence(aiHand);
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
        playerDeclScore += pts;
        seqMsg = 'You win Sequence (run of ' + pSeq.bestLen + ') = +' + pts;
      } else if (seqWinner === 'ai') {
        let pts = 0;
        for (const s of aSeq.allSequences)
          pts += sequenceScore(s.length);
        aiDeclScore += pts;
        seqMsg = 'AI wins Sequence (run of ' + aSeq.bestLen + ') = +' + pts;
      } else {
        seqMsg = 'Sequence is tied - no score';
      }
    } else {
      seqMsg = 'No sequences declared';
    }
    declResults.push({ phase: 'Sequence', msg: seqMsg, winner: seqWinner });

    // --- SET ---
    const pSet = computeBestSet(playerHand);
    const aSet = computeBestSet(aiHand);
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
        playerDeclScore += pts;
        setMsg = 'You win Set (' + pSet.bestKind + '-of-a-kind) = +' + pts;
      } else if (setWinner === 'ai') {
        let pts = 0;
        for (const s of aSet.allSets)
          pts += setScore(s.count);
        aiDeclScore += pts;
        setMsg = 'AI wins Set (' + aSet.bestKind + '-of-a-kind) = +' + pts;
      } else {
        setMsg = 'Set is tied - no score';
      }
    } else {
      setMsg = 'No sets declared';
    }
    declResults.push({ phase: 'Set', msg: setMsg, winner: setWinner });

    // --- REPIQUE / PIQUE ---
    // Repique: 30+ from declarations alone before opponent scores any declaration pts
    if (playerDeclScore >= 30 && aiDeclScore === 0) {
      playerDeclScore += 60;
      declResults.push({ phase: 'Bonus', msg: 'REPIQUE! You score +60 bonus', winner: 'player' });
    } else if (aiDeclScore >= 30 && playerDeclScore === 0) {
      aiDeclScore += 60;
      declResults.push({ phase: 'Bonus', msg: 'REPIQUE! AI scores +60 bonus', winner: 'ai' });
    }

    playerPointsBeforeTricks = playerDeclScore;
    aiPointsBeforeTricks = aiDeclScore;
  }

  /* ================================================================
     TRICK PLAY RULES
     ================================================================ */

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].card.suit;
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
    const leadSuit = trickCards[0].card.suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0].card);
    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i].card;
      if (c.suit === leadSuit && cardStrength(c) > bestStr) {
        bestIdx = i;
        bestStr = cardStrength(c);
      }
    }
    return trickCards[bestIdx].player;
  }

  /* ================================================================
     EXCHANGE LOGIC
     ================================================================ */

  function doPlayerExchange() {
    if (selectedIndices.length < 1) return;
    const elderIsPlayer = elder() === 0;
    const maxExch = elderIsPlayer ? Math.min(ELDER_MAX_EXCHANGE, talon.length) : talon.length;
    if (selectedIndices.length > maxExch) return;

    // Remove selected cards (descending order to preserve indices)
    const sorted = selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted)
      playerHand.splice(idx, 1);

    // Draw from talon
    const drawCount = sorted.length;
    for (let i = 0; i < drawCount && talon.length > 0; ++i) {
      const c = talon.shift();
      c.faceUp = true;
      playerHand.push(c);
    }
    sortHand(playerHand);
    selectedIndices = [];
    exchangeDone = true;

    if (!aiExchangeDone)
      doAiExchange();
    startDeclarations();
  }

  function doAiExchange() {
    const elderIsAi = elder() === 1;
    const maxExch = elderIsAi ? Math.min(ELDER_MAX_EXCHANGE, talon.length) : talon.length;

    // AI strategy: discard weakest cards (lowest rank, avoid breaking long suits)
    const discards = aiChooseDiscards(aiHand, maxExch);
    discards.sort((a, b) => b - a);
    for (const idx of discards)
      aiHand.splice(idx, 1);

    const drawCount = discards.length;
    for (let i = 0; i < drawCount && talon.length > 0; ++i)
      aiHand.push(talon.shift());

    sortHand(aiHand);
    aiExchangeDone = true;
  }

  /* ================================================================
     AI - EXCHANGE STRATEGY
     ================================================================ */

  function aiChooseDiscards(hand, maxDiscard) {
    // Score each card: higher is more valuable, lower gets discarded
    const scores = hand.map((card, idx) => {
      let val = cardStrength(card) * 3;
      // Bonus for cards in long suits
      const suitLen = getCardsOfSuit(hand, card.suit).length;
      val += suitLen * 2;
      // Bonus for high cards that form sets
      const sameRankCount = hand.filter(c => c.rank === card.rank).length;
      if (sameRankCount >= 3 && RANK_ORDER[card.rank] >= RANK_ORDER['10'])
        val += 10;
      // Bonus for cards in sequences
      const suitCards = getCardsOfSuit(hand, card.suit).map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
      const myOrd = RANK_ORDER[card.rank];
      const hasNeighbor = suitCards.some(o => Math.abs(o - myOrd) === 1);
      if (hasNeighbor) val += 4;
      return { idx, val };
    });

    scores.sort((a, b) => a.val - b.val);
    const count = Math.min(maxDiscard, Math.max(1, Math.min(3, maxDiscard)));
    const result = [];
    for (let i = 0; i < count; ++i)
      result.push(scores[i].idx);
    return result;
  }

  /* ================================================================
     AI - TRICK PLAY
     ================================================================ */

  function aiChooseCard() {
    if (aiHand.length === 0) return -1;
    const validIdxs = getValidIndices(aiHand);
    if (validIdxs.length === 1) return validIdxs[0];

    const isLeading = trickCards.length === 0;

    if (isLeading) {
      // Lead from longest suit, highest card
      let bestSuitLen = 0;
      let bestSuit = null;
      for (const suit of CE.SUITS) {
        const count = getCardsOfSuit(aiHand, suit).length;
        if (count > bestSuitLen) {
          bestSuitLen = count;
          bestSuit = suit;
        }
      }
      const suitIdxs = validIdxs.filter(i => aiHand[i].suit === bestSuit);
      if (suitIdxs.length > 0) {
        suitIdxs.sort((a, b) => cardStrength(aiHand[b]) - cardStrength(aiHand[a]));
        return suitIdxs[0];
      }
      validIdxs.sort((a, b) => cardStrength(aiHand[b]) - cardStrength(aiHand[a]));
      return validIdxs[0];
    }

    // Following: try to win with cheapest winning card, otherwise dump lowest
    const leadSuit = trickCards[0].card.suit;
    const leadStr = cardStrength(trickCards[0].card);
    const followIdxs = validIdxs.filter(i => aiHand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      const winners = followIdxs.filter(i => cardStrength(aiHand[i]) > leadStr);
      if (winners.length > 0) {
        winners.sort((a, b) => cardStrength(aiHand[a]) - cardStrength(aiHand[b]));
        return winners[0]; // cheapest winner
      }
      // Can't win, dump lowest
      followIdxs.sort((a, b) => cardStrength(aiHand[a]) - cardStrength(aiHand[b]));
      return followIdxs[0];
    }

    // Void in lead suit: dump lowest
    validIdxs.sort((a, b) => cardStrength(aiHand[a]) - cardStrength(aiHand[b]));
    return validIdxs[0];
  }

  /* ================================================================
     DEAL & SETUP
     ================================================================ */

  function dealRound() {
    deck = CE.shuffle(createPiquetDeck());
    playerHand = [];
    aiHand = [];
    talon = [];
    trickCards = [];
    selectedIndices = [];
    exchangeDone = false;
    aiExchangeDone = false;
    trickCount = 0;
    playerTricksWon = 0;
    aiTricksWon = 0;
    playerDeclScore = 0;
    aiDeclScore = 0;
    playerPointsBeforeTricks = 0;
    aiPointsBeforeTricks = 0;
    playerTrickPlayPts = 0;
    aiTrickPlayPts = 0;
    declResults = [];
    declPhaseTimer = 0;
    trickDoneTimer = 0;
    trickWinnerLabel = '';
    aiTimer = 0;
    pendingAiAction = false;
    hoverCardIdx = -1;
    resultMsg = '';
    roundOver = false;

    // Deal 12 cards each
    for (let i = 0; i < HAND_SIZE; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      const ac = deck.pop();
      ac.faceUp = false;
      aiHand.push(ac);
    }

    // Remaining 8 form the talon
    while (deck.length > 0)
      talon.push(deck.pop());

    sortHand(playerHand);
    sortHand(aiHand);

    phase = PHASE_EXCHANGE;

    // If AI is elder (non-dealer), AI exchanges first
    if (elder() === 1) {
      doAiExchange();
      // Player exchanges as younger after
    }
  }

  function setupGame() {
    playerScore = 0;
    aiScore = 0;
    gameOver = false;
    score = 0;
    roundNumber = 0;
    dealer = 1; // Player is elder (non-dealer) in first round
    dealRound();
  }

  /* ================================================================
     PHASE TRANSITIONS
     ================================================================ */

  function startDeclarations() {
    resolveDeclarations();
    phase = PHASE_DECLARE_POINT;
    declPhaseTimer = DECL_DISPLAY_DELAY;

    if (_host) {
      for (const d of declResults) {
        const color = d.winner === 'player' ? '#4f4' : d.winner === 'ai' ? '#f84' : '#aaa';
        _host.floatingText.add(CANVAS_W / 2, 200, d.msg, { color, size: 14 });
      }
    }
  }

  function advanceDeclarationPhase() {
    if (phase === PHASE_DECLARE_POINT) {
      phase = PHASE_DECLARE_SEQUENCE;
      declPhaseTimer = DECL_DISPLAY_DELAY;
    } else if (phase === PHASE_DECLARE_SEQUENCE) {
      phase = PHASE_DECLARE_SET;
      declPhaseTimer = DECL_DISPLAY_DELAY;
    } else if (phase === PHASE_DECLARE_SET) {
      applyDeclarationScores();
      startTrickPlay();
    }
  }

  function applyDeclarationScores() {
    playerScore += playerDeclScore;
    aiScore += aiDeclScore;
    score = playerScore;
    if (_host) _host.onScoreChanged(score);
    checkGameOver();
  }

  function startTrickPlay() {
    phase = PHASE_TRICK_PLAY;
    trickCards = [];
    // Elder (non-dealer) leads first
    currentTurn = elder();
    trickLeader = elder();
    aiTimer = 0;

    // Check for Pique: 30+ total (decl + leading first trick point) before opponent scores
    // Pique is checked during trick play once a player reaches 30 including trick points
  }

  function playCard(player, cardIdx) {
    const hand = player === 0 ? playerHand : aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    trickCards.push({ card, player });

    if (trickCards.length >= 2) {
      phase = PHASE_TRICK_DONE;
      trickDoneTimer = 0;

      const winner = determineTrickWinner();
      const leaderWon = winner === trickLeader;

      // Score: 1 point for leading to a trick won
      if (winner === 0) {
        ++playerTrickPlayPts;
        if (leaderWon)
          playerTrickPlayPts += 0; // leading point already counted as 1 for winning the trick
      } else {
        ++aiTrickPlayPts;
      }

      trickWinnerLabel = winner === 0 ? 'You take the trick' : 'AI takes the trick';
      return;
    }

    // After first card played, switch to other player
    currentTurn = currentTurn === 0 ? 1 : 0;
  }

  function finishTrick() {
    const winner = determineTrickWinner();
    if (winner === 0)
      ++playerTricksWon;
    else
      ++aiTricksWon;
    ++trickCount;

    // Last trick bonus: +1
    const isLastTrick = trickCount >= HAND_SIZE || (playerHand.length === 0 && aiHand.length === 0);
    if (isLastTrick) {
      if (winner === 0)
        ++playerTrickPlayPts;
      else
        ++aiTrickPlayPts;
    }

    trickCards = [];

    if (isLastTrick) {
      endRound();
      return;
    }

    // Winner leads next trick
    currentTurn = winner;
    trickLeader = winner;
    phase = PHASE_TRICK_PLAY;
    aiTimer = 0;
  }

  function endRound() {
    // Apply trick play points
    playerScore += playerTrickPlayPts;
    aiScore += aiTrickPlayPts;

    // Check Pique (30+ from declarations + trick pts before opponent scores any trick pts)
    // We check the full total: if one side had 29 from decl and scored 1+ trick pt before
    // opponent scored any trick pt, and total >= 30, that's a Pique
    const playerTotal = playerDeclScore + playerTrickPlayPts;
    const aiTotal = aiDeclScore + aiTrickPlayPts;

    // Pique: only if repique was not already awarded (repique is declarations-only)
    const hadRepique = declResults.some(d => d.phase === 'Bonus');
    if (!hadRepique) {
      if (playerTotal >= 30 && aiDeclScore === 0 && aiTrickPlayPts === 0) {
        playerScore += 30;
        declResults.push({ phase: 'Pique', msg: 'PIQUE! You score +30 bonus', winner: 'player' });
        if (_host) _host.floatingText.add(CANVAS_W / 2, 250, 'PIQUE! +30', { color: '#4f4', size: 20 });
      } else if (aiTotal >= 30 && playerDeclScore === 0 && playerTrickPlayPts === 0) {
        aiScore += 30;
        declResults.push({ phase: 'Pique', msg: 'PIQUE! AI scores +30 bonus', winner: 'ai' });
        if (_host) _host.floatingText.add(CANVAS_W / 2, 250, 'AI PIQUE! +30', { color: '#f84', size: 20 });
      }
    }

    // Capot: winning all 12 tricks = +40 bonus
    if (playerTricksWon === HAND_SIZE) {
      playerScore += 40;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 280, 'CAPOT! +40', { color: '#4f4', size: 20 });
    } else if (aiTricksWon === HAND_SIZE) {
      aiScore += 40;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 280, 'AI CAPOT! +40', { color: '#f84', size: 20 });
    }

    score = playerScore;
    if (_host) _host.onScoreChanged(score);

    ++roundNumber;
    roundOver = true;

    // Alternate dealer
    dealer = dealer === 0 ? 1 : 0;

    checkGameOver();
    phase = PHASE_ROUND_OVER;
  }

  function checkGameOver() {
    if (playerScore >= GAME_WIN_SCORE || aiScore >= GAME_WIN_SCORE) {
      gameOver = true;
      roundOver = true;
      if (_host) {
        const won = playerScore >= GAME_WIN_SCORE;
        const msg = won ? 'You win the game!' : 'AI wins the game!';
        const col = won ? '#4f4' : '#f44';
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (won) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
      }
    }
  }

  /* ================================================================
     DRAWING - LAYOUT HELPERS
     ================================================================ */

  const PLAYER_HAND_Y = 465;
  const AI_HAND_Y = 30;

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 160;
    const spacing = Math.min(55, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 195;
    const py = 10;
    const pw = 185;
    const ph = 130;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Piquet', px + 10, py + 6);

    _ctx.font = '11px sans-serif';
    let y = py + 24;

    _ctx.fillStyle = '#8cf';
    _ctx.fillText('You: ' + playerScore, px + 10, y);
    y += 16;

    _ctx.fillStyle = '#f88';
    _ctx.fillText('AI: ' + aiScore, px + 10, y);
    y += 18;

    _ctx.fillStyle = '#ff0';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('First to ' + GAME_WIN_SCORE + ' wins', px + 10, y);
    y += 14;

    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Round ' + (roundNumber + 1), px + 10, y);
    y += 14;

    const dealerLabel = dealer === 0 ? 'You deal' : 'AI deals';
    _ctx.fillText(dealerLabel, px + 10, y);

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - PLAYER HAND
     ================================================================ */

  function drawPlayerHand() {
    const total = playerHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      // Raise selected cards during exchange
      if (phase === PHASE_EXCHANGE && selectedIndices.includes(i))
        y -= 18;

      // Raise hovered card
      if (i === hoverCardIdx && (phase === PHASE_EXCHANGE || (phase === PHASE_TRICK_PLAY && currentTurn === 0)))
        y -= 10;

      CE.drawCardFace(_ctx, x, y, playerHand[i]);

      // Hint glow during exchange
      if (_host && _host.hintsEnabled && phase === PHASE_EXCHANGE && !exchangeDone) {
        if (isDiscardCandidate(i))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      // Hint glow during trick play
      if (_host && _host.hintsEnabled && phase === PHASE_TRICK_PLAY && currentTurn === 0) {
        if (isValidPlay(playerHand[i], playerHand))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      // Dim invalid cards during trick play
      if (phase === PHASE_TRICK_PLAY && currentTurn === 0 && !isValidPlay(playerHand[i], playerHand)) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, 4);
        _ctx.fill();
        _ctx.restore();
      }
    }
  }

  function isDiscardCandidate(idx) {
    // Hint: suggest discarding low-value cards not part of long suits or sequences
    const card = playerHand[idx];
    const suitLen = getCardsOfSuit(playerHand, card.suit).length;
    if (suitLen >= 5) return false; // Keep long suit cards
    if (RANK_ORDER[card.rank] >= RANK_ORDER['Q']) return false; // Keep high cards
    return RANK_ORDER[card.rank] <= RANK_ORDER['9'];
  }

  /* ================================================================
     DRAWING - AI HAND
     ================================================================ */

  function drawAIHand() {
    const count = aiHand.length;
    if (count === 0) return;

    _ctx.fillStyle = (currentTurn === 1 && phase === PHASE_TRICK_PLAY) ? '#ff0' : '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('AI (' + count + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const spacing = Math.min(28, 500 / Math.max(count, 1));
    const totalW = (count - 1) * spacing + CE.CARD_W * 0.55;
    const startX = CANVAS_W / 2 - totalW / 2;
    for (let i = 0; i < count; ++i)
      CE.drawCardBack(_ctx, startX + i * spacing, AI_HAND_Y + 12, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
  }

  /* ================================================================
     DRAWING - TALON
     ================================================================ */

  function drawTalon() {
    if (talon.length === 0) return;
    const tx = 30;
    const ty = 250;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Talon (' + talon.length + ')', tx + CE.CARD_W * 0.3, ty - 4);

    for (let i = 0; i < Math.min(talon.length, 3); ++i)
      CE.drawCardBack(_ctx, tx + i * 3, ty + i * 2, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
  }

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    // Center trick display
    const cx = CANVAS_W / 2;
    const cy = 270;

    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const entry = trickCards[i];
      const yOff = entry.player === 0 ? 30 : -30;
      const xOff = i === 0 ? -40 : 10;
      CE.drawCardFace(_ctx, cx + xOff - CE.CARD_W / 2, cy + yOff - CE.CARD_H / 2, entry.card);
    }

    // Trick count display
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/12  |  You: ' + playerTricksWon + '  AI: ' + aiTricksWon, cx, cy + 65);

    if (phase === PHASE_TRICK_DONE) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(trickWinnerLabel, cx, cy - 65);
    }
  }

  /* ================================================================
     DRAWING - EXCHANGE UI
     ================================================================ */

  function drawExchangeUI() {
    const elderIsPlayer = elder() === 0;
    const maxExch = elderIsPlayer
      ? Math.min(ELDER_MAX_EXCHANGE, talon.length)
      : Math.min(talon.length, talon.length);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Exchange Phase', CANVAS_W / 2, 180);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    const role = elderIsPlayer ? 'You are Elder (non-dealer)' : 'You are Younger (dealer)';
    _ctx.fillText(role, CANVAS_W / 2, 200);

    _ctx.fillStyle = '#ff0';
    _ctx.font = '13px sans-serif';
    _ctx.fillText('Select 1-' + maxExch + ' cards to discard, then click Exchange', CANVAS_W / 2, 220);

    _ctx.fillStyle = '#8cf';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Selected: ' + selectedIndices.length + '/' + maxExch, CANVAS_W / 2, 240);

    // Exchange button
    const canExchange = selectedIndices.length >= 1 && selectedIndices.length <= maxExch;
    const bg = canExchange ? '#1a5a1a' : '#333';
    const border = canExchange ? '#4a4' : '#555';
    CE.drawButton(_ctx, EXCHANGE_BTN.x, EXCHANGE_BTN.y, EXCHANGE_BTN.w, EXCHANGE_BTN.h, 'Exchange', { bg, border, textColor: '#fff', fontSize: 13 });
  }

  /* ================================================================
     DRAWING - DECLARATION UI
     ================================================================ */

  function drawDeclarationUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const px = CANVAS_W / 2 - 220;
    const py = 140;
    const pw = 440;
    const ph = 30 + declResults.length * 28 + 30;

    CE.drawRoundedRect(_ctx, px, py, pw, ph, 8);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Declarations', CANVAS_W / 2, py + 8);

    let y = py + 32;
    const currentPhaseIdx = phase === PHASE_DECLARE_POINT ? 0
      : phase === PHASE_DECLARE_SEQUENCE ? 1
      : 2;

    for (let i = 0; i < declResults.length; ++i) {
      const d = declResults[i];
      const isActive = (d.phase === 'Point' && phase === PHASE_DECLARE_POINT)
        || (d.phase === 'Sequence' && phase === PHASE_DECLARE_SEQUENCE)
        || (d.phase === 'Set' && phase === PHASE_DECLARE_SET)
        || d.phase === 'Bonus';

      // Only show declarations up to current phase
      const declPhaseOrder = { 'Point': 0, 'Sequence': 1, 'Set': 2, 'Bonus': 2 };
      if ((declPhaseOrder[d.phase] || 0) > currentPhaseIdx) continue;

      _ctx.fillStyle = d.winner === 'player' ? '#8cf' : d.winner === 'ai' ? '#f88' : '#aaa';
      _ctx.font = isActive ? 'bold 12px sans-serif' : '12px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(d.msg, px + 16, y);
      y += 24;
    }

    // Totals
    _ctx.fillStyle = '#8cf';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Your decl: +' + playerDeclScore + '  |  AI decl: +' + aiDeclScore, CANVAS_W / 2, y + 4);

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - ROUND OVER UI
     ================================================================ */

  function drawRoundOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    if (gameOver) {
      const won = playerScore >= GAME_WIN_SCORE;
      _ctx.fillStyle = won ? '#4f4' : '#f44';
      _ctx.fillText(won ? 'You Win!' : 'AI Wins!', CANVAS_W / 2, 160);

      _ctx.fillStyle = '#fff';
      _ctx.font = '16px sans-serif';
      _ctx.fillText('You: ' + playerScore + '  |  AI: ' + aiScore, CANVAS_W / 2, 200);

      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to start a new game', CANVAS_W / 2, 240);
    } else {
      _ctx.fillText('Round ' + roundNumber + ' Complete', CANVAS_W / 2, 140);

      let y = 180;
      _ctx.font = '14px sans-serif';

      // Declaration summary
      for (const d of declResults) {
        _ctx.fillStyle = d.winner === 'player' ? '#8cf' : d.winner === 'ai' ? '#f88' : '#aaa';
        _ctx.fillText(d.msg, CANVAS_W / 2, y);
        y += 22;
      }

      y += 8;
      _ctx.fillStyle = '#fff';
      _ctx.font = '13px sans-serif';
      _ctx.fillText('Tricks won - You: ' + playerTricksWon + '  AI: ' + aiTricksWon, CANVAS_W / 2, y);
      y += 20;
      _ctx.fillText('Trick points - You: +' + playerTrickPlayPts + '  AI: +' + aiTrickPlayPts, CANVAS_W / 2, y);
      y += 24;

      if (playerTricksWon === HAND_SIZE) {
        _ctx.fillStyle = '#4f4';
        _ctx.fillText('CAPOT! You win all tricks (+40)', CANVAS_W / 2, y);
        y += 22;
      } else if (aiTricksWon === HAND_SIZE) {
        _ctx.fillStyle = '#f84';
        _ctx.fillText('AI CAPOT! All tricks (+40)', CANVAS_W / 2, y);
        y += 22;
      }

      _ctx.fillStyle = '#8cf';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.fillText('You: ' + playerScore, CANVAS_W / 2 - 80, y);
      _ctx.fillStyle = '#f88';
      _ctx.fillText('AI: ' + aiScore, CANVAS_W / 2 + 80, y);
      y += 30;

      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - STATUS BAR
     ================================================================ */

  function drawStatusBar() {
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.font = '12px sans-serif';

    if (phase === PHASE_TRICK_PLAY) {
      if (currentTurn === 0) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
      } else {
        _ctx.fillStyle = '#aaa';
        _ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (phase === PHASE_EXCHANGE) {
      _ctx.fillStyle = '#8f8';
      _ctx.fillText('Select cards to exchange with the talon', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawAll() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Piquet', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    const elderLabel = elder() === 0 ? 'You' : 'AI';
    _ctx.fillText('Round ' + (roundNumber + 1) + ' \u2014 Elder: ' + elderLabel, 10, 28);

    drawScorePanel();
    drawAIHand();

    if (phase === PHASE_EXCHANGE) {
      drawTalon();
      drawExchangeUI();
    }

    if (phase === PHASE_DECLARE_POINT || phase === PHASE_DECLARE_SEQUENCE || phase === PHASE_DECLARE_SET)
      drawDeclarationUI();

    if (phase === PHASE_TRICK_PLAY || phase === PHASE_TRICK_DONE)
      drawTrickArea();

    drawPlayerHand();
    drawStatusBar();

    if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (phase === PHASE_EXCHANGE && selectedIndices.includes(i))
        cy -= 18;
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      if (score !== 0)
        playerScore = score;
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      // Round over - advance
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver)
          setupGame();
        else {
          roundOver = false;
          dealRound();
        }
        return;
      }

      // Exchange phase - toggle card selection or click Exchange button
      if (phase === PHASE_EXCHANGE && !exchangeDone) {
        // Check Exchange button
        if (CE.isInRect(mx, my, EXCHANGE_BTN.x, EXCHANGE_BTN.y, EXCHANGE_BTN.w, EXCHANGE_BTN.h)) {
          const elderIsPlayer = elder() === 0;
          const maxExch = elderIsPlayer
            ? Math.min(ELDER_MAX_EXCHANGE, talon.length)
            : talon.length;
          if (selectedIndices.length >= 1 && selectedIndices.length <= maxExch)
            doPlayerExchange();
          return;
        }

        // Toggle card selection
        const idx = hitTestPlayerCard(mx, my);
        if (idx >= 0) {
          const pos = selectedIndices.indexOf(idx);
          if (pos >= 0)
            selectedIndices.splice(pos, 1);
          else {
            const elderIsPlayer = elder() === 0;
            const maxExch = elderIsPlayer
              ? Math.min(ELDER_MAX_EXCHANGE, talon.length)
              : talon.length;
            if (selectedIndices.length < maxExch)
              selectedIndices.push(idx);
          }
        }
        return;
      }

      // Declaration phases - click to advance
      if (phase === PHASE_DECLARE_POINT || phase === PHASE_DECLARE_SEQUENCE || phase === PHASE_DECLARE_SET) {
        advanceDeclarationPhase();
        return;
      }

      // Trick play - player's turn
      if (phase === PHASE_TRICK_PLAY && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        if (isValidPlay(playerHand[idx], playerHand)) {
          playCard(0, idx);
        } else {
          const leadSuit = trickCards.length > 0 ? trickCards[0].card.suit : null;
          const reason = leadSuit && hasSuit(playerHand, leadSuit)
            ? 'Must follow suit!'
            : 'Invalid play!';
          if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      hoverCardIdx = -1;

      if (phase === PHASE_EXCHANGE || (phase === PHASE_TRICK_PLAY && currentTurn === 0))
        hoverCardIdx = hitTestPlayerCard(mx, my);
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        playerScore = 0;
        aiScore = 0;
        score = 0;
        gameOver = false;
        if (_host) _host.onScoreChanged(score);
        setupGame();
      }
      if (phase === PHASE_EXCHANGE && (e.key === 'Enter' || e.key === 'e' || e.key === 'E')) {
        const elderIsPlayer = elder() === 0;
        const maxExch = elderIsPlayer
          ? Math.min(ELDER_MAX_EXCHANGE, talon.length)
          : talon.length;
        if (selectedIndices.length >= 1 && selectedIndices.length <= maxExch)
          doPlayerExchange();
      }
    },

    tick(dt) {
      // Declaration auto-advance timer
      if (phase === PHASE_DECLARE_POINT || phase === PHASE_DECLARE_SEQUENCE || phase === PHASE_DECLARE_SET) {
        declPhaseTimer -= dt;
        if (declPhaseTimer <= 0)
          advanceDeclarationPhase();
        return;
      }

      // Trick done timer
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      // AI trick play
      if (phase === PHASE_TRICK_PLAY && currentTurn === 1) {
        aiTimer += dt;
        if (aiTimer >= AI_DELAY) {
          aiTimer = 0;
          const idx = aiChooseCard();
          if (idx >= 0)
            playCard(1, idx);
        }
      }
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      talon = [];
      deck = [];
      trickCards = [];
      selectedIndices = [];
      declResults = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_EXCHANGE;
      resultMsg = '';
      pendingAiAction = false;
      aiTimer = 0;
      hoverCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; playerScore = s; }
  };

  SZ.CardGames.registerVariant('piquet', module);

})();
