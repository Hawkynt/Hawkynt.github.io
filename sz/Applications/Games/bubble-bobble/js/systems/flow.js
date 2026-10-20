/* The run flow: the per-frame update (cooldowns, power-up timer, the player/bubble/
   enemy/item subsystems, the level-clear check and the effect updates), pause/resume,
   the new-game reset and the auto-pause hook that pauses when the window is hidden. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Update ── */
  function update(dt) {
    if (S.state !== C.STATE_PLAYING) return;

    S.shootCooldown = Math.max(0, S.shootCooldown - dt);

    // Power-up timer
    if (S.powerUpTimer > 0) {
      S.powerUpTimer -= dt;
      if (S.powerUpTimer <= 0) {
        S.powerUpSpeed = false;
        S.powerUpRange = false;
      }
    }

    NS.player.updatePlayer(dt);
    NS.bubbles.updateBubbles(dt);
    NS.enemies.updateEnemies(dt);
    NS.items.updateItems(dt);
    NS.level.checkLevelClear();

    V.particles.update(dt);
    V.screenShake.update(dt);
    V.floatingText.update(dt);
  }

  function togglePause() {
    if (S.state === C.STATE_PLAYING) S.state = C.STATE_PAUSED;
    else if (S.state === C.STATE_PAUSED) S.state = C.STATE_PLAYING;
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: togglePause
  });

  /* ── Game reset ── */
  function resetGame() {
    S.state = C.STATE_PLAYING;
    SZ.GameAudio.play('select');
    S.score = 0;
    S.lives = C.MAX_LIVES;
    S.currentLevel = 1;
    S.powerUpSpeed = false;
    S.powerUpRange = false;
    S.powerUpTimer = 0;
    NS.level.generateLevel(S.currentLevel);
    NS.player.resetPlayerPosition();
    S.player.invincible = 0;
    V.particles.clear();
    V.floatingText.clear();
    NS.app.updateTitle();
  }

  Object.assign(NS.flow, { update, togglePause, resetGame });
})();
