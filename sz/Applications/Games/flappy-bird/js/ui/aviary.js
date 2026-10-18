;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Aviary screen: the bird preview, its perk and the row of six birds. Owns G.aviaryIndex. */

  const { BIRD_DEFS } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const View = NS.view;
  const Shapes = NS.shapes;
  const Menu = NS.menu;

  function drawAviaryScreen() {
    ui.drawHeadline('Aviary', 640, 62, 500, 44, ui.UI.gold);
    const def = BIRD_DEFS[G.aviaryIndex];

    // glowing round pedestal with the big preview bird
    const px = 320, py = 400;
    const glow = ctx.createRadialGradient(px, py, 20, px, py, 150);
    glow.addColorStop(0, 'rgba(255,215,90,0.35)');
    glow.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,215,90,0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py + 84, 120, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,215,90,0.5)';
    ctx.stroke();
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: px,
      y: py - 6 + Math.sin(G.globalTime * 2) * 6,
      angle: 0,
      birdId: def.id,
      frame: G.globalTime * 10,
      scale: 4.5
    });

    // info panel
    const rx = 560, ry = 110, rw = 680, rh = 330;
    ui.drawPanel(rx, ry, rw, rh, { accent: ui.UI.gold });
    ui.drawHeadline(Prog.birdName(def.id), rx + rw / 2, ry + 62, rw - 80, 44, ui.UI.text);
    ui.drawTextBlock(def.perk, rx + 40, ry + 110, rw - 80, 60, 22, { color: ui.UI.textDim, valign: 'middle' });
    let status, statusColor;
    if (def.id === Prog.currentBird()) {
      status = 'Selected';
      statusColor = ui.UI.good;
    } else if (Prog.birdOwned(def.id)) {
      status = 'Owned — Enter to select';
      statusColor = ui.UI.text;
    } else if (!Prog.birdAvailable(def)) {
      status = 'Clear stage ' + def.unlock + ' to unlock';
      statusColor = ui.UI.warn;
    } else {
      status = 'Buy for ' + def.price;
      statusColor = ui.UI.gold;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(status, rx + rw / 2, ry + rh - 52, rw - 80, 24, { weight: 'bold', color: statusColor });

    // the six birds in a row along the bottom
    for (let i = 0; i < BIRD_DEFS.length; ++i) {
      const d = BIRD_DEFS[i];
      const cx = 140 + i * 170, cy = 556;
      const index = Menu.registerHit('bird' + i, cx, cy, 150, 120, () => { G.aviaryIndex = i; Prog.buyBird(d.id); }, false);
      const hot = Menu.isHot(index, cx, cy, 150, 120);
      if (hot)
        G.aviaryIndex = i;
      const owned = Prog.birdOwned(d.id);
      const avail = Prog.birdAvailable(d);
      const sel = d.id === Prog.currentBird();
      ctx.save();
      if (!avail)
        ctx.globalAlpha *= 0.55;
      ui.drawPanel(cx, cy, 150, 120, { radius: 8, noStuds: true, accent: sel ? ui.UI.good : (hot ? ui.UI.gold : ui.UI.accent), glow: hot });
      SZ.FlappyBirdArt.drawBird(ctx, { x: cx + 75, y: cy + 42, angle: 0, birdId: d.id, frame: G.globalTime * 8, scale: 1.6 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(Prog.birdName(d.id), cx + 75, cy + 82, 130, 15, { weight: 'bold', color: ui.UI.text });
      if (!avail) {
        Shapes.drawLock(cx + 75, cy + 104, 18);
      } else if (owned) {
        ui.fitText(sel ? 'Active' : 'Owned', cx + 75, cy + 104, 120, 12, { color: sel ? ui.UI.good : ui.UI.textDim });
      } else {
        ctx.textAlign = 'left';
        ui.fitText(String(d.price), cx + 68, cy + 104, 70, 14, { weight: 'bold', color: ui.UI.gold });
        View.sceneFor('meadow').drawCoin(ctx, cx + 52, cy + 104, G.globalTime);
      }
      if (i === G.aviaryIndex) {
        ui.roundRectPath(cx - 3, cy - 3, 156, 126, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Bird' },
      { key: 'Enter', label: 'Buy / Select' },
      { key: 'Esc', label: 'Back' }
    ], 640, 700, 900, 1);
  }

  Object.assign(NS.aviary, { drawAviaryScreen });
})();
