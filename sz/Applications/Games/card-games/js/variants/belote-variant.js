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

  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const BELOTE_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const NUM_PLAYERS = 4;
  const TRICKS_PER_ROUND = 8;
  const WIN_SCORE = 501;

  const PLAYER_NAMES = ['You', 'AI-1', 'Partner', 'AI-3'];
  const TEAM_A = 0; // players 0, 2
  const TEAM_B = 1; // players 1, 3

  /* ── Card point values ── */
  const TRUMP_POINTS = { 'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0 };
  const PLAIN_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0 };

  /* ── Card strength ordering (higher = stronger) ── */
  const TRUMP_STRENGTH = { 'J': 7, '9': 6, 'A': 5, '10': 4, 'K': 3, 'Q': 2, '8': 1, '7': 0 };
  const PLAIN_STRENGTH = { 'A': 7, '10': 6, 'K': 5, 'Q': 4, 'J': 3, '9': 2, '8': 1, '7': 0 };

  /* ── Phases ── */
  const PHASE_DEALING = 0;
  const PHASE_BID_ROUND1 = 1;
  const PHASE_BID_ROUND2 = 2;
  const PHASE_DEAL_REMAINING = 3;
  const PHASE_PLAYING = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_OVER = 6;
  const PHASE_GAME_OVER = 7;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let deck = [];
  let trumpSuit = null;
  let proposedCard = null;
  let takerPlayer = -1;
  let takerTeam = -1;
  let dealer = 0;
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCards = [];
  let trickPlayers = [];
  let trickCount = 0;
  let teamTrickPoints = [0, 0];
  let teamScores = [0, 0];
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let phase = PHASE_DEALING;

  let biddingPlayer = 0;
  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;
  let dealRemainingTimer = 0;
  const DEAL_REMAINING_DELAY = 0.6;

  /* ── Belote/Rebelote tracking ── */
  let beloteDeclared = [false, false, false, false]; // per player: declared belote
  let rebeloteDeclared = [false, false, false, false];
  let teamBeloteBonus = [0, 0]; // 20 per declaration pair

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  let hoveredCard = -1;
  let hoveredBtn = '';
  let roundMessage = '';
  let statusText = '';

  /* ================================================================
     TEAM / PLAYER UTILITIES
     ================================================================ */

  function teamOf(p) {
    return (p === 0 || p === 2) ? TEAM_A : TEAM_B;
  }

  function partnerOf(p) {
    return (p + 2) % NUM_PLAYERS;
  }

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  /* ================================================================
     CARD RANKING
     ================================================================ */

  function cardPoints(card) {
    if (card.suit === trumpSuit) return TRUMP_POINTS[card.rank] || 0;
    return PLAIN_POINTS[card.rank] || 0;
  }

  function cardStrength(card) {
    if (card.suit === trumpSuit) return 100 + (TRUMP_STRENGTH[card.rank] || 0);
    return PLAIN_STRENGTH[card.rank] || 0;
  }

  function cardStrengthInSuit(card, suit) {
    if (suit === trumpSuit) return 100 + (TRUMP_STRENGTH[card.rank] || 0);
    return PLAIN_STRENGTH[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const aIsTrump = a.suit === trumpSuit;
      const bIsTrump = b.suit === trumpSuit;
      if (aIsTrump && !bIsTrump) return 1;
      if (bIsTrump && !aIsTrump) return -1;
      if (aIsTrump && bIsTrump) return TRUMP_STRENGTH[a.rank] - TRUMP_STRENGTH[b.rank];
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return PLAIN_STRENGTH[a.rank] - PLAIN_STRENGTH[b.rank];
    });
  }

  /* ================================================================
     VALIDITY - BELOTE RULES
     ================================================================ */

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function hasHigherTrump(hand, currentHighest) {
    return hand.some(c => c.suit === trumpSuit && TRUMP_STRENGTH[c.rank] > currentHighest);
  }

  function currentWinnerIdx() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrengthInSuit(trickCards[0], leadSuit);
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cIsTrump = c.suit === trumpSuit;
      if (bestIsTrump) {
        if (cIsTrump && TRUMP_STRENGTH[c.rank] > TRUMP_STRENGTH[trickCards[bestIdx].rank]) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, trumpSuit);
        }
      } else {
        if (cIsTrump) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, trumpSuit);
          bestIsTrump = true;
        } else if (c.suit === leadSuit && PLAIN_STRENGTH[c.rank] > PLAIN_STRENGTH[trickCards[bestIdx].rank]) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, leadSuit);
        }
      }
    }
    return bestIdx;
  }

  function currentWinningPlayer() {
    const idx = currentWinnerIdx();
    return idx >= 0 ? trickPlayers[idx] : -1;
  }

  function highestTrumpStrengthInTrick() {
    let best = -1;
    for (const c of trickCards)
      if (c.suit === trumpSuit && TRUMP_STRENGTH[c.rank] > best)
        best = TRUMP_STRENGTH[c.rank];
    return best;
  }

  function isValidPlay(card, hand, playerIdx) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;

    // If lead suit is trump
    if (leadSuit === trumpSuit) {
      if (card.suit === trumpSuit) {
        // Must overtrump if possible
        const highestTrump = highestTrumpStrengthInTrick();
        if (hasHigherTrump(hand, highestTrump))
          return TRUMP_STRENGTH[card.rank] > highestTrump;
        // Can't overtrump, any trump is ok
        if (hasSuit(hand, trumpSuit))
          return card.suit === trumpSuit;
        return true;
      }
      // Don't have trump? Play anything
      if (!hasSuit(hand, trumpSuit)) return true;
      return false; // Must play trump if you have it
    }

    // Lead suit is not trump
    if (card.suit === leadSuit) return true;

    // Can't follow suit
    if (hasSuit(hand, leadSuit)) return false; // Must follow if able

    // Void in led suit: check if partner is winning
    const winnerPlayer = currentWinningPlayer();
    const partnerWinning = winnerPlayer >= 0 && teamOf(winnerPlayer) === teamOf(playerIdx);

    if (partnerWinning) {
      // Partner winning: can play anything (no obligation to trump)
      return true;
    }

    // Partner NOT winning: must trump if possible
    if (hasSuit(hand, trumpSuit)) {
      if (card.suit !== trumpSuit) return false;
      // Must overtrump if possible
      const highestTrump = highestTrumpStrengthInTrick();
      if (highestTrump >= 0 && hasHigherTrump(hand, highestTrump))
        return TRUMP_STRENGTH[card.rank] > highestTrump;
      return card.suit === trumpSuit; // play any trump
    }

    // No trump either: anything goes
    return true;
  }

  function getValidIndices(hand, playerIdx) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand, playerIdx))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i) valid.push(i);
    return valid;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cIsTrump = c.suit === trumpSuit;

      if (bestIsTrump) {
        if (cIsTrump && TRUMP_STRENGTH[c.rank] > TRUMP_STRENGTH[trickCards[bestIdx].rank])
          bestIdx = i;
      } else {
        if (cIsTrump) {
          bestIdx = i;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && PLAIN_STRENGTH[c.rank] > PLAIN_STRENGTH[trickCards[bestIdx].rank])
          bestIdx = i;
      }
    }
    return trickPlayers[bestIdx];
  }

  /* ================================================================
     BELOTE / REBELOTE
     ================================================================ */

  function playerHasBelote(playerIdx) {
    const hand = hands[playerIdx];
    const hasKing = hand.some(c => c.suit === trumpSuit && c.rank === 'K');
    const hasQueen = hand.some(c => c.suit === trumpSuit && c.rank === 'Q');
    return hasKing && hasQueen;
  }

  function checkBeloteDeclaration(playerIdx, card) {
    if (card.suit !== trumpSuit) return;
    if (card.rank !== 'K' && card.rank !== 'Q') return;

    const otherRank = card.rank === 'K' ? 'Q' : 'K';
    const handHasOther = hands[playerIdx].some(c => c.suit === trumpSuit && c.rank === otherRank);

    if (!beloteDeclared[playerIdx] && (handHasOther || rebeloteDeclared[playerIdx])) {
      // Playing the first of the pair
      if (handHasOther) {
        beloteDeclared[playerIdx] = true;
        if (_host) {
          const who = playerIdx === 0 ? 'You declare' : PLAYER_NAMES[playerIdx] + ' declares';
          _host.floatingText.add(CANVAS_W / 2, 180, who + ' Belote!', { color: '#ff0', size: 16 });
        }
      }
    } else if (beloteDeclared[playerIdx] && !rebeloteDeclared[playerIdx]) {
      // Playing the second of the pair
      rebeloteDeclared[playerIdx] = true;
      teamBeloteBonus[teamOf(playerIdx)] += 20;
      if (_host) {
        const who = playerIdx === 0 ? 'You declare' : PLAYER_NAMES[playerIdx] + ' declares';
        _host.floatingText.add(CANVAS_W / 2, 180, who + ' Rebelote! (+20)', { color: '#ff0', size: 16 });
      }
    }
  }

  /* ================================================================
     AI - BIDDING
     ================================================================ */

  function handPointsForSuit(hand, suit) {
    let pts = 0;
    for (const c of hand) {
      if (c.suit === suit)
        pts += TRUMP_POINTS[c.rank] || 0;
      else
        pts += PLAIN_POINTS[c.rank] || 0;
    }
    return pts;
  }

  function countCardsOfSuit(hand, suit) {
    let count = 0;
    for (const c of hand)
      if (c.suit === suit) ++count;
    return count;
  }

  function hasRankInSuit(hand, suit, rank) {
    return hand.some(c => c.suit === suit && c.rank === rank);
  }

  function aiShouldTakeRound1(playerIdx) {
    const hand = hands[playerIdx];
    const suit = proposedCard.suit;
    const trumpCount = countCardsOfSuit(hand, suit);
    const hasJ = hasRankInSuit(hand, suit, 'J');
    const has9 = hasRankInSuit(hand, suit, '9');
    const hasA = hasRankInSuit(hand, suit, 'A');

    // Strong take: J + 2 others, or 14+ total points
    if (hasJ && trumpCount >= 2) return true;
    if (trumpCount >= 3 && (has9 || hasA)) return true;
    if (handPointsForSuit(hand, suit) >= 14) return true;

    // Dealer gets the card, so be more aggressive as dealer
    if (playerIdx === dealer && trumpCount >= 2 && (hasJ || has9)) return true;

    return false;
  }

  function aiPickTrumpRound2(playerIdx) {
    const hand = hands[playerIdx];
    const excludeSuit = proposedCard ? proposedCard.suit : null;
    let bestSuit = null;
    let bestScore = 0;

    for (const s of CE.SUITS) {
      if (s === excludeSuit) continue;
      const count = countCardsOfSuit(hand, s);
      const hasJ = hasRankInSuit(hand, s, 'J');
      const has9 = hasRankInSuit(hand, s, '9');

      if (count >= 3 && (hasJ || has9)) {
        const sc = count * 10 + (hasJ ? 20 : 0) + (has9 ? 14 : 0);
        if (sc > bestScore) {
          bestScore = sc;
          bestSuit = s;
        }
      }
    }

    return bestSuit;
  }

  /* ================================================================
     AI - PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = getValidIndices(hand, playerIdx);
    if (valid.length === 1) return valid[0];

    const isLeading = trickCards.length === 0;
    const partner = partnerOf(playerIdx);

    if (isLeading) {
      // Lead with trump J or 9 if we have strong trumps
      const trumpIdxs = valid.filter(i => hand[i].suit === trumpSuit);
      if (trumpIdxs.length >= 3) {
        trumpIdxs.sort((a, b) => TRUMP_STRENGTH[hand[b].rank] - TRUMP_STRENGTH[hand[a].rank]);
        return trumpIdxs[0];
      }
      // Lead with non-trump aces
      const aces = valid.filter(i => hand[i].suit !== trumpSuit && hand[i].rank === 'A');
      if (aces.length > 0) return aces[0];
      // Lead with highest non-trump
      const nonTrump = valid.filter(i => hand[i].suit !== trumpSuit);
      if (nonTrump.length > 0) {
        nonTrump.sort((a, b) => PLAIN_STRENGTH[hand[b].rank] - PLAIN_STRENGTH[hand[a].rank]);
        return nonTrump[0];
      }
      // Only trumps left, lead lowest
      valid.sort((a, b) => TRUMP_STRENGTH[hand[a].rank] - TRUMP_STRENGTH[hand[b].rank]);
      return valid[0];
    }

    // Not leading
    const winnerPlayer = currentWinningPlayer();
    const partnerWinning = winnerPlayer >= 0 && teamOf(winnerPlayer) === teamOf(playerIdx);
    const leadSuit = trickCards[0].suit;

    // Following suit
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);
    if (followIdxs.length > 0) {
      if (partnerWinning) {
        // Play lowest of suit
        followIdxs.sort((a, b) => {
          const strA = leadSuit === trumpSuit ? TRUMP_STRENGTH[hand[a].rank] : PLAIN_STRENGTH[hand[a].rank];
          const strB = leadSuit === trumpSuit ? TRUMP_STRENGTH[hand[b].rank] : PLAIN_STRENGTH[hand[b].rank];
          return strA - strB;
        });
        return followIdxs[0];
      }
      // Try to win with lowest winning card
      followIdxs.sort((a, b) => {
        const strA = leadSuit === trumpSuit ? TRUMP_STRENGTH[hand[a].rank] : PLAIN_STRENGTH[hand[a].rank];
        const strB = leadSuit === trumpSuit ? TRUMP_STRENGTH[hand[b].rank] : PLAIN_STRENGTH[hand[b].rank];
        return strB - strA;
      });
      return followIdxs[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump
      const dump = valid.filter(i => hand[i].suit !== trumpSuit);
      const choice = dump.length > 0 ? dump : valid;
      choice.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return choice[0];
    }

    // Must trump: play lowest winning trump
    const trumpIdxs = valid.filter(i => hand[i].suit === trumpSuit);
    if (trumpIdxs.length > 0) {
      trumpIdxs.sort((a, b) => TRUMP_STRENGTH[hand[a].rank] - TRUMP_STRENGTH[hand[b].rank]);
      return trumpIdxs[0];
    }

    // No trump available, dump lowest
    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return valid[0];
  }

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, BELOTE_RANKS));

    hands = [[], [], [], []];
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    teamTrickPoints = [0, 0];
    trumpSuit = null;
    proposedCard = null;
    takerPlayer = -1;
    takerTeam = -1;
    hoveredCard = -1;
    hoveredBtn = '';
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    dealRemainingTimer = 0;
    aiTurnTimer = 0;
    roundMessage = '';
    statusText = '';
    roundOver = false;
    beloteDeclared = [false, false, false, false];
    rebeloteDeclared = [false, false, false, false];
    teamBeloteBonus = [0, 0];

    // Deal 5 cards each (3+2 or 2+3 pattern, but simplified to 5 straight)
    let idx = 0;
    for (let i = 0; i < 5; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p)
        hands[p].push(d[idx++]);

    // Remaining cards for later dealing
    deck = d.slice(idx);

    // Turn up one card as proposed trump
    proposedCard = deck.shift();
    proposedCard.faceUp = true;

    for (const c of hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    biddingPlayer = leftOf(dealer);
    phase = PHASE_BID_ROUND1;

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     TRUMP SELECTION
     ================================================================ */

  function acceptTrumpRound1(playerIdx) {
    trumpSuit = proposedCard.suit;
    takerPlayer = playerIdx;
    takerTeam = teamOf(playerIdx);

    if (_host) {
      const who = playerIdx === 0 ? 'You take' : PLAYER_NAMES[playerIdx] + ' takes';
      _host.floatingText.add(CANVAS_W / 2, 250, who + ' ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], { color: '#ff0', size: 16 });
    }

    // Give the proposed card to the taker
    proposedCard.faceUp = playerIdx === 0;
    hands[playerIdx].push(proposedCard);

    // Deal remaining 3 cards to each player (taker gets 2 since they got the proposed card)
    dealRemainingCards();
  }

  function acceptTrumpRound2(playerIdx, suit) {
    trumpSuit = suit;
    takerPlayer = playerIdx;
    takerTeam = teamOf(playerIdx);

    if (_host) {
      const who = playerIdx === 0 ? 'You call' : PLAYER_NAMES[playerIdx] + ' calls';
      _host.floatingText.add(CANVAS_W / 2, 250, who + ' ' + SUIT_SYMBOLS[suit] + ' ' + SUIT_NAMES[suit], { color: '#ff0', size: 16 });
    }

    // Proposed card goes back into deck (not taken)
    deck.unshift(proposedCard);

    // Deal remaining 3 cards each
    dealRemainingCards();
  }

  function dealRemainingCards() {
    phase = PHASE_DEAL_REMAINING;
    dealRemainingTimer = 0;
  }

  function finishDealRemaining() {
    // Each player needs 8 cards total
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      while (hands[p].length < 8 && deck.length > 0) {
        const c = deck.shift();
        c.faceUp = p === 0;
        hands[p].push(c);
      }
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    if (_host) {
      const total = hands[0].length;
      for (let i = 5; i < total; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, total), PLAYER_HAND_Y, (i - 5) * 0.06);
    }

    startPlaying();
  }

  function advanceBidding() {
    biddingPlayer = leftOf(biddingPlayer);
    aiTurnTimer = 0;
  }

  function startPlaying() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);
    for (const c of hands[0])
      c.faceUp = true;

    phase = PHASE_PLAYING;
    trickLeader = leftOf(dealer);
    currentTurn = trickLeader;
    trickCards = [];
    trickPlayers = [];
    aiTurnTimer = 0;
    statusText = currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[currentTurn] + ' is playing...';
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;

    // Check belote/rebelote
    checkBeloteDeclaration(playerIdx, card);

    trickCards.push(card);
    trickPlayers.push(playerIdx);

    if (trickCards.length >= NUM_PLAYERS) {
      phase = PHASE_TRICK_DONE;
      trickWinnerIdx = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    currentTurn = leftOf(currentTurn);
    statusText = currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[currentTurn] + ' is playing...';
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    const winTeam = teamOf(winner);
    ++trickCount;

    // Sum card points
    let trickPts = 0;
    for (const c of trickCards)
      trickPts += cardPoints(c);

    // Last trick bonus
    if (trickCount === TRICKS_PER_ROUND)
      trickPts += 10;

    teamTrickPoints[winTeam] += trickPts;

    if (_host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + trickCount + ' (+' + trickPts + ')';
      const color = winTeam === TEAM_A ? '#4f4' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 14 });
    }

    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (trickCount >= TRICKS_PER_ROUND) {
      endRound();
      return;
    }

    trickLeader = winner;
    currentTurn = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
    statusText = currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[currentTurn] + ' is playing...';
  }

  function endRound() {
    // Taker's team must score > 81 (out of 162)
    const takerPts = teamTrickPoints[takerTeam];
    const defenderPts = teamTrickPoints[1 - takerTeam];
    let takerFinal = 0;
    let defenderFinal = 0;
    let msg = '';

    if (takerPts > 81) {
      // Taker succeeds: both teams score what they won
      takerFinal = takerPts;
      defenderFinal = defenderPts;
      msg = 'Contract made! (' + takerPts + ' pts)';
    } else {
      // Taker fails (dedans): defenders get all 162
      takerFinal = 0;
      defenderFinal = 162;
      msg = 'Dedans! Taker fails (' + takerPts + ' pts)';
    }

    // Add belote bonuses (always awarded regardless of contract success)
    takerFinal += teamBeloteBonus[takerTeam];
    defenderFinal += teamBeloteBonus[1 - takerTeam];

    teamScores[takerTeam] += takerFinal;
    teamScores[1 - takerTeam] += defenderFinal;

    score = teamScores[TEAM_A];
    if (_host) _host.onScoreChanged(score);

    const teamALabel = 'Your Team: ' + teamScores[TEAM_A];
    const teamBLabel = 'Opponents: ' + teamScores[TEAM_B];
    roundMessage = msg + '\n' + teamALabel + '  ' + teamBLabel;

    if (teamBeloteBonus[TEAM_A] > 0 || teamBeloteBonus[TEAM_B] > 0) {
      const bonusA = teamBeloteBonus[TEAM_A] > 0 ? 'Your Team +' + teamBeloteBonus[TEAM_A] + ' belote' : '';
      const bonusB = teamBeloteBonus[TEAM_B] > 0 ? 'Opponents +' + teamBeloteBonus[TEAM_B] + ' belote' : '';
      const bonusMsg = [bonusA, bonusB].filter(s => s).join(', ');
      roundMessage += '\n' + bonusMsg;
    }

    roundOver = true;

    if (teamScores[TEAM_A] >= WIN_SCORE || teamScores[TEAM_B] >= WIN_SCORE) {
      gameOver = true;
      phase = PHASE_GAME_OVER;
      if (_host) {
        const won = teamScores[TEAM_A] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Opponents win!';
        _host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) {
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 80);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      }
    } else {
      phase = PHASE_ROUND_OVER;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: '#ff0', size: 18 });
    }
  }

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  function playerCardX(idx, total) {
    const maxWidth = 520;
    const fanWidth = Math.min(maxWidth, total * 60);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2 - 40;
    return startX + idx * spacing;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },       // bottom (player)
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },       // left (AI-1)
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },        // top (partner)
    { x: CANVAS_W / 2 + 50, y: 250 }                     // right (AI-3)
  ];

  const AI_HAND_POSITIONS = [
    null, // player 0
    { x: 20, y: 160, dir: 'vertical', label: 'AI-1 (L)' },
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'Partner (T)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'AI-3 (R)' }
  ];

  /* ── Button positions ── */
  const BTN_W = 100;
  const BTN_H = 30;
  const BTN_GAP = 12;
  const BTN_Y = 360;

  function takeBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W - BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function passBtnRect() {
    return { x: CANVAS_W / 2 + BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function suitBtnRect(idx) {
    const totalW = 3 * 80 + 2 * 8;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + idx * 88, y: BTN_Y, w: 80, h: BTN_H };
  }

  function passR2BtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 140;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Belote', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Your Team (You+Partner)', px + 10, py + 28);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + teamScores[TEAM_A], px + pw - 10, py + 28);

    _ctx.textAlign = 'left';
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Opponents (AI-1+AI-3)', px + 10, py + 44);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + teamScores[TEAM_B], px + pw - 10, py + 44);

    // Tricks & points this round
    if (phase >= PHASE_PLAYING && phase <= PHASE_ROUND_OVER) {
      _ctx.textAlign = 'left';
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.fillText('Round pts: A=' + teamTrickPoints[TEAM_A] + '  B=' + teamTrickPoints[TEAM_B], px + 10, py + 64);
      _ctx.fillText('Trick ' + (trickCount + (phase === PHASE_PLAYING ? 1 : 0)) + '/' + TRICKS_PER_ROUND, px + 10, py + 78);
    }

    // Trump indicator
    if (trumpSuit) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], px + 10, py + 96);

      if (takerPlayer >= 0) {
        _ctx.fillStyle = '#f80';
        _ctx.font = '10px sans-serif';
        _ctx.fillText('Taker: ' + PLAYER_NAMES[takerPlayer], px + 10, py + 112);
      }
    }

    // Dealer
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], px + 10, py + 126);

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isHover = i === hoveredCard && phase === PHASE_PLAYING && currentTurn === 0;
      if (isHover) y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow
      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0 && isValidPlay(hand[i], hand, 0))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Dim invalid cards
      if (phase === PHASE_PLAYING && currentTurn === 0 && !isValidPlay(hand[i], hand, 0)) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.fill();
        _ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrent = currentTurn === p && phase === PHASE_PLAYING;

      _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';

      const label = pos.label + ' (' + count + ')';

      if (pos.dir === 'horizontal') {
        _ctx.fillText(label, CANVAS_W / 2, pos.y);
        const spacing = Math.min(22, 240 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, pos.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const lx = p === 1 ? pos.x + 20 : pos.x;
        _ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);
        const spacing = Math.min(18, 200 / Math.max(count, 1));
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(_ctx, cx, pos.y + 14 + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Subtle center circle
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const playerIdx = trickPlayers[i];
      const pos = TRICK_POSITIONS[playerIdx];
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);
    }

    if (phase === PHASE_TRICK_DONE && trickWinnerIdx >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[trickWinnerIdx] + ' takes';
      _ctx.fillText(who + ' the trick', CANVAS_W / 2, 170);
    }
  }

  function drawProposedCard() {
    if (!proposedCard) return;
    const kx = CANVAS_W / 2 - CE.CARD_W / 2;
    const ky = 230;
    CE.drawCardFace(_ctx, kx, ky, proposedCard);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Proposed trump', CANVAS_W / 2, ky + CE.CARD_H + 4);
  }

  function drawBidRound1UI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding \u2014 Round 1', CANVAS_W / 2, 180);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Proposed trump: ' + SUIT_SYMBOLS[proposedCard.suit] + ' ' + proposedCard.rank + ' of ' + SUIT_NAMES[proposedCard.suit], CANVAS_W / 2, 200);

    drawProposedCard();

    if (biddingPlayer === 0) {
      const tb = takeBtnRect();
      const pb = passBtnRect();
      CE.drawButton(_ctx, tb.x, tb.y, tb.w, tb.h, 'Take', { bg: hoveredBtn === 'take' ? '#3a6a3a' : '#2a5a2a', border: '#6c6', fontSize: 12 });
      CE.drawButton(_ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
    } else {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawBidRound2UI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding \u2014 Round 2', CANVAS_W / 2, 200);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '12px sans-serif';
    const excludeSuit = proposedCard ? proposedCard.suit : null;
    _ctx.fillText('Name any suit except ' + (excludeSuit ? SUIT_NAMES[excludeSuit] : '?'), CANVAS_W / 2, 220);

    if (biddingPlayer === 0) {
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === excludeSuit) continue;
        const r = suitBtnRect(suitIdx);
        const col = (s === 'hearts' || s === 'diamonds') ? '#8a2a2a' : '#2a2a6a';
        const colHover = (s === 'hearts' || s === 'diamonds') ? '#aa4a4a' : '#4a4a8a';
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, SUIT_SYMBOLS[s] + ' ' + SUIT_NAMES[s], { bg: hoveredBtn === s ? colHover : col, border: '#aaa', fontSize: 11 });
        ++suitIdx;
      }
      const pb = passR2BtnRect();
      CE.drawButton(_ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: hoveredBtn === 'pass2' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
    } else {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawDealRemainingUI() {
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Dealing remaining cards...', CANVAS_W / 2, CANVAS_H / 2);

    if (trumpSuit) {
      _ctx.fillStyle = '#ccc';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit] + '  |  Taker: ' + PLAYER_NAMES[takerPlayer], CANVAS_W / 2, CANVAS_H / 2 + 24);
    }
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && trickCards.length < NUM_PLAYERS && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/' + TRICKS_PER_ROUND, 10, CANVAS_H - 16);
  }

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 140;
    const pw = 360;
    const ph = 260;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    _ctx.font = '13px sans-serif';
    _ctx.fillStyle = '#ccc';
    const takerName = takerTeam === TEAM_A ? 'Your Team' : 'Opponents';
    _ctx.fillText(takerName + ' took contract (' + SUIT_SYMBOLS[trumpSuit] + ')', CANVAS_W / 2, py + 40);

    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Your Team pts: ' + teamTrickPoints[TEAM_A] + '   Total: ' + teamScores[TEAM_A], CANVAS_W / 2, py + 68);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Opponents pts: ' + teamTrickPoints[TEAM_B] + '   Total: ' + teamScores[TEAM_B], CANVAS_W / 2, py + 88);

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    const lines = roundMessage.split('\n');
    for (let i = 0; i < lines.length; ++i)
      _ctx.fillText(lines[i], CANVAS_W / 2, py + 118 + i * 18);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    _ctx.restore();
  }

  function drawGameOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = teamScores[TEAM_A] >= WIN_SCORE;
    _ctx.fillStyle = won ? '#4f4' : '#f44';
    _ctx.font = 'bold 24px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(won ? 'You Win!' : 'You Lose!', CANVAS_W / 2, 220);

    _ctx.fillStyle = '#fff';
    _ctx.font = '16px sans-serif';
    _ctx.fillText('Your Team: ' + teamScores[TEAM_A] + '  |  Opponents: ' + teamScores[TEAM_B], CANVAS_W / 2, 260);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '14px sans-serif';
    _ctx.fillText('Click to start a new game', CANVAS_W / 2, 300);
    _ctx.restore();
  }

  function drawAll() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Belote', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (phase === PHASE_BID_ROUND1) {
      drawBidRound1UI();
      drawPlayerHand();
    } else if (phase === PHASE_BID_ROUND2) {
      drawBidRound2UI();
      drawPlayerHand();
    } else if (phase === PHASE_DEAL_REMAINING) {
      drawDealRemainingUI();
      drawPlayerHand();
    } else if (phase >= PHASE_PLAYING && phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (phase === PHASE_ROUND_OVER) {
      drawRoundOverUI();
    } else if (phase === PHASE_GAME_OVER) {
      drawGameOverUI();
    }
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const cy = PLAYER_HAND_Y;
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
      if (score !== 0) teamScores[TEAM_A] = score;
      else teamScores = [0, 0];
      gameOver = false;
      dealer = 0;
      dealRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      // Game over
      if (phase === PHASE_GAME_OVER) {
        teamScores = [0, 0];
        score = 0;
        gameOver = false;
        dealer = 0;
        if (_host) _host.onScoreChanged(score);
        dealRound();
        return;
      }

      // Round over screen
      if (phase === PHASE_ROUND_OVER) {
        dealer = leftOf(dealer);
        dealRound();
        return;
      }

      // Bid round 1 - player's turn
      if (phase === PHASE_BID_ROUND1 && biddingPlayer === 0) {
        const tb = takeBtnRect();
        const pb = passBtnRect();

        if (CE.isInRect(mx, my, tb.x, tb.y, tb.w, tb.h)) {
          acceptTrumpRound1(0);
          return;
        }
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          if (biddingPlayer === dealer) {
            biddingPlayer = leftOf(dealer);
            phase = PHASE_BID_ROUND2;
            aiTurnTimer = 0;
          } else
            advanceBidding();
          return;
        }
        return;
      }

      // Bid round 2 - player's turn
      if (phase === PHASE_BID_ROUND2 && biddingPlayer === 0) {
        const excludeSuit = proposedCard ? proposedCard.suit : null;
        let suitIdx = 0;
        for (const s of CE.SUITS) {
          if (s === excludeSuit) continue;
          const r = suitBtnRect(suitIdx);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            acceptTrumpRound2(0, s);
            return;
          }
          ++suitIdx;
        }
        const pb = passR2BtnRect();
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) {
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          if (biddingPlayer === dealer) {
            // All passed both rounds: redeal
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 260, 'All passed! Redealing...', { color: '#f80', size: 16 });
            dealer = leftOf(dealer);
            dealRound();
          } else
            advanceBidding();
          return;
        }
        return;
      }

      // Playing phase - player's turn
      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = hands[0];
        if (isValidPlay(hand[idx], hand, 0))
          playCard(0, idx);
        else if (_host) {
          let reason = 'Invalid play!';
          const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
          if (leadSuit && hasSuit(hand, leadSuit))
            reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
          else if (leadSuit && !hasSuit(hand, leadSuit) && hasSuit(hand, trumpSuit))
            reason = 'Must trump!';
          _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBtn = '';

      if (phase === PHASE_PLAYING && currentTurn === 0)
        hoveredCard = hitTestPlayerCard(mx, my);

      if (phase === PHASE_BID_ROUND1 && biddingPlayer === 0) {
        const tb = takeBtnRect();
        const pb = passBtnRect();
        if (CE.isInRect(mx, my, tb.x, tb.y, tb.w, tb.h)) hoveredBtn = 'take';
        else if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) hoveredBtn = 'pass';
      }

      if (phase === PHASE_BID_ROUND2 && biddingPlayer === 0) {
        const excludeSuit = proposedCard ? proposedCard.suit : null;
        let suitIdx = 0;
        for (const s of CE.SUITS) {
          if (s === excludeSuit) continue;
          const r = suitBtnRect(suitIdx);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) { hoveredBtn = s; break; }
          ++suitIdx;
        }
        const pb = passR2BtnRect();
        if (CE.isInRect(mx, my, pb.x, pb.y, pb.w, pb.h)) hoveredBtn = 'pass2';
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER || phase === PHASE_GAME_OVER) return;

      // Deal remaining timer
      if (phase === PHASE_DEAL_REMAINING) {
        dealRemainingTimer += dt;
        if (dealRemainingTimer >= DEAL_REMAINING_DELAY)
          finishDealRemaining();
        return;
      }

      // Trick done timer
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      // AI bidding round 1
      if (phase === PHASE_BID_ROUND1 && biddingPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          if (aiShouldTakeRound1(biddingPlayer)) {
            if (_host) {
              const msg = PLAYER_NAMES[biddingPlayer] + ' takes!';
              _host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
            }
            acceptTrumpRound1(biddingPlayer);
          } else {
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
            if (biddingPlayer === dealer) {
              biddingPlayer = leftOf(dealer);
              phase = PHASE_BID_ROUND2;
              aiTurnTimer = 0;
            } else
              advanceBidding();
          }
        }
        return;
      }

      // AI bidding round 2
      if (phase === PHASE_BID_ROUND2 && biddingPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          const picked = aiPickTrumpRound2(biddingPlayer);
          if (picked) {
            if (_host) {
              const msg = PLAYER_NAMES[biddingPlayer] + ' calls ' + SUIT_SYMBOLS[picked];
              _host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
            }
            acceptTrumpRound2(biddingPlayer, picked);
          } else {
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
            if (biddingPlayer === dealer) {
              // All passed both rounds, redeal
              if (_host)
                _host.floatingText.add(CANVAS_W / 2, 260, 'All passed! Redealing...', { color: '#f80', size: 16 });
              dealer = leftOf(dealer);
              dealRound();
            } else
              advanceBidding();
          }
        }
        return;
      }

      // Wait for player during bidding
      if ((phase === PHASE_BID_ROUND1 || phase === PHASE_BID_ROUND2) && biddingPlayer === 0) return;

      // AI playing
      if (phase !== PHASE_PLAYING) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const idx = aiChooseCard(currentTurn);
        if (idx >= 0)
          playCard(currentTurn, idx);
      }
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      deck = [];
      trickCards = [];
      trickPlayers = [];
      trumpSuit = null;
      proposedCard = null;
      takerPlayer = -1;
      takerTeam = -1;
      teamScores = [0, 0];
      teamTrickPoints = [0, 0];
      teamBeloteBonus = [0, 0];
      beloteDeclared = [false, false, false, false];
      rebeloteDeclared = [false, false, false, false];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DEALING;
      aiTurnTimer = 0;
      hoveredCard = -1;
      hoveredBtn = '';
      roundMessage = '';
      statusText = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) {
      score = s;
      teamScores[TEAM_A] = s;
    }
  };

  SZ.CardGames.registerVariant('belote', module);

})();
