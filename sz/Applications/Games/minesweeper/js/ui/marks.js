/* The question-mark (marks) toggle and its menu check. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const MK = NS.marks;

  /* ---- Marks (?) Toggle ---- */
  MK.toggleMarks = function toggleMarks() {
    S.marksEnabled = !S.marksEnabled;
    MK.updateMarksCheck();
  };

  MK.updateMarksCheck = function updateMarksCheck() {
    const el = document.querySelector('.menu-entry[data-action="marks"]');
    if (el)
      el.classList.toggle('checked', S.marksEnabled);
  };
})();
