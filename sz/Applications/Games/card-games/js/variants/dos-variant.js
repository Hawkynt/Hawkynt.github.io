;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 3;
  const AI_TURN_DELAY = 0.9;

  const dosColors = ['red', 'blue', 'green', 'yellow'];
  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#555' };

  let hands = [];
  let deck = [];
  let centerPiles = [null, null];
  let currentPlayer = 0;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let selectedCards = [];
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  function createDosDeck() {
    const d = [];
    const dist = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 2, 9: 2, 10: 2 };
    for (const color of dosColors)
      for (let val = 1; val <= 10; ++val)
        for (let c = 0; c < dist[val]; ++c)
          d.push({ color, value: val, type: 'number' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 2, type: 'wild' });
    return d;
  }

  function drawDosCard(x, y, w, h, card, highlight) {
    _ctx.save();
    _ctx.fillStyle = colorMap[card.color] || '#555';
    _ctx.strokeStyle = highlight ? '#ff0' : '#fff';
    _ctx.lineWidth = highlight ? 3 : 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    // White ellipse
    _ctx.fillStyle = 'rgba(255,255,255,0.7)';
    _ctx.beginPath();
    _ctx.ellipse(x + w / 2, y + h / 2, w / 3.5, h / 4, 0, 0, Math.PI * 2);
    _ctx.fill();
    // Number
    _ctx.fillStyle = colorMap[card.color] || '#555';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(card.type === 'wild' ? 'W2' : String(card.value), x + w / 2, y + h / 2);
    _ctx.restore();
  }

  function refillDeck() {
    if (deck.length > 0) return;
    // Reshuffle — keep center piles
    const newDeck = [];
    // Can't refill if no cards available
    deck = CE.shuffle(newDeck);
  }

  function canMatchSingle(card, pileCard) {
    if (!pileCard) return false;
    if (card.type === 'wild') return card.value === pileCard.value;
    return card.value === pileCard.value;
  }

  function canMatchDouble(card1, card2, pileCard) {
    if (!pileCard) return false;
    const sum = (card1.type === 'wild' ? 2 : card1.value) + (card2.type === 'wild' ? 2 : card2.value);
    return sum === pileCard.value;
  }

  function isColorMatch(card, pileCard) {
    if (card.type === 'wild' || pileCard.type === 'wild') return false;
    return card.color === pileCard.color;
  }

  function doPlay(playerIndex, cardIndices, pileIndex) {
    const hand = hands[playerIndex];
    const pileCard = centerPiles[pileIndex];
    let colorBonus = false;

    if (cardIndices.length === 1) {
      const card = hand[cardIndices[0]];
      if (!canMatchSingle(card, pileCard)) return false;
      colorBonus = isColorMatch(card, pileCard);
      centerPiles[pileIndex] = card;
      hand.splice(cardIndices[0], 1);
    } else if (cardIndices.length === 2) {
      const [i1, i2] = cardIndices.sort((a, b) => b - a);
      const card1 = hand[i1];
      const card2 = hand[i2];
      if (!canMatchDouble(card1, card2, pileCard)) return false;
      colorBonus = isColorMatch(card1, pileCard) || isColorMatch(card2, pileCard);
      centerPiles[pileIndex] = card1;
      hand.splice(i1, 1);
      hand.splice(Math.min(i1, i2), 1);
    } else return false;

    // Color bonus: discard one extra card
    if (colorBonus && hand.length > 0) {
      hand.splice(0, 1);
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Color Bonus!', { color: '#ff0', size: 16 });
    }

    // "Dos!" call at 2 cards
    if (hand.length === 2 && _host)
      _host.floatingText.add(CANVAS_W / 2, 350, 'DOS!', { color: '#0ff', size: 24 });

    // Check win
    if (hand.length === 0) {
      roundOver = true;
      if (playerIndex === 0) {
        score += 50;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
          _host.onScoreChanged(score);
        }
      } else if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
        _host.onScoreChanged(score);
      }
      return true;
    }

    currentPlayer = (currentPlayer + 1) % NUM_PLAYERS;
    return true;
  }

  function drawFromDeck(playerIndex) {
    if (deck.length > 0)
      hands[playerIndex].push(deck.pop());
    currentPlayer = (currentPlayer + 1) % NUM_PLAYERS;
  }

  function aiCanPlay(playerIndex) {
    const hand = hands[playerIndex];
    for (let p = 0; p < 2; ++p) {
      if (!centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (canMatchSingle(hand[i], centerPiles[p])) return true;
      for (let i = 0; i < hand.length; ++i)
        for (let j = i + 1; j < hand.length; ++j)
          if (canMatchDouble(hand[i], hand[j], centerPiles[p])) return true;
    }
    return false;
  }

  function aiTurn() {
    if (roundOver || gameOver) return;
    const hand = hands[currentPlayer];

    // Try double matches first (shed 2 cards)
    for (let p = 0; p < 2; ++p) {
      if (!centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        for (let j = i + 1; j < hand.length; ++j)
          if (canMatchDouble(hand[i], hand[j], centerPiles[p])) {
            doPlay(currentPlayer, [j, i], p);
            return;
          }
    }

    // Try single matches (prefer color match)
    for (let p = 0; p < 2; ++p) {
      if (!centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (canMatchSingle(hand[i], centerPiles[p]) && isColorMatch(hand[i], centerPiles[p])) {
          doPlay(currentPlayer, [i], p);
          return;
        }
    }
    for (let p = 0; p < 2; ++p) {
      if (!centerPiles[p]) continue;
      for (let i = 0; i < hand.length; ++i)
        if (canMatchSingle(hand[i], centerPiles[p])) {
          doPlay(currentPlayer, [i], p);
          return;
        }
    }

    // Draw
    drawFromDeck(currentPlayer);
  }

  function setupGame() {
    deck = CE.shuffle(createDosDeck());
    hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      for (let i = 0; i < 7; ++i)
        hands[p].push(deck.pop());
    }
    centerPiles = [deck.pop(), deck.pop()];
    // Ensure center piles are not wild
    for (let p = 0; p < 2; ++p)
      while (centerPiles[p].type === 'wild') {
        deck.unshift(centerPiles[p]);
        centerPiles[p] = deck.pop();
      }
    currentPlayer = 0;
    roundOver = false;
    gameOver = false;
    selectedCards = [];
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 100 + i * 55, 440, i * 0.1);
  }

  function drawGame() {
    // Two center piles
    for (let p = 0; p < 2; ++p) {
      const px = CANVAS_W / 2 - 80 + p * 100;
      const py = 230;
      if (centerPiles[p])
        drawDosCard(px, py, CE.CARD_W, CE.CARD_H, centerPiles[p], false);
      else
        CE.drawEmptySlot(_ctx, px, py, CE.CARD_W, CE.CARD_H);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Pile ' + (p + 1), px + CE.CARD_W / 2, py - 8);
    }

    // Draw pile
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 120, 240, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 120, 350);

    // Player hand
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = 100 + i * 55;
      const sel = selectedCards.indexOf(i) >= 0;
      drawDosCard(x, sel ? 425 : 440, CE.CARD_W, CE.CARD_H, hands[0][i], sel);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !roundOver && !gameOver && (canMatchSingle(hands[0][i], centerPiles[0]) || canMatchSingle(hands[0][i], centerPiles[1])))
        CE.drawHintGlow(_ctx, x, sel ? 425 : 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const y = 20 + (p - 1) * 100;
      _ctx.textAlign = 'left';
      _ctx.fillText('AI ' + p + ' (' + hands[p].length + ' cards)', 60, y + CE.CARD_H * 0.6 + 15);
      for (let i = 0; i < Math.min(hands[p].length, 7); ++i)
        CE.drawCardBack(_ctx, 60 + i * 18, y, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Instructions
    if (!roundOver && !gameOver && currentPlayer === 0) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (selectedCards.length === 0)
        _ctx.fillText('Click card(s) to select, then click a pile to play. Click deck to draw.', CANVAS_W / 2, CANVAS_H - 12);
      else
        _ctx.fillText('Click a pile to play selected card(s), or click another card for double match.', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Confirm/Cancel when cards selected
    if (selectedCards.length > 0 && currentPlayer === 0) {
      CE.drawButton(_ctx, CANVAS_W - 180, 440, 70, 28, 'Clear', { bg: '#633', border: '#a66', fontSize: 11 });
    }
  }

  function sortHand(hand) {
    const co = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    const to = { number: 0, action: 1, wild: 2 };
    hand.sort((a, b) => {
      const cd = (co[a.color] ?? 4) - (co[b.color] ?? 4);
      if (cd !== 0) return cd;
      const td = (to[a.type] ?? 2) - (to[b.type] ?? 2);
      if (td !== 0) return td;
      const av = parseInt(a.value) || 0, bv = parseInt(b.value) || 0;
      return av - bv || String(a.value).localeCompare(String(b.value));
    });
  }

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupGame();
    },
    draw(ctx, W, H) { _ctx = ctx; drawGame(); },
    handleClick(mx, my) {
      if (roundOver || gameOver) { if (_host) _host.onRoundOver(gameOver); return; }
      if (currentPlayer !== 0) return;

      // Clear button
      if (selectedCards.length > 0 && CE.isInRect(mx, my, CANVAS_W - 180, 440, 70, 28)) {
        selectedCards = [];
        return;
      }

      // Click on pile — attempt play
      for (let p = 0; p < 2; ++p) {
        const px = CANVAS_W / 2 - 80 + p * 100;
        if (CE.isInRect(mx, my, px, 230, CE.CARD_W, CE.CARD_H) && selectedCards.length > 0) {
          if (selectedCards.length === 1) {
            if (canMatchSingle(hands[0][selectedCards[0]], centerPiles[p])) {
              doPlay(0, [...selectedCards], p);
              selectedCards = [];
              return;
            }
            if (_host) _host.floatingText.add(mx, my - 20, 'No match!', { color: '#f88', size: 14 });
          } else if (selectedCards.length === 2) {
            if (canMatchDouble(hands[0][selectedCards[0]], hands[0][selectedCards[1]], centerPiles[p])) {
              doPlay(0, [...selectedCards], p);
              selectedCards = [];
              return;
            }
            if (_host) _host.floatingText.add(mx, my - 20, 'Sum doesn\'t match!', { color: '#f88', size: 14 });
          }
          return;
        }
      }

      // Click on draw pile
      if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 120, 240, CE.CARD_W, CE.CARD_H)) {
        selectedCards = [];
        drawFromDeck(0);
        return;
      }

      // Click on player cards
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 100 + i * 55;
        if (CE.isInRect(mx, my, cx, 425, CE.CARD_W, CE.CARD_H + 15)) {
          const idx = selectedCards.indexOf(i);
          if (idx >= 0)
            selectedCards.splice(idx, 1);
          else if (selectedCards.length < 2)
            selectedCards.push(i);
          return;
        }
      }
    },
    handleKey(e) {},
    handlePointerMove() {},
    handlePointerUp() {},
    tick(dt) {
      if (roundOver || gameOver) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = []; deck = []; centerPiles = [null, null]; selectedCards = [];
      roundOver = false; gameOver = false; aiTurnTimer = 0;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('dos', module);

})();
