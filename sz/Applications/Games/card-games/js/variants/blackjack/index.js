/* Blackjack variant: state, rules, flow, drawing and input in one module. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.blackjack = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Button positions ── */
  const BJ_HIT_BTN   = { x: CANVAS_W / 2 - 110, y: CANVAS_H - 65, w: 90, h: 36 };
  const BJ_STAND_BTN  = { x: CANVAS_W / 2 + 20,  y: CANVAS_H - 65, w: 90, h: 36 };

  const S = V.S = {
    /* ── Game state ── */
    bjPlayerHand: [],
    bjDealerHand: [],
    bjDealerRevealed: false,
    bjPlayerStood: false,
    bjBet: 10,
    deck: [],
    score: 100,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

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
    if (S.bjPlayerStood || S.roundOver || S.gameOver) return;
    const card = S.deck.pop();
    card.faceUp = true;
    S.bjPlayerHand.push(card);
    if (S._host) S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, 200 + (S.bjPlayerHand.length - 1) * 50, 400, 0);
    if (bjIsBust(S.bjPlayerHand)) {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 350, 'BUST!', { color: '#f44', size: 28 });
        S._host.screenShake.trigger(8, 400);
      }
      endRound(false);
    }
  }

  function bjStand() {
    if (S.bjPlayerStood || S.roundOver || S.gameOver) return;
    S.bjPlayerStood = true;
    if (S.bjDealerHand.length > 0) {
      S.bjDealerHand[0].faceUp = true;
      if (S._host) S._host.flipCard(S.bjDealerHand[0], true);
    }
    S.bjDealerRevealed = true;
    bjDealerPlay();
  }

  function bjDealerPlay() {
    while (bjHandValue(S.bjDealerHand) < 17 && S.deck.length > 0) {
      const card = S.deck.pop();
      card.faceUp = true;
      S.bjDealerHand.push(card);
    }
    const playerVal = bjHandValue(S.bjPlayerHand);
    const dealerVal = bjHandValue(S.bjDealerHand);
    const dealerBust = dealerVal > 21;
    const playerWins = dealerBust || playerVal > dealerVal;
    const tie = !dealerBust && playerVal === dealerVal;
    if (playerWins) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
      endRound(true);
    } else if (tie) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'PUSH', { color: '#ff8', size: 24 });
      S.roundOver = true;
      S.resultMsg = 'Push - Click to continue';
    } else {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'DEALER WINS', { color: '#f44', size: 24 });
      endRound(false);
    }
  }

  function endRound(won) {
    S.roundOver = true;
    if (won) {
      S.score += S.bjBet * 2;
      S.resultMsg = 'You win! +' + (S.bjBet * 2) + ' - Click to continue';
      if (S._host) {
        S._host.addGlow(180, 380, (S.bjPlayerHand.length * 50) + CE.CARD_W, CE.CARD_H, 2.0);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      S.score -= S.bjBet;
      S.resultMsg = 'You lose! -' + S.bjBet + ' - Click to continue';
    }
    if (S.score <= 0) {
      S.gameOver = true;
      S.resultMsg = 'GAME OVER';
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function setupBlackjack() {
    S.deck = CE.shuffle(CE.createDeck());
    S.bjPlayerHand = [];
    S.bjDealerHand = [];
    S.bjDealerRevealed = false;
    S.bjPlayerStood = false;
    S.bjBet = 10;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    for (let i = 0; i < 2; ++i) {
      const pc = S.deck.pop();
      pc.faceUp = true;
      S.bjPlayerHand.push(pc);
      if (S._host) S._host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 200 + i * 50, 400, i * 0.15);
      const dc = S.deck.pop();
      dc.faceUp = i === 1;
      S.bjDealerHand.push(dc);
      if (S._host) S._host.dealCardAnim(dc, CANVAS_W / 2, -CE.CARD_H, 200 + i * 50, 100, (i + 2) * 0.15);
    }
  }

  function drawBlackjack() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Dealer' + (S.bjDealerRevealed ? ' (' + bjHandValue(S.bjDealerHand) + ')' : ''), 200, 85);
    for (let i = 0; i < S.bjDealerHand.length; ++i) {
      if (S.bjDealerHand[i]._dealing) continue;
      const x = 200 + i * 50;
      if (S.bjDealerHand[i].faceUp)
        CE.drawCardFace(S._ctx, x, 100, S.bjDealerHand[i]);
      else
        CE.drawCardBack(S._ctx, x, 100);
    }
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You (' + bjHandValue(S.bjPlayerHand) + ')', 200, 385);
    for (let i = 0; i < S.bjPlayerHand.length; ++i) {
      if (S.bjPlayerHand[i]._dealing) continue;
      const x = 200 + i * 50;
      CE.drawCardFace(S._ctx, x, 400, S.bjPlayerHand[i]);
    }
    if (!S.bjPlayerStood && !S.roundOver && !S.gameOver) {
      CE.drawButton(S._ctx, BJ_HIT_BTN.x, BJ_HIT_BTN.y, BJ_HIT_BTN.w, BJ_HIT_BTN.h, 'Hit (H)', { bg: '#2a5a2a', border: '#6c6' });
      CE.drawButton(S._ctx, BJ_STAND_BTN.x, BJ_STAND_BTN.y, BJ_STAND_BTN.w, BJ_STAND_BTN.h, 'Stand (S)', { bg: '#5a2a2a', border: '#c66' });
    }
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Bet: ' + S.bjBet, CANVAS_W - 40, 120);
  }

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 100;
      setupBlackjack();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      drawBlackjack();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host) S._host.onRoundOver(S.gameOver);
        return;
      }
      if (!S.bjPlayerStood) {
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
      if (S.roundOver || S.gameOver) return;
      if (e.key === 'h' || e.key === 'H') bjHit();
      if (e.key === 's' || e.key === 'S') bjStand();
    },

    tick(dt) {},
    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.bjPlayerHand = [];
      S.bjDealerHand = [];
      S.deck = [];
      S.bjDealerRevealed = false;
      S.bjPlayerStood = false;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('blackjack', module);

})();
