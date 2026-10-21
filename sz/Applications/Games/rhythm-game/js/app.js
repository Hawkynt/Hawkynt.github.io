/* The main loop and the init sequence: canvas setup, mute sync, the reset to
   song select and the requestAnimationFrame loop that updates and draws. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { updatePlaying } = NS.flow;
  const { draw } = NS.board;

  function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, C.MAX_DT);
    S.lastTimestamp = timestamp;

    if (S.state === C.STATE_PLAYING)
      updatePlaying(dt);

    D.particles.update();
    D.trailParticles.update();
    D.screenShake.update(dt * 1000);
    D.floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  NS.os.setupCanvas();
  SZ.GameAudio.attachMuteButton();
  NS.audio.wireMuteSync();
  NS.song.initGame();

  S.lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

  Object.assign(NS.app, { gameLoop });
})();
