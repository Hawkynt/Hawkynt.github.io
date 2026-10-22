/* Card drawing: the rounded-rect primitive, text truncation, the card art and
   the full card face with cost and power gems, name, type and playability dim. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;
  const U = NS.util;

  function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath();
  }

  function drawCardArt(cardObj, cx, artX, artY, artW, artH) {
    const tc = T.TYPE_COLORS[cardObj.type];
    const cc = T.COMBO_ICONS[cardObj.combo];

    // Art area background gradient
    const artGrad = cx.createLinearGradient(artX, artY, artX, artY + artH);
    artGrad.addColorStop(0, tc.grad1);
    artGrad.addColorStop(1, U.hexAlpha(cardObj.color, '30'));
    cx.fillStyle = artGrad;
    cx.fillRect(artX, artY, artW, artH);

    // Central illustration -- large type icon
    const iconInfo = T.TYPE_ICONS[cardObj.type];
    cx.fillStyle = U.hexAlpha(cardObj.color, '60');
    cx.font = Math.floor(artH * 0.6) + 'px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(iconInfo.symbol, artX + artW / 2, artY + artH * 0.45);

    // Combo element icon smaller in corner
    if (cc) {
      cx.fillStyle = U.hexAlpha(cc.color, '80');
      cx.font = Math.floor(artH * 0.25) + 'px sans-serif';
      cx.fillText(cc.symbol, artX + artW - 10, artY + artH - 8);
    }

    // Decorative border around art
    cx.strokeStyle = U.hexAlpha(cardObj.color, '50');
    cx.lineWidth = 1;
    cx.strokeRect(artX, artY, artW, artH);

    cx.textBaseline = 'alphabetic';
  }

  function drawCard(cardObj, x, y, w, h, faceUp, hovered) {
    const ctx = D.ctx;
    const left = x - w / 2;
    const top = y - h / 2;
    const r = 5;
    const tc = T.TYPE_COLORS[cardObj.type] || T.TYPE_COLORS.attack;

    // Hover glow
    if (hovered) {
      ctx.shadowColor = cardObj.color || '#fff';
      ctx.shadowBlur = 16;
    }

    // Card body
    roundRect(ctx, left, top, w, h, r);
    if (faceUp) {
      const grad = ctx.createLinearGradient(left, top, left, top + h);
      grad.addColorStop(0, tc.grad1);
      grad.addColorStop(0.5, tc.bg);
      grad.addColorStop(1, tc.grad2);
      ctx.fillStyle = grad;
    } else {
      // Card back pattern
      const grad = ctx.createLinearGradient(left, top, left + w, top + h);
      grad.addColorStop(0, '#2a1a3e');
      grad.addColorStop(0.5, '#1a1030');
      grad.addColorStop(1, '#2a1a3e');
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = faceUp ? tc.border : '#555';
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    roundRect(ctx, left, top, w, h, r);
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (!faceUp) {
      // Card back design
      const cx = left + w / 2;
      const cy = top + h / 2;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      roundRect(ctx, left + 4, top + 4, w - 8, h - 8, 3);
      ctx.stroke();
      ctx.fillStyle = '#a6f';
      ctx.font = Math.floor(h * 0.25) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u2735', cx, cy + Math.floor(h * 0.08));
      return;
    }

    // Inner frame
    ctx.strokeStyle = tc.border + '30';
    ctx.lineWidth = 0.5;
    roundRect(ctx, left + 2, top + 2, w - 4, h - 4, 4);
    ctx.stroke();

    // ── Art area ──
    const artMargin = 4;
    const artTop = top + 22;
    const artH = h * 0.32;
    drawCardArt(cardObj, ctx, left + artMargin, artTop, w - artMargin * 2, artH);

    // ── Mana cost badge (top-left, blue gem) ──
    const costX = left + 11;
    const costY = top + 11;
    ctx.fillStyle = '#115';
    ctx.beginPath();
    ctx.arc(costX, costY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38f';
    ctx.beginPath();
    ctx.arc(costX, costY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Gem highlight
    ctx.fillStyle = '#8cf';
    ctx.beginPath();
    ctx.arc(costX - 2, costY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardObj.cost, costX, costY + 3.5);

    // ── Power badge (top-right, colored by type) ──
    const powX = left + w - 11;
    const powY = top + 11;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(powX, powY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tc.badge;
    ctx.beginPath();
    ctx.arc(powX, powY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(cardObj.power, powX, powY + 3.5);

    // ── Type icon badge (center top) ──
    const typeIcon = T.TYPE_ICONS[cardObj.type];
    ctx.fillStyle = tc.badge + '40';
    ctx.font = '10px sans-serif';
    ctx.fillText(typeIcon.symbol, x, top + 13);

    // ── Card name ──
    const nameY = artTop + artH + 12;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const displayName = w < 70 ? truncateText(cardObj.name, w - 10) : cardObj.name;
    ctx.fillText(displayName, x, nameY);

    // ── Type label with color ──
    const typeY = nameY + 11;
    ctx.fillStyle = tc.badge;
    ctx.font = '7px sans-serif';
    ctx.fillText(typeIcon.label + '  \u00b7  ' + cardObj.combo.toUpperCase(), x, typeY);

    // ── Description text ──
    const descY = typeY + 10;
    ctx.fillStyle = '#bbb';
    ctx.font = '7px sans-serif';
    const descText = w < 70 ? truncateText(cardObj.desc, w - 8) : cardObj.desc;
    ctx.fillText(descText, x, descY);

    // ── Playability indicator (dim if not enough mana) ──
    if (S.isPlayerTurn && S.state === C.STATE_PLAYING && cardObj.cost > S.playerMana) {
      roundRect(ctx, left, top, w, h, r);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = '#600';
      ctx.lineWidth = 1;
      roundRect(ctx, left, top, w, h, r);
      ctx.stroke();
    }
  }

  function truncateText(text, maxWidth) {
    // Simple character-based truncation for small card widths
    if (D.ctx.measureText(text).width <= maxWidth)
      return text;
    while (text.length > 3 && D.ctx.measureText(text + '...').width > maxWidth)
      text = text.slice(0, -1);
    return text + '...';
  }

  Object.assign(NS.cards, { roundRect, truncateText, drawCardArt, drawCard });
})();
