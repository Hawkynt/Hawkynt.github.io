/* Durak: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.durak;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, TAKE_BTN, DONE_BTN } = V;

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_DISPLAY_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 620;
    const fanWidth = Math.min(maxWidth, total * 52);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 20;
  }

  function aiCardX(idx, total) {
    const maxWidth = 500;
    const fanWidth = Math.min(maxWidth, total * 30);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardY() {
    return 15;
  }

  function tableAttackX(idx) {
    const startX = 200;
    return startX + idx * 95;
  }

  function tableAttackY() {
    return 230;
  }

  function tableDefenseX(idx) {
    return tableAttackX(idx) + 15;
  }

  function tableDefenseY() {
    return 260;
  }

  const STOCK_X = 30;
  const STOCK_Y = 250;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (S.stock.length > 0) {
      /* Trump card shown sideways under the pile */
      if (S.stock.length > 1 || S.trumpCard) {
        S._ctx.save();
        S._ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
        S._ctx.rotate(Math.PI / 2);
        if (S.trumpCard && S.trumpCard.faceUp)
          CE.drawCardFace(S._ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, S.trumpCard, CE.CARD_H, CE.CARD_W);
        else
          CE.drawCardBack(S._ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, CE.CARD_H, CE.CARD_W);
        S._ctx.restore();
      }

      /* Stock pile on top */
      if (S.stock.length > 1)
        CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);

      /* Card count */
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(S.stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 6);
    } else {
      /* Empty stock */
      S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = 'rgba(255,255,255,0.2)';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawTrumpIndicator() {
    const x = 20;
    const y = 195;
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trump:', x, y);
    const color = CE.resolveSuitColor(S.trumpSuit);
    S._ctx.fillStyle = color;
    S._ctx.font = 'bold 24px serif';
    S._ctx.fillText(SUIT_SYMBOLS[S.trumpSuit] || S.trumpSuit, x + 52, y - 4);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText(SUIT_DISPLAY_NAMES[S.trumpSuit] || S.trumpSuit, x + 78, y + 2);
  }

  function drawDiscard() {
    if (S.discard.length > 0) {
      const dx = CANVAS_W - 100;
      const dy = 250;
      S._ctx.save();
      S._ctx.globalAlpha = 0.4;
      CE.drawCardBack(S._ctx, dx, dy);
      S._ctx.restore();
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('Discard', dx + CE.CARD_W / 2, dy + CE.CARD_H + 4);
      S._ctx.fillText('(' + S.discard.length + ')', dx + CE.CARD_W / 2, dy + CE.CARD_H + 18);
    }
  }

  function drawTable() {
    for (let i = 0; i < S.attackCards.length; ++i) {
      const ax = tableAttackX(i);
      const ay = tableAttackY();
      CE.drawCardFace(S._ctx, ax, ay, S.attackCards[i]);

      if (S.defenseCards[i]) {
        const dx = tableDefenseX(i);
        const dy = tableDefenseY();
        CE.drawCardFace(S._ctx, dx, dy, S.defenseCards[i]);
      }
    }
  }

  function drawPlayerHandCards() {
    const total = S.playerHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (i === S.selectedCardIdx)
        y -= 20;
      else if (i === S.hoverCardIdx)
        y -= 8;

      CE.drawCardFace(S._ctx, x, y, S.playerHand[i]);

      // Hint glow for valid plays
      if (S._host && S._host.hintsEnabled && !S.roundOver && !S.gameOver) {
        const card = S.playerHand[i];
        let showHint = false;
        if (S.isPlayerAttacking && !S.waitingForDefense) {
          // Attack phase: first attack = any card; subsequent = matching ranks on table
          showHint = V.canAddAttackCard(card, S.aiHand.length);
        } else if (!S.isPlayerAttacking && S.waitingForDefense && !V.allDefended()) {
          // Defense phase: highlight cards that can beat any undefended attack card
          for (let a = 0; a < S.attackCards.length; ++a) {
            if (!S.defenseCards[a] && V.canBeat(S.attackCards[a], card)) {
              showHint = true;
              break;
            }
          }
        }
        if (showHint)
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      if (i === S.selectedCardIdx) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawAIHandCards() {
    const total = S.aiHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      const x = aiCardX(i, total);
      const y = aiCardY();
      CE.drawCardBack(S._ctx, x, y, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }
  }

  function drawRoleLabels() {
    /* Player role */
    S._ctx.fillStyle = S.isPlayerAttacking ? '#fa0' : '#8cf';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.isPlayerAttacking ? 'Attacker' : 'Defender', CANVAS_W / 2, CANVAS_H - CE.CARD_H - 42);

    /* AI role */
    S._ctx.fillStyle = S.isPlayerAttacking ? '#8cf' : '#fa0';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    const aiCount = S.aiHand.length;
    S._ctx.fillText('AI (' + aiCount + ') ' + (S.isPlayerAttacking ? '- Defender' : '- Attacker'), CANVAS_W / 2, 88);
  }

  function drawButtons() {
    if (S.roundOver || S.gameOver) return;

    if (!S.isPlayerAttacking && !V.allDefended() && S.attackCards.length > 0) {
      /* Defender can take */
      CE.drawButton(S._ctx, TAKE_BTN.x, TAKE_BTN.y, TAKE_BTN.w, TAKE_BTN.h, 'Take (T)', { bg: '#5a2a2a', border: '#c66' });
    }

    if (S.isPlayerAttacking && S.attackCards.length > 0 && V.allDefended()) {
      /* Attacker can press Done (or add more) */
      CE.drawButton(S._ctx, DONE_BTN.x, DONE_BTN.y, DONE_BTN.w, DONE_BTN.h, 'Done (D)', { bg: '#2a5a2a', border: '#6c6' });
    }
  }

  function drawStatusMessage() {
    if (S.roundOver || S.gameOver) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 10);
      if (!S.gameOver) {
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '12px sans-serif';
        S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 15);
      }
      return;
    }

    /* Turn hint */
    let hint = '';
    if (S.isPlayerAttacking) {
      if (S.attackCards.length === 0)
        hint = 'Your turn to attack -- click a card';
      else if (S.waitingForDefense)
        hint = 'Waiting for AI to defend...';
      else if (V.allDefended())
        hint = 'Add more cards or press Done (D)';
    } else {
      if (S.waitingForDefense && !V.allDefended()) {
        if (S.selectedCardIdx >= 0)
          hint = 'Click an undefended attack card to place defense';
        else
          hint = 'Select a card, then click an attack card to defend -- or Take (T)';
      } else if (V.allDefended() && S.attackCards.length > 0)
        hint = 'Waiting for AI to add cards or finish...';
      else if (S.attackCards.length === 0)
        hint = 'Waiting for AI to attack...';
    }

    if (hint) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(hint, CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawDurak() {
    /* Title */
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Durak', 10, 10);

    /* Score */
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W - 20, 10);

    drawTrumpIndicator();
    drawStock();
    drawDiscard();
    drawTable();
    drawAIHandCards();
    drawPlayerHandCards();
    drawRoleLabels();
    drawButtons();
    drawStatusMessage();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawDurak();
  }

  V.playerCardX = playerCardX;
  V.playerCardY = playerCardY;
  V.tableAttackX = tableAttackX;
  V.tableAttackY = tableAttackY;
  V.tableDefenseX = tableDefenseX;
  V.tableDefenseY = tableDefenseY;
  V.draw = draw;

})();
