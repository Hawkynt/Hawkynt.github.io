/* ui/hud.js -- top bar (lives, gold, wave, next wave, speeds), next-level button and boss bar.
   Owns state: G.shownGold, G.goldPulse, G.livesPulse, G.overlay, G.helpPage
   Reads: constants, enemyTypes, maps, env, pixelArt, text, widgets, effects, enemyArt, waves, simulation,
      researchScreen, help, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_BUILD, STATE_GAME_OVER, AUTO_WAVE_DELAY, TOP_H, BOT_H } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { BIOMES, MAPS, nextMapOf } = NS.maps;
  const { ctx, audio } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { fitText } = NS.text;
  const { UI, roundRectPath, drawPanel, drawMeter, addRegion, uiButton, beginHudPanel, endHudPanel } = NS.widgets;
  const { goldHudPos } = NS.effects;
  const { drawEnemyIcon } = NS.enemyArt;
  const { isBossWave, nextWavePreview, mapBountyMul, mapResearchMul, startNextWave, canCallEarly, waveHpScale } = NS.waves;
  const { GAME_SPEEDS } = NS.simulation;
  const { openResearchFromMap } = NS.researchScreen;

  const kbCursor = { col: 12, row: 8, active: false };

  function hudPanel(id, x, y, w, h, accent) {
    beginHudPanel(id, x, y, w, h);
    drawPanel(x, y, w, h, { accent, noStuds: true, radius: 8 });
  }

  function speedButtons(x, y, h) {
    const speeds = GAME_SPEEDS;
    const bw = 30;
    for (let i = 0; i < speeds.length; ++i) {
      const s = speeds[i];
      uiButton('speed' + s, x + i * (bw + 3), y, bw, h, s + '×', {
        style: G.gameSpeed === s ? 'gold' : 'dark', px: s >= 10 ? 11 : 12,
        onClick: () => NS.actions.setGameSpeed(s),
        tip: () => [`Game speed ${s}×`, s === 1 ? 'Normal speed' : `Everything runs ${s} times as fast`, '• F / + faster, Shift+F / - slower']
      });
    }
    return speeds.length * (bw + 3) - 3;
  }

  function drawTopBar() {
    const y = 6, h = TOP_H - 12;
    let x = 8;

    // Lives
    const lw = 88;
    hudPanel('lives', x, y, lw, h, UI.bad);
    drawIcon('heart', x + 21, y + h / 2, 22 * (1 + G.livesPulse * 0.35));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(String(G.lives), x + 37, y + h / 2 + 1, lw - 44, 21, { weight: 'bold', color: G.lives <= 5 ? UI.bad : '#ffffff' });
    endHudPanel();
    addRegion({ id: 'hud-lives', x, y, w: lw, h, tip: () => ['Lives', `${G.lives} of ${G.runStartLives} left`, 'Every enemy that reaches the exit costs a life (bosses cost more).'] });
    x += lw + 6;

    // Gold
    const gw = 112;
    hudPanel('gold', x, y, gw, h, UI.gold);
    drawIcon('coin', x + 21, y + h / 2, 22 * (1 + G.goldPulse * 0.3));
    ctx.textAlign = 'left';
    fitText(String(Math.round(G.shownGold)), x + 37, y + h / 2 + 1, gw - 44, 21, { weight: 'bold', color: G.goldPulse > 0.05 ? '#fff5c0' : UI.gold });
    endHudPanel();
    addRegion({ id: 'hud-gold', x, y, w: gw, h, tip: () => ['Gold', `${G.gold} gold`, 'Earned by defeating enemies and clearing waves.', 'Spend it on towers and upgrades.'] });
    goldHudPos.x = x + 21;
    goldHudPos.y = y + h / 2;
    x += gw + 6;

    // Wave
    const ww = 150;
    hudPanel('wave', x, y, ww, h, UI.accent);
    drawIcon('flag', x + 19, y + h / 2, 20);
    ctx.textAlign = 'left';
    fitText('WAVE', x + 34, y + 12, 50, 9, { weight: 'bold', color: UI.textDim });
    fitText(G.cleared ? `${G.currentWave} ✓` : `${G.currentWave} / ${G.totalWaves}`, x + 34, y + 27, ww - 42, 16, { weight: 'bold', color: G.cleared ? UI.gold : '#ffffff' });
    const left = G.waveEnemies.length + G.enemies.length;
    const prog = G.state === STATE_PLAYING && G.waveSize > 0 ? 1 - left / G.waveSize : 0;
    drawMeter(x + 92, y + h / 2 - 4, ww - 102, 8, G.state === STATE_PLAYING ? prog : Math.min(1, G.currentWave / G.totalWaves), G.state === STATE_PLAYING ? UI.warn : G.cleared ? UI.gold : UI.accent);
    endHudPanel();
    addRegion({ id: 'hud-wave', x, y, w: ww, h, tip: () => {
      const lines = [`Wave ${G.currentWave}`, G.cleared ? `Map cleared: you held the ${G.totalWaves} required waves.` : `Hold ${G.totalWaves} waves to clear the map (${Math.max(0, G.totalWaves - G.currentWave)} to go).`];
      if (G.state === STATE_PLAYING) lines.push(`${left} enemies left in this wave`);
      if (G.cleared) lines.push('• Waves keep coming and growing; each one now pays research.');
      lines.push(`★ Best on this map: wave ${G.meta.maps[G.currentMap].best}`);
      return lines;
    } });
    x += ww + 6;

    // Right group: speed, auto, help, pause
    const bh = h - 8, by = y + 4;
    const rightW = GAME_SPEEDS.length * 33 - 3 + 6 + 56 + 6 + 60 + 6 + 34 + 4 + 34;
    let rx = G.UW - 8 - rightW;
    hudPanel('controls', rx - 6, y, rightW + 12, h, '#6a8ac8');
    rx += speedButtons(rx, by, bh) + 6;
    uiButton('auto', rx, by, 56, bh, 'AUTO', {
      style: G.autoWaveMode ? 'blue' : 'dark', px: 11, icon: 'loop',
      onClick: NS.actions.toggleAutoWave,
      tip: () => ['Auto-wave ' + (G.autoWaveMode ? 'on' : 'off'), `Starts the next wave ${AUTO_WAVE_DELAY === 1 ? "one second" : AUTO_WAVE_DELAY + " seconds"} after a wave is cleared.`, '• A toggles']
    });
    rx += 62;
    uiButton('hud-research', rx, by, 60, bh, String(G.meta.rp), {
      style: 'dark', px: 11, icon: 'flask',
      onClick: openResearchFromMap,
      tip: () => ['Research', `${G.meta.rp} research to spend`, 'Pauses the map and opens the research tree.', '• Shift+R opens research']
    });
    rx += 66;
    uiButton('help', rx, by, 34, bh, '', { icon: 'help', px: 14, onClick: () => NS.help.openHelp(), tip: () => ['Help', 'How to play, towers, enemies and controls', '• H opens the help'] });
    rx += 38;
    uiButton('pause', rx, by, 34, bh, '', { icon: 'pause', px: 14, onClick: NS.actions.togglePause, tip: () => ['Pause', 'Pause menu', '• Esc pauses'] });
    endHudPanel();

    // Next wave panel fills the middle
    const nx = x, nw = G.UW - 8 - rightW - 12 - x - 6;
    if (nw > 120)
      drawNextWavePanel(nx, y, nw, h);
  }

  function drawNextWavePanel(x, y, w, h) {
    hudPanel('next', x, y, w, h, UI.warn);
    const bw = Math.min(150, w * 0.42);
    const bx = x + w - bw - 5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const nextNo = G.currentWave + 1;
    const boss = isBossWave(nextNo, G.totalWaves);
    const labelW = 62;
    fitText('NEXT', x + 10, y + 12, labelW - 8, 9, { weight: 'bold', color: UI.textDim });
    fitText(nextNo === G.totalWaves ? 'Goal!' : `Wave ${nextNo}`, x + 10, y + 27, labelW - 6, 13, { weight: 'bold', color: boss ? UI.bad : nextNo === G.totalWaves ? UI.gold : '#ffffff' });
    // Enemy icons with counts
    const list = nextWavePreview();
    const ix = x + labelW + 4, iw = bx - ix - 6;
    const cell = Math.min(46, iw / Math.max(1, list.length));
    for (let i = 0; i < list.length; ++i) {
      const row = list[i];
      const cx = ix + i * cell;
      if (cx + cell > ix + iw + 1) break;
      const def = ENEMY_TYPES[row.type];
      roundRectPath(cx + 1, y + 4, cell - 2, h - 8, 6);
      ctx.fillStyle = def.boss ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.fill();
      drawEnemyIcon(row.type, cx + cell / 2, y + h / 2 - 5, Math.min(cell - 10, 20));
      if (row.elite)
        drawIcon('crown', cx + cell - 8, y + 9, 9);
      ctx.textAlign = 'center';
      fitText(`×${row.count}`, cx + cell / 2, y + h - 9, cell - 4, 10, { weight: 'bold', color: def.boss ? UI.bad : UI.text });
      addRegion({ id: 'preview-' + row.type, x: cx, y, w: cell, h, anchorTip: true, tip: () => enemyTypeTooltip(row) });
    }
    ctx.textAlign = 'left';
    if (G.state === STATE_BUILD) {
      const autoIn = G.autoWaveMode && G.waveComplete && G.autoWaveTimer > 0 ? `in ${Math.ceil(G.autoWaveTimer)}s` : null;
      uiButton('startwave', bx, y + 4, bw, h - 8, 'Start', {
        style: 'gold', icon: 'play', px: 13, key: 'Space', sub: autoIn,
        onClick: () => startNextWave(),
        tip: () => [`Start wave ${nextNo}`, 'Send the next wave now.', boss ? '⚠ A boss is coming' : '• Enemies listed on the left']
      });
    } else {
      const bonus = 8 + G.currentWave * 2;
      uiButton('startwave', bx, y + 4, bw, h - 8, 'Call early', {
        style: 'green', icon: 'play', px: 12, key: 'N', sub: `+${bonus} gold`, disabled: !canCallEarly(),
        onClick: () => startNextWave(), onDisabled: () => audio.play('error'),
        tip: () => ['Call the next wave early', canCallEarly() ? `Sends wave ${nextNo} right away for ${bonus} bonus gold.` : 'Possible once the current wave is fully on the field.', '• N calls early']
      });
    }
    endHudPanel();
  }

  /* ── Next level: offered once the map is cleared ── */
  function carryGold() {
    return Math.floor(Math.min(G.gold, 2000) * 0.25);
  }

  function nextLevelAvailable() {
    return G.cleared && nextMapOf(G.currentMap) >= 0 && (G.state === STATE_BUILD || G.state === STATE_PLAYING || G.state === STATE_GAME_OVER);
  }

  function nextLevelGains() {
    const n = nextMapOf(G.currentMap);
    const b = Math.round((mapBountyMul(n) / mapBountyMul(G.currentMap) - 1) * 100);
    const r = Math.round((mapResearchMul(n) / mapResearchMul(G.currentMap) - 1) * 100);
    return { bounty: b, research: r, carry: carryGold() };
  }

  function nextLevelTooltip() {
    const n = MAPS[nextMapOf(G.currentMap)], g = nextLevelGains();
    return [`Next level: ${n.name}`, BIOMES[n.biome].name + ' · ' + n.waves + ' waves to clear',
      '--- Moving on ---',
      `✔ +${g.bounty}% gold per kill, +${g.research}% research per wave`,
      `✔ Brings ${g.carry} gold along (a quarter of what you hold, up to 500)`,
      '✔ Research, relics and unlocked towers always come with you',
      '⚠ Towers stay behind: you build anew on the next map',
      '• Staying here keeps the waves coming, but they grow fast', '• Key L'];
  }

  function drawNextLevelButton() {
    if (!nextLevelAvailable() || G.state === STATE_GAME_OVER) return;
    const n = MAPS[nextMapOf(G.currentMap)], g = nextLevelGains();
    const w = Math.min(340, G.UW - 40), h = 44;
    const x = G.UW / 2 - w / 2, y = G.UH - BOT_H - h - 8;
    beginHudPanel('nextlevel', x, y, w, h);
    const glow = 0.35 + 0.25 * Math.sin(G.animTime * 3);
    roundRectPath(x - 3, y - 3, w + 6, h + 6, 12);
    ctx.strokeStyle = `rgba(255,215,90,${glow})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    uiButton('next-level', x, y, w, h, `Next level: ${n.name}`, {
      style: 'gold', icon: 'play', px: 14, key: 'L',
      sub: `+${g.bounty}% gold · +${g.research}% research · carry ${g.carry} gold`,
      onClick: NS.actions.goNextLevel, tip: nextLevelTooltip
    });
    endHudPanel();
  }

  function enemyTypeTooltip(row) {
    const def = ENEMY_TYPES[row.type];
    const hp = Math.round(def.hp * waveHpScale(G.currentWave + 1));
    const lines = [`${def.name}  ×${row.count}`, def.info];
    lines.push(`[[heart]] ~${hp} health   Speed ${def.speed}${def.armor ? `   [[shield]] Armor ${def.armor}` : ''}`);
    if (row.elite) lines.push(`⚠ ${row.elite} elite (crowned): twice the health, hurries its neighbours`);
    if (def.boss) lines.push(`⚠ Costs ${def.lives} lives if it gets through`);
    lines.push(`✔ Counter: ${def.counter}`);
    return lines;
  }

  // Boss health bar under the top bar while a boss is on the field
  function drawBossBar() {
    let boss = null;
    for (const e of G.enemies)
      if (e.hp > 0 && ENEMY_TYPES[e.type].boss && (!boss || e.maxHp > boss.maxHp))
        boss = e;
    if (!boss) return;
    const def = ENEMY_TYPES[boss.type];
    const w = Math.min(360, G.UW * 0.4), h = 34;
    const x = G.UW / 2 - w / 2, y = TOP_H + 2;
    hudPanel('bossbar', x, y, w, h, UI.bad);
    drawIcon('skull', x + 18, y + h / 2, 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(def.name + (boss.enraged ? ' · enraged' : ''), x + 32, y + 11, w * 0.5, 11, { weight: 'bold', color: boss.enraged ? UI.bad : '#ffffff' });
    const mx = x + 32, mw = w - 44;
    drawMeter(mx, y + 19, mw, 9, boss.hp / boss.maxHp, boss.enraged ? '#ff3a3a' : '#d84ad8');
    if (boss.shieldHp > 0)
      drawMeter(mx, y + 19, mw * Math.min(1, boss.shieldHp / boss.maxHp), 4, 1, '#5ad8ff', { track: 'rgba(0,0,0,0)' });
    ctx.textAlign = 'right';
    fitText(`${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`, x + w - 12, y + 11, w * 0.4, 10, { weight: 'bold', color: UI.textDim });
    endHudPanel();
  }

  NS.hud = { kbCursor, drawTopBar, carryGold, nextLevelAvailable, nextLevelTooltip, drawNextLevelButton,
      drawBossBar };

})();
