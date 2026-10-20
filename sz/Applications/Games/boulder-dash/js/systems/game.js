/* The game flow: player death and respawn, level completion with its time bonus,
   the new-game reset and the window title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { generateLevel } = NS.levelgen;
  const { tileX, tileY } = NS.rules;
  const { User32 } = window.SZ?.Dlls ?? {};

  /* ── Player death ── */
  function playerDeath() {
    if (!S.player.alive || S.state !== C.STATE_PLAYING) return;
    S.player.alive = false;
    --S.lives;

    // Death explosion particles
    V.particles.burst(tileX(S.player.col), tileY(S.player.row), 20, { color: '#ff2200', life: 0.8, speed: 80 });
    V.screenShake.trigger(6, 0.3);
    SZ.GameAudio.play('explode', { volume: 0.7 });

    if (S.lives <= 0) {
      S.state = C.STATE_DEAD;
      NS.highscores.addHighScore(S.score, S.currentLevel);
      updateTitle();
      SZ.GameAudio.play('lose');
    } else {
      // Respawn after short delay
      setTimeout(() => {
        if (S.state === C.STATE_DEAD) return;
        resetPlayerPosition();
        S.player.alive = true;
      }, 1500);
    }
  }

  function resetPlayerPosition() {
    S.player.col = 1;
    S.player.row = 1;
    S.player.targetCol = 1;
    S.player.targetRow = 1;
    S.player.moveProgress = 1;
    S.grid[1][1] = C.EMPTY;
    S.grid[1][2] = C.EMPTY;
    S.grid[2][1] = C.EMPTY;
  }

  /* ── Level complete ── */
  function levelComplete() {
    // Time bonus
    const timeBonus = Math.floor(S.timeLeft) * C.TIME_BONUS_FACTOR;
    S.score += timeBonus;
    SZ.GameAudio.play('levelup');
    V.floatingText.add(V.canvas.width / 2, V.canvas.height / 2 - 20, 'Time Bonus +' + timeBonus, { color: '#ffd700', size: 20 });

    // Level-complete confetti burst
    for (let i = 0; i < 5; ++i) {
      const cx = C.TILE_SIZE * (5 + Math.random() * (C.COLS - 10));
      const cy = C.TILE_SIZE * (3 + Math.random() * (C.ROWS - 6));
      V.particles.burst(cx, cy, 15, {
        color: ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0'][i],
        life: 1.2,
        speed: 60
      });
    }

    ++S.currentLevel;
    generateLevel(S.currentLevel);
    resetPlayerPosition();
    S.player.alive = true;
    updateTitle();
  }

  /* ── Game reset ── */
  function resetGame() {
    S.state = C.STATE_PLAYING;
    SZ.GameAudio.play('select');
    S.score = 0;
    S.lives = C.MAX_LIVES;
    S.currentLevel = 1;
    generateLevel(S.currentLevel);
    resetPlayerPosition();
    S.player.alive = true;
    V.particles.clear();
    V.floatingText.clear();
    updateTitle();
  }

  /* ── Update title ── */
  function updateTitle() {
    const title = S.state === C.STATE_DEAD
      ? `Boulder Dash - Game Over (Score: ${S.score})`
      : `Boulder Dash - Level ${S.currentLevel} - Score: ${S.score}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  Object.assign(NS.game, { playerDeath, resetPlayerPosition, levelComplete, resetGame, updateTitle });
})();
