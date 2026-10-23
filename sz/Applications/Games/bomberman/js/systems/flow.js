/* The game flow: reset, the per-frame update order, the frame loop, the status
   bar and pausing — and the auto-pause wiring at the end of the module. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const F = NS.flow = NS.flow || {};

  /* ── Reset ── */
  F.resetGame = function resetGame() {
    S.state = C.STATE_READY;
    S.score = 0;
    S.lives = C.MAX_LIVES;
    S.currentLevel = 1;
    S.playerSpeed = C.PLAYER_SPEED_BASE;
    S.maxBombs = 1;
    S.blastRange = 2;
    S.hasKick = false;
    S.hasRemote = false;
    S.hasPowerKick = false;
    S.hasFly = false;
    S.hasGlove = false;
    S.hasClimb = false;
    S.bombs = [];
    S.fireCells = [];
    S.powerUps = [];
    NS.arena.generateArena(S.currentLevel);
    NS.arena.spawnEnemies(S.currentLevel);
    NS.arena.resetPlayerPosition();
    D.particles.clear();
    D.floatingText.clear();
    F.updateStatus();
    SZ.Dlls.User32.SetWindowText('Bomberman');
  };

  /* ── Update ── */
  F.update = function update(dt) {
    if (S.state === C.STATE_READY || S.state === C.STATE_PAUSED || S.state === C.STATE_DEAD) {
      D.screenShake.update(dt * 1000);
      D.particles.update();
      D.floatingText.update();
      return;
    }

    if (S.state !== C.STATE_PLAYING)
      return;

    // Player movement
    NS.player.updatePlayer(dt);

    // Update enemies
    for (const e of S.enemies)
      NS.enemies.updateEnemy(e, dt);

    // Update bomb fuses
    for (let i = S.bombs.length - 1; i >= 0; --i) {
      S.bombs[i].fuse -= dt;
      if (S.bombs[i].fuse <= 0)
        NS.bombs.detonateBomb(S.bombs[i]);
    }

    // Update sliding bombs
    NS.bombs.updateSlidingBombs(dt);

    // Update fire timers — clear fire cells after fire duration expires
    for (let i = S.fireCells.length - 1; i >= 0; --i) {
      S.fireCells[i].timer -= dt;
      if (S.fireCells[i].timer <= 0)
        S.fireCells.splice(i, 1);
    }

    // Check fire damage to player and enemies
    NS.damage.checkFireDamage();

    // Check enemy-player collision (distance-based for smooth movement)
    for (const e of S.enemies) {
      if (!e.alive)
        continue;
      const dx = e.x - S.player.x;
      const dy = e.y - S.player.y;
      const collisionThreshold = C.TILE_SIZE * 0.6;
      if (dx * dx + dy * dy < collisionThreshold * collisionThreshold) {
        NS.damage.playerHitByExplosion();
        if (S.state === C.STATE_DEAD)
          return;
      }
    }

    // Effects
    D.particles.update();
    D.floatingText.update();
    D.screenShake.update(dt * 1000);
    F.updateStatus();
  };

  /* ── Game Loop ── */
  F.gameLoop = function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, C.MAX_DT);
    S.lastTimestamp = timestamp;

    F.update(dt);
    NS.scene.draw();

    S.animFrameId = requestAnimationFrame(F.gameLoop);
  };

  /* ── Status Bar ── */
  F.updateStatus = function updateStatus() {
    D.statusScore.textContent = 'Score: ' + S.score;
    D.statusLevel.textContent = 'Level: ' + S.currentLevel;
    D.statusLives.textContent = 'Lives: ' + S.lives;
    D.statusState.textContent = S.state === C.STATE_PAUSED ? 'Paused' :
      S.state === C.STATE_DEAD ? 'Game Over' :
      S.state === C.STATE_PLAYING ? 'Playing' : 'Ready';
  };

  /* ── Input ── */
  F.togglePause = function togglePause() {
    if (S.state === C.STATE_PLAYING)
      S.state = C.STATE_PAUSED;
    else if (S.state === C.STATE_PAUSED)
      S.state = C.STATE_PLAYING;
    F.updateStatus();
  };

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: F.togglePause
  });
})();
