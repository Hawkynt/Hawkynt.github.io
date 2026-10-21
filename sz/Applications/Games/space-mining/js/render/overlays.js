/* Full-canvas overlays: the station shop panel with market prices, the paged
   tutorial, and the title, pause and game-over screens. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const O = NS.overlays;

  O.drawShopPanel = function drawShopPanel() {
    const panelW = 320;
    const panelH = 50 + T.UPGRADE_KEYS.length * 28 + 60;
    const px = (C.CANVAS_W - panelW) / 2;
    const py = 60;

    /* Background */
    D.ctx.save();
    D.ctx.fillStyle = 'rgba(10,20,30,0.92)';
    D.ctx.fillRect(px, py, panelW, panelH);
    D.ctx.strokeStyle = '#4a9';
    D.ctx.lineWidth = 2;
    D.ctx.strokeRect(px, py, panelW, panelH);

    /* Title */
    D.ctx.fillStyle = '#4ae';
    D.ctx.font = 'bold 16px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('STATION SHOP', px + panelW / 2, py + 24);

    D.ctx.fillStyle = '#aaa';
    D.ctx.font = '10px sans-serif';
    D.ctx.fillText('Credits: ' + S.credits, px + panelW / 2, py + 40);

    /* Upgrade rows */
    const startY = py + 50;
    const rowH = 28;
    D.ctx.textAlign = 'left';

    for (let i = 0; i < T.UPGRADE_KEYS.length; ++i) {
      const key = T.UPGRADE_KEYS[i];
      const def = T.UPGRADE_DEFS[key];
      const level = S.upgradeLevels[key];
      const ry = startY + i * rowH;
      const maxed = NS.economy.isMaxLevel(key);
      const cost = maxed ? 0 : NS.economy.getUpgradeCost(key);
      const canBuy = !maxed && S.credits >= cost;

      /* Selection highlight */
      if (i === S.shopSelection) {
        D.ctx.fillStyle = 'rgba(68,170,238,0.15)';
        D.ctx.fillRect(px + 4, ry, panelW - 8, rowH - 2);
      }

      /* Number key */
      D.ctx.fillStyle = '#666';
      D.ctx.font = '10px sans-serif';
      D.ctx.fillText((i + 1) + '.', px + 10, ry + 17);

      /* Label */
      D.ctx.fillStyle = canBuy ? '#fff' : '#888';
      D.ctx.font = '12px sans-serif';
      D.ctx.fillText(def.label, px + 28, ry + 17);

      /* Level pips */
      for (let l = 0; l < def.maxLevel; ++l) {
        D.ctx.fillStyle = l < level ? '#4ae' : '#333';
        D.ctx.fillRect(px + 140 + l * 14, ry + 8, 10, 8);
        D.ctx.strokeStyle = '#555';
        D.ctx.lineWidth = 0.5;
        D.ctx.strokeRect(px + 140 + l * 14, ry + 8, 10, 8);
      }

      /* Cost or MAX */
      D.ctx.textAlign = 'right';
      if (maxed) {
        D.ctx.fillStyle = '#4a4';
        D.ctx.font = 'bold 11px sans-serif';
        D.ctx.fillText('MAX', px + panelW - 10, ry + 17);
      } else {
        D.ctx.fillStyle = canBuy ? '#0f0' : '#f44';
        D.ctx.font = '11px sans-serif';
        D.ctx.fillText(cost + ' cr', px + panelW - 10, ry + 17);
      }
      D.ctx.textAlign = 'left';
    }

    /* Description of selected upgrade */
    const selKey = T.UPGRADE_KEYS[S.shopSelection];
    const selDef = T.UPGRADE_DEFS[selKey];
    D.ctx.fillStyle = '#aaa';
    D.ctx.font = '10px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText(selDef.desc, px + panelW / 2, startY + T.UPGRADE_KEYS.length * rowH + 10);

    /* Market prices */
    D.ctx.fillStyle = '#888';
    D.ctx.font = '9px sans-serif';
    let priceText = 'Market:';
    for (const key of T.ORE_KEYS)
      priceText += '  ' + T.ORE_TYPES[key].label + ' ' + S.marketPrices[key];
    D.ctx.fillText(priceText, px + panelW / 2, startY + T.UPGRADE_KEYS.length * rowH + 28);

    /* Close button */
    const closeBtnX = px + panelW / 2 - 40;
    const closeBtnY = startY + T.UPGRADE_KEYS.length * rowH + 34;
    const closeBtnW = 80;
    const closeBtnH = 22;
    D.ctx.fillStyle = '#533';
    D.ctx.fillRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    D.ctx.strokeStyle = '#a66';
    D.ctx.lineWidth = 1;
    D.ctx.strokeRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    D.ctx.fillStyle = '#faa';
    D.ctx.font = 'bold 11px sans-serif';
    D.ctx.fillText('Close', closeBtnX + closeBtnW / 2, closeBtnY + 15);

    D.ctx.restore();
  };

  O.drawTutorialOverlay = function drawTutorialOverlay() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.8)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const page = T.TUTORIAL_PAGES[S.tutorialPage] || T.TUTORIAL_PAGES[0];
    const centerX = C.CANVAS_W / 2;
    const panelW = 420;
    const panelH = 240;
    const px = centerX - panelW / 2;
    const py = (C.CANVAS_H - panelH) / 2;

    /* Panel bg */
    D.ctx.fillStyle = 'rgba(15,25,40,0.95)';
    D.ctx.fillRect(px, py, panelW, panelH);
    D.ctx.strokeStyle = '#4ae';
    D.ctx.lineWidth = 2;
    D.ctx.strokeRect(px, py, panelW, panelH);

    /* Page indicator */
    D.ctx.fillStyle = '#666';
    D.ctx.font = '10px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('Page ' + (S.tutorialPage + 1) + ' / ' + T.TUTORIAL_PAGES.length, centerX, py + panelH - 12);

    /* Title */
    D.ctx.fillStyle = '#4ae';
    D.ctx.font = 'bold 20px sans-serif';
    D.ctx.fillText(page.title, centerX, py + 35);

    /* Lines */
    D.ctx.fillStyle = '#ccc';
    D.ctx.font = '13px sans-serif';
    D.ctx.textAlign = 'center';
    for (let i = 0; i < page.lines.length; ++i)
      D.ctx.fillText(page.lines[i], centerX, py + 65 + i * 22);

    /* Navigation hint */
    D.ctx.fillStyle = '#888';
    D.ctx.font = '11px sans-serif';
    D.ctx.textAlign = 'center';
    if (S.tutorialPage < T.TUTORIAL_PAGES.length - 1)
      D.ctx.fillText('Click / SPACE / Right Arrow = Next  |  ESC = Skip', centerX, py + panelH - 28);
    else
      D.ctx.fillText('Click / SPACE = Start Mining!  |  Press H anytime for help', centerX, py + panelH - 28);
  };

  O.drawTitleScreen = function drawTitleScreen() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    D.ctx.fillStyle = '#4ae';
    D.ctx.font = 'bold 36px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.shadowBlur = 20;
    D.ctx.shadowColor = '#4ae';
    D.ctx.fillText('SPACE MINING', C.CANVAS_W / 2, C.CANVAS_H / 2 - 50);
    D.ctx.shadowBlur = 0;

    D.ctx.fillStyle = '#aaa';
    D.ctx.font = '16px sans-serif';
    D.ctx.fillText('Tap or press SPACE to start', C.CANVAS_W / 2, C.CANVAS_H / 2);
    D.ctx.font = '12px sans-serif';
    D.ctx.fillText('WASD / Arrows to fly  |  SPACE to drill  |  or use Mouse', C.CANVAS_W / 2, C.CANVAS_H / 2 + 30);
    D.ctx.fillStyle = '#888';
    D.ctx.fillText('Press H for tutorial', C.CANVAS_W / 2, C.CANVAS_H / 2 + 55);
  };

  O.drawPauseOverlay = function drawPauseOverlay() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    D.ctx.fillStyle = '#fff';
    D.ctx.font = 'bold 28px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2);
    D.ctx.font = '14px sans-serif';
    D.ctx.fillText('Press ESC to resume  |  H for help', C.CANVAS_W / 2, C.CANVAS_H / 2 + 30);
  };

  O.drawGameOverScreen = function drawGameOverScreen() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    D.ctx.fillStyle = '#f44';
    D.ctx.font = 'bold 32px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillText('GAME OVER', C.CANVAS_W / 2, C.CANVAS_H / 2 - 30);
    D.ctx.fillStyle = '#fff';
    D.ctx.font = '18px sans-serif';
    D.ctx.fillText('Final Credits: ' + S.credits, C.CANVAS_W / 2, C.CANVAS_H / 2 + 10);
    D.ctx.font = '14px sans-serif';
    D.ctx.fillText('Tap or press F2 for New Game', C.CANVAS_W / 2, C.CANVAS_H / 2 + 40);
  };
})();
