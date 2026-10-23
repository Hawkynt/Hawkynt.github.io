/* Application entry: the frame loop and the boot sequence. Loaded last. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const A = NS.animations;
  const G = NS.game;
  const DR = NS.draw;
  const ME = NS.menu;

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, K.MAX_DT);
    S.lastTimestamp = timestamp;

    if (S.state === K.STATE_PLAYING || S.state === K.STATE_ROUND_OVER) {
      A.updateAnimations(dt);
      G.tickAi(dt);
      if (S.autoSortHand && S.activeVariantModule?.sortPlayerHand)
        S.activeVariantModule.sortPlayerHand();
      NS.host.hintTime += dt;
      if (SZ.CardThemes) SZ.CardThemes.updateShimmers(dt);
    }

    E.particles.update();
    E.screenShake.update(dt * 1000);
    E.floatingText.update();

    DR.draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: ME.handleAction
  });

  D.setupCanvas();
  if (SZ.CardThemes) SZ.CardThemes.loadTheme();
  G.initGame();

  // In the status bar: a corner button would cover the variants' table buttons
  const statusBar = document.querySelector('.status-bar');
  const muteBtn = SZ.GameAudio.attachMuteButton(statusBar || undefined);
  if (statusBar)
    Object.assign(muteBtn.style, { position: 'static', marginLeft: 'auto', width: '18px', height: '16px', fontSize: '10px', lineHeight: '14px', borderRadius: '3px' });

  S.lastTimestamp = 0;
  requestAnimationFrame(gameLoop);
})();
