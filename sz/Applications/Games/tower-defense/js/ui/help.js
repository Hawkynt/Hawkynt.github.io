/* ui/help.js -- the help pages.
   Reads: constants, towerTypes, enemyTypes, env, pixelArt, text, widgets, towerArt, enemyArt, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx, audio } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { uiFont, fitText, drawTextBlock } = NS.text;
  const { UI, roundRectPath, drawPanel, drawKeyHints, drawScrim, uiButton } = NS.widgets;
  const { drawTowerIcon } = NS.towerArt;
  const { drawEnemyIcon } = NS.enemyArt;

  /* ── Help pages ── */
  const HELP_PAGES = [
    { title: 'Basics', body: [
      ['flag', 'Enemies march from the cave to your gatehouse. Every one that gets through costs a life (bosses cost five); lose them all and the map is lost.'],
      ['hammer', 'Choose a tower in the build bar (or press 1-0) and click a free tile beside the road. Spike traps go on the road itself. A green outline means you can build there.'],
      ['eye', 'The NEXT panel shows the enemies of the coming wave. Hover them to learn what counters them. Press Start (Space) when you are ready, or call a wave early (N) for bonus gold.'],
      ['coin', 'Defeated enemies drop gold and every cleared wave pays a bonus. Gold Mines dig up more.'],
      ['star', 'Hold a map\'s required waves to clear it: keep 50% of your lives for two stars, 90% for three. The waves never stop, though: stay to grind gold and research, or press Next level (L).'],
      ['loop', 'The campaign crosses six regions of four maps each, and further maps pay more gold and research. Moving on brings research, relics, unlocked towers and a quarter of your gold (up to 500); towers stay behind; your best wave per map is recorded.']
    ] },
    { title: 'Towers', towers: true },
    { title: 'Enemies', enemies: true },
    { title: 'Upgrades', body: [
      ['up', 'Select a tower to upgrade it (U). Tiers I-III make it stronger; at tier III pick one of two specializations (U or I) with very different strengths.'],
      ['crown', 'Tier V masters a specialization. It needs the matching Mastery from the research tree.'],
      ['target', 'Targeting (T): First hits the enemy closest to your gate, Last the newest one, Strong the toughest, Close the nearest.'],
      ['flask', 'Clearing waves, winning maps and earning new stars gives research. Spend it on the title screen or the campaign map to unlock towers and abilities and to train your army for good.'],
      ['bomb', 'Abilities (Q, W, E) are unlocked by research: Airstrike bombs the spot you click, Deep Freeze freezes the whole field, Gold Rush doubles kill gold.'],
      ['r_seal', 'Bosses drop rewards: the Slime King, Lich King and Dragon each unlock a tower that research cannot buy, and bosses may leave relics with permanent effects (most often the first time you beat each kind). See them with K.']
    ] },
    { title: 'Controls', keys: [
      ['1 - 0, ⇧1 - ⇧6', 'Choose a tower to build'], ['Click / Enter', 'Build or select'], ['Right click / Esc', 'Cancel'],
      ['Arrow keys', 'Move the build cursor'], ['U / I', 'Upgrade / pick a specialization'], ['T', 'Cycle targeting'],
      ['S / R', 'Sell / repair'], ['Space', 'Start the next wave'], ['N', 'Call the next wave early'],
      ['F, ⇧F, + / -', 'Faster / slower (1× to 20×)'], ['A', 'Auto-wave on/off'], ['Q / W / E', 'Abilities'],
      ['H', 'Help'], ['Esc', 'Pause menu'], ['F2', 'New game'], ['Touch', 'Tap to preview, tap again to build'], ['L', 'Next level (once cleared)'], ['K', 'Relics'], ['Any key / tap', 'Skip a cutscene'], ['PgUp / PgDn', 'Campaign: switch region pages']
    ] }
  ];
  function openHelp(page) {
    if (G.state === STATE_PLAYING)
      NS.actions.togglePause();
    G.overlay = 'help';
    G.helpPage = page || 0;
    audio.play('select');
  }

  function closeHelp() {
    G.overlay = null;
    audio.play('click', { pitch: 0.8 });
  }

  function drawHelp() {
    drawScrim(0.7);
    const pw = Math.min(720, G.UW - 32), ph = Math.min(500, G.UH - 32);
    const px = G.UW / 2 - pw / 2, py = G.UH / 2 - ph / 2;
    drawPanel(px, py, pw, ph, { title: 'How to play', titleRight: `${G.helpPage + 1} / ${HELP_PAGES.length}`, titleRightPad: 28, accent: UI.gold, radius: 12, headerH: 34 });
    uiButton('help-close', px + pw - 30, py + 7, 22, 20, '×', { px: 14, onClick: closeHelp, tip: () => ['Close', 'Esc'] });
    // Tabs
    const tabW = Math.min(150, (pw - 24 - (HELP_PAGES.length - 1) * 6) / HELP_PAGES.length);
    for (let i = 0; i < HELP_PAGES.length; ++i)
      uiButton('help-tab' + i, px + 12 + i * (tabW + 6), py + 42, tabW, 28, HELP_PAGES[i].title, { style: i === G.helpPage ? 'gold' : 'dark', px: 12, onClick: () => { G.helpPage = i; audio.play('click'); } });
    const cx = px + 16, cy = py + 82, cw = pw - 32, ch = ph - 82 - 40;
    const page = HELP_PAGES[G.helpPage];
    if (page.body) {
      const rowH = Math.min(62, ch / page.body.length);
      page.body.forEach(([icon, text], i) => {
        const y = cy + i * rowH;
        roundRectPath(cx, y + 2, 36, 36, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        drawIcon(icon, cx + 18, y + 20, 22);
        drawTextBlock(text, cx + 48, y, cw - 48, rowH - 6, 13, { color: UI.text, valign: 'middle' });
      });
    } else if (page.towers) {
      drawHelpGrid(cx, cy, cw, ch, TOWER_TYPES.map((def, i) => ({ draw: (x, y, s) => drawTowerIcon(i, 3, x, y, s), name: `${def.name} · ${def.cost} gold`, text: `${def.desc} Becomes ${def.branches[0].name} or ${def.branches[1].name}.` })));
    } else if (page.enemies) {
      drawHelpGrid(cx, cy, cw, ch, Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].unlock <= 1).map(k => ({ draw: (x, y, s) => drawEnemyIcon(k, x, y, s), name: ENEMY_TYPES[k].name, text: `${ENEMY_TYPES[k].info} Counter: ${ENEMY_TYPES[k].counter}.` })));
    } else if (page.keys) {
      const cols = cw > 520 ? 2 : 1;
      const perCol = Math.ceil(page.keys.length / cols);
      const colW = cw / cols;
      const rowH = Math.min(30, ch / perCol);
      page.keys.forEach(([key, label], i) => {
        const col = Math.floor(i / perCol), row = i % perCol;
        const x = cx + col * colW, y = cy + row * rowH;
        ctx.font = uiFont(11, 'bold');
        const kw = Math.min(colW * 0.45, Math.max(26, ctx.measureText(key).width + 12));
        roundRectPath(x, y + 3, kw, rowH - 8, 4);
        ctx.fillStyle = 'rgba(20,26,42,0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,90,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(key, x + kw / 2, y + rowH / 2 - 1, kw - 6, 11, { weight: 'bold', color: '#ffe9a8' });
        ctx.textAlign = 'left';
        fitText(label, x + kw + 10, y + rowH / 2, colW - kw - 18, 13, { color: UI.text });
      });
    }
    drawKeyHints([{ key: '←→', label: 'Page' }, { key: 'Esc', label: 'Close' }], G.UW / 2, py + ph - 18, pw - 40);
  }

  function drawHelpGrid(x, y, w, h, items) {
    const cols = w > 560 ? 3 : 2;
    const rowsN = Math.ceil(items.length / cols);
    const cellW = (w - (cols - 1) * 8) / cols;
    const cellH = Math.min(70, (h - (rowsN - 1) * 5) / rowsN);
    items.forEach((it, i) => {
      const cx = x + (i % cols) * (cellW + 8), cy = y + Math.floor(i / cols) * (cellH + 6);
      roundRectPath(cx, cy, cellW, cellH, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      const s = Math.min(cellH - 10, 40);
      it.draw(cx + 6 + s / 2, cy + cellH / 2, s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(it.name, cx + s + 14, cy + 13, cellW - s - 20, 13, { weight: 'bold', color: UI.gold });
      drawTextBlock(it.text, cx + s + 14, cy + 22, cellW - s - 20, cellH - 25, 11, { color: '#c4cde0' });
    });
  }

  NS.help = { HELP_PAGES, openHelp, closeHelp, drawHelp };

})();
