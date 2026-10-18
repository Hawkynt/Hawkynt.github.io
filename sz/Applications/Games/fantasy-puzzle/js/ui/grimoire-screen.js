/* The Grimoire screen: branch tabs, connectors and node cards. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TREE, TREE_BRANCHES, TREE_BY_ID } = NS.consts;
  const { ctx, ui, Fx, fxMenu } = NS.context;
  const { treeLevel, buildTreeLayout, selectFirstInBranch, romanNumeral, treeMaxedCount } = NS.grimoire;
  const { arcaneCircle } = NS.sprites;
  const { drawMenuBackdrop, drawShardsChip } = NS.widgets;

  function drawGrimoire() {
    const layout = buildTreeLayout();
    G.treeLayout = layout;
    if (!G.treeSelected || !layout.cards.some(function(c) { return c.node.id === G.treeSelected; }))
      selectFirstInBranch();
    if (G.mouseX >= 0) {
      for (const card of layout.cards) {
        if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
          G.treeSelected = card.node.id;
          break;
        }
      }
    }

    drawMenuBackdrop(4, 'rgba(4,6,14,0.72)');
    /* the great inscription circle turning slowly behind the tree */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.translate(640, 400);
    ctx.rotate(G.time * 0.04);
    ctx.drawImage(arcaneCircle(), -330, -330, 660, 660);
    ctx.rotate(-G.time * 0.1);
    ctx.globalAlpha = 0.18;
    ctx.drawImage(arcaneCircle(), -200, -200, 400, 400);
    ctx.restore();
    fxMenu.update(G.frameDt);
    Fx.ambient(fxMenu, 4, VIEW_W, VIEW_H, G.frameDt);
    fxMenu.draw(ctx);

    ui.drawPanel(24, 20, 1232, 76, { accent: '#c04cff' });
    ui.drawHeadline('Grimoire', 150, 58, 260, 46, '#e8b0ff', '#7a2ad0');
    drawShardsChip(1236, 44);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ui.fitText(treeMaxedCount() + ' / ' + TREE.length + ' runes inscribed', 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    for (const tab of layout.tabs) {
      const active = tab.index === G.treeBranch;
      if (active) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(Fx.sprite('glow', tab.branch.color), tab.x - 20, tab.y - 24, tab.w + 40, tab.h + 48);
        ctx.restore();
      }
      ui.drawPanel(tab.x, tab.y, tab.w, tab.h, {
        radius: 8, noStuds: true, glow: active, accent: tab.branch.color,
        top: ui.hexToRgba(ui.shade(tab.branch.color, -0.45), active ? 0.95 : 0.6), bottom: ui.hexToRgba(ui.shade(tab.branch.color, -0.8), active ? 0.95 : 0.6)
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(tab.branch.name + ' ' + tab.maxed + '/' + tab.total, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';

    /* connectors under the cards */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (const [reqId, reqLevel] of card.node.req) {
        const from = byId[reqId];
        if (!from)
          continue;
        const met = treeLevel(reqId) >= reqLevel;
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 7;
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.25) : 'rgba(0,0,0,0.4)';
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.9) : '#4a4460';
        ctx.stroke();
        if (met) {
          /* motes of power flowing along an inscribed link */
          const len = (midX - x1) + Math.abs(y2 - y1) + (x2 - midX);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let m = 0; m < 3; ++m) {
            let d = ((G.time * 90 + m * len / 3) % len);
            let px, py;
            if (d < midX - x1) { px = x1 + d; py = y1; }
            else if ((d -= midX - x1) < Math.abs(y2 - y1)) { px = midX; py = y1 + Math.sign(y2 - y1) * d; }
            else { d -= Math.abs(y2 - y1); px = midX + d; py = y2; }
            ctx.drawImage(Fx.sprite('spark', layout.branch.color), px - 9, py - 9, 18, 18);
          }
          ctx.restore();
        }
      }
    }

    for (const card of layout.cards) {
      if (card.node.id !== G.treeSelected)
        continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.1 * Math.sin(G.time * 3);
      ctx.drawImage(Fx.sprite('glow', layout.branch.color), card.x - 60, card.y - 60, card.w + 120, card.h + 120);
      ctx.restore();
    }
    for (const card of layout.cards)
      drawTreeNodeCard(card);

    for (const card of layout.cards) {
      if (card.node.id !== G.treeSelected)
        continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = ui.hexToRgba('#ffd75a', 0.75 + 0.25 * Math.sin(G.time * 4));
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Tab/1-4', label: 'Branch' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 694, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(G.time * 4));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 27, 230, 21, { weight: 'bold', color: '#f4e6c4', font: ui.TITLE_FONT });
    ui.drawChip((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

    for (let l = 0; l < max; ++l) {
      const px = card.x + 16 + l * 20;
      const py = card.y + card.h - 18;
      ui.roundRectPath(px, py, 16, 8, 2);
      ctx.fillStyle = l < level ? branch.color : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (l >= level) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    }

    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText(node.costs[level] + ' shards', card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    if (locked) {
      const missing = [];
      for (const [reqId, reqLevel] of node.req) {
        if (treeLevel(reqId) < reqLevel)
          missing.push(TREE_BY_ID[reqId].name + ' ' + romanNumeral(reqLevel));
      }
      ctx.textAlign = 'center';
      ui.fitText('Requires ' + missing.join(', '), card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    if (G.treeBuyFlash && G.treeBuyFlash.id === node.id) {
      const f = 1 - (G.time - G.treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  NS.grimoireScreen = { drawGrimoire };
})();
