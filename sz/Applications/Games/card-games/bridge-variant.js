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

  const SUIT_NAMES = { clubs: 'Clubs', diamonds: 'Diamonds', hearts: 'Hearts', spades: 'Spades' };
  const SUIT_SYMBOLS = { clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660' };
  const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const STRAIN_ORDER = ['clubs', 'diamonds', 'hearts', 'spades', 'notrump'];
  const STRAIN_NAMES = { clubs: 'Clubs', diamonds: 'Diamonds', hearts: 'Hearts', spades: 'Spades', notrump: 'No Trump' };
  const STRAIN_SHORT = { clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660', notrump: 'NT' };

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 13;

  /* Players: 0=South(human), 1=West(AI), 2=North(AI partner/dummy), 3=East(AI) */
  const PLAYER_NAMES = ['South (You)', 'West', 'North', 'East'];
  const PLAYER_SHORT = ['S', 'W', 'N', 'E'];
  const SOUTH = 0;
  const WEST = 1;
  const NORTH = 2;
  const EAST = 3;

  /* Partnerships: NS = 0,2  EW = 1,3 */
  const TEAM_NS = 0;
  const TEAM_EW = 1;

  /* ── Phases ── */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;
  const PHASE_GAME_OVER = 4;

  /* ── HCP values ── */
  const HCP_VALUES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let trickCards = [];
  let trickPlayers = [];

  /* Bidding state */
  let biddingPlayer = 0;
  let bidHistory = [];           // array of { player, bid } where bid = { level, strain } or 'pass'
  let consecutivePasses = 0;
  let contractBid = null;        // { level, strain }
  let contractPlayer = -1;       // declarer
  let dummyPlayer = -1;
  let defendingLead = -1;

  /* Play state */
  let currentTurn = 0;
  let trickLeader = 0;
  let trickCount = 0;
  let tricksWonNS = 0;
  let tricksWonEW = 0;
  let trumpSuit = null;          // null for no trump

  /* Scoring */
  let nsAboveLine = 0;
  let nsBelow = 0;
  let ewAboveLine = 0;
  let ewBelow = 0;
  let nsGamesWon = 0;
  let ewGamesWon = 0;
  let nsVulnerable = false;
  let ewVulnerable = false;
  let dealer = SOUTH;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let phase = PHASE_BIDDING;

  let trickWinnerIdx = -1;
  let trickDoneTimer = 0;
  const TRICK_DONE_DELAY = 1.0;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.6;
  const AI_BID_DELAY = 0.5;

  let hoveredCard = -1;
  let hoveredBidBtn = -1;
  let hoveredPassBtn = false;
  let statusMessage = '';
  let dummyRevealed = false;
  let openingLeadMade = false;

  /* ================================================================
     TEAM / PLAYER UTILITIES
     ================================================================ */

  function teamOf(p) {
    return (p === SOUTH || p === NORTH) ? TEAM_NS : TEAM_EW;
  }

  function partnerOf(p) {
    return (p + 2) % NUM_PLAYERS;
  }

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function isDeclarerSide(p) {
    return teamOf(p) === teamOf(contractPlayer);
  }

  function isDummy(p) {
    return p === dummyPlayer;
  }

  /* Who controls this player's hand? Declarer plays for dummy. */
  function controllerOf(p) {
    if (p === dummyPlayer) return contractPlayer;
    return p;
  }

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrd = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    hand.sort((a, b) => {
      const sd = suitOrd[a.suit] - suitOrd[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function hasSuit(hand, suit) {
    return hand.some(c => c.suit === suit);
  }

  function countSuit(hand, suit) {
    let n = 0;
    for (const c of hand)
      if (c.suit === suit) ++n;
    return n;
  }

  function getHCP(hand) {
    let pts = 0;
    for (const c of hand)
      pts += HCP_VALUES[c.rank] || 0;
    return pts;
  }

  function getDistributionPoints(hand) {
    let pts = 0;
    for (const s of CE.SUITS) {
      const cnt = countSuit(hand, s);
      if (cnt === 0) pts += 3;       // void
      else if (cnt === 1) pts += 2;  // singleton
      else if (cnt === 2) pts += 1;  // doubleton
    }
    return pts;
  }

  function getLongestSuit(hand) {
    let best = null;
    let bestCount = 0;
    for (const s of CE.SUITS) {
      const cnt = countSuit(hand, s);
      if (cnt > bestCount) {
        bestCount = cnt;
        best = s;
      }
    }
    return best;
  }

  /* ================================================================
     BIDDING UTILITIES
     ================================================================ */

  function bidToString(bid) {
    if (bid === 'pass') return 'Pass';
    return bid.level + STRAIN_SHORT[bid.strain];
  }

  function bidIsHigher(a, b) {
    if (!b) return true;
    if (a.level > b.level) return true;
    if (a.level === b.level)
      return STRAIN_ORDER.indexOf(a.strain) > STRAIN_ORDER.indexOf(b.strain);
    return false;
  }

  function getLastNonPassBid() {
    for (let i = bidHistory.length - 1; i >= 0; --i)
      if (bidHistory[i].bid !== 'pass')
        return bidHistory[i].bid;
    return null;
  }

  function getAllBids() {
    const bids = [];
    for (const h of bidHistory)
      if (h.bid !== 'pass')
        bids.push(h);
    return bids;
  }

  /* Find declarer: first player in the winning partnership who bid the winning strain */
  function findDeclarer(winBid, winningPlayer) {
    const winTeam = teamOf(winningPlayer);
    for (const h of bidHistory) {
      if (h.bid === 'pass') continue;
      if (teamOf(h.player) === winTeam && h.bid.strain === winBid.strain)
        return h.player;
    }
    return winningPlayer;
  }

  /* ================================================================
     BIDDING BUTTON GRID
     ================================================================ */

  const BID_BTN_W = 42;
  const BID_BTN_H = 26;
  const BID_BTN_GAP = 3;
  const BID_AREA_X = 260;
  const BID_AREA_Y = 170;
  const PASS_BTN = { x: 260, y: 360, w: 80, h: 28 };

  /* 7 rows x 5 columns: levels 1-7 x strains (C D H S NT) */
  function bidBtnRect(level, strainIdx) {
    return {
      x: BID_AREA_X + strainIdx * (BID_BTN_W + BID_BTN_GAP),
      y: BID_AREA_Y + (level - 1) * (BID_BTN_H + BID_BTN_GAP),
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  function bidBtnIndex(level, strainIdx) {
    return (level - 1) * 5 + strainIdx;
  }

  function bidFromIndex(idx) {
    const level = Math.floor(idx / 5) + 1;
    const strainIdx = idx % 5;
    return { level, strain: STRAIN_ORDER[strainIdx] };
  }

  /* ================================================================
     VALIDITY - PLAY
     ================================================================ */

  function isValidPlay(card, hand) {
    if (trickCards.length === 0) return true;
    const leadSuit = trickCards[0].suit;
    if (hasSuit(hand, leadSuit))
      return card.suit === leadSuit;
    return true;
  }

  function getValidIndices(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand))
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
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = trumpSuit && trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cTrump = trumpSuit && c.suit === trumpSuit;
      const cStr = cardStrength(c);

      if (bestIsTrump) {
        if (cTrump && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      } else {
        if (cTrump) {
          bestIdx = i;
          bestStr = cStr;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  function resolveTrickWinnerPartial() {
    if (trickCards.length === 0) return -1;
    const leadSuit = trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(trickCards[0]);
    let bestIsTrump = trumpSuit && trickCards[0].suit === trumpSuit;

    for (let i = 1; i < trickCards.length; ++i) {
      const c = trickCards[i];
      const cTrump = trumpSuit && c.suit === trumpSuit;
      const cStr = cardStrength(c);

      if (bestIsTrump) {
        if (cTrump && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      } else {
        if (cTrump) {
          bestIdx = i;
          bestStr = cStr;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return trickPlayers[bestIdx];
  }

  /* ================================================================
     AI BIDDING
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = hands[playerIdx];
    const hcp = getHCP(hand);
    const dp = getDistributionPoints(hand);
    const totalPts = hcp + dp;
    const lastBid = getLastNonPassBid();
    const partner = partnerOf(playerIdx);

    /* Check if partner has bid */
    let partnerBid = null;
    for (const h of bidHistory)
      if (h.player === partner && h.bid !== 'pass')
        partnerBid = h.bid;

    /* Determine a suit to bid */
    let bestSuit = getLongestSuit(hand);
    let bestSuitCount = countSuit(hand, bestSuit);

    /* With balanced hand and 15-17 HCP, prefer notrump */
    const isBalanced = CE.SUITS.every(s => countSuit(hand, s) >= 2);

    /* Opening bid logic */
    if (!lastBid && !partnerBid) {
      if (totalPts < 13) return 'pass';

      if (isBalanced && hcp >= 15 && hcp <= 17)
        return { level: 1, strain: 'notrump' };

      if (bestSuitCount >= 5)
        return { level: 1, strain: bestSuit };

      /* Bid longest minor with short major suits */
      const clubCount = countSuit(hand, 'clubs');
      const diamondCount = countSuit(hand, 'diamonds');
      return { level: 1, strain: diamondCount >= clubCount ? 'diamonds' : 'clubs' };
    }

    /* Responding to partner's bid */
    if (partnerBid && !lastBid) {
      if (totalPts < 6) return 'pass';

      /* Raise partner's suit */
      if (partnerBid.strain !== 'notrump') {
        const support = countSuit(hand, partnerBid.strain);
        if (support >= 3 && totalPts >= 6) {
          const newLevel = partnerBid.level + (totalPts >= 13 ? 1 : 0);
          if (newLevel <= 4) {
            const candidate = { level: Math.min(newLevel + 1, 4), strain: partnerBid.strain };
            if (bidIsHigher(candidate, lastBid))
              return candidate;
          }
        }
      }

      /* Bid new suit at 1 level if possible */
      if (bestSuitCount >= 4 && totalPts >= 6) {
        const candidate = { level: 1, strain: bestSuit };
        if (bidIsHigher(candidate, lastBid || partnerBid))
          return candidate;
        if (totalPts >= 10) {
          const candidate2 = { level: 2, strain: bestSuit };
          if (bidIsHigher(candidate2, lastBid || partnerBid))
            return candidate2;
        }
      }

      /* Bid NT */
      if (isBalanced && hcp >= 6) {
        const ntLevel = partnerBid.strain === 'notrump' ? partnerBid.level + 1 : 1;
        if (ntLevel <= 3) {
          const candidate = { level: ntLevel, strain: 'notrump' };
          if (bidIsHigher(candidate, lastBid || partnerBid))
            return candidate;
        }
      }

      return 'pass';
    }

    /* Competitive bidding: opponent has bid, we respond */
    if (lastBid) {
      if (totalPts < 10) return 'pass';

      /* Try to overcall with a good 5+ card suit */
      if (bestSuitCount >= 5 && hcp >= 10) {
        for (let lvl = lastBid.level; lvl <= Math.min(lastBid.level + 1, 3); ++lvl) {
          const candidate = { level: lvl, strain: bestSuit };
          if (bidIsHigher(candidate, lastBid))
            return candidate;
        }
      }

      /* NT overcall with 15-18 HCP and balanced hand */
      if (isBalanced && hcp >= 15 && hcp <= 18) {
        const candidate = { level: lastBid.level, strain: 'notrump' };
        if (bidIsHigher(candidate, lastBid))
          return candidate;
        const candidate2 = { level: lastBid.level + 1, strain: 'notrump' };
        if (candidate2.level <= 3 && bidIsHigher(candidate2, lastBid))
          return candidate2;
      }

      return 'pass';
    }

    return 'pass';
  }

  /* ================================================================
     AI PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const isLeading = trickCards.length === 0;
    const partner = partnerOf(playerIdx);

    /* Check if partner is winning */
    let partnerWinning = false;
    if (trickCards.length > 0) {
      const tempWinner = resolveTrickWinnerPartial();
      partnerWinning = teamOf(tempWinner) === teamOf(playerIdx);
    }

    if (isLeading) {
      /* Lead partner's suit if known from bidding */
      /* Otherwise lead through declarer -- lead low from long suit */
      const nonTrump = valid.filter(i => !trumpSuit || hand[i].suit !== trumpSuit);
      const pool = nonTrump.length > 0 ? nonTrump : valid;

      /* Lead 4th best from longest suit */
      let bestSuit = null;
      let bestLen = 0;
      for (const s of CE.SUITS) {
        if (s === trumpSuit) continue;
        const suitCards = pool.filter(i => hand[i].suit === s);
        if (suitCards.length > bestLen) {
          bestLen = suitCards.length;
          bestSuit = s;
        }
      }

      if (bestSuit) {
        const suitCards = pool.filter(i => hand[i].suit === bestSuit);
        suitCards.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        /* Lead 4th best (or lowest if fewer than 4) */
        const idx = Math.max(0, suitCards.length - 4);
        return suitCards[idx];
      }

      pool.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return pool[0];
    }

    const leadSuit = trickCards[0].suit;
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      /* Second hand low */
      if (trickCards.length === 1) {
        followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return followIdxs[0];
      }

      /* Third hand high */
      if (trickCards.length === 2 && !partnerWinning) {
        followIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
        return followIdxs[0];
      }

      /* Fourth hand: play just enough to win, or dump lowest */
      if (trickCards.length === 3) {
        if (partnerWinning) {
          followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
          return followIdxs[0];
        }
        /* Try to win with minimum */
        const currentBest = Math.max(...trickCards.filter(c => c.suit === leadSuit).map(c => cardStrength(c)));
        const winners = followIdxs.filter(i => cardStrength(hand[i]) > currentBest);
        if (winners.length > 0) {
          winners.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
          return winners[0];
        }
        followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return followIdxs[0];
      }

      /* Default: partner winning => lowest, else highest */
      if (partnerWinning) {
        followIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
        return followIdxs[0];
      }
      followIdxs.sort((a, b) => cardStrength(hand[b]) - cardStrength(hand[a]));
      return followIdxs[0];
    }

    /* Can't follow suit */
    if (partnerWinning) {
      /* Dump lowest non-trump */
      const nonTrump = valid.filter(i => !trumpSuit || hand[i].suit !== trumpSuit);
      const dump = nonTrump.length > 0 ? nonTrump : valid;
      dump.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
      return dump[0];
    }

    /* Trump in with lowest trump if possible */
    if (trumpSuit) {
      const trumpIdxs = valid.filter(i => hand[i].suit === trumpSuit);
      if (trumpIdxs.length > 0) {
        /* Check if existing trump in trick */
        const trickTrumps = trickCards.filter(c => c.suit === trumpSuit);
        if (trickTrumps.length > 0) {
          const bestTrump = Math.max(...trickTrumps.map(c => cardStrength(c)));
          const overTrumps = trumpIdxs.filter(i => cardStrength(hand[i]) > bestTrump);
          if (overTrumps.length > 0) {
            overTrumps.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
            return overTrumps[0];
          }
        } else {
          trumpIdxs.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
          return trumpIdxs[0];
        }
      }
    }

    /* Dump lowest */
    valid.sort((a, b) => cardStrength(hand[a]) - cardStrength(hand[b]));
    return valid[0];
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreContract() {
    const declarerTeam = teamOf(contractPlayer);
    const tricksMade = declarerTeam === TEAM_NS ? tricksWonNS : tricksWonEW;
    const contracted = contractBid.level + 6;
    const over = tricksMade - contracted;
    const under = contracted - tricksMade;
    const vulnerable = declarerTeam === TEAM_NS ? nsVulnerable : ewVulnerable;

    let belowPts = 0;
    let abovePts = 0;
    let defenseAbove = 0;

    if (over >= 0) {
      /* Made the contract */
      const strain = contractBid.strain;
      const level = contractBid.level;

      /* Below the line: trick value */
      if (strain === 'clubs' || strain === 'diamonds')
        belowPts = level * 20;
      else if (strain === 'hearts' || strain === 'spades')
        belowPts = level * 30;
      else if (strain === 'notrump')
        belowPts = 40 + (level - 1) * 30;

      /* Overtricks */
      if (over > 0)
        abovePts = over * (vulnerable ? 30 : 20);

      /* Slam bonuses */
      if (contracted >= 12)
        abovePts += vulnerable ? 750 : 500;   // small slam
      if (contracted >= 13)
        abovePts += vulnerable ? 750 : 500;   // grand slam (additional)

      /* Apply to correct team */
      if (declarerTeam === TEAM_NS) {
        nsBelow += belowPts;
        nsAboveLine += abovePts;
      } else {
        ewBelow += belowPts;
        ewAboveLine += abovePts;
      }

      /* Check for game (100 below the line) */
      if (declarerTeam === TEAM_NS && nsBelow >= 100) {
        ++nsGamesWon;
        nsAboveLine += nsBelow;
        ewAboveLine += ewBelow;
        nsBelow = 0;
        ewBelow = 0;
        nsVulnerable = nsGamesWon >= 1;
        ewVulnerable = ewGamesWon >= 1;
      } else if (declarerTeam === TEAM_EW && ewBelow >= 100) {
        ++ewGamesWon;
        nsAboveLine += nsBelow;
        ewAboveLine += ewBelow;
        nsBelow = 0;
        ewBelow = 0;
        nsVulnerable = nsGamesWon >= 1;
        ewVulnerable = ewGamesWon >= 1;
      }
    } else {
      /* Went down */
      const penalty = vulnerable ? 100 : 50;
      defenseAbove = under * penalty;

      if (declarerTeam === TEAM_NS)
        ewAboveLine += defenseAbove;
      else
        nsAboveLine += defenseAbove;
    }

    /* Total score = above + below for NS */
    score = nsAboveLine + nsBelow;
    if (_host) _host.onScoreChanged(score);

    return { tricksMade, contracted, over, under, belowPts, abovePts, defenseAbove, declarerTeam, vulnerable };
  }

  function checkRubberOver() {
    return nsGamesWon >= 2 || ewGamesWon >= 2;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    for (const c of hands[SOUTH])
      c.faceUp = true;

    trickCards = [];
    trickPlayers = [];
    bidHistory = [];
    consecutivePasses = 0;
    contractBid = null;
    contractPlayer = -1;
    dummyPlayer = -1;
    defendingLead = -1;
    trumpSuit = null;
    trickCount = 0;
    tricksWonNS = 0;
    tricksWonEW = 0;
    roundOver = false;
    dummyRevealed = false;
    openingLeadMade = false;

    phase = PHASE_BIDDING;
    biddingPlayer = leftOf(dealer);
    aiTurnTimer = 0;
    trickWinnerIdx = -1;
    trickDoneTimer = 0;
    hoveredCard = -1;
    hoveredBidBtn = -1;
    hoveredPassBtn = false;
    statusMessage = '';

    if (_host) {
      for (let i = 0; i < hands[SOUTH].length; ++i)
        _host.dealCardAnim(hands[SOUTH][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[SOUTH].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    nsAboveLine = 0;
    nsBelow = 0;
    ewAboveLine = 0;
    ewBelow = 0;
    nsGamesWon = 0;
    ewGamesWon = 0;
    nsVulnerable = false;
    ewVulnerable = false;
    dealer = SOUTH;
    gameOver = false;
    score = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function placeBid(playerIdx, bid) {
    bidHistory.push({ player: playerIdx, bid: bid });

    if (bid === 'pass') {
      ++consecutivePasses;

      /* All 4 pass initially => redeal */
      if (bidHistory.length === 4 && consecutivePasses === 4) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 280, 'All pass \u2014 redeal!', { color: '#ff0', size: 16 });
        dealer = leftOf(dealer);
        deal();
        return;
      }

      /* 3 consecutive passes after at least one bid => auction ends */
      if (consecutivePasses >= 3 && getAllBids().length > 0) {
        finishBidding();
        return;
      }
    } else {
      consecutivePasses = 0;
    }

    biddingPlayer = leftOf(biddingPlayer);
    aiTurnTimer = 0;
  }

  function finishBidding() {
    const winningBidEntry = getAllBids()[getAllBids().length - 1];
    contractBid = winningBidEntry.bid;
    contractPlayer = findDeclarer(contractBid, winningBidEntry.player);
    dummyPlayer = partnerOf(contractPlayer);
    trumpSuit = contractBid.strain === 'notrump' ? null : contractBid.strain;
    defendingLead = leftOf(contractPlayer);

    if (_host) {
      const strName = STRAIN_SHORT[contractBid.strain];
      const msg = PLAYER_NAMES[contractPlayer] + ' declares ' + contractBid.level + strName;
      _host.floatingText.add(CANVAS_W / 2, 250, msg, { color: '#ff0', size: 18 });
    }

    /* Start play phase: left of declarer leads */
    phase = PHASE_PLAYING;
    trickLeader = defendingLead;
    currentTurn = defendingLead;
    aiTurnTimer = 0;
    openingLeadMade = false;
    dummyRevealed = false;
    statusMessage = PLAYER_NAMES[defendingLead] + ' leads';
  }

  /* ================================================================
     PLAY FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const hand = hands[playerIdx];
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    trickCards.push(card);
    trickPlayers.push(playerIdx);

    /* After opening lead, reveal dummy */
    if (!openingLeadMade) {
      openingLeadMade = true;
      dummyRevealed = true;
      for (const c of hands[dummyPlayer])
        c.faceUp = true;
    }

    if (trickCards.length >= NUM_PLAYERS) {
      phase = PHASE_TRICK_DONE;
      trickWinnerIdx = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    currentTurn = leftOf(currentTurn);
    aiTurnTimer = 0;
  }

  function finishTrick() {
    const winner = trickWinnerIdx;
    if (teamOf(winner) === TEAM_NS)
      ++tricksWonNS;
    else
      ++tricksWonEW;
    ++trickCount;

    if (_host) {
      const who = winner === SOUTH ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win' + (winner === SOUTH ? '' : 's') + ' trick #' + trickCount;
      const color = teamOf(winner) === TEAM_NS ? '#4f4' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    trickCards = [];
    trickPlayers = [];
    trickWinnerIdx = -1;

    if (trickCount >= HAND_SIZE) {
      endRound();
      return;
    }

    trickLeader = winner;
    currentTurn = winner;
    phase = PHASE_PLAYING;
    aiTurnTimer = 0;
  }

  function endRound() {
    const result = scoreContract();
    roundOver = true;

    if (checkRubberOver()) {
      /* Rubber bonus */
      const nsWon = nsGamesWon >= 2;
      const bonus = (nsWon ? (ewGamesWon === 0 ? 700 : 500) : (nsGamesWon === 0 ? 700 : 500));
      if (nsWon)
        nsAboveLine += bonus;
      else
        ewAboveLine += bonus;

      score = nsAboveLine + nsBelow;
      if (_host) _host.onScoreChanged(score);

      gameOver = true;
      phase = PHASE_GAME_OVER;

      if (_host) {
        const nsTot = nsAboveLine + nsBelow;
        const ewTot = ewAboveLine + ewBelow;
        const won = nsTot > ewTot;
        const msg = won ? 'Rubber Won!' : 'Rubber Lost!';
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 80);
      }
    } else {
      phase = PHASE_ROUND_OVER;

      if (_host) {
        const over = result.over;
        let msg;
        if (over >= 0)
          msg = 'Contract made! +' + result.belowPts + ' below' + (result.abovePts > 0 ? ', +' + result.abovePts + ' above' : '');
        else
          msg = 'Down ' + result.under + '! Defenders +' + result.defenseAbove;
        _host.floatingText.add(CANVAS_W / 2, 200, msg, { color: over >= 0 ? '#4f4' : '#f88', size: 16 });
      }
    }
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 18;

  function playerCardX(idx, total) {
    const maxWidth = 640;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* Dummy hand at top (North position) */
  const DUMMY_HAND_Y = 12;
  function dummyCardX(idx, total) {
    const maxWidth = 600;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* Trick card positions: center, arranged by seat */
  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 330 },          // South
    { x: CANVAS_W / 2 - CE.CARD_W - 45, y: 270 },          // West
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 210 },           // North
    { x: CANVAS_W / 2 + 45, y: 270 }                        // East
  ];

  /* AI hand display positions */
  const AI_HAND_POS = {
    [WEST]: { x: 15, y: 180, dir: 'vertical', label: 'West' },
    [EAST]: { x: CANVAS_W - 60, y: 180, dir: 'vertical', label: 'East' }
  };

  /* ================================================================
     DRAWING - HELPERS
     ================================================================ */

  function lightenColor(hex, amount) {
    const amt = amount || 40;
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 8;
    const pw = 192;
    const ph = 158;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Contract Bridge', px + 8, py + 6);

    const lh = 14;
    let y = py + 24;

    /* Vulnerability */
    _ctx.font = '10px sans-serif';
    _ctx.fillStyle = nsVulnerable ? '#f88' : '#8f8';
    _ctx.fillText('NS: ' + (nsVulnerable ? 'Vul' : 'NV'), px + 8, y);
    _ctx.fillStyle = ewVulnerable ? '#f88' : '#8f8';
    _ctx.fillText('EW: ' + (ewVulnerable ? 'Vul' : 'NV'), px + 100, y);
    y += lh + 2;

    /* Games won */
    _ctx.fillStyle = '#8cf';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Games: NS=' + nsGamesWon + '  EW=' + ewGamesWon, px + 8, y);
    y += lh + 2;

    /* Below the line */
    _ctx.fillStyle = '#ccc';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Below:', px + 8, y);
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS ' + nsBelow, px + 55, y);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW ' + ewBelow, px + 110, y);
    y += lh;

    /* Above the line */
    _ctx.fillStyle = '#ccc';
    _ctx.fillText('Above:', px + 8, y);
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS ' + nsAboveLine, px + 55, y);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW ' + ewAboveLine, px + 110, y);
    y += lh + 4;

    /* Dealer indicator */
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], px + 8, y);
    y += lh;

    /* Current contract if in play */
    if (contractBid && phase >= PHASE_PLAYING) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.fillText('Contract: ' + contractBid.level + STRAIN_SHORT[contractBid.strain], px + 8, y);
      y += lh;
      _ctx.fillStyle = '#ccc';
      _ctx.font = '10px sans-serif';
      _ctx.fillText('Declarer: ' + PLAYER_SHORT[contractPlayer], px + 8, y);
      _ctx.fillText('NS:' + tricksWonNS + ' EW:' + tricksWonEW, px + 100, y);
    }

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - PLAYER HAND (South)
     ================================================================ */

  function drawPlayerHand() {
    const hand = hands[SOUTH];
    const total = hand.length;
    if (total === 0) return;

    const isPlayerTurn = phase === PHASE_PLAYING && controllerOf(currentTurn) === SOUTH && currentTurn === SOUTH;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (isPlayerTurn && i === hoveredCard)
        y -= 10;

      const valid = isPlayerTurn && isValidPlay(hand[i], hand);

      if (valid) {
        _ctx.save();
        _ctx.shadowColor = '#4f4';
        _ctx.shadowBlur = 8;
        CE.drawCardFace(_ctx, x, y, hand[i]);
        _ctx.restore();
      } else
        CE.drawCardFace(_ctx, x, y, hand[i]);

      if (_host && _host.hintsEnabled && isPlayerTurn && valid)
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      if (isPlayerTurn && !valid) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.fill();
        _ctx.restore();
      }
    }
  }

  /* ================================================================
     DRAWING - DUMMY HAND (North when revealed)
     ================================================================ */

  function drawDummyHand() {
    const hand = hands[dummyPlayer];
    const total = hand.length;

    /* If dummy is South (player is dummy), cards shown at bottom -- handled in drawPlayerHand */
    if (dummyPlayer === SOUTH) return;

    /* If dummy is North, show face-up at top */
    if (dummyPlayer === NORTH) {
      if (!dummyRevealed) {
        /* Show as card backs */
        const spacing = Math.min(22, 360 / Math.max(total, 1));
        const totalW = (total - 1) * spacing + CE.CARD_W * 0.55;
        const startX = CANVAS_W / 2 - totalW / 2;
        _ctx.fillStyle = '#aaa';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'bottom';
        _ctx.fillText('North (' + total + ')', CANVAS_W / 2, DUMMY_HAND_Y);
        for (let i = 0; i < total; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, DUMMY_HAND_Y + 2, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        return;
      }

      const isDummyTurn = phase === PHASE_PLAYING && currentTurn === dummyPlayer;
      const isHumanControlling = isDummyTurn && controllerOf(dummyPlayer) === SOUTH;

      _ctx.fillStyle = isDummyTurn ? '#ff0' : '#aaa';
      _ctx.font = isDummyTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Dummy (North) \u2014 ' + total + ' cards', CANVAS_W / 2, DUMMY_HAND_Y);

      for (let i = 0; i < total; ++i) {
        const x = dummyCardX(i, total);
        let y = DUMMY_HAND_Y + 2;

        const valid = isHumanControlling && isValidPlay(hand[i], hand);

        if (isHumanControlling && i === hoveredCard && currentTurn === dummyPlayer)
          y += 8;

        CE.drawCardFace(_ctx, x, y, hand[i], CE.CARD_W * 0.75, CE.CARD_H * 0.75);

        if (_host && _host.hintsEnabled && isHumanControlling && valid)
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W * 0.75, CE.CARD_H * 0.75, _host.hintTime);

        if (isHumanControlling && !valid) {
          _ctx.save();
          _ctx.fillStyle = 'rgba(0,0,0,0.35)';
          CE.drawRoundedRect(_ctx, x, y, CE.CARD_W * 0.75, CE.CARD_H * 0.75, CE.CARD_RADIUS);
          _ctx.fill();
          _ctx.restore();
        }
      }
      return;
    }

    /* If dummy is West or East -- draw face up in their position */
    drawAISingleHand(dummyPlayer, true);
  }

  /* ================================================================
     DRAWING - AI HANDS
     ================================================================ */

  function drawAISingleHand(p, faceUp) {
    const hand = hands[p];
    const count = hand.length;
    const pos = AI_HAND_POS[p];
    if (!pos) return;

    const isCurrent = currentTurn === p && phase === PHASE_PLAYING;
    const isDummy = p === dummyPlayer && dummyRevealed;

    _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
    _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';

    const label = pos.label + (isDummy ? ' (Dummy)' : '') + ' (' + count + ')';

    const spacing = Math.min(18, 240 / Math.max(count, 1));
    const lx = pos.x + (p === WEST ? 20 : 0);
    _ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);

    for (let i = 0; i < count; ++i) {
      const cx = pos.x + (p === WEST ? 5 : -CE.CARD_W * 0.5 + 5);
      const cy = pos.y + 14 + i * spacing;

      if (faceUp || isDummy) {
        CE.drawCardFace(_ctx, cx, cy, hand[i], CE.CARD_W * 0.5, CE.CARD_H * 0.45);

        /* If human controls dummy at West/East, show valid hints */
        if (isDummy && currentTurn === p && controllerOf(p) === SOUTH) {
          if (_host && _host.hintsEnabled && isValidPlay(hand[i], hand))
            CE.drawHintGlow(_ctx, cx, cy, CE.CARD_W * 0.5, CE.CARD_H * 0.45, _host.hintTime);
        }
      } else
        CE.drawCardBack(_ctx, cx, cy, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
    }
  }

  function drawAIHands() {
    for (const p of [WEST, EAST]) {
      if (p === dummyPlayer && dummyRevealed) continue; // drawn by drawDummyHand
      drawAISingleHand(p, false);
    }
    /* Draw North as card backs if not dummy or not revealed */
    if (dummyPlayer !== NORTH || !dummyRevealed) {
      const hand = hands[NORTH];
      const count = hand.length;
      const isCurrent = currentTurn === NORTH && phase === PHASE_PLAYING;

      _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('North (' + count + ')', CANVAS_W / 2, DUMMY_HAND_Y);

      const spacing = Math.min(22, 360 / Math.max(count, 1));
      const totalW = (count - 1) * spacing + CE.CARD_W * 0.55;
      const startX = CANVAS_W / 2 - totalW / 2;
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(_ctx, startX + i * spacing, DUMMY_HAND_Y + 2, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }
  }

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _ctx.beginPath();
    _ctx.arc(CANVAS_W / 2, 290, 85, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const p = trickPlayers[i];
      const pos = TRICK_POS[p];
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);

      _ctx.fillStyle = '#ccc';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      const labelY = p === NORTH ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      _ctx.fillText(PLAYER_SHORT[p], pos.x + CE.CARD_W / 2, labelY);
    }

    if (phase === PHASE_TRICK_DONE && trickWinnerIdx >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinnerIdx === SOUTH ? 'You take' : PLAYER_NAMES[trickWinnerIdx] + ' takes';
      _ctx.fillText(who + ' the trick', CANVAS_W / 2, 195);
    }
  }

  /* ================================================================
     DRAWING - TRICK COUNTER
     ================================================================ */

  function drawTrickCounter() {
    if (phase < PHASE_PLAYING || !contractBid) return;

    const needed = contractBid.level + 6;
    const declTeam = teamOf(contractPlayer);
    const declTricks = declTeam === TEAM_NS ? tricksWonNS : tricksWonEW;
    const defTricks = declTeam === TEAM_NS ? tricksWonEW : tricksWonNS;

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trick ' + (trickCount + 1) + '/13', 10, CANVAS_H - 28);

    _ctx.fillStyle = '#8cf';
    _ctx.fillText('Decl: ' + declTricks + '/' + needed, 10, CANVAS_H - 14);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('Def: ' + defTricks, 100, CANVAS_H - 14);
  }

  /* ================================================================
     DRAWING - BIDDING UI
     ================================================================ */

  function drawBiddingUI() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Bidding Phase', CANVAS_W / 2, 140);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Dealer: ' + PLAYER_NAMES[dealer], CANVAS_W / 2, 157);

    /* Draw bid history */
    const histX = 20;
    const histY = 140;
    _ctx.fillStyle = '#ccc';
    _ctx.font = 'bold 10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Bid History:', histX, histY);

    _ctx.font = '10px sans-serif';
    const maxShow = Math.min(bidHistory.length, 12);
    const startIdx = Math.max(0, bidHistory.length - maxShow);
    for (let i = startIdx; i < bidHistory.length; ++i) {
      const h = bidHistory[i];
      const row = i - startIdx;
      const y = histY + 14 + row * 13;
      _ctx.fillStyle = teamOf(h.player) === TEAM_NS ? '#8cf' : '#f88';
      const bidStr = h.bid === 'pass' ? 'Pass' : bidToString(h.bid);
      _ctx.fillText(PLAYER_SHORT[h.player] + ': ' + bidStr, histX, y);
    }

    /* If it's the player's turn to bid */
    if (biddingPlayer === SOUTH) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your bid:', CANVAS_W / 2 + 40, BID_AREA_Y - 14);

      const lastBid = getLastNonPassBid();

      /* Column headers */
      for (let si = 0; si < 5; ++si) {
        const strain = STRAIN_ORDER[si];
        const r = bidBtnRect(1, si);
        _ctx.fillStyle = '#ccc';
        _ctx.font = 'bold 10px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'bottom';
        const sym = STRAIN_SHORT[strain];
        const color = (strain === 'hearts' || strain === 'diamonds') ? '#d66' : '#aaa';
        _ctx.fillStyle = color;
        _ctx.fillText(sym, r.x + r.w / 2, r.y - 2);
      }

      /* Draw bid buttons */
      for (let lvl = 1; lvl <= 7; ++lvl) {
        for (let si = 0; si < 5; ++si) {
          const idx = bidBtnIndex(lvl, si);
          const r = bidBtnRect(lvl, si);
          const candidate = { level: lvl, strain: STRAIN_ORDER[si] };
          const isValid = bidIsHigher(candidate, lastBid);

          let bg, border;
          if (!isValid) {
            bg = '#333';
            border = '#555';
          } else if (hoveredBidBtn === idx) {
            bg = '#3a6a3a';
            border = '#8c8';
          } else {
            bg = '#1a4a1a';
            border = '#5a5';
          }

          CE.drawButton(_ctx, r.x, r.y, r.w, r.h, '' + lvl, {
            bg,
            border,
            textColor: isValid ? '#fff' : '#666',
            fontSize: 10
          });
        }
      }

      /* Pass button */
      const pbg = hoveredPassBtn ? '#6a3a3a' : '#5a2a2a';
      CE.drawButton(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', {
        bg: pbg,
        border: '#c66',
        fontSize: 12
      });
    } else {
      _ctx.fillStyle = '#aaa';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(PLAYER_NAMES[biddingPlayer] + ' is thinking...', CANVAS_W / 2 + 40, BID_AREA_Y + 60);
    }
  }

  /* ================================================================
     DRAWING - CONTRACT DISPLAY
     ================================================================ */

  function drawContractDisplay() {
    if (!contractBid) return;

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';

    const strName = contractBid.level + STRAIN_SHORT[contractBid.strain];
    _ctx.fillText('Contract: ' + strName + ' by ' + PLAYER_SHORT[contractPlayer], 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Dummy: ' + PLAYER_SHORT[dummyPlayer], 10, 26);

    if (trumpSuit) {
      _ctx.fillStyle = (trumpSuit === 'hearts' || trumpSuit === 'diamonds') ? '#f88' : '#ccc';
      _ctx.fillText('Trump: ' + SUIT_SYMBOLS[trumpSuit] + ' ' + SUIT_NAMES[trumpSuit], 10, 40);
    } else {
      _ctx.fillStyle = '#8cf';
      _ctx.fillText('No Trump', 10, 40);
    }
  }

  /* ================================================================
     DRAWING - ROUND OVER UI
     ================================================================ */

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 120;
    const pw = 360;
    const ph = 310;

    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Hand Complete', CANVAS_W / 2, py + 12);

    let y = py + 42;
    _ctx.font = '13px sans-serif';

    /* Contract info */
    if (contractBid) {
      _ctx.fillStyle = '#ff0';
      _ctx.fillText('Contract: ' + contractBid.level + STRAIN_SHORT[contractBid.strain] + ' by ' + PLAYER_NAMES[contractPlayer], CANVAS_W / 2, y);
      y += 20;
    }

    /* Tricks */
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS Tricks: ' + tricksWonNS, CANVAS_W / 2, y);
    y += 18;
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW Tricks: ' + tricksWonEW, CANVAS_W / 2, y);
    y += 24;

    /* Result */
    if (contractBid) {
      const needed = contractBid.level + 6;
      const declTeam = teamOf(contractPlayer);
      const declTricks = declTeam === TEAM_NS ? tricksWonNS : tricksWonEW;
      const diff = declTricks - needed;

      if (diff >= 0) {
        _ctx.fillStyle = '#4f4';
        _ctx.font = 'bold 14px sans-serif';
        _ctx.fillText('Made! ' + (diff > 0 ? '+' + diff + ' overtrick' + (diff > 1 ? 's' : '') : 'Exactly'), CANVAS_W / 2, y);
      } else {
        _ctx.fillStyle = '#f44';
        _ctx.font = 'bold 14px sans-serif';
        _ctx.fillText('Down ' + (-diff) + '!', CANVAS_W / 2, y);
      }
      y += 24;
    }

    /* Score summary */
    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#ccc';
    _ctx.fillText('Score Summary', CANVAS_W / 2, y);
    y += 18;

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8cf';
    _ctx.fillText('NS \u2014 Below: ' + nsBelow + '  Above: ' + nsAboveLine + '  Games: ' + nsGamesWon, CANVAS_W / 2, y);
    y += 16;
    _ctx.fillStyle = '#f88';
    _ctx.fillText('EW \u2014 Below: ' + ewBelow + '  Above: ' + ewAboveLine + '  Games: ' + ewGamesWon, CANVAS_W / 2, y);
    y += 16;

    /* Vulnerability */
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Vulnerability: NS=' + (nsVulnerable ? 'Yes' : 'No') + '  EW=' + (ewVulnerable ? 'Yes' : 'No'), CANVAS_W / 2, y);
    y += 24;

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Click to deal next hand', CANVAS_W / 2, y);

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - GAME OVER UI
     ================================================================ */

  function drawGameOverUI() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.85)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const nsTot = nsAboveLine + nsBelow;
    const ewTot = ewAboveLine + ewBelow;
    const nsWins = nsTot > ewTot;

    _ctx.fillStyle = nsWins ? '#4f4' : '#f44';
    _ctx.font = 'bold 26px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(nsWins ? 'Rubber Won!' : 'Rubber Lost!', CANVAS_W / 2, 180);

    _ctx.fillStyle = '#fff';
    _ctx.font = '16px sans-serif';
    _ctx.fillText('NS Total: ' + nsTot + '  |  EW Total: ' + ewTot, CANVAS_W / 2, 220);

    _ctx.font = '13px sans-serif';
    _ctx.fillStyle = '#ccc';
    _ctx.fillText('NS Games: ' + nsGamesWon + '  EW Games: ' + ewGamesWon, CANVAS_W / 2, 250);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '14px sans-serif';
    _ctx.fillText('Click to start a new rubber', CANVAS_W / 2, 300);

    _ctx.restore();
  }

  /* ================================================================
     DRAWING - STATUS BAR
     ================================================================ */

  function drawStatusBar() {
    if (phase === PHASE_PLAYING) {
      const ctrl = controllerOf(currentTurn);
      if (ctrl === SOUTH && currentTurn !== SOUTH) {
        statusMessage = 'Play a card from dummy\'s hand';
      } else if (ctrl === SOUTH) {
        statusMessage = 'Your turn \u2014 click a card to play';
      } else {
        statusMessage = PLAYER_NAMES[currentTurn] + ' is thinking...';
      }
    }

    if (!statusMessage) return;
    _ctx.fillStyle = '#ff0';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText(statusMessage, CANVAS_W / 2, CANVAS_H - 4);
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawAll() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';

    drawScorePanel();

    if (phase === PHASE_BIDDING) {
      drawAIHands();
      /* Show North as card backs during bidding */
      drawPlayerHand();
      drawBiddingUI();
    } else if (phase >= PHASE_PLAYING && phase <= PHASE_TRICK_DONE) {
      drawContractDisplay();
      drawAIHands();
      if (dummyRevealed)
        drawDummyHand();
      drawTrickArea();
      drawPlayerHand();
      drawTrickCounter();
      drawStatusBar();
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
    const hand = hands[SOUTH];
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

  function hitTestDummyCard(mx, my) {
    if (!dummyRevealed) return -1;
    if (dummyPlayer !== NORTH) return hitTestDummySide(mx, my);

    const hand = hands[dummyPlayer];
    const total = hand.length;
    if (total === 0) return -1;

    const cardW = CE.CARD_W * 0.75;
    const cardH = CE.CARD_H * 0.75;

    for (let i = total - 1; i >= 0; --i) {
      const cx = dummyCardX(i, total);
      const cy = DUMMY_HAND_Y + 2;
      const rightEdge = i === total - 1 ? cx + cardW : dummyCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + cardH)
        return i;
    }
    return -1;
  }

  function hitTestDummySide(mx, my) {
    /* For dummy at West or East */
    const p = dummyPlayer;
    const pos = AI_HAND_POS[p];
    if (!pos) return -1;

    const hand = hands[p];
    const count = hand.length;
    if (count === 0) return -1;

    const spacing = Math.min(18, 240 / Math.max(count, 1));
    const cardW = CE.CARD_W * 0.5;
    const cardH = CE.CARD_H * 0.45;

    for (let i = count - 1; i >= 0; --i) {
      const cx = pos.x + (p === WEST ? 5 : -CE.CARD_W * 0.5 + 5);
      const cy = pos.y + 14 + i * spacing;
      const bottom = i === count - 1 ? cy + cardH : pos.y + 14 + (i + 1) * spacing;
      const hitH = bottom - cy;
      if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + hitH)
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
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      /* Game over */
      if (phase === PHASE_GAME_OVER) {
        setupGame();
        if (_host) _host.onScoreChanged(score);
        return;
      }

      /* Round over */
      if (phase === PHASE_ROUND_OVER) {
        dealer = leftOf(dealer);
        deal();
        return;
      }

      /* Bidding - player's turn */
      if (phase === PHASE_BIDDING && biddingPlayer === SOUTH) {
        /* Check pass button */
        if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
          placeBid(SOUTH, 'pass');
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          return;
        }

        /* Check bid buttons */
        const lastBid = getLastNonPassBid();
        for (let lvl = 1; lvl <= 7; ++lvl) {
          for (let si = 0; si < 5; ++si) {
            const r = bidBtnRect(lvl, si);
            if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
              const candidate = { level: lvl, strain: STRAIN_ORDER[si] };
              if (bidIsHigher(candidate, lastBid)) {
                placeBid(SOUTH, candidate);
                if (_host)
                  _host.floatingText.add(CANVAS_W / 2, 300, 'You bid ' + bidToString(candidate), { color: '#ff0', size: 14 });
              } else {
                if (_host)
                  _host.floatingText.add(mx, my - 20, 'Bid must be higher!', { color: '#f88', size: 12 });
              }
              return;
            }
          }
        }
        return;
      }

      /* Playing - check if human controls current turn */
      if (phase === PHASE_PLAYING) {
        const ctrl = controllerOf(currentTurn);
        if (ctrl !== SOUTH) return;

        /* Playing own hand */
        if (currentTurn === SOUTH) {
          const idx = hitTestPlayerCard(mx, my);
          if (idx < 0) return;

          const hand = hands[SOUTH];
          if (isValidPlay(hand[idx], hand)) {
            playCard(SOUTH, idx);
          } else {
            const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
            const reason = leadSuit ? 'Must follow ' + SUIT_NAMES[leadSuit] + '!' : 'Invalid play!';
            if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
          }
          return;
        }

        /* Playing dummy's hand */
        if (currentTurn === dummyPlayer) {
          const idx = hitTestDummyCard(mx, my);
          if (idx < 0) return;

          const hand = hands[dummyPlayer];
          if (isValidPlay(hand[idx], hand)) {
            playCard(dummyPlayer, idx);
          } else {
            const leadSuit = trickCards.length > 0 ? trickCards[0].suit : null;
            const reason = leadSuit ? 'Must follow ' + SUIT_NAMES[leadSuit] + '!' : 'Invalid play!';
            if (_host) _host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
          }
          return;
        }
      }
    },

    handlePointerMove(mx, my) {
      hoveredCard = -1;
      hoveredBidBtn = -1;
      hoveredPassBtn = false;

      if (phase === PHASE_BIDDING && biddingPlayer === SOUTH) {
        /* Bid buttons hover */
        for (let lvl = 1; lvl <= 7; ++lvl) {
          for (let si = 0; si < 5; ++si) {
            const r = bidBtnRect(lvl, si);
            if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
              hoveredBidBtn = bidBtnIndex(lvl, si);
              return;
            }
          }
        }
        if (CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h))
          hoveredPassBtn = true;
        return;
      }

      if (phase === PHASE_PLAYING) {
        const ctrl = controllerOf(currentTurn);
        if (ctrl !== SOUTH) return;

        if (currentTurn === SOUTH)
          hoveredCard = hitTestPlayerCard(mx, my);
        else if (currentTurn === dummyPlayer)
          hoveredCard = hitTestDummyCard(mx, my);
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick(dt) {
      if (phase === PHASE_ROUND_OVER || phase === PHASE_GAME_OVER) return;

      /* Trick done timer */
      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      /* AI bidding */
      if (phase === PHASE_BIDDING && biddingPlayer !== SOUTH) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_BID_DELAY) {
          aiTurnTimer = 0;
          const bid = aiBid(biddingPlayer);
          if (_host) {
            const label = PLAYER_NAMES[biddingPlayer] + ': ' + (bid === 'pass' ? 'Pass' : bidToString(bid));
            const color = bid === 'pass' ? '#aaa' : '#ff0';
            _host.floatingText.add(CANVAS_W / 2, 300, label, { color, size: 13 });
          }
          placeBid(biddingPlayer, bid);
        }
        return;
      }

      /* AI playing */
      if (phase !== PHASE_PLAYING) return;

      const ctrl = controllerOf(currentTurn);
      if (ctrl === SOUTH) return; // waiting for human

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;

        /* AI plays for itself, or AI declarer plays dummy's hand */
        const hand = hands[currentTurn];
        if (hand.length === 0) return;

        const idx = aiChooseCard(currentTurn);
        if (idx >= 0)
          playCard(currentTurn, idx);
      }
    },

    cleanup() {
      hands = [[], [], [], []];
      trickCards = [];
      trickPlayers = [];
      bidHistory = [];
      contractBid = null;
      contractPlayer = -1;
      dummyPlayer = -1;
      trumpSuit = null;
      nsAboveLine = 0;
      nsBelow = 0;
      ewAboveLine = 0;
      ewBelow = 0;
      nsGamesWon = 0;
      ewGamesWon = 0;
      nsVulnerable = false;
      ewVulnerable = false;
      roundOver = false;
      gameOver = false;
      phase = PHASE_BIDDING;
      aiTurnTimer = 0;
      hoveredCard = -1;
      hoveredBidBtn = -1;
      hoveredPassBtn = false;
      statusMessage = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('bridge', module);

})();
