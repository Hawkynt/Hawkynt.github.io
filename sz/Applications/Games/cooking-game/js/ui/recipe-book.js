;(function() {
  'use strict';

  /* The recipe book: twelve pinned paper cards; recipes of venues not yet
     reached stay silhouettes. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_TITLE } = NS.C;
  const { ctx, ui } = NS.view;
  const { recipeReached } = NS.persist;
  const { setScreen, drawButton, drawMenuBackdrop } = NS.menu;

  function drawRecipeBook() {
    drawMenuBackdrop('sushi', 0.6);
    ui.drawHeadline('Recipe Book', 640, 44, 600, 50, '#ffd23f', '#ff6a1a');

    const CW = 296, CH = 168, GX = 16, GY = 14;
    for (let i = 0; i < SZ.KitchenData.RECIPES.length; ++i) {
      const r = SZ.KitchenData.RECIPES[i];
      const cx = 24 + (i % 4) * (CW + GX), cy = 92 + Math.floor(i / 4) * (CH + GY);
      const reached = recipeReached(r.id);
      const hot = reached && G.mouseX >= cx && G.mouseX <= cx + CW && G.mouseY >= cy && G.mouseY <= cy + CH;
      const tilt = ((i * 7) % 5 - 2) * 0.004;
      ctx.save();
      ctx.translate(cx + CW / 2, cy + CH / 2);
      ctx.rotate(tilt);
      if (hot) ctx.scale(1.03, 1.03);
      ctx.translate(-(cx + CW / 2), -(cy + CH / 2));
      ui.drawPanel(cx, cy, CW, CH, { style: 'paper', radius: 6, accent: reached ? '#d8402a' : '#9a8a78', bottom: reached ? undefined : '#d8ccb4' });
      /* a pin at the top */
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(cx + CW / 2 + 1.5, cy + 10, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = reached ? '#d8302a' : '#7a6a5a';
      ctx.beginPath();
      ctx.arc(cx + CW / 2, cy + 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(cx + CW / 2 - 2, cy + 6, 2, 0, Math.PI * 2);
      ctx.fill();

      if (reached) ui.drawGlow(cx + 64, cy + 72, 150, '#ffe8b0');
      SZ.FoodArt.drawDish(ctx, r.id, cx + 64, cy + 72, 104, reached ? 1 : 0.12, 'good');
      if (!reached) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText('?', cx + 64, cy + 70, 60, 46, { weight: '900', color: '#7a6a5a' });
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(reached ? r.name : 'Not reached yet', cx + 124, cy + 34, CW - 140, 21, { weight: 'bold', color: reached ? ui.UI.ink : ui.UI.inkDim });
      ui.fitText(reached ? '$' + r.price + ' per dish' : 'Serve it to unlock', cx + 124, cy + 58, CW - 140, 14, { weight: 'bold', color: reached ? '#b8641a' : ui.UI.inkDim });

      for (let j = 0; j < r.steps.length; ++j) {
        if (j > 0) {
          ctx.fillStyle = 'rgba(90,60,30,0.6)';
          ctx.font = ui.uiFont(16, 'bold');
          ctx.textAlign = 'center';
          ctx.fillText('›', cx + 122 + j * 36, cy + 90);
        }
        ui.roundRectPath(cx + 124 + j * 36 - 15, cy + 74, 30, 30, 7);
        ctx.fillStyle = 'rgba(120,80,30,0.12)';
        ctx.fill();
        SZ.FoodArt.drawStepIcon(ctx, r.steps[j].station, cx + 124 + j * 36, cy + 89, 26);
      }

      let chipX = cx + 14;
      for (const loc of SZ.KitchenData.LOCATIONS) {
        if (loc.recipes.indexOf(r.id) < 0) continue;
        ctx.font = ui.uiFont(11, 'bold');
        if (chipX + ctx.measureText(loc.name).width + 18 > cx + CW - 10) break;
        const w = ui.drawChip(loc.name, chipX, cy + CH - 36, 22, {
          px: 11,
          color: '#ffffff',
          bg: reached ? ui.shade(loc.color, -0.15) : '#a89880',
          border: 'rgba(60,30,10,0.4)',
        });
        chipX += w + 6;
      }
      ctx.restore();
    }

    drawButton('recipes-back', 'Back', 24, 640, 150, 50, { px: 18, color: 'wood', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
  }

  NS.recipeBook = { drawRecipeBook };

})();
