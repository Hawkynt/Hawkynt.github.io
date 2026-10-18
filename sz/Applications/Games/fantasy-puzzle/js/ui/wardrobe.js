/* The Wardrobe screen: robe preview and swatches. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { ROBES } = NS.consts;
  const { sfx, ctx, ui } = NS.context;
  const { selectRobe, robeRequirement } = NS.grimoire;
  const { drawMenuBackdrop, drawLock } = NS.widgets;
  const { registerHit, isHot } = NS.menu;

  function robeName(id) {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function drawWardrobe() {
    drawMenuBackdrop(0, 'rgba(4,6,14,0.62)');
    ui.drawHeadline('Wardrobe', 640, 46, 600, 40, '#ffd23f', '#c04cff');

    const robeIds = Object.keys(ROBES);
    const preview = robeIds[Math.max(0, Math.min(robeIds.length - 1, G.wardrobeCursor))];

    /* the mage, big, idling in a pool of his robe's own light */
    const gx = 330, gy = 470;
    ctx.save();
    const glow = 0.3 + 0.12 * Math.sin(G.time * 3);
    const g = ctx.createRadialGradient(gx, gy, 10, gx, gy, 170);
    g.addColorStop(0, ui.hexToRgba(ROBES[preview], glow));
    g.addColorStop(1, ui.hexToRgba(ROBES[preview], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 170, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(gx, gy - 24);
    ctx.scale(3, 3);
    SZ.PuzzleArt.drawHero(ctx, 0, 0, 'down', 'idle', G.time, ROBES[preview]);
    ctx.restore();

    /* right: the robe's name and what it takes to wear it */
    ui.drawPanel(560, 150, 680, 200, { accent: ROBES[preview] });
    ui.drawHeadline(robeName(preview) + ' Robe', 900, 196, 600, 30, ROBES[preview], ui.UI.gold);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (G.save.robe === preview) {
      ui.fitText('You are wearing this robe.', 900, 250, 600, 17, { color: ui.UI.good });
    } else if (G.save.robes.indexOf(preview) >= 0) {
      ui.fitText('In your wardrobe — Enter or click to wear it.', 900, 250, 600, 17, { color: ui.UI.text });
    } else {
      ui.fitText('Inscribe “' + robeRequirement(preview) + '” in the Grimoire to unlock.', 900, 250, 600, 17, { color: ui.UI.warn });
    }
    ui.drawKeyHints([
      { key: '←→', label: 'Select robe' },
      { key: 'Enter', label: 'Wear' },
      { key: 'Esc', label: 'Back' }
    ], 900, 310, 600, 1);

    /* bottom: the six swatches */
    for (let i = 0; i < robeIds.length; ++i) {
      const id = robeIds[i];
      const x = 40 + i * 202, y = 540, w = 190, h = 150;
      const owned = G.save.robes.indexOf(id) >= 0;
      const worn = G.save.robe === id;
      const hit = registerHit('robe-' + id, x, y, w, h, function() {
        G.wardrobeCursor = i;
        if (owned)
          selectRobe(id);
        else
          sfx('error', { volume: 0.4 });
      });
      const hot = isHot(hit, x, y, w, h);
      ctx.save();
      if (!owned)
        ctx.globalAlpha *= 0.6;
      ui.drawPanel(x, y, w, h, { radius: 9, accent: worn ? ui.UI.good : hot ? ui.UI.gold : ROBES[id], glow: worn || G.wardrobeCursor === i });
      ctx.save();
      ctx.translate(x + w / 2, y + 80);
      ctx.scale(1.3, 1.3);
      SZ.PuzzleArt.drawHero(ctx, 0, 0, 'down', 'idle', G.time, ROBES[id]);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(robeName(id), x + w / 2, y + 110, w - 20, 15, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
      let tag, tagColor;
      if (worn) { tag = 'Selected'; tagColor = ui.UI.good; }
      else if (owned) { tag = 'Enter to wear'; tagColor = ui.UI.textDim; }
      else { tag = 'Needs ' + robeRequirement(id); tagColor = ui.UI.warn; }
      ctx.fillStyle = tagColor;
      ctx.font = ui.uiFont(12, 'bold');
      ctx.fillText(tag, x + w / 2, y + 132);
      if (!owned)
        drawLock(x + w / 2, y + 40, 30);
      ctx.restore();
    }
  }

  NS.wardrobe = { drawWardrobe };
})();
