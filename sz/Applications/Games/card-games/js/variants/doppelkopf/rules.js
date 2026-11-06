/* Doppelkopf - deck, trump order, legal plays, trick resolution and round scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;
  const { NUM_PLAYERS, DK_RANKS } = V;

  /* trumps from highest to lowest; the 10 of hearts (Dulle) leads the list */
  const TRUMP_ORDER = [
    'hearts:10',
    'clubs:Q', 'spades:Q', 'hearts:Q', 'diamonds:Q',
    'clubs:J', 'spades:J', 'hearts:J', 'diamonds:J',
    'diamonds:A', 'diamonds:10', 'diamonds:K', 'diamonds:9'
  ];

  const PLAIN_ORDER = ['A', '10', 'K', '9'];

  const CARD_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0 };

  const SUIT_SORT = ['clubs', 'spades', 'hearts'];

  const TRUMP_HINT = 'Trumps: 10♥ Q♣ Q♠ Q♥ Q♦ J♣ J♠ J♥ J♦ A♦ 10♦ K♦ 9♦';

  /* ================================================================
     CARD CLASSIFICATION
     ================================================================ */

  function cardKey(card) {
    return card.suit + ':' + card.rank;
  }

  function isTrump(card) {
    return TRUMP_ORDER.indexOf(cardKey(card)) >= 0;
  }

  function isDulle(card) {
    return card.suit === 'hearts' && card.rank === '10';
  }

  function isQueenOfClubs(card) {
    return card.suit === 'clubs' && card.rank === 'Q';
  }

  function isFox(card) {
    return card.suit === 'diamonds' && card.rank === 'A';
  }

  function isCharlie(card) {
    return card.suit === 'clubs' && card.rank === 'J';
  }

  /* the "suit" a card belongs to for following: all trumps form one suit */
  function effectiveSuit(card) {
    return isTrump(card) ? 'trump' : card.suit;
  }

  /* higher is stronger; trumps always outrank plain cards */
  function cardStrength(card) {
    const t = TRUMP_ORDER.indexOf(cardKey(card));
    if (t >= 0)
      return 100 + (TRUMP_ORDER.length - t);
    return PLAIN_ORDER.length - PLAIN_ORDER.indexOf(card.rank);
  }

  function cardPoints(card) {
    return CARD_POINTS[card.rank] || 0;
  }

  function sumPoints(cards) {
    let total = 0;
    for (let i = 0; i < cards.length; ++i)
      total += cardPoints(cards[i]);
    return total;
  }

  /* ================================================================
     DECK
     ================================================================ */

  function createDeck() {
    return CE.createDeckFromRanks(CE.SUITS, DK_RANKS).concat(CE.createDeckFromRanks(CE.SUITS, DK_RANKS));
  }

  /* ================================================================
     LEGAL PLAYS
     ================================================================ */

  function isValidPlay(card, hand, trickCards) {
    if (!trickCards || trickCards.length === 0)
      return true;
    const led = effectiveSuit(trickCards[0]);
    let canFollow = false;
    for (let i = 0; i < hand.length; ++i)
      if (effectiveSuit(hand[i]) === led) {
        canFollow = true;
        break;
      }
    return !canFollow || effectiveSuit(card) === led;
  }

  function validIndices(hand, trickCards) {
    const out = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand, trickCards))
        out.push(i);
    return out;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  /* does `card` take the trick from the currently best card `best`? */
  function beats(card, best) {
    if (isDulle(card) && isDulle(best))
      return true;
    const ct = isTrump(card);
    const bt = isTrump(best);
    if (ct && !bt)
      return true;
    if (!ct && bt)
      return false;
    if (effectiveSuit(card) !== effectiveSuit(best))
      return false;
    return cardStrength(card) > cardStrength(best);
  }

  /* index into trickCards of the card currently winning */
  function winningIndex(trickCards) {
    let best = 0;
    for (let i = 1; i < trickCards.length; ++i)
      if (beats(trickCards[i], trickCards[best]))
        best = i;
    return best;
  }

  /* ================================================================
     SORTING
     ================================================================ */

  function sortKey(card) {
    if (isTrump(card))
      return TRUMP_ORDER.indexOf(cardKey(card));
    return 100 + SUIT_SORT.indexOf(card.suit) * 10 + PLAIN_ORDER.indexOf(card.rank);
  }

  function sortHand(hand) {
    hand.sort((a, b) => sortKey(a) - sortKey(b));
  }

  /* ================================================================
     TEAM KNOWLEDGE
     ================================================================ */

  /* what `viewer` knows about `other`: 'same', 'other' or null (unknown) */
  function teamRelation(viewer, other) {
    if (viewer === other)
      return 'same';
    if (S.soloist === viewer)
      return 'other';
    const viewerRe = S.re[viewer];
    if (S.queensOfClubsPlayed >= 2) {
      if (S.soloist >= 0)
        return other === S.soloist ? 'other' : 'same';
      return S.re[other] === viewerRe ? 'same' : 'other';
    }
    if (viewerRe) {
      /* a Re player knows the partner once the other Q of clubs shows up */
      let partner = -1;
      for (let p = 0; p < NUM_PLAYERS; ++p)
        if (p !== viewer && S.playedQueenOfClubs[p])
          partner = p;
      if (partner < 0)
        return null;
      return other === partner ? 'same' : 'other';
    }
    if (S.playedQueenOfClubs[other])
      return 'other';
    return null;
  }

  /* label for a seat as seen by `viewer`, or '' while unknown */
  function partyLabel(viewer, p) {
    const rel = teamRelation(viewer, p);
    if (rel === null)
      return '';
    const viewerRe = S.re[viewer];
    const isRe = rel === 'same' ? viewerRe : !viewerRe;
    if (isRe && S.soloist === p && (p === viewer || S.queensOfClubsPlayed >= 2))
      return 'Re (Solo)';
    return isRe ? 'Re' : 'Kontra';
  }

  /* ================================================================
     ROUND SCORING
     ================================================================ */

  /*
   * re:      array of 4 booleans (true = Re party)
   * soloist: seat of a silent soloist or -1
   * tricks:  12 entries of { cards, players, winner }
   */
  function scoreRound(re, soloist, tricks) {
    const isSolo = soloist >= 0;
    let rePoints = 0;
    let reTricks = 0;
    let kontraTricks = 0;
    const extras = { re: [], kontra: [] };
    const partyOf = p => (re[p] ? 're' : 'kontra');

    for (let t = 0; t < tricks.length; ++t) {
      const tr = tricks[t];
      const pts = sumPoints(tr.cards);
      const winnerParty = partyOf(tr.winner);
      if (winnerParty === 're') {
        rePoints += pts;
        ++reTricks;
      } else
        ++kontraTricks;

      if (isSolo)
        continue;

      if (pts >= 40)
        extras[winnerParty].push('Doppelkopf');
      for (let i = 0; i < tr.cards.length; ++i)
        if (isFox(tr.cards[i]) && partyOf(tr.players[i]) !== winnerParty)
          extras[winnerParty].push('Fuchs gefangen');
      if (t === tricks.length - 1 && tricks.length === 12) {
        const wi = tr.players.indexOf(tr.winner);
        if (wi >= 0 && isCharlie(tr.cards[wi]))
          extras[winnerParty].push('Karlchen');
      }
    }

    const kontraPoints = 240 - rePoints;
    const reWins = rePoints >= 121;
    const winner = reWins ? 're' : 'kontra';
    const loser = reWins ? 'kontra' : 're';
    const loserPoints = reWins ? kontraPoints : rePoints;
    const loserTricks = reWins ? kontraTricks : reTricks;

    const lines = [];
    lines.push({ label: 'Won', party: winner, value: 1 });
    if (!reWins && !isSolo)
      lines.push({ label: 'Gegen die Alten', party: winner, value: 1 });
    if (loserPoints < 90)
      lines.push({ label: 'Keine 90', party: winner, value: 1 });
    if (loserPoints < 60)
      lines.push({ label: 'Keine 60', party: winner, value: 1 });
    if (loserPoints < 30)
      lines.push({ label: 'Keine 30', party: winner, value: 1 });
    if (loserTricks === 0)
      lines.push({ label: 'Schwarz', party: winner, value: 1 });
    for (let i = 0; i < extras[winner].length; ++i)
      lines.push({ label: extras[winner][i], party: winner, value: 1 });
    for (let i = 0; i < extras[loser].length; ++i)
      lines.push({ label: extras[loser][i], party: loser, value: 1 });

    /* net game value from the winning party's point of view */
    let value = 0;
    for (let i = 0; i < lines.length; ++i)
      value += lines[i].party === winner ? lines[i].value : -lines[i].value;

    const playerScores = [0, 0, 0, 0];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const sign = partyOf(p) === winner ? 1 : -1;
      const mult = isSolo && p === soloist ? 3 : 1;
      playerScores[p] = sign * mult * value;
    }

    return {
      rePoints, kontraPoints, reWins, winner, value, lines, playerScores,
      isSolo, soloist, reTricks, kontraTricks
    };
  }

  Object.assign(V, {
    TRUMP_ORDER, PLAIN_ORDER, CARD_POINTS, TRUMP_HINT,
    isTrump, isDulle, isQueenOfClubs, isFox, isCharlie, effectiveSuit,
    cardStrength, cardPoints, sumPoints, createDeck,
    isValidPlay, validIndices, beats, winningIndex,
    sortHand, teamRelation, partyLabel, scoreRound
  });

})();
