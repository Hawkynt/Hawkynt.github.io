/* The menu bar actions — new game, pause, the high-scores dialog with its
   reset, exit, controls, tutorial and about — and the dialog wiring. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const M = NS.menu = NS.menu || {};

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => NS.flow.resetGame(),
      pause: NS.flow.togglePause,
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < C.MAX_HIGH_SCORES; ++i) {
          const entry = S.highScores[i] || { score: 0, level: 0 };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${entry.score}</td><td>${entry.level}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          S.highScores = [];
          NS.highscores.saveData();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      tutorial: () => { S.showTutorial = true; S.tutorialPage = 0; },
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();
})();
