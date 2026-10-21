/* Full-screen overlays: the mode-select menu with field-size picker and mode
   cards, the game-over statistics screen and the pause overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawModeSelect() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, S.W, S.H);

    const time = performance.now() / 1000;
    const titleGlow = 15 + Math.sin(time * 1.5) * 10;

    /* Title */
    ctx.save();
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = titleGlow;
    ctx.font = NS.rules.scaledFont(44);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('ASTEROIDS', S.W / 2, 70 * S.uiS);
    ctx.restore();

    ctx.fillStyle = '#667';
    ctx.font = NS.rules.scaledFont(12, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Enhanced Edition', S.W / 2, 96 * S.uiS);

    /* Field size selector */
    const fieldY = 125 * S.uiS;
    ctx.fillStyle = '#889';
    ctx.font = NS.rules.scaledFont(11, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Field Size', S.W / 2, fieldY);

    const fLabel = C.FIELD_SIZES[S.fieldSizeKey].label + ' (' + C.FIELD_SIZES[S.fieldSizeKey].size + ')';
    ctx.fillStyle = '#88ccff';
    ctx.font = NS.rules.scaledFont(16);
    ctx.fillText('◀  ' + fLabel + '  ▶', S.W / 2, fieldY + 20 * S.uiS);

    /* Mode cards */
    const modes = [
      { key: 'classic', num: '1' },
      { key: 'survival', num: '2' },
      { key: 'zen', num: '3' },
      { key: 'hardcore', num: '4' }
    ];

    const cardH = 56 * S.uiS;
    const cardW = 280 * S.uiS;
    const startY = 170 * S.uiS;
    const gap = 12 * S.uiS;

    for (let i = 0; i < modes.length; ++i) {
      const m = modes[i];
      const modeCfg = T.MODE_CONFIGS[m.key];
      const y = startY + i * (cardH + gap);
      const x = (S.W - cardW) / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 6 * S.uiS);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#88ccff';
      ctx.font = NS.rules.scaledFont(22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.num, x + 24 * S.uiS, y + cardH / 2);

      ctx.fillStyle = '#fff';
      ctx.font = NS.rules.scaledFont(18);
      ctx.textAlign = 'left';
      ctx.fillText(modeCfg.label, x + 50 * S.uiS, y + cardH / 2 - 8 * S.uiS);

      ctx.fillStyle = '#889';
      ctx.font = NS.rules.scaledFont(12, 'normal');
      ctx.fillText(modeCfg.description, x + 50 * S.uiS, y + cardH / 2 + 12 * S.uiS);
    }

    const footerY = startY + modes.length * (cardH + gap) + 16 * S.uiS;
    ctx.fillStyle = '#556';
    ctx.font = NS.rules.scaledFont(11, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Click a mode or press 1–4 to start  ·  ◀ ▶ field size', S.W / 2, footerY);
    ctx.fillText('Mouse aims + clicks to shoot · Arrow keys/WASD + Space also work', S.W / 2, footerY + 16 * S.uiS);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, S.W, S.H);

    const time = performance.now() / 1000;
    const pulse = 0.7 + Math.sin(time * 2) * 0.3;

    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.font = NS.rules.scaledFont(32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgb(255,${Math.round(70 + pulse * 30)},${Math.round(70 + pulse * 30)})`;
    ctx.fillText('GAME OVER', S.W / 2, S.H / 2 - 80 * S.uiS);
    ctx.restore();

    ctx.font = NS.rules.scaledFont(20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Score: ' + S.score, S.W / 2, S.H / 2 - 40 * S.uiS);

    ctx.font = NS.rules.scaledFont(14, 'normal');
    ctx.fillStyle = '#aaa';
    ctx.fillText(NS.rules.modeConfig().label + ' Mode  ·  Level ' + S.level, S.W / 2, S.H / 2 - 15 * S.uiS);

    const statLines = [
      'Asteroids destroyed: ' + S.stats.asteroidsDestroyed,
      'Accuracy: ' + (S.stats.shotsFired > 0 ? Math.round(S.stats.shotsHit / S.stats.shotsFired * 100) : 0) + '%',
      'Max combo: ×' + Math.max(1, S.stats.maxCombo),
      'Powerups collected: ' + S.stats.powerupsCollected
    ];

    ctx.font = NS.rules.scaledFont(12, 'normal');
    ctx.fillStyle = '#888';
    for (let i = 0; i < statLines.length; ++i)
      ctx.fillText(statLines[i], S.W / 2, S.H / 2 + 15 * S.uiS + i * 18 * S.uiS);

    ctx.fillStyle = '#667';
    ctx.font = NS.rules.scaledFont(12, 'normal');
    ctx.fillText('Tap or press F2 for new game', S.W / 2, S.H / 2 + 110 * S.uiS);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, S.W, S.H);

    ctx.save();
    ctx.font = NS.rules.scaledFont(28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.fillText('PAUSED', S.W / 2, S.H / 2 - 10 * S.uiS);
    ctx.restore();

    ctx.fillStyle = '#888';
    ctx.font = NS.rules.scaledFont(14, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Press P to resume', S.W / 2, S.H / 2 + 20 * S.uiS);
  }

  Object.assign(NS.screens, { drawModeSelect, drawGameOver, drawPauseOverlay });
})();
