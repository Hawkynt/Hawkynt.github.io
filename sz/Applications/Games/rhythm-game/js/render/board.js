/* One frame: the select and results screens stand alone; the playfield draws
   lanes, hit zone, notes and combo under the shake transform, then the score,
   progress bar and effects, the screen flash and the pause overlay on top. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function draw() {
    const ctx = D.ctx;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    if (S.state === C.STATE_SONG_SELECT) {
      NS.screens.drawSongSelectScreen();
      return;
    }

    if (S.state === C.STATE_RESULTS) {
      NS.screens.drawResultsScreen();
      D.particles.draw(ctx);
      D.floatingText.draw(ctx);
      return;
    }

    D.screenShake.apply(ctx);
    NS.lanes.drawLaneBackground();
    NS.lanes.drawHitZone();
    NS.notes.drawNotes();
    NS.notes.drawComboDisplay();

    // Score display with subtle neon glow
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 4;
    ctx.fillText(`Score: ${S.score}`, 20, 30);
    ctx.restore();

    // Song progress with neon bar
    if (S.currentSong && S.activeNotes.length > 0) {
      const lastTime = S.activeNotes[S.activeNotes.length - 1].time;
      const progress = Math.max(0, Math.min(1, S.songTime / lastTime));
      ctx.fillStyle = '#222';
      ctx.fillRect(20, C.CANVAS_H - 40, C.CANVAS_W - 40, 6);
      ctx.save();
      ctx.fillStyle = '#4488ff';
      ctx.shadowColor = '#2266ff';
      ctx.shadowBlur = 6;
      ctx.fillRect(20, C.CANVAS_H - 40, (C.CANVAS_W - 40) * progress, 6);
      ctx.restore();
    }

    D.particles.draw(ctx);
    D.floatingText.draw(ctx);

    D.screenShake.restore(ctx);

    // Screen flash overlay (triggers on PERFECT hits)
    if (S.screenFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = S.screenFlashAlpha;
      ctx.fillStyle = S.screenFlashColor;
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.restore();
    }

    if (S.state === C.STATE_PAUSED) NS.screens.drawPauseOverlay();
  }

  Object.assign(NS.board, { draw });
})();
