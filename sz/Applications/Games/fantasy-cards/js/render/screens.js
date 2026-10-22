/* Full-screen states: the title menu with difficulty buttons, the deck builder
   collection grid and the defeat/victory/pause overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;
  const U = NS.util;

  function drawMenuScreen() {
    const ctx = D.ctx;
    // Background with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    bgGrad.addColorStop(0, '#0a0818');
    bgGrad.addColorStop(0.5, '#0a0a18');
    bgGrad.addColorStop(1, '#080612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Decorative card fan behind title
    const fanCards = [
      { type: 'attack', color: '#f44' },
      { type: 'defend', color: '#48f' },
      { type: 'heal',   color: '#4f4' },
      { type: 'buff',   color: '#fa4' },
      { type: 'debuff', color: '#a66' }
    ];
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < fanCards.length; ++i) {
      const angle = (i - 2) * 0.18;
      const fx = C.CANVAS_W / 2;
      const fy = 90;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(angle);
      NS.cards.roundRect(ctx, -25, -40, 50, 70, 4);
      ctx.fillStyle = fanCards[i].color;
      ctx.fill();
      ctx.strokeStyle = fanCards[i].color;
      ctx.lineWidth = 1;
      NS.cards.roundRect(ctx, -25, -40, 50, 70, 4);
      ctx.stroke();
      const ti = T.TYPE_ICONS[fanCards[i].type];
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ti.symbol, 0, 8);
      ctx.restore();
    }
    ctx.restore();

    // Title
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fantasy Cards', C.CANVAS_W / 2, 120);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Deck-Building Card Battler', C.CANVAS_W / 2, 148);

    // Difficulty selection
    const diffs = [C.DIFF_EASY, C.DIFF_NORMAL, C.DIFF_HARD];
    const labels = ['Easy', 'Normal', 'Hard'];
    const diffDescs = ['Random AI, forgiving', 'Tactical AI, balanced', 'Strategic AI, ruthless'];
    for (let i = 0; i < 3; ++i) {
      const bx = C.CANVAS_W / 2 - 75;
      const by = 180 + i * 48;
      const selected = S.difficulty === diffs[i];

      if (selected) {
        ctx.shadowColor = '#6f8';
        ctx.shadowBlur = 8;
      }
      NS.cards.roundRect(ctx, bx, by, 150, 38, 4);
      ctx.fillStyle = selected ? '#1a3a2a' : '#181828';
      ctx.fill();
      ctx.strokeStyle = selected ? '#6f8' : '#444';
      ctx.lineWidth = selected ? 2 : 1;
      NS.cards.roundRect(ctx, bx, by, 150, 38, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(labels[i], C.CANVAS_W / 2, by + 17);

      ctx.fillStyle = '#888';
      ctx.font = '9px sans-serif';
      ctx.fillText(diffDescs[i], C.CANVAS_W / 2, by + 32);
    }

    // Card type reference
    const refY = 340;
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Card Types:', C.CANVAS_W / 2, refY);

    const typeList = ['attack', 'defend', 'heal', 'buff', 'debuff'];
    const typeNames = ['Attack', 'Defend', 'Heal', 'Buff', 'Debuff'];
    const typeBriefs = ['Deal damage', 'Gain shield', 'Restore HP', 'Boost stats', 'Weaken foe'];
    const totalRefW = typeList.length * 140;
    const refStartX = (C.CANVAS_W - totalRefW) / 2 + 70;

    for (let i = 0; i < typeList.length; ++i) {
      const rx = refStartX + i * 140;
      const ry = refY + 16;
      const tc = T.TYPE_COLORS[typeList[i]];
      const ti = T.TYPE_ICONS[typeList[i]];

      ctx.fillStyle = tc.badge;
      ctx.font = '14px sans-serif';
      ctx.fillText(ti.symbol, rx - 18, ry + 4);

      ctx.fillStyle = tc.badge;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(typeNames[i], rx + 2, ry);

      ctx.fillStyle = '#777';
      ctx.font = '9px sans-serif';
      ctx.fillText(typeBriefs[i], rx + 2, ry + 14);
    }

    // Element icons
    const elemY = refY + 50;
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('Elements:', C.CANVAS_W / 2, elemY);

    const elemKeys = Object.keys(T.COMBO_ICONS);
    const totalElemW = elemKeys.length * 100;
    const elemStartX = (C.CANVAS_W - totalElemW) / 2 + 50;

    for (let i = 0; i < elemKeys.length; ++i) {
      const key = elemKeys[i];
      const ci = T.COMBO_ICONS[key];
      const ex = elemStartX + i * 100;
      ctx.fillStyle = ci.color;
      ctx.font = '12px sans-serif';
      ctx.fillText(ci.symbol + ' ' + key.charAt(0).toUpperCase() + key.slice(1), ex, elemY + 16);
    }

    // Start button
    const startBtnX = C.CANVAS_W / 2 - 75;
    const startBtnY = elemY + 30;
    const startBtnW = 150;
    const startBtnH = 38;
    const startHovered = S.mouseX >= startBtnX && S.mouseX <= startBtnX + startBtnW
      && S.mouseY >= startBtnY && S.mouseY <= startBtnY + startBtnH;

    if (startHovered) {
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 12;
    }
    const startGrad = ctx.createLinearGradient(startBtnX, startBtnY, startBtnX, startBtnY + startBtnH);
    startGrad.addColorStop(0, startHovered ? '#4a3a0a' : '#3a2a08');
    startGrad.addColorStop(1, startHovered ? '#2a1a04' : '#1a1004');
    ctx.fillStyle = startGrad;
    NS.cards.roundRect(ctx, startBtnX, startBtnY, startBtnW, startBtnH, 4);
    ctx.fill();
    ctx.strokeStyle = '#fc0';
    ctx.lineWidth = 2;
    NS.cards.roundRect(ctx, startBtnX, startBtnY, startBtnW, startBtnH, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Start Game', C.CANVAS_W / 2, startBtnY + 22);

    // Instructions
    const instY = startBtnY + startBtnH + 12;
    ctx.fillStyle = '#6a8';
    ctx.font = '11px sans-serif';
    ctx.fillText('D = Deck Builder  |  H = How to Play  |  F2 = Start', C.CANVAS_W / 2, instY);

    // Combo hint
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.fillText('Play cards of the same element for +2 combo bonus!', C.CANVAS_W / 2, instY + 20);
  }

  function drawDeckBuilder() {
    const ctx = D.ctx;
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Title with deck count indicator
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Deck Builder', C.CANVAS_W / 2 - 50, 26);

    // Count badge
    const countColor = S.selectedDeck.length === C.DECK_SIZE ? '#4f4' : S.selectedDeck.length > C.DECK_SIZE ? '#f44' : '#fa4';
    ctx.fillStyle = countColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${S.selectedDeck.length}/${C.DECK_SIZE}`, C.CANVAS_W / 2 + 60, 26);

    // Type filter legend
    const legendTypes = ['attack', 'defend', 'heal', 'buff', 'debuff'];
    const legendLabels = ['Attack', 'Defend', 'Heal', 'Buff', 'Debuff'];
    for (let i = 0; i < legendTypes.length; ++i) {
      const lx = 60 + i * 155;
      const ly = 38;
      const tc = T.TYPE_COLORS[legendTypes[i]];
      const icon = T.TYPE_ICONS[legendTypes[i]];
      ctx.fillStyle = tc.badge;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon.symbol + ' ' + legendLabels[i], lx, ly);
    }

    // Card collection grid -- improved with type coloring
    const cols = 8;
    const cardW = 90;
    const cardH = 52;
    const gapX = 6;
    const gapY = 4;
    const startY = 48;

    S.hoveredDeckCard = -1;

    for (let i = 0; i < T.ALL_CARDS.length; ++i) {
      const card = T.ALL_CARDS[i];
      const tc = T.TYPE_COLORS[card.type];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = 16 + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const inDeck = S.selectedDeck.includes(card.id);

      // Check hover
      const isHovered = S.mouseX >= cx && S.mouseX <= cx + cardW && S.mouseY >= cy && S.mouseY <= cy + cardH;
      if (isHovered)
        S.hoveredDeckCard = i;

      // Card background with type color
      if (isHovered) {
        ctx.shadowColor = tc.border;
        ctx.shadowBlur = 8;
      }

      const grad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      grad.addColorStop(0, inDeck ? '#1a3a1a' : tc.grad1);
      grad.addColorStop(1, inDeck ? '#0a2a0a' : tc.grad2);
      ctx.fillStyle = grad;
      NS.cards.roundRect(ctx, cx, cy, cardW, cardH, 3);
      ctx.fill();

      ctx.strokeStyle = inDeck ? '#4f4' : tc.border;
      ctx.lineWidth = isHovered ? 2 : 1;
      NS.cards.roundRect(ctx, cx, cy, cardW, cardH, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // In-deck check mark
      if (inDeck) {
        ctx.fillStyle = '#4f4';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('\u2713', cx + cardW - 4, cy + 13);
      }

      // Mana cost
      ctx.fillStyle = '#38f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.cost + '', cx + 4, cy + 12);

      // Type icon
      const typeIcon = T.TYPE_ICONS[card.type];
      ctx.fillStyle = tc.badge;
      ctx.font = '9px sans-serif';
      ctx.fillText(typeIcon.symbol, cx + 16, cy + 12);

      // Power
      ctx.fillStyle = tc.badge;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(card.power + '', cx + cardW - (inDeck ? 16 : 4), cy + 12);

      // Card name
      ctx.fillStyle = '#eee';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.name, cx + cardW / 2, cy + 26);

      // Combo element
      const comboIcon = T.COMBO_ICONS[card.combo];
      if (comboIcon) {
        ctx.fillStyle = U.hexAlpha(comboIcon.color, '90');
        ctx.font = '8px sans-serif';
        ctx.fillText(comboIcon.symbol + ' ' + card.combo, cx + cardW / 2, cy + 38);
      }

      // Brief desc
      ctx.fillStyle = '#777';
      ctx.font = '6px sans-serif';
      ctx.fillText(card.desc, cx + cardW / 2, cy + 48);
    }

    // Hovered card detail panel at bottom
    if (S.hoveredDeckCard >= 0) {
      const card = T.ALL_CARDS[S.hoveredDeckCard];
      const tc = T.TYPE_COLORS[card.type];
      const typeIcon = T.TYPE_ICONS[card.type];
      const comboIcon = T.COMBO_ICONS[card.combo];

      const panelY = C.CANVAS_H - 52;
      ctx.fillStyle = 'rgba(10,10,24,0.95)';
      ctx.fillRect(0, panelY, C.CANVAS_W, 52);
      ctx.strokeStyle = tc.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, panelY);
      ctx.lineTo(C.CANVAS_W, panelY);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(typeIcon.symbol + ' ' + card.name, 12, panelY + 16);

      ctx.fillStyle = tc.badge;
      ctx.font = '11px sans-serif';
      ctx.fillText(typeIcon.label + '  |  Cost: ' + card.cost + '  |  Power: ' + card.power, 12, panelY + 32);

      if (comboIcon) {
        ctx.fillStyle = comboIcon.color;
        ctx.fillText(comboIcon.symbol + ' ' + card.combo.charAt(0).toUpperCase() + card.combo.slice(1) + ' element (+2 combo)', 250, panelY + 32);
      }

      ctx.fillStyle = '#bbb';
      ctx.fillText(card.desc, 12, panelY + 46);

      if (card.flavor) {
        ctx.fillStyle = '#777';
        ctx.font = 'italic 10px sans-serif';
        ctx.fillText('"' + card.flavor + '"', 350, panelY + 46);
      }
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click cards to add/remove from deck. Hover for details. Press D to close.', C.CANVAS_W / 2, C.CANVAS_H - 12);
    }
  }

  function drawGameOverlay() {
    const ctx = D.ctx;
    if (S.state === C.STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(10,0,0,0.7)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      // Decorative border
      ctx.strokeStyle = '#f44';
      ctx.lineWidth = 2;
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 160, C.CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,0,0,0.8)';
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 160, C.CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.fill();

      ctx.fillStyle = '#f44';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEFEAT', C.CANVAS_W / 2, C.CANVAS_H / 2 - 30);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.fillText('Turns survived: ' + S.turnNumber + '  |  Difficulty: ' + S.difficulty, C.CANVAS_W / 2, C.CANVAS_H / 2 + 5);
      ctx.fillText('Enemy HP remaining: ' + Math.max(0, S.aiHP) + '/' + S.aiMaxHP, C.CANVAS_W / 2, C.CANVAS_H / 2 + 25);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press F2 for new game  |  Esc for menu', C.CANVAS_W / 2, C.CANVAS_H / 2 + 60);

    } else if (S.state === C.STATE_VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 160, C.CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,30,0,0.8)';
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 160, C.CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.fill();

      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u2726 VICTORY! \u2726', C.CANVAS_W / 2, C.CANVAS_H / 2 - 30);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.fillText('Completed in ' + S.turnNumber + ' turns  |  Difficulty: ' + S.difficulty, C.CANVAS_W / 2, C.CANVAS_H / 2 + 5);
      ctx.fillText('HP remaining: ' + S.playerHP + '/' + S.playerMaxHP, C.CANVAS_W / 2, C.CANVAS_H / 2 + 25);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press F2 for new game  |  Esc for menu', C.CANVAS_W / 2, C.CANVAS_H / 2 + 60);

    } else if (S.state === C.STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 100, C.CANVAS_H / 2 - 50, 200, 100, 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,30,0.9)';
      NS.cards.roundRect(ctx, C.CANVAS_W / 2 - 100, C.CANVAS_H / 2 - 50, 200, 100, 6);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2);

      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.fillText('Press Esc to resume', C.CANVAS_W / 2, C.CANVAS_H / 2 + 28);
    }
  }

  Object.assign(NS.screens, { drawMenuScreen, drawDeckBuilder, drawGameOverlay });
})();
