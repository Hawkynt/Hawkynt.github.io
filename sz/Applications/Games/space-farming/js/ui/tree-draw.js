/* Space Farming - tech tree drawing: background, cards, connectors, tabs and header.
   Reads: G.uiS, G.UW, G.UH, G.credits, G.inventory, G.spriteScale, G.uiTime, G.frameDt, G.treeLayout,
     G.treeTab, G.treeFocusId, G.treeHoverId, G.treePanning, G.dialogT, G.pointerUX, G.pointerUY,
     G.pointerInside */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { ctx, drawSprite, uiFont, fitText, drawTextBlock, UI, hexToRgba, roundRectPath, drawPanel,
    drawMeter, drawChip, drawKeyHints, addRegion, drawCloseButton, getStorageCapacity,
    getTotalInventoryCount, TREE_BRANCH_ORDER, TREE_BRANCH_LABELS, TREE_BRANCH_SHORT, TREE_BRANCH_COLORS,
    TREE_BRANCH_ICONS, TREE_GAP_X, TREE_GAP_Y, TREE_REGION_PAD, TREE_REGION_HEADER, TECH, TECH_BY_ID,
    techLevel, techOwned, isNodeDone, nodeCost, treeNodeState, itemSprite, nodeTitle, computeTreeLayout,
    treeCam, treeFlash, treeView, setTreeTab, zoomTreeAt, hitTreeNode, tryPurchaseTreeNode, closeDialog } = NS;

  /* ── Tree drawing ── */

  let treeNebula = null;

  let treeBackCanvas = null, treeBackKey = '';

  /* Gradient and drifting nebula, baked at screen size whenever the drift moves */
  function drawTreeBackground() {
    if (!treeNebula) {
      treeNebula = document.createElement('canvas');
      treeNebula.width = 700;
      treeNebula.height = 500;
      const n = treeNebula.getContext('2d');
      for (const [bx, by, br, col] of [[160, 140, 220, '60,160,90'], [520, 120, 180, '150,60,190'], [420, 380, 240, '30,130,170'], [120, 420, 160, '190,150,60']]) {
        const rg = n.createRadialGradient(bx, by, 0, bx, by, br);
        rg.addColorStop(0, `rgba(${col},0.22)`);
        rg.addColorStop(1, `rgba(${col},0)`);
        n.fillStyle = rg;
        n.fillRect(0, 0, 700, 500);
      }
      n.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 140; ++i) {
        const s = ((i * 7919) % 97) / 97;
        n.globalAlpha = 0.15 + s * 0.5;
        n.fillRect((i * 7307) % 700, (i * 5279) % 500, s > 0.8 ? 1.5 : 1, s > 0.8 ? 1.5 : 1);
      }
      n.globalAlpha = 1;
    }
    const ox = Math.round(((treeCam.x * 0.05) % 140) - 70), oy = Math.round(((treeCam.y * 0.05) % 100) - 50);
    const s = G.uiS * (window.devicePixelRatio || 1);
    const W = Math.round(G.UW * s), H = Math.round(G.UH * s);
    const key = [W, H, ox, oy].join('|');
    if (key !== treeBackKey || !treeBackCanvas) {
      treeBackKey = key;
      if (!treeBackCanvas)
        treeBackCanvas = document.createElement('canvas');
      if (treeBackCanvas.width !== W || treeBackCanvas.height !== H) {
        treeBackCanvas.width = W;
        treeBackCanvas.height = H;
      }
      const b = treeBackCanvas.getContext('2d');
      b.setTransform(s, 0, 0, s, 0, 0);
      const g = b.createLinearGradient(0, 0, 0, G.UH);
      g.addColorStop(0, '#0b0f1e');
      g.addColorStop(1, '#05060c');
      b.fillStyle = g;
      b.fillRect(0, 0, G.UW, G.UH);
      b.drawImage(treeNebula, ox - 70, oy - 50, G.UW + 140, G.UH + 100);
    }
    ctx.drawImage(treeBackCanvas, 0, 0, G.UW, G.UH);
    const V = treeView();
    const step = 64 * treeCam.z;
    if (step >= 10) {
      ctx.beginPath();
      const sx = ((treeCam.x % step) + step) % step, sy = ((treeCam.y % step) + step) % step;
      for (let x = sx; x < G.UW; x += step) {
        ctx.moveTo(Math.round(x) + 0.5, V.y);
        ctx.lineTo(Math.round(x) + 0.5, V.y + V.h);
      }
      for (let y = sy; y < G.UH; y += step) {
        if (y < V.y || y > V.y + V.h) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(G.UW, Math.round(y) + 0.5);
      }
      ctx.strokeStyle = 'rgba(110,200,150,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* Cost as "120 [coin] 8 [wheat]", red where you are short, shrunk to maxW */
  function drawCostRow(cost, x, y, maxW, px) {
    const parts = [];
    for (const k in cost)
      if ((cost[k] || 0) > 0)
        parts.push({ k, n: cost[k], ok: k === 'cr' ? G.credits >= cost[k] : (G.inventory[k] || 0) >= cost[k] });
    if (!parts.length) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText('Free', x, y + 1, maxW, px, { weight: 'bold', color: UI.good });
      return;
    }
    let size = px, total;
    for (;;) {
      ctx.font = uiFont(size, 'bold');
      total = 0;
      for (const p of parts)
        total += ctx.measureText(String(p.n)).width + size * 1.15 + size * 0.6;
      total -= size * 0.6;
      if (total <= maxW || size <= 8) break;
      --size;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x;
    for (const p of parts) {
      if (cx > x + maxW) break;
      ctx.fillStyle = p.ok ? '#d8f5dc' : '#ff8a8a';
      const label = String(p.n);
      ctx.fillText(label, cx, y + 1);
      cx += ctx.measureText(label).width + 2;
      drawSprite(itemSprite(p.k), cx + size * 0.55, y, size * 1.15, p.ok ? 1 : 0.6);
      cx += size * 1.15 + size * 0.6;
    }
  }

  function drawNodeFrame(x, y, w, h, color, st, highlight) {
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') ctx.fillStyle = hexToRgba(color, 0.26);
    else if (st === 'ready') ctx.fillStyle = highlight ? hexToRgba(color, 0.3) : hexToRgba(color, 0.16);
    else if (st === 'poor') ctx.fillStyle = highlight ? 'rgba(54,48,38,0.95)' : 'rgba(40,36,30,0.95)';
    else ctx.fillStyle = 'rgba(16,18,26,0.95)';
    ctx.fill();
    // gloss on the upper part (a rounded strip instead of a clip, which is costly)
    roundRectPath(x + 1, y + 1, w - 2, h * 0.45, 11);
    ctx.fillStyle = st === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
    } else if (st === 'ready') {
      ctx.lineWidth = 7 + Math.sin(G.uiTime * 4) * 2;
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
    } else if (st === 'poor') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,182,72,0.65)';
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(120,130,160,0.3)';
      ctx.setLineDash([6, 5]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTreeCard(ln, st, compact) {
    const n = ln.node;
    const { x, y, w, h } = ln;
    const color = TREE_BRANCH_COLORS[ln.branch];
    const hover = G.treeHoverId === n.id, focus = G.treeFocusId === n.id;
    const dim = st === 'locked';
    ctx.save();
    roundRectPath(x + 3, y + 5, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    drawNodeFrame(x, y, w, h, color, st, hover || focus);
    if (hover || focus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 15);
      if (focus) {
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(255,215,90,0.25)';
        ctx.stroke();
      }
      ctx.lineWidth = focus ? 3 : 2;
      ctx.strokeStyle = focus ? UI.gold : 'rgba(255,255,255,0.85)';
      ctx.stroke();
    }
    roundRectPath(x + 10, y + 10, 44, 44, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dim ? 'rgba(255,255,255,0.06)' : hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(n.icon, x + 32, y + 32, 34, dim ? 0.4 : 1);
    if (n.chain) {
      const k = n.tiers;
      const pw = Math.min(8, (40 - (k - 1) * 2) / k);
      let px = x + 32 - (k * pw + (k - 1) * 2) / 2;
      for (let i = 1; i <= k; ++i) {
        const owned = techOwned(n.chain + i);
        ctx.fillStyle = owned ? color : (i === n.tier ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.14)');
        ctx.fillRect(px, y + 62, pw, 6);
        if (i === n.tier) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, y + 70, pw, 2);
        }
        px += pw + 2;
      }
    } else if (n.unlock) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('UNLOCK', x + 32, y + 68, 50, 10, { weight: 'bold', color: dim ? UI.textMute : hexToRgba(color, 0.95), minPx: 7 });
    } else if (n.repeat) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Lv ' + techLevel(n.id), x + 32, y + 68, 50, 11, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 7 });
    }
    if (st === 'owned')
      drawSprite('check', x + w - 18, y + 18, 22);
    else if (st === 'locked')
      drawSprite('lock', x + w - 18, y + 18, 20, 0.7);
    const textX = x + 64;
    const textW = w - 64 - (st === 'owned' || st === 'locked' ? 32 : 10);
    const nameColor = dim ? '#6a7288' : (st === 'owned' ? '#ffffff' : UI.text);
    if (compact)
      drawTextBlock(nodeTitle(n), textX, y + 8, textW, h - 16, 24, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 14, lineGap: 1.1 });
    else {
      drawTextBlock(nodeTitle(n), textX, y + 7, textW, 44, 17, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 11, lineGap: 1.15 });
      if (st === 'owned') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText('Owned', textX, y + h - 18, w - 64 - 12, 14, { weight: 'bold', color });
      } else {
        ctx.save();
        if (dim) ctx.globalAlpha *= 0.55;
        drawCostRow(nodeCost(n), textX, y + h - 18, w - 64 - 12, 15);
        ctx.restore();
      }
    }
    const flash = treeFlash[n.id];
    if (flash !== undefined) {
      const t = (G.uiTime - flash) / 0.6;
      if (t >= 1) delete treeFlash[n.id];
      else {
        roundRectPath(x - t * 16, y - t * 16, w + t * 32, h + t * 32, 12 + t * 10);
        ctx.lineWidth = 4 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
        roundRectPath(x, y, w, h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Orthogonal connector with rounded corners through the channels between cards */
  function strokeTreeConnector(parent, child) {
    const px = parent.x + parent.w, py = parent.y + parent.h / 2;
    const cx = child.x, cy = child.y + child.h / 2;
    const x1 = px + TREE_GAP_X / 2, x2 = cx - TREE_GAP_X / 2;
    const pts = [[px, py]];
    if (Math.abs(py - cy) < 0.5)
      pts.push([cx, cy]);
    else if (Math.abs(x1 - x2) < 0.5)
      pts.push([x1, py], [x1, cy], [cx, cy]);
    else {
      const chY = cy > py ? child.y - TREE_GAP_Y / 2 : child.y + child.h + TREE_GAP_Y / 2;
      pts.push([x1, py], [x1, chY], [x2, chY], [x2, cy], [cx, cy]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; ++i)
      ctx.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 10);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
  }

  function drawTreeContent() {
    const V = treeView();
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    ctx.translate(treeCam.x, treeCam.y);
    ctx.scale(treeCam.z, treeCam.z);
    G.spriteScale = G.uiS * treeCam.z * (window.devicePixelRatio || 1);
    const viewL = (V.x - treeCam.x) / treeCam.z, viewT = (V.y - treeCam.y) / treeCam.z;
    const viewR = viewL + V.w / treeCam.z, viewB = viewT + V.h / treeCam.z;
    const compact = treeCam.z < 0.6;
    for (const branch of TREE_BRANCH_ORDER) {
      const r = G.treeLayout.regions[branch];
      if (r.x > viewR || r.x + r.w < viewL || r.y > viewB || r.y + r.h < viewT) continue;
      const color = TREE_BRANCH_COLORS[branch];
      roundRectPath(r.x, r.y, r.w, r.h, 22);
      ctx.fillStyle = hexToRgba(color, 0.045);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.stroke();
      let owned = 0, total = 0;
      for (const n of TECH)
        if (n.branch === branch && !n.repeat) {
          ++total;
          if (techOwned(n.id)) ++owned;
        }
      const headPx = compact ? Math.min(48, 20 / treeCam.z) : 30;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawSprite(TREE_BRANCH_ICONS[branch], r.x + TREE_REGION_PAD + headPx * 0.6, r.y + TREE_REGION_HEADER / 2, headPx * 1.2);
      const lx = r.x + TREE_REGION_PAD + headPx * 1.4;
      const labelW = fitText(TREE_BRANCH_LABELS[branch], lx, r.y + TREE_REGION_HEADER / 2, r.w * 0.55, headPx, { weight: 'bold', color });
      const mx = lx + labelW + 24;
      const mw = Math.min(260, r.x + r.w - TREE_REGION_PAD - mx - 90);
      if (mw > 40) {
        drawMeter(mx, r.y + TREE_REGION_HEADER / 2 - 6, mw, 12, owned / total, color);
        fitText(`${owned} / ${total}`, mx + mw + 12, r.y + TREE_REGION_HEADER / 2, 80, compact ? headPx * 0.6 : 18, { weight: 'bold', color: UI.textDim });
      }
    }
    const edges = [[], [], []];
    for (const ln of G.treeLayout.nodes)
      for (const pid of ln.node.prereqs) {
        const parent = G.treeLayout.byId[pid];
        if (!parent || parent.branch !== ln.branch) continue;
        const minX = Math.min(parent.x, ln.x) - TREE_GAP_X, maxX = Math.max(parent.x + parent.w, ln.x + ln.w) + TREE_GAP_X;
        const minY = Math.min(parent.y, ln.y) - TREE_GAP_Y, maxY = Math.max(parent.y + parent.h, ln.y + ln.h) + TREE_GAP_Y;
        if (minX > viewR || maxX < viewL || minY > viewB || maxY < viewT) continue;
        const pOwned = techOwned(pid);
        edges[pOwned ? (isNodeDone(ln.node) ? 2 : 1) : 0].push([parent, ln]);
      }
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 3; ++pass)
      for (const [parent, ln] of edges[pass]) {
        const color = TREE_BRANCH_COLORS[ln.branch];
        if (pass === 0) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(130,140,170,0.28)';
          ctx.setLineDash([7, 7]);
        } else if (pass === 1) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = hexToRgba(color, 0.7);
          ctx.setLineDash([]);
        } else {
          ctx.lineWidth = 4;
          ctx.strokeStyle = color;
          ctx.setLineDash([]);
        }
        strokeTreeConnector(parent, ln);
      }
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    for (const ln of G.treeLayout.nodes) {
      if (ln.x > viewR || ln.x + ln.w < viewL || ln.y > viewB || ln.y + ln.h < viewT) continue;
      drawTreeCard(ln, treeNodeState(ln.node), compact);
    }
    ctx.restore();
    G.spriteScale = G.uiS * (window.devicePixelRatio || 1);
  }

  function treeTabs() {
    const ids = ['all'].concat(TREE_BRANCH_ORDER);
    const gap = 8;
    const tabW = Math.min(180, Math.floor((G.UW - 40 - (ids.length - 1) * gap) / ids.length));
    const x0 = G.UW / 2 - (ids.length * tabW + (ids.length - 1) * gap) / 2;
    return ids.map((id, i) => ({ id, x: x0 + i * (tabW + gap), y: 62, w: tabW, h: 32 }));
  }

  function drawTreeDialog() {
    computeTreeLayout();
    G.dialogT = Math.min(1, G.dialogT + G.frameDt * 6);
    if (!G.treePanning) {
      const all = G.treeLayout.regions.all, V = treeView(), keep = 140;
      treeCam.tx = Math.min(V.x + V.w - keep - all.x * treeCam.tz, Math.max(V.x + keep - (all.x + all.w) * treeCam.tz, treeCam.tx));
      treeCam.ty = Math.min(V.y + V.h - keep - all.y * treeCam.tz, Math.max(V.y + keep - (all.y + all.h) * treeCam.tz, treeCam.ty));
      const k = 1 - Math.exp(-G.frameDt * 14);
      treeCam.z += (treeCam.tz - treeCam.z) * k;
      treeCam.x += (treeCam.tx - treeCam.x) * k;
      treeCam.y += (treeCam.ty - treeCam.y) * k;
    }
    const e = 1 - Math.pow(1 - G.dialogT, 3);
    addRegion({ id: 'tree-scrim', x: 0, y: 0, w: G.UW, h: G.UH, modal: true });
    ctx.save();
    ctx.globalAlpha *= e;
    drawTreeBackground();
    const V = treeView();
    addRegion({
      id: 'tree-view', x: V.x, y: V.y, w: V.w, h: V.h, modal: true,
      onWheel: (dy) => zoomTreeAt(G.pointerUX, G.pointerUY, dy < 0 ? 1.12 : 1 / 1.12),
      onDragStart: () => { G.treePanning = { x: G.pointerUX, y: G.pointerUY, tx: treeCam.x, ty: treeCam.y, moved: false }; },
      onDrag: () => {
        if (!G.treePanning) return;
        const dx = G.pointerUX - G.treePanning.x, dy = G.pointerUY - G.treePanning.y;
        if (Math.hypot(dx, dy) > 4) G.treePanning.moved = true;
        treeCam.x = treeCam.tx = G.treePanning.tx + dx;
        treeCam.y = treeCam.ty = G.treePanning.ty + dy;
        treeCam.tz = treeCam.z;
      },
      onDragEnd: (button) => {
        const moved = G.treePanning && G.treePanning.moved;
        G.treePanning = null;
        // a left click on a card buys it; right and middle buttons only pan
        if (!moved && !button) {
          const ln = hitTreeNode(G.pointerUX, G.pointerUY);
          if (ln) {
            G.treeFocusId = ln.node.id;
            tryPurchaseTreeNode(ln.node);
          }
        }
      },
      tipKey: () => { const ln = hitTreeNode(G.pointerUX, G.pointerUY); return ln ? 'tree:' + ln.node.id + ':' + treeNodeState(ln.node) + ':' + techLevel(ln.node.id) : 'tree:none'; },
      tip: () => { const ln = hitTreeNode(G.pointerUX, G.pointerUY); return ln ? buildTechTooltip(ln.node) : null; }
    });
    const hv = hitTreeNode(G.pointerUX, G.pointerUY);
    G.treeHoverId = hv && G.pointerInside ? hv.node.id : null;
    drawTreeContent();
    drawTreeHeader();
    ctx.restore();
  }

  function drawTreeHeader() {
    drawPanel(10, 6, G.UW - 20, 100, { accent: UI.gold, radius: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawSprite('techtree', 34, 32, 28);
    fitText('Tech Tree', 54, 32, 220, 24, { weight: 'bold', color: UI.gold });
    let owned = 0, total = 0;
    for (const n of TECH)
      if (!n.repeat) {
        ++total;
        if (techOwned(n.id)) ++owned;
      }
    const mw = Math.min(220, G.UW * 0.2);
    drawMeter(G.UW - 70 - mw, 26, mw, 12, owned / total, UI.gold);
    ctx.textAlign = 'right';
    fitText(`${owned} / ${total}`, G.UW - 80 - mw, 32, 90, 15, { weight: 'bold', color: UI.textDim });
    // credits and storage at a glance
    ctx.textAlign = 'left';
    const credX = 290;
    const credW = G.UW - 70 - mw - 90 - credX - 40;
    if (credW > 120)
      fitText(`[[coin]] ${Math.round(G.credits).toLocaleString('en-US')}   [[basket]] ${getTotalInventoryCount()} / ${getStorageCapacity()}`, credX, 32, credW, 15, { weight: 'bold', color: UI.text });
    drawCloseButton('tree-close', G.UW - 46, 18, 26, closeDialog);
    for (const t of treeTabs()) {
      const active = G.treeTab === t.id;
      const hover = G.pointerUX >= t.x && G.pointerUX <= t.x + t.w && G.pointerUY >= t.y && G.pointerUY <= t.y + t.h;
      const color = t.id === 'all' ? UI.gold : TREE_BRANCH_COLORS[t.id];
      roundRectPath(t.x, t.y, t.w, t.h, 9);
      ctx.fillStyle = active ? hexToRgba(color, 0.24) : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeStyle = active ? color : 'rgba(255,255,255,0.1)';
      ctx.stroke();
      let label = t.id === 'all' ? 'All' : TREE_BRANCH_SHORT[t.id];
      if (t.id !== 'all') {
        let o = 0, c = 0, ready = 0;
        for (const n of TECH)
          if (n.branch === t.id && !n.repeat) {
            ++c;
            if (techOwned(n.id)) ++o;
            else if (treeNodeState(n) === 'ready') ++ready;
          }
        label += `  ${o}/${c}`;
        if (ready)
          drawChip(String(ready), t.x + t.w - 4, t.y - 6, 16, { align: 'right', px: 10, bg: color, color: '#10141e' });
      }
      if (t.id === 'all')
        drawSprite('techtree', t.x + 18, t.y + t.h / 2, 16);
      else
        drawSprite(TREE_BRANCH_ICONS[t.id], t.x + 18, t.y + t.h / 2, 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, t.x + 32, t.y + t.h / 2 + 1, t.w - 40, 14, { weight: 'bold', color: active ? '#fff' : UI.textDim });
      addRegion({ id: 'tree-tab-' + t.id, x: t.x, y: t.y, w: t.w, h: t.h, modal: true, onClick: () => setTreeTab(t.id), tip: () => t.id === 'all' ? ['All branches', 'Shortcut: 1 or Tab'] : [`[[${TREE_BRANCH_ICONS[t.id]}]] ${TREE_BRANCH_LABELS[t.id].charAt(0) + TREE_BRANCH_LABELS[t.id].slice(1).toLowerCase()}`, ['Crops, soil and harvests', 'Animals and their produce', 'Buildings, energy, automation and land', 'Weather, pests and new crop species', 'Prices, storage and trade'][TREE_BRANCH_ORDER.indexOf(t.id)], 'Shortcut: Tab'] });
    }
    // Footer: legend and controls
    const fy = G.UH - 44;
    drawPanel(10, fy, G.UW - 20, 38, { radius: 12, shadow: 8, accent: '#6a8ac8' });
    let lx = 26;
    for (const [label, st] of [['Owned', 'owned'], ['Can buy', 'ready'], ['Need more', 'poor'], ['Locked', 'locked']]) {
      roundRectPath(lx, fy + 11, 24, 16, 5);
      ctx.fillStyle = st === 'owned' ? hexToRgba(UI.leaf, 0.35) : (st === 'ready' ? hexToRgba(UI.leaf, 0.18) : (st === 'poor' ? 'rgba(40,36,30,0.95)' : 'rgba(16,18,26,0.95)'));
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : (st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.leaf);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lx += 30 + fitText(label, lx + 30, fy + 20, 110, 13, { color: UI.textDim }) + 18;
    }
    drawKeyHints([
      { key: 'Wheel', label: 'Zoom' }, { key: 'Drag', label: 'Pan' }, { key: '←↑→↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' }, { key: 'Tab', label: 'Branch' }, { key: 'Esc', label: 'Close' }
    ], (lx + G.UW - 20) / 2, fy + 19, G.UW - 20 - lx - 16);
  }

  function buildTechTooltip(n) {
    const st = treeNodeState(n);
    const lines = [`[[${n.icon}]] ${nodeTitle(n)}`, n.desc];
    lines.push(`${TREE_BRANCH_LABELS[n.branch].charAt(0) + TREE_BRANCH_LABELS[n.branch].slice(1).toLowerCase()}` + (n.chain ? ` · tier ${n.tier} of ${n.tiers}` : '') + (n.repeat ? ` · level ${techLevel(n.id)}` : ''));
    if (st === 'owned') {
      lines.push('✔ Owned');
      return lines;
    }
    if (n.prereqs.length) {
      lines.push('--- Requires ---');
      for (const p of n.prereqs)
        lines.push((techOwned(p) ? '✔ ' : '✘ ') + nodeTitle(TECH_BY_ID[p]));
    }
    const cost = nodeCost(n);
    lines.push('--- Cost ---');
    for (const k in cost) {
      if (!cost[k]) continue;
      const have = k === 'cr' ? Math.floor(G.credits) : (G.inventory[k] || 0);
      lines.push((have >= cost[k] ? '✔ ' : '✘ ') + `[[${itemSprite(k)}]] ${k === 'cr' ? 'Credits' : k}: ${have} / ${cost[k]}`);
    }
    if (st === 'ready')
      lines.push('Click or Enter to buy');
    return lines;
  }

  Object.assign(NS, { drawCostRow, drawNodeFrame, drawTreeDialog, buildTechTooltip });

})();
