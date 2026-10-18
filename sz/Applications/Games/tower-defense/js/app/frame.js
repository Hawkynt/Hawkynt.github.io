/* app/frame.js -- composing one frame and the status bar.
   Reads: constants, env, layout, widgets, effects, battlefield, researchScreen, abilityBar, relicsPanel,
      cinematics, hud, buildBar, inspector, screens, mapSelect, help and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_BUILD, STATE_GAME_OVER, STATE_MAP_SELECT,
      STATE_RESEARCH } = NS.constants;
  const { canvas, ctx, statusWave, statusGold, statusLives, waveTotalText } = NS.env;
  const { setUiTransform } = NS.layout;
  const { drawTooltip } = NS.widgets;
  const { updateDrawCoins, drawBanner, drawBossIntro, drawTransition, drawDanger } = NS.effects;
  const { drawWorld } = NS.battlefield;
  const { drawResearch } = NS.researchScreen;
  const { drawAbilityOverlays } = NS.abilityBar;
  const { drawRelics } = NS.relicsPanel;
  const { withCineView, drawCineOverlay } = NS.cinematics;
  const { drawTopBar, drawNextLevelButton, drawBossBar } = NS.hud;
  const { drawBuildBar } = NS.buildBar;
  const { drawInspector } = NS.inspector;
  const { drawTitleScreen, drawPauseScreen, drawEndScreen } = NS.screens;
  const { drawMapSelect } = NS.mapSelect;
  const { drawHelp } = NS.help;

  /* ══════════════════════════════════════════════════════════════════
     FRAME
     ══════════════════════════════════════════════════════════════════ */

  function drawFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G.cine || G.cine.kind !== 'travel')
      withCineView(drawWorld);

    setUiTransform();
    G.regions = [];
    if (G.cine && G.cine.kind !== 'reward') {
      // Intros, outros and the world map take over the screen
      drawCineOverlay();
      drawTransition();
      G.prevRegions = G.regions;
      return;
    }
    drawDanger();
    drawAbilityOverlays();
    if (G.state === STATE_PLAYING || G.state === STATE_BUILD || G.state === STATE_PAUSED)
      drawBossIntro();
    if (G.state === STATE_READY) {
      drawTitleScreen();
    } else if (G.state === STATE_MAP_SELECT) {
      drawMapSelect();
    } else if (G.state === STATE_RESEARCH) {
      drawResearch();
    } else {
      drawTopBar();
      if (!G.bossIntro) drawBossBar();
      drawBuildBar();
      drawInspector();
      drawNextLevelButton();
      if (!G.cine) drawBanner();
      updateDrawCoins();
      // Modal screens: the HUD underneath stops reacting
      if (G.state === STATE_PAUSED && !G.overlay) {
        G.regions = [];
        drawPauseScreen();
      } else if (G.state === STATE_GAME_OVER) {
        G.regions = [];
        drawEndScreen();
      }
    }
    if (G.overlay === 'help') {
      G.regions = [];
      drawHelp();
    } else if (G.overlay === 'relics') {
      G.regions = [];
      drawRelics();
    }
    if (G.cine) {
      G.regions = [];
      drawCineOverlay();
    }
    drawTooltip();
    drawTransition();
    G.prevRegions = G.regions;
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusWave) statusWave.textContent = `Wave: ${G.currentWave}/${waveTotalText()}`;
    if (statusGold) statusGold.textContent = `Gold: ${G.gold}`;
    if (statusLives) statusLives.textContent = `Lives: ${G.lives}`;
  }

  NS.frame = { drawFrame, updateStatusBar };

})();
