/* The game flow: loading a level's geometry, resetting the probe, scoring a solved
   puzzle with its star rating and celebration, pausing, restarting and the window
   title that tracks progress. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const { User32 } = window.SZ?.Dlls ?? {};
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { LEVELS } = NS.levels;
  const { calculateRating, ratingToStars } = NS.rules;
  const { addHighScore } = NS.highscores;

  /* ── Load level ── */
  function loadLevel(idx) {
    if (idx >= LEVELS.length) {
      // All levels complete — game over with victory
      S.state = C.STATE_GAME_OVER;
      SZ.GameAudio.play('levelup');
      addHighScore(S.totalScore);
      updateTitle();
      return;
    }

    const lvl = LEVELS[idx];
    S.currentLevel = idx;
    S.startPos = { x: lvl.start.x, y: lvl.start.y };
    S.goal = { x: lvl.goal.x, y: lvl.goal.y };
    S.wells = lvl.wells.map(w => ({ ...w }));
    S.asteroids = lvl.asteroids.map(a => ({ ...a, glow: Math.random() * Math.PI * 2 }));
    S.moveCount = 0;
    S.elapsed = 0;
    S.levelStartTime = performance.now();
    S.trail = [];
    resetObject();
    S.state = C.STATE_PLAYING;
    updateTitle();
  }

  function resetObject() {
    S.obj.x = S.startPos.x;
    S.obj.y = S.startPos.y;
    S.obj.vx = 0;
    S.obj.vy = 0;
    S.obj.active = false;
    S.trail = [];
    S.state = C.STATE_PLAYING;
  }

  /* ── Puzzle solved ── */
  function puzzleSolved() {
    S.state = C.STATE_SOLVED;
    const rating = calculateRating(S.moveCount, LEVELS[S.currentLevel].par);
    const stars = ratingToStars(rating);
    const levelScore = rating * 100 + Math.max(0, Math.floor(300 - S.elapsed * 10));
    S.totalScore += levelScore;

    // Spacecraft repair progress — component found!
    const repairComponent = LEVELS[S.currentLevel].repair.component;
    D.floatingText.add(S.goal.x, S.goal.y - 30, repairComponent + ' repaired!', { color: '#00ffaa' });
    D.floatingText.add(S.goal.x, S.goal.y - 50, stars + ' (' + levelScore + ' pts)', { color: '#ffd700' });

    // Solution-reveal particle cascade — confetti celebration
    for (let i = 0; i < 8; ++i) {
      const cx = S.goal.x + (Math.random() - 0.5) * 100;
      const cy = S.goal.y + (Math.random() - 0.5) * 80;
      D.particles.burst(cx, cy, 12, {
        color: C.CONFETTI_COLORS[i],
        life: 1.0, speed: 60
      });
    }
    D.screenShake.trigger(6, 0.3);
    SZ.GameAudio.play('win');
    updateTitle();

    // Advance to next level after delay
    setTimeout(() => {
      if (S.state === C.STATE_SOLVED)
        loadLevel(S.currentLevel + 1);
    }, 2000);
  }

  /* ── Toggle pause ── */
  function togglePause() {
    if (S.state === C.STATE_PLAYING || S.state === C.STATE_AIMING || S.state === C.STATE_LAUNCHED) {
      S.state = C.STATE_PAUSED;
    } else if (S.state === C.STATE_PAUSED)
      S.state = C.STATE_PLAYING;
  }

  /* ── Reset game ── */
  function resetGame() {
    S.totalScore = 0;
    SZ.GameAudio.play('select');
    loadLevel(0);
    D.particles.clear();
    D.floatingText.clear();
  }

  /* ── Title ── */
  function updateTitle() {
    const title = S.state === C.STATE_GAME_OVER
      ? `Space Puzzle - All Levels Complete! (Score: ${S.totalScore})`
      : `Space Puzzle - Level ${S.currentLevel + 1} - Score: ${S.totalScore}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  Object.assign(NS.game, { loadLevel, resetObject, puzzleSolved, togglePause, resetGame, updateTitle });
})();
