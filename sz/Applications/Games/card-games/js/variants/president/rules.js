/* President: dealing, card exchange, legal plays, tricks, titles and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['president'];
  const S = V.S;
  const { RANK_STRENGTH, CANVAS_W, NUM_PLAYERS, PHASE_EXCHANGE, PHASE_PLAYING, PHASE_TRICK_CLEAR, CANVAS_H, TITLE_COLORS, PLAYER_NAMES, PHASE_ROUND_OVER, WIN_SCORE, TITLE_POINTS } = V;

  /* ================================================================
     CARD UTILITIES
     ================================================================ */

  function cardStrength(card) {
    return RANK_STRENGTH[card.rank];
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const sd = cardStrength(a) - cardStrength(b);
      if (sd !== 0) return sd;
      return CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
    });
  }

  function cardsOfRank(hand, rank) {
    return hand.filter(c => c.rank === rank);
  }

  function uniqueRanks(hand) {
    const seen = new Set();
    for (const c of hand) seen.add(c.rank);
    return [...seen];
  }

  function removeCards(hand, cards) {
    for (const c of cards) {
      const idx = hand.indexOf(c);
      if (idx >= 0) hand.splice(idx, 1);
    }
  }

  /* ================================================================
     RULES - VALIDITY
     ================================================================ */

  function isValidPlay(cards, hand) {
    if (cards.length === 0) return false;

    const rank = cards[0].rank;
    if (!cards.every(c => c.rank === rank)) return false;

    if (S.pile.length === 0)
      return true;

    if (cards.length !== S.pileCount) return false;
    if (cardStrength(cards[0]) <= RANK_STRENGTH[S.pileRank]) return false;

    return true;
  }

  function getPlayableRanks(hand) {
    const playable = [];
    if (S.pile.length === 0) {
      for (const rank of uniqueRanks(hand)) {
        const matching = cardsOfRank(hand, rank);
        for (let count = 1; count <= matching.length; ++count)
          playable.push({ rank, count });
      }
      return playable;
    }

    for (const rank of uniqueRanks(hand)) {
      if (RANK_STRENGTH[rank] <= RANK_STRENGTH[S.pileRank]) continue;
      const matching = cardsOfRank(hand, rank);
      if (matching.length >= S.pileCount)
        playable.push({ rank, count: S.pileCount });
    }
    return playable;
  }

  function canPlay(hand) {
    return getPlayableRanks(hand).length > 0;
  }

  function isClearingPlay(cards) {
    if (cards.length === 4) return true;
    if (cards.length > 0 && cards[0].rank === '2') return true;
    return false;
  }

  /* ================================================================
     DEAL & SETUP
     ================================================================ */

  function dealRound() {
    const deck = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    S.pile = [];
    S.pileCount = 0;
    S.pileRank = '';
    S.passCount = 0;
    S.finishOrder = [];
    S.selectedCards = [];
    S.hoverCardIdx = -1;
    S.trickClearTimer = 0;
    S.aiTurnTimer = 0;
    S.exchangeCards = [[], [], [], []];
    S.exchangeDone = [false, false, false, false];
    S.exchangePhaseActive = false;

    for (let i = 0; i < 52; ++i)
      S.hands[i % NUM_PLAYERS].push(deck[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(S.hands[p]);

    for (const c of S.hands[0])
      c.faceUp = true;

    if (S.roundNumber > 0 && S.titles.some(t => t >= 0))
      startExchange();
    else
      startPlaying();

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), V.playerCardY(), i * 0.06);
    }
  }

  function startExchange() {
    S.exchangePhaseActive = true;
    S.phase = PHASE_EXCHANGE;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.titles[p] < 0) {
        S.exchangeDone[p] = true;
        continue;
      }
    }

    for (let p = 1; p < NUM_PLAYERS; ++p) {
      if (!S.exchangeDone[p])
        V.aiDoExchange(p);
    }
  }

  function getExchangeCount(titleIdx) {
    if (titleIdx === 0) return 2;
    if (titleIdx === 1) return 1;
    if (titleIdx === 2) return 1;
    if (titleIdx === 3) return 2;
    return 0;
  }

  function executeExchange() {
    const presIdx = S.titles.indexOf(0);
    const vpIdx = S.titles.indexOf(1);
    const vsIdx = S.titles.indexOf(2);
    const scumIdx = S.titles.indexOf(3);

    if (presIdx >= 0 && scumIdx >= 0) {
      const presGive = S.exchangeCards[presIdx];
      const scumGive = S.exchangeCards[scumIdx];
      removeCards(S.hands[presIdx], presGive);
      removeCards(S.hands[scumIdx], scumGive);
      for (const c of scumGive) S.hands[presIdx].push(c);
      for (const c of presGive) S.hands[scumIdx].push(c);
    }

    if (vpIdx >= 0 && vsIdx >= 0) {
      const vpGive = S.exchangeCards[vpIdx];
      const vsGive = S.exchangeCards[vsIdx];
      removeCards(S.hands[vpIdx], vpGive);
      removeCards(S.hands[vsIdx], vsGive);
      for (const c of vsGive) S.hands[vpIdx].push(c);
      for (const c of vpGive) S.hands[vsIdx].push(c);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      sortHand(S.hands[p]);
      if (p === 0)
        for (const c of S.hands[0]) c.faceUp = true;
    }

    S.exchangePhaseActive = false;
    startPlaying();
  }

  function startPlaying() {
    S.phase = PHASE_PLAYING;
    S.pile = [];
    S.pileCount = 0;
    S.pileRank = '';
    S.passCount = 0;

    if (S.roundNumber === 0) {
      S.currentTurn = findStartingPlayer();
    } else {
      const scumIdx = S.titles.indexOf(3);
      S.currentTurn = scumIdx >= 0 ? scumIdx : 0;
    }
    S.leadPlayer = S.currentTurn;
  }

  function findStartingPlayer() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of S.hands[p])
        if (c.rank === '3' && c.suit === 'clubs') return p;
    return 0;
  }

  /* ================================================================
     PLAY FLOW
     ================================================================ */

  function playCards(playerIdx, cards) {
    removeCards(S.hands[playerIdx], cards);

    for (const c of cards) {
      c.faceUp = true;
      S.pile.push(c);
    }

    S.pileRank = cards[0].rank;
    S.pileCount = cards.length;
    S.passCount = 0;
    S.leadPlayer = playerIdx;

    if (S._host) {
      const label = (playerIdx === 0 ? 'You play ' : PLAYER_NAMES[playerIdx] + ' plays ') +
        cards.length + 'x ' + cards[0].rank;
      S._host.floatingText.add(CANVAS_W / 2, 270, label, { color: '#ff0', size: 14 });
    }

    if (S.hands[playerIdx].length === 0 && S.finishOrder.indexOf(playerIdx) < 0) {
      S.finishOrder.push(playerIdx);
      if (S._host) {
        const pos = S.finishOrder.length;
        const name = playerIdx === 0 ? 'You' : PLAYER_NAMES[playerIdx];
        S._host.floatingText.add(CANVAS_W / 2, 240, name + ' finished #' + pos + '!', {
          color: TITLE_COLORS[pos - 1], size: 18
        });
        if (playerIdx === 0)
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
      }
    }

    if (checkRoundEnd()) return;

    if (isClearingPlay(cards)) {
      S.phase = PHASE_TRICK_CLEAR;
      S.trickClearTimer = 0;
      return;
    }

    advanceTurn();
  }

  function doPass(playerIdx) {
    ++S.passCount;

    if (S._host && playerIdx !== 0) {
      S._host.floatingText.add(CANVAS_W / 2, 290, PLAYER_NAMES[playerIdx] + ' passes', { color: '#aaa', size: 12 });
    }

    const activePlayers = countActivePlayers();

    if (S.passCount >= activePlayers - 1) {
      S.phase = PHASE_TRICK_CLEAR;
      S.trickClearTimer = 0;
      return;
    }

    advanceTurn();
  }

  function clearPile() {
    S.pile = [];
    S.pileCount = 0;
    S.pileRank = '';
    S.passCount = 0;
    S.phase = PHASE_PLAYING;

    if (S.hands[S.leadPlayer].length > 0) {
      S.currentTurn = S.leadPlayer;
    } else {
      S.currentTurn = nextActivePlayer(S.leadPlayer);
    }

    if (checkRoundEnd()) return;

    S.aiTurnTimer = 0;
  }

  function advanceTurn() {
    S.currentTurn = nextActivePlayer(S.currentTurn);
    S.aiTurnTimer = 0;
  }

  function nextActivePlayer(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const p = (from + i) % NUM_PLAYERS;
      if (S.hands[p].length > 0 && S.finishOrder.indexOf(p) < 0) return p;
    }
    return from;
  }

  function countActivePlayers() {
    let count = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (S.hands[p].length > 0 && S.finishOrder.indexOf(p) < 0) ++count;
    return count;
  }

  function checkRoundEnd() {
    const active = countActivePlayers();
    if (active <= 1) {
      for (let p = 0; p < NUM_PLAYERS; ++p)
        if (S.finishOrder.indexOf(p) < 0) S.finishOrder.push(p);
      endRound();
      return true;
    }
    return false;
  }

  function endRound() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      S.titles[S.finishOrder[i]] = i;
      S.scores[S.finishOrder[i]] += TITLE_POINTS[i];
    }

    S.score = S.scores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    ++S.roundNumber;
    S.roundOver = true;

    let anyWin = false;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (S.scores[p] >= WIN_SCORE) anyWin = true;

    if (anyWin) {
      S.gameOver = true;
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (S.scores[p] > S.scores[winner]) winner = p;

      if (S._host) {
        const msg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins the game!';
        const col = winner === 0 ? '#4f4' : '#f88';
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (winner === 0) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    S.phase = PHASE_ROUND_OVER;
  }

  function getCardsForPlay(hand, rank, count) {
    const matching = cardsOfRank(hand, rank);
    return matching.slice(0, count);
  }

  function setup(ctx, canvas, W, H, host) {
    S._ctx = ctx;
    S._host = host || null;
    S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
    S.scores = [0, 0, 0, 0];
    S.titles = [-1, -1, -1, -1];
    S.roundNumber = 0;
    S.roundOver = false;
    S.gameOver = false;
    dealRound();
  }

  Object.assign(V, { cardStrength, getExchangeCount, getCardsForPlay, getPlayableRanks, cardsOfRank, isValidPlay, setup, playCards, doPass, executeExchange, dealRound, advanceTurn, clearPile, sortHand });

})();
