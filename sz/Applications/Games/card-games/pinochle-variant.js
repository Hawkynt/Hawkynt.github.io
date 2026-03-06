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

  const SUIT_NAMES = { spades: '\u2660 Spades', hearts: '\u2665 Hearts', diamonds: '\u2666 Diamonds', clubs: '\u2663 Clubs' };
  const SUIT_SHORT = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const PINOCHLE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '9': 0, 'J': 1, 'Q': 2, 'K': 3, '10': 4, 'A': 5 };
  const TRICK_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0 };

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 12;
  const MIN_BID = 20;
  const BID_STEP = 5;
  const GAME_WIN_SCORE = 1500;

  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_A = 0;
  const TEAM_B = 1;

  /* Phases */
  const PHASE_BIDDING = 0;
  const PHASE_TRUMP_SELECT = 1;
  const PHASE_MELDING = 2;
  const PHASE_PLAYING = 3;
  const PHASE_TRICK_DONE = 4;
  const PHASE_ROUND_SCORE = 5;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let trickCards = [];
  let trickPlayers = [];
  let teamScores = [0, 0];
  let meldPoints = [0, 0, 0, 0];
  let trickPointsWon = [0, 0];
  let tricksWon = [0, 0];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  let phase = PHASE_BIDDING;
  let trumpSuit = null;
  let dealer = 0;
  let currentBidder = 0;
  let highBid = 0;
  let highBidder = -1;
  let passCount = 0;
  let bidPassed = [false, false, false, false];
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCount = 0;
  let roundNumber = 0;
  let trickWinnerIdx = -1;

  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.2;

  let meldDisplayTimer = 0;
  const MELD_DISPLAY_DELAY = 3.0;
  let meldResults = [];

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.6;

  let hoverCardIdx = -1;
  let hoverBidBtn = -1;
  let hoveredTrumpSuit = null;

  /* ================================================================
     TEAM HELPERS
     ================================================================ */

  function teamOf(player) {
    return (player === 0 || player === 2) ? TEAM_A : TEAM_B;
  }

  /* ================================================================
     DECK CREATION (48-card Pinochle deck)
     ================================================================ */

  function createPinochleDeck() {
    const half = CE.createDeckFromRanks(CE.SUITS, PINOCHLE_RANKS);
    const other = CE.createDeckFromRanks(CE.SUITS, PINOCHLE_RANKS);
    return half.concat(other);
  }

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function cardTrickValue(card) {
    return TRICK_POINTS[card.rank] || 0;
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

  function countRankInSuit(hand, rank, suit) {
    return hand.filter(c => c.rank === rank && c.suit === suit).length;
  }

  function countRankAcrossSuits(hand, rank) {
    const suits = new Set();
    for (const c of hand)
      if (c.rank === rank)
        suits.add(c.suit);
    return suits.size;
  }

  /* ================================================================
     TRICK RULES - VALIDITY
     ================================================================ */

  function currentWinningStrength() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestStr = -1;
    let bestIsTrump = false;

    for (const c of trickCards) {
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);
      if (bestStr < 0) {
        bestStr = str;
        bestIsTrump = isTrump;
      } else if (bestIsTrump) {
        if (isTrump && str > bestStr)
          bestStr = str;
      } else {
        if (isTrump) {
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr)
          bestStr = str;
      }
    }
    return bestStr;
  }

  function currentWinnerIsTrump() {
    if (trickCards.length === 0) return false;
    const leadSuit = trickCards[0].suit;
    let bestStr = -1;
    let bestIsTrump = false;

    for (const c of trickCards) {
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);
      if (bestStr < 0) {
        bestStr = str;
        bestIsTrump = isTrump;
      } else if (bestIsTrump) {
        if (isTrump && str > bestStr)
          bestStr = str;
      } else {
        if (isTrump) {
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr)
          bestStr = str;
      }
    }
    return bestIsTrump;
  }

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;
    const hasLead = hasSuit(hand, leadSuit);

    if (hasLead) {
      if (card.suit !== leadSuit) return false;
      const bestStr = currentWinningStrength();
      const winIsTrump = currentWinnerIsTrump();
      if (!winIsTrump || leadSuit === trumpSuit) {
        const higherCards = hand.filter(c => c.suit === leadSuit && cardStrength(c) > bestStr);
        if (higherCards.length > 0)
          return cardStrength(card) > bestStr;
      }
      return true;
    }

    const hasTrump = hasSuit(hand, trumpSuit);
    if (hasTrump && card.suit !== trumpSuit) return false;
    if (hasTrump && card.suit === trumpSuit) {
      const winIsTrump = currentWinnerIsTrump();
      if (winIsTrump) {
        const bestStr = currentWinningStrength();
        const higherTrumps = hand.filter(c => c.suit === trumpSuit && cardStrength(c) > bestStr);
        if (higherTrumps.length > 0)
          return cardStrength(card) > bestStr;
      }
      return true;
    }

    return true;
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

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function determineTrickWinner() {
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStr) {
          bestIdx = i;
          bestStr = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr) {
          bestIdx = i;
          bestStr = str;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  function computeTrickPoints() {
    let pts = 0;
    for (const c of trickCards)
      pts += cardTrickValue(c);
    return pts;
  }

  /* ================================================================
     MELDING
     ================================================================ */

  function computeMelds(hand) {
    const melds = [];
    let total = 0;

    // Marriages: K+Q same suit
    for (const suit of CE.SUITS) {
      const kings = countRankInSuit(hand, 'K', suit);
      const queens = countRankInSuit(hand, 'Q', suit);
      const marriages = Math.min(kings, queens);
      for (let i = 0; i < marriages; ++i) {
        const pts = suit === trumpSuit ? 40 : 20;
        const name = suit === trumpSuit ? 'Royal Marriage' : 'Marriage';
        melds.push({ name: name + ' (' + SUIT_SHORT[suit] + ')', points: pts });
        total += pts;
      }
    }

    // Pinochle: J of diamonds + Q of spades
    const jDiamonds = countRankInSuit(hand, 'J', 'diamonds');
    const qSpades = countRankInSuit(hand, 'Q', 'spades');
    const pinochles = Math.min(jDiamonds, qSpades);
    if (pinochles >= 2) {
      melds.push({ name: 'Double Pinochle', points: 300 });
      total += 300;
    } else if (pinochles === 1) {
      melds.push({ name: 'Pinochle', points: 40 });
      total += 40;
    }

    // Run in trump: A-10-K-Q-J of trump
    if (trumpSuit) {
      const hasA = countRankInSuit(hand, 'A', trumpSuit) > 0;
      const has10 = countRankInSuit(hand, '10', trumpSuit) > 0;
      const hasK = countRankInSuit(hand, 'K', trumpSuit) > 0;
      const hasQ = countRankInSuit(hand, 'Q', trumpSuit) > 0;
      const hasJ = countRankInSuit(hand, 'J', trumpSuit) > 0;
      if (hasA && has10 && hasK && hasQ && hasJ) {
        melds.push({ name: 'Run in Trump', points: 150 });
        total += 150;
      }
    }

    // Around melds
    const arounds = [
      { rank: 'A', name: 'Aces Around', points: 100 },
      { rank: 'K', name: 'Kings Around', points: 80 },
      { rank: 'Q', name: 'Queens Around', points: 60 },
      { rank: 'J', name: 'Jacks Around', points: 40 }
    ];
    for (const { rank, name, points } of arounds) {
      const suitCount = countRankAcrossSuits(hand, rank);
      if (suitCount === 4) {
        melds.push({ name, points });
        total += points;
      }
    }

    return { melds, total };
  }

  /* ================================================================
     AI BIDDING
     ================================================================ */

  function aiEstimateMelds(hand) {
    let est = 0;
    // Rough meld estimate without knowing trump
    for (const suit of CE.SUITS) {
      const k = countRankInSuit(hand, 'K', suit);
      const q = countRankInSuit(hand, 'Q', suit);
      est += Math.min(k, q) * 20;
    }
    const jd = countRankInSuit(hand, 'J', 'diamonds');
    const qs = countRankInSuit(hand, 'Q', 'spades');
    if (Math.min(jd, qs) >= 2)
      est += 300;
    else if (Math.min(jd, qs) >= 1)
      est += 40;

    const aroundRanks = ['A', 'K', 'Q', 'J'];
    const aroundValues = [100, 80, 60, 40];
    for (let i = 0; i < aroundRanks.length; ++i) {
      if (countRankAcrossSuits(hand, aroundRanks[i]) === 4)
        est += aroundValues[i];
    }
    return est;
  }

  function aiCountHighCards(hand) {
    let count = 0;
    for (const c of hand)
      if (c.rank === 'A' || c.rank === '10' || c.rank === 'K')
        ++count;
    return count;
  }

  function aiBid(playerIdx) {
    const hand = hands[playerIdx];
    const meldEst = aiEstimateMelds(hand);
    const highCards = aiCountHighCards(hand);
    const trickEst = highCards * 8;
    const totalEst = meldEst + trickEst;
    const maxBid = Math.floor(totalEst * 0.8);
    const nextBid = highBid > 0 ? highBid + BID_STEP : MIN_BID;

    if (meldEst >= 40 && highCards >= 3 && nextBid <= maxBid)
      return nextBid;
    if (meldEst >= 20 && highCards >= 4 && nextBid <= maxBid)
      return nextBid;
    if (nextBid <= MIN_BID && highCards >= 5)
      return nextBid;

    return 0;
  }

  function aiSelectTrump(playerIdx) {
    const hand = hands[playerIdx];
    let bestSuit = CE.SUITS[0];
    let bestScore = -1;
    for (const suit of CE.SUITS) {
      const cards = getCardsOfSuit(hand, suit);
      let suitScore = cards.length * 10;
      for (const c of cards) {
        if (c.rank === 'A') suitScore += 15;
        else if (c.rank === '10') suitScore += 12;
        else if (c.rank === 'K') suitScore += 5;
      }
      // Marriage bonus
      const hasK = cards.some(c => c.rank === 'K');
      const hasQ = cards.some(c => c.rank === 'Q');
      if (hasK && hasQ) suitScore += 20;
      if (suitScore > bestScore) {
        bestScore = suitScore;
        bestSuit = suit;
      }
    }
    return bestSuit;
  }

  /* ================================================================
     AI TRICK PLAY
     ================================================================ */

  function determineTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const isTrump = c.suit === trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStr) { bestIdx = i; bestStr = str; }
      } else {
        if (isTrump) { bestIdx = i; bestStr = str; bestIsTrump = true; }
        else if (c.suit === leadSuit && str > bestStr) { bestIdx = i; bestStr = str; }
      }
    }
    return trickPlayers[bestIdx];
  }

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;
    const validIdxs = getValidIndices(hand);
    if (validIdxs.length === 1) return validIdxs[0];

    const partnerIdx = (playerIdx + 2) % 4;
    let partnerWinning = false;
    if (trickCards.length > 0) {
      const curWinner = determineTrickWinnerPartial();
      partnerWinning = teamOf(curWinner) === teamOf(playerIdx);
    }

    const isLeading = trickCards.length === 0;

    if (isLeading) {
      // Lead trump if strong trump hand
      const trumpCards = validIdxs.filter(i => hand[i].suit === trumpSuit);
      if (trumpCards.length >= 3) {
        trumpCards.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return trumpCards[0];
      }
      // Otherwise lead highest non-trump
      const nonTrump = validIdxs.filter(i => hand[i].suit !== trumpSuit);
      const pool = nonTrump.length > 0 ? nonTrump : validIdxs;
      pool.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return pool[0];
    }

    const leadSuit = trickCards[0].suit;
    const followSuit = validIdxs.filter(i => hand[i].suit === leadSuit);

    if (followSuit.length > 0) {
      if (partnerWinning) {
        // Partner winning: play lowest of suit
        followSuit.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return followSuit[0];
      }
      // Try to head the trick
      followSuit.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return followSuit[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest
      validIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return validIdxs[0];
    }

    // Try to trump
    const trumpIdxs = validIdxs.filter(i => hand[i].suit === trumpSuit);
    if (trumpIdxs.length > 0) {
      // Estimate trick value
      let trickValue = 0;
      for (const c of trickCards)
        trickValue += cardTrickValue(c);
      // Trump with lowest winning trump for high-value tricks
      if (trickValue >= 10) {
        trumpIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return trumpIdxs[0];
      }
      // Low value trick: dump lowest card
      validIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return validIdxs[0];
    }

    // No trump available: dump lowest
    validIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return validIdxs[0];
  }

  /* ================================================================
     SETUP & DEALING
     ================================================================ */

  function deal() {
    const d = CE.shuffle(createPinochleDeck());
    hands = [[], [], [], []];
    for (let i = 0; i < 48; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);
    for (const c of hands[0])
      c.faceUp = true;

    trickCards = [];
    trickPlayers = [];
    meldPoints = [0, 0, 0, 0];
    trickPointsWon = [0, 0];
    tricksWon = [0, 0];
    trickCount = 0;
    roundOver = false;
    trumpSuit = null;
    highBid = 0;
    highBidder = -1;
    passCount = 0;
    bidPassed = [false, false, false, false];
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    hoverCardIdx = -1;
    hoverBidBtn = -1;
    hoveredTrumpSuit = null;
    meldDisplayTimer = 0;
    meldResults = [];

    currentBidder = (dealer + 1) % NUM_PLAYERS;
    phase = PHASE_BIDDING;

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    teamScores = [0, 0];
    gameOver = false;
    score = 0;
    roundNumber = 0;
    dealer = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function advanceBidding() {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const next = (currentBidder + i) % NUM_PLAYERS;
      if (!bidPassed[next]) {
        currentBidder = next;
        return;
      }
    }
    finalizeBidding();
  }

  function processBid(playerIdx, bid) {
    if (bid === 0) {
      bidPassed[playerIdx] = true;
      ++passCount;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[playerIdx] + ' passes', { color: '#aaa', size: 14 });
    } else {
      highBid = bid;
      highBidder = playerIdx;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[playerIdx] + ' bids ' + bid, { color: '#ff0', size: 14 });
    }

    if (passCount >= 3) {
      finalizeBidding();
      return;
    }
    advanceBidding();
  }

  function finalizeBidding() {
    if (highBidder < 0) {
      // Everyone passed - redeal
      dealer = (dealer + 1) % NUM_PLAYERS;
      deal();
      return;
    }
    if (highBidder === 0) {
      phase = PHASE_TRUMP_SELECT;
    } else {
      trumpSuit = aiSelectTrump(highBidder);
      startMelding();
    }
  }

  /* ================================================================
     MELDING PHASE
     ================================================================ */

  function startMelding() {
    phase = PHASE_MELDING;
    meldResults = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const result = computeMelds(hands[p]);
      meldPoints[p] = result.total;
      meldResults.push({ player: p, melds: result.melds, total: result.total });
    }
    meldDisplayTimer = MELD_DISPLAY_DELAY;

    // Add meld points to team trick-point tallies
    trickPointsWon[TEAM_A] += meldPoints[0] + meldPoints[2];
    trickPointsWon[TEAM_B] += meldPoints[1] + meldPoints[3];

    if (_host) {
      const teamAMeld = meldPoints[0] + meldPoints[2];
      const teamBMeld = meldPoints[1] + meldPoints[3];
      if (teamAMeld > 0)
        _host.floatingText.add(CANVAS_W / 2, 200, 'Team A melds: ' + teamAMeld + ' pts', { color: '#8cf', size: 16 });
      if (teamBMeld > 0)
        _host.floatingText.add(CANVAS_W / 2, 230, 'Team B melds: ' + teamBMeld + ' pts', { color: '#f88', size: 16 });
    }
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function startPlaying() {
    phase = PHASE_PLAYING;
    currentTurn = highBidder;
    trickLeader = highBidder;
    trickCards = [];
    trickPlayers = [];
    aiTurnTimer = 0;
  }

  function playCard(playerIdx, cardIdx) {
    const card = hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);

    if (trickCards.length >= NUM_PLAYERS) {
      phase = PHASE_TRICK_DONE;
      trickWinnerIdx = determineTrickWinner();
      trickDoneTimer = 0;
      return;
    }
    currentTurn = (currentTurn + 1) % NUM_PLAYERS;
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    const team = teamOf(winner);
    const pts = computeTrickPoints();
    ++trickCount;

    // Last trick bonus
    const isLastTrick = trickCount >= HAND_SIZE || hands.every(h => h.length === 0);
    const totalPts = pts + (isLastTrick ? 10 : 0);
    trickPointsWon[team] += totalPts;
    ++tricksWon[team];

    if (_host && totalPts > 0) {
      const label = PLAYER_NAMES[winner] + ' +' + totalPts + (isLastTrick ? ' (last trick!)' : '');
      const color = team === TEAM_A ? '#8cf' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 14 });
    }

    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (isLastTrick) {
      endRound();
      return;
    }

    currentTurn = winner;
    trickLeader = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  function endRound() {
    const bidTeam = teamOf(highBidder);
    const bidTeamPts = trickPointsWon[bidTeam];

    // Check if bidding team met their bid
    if (bidTeamPts >= highBid) {
      teamScores[bidTeam] += bidTeamPts;
    } else {
      teamScores[bidTeam] -= highBid;
      if (_host) {
        const teamName = bidTeam === TEAM_A ? 'Team A' : 'Team B';
        _host.floatingText.add(CANVAS_W / 2, 250, teamName + ' set! -' + highBid, { color: '#f44', size: 18 });
      }
    }

    // Non-bidding team always gets their points
    const otherTeam = bidTeam === TEAM_A ? TEAM_B : TEAM_A;
    teamScores[otherTeam] += trickPointsWon[otherTeam];

    score = teamScores[TEAM_A];
    if (_host) _host.onScoreChanged(score);

    ++roundNumber;
    roundOver = true;
    dealer = (dealer + 1) % NUM_PLAYERS;

    if (teamScores[TEAM_A] >= GAME_WIN_SCORE || teamScores[TEAM_B] >= GAME_WIN_SCORE) {
      gameOver = true;
      if (_host) {
        const won = teamScores[TEAM_A] >= GAME_WIN_SCORE;
        const msg = won ? 'Your team wins!' : 'Opponents win!';
        const col = won ? '#4f4' : '#f88';
        _host.floatingText.add(CANVAS_W / 2, 220, msg, { color: col, size: 24 });
        if (won) _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }

    phase = PHASE_ROUND_SCORE;
  }

  /* ================================================================
     DRAWING - LAYOUT
     ================================================================ */

  const PLAYER_HAND_Y = 470;

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 240;
    const spacing = Math.min(48, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2 - 40;
    return startX + idx * spacing;
  }

  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2 - 40, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 80, y: 260 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2 - 40, y: 200 },
    { x: CANVAS_W / 2 + 10, y: 260 }
  ];

  const AI_POS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 195;
    const py = 10;
    const pw = 185;
    const ph = 155;

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
    _ctx.fillText('Pinochle', px + 10, py + 6);

    _ctx.font = '11px sans-serif';
    let y = py + 24;

    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Team A (You+Partner)', px + 10, y);
    y += 14;
    _ctx.fillStyle = '#fff';
    _ctx.fillText('Score: ' + teamScores[TEAM_A], px + 10, y);
    y += 16;

    _ctx.fillStyle = '#f88';
    _ctx.fillText('Team B (West+East)', px + 10, y);
    y += 14;
    _ctx.fillStyle = '#fff';
    _ctx.fillText('Score: ' + teamScores[TEAM_B], px + 10, y);
    y += 18;

    if (trumpSuit) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.fillText('Trump: ' + SUIT_NAMES[trumpSuit], px + 10, y);
      y += 14;
    }
    if (highBidder >= 0) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.fillText('Bid: ' + highBid + ' (' + PLAYER_NAMES[highBidder] + ')', px + 10, y);
      y += 14;
    }
    if (phase === PHASE_PLAYING || phase === PHASE_TRICK_DONE) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.fillText('Trick ' + (trickCount + 1) + '/' + HAND_SIZE, px + 10, y);
    }

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - HANDS
     ================================================================ */

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (phase === PHASE_PLAYING && i === hoverCardIdx && currentTurn === 0)
        y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      if (_host && _host.hintsEnabled && phase === PHASE_PLAYING && currentTurn === 0) {
        if (isValidPlay(hand[i], hand))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }

      // Dim invalid cards
      if (phase === PHASE_PLAYING && currentTurn === 0 && !isValidPlay(hand[i], hand)) {
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
      const pos = AI_POS[p];
      const count = hands[p].length;

      _ctx.fillStyle = (currentTurn === p && phase === PHASE_PLAYING) ? '#ff0' : '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'horizontal') {
        _ctx.textAlign = 'center';
        _ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y - 2);
        const spacing = Math.min(22, 360 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, pos.y + 10, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const spacing = Math.min(18, 250 / Math.max(count, 1));
        const startY = pos.y + 20;

        _ctx.save();
        _ctx.translate(pos.x + (p === 1 ? 20 : 0), pos.y);
        _ctx.fillStyle = (currentTurn === p && phase === PHASE_PLAYING) ? '#ff0' : '#aaa';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'bottom';
        _ctx.fillText(pos.label + ' (' + count + ')', CE.CARD_W * 0.25, -2);
        _ctx.restore();

        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(_ctx, cx, startY + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(CANVAS_W / 2 - 40, 280, 90, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const playerIdx = trickPlayers[i];
      const pos = TRICK_POS[playerIdx];
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);
    }

    if (phase === PHASE_TRICK_DONE && trickWinnerIdx >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[trickWinnerIdx] + ' takes';
      _ctx.fillText(who + ' the trick', CANVAS_W / 2 - 40, 185);
    }
  }

  /* ================================================================
     DRAWING - BIDDING UI
     ================================================================ */

  const BID_BTN_W = 50;
  const BID_BTN_H = 28;

  function getBidButtons() {
    const nextMin = highBid > 0 ? highBid + BID_STEP : MIN_BID;
    const bids = [];
    for (let b = nextMin; b <= nextMin + BID_STEP * 4 && b <= 100; b += BID_STEP)
      bids.push(b);
    bids.push(0); // pass
    return bids;
  }

  function bidBtnRect(idx, total) {
    const totalW = total * (BID_BTN_W + 4) - 4;
    const startX = (CANVAS_W - totalW) / 2 - 40;
    return { x: startX + idx * (BID_BTN_W + 4), y: 340, w: BID_BTN_W, h: BID_BTN_H };
  }

  function drawBiddingUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding Phase', CANVAS_W / 2 - 40, 220);

    // Show current bid info
    _ctx.font = '13px sans-serif';
    _ctx.fillStyle = '#aaa';
    if (highBidder >= 0)
      _ctx.fillText('High bid: ' + highBid + ' by ' + PLAYER_NAMES[highBidder], CANVAS_W / 2 - 40, 248);
    else
      _ctx.fillText('Minimum bid: ' + MIN_BID, CANVAS_W / 2 - 40, 248);

    // Show bid status
    let y = 268;
    _ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (bidPassed[p]) {
        _ctx.fillStyle = '#888';
        _ctx.fillText(PLAYER_NAMES[p] + ': Passed', CANVAS_W / 2 - 40, y);
        y += 16;
      }
    }

    if (currentBidder === 0 && !bidPassed[0]) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '13px sans-serif';
      _ctx.fillText('Your bid:', CANVAS_W / 2 - 40, 320);

      const btns = getBidButtons();
      for (let i = 0; i < btns.length; ++i) {
        const r = bidBtnRect(i, btns.length);
        const label = btns[i] === 0 ? 'Pass' : '' + btns[i];
        const isHover = hoverBidBtn === i;
        const bg = btns[i] === 0 ? (isHover ? '#833' : '#633') : (isHover ? '#2a6a2a' : '#1a4a1a');
        const border = btns[i] === 0 ? '#a66' : '#4a4';
        CE.drawButton(_ctx, r.x, r.y, r.w, r.h, label, { bg, border, textColor: '#fff', fontSize: 12 });
      }
    } else if (!bidPassed[currentBidder]) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.fillText(PLAYER_NAMES[currentBidder] + ' is thinking...', CANVAS_W / 2 - 40, 320);
    }
  }

  /* ================================================================
     DRAWING - TRUMP SELECTION UI
     ================================================================ */

  function drawTrumpSelectUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('You won the bid (' + highBid + ')!', CANVAS_W / 2 - 40, 220);

    _ctx.fillStyle = '#ff0';
    _ctx.font = '14px sans-serif';
    _ctx.fillText('Select trump suit:', CANVAS_W / 2 - 40, 250);

    const btnW = 90;
    const btnH = 32;
    const gap = 8;
    const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2 - 40;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const suit = CE.SUITS[i];
      const x = startX + i * (btnW + gap);
      const y = 280;
      const isHover = hoveredTrumpSuit === suit;
      const color = (suit === 'hearts' || suit === 'diamonds') ? '#a33' : '#333';
      const bg = isHover ? '#2a5a2a' : '#1a3a1a';
      CE.drawButton(_ctx, x, y, btnW, btnH, SUIT_NAMES[suit], { bg, border: isHover ? '#8f8' : '#4a4', textColor: '#fff', fontSize: 12 });
    }
  }

  /* ================================================================
     DRAWING - MELDING UI
     ================================================================ */

  function drawMeldingUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const px = CANVAS_W / 2 - 240;
    const py = 150;
    const pw = 400;
    let ph = 40;
    for (const mr of meldResults)
      ph += 20 + mr.melds.length * 16;
    ph = Math.max(ph, 100);

    CE.drawRoundedRect(_ctx, px, py, pw, ph, 8);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Melds (Trump: ' + SUIT_NAMES[trumpSuit] + ')', CANVAS_W / 2, py + 10);

    let y = py + 34;
    for (const mr of meldResults) {
      const teamColor = teamOf(mr.player) === TEAM_A ? '#8cf' : '#f88';
      _ctx.fillStyle = teamColor;
      _ctx.font = 'bold 12px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[mr.player] + ' (' + mr.total + ' pts):', px + 16, y);
      y += 16;

      _ctx.font = '11px sans-serif';
      _ctx.fillStyle = '#ccc';
      if (mr.melds.length === 0) {
        _ctx.fillText('  No melds', px + 24, y);
        y += 16;
      } else {
        for (const m of mr.melds) {
          _ctx.fillText('  ' + m.name + ': ' + m.points, px + 24, y);
          y += 16;
        }
      }
      y += 4;
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    const remaining = Math.max(0, Math.ceil(meldDisplayTimer));
    _ctx.fillText('Starting play in ' + remaining + 's...', CANVAS_W / 2, y + 4);
    _ctx.restore();
  }

  /* ================================================================
     DRAWING - ROUND SCORE UI
     ================================================================ */

  function drawRoundScoreUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    if (gameOver) {
      const won = teamScores[TEAM_A] >= GAME_WIN_SCORE;
      _ctx.fillStyle = won ? '#4f4' : '#f44';
      _ctx.fillText(won ? 'Your Team Wins!' : 'Opponents Win!', CANVAS_W / 2, 180);
      _ctx.fillStyle = '#fff';
      _ctx.font = '16px sans-serif';
      _ctx.fillText('Team A: ' + teamScores[TEAM_A] + '  |  Team B: ' + teamScores[TEAM_B], CANVAS_W / 2, 220);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to start a new game', CANVAS_W / 2, 260);
    } else {
      _ctx.fillText('Round ' + roundNumber + ' Complete', CANVAS_W / 2, 170);

      let y = 210;
      _ctx.font = '14px sans-serif';

      const bidTeam = teamOf(highBidder);
      const bidTeamName = bidTeam === TEAM_A ? 'Team A' : 'Team B';
      const otherName = bidTeam === TEAM_A ? 'Team B' : 'Team A';
      const bidMet = trickPointsWon[bidTeam] >= highBid;

      _ctx.fillStyle = '#ff0';
      _ctx.fillText(PLAYER_NAMES[highBidder] + ' bid ' + highBid + ' (Trump: ' + SUIT_NAMES[trumpSuit] + ')', CANVAS_W / 2, y);
      y += 24;

      _ctx.fillStyle = bidMet ? '#8cf' : '#f44';
      _ctx.fillText(bidTeamName + ': ' + trickPointsWon[bidTeam] + ' pts ' + (bidMet ? '(made it!)' : '(SET! -' + highBid + ')'), CANVAS_W / 2, y);
      y += 22;

      const otherTeam = bidTeam === TEAM_A ? TEAM_B : TEAM_A;
      _ctx.fillStyle = '#f88';
      _ctx.fillText(otherName + ': ' + trickPointsWon[otherTeam] + ' pts', CANVAS_W / 2, y);
      y += 28;

      _ctx.fillStyle = '#8cf';
      _ctx.fillText('Team A Total: ' + teamScores[TEAM_A], CANVAS_W / 2, y);
      y += 20;
      _ctx.fillStyle = '#f88';
      _ctx.fillText('Team B Total: ' + teamScores[TEAM_B], CANVAS_W / 2, y);
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
    if (phase !== PHASE_PLAYING) return;
    if (currentTurn === 0 && trickCards.length < NUM_PLAYERS && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    } else if (currentTurn !== 0 && !roundOver) {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText(PLAYER_NAMES[currentTurn] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
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
    _ctx.fillText('Pinochle', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + ' \u2014 Dealer: ' + PLAYER_NAMES[dealer], 10, 28);

    drawScorePanel();
    drawAIHands();

    if (phase === PHASE_PLAYING || phase === PHASE_TRICK_DONE) {
      drawTrickArea();
      drawStatusBar();
    }

    drawPlayerHand();

    if (phase === PHASE_BIDDING)
      drawBiddingUI();
    else if (phase === PHASE_TRUMP_SELECT)
      drawTrumpSelectUI();
    else if (phase === PHASE_MELDING)
      drawMeldingUI();
    else if (phase === PHASE_ROUND_SCORE)
      drawRoundScoreUI();
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
      if (score !== 0) {
        teamScores[TEAM_A] = score;
        teamScores[TEAM_B] = 0;
      }
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      // Round score - advance
      if (phase === PHASE_ROUND_SCORE) {
        if (gameOver) {
          setupGame();
        } else {
          roundOver = false;
          deal();
        }
        return;
      }

      // Bidding - player bid
      if (phase === PHASE_BIDDING && currentBidder === 0 && !bidPassed[0]) {
        const btns = getBidButtons();
        for (let i = 0; i < btns.length; ++i) {
          const r = bidBtnRect(i, btns.length);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            processBid(0, btns[i]);
            return;
          }
        }
        return;
      }

      // Trump selection
      if (phase === PHASE_TRUMP_SELECT) {
        const btnW = 90;
        const btnH = 32;
        const gap = 8;
        const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
        const startX = (CANVAS_W - totalW) / 2 - 40;

        for (let i = 0; i < CE.SUITS.length; ++i) {
          const x = startX + i * (btnW + gap);
          if (CE.isInRect(mx, my, x, 280, btnW, btnH)) {
            trumpSuit = CE.SUITS[i];
            startMelding();
            return;
          }
        }
        return;
      }

      // Playing - player's turn
      if (phase === PHASE_PLAYING && currentTurn === 0) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        const hand = hands[0];
        if (isValidPlay(hand[idx], hand)) {
          playCard(0, idx);
        } else {
          let reason = 'Invalid play!';
          const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
          if (leadSuit && hasSuit(hand, leadSuit) && hand[idx].suit !== leadSuit)
            reason = 'Must follow suit!';
          else if (!hasSuit(hand, leadSuit) && hasSuit(hand, trumpSuit) && hand[idx].suit !== trumpSuit)
            reason = 'Must play trump!';
          else
            reason = 'Must head the trick!';

          if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
        }
        return;
      }
    },

    handlePointerMove(mx, my) {
      hoverCardIdx = -1;
      hoverBidBtn = -1;
      hoveredTrumpSuit = null;

      if (phase === PHASE_PLAYING && currentTurn === 0)
        hoverCardIdx = hitTestPlayerCard(mx, my);

      if (phase === PHASE_BIDDING && currentBidder === 0 && !bidPassed[0]) {
        const btns = getBidButtons();
        for (let i = 0; i < btns.length; ++i) {
          const r = bidBtnRect(i, btns.length);
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            hoverBidBtn = i;
            break;
          }
        }
      }

      if (phase === PHASE_TRUMP_SELECT) {
        const btnW = 90;
        const btnH = 32;
        const gap = 8;
        const totalW = CE.SUITS.length * btnW + (CE.SUITS.length - 1) * gap;
        const startX = (CANVAS_W - totalW) / 2 - 40;
        for (let i = 0; i < CE.SUITS.length; ++i) {
          const x = startX + i * (btnW + gap);
          if (CE.isInRect(mx, my, x, 280, btnW, btnH)) {
            hoveredTrumpSuit = CE.SUITS[i];
            break;
          }
        }
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_SCORE) return;

      // Meld display timer
      if (phase === PHASE_MELDING) {
        meldDisplayTimer -= dt;
        if (meldDisplayTimer <= 0)
          startPlaying();
        return;
      }

      // Trick done timer
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      // AI bidding
      if (phase === PHASE_BIDDING && currentBidder !== 0 && !bidPassed[currentBidder]) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          const bid = aiBid(currentBidder);
          processBid(currentBidder, bid);
        }
        return;
      }

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
      trickCards = [];
      trickPlayers = [];
      teamScores = [0, 0];
      meldPoints = [0, 0, 0, 0];
      trickPointsWon = [0, 0];
      tricksWon = [0, 0];
      roundOver = false;
      gameOver = false;
      phase = PHASE_BIDDING;
      trumpSuit = null;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      hoverBidBtn = -1;
      hoveredTrumpSuit = null;
      meldResults = [];
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

  SZ.CardGames.registerVariant('pinochle', module);

})();
