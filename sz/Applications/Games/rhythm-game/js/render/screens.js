/* The full-screen states: the song selection list with best scores per song,
   the results screen with grade and judgement breakdown, and the pause overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { SONGS } = NS.songs;
  const { calculateGrade } = NS.rules;
  const { getHighScoreForSong } = NS.highscores;

  function drawSongSelectScreen() {
    const ctx = D.ctx;
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a Song', C.CANVAS_W / 2, 60);

    const startY = 110;
    const rowH = 60;
    for (let i = 0; i < SONGS.length; ++i) {
      const y = startY + i * rowH;
      const selected = i === S.selectedSongIndex;

      ctx.fillStyle = selected ? '#2a2a6a' : '#1a1a2a';
      ctx.strokeStyle = selected ? '#88f' : '#333';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.fillRect(C.CANVAS_W / 2 - 200, y, 400, 50);
      ctx.strokeRect(C.CANVAS_W / 2 - 200, y, 400, 50);

      ctx.fillStyle = selected ? '#fff' : '#aaa';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(SONGS[i].name, C.CANVAS_W / 2 - 180, y + 22);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = selected ? '#88f' : '#666';
      ctx.fillText(`BPM: ${SONGS[i].bpm} • Difficulty: ${'★'.repeat(SONGS[i].difficulty)}${'☆'.repeat(3 - SONGS[i].difficulty)}`, C.CANVAS_W / 2 - 180, y + 40);

      // Show high score if available
      const hs = getHighScoreForSong(SONGS[i].name);
      if (hs) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fa0';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Best: ${hs.score} (${hs.grade})`, C.CANVAS_W / 2 + 180, y + 30);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('↑/↓ to navigate • Enter or Click to start', C.CANVAS_W / 2, C.CANVAS_H - 40);
  }

  function drawResultsScreen() {
    const ctx = D.ctx;
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const grade = calculateGrade();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Song Complete!', C.CANVAS_W / 2, 60);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(S.currentSong.name, C.CANVAS_W / 2, 95);

    // Grade display
    const gradeColor = grade === 'S' ? '#ff0' : grade === 'A' ? '#4f4' : grade === 'B' ? '#4af' : grade === 'C' ? '#fa0' : '#f44';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = gradeColor;
    ctx.fillText(grade, C.CANVAS_W / 2, 200);

    // Stats
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    const statsX = C.CANVAS_W / 2 - 100;
    let statsY = 250;
    const lineH = 28;

    ctx.fillStyle = '#fa0';
    ctx.fillText(`Score: ${S.score}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#fff';
    ctx.fillText(`Max Combo: ${S.maxCombo}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#ff0';
    ctx.fillText(`Perfect: ${S.perfectCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#4f4';
    ctx.fillText(`Great: ${S.greatCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#4af';
    ctx.fillText(`Good: ${S.goodCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#f44';
    ctx.fillText(`Miss: ${S.missCount}`, statsX, statsY); statsY += lineH;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press Enter or click to continue', C.CANVAS_W / 2, C.CANVAS_H - 40);
  }

  function drawPauseOverlay() {
    const ctx = D.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Escape to resume', C.CANVAS_W / 2, C.CANVAS_H / 2 + 20);
  }

  Object.assign(NS.screens, { drawSongSelectScreen, drawResultsScreen, drawPauseOverlay });
})();
