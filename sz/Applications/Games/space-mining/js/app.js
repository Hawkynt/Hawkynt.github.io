/* Loaded last: the status bar and window title, the requestAnimationFrame game
   loop and the start-up sequence. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const A = NS.app;

  /* ── Status Bar ── */
  A.updateStatusBar = function updateStatusBar() {
    if (D.statusCredits)
      D.statusCredits.textContent = 'Credits: ' + S.credits;
    if (D.statusCargo)
      D.statusCargo.textContent = 'Cargo: ' + Math.floor(NS.economy.totalCargo()) + '/' + S.cargoMax;
    if (D.statusState) {
      let stateText = S.state === C.STATE_PLAYING ? 'Mining' : S.state;
      if (S.shopOpen) stateText = 'Docked';
      const activeList = Object.keys(S.activePowerups);
      if (activeList.length > 0)
        stateText += ' [' + activeList.map(k => T.POWERUP_DEFS[k].icon).join('') + ']';
      D.statusState.textContent = stateText;
    }
  };

  /* ── Window Title ── */
  A.updateWindowTitle = function updateWindowTitle() {
    const title = 'Space Mining - Credits: ' + S.credits;
    document.title = title;
    if (D.User32?.SetWindowText)
      D.User32.SetWindowText(title);
  };

  /* ── Game Loop ── */
  A.gameLoop = function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, C.MAX_DT);
    S.lastTimestamp = timestamp;

    NS.flow.updateGame(dt);

    D.particles.update();
    D.screenShake.update(dt * 1000);
    D.floatingText.update();

    D.ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    D.ctx.save();
    D.screenShake.apply(D.ctx);
    NS.scene.drawGame();
    D.particles.draw(D.ctx);
    D.floatingText.draw(D.ctx);
    D.screenShake.restore(D.ctx);
    D.ctx.restore();

    S.animFrameId = requestAnimationFrame(A.gameLoop);
  };

  /* ── Init ── */
  SZ.GameAudio.attachMuteButton();
  D.setupCanvas();
  NS.highscores.loadHighScores();
  NS.highscores.loadTutorialSeen();
  NS.world.initStars();
  NS.world.initNebulae();
  NS.world.initBgAsteroids();
  NS.economy.randomizePrices();
  NS.mining.spawnAsteroids();
  NS.economy.resetCargo();
  NS.economy.applyUpgrades();
  S.hull = S.hullMax;
  A.updateWindowTitle();
  S.lastTimestamp = 0;
  S.animFrameId = requestAnimationFrame(A.gameLoop);
})();
