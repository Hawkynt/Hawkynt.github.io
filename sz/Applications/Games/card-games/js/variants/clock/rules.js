;(function() {
  'use strict';

  /* Clock: pile positions on the dial, deck, the flip-and-place move cycle, game end
     and hit testing. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.clock;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, RANKS, PILE_COUNT, CARDS_PER_PILE, CENTER_PILE, CW, CH, CLOCK_CX,
    CLOCK_CY, CLOCK_RADIUS, FAN_OFFSET
  } = V;
  const { shuffle } = SZ.CardGames.shared.solitaireFallback;

  /* ── Rank → pile index mapping: A=0, 2=1, ... Q=11, K=12(center) ── */
  function rankToPile(rank) {
    const idx = RANKS.indexOf(rank);
    if (idx === 12) return CENTER_PILE;  // K → center
    return idx;                           // A=0, 2=1, ... Q=11
  }

  /* ── Pile position: 0-11 are clock face (1 o'clock through 12 o'clock), 12 is center ── */
  function pilePosition(pileIdx) {
    if (pileIdx === CENTER_PILE)
      return { x: CLOCK_CX, y: CLOCK_CY };
    // Clock face: pileIdx 0 = Ace = 1 o'clock position, ... pileIdx 11 = Queen = 12 o'clock
    // Angle: 12 o'clock is -PI/2, going clockwise
    const hourPosition = pileIdx + 1;  // 1-12
    const angle = -Math.PI / 2 + (hourPosition / 12) * 2 * Math.PI;
    return {
      x: CLOCK_CX + Math.cos(angle) * CLOCK_RADIUS,
      y: CLOCK_CY + Math.sin(angle) * CLOCK_RADIUS
    };
  }

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createDeck() {
    if (CE && CE.createDeck)
      return CE.createDeck();
    const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ suit, rank, value: RANKS.indexOf(rank), faceUp: false, color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black' });
    return deck;
  }

  /* ================================================================
   *  GAME LOGIC
   * ================================================================ */

  function countFaceUp(pile) {
    let n = 0;
    for (const c of pile)
      if (c.faceUp) ++n;
    return n;
  }

  function isPileComplete(pileIdx) {
    return countFaceUp(S.piles[pileIdx]) === CARDS_PER_PILE;
  }

  function allComplete() {
    for (let i = 0; i < PILE_COUNT; ++i)
      if (!isPileComplete(i)) return false;
    return true;
  }

  function topFaceDownCard(pileIdx) {
    const pile = S.piles[pileIdx];
    for (let i = pile.length - 1; i >= 0; --i)
      if (!pile[i].faceUp) return pile[i];
    return null;
  }

  function flipFromPile(pileIdx) {
    const card = topFaceDownCard(pileIdx);
    if (!card) return null;
    card.faceUp = true;
    return card;
  }

  function placeCard(card, targetPile) {
    S.piles[targetPile].push(card);
    ++S.cardsPlaced;
    S.score = S.cardsPlaced;
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
  }

  function startMove() {
    if (S.roundOver || S.gameOver || S.animating) return;

    // If no current card, flip from center pile to start
    if (!S.currentCard) {
      S.currentCard = flipFromPile(CENTER_PILE);
      S.currentFromPile = CENTER_PILE;
      if (!S.currentCard) {
        endGame(false);
        return;
      }
    }

    const targetPile = rankToPile(S.currentCard.rank);
    const card = S.currentCard;
    S.currentCard = null;

    // Animate the card moving from its source pile to the target pile
    const fromPos = pilePosition(S.currentFromPile);
    const toPos = pilePosition(targetPile);

    S.animCard = card;
    S.animFromX = fromPos.x - CW / 2;
    S.animFromY = fromPos.y - CH / 2;
    S.animToX = toPos.x - CW / 2;
    S.animToY = toPos.y - CH / 2;
    S.animProgress = 0;
    S.animating = true;

    S.animCallback = function() {
      placeCard(card, targetPile);

      if (S._host && S._host.floatingText) {
        const pos = pilePosition(targetPile);
        S._host.floatingText.add(pos.x, pos.y - CH / 2 - 10, '+1', { color: '#4f4', size: 16 });
      }
      if (S._host && S._host.particles)
        S._host.particles.sparkle(toPos.x, toPos.y, 3);

      // Check win
      if (allComplete()) {
        endGame(true);
        return;
      }

      // Check if target pile is now complete (all 4 face-up = 4 Kings placed, or pile done)
      // If 4th King is turned and other piles aren't done, game over
      if (targetPile === CENTER_PILE && isPileComplete(CENTER_PILE)) {
        if (!allComplete()) {
          endGame(false);
          return;
        }
      }

      // Flip next card from target pile
      const nextCard = topFaceDownCard(targetPile);
      if (nextCard) {
        nextCard.faceUp = true;
        S.currentCard = nextCard;
        S.currentFromPile = targetPile;
      } else {
        // Target pile fully face-up, no more face-down cards to flip
        // This shouldn't happen in a standard game unless we just completed everything
        if (!allComplete())
          endGame(false);
      }
    };
  }

  function endGame(won) {
    S.roundOver = true;
    S.gameOver = !won;
    S.autoPlaying = false;

    if (won) {
      S.score = 52;
      S.resultMsg = 'You win! All piles completed!';
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
      if (S._host && S._host.particles)
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
    } else {
      S.resultMsg = S.cardsPlaced + ' of 52 cards placed. Better luck next time!';
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Game Over', { color: '#f88', size: 28 });
    }

    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
    if (S._host && S._host.onRoundOver)
      S._host.onRoundOver(S.gameOver);
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = shuffle(createDeck());

    S.piles = [];
    for (let i = 0; i < PILE_COUNT; ++i)
      S.piles.push([]);

    // Deal 4 cards to each of the 13 piles
    // Standard deal: go round-robin
    let dealIdx = 0;
    for (let round = 0; round < CARDS_PER_PILE; ++round)
      for (let p = 0; p < PILE_COUNT; ++p) {
        const card = deck[dealIdx++];
        card.faceUp = false;
        S.piles[p].push(card);
      }

    S.score = 0;
    S.cardsPlaced = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.currentCard = null;
    S.currentFromPile = -1;
    S.autoPlaying = false;
    S.autoTimer = 0;
    S.animating = false;
    S.animCard = null;
    S.animCallback = null;
    S.hoverPile = -1;

    // Animate deal
    if (S._host && S._host.dealCardAnim) {
      for (let p = 0; p < PILE_COUNT; ++p)
        for (let r = 0; r < CARDS_PER_PILE; ++r) {
          const card = S.piles[p][r];
          const pos = pilePosition(p);
          const tx = pos.x - CW / 2 + r * FAN_OFFSET;
          const ty = pos.y - CH / 2 + r * FAN_OFFSET;
          S._host.dealCardAnim(card, CANVAS_W / 2, -CH, tx, ty, (p * CARDS_PER_PILE + r) * 0.02);
        }
    }

    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTestPile(mx, my) {
    for (let p = 0; p < PILE_COUNT; ++p) {
      const pos = pilePosition(p);
      const pile = S.piles[p];
      const stackOffset = (pile.length - 1) * FAN_OFFSET;
      const x = pos.x - CW / 2;
      const y = pos.y - CH / 2;
      if (mx >= x && mx < x + CW + stackOffset && my >= y && my < y + CH + stackOffset)
        return p;
    }
    return -1;
  }

  function isInRect(mx, my, r) {
    return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;
  }

  Object.assign(V, {
    rankToPile, pilePosition, countFaceUp, isPileComplete, startMove, newGame, hitTestPile,
    isInRect
  });

})();
