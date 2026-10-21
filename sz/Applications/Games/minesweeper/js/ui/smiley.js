/* The smiley button: its bounce-on-new-game click and the face state setter. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const D = NS.dom;
  const SM = NS.smiley;
  const G = NS.game;

  /* ---- Smiley ---- */
  D.smileyBtn.addEventListener('click', () => {
    D.smileyBtn.classList.add('smiley-bounce');
    D.smileyBtn.addEventListener('animationend', function handler() {
      D.smileyBtn.classList.remove('smiley-bounce');
      D.smileyBtn.removeEventListener('animationend', handler);
    });
    G.newGame();
  });

  SM.setSmiley = function setSmiley(face) {
    D.smileyBtn.dataset.face = face;
  };
})();
