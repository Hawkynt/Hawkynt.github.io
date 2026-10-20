/* The game flow: pause and resume, the full restart, and the per-frame update of
   the player animation and the perspective morph. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const { updatePlayerAnimation } = NS.player;
  const { updateRotation } = NS.perspective;
  const { loadLevel } = NS.level;

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (S.state !== C.STATE_PLAYING) return;
    updatePlayerAnimation(dt);
    updateRotation(dt);
  }

  function togglePause() {
    if (S.state === C.STATE_PLAYING)
      S.state = C.STATE_PAUSED;
    else if (S.state === C.STATE_PAUSED)
      S.state = C.STATE_PLAYING;
    else
      return;
    SZ.GameAudio.play('click');
  }

  function resetAndStart() {
    S.collected = [];
    S.levelProgress = {};
    loadLevel(0);
  }

  Object.assign(NS.game, { updateGame, togglePause, resetAndStart });
})();
