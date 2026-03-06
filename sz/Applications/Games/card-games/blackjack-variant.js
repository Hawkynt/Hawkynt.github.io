;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;
  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Game state ── */
  let bjPlayerHand = [];
  let bjDealerHand = [];
  let bjDealerRevealed = false;
  let bjPlayerStood = false;
  let bjBet = 10;
  let deck = [];
  let score = 100;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Button positions ── */
  const BJ_HIT_BTN   = { x: CANVAS_W / 2 - 110, y: CANVAS_H - 65, w: 90, h: 36 };
  const BJ_STAND_BTN  = { x: CANVAS_W / 2 + 20,  y: CANVAS_H - 65, w: 90, h: 36 };

  /* ══════════════════════════════════════════════════════════════════
     BLACKJACK RULES
     ══════════════════════════════════════════════════════════════════ */

  function bjCardValue(card) {
    if (card.rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(card.rank)) return 10;
    return parseInt(card.rank, 10);
  }

  function bjHandValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      total += bjCardValue(c);
      if (c.rank === 'A') ++aces;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      --aces;
    }
    return total;
  }

  function bjIsBust(hand) {
    return bjHandValue(hand) > 21;
  }

  function bjHit() {
    if (bjPlayerStood || roundOver || gameOver) return;
    const card = deck.pop();
    card.faceUp = true;
    bjPlayerHand.push(card);
    if (_host) _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, 200 + (bjPlayerHand.length - 1) * 50, 400, 0);
    if (bjIsBust(bjPlayerHand)) {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 350, 'BUST!', { color: '#f44', size: 28 });
        _host.screenShake.trigger(8, 400);
      }
      endRound(false);
    }
  }

  function bjStand() {
    if (bjPlayerStood || roundOver || gameOver) return;
    bjPlayerStood = true;
    if (bjDealerHand.length > 0) {
      bjDealerHand[0].faceUp = true;
      if (_host) _host.flipCard(bjDealerHand[0], true);
    }
    bjDealerRevealed = true;
    bjDealerPlay();
  }

  function bjDealerPlay() {
    while (bjHandValue(bjDealerHand) < 17 && deck.length > 0) {
      const card = deck.pop();
      card.faceUp = true;
      bjDealerHand.push(card);
    }
    const playerVal = bjHandValue(bjPlayerHand);
    const dealerVal = bjHandValue(bjDealerHand);
    const dealerBust = dealerVal > 21;
    const playerWins = dealerBust || playerVal > dealerVal;
    const tie = !dealerBust && playerVal === dealerVal;
    if (playerWins) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
      endRound(true);
    } else if (tie) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'PUSH', { color: '#ff8', size: 24 });
      roundOver = true;
      resultMsg = 'Push - Click to continue';
    } else {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 300, 'DEALER WINS', { color: '#f44', size: 24 });
      endRound(false);
    }
  }

  function endRound(won) {
    roundOver = true;
    if (won) {
      score += bjBet * 2;
      resultMsg = 'You win! +' + (bjBet * 2) + ' - Click to continue';
      if (_host) {
        _host.addGlow(180, 380, (bjPlayerHand.length * 50) + CE.CARD_W, CE.CARD_H, 2.0);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      score -= bjBet;
      resultMsg = 'You lose! -' + bjBet + ' - Click to continue';
    }
    if (score <= 0) {
      gameOver = true;
      resultMsg = 'GAME OVER';
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (_host) _host.onScoreChanged(score);
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupBlackjack() {
    deck = CE.shuffle(CE.createDeck());
    bjPlayerHand = [];
    bjDealerHand = [];
    bjDealerRevealed = false;
    bjPlayerStood = false;
    bjBet = 10;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    for (let i = 0; i < 2; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      bjPlayerHand.push(pc);
      if (_host) _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 200 + i * 50, 400, i * 0.15);
      const dc = deck.pop();
      dc.faceUp = i === 1;
      bjDealerHand.push(dc);
      if (_host) _host.dealCardAnim(dc, CANVAS_W / 2, -CE.CARD_H, 200 + i * 50, 100, (i + 2) * 0.15);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawBlackjack() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Dealer' + (bjDealerRevealed ? ' (' + bjHandValue(bjDealerHand) + ')' : ''), 200, 85);
    for (let i = 0; i < bjDealerHand.length; ++i) {
      if (bjDealerHand[i]._dealing) continue;
      const x = 200 + i * 50;
      if (bjDealerHand[i].faceUp)
        CE.drawCardFace(_ctx, x, 100, bjDealerHand[i]);
      else
        CE.drawCardBack(_ctx, x, 100);
    }
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('You (' + bjHandValue(bjPlayerHand) + ')', 200, 385);
    for (let i = 0; i < bjPlayerHand.length; ++i) {
      if (bjPlayerHand[i]._dealing) continue;
      const x = 200 + i * 50;
      CE.drawCardFace(_ctx, x, 400, bjPlayerHand[i]);
    }
    if (!bjPlayerStood && !roundOver && !gameOver) {
      CE.drawButton(_ctx, BJ_HIT_BTN.x, BJ_HIT_BTN.y, BJ_HIT_BTN.w, BJ_HIT_BTN.h, 'Hit (H)', { bg: '#2a5a2a', border: '#6c6' });
      CE.drawButton(_ctx, BJ_STAND_BTN.x, BJ_STAND_BTN.y, BJ_STAND_BTN.w, BJ_STAND_BTN.h, 'Stand (S)', { bg: '#5a2a2a', border: '#c66' });
    }
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Bet: ' + bjBet, CANVAS_W - 40, 120);
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 100;
      setupBlackjack();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawBlackjack();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (!bjPlayerStood) {
        if (CE.isInRect(mx, my, BJ_HIT_BTN.x, BJ_HIT_BTN.y, BJ_HIT_BTN.w, BJ_HIT_BTN.h)) {
          bjHit();
          return;
        }
        if (CE.isInRect(mx, my, BJ_STAND_BTN.x, BJ_STAND_BTN.y, BJ_STAND_BTN.w, BJ_STAND_BTN.h)) {
          bjStand();
          return;
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (e.key === 'h' || e.key === 'H') bjHit();
      if (e.key === 's' || e.key === 'S') bjStand();
    },

    tick(dt) {},
    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      bjPlayerHand = [];
      bjDealerHand = [];
      deck = [];
      bjDealerRevealed = false;
      bjPlayerStood = false;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('blackjack', module);

})();
