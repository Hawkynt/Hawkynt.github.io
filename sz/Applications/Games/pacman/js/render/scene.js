;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.scene.draw = function draw(timestamp) {
    D.ctx.fillStyle = S.currentTheme ? S.currentTheme.bg : '#000000';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    D.ctx.save();
    E.screenShake.apply(D.ctx);

    /* Intermission renders its own scene */
    if (S.gameState === 'intermission') {
      E.screenShake.restore(D.ctx);
      D.ctx.restore();
      NS.intermission.drawIntermission();
      return;
    }

    /* Boss intro overlay */
    if (S.gameState === 'bossIntro') {
      NS.mazeview.drawMaze();
      E.screenShake.restore(D.ctx);
      D.ctx.restore();
      NS.bossview.drawBossIntro();
      return;
    }

    /* Draw S.maze (with flashing for S.level complete) */
    if (S.gameState === 'levelcomplete') {
      const flash = Math.floor(performance.now() / 200) % 2;
      if (flash)
        NS.mazeview.drawMazeFlash();
      else
        NS.mazeview.drawMaze();
    } else {
      NS.mazeview.drawMaze();
    }

    /* Draw fruit */
    NS.fruitview.drawFruit(timestamp);

    /* Draw powerup item */
    NS.powerupview.drawPowerupItem(timestamp);

    /* Draw Pac-Man */
    if (S.gameState !== 'dying' || S.dyingTimer > 1000)
      NS.pacview.drawPacman();
    else {
      const progress = 1 - S.dyingTimer / 1000;
      D.ctx.save();
      D.ctx.translate(S.pacman.x, S.pacman.y);
      D.ctx.scale(1 - progress, 1 - progress);
      D.ctx.translate(-S.pacman.x, -S.pacman.y);
      NS.pacview.drawPacman();
      D.ctx.restore();
    }

    /* Draw S.ghosts */
    if (S.gameState !== 'dying')
      NS.ghostview.drawGhosts();

    /* Draw S.boss */
    if (S.bossActive)
      NS.bossview.drawBoss();

    /* Draw electric arcs */
    for (const arc of S.electricArcs)
      SZ.GameEffects.drawElectricArc(D.ctx, arc.x1, arc.y1, arc.x2, arc.y2);

    /* Draw effects */
    E.particles.draw(D.ctx);
    E.floatingText.draw(D.ctx);

    E.screenShake.restore(D.ctx);
    D.ctx.restore();

    /* Draw S.boss health bar outside shake transform */
    if (S.bossActive)
      NS.bossview.drawBossHealthBar();

    /* Draw overlays */
    if (S.gameState === 'ready')
      NS.overlay.drawReadyText();
    else if (S.gameState === 'paused')
      NS.overlay.drawOverlayText('PAUSED', 'Press P to resume');
    else if (S.gameState === 'gameover')
      NS.overlay.drawOverlayText('GAME OVER', 'Tap or press Space for new game');
    else if (S.gameState === 'idle')
      NS.overlay.drawOverlayText('PAC-MAN', 'Tap or press Space to start');
    else if (S.gameState === 'bossVictory')
      NS.overlay.drawOverlayText('BOSS DEFEATED!', 'Well done!');

    NS.status.updateEffectDisplay(timestamp);
  }

})();
