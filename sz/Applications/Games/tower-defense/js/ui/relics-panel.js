/* ui/relics-panel.js -- the relics overlay.
   Reads: constants, towerTypes, enemyTypes, env, pixelArt, artKit, text, widgets, research, bossRewards,
      towerArt, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING, hexToRgba } = NS.constants;
  const { TOWER_BY_ID } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx, audio } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { drawGlow } = NS.artKit;
  const { fitText } = NS.text;
  const { UI, roundRectPath, drawPanel, drawScrim, uiButton } = NS.widgets;
  const { techLevel } = NS.research;
  const { BOSS_UNLOCKS, RELICS, hasRelic } = NS.bossRewards;
  const { drawTowerIcon } = NS.towerArt;

  /* ══════════════════════════════════════════════════════════════════
     RELICS PANEL
     ══════════════════════════════════════════════════════════════════ */

  function openRelics() {
    if (G.state === STATE_PLAYING) NS.actions.togglePause();
    G.overlay = 'relics';
    audio.play('select');
  }

  function drawRelics() {
    drawScrim(0.72);
    const pw = Math.min(720, G.UW - 32), ph = Math.min(500, G.UH - 32);
    const px = G.UW / 2 - pw / 2, py = G.UH / 2 - ph / 2;
    const found = (G.meta.relics || []).length;
    drawPanel(px, py, pw, ph, { title: 'Relics & boss trophies', titleRight: `${found} / ${RELICS.length} relics`, titleRightPad: 28, accent: UI.gold, radius: 12, headerH: 34 });
    uiButton('relics-close', px + pw - 30, py + 7, 22, 20, '×', { px: 14, onClick: () => { G.overlay = null; audio.play('click', { pitch: 0.8 }); }, tip: () => ['Close', 'Esc'] });
    const cx = px + 14, cw = pw - 28;
    let y = py + 44;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Bosses sometimes drop relics (most often the first time you beat each kind). Their effects are permanent.', cx, y + 6, cw, 12, { color: UI.textDim });
    y += 20;
    const cols = cw > 560 ? 2 : 1;
    const rowsN = Math.ceil(RELICS.length / cols);
    const gap = 6;
    const trophyH = 74;
    const cellW = (cw - (cols - 1) * gap) / cols;
    const cellH = Math.min(52, (py + ph - 16 - trophyH - y - (rowsN - 1) * gap) / rowsN);
    RELICS.forEach((r, i) => {
      const x = cx + (i % cols) * (cellW + gap), yy = y + Math.floor(i / cols) * (cellH + gap);
      const own = hasRelic(r.id);
      roundRectPath(x, yy, cellW, cellH, 7);
      ctx.fillStyle = own ? hexToRgba(r.color, 0.14) : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = own ? hexToRgba(r.color, 0.6) : 'rgba(150,170,210,0.15)';
      ctx.stroke();
      const s = cellH - 12;
      roundRectPath(x + 5, yy + 5, s + 2, s + 2, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      if (own) {
        drawGlow(r.color, x + 6 + s / 2, yy + 6 + s / 2, s * 0.8, 0.25);
        drawIcon(r.icon, x + 6 + s / 2, yy + 6 + s / 2, s * 0.8);
      } else {
        ctx.textAlign = 'center';
        fitText('?', x + 6 + s / 2, yy + 6 + s / 2, s, s * 0.6, { weight: 'bold', color: UI.textMute });
      }
      ctx.textAlign = 'left';
      fitText(own ? r.name : 'Undiscovered relic', x + s + 16, yy + cellH * 0.32, cellW - s - 24, 13, { weight: 'bold', color: own ? '#ffffff' : UI.textMute });
      fitText(own ? r.desc : 'Defeat bosses to find it.', x + s + 16, yy + cellH * 0.7, cellW - s - 24, 11, { color: own ? '#c4cde0' : UI.textMute });
    });
    // Towers that only bosses can unlock
    const ty = py + ph - trophyH - 10;
    ctx.fillStyle = 'rgba(255,215,90,0.25)';
    ctx.fillRect(cx, ty - 4, cw, 1);
    ctx.textAlign = 'left';
    fitText('Towers won from bosses', cx, ty + 8, cw, 12, { weight: 'bold', color: UI.gold });
    const keys = Object.keys(BOSS_UNLOCKS);
    const tw = (cw - (keys.length - 1) * gap) / keys.length;
    keys.forEach((boss, i) => {
      const fam = BOSS_UNLOCKS[boss], def = TOWER_BY_ID[fam];
      const own = techLevel('unlock_' + fam) > 0;
      const x = cx + i * (tw + gap), yy = ty + 18;
      roundRectPath(x, yy, tw, trophyH - 22, 7);
      ctx.fillStyle = own ? hexToRgba(def.color, 0.14) : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.globalAlpha = own ? 1 : 0.35;
      drawTowerIcon(def.index, own ? 3 : 1, x + 26, yy + (trophyH - 22) / 2, trophyH - 30);
      ctx.globalAlpha = 1;
      if (!own) drawIcon('lock', x + 26, yy + (trophyH - 22) / 2, 16);
      ctx.textAlign = 'left';
      fitText(def.name, x + 50, yy + 14, tw - 56, 13, { weight: 'bold', color: own ? '#ffffff' : UI.textMute });
      fitText(own ? `Won from the ${ENEMY_TYPES[boss].name}` : `Defeat the ${ENEMY_TYPES[boss].name}`, x + 50, yy + 34, tw - 56, 11, { color: own ? UI.good : UI.textDim });
    });
  }

  NS.relicsPanel = { openRelics, drawRelics };

})();
