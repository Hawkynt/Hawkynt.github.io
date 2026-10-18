/* Space Farming - the shared modal dialog frame and the livestock dialog.
   Reads: G.UW, G.UH, G.credits, G.livestockPens, G.uiTime, G.frameDt, G.dialogT */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { LIVESTOCK, ctx, drawSprite, fitText, UI, roundRectPath, drawPanel, drawChip, drawKeyHints,
    drawScrim, addRegion, hoverAmount, drawButton, getEffectiveProduceValue, buyLivestock, unlockedByTech,
    isAnimalUnlocked, nodeTitle, openTree, lockedTooltip, closeDialog, getFeedInterval,
    buildLivestockBuyTooltip } = NS;

  /* Scrim + centred animated panel; returns the content rect */
  function beginDialog(title, w, h, opts) {
    opts = opts || {};
    G.dialogT = Math.min(1, G.dialogT + G.frameDt * 6);
    const e = 1 - Math.pow(1 - G.dialogT, 3);
    ctx.save();
    ctx.globalAlpha *= e;
    drawScrim(0.55);
    ctx.restore();
    addRegion({ id: 'dlg-scrim', x: 0, y: 0, w: G.UW, h: G.UH, modal: true, onClick: opts.closeOnScrim === false ? null : closeDialog });
    w = Math.min(w, G.UW - 24);
    h = Math.min(h, G.UH - 24);
    const x = Math.round(G.UW / 2 - w / 2), y = Math.round(G.UH / 2 - h / 2);
    ctx.save();
    ctx.globalAlpha *= e;
    const s = 0.94 + 0.06 * e;
    ctx.translate(G.UW / 2, G.UH / 2);
    ctx.scale(s, s);
    ctx.translate(-G.UW / 2, -G.UH / 2);
    addRegion({ id: 'dlg-panel', x, y, w, h, modal: true });
    const top = drawPanel(x, y, w, h, { title, icon: opts.icon, accent: opts.accent || UI.gold, headerH: 42, titlePx: 20, titleRight: opts.titleRight, titleRightColor: opts.titleRightColor, closeId: 'dlg-close', radius: 14 });
    return { x: x + 16, y: top, w: w - 32, h: y + h - top - 12, px: x, py: y, pw: w, ph: h };
  }

  function endDialog() {
    ctx.restore();
  }

  /* ── Upgrade shop (permanent farm upgrades) ── */




  /* ── Livestock shop ── */

  function drawLivestockDialog() {
    const c = beginDialog('Livestock', 660, 470, { icon: 'paw', accent: '#ff9ac0', titleRight: `${Math.round(G.credits).toLocaleString('en-US')} [[coin]]`, titleRightColor: UI.gold });
    const cols = c.w >= 520 ? 2 : 1;
    const gap = 10;
    const cardW = (c.w - gap * (cols - 1)) / cols;
    const cardH = Math.min(104, (c.h - 30 - gap * 2) / 3);
    LIVESTOCK.forEach((def, i) => {
      const x = c.x + (i % cols) * (cardW + gap);
      const y = c.y + Math.floor(i / cols) * (cardH + gap);
      const owned = G.livestockPens.filter(p => p.typeIndex === i).length;
      const afford = G.credits >= def.cost;
      const id = 'buy-animal-' + i;
      const hv = hoverAmount(id);
      if (!isAnimalUnlocked(i)) {
        const n = unlockedByTech('animals', i);
        roundRectPath(x, y, cardW, cardH, 12);
        ctx.fillStyle = 'rgba(16,18,26,0.95)';
        ctx.fill();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(120,130,160,0.4)';
        ctx.stroke();
        ctx.setLineDash([]);
        roundRectPath(x + 10, y + 10, 60, 60, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        drawSprite(def.sprite, x + 40, y + 40, 48, 0.25);
        drawSprite('lock', x + 40, y + 42, 24);
        const tx = x + 80, tw = cardW - 92;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(def.name, tx, y + 20, tw, 16, { weight: 'bold', color: '#7a8298' });
        fitText(`[[${def.produceSprite}]] ${def.produce}, worth ${getEffectiveProduceValue(def)} cr`, tx, y + 42, tw, 12, { color: UI.textMute });
        if (n)
          drawButton({ id, x: tx, y: y + cardH - 34, w: tw, h: 26 }, { label: `Unlock: ${nodeTitle(n)}`, icon: 'techtree', px: 11, onClick: () => openTree(n.id), tip: () => lockedTooltip('animals', i) });
        return;
      }
      roundRectPath(x, y, cardW, cardH, 12);
      ctx.fillStyle = afford ? `rgba(255,154,192,${0.08 + hv * 0.06})` : 'rgba(40,36,30,0.9)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = afford ? 'rgba(255,154,192,0.5)' : 'rgba(255,182,72,0.45)';
      ctx.stroke();
      roundRectPath(x + 10, y + 10, 60, 60, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      drawSprite(def.sprite, x + 40, y + 40 + Math.sin(G.uiTime * 3 + i) * 1.5, 48);
      if (owned)
        drawChip(`×${owned}`, x + 40, y + 76, 18, { align: 'center', px: 11, bg: 'rgba(0,0,0,0.5)', color: UI.text });
      const tx = x + 80, tw = cardW - 80 - 12;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(def.name, tx, y + 20, tw, 16, { weight: 'bold', color: UI.text });
      fitText(`[[${def.produceSprite}]] ${def.produce} every ${getFeedInterval(def)}s`, tx, y + 42, tw, 12, { color: UI.textDim });
      fitText(`Worth ${getEffectiveProduceValue(def)} cr each`, tx, y + 60, tw, 12, { color: UI.gold });
      drawButton({ id, x: tx, y: y + cardH - 34, w: tw, h: 26 }, { label: `Buy · ${def.cost} [[coin]]`, primary: afford, color: '#ff9ac0', px: 12, disabled: !afford, onClick: () => buyLivestock(i), onDisabled: () => SZ.GameAudio.play('error'), tip: () => buildLivestockBuyTooltip(i) });
    });
    drawKeyHints([{ key: 'Click', label: 'Buy' }, { key: 'L', label: 'Close' }], c.x + c.w / 2, c.y + c.h - 8, c.w);
    endDialog();
  }

  Object.assign(NS, { beginDialog, endDialog, drawLivestockDialog });

})();
