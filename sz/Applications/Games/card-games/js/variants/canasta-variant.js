;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Game state ── */
  let playerHand = [];
  let aiHands = [[]];
  let canastaMelds = [];
  let discardPile = [];
  let deck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     CANASTA RULES
     ══════════════════════════════════════════════════════════════════ */

  function canastaCanMeld(hand) {
    const counts = {};
    for (const c of hand) {
      const k = c.rank;
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).some(([, v]) => v >= 3);
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanasta() {
    deck = CE.shuffle([...CE.createDeck(), ...CE.createDeck()]);
    playerHand = [];
    aiHands = [[]];
    canastaMelds = [];
    discardPile = [];
    roundOver = false;
    gameOver = false;
    for (let i = 0; i < 11; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      if (_host) _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 40 + i * 55, 440, i * 0.08);
      const ac = deck.pop();
      aiHands[0].push(ac);
    }
    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawCanasta() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Canasta', 40, 225);
    if (discardPile.length > 0)
      CE.drawCardFace(_ctx, CANVAS_W / 2 + 40, 240, discardPile[discardPile.length - 1]);
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 20, 240);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 20, 350);
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', 40, 425);
    // Pre-compute rank counts for hint glow
    const _hintCounts = {};
    if (_host && _host.hintsEnabled) {
      for (const c of playerHand)
        _hintCounts[c.rank] = (_hintCounts[c.rank] || 0) + 1;
      // Also count ranks matching existing melds on the table
      for (const m of canastaMelds)
        _hintCounts[m.rank] = (_hintCounts[m.rank] || 0) + 3;
    }
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = 40 + i * 50;
      CE.drawCardFace(_ctx, x, 440, playerHand[i], CE.CARD_W * 0.85, CE.CARD_H * 0.85);
      if (_host && _host.hintsEnabled && (_hintCounts[playerHand[i].rank] || 0) >= 2)
        CE.drawHintGlow(_ctx, x, 440, CE.CARD_W * 0.85, CE.CARD_H * 0.85, _host.hintTime);
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI (' + aiHands[0].length + ' cards)', 40, 65);
    for (let i = 0; i < Math.min(aiHands[0].length, 11); ++i)
      CE.drawCardBack(_ctx, 40 + i * 22, 80, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    _ctx.fillText('Melds: ' + canastaMelds.length, CANVAS_W - 150, 440);
  }

  /* ══════════════════════════════════════════════════════════════════
     HAND SORTING
     ══════════════════════════════════════════════════════════════════ */

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupCanasta();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawCanasta();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (mx >= CANVAS_W / 2 - CE.CARD_W - 20 && mx <= CANVAS_W / 2 - 20 &&
          my >= 240 && my <= 240 + CE.CARD_H && deck.length > 0) {
        const c = deck.pop();
        c.faceUp = true;
        playerHand.push(c);
        return;
      }
      if (canastaCanMeld(playerHand)) {
        const counts = {};
        for (const c of playerHand) {
          const k = c.rank;
          if (!counts[k]) counts[k] = [];
          counts[k].push(c);
        }
        for (const [rank, cards] of Object.entries(counts)) {
          if (cards.length >= 3) {
            canastaMelds.push({ rank, count: cards.length });
            for (const c of cards)
              playerHand.splice(playerHand.indexOf(c), 1);
            score += cards.length * 10;
            if (_host) {
              _host.floatingText.add(CANVAS_W / 2, 350, 'Meld: ' + cards.length + '\u00d7' + rank, { color: '#4f4', size: 18 });
              if (cards.length >= 7) {
                _host.addGlow(40, 420, playerHand.length * 50 + CE.CARD_W, CE.CARD_H, 2);
                _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
              }
              _host.onScoreChanged(score);
            }
            break;
          }
        }
        if (playerHand.length === 0) {
          if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          roundOver = true;
        }
      }
    },

    handleKey(e) {},
    tick(dt) {},
    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { sortHand(playerHand); },

    cleanup() {
      playerHand = [];
      aiHands = [[]];
      canastaMelds = [];
      discardPile = [];
      deck = [];
      roundOver = false;
      gameOver = false;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('canasta', module);

})();
