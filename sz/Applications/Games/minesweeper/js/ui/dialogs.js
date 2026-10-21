/* Best times, statistics, custom field and about dialogs, plus the Enter wiring
   of the custom field inputs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const D = NS.dom;
  const ST = NS.store;
  const ME = NS.menu;
  const DL = NS.dialogs;
  const G = NS.game;

  /* ---- Best Times Dialog ---- */
  DL.showBestTimes = function showBestTimes() {
    document.getElementById('btBegTime').textContent = S.bestTimes.beginner.time + ' seconds';
    document.getElementById('btBegName').textContent = S.bestTimes.beginner.name;
    document.getElementById('btIntTime').textContent = S.bestTimes.intermediate.time + ' seconds';
    document.getElementById('btIntName').textContent = S.bestTimes.intermediate.name;
    document.getElementById('btExpTime').textContent = S.bestTimes.expert.time + ' seconds';
    document.getElementById('btExpName').textContent = S.bestTimes.expert.name;
    SZ.Dialog.show('bestTimesBackdrop').then(result => {
      if (result === 'reset') {
        ST.resetBestTimes();
        DL.showBestTimes();
      }
    });
  };

  /* ---- Statistics Dialog ---- */
  DL.showStatsDialog = function showStatsDialog() {
    const d = S.difficulty === 'custom' ? 'beginner' : S.difficulty;
    const s = S.stats[d] || S.defaultStats();
    const pct = s.played > 0 ? Math.round(s.won / s.played * 100) : 0;
    document.getElementById('statsDifficulty').textContent = d.charAt(0).toUpperCase() + d.slice(1);
    document.getElementById('statsPlayed').textContent = s.played;
    document.getElementById('statsWon').textContent = s.won;
    document.getElementById('statsWinPct').textContent = pct + '%';
    document.getElementById('statsStreak').textContent = s.streak;
    document.getElementById('statsBestStreak').textContent = s.bestStreak;
    SZ.Dialog.show('statsBackdrop').then(result => {
      if (result === 'reset') {
        ST.resetStats();
        DL.showStatsDialog();
      }
    });
  };

  /* ---- Custom Field Dialog ---- */
  DL.showCustomDialog = function showCustomDialog() {
    if (S.customConfig) {
      D.customRowsInput.value = S.customConfig.rows;
      D.customColsInput.value = S.customConfig.cols;
      D.customMinesInput.value = S.customConfig.mines;
    }
    D.customError.textContent = '';
    SZ.Dialog.show('customBackdrop').then(result => {
      if (result === 'ok')
        DL.applyCustom();
    });
    D.customRowsInput.focus();
  };

  DL.applyCustom = function applyCustom() {
    const r = parseInt(D.customRowsInput.value, 10);
    const c = parseInt(D.customColsInput.value, 10);
    const m = parseInt(D.customMinesInput.value, 10);

    if (isNaN(r) || r < 9 || r > 24) {
      D.customError.textContent = 'Height must be between 9 and 24.';
      DL.showCustomDialog();
      D.customRowsInput.focus();
      return;
    }
    if (isNaN(c) || c < 9 || c > 30) {
      D.customError.textContent = 'Width must be between 9 and 30.';
      DL.showCustomDialog();
      D.customColsInput.focus();
      return;
    }
    if (isNaN(m) || m < 10 || m > 667) {
      D.customError.textContent = 'Mines must be between 10 and 667.';
      DL.showCustomDialog();
      D.customMinesInput.focus();
      return;
    }

    const maxMines = r * c - 9;
    if (m >= maxMines) {
      D.customError.textContent = 'Mines must be less than ' + maxMines + ' (' + r + 'x' + c + ' - 9).';
      DL.showCustomDialog();
      D.customMinesInput.focus();
      return;
    }

    S.customConfig = { rows: r, cols: c, mines: m };
    S.difficulty = 'custom';
    ME.updateDifficultyChecks();
    G.newGame();
    ME.requestWindowResize();
  };

  // Allow Enter key in custom dialog inputs
  [D.customRowsInput, D.customColsInput, D.customMinesInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        SZ.Dialog.close('customBackdrop');
        DL.applyCustom();
      }
    });
  });

  /* ---- About Dialog ---- */
  DL.showAboutDialog = function showAboutDialog() {
    SZ.Dialog.show('dlg-about');
  };
})();
