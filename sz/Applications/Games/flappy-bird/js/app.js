;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Bootstrap: the game loop (with a smoothed JS frame time in G.frameMs), the menu bar,
     dialogs, OS integration and start-up. Owns G.lastTimestamp and G.animFrameId. */

  const { MAX_HIGH_SCORES, MAX_DT, STATE_TITLE } = NS.C;
  const G = NS.state;
  const Save = NS.save;
  const Rules = NS.rules;
  const View = NS.view;
  const Flight = NS.flight;
  const FxDraw = NS.fxDraw;
  const Nav = NS.nav;
  const Input = NS.input;
  const Goals = NS.goals;

  function gameLoop(timestamp) {
    const t0 = performance.now();
    const rawDt = G.lastTimestamp ? (timestamp - G.lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, MAX_DT);
    G.lastTimestamp = timestamp;

    Flight.update(dt);
    NS.music.update(dt);
    View.beginFrame();
    View.draw();
    FxDraw.drawScreenFx();

    G.frameMs = G.frameMs * 0.95 + (performance.now() - t0) * 0.05;
    G.animFrameId = requestAnimationFrame(gameLoop);
  }

  Input.attach();

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => Nav.goTitle(),
      pause: Nav.togglePause,
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
          const s = G.highScores[i] || 0;
          const medal = Rules.getMedal(s);
          const a = G.save.arcadeScores[i];
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${s}</td><td>${medal ? medal.name : '-'}</td><td>${a ? a.score : '-'}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          G.highScores = [];
          Save.saveHighScores();
          G.save.arcadeScores = [];
          Save.writeSave();
          Nav.updateStatus();
        }
      },
      exit: () => {
        NS.autosave.saveNow();
        SZ.Dlls.User32.DestroyWindow();
      },
      music: () => { if (SZ.GameMusic) SZ.GameMusic.toggle(); },
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_SIZE' || msg === 'WM_THEMECHANGED')
      View.setupCanvas();
  });

  SZ.Dlls.User32.SetWindowText('Flappy Bird');

  /* ── Init ── */
  document.body.tabIndex = -1;
  Save.loadHighScores();
  Save.loadSave();
  Goals.rollover();
  Goals.check();
  Save.writeSave();
  View.setupCanvas();
  G.state = STATE_TITLE;
  G.fade = 1;
  Nav.updateStatus();
  Nav.updateWindowTitle();
  SZ.GameAudio.attachMuteButton();
  G.animFrameId = requestAnimationFrame(gameLoop);

  Object.assign(NS.app, { gameLoop });
})();
