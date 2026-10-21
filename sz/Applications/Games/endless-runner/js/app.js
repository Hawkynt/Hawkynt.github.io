/* Loaded last: the requestAnimationFrame game loop, dialog wiring, the OS window
   integration and the start-up sequence. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, C.MAX_DT);
    S.lastTimestamp = timestamp;

    NS.flow.update(dt);
    NS.scene.draw();

    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — CSS handles it
    }
    if (msg === 'WM_SIZE') {
      V.setupCanvas();
    }
  });

  SZ.Dlls.User32.SetWindowText('Endless Runner');

  /* ── Init ── */
  V.sfx.attachMuteButton();
  NS.highscores.loadData();
  V.setupCanvas();
  NS.status.updateStatus();
  try { S.tutorialSeen = localStorage.getItem(C.STORAGE_TUTORIAL) === '1'; } catch (_) { S.tutorialSeen = false; }
  if (!S.tutorialSeen) {
    S.showTutorial = true;
    S.tutorialPage = 0;
    S.tutorialSeen = true;
    try { localStorage.setItem(C.STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  S.animFrameId = requestAnimationFrame(gameLoop);
})();
