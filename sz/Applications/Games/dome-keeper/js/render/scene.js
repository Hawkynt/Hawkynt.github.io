;(function() {
  'use strict';

  // Composing a frame: the surface scene, the whole game screen and the tutorial overlay.
  // Owns: NS.scene
  // Reads: constants, dom, sprites, textLayout, panels, gameState, run, time, weatherArt, cinematicArt,
  //   artifacts, upgradeTree, surfaceArt, enemyArt, domeArt, undergroundArt, gadgetArt, bombArt, combatArt,
  //   hud
  // Reads state of: gameState, run, relocation, weapon

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_UPGRADE_DIALOG, STATE_CINEMATIC } = NS.constants;
  const { ctx } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { uiFont, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawChip, drawScrim } = NS.panels;
  const { TUTORIAL_PAGES } = NS.gameState;
  const { getTransitionAlpha } = NS.run;
  const { drawBanner } = NS.time;
  const { drawWeather, drawMeteorOre, drawSnowCover } = NS.weatherArt;
  const { drawCinematic } = NS.cinematicArt;
  const { drawSurfaceArtifacts, drawTimeSlowTint } = NS.artifacts;
  const { drawUpgradeDialog } = NS.upgradeTree;
  const { drawSky, drawGroundLayer } = NS.surfaceArt;
  const { drawEnemy, drawEnemyShots, drawProjectiles } = NS.enemyArt;
  const { drawDome } = NS.domeArt;
  const { drawUnderground } = NS.undergroundArt;
  const { drawSurfaceGadgets, drawKeyHints, drawSurfaceHUD } = NS.gadgetArt;
  const { drawSurfaceBombs, drawBlasts, drawThrowPreview, drawBombBar } = NS.bombArt;
  const { drawCombatOverlays, drawChargeRing } = NS.combatArt;
  const { drawUpgradePanel, drawHUD } = NS.hud;

  /* ======================================================================
     DRAWING -- SURFACE
     ====================================================================== */

  function drawSurface() {
    drawSky();

    // Ground layer with details
    drawGroundLayer();
    drawMeteorOre();

    // Dome
    drawDome();
    drawSnowCover();

    // Gadget and artifact visuals on surface
    drawSurfaceGadgets();
    drawSurfaceArtifacts();

    // Enemies
    for (const e of G.enemies)
      drawEnemy(e);

    drawEnemyShots();

    drawCombatOverlays();

    // Projectiles, bombs and explosions
    drawProjectiles();
    drawSurfaceBombs();
    drawBlasts(false);
    drawWeather();
    drawTimeSlowTint();
    drawThrowPreview();
    drawChargeRing();
    if (G.screenFlash > 0) {
      ctx.fillStyle = `rgba(${G.screenFlashColor},${G.screenFlash})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    drawSurfaceHUD();

    // Upgrade panel and bomb stock
    drawUpgradePanel();
    drawBombBar();
  }

  /* ======================================================================
     DRAWING -- MAIN
     ====================================================================== */

  function drawGame() {
    const alpha = getTransitionAlpha();
    ctx.globalAlpha = alpha;

    // View switches slide the scene the way the keeper travels (down into the mine, up to the dome)
    let slide = 0;
    if (alpha < 1) {
      const goingDown = (G.transitionTarget || G.currentView) === VIEW_UNDERGROUND;
      const k = 1 - alpha;
      const eased = k * k * (3 - 2 * k);
      slide = (G.transitionPhase === 'fade-out' ? -eased : eased) * 90 * (goingDown ? 1 : -1);
      ctx.save();
      ctx.translate(0, slide);
    }

    const treeOpen = G.state === STATE_UPGRADE_DIALOG;
    if (G.state === STATE_CINEMATIC && G.cinematic)
      drawCinematic();
    else if (treeOpen)
      ; // the tree is opaque and drawn below
    else if (G.currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;

    // Transition overlay: fade through black with a soft wipe band
    if (alpha < 1) {
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const k = 1 - alpha;
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, `rgba(90,180,255,${0.12 * k})`);
      g.addColorStop(0.5, 'rgba(90,180,255,0)');
      g.addColorStop(1, `rgba(255,170,60,${0.12 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (!treeOpen) {
      drawBanner();
      drawHUD();
    }

    if (G.state === STATE_UPGRADE_DIALOG)
      drawUpgradeDialog();

    if (G.showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    drawScrim(0.68);
    const page = TUTORIAL_PAGES[G.tutorialPage] || TUTORIAL_PAGES[0];
    const pw = 880, ph = 540, px = CANVAS_W / 2 - pw / 2, py = (CANVAS_H - ph) / 2;
    drawPanel(px, py, pw, ph, {
      accent: '#ffb030', radius: 16, title: page.title, titlePx: 28, headerH: 64,
      titleRight: 'Page ' + (G.tutorialPage + 1) + ' of ' + TUTORIAL_PAGES.length,
      top: 'rgba(24,30,50,0.99)', bottom: 'rgba(10,13,24,0.99)'
    });

    // Page icon and intro paragraph
    const bodyX = px + 44, bodyW = pw - 88;
    ctx.save();
    const ig = ctx.createRadialGradient(bodyX + 40, py + 132, 4, bodyX + 40, py + 132, 52);
    ig.addColorStop(0, 'rgba(255,176,48,0.3)');
    ig.addColorStop(1, 'rgba(255,176,48,0)');
    ctx.fillStyle = ig;
    ctx.fillRect(bodyX - 12, py + 80, 104, 104);
    ctx.restore();
    drawSprite(page.icon, bodyX + 40, py + 132, 64);
    drawTextBlock(page.intro, bodyX + 104, py + 88, bodyW - 104, 88, 23, { valign: 'middle', color: UI.text, minPx: 15 });
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(bodyX, py + 190, bodyW, 1);

    // Key / action rows
    const rowsTop = py + 202, rowsBottom = py + ph - 100;
    const rowH = Math.min(48, (rowsBottom - rowsTop) / Math.max(1, page.items.length));
    ctx.font = uiFont(15, 'bold');
    let keyColW = 0;
    for (const it of page.items)
      if (it[0])
        keyColW = Math.max(keyColW, ctx.measureText(it[0]).width + 22);
    keyColW = Math.min(180, keyColW + 32);
    for (let i = 0; i < page.items.length; ++i) {
      const [key, text] = page.items[i];
      const ry = rowsTop + i * rowH;
      if (i % 2 === 0) {
        roundRectPath(bodyX, ry + 2, bodyW, rowH - 4, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
      }
      if (key)
        drawChip(key, bodyX + 12, ry + (rowH - 28) / 2, 28, { px: 15, maxW: keyColW - 24, bg: 'rgba(20,26,42,0.95)', border: 'rgba(170,190,230,0.4)', color: '#e8eefa' });
      else {
        ctx.fillStyle = '#ffb030';
        ctx.beginPath();
        ctx.arc(bodyX + 24, ry + rowH / 2, 5, 0, TWO_PI);
        ctx.fill();
      }
      const tx = key ? bodyX + keyColW : bodyX + 44;
      drawTextBlock(text, tx, ry + 2, bodyX + bodyW - 12 - tx, rowH - 4, 21, { valign: 'middle', color: '#cdd6e8', minPx: 13 });
    }

    // Page dots
    const dotsY = py + ph - 78;
    for (let i = 0; i < TUTORIAL_PAGES.length; ++i) {
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2 + (i - (TUTORIAL_PAGES.length - 1) / 2) * 22, dotsY, i === G.tutorialPage ? 6 : 4, 0, TWO_PI);
      ctx.fillStyle = i === G.tutorialPage ? '#ffb030' : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
    const last = G.tutorialPage >= TUTORIAL_PAGES.length - 1;
    drawKeyHints(last
      ? [{ key: 'Click', label: 'Start playing' }, { key: 'H', label: 'Help anytime' }]
      : [{ key: 'Click', label: 'Next' }, { key: '→', label: 'Next' }, { key: '←', label: 'Back' }, { key: 'Esc', label: 'Close' }],
    CANVAS_W / 2, py + ph - 36, pw - 80);
  }

  NS.scene = { drawGame };
})();
