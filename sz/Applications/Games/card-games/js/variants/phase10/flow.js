/* Phase 10 round flow: dealing, draws, discards with skips, laying phases, hitting and round scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, TURN_DRAW, TURN_PLAY } = V;

  const HAND_SIZE = 10;

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    S.deck = CE.shuffle(V.createPhase10Deck());
    S.discardPile = [];
    S.hands = [];
    S.laidPhases = [];
    S.selectedCards = [];
    S.hitTarget = null;
    S.turnPhase = TURN_DRAW;
    S.currentPlayer = 0;
    S.roundOver = false;
    S.aiTurnTimer = 0;
    S.aiSubStep = 0;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      S.laidPhases.push([]);
      for (let i = 0; i < HAND_SIZE; ++i)
        S.hands[p].push(S.deck.pop());
    }
    S.discardPile.push(S.deck.pop());

    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 40 + i * 55, 470, i * 0.08);
  }

  function setupGame() {
    S.playerPhases = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      S.playerPhases.push(0);
    S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
    S.gameOver = false;
    setupRound();
  }

  /* ================================================================
     RECYCLING DECK
     ================================================================ */

  function recycleDeck() {
    if (S.deck.length > 0) return;
    const top = S.discardPile.pop();
    S.deck = CE.shuffle(S.discardPile);
    S.discardPile = top ? [top] : [];
  }

  /* ================================================================
     ROUND END
     ================================================================ */

  function endRound(winner) {
    S.roundOver = true;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.laidPhases[p].length > 0 && S.playerPhases[p] < 10)
        ++S.playerPhases[p];
    }
    // Score penalty points for cards left in hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === 0) S.score -= V.handPoints(S.hands[p]);
    }
    if (winner === 0) {
      S.score += 50;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'You went out!', { color: '#4f4', size: 22 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[winner] + ' went out!', { color: '#f88', size: 22 });

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.playerPhases[p] >= 10) {
        S.gameOver = true;
        if (S._host) {
          const msg = p === 0 ? 'YOU WIN THE GAME!' : PLAYER_NAMES[p] + ' wins the game!';
          const col = p === 0 ? '#4f4' : '#f44';
          S._host.floatingText.add(CANVAS_W / 2, 260, msg, { color: col, size: 28 });
        }
        break;
      }
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  /* ================================================================
     TURN LOGIC
     ================================================================ */

  function drawFromStock(p) {
    recycleDeck();
    if (S.deck.length === 0) return;
    S.hands[p].push(S.deck.pop());
    S.turnPhase = TURN_PLAY;
  }

  function drawFromDiscard(p) {
    if (S.discardPile.length === 0) return;
    S.hands[p].push(S.discardPile.pop());
    S.turnPhase = TURN_PLAY;
  }

  function discardCard(p, handIdx) {
    const card = S.hands[p].splice(handIdx, 1)[0];
    S.discardPile.push(card);
    // Skip card effect
    if (card.type === 'skip') {
      const next = (S.currentPlayer + 1) % NUM_PLAYERS;
      S.currentPlayer = (next + 1) % NUM_PLAYERS;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 230, PLAYER_NAMES[next] + ' skipped!', { color: '#ff8', size: 14 });
    } else
      S.currentPlayer = (S.currentPlayer + 1) % NUM_PLAYERS;

    S.turnPhase = TURN_DRAW;
    S.selectedCards = [];
    S.hitTarget = null;

    if (S.hands[p].length === 0)
      endRound(p);
  }

  function layPhase(p, groupArrays) {
    for (const g of groupArrays)
      S.laidPhases[p].push(g.slice());
    // Remove cards from hand
    const used = new Set();
    for (const g of groupArrays)
      for (const c of g)
        for (let i = 0; i < S.hands[p].length; ++i)
          if (!used.has(i) && S.hands[p][i] === c) { used.add(i); break; }
    const newHand = [];
    for (let i = 0; i < S.hands[p].length; ++i)
      if (!used.has(i)) newHand.push(S.hands[p][i]);
    S.hands[p] = newHand;
    if (S._host) {
      const msg = p === 0 ? 'Phase laid!' : PLAYER_NAMES[p] + ' laid phase!';
      S._host.floatingText.add(CANVAS_W / 2, 230, msg, { color: '#ff0', size: 16 });
    }
  }

  function hitOnGroup(p, handIdx, targetPlayer, groupIdx) {
    const card = S.hands[p][handIdx];
    S.laidPhases[targetPlayer][groupIdx].push(card);
    S.hands[p].splice(handIdx, 1);
  }

  Object.assign(V, { layPhase, hitOnGroup, drawFromDiscard, drawFromStock, discardCard, endRound,
    setupRound, setupGame });

})();
