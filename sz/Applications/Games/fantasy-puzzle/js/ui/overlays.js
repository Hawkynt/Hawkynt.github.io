/* In-level overlays: pause, level complete, out of mana and the realm-restored banner. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, REALM_BANNER_TIME, STATE_PLAYING, STATE_PAUSED, STATE_LEVEL_COMPLETE, STATE_OUT_OF_MANA } = NS.consts;
  const { sfx, ctx, ui, screenShake, Fx, fxScreen } = NS.context;
  const { openGrimoireFromLevel } = NS.grimoire;
  const { restartLevel, nextLevel, goLevels } = NS.session;
  const { undoCast } = NS.casting;
  const { starSprite, raySprite } = NS.sprites;
  const { fillVeil, easeOutBack, drawCrystal } = NS.widgets;
  const { drawHUD } = NS.hud;
  const { drawButton } = NS.menu;

  function drawPauseOverlay() {
    fillVeil('rgba(4,6,14,0.6)');
    const pw = 420, ph = 386;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 10;
    ui.drawPanel(px, py, pw, ph, { title: 'PAUSED', accent: ui.UI.gold, glow: true });
    drawButton('p-resume', 'Resume', px + 40, py + 62, pw - 80, 48, { key: 'Esc', action: function() { G.state = STATE_PLAYING; } });
    drawButton('p-grimoire', 'Grimoire (' + G.save.shards + ' shards)', px + 40, py + 118, pw - 80, 48, { key: 'G', action: openGrimoireFromLevel });
    drawButton('p-restart', 'Restart', px + 40, py + 174, pw - 80, 48, { key: 'R', action: restartLevel });
    drawButton('p-levels', 'Levels', px + 40, py + 230, pw - 80, 48, { key: 'L', action: goLevels });
    drawButton('p-title', 'Title', px + 40, py + 286, pw - 80, 48, { key: 'T', action: function() { NS.screens.setScreen('title'); } });
  }

  function drawLevelCompletePanel() {
    const elapsed = G.panelAnim ? G.time - G.panelAnim.at : 99;
    const intro = Math.min(1, elapsed / 0.45);
    fillVeil('rgba(4,4,12,' + (0.62 * Math.min(1, elapsed / 0.3)).toFixed(3) + ')');
    const pw = 600, ph = 360;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 + 6;
    const sc = 0.6 + 0.4 * easeOutBack(intro);
    ctx.save();
    ctx.globalAlpha = Math.min(1, intro * 2);
    ctx.translate(VIEW_W / 2, py + ph / 2);
    ctx.scale(sc, sc);
    ctx.translate(-VIEW_W / 2, -(py + ph / 2));

    /* the ray burst turns slowly behind the stars */
    const starsY = py + 132;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.32 * Math.min(1, elapsed / 0.8);
    ctx.translate(VIEW_W / 2, starsY);
    ctx.rotate(G.time * 0.25);
    ctx.drawImage(raySprite(), -330, -330, 660, 660);
    ctx.restore();

    ui.drawPanel(px, py, pw, ph, { accent: ui.UI.gold, top: 'rgba(42,30,70,0.95)', bottom: 'rgba(12,8,26,0.97)' });
    /* ribbon headline over the top edge */
    ui.drawHeadline('Level Complete', VIEW_W / 2, py - 2, 520, 46, '#ffd75a', '#c46a10');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(G.level.name, VIEW_W / 2, py + 48, pw - 60, 20, { weight: 'bold', color: '#e8dcc0', font: ui.TITLE_FONT });

    const stars = 1
      + (G.casts <= G.level.par ? 1 : 0)
      + (SZ.PuzzleCore.isPerfect(G.puzzle) ? 1 : 0);
    const reasons = ['Solved', 'Casts ≤ par', 'All runes'];
    for (let i = 0; i < 3; ++i) {
      const cx = VIEW_W / 2 + (i - 1) * 150;
      const cy = starsY + (i === 1 ? -10 : 6);
      const size = i === 1 ? 96 : 80;
      const earned = i < stars;
      /* the earned stars slam in one after another, each with a burst */
      const appearAt = 0.45 + i * 0.32;
      const popped = !earned || !G.panelAnim || elapsed >= appearAt;
      if (popped && earned && G.panelAnim && !G.panelAnim.starPlayed[i]) {
        G.panelAnim.starPlayed[i] = true;
        sfx('coin', { pitch: 1 + i * 0.2 });
        Fx.starBurst(fxScreen, cx, cy);
        screenShake.trigger(3, 120);
      }
      ctx.drawImage(starSprite(false), cx - size / 2, cy - size / 2, size, size);
      if (earned && popped) {
        let s = 1;
        if (G.panelAnim) {
          const k = Math.min(1, (elapsed - appearAt) / 0.32);
          s = k < 1 ? 2.2 - 1.2 * easeOutBack(k) : 1 + 0.04 * Math.sin(G.time * 3 + i);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.5 + 0.15 * Math.sin(G.time * 3 + i);
        ctx.drawImage(Fx.sprite('glow', '#ffc84a'), cx - size, cy - size, size * 2, size * 2);
        ctx.restore();
        ctx.drawImage(starSprite(true), cx - size * s / 2, cy - size * s / 2, size * s, size * s);
      }
      ui.fitText(reasons[i], cx, py + 196, 140, 13, { weight: 'bold', color: earned && popped ? ui.UI.gold : ui.UI.textMute });
    }

    ui.drawTextBlock(`Casts ${G.casts} / par ${G.level.par}    ·    Runes ${G.puzzle.runes.size} / ${SZ.PuzzleCore.totalRunes(G.puzzle)}`,
      px + 30, py + 216, pw - 60, 28, 16, { color: '#c8bce0', align: 'center', valign: 'middle' });
    if (G.lastShardGain > 0) {
      /* the shards count up once the stars have landed */
      const shown = G.panelAnim
        ? Math.max(0, Math.min(G.lastShardGain, Math.round(G.lastShardGain * (elapsed - 1.5) / 0.6)))
        : G.lastShardGain;
      drawCrystal(VIEW_W / 2 - 92, py + 254, 8, '#8fd0ff');
      ui.drawTextBlock(`+${shown} arcane shards`, px + 30, py + 242, pw - 60, 24, 16, { color: '#8fd0ff', align: 'center', valign: 'middle', weight: 'bold' });
    }

    const by = py + ph - 66;
    drawButton('c-next', 'Next', px + 40, by, 150, 46, { key: 'Enter', action: nextLevel });
    drawButton('c-replay', 'Replay', px + pw / 2 - 75, by, 150, 46, { key: 'R', action: restartLevel });
    drawButton('c-levels', 'Levels', px + pw - 190, by, 150, 46, { key: 'Esc', action: goLevels });
    ctx.restore();
  }

  function drawOutOfManaPanel() {
    fillVeil('rgba(4,6,14,0.55)');
    const pw = 520, ph = 210;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 12;
    ui.drawPanel(px, py, pw, ph, { title: 'OUT OF MANA', accent: ui.UI.bad });
    ui.drawTextBlock('The well is dry. Undo a cast to win some mana back, deepen your well in the Grimoire (G), or start the puzzle over.',
      px + 26, py + 48, pw - 52, 70, 15, { color: ui.UI.textDim, align: 'center', valign: 'middle' });
    const by = py + ph - 62;
    drawButton('m-undo', 'Undo', px + 26, by, 140, 42, { key: 'Z', action: undoCast });
    drawButton('m-replay', 'Restart', px + pw / 2 - 70, by, 140, 42, { key: 'R', action: restartLevel });
    drawButton('m-levels', 'Levels', px + pw - 166, by, 140, 42, { key: 'Esc', action: goLevels });
  }

  function drawOverlays() {
    G.hitAreas.length = 0;
    drawHUD();
    if (G.state === STATE_PAUSED)
      drawPauseOverlay();
    else if (G.state === STATE_LEVEL_COMPLETE)
      drawLevelCompletePanel();
    else if (G.state === STATE_OUT_OF_MANA)
      drawOutOfManaPanel();
    if (G.realmBanner) {
      const b = G.realmBanner;
      const alpha = Math.max(0, Math.min(1, b.t * 4, (REALM_BANNER_TIME - b.t) / 0.5));
      const realm = SZ.PuzzleLevels.REALMS[b.realm];
      fillVeil(ui.hexToRgba(realm.color, 0.16 * alpha));
      ctx.save();
      ctx.globalAlpha = alpha;
      ui.drawHeadline(realm.name + ' Restored!', 640, 296, 1000, 64, realm.color, ui.UI.gold);
      ctx.restore();
    }
  }

  NS.overlays = { drawOverlays };
})();
