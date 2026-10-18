/* ui/screens.js -- title, pause and end screens.
   Reads: constants, maps, env, pixelArt, text, widgets, bossRewards, progress, savegame, researchScreen,
      relicsPanel, hud, mapSelect, help, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { clamp } = NS.constants;
  const { MAPS, nextMapOf } = NS.maps;
  const { ctx, waveTotalText } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { fitText } = NS.text;
  const { UI, drawPanel, drawKeyHints, drawHeadline, drawScrim, uiButton } = NS.widgets;
  const { RELICS } = NS.bossRewards;
  const { totalStars } = NS.progress;
  const { continueSavedGame, requestNewGame } = NS.savegame;
  const { openResearchFromMap, openResearch } = NS.researchScreen;
  const { openRelics } = NS.relicsPanel;
  const { nextLevelTooltip } = NS.hud;

  /* ══════════════════════════════════════════════════════════════════
     SCREENS -- title, pause, game over, victory, help
     ══════════════════════════════════════════════════════════════════ */

  function drawTitleScreen() {
    drawScrim(0.5);
    const cx = G.UW / 2;
    const top = Math.max(46, G.UH * 0.17);
    drawHeadline('TOWER DEFENSE', cx, top, G.UW - 60, 66, UI.gold, '#ff9a2a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('Hold the line. Build, upgrade, survive every wave.', cx, top + 46, G.UW - 80, 15, { color: '#c4cde0' });

    const pw = Math.min(380, G.UW - 40), ph = G.savedGameInfo ? 262 : 210;
    const px = cx - pw / 2, py = Math.min(top + 78, G.UH - ph - 60);
    drawPanel(px, py, pw, ph, { accent: UI.gold, radius: 12 });
    let y = py + 16;
    const bw = pw - 40;
    if (G.savedGameInfo) {
      const sm = MAPS[G.savedGameInfo.map];
      uiButton('title-continue', px + 20, y, bw, 52, 'Continue', { style: 'gold', icon: 'play', px: 17, key: 'Enter', sub: `${sm.name} · wave ${G.savedGameInfo.wave}`, onClick: () => continueSavedGame() });
      y += 60;
    }
    uiButton('title-campaign', px + 20, y, bw, G.savedGameInfo ? 42 : 52, 'Campaign', { style: G.savedGameInfo ? 'dark' : 'gold', icon: 'flag', px: G.savedGameInfo ? 15 : 17, key: G.savedGameInfo ? 'C' : 'Enter',
      sub: `${totalStars()} of ${MAPS.length * 3} stars`, onClick: () => NS.mapSelect.openMapSelect() });
    y += G.savedGameInfo ? 50 : 60;
    uiButton('title-research', px + 20, y, bw, 38, 'Research', { style: 'dark', icon: 'flask', px: 14, key: 'R', sub: `${G.meta.rp} research to spend`, onClick: () => openResearch(),
      tip: () => ['Research', 'Permanent upgrades: unlock towers, train them, grow your economy and defenses.', `★ ${G.meta.rp} research available`] });
    y += 44;
    uiButton('title-help', px + 20, y, bw, 36, 'How to play', { style: 'blue', icon: 'help', px: 13, key: 'H', onClick: () => NS.help.openHelp() });
    if (G.saveNotice) {
      ctx.textAlign = 'center';
      fitText(G.saveNotice, cx, py + ph + 18, G.UW - 40, 12, { color: UI.warn });
    }
    drawKeyHints(G.savedGameInfo
      ? [{ key: 'Enter', label: 'Continue' }, { key: 'C', label: 'Campaign' }, { key: 'R', label: 'Research' }, { key: 'H', label: 'Help' }]
      : [{ key: 'Enter', label: 'Campaign' }, { key: 'R', label: 'Research' }, { key: 'H', label: 'Help' }], cx, G.UH - 22, G.UW - 40);
  }

  function drawPauseScreen() {
    drawScrim(0.6);
    const pw = Math.min(320, G.UW - 40), ph = 350;
    const px = G.UW / 2 - pw / 2, py = G.UH / 2 - ph / 2;
    drawPanel(px, py, pw, ph, { title: 'Paused', titleRight: `${MAPS[G.currentMap].name} · wave ${G.currentWave}/${waveTotalText()}`, accent: UI.gold, radius: 12 });
    let y = py + 44;
    const bw = pw - 40;
    uiButton('p-resume', px + 20, y, bw, 42, 'Resume', { style: 'gold', icon: 'play', key: 'Esc', px: 15, onClick: NS.actions.togglePause });
    y += 50;
    uiButton('p-help', px + 20, y, bw, 36, 'Help', { style: 'blue', icon: 'help', key: 'H', onClick: () => NS.help.openHelp() });
    y += 44;
    uiButton('p-relics', px + 20, y, bw, 36, `Relics · ${(G.meta.relics || []).length}/${RELICS.length}`, { style: 'dark', icon: 'r_seal', key: 'K', onClick: openRelics });
    y += 44;
    uiButton('p-research', px + 20, y, bw, 36, `Research · ${G.meta.rp}`, { style: 'dark', icon: 'flask', key: 'R', onClick: openResearchFromMap, tip: () => ['Research', 'Spend research now; the map stays paused and the new research applies when you return.'] });
    y += 44;
    uiButton('p-restart', px + 20, y, bw, 36, 'Restart map', { style: 'dark', key: 'F2', onClick: () => requestNewGame(), tip: () => ['Restart', 'Starts this map again from wave 1.'] });
    y += 44;
    uiButton('p-title', px + 20, y, bw, 36, 'Main menu', { style: 'dark', key: 'M', onClick: NS.actions.quitToTitle, tip: () => ['Main menu', 'Your game is saved; Continue picks it up again.'] });
  }

  // The run is over: a defeat before the map was cleared, or the end of a stand after it
  function drawEndScreen() {
    drawScrim(0.62);
    const cx = G.UW / 2;
    const res = G.lastResult || { stars: 0, prevStars: 0, waves: 0, prevBest: 0 };
    const held = !!res.cleared;
    const hasNext = held && nextMapOf(G.currentMap) >= 0;
    const pw = Math.min(440, G.UW - 40), ph = held ? 330 : 296;
    const px = cx - pw / 2, py = clamp(G.UH / 2 - ph / 2 + 30, 80, G.UH - ph - 10);
    drawHeadline(held ? 'STAND ENDED' : 'DEFEAT', cx, py - 40, G.UW - 40, 58, held ? UI.gold : '#ff5a5a', held ? '#ff9a2a' : '#9a1a1a');
    drawPanel(px, py, pw, ph, { title: MAPS[G.currentMap].name, titleRight: held ? 'Map cleared' : `Fell at wave ${G.currentWave}`, accent: held ? UI.gold : UI.bad, radius: 12 });
    let y = py + 44;
    if (held) {
      NS.mapSelect.drawStars(G.meta.maps[G.currentMap].stars, cx, y + 12, 26);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(res.newBest ? `New record on this map: wave ${res.waves}!` : `Held to wave ${res.waves} · record ${Math.max(res.prevBest, res.waves)}`, cx, y + 38, pw - 40, 13, { weight: 'bold', color: res.newBest ? UI.gold : UI.text });
      y += 54;
    }
    const stats = [
      ['flag', 'Waves held', `${Math.max(0, G.currentWave - 1)} (goal ${G.totalWaves})`],
      ['skull', 'Enemies defeated', String(G.runStats.kills)],
      ['coin', 'Gold earned', String(G.runStats.gold)],
      ['heart', 'Lives left', `${G.lives} / ${G.runStartLives}`]
    ];
    for (const [icon, label, value] of stats) {
      drawIcon(icon, px + 30, y + 9, 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, px + 46, y + 10, pw * 0.5, 13, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(value, px + pw - 24, y + 10, pw * 0.4, 15, { weight: 'bold', color: '#ffffff' });
      y += 24;
    }
    drawIcon('flask', px + 30, y + 9, 16);
    ctx.textAlign = 'left';
    fitText('Research earned', px + 46, y + 10, pw * 0.5, 13, { color: '#c8a8ff' });
    ctx.textAlign = 'right';
    fitText(`+${G.lastRp}  (${G.meta.rp} to spend)`, px + pw - 24, y + 10, pw * 0.45, 15, { weight: 'bold', color: '#e0ccff' });
    y += 34;
    const bw = (pw - 52) / 2;
    if (hasNext) {
      uiButton('end-next', px + 20, y, bw, 44, 'Next level', { style: 'gold', icon: 'play', key: 'L', px: 14, onClick: NS.actions.goNextLevel, tip: nextLevelTooltip });
      uiButton('end-retry', px + 32 + bw, y, bw, 44, 'Try again', { style: 'dark', key: 'Enter', px: 14, onClick: NS.actions.resetAndStart });
    } else {
      uiButton('end-retry', px + 20, y, bw, 44, 'Try again', { style: 'gold', icon: 'play', key: 'Enter', px: 14, onClick: NS.actions.resetAndStart });
      uiButton('end-maps', px + 32 + bw, y, bw, 44, 'Campaign map', { style: 'dark', key: 'M', px: 13, onClick: NS.mapSelect.openMapSelect });
    }
    if (hasNext) {
      uiButton('end-maps', px + 20, y + 52, bw, 32, 'Campaign map', { style: 'dark', key: 'M', px: 12, onClick: NS.mapSelect.openMapSelect });
      uiButton('end-research', px + 32 + bw, y + 52, bw, 32, 'Research', { style: 'dark', icon: 'flask', key: 'T', px: 12, onClick: openResearch });
    } else
      uiButton('end-research', px + 20, y + 52, pw - 40, 32, `Research · ${G.meta.rp} to spend`, { style: 'dark', icon: 'flask', key: 'T', px: 12, onClick: openResearch });
  }

  NS.screens = { drawTitleScreen, drawPauseScreen, drawEndScreen };

})();
