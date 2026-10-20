/* The heads-up display and the frame composition: the title screen, the room/rule panel
   and rules-found counter, the pause and game-over overlays, and drawGame which lays the
   room, the player and the HUD over the cleared canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const ctx = NS.dom.ctx;
  const ROOMS = NS.rooms;
  const { UI, panel, centeredText, pill } = NS.primitives;
  const { drawRoom, drawPlayer, drawTitleArt } = NS.scene;

  function drawHUD() {
    const t = performance.now() / 1000;

    if (S.state === C.STATE_READY) {
      const bg = ctx.createLinearGradient(0, 0, 0, C.canvasH);
      bg.addColorStop(0, '#0f0e2a');
      bg.addColorStop(1, '#2a1846');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, C.canvasW, C.canvasH);
      drawTitleArt(C.canvasW / 2, C.canvasH / 2 - 80, t);
      centeredText('MIND-BENDING PUZZLE', C.canvasH / 2 + 60, 'bold 30px ' + UI.font, UI.text, 'rgba(150,130,255,0.9)');
      centeredText('Discover the hidden rule of each surreal room', C.canvasH / 2 + 94, 'italic 15px ' + UI.font, UI.textDim);
      pill('Tap or press F2 to start', C.canvasH / 2 + 140, UI.gold);
      centeredText('Arrows / WASD move   ·   E / Space interact   ·   Q shift perspective   ·   Esc pause', C.canvasH / 2 + 190, '12px ' + UI.font, UI.textDim);
    }

    if (S.state === C.STATE_EXPLORING || S.state === C.STATE_PAUSED) {
      const def = ROOMS[S.currentRoom];
      const known = !!S.discoveredRules[S.currentRoom];
      const roomLabel = `ROOM ${S.currentRoom + 1} / ${ROOMS.length}`;
      const ruleText = known ? def.rule : 'Rule unknown';
      ctx.save();
      ctx.font = 'bold 11px ' + UI.font;
      const labelW = ctx.measureText(roomLabel).width;
      ctx.font = 'bold 15px ' + UI.font;
      const headW = labelW + 12 + ctx.measureText(def.name).width;
      ctx.font = '12px ' + UI.font;
      const w = Math.max(220, ctx.measureText(ruleText).width + 54, headW + 36);
      ctx.restore();
      panel(12, 12, w, 52, 0.8, def.accentColor);
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = def.accentColor;
      ctx.font = 'bold 11px ' + UI.font;
      ctx.fillText(roomLabel, 24, 26);
      ctx.fillStyle = UI.text;
      ctx.font = 'bold 15px ' + UI.font;
      ctx.fillText(def.name, 24 + labelW + 12, 26);
      // Rule line with a lock or check mark
      ctx.font = '12px ' + UI.font;
      ctx.fillStyle = known ? UI.good : UI.textDim;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (known) {
        // check mark
        ctx.moveTo(25, 48);
        ctx.lineTo(29, 52);
        ctx.lineTo(36, 43);
        ctx.stroke();
      } else {
        // padlock
        ctx.arc(30, 46, 3.5, Math.PI, 0);
        ctx.stroke();
        ctx.fillRect(25, 46, 10, 7);
      }
      ctx.fillText(ruleText, 42, 48);
      ctx.restore();

      // Discovered rules counter
      const discovered = Object.keys(S.discoveredRules).length;
      panel(C.canvasW - 120, 12, 108, 52, 0.8);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = UI.textDim;
      ctx.font = 'bold 10px ' + UI.font;
      ctx.fillText('RULES FOUND', C.canvasW - 66, 27);
      ctx.fillStyle = UI.gold;
      ctx.font = 'bold 18px ' + UI.font;
      ctx.fillText(`${discovered} / ${ROOMS.length}`, C.canvasW - 66, 47);
      ctx.restore();
    }

    if (S.state === C.STATE_PAUSED) {
      ctx.fillStyle = 'rgba(8,6,24,0.55)';
      ctx.fillRect(0, 0, C.canvasW, C.canvasH);
      panel(C.canvasW / 2 - 130, C.canvasH / 2 - 55, 260, 110, 0.92);
      centeredText('PAUSED', C.canvasH / 2 - 15, 'bold 28px ' + UI.font, UI.text, 'rgba(150,130,255,0.8)');
      centeredText('Press Esc to resume', C.canvasH / 2 + 22, '13px ' + UI.font, UI.textDim);
    }

    if (S.state === C.STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(8,6,24,0.6)';
      ctx.fillRect(0, 0, C.canvasW, C.canvasH);
      panel(C.canvasW / 2 - 180, C.canvasH / 2 - 90, 360, 180, 0.94, '#ffd700');
      centeredText('AWAKENED', C.canvasH / 2 - 50, 'bold 30px ' + UI.font, UI.gold, 'rgba(255,200,80,0.8)');
      const discovered = Object.keys(S.discoveredRules).length;
      centeredText(`Rules discovered: ${discovered} / ${ROOMS.length}`, C.canvasH / 2 - 12, 'bold 15px ' + UI.font, UI.text);
      centeredText(`Time: ${Math.floor(S.elapsedTime / 60)}:${String(Math.floor(S.elapsedTime % 60)).padStart(2, '0')}`, C.canvasH / 2 + 14, '14px ' + UI.font, UI.textDim);
      pill('Tap or press F2 to play again', C.canvasH / 2 + 55, UI.gold);
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, C.canvasW, C.canvasH);

    if (S.state === C.STATE_EXPLORING || S.state === C.STATE_PAUSED || S.state === C.STATE_GAME_OVER) {
      drawRoom();
      drawPlayer();
    }

    drawHUD();
  }

  Object.assign(NS.hud, { drawHUD, drawGame });
})();
