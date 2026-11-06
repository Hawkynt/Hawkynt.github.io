/* Bridge - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;
  const { STRAIN_ORDER, STRAIN_SHORT, NUM_PLAYERS, SOUTH, NORTH, TEAM_NS } = V;

  const RANK_ORDER = T.RANK_ORDER;
  const TEAM_EW = 1;

  /* ── HCP values ── */
  const HCP_VALUES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

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
    return teamOf(p) === teamOf(S.contractPlayer);
  }

  function isDummy(p) {
    return p === S.dummyPlayer;
  }

  /* Who controls this player's hand? Declarer plays for dummy. */
  function controllerOf(p) {
    if (p === S.dummyPlayer) return S.contractPlayer;
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
    for (let i = S.bidHistory.length - 1; i >= 0; --i)
      if (S.bidHistory[i].bid !== 'pass')
        return S.bidHistory[i].bid;
    return null;
  }

  function getAllBids() {
    const bids = [];
    for (const h of S.bidHistory)
      if (h.bid !== 'pass')
        bids.push(h);
    return bids;
  }

  /* Find declarer: first player in the winning partnership who bid the winning strain */
  function findDeclarer(winBid, winningPlayer) {
    const winTeam = teamOf(winningPlayer);
    for (const h of S.bidHistory) {
      if (h.bid === 'pass') continue;
      if (teamOf(h.player) === winTeam && h.bid.strain === winBid.strain)
        return h.player;
    }
    return winningPlayer;
  }

  /* ================================================================
     VALIDITY - PLAY
     ================================================================ */

  function isValidPlay(card, hand) {
    return T.followsSuit(card, hand, S.trickCards);
  }

  function getValidIndices(hand) {
    return T.validIndices(hand, isValidPlay);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trumpSuit && S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cTrump = S.trumpSuit && c.suit === S.trumpSuit;
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
    return S.trickPlayers[bestIdx];
  }

  function resolveTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trumpSuit && S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cTrump = S.trumpSuit && c.suit === S.trumpSuit;
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
    return S.trickPlayers[bestIdx];
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreContract() {
    const declarerTeam = teamOf(S.contractPlayer);
    const tricksMade = declarerTeam === TEAM_NS ? S.tricksWonNS : S.tricksWonEW;
    const contracted = S.contractBid.level + 6;
    const over = tricksMade - contracted;
    const under = contracted - tricksMade;
    const vulnerable = declarerTeam === TEAM_NS ? S.nsVulnerable : S.ewVulnerable;

    let belowPts = 0;
    let abovePts = 0;
    let defenseAbove = 0;

    if (over >= 0) {
      /* Made the contract */
      const strain = S.contractBid.strain;
      const level = S.contractBid.level;

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
        S.nsBelow += belowPts;
        S.nsAboveLine += abovePts;
      } else {
        S.ewBelow += belowPts;
        S.ewAboveLine += abovePts;
      }

      /* Check for game (100 below the line) */
      if (declarerTeam === TEAM_NS && S.nsBelow >= 100) {
        ++S.nsGamesWon;
        S.nsAboveLine += S.nsBelow;
        S.ewAboveLine += S.ewBelow;
        S.nsBelow = 0;
        S.ewBelow = 0;
        S.nsVulnerable = S.nsGamesWon >= 1;
        S.ewVulnerable = S.ewGamesWon >= 1;
      } else if (declarerTeam === TEAM_EW && S.ewBelow >= 100) {
        ++S.ewGamesWon;
        S.nsAboveLine += S.nsBelow;
        S.ewAboveLine += S.ewBelow;
        S.nsBelow = 0;
        S.ewBelow = 0;
        S.nsVulnerable = S.nsGamesWon >= 1;
        S.ewVulnerable = S.ewGamesWon >= 1;
      }
    } else {
      /* Went down */
      const penalty = vulnerable ? 100 : 50;
      defenseAbove = under * penalty;

      if (declarerTeam === TEAM_NS)
        S.ewAboveLine += defenseAbove;
      else
        S.nsAboveLine += defenseAbove;
    }

    /* Total score = above + below for NS */
    S.score = S.nsAboveLine + S.nsBelow;
    if (S._host) S._host.onScoreChanged(S.score);

    return { tricksMade, contracted, over, under, belowPts, abovePts, defenseAbove, declarerTeam, vulnerable };
  }

  function checkRubberOver() {
    return S.nsGamesWon >= 2 || S.ewGamesWon >= 2;
  }

  Object.assign(V, {
    teamOf, partnerOf, leftOf, controllerOf, cardStrength, sortHand,
    countSuit, getHCP, getDistributionPoints, getLongestSuit, bidToString,
    bidIsHigher, getLastNonPassBid, getAllBids, findDeclarer, isValidPlay,
    getValidIndices, resolveTrickWinner, resolveTrickWinnerPartial,
    scoreContract, checkRubberOver
  });

})();
