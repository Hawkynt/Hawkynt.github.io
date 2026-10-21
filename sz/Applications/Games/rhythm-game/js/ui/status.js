/* The HTML status bar: score, combo and the song currently being played. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const S = NS.state;

  function updateStatus() {
    const scoreEl = document.getElementById('statusScore');
    const comboEl = document.getElementById('statusCombo');
    const songEl = document.getElementById('statusSong');
    if (scoreEl) scoreEl.textContent = `Score: ${S.score}`;
    if (comboEl) comboEl.textContent = `Combo: ${S.combo}`;
    if (songEl) songEl.textContent = S.currentSong ? S.currentSong.name : 'Select a song';
  }

  Object.assign(NS.status, { updateStatus });
})();
