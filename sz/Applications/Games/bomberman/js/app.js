/* The boot sequence: load stored data, honor the tutorial-seen flag, size the
   canvas, set up the first round, wire the mute button and touch controls,
   open the tutorial for first-timers and start the frame loop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  /* ── Init ── */
  NS.highscores.loadData();
  try { S.tutorialSeen = localStorage.getItem(C.STORAGE_TUTORIAL) === '1'; } catch (_) { S.tutorialSeen = false; }
  D.setupCanvas();
  NS.flow.resetGame();
  SZ.GameAudio.attachMuteButton();
  SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'four',
    buttons: [{ label: 'Bomb', code: 'Space' }],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });
  if (!S.tutorialSeen) {
    S.showTutorial = true;
    S.tutorialPage = 0;
    S.tutorialSeen = true;
    try { localStorage.setItem(C.STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  S.animFrameId = requestAnimationFrame(NS.flow.gameLoop);
})();
