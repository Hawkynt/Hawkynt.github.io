/* The pure rules: turning a song melody into its note list, lane geometry,
   the combo score multiplier, the timing judgement and the final grade. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;

  function generateNotes(melody, bpm) {
    const beatDuration = 60 / bpm;
    const notes = [];
    for (let i = 0; i < melody.length; ++i) {
      const beat = melody[i];
      if (beat < 0) continue;
      notes.push({ lane: beat % C.LANE_COUNT, time: i * beatDuration * 0.5, hit: false, missed: false });
    }
    return notes;
  }

  function laneX(lane) {
    return C.LANE_START_X + lane * C.laneWidth + C.laneWidth / 2;
  }

  function getMultiplier() {
    if (S.combo >= 50) return 4;
    if (S.combo >= 30) return 3;
    if (S.combo >= 10) return 2;
    return 1;
  }

  function judgeNote(timeDiff) {
    const diff = Math.abs(timeDiff);
    if (diff <= C.PERFECT_WINDOW) return { rank: 'PERFECT', score: C.SCORE_PERFECT, color: '#ff0' };
    if (diff <= C.GREAT_WINDOW) return { rank: 'GREAT', score: C.SCORE_GREAT, color: '#4f4' };
    if (diff <= C.GOOD_WINDOW) return { rank: 'GOOD', score: C.SCORE_GOOD, color: '#4af' };
    return null;
  }

  function calculateGrade() {
    if (S.totalNotes === 0) return 'D';
    const ratio = (S.perfectCount * 3 + S.greatCount * 2 + S.goodCount) / (S.totalNotes * 3);
    if (ratio >= 0.95 && S.missCount === 0) return 'S';
    if (ratio >= 0.85) return 'A';
    if (ratio >= 0.7) return 'B';
    if (ratio >= 0.5) return 'C';
    return 'D';
  }

  Object.assign(NS.rules, { generateNotes, laneX, getMultiplier, judgeNote, calculateGrade });
})();
