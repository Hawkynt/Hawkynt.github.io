/* The four help pages. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T, ELEMENT_BY_ID } = NS.consts;
  const { ctx, ui } = NS.context;
  const { drawMenuBackdrop } = NS.widgets;

  const HELP_PAGES = ['Goal', 'Elements', 'Tiles', 'Controls'];
  const helpTiles = [];

  function drawHelp() {
    drawMenuBackdrop(1, 'rgba(4,6,14,0.78)');
    const pw = 900, ph = 520, px = 190, py = 100;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[G.helpPage], accent: ui.UI.accent, titlePx: 20 });

    if (G.helpPage === 0) {
      SZ.PuzzleArt.drawPortal(ctx, G.theme, 640, 200, G.time, true);
      const lines = [
        'Reach the glowing portal to complete the puzzle.',
        'Walk by clicking a tile you can reach; runes on the way are collected.',
        'Every cast costs one mana from the well — plan the fewest spells.',
        'Stars: one for solving, one for casts at or under par, one for every rune.'
      ];
      let y = 280;
      for (const line of lines) {
        ui.drawTextBlock(line, px + 60, y, pw - 120, 36, 18, { color: ui.UI.text, align: 'center', valign: 'middle' });
        y += 52;
      }
    } else if (G.helpPage === 1) {
      const info = [
        ['fire', 'Spreads through connected wood and melts ice into water.'],
        ['water', 'Floods connected channels, so you can walk across.'],
        ['earth', 'Fills chasms and raises a stone wall on the open floor you click; right-click or hold the press there to walk instead.'],
        ['air', 'Pushes a boulder from the side you point at; it slides until something stops it, and a boulder that falls into a chasm fills it.']
      ];
      let y = 166;
      for (const row of info) {
        SZ.PuzzleScene.drawElementIcon(ctx, row[0], 330, y + 34, 52, true);
        const el = ELEMENT_BY_ID[row[0]];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(el.name, 380, y + 12, 200, 20, { weight: 'bold', color: el.color });
        ui.drawTextBlock(row[1], 380, y + 28, 640, 62, 15, { color: ui.UI.textDim });
        y += 102;
      }
    } else if (G.helpPage === 2) {
      const samples = [
        [T.FLOOR, 'Floor'], [T.WALL, 'Wall'], [T.WOOD, 'Wood'], [T.CHANNEL, 'Channel'], [T.WATER, 'Water'],
        [T.BOULDER, 'Boulder'], [T.STONE, 'Stone'], [T.CHASM, 'Chasm'], [T.ICE, 'Ice'], [T.RUNE, 'Rune']
      ];
      for (let i = 0; i < samples.length; ++i) {
        const x = 252 + (i % 5) * 160, y = 186 + ((i / 5) | 0) * 160;
        /* each sample is a framed one-tile board in the in-game art */
        if (!helpTiles[i]) {
          helpTiles[i] = SZ.PuzzleBoard.create(0);
          helpTiles[i].update({ cols: 1, rows: 1, tiles: [samples[i][0]], scale: 2, id: 'help' + i, frame: false });
        }
        const hb = helpTiles[i];
        ctx.save();
        ctx.translate(x, y);
        hb.drawGround(ctx);
        hb.drawWater(ctx, G.time);
        if (samples[i][0] === T.RUNE)
          SZ.PuzzleArt.drawRuneGlow(ctx, 0, 32, 32, G.time, false);
        hb.drawUpper(ctx);
        hb.drawGlow(ctx, G.time);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(samples[i][1], x + 32, y + 84, 140, 14, { color: ui.UI.textDim });
      }
    } else {
      const lines = [
        ['Elements', '1-4 or Q / W / E'],
        ['Walk / cast', 'click or tap a tile'],
        ['Walk only', 'right-click, or hold the press'],
        ['Undo', 'Z'],
        ['Restart', 'R'],
        ['Hint', 'H'],
        ['Pause', 'Esc'],
        ['Title screen', 'F2']
      ];
      for (let i = 0; i < lines.length; ++i) {
        const y = 186 + i * 48;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(20, 'bold');
        ctx.fillText(lines[i][0], px + 90, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(18);
        ctx.fillText(lines[i][1], px + 340, y);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Page ' + (G.helpPage + 1) + ' / ' + HELP_PAGES.length, 640, py + ph - 26, 300, 13, { color: ui.UI.textMute });
    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Back' }
    ], 640, 694, 900, 1);
  }

  NS.help = { HELP_PAGES, drawHelp };
})();
