/* Canvas rendering: variant selection menu, in-game buttons, overlays, table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const A = NS.animations;
  const DR = NS.draw = NS.draw || {};

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  DR.drawMenu = function() {
    const btnW = 120;
    const btnH = 26;
    const gapX = 8;
    const gapY = 3;
    const cols = 6;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const marginX = (K.CANVAS_W - totalW) / 2;
    const fieldsetGap = 4;
    const padTop = 10;
    const padBot = 4;

    // Title
    D.ctx.font = 'bold 20px sans-serif';
    D.ctx.fillStyle = '#fff';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'top';
    D.ctx.fillText('Card Games Suite', K.CANVAS_W / 2, 4);

    // Get table background color for legend masking
    const CT = SZ.CardThemes;
    const tableBg = CT ? (CT.TABLE_THEMES[CT.activeTheme.table]?.preview || '#1a4a1a') : '#1a4a1a';

    let curY = 28;

    for (const cat of K.SORTED_CATS) {
      const rows = Math.ceil(cat.games.length / cols);
      const innerH = rows * (btnH + gapY) - gapY;
      const fieldH = padTop + innerH + padBot;

      // Fieldset border (category color at ~40% opacity)
      D.ctx.strokeStyle = cat.color + '66';
      D.ctx.lineWidth = 1;
      CE.drawRoundedRect(D.ctx, marginX - 4, curY, totalW + 8, fieldH, 4);
      D.ctx.stroke();

      // Legend: mask border behind text, then draw label
      D.ctx.font = 'bold 11px sans-serif';
      const legendW = D.ctx.measureText(cat.name).width;
      const legendX = marginX + 8;
      const legendY = curY - 6;
      D.ctx.fillStyle = tableBg;
      D.ctx.fillRect(legendX - 3, legendY, legendW + 6, 12);
      D.ctx.fillStyle = cat.color;
      D.ctx.textAlign = 'left';
      D.ctx.textBaseline = 'top';
      D.ctx.fillText(cat.name, legendX, legendY + 1);

      // Game buttons
      for (let i = 0; i < cat.games.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = marginX + col * (btnW + gapX);
        const by = curY + padTop + row * (btnH + gapY);

        D.ctx.fillStyle = '#1a3a1a';
        D.ctx.strokeStyle = '#4a4';
        D.ctx.lineWidth = 1;
        CE.drawRoundedRect(D.ctx, bx, by, btnW, btnH, 5);
        D.ctx.fill();
        D.ctx.stroke();

        // Auto-shrink long names
        let fontSize = 11;
        D.ctx.font = 'bold ' + fontSize + 'px sans-serif';
        while (D.ctx.measureText(cat.games[i].variant.name).width > btnW - 8 && fontSize > 8) {
          --fontSize;
          D.ctx.font = 'bold ' + fontSize + 'px sans-serif';
        }
        D.ctx.fillStyle = '#fff';
        D.ctx.textAlign = 'center';
        D.ctx.textBaseline = 'middle';
        D.ctx.fillText(cat.games[i].variant.name, bx + btnW / 2, by + btnH / 2);
      }

      curY += fieldH + fieldsetGap;
    }

    // Style button below last fieldset
    if (SZ.CardThemes)
      CE.drawButton(D.ctx, K.CANVAS_W / 2 - 48, curY, 96, 26, '\u2699 Card Style', { bg: '#333', border: '#666', fontSize: 11 });
  };

  DR.drawMenuButton = function() {
    if (SZ.CardThemes)
      CE.drawButton(D.ctx, K.STYLE_BTN.x, K.STYLE_BTN.y, K.STYLE_BTN.w, K.STYLE_BTN.h, '\u2699 Style', { bg: '#333', border: '#666', fontSize: 11 });
    if (S.activeVariantModule?.sortPlayerHand) {
      const sortLabel = S.autoSortHand ? '\u2714 Sort' : '\u2610 Sort';
      CE.drawButton(D.ctx, K.SORT_BTN.x, K.SORT_BTN.y, K.SORT_BTN.w, K.SORT_BTN.h, sortLabel, { bg: S.autoSortHand ? '#2a5a2a' : '#333', border: '#666', fontSize: 11 });
    }
    const hintLabel = S.hintsEnabled ? '\u2714 Hints' : '\u2610 Hints';
    CE.drawButton(D.ctx, K.HINT_BTN.x, K.HINT_BTN.y, K.HINT_BTN.w, K.HINT_BTN.h, hintLabel, { bg: S.hintsEnabled ? '#2a5a2a' : '#333', border: '#666', fontSize: 11 });
    CE.drawButton(D.ctx, K.MENU_BTN.x, K.MENU_BTN.y, K.MENU_BTN.w, K.MENU_BTN.h, '\u2630 Menu', { bg: '#333', border: '#666', fontSize: 11 });
  };

  DR.drawPauseOverlay = function() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    D.ctx.fillRect(0, 0, K.CANVAS_W, K.CANVAS_H);
    D.ctx.fillStyle = '#fff';
    D.ctx.font = 'bold 36px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('PAUSED', K.CANVAS_W / 2, K.CANVAS_H / 2 - 10);
    D.ctx.font = '14px sans-serif';
    D.ctx.fillStyle = '#aaa';
    D.ctx.fillText('Press Escape to resume', K.CANVAS_W / 2, K.CANVAS_H / 2 + 20);
  };

  DR.drawGameOverOverlay = function() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    D.ctx.fillRect(0, 0, K.CANVAS_W, K.CANVAS_H);
    D.ctx.fillStyle = '#fff';
    D.ctx.font = 'bold 28px sans-serif';
    D.ctx.textAlign = 'center';
    const msg = S.state === K.STATE_GAME_OVER ? 'GAME OVER' : 'ROUND COMPLETE';
    D.ctx.fillText(msg, K.CANVAS_W / 2, K.CANVAS_H / 2 - 20);
    D.ctx.font = '16px sans-serif';
    D.ctx.fillStyle = '#fa0';
    D.ctx.fillText('Score: ' + S.score, K.CANVAS_W / 2, K.CANVAS_H / 2 + 10);
    D.ctx.font = '12px sans-serif';
    D.ctx.fillStyle = '#aaa';
    D.ctx.fillText('Click to continue', K.CANVAS_W / 2, K.CANVAS_H / 2 + 40);
  };

  DR.drawTable = function() {
    const CT = SZ.CardThemes;
    if (CT) {
      const theme = CT.TABLE_THEMES[CT.activeTheme.table];
      if (theme) {
        theme.draw(D.ctx, K.CANVAS_W, K.CANVAS_H);
        return;
      }
    }
    const diag = Math.sqrt(K.CANVAS_W * K.CANVAS_W + K.CANVAS_H * K.CANVAS_H) / 2;
    const grad = D.ctx.createRadialGradient(K.CANVAS_W / 2, K.CANVAS_H / 2, 50, K.CANVAS_W / 2, K.CANVAS_H / 2, diag);
    grad.addColorStop(0, '#1a4a1a');
    grad.addColorStop(0.85, '#0e350e');
    grad.addColorStop(1, '#0a2a0a');
    D.ctx.fillStyle = grad;
    D.ctx.fillRect(0, 0, K.CANVAS_W, K.CANVAS_H);
  };

  DR.draw = function() {
    D.ctx.clearRect(0, 0, K.CANVAS_W, K.CANVAS_H);

    if (S.state === K.STATE_MENU) {
      DR.drawTable();
      DR.drawMenu();
    } else {
      E.screenShake.apply(D.ctx);
      DR.drawTable();

      // Variant rendering
      if (S.activeVariantModule)
        S.activeVariantModule.draw(D.ctx, K.CANVAS_W, K.CANVAS_H);

      A.drawDealAnimations();
      A.drawGlowEffects();
      if (SZ.CardThemes) SZ.CardThemes.drawShimmers(D.ctx);
      E.particles.draw(D.ctx);
      E.floatingText.draw(D.ctx);
      E.screenShake.restore(D.ctx);

      if (S.state === K.STATE_PLAYING) DR.drawMenuButton();
      if (S.state === K.STATE_PAUSED) DR.drawPauseOverlay();
      if (S.state === K.STATE_ROUND_OVER || S.state === K.STATE_GAME_OVER) DR.drawGameOverOverlay();
    }

    if (SZ.CardThemes) SZ.CardThemes.drawSettingsPanel(D.ctx, K.CANVAS_W, K.CANVAS_H);
  };
})();
