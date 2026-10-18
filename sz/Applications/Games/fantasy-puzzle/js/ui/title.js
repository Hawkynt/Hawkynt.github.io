/* The title screen: realm backdrop, floating island with the mage and orbiting elements, the main
   menu. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T, VIEW_W, VIEW_H, ELEMENTS, ROBES } = NS.consts;
  const { ctx, ui, Fx, fxMenu } = NS.context;
  const { buildTreeLayout, selectFirstInBranch } = NS.grimoire;
  const { campaignStarCount, solvedTrialCount, dailySub, loadDailyPuzzle } = NS.session;
  const { drawMenuBackdrop, drawShardsChip, drawMenuLight } = NS.widgets;
  const { drawButton } = NS.menu;
  const { setScreen, openHelp } = NS.screens;

  let titleBoard = null, titleBoardRealm = -1;
  const TITLE_ISLAND = [
    T.WOOD, T.FLOOR, T.BOULDER, T.FLOOR, T.ICE,
    T.FLOOR, T.FLOOR, T.FLOOR, T.RUNE, T.FLOOR,
    T.CHANNEL, T.WATER, T.WATER, T.FLOOR, T.GOAL
  ];

  function drawTitleScreen() {
    const realm = Math.floor(G.time / 12) % SZ.PuzzleLevels.REALMS.length;
    drawMenuBackdrop(realm, 'rgba(4,6,14,0.45)');
    drawMenuLight();
    fxMenu.update(G.frameDt);
    Fx.ambient(fxMenu, realm, VIEW_W, VIEW_H, G.frameDt);
    fxMenu.draw(ctx);

    ui.drawHeadline('Fantasy Puzzle', 640, 108, 1100, 96, '#ffd75a', '#b0389a');
    /* a glint sweeping over the title every few seconds */
    const sweep = (G.time % 4.5) / 1.2;
    if (sweep < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * Math.sin(sweep * Math.PI);
      ctx.drawImage(Fx.sprite('glow', '#fff0c0'), 250 + sweep * 780 - 60, 60, 120, 100);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Bend the elements. Open the way.', 640, 178, 800, 22, { color: '#d8c8a8', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.6)' });

    drawShardsChip(1256, 20);

    /* the mage on a floating island of the realm, the four elements orbiting him */
    if (!titleBoard || titleBoardRealm !== realm) {
      titleBoard = SZ.PuzzleBoard.create(realm);
      titleBoardRealm = realm;
    }
    titleBoard.update({ cols: 5, rows: 3, tiles: TITLE_ISLAND, scale: 1.25, id: 'title' });
    const float = Math.sin(G.time * 1.2) * 6;
    ctx.save();
    ctx.translate(150, 330 + float);
    ctx.scale(1.05, 1.05);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(SZ.PuzzleBoard.softDot('#000000', 64), -20, 230 - float, 360, 60);
    ctx.restore();
    titleBoard.drawGround(ctx);
    titleBoard.drawWater(ctx, G.time);
    SZ.PuzzleArt.drawRuneGlow(ctx, realm, 8 * 64 % 320 + 32, 96, G.time, false);
    titleBoard.drawUpper(ctx);
    titleBoard.drawGlow(ctx, G.time);
    ctx.save();
    ctx.translate(4 * 64 + 32, 2 * 64 + 32);
    ctx.scale(1, 0.86);
    ctx.rotate(G.time * 1.6);
    SZ.PuzzleArt.drawPortal(ctx, realm, 0, 0, G.time, true);
    ctx.restore();
    const hx = 2 * 64 + 32, hy = 64 + 32;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(SZ.PuzzleBoard.softDot('#000000', 64), hx - 22, hy + 8, 44, 18);
    ctx.restore();
    SZ.PuzzleArt.drawHero(ctx, hx, hy + Math.sin(G.time * 2.2) * 1.5, 'down', 'idle', G.time, ROBES[G.save.robe] || ROBES.violet);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 + 0.2 * Math.sin(G.time * 3);
    ctx.drawImage(Fx.sprite('glow', '#8ae0ff'), hx + 17 - 18, hy - 38 - 18, 36, 36);
    ctx.restore();
    for (let i = 0; i < ELEMENTS.length; ++i) {
      const a = G.time * 0.8 + i * Math.PI / 2;
      const ox = hx + Math.cos(a) * 120, oy = hy - 20 + Math.sin(a) * 44;
      const front = Math.sin(a) > 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = front ? 0.8 : 0.45;
      ctx.drawImage(Fx.sprite('glow', ELEMENTS[i].color), ox - 34, oy - 34, 68, 68);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = front ? 1 : 0.7;
      SZ.PuzzleScene.drawElementIcon(ctx, ELEMENTS[i].id, ox, oy, front ? 34 : 26, true);
      ctx.restore();
      if (Math.random() < 0.5)
        fxMenu.spawn({ kind: 'spark', color: ELEMENTS[i].color, x: 150 + ox * 1.05, y: 330 + float + oy * 1.05, vx: -Math.sin(a) * 20, vy: Math.cos(a) * 10, life: 0.6, size: 8, size1: 1 });
    }
    ctx.restore();

    const items = [
      { id: 't-campaign', label: 'Campaign', sub: campaignStarCount() + ' / 120 stars', action: function() { setScreen('realms'); } },
      { id: 't-daily', label: 'Daily Puzzle', sub: dailySub(), action: loadDailyPuzzle },
      { id: 't-trials', label: 'Trials', sub: solvedTrialCount() + ' / 60', action: function() { setScreen('trials'); } },
      { id: 't-grimoire', label: 'Grimoire', sub: G.save.shards + ' shards', action: function() { G.prevScreen = 'title'; G.treeLayout = buildTreeLayout(); selectFirstInBranch(); setScreen('grimoire'); } },
      { id: 't-wardrobe', label: 'Wardrobe', action: function() { G.prevScreen = 'title'; G.wardrobeCursor = Math.max(0, Object.keys(ROBES).indexOf(G.save.robe)); setScreen('wardrobe'); } },
      { id: 't-help', label: 'Help', action: openHelp }
    ];
    for (let i = 0; i < items.length; ++i)
      drawButton(items[i].id, items[i].label, 760, 248 + i * 64, 360, 54, { sub: items[i].sub, action: items[i].action });

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' }
    ], 640, 694, 900, 1);
  }

  NS.title = { drawTitleScreen };
})();
