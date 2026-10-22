/* The in-battle HUD: background and play field, buff indicators, health and
   mana bars, hands, the end-turn button, the card tooltip and the deck pile. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;
  const U = NS.util;

  function drawBackground() {
    const ctx = D.ctx;
    // Gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    bgGrad.addColorStop(0, '#120a1e');
    bgGrad.addColorStop(0.45, '#1a1024');
    bgGrad.addColorStop(0.55, '#1a1024');
    bgGrad.addColorStop(1, '#0a1218');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Subtle grid pattern
    ctx.strokeStyle = '#ffffff06';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < C.CANVAS_W; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, C.CANVAS_H);
      ctx.stroke();
    }
    for (let gy = 0; gy < C.CANVAS_H; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(C.CANVAS_W, gy);
      ctx.stroke();
    }

    // Play field divider with glow
    const divY = C.CANVAS_H / 2;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, divY);
    ctx.lineTo(C.CANVAS_W, divY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Turn number display
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Turn ' + S.turnNumber, C.CANVAS_W - 10, divY - 5);

    // Player/opponent labels
    ctx.fillStyle = '#555';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OPPONENT', 10, 8 + 10);
    ctx.fillText('YOU', 10, C.CANVAS_H - 32 + 10);
  }

  function drawBuffIndicators() {
    const ctx = D.ctx;
    // Player buffs
    let bx = 160;
    const pBufY = C.CANVAS_H - 50;
    if (S.playerDamageBuff > 0) {
      ctx.fillStyle = '#fa4';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2694+' + S.playerDamageBuff, bx, pBufY + 10);
      bx += 40;
    }
    if (S.playerShieldBuff > 0) {
      ctx.fillStyle = '#8af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u{1F6E1}+' + S.playerShieldBuff, bx, pBufY + 10);
      bx += 40;
    }
    if (S.playerPoison > 0) {
      ctx.fillStyle = '#0a0';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2620' + S.playerPoison, bx, pBufY + 10);
    }

    // AI buffs
    let ax = C.CANVAS_W / 2 + 110;
    const aBufY = 10;
    if (S.aiDamageBuff > 0) {
      ctx.fillStyle = '#f88';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2694+' + S.aiDamageBuff, ax, aBufY + 10);
      ax += 40;
    }
    if (S.aiShieldBuff > 0) {
      ctx.fillStyle = '#8af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u{1F6E1}+' + S.aiShieldBuff, ax, aBufY + 10);
      ax += 40;
    }
    if (S.aiPoison > 0) {
      ctx.fillStyle = '#0a0';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2620' + S.aiPoison, ax, aBufY + 10);
    }
  }

  function drawHealthBar(x, y, hp, maxHP, shield, color, label) {
    const ctx = D.ctx;
    const barW = 200;
    const barH = 16;

    // Background
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, barW, barH);

    // Health portion
    const hpRatio = Math.max(0, hp / maxHP);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * hpRatio, barH);

    // Shield overlay
    if (shield > 0) {
      const shieldRatio = Math.min(1, shield / maxHP);
      ctx.fillStyle = 'rgba(100,160,255,0.4)';
      ctx.fillRect(x, y, barW * shieldRatio, barH);
    }

    // Border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${label}: ${hp}/${maxHP}` + (shield > 0 ? ` (+${shield})` : ''), x + 4, y + 12);
  }

  function drawManaBar(x, y, mana, maxMana) {
    const ctx = D.ctx;
    const barW = 120;
    const barH = 14;

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, barW, barH);

    const manaRatio = mana / Math.max(1, maxMana);
    ctx.fillStyle = '#38f';
    ctx.fillRect(x, y, barW * manaRatio, barH);

    // Mana shimmer glow effect when active
    if (S.manaShimmerTimer > 0) {
      ctx.fillStyle = `rgba(80,150,255,${S.manaShimmerTimer})`;
      ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    }

    ctx.strokeStyle = '#448';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Mana text display
    ctx.fillStyle = '#adf';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Mana: ${mana}/${maxMana}`, x + 4, y + 11);
  }

  function drawTurnIndicator() {
    const ctx = D.ctx;
    if (S.turnTransition > 0) {
      const alpha = Math.min(1, S.turnTransition * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(S.turnTransitionText, C.CANVAS_W / 2, C.CANVAS_H / 2 - 10);
    }
  }

  function drawEndTurnButton() {
    const ctx = D.ctx;
    if (!S.isPlayerTurn || S.state !== C.STATE_PLAYING)
      return;
    const bx = C.CANVAS_W - 100, by = C.CANVAS_H / 2 - 20, bw = 80, bh = 30;

    // Check hover
    const btnHovered = S.mouseX >= bx && S.mouseX <= bx + bw && S.mouseY >= by && S.mouseY <= by + bh;

    if (btnHovered) {
      ctx.shadowColor = '#4f8';
      ctx.shadowBlur = 8;
    }

    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, btnHovered ? '#3b6' : '#2a5');
    grad.addColorStop(1, btnHovered ? '#1a4' : '#193');
    ctx.fillStyle = grad;
    NS.cards.roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = '#4f8';
    ctx.lineWidth = 1;
    NS.cards.roundRect(ctx, bx, by, bw, bh, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('End Turn', bx + bw / 2, by + 17);

    ctx.fillStyle = '#8c8';
    ctx.font = '8px sans-serif';
    ctx.fillText('[E]', bx + bw / 2, by + 27);
  }

  function drawCardTooltip() {
    const ctx = D.ctx;
    if (S.state !== C.STATE_PLAYING || S.hoveredCard < 0 || S.hoveredCard >= S.playerHand.length)
      return;

    const card = S.playerHand[S.hoveredCard];
    const tc = T.TYPE_COLORS[card.type];
    const typeIcon = T.TYPE_ICONS[card.type];
    const comboIcon = T.COMBO_ICONS[card.combo];

    const tw = 210;
    const th = 150;
    const cx = U.getCardX(S.hoveredCard, S.playerHand.length);
    let tx = cx - tw / 2;
    let ty = 240;

    // Keep tooltip on screen
    if (tx < 4) tx = 4;
    if (tx + tw > C.CANVAS_W - 4) tx = C.CANVAS_W - tw - 4;

    // Background
    ctx.fillStyle = 'rgba(10,10,24,0.95)';
    NS.cards.roundRect(ctx, tx, ty, tw, th, 6);
    ctx.fill();
    ctx.strokeStyle = tc.border;
    ctx.lineWidth = 2;
    NS.cards.roundRect(ctx, tx, ty, tw, th, 6);
    ctx.stroke();

    // Inner glow line
    ctx.strokeStyle = tc.border + '30';
    ctx.lineWidth = 1;
    NS.cards.roundRect(ctx, tx + 3, ty + 3, tw - 6, th - 6, 4);
    ctx.stroke();

    let row = ty + 20;
    const padL = tx + 12;
    const padR = tx + tw - 12;

    // Card name (large)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.name, padL, row);

    // Type + element on right
    ctx.fillStyle = tc.badge;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(typeIcon.symbol + ' ' + typeIcon.label, padR, row);

    row += 18;

    // Horizontal separator
    ctx.strokeStyle = tc.border + '50';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, row);
    ctx.lineTo(padR, row);
    ctx.stroke();

    row += 14;

    // Stats line
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';

    // Mana cost
    ctx.fillStyle = '#8cf';
    ctx.fillText('\u{1F48E} Cost: ' + card.cost + ' mana', padL, row);

    // Power
    ctx.fillStyle = tc.badge;
    ctx.textAlign = 'right';
    const powerLabel = card.type === 'attack' ? 'Damage' : card.type === 'defend' ? 'Shield' : card.type === 'heal' ? 'Heal' : 'Power';
    ctx.fillText(typeIcon.symbol + ' ' + powerLabel + ': ' + card.power, padR, row);

    row += 16;

    // Element / combo
    if (comboIcon) {
      ctx.fillStyle = comboIcon.color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(comboIcon.symbol + ' Element: ' + card.combo.charAt(0).toUpperCase() + card.combo.slice(1), padL, row);
      ctx.fillStyle = '#777';
      ctx.textAlign = 'right';
      ctx.fillText('+2 combo bonus', padR, row);
    }

    row += 16;

    // Description
    ctx.fillStyle = '#ddd';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.desc, padL, row);

    row += 14;

    // Flavor text
    if (card.flavor) {
      ctx.fillStyle = '#888';
      ctx.font = 'italic 9px sans-serif';
      ctx.fillText('"' + card.flavor + '"', padL, row);
    }

    row += 14;

    // Playability hint
    if (card.cost > S.playerMana) {
      ctx.fillStyle = '#f66';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('Not enough mana! Need ' + (card.cost - S.playerMana) + ' more.', padL, row);
    } else {
      ctx.fillStyle = '#6f6';
      ctx.font = '9px sans-serif';
      ctx.fillText('Click or press ' + (S.hoveredCard + 1) + ' to play', padL, row);
    }
  }

  function drawDeckPile() {
    const ctx = D.ctx;
    // Stacked card appearance for deck
    const dx = 20, dy = 370;
    const dw = 50, dh = 40;

    // Shadow cards behind
    for (let s = 2; s >= 1; --s) {
      ctx.fillStyle = '#1a1030';
      NS.cards.roundRect(ctx, dx + s * 2, dy - s * 2, dw, dh, 3);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      NS.cards.roundRect(ctx, dx + s * 2, dy - s * 2, dw, dh, 3);
      ctx.stroke();
    }

    // Top card
    const grad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    grad.addColorStop(0, '#2a1a3e');
    grad.addColorStop(1, '#1a1030');
    ctx.fillStyle = grad;
    NS.cards.roundRect(ctx, dx, dy, dw, dh, 3);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    NS.cards.roundRect(ctx, dx, dy, dw, dh, 3);
    ctx.stroke();

    // Arcane symbol on back
    ctx.fillStyle = 'rgba(170,102,255,0.25)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2735', dx + dw / 2, dy + dh / 2 + 2);

    // Count
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.playerDeck.length, dx + dw / 2, dy + dh + 12);

    ctx.fillStyle = '#888';
    ctx.font = '7px sans-serif';
    ctx.fillText('DECK', dx + dw / 2, dy + dh + 22);

    // Discard pile indicator
    const ddx = dx + dw + 10;
    if (S.playerDiscard.length > 0) {
      ctx.fillStyle = '#1a1020';
      NS.cards.roundRect(ctx, ddx, dy + 8, 35, 30, 2);
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      NS.cards.roundRect(ctx, ddx, dy + 8, 35, 30, 2);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(S.playerDiscard.length, ddx + 17, dy + 26);
      ctx.fillText('DISCARD', ddx + 17, dy + 50);
    }
  }

  function drawPlayerHand() {
    const cardW = 80;
    const cardH = 110;

    for (let i = 0; i < S.playerHand.length; ++i) {
      const card = S.playerHand[i];
      const x = U.getCardX(i, S.playerHand.length);
      const y = S.hoveredCard === i ? 405 : 420;
      const hovered = S.hoveredCard === i;
      NS.cards.drawCard(card, x, y, cardW, cardH, true, hovered);
    }
  }

  function drawAiHand() {
    const cardW = 60;
    const cardH = 80;
    for (let i = 0; i < S.aiHand.length; ++i) {
      const x = U.getCardX(i, S.aiHand.length);
      NS.cards.drawCard(S.aiHand[i], x, 60, cardW, cardH, false, false);
    }
  }

  Object.assign(NS.hud, {
    drawBackground, drawBuffIndicators, drawHealthBar, drawManaBar,
    drawTurnIndicator, drawEndTurnButton, drawCardTooltip, drawDeckPile,
    drawPlayerHand, drawAiHand
  });
})();
