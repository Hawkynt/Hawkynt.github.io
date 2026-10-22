/* One frame of the game: the per-frame update (animations, timers, AI) and the
   state-dependent draw order, driven by the requestAnimationFrame loop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function update(dt) {
    // Update animations
    for (let i = S.cardAnimations.length - 1; i >= 0; --i) {
      const a = S.cardAnimations[i];
      a.t += dt / a.duration;
      if (a.t >= 1) {
        S.cardAnimations.splice(i, 1);
      }
    }

    // Mana shimmer timer
    if (S.manaShimmerTimer > 0)
      S.manaShimmerTimer -= dt;

    // Turn transition
    if (S.turnTransition > 0)
      S.turnTransition -= dt;

    // AI plays
    if (!S.isPlayerTurn && S.state === C.STATE_PLAYING)
      NS.ai.aiTakeTurn(dt);

    // Update effects
    D.particles.update();
    D.screenShake.update(dt * 1000);
    D.floatingText.update();
  }

  function render() {
    const ctx = D.ctx;
    ctx.save();

    // Apply screen shake
    D.screenShake.apply(ctx);

    if (S.state === C.STATE_MENU) {
      NS.screens.drawMenuScreen();
    } else if (S.state === C.STATE_DECK_BUILD) {
      NS.screens.drawDeckBuilder();
    } else {
      NS.hud.drawBackground();

      // Health bars
      NS.hud.drawHealthBar(C.CANVAS_W / 2 - 100, 10, S.aiHP, S.aiMaxHP, S.aiShield, '#c44', 'Opponent');
      NS.hud.drawHealthBar(C.CANVAS_W / 2 - 100, C.CANVAS_H - 30, S.playerHP, S.playerMaxHP, S.playerShield, '#4a4', 'You');

      // Mana bar display
      NS.hud.drawManaBar(20, C.CANVAS_H - 50, S.playerMana, S.playerMaxMana);

      // Buff/debuff indicators
      NS.hud.drawBuffIndicators();

      // Deck pile
      NS.hud.drawDeckPile();

      // AI hand (face down)
      NS.hud.drawAiHand();

      // Player hand
      NS.hud.drawPlayerHand();

      // End turn button
      NS.hud.drawEndTurnButton();

      // Card tooltip
      NS.hud.drawCardTooltip();

      // Turn indicator
      NS.hud.drawTurnIndicator();

      // Overlays
      NS.screens.drawGameOverlay();
    }

    // Draw effects on top
    D.particles.draw(ctx);
    D.floatingText.draw(ctx);

    D.screenShake.restore(ctx);
    ctx.restore();
  }

  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - S.lastTimestamp) / 1000, C.MAX_DT);
    S.lastTimestamp = timestamp;

    if (S.state !== C.STATE_PAUSED)
      update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  Object.assign(NS.scene, { update, render, gameLoop });
})();
