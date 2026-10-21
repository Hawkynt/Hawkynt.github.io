/* The menu bar: new game, pause, the high-scores dialog with its reset branch, exit,
   the in-canvas tutorial, the controls dialog and about. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => NS.flow.resetGame(),
      pause: () => NS.input.togglePause(),
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < C.MAX_HIGH_SCORES; ++i) {
          const entry = S.highScores[i] || { distance: 0, coins: 0 };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${Math.floor(entry.distance)} m</td><td>${entry.coins}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          S.highScores = [];
          S.totalCoins = 0;
          NS.highscores.saveData();
          NS.status.updateStatus();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      tutorial: () => { S.showTutorial = true; S.tutorialPage = 0; },
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }
})();
