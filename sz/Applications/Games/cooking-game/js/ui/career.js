;(function() {
  'use strict';

  /* The career map: five venue cards with miniatures, star counts, locks
     and the six day medals each. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { STATE_TITLE } = NS.C;
  const { ctx, ui } = NS.view;
  const { careerUnlocked, locationReached } = NS.persist;
  const { startDay } = NS.day;
  const { drawLock, cachedSprite, drawRibbon } = NS.sprites;
  const { menuScene, setScreen, registerHit, isHot, drawButton, drawMenuBackdrop, drawCoinChip } = NS.menu;

  /* Small marker on a career day button: glasses for a critic day, a bolt for
     a rush day. */
  function drawSpecialIcon(kind, x, y) {
    ctx.save();
    ctx.strokeStyle = '#ffd23f';
    ctx.fillStyle = '#ffd23f';
    ctx.lineWidth = 1.5;
    if (kind === 'critic') {
      ctx.beginPath();
      ctx.arc(x - 4, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 4, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 1, y);
      ctx.lineTo(x + 1, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 5);
      ctx.lineTo(x - 3, y + 1);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x - 1, y + 5);
      ctx.lineTo(x + 3, y - 1);
      ctx.lineTo(x, y - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDayMedal(bx, by, bs, label, color, hot, got, open) {
    const cx = bx + bs / 2, cy = by + bs / 2;
    if (hot) ui.drawGlow(cx, cy, bs * 2.2, '#ffd23f');
    const key = 'medal|' + bs + '|' + color + '|' + (open ? 1 : 0) + (got >= 3 ? 'g' : '');
    const img = cachedSprite(key, bs + 6, bs + 8, (c) => {
      const r = bs / 2;
      c.fillStyle = 'rgba(20,8,0,0.45)';
      c.beginPath();
      c.arc(r + 3, r + 6, r, 0, Math.PI * 2);
      c.fill();
      const rim = c.createLinearGradient(0, 3, 0, bs + 3);
      rim.addColorStop(0, '#fff0b0');
      rim.addColorStop(0.5, '#d8a03a');
      rim.addColorStop(1, '#7a4a10');
      c.fillStyle = rim;
      c.beginPath();
      c.arc(r + 3, r + 3, r, 0, Math.PI * 2);
      c.fill();
      const face = c.createLinearGradient(0, 6, 0, bs);
      const base = open ? (got >= 3 ? '#4cc23a' : color) : '#6a5a4a';
      face.addColorStop(0, ui.shade(base, 0.35));
      face.addColorStop(1, ui.shade(base, -0.35));
      c.fillStyle = face;
      c.beginPath();
      c.arc(r + 3, r + 3, r - 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(r + 3, r - 3, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
      c.fill();
    });
    ctx.drawImage(img, bx - 3, by - 3, bs + 6, bs + 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (open) ui.fitText(label, cx, cy + 1, bs, 18, { weight: '900', color: '#ffffff', outline: 'rgba(40,16,0,0.8)' });
  }

  function drawCareerScreen() {
    drawMenuBackdrop('truck', 0.55);
    ui.drawHeadline('Career', 640, 44, 600, 50, '#ffd23f', '#ff6a1a');
    drawCoinChip(1256, 16, G.save.coins);

    for (let li = 0; li < SZ.KitchenData.LOCATIONS.length; ++li) {
      const loc = SZ.KitchenData.LOCATIONS[li];
      const cx = 25 + li * 250, cy = 90, cw = 230, ch = 440;
      const reached = locationReached(li);
      ui.drawPanel(cx, cy, cw, ch, { accent: reached ? loc.color : ui.UI.textMute, noStuds: false });
      /* miniature of the location scene in a brass frame */
      const mx = cx + 12, my = cy + 12, mw = cw - 24, mh = 124;
      ctx.save();
      ui.roundRectPath(mx, my, mw, mh, 6);
      ctx.clip();
      ctx.save();
      ctx.translate(mx - 40, my - 10);
      ctx.scale((mw + 80) / 1280, (mw + 80) / 1280);
      menuScene(loc.theme).draw(ctx, G.animT, { x0: 0, y0: 0, x1: 1280, y1: 720 });
      menuScene(loc.theme).drawFront(ctx);
      ctx.restore();
      if (!reached) {
        ctx.fillStyle = 'rgba(10,6,4,0.72)';
        ctx.fillRect(mx, my, mw, mh);
      }
      ctx.restore();
      ui.roundRectPath(mx, my, mw, mh, 6);
      ctx.strokeStyle = '#e0b048';
      ctx.lineWidth = 3;
      ctx.stroke();
      ui.roundRectPath(mx + 2, my + 2, mw - 4, mh - 4, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      let stars = 0;
      for (let k = 0; k < 6; ++k)
        stars += G.save.stars[(li + 1) + '-' + (k + 1)] || 0;
      drawRibbon(cx + cw / 2, my + mh + 16, cw - 70, 34, loc.name, reached ? loc.color : '#6a5a4a');
      ctx.save();
      ui.drawStar(cx + cw / 2 - 28, cy + 190, 22, stars > 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(stars + ' / 18', cx + cw / 2 - 14, cy + 191, 80, 16, { weight: 'bold', color: stars ? ui.UI.gold : ui.UI.textMute });
      ctx.restore();

      if (!reached) {
        const bob = Math.sin(G.animT * 2 + li) * 3;
        drawLock(cx + cw / 2, cy + 278 + bob, 64);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.drawTextBlock('Earn a star on day ' + SZ.KitchenData.CAREER[li * 6 - 1].id, cx + 20, cy + 330, cw - 40, 40, 15, { color: ui.UI.warn, weight: 'bold', align: 'center' });
        continue;
      }

      for (let k = 0; k < 6; ++k) {
        const di = li * 6 + k;
        const day = SZ.KitchenData.CAREER[di];
        const open = careerUnlocked(di);
        const got = G.save.stars[day.id] || 0;
        const bs = 46;
        const bx = cx + 22 + (k % 3) * 66, by = cy + 214 + Math.floor(k / 3) * 84;
        const hit = registerHit('day-' + di, bx, by, bs, bs, () => startDay('career', di), !open);
        const hot = isHot(hit, bx, by, bs, bs);
        ctx.save();
        if (hot && open) {
          ctx.translate(bx + bs / 2, by + bs / 2);
          const s = 1.1 + Math.sin(G.animT * 6) * 0.03;
          ctx.scale(s, s);
          ctx.translate(-(bx + bs / 2), -(by + bs / 2));
        }
        drawDayMedal(bx, by, bs, String(k + 1), loc.color, hot && open, got, open);
        if (day.special) drawSpecialIcon(day.special, bx + bs - 4, by + 4);
        if (!open) drawLock(bx + bs / 2, by + bs / 2, 22);
        ctx.restore();
        for (let t = 0; t < 3; ++t)
          ui.drawStar(bx + bs / 2 - 15 + t * 15, by + bs + 12, 15, t < got);
        const best = G.save.best[day.id] || 0;
        if (best > 0) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ui.fitText('$' + best, bx + bs / 2, by + bs + 27, bs + 14, 11, { weight: 'bold', color: 'rgba(255,230,190,0.6)' });
        }
      }

      ctx.textAlign = 'left';
      ui.drawTextBlock(loc.recipes.map(id => SZ.KitchenData.recipeById(id).name).join(' · '), cx + 16, cy + ch - 56, cw - 32, 42, 12, { color: 'rgba(255,230,190,0.6)', align: 'center' });
    }

    drawButton('career-back', 'Back', 24, 640, 150, 50, { px: 18, color: 'wood', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select day' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' },
    ], 640, 690, 900, 1);
  }

  NS.careerScreen = { drawCareerScreen };

})();
