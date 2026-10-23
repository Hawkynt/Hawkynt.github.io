;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION G: SETTINGS PANEL UI
   * ================================================================ */

  let settingsPanelOpen = false;

  const PANEL_W = 520;
  const PANEL_H = 420;
  const TILE_W = 60;
  const TILE_H = 44;
  const TILE_GAP = 8;
  const ROW_START_X = 110;
  const CUSTOM_COLORS = ['#1a237e', '#8b1a1a', '#1b5e20', '#b8860b', '#4a148c', '#004d40', '#bf360c', '#263238'];

  function _drawPanelTile(cx, px, py, tw, th, color, label, isActive) {
    CE.drawRoundedRect(cx, px, py, tw, th, 4);
    cx.fillStyle = color;
    cx.fill();
    if (isActive) {
      cx.strokeStyle = '#ffff00';
      cx.lineWidth = 3;
    } else {
      cx.strokeStyle = 'rgba(255,255,255,0.3)';
      cx.lineWidth = 1;
    }
    cx.stroke();
    if (label) {
      cx.font = '8px sans-serif';
      cx.fillStyle = '#ccc';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(label, px + tw / 2, py + th + 2);
    }
  }

  function drawSettingsPanel(cx, W, H) {
    if (!settingsPanelOpen) return;

    // Dimmed backdrop
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fillRect(0, 0, W, H);

    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    // Panel background
    CE.drawRoundedRect(cx, px, py, PANEL_W, PANEL_H, 10);
    cx.fillStyle = '#1e1e1e';
    cx.fill();
    cx.strokeStyle = '#555';
    cx.lineWidth = 2;
    cx.stroke();

    // Title
    cx.font = 'bold 18px sans-serif';
    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'top';
    cx.fillText('Card Style Settings', W / 2, py + 14);

    let rowY = py + 50;
    const labelX = px + 16;

    // ── Table row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Table:', labelX, rowY + TILE_H / 2);

    const tableKeys = Object.keys(CT.TABLE_THEMES);
    for (let i = 0; i < tableKeys.length; ++i) {
      const key = tableKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      _drawPanelTile(cx, tx, rowY, TILE_W, TILE_H, CT.TABLE_THEMES[key].preview, CT.TABLE_THEMES[key].name.split(' ')[0], CT.activeTheme.table === key);
    }

    rowY += TILE_H + 24;

    // ── Card Back row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Card Back:', labelX, rowY + TILE_H / 2);

    const backKeys = Object.keys(CT.CARD_BACK_DESIGNS);
    for (let i = 0; i < backKeys.length; ++i) {
      const key = backKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      const previewColor = key === 'custom' ? CT.activeTheme.customBackColor : CT.CARD_BACK_DESIGNS[key].preview;
      _drawPanelTile(cx, tx, rowY, TILE_W, TILE_H, previewColor, CT.CARD_BACK_DESIGNS[key].name.split(' ')[0], CT.activeTheme.cardBack === key);
    }

    rowY += TILE_H + 24;

    // ── Card Face row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Card Face:', labelX, rowY + TILE_H / 2);

    const faceKeys = Object.keys(CT.CARD_FACE_TEMPLATES);
    for (let i = 0; i < faceKeys.length; ++i) {
      const key = faceKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      const tpl = CT.CARD_FACE_TEMPLATES[key];
      CE.drawRoundedRect(cx, tx, rowY, TILE_W, TILE_H, 4);
      cx.fillStyle = tpl.cardBg;
      cx.fill();
      // Draw a small suit icon preview
      const sc = tpl.suitColors;
      cx.fillStyle = sc.hearts;
      cx.font = '14px serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText('\u2665', tx + TILE_W * 0.3, rowY + TILE_H * 0.4);
      cx.fillStyle = sc.spades;
      cx.fillText('\u2660', tx + TILE_W * 0.7, rowY + TILE_H * 0.4);
      if (CT.activeTheme.cardFace === key) {
        cx.strokeStyle = '#ffff00';
        cx.lineWidth = 3;
      } else {
        cx.strokeStyle = 'rgba(255,255,255,0.3)';
        cx.lineWidth = 1;
      }
      CE.drawRoundedRect(cx, tx, rowY, TILE_W, TILE_H, 4);
      cx.stroke();
      cx.font = '8px sans-serif';
      cx.fillStyle = '#ccc';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(tpl.name.split(' ')[0], tx + TILE_W / 2, rowY + TILE_H + 2);
    }

    rowY += TILE_H + 24;

    // ── Custom Color row (only when custom back selected) ──
    if (CT.activeTheme.cardBack === 'custom') {
      cx.font = 'bold 12px sans-serif';
      cx.fillStyle = '#aaa';
      cx.textAlign = 'left';
      cx.textBaseline = 'middle';
      cx.fillText('Color:', labelX, rowY + 20);

      const swatchSize = 28;
      const swatchGap = 6;
      for (let i = 0; i < CUSTOM_COLORS.length; ++i) {
        const sx = px + ROW_START_X + i * (swatchSize + swatchGap);
        cx.fillStyle = CUSTOM_COLORS[i];
        CE.drawRoundedRect(cx, sx, rowY + 6, swatchSize, swatchSize, 4);
        cx.fill();
        if (CT.activeTheme.customBackColor === CUSTOM_COLORS[i]) {
          cx.strokeStyle = '#ffff00';
          cx.lineWidth = 2;
        } else {
          cx.strokeStyle = 'rgba(255,255,255,0.3)';
          cx.lineWidth = 1;
        }
        CE.drawRoundedRect(cx, sx, rowY + 6, swatchSize, swatchSize, 4);
        cx.stroke();
      }
      rowY += 48;
    }

    // ── Preview section ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Preview:', labelX, rowY + CE.CARD_H * 0.55 / 2);

    const previewScale = 0.55;
    const pw = Math.round(CE.CARD_W * previewScale);
    const ph = Math.round(CE.CARD_H * previewScale);
    const previewX = px + ROW_START_X;

    // Sample face card
    const sampleCard = { suit: 'hearts', rank: 'Q', faceUp: true, color: 'red', value: 11 };
    cx.save();
    cx.translate(previewX, rowY);
    cx.scale(previewScale, previewScale);
    CE.drawCardFace(cx, 0, 0, sampleCard);
    cx.restore();

    // Sample card back
    cx.save();
    cx.translate(previewX + pw + 16, rowY);
    cx.scale(previewScale, previewScale);
    CT.CARD_BACK_DESIGNS[CT.activeTheme.cardBack].draw(cx, 0, 0, CE.CARD_W, CE.CARD_H);
    cx.restore();

    // ── Close button ──
    const closeBtnW = 80;
    const closeBtnH = 30;
    const closeBtnX = W / 2 - closeBtnW / 2;
    const closeBtnY = py + PANEL_H - 46;
    CE.drawButton(cx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, 'Close', { bg: '#333', border: '#888', fontSize: 13 });
  }

  function handleSettingsClick(mx, my) {
    if (!settingsPanelOpen) return false;

    const W = 900;
    const H = 600;
    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    // Outside panel -- close
    if (!CE.isInRect(mx, my, px, py, PANEL_W, PANEL_H)) {
      settingsPanelOpen = false;
      return true;
    }

    let rowY = py + 50;

    // ── Table row hit test ──
    const tableKeys = Object.keys(CT.TABLE_THEMES);
    for (let i = 0; i < tableKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        CT.setTheme({ table: tableKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Card Back row hit test ──
    const backKeys = Object.keys(CT.CARD_BACK_DESIGNS);
    for (let i = 0; i < backKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        CT.setTheme({ cardBack: backKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Card Face row hit test ──
    const faceKeys = Object.keys(CT.CARD_FACE_TEMPLATES);
    for (let i = 0; i < faceKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        CT.setTheme({ cardFace: faceKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Custom Color swatch hit test ──
    if (CT.activeTheme.cardBack === 'custom') {
      const swatchSize = 28;
      const swatchGap = 6;
      for (let i = 0; i < CUSTOM_COLORS.length; ++i) {
        const sx = px + ROW_START_X + i * (swatchSize + swatchGap);
        if (CE.isInRect(mx, my, sx, rowY + 6, swatchSize, swatchSize)) {
          CT.setTheme({ customBackColor: CUSTOM_COLORS[i] });
          return true;
        }
      }
      rowY += 48;
    }

    // ── Close button hit test ──
    const closeBtnW = 80;
    const closeBtnH = 30;
    const closeBtnX = W / 2 - closeBtnW / 2;
    const closeBtnY = py + PANEL_H - 46;
    if (CE.isInRect(mx, my, closeBtnX, closeBtnY, closeBtnW, closeBtnH)) {
      settingsPanelOpen = false;
      return true;
    }

    return true;
  }

  CT.drawSettingsPanel = drawSettingsPanel;
  CT.handleSettingsClick = handleSettingsClick;
  Object.defineProperty(CT, 'settingsPanelOpen', {
    get: function() { return settingsPanelOpen; },
    set: function(v) { settingsPanelOpen = v; },
    enumerable: true,
    configurable: true
  });

})();
