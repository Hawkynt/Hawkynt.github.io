/* Input: auto-pause on blur, the keyboard (F2 reset, Escape pause, song browsing,
   lane keys d/f/j/k) and the canvas pointer (song row clicks, lane taps during
   play, continue on results, resume on pause). Audio bootstraps on first gesture. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { ensureAudioCtx, resumeAudioCtx, pauseMusic, resumeMusic } = NS.audio;

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: () => {
      S.state = C.STATE_PAUSED;
      pauseMusic();
      NS.os.updateWindowTitle();
    }
  });

  window.addEventListener('keydown', (e) => {
    // Bootstrap audio context on first user gesture (browser requirement)
    ensureAudioCtx();
    resumeAudioCtx();

    if (e.key === 'F2') {
      e.preventDefault();
      NS.song.initGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (S.state === C.STATE_PLAYING) {
        S.state = C.STATE_PAUSED;
        pauseMusic();
        NS.os.updateWindowTitle();
      } else if (S.state === C.STATE_PAUSED) {
        S.state = C.STATE_PLAYING;
        resumeMusic();
        NS.os.updateWindowTitle();
      }
      return;
    }

    if (S.state === C.STATE_SONG_SELECT) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        NS.song.selectSong(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        NS.song.selectSong(1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        NS.song.startSong(S.selectedSongIndex);
      }
      return;
    }

    if (S.state === C.STATE_RESULTS) {
      if (e.key === 'Enter') {
        e.preventDefault();
        NS.song.initGame();
      }
      return;
    }

    if (S.state !== C.STATE_PLAYING) return;

    const laneIndex = C.LANE_KEYS.indexOf(e.key.toLowerCase());
    if (laneIndex >= 0) {
      e.preventDefault();
      NS.scoring.hitNote(laneIndex);
    }
  });

  D.canvas.addEventListener('pointerdown', (e) => {
    ensureAudioCtx();
    resumeAudioCtx();

    if (S.state === C.STATE_SONG_SELECT) {
      // Calculate click position relative to canvas
      const rect = D.canvas.getBoundingClientRect();
      const scaleX = C.CANVAS_W / rect.width;
      const scaleY = C.CANVAS_H / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Check if a song row was clicked
      const startY = 110;
      const rowH = 60;
      for (let i = 0; i < NS.songs.SONGS.length; ++i) {
        const rowTop = startY + i * rowH;
        const rowBot = rowTop + 50;
        if (clickX >= C.CANVAS_W / 2 - 200 && clickX <= C.CANVAS_W / 2 + 200 &&
            clickY >= rowTop && clickY <= rowBot) {
          S.selectedSongIndex = i;
          NS.song.startSong(S.selectedSongIndex);
          return;
        }
      }

      // Click anywhere else on song select starts the currently selected song
      NS.song.startSong(S.selectedSongIndex);
      return;
    }

    if (S.state === C.STATE_PLAYING) {
      // Click lanes during gameplay — determine lane from x position
      const rect = D.canvas.getBoundingClientRect();
      const scaleX = C.CANVAS_W / rect.width;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickLane = Math.floor((clickX - C.LANE_START_X) / C.laneWidth);
      if (clickLane >= 0 && clickLane < C.LANE_COUNT)
        NS.scoring.hitNote(clickLane);
      return;
    }

    if (S.state === C.STATE_RESULTS) {
      NS.song.initGame();
      return;
    }

    if (S.state === C.STATE_PAUSED) {
      S.state = C.STATE_PLAYING;
      resumeMusic();
      NS.os.updateWindowTitle();
    }
  });

  Object.assign(NS.input, {});
})();
