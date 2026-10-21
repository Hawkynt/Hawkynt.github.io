/* Song lifecycle: starting a song with its generated note list and a fresh set
   of counters, finishing it with the grade and saved high score, browsing the
   selection and the full reset back to song select. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { SONGS } = NS.songs;
  const { generateNotes, calculateGrade } = NS.rules;
  const { startMusic, stopMusic } = NS.audio;
  const { saveHighScore } = NS.highscores;
  const { updateStatus } = NS.status;

  function startSong(index) {
    S.currentSong = SONGS[index];
    S.activeNotes = generateNotes(S.currentSong.melody, S.currentSong.bpm);
    S.totalNotes = S.activeNotes.length;
    S.songTime = -2;  // 2-second lead-in
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.perfectCount = 0;
    S.greatCount = 0;
    S.goodCount = 0;
    S.missCount = 0;
    S.comboGlowIntensity = 0;
    S.consecutiveMisses = 0;
    S.comboPulse = 0;
    S.glowRings.length = 0;
    S.screenFlashAlpha = 0;
    S.bgPulseIntensity = 0;
    S.bgPulsePhase = 0;
    S.comboBounce = 0;
    S.comboLastValue = 0;
    D.trailParticles.clear();
    for (let i = 0; i < C.LANE_COUNT; ++i) S.laneFlash[i] = 0;
    S.state = C.STATE_PLAYING;
    startMusic(index);
    NS.os.updateWindowTitle();
    updateStatus();
  }

  function endSong() {
    S.state = C.STATE_RESULTS;
    stopMusic();
    const grade = calculateGrade();
    saveHighScore(S.currentSong.name, S.score, grade);
    D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 100, `Grade: ${grade}`, { color: '#ff0', size: 36 });
    D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 60, `Score: ${S.score}`, { color: '#fff', size: 24 });
    D.particles.confetti(C.CANVAS_W / 2, C.CANVAS_H / 2, 30);
    NS.os.updateWindowTitle();
  }

  function selectSong(direction) {
    S.selectedSongIndex = (S.selectedSongIndex + direction + SONGS.length) % SONGS.length;
  }

  function initGame() {
    stopMusic();
    S.state = C.STATE_SONG_SELECT;
    S.currentSong = null;
    S.activeNotes = [];
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.perfectCount = 0;
    S.greatCount = 0;
    S.goodCount = 0;
    S.missCount = 0;
    S.comboGlowIntensity = 0;
    S.consecutiveMisses = 0;
    S.comboPulse = 0;
    S.glowRings.length = 0;
    S.screenFlashAlpha = 0;
    S.bgPulseIntensity = 0;
    S.bgPulsePhase = 0;
    S.comboBounce = 0;
    S.comboLastValue = 0;
    D.trailParticles.clear();
    for (let i = 0; i < C.LANE_COUNT; ++i) S.laneFlash[i] = 0;
    NS.os.updateWindowTitle();
    updateStatus();
  }

  Object.assign(NS.song, { startSong, endSong, selectSong, initGame });
})();
